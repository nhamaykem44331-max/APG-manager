import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Customer,
  InvoiceAttachmentType,
  InvoiceDirection,
  Prisma,
  SupplierProfile,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  CreateInvoiceAttachmentDto,
  CreateInvoiceDto,
  CreateInvoiceFromBookingsDto,
  InvoiceLineDto,
  ListInvoiceCoverageDto,
  ListInvoiceDebtStatementDto,
  ListInvoicesDto,
  UpdateInvoiceDto,
} from './dto';

type InvoiceRecordWithRelations = Prisma.InvoiceRecordGetPayload<{
  include: {
    customer: { select: { id: true; fullName: true; phone: true; email: true; type: true; companyName: true; companyTaxId: true; customerCode: true } };
    supplier: { select: { id: true; code: true; name: true; type: true; taxId: true; contactName: true; contactPhone: true; contactEmail: true; bankAccount: true; bankName: true } };
    lines: true;
    attachments: true;
    reviews: { orderBy: { createdAt: 'desc' } };
  };
}>;
type BookingMatchRecord = Prisma.BookingGetPayload<{
  include: {
    customer: true;
    supplier: true;
    tickets: { include: { passenger: true } };
    ledgers: true;
  };
}>;
type InvoiceLedgerRecord = BookingMatchRecord['ledgers'][number];
type NormalizedInvoiceLine = {
  lineNo: number;
  bookingId?: string;
  bookingCode: string | null;
  pnr: string | null;
  ticketIds: string[];
  description: string;
  passengerName: string | null;
  passengerType: string | null;
  route: string | null;
  quantity: number;
  unitName: string;
  currencyCode: string;
  unitPrice: number;
  amountBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  amount: number;
  serviceFee: number;
  notes: string | null;
  snapshot?: Prisma.InputJsonValue;
};

const ELIGIBLE_BOOKING_STATUSES = ['ISSUED', 'COMPLETED', 'CHANGED'] as const;
const INACTIVE_INVOICE_STATUSES = ['CANCELLED', 'ADJUSTED', 'REJECTED', 'INVALID'] as const;

@Injectable()
export class InvoiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private normalizeTags(tags?: string[] | null) {
    return Array.from(new Set(
      (tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ));
  }

  private normalizeComparable(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private canonicalizeVietnamese(value: string | undefined, canonical: string) {
    if (!value?.trim()) {
      return canonical;
    }

    return this.normalizeComparable(value) === this.normalizeComparable(canonical)
      ? canonical
      : value;
  }

  private getDefaultSellerProfile() {
    return {
      sellerLegalName: this.canonicalizeVietnamese(
        this.config.get<string>('INVOICE_SELLER_LEGAL_NAME'),
        'HTX Vận Tải Ô Tô Tân Phú',
      ),
      sellerTaxCode: this.config.get<string>('INVOICE_SELLER_TAX_CODE') || '4600111735',
      sellerAddress: this.canonicalizeVietnamese(
        this.config.get<string>('INVOICE_SELLER_ADDRESS'),
        'Tổ 9, Phường Tích Lương, Thành phố Thái Nguyên, Tỉnh Thái Nguyên, Việt Nam',
      ),
      sellerEmail: this.config.get<string>('INVOICE_SELLER_EMAIL') || 'tkt.tanphu@gmail.com',
      sellerPhone: this.config.get<string>('INVOICE_SELLER_PHONE') || '0943557959',
      sellerBankAccount: this.config.get<string>('INVOICE_SELLER_BANK_ACCOUNT') || '3900543757',
      sellerBankName: this.canonicalizeVietnamese(
        this.config.get<string>('INVOICE_SELLER_BANK_NAME'),
        'BIDV CN Thái Nguyên',
      ),
    };
  }

  private async generateCode(direction: InvoiceDirection) {
    const prefix = direction === 'INCOMING' ? 'INV-IN' : 'INV-OUT';
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `${prefix}-${yy}${mm}${dd}`;
    const count = await this.prisma.invoiceRecord.count({
      where: { code: { startsWith: datePrefix } },
    });
    return `${datePrefix}-${String(count + 1).padStart(3, '0')}`;
  }

  private buildRouteFromTickets(tickets: Array<{
    departureCode: string;
    arrivalCode: string;
    departureTime: Date;
  }>) {
    if (!tickets.length) return '';
    const sorted = [...tickets].sort((left, right) => left.departureTime.getTime() - right.departureTime.getTime());
    const points = [sorted[0].departureCode, ...sorted.map((ticket) => ticket.arrivalCode)];
    return points.join('-');
  }

  private buildCoverageBookingWhere(search?: string): Prisma.BookingWhereInput {
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      status: { in: [...ELIGIBLE_BOOKING_STATUSES] },
    };

    if (!search?.trim()) {
      return where;
    }

    const query = search.trim();
    where.OR = [
      { bookingCode: { contains: query, mode: 'insensitive' } },
      { pnr: { contains: query, mode: 'insensitive' } },
      { contactName: { contains: query, mode: 'insensitive' } },
      { customer: { is: { fullName: { contains: query, mode: 'insensitive' } } } },
      { customer: { is: { companyName: { contains: query, mode: 'insensitive' } } } },
      { supplier: { is: { name: { contains: query, mode: 'insensitive' } } } },
    ];

    return where;
  }

  private getCoverageBuyerName(booking: {
    contactName?: string | null;
    customer?: {
      type: 'INDIVIDUAL' | 'CORPORATE';
      fullName: string;
      companyName?: string | null;
    } | null;
  }) {
    if (booking.customer?.type === 'CORPORATE') {
      return booking.customer.companyName || booking.customer.fullName || booking.contactName || 'Chưa có khách hàng';
    }

    return booking.contactName || booking.customer?.fullName || 'Chưa có người đại diện';
  }

  private normalizeLine(line: InvoiceLineDto, index: number): NormalizedInvoiceLine {
    const quantity = Number(line.quantity ?? 1);
    const unitPrice = Number(line.unitPrice ?? 0);
    const amountBeforeVat = Number(line.amountBeforeVat ?? quantity * unitPrice);
    const vatRate = Number(line.vatRate ?? 0);
    const vatAmount = Number(line.vatAmount ?? (amountBeforeVat * vatRate) / 100);
    const amount = Number(line.amount ?? amountBeforeVat + vatAmount);
    const serviceFee = Number(line.serviceFee ?? 0);

    return {
      lineNo: index + 1,
      bookingId: line.bookingId,
      bookingCode: line.bookingCode?.trim() || null,
      pnr: line.pnr?.trim().toUpperCase() || null,
      ticketIds: line.ticketIds ?? [],
      description: line.description.trim(),
      passengerName: line.passengerName?.trim() || null,
      passengerType: line.passengerType?.trim().toUpperCase() || null,
      route: line.route?.trim().toUpperCase() || null,
      quantity,
      unitName: line.unitName?.trim() || 'Vé',
      currencyCode: line.currencyCode?.trim().toUpperCase() || 'VND',
      unitPrice,
      amountBeforeVat,
      vatRate,
      vatAmount,
      amount,
      serviceFee,
      notes: line.notes?.trim() || null,
    };
  }

  private calcTotals(lines: ReturnType<InvoiceService['normalizeLine']>[]) {
    return lines.reduce((acc, line) => ({
      subtotal: acc.subtotal + line.amountBeforeVat,
      vatAmount: acc.vatAmount + line.vatAmount,
      totalAmount: acc.totalAmount + line.amount,
    }), { subtotal: 0, vatAmount: 0, totalAmount: 0 });
  }

  private buildBuyerFromCustomer(customer: Customer | null | undefined) {
    if (!customer) {
      return {
        buyerType: null,
        buyerLegalName: null,
        buyerTaxCode: null,
        buyerAddress: null,
        buyerEmail: null,
        buyerPhone: null,
        buyerFullName: null,
      };
    }

    const isCorporate = customer.type === 'CORPORATE';

    return {
      buyerType: customer.type,
      buyerLegalName: isCorporate ? (customer.companyName || customer.fullName) : customer.fullName,
      buyerTaxCode: isCorporate ? (customer.companyTaxId || null) : null,
      buyerAddress: null,
      buyerEmail: customer.email || null,
      buyerPhone: customer.phone || null,
      buyerFullName: customer.fullName || null,
    };
  }

  private buildSupplierSnapshot(supplier: SupplierProfile | null | undefined) {
    if (!supplier) {
      return {
        supplierLegalName: null,
        supplierTaxCode: null,
        supplierAddress: null,
        supplierEmail: null,
        supplierPhone: null,
        supplierBankAccount: null,
        supplierBankName: null,
      };
    }

    return {
      supplierLegalName: supplier.name,
      supplierTaxCode: supplier.taxId || null,
      supplierAddress: null,
      supplierEmail: supplier.contactEmail || null,
      supplierPhone: supplier.contactPhone || null,
      supplierBankAccount: supplier.bankAccount || null,
      supplierBankName: supplier.bankName || null,
    };
  }

  private serializeLine(line: InvoiceRecordWithRelations['lines'][number]) {
    return {
      ...line,
      quantity: Number(line.quantity),
      unitPrice: Number(line.unitPrice),
      amountBeforeVat: Number(line.amountBeforeVat),
      vatRate: Number(line.vatRate),
      vatAmount: Number(line.vatAmount),
      amount: Number(line.amount),
      serviceFee: Number(line.serviceFee),
    };
  }

  private serializeInvoice(record: InvoiceRecordWithRelations) {
    return {
      ...record,
      subtotal: Number(record.subtotal),
      vatAmount: Number(record.vatAmount),
      totalAmount: Number(record.totalAmount),
      lines: record.lines.map((line) => this.serializeLine(line)),
    };
  }

  private findDuplicateValues(values: string[]) {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const value of values) {
      if (seen.has(value)) {
        duplicates.add(value);
      } else {
        seen.add(value);
      }
    }

    return Array.from(duplicates);
  }

  private getLineReferenceKey(line: {
    pnr?: string | null;
    bookingCode?: string | null;
    bookingId?: string | null;
  }) {
    return line.pnr?.trim().toUpperCase()
      || line.bookingCode?.trim()
      || line.bookingId?.trim()
      || null;
  }

  private buildPassengerSummary(
    tickets: Array<{
      passenger?: {
        fullName?: string | null;
        type?: string | null;
      } | null;
    }>,
  ) {
    return Array.from(new Set(
      tickets
        .map((ticket) => ticket.passenger?.fullName?.trim())
        .filter((value): value is string => Boolean(value)),
    ));
  }

  private summarizeLedgerCollection(ledgers: InvoiceLedgerRecord[]) {
    if (ledgers.length === 0) {
      return {
        ledgerCount: 0,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        overdueAmount: 0,
        overdueCount: 0,
        paymentStatus: 'NO_LEDGER',
        ledgers: [],
      };
    }

    const totalAmount = ledgers.reduce((sum, ledger) => sum + Number(ledger.totalAmount ?? 0), 0);
    const paidAmount = ledgers.reduce((sum, ledger) => sum + Number(ledger.paidAmount ?? 0), 0);
    const remainingAmount = ledgers.reduce((sum, ledger) => sum + Number(ledger.remaining ?? 0), 0);
    const overdueLedgers = ledgers.filter((ledger) => ledger.status === 'OVERDUE');
    const overdueAmount = overdueLedgers.reduce((sum, ledger) => sum + Number(ledger.remaining ?? 0), 0);
    const paymentStatus = remainingAmount <= 0
      ? 'PAID'
      : paidAmount > 0
        ? 'PARTIAL'
        : overdueLedgers.length > 0
          ? 'OVERDUE'
          : 'UNPAID';

    return {
      ledgerCount: ledgers.length,
      totalAmount,
      paidAmount,
      remainingAmount,
      overdueAmount,
      overdueCount: overdueLedgers.length,
      paymentStatus,
      ledgers: ledgers.map((ledger) => ({
        id: ledger.id,
        code: ledger.code,
        direction: ledger.direction,
        status: ledger.status,
        bookingId: ledger.bookingId,
        bookingCode: ledger.bookingCode,
        invoiceNumber: ledger.invoiceNumber,
        totalAmount: Number(ledger.totalAmount ?? 0),
        paidAmount: Number(ledger.paidAmount ?? 0),
        remaining: Number(ledger.remaining ?? 0),
        dueDate: ledger.dueDate,
      })),
    };
  }

  private buildBookingLookup(bookings: BookingMatchRecord[]) {
    const byId = new Map<string, BookingMatchRecord>();
    const bookingCodeBuckets = new Map<string, BookingMatchRecord[]>();
    const pnrBuckets = new Map<string, BookingMatchRecord[]>();

    for (const booking of bookings) {
      byId.set(booking.id, booking);

      const bookingCode = booking.bookingCode?.trim();
      if (bookingCode) {
        bookingCodeBuckets.set(bookingCode, [...(bookingCodeBuckets.get(bookingCode) ?? []), booking]);
      }

      const pnr = booking.pnr?.trim().toUpperCase();
      if (pnr) {
        pnrBuckets.set(pnr, [...(pnrBuckets.get(pnr) ?? []), booking]);
      }
    }

    const resolveUnique = (bucketMap: Map<string, BookingMatchRecord[]>, key?: string | null) => {
      if (!key) return null;
      const bucket = bucketMap.get(key) ?? [];
      return bucket.length === 1 ? bucket[0] : null;
    };

    return {
      byId,
      resolveByBookingCode: (bookingCode?: string | null) => resolveUnique(bookingCodeBuckets, bookingCode?.trim()),
      resolveByPnr: (pnr?: string | null) => resolveUnique(pnrBuckets, pnr?.trim().toUpperCase()),
    };
  }

  private buildResolvedLineFromBooking(line: NormalizedInvoiceLine, booking: BookingMatchRecord): NormalizedInvoiceLine {
    const passengerNames = this.buildPassengerSummary(booking.tickets);
    const route = this.buildRouteFromTickets(booking.tickets);
    const passengerType = passengerNames.length > 1
      ? 'MULTI'
      : (booking.tickets[0]?.passenger?.type?.trim().toUpperCase() || line.passengerType || null);

    return {
      ...line,
      bookingId: booking.id,
      bookingCode: line.bookingCode || booking.bookingCode,
      pnr: line.pnr || booking.pnr || booking.bookingCode,
      ticketIds: Array.isArray(line.ticketIds) && line.ticketIds.length > 0
        ? line.ticketIds
        : booking.tickets.map((ticket) => ticket.id),
      route: line.route || route || null,
      passengerName: line.passengerName || passengerNames.join(', ') || null,
      passengerType,
      notes: line.notes || booking.notes || null,
      snapshot: line.snapshot ?? {
        bookingCode: booking.bookingCode,
        pnr: booking.pnr,
        route,
        passengerNames,
        issuedAt: booking.issuedAt?.toISOString() ?? null,
        totalSellPrice: Number(booking.totalSellPrice ?? 0),
        totalNetPrice: Number(booking.totalNetPrice ?? 0),
      },
    };
  }

  private async matchLinesToBookings(
    direction: InvoiceDirection,
    lines: NormalizedInvoiceLine[],
    options?: {
      customerId?: string | null;
      supplierId?: string | null;
    },
  ) {
    const bookingIds = Array.from(new Set(lines.map((line) => line.bookingId).filter((value): value is string => Boolean(value))));
    const bookingCodes = Array.from(new Set(lines.map((line) => line.bookingCode?.trim()).filter((value): value is string => Boolean(value))));
    const pnrs = Array.from(new Set(lines.map((line) => line.pnr?.trim().toUpperCase()).filter((value): value is string => Boolean(value))));

    if (bookingIds.length === 0 && bookingCodes.length === 0 && pnrs.length === 0) {
      return {
        lines,
        matchedBookings: [] as BookingMatchRecord[],
      };
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(bookingIds.length > 0 ? [{ id: { in: bookingIds } }] : []),
          ...(bookingCodes.length > 0 ? [{ bookingCode: { in: bookingCodes } }] : []),
          ...(pnrs.length > 0 ? [{ pnr: { in: pnrs } }] : []),
        ],
      },
      include: {
        customer: true,
        supplier: true,
        tickets: {
          include: {
            passenger: true,
          },
          orderBy: { departureTime: 'asc' },
        },
        ledgers: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const lookup = this.buildBookingLookup(bookings);
    const matchedBookingsMap = new Map<string, BookingMatchRecord>();

    const resolvedLines = lines.map((line) => {
      const matched = line.bookingId
        ? lookup.byId.get(line.bookingId) ?? null
        : lookup.resolveByBookingCode(line.bookingCode) ?? lookup.resolveByPnr(line.pnr);

      if (!matched) {
        return line;
      }

      if (direction === 'OUTGOING' && options?.customerId && matched.customerId !== options.customerId) {
        throw new BadRequestException(`Booking ${matched.bookingCode} không thuộc khách hàng của hóa đơn đầu ra.`);
      }

      if (direction === 'INCOMING' && options?.supplierId) {
        if (!matched.supplierId) {
          throw new BadRequestException(`Booking ${matched.bookingCode} chua gan nha cung cap de match hoa don dau vao.`);
        }
        if (matched.supplierId !== options.supplierId) {
          throw new BadRequestException(`Booking ${matched.bookingCode} thuộc NCC khác, không khớp với hóa đơn đầu vào này.`);
        }
      }

      matchedBookingsMap.set(matched.id, matched);
      return this.buildResolvedLineFromBooking(line, matched);
    });

    const matchedBookings = Array.from(matchedBookingsMap.values());
    const uniqueCustomerIds = Array.from(new Set(matchedBookings.map((booking) => booking.customerId).filter(Boolean)));
    const uniqueSupplierIds = Array.from(new Set(matchedBookings.map((booking) => booking.supplierId).filter(Boolean)));

    if (direction === 'OUTGOING' && uniqueCustomerIds.length > 1) {
      throw new BadRequestException('Hóa đơn đầu ra không được gom booking của nhiều khách hàng.');
    }

    if (direction === 'INCOMING' && uniqueSupplierIds.length > 1) {
      throw new BadRequestException('Hóa đơn đầu vào không được gom booking của nhiều nhà cung cấp.');
    }

    return {
      lines: resolvedLines,
      matchedBookings,
    };
  }

  private async validateLineUniqueness(
    direction: InvoiceDirection,
    lines: NormalizedInvoiceLine[],
    options?: {
      currentInvoiceId?: string;
      supplierId?: string | null;
    },
  ) {
    const pnrKeys = lines
      .map((line) => line.pnr?.trim().toUpperCase())
      .filter((value): value is string => Boolean(value));
    const duplicatePnrs = this.findDuplicateValues(pnrKeys);

    if (duplicatePnrs.length > 0) {
      throw new BadRequestException(`PNR bị lặp trong cùng hóa đơn: ${duplicatePnrs.join(', ')}.`);
    }

    if (pnrKeys.length === 0) {
      return;
    }

    const where: Prisma.InvoiceLineItemWhereInput = {
      pnr: { in: pnrKeys },
      invoice: {
        direction,
        status: { notIn: [...INACTIVE_INVOICE_STATUSES] },
        ...(options?.currentInvoiceId ? { id: { not: options.currentInvoiceId } } : {}),
        ...(direction === 'INCOMING' && options?.supplierId ? { supplierId: options.supplierId } : {}),
      },
    };

    const existingLines = await this.prisma.invoiceLineItem.findMany({
      where,
      include: {
        invoice: {
          select: {
            code: true,
            status: true,
            supplierId: true,
          },
        },
      },
    });

    if (existingLines.length === 0) {
      return;
    }

    const duplicate = existingLines[0];
    if (direction === 'OUTGOING') {
      throw new BadRequestException(
        `PNR ${duplicate.pnr} đã tồn tại trong hóa đơn đầu ra ${duplicate.invoice.code} (${duplicate.invoice.status}).`,
      );
    }

    throw new BadRequestException(
      `PNR ${duplicate.pnr} đã tồn tại trong hóa đơn đầu vào ${duplicate.invoice.code} (${duplicate.invoice.status}).`,
    );
  }

  private async enrichInvoice(invoice: ReturnType<InvoiceService['serializeInvoice']>) {
    const bookingRefs = invoice.lines.map((line) => ({
      bookingId: line.bookingId,
      bookingCode: line.bookingCode,
      pnr: line.pnr,
    }));

    const { matchedBookings } = await this.matchLinesToBookings(invoice.direction, bookingRefs.map((line, index) => ({
      lineNo: index + 1,
      bookingId: line.bookingId ?? undefined,
      bookingCode: line.bookingCode,
      pnr: line.pnr,
      ticketIds: [],
      description: line.pnr || line.bookingCode || `line-${index + 1}`,
      quantity: 1,
      unitName: 'Vé',
      currencyCode: 'VND',
      unitPrice: 0,
      amountBeforeVat: 0,
      vatRate: 0,
      vatAmount: 0,
      amount: 0,
      serviceFee: 0,
      passengerName: null,
      passengerType: null,
      route: null,
      notes: null,
    })));

    const lookup = this.buildBookingLookup(matchedBookings);
    const resolvedBookings = invoice.lines
      .map((line) => line.bookingId
        ? lookup.byId.get(line.bookingId) ?? null
        : lookup.resolveByBookingCode(line.bookingCode) ?? lookup.resolveByPnr(line.pnr))
      .filter((booking): booking is BookingMatchRecord => Boolean(booking));

    const uniqueBookings = Array.from(new Map(resolvedBookings.map((booking) => [booking.id, booking])).values());
    const linkedLedgers = uniqueBookings
      .flatMap((booking) => booking.ledgers)
      .filter((ledger) => ledger.direction === (invoice.direction === 'OUTGOING' ? 'RECEIVABLE' : 'PAYABLE'));
    const paymentSummary = this.summarizeLedgerCollection(linkedLedgers);

    const matchedLineKeys = new Set(
      uniqueBookings.flatMap((booking) => [
        booking.id,
        booking.bookingCode,
        booking.pnr?.trim().toUpperCase() ?? '',
      ].filter(Boolean)),
    );
    const unmatchedLines = invoice.lines.filter((line) => {
      const lineKey = this.getLineReferenceKey(line);
      return !lineKey || !matchedLineKeys.has(lineKey);
    });
    const duplicatePnrs = this.findDuplicateValues(
      invoice.lines
        .map((line) => line.pnr?.trim().toUpperCase())
        .filter((value): value is string => Boolean(value)),
    );

    const counterpartyMismatches = uniqueBookings.filter((booking) => {
      if (invoice.direction === 'OUTGOING') {
        return Boolean(invoice.customerId) && booking.customerId !== invoice.customerId;
      }
      return Boolean(invoice.supplierId) && booking.supplierId !== invoice.supplierId;
    });

    return {
      ...invoice,
      linkedBookings: uniqueBookings.map((booking) => ({
        id: booking.id,
        bookingCode: booking.bookingCode,
        pnr: booking.pnr,
        status: booking.status,
        issuedAt: booking.issuedAt,
        paymentStatus: booking.paymentStatus,
        route: this.buildRouteFromTickets(booking.tickets),
        passengerSummary: this.buildPassengerSummary(booking.tickets).join(', '),
        customerId: booking.customerId,
        customerName: this.getCoverageBuyerName(booking),
        supplierId: booking.supplierId,
        supplierName: booking.supplier?.name ?? null,
        totalSellPrice: Number(booking.totalSellPrice ?? 0),
        totalNetPrice: Number(booking.totalNetPrice ?? 0),
      })),
      paymentSummary: {
        ledgerDirection: invoice.direction === 'OUTGOING' ? 'RECEIVABLE' : 'PAYABLE',
        ...paymentSummary,
      },
      businessLinkage: {
        linkedBookingCount: uniqueBookings.length,
        unmatchedLineCount: unmatchedLines.length,
        duplicatePnrCount: duplicatePnrs.length,
        counterpartyMatched: counterpartyMismatches.length === 0,
        counterpartyMismatchCount: counterpartyMismatches.length,
      },
    };
  }

  private isMissingInvoiceStorageError(error: unknown) {
    const code = (error as { code?: string })?.code;
    if (code !== 'P2021') {
      return false;
    }

    const message = (error as { message?: string })?.message?.toLowerCase() ?? '';
    return message.includes('invoice_record')
      || message.includes('invoice_records')
      || message.includes('invoice_line_item')
      || message.includes('invoice_line_items')
      || message.includes('invoice_attachment')
      || message.includes('invoice_attachments')
      || message.includes('invoice_review')
      || message.includes('invoice_reviews')
      || message.includes('invoice_import_batch')
      || message.includes('invoice_import_batches')
      || message.includes('invoice_export_batch')
      || message.includes('invoice_export_batches');
  }

  private async ensureInvoiceStorageReady() {
    try {
      await Promise.all([
        this.prisma.invoiceRecord.count(),
        this.prisma.invoiceLineItem.count(),
      ]);
    } catch (error) {
      if (!this.isMissingInvoiceStorageError(error)) {
        throw error;
      }

      throw new BadRequestException(
        'Kho dữ liệu Invoice chưa được khởi tạo trong database. Cần đồng bộ schema invoice trước khi tạo hoặc cập nhật hóa đơn.',
      );
    }
  }

  private buildListWhere(dto: ListInvoicesDto): Prisma.InvoiceRecordWhereInput {
    const where: Prisma.InvoiceRecordWhereInput = {};

    if (dto.direction) where.direction = dto.direction;
    if (dto.status) where.status = dto.status;
    if (dto.customerId) where.customerId = dto.customerId;
    if (dto.supplierId) where.supplierId = dto.supplierId;

    if (dto.dateFrom || dto.dateTo) {
      where.invoiceDate = {
        ...(dto.dateFrom ? { gte: new Date(dto.dateFrom) } : {}),
        ...(dto.dateTo ? { lte: new Date(`${dto.dateTo}T23:59:59.999Z`) } : {}),
      };
    }

    if (dto.search) {
      const search = dto.search.trim();
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { invoiceSeries: { contains: search, mode: 'insensitive' } },
        { buyerLegalName: { contains: search, mode: 'insensitive' } },
        { buyerTaxCode: { contains: search, mode: 'insensitive' } },
        { supplierLegalName: { contains: search, mode: 'insensitive' } },
        { supplierTaxCode: { contains: search, mode: 'insensitive' } },
        { customer: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
        { supplier: { is: { name: { contains: search, mode: 'insensitive' } } } },
        {
          lines: {
            some: {
              OR: [
                { pnr: { contains: search, mode: 'insensitive' } },
                { bookingCode: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }

    return where;
  }

  async getSummary() {
    const eligibleBookingWhere = this.buildCoverageBookingWhere();
    const [
      eligibleBookingCount,
      missingSupplierCount,
      receivableOutstanding,
      payableOutstanding,
      receivableOverdue,
      payableOverdue,
    ] = await Promise.all([
      this.prisma.booking.count({
        where: eligibleBookingWhere,
      }),
      this.prisma.booking.count({
        where: {
          ...eligibleBookingWhere,
          supplierId: null,
        },
      }),
      this.prisma.accountsLedger.aggregate({
        where: {
          direction: 'RECEIVABLE',
          status: { notIn: ['PAID', 'WRITTEN_OFF', 'REFUNDED'] as any },
        },
        _count: true,
        _sum: { remaining: true },
      }),
      this.prisma.accountsLedger.aggregate({
        where: {
          direction: 'PAYABLE',
          status: { notIn: ['PAID', 'WRITTEN_OFF', 'REFUNDED'] as any },
        },
        _count: true,
        _sum: { remaining: true },
      }),
      this.prisma.accountsLedger.aggregate({
        where: {
          direction: 'RECEIVABLE',
          status: 'OVERDUE',
        },
        _sum: { remaining: true },
      }),
      this.prisma.accountsLedger.aggregate({
        where: {
          direction: 'PAYABLE',
          status: 'OVERDUE',
        },
        _sum: { remaining: true },
      }),
    ]);

    try {
      const [
        incoming,
        outgoing,
        reviewQueue,
        ocrImportQueue,
        readyForExport,
        incomingCoveredBookings,
        outgoingCoveredBookings,
      ] = await Promise.all([
        this.prisma.invoiceRecord.aggregate({
          where: { direction: 'INCOMING' },
          _count: true,
          _sum: { totalAmount: true },
        }),
        this.prisma.invoiceRecord.aggregate({
          where: { direction: 'OUTGOING' },
          _count: true,
          _sum: { totalAmount: true },
        }),
        this.prisma.invoiceRecord.count({
          where: { status: { in: ['OCR_PENDING', 'NEED_REVIEW', 'VERIFIED'] } },
        }),
        this.prisma.invoiceImportBatch.count({
          where: { status: { in: ['OCR_PENDING', 'NEED_REVIEW', 'VERIFIED'] } },
        }),
        this.prisma.invoiceRecord.count({
          where: { status: 'READY_FOR_EXPORT' },
        }),
        this.prisma.invoiceLineItem.findMany({
          where: {
            bookingId: { not: null },
            booking: {
              is: eligibleBookingWhere,
            },
            invoice: {
              direction: 'INCOMING',
              status: { notIn: [...INACTIVE_INVOICE_STATUSES] },
            },
          },
          distinct: ['bookingId'],
          select: { bookingId: true },
        }),
        this.prisma.invoiceLineItem.findMany({
          where: {
            bookingId: { not: null },
            booking: {
              is: eligibleBookingWhere,
            },
            invoice: {
              direction: 'OUTGOING',
              status: { notIn: [...INACTIVE_INVOICE_STATUSES] },
            },
          },
          distinct: ['bookingId'],
          select: { bookingId: true },
        }),
      ]);

      return {
        incomingCount: incoming._count,
        incomingTotal: Number(incoming._sum.totalAmount ?? 0),
        outgoingCount: outgoing._count,
        outgoingTotal: Number(outgoing._sum.totalAmount ?? 0),
        reviewQueueCount: reviewQueue + ocrImportQueue,
        readyForExportCount: readyForExport,
        eligibleBookingCount,
        missingSupplierCount,
        missingIncomingCount: Math.max(eligibleBookingCount - incomingCoveredBookings.length, 0),
        missingOutgoingCount: Math.max(eligibleBookingCount - outgoingCoveredBookings.length, 0),
        receivableOutstandingCount: receivableOutstanding._count,
        receivableOutstandingAmount: Number(receivableOutstanding._sum.remaining ?? 0),
        payableOutstandingCount: payableOutstanding._count,
        payableOutstandingAmount: Number(payableOutstanding._sum.remaining ?? 0),
        receivableOverdueAmount: Number(receivableOverdue._sum.remaining ?? 0),
        payableOverdueAmount: Number(payableOverdue._sum.remaining ?? 0),
      };
    } catch (error) {
      if (!this.isMissingInvoiceStorageError(error)) {
        throw error;
      }

      return {
        incomingCount: 0,
        incomingTotal: 0,
        outgoingCount: 0,
        outgoingTotal: 0,
        reviewQueueCount: 0,
        readyForExportCount: 0,
        eligibleBookingCount,
        missingSupplierCount,
        missingIncomingCount: eligibleBookingCount,
        missingOutgoingCount: eligibleBookingCount,
        receivableOutstandingCount: receivableOutstanding._count,
        receivableOutstandingAmount: Number(receivableOutstanding._sum.remaining ?? 0),
        payableOutstandingCount: payableOutstanding._count,
        payableOutstandingAmount: Number(payableOutstanding._sum.remaining ?? 0),
        receivableOverdueAmount: Number(receivableOverdue._sum.remaining ?? 0),
        payableOverdueAmount: Number(payableOverdue._sum.remaining ?? 0),
      };
    }
  }

  async getCoverageQueue(dto: ListInvoiceCoverageDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const where = this.buildCoverageBookingWhere(dto.search);

    const [bookings, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [
          { issuedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        include: {
          customer: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              email: true,
              type: true,
              companyName: true,
              companyTaxId: true,
              customerCode: true,
            },
          },
          supplier: {
            select: {
              id: true,
              code: true,
              name: true,
              type: true,
              taxId: true,
              contactName: true,
              contactPhone: true,
              contactEmail: true,
              bankAccount: true,
              bankName: true,
            },
          },
          tickets: {
            include: {
              passenger: {
                select: {
                  fullName: true,
                  type: true,
                },
              },
            },
            orderBy: { departureTime: 'asc' },
          },
          ledgers: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);

    const bookingIds = bookings.map((booking) => booking.id);
    let invoiceLinks: Array<Prisma.InvoiceLineItemGetPayload<{
      include: {
        invoice: {
          select: {
            id: true;
            code: true;
            direction: true;
            status: true;
            invoiceNumber: true;
            invoiceDate: true;
          };
        };
      };
    }>> = [];

    if (bookingIds.length > 0) {
      try {
        invoiceLinks = await this.prisma.invoiceLineItem.findMany({
          where: {
            bookingId: { in: bookingIds },
            invoice: {
              status: { notIn: [...INACTIVE_INVOICE_STATUSES] },
            },
          },
          include: {
            invoice: {
              select: {
                id: true,
                code: true,
                direction: true,
                status: true,
                invoiceNumber: true,
                invoiceDate: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (error) {
        if (!this.isMissingInvoiceStorageError(error)) {
          throw error;
        }
      }
    }

    const linksByBooking = new Map<string, Array<typeof invoiceLinks[number]>>();
    for (const link of invoiceLinks) {
      if (!link.bookingId) continue;
      const bucket = linksByBooking.get(link.bookingId) ?? [];
      bucket.push(link);
      linksByBooking.set(link.bookingId, bucket);
    }

    const data = bookings.map((booking) => {
      const route = this.buildRouteFromTickets(booking.tickets);
      const passengerNames = Array.from(new Set(
        booking.tickets
          .map((ticket) => ticket.passenger?.fullName?.trim())
          .filter((value): value is string => Boolean(value)),
      ));

      const relatedLinks = linksByBooking.get(booking.id) ?? [];
      const incomingInvoices = relatedLinks
        .filter((link) => link.invoice.direction === 'INCOMING')
        .map((link) => link.invoice)
        .filter((invoice, index, collection) => collection.findIndex((item) => item.id === invoice.id) === index);
      const outgoingInvoices = relatedLinks
        .filter((link) => link.invoice.direction === 'OUTGOING')
        .map((link) => link.invoice)
        .filter((invoice, index, collection) => collection.findIndex((item) => item.id === invoice.id) === index);

      const incomingStatus = !booking.supplierId
        ? 'MISSING_SUPPLIER'
        : incomingInvoices.length > 0
          ? 'READY'
          : 'MISSING';
      const outgoingStatus = outgoingInvoices.length > 0 ? 'READY' : 'MISSING';
      const receivableLedgers = booking.ledgers.filter((ledger) => ledger.direction === 'RECEIVABLE');
      const payableLedgers = booking.ledgers.filter((ledger) => ledger.direction === 'PAYABLE');

      return {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        pnr: booking.pnr,
        bookingStatus: booking.status,
        issuedAt: booking.issuedAt,
        paymentStatus: booking.paymentStatus,
        route,
        passengerSummary: passengerNames.join(', '),
        customerId: booking.customerId,
        customerType: booking.customer?.type ?? null,
        customerName: this.getCoverageBuyerName(booking),
        customerTaxCode: booking.customer?.type === 'CORPORATE' ? booking.customer.companyTaxId : null,
        supplierId: booking.supplierId,
        supplierName: booking.supplier?.name ?? null,
        supplierCode: booking.supplier?.code ?? null,
        totalSellPrice: Number(booking.totalSellPrice ?? 0),
        totalNetPrice: Number(booking.totalNetPrice ?? 0),
        incomingStatus,
        outgoingStatus,
        incomingInvoices,
        outgoingInvoices,
        receivableSummary: this.summarizeLedgerCollection(receivableLedgers),
        payableSummary: this.summarizeLedgerCollection(payableLedgers),
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async findAll(dto: ListInvoicesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;
    const where = this.buildListWhere(dto);
    const sortBy = dto.sortBy && ['invoiceDate', 'createdAt', 'updatedAt', 'totalAmount', 'code'].includes(dto.sortBy)
      ? dto.sortBy
      : 'invoiceDate';
    const sortOrder = dto.sortOrder === 'asc' ? 'asc' : 'desc';

    try {
      const [data, total] = await Promise.all([
        this.prisma.invoiceRecord.findMany({
          where,
          skip,
          take: pageSize,
          orderBy: { [sortBy]: sortOrder },
          include: {
            customer: {
              select: {
                id: true,
                fullName: true,
                phone: true,
                email: true,
                type: true,
                companyName: true,
                companyTaxId: true,
                customerCode: true,
              },
            },
            supplier: {
              select: {
                id: true,
                code: true,
                name: true,
                type: true,
                taxId: true,
                contactName: true,
                contactPhone: true,
                contactEmail: true,
                bankAccount: true,
                bankName: true,
              },
            },
            lines: {
              orderBy: { lineNo: 'asc' },
            },
            attachments: {
              orderBy: { createdAt: 'desc' },
            },
            reviews: {
              orderBy: { createdAt: 'desc' },
            },
          },
        }),
        this.prisma.invoiceRecord.count({ where }),
      ]);

      return {
        data: data.map((record) => this.serializeInvoice(record)),
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    } catch (error) {
      if (!this.isMissingInvoiceStorageError(error)) {
        throw error;
      }

      return {
        data: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }
  }

  async findOne(id: string) {
    await this.ensureInvoiceStorageReady();

    const record = await this.prisma.invoiceRecord.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            type: true,
            companyName: true,
            companyTaxId: true,
            customerCode: true,
          },
        },
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            taxId: true,
            contactName: true,
            contactPhone: true,
            contactEmail: true,
            bankAccount: true,
            bankName: true,
          },
        },
        lines: {
          orderBy: { lineNo: 'asc' },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!record) {
      throw new NotFoundException('Invoice not found');
    }

    return this.enrichInvoice(this.serializeInvoice(record));
  }

  async create(dto: CreateInvoiceDto, userId: string) {
    await this.ensureInvoiceStorageReady();

    const code = await this.generateCode(dto.direction);
    let normalizedLines = dto.lines.map((line, index) => this.normalizeLine(line, index));
    if (normalizedLines.length === 0) {
      throw new BadRequestException('Invoice must have at least one line item.');
    }

    const matchedResult = await this.matchLinesToBookings(dto.direction, normalizedLines, {
      customerId: dto.customerId,
      supplierId: dto.supplierId,
    });
    normalizedLines = matchedResult.lines;

    const inferredCustomerId = dto.direction === 'OUTGOING' && !dto.customerId
      ? Array.from(new Set(matchedResult.matchedBookings.map((booking) => booking.customerId).filter(Boolean)))[0] ?? null
      : dto.customerId ?? null;
    const inferredSupplierId = dto.direction === 'INCOMING' && !dto.supplierId
      ? Array.from(new Set(matchedResult.matchedBookings.map((booking) => booking.supplierId).filter(Boolean)))[0] ?? null
      : dto.supplierId ?? null;

    await this.validateLineUniqueness(dto.direction, normalizedLines, {
      supplierId: inferredSupplierId,
    });

    const customer = inferredCustomerId
      ? await this.prisma.customer.findUnique({ where: { id: inferredCustomerId } })
      : null;
    const supplier = inferredSupplierId
      ? await this.prisma.supplierProfile.findUnique({ where: { id: inferredSupplierId } })
      : null;

    if (dto.direction === 'INCOMING' && !supplier && !dto.supplierLegalName) {
      throw new BadRequestException('Hóa đơn đầu vào cần có nhà cung cấp.');
    }

    if (dto.direction === 'OUTGOING' && !customer && !dto.buyerLegalName) {
      throw new BadRequestException('Hóa đơn đầu ra cần có thông tin người mua.');
    }

    const totals = this.calcTotals(normalizedLines);
    const defaultSeller = this.getDefaultSellerProfile();
    const buyerSnapshot = this.buildBuyerFromCustomer(customer);
    const supplierBaseSnapshot = this.buildSupplierSnapshot(supplier);

    const seller = {
      ...defaultSeller,
      sellerLegalName: dto.sellerLegalName ?? defaultSeller.sellerLegalName,
      sellerTaxCode: dto.sellerTaxCode ?? defaultSeller.sellerTaxCode,
      sellerAddress: dto.sellerAddress ?? defaultSeller.sellerAddress,
      sellerEmail: dto.sellerEmail ?? defaultSeller.sellerEmail,
      sellerPhone: dto.sellerPhone ?? defaultSeller.sellerPhone,
      sellerBankAccount: dto.sellerBankAccount ?? defaultSeller.sellerBankAccount,
      sellerBankName: dto.sellerBankName ?? defaultSeller.sellerBankName,
    };
    const buyer = {
      ...buyerSnapshot,
      buyerType: dto.buyerType ?? buyerSnapshot.buyerType,
      buyerLegalName: dto.buyerLegalName ?? buyerSnapshot.buyerLegalName,
      buyerTaxCode: dto.buyerTaxCode ?? buyerSnapshot.buyerTaxCode,
      buyerAddress: dto.buyerAddress ?? buyerSnapshot.buyerAddress,
      buyerEmail: dto.buyerEmail ?? buyerSnapshot.buyerEmail,
      buyerPhone: dto.buyerPhone ?? buyerSnapshot.buyerPhone,
      buyerFullName: dto.buyerFullName ?? buyerSnapshot.buyerFullName,
    };
    const supplierSnapshot = {
      ...supplierBaseSnapshot,
      supplierLegalName: dto.supplierLegalName ?? supplierBaseSnapshot.supplierLegalName,
      supplierTaxCode: dto.supplierTaxCode ?? supplierBaseSnapshot.supplierTaxCode,
      supplierAddress: dto.supplierAddress ?? supplierBaseSnapshot.supplierAddress,
      supplierEmail: dto.supplierEmail ?? supplierBaseSnapshot.supplierEmail,
      supplierPhone: dto.supplierPhone ?? supplierBaseSnapshot.supplierPhone,
      supplierBankAccount: dto.supplierBankAccount ?? supplierBaseSnapshot.supplierBankAccount,
      supplierBankName: dto.supplierBankName ?? supplierBaseSnapshot.supplierBankName,
    };

    const created: InvoiceRecordWithRelations = await this.prisma.invoiceRecord.create({
      data: {
        code,
        direction: dto.direction,
        sourceType: dto.sourceType ?? 'MANUAL',
        status: dto.status ?? 'DRAFT',
        invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : new Date(),
        periodFrom: dto.periodFrom ? new Date(dto.periodFrom) : null,
        periodTo: dto.periodTo ? new Date(dto.periodTo) : null,
        currencyCode: dto.currencyCode?.trim().toUpperCase() || 'VND',
        paymentMethod: dto.paymentMethod?.trim() || null,
        customerId: inferredCustomerId,
        supplierId: inferredSupplierId,
        buyerType: buyer.buyerType ?? null,
        invoiceNumber: dto.invoiceNumber?.trim() || null,
        invoiceSeries: dto.invoiceSeries?.trim() || null,
        invoiceTemplateNo: dto.invoiceTemplateNo?.trim() || null,
        transactionId: dto.transactionId?.trim() || null,
        lookupUrl: dto.lookupUrl?.trim() || null,
        ...seller,
        buyerLegalName: buyer.buyerLegalName,
        buyerTaxCode: buyer.buyerTaxCode,
        buyerAddress: buyer.buyerAddress,
        buyerEmail: buyer.buyerEmail,
        buyerPhone: buyer.buyerPhone,
        buyerFullName: buyer.buyerFullName,
        ...supplierSnapshot,
        subtotal: totals.subtotal,
        vatAmount: totals.vatAmount,
        totalAmount: totals.totalAmount,
        tags: this.normalizeTags(dto.tags),
        notes: dto.notes?.trim() || null,
        metadata: {
          matchedBookingCount: matchedResult.matchedBookings.length,
          ...(dto.metadata ?? {}),
        } as Prisma.InputJsonValue,
        createdBy: userId,
        lines: {
          create: normalizedLines,
        },
        reviews: {
          create: {
            action: 'CREATE',
            toStatus: dto.status ?? 'DRAFT',
            createdBy: userId,
            payload: {
              sourceType: dto.sourceType ?? 'MANUAL',
              lineCount: normalizedLines.length,
              matchedBookingCount: matchedResult.matchedBookings.length,
            },
          },
        },
      },
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            type: true,
            companyName: true,
            companyTaxId: true,
            customerCode: true,
          },
        },
        supplier: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            taxId: true,
            contactName: true,
            contactPhone: true,
            contactEmail: true,
            bankAccount: true,
            bankName: true,
          },
        },
        lines: {
          orderBy: { lineNo: 'asc' },
        },
        attachments: {
          orderBy: { createdAt: 'desc' },
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    return this.serializeInvoice(created);
  }

  async createOutgoingFromBookings(dto: CreateInvoiceFromBookingsDto, userId: string) {
    await this.ensureInvoiceStorageReady();

    const bookingIds = Array.from(new Set(dto.bookingIds.map((id) => id.trim()).filter(Boolean)));
    if (bookingIds.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 booking.');
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        id: { in: bookingIds },
        deletedAt: null,
      },
      include: {
        customer: true,
        tickets: {
          include: {
            passenger: true,
          },
          orderBy: { departureTime: 'asc' },
        },
      },
    });

    if (bookings.length !== bookingIds.length) {
      throw new BadRequestException('Có booking không tồn tại hoặc đã bị xóa.');
    }

    const invalidStatus = bookings.find((booking) => !ELIGIBLE_BOOKING_STATUSES.includes(booking.status as (typeof ELIGIBLE_BOOKING_STATUSES)[number]));
    if (invalidStatus) {
      throw new BadRequestException(`Booking ${invalidStatus.bookingCode} chưa đủ điều kiện tạo draft hóa đơn.`);
    }

    const customerIds = Array.from(new Set(bookings.map((booking) => booking.customerId)));
    if (customerIds.length !== 1) {
      throw new BadRequestException('Phase 1 chỉ hỗ trợ tạo draft cho các booking cùng 1 khách hàng.');
    }

    const existingLine = await this.prisma.invoiceLineItem.findFirst({
      where: {
        bookingId: { in: bookingIds },
        invoice: {
          direction: 'OUTGOING',
          status: {
            notIn: [...INACTIVE_INVOICE_STATUSES],
          },
        },
      },
      include: {
        invoice: {
          select: {
            code: true,
            status: true,
          },
        },
      },
    });

    if (existingLine) {
      throw new BadRequestException(
        `Booking đã tồn tại trong invoice ${existingLine.invoice.code} (${existingLine.invoice.status}).`,
      );
    }

    const lines: InvoiceLineDto[] = bookings.map((booking) => {
      const passengerNames = Array.from(new Set(
        booking.tickets
          .map((ticket) => ticket.passenger?.fullName?.trim().toUpperCase())
          .filter((value): value is string => Boolean(value)),
      ));
      const quantity = passengerNames.length || 1;
      const route = this.buildRouteFromTickets(booking.tickets);
      const totalSellPrice = Number(booking.totalSellPrice ?? 0);
      const totalFees = Number(booking.totalFees ?? 0);

      return {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        pnr: booking.pnr || booking.bookingCode,
        ticketIds: booking.tickets.map((ticket) => ticket.id),
        description: `${booking.pnr || booking.bookingCode} / ${route || booking.bookingCode}`,
        passengerName: passengerNames.join(', '),
        passengerType: quantity > 1 ? 'MULTI' : (booking.tickets[0]?.passenger?.type ?? 'ADT'),
        route,
        quantity,
        unitName: 'Vé',
        currencyCode: 'VND',
        unitPrice: quantity > 0 ? totalSellPrice / quantity : totalSellPrice,
        amountBeforeVat: totalSellPrice,
        vatRate: 0,
        vatAmount: 0,
        amount: totalSellPrice,
        serviceFee: totalFees,
        notes: booking.notes || undefined,
      };
    });

    const customer = bookings[0].customer;
    const buyerFullName = this.getCoverageBuyerName(bookings[0]);
    const buyerLegalName = customer.type === 'CORPORATE'
      ? (customer.companyName || customer.fullName || buyerFullName)
      : buyerFullName;
    const periodFrom = dto.periodFrom
      ? new Date(dto.periodFrom)
      : new Date(Math.min(...bookings.map((booking) => (booking.issuedAt ?? booking.createdAt).getTime())));
    const periodTo = dto.periodTo
      ? new Date(dto.periodTo)
      : new Date(Math.max(...bookings.map((booking) => (booking.issuedAt ?? booking.createdAt).getTime())));

    return this.create({
      direction: 'OUTGOING',
      sourceType: 'BOOKING_BATCH',
      status: 'DRAFT',
      invoiceDate: dto.invoiceDate,
      periodFrom: periodFrom.toISOString(),
      periodTo: periodTo.toISOString(),
      customerId: customer.id,
      buyerType: customer.type,
      buyerLegalName,
      buyerFullName,
      buyerTaxCode: customer.type === 'CORPORATE' ? (customer.companyTaxId || undefined) : undefined,
      notes: dto.notes,
      tags: dto.tags,
      metadata: {
        bookingIds,
        createdFrom: 'booking-batch',
      },
      lines,
    }, userId);
  }

  async createIncomingFromBookings(dto: CreateInvoiceFromBookingsDto, userId: string) {
    await this.ensureInvoiceStorageReady();

    const bookingIds = Array.from(new Set(dto.bookingIds.map((id) => id.trim()).filter(Boolean)));
    if (bookingIds.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 booking.');
    }

    const bookings = await this.prisma.booking.findMany({
      where: {
        id: { in: bookingIds },
        deletedAt: null,
      },
      include: {
        supplier: true,
        tickets: {
          include: {
            passenger: true,
          },
          orderBy: { departureTime: 'asc' },
        },
      },
    });

    if (bookings.length !== bookingIds.length) {
      throw new BadRequestException('Có booking không tồn tại hoặc đã bị xóa.');
    }

    const invalidStatus = bookings.find((booking) => !ELIGIBLE_BOOKING_STATUSES.includes(booking.status as (typeof ELIGIBLE_BOOKING_STATUSES)[number]));
    if (invalidStatus) {
      throw new BadRequestException(`Booking ${invalidStatus.bookingCode} chưa đủ điều kiện tạo draft hóa đơn đầu vào.`);
    }

    const missingSupplier = bookings.find((booking) => !booking.supplierId);
    if (missingSupplier) {
      throw new BadRequestException(`Booking ${missingSupplier.bookingCode} chua gan nha cung cap.`);
    }

    const supplierIds = Array.from(new Set(bookings.map((booking) => booking.supplierId).filter(Boolean)));
    if (supplierIds.length !== 1) {
      throw new BadRequestException('Chi co the tao draft dau vao cho cac booking cung 1 nha cung cap.');
    }

    const existingLine = await this.prisma.invoiceLineItem.findFirst({
      where: {
        bookingId: { in: bookingIds },
        invoice: {
          direction: 'INCOMING',
          status: {
            notIn: [...INACTIVE_INVOICE_STATUSES],
          },
        },
      },
      include: {
        invoice: {
          select: {
            code: true,
            status: true,
          },
        },
      },
    });

    if (existingLine) {
      throw new BadRequestException(
        `Booking đã tồn tại trong hóa đơn đầu vào ${existingLine.invoice.code} (${existingLine.invoice.status}).`,
      );
    }

    const lines: InvoiceLineDto[] = bookings.map((booking) => {
      const passengerNames = Array.from(new Set(
        booking.tickets
          .map((ticket) => ticket.passenger?.fullName?.trim().toUpperCase())
          .filter((value): value is string => Boolean(value)),
      ));
      const quantity = passengerNames.length || 1;
      const route = this.buildRouteFromTickets(booking.tickets);
      const totalNetPrice = Number(booking.totalNetPrice ?? 0);

      return {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        pnr: booking.pnr || booking.bookingCode,
        ticketIds: booking.tickets.map((ticket) => ticket.id),
        description: `${booking.pnr || booking.bookingCode} / ${route || booking.bookingCode}`,
        passengerName: passengerNames.join(', '),
        passengerType: quantity > 1 ? 'MULTI' : (booking.tickets[0]?.passenger?.type ?? 'ADT'),
        route,
        quantity,
        unitName: 'Vé',
        currencyCode: 'VND',
        unitPrice: quantity > 0 ? totalNetPrice / quantity : totalNetPrice,
        amountBeforeVat: totalNetPrice,
        vatRate: 0,
        vatAmount: 0,
        amount: totalNetPrice,
        serviceFee: 0,
        notes: booking.notes || undefined,
      };
    });

    const supplier = bookings[0].supplier;
    if (!supplier) {
      throw new BadRequestException('Không tìm thấy nhà cung cấp cho lô booking này.');
    }

    const periodFrom = dto.periodFrom
      ? new Date(dto.periodFrom)
      : new Date(Math.min(...bookings.map((booking) => (booking.issuedAt ?? booking.createdAt).getTime())));
    const periodTo = dto.periodTo
      ? new Date(dto.periodTo)
      : new Date(Math.max(...bookings.map((booking) => (booking.issuedAt ?? booking.createdAt).getTime())));

    return this.create({
      direction: 'INCOMING',
      sourceType: 'BOOKING_BATCH',
      status: 'DRAFT',
      invoiceDate: dto.invoiceDate,
      periodFrom: periodFrom.toISOString(),
      periodTo: periodTo.toISOString(),
      supplierId: supplier.id,
      supplierLegalName: supplier.name,
      supplierTaxCode: supplier.taxId || undefined,
      supplierEmail: supplier.contactEmail || undefined,
      supplierPhone: supplier.contactPhone || undefined,
      supplierBankAccount: supplier.bankAccount || undefined,
      supplierBankName: supplier.bankName || undefined,
      notes: dto.notes,
      tags: dto.tags,
      metadata: {
        bookingIds,
        createdFrom: 'booking-batch-incoming',
      },
      lines,
    }, userId);
  }

  async getDebtStatement(dto: ListInvoiceDebtStatementDto) {
    const dateFrom = dto.dateFrom ? new Date(dto.dateFrom) : null;
    const dateTo = dto.dateTo ? new Date(`${dto.dateTo}T23:59:59.999Z`) : null;
    const search = dto.search?.trim();
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      status: { in: [...ELIGIBLE_BOOKING_STATUSES] },
      ...(dto.customerId ? { customerId: dto.customerId } : {}),
    };

    if (search) {
      where.OR = [
        { bookingCode: { contains: search, mode: 'insensitive' } },
        { pnr: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { customer: { is: { fullName: { contains: search, mode: 'insensitive' } } } },
        { customer: { is: { companyName: { contains: search, mode: 'insensitive' } } } },
      ];
    }

    if (dateFrom || dateTo) {
      const issueDateFilter = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };

      where.AND = [
        {
          OR: [
            { issuedAt: issueDateFilter },
            {
              AND: [
                { issuedAt: null },
                { createdAt: issueDateFilter },
              ],
            },
          ],
        },
      ];
    }

    const bookings = await this.prisma.booking.findMany({
      where,
      orderBy: [
        { issuedAt: 'asc' },
        { createdAt: 'asc' },
      ],
      include: {
        customer: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            type: true,
            companyName: true,
            companyTaxId: true,
            customerCode: true,
          },
        },
        tickets: {
          include: {
            passenger: {
              select: {
                fullName: true,
                type: true,
              },
            },
          },
          orderBy: { departureTime: 'asc' },
        },
        ledgers: {
          where: {
            direction: 'RECEIVABLE',
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    const bookingIds = bookings.map((booking) => booking.id);
    const customer = bookings[0]?.customer ?? (
      dto.customerId
        ? await this.prisma.customer.findUnique({
          where: { id: dto.customerId },
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
            type: true,
            companyName: true,
            companyTaxId: true,
            customerCode: true,
          },
        })
        : null
    );

    let invoiceLinks: Array<Prisma.InvoiceLineItemGetPayload<{
      include: {
        invoice: {
          select: {
            id: true;
            code: true;
            status: true;
            invoiceNumber: true;
            invoiceDate: true;
          };
        };
      };
    }>> = [];

    if (bookingIds.length > 0) {
      try {
        invoiceLinks = await this.prisma.invoiceLineItem.findMany({
          where: {
            bookingId: { in: bookingIds },
            invoice: {
              direction: 'OUTGOING',
              status: { notIn: [...INACTIVE_INVOICE_STATUSES] },
            },
          },
          include: {
            invoice: {
              select: {
                id: true,
                code: true,
                status: true,
                invoiceNumber: true,
                invoiceDate: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });
      } catch (error) {
        if (!this.isMissingInvoiceStorageError(error)) {
          throw error;
        }
      }
    }

    const outgoingByBooking = new Map<string, typeof invoiceLinks[number]['invoice']>();
    for (const link of invoiceLinks) {
      if (!link.bookingId || outgoingByBooking.has(link.bookingId)) continue;
      outgoingByBooking.set(link.bookingId, link.invoice);
    }

    const rows = bookings.map((booking, index) => {
      const passengerNames = this.buildPassengerSummary(booking.tickets);
      const quantity = passengerNames.length || booking.tickets.length || 1;
      const totalAmount = Number(booking.totalSellPrice ?? 0);
      const receivableSummary = this.summarizeLedgerCollection(booking.ledgers);
      const linkedInvoice = outgoingByBooking.get(booking.id) ?? null;

      return {
        rowNo: index + 1,
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        pnr: booking.pnr || booking.bookingCode,
        issuedAt: booking.issuedAt ?? booking.createdAt,
        route: this.buildRouteFromTickets(booking.tickets),
        passengerSummary: passengerNames.join(', '),
        currencyCode: 'VND',
        ticketQuantity: quantity,
        unitPrice: quantity > 0 ? totalAmount / quantity : totalAmount,
        vatAmount: 0,
        totalAmount,
        notes: booking.notes ?? null,
        paymentMethod: booking.paymentMethod,
        bookingPaymentStatus: booking.paymentStatus,
        outgoingInvoice: linkedInvoice,
        receivableSummary,
      };
    });

    const summary = rows.reduce((acc, row) => ({
      bookingCount: acc.bookingCount + 1,
      totalAmount: acc.totalAmount + row.totalAmount,
      paidAmount: acc.paidAmount + row.receivableSummary.paidAmount,
      remainingAmount: acc.remainingAmount + row.receivableSummary.remainingAmount,
      overdueAmount: acc.overdueAmount + row.receivableSummary.overdueAmount,
    }), {
      bookingCount: 0,
      totalAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      overdueAmount: 0,
    });

    return {
      generatedAt: new Date().toISOString(),
      dateFrom: dto.dateFrom ?? null,
      dateTo: dto.dateTo ?? null,
      seller: this.getDefaultSellerProfile(),
      customer,
      rows,
      summary: {
        ...summary,
        paymentMethods: Array.from(new Set(bookings.map((booking) => booking.paymentMethod).filter(Boolean))),
      },
    };
  }

  async update(id: string, dto: UpdateInvoiceDto, userId: string) {
    await this.ensureInvoiceStorageReady();

    const existing = await this.prisma.invoiceRecord.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    let normalizedLines = dto.lines?.map((line, index) => this.normalizeLine(line, index));
    let matchedBookingCount: number | null = null;
    if (normalizedLines) {
      const matchedResult = await this.matchLinesToBookings(existing.direction, normalizedLines, {
        customerId: existing.customerId,
        supplierId: existing.supplierId,
      });
      normalizedLines = matchedResult.lines;
      matchedBookingCount = matchedResult.matchedBookings.length;
      await this.validateLineUniqueness(existing.direction, normalizedLines, {
        currentInvoiceId: id,
        supplierId: existing.supplierId,
      });
    }

    const totals = normalizedLines ? this.calcTotals(normalizedLines) : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.invoiceRecord.update({
        where: { id },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.invoiceDate ? { invoiceDate: new Date(dto.invoiceDate) } : {}),
          ...(dto.periodFrom !== undefined ? { periodFrom: dto.periodFrom ? new Date(dto.periodFrom) : null } : {}),
          ...(dto.periodTo !== undefined ? { periodTo: dto.periodTo ? new Date(dto.periodTo) : null } : {}),
          ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod?.trim() || null } : {}),
          ...(dto.buyerType !== undefined ? { buyerType: dto.buyerType } : {}),
          ...(dto.invoiceNumber !== undefined ? { invoiceNumber: dto.invoiceNumber?.trim() || null } : {}),
          ...(dto.invoiceSeries !== undefined ? { invoiceSeries: dto.invoiceSeries?.trim() || null } : {}),
          ...(dto.invoiceTemplateNo !== undefined ? { invoiceTemplateNo: dto.invoiceTemplateNo?.trim() || null } : {}),
          ...(dto.transactionId !== undefined ? { transactionId: dto.transactionId?.trim() || null } : {}),
          ...(dto.lookupUrl !== undefined ? { lookupUrl: dto.lookupUrl?.trim() || null } : {}),
          ...(dto.buyerLegalName !== undefined ? { buyerLegalName: dto.buyerLegalName?.trim() || null } : {}),
          ...(dto.buyerTaxCode !== undefined ? { buyerTaxCode: dto.buyerTaxCode?.trim() || null } : {}),
          ...(dto.buyerAddress !== undefined ? { buyerAddress: dto.buyerAddress?.trim() || null } : {}),
          ...(dto.buyerEmail !== undefined ? { buyerEmail: dto.buyerEmail?.trim() || null } : {}),
          ...(dto.buyerPhone !== undefined ? { buyerPhone: dto.buyerPhone?.trim() || null } : {}),
          ...(dto.buyerFullName !== undefined ? { buyerFullName: dto.buyerFullName?.trim() || null } : {}),
          ...(dto.supplierLegalName !== undefined ? { supplierLegalName: dto.supplierLegalName?.trim() || null } : {}),
          ...(dto.supplierTaxCode !== undefined ? { supplierTaxCode: dto.supplierTaxCode?.trim() || null } : {}),
          ...(dto.supplierAddress !== undefined ? { supplierAddress: dto.supplierAddress?.trim() || null } : {}),
          ...(dto.supplierEmail !== undefined ? { supplierEmail: dto.supplierEmail?.trim() || null } : {}),
          ...(dto.supplierPhone !== undefined ? { supplierPhone: dto.supplierPhone?.trim() || null } : {}),
          ...(dto.supplierBankAccount !== undefined ? { supplierBankAccount: dto.supplierBankAccount?.trim() || null } : {}),
          ...(dto.supplierBankName !== undefined ? { supplierBankName: dto.supplierBankName?.trim() || null } : {}),
          ...(dto.tags !== undefined ? { tags: this.normalizeTags(dto.tags) } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
          ...(dto.metadata !== undefined ? { metadata: dto.metadata as Prisma.InputJsonValue } : {}),
          ...(totals ? {
            subtotal: totals.subtotal,
            vatAmount: totals.vatAmount,
            totalAmount: totals.totalAmount,
          } : {}),
        },
      });

      if (normalizedLines) {
        await tx.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
        if (normalizedLines.length > 0) {
          await tx.invoiceLineItem.createMany({
            data: normalizedLines.map((line) => ({
              invoiceId: id,
              ...line,
            })),
          });
        }
      }

      const payload: Prisma.InputJsonObject = normalizedLines
        ? {
          updatedFields: Object.keys(dto),
          replacedLineCount: normalizedLines.length,
          matchedBookingCount,
        }
        : { updatedFields: Object.keys(dto) };

      await tx.invoiceReviewLog.create({
        data: {
          invoiceId: id,
          action: normalizedLines ? 'UPDATE_WITH_LINES' : 'UPDATE',
          fromStatus: existing.status,
          toStatus: dto.status ?? existing.status,
          createdBy: userId,
          payload,
        },
      });
    });

    return this.findOne(id);
  }

  async addAttachment(id: string, dto: CreateInvoiceAttachmentDto, userId: string) {
    await this.ensureInvoiceStorageReady();

    await this.findOne(id);

    const attachment = await this.prisma.invoiceAttachment.create({
      data: {
        invoiceId: id,
        type: dto.type ?? InvoiceAttachmentType.OTHER,
        fileName: dto.fileName.trim(),
        mimeType: dto.mimeType?.trim() || null,
        storagePath: dto.storagePath?.trim() || null,
        externalUrl: dto.externalUrl?.trim() || null,
        notes: dto.notes?.trim() || null,
        createdBy: userId,
      },
    });

    await this.prisma.invoiceReviewLog.create({
      data: {
        invoiceId: id,
        action: 'ADD_ATTACHMENT',
        createdBy: userId,
        payload: {
          attachmentId: attachment.id,
          type: attachment.type,
          fileName: attachment.fileName,
        },
      },
    });

    return attachment;
  }
}
