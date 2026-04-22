import { BadRequestException, Injectable } from '@nestjs/common';
import { CashFlowSourceType, FundAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { N8nService } from '../automation/n8n.service';
import { CashFlowService } from './cashflow.service';
import { CreateLedgerDto, ListLedgerDto, PayLedgerBatchDto, PayLedgerDto } from './dto';

type LedgerPaymentTarget = Prisma.AccountsLedgerGetPayload<{
  include: {
    customer: true;
    supplier: true;
    booking: { select: { id: true; bookingCode: true; pnr: true } };
  };
}>;

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

  private orderAllocatableLedgers<T extends { dueDate: Date; createdAt: Date; category?: string | null }>(ledgers: T[]) {
    return [...ledgers].sort((a, b) => {
      const dueDelta = a.dueDate.getTime() - b.dueDate.getTime();
      if (dueDelta !== 0) return dueDelta;

      const aPriority = a.category === 'TICKET' || a.category == null ? 0 : 1;
      const bPriority = b.category === 'TICKET' || b.category == null ? 0 : 1;
      if (aPriority !== bPriority) return aPriority - bPriority;

      return a.createdAt.getTime() - b.createdAt.getTime();
    });
  }

  private async resolveBookingPaymentSnapshot(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ) {
    const [booking, receivableLedgers, payments] = await Promise.all([
      tx.booking.findUnique({ where: { id: bookingId } }),
      tx.accountsLedger.findMany({
        where: {
          bookingId,
          direction: 'RECEIVABLE',
          status: { notIn: ['WRITTEN_OFF', 'REFUNDED'] as any },
        },
        select: { totalAmount: true, paidAmount: true },
      }),
      tx.payment.findMany({ where: { bookingId } }),
    ]);

    if (!booking) {
      return null;
    }

    const hasReceivableLedger = receivableLedgers.length > 0;
    const totalDue = hasReceivableLedger
      ? receivableLedgers.reduce((sum, ledger) => sum + Number(ledger.totalAmount), 0)
      : booking.status === 'REFUNDED'
        ? 0
        : Number(booking.totalSellPrice);
    const totalPaid = hasReceivableLedger
      ? receivableLedgers.reduce((sum, ledger) => sum + Number(ledger.paidAmount), 0)
      : payments
          .filter((payment) => payment.method !== 'DEBT')
          .reduce((sum, payment) => sum + Number(payment.amount), 0);

    let paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
    if (totalDue <= 0) paymentStatus = 'PAID';
    else if (totalPaid >= totalDue) paymentStatus = 'PAID';
    else if (totalPaid > 0) paymentStatus = 'PARTIAL';
    else paymentStatus = 'UNPAID';

    return { paymentStatus, totalDue, totalPaid };
  }

  private async syncBookingPaymentStatus(
    tx: Prisma.TransactionClient,
    bookingId: string,
  ) {
    const snapshot = await this.resolveBookingPaymentSnapshot(tx, bookingId);
    if (!snapshot) {
      return;
    }

    await tx.booking.update({
      where: { id: bookingId },
      data: { paymentStatus: snapshot.paymentStatus },
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

    const [data, total] = await this.prisma.$transaction([
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

  private async applyLedgerPaymentAllocation(
    tx: Prisma.TransactionClient,
    ledgers: LedgerPaymentTarget[],
    dto: Pick<PayLedgerDto, 'amount' | 'method' | 'reference' | 'notes'>,
    userId: string,
    paidAt: Date,
  ) {
    let unallocated = dto.amount;
    const allocations: Array<{
      amount: number;
      ledgerCode: string;
      ledgerPaymentId: string;
    }> = [];

    for (const ledger of this.orderAllocatableLedgers(ledgers)) {
      if (unallocated <= 0) {
        break;
      }

      const allocatable = Math.min(unallocated, Number(ledger.remaining));
      if (allocatable <= 0) {
        continue;
      }

      const nextPaid = Number(ledger.paidAmount) + allocatable;
      const nextRemaining = Math.max(0, Number(ledger.totalAmount) - nextPaid);
      const nextStatus = this.calcStatus(Number(ledger.totalAmount), nextPaid, ledger.dueDate);

      const ledgerPayment = await tx.ledgerPayment.create({
        data: {
          ledgerId: ledger.id,
          amount: allocatable,
          method: dto.method,
          reference: dto.reference,
          paidAt,
          paidBy: userId,
          notes: dto.notes,
        },
      });

      await tx.accountsLedger.update({
        where: { id: ledger.id },
        data: {
          paidAmount: nextPaid,
          remaining: nextRemaining,
          status: nextStatus as never,
        },
      });

      allocations.push({
        amount: allocatable,
        ledgerCode: ledger.code,
        ledgerPaymentId: ledgerPayment.id,
      });
      unallocated -= allocatable;
    }

    return { allocations, unallocated };
  }

  async pay(id: string, dto: PayLedgerDto, userId: string) {
    const ledger = await this.prisma.accountsLedger.findUniqueOrThrow({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        booking: { select: { id: true, bookingCode: true, pnr: true } },
      },
    });

    if (dto.amount > Number(ledger.remaining)) {
      throw new BadRequestException(
        `So tien vuot qua so con lai (${Number(ledger.remaining).toLocaleString('vi-VN')} VND).`,
      );
    }

    if (!dto.fundAccount) {
      throw new BadRequestException('Vui long chon quy thu/chi khi ghi nhan thanh toan.');
    }

    const fundAccount = dto.fundAccount as FundAccount;
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const allocationResult = await this.applyLedgerPaymentAllocation(tx, [ledger], dto, userId, paidAt);

      if (allocationResult.unallocated > 0) {
        throw new BadRequestException('Khong the phan bo het so tien thanh toan vao cong no.');
      }

      if (ledger.direction === 'RECEIVABLE' && ledger.bookingId) {
        await tx.payment.create({
          data: {
            bookingId: ledger.bookingId,
            amount: dto.amount,
            method: dto.method,
            fundAccount: fundAccount as Prisma.PaymentCreateInput['fundAccount'],
            reference: dto.reference,
            paidAt,
            notes: dto.notes || `Thu cong no tu Finance (${ledger.code})`,
          },
        });

        await this.syncBookingPaymentStatus(tx, ledger.bookingId);
      }

      const cashFlowNotes = dto.notes
        ? `${dto.notes} | Ledger: ${ledger.code}`
        : `Ledger: ${ledger.code}`;

      await this.cashflow.recordSystemEntry({
        direction: ledger.direction === 'PAYABLE' ? 'OUTFLOW' : 'INFLOW',
        category: ledger.direction === 'PAYABLE' ? 'AIRLINE_PAYMENT' : 'TICKET_PAYMENT',
        amount: dto.amount,
        pic: 'System',
        description: ledger.direction === 'PAYABLE'
          ? `Tra NCC ${ledger.supplier?.name ?? ledger.customerCode ?? 'NCC'} - ${ledger.booking?.bookingCode ?? ledger.code}`
          : `Thu cong no KH ${ledger.customer?.fullName ?? ledger.customerCode ?? 'KH'} - ${ledger.code}`,
        reference: dto.reference || ledger.booking?.pnr || ledger.booking?.bookingCode || ledger.code,
        date: paidAt,
        status: 'DONE',
        fundAccount,
        notes: cashFlowNotes,
        sourceType: CashFlowSourceType.LEDGER_PAYMENT,
        sourceId: allocationResult.allocations[0]?.ledgerPaymentId ?? null,
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

      return tx.accountsLedger.findUniqueOrThrow({
        where: { id },
      });
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

  async payBatch(dto: PayLedgerBatchDto, userId: string) {
    const ledgerIds = Array.from(new Set(dto.ledgerIds));
    if (ledgerIds.length === 0) {
      throw new BadRequestException('Danh sach cong no thanh toan khong hop le.');
    }

    if (!dto.fundAccount) {
      throw new BadRequestException('Vui long chon quy thu/chi khi ghi nhan thanh toan.');
    }

    const ledgers = await this.prisma.accountsLedger.findMany({
      where: { id: { in: ledgerIds } },
      include: {
        customer: true,
        supplier: true,
        booking: { select: { id: true, bookingCode: true, pnr: true } },
      },
    });

    if (ledgers.length !== ledgerIds.length) {
      throw new BadRequestException('Mot hoac nhieu cong no khong con ton tai.');
    }

    const directions = new Set(ledgers.map((ledger) => ledger.direction));
    if (directions.size !== 1) {
      throw new BadRequestException('Chi duoc thanh toan cung luc cac cong no cung chieu AR hoac AP.');
    }

    const bookingKeys = new Set(ledgers.map((ledger) => ledger.bookingId ?? '__NO_BOOKING__'));
    if (ledgers.length > 1 && bookingKeys.size !== 1) {
      throw new BadRequestException('Chi duoc gop thanh toan cac cong no thuoc cung mot booking/PNR.');
    }

    const partyKeys = new Set(ledgers.map((ledger) => ledger.direction === 'PAYABLE'
      ? (ledger.supplierId ?? ledger.supplier?.code ?? '__NO_SUPPLIER__')
      : (ledger.customerId ?? ledger.customerCode ?? '__NO_CUSTOMER__')));
    if (ledgers.length > 1 && partyKeys.size !== 1) {
      throw new BadRequestException('Chi duoc gop thanh toan cac cong no cung mot khach hang hoac nha cung cap.');
    }

    const totalRemaining = ledgers.reduce((sum, ledger) => sum + Number(ledger.remaining), 0);
    if (totalRemaining <= 0) {
      throw new BadRequestException('Cac cong no da duoc thanh toan du.');
    }

    if (dto.amount > totalRemaining) {
      throw new BadRequestException(
        `So tien vuot qua so con lai (${totalRemaining.toLocaleString('vi-VN')} VND).`,
      );
    }

    const fundAccount = dto.fundAccount as FundAccount;
    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date();
    const orderedLedgers = this.orderAllocatableLedgers(ledgers);
    const primaryLedger = orderedLedgers[0];
    const bookingRef = primaryLedger.booking?.pnr
      ?? primaryLedger.booking?.bookingCode
      ?? primaryLedger.bookingCode
      ?? primaryLedger.code;

    const result = await this.prisma.$transaction(async (tx) => {
      const allocationResult = await this.applyLedgerPaymentAllocation(
        tx,
        orderedLedgers,
        dto,
        userId,
        paidAt,
      );

      if (allocationResult.unallocated > 0) {
        throw new BadRequestException('Khong the phan bo het so tien thanh toan vao cong no.');
      }

      if (primaryLedger.direction === 'RECEIVABLE' && primaryLedger.bookingId) {
        await tx.payment.create({
          data: {
            bookingId: primaryLedger.bookingId,
            amount: dto.amount,
            method: dto.method,
            fundAccount: fundAccount as Prisma.PaymentCreateInput['fundAccount'],
            reference: dto.reference,
            paidAt,
            notes: dto.notes || `Thu cong no tu Finance (${bookingRef})`,
          },
        });

        await this.syncBookingPaymentStatus(tx, primaryLedger.bookingId);
      }

      const joinedLedgerCodes = allocationResult.allocations.map((item) => item.ledgerCode).join(', ');
      const cashFlowNotes = dto.notes
        ? `${dto.notes} | Ledgers: ${joinedLedgerCodes}`
        : `Ledgers: ${joinedLedgerCodes}`;

      await this.cashflow.recordSystemEntry({
        direction: primaryLedger.direction === 'PAYABLE' ? 'OUTFLOW' : 'INFLOW',
        category: primaryLedger.direction === 'PAYABLE' ? 'AIRLINE_PAYMENT' : 'TICKET_PAYMENT',
        amount: dto.amount,
        pic: 'System',
        description: primaryLedger.direction === 'PAYABLE'
          ? `Tra NCC ${primaryLedger.supplier?.name ?? primaryLedger.customerCode ?? 'NCC'} - ${bookingRef}`
          : `Thu cong no KH ${primaryLedger.customer?.fullName ?? primaryLedger.customerCode ?? 'KH'} - ${bookingRef}`,
        reference: dto.reference || bookingRef,
        date: paidAt,
        status: 'DONE',
        fundAccount,
        notes: cashFlowNotes,
        sourceType: CashFlowSourceType.LEDGER_PAYMENT,
        sourceId: allocationResult.allocations[0]?.ledgerPaymentId ?? null,
        isLocked: true,
      }, tx);

      if (primaryLedger.direction === 'PAYABLE' && primaryLedger.supplier?.type === 'AIRLINE') {
        const deposit = await tx.airlineDeposit.findFirst({
          where: { airline: primaryLedger.supplier.code },
        });

        if (deposit) {
          await tx.airlineDeposit.update({
            where: { id: deposit.id },
            data: { balance: { decrement: dto.amount } },
          });
        }
      }

      const updatedLedgers = await tx.accountsLedger.findMany({
        where: { id: { in: ledgerIds } },
      });

      return {
        direction: primaryLedger.direction,
        bookingRef,
        totalPaid: dto.amount,
        allocations: allocationResult.allocations,
        updatedLedgers,
      };
    });

    const partyName = primaryLedger.customer?.fullName ?? primaryLedger.supplier?.name ?? primaryLedger.customerCode ?? 'N/A';
    await this.n8n.sendLedgerPaymentNotification({
      ledgerCode: bookingRef,
      amount: dto.amount,
      direction: primaryLedger.direction,
      partyName,
    }).catch(() => undefined);

    return result;
  }

  async getSummary() {
    const now = new Date();

    const [arData, apData, arOverdue, apOverdue] = await this.prisma.$transaction([
      this.prisma.accountsLedger.aggregate({
        where: { direction: 'RECEIVABLE', status: { notIn: ['PAID', 'WRITTEN_OFF', 'REFUNDED'] as any } },
        _sum: { remaining: true },
        _count: true,
      }),
      this.prisma.accountsLedger.aggregate({
        where: { direction: 'PAYABLE', status: { notIn: ['PAID', 'WRITTEN_OFF', 'REFUNDED'] as any } },
        _sum: { remaining: true },
        _count: true,
      }),
      this.prisma.accountsLedger.aggregate({
        where: { direction: 'RECEIVABLE', dueDate: { lt: now }, status: { notIn: ['PAID', 'WRITTEN_OFF', 'REFUNDED'] as any } },
        _sum: { remaining: true },
      }),
      this.prisma.accountsLedger.aggregate({
        where: { direction: 'PAYABLE', dueDate: { lt: now }, status: { notIn: ['PAID', 'WRITTEN_OFF', 'REFUNDED'] as any } },
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
      where: { ...directionFilter, status: { notIn: ['PAID', 'WRITTEN_OFF', 'REFUNDED'] as any } },
      select: { direction: true, remaining: true, dueDate: true },
    });

    const buckets = (dir: string) => {
      const filtered = ledgers.filter((item) => !direction || item.direction === dir);
      const result = { 'Chua den han': 0, '0-30': 0, '30-60': 0, '60-90': 0, '>90': 0 };
      for (const item of filtered) {
        const days = Math.floor((now.getTime() - item.dueDate.getTime()) / 86_400_000);
        const amount = Number(item.remaining);
        if (days < 0) result['Chua den han'] += amount;
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
      where: { dueDate: { lt: now }, status: { notIn: ['PAID', 'WRITTEN_OFF', 'REFUNDED'] as any } },
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
