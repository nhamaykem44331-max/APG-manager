// APG Manager RMS - LedgerService: Quản lý sổ cái công nợ 2 chiều (AR/AP)
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateLedgerDto, PayLedgerDto, ListLedgerDto } from './dto';
import { N8nService } from '../automation/n8n.service';

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly n8n: N8nService,
  ) {}

  // ─── Sinh mã AR/AP tự động ───────────────────────────────────────────
  private async generateCode(direction: string): Promise<string> {
    const prefix = direction === 'RECEIVABLE' ? 'AR' : 'AP';
    const now = new Date();
    const yy = now.getFullYear().toString().slice(-2);
    const mm = (now.getMonth() + 1).toString().padStart(2, '0');
    const dd = now.getDate().toString().padStart(2, '0');
    const dateStr = `${prefix}-${yy}${mm}${dd}`;
    const count = await this.prisma.accountsLedger.count({
      where: { code: { startsWith: dateStr } },
    });
    return `${dateStr}-${(count + 1).toString().padStart(3, '0')}`;
  }

  // ─── Tính lại status sau khi có thanh toán ───────────────────────────
  private calcStatus(
    totalAmount: number, paidAmount: number, dueDate: Date,
  ): 'ACTIVE' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' {
    if (paidAmount >= totalAmount) return 'PAID';
    if (paidAmount > 0) return 'PARTIAL_PAID';
    if (new Date() > dueDate) return 'OVERDUE';
    return 'ACTIVE';
  }

  // ─── findAll: Danh sách công nợ có filter + phân trang ───────────────
  async findAll(dto: ListLedgerDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (dto.direction) where.direction = dto.direction;
    if (dto.partyType) where.partyType = dto.partyType;
    if (dto.status) where.status = dto.status;
    if (dto.customerId) where.customerId = dto.customerId;
    if (dto.supplierId) where.supplierId = dto.supplierId;
    if (dto.customerCode) where.customerCode = { contains: dto.customerCode, mode: 'insensitive' };
    if (dto.pic) where.pic = { contains: dto.pic, mode: 'insensitive' };
    if (dto.search) {
      where.OR = [
        { code: { contains: dto.search, mode: 'insensitive' } },
        { description: { contains: dto.search, mode: 'insensitive' } },
        { customerCode: { contains: dto.search, mode: 'insensitive' } },
        { notes: { contains: dto.search, mode: 'insensitive' } },
        { bookingCode: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.accountsLedger.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { dueDate: 'asc' },
        include: {
          customer: { select: { id: true, fullName: true, phone: true, type: true } },
          supplier: { select: { id: true, code: true, name: true, type: true } },
          booking: { select: { id: true, bookingCode: true, totalSellPrice: true } },
          payments: { orderBy: { paidAt: 'desc' } },
        },
      }),
      this.prisma.accountsLedger.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  // ─── findOne: Chi tiết 1 công nợ ─────────────────────────────────────
  async findOne(id: string) {
    return this.prisma.accountsLedger.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        booking: { select: { id: true, bookingCode: true, totalSellPrice: true } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
  }

  // ─── create: Tạo công nợ mới ─────────────────────────────────────────
  async create(dto: CreateLedgerDto, userId: string) {
    const code = await this.generateCode(dto.direction);
    return this.prisma.accountsLedger.create({
      data: {
        code,
        direction: dto.direction,
        partyType: dto.partyType,
        customerId: dto.customerId,
        supplierId: dto.supplierId,
        customerCode: dto.customerCode,
        bookingId: dto.bookingId,
        bookingCode: dto.bookingCode,
        totalAmount: dto.totalAmount,
        remaining: dto.totalAmount,
        dueDate: new Date(dto.dueDate),
        description: dto.description,
        invoiceNumber: dto.invoiceNumber,
        pic: dto.pic,
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  // ─── update: Cập nhật thông tin công nợ ──────────────────────────────
  async update(id: string, data: Partial<CreateLedgerDto>) {
    return this.prisma.accountsLedger.update({
      where: { id },
      data: {
        ...(data.description !== undefined && { description: data.description }),
        ...(data.invoiceNumber !== undefined && { invoiceNumber: data.invoiceNumber }),
        ...(data.pic !== undefined && { pic: data.pic }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.dueDate && { dueDate: new Date(data.dueDate) }),
      },
    });
  }

  // ─── pay: Ghi nhận thanh toán công nợ ────────────────────────────────
  async pay(id: string, dto: PayLedgerDto, userId: string) {
    const ledger = await this.prisma.accountsLedger.findUniqueOrThrow({
      where: { id },
      include: { customer: true, supplier: true },
    });

    // Tạo LedgerPayment
    await this.prisma.ledgerPayment.create({
      data: {
        ledgerId: id,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        paidBy: userId,
        notes: dto.notes,
      },
    });

    // Cập nhật paidAmount và remaining
    const newPaid = Number(ledger.paidAmount) + dto.amount;
    const newRemaining = Math.max(0, Number(ledger.totalAmount) - newPaid);
    const newStatus = this.calcStatus(Number(ledger.totalAmount), newPaid, ledger.dueDate);

    const updated = await this.prisma.accountsLedger.update({
      where: { id },
      data: { paidAmount: newPaid, remaining: newRemaining, status: newStatus as never },
    });

    // Gửi webhook n8n thông báo thanh toán
    const partyName = ledger.customer?.fullName ?? ledger.supplier?.name ?? ledger.customerCode ?? 'N/A';
    await this.n8n.sendLedgerPaymentNotification({
      ledgerCode: ledger.code,
      amount: dto.amount,
      direction: ledger.direction,
      partyName,
    }).catch(() => undefined); // Không block response nếu lỗi webhook

    return updated;
  }

  // ─── getSummary: Tổng quan AR/AP ─────────────────────────────────────
  async getSummary() {
    const now = new Date();

    const [arData, apData, arOverdue, apOverdue] = await Promise.all([
      this.prisma.accountsLedger.aggregate({
        where: { direction: 'RECEIVABLE', status: { not: 'PAID' } },
        _sum: { remaining: true },
        _count: true,
      }),
      this.prisma.accountsLedger.aggregate({
        where: { direction: 'PAYABLE', status: { not: 'PAID' } },
        _sum: { remaining: true },
        _count: true,
      }),
      this.prisma.accountsLedger.aggregate({
        where: { direction: 'RECEIVABLE', dueDate: { lt: now }, status: { not: 'PAID' } },
        _sum: { remaining: true },
      }),
      this.prisma.accountsLedger.aggregate({
        where: { direction: 'PAYABLE', dueDate: { lt: now }, status: { not: 'PAID' } },
        _sum: { remaining: true },
      }),
    ]);

    const totalReceivable = Number(arData._sum.remaining ?? 0);
    const totalPayable = Number(apData._sum.remaining ?? 0);

    return {
      totalReceivable,
      totalPayable,
      netPosition: totalReceivable - totalPayable, // Dương = APG đang có lời
      overdueReceivable: Number(arOverdue._sum.remaining ?? 0),
      overduePayable: Number(apOverdue._sum.remaining ?? 0),
      receivableCount: arData._count,
      payableCount: apData._count,
    };
  }

  // ─── getAging: Báo cáo lão hóa công nợ ──────────────────────────────
  async getAging(direction?: string) {
    const now = new Date();
    const directionFilter = direction
      ? { direction: direction as 'RECEIVABLE' | 'PAYABLE' }
      : {};

    const ledgers = await this.prisma.accountsLedger.findMany({
      where: { ...directionFilter, status: { not: 'PAID' } },
      select: { direction: true, remaining: true, dueDate: true },
    });

    const buckets = (dir: string) => {
      const filtered = ledgers.filter((l) => !direction || l.direction === dir);
      const result = { 'Chưa đến hạn': 0, '0-30': 0, '30-60': 0, '60-90': 0, '>90': 0 };
      for (const l of filtered) {
        const days = Math.floor((now.getTime() - l.dueDate.getTime()) / 86_400_000);
        const amount = Number(l.remaining);
        if (days < 0) result['Chưa đến hạn'] += amount;
        else if (days <= 30) result['0-30'] += amount;
        else if (days <= 60) result['30-60'] += amount;
        else if (days <= 90) result['60-90'] += amount;
        else result['>90'] += amount;
      }
      return result;
    };

    if (direction) {
      return [{ direction, buckets: buckets(direction), total: ledgers.reduce((s, l) => s + Number(l.remaining), 0) }];
    }
    return [
      { direction: 'RECEIVABLE', buckets: buckets('RECEIVABLE') },
      { direction: 'PAYABLE', buckets: buckets('PAYABLE') },
    ];
  }

  // ─── getOverdue: Tất cả khoản quá hạn ───────────────────────────────
  async getOverdue() {
    const now = new Date();
    return this.prisma.accountsLedger.findMany({
      where: { dueDate: { lt: now }, status: { not: 'PAID' } },
      orderBy: { dueDate: 'asc' },
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
    });
  }

  // ─── getStatement: Bảng kê đối chiếu cho 1 khách hàng ───────────────
  async getStatement(customerId: string) {
    return this.prisma.accountsLedger.findMany({
      where: { customerId },
      orderBy: { issueDate: 'desc' },
      include: {
        payments: { orderBy: { paidAt: 'asc' } },
        booking: { select: { id: true, bookingCode: true } },
      },
    });
  }
}
