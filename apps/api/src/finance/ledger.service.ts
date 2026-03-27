import { BadRequestException, Injectable } from '@nestjs/common';
import { CashFlowSourceType, FundAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { N8nService } from '../automation/n8n.service';
import { CashFlowService } from './cashflow.service';
import { CreateLedgerDto, ListLedgerDto, PayLedgerDto } from './dto';

@Injectable()
export class LedgerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly n8n: N8nService,
    private readonly cashflow: CashFlowService,
  ) {}

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

  private calcStatus(
    totalAmount: number,
    paidAmount: number,
    dueDate: Date,
  ): 'ACTIVE' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' {
    if (paidAmount >= totalAmount) return 'PAID';
    if (paidAmount > 0) return 'PARTIAL_PAID';
    if (new Date() > dueDate) return 'OVERDUE';
    return 'ACTIVE';
  }

  private async syncBookingPaymentStatus(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ) {
    const [booking, payments] = await Promise.all([
      tx.booking.findUnique({ where: { id: bookingId } }),
      tx.payment.findMany({ where: { bookingId } }),
    ]);

    if (!booking) return;

    const totalPaid = payments
      .filter((payment) => payment.method !== 'DEBT')
      .reduce((sum, payment) => sum + Number(payment.amount), 0);
    const totalSell = Number(booking.totalSellPrice);

    let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
    if (totalPaid >= totalSell && totalSell > 0) paymentStatus = 'PAID';
    else if (totalPaid > 0) paymentStatus = 'PARTIAL';
    else paymentStatus = 'UNPAID';

    await tx.booking.update({
      where: { id: bookingId },
      data: { paymentStatus },
    });
  }

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
        { invoiceNumber: { contains: dto.search, mode: 'insensitive' } },
        { booking: { is: { pnr: { contains: dto.search, mode: 'insensitive' } } } },
        { customer: { is: { fullName: { contains: dto.search, mode: 'insensitive' } } } },
        { customer: { is: { customerCode: { contains: dto.search, mode: 'insensitive' } } } },
        { supplier: { is: { name: { contains: dto.search, mode: 'insensitive' } } } },
      ];
    }

    const orderBy = dto.sortBy
      ? { [dto.sortBy]: dto.sortOrder || 'desc' }
      : { dueDate: 'asc' as const };

    const [data, total] = await Promise.all([
      this.prisma.accountsLedger.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          customer: { select: { id: true, fullName: true, phone: true, type: true, customerCode: true } },
          supplier: { select: { id: true, code: true, name: true, type: true } },
          booking: { select: { id: true, bookingCode: true, pnr: true, totalSellPrice: true } },
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

  async findOne(id: string) {
    return this.prisma.accountsLedger.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        booking: { select: { id: true, bookingCode: true, pnr: true, totalSellPrice: true } },
        payments: { orderBy: { paidAt: 'desc' } },
      },
    });
  }

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

  async pay(id: string, dto: PayLedgerDto, userId: string) {
    const ledger = await this.prisma.accountsLedger.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        booking: { select: { bookingCode: true, pnr: true } },
      },
    });

    if (dto.amount > Number(ledger.remaining)) {
      throw new BadRequestException(
        `Sá»‘ tiá»n vÆ°á»£t quÃ¡ sá»‘ cÃ²n láº¡i (${Number(ledger.remaining).toLocaleString('vi-VN')} â‚«).`,
      );
    }

    if (!dto.fundAccount) {
      throw new BadRequestException('Vui lÃ²ng chá»n quá»¹ thu/chi khi ghi nháº­n thanh toÃ¡n.');
    }

    const fundAccount = dto.fundAccount as FundAccount;
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const newPaid = Number(ledger.paidAmount) + dto.amount;
    const newRemaining = Math.max(0, Number(ledger.totalAmount) - newPaid);
    const newStatus = this.calcStatus(Number(ledger.totalAmount), newPaid, ledger.dueDate);

    const updated = await this.prisma.$transaction(async (tx) => {
      const ledgerPayment = await tx.ledgerPayment.create({
        data: {
          ledgerId: id,
          amount: dto.amount,
          method: dto.method,
          reference: dto.reference,
          paidAt,
          paidBy: userId,
          notes: dto.notes,
        },
      });

      const updatedLedger = await tx.accountsLedger.update({
        where: { id },
        data: {
          paidAmount: newPaid,
          remaining: newRemaining,
          status: newStatus as never,
        },
      });

      if (ledger.direction === 'RECEIVABLE' && ledger.bookingId) {
        await tx.payment.create({
          data: {
            bookingId: ledger.bookingId,
            amount: dto.amount,
            method: dto.method,
            fundAccount: fundAccount as Prisma.PaymentCreateInput['fundAccount'],
            reference: dto.reference,
            paidAt,
            notes: dto.notes || `Thu cÃ´ng ná»£ tá»« Finance (${ledger.code})`,
          },
        });

        await this.syncBookingPaymentStatus(tx, ledger.bookingId);
      }

      await this.cashflow.recordSystemEntry({
        direction: ledger.direction === 'PAYABLE' ? 'OUTFLOW' : 'INFLOW',
        category: ledger.direction === 'PAYABLE' ? 'AIRLINE_PAYMENT' : 'TICKET_PAYMENT',
        amount: dto.amount,
        pic: 'System',
        description: ledger.direction === 'PAYABLE'
          ? `Tráº£ NCC ${ledger.supplier?.name ?? ledger.customerCode ?? 'NCC'} - ${ledger.booking?.bookingCode ?? ledger.code}`
          : `Thu cÃ´ng ná»£ KH ${ledger.customer?.fullName ?? ledger.customerCode ?? 'KH'} - ${ledger.code}`,
        reference: dto.reference || ledger.code,
        date: paidAt,
        status: 'DONE',
        fundAccount,
        notes: dto.notes ?? `Ledger: ${ledger.code}`,
        sourceType: CashFlowSourceType.LEDGER_PAYMENT,
        sourceId: ledgerPayment.id,
        isLocked: true,
      }, tx);

      if (ledger.direction === 'PAYABLE' && ledger.supplier?.type === 'AIRLINE') {
        const deposit = await tx.airlineDeposit.findFirst({
          where: { airline: ledger.supplier.code },
        });

        if (deposit) {
          await tx.airlineDeposit.update({
            where: { id: deposit.id },
            data: { balance: { decrement: dto.amount } },
          });
        }
      }

      return updatedLedger;
    });

    const partyName = ledger.customer?.fullName ?? ledger.supplier?.name ?? ledger.customerCode ?? 'N/A';
    await this.n8n.sendLedgerPaymentNotification({
      ledgerCode: ledger.code,
      amount: dto.amount,
      direction: ledger.direction,
      partyName,
    }).catch(() => undefined);

    return updated;
  }

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
      netPosition: totalReceivable - totalPayable,
      overdueReceivable: Number(arOverdue._sum.remaining ?? 0),
      overduePayable: Number(apOverdue._sum.remaining ?? 0),
      receivableCount: arData._count,
      payableCount: apData._count,
    };
  }

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
      const filtered = ledgers.filter((item) => !direction || item.direction === dir);
      const result = { 'ChÆ°a Ä‘áº¿n háº¡n': 0, '0-30': 0, '30-60': 0, '60-90': 0, '>90': 0 };
      for (const item of filtered) {
        const days = Math.floor((now.getTime() - item.dueDate.getTime()) / 86_400_000);
        const amount = Number(item.remaining);
        if (days < 0) result['ChÆ°a Ä‘áº¿n háº¡n'] += amount;
        else if (days <= 30) result['0-30'] += amount;
        else if (days <= 60) result['30-60'] += amount;
        else if (days <= 90) result['60-90'] += amount;
        else result['>90'] += amount;
      }
      return result;
    };

    if (direction) {
      return [{
        direction,
        buckets: buckets(direction),
        total: ledgers.reduce((sum, item) => sum + Number(item.remaining), 0),
      }];
    }

    return [
      { direction: 'RECEIVABLE', buckets: buckets('RECEIVABLE') },
      { direction: 'PAYABLE', buckets: buckets('PAYABLE') },
    ];
  }

  async getOverdue() {
    const now = new Date();
    return this.prisma.accountsLedger.findMany({
      where: { dueDate: { lt: now }, status: { not: 'PAID' } },
      orderBy: { dueDate: 'asc' },
      include: {
        customer: { select: { id: true, fullName: true, phone: true, customerCode: true, type: true } },
        supplier: { select: { id: true, code: true, name: true } },
      },
    });
  }

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
