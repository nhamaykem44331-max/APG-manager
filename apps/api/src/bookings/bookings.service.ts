// APG Manager RMS - Bookings Service (nghiệp vụ đặt vé)
import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { N8nService } from '../automation/n8n.service';
import { BookingStatus, Prisma } from '@prisma/client';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { ListBookingsDto } from './dto/list-bookings.dto';
import { AddTicketDto } from './dto/add-ticket.dto';
import { AddPaymentDto } from './dto/add-payment.dto';

/** Chuyển chuỗi ISO thành Date; fallback về now nếu invalid để tránh lỗi DB */
function safeDate(iso: string, isArrival = false): Date {
  if (!iso || iso.trim() === '') {
    return isArrival ? new Date(Date.now() + 3_600_000) : new Date();
  }
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? (isArrival ? new Date(Date.now() + 3_600_000) : new Date())
    : d;
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

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private n8n: N8nService,
  ) {}

  // Lấy danh sách booking có filter, sort, paginate
  async findAll(dto: ListBookingsDto) {
    const {
      page = 1, pageSize = 20,
      status, source, search,
      sortBy = 'createdAt', order = 'desc',
    } = dto;

    const where: Prisma.BookingWhereInput = { deletedAt: null };

    if (status) where.status = status as BookingStatus;
    if (source) where.source = source as Prisma.EnumBookingSourceFilter;
    if (search) {
      where.OR = [
        { bookingCode: { contains: search, mode: 'insensitive' } },
        { contactName: { contains: search, mode: 'insensitive' } },
        { contactPhone: { contains: search } },
        { pnr: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, vipTier: true } },
          staff: { select: { id: true, fullName: true } },
          tickets: { take: 1 }, // Chỉ lấy ticket đầu tiên cho hiển thị danh sách
        },
        orderBy: { [sortBy]: order },
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
      },
    });

    if (!booking) {
      throw new NotFoundException(`Không tìm thấy booking ID: ${id}`);
    }

    return booking;
  }

  // Tạo booking mới
  async create(dto: CreateBookingDto, staffId: string) {
    // Sinh mã booking theo format APG-YYMMDD-XXX
    const bookingCode = await this.generateBookingCode();
    const customerId = await this.resolveCustomerId(dto);

    const booking = await this.prisma.booking.create({
      data: {
        bookingCode,
        customerId,
        staffId,
        source: dto.source,
        contactName: dto.contactName,
        contactPhone: dto.contactPhone,
        paymentMethod: dto.paymentMethod,
        pnr: dto.pnr?.trim().toUpperCase() || null,
        notes: dto.notes,
        internalNotes: dto.internalNotes,
      },
      include: {
        customer: { select: { fullName: true, phone: true } },
        staff: { select: { fullName: true } },
      },
    });

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

    // Trigger n8n webhook thông báo booking mới
    await this.n8n.triggerWebhook('/booking-new', {
      bookingCode: booking.bookingCode,
      customerName: booking.customer.fullName,
      customerPhone: booking.customer.phone,
      staffName: booking.staff.fullName,
    });

    return booking;
  }

  // Cập nhật thông tin booking
  async update(id: string, dto: UpdateBookingDto) {
    await this.findOne(id); // Kiểm tra tồn tại

    return this.prisma.booking.update({
      where: { id },
      data: dto,
    });
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

  // Chuyển trạng thái booking (có validation)
  async updateStatus(id: string, dto: UpdateBookingStatusDto, changedBy: string) {
    const booking = await this.findOne(id);

    const allowedTransitions = STATUS_TRANSITIONS[booking.status];
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
    if (targetStatus === 'ISSUED' && booking.paymentStatus === 'UNPAID') {
      try {
        const customer = await this.prisma.customer.findUnique({
          where: { id: booking.customerId },
          select: { id: true, type: true, fullName: true },
        });

        // Hạn thanh toán: 7 ngày (lẻ) hoặc 30 ngày (doanh nghiệp)
        const dueDays = customer?.type === 'CORPORATE' ? 30 : 7;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + dueDays);

        const partyType = customer?.type === 'CORPORATE'
          ? 'CUSTOMER_CORPORATE'
          : 'CUSTOMER_INDIVIDUAL';

        const code = await this.generateLedgerCode('RECEIVABLE');

        await this.prisma.accountsLedger.create({
          data: {
            code,
            direction:   'RECEIVABLE',
            partyType:   partyType as never,
            customerId:  booking.customerId,
            bookingId:   booking.id,
            totalAmount: booking.totalSellPrice,
            paidAmount:  0,
            remaining:   booking.totalSellPrice,
            dueDate,
            description: `Công nợ vé ${booking.bookingCode}`,
            createdBy:   changedBy,
          },
        });
      } catch (err) {
        // Không throw — không để lỗi ledger chặn việc xuất vé
        console.error(`[LedgerAutoCreate] Lỗi tạo AR cho booking ${booking.bookingCode}:`, err);
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


  // Thêm vé vào booking và tính lại lợi nhuận
  async addTicket(bookingId: string, dto: AddTicketDto) {
    const booking = await this.findOne(bookingId);

    // Nếu không có passengerId, tạo mới Passenger inline
    let passengerId = dto.passengerId;
    if (!passengerId) {
      if (!dto.passengerName) {
        throw new BadRequestException('Cần cung cấp passengerId hoặc passengerName.');
      }
      const newPassenger = await this.prisma.passenger.create({
        data: {
          fullName: dto.passengerName,
          type: dto.passengerType ?? 'ADT',
          customerId: booking.customerId,
        },
      });
      passengerId = newPassenger.id;
    }

    const profit = dto.sellPrice - dto.netPrice - dto.tax - dto.serviceFee + dto.commission;

    const ticket = await this.prisma.ticket.create({
      data: {
        bookingId,
        passengerId,
        airline: dto.airline,
        flightNumber: dto.flightNumber,
        departureCode: dto.departureCode,
        arrivalCode: dto.arrivalCode,
        departureTime: safeDate(dto.departureTime),
        arrivalTime: safeDate(dto.arrivalTime, true),
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
        airlineBookingCode: dto.airlineBookingCode,
        status: 'ACTIVE',
      },
      include: { passenger: true },
    });

    // Tính lại tổng booking
    await this.recalculateBookingTotals(bookingId);

    return ticket;
  }


  // Ghi nhận thanh toán
  async addPayment(bookingId: string, dto: AddPaymentDto) {
    await this.findOne(bookingId);

    const payment = await this.prisma.payment.create({
      data: {
        bookingId,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        notes: dto.notes,
      },
    });

    // Cập nhật trạng thái thanh toán
    await this.updatePaymentStatus(bookingId);

    // Gửi webhook cập nhật Google Sheets kế toán
    await this.n8n.triggerWebhook('/payment', {
      bookingId,
      amount: payment.amount,
      method: payment.method,
      reference: payment.reference,
    });

    return payment;
  }

  // Tính lại tổng tiền booking từ các vé
  private async recalculateBookingTotals(bookingId: string) {
    const tickets = await this.prisma.ticket.findMany({
      where: { bookingId, status: 'ACTIVE' },
    });

    const totals = tickets.reduce(
      (acc, t) => ({
        totalSellPrice: acc.totalSellPrice + Number(t.sellPrice),
        totalNetPrice: acc.totalNetPrice + Number(t.netPrice) + Number(t.tax),
        totalFees: acc.totalFees + Number(t.serviceFee),
        profit: acc.profit + Number(t.profit),
      }),
      { totalSellPrice: 0, totalNetPrice: 0, totalFees: 0, profit: 0 },
    );

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: totals,
    });
  }

  // Cập nhật trạng thái thanh toán dựa trên tổng payments
  private async updatePaymentStatus(bookingId: string) {
    const [booking, payments] = await Promise.all([
      this.prisma.booking.findUnique({ where: { id: bookingId } }),
      this.prisma.payment.findMany({ where: { bookingId } }),
    ]);

    if (!booking) return;

    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalSell = Number(booking.totalSellPrice);

    let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
    if (totalPaid >= totalSell) paymentStatus = 'PAID';
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

    // Đếm số booking trong ngày
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const count = await this.prisma.booking.count({
      where: { createdAt: { gte: startOfDay } },
    });

    const seq = (count + 1).toString().padStart(3, '0');
    return `${prefix}-${seq}`;
  }

  private async resolveCustomerId(dto: CreateBookingDto) {
    const providedCustomerId = dto.customerId?.trim();

    if (providedCustomerId && providedCustomerId !== 'new') {
      const existingCustomer = await this.prisma.customer.findUnique({
        where: { id: providedCustomerId },
        select: { id: true },
      });

      if (existingCustomer) {
        return existingCustomer.id;
      }
    }

    const existingByPhone = await this.prisma.customer.findUnique({
      where: { phone: dto.contactPhone },
      select: { id: true },
    });

    if (existingByPhone) {
      return existingByPhone.id;
    }

    const newCustomer = await this.prisma.customer.create({
      data: {
        fullName: dto.contactName,
        phone: dto.contactPhone,
        tags: [],
      },
      select: { id: true },
    });

    return newCustomer.id;
  }
}
