// APG Manager RMS - Bookings Service (nghiệp vụ đặt vé)
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

/** Chuyển chuỗi ISO thành Date; fallback về now nếu invalid để tránh lỗi DB */
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

// Máy trạng thái booking - quy định chuyển trạng thái hợp lệ
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

  // Lấy danh sách booking có filter, sort, paginate
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

    // FIX 6: Filter theo ngày tạo
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
          tickets: { orderBy: { departureTime: 'asc' } }, // Giữ đúng thứ tự hành trình để hiển thị route/khởi hành chính xác
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

  // Lấy chi tiết booking kèm tất cả relations
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
        ledgers: { select: { id: true, code: true, direction: true, status: true, remaining: true, totalAmount: true, createdAt: true } },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy booking ID: ${id}`);
    }

    if (booking.customer && !booking.customer.customerCode) {
      booking.customer.customerCode = await this.customers.ensureCustomerCode(booking.customer.id);
    }

    return booking;
  }

  // Tạo booking mới
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

      // Ghi log tạo mới
      await this.prisma.bookingStatusLog.create({
        data: {
          bookingId: booking.id,
          fromStatus: 'NEW',
          toStatus: 'NEW',
          changedBy: staffId,
          reason: 'Tạo booking mới',
        },
      });

      // Trigger n8n webhook thông báo booking mới (fire & forget)
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

  // Cập nhật thông tin booking
  async update(id: string, dto: UpdateBookingDto, currentUser: Pick<User, 'id' | 'role'>) {
    const existingBooking = await this.findOne(id); // Kiểm tra tồn tại

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

    // ── Re-sync AP ledger entries when supplier changes ──────────
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
                ? `Phải trả NCC ${newSupplier.name} — Booking ${(await this.findOne(id)).bookingCode}`
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
        throw new BadRequestException('customerId không hợp lệ.');
      }

      const customer = await this.prisma.customer.findUnique({
        where: { id: customerId },
        select: { id: true, fullName: true, phone: true, type: true, customerCode: true },
      });

      if (!customer) {
        throw new NotFoundException('Không tìm thấy khách hàng.');
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
      description: `Công nợ vé ${booking.bookingCode}`,
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
          description: `Phải trả NCC ${booking.supplier.name} — Booking ${booking.bookingCode}`,
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
        description: `Phải trả NCC ${booking.supplier.name} — Booking ${booking.bookingCode}`,
        createdBy: updatedBy,
      },
    });
    console.log(`[AP-AUTO] Created AP ${apCode} for booking ${booking.bookingCode} -> ${booking.supplier.name}`);
  }

  // Soft delete booking
  async remove(id: string, staffId: string) {
    const booking = await this.findOne(id);

    // Chuyển trạng thái sang CANCELLED và set deletedAt
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
          reason: 'Xóa booking (soft delete)',
        },
      }),
    ]);
    return updated;
  }


  // Hard delete booking (chỉ cho CANCELLED)
  async hardDelete(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: { id: true, bookingCode: true, status: true, deletedAt: true },
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy booking ID: ${id}`);
    }

    if (booking.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Chỉ có thể xóa vĩnh viễn booking ở trạng thái "Đã hủy". Trạng thái hiện tại: ${booking.status}`,
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
      await tx.payment.deleteMany({ where: { bookingId: id } });
      await tx.bookingStatusLog.deleteMany({ where: { bookingId: id } });
      await tx.ticket.deleteMany({ where: { bookingId: id } });
      await tx.booking.delete({ where: { id } });
    });

    return {
      success: true,
      id,
      message: `Đã xóa vĩnh viễn booking ${booking.bookingCode}.`,
    };
  }

  // Hard delete booking (chỉ cho CANCELLED)
  async hardDelete(id: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      select: { id: true, bookingCode: true, status: true, deletedAt: true },
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy booking ID: ${id}`);
    }

    if (booking.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Chỉ có thể xóa vĩnh viễn booking ở trạng thái "Đã hủy". Trạng thái hiện tại: ${booking.status}`,
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
      await tx.payment.deleteMany({ where: { bookingId: id } });
      await tx.bookingStatusLog.deleteMany({ where: { bookingId: id } });
      await tx.ticket.deleteMany({ where: { bookingId: id } });
      await tx.booking.delete({ where: { id } });
    });

    return {
      success: true,
      id,
      message: `Đã xóa vĩnh viễn booking ${booking.bookingCode}.`,
    };
  }

  // Chuyển trạng thái booking (có validation)
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

    // Kiểm tra chuyển trạng thái có hợp lệ không
    if (!allowedTransitions.includes(targetStatus)) {
      throw new BadRequestException(
        `Không thể chuyển từ "${booking.status}" sang "${targetStatus}". ` +
        `Cho phép: ${allowedTransitions.join(', ') || 'Không có (trạng thái cuối)'}`
      );
    }

    // Cập nhật trong transaction để đảm bảo tính toàn vẹn
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

    // ── Bước 2i: Auto-tạo AR công nợ khi xuất vé chưa thanh toán ─────
    // Business rule: Tạo công nợ phải thu (AR) cho MỌI booking chưa thanh toán khi xuất vé
    // Không giới hạn chỉ paymentMethod === 'DEBT' — vì khách có thể thanh toán sau dù chọn bất kỳ method nào
    // Khi khách thanh toán xong, payLedger() sẽ tự động chuyển status → PAID
    if (
      ['ISSUED', 'COMPLETED', 'CHANGED'].includes(targetStatus)
      && booking.paymentStatus !== 'PAID'
    ) {
      try {
        await this.syncReceivableLedgerForBooking(booking.id, changedBy, { createIfMissing: true });
      } catch (err) {
        // Không throw — không để lỗi ledger chặn việc xuất vé
        console.error(`[LedgerAutoCreate] Lỗi tạo AR cho booking ${booking.bookingCode}:`, err);
      }
    }

    // ── Auto-tạo AP (phải trả NCC) khi xuất vé có supplier ─────
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
              description: `Phải trả NCC ${supplier.name} — Booking ${booking.bookingCode}`,
              createdBy: changedBy,
            },
          });
          console.log(`[AP-AUTO] Tạo AP ${apCode} — ${supplier.name} — ${booking.totalNetPrice}`);
        }
        }
      } catch (err) {
        console.error(`[AP-AUTO] Lỗi tạo AP cho booking ${booking.bookingCode}:`, err);
      }
    }

    // Gửi thông báo khi xuất vé hoặc hủy
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

  // Helper: sinh mã AR-YYMMDD-XXX hoặc AP-YYMMDD-XXX (dùng cho Bước 2i + 2e)
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


  // Thêm vé vào booking và tính lại lợi nhuận
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
        'Booking đã có thanh toán hoặc bút toán liên quan. Không thể thêm hoặc thay thế hành trình lúc này.',
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
        'Booking đang có PNR khác. Vui lòng dùng Nhập nhanh để thay thế toàn bộ PNR cũ trước khi thêm PNR mới.',
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
          throw new BadRequestException('Cần cung cấp passengerId hoặc passengerName.');
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

  // Xóa toàn bộ vé/hành trình và reset tổng tiền về trạng thái ban đầu
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
        'Booking đã có thanh toán hoặc bút toán liên quan. Không thể xóa hành trình lúc này.',
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


  // Ghi nhận thanh toán
  async addPayment(bookingId: string, dto: AddPaymentDto) {
    const booking = await this.findOne(bookingId);

    // 1. Tạo payment record
    if (dto.method !== 'DEBT' && !dto.fundAccount) {
      throw new BadRequestException('Vui lÃ²ng chá»n quá»¹ nháº­n tiá»n cho giao dá»‹ch nÃ y.');
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

    // 2. Cập nhật paymentStatus booking
    await this.updatePaymentStatus(bookingId);

    // 3. ── DEBT: tạo AR trực tiếp, skip CashFlow ──────────────────
    if (dto.method === 'DEBT') {
      try {
        // Kiểm tra AR đã tồn tại chưa
        const existingAR = await this.prisma.accountsLedger.findFirst({
          where: { bookingId, direction: 'RECEIVABLE', status: { not: 'PAID' } },
        });

        if (!existingAR) {
          // Tạo mới AR cho toàn bộ giá trị booking
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
              dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 ngày
            },
          });
          console.log(`[AR-CREATE-DEBT] AR ${arCode} — ${dto.amount} cho KH ${customer?.fullName}`);
        }
      } catch (err) {
        console.error('[AR-DEBT] Lỗi tạo AR từ công nợ:', err);
      }
    } else {
      // NON-DEBT: ghi CashFlow Inflow bình thường
      try {
        const fundLabel = dto.fundAccount === 'CASH_OFFICE' ? 'Tiền mặt VP'
          : dto.fundAccount === 'BANK_HTX' ? 'TK BIDV HTX'
          : dto.fundAccount === 'BANK_PERSONAL' ? 'TK MB cá nhân' : 'N/A';

        await this.prisma.cashFlowEntry.create({
          data: {
            direction: 'INFLOW',
            category: 'TICKET_PAYMENT',
            amount: dto.amount,
            pic: booking.staff?.fullName ?? 'System',
            description: `KH thanh toán ${booking.bookingCode} — ${booking.contactName}`,
            reference: booking.pnr || booking.bookingCode,
            date: dto.paidAt ? new Date(dto.paidAt) : new Date(),
            status: 'DONE',
            fundAccount: dto.fundAccount as any,
          },
        });
        console.log(`[INFLOW] +${dto.amount} từ KH ${booking.contactName} vào ${fundLabel}`);
      } catch (err) {
        console.error('[INFLOW] Lỗi ghi CashFlow:', err);
      }
    }

    // 4. ── AUTO CẬP NHẬT AR (công nợ phải thu) ────────────────────
    try {
      const arLedger = await this.prisma.accountsLedger.findFirst({
        where: { bookingId, direction: 'RECEIVABLE', status: { not: 'PAID' } },
      });

      // Chỉ giảm trừ công nợ nếu khách trả tiền thực tế (không phải là ghi nợ mới)
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
            notes: `Auto từ payment booking ${booking.bookingCode}`,
          },
        });
        console.log(`[AR-UPDATE] AR ${arLedger.code} — paid +${dto.amount}, remaining ${newRemaining}`);
      }
    } catch (err) {
      console.error('[AR-UPDATE] Lỗi cập nhật AR:', err);
    }

    // 5. Webhook n8n
    await this.n8n.triggerWebhook('/payment', {
      bookingId, bookingCode: booking.bookingCode,
      amount: payment.amount, method: payment.method,
      fundAccount: dto.fundAccount, customerName: booking.contactName,
    });

    return payment;
  }

  // Cập nhật trạng thái thanh toán dựa trên tổng payments
  private async updatePaymentStatus(bookingId: string) {
    const [booking, payments] = await Promise.all([
      this.prisma.booking.findUnique({ where: { id: bookingId } }),
      this.prisma.payment.findMany({ where: { bookingId } }),
    ]);

    if (!booking) return;

    // Chỉ cộng dồn các khoản thu thực tế, bỏ qua phương thức CÔNG NỢ (DEBT) vì không sinh dòng tiền
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

  // Sinh mã booking APG-YYMMDD-XXX
  private async generateBookingCode(): Promise<string> {
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const prefix = `APG-${yy}${mm}${dd}`;

    // Lấy sequence lớn nhất theo prefix ngày hiện tại.
    // Không phụ thuộc createdAt để tránh đụng mã khi booking bị backdate.
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

    throw new ConflictException('Không thể sinh mã booking mới. Vui lòng thử lại.');
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

  // FIX 2: Xử lý contactPhone rỗng → sinh phone unique tạm
  private async resolveCustomerId(dto: CreateBookingDto) {
    const providedCustomerId = dto.customerId?.trim();
    const providedCustomerCode = dto.customerCode?.trim().toUpperCase();

    // 1. Nếu có customerId hợp lệ → dùng luôn
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

    // 2. Nếu có mã KH → ưu tiên tìm theo mã
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

    // 3. Nếu có phone hợp lệ (không rỗng) → tìm theo phone
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

    // 4. Tạo khách mới — sinh phone unique nếu rỗng
    const newCustomer = await this.customers.create({
      data: {
        fullName: dto.contactName || 'Khách hàng mới',
        phone: phone && phone.length >= 5
          ? phone
          : `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        customerCode: providedCustomerCode,
        tags: [],
      },
      select: { id: true },
    });
    return newCustomer.id;
  }
}
