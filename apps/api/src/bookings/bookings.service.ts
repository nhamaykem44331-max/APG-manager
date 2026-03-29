// APG Manager RMS - Bookings Service (nghiá»‡p vá»¥ Ä‘áº·t vÃ©)
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

/** Chuyá»ƒn chuá»—i ISO thÃ nh Date; fallback vá» now náº¿u invalid Ä‘á»ƒ trÃ¡nh lá»—i DB */
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

// MÃ¡y tráº¡ng thÃ¡i booking - quy Ä‘á»‹nh chuyá»ƒn tráº¡ng thÃ¡i há»£p lá»‡
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
  ) {}

  // Láº¥y danh sÃ¡ch booking cÃ³ filter, sort, paginate
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

    // FIX 6: Filter theo ngÃ y táº¡o
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
          tickets: { orderBy: { departureTime: 'asc' } }, // Giá»¯ Ä‘Ãºng thá»© tá»± hÃ nh trÃ¬nh Ä‘á»ƒ hiá»ƒn thá»‹ route/khá»Ÿi hÃ nh chÃ­nh xÃ¡c
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

  // Láº¥y chi tiáº¿t booking kÃ¨m táº¥t cáº£ relations
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
        ledgers: { select: { id: true, code: true, direction: true, status: true, remaining: true, totalAmount: true, createdAt: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`KhÃ´ng tÃ¬m tháº¥y booking ID: ${id}`);
    }

    if (booking.customer && !booking.customer.customerCode) {
      booking.customer.customerCode = await this.customers.ensureCustomerCode(booking.customer.id);
    }

    return booking;
  }

  // Táº¡o booking má»›i
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

      // Ghi log táº¡o má»›i
      await this.prisma.bookingStatusLog.create({
        data: {
          bookingId: booking.id,
          fromStatus: 'NEW',
          toStatus: 'NEW',
          changedBy: staffId,
          reason: 'Táº¡o booking má»›i',
        },
      });

      // Trigger n8n webhook thÃ´ng bÃ¡o booking má»›i (fire & forget)
      this.n8n.triggerWebhook('/booking-new', {
        bookingCode: booking.bookingCode,
        customerName: booking.customer.fullName,
        customerPhone: booking.customer.phone,
        staffName: booking.staff.fullName,
      }).catch(err => console.error('[N8N] webhook error:', err));

      return booking;
    } catch (error) {
      console.error('[BookingsService.create] ERROR:', error);
      throw error;
    }
  }

  // Cáº­p nháº­t thÃ´ng tin booking
  async update(id: string, dto: UpdateBookingDto, currentUser: Pick<User, 'id' | 'role'>) {
    const existingBooking = await this.findOne(id); // Kiá»ƒm tra tá»“n táº¡i

    const data: Prisma.BookingUncheckedUpdateInput = {};

    if (dto.contactName !== undefined) data.contactName = dto.contactName;
    if (dto.source !== undefined) data.source = dto.source as Prisma.BookingUncheckedUpdateInput['source'];
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone;
    if (dto.paymentMethod !== undefined) data.paymentMethod = dto.paymentMethod;
    if (dto.pnr !== undefined) data.pnr = dto.pnr;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.internalNotes !== undefined) data.internalNotes = dto.internalNotes;
    if (dto.supplierId !== undefined) data.supplierId = dto.supplierId;
    if (dto.createdAt !== undefined) {
      const createdAt = dto.createdAt.trim();
      if (createdAt) data.businessDate = safeDate(createdAt, 'businessDate');
    }

    if (dto.staffId !== undefined) {
      const staffId = dto.staffId.trim();

      if (!staffId) {
        throw new BadRequestException('staffId khÃƒÂ´ng hÃ¡Â»Â£p lÃ¡Â»â€¡.');
      }

      if (staffId !== existingBooking.staffId && currentUser.role !== UserRole.ADMIN) {
        throw new ForbiddenException('ChÃ¡Â»â€° admin mÃ¡Â»â€ºi Ã„â€˜Ã†Â°Ã¡Â»Â£c thay Ã„â€˜Ã¡Â»â€¢i nhÃƒÂ¢n viÃƒÂªn phÃ¡Â»Â¥ trÃƒÂ¡ch.');
      }

      const staff = await this.prisma.user.findUnique({
        where: { id: staffId },
        select: { id: true, isActive: true },
      });

      if (!staff || !staff.isActive) {
        throw new NotFoundException('KhÃƒÂ´ng tÃƒÂ¬m thÃ¡ÂºÂ¥y nhÃƒÂ¢n viÃƒÂªn phÃ¡Â»Â¥ trÃƒÂ¡ch phÃƒÂ¹ hÃ¡Â»Â£p.');
      }

      data.staffId = staff.id;
    }

    // â”€â”€ Re-sync AP ledger entries when supplier changes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (dto.supplierId !== undefined) {
      try {
        const newSupplierId = dto.supplierId;
        const newSupplier = newSupplierId
          ? await this.prisma.supplierProfile.findUnique({
              where: { id: newSupplierId },
              select: { id: true, name: true, type: true },
            })
          : null;

        // Update all PAYABLE ledger entries for this booking to point to the new supplier
        const existingAP = await this.prisma.accountsLedger.findMany({
          where: { bookingId: id, direction: 'PAYABLE' },
        });

        if (existingAP.length > 0) {
          await this.prisma.accountsLedger.updateMany({
            where: { bookingId: id, direction: 'PAYABLE' },
            data: {
              supplierId: newSupplierId,
              partyType: newSupplier ? (newSupplier.type as any) : null,
              description: newSupplier
                ? `Pháº£i tráº£ NCC ${newSupplier.name} â€” Booking ${(await this.findOne(id)).bookingCode}`
                : undefined,
            },
          });
          console.log(`[AP-SYNC] Re-synced ${existingAP.length} AP entries to supplier ${newSupplier?.name ?? 'NULL'}`);
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

    if (dto.supplierId !== undefined || dto.paymentMethod !== undefined) {
        await this.syncPayableLedgerForBooking(id, currentUser.id);
    }

    if (dto.customerId !== undefined && data.customerId && data.customerId !== existingBooking.customerId) {
      const passengerIds = await this.prisma.ticket.findMany({
        where: { bookingId: id },
        select: { passengerId: true },
        distinct: ['passengerId'],
      });

      if (passengerIds.length > 0) {
        await this.prisma.passenger.updateMany({
          where: { id: { in: passengerIds.map((ticket) => ticket.passengerId) } },
          data: { customerId: data.customerId },
        });
      }

      await this.syncReceivableLedgerForBooking(id, currentUser.id, { createIfMissing: true });
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
      where: { bookingId, direction: 'RECEIVABLE' },
    });

    const totalAmount = Number(booking.totalSellPrice);
    const paidAmount = booking.payments
      .filter((payment) => payment.method !== 'DEBT')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
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

    const code = await this.generateLedgerCode('RECEIVABLE');
    await this.prisma.accountsLedger.create({
      data: {
        code,
        direction: 'RECEIVABLE',
        issueDate,
        createdBy: updatedBy,
        ...ledgerData,
      },
    });
    console.log(`[AR-AUTO] Created AR ${code} for booking ${booking.bookingCode} -> ${booking.customer.fullName}`);
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
      where: { bookingId, direction: 'PAYABLE' },
    });

    const dueDate = existingAP?.dueDate
      ? new Date(existingAP.dueDate)
      : (() => {
          const nextDueDate = new Date();
          nextDueDate.setDate(nextDueDate.getDate() + (booking.supplier?.paymentTerms ?? 15));
          return nextDueDate;
        })();

    const totalAmount = Number(booking.totalNetPrice);
    const paidAmount = Number(existingAP?.paidAmount ?? 0);
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
          remaining,
          dueDate,
          status: status as any,
          description: `Pháº£i tráº£ NCC ${booking.supplier.name} â€” Booking ${booking.bookingCode}`,
        },
      });
      console.log(`[AP-SYNC] Synced AP ${existingAP.code} to supplier ${booking.supplier.name}`);
      return;
    }

    const apCode = await this.generateLedgerCode('PAYABLE');
    await this.prisma.accountsLedger.create({
      data: {
        code: apCode,
        direction: 'PAYABLE',
        partyType: booking.supplier.type as any,
        supplierId: booking.supplier.id,
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        totalAmount,
        paidAmount,
        remaining,
        dueDate,
        status: status as any,
        description: `Pháº£i tráº£ NCC ${booking.supplier.name} â€” Booking ${booking.bookingCode}`,
        createdBy: updatedBy,
      },
    });
    console.log(`[AP-AUTO] Created AP ${apCode} for booking ${booking.bookingCode} -> ${booking.supplier.name}`);
  }

  // Soft delete booking
  async remove(id: string, staffId: string) {
    const booking = await this.findOne(id);

    // Chuyá»ƒn tráº¡ng thÃ¡i sang CANCELLED vÃ  set deletedAt
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
    return updated;
  }


  // Hard delete booking (chá»‰ cho CANCELLED)
  async hardDelete(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: { id: true, bookingCode: true, status: true, deletedAt: true },
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

    return {
      success: true,
      id,
      message: `ÄÃ£ xÃ³a vÄ©nh viá»…n booking ${booking.bookingCode}.`,
    };
  }

  // Chuyá»ƒn tráº¡ng thÃ¡i booking (cÃ³ validation)
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

    // Kiá»ƒm tra chuyá»ƒn tráº¡ng thÃ¡i cÃ³ há»£p lá»‡ khÃ´ng
    if (!allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `KhÃ´ng thá»ƒ chuyá»ƒn tá»« "${booking.status}" sang "${targetStatus}". ` +
        `Cho phÃ©p: ${allowedTransitions.join(', ') || 'KhÃ´ng cÃ³ (tráº¡ng thÃ¡i cuá»‘i)'}`
      );
    }

    // Cáº­p nháº­t trong transaction Ä‘á»ƒ Ä‘áº£m báº£o tÃ­nh toÃ n váº¹n
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

    // â”€â”€ BÆ°á»›c 2i: Auto-táº¡o AR cÃ´ng ná»£ khi xuáº¥t vÃ© chÆ°a thanh toÃ¡n â”€â”€â”€â”€â”€
    // Business rule: Táº¡o cÃ´ng ná»£ pháº£i thu (AR) cho Má»ŒI booking chÆ°a thanh toÃ¡n khi xuáº¥t vÃ©
    // KhÃ´ng giá»›i háº¡n chá»‰ paymentMethod === 'DEBT' â€” vÃ¬ khÃ¡ch cÃ³ thá»ƒ thanh toÃ¡n sau dÃ¹ chá»n báº¥t ká»³ method nÃ o
    // Khi khÃ¡ch thanh toÃ¡n xong, payLedger() sáº½ tá»± Ä‘á»™ng chuyá»ƒn status â†’ PAID
    if (
      ['ISSUED', 'COMPLETED', 'CHANGED'].includes(targetStatus)
      && booking.paymentStatus !== 'PAID'
    ) {
      try {
        await this.syncReceivableLedgerForBooking(booking.id, changedBy, { createIfMissing: true });
      } catch (err) {
        // KhÃ´ng throw â€” khÃ´ng Ä‘á»ƒ lá»—i ledger cháº·n viá»‡c xuáº¥t vÃ©
        console.error(`[LedgerAutoCreate] Lá»—i táº¡o AR cho booking ${booking.bookingCode}:`, err);
      }
    }

    // â”€â”€ Auto-táº¡o AP (pháº£i tráº£ NCC) khi xuáº¥t vÃ© cÃ³ supplier â”€â”€â”€â”€â”€
    if (targetStatus === 'ISSUED' && booking.supplierId) {
      try {
        const existingAP = await this.prisma.accountsLedger.findFirst({
          where: { bookingId: booking.id, direction: 'PAYABLE' },
          select: { id: true },
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

          const apCode = await this.generateLedgerCode('PAYABLE');

          await this.prisma.accountsLedger.create({
            data: {
              code: apCode,
              direction: 'PAYABLE',
              partyType: supplier.type as any,
              supplierId: booking.supplierId,
              bookingId: booking.id,
              totalAmount: booking.totalNetPrice,
              paidAmount: 0,
              remaining: booking.totalNetPrice,
              dueDate: apDueDate,
              description: `Pháº£i tráº£ NCC ${supplier.name} â€” Booking ${booking.bookingCode}`,
              createdBy: changedBy,
            },
          });
          console.log(`[AP-AUTO] Táº¡o AP ${apCode} â€” ${supplier.name} â€” ${booking.totalNetPrice}`);
        }
        }
      } catch (err) {
        console.error(`[AP-AUTO] Lá»—i táº¡o AP cho booking ${booking.bookingCode}:`, err);
      }
    }

    // Gá»­i thÃ´ng bÃ¡o khi xuáº¥t vÃ© hoáº·c há»§y
    if (targetStatus === 'ISSUED' || targetStatus === 'CANCELLED') {
      await this.n8n.triggerWebhook('/booking-status', {
        bookingCode: booking.bookingCode,
        customerName: booking.customer?.fullName,
        customerPhone: booking.customer?.phone,
        status: targetStatus,
        reason: dto.reason,
      });
    }

    return updated;
  }

  // Helper: sinh mÃ£ AR-YYMMDD-XXX hoáº·c AP-YYMMDD-XXX (dÃ¹ng cho BÆ°á»›c 2i + 2e)
  private async generateLedgerCode(direction: string): Promise<string> {
    const prefix = direction === 'RECEIVABLE' ? 'AR' : 'AP';
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const datePrefix = `${prefix}-${yy}${mm}${dd}`;
    const count = await this.prisma.accountsLedger.count({
      where: { code: { startsWith: datePrefix } },
    });
    return `${datePrefix}-${(count + 1).toString().padStart(3, '0')}`;
  }

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


  // ThÃªm vÃ© vÃ o booking vÃ  tÃ­nh láº¡i lá»£i nhuáº­n
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

    return this.prisma.$transaction(async (tx) => {
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

      const ticket = await tx.ticket.create({
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

      return ticket;
    });
  }

  // XÃ³a toÃ n bá»™ vÃ©/hÃ nh trÃ¬nh vÃ  reset tá»•ng tiá»n vá» tráº¡ng thÃ¡i ban Ä‘áº§u
  async clearTickets(bookingId: string) {
    await this.findOne(bookingId);

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

    return this.findOne(bookingId);
  }


  // Ghi nháº­n thanh toÃ¡n
  async addPayment(bookingId: string, dto: AddPaymentDto) {
    const booking = await this.findOne(bookingId);

    // 1. Táº¡o payment record
    if (dto.method !== 'DEBT' && !dto.fundAccount) {
      throw new BadRequestException('Vui lÃƒÂ²ng chÃ¡Â»Ân quÃ¡Â»Â¹ nhÃ¡ÂºÂ­n tiÃ¡Â»Ân cho giao dÃ¡Â»â€¹ch nÃƒÂ y.');
    }

    const payment = await this.prisma.payment.create({
      data: {
        bookingId,
        amount: dto.amount,
        method: dto.method,
        fundAccount: dto.fundAccount as any || null,
        reference: dto.reference,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        notes: dto.notes,
      },
    });

    // 2. Cáº­p nháº­t paymentStatus booking
    await this.updatePaymentStatus(bookingId);

    // 3. â”€â”€ DEBT: táº¡o AR trá»±c tiáº¿p, skip CashFlow â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (dto.method === 'DEBT') {
      try {
        // Kiá»ƒm tra AR Ä‘Ã£ tá»“n táº¡i chÆ°a
        const existingAR = await this.prisma.accountsLedger.findFirst({
          where: { bookingId, direction: 'RECEIVABLE', status: { not: 'PAID' } },
        });

        if (!existingAR) {
          // Táº¡o má»›i AR cho toÃ n bá»™ giÃ¡ trá»‹ booking
          const arCode = `AR-${booking.bookingCode}`;
          const customer = await this.prisma.customer.findUnique({
            where: { id: booking.customerId },
            select: { fullName: true, customerCode: true, type: true },
          });

          await this.prisma.accountsLedger.create({
            data: {
              code: arCode,
              direction: 'RECEIVABLE',
              bookingId,
              bookingCode: booking.bookingCode,
              customerId: booking.customerId,
              customerCode: customer?.customerCode ?? null,
              partyType: customer?.type === 'CORPORATE' ? 'CUSTOMER_CORPORATE' : 'CUSTOMER_INDIVIDUAL',
              totalAmount: dto.amount,
              paidAmount: 0,
              remaining: dto.amount,
              status: 'ACTIVE',
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngÃ y
            },
          });
          console.log(`[AR-CREATE-DEBT] AR ${arCode} â€” ${dto.amount} cho KH ${customer?.fullName}`);
        }
      } catch (err) {
        console.error('[AR-DEBT] Lá»—i táº¡o AR tá»« cÃ´ng ná»£:', err);
      }
    } else {
      // NON-DEBT: ghi CashFlow Inflow bÃ¬nh thÆ°á»ng
      try {
        const fundLabel = dto.fundAccount === 'CASH_OFFICE' ? 'Tiá»n máº·t VP'
          : dto.fundAccount === 'BANK_HTX' ? 'TK BIDV HTX'
          : dto.fundAccount === 'BANK_PERSONAL' ? 'TK MB cÃ¡ nhÃ¢n' : 'N/A';

        await this.prisma.cashFlowEntry.create({
          data: {
            direction: 'INFLOW',
            category: 'TICKET_PAYMENT',
            amount: dto.amount,
            pic: booking.staff?.fullName ?? 'System',
            description: `KH thanh toÃ¡n ${booking.bookingCode} â€” ${booking.contactName}`,
            reference: booking.pnr || booking.bookingCode,
            date: dto.paidAt ? new Date(dto.paidAt) : new Date(),
            status: 'DONE',
            fundAccount: dto.fundAccount as any,
          },
        });
        console.log(`[INFLOW] +${dto.amount} tá»« KH ${booking.contactName} vÃ o ${fundLabel}`);
      } catch (err) {
        console.error('[INFLOW] Lá»—i ghi CashFlow:', err);
      }
    }

    // 4. â”€â”€ AUTO Cáº¬P NHáº¬T AR (cÃ´ng ná»£ pháº£i thu) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    try {
      const arLedger = await this.prisma.accountsLedger.findFirst({
        where: { bookingId, direction: 'RECEIVABLE', status: { not: 'PAID' } },
      });

      // Chá»‰ giáº£m trá»« cÃ´ng ná»£ náº¿u khÃ¡ch tráº£ tiá»n thá»±c táº¿ (khÃ´ng pháº£i lÃ  ghi ná»£ má»›i)
      if (arLedger && dto.method !== 'DEBT') {
        const newPaid = Number(arLedger.paidAmount) + dto.amount;
        const newRemaining = Math.max(0, Number(arLedger.totalAmount) - newPaid);
        const newStatus = newRemaining <= 0 ? 'PAID' : newPaid > 0 ? 'PARTIAL_PAID' : 'ACTIVE';

        await this.prisma.accountsLedger.update({
          where: { id: arLedger.id },
          data: { paidAmount: newPaid, remaining: newRemaining, status: newStatus as any },
        });

        await this.prisma.ledgerPayment.create({
          data: {
            ledgerId: arLedger.id,
            amount: dto.amount,
            method: dto.method,
            reference: dto.reference,
            notes: `Auto tá»« payment booking ${booking.bookingCode}`,
          },
        });
        console.log(`[AR-UPDATE] AR ${arLedger.code} â€” paid +${dto.amount}, remaining ${newRemaining}`);
      }
    } catch (err) {
      console.error('[AR-UPDATE] Lá»—i cáº­p nháº­t AR:', err);
    }

    // 5. Webhook n8n
    await this.n8n.triggerWebhook('/payment', {
      bookingId, bookingCode: booking.bookingCode,
      amount: payment.amount, method: payment.method,
      fundAccount: dto.fundAccount, customerName: booking.contactName,
    });

    return payment;
  }

  // Cáº­p nháº­t tráº¡ng thÃ¡i thanh toÃ¡n dá»±a trÃªn tá»•ng payments
  private async updatePaymentStatus(bookingId: string) {
    const [booking, payments] = await Promise.all([
      this.prisma.booking.findUnique({ where: { id: bookingId } }),
      this.prisma.payment.findMany({ where: { bookingId } }),
    ]);

    if (!booking) return;

    // Chá»‰ cá»™ng dá»“n cÃ¡c khoáº£n thu thá»±c táº¿, bá» qua phÆ°Æ¡ng thá»©c CÃ”NG Ná»¢ (DEBT) vÃ¬ khÃ´ng sinh dÃ²ng tiá»n
    const totalPaid = payments
      .filter(p => p.method !== 'DEBT')
      .reduce((sum, p) => sum + Number(p.amount), 0);
    const totalSell = Number(booking.totalSellPrice);

    let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
    if (totalPaid >= totalSell && totalSell > 0) paymentStatus = 'PAID';
    else if (totalPaid > 0) paymentStatus = 'PARTIAL';
    else paymentStatus = 'UNPAID';

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: { paymentStatus },
    });
  }

  // Sinh mÃ£ booking APG-YYMMDD-XXX
  private async generateBookingCode(): Promise<string> {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const prefix = `APG-${yy}${mm}${dd}`;

    // Láº¥y sequence lá»›n nháº¥t theo prefix ngÃ y hiá»‡n táº¡i.
    // KhÃ´ng phá»¥ thuá»™c createdAt Ä‘á»ƒ trÃ¡nh Ä‘á»¥ng mÃ£ khi booking bá»‹ backdate.
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
    customerId: string,
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

  // FIX 2: Xá»­ lÃ½ contactPhone rá»—ng â†’ sinh phone unique táº¡m
  private async resolveCustomerId(dto: CreateBookingDto) {
    const providedCustomerId = dto.customerId?.trim();
    const providedCustomerCode = dto.customerCode?.trim().toUpperCase();

    // 1. Náº¿u cÃ³ customerId há»£p lá»‡ â†’ dÃ¹ng luÃ´n
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

    // 2. Náº¿u cÃ³ mÃ£ KH â†’ Æ°u tiÃªn tÃ¬m theo mÃ£
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

    // 3. Náº¿u cÃ³ phone há»£p lá»‡ (khÃ´ng rá»—ng) â†’ tÃ¬m theo phone
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
    }

    // 4. Táº¡o khÃ¡ch má»›i â€” sinh phone unique náº¿u rá»—ng
    const newCustomer = await this.customers.create({
      data: {
        fullName: dto.contactName || 'KhÃ¡ch hÃ ng má»›i',
        phone: phone && phone.length >= 5
          ? phone
          : `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        customerCode: providedCustomerCode,
        tags: [],
      },
      select: { id: true },
    });
    return newCustomer.id;
    return newCustomer.id;
  }

  // POST /bookings/:id/adjustments - Ghi nháº­n hoÃ n/Ä‘á»•i vÃ©
  async addAdjustment(bookingId: string, dto: AddAdjustmentDto, userId: string) {
    const booking = await this.findOne(bookingId);

    let arCode: string | undefined;
    let apCode: string | undefined;

    if (dto.type === 'CHANGE') {
      const charge = Number(dto.chargeToCustomer ?? 0);
      const fee = Number(dto.changeFee ?? 0);
      if (charge > 0 && booking.customer) arCode = await this.generateLedgerCode('RECEIVABLE');
      if (fee > 0 && booking.supplier) apCode = await this.generateLedgerCode('PAYABLE');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Táº¡o báº£n ghi BookingAdjustment
      const adjustment = await tx.bookingAdjustment.create({
        data: {
          bookingId,
          type: dto.type as any,
          changeFee: dto.changeFee ?? 0,
          chargeToCustomer: dto.chargeToCustomer ?? 0,
          refundAmount: dto.refundAmount ?? 0,
          notes: dto.notes,
          createdBy: userId,
        },
      });

      // 2. Náº¿u lÃ  CHANGE, cáº§n táº¡o AR cho chargeToCustomer vÃ  AP cho changeFee
      if (dto.type === 'CHANGE') {
        const charge = Number(dto.chargeToCustomer ?? 0);
        const fee = Number(dto.changeFee ?? 0);

        // ThÃªm AR náº¿u thu khÃ¡ch > 0
        if (charge > 0 && booking.customer && arCode) {
          await tx.accountsLedger.create({
            data: {
              code: arCode,
              direction: 'RECEIVABLE',
              partyType: this.getReceivablePartyType(booking.customer.type) as any,
              customerId: booking.customer.id,
              customerCode: booking.customer.customerCode,
              bookingId: booking.id,
              bookingCode: booking.bookingCode,
              totalAmount: charge,
              paidAmount: 0,
              remaining: charge,
              issueDate: new Date(),
              dueDate: this.buildReceivableDueDate(new Date(), booking.customer.type),
              status: 'ACTIVE',
              description: `Phá»¥ thu Ä‘á»•i vÃ© â€” Booking ${booking.bookingCode}`,
              createdBy: userId,
            },
          });
        }

        // ThÃªm AP náº¿u phÃ­ Ä‘á»•i > 0
        if (fee > 0 && booking.supplier && apCode) {
          const dueDate = new Date();
          dueDate.setDate(dueDate.getDate() + (booking.supplier.paymentTerms ?? 15));
          
          await tx.accountsLedger.create({
            data: {
              code: apCode,
              direction: 'PAYABLE',
              partyType: booking.supplier.type as any,
              supplierId: booking.supplier.id,
              bookingId: booking.id,
              bookingCode: booking.bookingCode,
              totalAmount: fee,
              paidAmount: 0,
              remaining: fee,
              issueDate: new Date(),
              dueDate: dueDate,
              status: 'ACTIVE',
              description: `PhÃ­ Ä‘á»•i vÃ© (tráº£ NCC) â€” Booking ${booking.bookingCode}`,
              createdBy: userId,
            },
          });
        }

        // Cáº­p nháº­t tráº¡ng thÃ¡i booking sang CHANGED (náº¿u chÆ°a)
        if (booking.status !== 'CHANGED') {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: 'CHANGED' }
          });
          await tx.bookingStatusLog.create({
            data: {
              bookingId: booking.id,
              fromStatus: booking.status,
              toStatus: 'CHANGED',
              changedBy: userId,
              reason: `Äá»•i vÃ©: Phá»¥ thu ${charge}, PhÃ­ ${fee}`,
            }
          });
        }
      } else {
        // Äá»‘i vá»›i REFUND
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'REFUNDED' }
        });
        await tx.bookingStatusLog.create({
          data: {
            bookingId: booking.id,
            fromStatus: booking.status,
            toStatus: 'REFUNDED',
            changedBy: userId,
            reason: `HoÃ n vÃ© (${dto.type}): Sá»‘ tiá»n hoÃ n ${dto.refundAmount ?? 0}`,
          }
        });
      }

      return adjustment;
    });
  }
}
