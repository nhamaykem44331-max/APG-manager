import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { GoogleSheetsClient } from './google-sheets.client';
import { SheetRow, SyncResult, ImportPreviewRow, ImportResult } from './dto/sheet-row.dto';
import { convertBookingToSheetRow } from './booking-to-row.util';

@Injectable()
export class SheetSyncService {
  private logger = new Logger(SheetSyncService.name);

  constructor(
    private prisma: PrismaService,
    private sheetsClient: GoogleSheetsClient,
  ) {}

  // ============================================
  // Lõi mapping từ Database thành cấu trúc Sheet
  // ============================================
  async fetchBookingsForExport(filter?: {
    from?: Date;
    to?: Date;
    status?: string[];
  }): Promise<SheetRow[]> {
    const where: any = {};
    if (filter?.status) where.status = { in: filter.status };
    if (filter?.from || filter?.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = filter.from;
      if (filter.to) where.createdAt.lte = filter.to;
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      include: {
        tickets: {
          include: { passenger: true },
          orderBy: { departureTime: 'asc' },
        },
        customer: { select: { id: true, fullName: true, customerCode: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return bookings.map((bk, idx) => convertBookingToSheetRow(bk, idx + 1));
  }

  // ============================================
  // Đổ dữ liệu lên Google Sheets
  // ============================================
  async pushToSheets(options: {
    mode: 'APPEND' | 'REPLACE_ALL';
    from?: string;
    to?: string;
    statuses?: string[];
  }): Promise<SyncResult> {
    try {
      const filter = {
        from: options.from ? new Date(options.from) : undefined,
        to: options.to ? new Date(options.to) : undefined,
        status: options.statuses ?? ['ISSUED', 'COMPLETED'],
      };

      const rows = await this.fetchBookingsForExport(filter);
      this.logger.log(`Prepared ${rows.length} rows for Google Sheets sync.`);

      const sheetData = rows.map((r) => [
        r.stt,
        r.pnr,
        r.contactName,
        r.dob,
        r.route,
        r.flightDate,
        r.paxCount,
        r.airline,
        r.supplier,
        r.issueDate,
        r.costPrice,
        r.sellPrice,
        r.profit,
        r.note,
        r.pending,
        r.customerCode,
      ]);

      let written: number;
      if (options.mode === 'REPLACE_ALL') {
        written = await this.sheetsClient.clearAndWriteAll(sheetData);
      } else {
        written = await this.sheetsClient.appendRows(sheetData);
      }

      return {
        success: true,
        rowsProcessed: rows.length,
        rowsWritten: written,
        sheetUrl: this.sheetsClient.spreadsheetUrl,
      };
    } catch (error: any) {
      this.logger.error('Push to Sheets failed', error);
      return {
        success: false,
        rowsProcessed: 0,
        rowsWritten: 0,
        sheetUrl: '',
        error: error.message || 'Unknown error occurred while syncing.',
      };
    }
  }

  async getSheetInfo() {
    return this.sheetsClient.getSheetInfo();
  }

  // ============================================
  // Preview dữ liệu từ Google Sheets (không import)
  // ============================================
  async previewFromSheets(options?: {
    startRow?: number;
    maxRows?: number;
  }): Promise<{ rows: ImportPreviewRow[]; totalSheetRows: number }> {
    const allRows = await this.sheetsClient.readSheet();
    // Bỏ header (row 0)
    const dataRows = allRows.slice(1);
    const totalSheetRows = dataRows.length;

    const start = options?.startRow ?? 0;
    const max = options?.maxRows ?? 100;
    const sliced = dataRows.slice(start, start + max);

    // Lấy tất cả PNR hiện có trong DB để cross-check
    const existingBookings = await this.prisma.booking.findMany({
      where: { pnr: { not: null } },
      select: { id: true, bookingCode: true, pnr: true },
    });
    const pnrMap = new Map(existingBookings.map(b => [b.pnr?.toUpperCase(), { id: b.id, code: b.bookingCode }]));

    const rows: ImportPreviewRow[] = sliced.map((row, idx) => {
      const pnr = (row[1] ?? '').toString().trim().toUpperCase();
      const existing = pnrMap.get(pnr);
      return {
        rowIndex: start + idx + 2, // 1-based + header
        pnr,
        contactName: (row[2] ?? '').toString().trim(),
        route: (row[4] ?? '').toString().trim(),
        flightDate: (row[5] ?? '').toString().trim(),
        paxCount: parseInt(row[6]) || 1,
        airline: (row[7] ?? '').toString().trim().toUpperCase(),
        issueDate: (row[9] ?? '').toString().trim(),
        costPrice: parseFloat((row[10] ?? '0').toString().replace(/[^\d.-]/g, '')) || 0,
        sellPrice: parseFloat((row[11] ?? '0').toString().replace(/[^\d.-]/g, '')) || 0,
        profit: parseFloat((row[12] ?? '0').toString().replace(/[^\d.-]/g, '')) || 0,
        note: (row[13] ?? '').toString().trim(),
        customerCode: (row[15] ?? '').toString().trim(),
        existsInDb: !!existing,
        existingBookingId: existing?.id,
        existingBookingCode: existing?.code,
      };
    });

    return { rows, totalSheetRows };
  }

  // ============================================
  // Import thực tế từ Google Sheets vào Database
  // ============================================
  async importFromSheets(selectedRowIndices: number[]): Promise<ImportResult> {
    const result: ImportResult = { success: true, created: 0, updated: 0, skipped: 0, errors: [] };

    try {
      const allRows = await this.sheetsClient.readSheet();
      const dataRows = allRows.slice(1); // bỏ header

      for (const rowIdx of selectedRowIndices) {
        const sheetRowIndex = rowIdx - 2; // convert from 1-based+header to 0-based array index
        if (sheetRowIndex < 0 || sheetRowIndex >= dataRows.length) {
          result.errors.push(`Dòng ${rowIdx}: ngoài phạm vi Sheet.`);
          result.skipped++;
          continue;
        }

        const row = dataRows[sheetRowIndex];
        const pnr = (row[1] ?? '').toString().trim().toUpperCase();
        if (!pnr) {
          result.errors.push(`Dòng ${rowIdx}: PNR trống, bỏ qua.`);
          result.skipped++;
          continue;
        }

        const contactName = (row[2] ?? '').toString().trim();
        const route = (row[4] ?? '').toString().trim();
        const airline = (row[7] ?? '').toString().trim().toUpperCase();
        const costPrice = parseFloat((row[10] ?? '0').toString().replace(/[^\d.-]/g, '')) || 0;
        const sellPrice = parseFloat((row[11] ?? '0').toString().replace(/[^\d.-]/g, '')) || 0;
        const profit = parseFloat((row[12] ?? '0').toString().replace(/[^\d.-]/g, '')) || 0;
        const note = (row[13] ?? '').toString().trim();
        const paxCount = parseInt(row[6]) || 1;

        // Parse route to departure/arrival
        let departureCode = '';
        let arrivalCode = '';
        if (route.length >= 6) {
          departureCode = route.substring(0, 3);
          arrivalCode = route.substring(3, 6);
        }

        // Check existing
        const existing = await this.prisma.booking.findFirst({ where: { pnr } });

        try {
          if (existing) {
            // UPDATE existing booking
            await this.prisma.booking.update({
              where: { id: existing.id },
              data: {
                contactName: contactName || existing.contactName,
                totalNetPrice: costPrice,
                totalSellPrice: sellPrice,
                profit,
                notes: note || existing.notes,
                paymentStatus: note.toLowerCase().startsWith('done') ? 'PAID' : 'UNPAID',
              },
            });
            result.updated++;
          } else {
            // CREATE new booking
            const bookingCode = `APG-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999)).padStart(3, '0')}`;
            await this.prisma.booking.create({
              data: {
                bookingCode,
                pnr,
                contactName: contactName || 'N/A',
                contactPhone: '',
                status: note.toLowerCase().startsWith('done') ? 'COMPLETED' : 'ISSUED',
                source: 'WALK_IN',
                paymentMethod: 'BANK_TRANSFER',
                paymentStatus: note.toLowerCase().startsWith('done') ? 'PAID' : 'UNPAID',
                totalNetPrice: costPrice,
                totalSellPrice: sellPrice,
                totalFees: 0,
                profit,
                notes: note || null,
                staffId: (await this.prisma.user.findFirst({ select: { id: true } }))?.id ?? '',
                customerId: (await this.prisma.customer.findFirst({ select: { id: true } }))?.id ?? '',
              },
            });
            result.created++;
          }
        } catch (err: any) {
          result.errors.push(`Dòng ${rowIdx} (PNR: ${pnr}): ${err.message}`);
          result.skipped++;
        }
      }
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Lỗi tổng thể: ${error.message}`);
    }

    this.logger.log(`Import hoàn tất: ${result.created} tạo mới, ${result.updated} cập nhật, ${result.skipped} bỏ qua`);
    return result;
  }
}
