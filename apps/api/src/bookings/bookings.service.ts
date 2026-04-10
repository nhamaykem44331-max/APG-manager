// APG Manager RMS - Bookings Service (nghiÃ¡Â»â€¡p vÃ¡Â»Â¥ Ã„â€˜Ã¡ÂºÂ·t vÃƒÂ©)
import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { N8nService } from '../automation/n8n.service';
import { BookingStatus, Prisma, User, UserRole } from '@prisma/client';
import { CustomersService } from '../customers/customers.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { AddTicketDto } from './dto/add-ticket.dto';
import { AddPaymentDto } from './dto/add-payment.dto';
import { AddAdjustmentDto } from './dto/add-adjustment.dto';
import { NamedCreditService } from './named-credit.service';

/** ChuyÃ¡Â»Æ’n chuÃ¡Â»â€”i ISO thÃƒÂ nh Date; fallback vÃ¡Â»Â now nÃ¡ÂºÂ¿u invalid Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh lÃ¡Â»â€”i DB */
function safeDate(iso: string, label = 'date'): Date {
  if (!iso || iso.trim() === '') {
    console.warn(`[safeDate] ${label}: empty string, using current time`);
    return new Date();
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    console.warn(`[safeDate] ${label}: invalid ISO "${iso}", using current time`);
    return new Date();
  }
  return d;
}

function parseFilterStart(value: string) {
  return new Date(value.includes('T') ? value : `${value}T00:00:00.000Z`);
}

function parseFilterEnd(value: string) {
  return new Date(value.includes('T') ? value : `${value}T23:59:59.999Z`);
}

function resolveBusinessDate(value?: string | Date | null) {
  return value ? safeDate(String(value), 'businessDate') : new Date();
}

type DebtLinkedLedgerPayment = {
  id: string;
  amount: Prisma.Decimal;
  method: Prisma.$Enums.PaymentMethod;
  paidAt: Date;
  notes: string | null;
};

type DebtTrackableReceivableLedger = {
  id: string;
  code: string;
  totalAmount: Prisma.Decimal;
  remaining: Prisma.Decimal;
  dueDate: Date;
  createdAt: Date;
  issueDate: Date;
  category: Prisma.$Enums.LedgerCategory;
  payments: DebtLinkedLedgerPayment[];
};

// MÃƒÂ¡y trÃ¡ÂºÂ¡ng thÃƒÂ¡i booking - quy Ã„â€˜Ã¡Â»â€¹nh chuyÃ¡Â»Æ’n trÃ¡ÂºÂ¡ng thÃƒÂ¡i hÃ¡Â»Â£p lÃ¡Â»â€¡
const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  NEW:             ['PROCESSING', 'CANCELLED'],
  PROCESSING:      ['QUOTED', 'CANCELLED'],
  QUOTED:          ['PENDING_PAYMENT', 'PROCESSING', 'CANCELLED'],
  PENDING_PAYMENT: ['ISSUED', 'CANCELLED'],
  ISSUED:          ['COMPLETED', 'CHANGED', 'REFUNDED'],
  COMPLETED:       [],
  CHANGED:         ['ISSUED', 'REFUNDED'],
  REFUNDED:        [],
  CANCELLED:       [],
};

const STATUS_ORDER: BookingStatus[] = [
  'NEW',
  'PROCESSING',
  'QUOTED',
  'PENDING_PAYMENT',
  'ISSUED',
  'COMPLETED',
  'CHANGED',
  'REFUNDED',
  'CANCELLED',
];

function getAllowedStatusTargets(
  currentStatus: BookingStatus,
  _statusHistory: Array<{ fromStatus: BookingStatus; toStatus: BookingStatus }>,
): BookingStatus[] {
  void STATUS_TRANSITIONS[currentStatus];
  return STATUS_ORDER.filter((status) => status !== currentStatus);
}

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private n8n: N8nService,
    private customers: CustomersService,
    private namedCreditService: NamedCreditService,
  ) {}

  private async refreshAffectedCustomers(...customerIds: Array<string | null | undefined>) {
    const uniqueIds = Array.from(
      new Set(customerIds.filter((customerId): customerId is string => Boolean(customerId))),
    );

    if (uniqueIds.length === 0) {
      return;
    }

    await Promise.all(uniqueIds.map((customerId) => this.customers.refreshCustomerMetrics(customerId)));
  }

  private async generateLedgerCodeWithClient(
    client: PrismaService | Prisma.TransactionClient,
    direction: 'RECEIVABLE' | 'PAYABLE',
  ): Promise<string> {
    const prefix = direction === 'RECEIVABLE' ? 'AR' : 'AP';
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const datePrefix = `${prefix}-${yy}${mm}${dd}`;

    const rows = await client.accountsLedger.findMany({
      where: { code: { startsWith: `${datePrefix}-` } },
      select: { code: true },
    });

    const maxSeq = rows.reduce((max, row) => {
      const match = row.code.match(new RegExp(`^${datePrefix}-(\\d+)$`));
      if (!match) return max;

      const value = Number(match[1]);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);

    return `${datePrefix}-${(maxSeq + 1).toString().padStart(3, '0')}`;
  }

  private isLedgerCodeConflict(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    const targets = Array.isArray(target)
      ? target.map((item) => String(item))
      : target
        ? [String(target)]
        : [];

    if (targets.length === 0) {
      return true;
    }

    return targets.some((item) => item.includes('code'));
  }

  private async createLedgerWithGeneratedCode(
    client: PrismaService | Prisma.TransactionClient,
    direction: 'RECEIVABLE' | 'PAYABLE',
    buildData: (code: string) => Prisma.AccountsLedgerUncheckedCreateInput,
  ) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = await this.generateLedgerCodeWithClient(client, direction);

      try {
        return await client.accountsLedger.create({
          data: buildData(code),
        });
      } catch (error) {
        if (this.isLedgerCodeConflict(error) && attempt < 4) {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException('KhÃ´ng thá»ƒ sinh mÃ£ cÃ´ng ná»£ má»›i. Vui lÃ²ng thá»­ láº¡i.');
  }

  // LÃ¡ÂºÂ¥y danh sÃƒÂ¡ch booking cÃƒÂ³ filter, sort, paginate
  async findAll(dto: ListBookingsDto) {
    const {
      page = 1, pageSize = 20,
      status, source, search,
      sortBy = 'createdAt', order = 'desc',
    } = dto;

    const where: Prisma.BookingWhereInput = { deletedAt: null };
    const include = {
      customer: { select: { id: true, fullName: true, vipTier: true, customerCode: true, type: true, phone: true } },
      staff: { select: { id: true, fullName: true } },
      tickets: { orderBy: { departureTime: 'asc' as const } },
      adjustments: { orderBy: { createdAt: 'asc' as const } },
    };

    if (status) where.status = status as BookingStatus;
    if (source) where.source = source as never;
    if (search) {
      where.OR = [
        { bookingCode: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactPhone: { contains: search } },
        { pnr: { contains: search, mode: 'insensitive' } },
      ];
    }

    // FIX 6: Filter theo ngÃƒÂ y tÃ¡ÂºÂ¡o
    if (dto.dateFrom || dto.dateTo) {
      const businessDateFrom = dto.dateFrom ? parseFilterStart(dto.dateFrom) : undefined;
      const businessDateTo = dto.dateTo ? parseFilterEnd(dto.dateTo) : undefined;

      where.businessDate = {
        ...(businessDateFrom && { gte: businessDateFrom }),
        ...(businessDateTo && { lte: businessDateTo }),
      };
    }

    if (sortBy === 'departureTime') {
      const conditions: Prisma.Sql[] = [Prisma.sql`b.deleted_at IS NULL`];
      const orderSql = order === 'asc' ? Prisma.raw('ASC') : Prisma.raw('DESC');
      const searchTerm = search ? `%${search}%` : null;

      if (status) conditions.push(Prisma.sql`b.status = ${status}`);
      if (source) conditions.push(Prisma.sql`b.source = ${source}`);
      if (searchTerm) {
        conditions.push(
          Prisma.sql`(
            b.booking_code ILIKE ${searchTerm}
            OR b.contact_name ILIKE ${searchTerm}
            OR b.contact_phone ILIKE ${searchTerm}
            OR b.pnr ILIKE ${searchTerm}
          )`,
        );
      }
      if (dto.dateFrom) conditions.push(Prisma.sql`COALESCE(b.business_date, b.created_at) >= ${parseFilterStart(dto.dateFrom)}`);
      if (dto.dateTo) conditions.push(Prisma.sql`COALESCE(b.business_date, b.created_at) <= ${parseFilterEnd(dto.dateTo)}`);

      const [idRows, total] = await Promise.all([
        this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT b.id
          FROM bookings b
          LEFT JOIN tickets t
            ON t.booking_id = b.id
           AND t.status = 'ACTIVE'
          WHERE ${Prisma.join(conditions, ' AND ')}
          GROUP BY b.id
          ORDER BY MIN(t.departure_time) ${orderSql} NULLS LAST, COALESCE(b.business_date, b.created_at) DESC
          OFFSET ${(page - 1) * pageSize}
          LIMIT ${pageSize}
        `),
        this.prisma.booking.count({ where }),
      ]);

      const ids = idRows.map((row) => row.id);
      const records = ids.length > 0
        ? await this.prisma.booking.findMany({
            where: { id: { in: ids } },
            include,
          })
        : [];
      const recordMap = new Map(records.map((record) => [record.id, record]));
      const data = ids.map((id) => recordMap.get(id)).filter(Boolean);

      return {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      };
    }

    const sortColumn = sortBy === 'createdAt' ? 'businessDate' : sortBy;

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, vipTier: true, customerCode: true, type: true, phone: true } },
          staff: { select: { id: true, fullName: true } },
          tickets: { orderBy: { departureTime: 'asc' } }, // GiÃ¡Â»Â¯ Ã„â€˜ÃƒÂºng thÃ¡Â»Â© tÃ¡Â»Â± hÃƒÂ nh trÃƒÂ¬nh Ã„â€˜Ã¡Â»Æ’ hiÃ¡Â»Æ’n thÃ¡Â»â€¹ route/khÃ¡Â»Å¸i hÃƒÂ nh chÃƒÂ­nh xÃƒÂ¡c
          adjustments: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { [sortColumn]: order },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.booking.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // LÃ¡ÂºÂ¥y chi tiÃ¡ÂºÂ¿t booking kÃƒÂ¨m tÃ¡ÂºÂ¥t cÃ¡ÂºÂ£ relations
  async findOne(id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, deletedAt: null },
      include: {
        customer: true,
        staff: { select: { id: true, fullName: true, email: true, role: true } },
        tickets: { include: { passenger: true } },
        payments: { orderBy: { paidAt: 'desc' } },
        statusHistory: { orderBy: { createdAt: 'asc' } },
        supplier: true,
        adjustments: { orderBy: { createdAt: 'asc' } },
        creditsCreated: {
          orderBy: { createdAt: 'desc' },
          include: {
            customer: { select: { fullName: true } },
          },
        },
        ledgers: { select: { id: true, code: true, direction: true, status: true, remaining: true, totalAmount: true, createdAt: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y booking ID: ${id}`);
    }

    if (booking.customer && !booking.customer.customerCode) {
      booking.customer.customerCode = await this.customers.ensureCustomerCode(booking.customer.id);
    }

    const debtRecordableAmount = await this.calculateDebtRecordableAmount(this.prisma, booking.id);

    return {
      ...booking,
      debtRecordableAmount,
    };
  }

  // TÃ¡ÂºÂ¡o booking mÃ¡Â»â€ºi
  async create(dto: CreateBookingDto, staffId: string) {
    try {
      const customerId = await this.resolveCustomerId(dto);

      const booking: Prisma.BookingGetPayload<{
        include: {
          customer: { select: { fullName: true; phone: true; customerCode: true } };
          staff: { select: { fullName: true } };
          supplier: { select: { id: true; name: true; code: true } };
        };
      }> = await this.createBookingRecord(dto, customerId, staffId);

      // Ghi log tÃ¡ÂºÂ¡o mÃ¡Â»â€ºi
      await this.prisma.bookingStatusLog.create({
        data: {
          bookingId: booking.id,
          fromStatus: 'NEW',
          toStatus: 'NEW',
          changedBy: staffId,
          reason: 'Táº¡o booking má»›i',
        },
      });

      // Trigger n8n webhook thÃƒÂ´ng bÃƒÂ¡o booking mÃ¡Â»â€ºi (fire & forget)
      this.n8n.triggerWebhook('/booking-new', {
        bookingCode: booking.bookingCode,
        customerName: booking.customer?.fullName ?? booking.contactName,
        customerPhone: booking.customer?.phone ?? booking.contactPhone,
        staffName: booking.staff.fullName,
      }).catch(err => console.error('[N8N] webhook error:', err));

      return booking;
    } catch (error) {
      console.error('[BookingsService.create] ERROR:', error);
      throw error;
    }
  }

  // CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t thÃƒÂ´ng tin booking
  async update(id: string, dto: UpdateBookingDto, currentUser: Pick<User, 'id' | 'role'>) {
    const existingBooking = await this.findOne(id); // KiÃ¡Â»Æ’m tra tÃ¡Â»â€œn tÃ¡ÂºÂ¡i

    const data: Prisma.BookingUncheckedUpdateInput = {};
    let normalizedSupplierId: string | null | undefined;
    let resolvedSupplier: { id: string; name: string; type: Prisma.AccountsLedgerUncheckedUpdateInput['partyType'] } | null = null;

    if (dto.contactName !== undefined) data.contactName = dto.contactName;
    if (dto.source !== undefined) data.source = dto.source as Prisma.BookingUncheckedUpdateInput['source'];
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone;
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.pnr !== undefined) data.pnr = dto.pnr;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.internalNotes !== undefined) data.internalNotes = dto.internalNotes;
    if (dto.createdAt !== undefined) {
      const createdAt = dto.createdAt.trim();
      if (createdAt) data.businessDate = safeDate(createdAt, 'businessDate');
    }

    if (dto.staffId !== undefined) {
      const staffId = dto.staffId.trim();

      if (!staffId) {
        throw new BadRequestException('staffId khÃ´ng há»£p lá»‡.');
      }

      if (staffId !== existingBooking.staffId && currentUser.role !== UserRole.ADMIN) {
        throw new ForbiddenException('Chá»‰ admin má»›i Ä‘Æ°á»£c thay Ä‘á»•i nhÃ¢n viÃªn phá»¥ trÃ¡ch.');
      }

      const staff = await this.prisma.user.findUnique({
        where: { id: staffId },
        select: { id: true, isActive: true },
      });

      if (!staff || !staff.isActive) {
        throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y nhÃ¢n viÃªn phá»¥ trÃ¡ch phÃ¹ há»£p.');
      }

      data.staffId = staff.id;
    }

    if (dto.supplierId !== undefined) {
      normalizedSupplierId = typeof dto.supplierId === 'string'
        ? dto.supplierId.trim() || null
        : null;

      if (normalizedSupplierId) {
        const supplier = await this.prisma.supplierProfile.findUnique({
          where: { id: normalizedSupplierId },
          select: { id: true, name: true, type: true },
        });

        if (!supplier) {
          throw new NotFoundException('Không tìm thấy nhà cung cấp phù hợp.');
        }

        resolvedSupplier = {
          id: supplier.id,
          name: supplier.name,
          type: supplier.type as Prisma.AccountsLedgerUncheckedUpdateInput['partyType'],
        };
      }

      data.supplierId = normalizedSupplierId;
    }

    const supplierChanged = dto.supplierId !== undefined
      && (normalizedSupplierId ?? null) !== (existingBooking.supplierId ?? null);
    const paymentMethodChanged = dto.paymentMethod !== undefined
      && dto.paymentMethod !== existingBooking.paymentMethod;

    // Ã¢â€â‚¬Ã¢â€â‚¬ Re-sync AP ledger entries when supplier changes Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    if (supplierChanged) {
      try {
        // Update all PAYABLE ledger entries for this booking to point to the new supplier
        const existingAP = await this.prisma.accountsLedger.findMany({
          where: { bookingId: id, direction: 'PAYABLE' },
        });

        if (existingAP.length > 0) {
          await this.prisma.accountsLedger.updateMany({
            where: { bookingId: id, direction: 'PAYABLE' },
            data: {
              supplierId: normalizedSupplierId,
              ...(resolvedSupplier
                ? { partyType: resolvedSupplier.type }
                : {}),
              description: resolvedSupplier
                ? `Pháº£i tráº£ NCC ${resolvedSupplier.name} â€” Booking ${(await this.findOne(id)).bookingCode}`
                : undefined,
            },
          });
          console.log(`[AP-SYNC] Re-synced ${existingAP.length} AP entries to supplier ${resolvedSupplier?.name ?? 'NULL'}`);
        }
      } catch (err) {
        console.error('[AP-SYNC] Error re-syncing AP entries:', err);
      }
    }

    if (dto.customerId !== undefined) {
      const customerId = dto.customerId?.trim();
      if (!customerId) {
        throw new BadRequestException('customerId khÃ´ng há»£p lá»‡.');
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, fullName: true, phone: true, type: true, customerCode: true },
      });

      if (!customer) {
        throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y khÃ¡ch hÃ ng.');
      }

      data.customerId = customer.id;
      if (dto.contactName === undefined) data.contactName = customer.fullName;
      if (dto.contactPhone === undefined) data.contactPhone = customer.phone;
    }

    const updatedBooking = await this.prisma.booking.update({
      where: { id },
      data,
    });

    if (supplierChanged || paymentMethodChanged) {
      try {
        await this.syncPayableLedgerForBooking(id, currentUser.id);
      } catch (err) {
        console.error(`[BookingsService.update] Failed to sync AP for booking ${existingBooking.bookingCode}:`, err);
      }
    }

    const customerChanged = dto.customerId !== undefined
      && updatedBooking.customerId !== existingBooking.customerId
      && Boolean(updatedBooking.customerId);

    if (customerChanged && updatedBooking.customerId) {
      try {
        const passengerIds = await this.prisma.ticket.findMany({
          where: { bookingId: id },
          select: { passengerId: true },
          distinct: ['passengerId'],
        });

        const linkedPassengerIds = passengerIds
          .map((ticket) => ticket.passengerId)
          .filter((passengerId): passengerId is string => Boolean(passengerId));

        if (linkedPassengerIds.length > 0) {
          await this.prisma.passenger.updateMany({
            where: { id: { in: linkedPassengerIds } },
            data: { customerId: updatedBooking.customerId },
          });
        }

        await this.syncReceivableLedgerForBooking(id, currentUser.id, { createIfMissing: true });
      } catch (err) {
        console.error(`[BookingsService.update] Failed to sync AR for booking ${existingBooking.bookingCode}:`, err);
      }
    }

    if (dto.customerId !== undefined && updatedBooking.customerId !== existingBooking.customerId) {
      try {
        await this.refreshAffectedCustomers(existingBooking.customerId, updatedBooking.customerId);
      } catch (err) {
        console.error(`[BookingsService.update] Failed to refresh customer metrics for booking ${existingBooking.bookingCode}:`, err);
      }
    }

    return updatedBooking;
  }

  private getReceivablePartyType(customerType?: string | null) {
    return customerType === 'CORPORATE' ? 'CUSTOMER_CORPORATE' : 'CUSTOMER_INDIVIDUAL';
  }

  private buildReceivableDueDate(referenceDate: Date, customerType?: string | null) {
    const dueDate = new Date(referenceDate);
    const dueDays = customerType === 'CORPORATE' ? 30 : 7;
    dueDate.setDate(dueDate.getDate() + dueDays);
    return dueDate;
  }

  private getLedgerStatus(totalAmount: number, paidAmount: number, dueDate: Date) {
    if (paidAmount >= totalAmount) return 'PAID';
    if (paidAmount > 0) return 'PARTIAL_PAID';
    if (new Date() > dueDate) return 'OVERDUE';
    return 'ACTIVE';
  }

  private getPrimaryTicketLedgerWhere(direction: 'RECEIVABLE' | 'PAYABLE') {
    return {
      direction,
      OR: [
        { category: 'TICKET' as const },
        { category: null },
      ],
    };
  }

  private orderLedgerAllocations<T extends { dueDate: Date; createdAt: Date; category?: string | null }>(ledgers: T[]) {
    return [...ledgers].sort((a, b) => {
      const dueDelta = a.dueDate.getTime() - b.dueDate.getTime();
      if (dueDelta !== 0) return dueDelta;

      const aPriority = a.category === 'TICKET' || a.category == null ? 0 : 1;
      const bPriority = b.category === 'TICKET' || b.category == null ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;

      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  private async getDebtTrackableReceivables(
    client: PrismaService | Prisma.TransactionClient,
    bookingId: string,
  ): Promise<DebtTrackableReceivableLedger[]> {
    return client.accountsLedger.findMany({
      where: {
        bookingId,
        direction: 'RECEIVABLE',
        status: { not: 'WRITTEN_OFF' },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        code: true,
        totalAmount: true,
        remaining: true,
        dueDate: true,
        createdAt: true,
        issueDate: true,
        category: true,
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            paidAt: true,
            notes: true,
          },
        },
      },
    });
  }

  private getDebtLinkedAmountForLedger(ledger: Pick<DebtTrackableReceivableLedger, 'payments'>) {
    return (ledger.payments ?? [])
      .filter((payment) => payment.method === 'DEBT')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
  }

  private calculateDebtRecordableAmountFromLedgers(ledgers: DebtTrackableReceivableLedger[]) {
    return ledgers.reduce((sum, ledger) => (
      sum + Math.max(0, Number(ledger.remaining) - this.getDebtLinkedAmountForLedger(ledger))
    ), 0);
  }

  private async calculateDebtRecordableAmount(
    client: PrismaService | Prisma.TransactionClient,
    bookingId: string,
  ) {
    const receivableLedgers = await this.getDebtTrackableReceivables(client, bookingId);
    return this.calculateDebtRecordableAmountFromLedgers(receivableLedgers);
  }

  private async linkDebtPaymentToReceivables(
    client: Prisma.TransactionClient,
    bookingCode: string,
    paymentId: string,
    amount: number,
    paidAt: Date,
    receivableLedgers: DebtTrackableReceivableLedger[],
  ) {
    const linkedAmounts = new Map<string, number>(
      receivableLedgers.map((ledger) => [ledger.id, this.getDebtLinkedAmountForLedger(ledger)]),
    );
    const orderedLedgers = this.orderLedgerAllocations(receivableLedgers);
    let unallocated = amount;

    for (const ledger of orderedLedgers) {
      if (unallocated <= 0) {
        break;
      }

      const alreadyLinked = linkedAmounts.get(ledger.id) ?? 0;
      const availableToLink = Math.max(0, Number(ledger.remaining) - alreadyLinked);
      const allocatable = Math.min(unallocated, availableToLink);
      if (allocatable <= 0) {
        continue;
      }

      await client.ledgerPayment.create({
        data: {
          ledgerId: ledger.id,
          amount: allocatable,
          method: 'DEBT',
          paidAt,
          reference: paymentId,
          notes: `Linked debt payment ${paymentId} for booking ${bookingCode}`,
        },
      });

      linkedAmounts.set(ledger.id, alreadyLinked + allocatable);
      unallocated -= allocatable;
    }

    if (unallocated > 0) {
      throw new BadRequestException(
        `Khong con cong no moi de ghi nhan (${unallocated.toLocaleString('vi-VN')} VND chua duoc lien ket).`,
      );
    }
  }

  private async resolveBookingPaymentStatusSnapshot(
    client: PrismaService | Prisma.TransactionClient,
    bookingId: string,
  ) {
    const [booking, receivableLedgers, payments] = await Promise.all([
      client.booking.findUnique({ where: { id: bookingId } }),
      client.accountsLedger.findMany({
        where: {
          bookingId,
          direction: 'RECEIVABLE',
          status: { not: 'WRITTEN_OFF' },
        },
        select: { totalAmount: true, paidAmount: true },
      }),
      client.payment.findMany({ where: { bookingId } }),
    ]);

    if (!booking) {
      return null;
    }

    const hasReceivableLedger = receivableLedgers.length > 0;
    const totalDue = hasReceivableLedger
      ? receivableLedgers.reduce((sum, ledger) => sum + Number(ledger.totalAmount), 0)
      : Number(booking.totalSellPrice);
    const totalPaid = hasReceivableLedger
      ? receivableLedgers.reduce((sum, ledger) => sum + Number(ledger.paidAmount), 0)
      : payments
          .filter((payment) => payment.method !== 'DEBT')
          .reduce((sum, payment) => sum + Number(payment.amount), 0);

    let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
    if (totalDue > 0 && totalPaid >= totalDue) paymentStatus = 'PAID';
    else if (totalPaid > 0) paymentStatus = 'PARTIAL';
    else paymentStatus = 'UNPAID';

    return { paymentStatus, totalDue, totalPaid };
  }

  private async updatePaymentStatusWithClient(
    client: PrismaService | Prisma.TransactionClient,
    bookingId: string,
  ) {
    const snapshot = await this.resolveBookingPaymentStatusSnapshot(client, bookingId);
    if (!snapshot) {
      return;
    }

    await client.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: snapshot.paymentStatus },
    });
  }

  private async syncReceivableLedgerForBooking(
    bookingId: string,
    updatedBy: string,
    options: { createIfMissing?: boolean } = {},
  ) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: {
          select: { id: true, fullName: true, customerCode: true, type: true },
        },
        payments: {
          select: { amount: true, method: true },
        },
      },
    });

    if (!booking || !booking.customer) {
      return;
    }

    const existingAR = await this.prisma.accountsLedger.findFirst({
      where: {
        bookingId,
        ...this.getPrimaryTicketLedgerWhere('RECEIVABLE'),
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalAmount = Number(booking.totalSellPrice);
    const paidAmount = existingAR
      ? Math.min(Number(existingAR.paidAmount), totalAmount)
      : Math.min(
          booking.payments
            .filter((payment) => payment.method !== 'DEBT')
            .reduce((sum, payment) => sum + Number(payment.amount), 0),
          totalAmount,
        );
    const remaining = Math.max(0, totalAmount - paidAmount);
    const shouldHaveReceivable = ['ISSUED', 'COMPLETED', 'CHANGED'].includes(booking.status)
      && totalAmount > 0;

    if (!existingAR && (!options.createIfMissing || !shouldHaveReceivable || remaining <= 0)) {
      return;
    }

    const customerCode = booking.customer.customerCode
      ?? await this.customers.ensureCustomerCode(booking.customer.id);
    const issueDate = existingAR?.issueDate ?? booking.issuedAt ?? new Date();
    const dueDate = this.buildReceivableDueDate(issueDate, booking.customer.type);
    const status = this.getLedgerStatus(totalAmount, paidAmount, dueDate);
    const ledgerData = {
      customerId: booking.customer.id,
      customerCode,
      partyType: this.getReceivablePartyType(booking.customer.type) as never,
      bookingId: booking.id,
      bookingCode: booking.bookingCode,
      totalAmount,
      paidAmount,
      remaining,
      dueDate,
      status: status as never,
      category: 'TICKET' as never,
      description: `CÃ´ng ná»£ vÃ© ${booking.bookingCode}`,
    };

    if (existingAR) {
      await this.prisma.accountsLedger.update({
        where: { id: existingAR.id },
        data: ledgerData,
      });
      console.log(`[AR-SYNC] Synced AR ${existingAR.code} to customer ${booking.customer.fullName}`);
      return;
    }

    const createdLedger = await this.createLedgerWithGeneratedCode(
      this.prisma,
      'RECEIVABLE',
      (code) => ({
        code,
        direction: 'RECEIVABLE',
        issueDate,
        createdBy: updatedBy,
        ...ledgerData,
      }),
    );
    console.log(`[AR-AUTO] Created AR ${createdLedger.code} for booking ${booking.bookingCode} -> ${booking.customer.fullName}`);
  }

  private async syncPayableLedgerForBooking(bookingId: string, updatedBy: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        supplier: {
          select: { id: true, name: true, type: true, paymentTerms: true },
        },
      },
    });

    if (!booking || !booking.supplierId || !booking.supplier) {
      return;
    }

    const shouldHavePayable = ['ISSUED', 'COMPLETED', 'CHANGED'].includes(booking.status);
    if (!shouldHavePayable || Number(booking.totalNetPrice) <= 0) {
      return;
    }

    const existingAP = await this.prisma.accountsLedger.findFirst({
      where: {
        bookingId,
        ...this.getPrimaryTicketLedgerWhere('PAYABLE'),
      },
      orderBy: { createdAt: 'asc' },
    });

    const dueDate = existingAP?.dueDate
      ? new Date(existingAP.dueDate)
      : (() => {
          const nextDueDate = new Date();
          nextDueDate.setDate(nextDueDate.getDate() + (booking.supplier?.paymentTerms ?? 15));
          return nextDueDate;
        })();

    const totalAmount = Number(booking.totalNetPrice);
    const paidAmount = Math.min(Number(existingAP?.paidAmount ?? 0), totalAmount);
    const remaining = Math.max(0, totalAmount - paidAmount);
    const status =
      paidAmount >= totalAmount
        ? 'PAID'
        : paidAmount > 0
          ? 'PARTIAL_PAID'
          : new Date() > dueDate
            ? 'OVERDUE'
            : 'ACTIVE';

    if (existingAP) {
      await this.prisma.accountsLedger.update({
        where: { id: existingAP.id },
        data: {
          supplierId: booking.supplier.id,
          partyType: booking.supplier.type as any,
          totalAmount,
          paidAmount,
          remaining,
          dueDate,
          status: status as any,
          category: 'TICKET' as any,
          description: `Pháº£i tráº£ NCC ${booking.supplier.name} â€” Booking ${booking.bookingCode}`,
        },
      });
      console.log(`[AP-SYNC] Synced AP ${existingAP.code} to supplier ${booking.supplier.name}`);
      return;
    }

    const supplier = booking.supplier;
    const createdLedger = await this.createLedgerWithGeneratedCode(
      this.prisma,
      'PAYABLE',
      (code) => ({
        code,
        direction: 'PAYABLE',
        partyType: supplier.type as any,
        supplierId: supplier.id,
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        totalAmount,
        paidAmount,
        remaining,
        dueDate,
        status: status as any,
        category: 'TICKET' as any,
        description: `Pháº£i tráº£ NCC ${supplier.name} â€” Booking ${booking.bookingCode}`,
        createdBy: updatedBy,
      }),
    );
    console.log(`[AP-AUTO] Created AP ${createdLedger.code} for booking ${booking.bookingCode} -> ${supplier.name}`);
  }

  // Soft delete booking
  async remove(id: string, staffId: string) {
    const booking = await this.findOne(id);

    // ChuyÃ¡Â»Æ’n trÃ¡ÂºÂ¡ng thÃƒÂ¡i sang CANCELLED vÃƒÂ  set deletedAt
    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          deletedAt: new Date(),
          notes: booking.notes ? `[DELETED] ${booking.notes}` : '[DELETED]',
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: 'CANCELLED',
          changedBy: staffId,
          reason: 'XÃ³a booking (soft delete)',
        },
      }),
    ]);

    await this.refreshAffectedCustomers(booking.customerId);

    return updated;
  }


  // Hard delete booking (chÃ¡Â»â€° cho CANCELLED)
  async hardDelete(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: { id: true, bookingCode: true, status: true, deletedAt: true, customerId: true },
    });

    if (!booking) {
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y booking ID: ${id}`);
    }

    if (booking.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Chá»‰ cÃ³ thá»ƒ xÃ³a vÄ©nh viá»…n booking á»Ÿ tráº¡ng thÃ¡i "ÄÃ£ há»§y". Tráº¡ng thÃ¡i hiá»‡n táº¡i: ${booking.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      const ledgerIds = (await tx.accountsLedger.findMany({
        where: { bookingId: id },
        select: { id: true },
      })).map((l) => l.id);

      if (ledgerIds.length > 0) {
        await tx.ledgerPayment.deleteMany({ where: { ledgerId: { in: ledgerIds } } });
        await tx.accountsLedger.deleteMany({ where: { id: { in: ledgerIds } } });
      }

      await tx.invoiceLineItem.deleteMany({ where: { bookingId: id } });
      await tx.bookingAdjustment.deleteMany({ where: { bookingId: id } });
      await tx.payment.deleteMany({ where: { bookingId: id } });
      await tx.bookingStatusLog.deleteMany({ where: { bookingId: id } });
      await tx.ticket.deleteMany({ where: { bookingId: id } });
      await tx.booking.delete({ where: { id } });
    });

    await this.refreshAffectedCustomers(booking.customerId);

    return {
      success: true,
      id,
      message: `ÄÃ£ xÃ³a vÄ©nh viá»…n booking ${booking.bookingCode}.`,
    };
  }

  // ChuyÃ¡Â»Æ’n trÃ¡ÂºÂ¡ng thÃƒÂ¡i booking (cÃƒÂ³ validation)
  async updateStatus(id: string, dto: UpdateBookingStatusDto, changedBy: string) {
    const booking = await this.findOne(id);

    const allowedTransitions = getAllowedStatusTargets(
      booking.status,
      (booking.statusHistory ?? []).map((entry) => ({
        fromStatus: entry.fromStatus as BookingStatus,
        toStatus: entry.toStatus as BookingStatus,
      })),
    );
    const targetStatus = dto.toStatus as BookingStatus;

    if (['ISSUED', 'PENDING_PAYMENT'].includes(targetStatus)) {
      if (!booking.customerId || !booking.customer || booking.contactName === 'KhÃ¡ch hÃ ng má»›i') {
        throw new BadRequestException('Vui lÃ²ng chá»n khÃ¡ch hÃ ng trÆ°á»›c khi chuyá»ƒn tráº¡ng thÃ¡i.');
      }

      if (!booking.supplierId) {
        throw new BadRequestException('Vui lÃ²ng chá»n nhÃ  cung cáº¥p trÆ°á»›c khi chuyá»ƒn tráº¡ng thÃ¡i.');
      }
    }

    // KiÃ¡Â»Æ’m tra chuyÃ¡Â»Æ’n trÃ¡ÂºÂ¡ng thÃƒÂ¡i cÃƒÂ³ hÃ¡Â»Â£p lÃ¡Â»â€¡ khÃƒÂ´ng
    if (!allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `KhÃ´ng thá»ƒ chuyá»ƒn tá»« "${booking.status}" sang "${targetStatus}". ` +
        `Cho phÃ©p: ${allowedTransitions.join(', ') || 'KhÃ´ng cÃ³ (tráº¡ng thÃ¡i cuá»‘i)'}`
      );
    }

    // CÃ¡ÂºÂ­p nhÃ¡ÂºÂ­t trong transaction Ã„â€˜Ã¡Â»Æ’ Ã„â€˜Ã¡ÂºÂ£m bÃ¡ÂºÂ£o tÃƒÂ­nh toÃƒÂ n vÃ¡ÂºÂ¹n
    const [updated] = await this.prisma.$transaction([
      this.prisma.booking.update({
        where: { id },
        data: {
          status: targetStatus,
          issuedAt: targetStatus === 'ISSUED' ? new Date() : undefined,
        },
      }),
      this.prisma.bookingStatusLog.create({
        data: {
          bookingId: id,
          fromStatus: booking.status,
          toStatus: targetStatus,
          changedBy,
          reason: dto.reason,
        },
      }),
    ]);

    // Ã¢â€â‚¬Ã¢â€â‚¬ BÃ†Â°Ã¡Â»â€ºc 2i: Auto-tÃ¡ÂºÂ¡o AR cÃƒÂ´ng nÃ¡Â»Â£ khi xuÃ¡ÂºÂ¥t vÃƒÂ© chÃ†Â°a thanh toÃƒÂ¡n Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    // Business rule: TÃ¡ÂºÂ¡o cÃƒÂ´ng nÃ¡Â»Â£ phÃ¡ÂºÂ£i thu (AR) cho MÃ¡Â»Å’I booking chÃ†Â°a thanh toÃƒÂ¡n khi xuÃ¡ÂºÂ¥t vÃƒÂ©
    // KhÃƒÂ´ng giÃ¡Â»â€ºi hÃ¡ÂºÂ¡n chÃ¡Â»â€° paymentMethod === 'DEBT' Ã¢â‚¬â€ vÃƒÂ¬ khÃƒÂ¡ch cÃƒÂ³ thÃ¡Â»Æ’ thanh toÃƒÂ¡n sau dÃƒÂ¹ chÃ¡Â»Ân bÃ¡ÂºÂ¥t kÃ¡Â»Â³ method nÃƒÂ o
    // Khi khÃƒÂ¡ch thanh toÃƒÂ¡n xong, payLedger() sÃ¡ÂºÂ½ tÃ¡Â»Â± Ã„â€˜Ã¡Â»â„¢ng chuyÃ¡Â»Æ’n status Ã¢â€ â€™ PAID
    if (
      ['ISSUED', 'COMPLETED', 'CHANGED'].includes(targetStatus)
      && booking.paymentStatus !== 'PAID'
    ) {
      try {
        await this.syncReceivableLedgerForBooking(booking.id, changedBy, { createIfMissing: true });
      } catch (err) {
        // KhÃƒÂ´ng throw Ã¢â‚¬â€ khÃƒÂ´ng Ã„â€˜Ã¡Â»Æ’ lÃ¡Â»â€”i ledger chÃ¡ÂºÂ·n viÃ¡Â»â€¡c xuÃ¡ÂºÂ¥t vÃƒÂ©
        console.error(`[LedgerAutoCreate] Lá»—i táº¡o AR cho booking ${booking.bookingCode}:`, err);
      }
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Auto-tÃ¡ÂºÂ¡o AP (phÃ¡ÂºÂ£i trÃ¡ÂºÂ£ NCC) khi xuÃ¡ÂºÂ¥t vÃƒÂ© cÃƒÂ³ supplier Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
    if (targetStatus === 'ISSUED' && booking.supplierId) {
      try {
        const existingAP = await this.prisma.accountsLedger.findFirst({
          where: {
            bookingId: booking.id,
            ...this.getPrimaryTicketLedgerWhere('PAYABLE'),
          },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });

        if (existingAP) {
          console.log(`[AP-AUTO] Skip duplicate AP for booking ${booking.bookingCode}`);
        } else {
        const supplier = await this.prisma.supplierProfile.findUnique({
          where: { id: booking.supplierId },
          select: { id: true, name: true, type: true, paymentTerms: true },
        });

        if (supplier) {
          const apDueDays = supplier.paymentTerms ?? 15;
          const apDueDate = new Date();
          apDueDate.setDate(apDueDate.getDate() + apDueDays);

          const createdLedger = await this.createLedgerWithGeneratedCode(
            this.prisma,
            'PAYABLE',
            (code) => ({
              code,
              direction: 'PAYABLE',
              partyType: supplier.type as any,
              supplierId: booking.supplierId,
              bookingId: booking.id,
              bookingCode: booking.bookingCode,
              totalAmount: booking.totalNetPrice,
              paidAmount: 0,
              remaining: booking.totalNetPrice,
              dueDate: apDueDate,
              category: 'TICKET' as any,
              description: `Pháº£i tráº£ NCC ${supplier.name} â€” Booking ${booking.bookingCode}`,
              createdBy: changedBy,
            }),
          );
          console.log(`[AP-AUTO] Táº¡o AP ${createdLedger.code} â€” ${supplier.name} â€” ${booking.totalNetPrice}`);
        }
        }
      } catch (err) {
        console.error(`[AP-AUTO] Lá»—i táº¡o AP cho booking ${booking.bookingCode}:`, err);
      }
    }

    // GÃ¡Â»Â­i thÃƒÂ´ng bÃƒÂ¡o khi xuÃ¡ÂºÂ¥t vÃƒÂ© hoÃ¡ÂºÂ·c hÃ¡Â»Â§y
    if (targetStatus === 'ISSUED' || targetStatus === 'CANCELLED') {
      await this.n8n.triggerWebhook('/booking-status', {
        bookingCode: booking.bookingCode,
        customerName: booking.customer?.fullName,
        customerPhone: booking.customer?.phone,
        status: targetStatus,
        reason: dto.reason,
      });
    }

    await this.refreshAffectedCustomers(booking.customerId);

    return updated;
  }

  // Helper: sinh mÃƒÂ£ AR-YYMMDD-XXX hoÃ¡ÂºÂ·c AP-YYMMDD-XXX (dÃƒÂ¹ng cho BÃ†Â°Ã¡Â»â€ºc 2i + 2e)
  private normalizePnr(value?: string | null) {
    const normalized = value?.trim().toUpperCase();
    return normalized ? normalized : null;
  }

  private collectBookingPnrs(booking: {
    pnr?: string | null;
    tickets?: Array<{ status?: string | null; airlineBookingCode?: string | null }>;
  }) {
    const pnrs = new Set<string>();

    const bookingPnr = this.normalizePnr(booking.pnr);
    if (bookingPnr) {
      pnrs.add(bookingPnr);
    }

    for (const ticket of booking.tickets ?? []) {
      if (ticket.status && ticket.status !== 'ACTIVE') {
        continue;
      }

      const ticketPnr = this.normalizePnr(ticket.airlineBookingCode);
      if (ticketPnr) {
        pnrs.add(ticketPnr);
      }
    }

    return Array.from(pnrs);
  }

  private hasBookingFinancialLocks(booking: {
    payments?: Array<unknown>;
    ledgers?: Array<unknown>;
  }) {
    return (booking.payments?.length ?? 0) > 0 || (booking.ledgers?.length ?? 0) > 0;
  }

  private async recalculateBookingTotalsWithClient(
    client: Prisma.TransactionClient | PrismaService,
    bookingId: string,
  ) {
    const tickets = await client.ticket.findMany({
      where: { bookingId, status: 'ACTIVE' },
    });

    const totals = tickets.reduce(
      (acc, t) => ({
        totalSellPrice: acc.totalSellPrice + Number(t.sellPrice),
        totalNetPrice: acc.totalNetPrice + Number(t.netPrice),
        totalFees: 0,
        profit: acc.profit + Number(t.profit),
      }),
      { totalSellPrice: 0, totalNetPrice: 0, totalFees: 0, profit: 0 },
    );

    await client.booking.update({
      where: { id: bookingId },
      data: totals,
    });
  }


  // ThÃƒÂªm vÃƒÂ© vÃƒÂ o booking vÃƒÂ  tÃƒÂ­nh lÃ¡ÂºÂ¡i lÃ¡Â»Â£i nhuÃ¡ÂºÂ­n
  async addTicket(bookingId: string, dto: AddTicketDto) {
    const booking = await this.findOne(bookingId);
    const activeTickets = (booking.tickets ?? []).filter((ticket) => ticket.status === 'ACTIVE');
    const hasExistingTickets = activeTickets.length > 0;
    const hasFinancialLocks = this.hasBookingFinancialLocks(booking);
    const incomingPnr = this.normalizePnr(dto.airlineBookingCode);
    const existingPnrs = this.collectBookingPnrs(booking);
    const isNewPnrImport = Boolean(
      incomingPnr &&
      (existingPnrs.length === 0 || !existingPnrs.includes(incomingPnr))
    );

    if (hasFinancialLocks) {
      throw new BadRequestException(
        'Booking Ä‘Ã£ cÃ³ thanh toÃ¡n hoáº·c bÃºt toÃ¡n liÃªn quan. KhÃ´ng thá»ƒ thÃªm hoáº·c thay tháº¿ hÃ nh trÃ¬nh lÃºc nÃ y.',
      );
    }

    const shouldReplaceExistingPnr = Boolean(
      dto.replaceExistingPnr &&
      incomingPnr &&
      hasExistingTickets &&
      isNewPnrImport
    );

    if (isNewPnrImport && hasExistingTickets && !shouldReplaceExistingPnr) {
      throw new BadRequestException(
        'Booking Ä‘ang cÃ³ PNR khÃ¡c. Vui lÃ²ng dÃ¹ng Nháº­p nhanh Ä‘á»ƒ thay tháº¿ toÃ n bá»™ PNR cÅ© trÆ°á»›c khi thÃªm PNR má»›i.',
      );
    }

    const ticket = await this.prisma.$transaction(async (tx) => {
      if (shouldReplaceExistingPnr) {
        await tx.ticket.deleteMany({ where: { bookingId } });
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            pnr: incomingPnr,
            totalSellPrice: 0,
            totalNetPrice: 0,
            totalFees: 0,
            profit: 0,
            paymentStatus: 'UNPAID',
          },
        });
      } else if (incomingPnr && this.normalizePnr(booking.pnr) !== incomingPnr) {
        await tx.booking.update({
          where: { id: bookingId },
          data: { pnr: incomingPnr },
        });
      }

      let passengerId = dto.passengerId;
      if (!passengerId) {
        if (!dto.passengerName) {
          throw new BadRequestException('Cáº§n cung cáº¥p passengerId hoáº·c passengerName.');
        }
        const newPassenger = await tx.passenger.create({
          data: {
            fullName: dto.passengerName,
            type: dto.passengerType ?? 'ADT',
            customerId: booking.customerId,
          },
        });
        passengerId = newPassenger.id;
      }

      const profit = dto.sellPrice - dto.netPrice;

      const createdTicket = await tx.ticket.create({
        data: {
          bookingId,
          passengerId,
          airline: dto.airline,
          flightNumber: dto.flightNumber,
          departureCode: dto.departureCode,
          arrivalCode: dto.arrivalCode,
          departureTime: safeDate(dto.departureTime, 'departureTime'),
          arrivalTime: safeDate(dto.arrivalTime, 'arrivalTime'),
          seatClass: dto.seatClass,
          fareClass: dto.fareClass,
          sellPrice: dto.sellPrice,
          netPrice: dto.netPrice,
          tax: dto.tax,
          serviceFee: dto.serviceFee,
          commission: dto.commission,
          profit,
          eTicketNumber: dto.eTicketNumber,
          baggageAllowance: dto.baggageAllowance,
          airlineBookingCode: incomingPnr,
          status: 'ACTIVE',
        },
        include: { passenger: true },
      });

      await this.recalculateBookingTotalsWithClient(tx, bookingId);

      return createdTicket;
    });

    await this.refreshAffectedCustomers(booking.customerId);

    return ticket;
  }

  // XÃƒÂ³a toÃƒÂ n bÃ¡Â»â„¢ vÃƒÂ©/hÃƒÂ nh trÃƒÂ¬nh vÃƒÂ  reset tÃ¡Â»â€¢ng tiÃ¡Â»Ân vÃ¡Â»Â trÃ¡ÂºÂ¡ng thÃƒÂ¡i ban Ã„â€˜Ã¡ÂºÂ§u
  async clearTickets(bookingId: string) {
    const booking = await this.findOne(bookingId);

    const existingLedgers = await this.prisma.accountsLedger.findMany({
      where: { bookingId },
      select: { id: true },
    });

    const ledgerIds = existingLedgers.map((ledger) => ledger.id);

    const [paymentCount, ledgerPaymentCount] = await Promise.all([
      this.prisma.payment.count({ where: { bookingId } }),
      ledgerIds.length > 0
        ? this.prisma.ledgerPayment.count({ where: { ledgerId: { in: ledgerIds } } })
        : Promise.resolve(0),
    ]);

    if (paymentCount > 0 || ledgerPaymentCount > 0) {
      throw new BadRequestException(
        'Booking Ä‘Ã£ cÃ³ thanh toÃ¡n hoáº·c bÃºt toÃ¡n liÃªn quan. KhÃ´ng thá»ƒ xÃ³a hÃ nh trÃ¬nh lÃºc nÃ y.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      if (ledgerIds.length > 0) {
        await tx.accountsLedger.deleteMany({ where: { id: { in: ledgerIds } } });
      }

      await tx.ticket.deleteMany({ where: { bookingId } });

      await tx.booking.update({
        where: { id: bookingId },
        data: {
          totalSellPrice: 0,
          totalNetPrice: 0,
          totalFees: 0,
          profit: 0,
          paymentStatus: 'UNPAID',
        },
      });
    });

    await this.refreshAffectedCustomers(booking.customerId);

    return this.findOne(bookingId);
  }


  // Ghi nhÃ¡ÂºÂ­n thanh toÃƒÂ¡n
  async addPayment(bookingId: string, dto: AddPaymentDto) {
    const booking = await this.findOne(bookingId);

    if (!booking.customerId || !booking.customer || booking.contactName === 'Khách hàng mới') {
      throw new BadRequestException('Vui lòng chọn khách hàng trước khi ghi nhận thanh toán.');
    }

    if (!booking.supplierId) {
      throw new BadRequestException('Vui lòng chọn nhà cung cấp trước khi ghi nhận thanh toán.');
    }

    if (dto.method !== 'DEBT' && !dto.fundAccount) {
      throw new BadRequestException('Vui lòng chọn quỹ nhận tiền cho giao dịch này.');
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const payment = await this.prisma.$transaction(async (tx) => {
      if (dto.method === 'DEBT') {
        let receivableLedgers = await this.getDebtTrackableReceivables(tx, bookingId);

        if (receivableLedgers.length === 0) {
          const customer = await tx.customer.findUnique({
            where: { id: booking.customerId! },
            select: { customerCode: true, type: true },
          });

          const issueDate = booking.issuedAt ?? new Date();
          const dueDate = this.buildReceivableDueDate(issueDate, customer?.type ?? booking.customer.type);

          await this.createLedgerWithGeneratedCode(tx, 'RECEIVABLE', (code) => ({
            code,
            direction: 'RECEIVABLE',
            partyType: customer?.type === 'CORPORATE' ? 'CUSTOMER_CORPORATE' : 'CUSTOMER_INDIVIDUAL',
            bookingId,
            bookingCode: booking.bookingCode,
            customerId: booking.customerId!,
            customerCode: customer?.customerCode ?? booking.customer?.customerCode ?? null,
            totalAmount: dto.amount,
            paidAmount: 0,
            remaining: dto.amount,
            issueDate,
            dueDate,
            status: 'ACTIVE',
            category: 'TICKET' as any,
            description: `Cong no ve ${booking.bookingCode}`,
            createdBy: null,
          }));

          receivableLedgers = await this.getDebtTrackableReceivables(tx, bookingId);
        }

        const debtRecordableAmount = this.calculateDebtRecordableAmountFromLedgers(receivableLedgers);
        if (debtRecordableAmount <= 0) {
          throw new BadRequestException('Khong con cong no moi de ghi nhan.');
        }

        if (dto.amount > debtRecordableAmount) {
          throw new BadRequestException(
            `So tien vuot qua phan cong no chua ghi nhan (${debtRecordableAmount.toLocaleString('vi-VN')} VND).`,
          );
        }

        const createdPayment = await tx.payment.create({
          data: {
            bookingId,
            amount: dto.amount,
            method: dto.method,
            fundAccount: null,
            reference: dto.reference,
            paidAt,
            notes: dto.notes,
          },
        });

        await this.linkDebtPaymentToReceivables(
          tx,
          booking.bookingCode,
          createdPayment.id,
          dto.amount,
          paidAt,
          receivableLedgers,
        );

        await this.updatePaymentStatusWithClient(tx, bookingId);
        return createdPayment;
      }

      const createdPayment = await tx.payment.create({
        data: {
          bookingId,
          amount: dto.amount,
          method: dto.method,
          fundAccount: dto.fundAccount as any || null,
          reference: dto.reference,
          paidAt,
          notes: dto.notes,
        },
      });

      await tx.cashFlowEntry.create({
        data: {
          direction: 'INFLOW',
          category: 'TICKET_PAYMENT',
          amount: dto.amount,
          pic: booking.staff?.fullName ?? 'System',
          description: `KH thanh toan ${booking.bookingCode} - ${booking.contactName}`,
          reference: booking.pnr || booking.bookingCode,
          date: paidAt,
          status: 'DONE',
          fundAccount: dto.fundAccount as any,
          notes: dto.notes ?? null,
        },
      });

      const openReceivables = await tx.accountsLedger.findMany({
        where: {
          bookingId,
          direction: 'RECEIVABLE',
          status: { notIn: ['PAID', 'WRITTEN_OFF'] as any },
        },
        orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      });

      const totalRemaining = openReceivables.reduce((sum, ledger) => sum + Number(ledger.remaining), 0);
      if (openReceivables.length > 0 && dto.amount > totalRemaining) {
        throw new BadRequestException(
          `So tien vuot qua cong no con lai (${totalRemaining.toLocaleString('vi-VN')} VND).`,
        );
      }

      let unallocated = dto.amount;
      for (const ledger of this.orderLedgerAllocations(openReceivables)) {
        if (unallocated <= 0) {
          break;
        }

        const allocatable = Math.min(unallocated, Number(ledger.remaining));
        if (allocatable <= 0) {
          continue;
        }

        const nextPaid = Number(ledger.paidAmount) + allocatable;
        const nextRemaining = Math.max(0, Number(ledger.totalAmount) - nextPaid);
        const nextStatus = this.getLedgerStatus(Number(ledger.totalAmount), nextPaid, ledger.dueDate);

        await tx.accountsLedger.update({
          where: { id: ledger.id },
          data: {
            paidAmount: nextPaid,
            remaining: nextRemaining,
            status: nextStatus as any,
          },
        });

        await tx.ledgerPayment.create({
          data: {
            ledgerId: ledger.id,
            amount: allocatable,
            method: dto.method,
            reference: dto.reference,
            paidAt,
            notes: `Auto tu payment booking ${booking.bookingCode}`,
          },
        });

        unallocated -= allocatable;
      }

      await this.updatePaymentStatusWithClient(tx, bookingId);
      return createdPayment;
    });

    await this.n8n.triggerWebhook('/payment', {
      bookingId,
      bookingCode: booking.bookingCode,
      amount: payment.amount,
      method: payment.method,
      fundAccount: dto.fundAccount,
      customerName: booking.contactName,
    });

    return payment;
  }

  private async updatePaymentStatus(bookingId: string) {
    await this.updatePaymentStatusWithClient(this.prisma, bookingId);
  }
  // Sinh mÃƒÂ£ booking APG-YYMMDD-XXX
  private async generateBookingCode(): Promise<string> {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const prefix = `APG-${yy}${mm}${dd}`;

    // LÃ¡ÂºÂ¥y sequence lÃ¡Â»â€ºn nhÃ¡ÂºÂ¥t theo prefix ngÃƒÂ y hiÃ¡Â»â€¡n tÃ¡ÂºÂ¡i.
    // KhÃƒÂ´ng phÃ¡Â»Â¥ thuÃ¡Â»â„¢c createdAt Ã„â€˜Ã¡Â»Æ’ trÃƒÂ¡nh Ã„â€˜Ã¡Â»Â¥ng mÃƒÂ£ khi booking bÃ¡Â»â€¹ backdate.
    const rows = await this.prisma.booking.findMany({
      where: {
        bookingCode: { startsWith: `${prefix}-` },
      },
      select: { bookingCode: true },
    });

    const maxSeq = rows.reduce((max, row) => {
      const match = row.bookingCode.match(/-(\d+)$/);
      if (!match) return max;
      const value = Number(match[1]);
      return Number.isFinite(value) ? Math.max(max, value) : max;
    }, 0);

    const seq = (maxSeq + 1).toString().padStart(3, '0');
    return `${prefix}-${seq}`;
  }

  private async createBookingRecord(
    dto: CreateBookingDto,
    customerId: string | null,
    staffId: string,
  ) {
    const include = {
      customer: { select: { fullName: true, phone: true, customerCode: true } },
      staff: { select: { fullName: true } },
      supplier: { select: { id: true, name: true, code: true } },
    } as const;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const bookingCode = await this.generateBookingCode();

      try {
        return await this.prisma.booking.create({
          data: {
            bookingCode,
            customerId,
            staffId,
            businessDate: resolveBusinessDate(dto.createdAt),
            source: dto.source as never,
            contactName: dto.contactName,
            contactPhone: dto.contactPhone,
            paymentMethod: dto.paymentMethod,
            pnr: dto.pnr?.trim().toUpperCase() || null,
            notes: dto.notes,
            internalNotes: dto.internalNotes,
            supplierId: dto.supplierId || null,
          },
          include,
        });
      } catch (error) {
        if (this.isBookingCodeConflict(error) && attempt < 4) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('KhÃ´ng thá»ƒ sinh mÃ£ booking má»›i. Vui lÃ²ng thá»­ láº¡i.');
  }

  private isBookingCodeConflict(error: unknown) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return false;
    }

    if (error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    const targets = Array.isArray(target)
      ? target.map((item) => String(item))
      : target
        ? [String(target)]
        : [];

    if (targets.length === 0) {
      return true;
    }

    return targets.some((item) => item.includes('booking_code') || item.includes('bookingCode'));
  }

  // FIX 2: XÃ¡Â»Â­ lÃƒÂ½ contactPhone rÃ¡Â»â€”ng Ã¢â€ â€™ sinh phone unique tÃ¡ÂºÂ¡m
  private async resolveCustomerId(dto: CreateBookingDto): Promise<string | null> {
    const providedCustomerId = dto.customerId?.trim();
    const providedCustomerCode = dto.customerCode?.trim().toUpperCase();

    // 1. NÃ¡ÂºÂ¿u cÃƒÂ³ customerId hÃ¡Â»Â£p lÃ¡Â»â€¡ Ã¢â€ â€™ dÃƒÂ¹ng luÃƒÂ´n
    if (providedCustomerId && providedCustomerId !== 'new') {
      const existing = await this.prisma.customer.findUnique({
        where: { id: providedCustomerId },
        select: { id: true },
      });
      if (existing) {
        await this.customers.ensureCustomerCode(existing.id);
        return existing.id;
      }
    }

    // 2. NÃ¡ÂºÂ¿u cÃƒÂ³ mÃƒÂ£ KH Ã¢â€ â€™ Ã†Â°u tiÃƒÂªn tÃƒÂ¬m theo mÃƒÂ£
    if (providedCustomerCode) {
      const existingByCode = await this.prisma.customer.findUnique({
        where: { customerCode: providedCustomerCode },
        select: { id: true },
      });
      if (existingByCode) {
        await this.customers.ensureCustomerCode(existingByCode.id);
        return existingByCode.id;
      }
    }

    // 3. NÃ¡ÂºÂ¿u cÃƒÂ³ phone hÃ¡Â»Â£p lÃ¡Â»â€¡ (khÃƒÂ´ng rÃ¡Â»â€”ng) Ã¢â€ â€™ tÃƒÂ¬m theo phone
    const phone = dto.contactPhone?.trim();
    if (phone && phone.length >= 5) {
      const existingByPhone = await this.prisma.customer.findUnique({
        where: { phone },
        select: { id: true },
      });
      if (existingByPhone) {
        await this.customers.ensureCustomerCode(existingByPhone.id);
        return existingByPhone.id;
      }

      const newCustomer = await this.customers.create({
        data: {
          fullName: dto.contactName || 'ChÆ°a cÃ³ tÃªn',
          phone,
          customerCode: providedCustomerCode,
          tags: [],
        },
        select: { id: true },
      });
      return newCustomer.id;
    }

    // 4. TÃ¡ÂºÂ¡o khÃƒÂ¡ch mÃ¡Â»â€ºi Ã¢â‚¬â€ sinh phone unique nÃ¡ÂºÂ¿u rÃ¡Â»â€”ng
    return null;
  }

  // POST /bookings/:id/adjustments - Ghi nhÃ¡ÂºÂ­n hoÃƒÂ n/Ã„â€˜Ã¡Â»â€¢i vÃƒÂ©
  async addAdjustment(bookingId: string, dto: AddAdjustmentDto, userId: string) {
    const booking = await this.findOne(bookingId);

    const adjustment = await this.prisma.$transaction(async (tx) => {
      const fundAccount = dto.fundAccount ? (dto.fundAccount as any) : null;

      // 1. TÃ¡ÂºÂ¡o bÃ¡ÂºÂ£n ghi BookingAdjustment
      const adjustment = await tx.bookingAdjustment.create({
        data: {
          bookingId,
          type: dto.type as any,
          changeFee: dto.changeFee ?? 0,
          chargeToCustomer: dto.chargeToCustomer ?? 0,
          refundAmount: dto.refundAmount ?? 0,
          airlineRefund: dto.airlineRefund ?? 0,
          penaltyFee: dto.penaltyFee ?? 0,
          apgServiceFee: dto.apgServiceFee ?? 0,
          fundAccount,
          notes: dto.notes,
          createdBy: userId,
        },
      });

      const fundLabel = dto.fundAccount === 'CASH_OFFICE'
        ? 'Tiá»n máº·t VP'
        : dto.fundAccount === 'BANK_HTX'
          ? 'TK BIDV HTX'
          : dto.fundAccount === 'BANK_PERSONAL'
            ? 'TK MB cÃ¡ nhÃ¢n'
            : 'N/A';

      // 2. Äá»”I VÃ‰ (CHANGE)
      if (dto.type === 'CHANGE') {
        const charge = Number(dto.chargeToCustomer ?? 0);
        const fee = Number(dto.changeFee ?? 0);

        if (charge > 0 && booking.customer) {
          const issueDate = new Date();
          await this.createLedgerWithGeneratedCode(tx, 'RECEIVABLE', (code) => ({
            code,
            direction: 'RECEIVABLE',
            partyType: this.getReceivablePartyType(booking.customer.type) as any,
            customerId: booking.customer.id,
            customerCode: booking.customer.customerCode,
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            totalAmount: charge,
            paidAmount: 0,
            remaining: charge,
            issueDate,
            dueDate: this.buildReceivableDueDate(issueDate, booking.customer.type),
            status: 'ACTIVE',
            category: 'TICKET_CHANGE' as any,
            description: `Phá»¥ thu Ä‘á»•i vÃ© â€” Booking ${booking.bookingCode}`,
            createdBy: userId,
          }));
          console.log(`[CHANGE-AR] +${charge} phá»¥ thu KH ${booking.contactName}`);
        }

        if (fee > 0 && booking.supplier) {
          const supplier = booking.supplier;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (supplier.paymentTerms ?? 15));

          await this.createLedgerWithGeneratedCode(tx, 'PAYABLE', (code) => ({
            code,
            direction: 'PAYABLE',
            partyType: supplier.type as any,
            supplierId: supplier.id,
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            totalAmount: fee,
            paidAmount: 0,
            remaining: fee,
            issueDate: new Date(),
            dueDate,
            status: 'ACTIVE',
            category: 'TICKET_CHANGE' as any,
            description: `PhÃ­ Ä‘á»•i vÃ© (tráº£ NCC) â€” Booking ${booking.bookingCode}`,
            createdBy: userId,
          }));
          console.log(`[CHANGE-AP] +${fee} phÃ­ Ä‘á»•i tráº£ NCC ${supplier.name}`);
        }

        if (booking.status !== 'CHANGED') {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: 'CHANGED' },
          });
          await tx.bookingStatusLog.create({
            data: {
              bookingId: booking.id,
              fromStatus: booking.status,
              toStatus: 'CHANGED',
              changedBy: userId,
              reason: `Äá»•i vÃ©: Phá»¥ thu KH ${charge}, PhÃ­ NCC ${fee}`,
            },
          });
        }
      } else if (dto.type === 'REFUND_NAMED') {
        if (!booking.customerId) {
          throw new BadRequestException('Booking chÆ°a cÃ³ khÃ¡ch hÃ ng Ä‘á»ƒ táº¡o credit Ä‘á»‹nh danh.');
        }

        const firstTicket = booking.tickets?.[0];
        const creditAmount = Number(dto.airlineRefund ?? dto.refundAmount ?? 0);

        if (creditAmount <= 0) {
          throw new BadRequestException('Sá»‘ tiá»n credit Ä‘á»‹nh danh pháº£i lá»›n hÆ¡n 0.');
        }

        await this.namedCreditService.create({
          bookingId: booking.id,
          customerId: booking.customerId,
          passengerName: dto.passengerName || booking.contactName,
          airline: firstTicket?.airline ?? 'UNKNOWN',
          ticketNumber: firstTicket?.eTicketNumber ?? undefined,
          pnr: booking.pnr ?? undefined,
          creditAmount,
          expiryDate: dto.expiryDate || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString(),
          notes: dto.notes,
          createdBy: userId,
        }, tx);

        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'REFUNDED' },
        });
        await tx.bookingStatusLog.create({
          data: {
            bookingId: booking.id,
            fromStatus: booking.status,
            toStatus: 'REFUNDED',
            changedBy: userId,
            reason: `HoÃ n Ä‘á»‹nh danh: Credit ${creditAmount} trÃªn hÃ£ng ${firstTicket?.airline ?? 'UNKNOWN'}`,
          },
        });
      } else if (dto.type === 'HLKG' || dto.type === 'SERVICE') {
        const charge = Number(dto.chargeToCustomer ?? 0);
        const cost = Number(dto.changeFee ?? 0);
        const category = dto.type === 'HLKG' ? 'HLKG' : 'SERVICE';
        const categoryLabel = dto.type === 'HLKG' ? 'Hành lý ký gửi' : 'Dịch vụ HK';
        const serviceSuffix = dto.serviceCode ? ` (Mã: ${dto.serviceCode})` : '';

        if (charge > 0 && booking.customer) {
          const issueDate = new Date();
          await this.createLedgerWithGeneratedCode(tx, 'RECEIVABLE', (code) => ({
            code,
            direction: 'RECEIVABLE',
            partyType: this.getReceivablePartyType(booking.customer.type) as any,
            customerId: booking.customer.id,
            customerCode: booking.customer.customerCode,
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            totalAmount: charge,
            paidAmount: 0,
            remaining: charge,
            issueDate,
            dueDate: this.buildReceivableDueDate(issueDate, booking.customer.type),
            status: 'ACTIVE',
            category: category as any,
            serviceCode: dto.serviceCode ?? null,
            description: `${categoryLabel} — Booking ${booking.bookingCode}${serviceSuffix}`,
            createdBy: userId,
          }));
          console.log(`[${category}-AR] +${charge} thu KH — ${dto.serviceCode || 'N/A'}`);
        }

        if (cost > 0 && booking.supplier) {
          const supplier = booking.supplier;
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (supplier.paymentTerms ?? 15));

          await this.createLedgerWithGeneratedCode(tx, 'PAYABLE', (code) => ({
            code,
            direction: 'PAYABLE',
            partyType: supplier.type as any,
            supplierId: supplier.id,
            bookingId: booking.id,
            bookingCode: booking.bookingCode,
            totalAmount: cost,
            paidAmount: 0,
            remaining: cost,
            issueDate: new Date(),
            dueDate,
            status: 'ACTIVE',
            category: category as any,
            serviceCode: dto.serviceCode ?? null,
            description: `${categoryLabel} (trả NCC) — Booking ${booking.bookingCode}${serviceSuffix}`,
            createdBy: userId,
          }));
          console.log(`[${category}-AP] +${cost} trả NCC — ${dto.serviceCode || 'N/A'}`);
        }
      } else if (dto.type === 'REFUND_CASH' || dto.type === 'REFUND_CREDIT') {
        const refundToCustomer = Number(dto.refundAmount ?? 0);
        const airlineRefund = Number(dto.airlineRefund ?? 0);
        const penaltyFee = Number(dto.penaltyFee ?? 0);
        const apgFee = Number(dto.apgServiceFee ?? 0);

        const existingAR = await tx.accountsLedger.findFirst({
          where: { bookingId: booking.id, direction: 'RECEIVABLE' },
          orderBy: { createdAt: 'asc' },
        });

        if (existingAR) {
          const arTotal = Number(existingAR.totalAmount);
          const arPaid = Number(existingAR.paidAmount);

          if (arPaid < arTotal) {
            await tx.accountsLedger.update({
              where: { id: existingAR.id },
              data: {
                totalAmount: arPaid,
                remaining: 0,
                status: arPaid > 0 ? 'PAID' : 'WRITTEN_OFF',
                description: `${existingAR.description} [HOÃ€N VÃ‰ - AR Ä‘iá»u chá»‰nh]`,
              },
            });
            console.log(`[REFUND-AR] AR ${existingAR.code}: giáº£m tá»« ${arTotal} â†’ ${arPaid} (xÃ³a ná»£)`);
          }
        }

        const existingAP = await tx.accountsLedger.findFirst({
          where: { bookingId: booking.id, direction: 'PAYABLE' },
          orderBy: { createdAt: 'asc' },
        });

        if (existingAP) {
          const apTotal = Number(existingAP.totalAmount);
          const apPaid = Number(existingAP.paidAmount);

          if (apPaid < apTotal) {
            const newApTotal = apPaid + penaltyFee;
            const newApRemaining = Math.max(0, newApTotal - apPaid);
            const newApStatus = newApRemaining <= 0
              ? 'PAID'
              : apPaid > 0
                ? 'PARTIAL_PAID'
                : 'ACTIVE';

            await tx.accountsLedger.update({
              where: { id: existingAP.id },
              data: {
                totalAmount: Math.max(0, newApTotal),
                remaining: newApRemaining,
                status: newApStatus as any,
                description: `${existingAP.description} [HOÃ€N VÃ‰ - AP Ä‘iá»u chá»‰nh]`,
              },
            });
            console.log(`[REFUND-AP] AP ${existingAP.code}: giáº£m tá»« ${apTotal} â†’ ${newApTotal}`);
          }
        }

        if (airlineRefund > 0) {
          try {
            await tx.cashFlowEntry.create({
              data: {
                direction: 'INFLOW',
                category: 'TICKET_REFUND',
                amount: airlineRefund,
                pic: 'System',
                description: `NCC hoÃ n vÃ© - Booking ${booking.bookingCode}`,
                reference: booking.pnr || booking.bookingCode,
                date: new Date(),
                status: 'DONE',
                fundAccount,
                notes: `Quá»¹ nháº­n: ${fundLabel}. HÃ£ng hoÃ n ${airlineRefund}, phÃ­ hoÃ n ${penaltyFee}`,
              },
            });
            console.log(`[REFUND-INFLOW] +${airlineRefund} NCC hoÃ n APG vÃ o ${fundLabel}`);
          } catch (err) {
            console.error('[REFUND-INFLOW] Lá»—i ghi CashFlow:', err);
          }
        }

        if (dto.type === 'REFUND_CASH' && refundToCustomer > 0) {
          try {
            await tx.cashFlowEntry.create({
              data: {
                direction: 'OUTFLOW',
                category: 'TICKET_REFUND',
                amount: refundToCustomer,
                pic: 'System',
                description: `HoÃ n tiá»n KH ${booking.contactName} - Booking ${booking.bookingCode}`,
                reference: booking.pnr || booking.bookingCode,
                date: new Date(),
                status: 'DONE',
                fundAccount,
                notes: `Quá»¹ chi: ${fundLabel}. HoÃ n KH ${refundToCustomer}`,
              },
            });
            console.log(`[REFUND-OUTFLOW] -${refundToCustomer} hoÃ n KH ${booking.contactName} tá»« ${fundLabel}`);
          } catch (err) {
            console.error('[REFUND-OUTFLOW] Lá»—i ghi CashFlow:', err);
          }
        }

        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'REFUNDED' },
        });
        await tx.bookingStatusLog.create({
          data: {
            bookingId: booking.id,
            fromStatus: booking.status,
            toStatus: 'REFUNDED',
            changedBy: userId,
            reason: `HoÃ n vÃ© (${dto.type}): HoÃ n KH ${refundToCustomer}, NCC hoÃ n ${airlineRefund}, PhÃ­ hoÃ n ${penaltyFee}, PhÃ­ APG ${apgFee}`,
          },
        });
      } else {
        throw new BadRequestException(`Loáº¡i Ä‘iá»u chá»‰nh khÃ´ng Ä‘Æ°á»£c há»— trá»£: ${dto.type}`);
      }

      return adjustment;
    });

    await this.refreshAffectedCustomers(booking.customerId);

    return adjustment;
  }
}

