import { Injectable, Logger } from '@nestjs/common';
import { BookingStatus, CustomerType, PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../common/prisma.service';
import { GoogleSheetsClient } from './google-sheets.client';
import { buildRouteString, convertBookingToSheetRow, formatFlightDate } from './booking-to-row.util';
import { ImportPreviewRow, ImportResult, SheetRow, SyncResult } from './dto/sheet-row.dto';
import {
  BOOKING_SHEET_COLUMNS,
  BOOKING_SHEET_TEMPLATE_VERSION,
  buildSheetColumnMap,
  getSheetCellValue,
  getSheetNumberValue,
  hasAnySheetValue,
  normalizeSheetHeader,
  sheetRowToValues,
} from './sheet-template.util';

type ParsedSheetImportRow = SheetRow & {
  rowIndex: number;
  raw: Partial<Record<keyof SheetRow, string>>;
  hasStructuredSnapshot: boolean;
  snapshot: Record<string, any> | null;
};

type ExistingBookingRecord = {
  id: string;
  bookingCode: string;
  pnr: string | null;
  status: BookingStatus;
  contactName: string;
  contactPhone: string;
};

type ExistingBookingLookup = {
  byId: Map<string, ExistingBookingRecord>;
  byBookingCode: Map<string, ExistingBookingRecord>;
  byPnr: Map<string, ExistingBookingRecord>;
};

@Injectable()
export class SheetSyncService {
  private logger = new Logger(SheetSyncService.name);

  constructor(
    private prisma: PrismaService,
    private sheetsClient: GoogleSheetsClient,
  ) {}

  async fetchBookingsForExport(filter?: {
    from?: Date;
    to?: Date;
    status?: string[];
  }): Promise<SheetRow[]> {
    const where: Prisma.BookingWhereInput = { deletedAt: null };

    if (filter?.status?.length) {
      where.status = { in: filter.status as BookingStatus[] };
    }

    if (filter?.from || filter?.to) {
      where.createdAt = {};
      if (filter.from) {
        where.createdAt.gte = filter.from;
      }
      if (filter.to) {
        where.createdAt.lte = filter.to;
      }
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        tickets: {
          include: { passenger: true },
          orderBy: { departureTime: 'asc' },
        },
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            customerCode: true,
            type: true,
            dateOfBirth: true,
            companyName: true,
          },
        },
        staff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
          },
        },
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            contactName: true,
          },
        },
        payments: {
          orderBy: { paidAt: 'desc' },
        },
        statusHistory: {
          orderBy: { createdAt: 'asc' },
        },
        ledgers: {
          select: {
            id: true,
            code: true,
            direction: true,
            status: true,
            remaining: true,
            totalAmount: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return bookings.map((booking, index) => convertBookingToSheetRow(booking, index + 1));
  }

  async pushToSheets(options: {
    mode: 'APPEND' | 'REPLACE_ALL';
    from?: string;
    to?: string;
    statuses?: string[];
  }): Promise<SyncResult> {
    try {
      const rows = await this.fetchBookingsForExport({
        from: options.from ? new Date(options.from) : undefined,
        to: options.to ? new Date(options.to) : undefined,
        status: options.statuses ?? ['ISSUED', 'COMPLETED'],
      });

      const values = rows.map((row) => sheetRowToValues(row));
      const rowsWritten = options.mode === 'REPLACE_ALL'
        ? await this.sheetsClient.clearAndWriteAll(values)
        : await this.sheetsClient.appendRows(values);

      return {
        success: true,
        rowsProcessed: rows.length,
        rowsWritten,
        sheetUrl: this.sheetsClient.spreadsheetUrl,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred while syncing.';
      this.logger.error('Push to Sheets failed', error);
      return {
        success: false,
        rowsProcessed: 0,
        rowsWritten: 0,
        sheetUrl: this.sheetsClient.spreadsheetUrl,
        error: message,
      };
    }
  }

  async getSheetInfo() {
    return this.sheetsClient.getSheetInfo();
  }

  async previewFromSheets(options?: {
    startRow?: number;
    maxRows?: number;
  }): Promise<{ rows: ImportPreviewRow[]; totalSheetRows: number }> {
    return this.previewParsedRows(this.parseSheetRows(await this.sheetsClient.readSheet()), options);
  }

  async previewFromExcel(
    buffer: Uint8Array,
    options?: {
      startRow?: number;
      maxRows?: number;
    },
  ): Promise<{ rows: ImportPreviewRow[]; totalSheetRows: number }> {
    const workbookRows = await this.readExcelRows(buffer);
    return this.previewParsedRows(this.parseSheetRows(workbookRows), options);
  }

  async importFromSheets(selectedRowIndices: number[]): Promise<ImportResult> {
    return this.importParsedRows(this.parseSheetRows(await this.sheetsClient.readSheet()), selectedRowIndices);
  }

  async importFromExcel(buffer: Uint8Array, selectedRowIndices: number[]): Promise<ImportResult> {
    const workbookRows = await this.readExcelRows(buffer);
    return this.importParsedRows(this.parseSheetRows(workbookRows), selectedRowIndices);
  }

  private async importRow(
    row: ParsedSheetImportRow,
    existing: ExistingBookingRecord | undefined,
    existingLookup: ExistingBookingLookup,
    defaultStaffId: string,
    result: ImportResult,
  ) {
    try {
      const booking = await this.prisma.$transaction(async (tx) => {
        const customerId = await this.resolveCustomerId(tx, row);
        const staffId = await this.resolveStaffId(tx, row, defaultStaffId);
        const supplierId = await this.resolveSupplierId(tx, row);
        const createdAt = this.resolveDate(row, 'createdAt') ?? new Date();
        const issuedAt = this.resolveDate(row, 'issuedAtIso');
        const totalSellPrice = this.pickNumber(row, 'sellPrice', this.pickSnapshotNumber(row, 'totalSellPrice'));
        const totalNetPrice = this.pickNumber(row, 'costPrice', this.pickSnapshotNumber(row, 'totalNetPrice'));
        const totalFees = this.pickNumber(row, 'totalFees', this.pickSnapshotNumber(row, 'totalFees'));
        const profit = this.pickNumber(
          row,
          'profit',
          this.pickSnapshotNumber(row, 'profit') || (totalSellPrice - totalNetPrice - totalFees),
        );
        const bookingCode = existing?.bookingCode
          || this.pickText(row, 'bookingCode')
          || await this.generateBookingCode(tx, createdAt);
        const bookingStatus = this.resolveBookingStatus(row);
        const paymentStatus = this.resolvePaymentStatus(row);
        const paymentMethod = this.resolvePaymentMethod(row);
        const bookingSource = this.resolveBookingSource(row);
        const contactName = this.pickText(row, 'contactName')
          || this.pickText(row, 'customerName')
          || 'Khách hàng mới';
        const contactPhone = this.pickText(row, 'contactPhone')
          || this.pickSnapshotCustomerPhone(row)
          || this.buildTemporaryPhone('BOOKING');
        const pnr = this.pickText(row, 'pnr')?.toUpperCase() || null;

        const baseData: Prisma.BookingUncheckedCreateInput = {
          bookingCode,
          customerId,
          staffId,
          status: bookingStatus,
          source: bookingSource,
          contactName,
          contactPhone,
          totalSellPrice,
          totalNetPrice,
          totalFees,
          profit,
          paymentMethod,
          paymentStatus,
          pnr,
          gdsBookingId: this.pickText(row, 'gdsBookingId') || null,
          supplierId,
          notes: this.pickText(row, 'note') || null,
          internalNotes: this.pickText(row, 'internalNotes') || null,
          createdAt,
          issuedAt: issuedAt ?? undefined,
        };

        const persistedBooking = existing
          ? await tx.booking.update({
              where: { id: existing.id },
              data: {
                customerId,
                staffId,
                status: bookingStatus,
                source: bookingSource,
                contactName,
                contactPhone,
                totalSellPrice,
                totalNetPrice,
                totalFees,
                profit,
                paymentMethod,
                paymentStatus,
                pnr,
                gdsBookingId: baseData.gdsBookingId,
                supplierId,
                notes: baseData.notes,
                internalNotes: baseData.internalNotes,
                issuedAt: issuedAt ?? undefined,
              },
            })
          : await tx.booking.create({ data: baseData });

        if (!existing) {
          await tx.bookingStatusLog.create({
            data: {
              bookingId: persistedBooking.id,
              fromStatus: 'NEW',
              toStatus: bookingStatus,
              changedBy: staffId,
              reason: 'Imported from Google Sheets',
            },
          });
        } else if (bookingStatus !== existing.status) {
          await tx.bookingStatusLog.create({
            data: {
              bookingId: persistedBooking.id,
              fromStatus: existing.status,
              toStatus: bookingStatus,
              changedBy: staffId,
              reason: 'Updated from Google Sheets',
            },
          });
        }

        if (Array.isArray(row.snapshot?.tickets) && row.snapshot.tickets.length > 0) {
          await this.syncTicketsFromSnapshot(tx, persistedBooking.id, customerId, row.snapshot.tickets);
        }

        return persistedBooking;
      });

      if (existing) {
        result.updated += 1;
      } else {
        result.created += 1;
      }

      const record: ExistingBookingRecord = {
        id: booking.id,
        bookingCode: booking.bookingCode,
        pnr: booking.pnr,
        status: booking.status,
        contactName: booking.contactName,
        contactPhone: booking.contactPhone,
      };
      existingLookup.byId.set(record.id, record);
      existingLookup.byBookingCode.set(record.bookingCode.toUpperCase(), record);
      if (record.pnr) {
        existingLookup.byPnr.set(record.pnr.toUpperCase(), record);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Dòng ${row.rowIndex}: ${message}`);
      result.skipped += 1;
    }
  }

  private async previewParsedRows(
    parsedRows: ParsedSheetImportRow[],
    options?: {
      startRow?: number;
      maxRows?: number;
    },
  ): Promise<{ rows: ImportPreviewRow[]; totalSheetRows: number }> {
    const existingLookup = await this.lookupExistingBookings(parsedRows);
    const start = options?.startRow ?? 0;
    const max = options?.maxRows ?? 100;

    return {
      rows: parsedRows.slice(start, start + max).map((row) => {
        const existing = this.findExistingBooking(row, existingLookup);
        return {
          rowIndex: row.rowIndex,
          syncKey: row.syncKey,
          bookingId: row.bookingId,
          bookingCode: row.bookingCode,
          pnr: row.pnr,
          contactName: row.contactName,
          contactPhone: row.contactPhone,
          route: row.route,
          flightDate: row.flightDate,
          paxCount: row.paxCount,
          airline: row.airline,
          issueDate: row.issueDate,
          costPrice: row.costPrice,
          sellPrice: row.sellPrice,
          profit: row.profit,
          note: row.note,
          customerCode: row.customerCode,
          bookingStatus: row.bookingStatus,
          paymentStatus: row.paymentStatus,
          staffName: row.staffName,
          templateVersion: row.templateVersion || BOOKING_SHEET_TEMPLATE_VERSION,
          hasStructuredSnapshot: row.hasStructuredSnapshot,
          existsInDb: Boolean(existing),
          existingBookingId: existing?.id,
          existingBookingCode: existing?.bookingCode,
        };
      }),
      totalSheetRows: parsedRows.length,
    };
  }

  private async importParsedRows(parsedRows: ParsedSheetImportRow[], selectedRowIndices: number[]): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
    };

    try {
      const parsedByRowIndex = new Map(parsedRows.map((row) => [row.rowIndex, row]));
      const rowsToImport: ParsedSheetImportRow[] = [];

      for (const rowIndex of selectedRowIndices) {
        const row = parsedByRowIndex.get(rowIndex);
        if (!row) {
          result.errors.push(`Dòng ${rowIndex}: không tìm thấy trong file import.`);
          result.skipped += 1;
          continue;
        }
        rowsToImport.push(row);
      }

      if (rowsToImport.length === 0) {
        return result;
      }

      const existingLookup = await this.lookupExistingBookings(rowsToImport);
      const defaultStaff = await this.prisma.user.findFirst({
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });

      if (!defaultStaff) {
        throw new Error('Không tìm thấy nhân viên mặc định để import booking.');
      }

      for (const row of rowsToImport) {
        const existing = this.findExistingBooking(row, existingLookup);

        if (!row.contactName && !row.customerName && !row.bookingCode && !row.pnr && !row.hasStructuredSnapshot) {
          result.errors.push(`Dòng ${row.rowIndex}: thiếu dữ liệu nhận diện booking, đã bỏ qua.`);
          result.skipped += 1;
          continue;
        }

        await this.importRow(row, existing, existingLookup, defaultStaff.id, result);
      }
    } catch (error: unknown) {
      result.success = false;
      const message = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Lỗi tổng thể: ${message}`);
    }

    this.logger.log(`Booking import completed: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`);
    return result;
  }

  private async readExcelRows(buffer: Uint8Array) {
    const workbook = new ExcelJS.Workbook();
    const arrayBuffer = Uint8Array.from(buffer).buffer as ArrayBuffer;
    await workbook.xlsx.load(arrayBuffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error('File Excel không có sheet dữ liệu.');
    }

    const rows: string[][] = [];
    worksheet.eachRow({ includeEmpty: true }, (row) => {
      const values = Array.from({ length: row.cellCount }, (_, index) => row.getCell(index + 1).text.trim());
      rows.push(values);
    });

    return rows;
  }

  private parseSheetRows(allRows: string[][]): ParsedSheetImportRow[] {
    if (allRows.length === 0) {
      return [];
    }

    const columnMap = buildSheetColumnMap(allRows[0] ?? []);
    const rows: ParsedSheetImportRow[] = [];

    allRows.slice(1).forEach((row, index) => {
      if (!hasAnySheetValue(row)) {
        return;
      }
      rows.push(this.parseSheetRow(row, columnMap, index + 2));
    });

    return rows;
  }

  private parseSheetRow(row: string[], columnMap: Map<keyof SheetRow, number>, rowIndex: number): ParsedSheetImportRow {
    const raw = Object.fromEntries(
      BOOKING_SHEET_COLUMNS.map((column) => [column.key, getSheetCellValue(row, columnMap, column.key)]),
    ) as Partial<Record<keyof SheetRow, string>>;
    const snapshot = this.parseBookingSnapshot(raw.bookingJson ?? '');
    const snapshotTickets = Array.isArray(snapshot?.tickets) ? snapshot.tickets : [];
    const snapshotAirlines = [
      ...new Set(snapshotTickets.map((ticket: Record<string, any>) => String(ticket.airline ?? '').trim()).filter(Boolean)),
    ];
    const snapshotPassengers = [
      ...new Set(
        snapshotTickets
          .map((ticket: Record<string, any>) => String(ticket.passenger?.fullName ?? '').trim())
          .filter(Boolean),
      ),
    ];

    return {
      stt: raw.stt ? Number.parseInt(raw.stt, 10) || 0 : 0,
      pnr: (raw.pnr || snapshot?.pnr || '').trim().toUpperCase(),
      contactName: raw.contactName || snapshot?.contactName || snapshot?.customer?.fullName || '',
      dob: raw.dob || '',
      route: raw.route || buildRouteString(snapshotTickets as Array<{ departureCode?: string; arrivalCode?: string }>),
      flightDate: raw.flightDate || formatFlightDate(snapshotTickets as Array<{ departureTime?: Date | string | null }>),
      paxCount: raw.paxCount ? Number.parseInt(raw.paxCount, 10) || 0 : snapshotPassengers.length || 1,
      airline: raw.airline || snapshotAirlines.join(', '),
      supplier: raw.supplier || snapshot?.supplier?.name || snapshot?.supplier?.code || '',
      issueDate: raw.issueDate || this.formatDisplayDate(snapshot?.issuedAt || snapshot?.createdAt),
      costPrice: raw.costPrice ? getSheetNumberValue(row, columnMap, 'costPrice') : this.toNumber(snapshot?.totalNetPrice),
      sellPrice: raw.sellPrice ? getSheetNumberValue(row, columnMap, 'sellPrice') : this.toNumber(snapshot?.totalSellPrice),
      profit: raw.profit ? getSheetNumberValue(row, columnMap, 'profit') : this.toNumber(snapshot?.profit),
      note: raw.note || snapshot?.notes || '',
      pending: raw.pending || '',
      customerCode: (raw.customerCode || snapshot?.customer?.customerCode || '').trim().toUpperCase(),
      syncKey: raw.syncKey || (snapshot?.bookingCode ? `BOOK:${snapshot.bookingCode}` : ''),
      bookingId: raw.bookingId || snapshot?.id || '',
      bookingCode: raw.bookingCode || snapshot?.bookingCode || this.extractBookingCode(raw.syncKey ?? ''),
      contactPhone: raw.contactPhone || snapshot?.contactPhone || snapshot?.customer?.phone || '',
      customerName: raw.customerName || snapshot?.customer?.fullName || '',
      customerId: raw.customerId || snapshot?.customer?.id || '',
      customerType: raw.customerType || snapshot?.customer?.type || '',
      bookingStatus: raw.bookingStatus || snapshot?.status || '',
      paymentStatus: raw.paymentStatus || snapshot?.paymentStatus || '',
      paymentMethod: raw.paymentMethod || snapshot?.paymentMethod || '',
      bookingSource: raw.bookingSource || snapshot?.source || '',
      createdAt: raw.createdAt || snapshot?.createdAt || '',
      updatedAt: raw.updatedAt || snapshot?.updatedAt || '',
      issuedAtIso: raw.issuedAtIso || snapshot?.issuedAt || '',
      firstDepartureAt: raw.firstDepartureAt || (snapshotTickets[0]?.departureTime ?? ''),
      lastArrivalAt: raw.lastArrivalAt || (snapshotTickets[snapshotTickets.length - 1]?.arrivalTime ?? ''),
      flightNumbers: raw.flightNumbers || this.joinSnapshotValues(snapshotTickets, 'flightNumber'),
      airlineBookingCodes: raw.airlineBookingCodes || this.joinSnapshotValues(snapshotTickets, 'airlineBookingCode'),
      passengerNames: raw.passengerNames || snapshotPassengers.join(', '),
      staffId: raw.staffId || snapshot?.staff?.id || '',
      staffName: raw.staffName || snapshot?.staff?.fullName || '',
      supplierId: raw.supplierId || snapshot?.supplier?.id || '',
      supplierCode: raw.supplierCode || snapshot?.supplier?.code || '',
      supplierName: raw.supplierName || snapshot?.supplier?.name || '',
      gdsBookingId: raw.gdsBookingId || snapshot?.gdsBookingId || '',
      internalNotes: raw.internalNotes || snapshot?.internalNotes || '',
      totalFees: raw.totalFees ? getSheetNumberValue(row, columnMap, 'totalFees') : this.toNumber(snapshot?.totalFees),
      paidAmount: raw.paidAmount ? getSheetNumberValue(row, columnMap, 'paidAmount') : this.sumSnapshotPayments(snapshot),
      latestPaymentAt: raw.latestPaymentAt || snapshot?.payments?.[0]?.paidAt || '',
      bookingJson: raw.bookingJson || '',
      templateVersion: raw.templateVersion || BOOKING_SHEET_TEMPLATE_VERSION,
      rowIndex,
      raw,
      hasStructuredSnapshot: Boolean(snapshot),
      snapshot,
    };
  }

  private async lookupExistingBookings(rows: ParsedSheetImportRow[]): Promise<ExistingBookingLookup> {
    const bookingIds = [...new Set(rows.map((row) => row.bookingId).filter(Boolean))];
    const bookingCodes = [...new Set(rows.map((row) => row.bookingCode.toUpperCase()).filter(Boolean))];
    const pnrs = [...new Set(rows.map((row) => row.pnr.toUpperCase()).filter(Boolean))];
    const orConditions: Prisma.BookingWhereInput[] = [];

    if (bookingIds.length > 0) {
      orConditions.push({ id: { in: bookingIds } });
    }
    if (bookingCodes.length > 0) {
      orConditions.push({ bookingCode: { in: bookingCodes } });
    }
    if (pnrs.length > 0) {
      orConditions.push({ pnr: { in: pnrs } });
    }

    if (orConditions.length === 0) {
      return { byId: new Map(), byBookingCode: new Map(), byPnr: new Map() };
    }

    const existingBookings = await this.prisma.booking.findMany({
      where: {
        deletedAt: null,
        OR: orConditions,
      },
      select: {
        id: true,
        bookingCode: true,
        pnr: true,
        status: true,
        contactName: true,
        contactPhone: true,
      },
    });

    return {
      byId: new Map(existingBookings.map((booking) => [booking.id, booking])),
      byBookingCode: new Map(existingBookings.map((booking) => [booking.bookingCode.toUpperCase(), booking])),
      byPnr: new Map(
        existingBookings
          .filter((booking) => Boolean(booking.pnr))
          .map((booking) => [booking.pnr!.toUpperCase(), booking]),
      ),
    };
  }

  private findExistingBooking(row: ParsedSheetImportRow, lookup: ExistingBookingLookup) {
    if (row.bookingId && lookup.byId.has(row.bookingId)) {
      return lookup.byId.get(row.bookingId);
    }
    if (row.bookingCode && lookup.byBookingCode.has(row.bookingCode.toUpperCase())) {
      return lookup.byBookingCode.get(row.bookingCode.toUpperCase());
    }
    const syncBookingCode = this.extractBookingCode(row.syncKey);
    if (syncBookingCode && lookup.byBookingCode.has(syncBookingCode.toUpperCase())) {
      return lookup.byBookingCode.get(syncBookingCode.toUpperCase());
    }
    if (row.pnr && lookup.byPnr.has(row.pnr.toUpperCase())) {
      return lookup.byPnr.get(row.pnr.toUpperCase());
    }
    return undefined;
  }

  private parseBookingSnapshot(raw: string) {
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, any>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  private extractBookingCode(syncKey: string) {
    return syncKey.startsWith('BOOK:') ? syncKey.slice(5).trim() : '';
  }

  private pickText(row: ParsedSheetImportRow, key: keyof SheetRow) {
    if ((row.raw[key] ?? '') !== '') {
      return String(row[key] ?? '').trim();
    }
    const snapshotValue = this.pickSnapshotValue(row, key);
    return String(snapshotValue ?? '').trim();
  }

  private pickNumber(row: ParsedSheetImportRow, key: keyof SheetRow, fallback = 0) {
    if ((row.raw[key] ?? '') !== '') {
      return this.toNumber(row[key]);
    }
    return this.toNumber(fallback);
  }

  private pickSnapshotValue(row: ParsedSheetImportRow, key: keyof SheetRow) {
    const snapshot = row.snapshot ?? {};
    switch (key) {
      case 'bookingCode':
        return snapshot.bookingCode;
      case 'pnr':
        return snapshot.pnr;
      case 'contactName':
        return snapshot.contactName ?? snapshot.customer?.fullName;
      case 'contactPhone':
        return snapshot.contactPhone ?? snapshot.customer?.phone;
      case 'customerName':
        return snapshot.customer?.fullName;
      case 'customerCode':
        return snapshot.customer?.customerCode;
      case 'customerId':
        return snapshot.customer?.id;
      case 'customerType':
        return snapshot.customer?.type;
      case 'bookingStatus':
        return snapshot.status;
      case 'paymentStatus':
        return snapshot.paymentStatus;
      case 'paymentMethod':
        return snapshot.paymentMethod;
      case 'bookingSource':
        return snapshot.source;
      case 'createdAt':
        return snapshot.createdAt;
      case 'issuedAtIso':
        return snapshot.issuedAt;
      case 'gdsBookingId':
        return snapshot.gdsBookingId;
      case 'internalNotes':
        return snapshot.internalNotes;
      default:
        return undefined;
    }
  }

  private pickSnapshotNumber(row: ParsedSheetImportRow, key: 'totalSellPrice' | 'totalNetPrice' | 'totalFees' | 'profit') {
    return this.toNumber(row.snapshot?.[key]);
  }

  private pickSnapshotCustomerPhone(row: ParsedSheetImportRow) {
    return String(row.snapshot?.customer?.phone ?? '').trim();
  }

  private resolveDate(row: ParsedSheetImportRow, key: keyof SheetRow) {
    const raw = (row.raw[key] ?? '').trim();
    return this.toDate(raw || this.pickSnapshotValue(row, key));
  }

  private resolveBookingStatus(row: ParsedSheetImportRow) {
    return this.normalizeBookingStatus(this.pickText(row, 'bookingStatus') || row.snapshot?.status || 'NEW');
  }

  private resolvePaymentStatus(row: ParsedSheetImportRow) {
    const explicit = this.pickText(row, 'paymentStatus') || row.snapshot?.paymentStatus;
    if (explicit) {
      return this.normalizePaymentStatus(explicit);
    }
    const sellPrice = this.pickNumber(row, 'sellPrice', this.pickSnapshotNumber(row, 'totalSellPrice'));
    const paidAmount = this.pickNumber(row, 'paidAmount', this.sumSnapshotPayments(row.snapshot));
    if (paidAmount >= sellPrice && sellPrice > 0) {
      return 'PAID';
    }
    if (paidAmount > 0) {
      return 'PARTIAL';
    }
    return 'UNPAID';
  }

  private resolvePaymentMethod(row: ParsedSheetImportRow) {
    return this.normalizePaymentMethod(this.pickText(row, 'paymentMethod') || row.snapshot?.paymentMethod || 'CASH');
  }

  private resolveBookingSource(row: ParsedSheetImportRow) {
    return this.normalizeBookingSource(this.pickText(row, 'bookingSource') || row.snapshot?.source || 'PHONE');
  }

  private async resolveCustomerId(tx: Prisma.TransactionClient, row: ParsedSheetImportRow) {
    const customerId = this.pickText(row, 'customerId');
    if (customerId) {
      const existingById = await tx.customer.findUnique({ where: { id: customerId }, select: { id: true, customerCode: true } });
      if (existingById) {
        if (!existingById.customerCode && row.customerCode) {
          await tx.customer.update({
            where: { id: existingById.id },
            data: { customerCode: row.customerCode.toUpperCase() },
          });
        }
        return existingById.id;
      }
    }

    const customerCode = this.pickText(row, 'customerCode').toUpperCase();
    if (customerCode) {
      const existingByCode = await tx.customer.findUnique({ where: { customerCode }, select: { id: true } });
      if (existingByCode) {
        return existingByCode.id;
      }
    }

    const phone = this.pickText(row, 'contactPhone') || this.pickSnapshotCustomerPhone(row);
    if (phone) {
      const existingByPhone = await tx.customer.findUnique({ where: { phone }, select: { id: true } });
      if (existingByPhone) {
        return existingByPhone.id;
      }
    }

    const createdCustomer = await tx.customer.create({
      data: {
        fullName: this.pickText(row, 'customerName') || this.pickText(row, 'contactName') || 'Khách hàng mới',
        phone: phone || this.buildTemporaryPhone('CUSTOMER'),
        email: this.optionalString(row.snapshot?.customer?.email),
        dateOfBirth: this.toDate(row.snapshot?.customer?.dateOfBirth) ?? undefined,
        type: this.normalizeCustomerType(this.pickText(row, 'customerType') || row.snapshot?.customer?.type || 'INDIVIDUAL'),
        companyName: this.optionalString(row.snapshot?.customer?.companyName),
        tags: [],
        customerCode: customerCode || await this.generateCustomerCode(tx),
      },
      select: { id: true },
    });

    return createdCustomer.id;
  }

  private async resolveStaffId(tx: Prisma.TransactionClient, row: ParsedSheetImportRow, defaultStaffId: string) {
    const staffId = this.pickText(row, 'staffId');
    if (staffId) {
      const existingById = await tx.user.findUnique({ where: { id: staffId }, select: { id: true } });
      if (existingById) {
        return existingById.id;
      }
    }

    const staffName = this.pickText(row, 'staffName');
    if (staffName) {
      const existingByName = await tx.user.findFirst({
        where: { fullName: { equals: staffName, mode: 'insensitive' } },
        select: { id: true },
      });
      if (existingByName) {
        return existingByName.id;
      }
    }

    return defaultStaffId;
  }

  private async resolveSupplierId(tx: Prisma.TransactionClient, row: ParsedSheetImportRow) {
    const supplierId = this.pickText(row, 'supplierId');
    if (supplierId) {
      const existingById = await tx.supplierProfile.findUnique({ where: { id: supplierId }, select: { id: true } });
      if (existingById) {
        return existingById.id;
      }
    }

    const supplierCode = this.pickText(row, 'supplierCode').toUpperCase();
    if (supplierCode) {
      const existingByCode = await tx.supplierProfile.findUnique({ where: { code: supplierCode }, select: { id: true } });
      if (existingByCode) {
        return existingByCode.id;
      }
    }

    const supplierName = this.pickText(row, 'supplierName') || this.pickText(row, 'supplier');
    if (supplierName) {
      const existingByName = await tx.supplierProfile.findFirst({
        where: { name: { equals: supplierName, mode: 'insensitive' } },
        select: { id: true },
      });
      return existingByName?.id ?? null;
    }

    return null;
  }

  private async generateCustomerCode(tx: Prisma.TransactionClient) {
    const existingCodes = await tx.customer.findMany({
      where: { customerCode: { startsWith: 'KH' } },
      select: { customerCode: true },
      take: 1000,
      orderBy: { customerCode: 'desc' },
    });

    const maxSequence = existingCodes.reduce((max, customer) => {
      const matched = customer.customerCode?.match(/^KH(\d+)$/);
      return matched ? Math.max(max, Number(matched[1])) : max;
    }, 0);

    return `KH${String(maxSequence + 1).padStart(6, '0')}`;
  }

  private async generateBookingCode(tx: Prisma.TransactionClient, baseDate: Date) {
    const yy = baseDate.getFullYear().toString().slice(-2);
    const mm = String(baseDate.getMonth() + 1).padStart(2, '0');
    const dd = String(baseDate.getDate()).padStart(2, '0');
    const prefix = `APG-${yy}${mm}${dd}`;
    const startOfDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());
    const endOfDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + 1);

    const count = await tx.booking.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
    });

    return `${prefix}-${String(count + 1).padStart(3, '0')}`;
  }

  private async syncTicketsFromSnapshot(
    tx: Prisma.TransactionClient,
    bookingId: string,
    customerId: string,
    ticketSnapshots: Array<Record<string, any>>,
  ) {
    await tx.ticket.deleteMany({ where: { bookingId } });
    const passengerIdByKey = new Map<string, string>();

    for (const [index, ticket] of ticketSnapshots.entries()) {
      const passenger = (ticket.passenger ?? {}) as Record<string, any>;
      const passengerKey = this.buildPassengerKey(passenger, ticket.passengerId, index);
      let passengerId = passengerIdByKey.get(passengerKey);

      if (!passengerId) {
        passengerId = await this.resolvePassengerId(tx, customerId, passenger, ticket.passengerId, index);
        passengerIdByKey.set(passengerKey, passengerId);
      }

      await tx.ticket.create({
        data: {
          bookingId,
          passengerId,
          airline: this.optionalString(ticket.airline) ?? 'OTHER',
          flightNumber: this.optionalString(ticket.flightNumber) ?? 'UNKNOWN',
          departureCode: this.optionalString(ticket.departureCode) ?? 'UNK',
          arrivalCode: this.optionalString(ticket.arrivalCode) ?? 'UNK',
          departureTime: this.toDate(ticket.departureTime) ?? new Date(),
          arrivalTime: this.toDate(ticket.arrivalTime) ?? this.toDate(ticket.departureTime) ?? new Date(),
          seatClass: this.optionalString(ticket.seatClass) ?? 'Economy',
          fareClass: this.optionalString(ticket.fareClass),
          airlineBookingCode: this.optionalString(ticket.airlineBookingCode),
          sellPrice: this.toNumber(ticket.sellPrice),
          netPrice: this.toNumber(ticket.netPrice),
          tax: this.toNumber(ticket.tax),
          serviceFee: this.toNumber(ticket.serviceFee),
          commission: this.toNumber(ticket.commission),
          profit: this.toNumber(ticket.profit),
          eTicketNumber: this.optionalString(ticket.eTicketNumber),
          baggageAllowance: this.optionalString(ticket.baggageAllowance),
          status: this.optionalString(ticket.status) ?? 'ACTIVE',
          createdAt: this.toDate(ticket.createdAt) ?? new Date(),
        },
      });
    }
  }

  private async resolvePassengerId(
    tx: Prisma.TransactionClient,
    customerId: string,
    passenger: Record<string, any>,
    originalPassengerId: string | undefined,
    index: number,
  ) {
    const passengerId = String(originalPassengerId ?? passenger.id ?? '').trim();
    if (passengerId) {
      const existingById = await tx.passenger.findUnique({ where: { id: passengerId }, select: { id: true } });
      if (existingById) {
        return existingById.id;
      }
    }

    const fullName = this.optionalString(passenger.fullName) ?? `Passenger ${index + 1}`;
    const dateOfBirth = this.toDate(passenger.dateOfBirth);
    const linkedCustomerId = this.optionalString(passenger.customerId) ?? customerId;
    const existingByIdentity = await tx.passenger.findFirst({
      where: {
        customerId: linkedCustomerId,
        fullName,
        ...(dateOfBirth ? { dateOfBirth } : {}),
      },
      select: { id: true },
    });

    if (existingByIdentity) {
      return existingByIdentity.id;
    }

    const createdPassenger = await tx.passenger.create({
      data: {
        customerId: linkedCustomerId,
        fullName,
        dateOfBirth: dateOfBirth ?? undefined,
        gender: this.optionalString(passenger.gender),
        idNumber: this.optionalString(passenger.idNumber),
        passport: this.optionalString(passenger.passport),
        phone: this.optionalString(passenger.phone),
        email: this.optionalString(passenger.email),
        type: this.optionalString(passenger.type) ?? 'ADT',
      },
      select: { id: true },
    });

    return createdPassenger.id;
  }

  private buildPassengerKey(passenger: Record<string, any>, passengerId: string | undefined, index: number) {
    const resolvedId = String(passengerId ?? passenger.id ?? '').trim();
    if (resolvedId) {
      return resolvedId;
    }
    return `${String(passenger.fullName ?? '').trim().toUpperCase()}|${this.toDate(passenger.dateOfBirth)?.toISOString() ?? ''}|${index}`;
  }

  private normalizeBookingStatus(value: string): BookingStatus {
    const normalized = normalizeSheetHeader(value);
    const mapping: Record<string, BookingStatus> = {
      NEW: 'NEW',
      MOI: 'NEW',
      PROCESSING: 'PROCESSING',
      DANGXULY: 'PROCESSING',
      QUOTED: 'QUOTED',
      DABAOGIA: 'QUOTED',
      PENDINGPAYMENT: 'PENDING_PAYMENT',
      CHOTHANHTOAN: 'PENDING_PAYMENT',
      ISSUED: 'ISSUED',
      DAXUATVE: 'ISSUED',
      COMPLETED: 'COMPLETED',
      HOANTHANH: 'COMPLETED',
      CHANGED: 'CHANGED',
      DADOI: 'CHANGED',
      REFUNDED: 'REFUNDED',
      DAHOAN: 'REFUNDED',
      CANCELLED: 'CANCELLED',
      DAHUY: 'CANCELLED',
    };

    return mapping[normalized] ?? 'NEW';
  }

  private normalizePaymentStatus(value: string): PaymentStatus {
    const normalized = normalizeSheetHeader(value);
    const mapping: Record<string, PaymentStatus> = {
      PAID: 'PAID',
      DATHANHTOAN: 'PAID',
      PARTIAL: 'PARTIAL',
      THANHTOANMOTPHAN: 'PARTIAL',
      COC: 'PARTIAL',
      UNPAID: 'UNPAID',
      DANGNO: 'UNPAID',
      CHUATHANHTOAN: 'UNPAID',
      REFUNDED: 'REFUNDED',
      DAHOAN: 'REFUNDED',
    };

    return mapping[normalized] ?? 'UNPAID';
  }

  private normalizePaymentMethod(value: string): PaymentMethod {
    const normalized = normalizeSheetHeader(value);
    const mapping: Record<string, PaymentMethod> = {
      CASH: 'CASH',
      TIENMAT: 'CASH',
      BANKTRANSFER: 'BANK_TRANSFER',
      CHUYENKHOAN: 'BANK_TRANSFER',
      CREDITCARD: 'CREDIT_CARD',
      THETINDUNG: 'CREDIT_CARD',
      MOMO: 'MOMO',
      VNPAY: 'VNPAY',
      DEBT: 'DEBT',
      CONGNO: 'DEBT',
    };

    return mapping[normalized] ?? 'CASH';
  }

  private normalizeBookingSource(value: string) {
    const normalized = normalizeSheetHeader(value);
    const mapping: Record<string, string> = {
      WEBSITE: 'WEBSITE',
      ZALO: 'ZALO',
      MESSENGER: 'MESSENGER',
      PHONE: 'PHONE',
      DIENTHOAI: 'PHONE',
      WALKIN: 'WALK_IN',
      REFERRAL: 'REFERRAL',
      GIOITHIEU: 'REFERRAL',
    };

    return mapping[normalized] ?? 'PHONE';
  }

  private normalizeCustomerType(value: string): CustomerType {
    const normalized = normalizeSheetHeader(value);
    return normalized === 'CORPORATE' || normalized === 'KHACHDN' || normalized === 'DOANHNGHIEP'
      ? 'CORPORATE'
      : 'INDIVIDUAL';
  }

  private sumSnapshotPayments(snapshot: Record<string, any> | null) {
    if (!Array.isArray(snapshot?.payments)) {
      return 0;
    }

    return snapshot.payments
      .filter((payment: Record<string, any>) => String(payment.method ?? '').toUpperCase() !== 'DEBT')
      .reduce((sum: number, payment: Record<string, any>) => sum + this.toNumber(payment.amount), 0);
  }

  private joinSnapshotValues(items: Array<Record<string, any>>, key: string) {
    return [...new Set(items.map((item) => String(item[key] ?? '').trim()).filter(Boolean))].join(', ');
  }

  private formatDisplayDate(value?: string | Date | null) {
    const parsed = this.toDate(value);
    if (!parsed) {
      return '';
    }
    return `${String(parsed.getDate()).padStart(2, '0')}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${parsed.getFullYear()}`;
  }

  private toDate(value?: string | Date | null) {
    if (!value) {
      return null;
    }
    const parsed = value instanceof Date ? value : new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private toNumber(value: unknown) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private buildTemporaryPhone(scope: string) {
    return `TEMP-${scope}-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }

  private optionalString(value: unknown) {
    const normalized = String(value ?? '').trim();
    return normalized || null;
  }
}
