import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CashFlowCategory,
  CashFlowDirection,
  CashFlowSourceType,
  FundAccount,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import {
  AdjustFundBalanceDto,
  CreateCashFlowDto,
  CreateFundEntryDto,
  ListCashFlowDto,
  ListFundLedgerDto,
  TransferFundDto,
  UpdateFundEntryDto,
} from './dto';

const FUND_LABELS: Record<FundAccount, string> = {
  CASH_OFFICE: 'Quỹ tiền mặt VP',
  BANK_HTX: 'TK BIDV HTX',
  BANK_PERSONAL: 'TK MB cá nhân',
};

const FUND_LIST: FundAccount[] = ['CASH_OFFICE', 'BANK_HTX', 'BANK_PERSONAL'];

const SOURCE_LABELS: Partial<Record<CashFlowSourceType, string>> = {
  MANUAL: 'Thủ công',
  BOOKING_PAYMENT: 'Thanh toán booking',
  LEDGER_PAYMENT: 'Thu/chi công nợ',
  OPERATING_EXPENSE: 'Chi phí vận hành',
  FUND_TRANSFER: 'Chuyển quỹ nội bộ',
  FUND_ADJUSTMENT: 'Điều chỉnh số dư',
  DEPOSIT_TOPUP: 'Nạp deposit',
};

type DbClient = Prisma.TransactionClient | PrismaClient;

type SystemCashFlowPayload = {
  direction: CashFlowDirection;
  category: CashFlowCategory;
  amount: number;
  pic: string;
  description: string;
  reference?: string | null;
  date: Date;
  status?: string;
  notes?: string | null;
  fundAccount?: FundAccount | null;
  counterpartyFundAccount?: FundAccount | null;
  sourceType: CashFlowSourceType;
  sourceId?: string | null;
  transferGroupId?: string | null;
  reason?: string | null;
  isLocked?: boolean;
};

@Injectable()
export class CashFlowService {
  constructor(private readonly prisma: PrismaService) {}

  private getFundLabel(fund?: FundAccount | null) {
    return fund ? FUND_LABELS[fund] : 'Chưa gán quỹ';
  }

  private getSourceLabel(sourceType?: CashFlowSourceType | null) {
    return sourceType ? SOURCE_LABELS[sourceType] ?? sourceType : 'Legacy';
  }

  private sanitizeForAudit(value: unknown) {
    return JSON.parse(
      JSON.stringify(value, (_key, current) => {
        if (typeof current === 'bigint') {
          return current.toString();
        }
        return current;
      }),
    );
  }

  private async writeAuditLog(
    tx: DbClient,
    userId: string | undefined,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    entityId: string,
    oldData?: unknown,
    newData?: unknown,
  ) {
    if (!userId) {
      return;
    }

    await tx.auditLog.create({
      data: {
        userId,
        action,
        entity: 'cashflow',
        entityId,
        oldData: oldData === undefined ? undefined : this.sanitizeForAudit(oldData),
        newData: newData === undefined ? undefined : this.sanitizeForAudit(newData),
      },
    });
  }

  private buildCashFlowWhere(dto: ListCashFlowDto): Prisma.CashFlowEntryWhereInput {
    const where: Prisma.CashFlowEntryWhereInput = {};

    if (dto.direction) where.direction = dto.direction as CashFlowDirection;
    if (dto.category) where.category = dto.category as CashFlowCategory;
    if (dto.status) where.status = dto.status;
    if (dto.fundAccount) where.fundAccount = dto.fundAccount as FundAccount;
    if (dto.sourceType) where.sourceType = dto.sourceType as CashFlowSourceType;
    if (dto.pic) where.pic = { contains: dto.pic, mode: 'insensitive' };
    if (dto.search) {
      where.OR = [
        { description: { contains: dto.search, mode: 'insensitive' } },
        { reference: { contains: dto.search, mode: 'insensitive' } },
        { notes: { contains: dto.search, mode: 'insensitive' } },
        { reason: { contains: dto.search, mode: 'insensitive' } },
      ];
    }

    if (dto.dateFrom || dto.dateTo) {
      where.date = {
        ...(dto.dateFrom && { gte: new Date(dto.dateFrom) }),
        ...(dto.dateTo && { lte: new Date(dto.dateTo) }),
      };
    }

    return where;
  }

  private getSignedAmount(entry: { direction: CashFlowDirection; amount: Prisma.Decimal | number }) {
    const amount = Number(entry.amount ?? 0);
    return entry.direction === 'INFLOW' ? amount : -amount;
  }

  private ensureEditable(entry: {
    id: string;
    description: string;
    sourceType?: CashFlowSourceType | null;
    isLocked: boolean;
  }) {
    if (!entry.isLocked) {
      return;
    }

    throw new BadRequestException(
      `Giao dịch "${entry.description}" được đồng bộ từ ${this.getSourceLabel(entry.sourceType)}. ` +
      'Hãy chỉnh sửa ở chứng từ nguồn để tránh lệch số liệu toàn hệ thống.',
    );
  }

  private async createEntry(
    tx: DbClient,
    data: SystemCashFlowPayload,
    userId?: string,
  ) {
    const created = await tx.cashFlowEntry.create({
      data: {
        direction: data.direction,
        category: data.category,
        amount: data.amount,
        pic: data.pic,
        description: data.description,
        reference: data.reference ?? null,
        date: data.date,
        status: data.status ?? 'DONE',
        notes: data.notes ?? null,
        fundAccount: data.fundAccount ?? null,
        counterpartyFundAccount: data.counterpartyFundAccount ?? null,
        sourceType: data.sourceType,
        sourceId: data.sourceId ?? null,
        transferGroupId: data.transferGroupId ?? null,
        reason: data.reason ?? null,
        isLocked: data.isLocked ?? false,
        createdBy: userId ?? null,
      },
    });

    await this.writeAuditLog(tx, userId, 'CREATE', created.id, undefined, created);
    return created;
  }

  private async getFundCurrentBalance(fundAccount: FundAccount) {
    const [inflow, outflow] = await Promise.all([
      this.prisma.cashFlowEntry.aggregate({
        where: { fundAccount, direction: 'INFLOW', status: 'DONE' },
        _sum: { amount: true },
      }),
      this.prisma.cashFlowEntry.aggregate({
        where: { fundAccount, direction: 'OUTFLOW', status: 'DONE' },
        _sum: { amount: true },
      }),
    ]);

    return Number(inflow._sum.amount ?? 0) - Number(outflow._sum.amount ?? 0);
  }

  async recordSystemEntry(payload: SystemCashFlowPayload, tx: DbClient = this.prisma) {
    return this.createEntry(tx, { ...payload, isLocked: payload.isLocked ?? true });
  }

  async syncSystemEntryBySource(
    sourceType: CashFlowSourceType,
    sourceId: string,
    direction: CashFlowDirection,
    payload: Omit<SystemCashFlowPayload, 'sourceType' | 'sourceId' | 'direction'>,
    tx: DbClient = this.prisma,
  ) {
    const existing = await tx.cashFlowEntry.findFirst({
      where: { sourceType, sourceId, direction },
    });

    if (existing) {
      return tx.cashFlowEntry.update({
        where: { id: existing.id },
        data: {
          category: payload.category,
          amount: payload.amount,
          pic: payload.pic,
          description: payload.description,
          reference: payload.reference ?? null,
          date: payload.date,
          status: payload.status ?? 'DONE',
          notes: payload.notes ?? null,
          fundAccount: payload.fundAccount ?? null,
          counterpartyFundAccount: payload.counterpartyFundAccount ?? null,
          reason: payload.reason ?? null,
          isLocked: payload.isLocked ?? true,
        },
      });
    }

    return this.recordSystemEntry({
      direction,
      sourceType,
      sourceId,
      ...payload,
      isLocked: payload.isLocked ?? true,
    }, tx);
  }

  async deleteSystemEntriesBySource(
    sourceType: CashFlowSourceType,
    sourceId: string,
    tx: DbClient = this.prisma,
  ) {
    return tx.cashFlowEntry.deleteMany({
      where: { sourceType, sourceId },
    });
  }

  // ─── Danh sách giao dịch có filter + phân trang ───────────────────────
  async findAll(dto: ListCashFlowDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 30;
    const skip = (page - 1) * pageSize;
    const where = this.buildCashFlowWhere(dto);

    const [data, total] = await Promise.all([
      this.prisma.cashFlowEntry.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.cashFlowEntry.count({ where }),
    ]);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  // ─── Tạo giao dịch thủ công ────────────────────────────────────────────
  async create(dto: CreateCashFlowDto, userId: string) {
    return this.createEntry(this.prisma, {
      direction: dto.direction,
      category: dto.category,
      amount: dto.amount,
      pic: dto.pic,
      description: dto.description,
      reference: dto.reference,
      date: new Date(dto.date),
      status: dto.status ?? 'DONE',
      notes: dto.notes,
      fundAccount: dto.fundAccount,
      counterpartyFundAccount: dto.counterpartyFundAccount,
      reason: dto.reason,
      sourceType: CashFlowSourceType.MANUAL,
      sourceId: null,
      transferGroupId: dto.transferGroupId,
      isLocked: false,
    }, userId);
  }

  // ─── Cập nhật giao dịch thủ công ───────────────────────────────────────
  async update(id: string, data: Partial<CreateCashFlowDto>, userId?: string) {
    const existing = await this.prisma.cashFlowEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy giao dịch quỹ.');
    }

    if (existing.transferGroupId) {
      throw new BadRequestException('Giao dịch chuyển quỹ cần sửa bằng form chuyển quỹ nội bộ.');
    }

    this.ensureEditable(existing);

    const updated = await this.prisma.cashFlowEntry.update({
      where: { id },
      data: {
        ...(data.direction && { direction: data.direction }),
        ...(data.category && { category: data.category }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.pic !== undefined && { pic: data.pic }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.reference !== undefined && { reference: data.reference }),
        ...(data.date && { date: new Date(data.date) }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.fundAccount !== undefined && { fundAccount: data.fundAccount }),
        ...(data.counterpartyFundAccount !== undefined && { counterpartyFundAccount: data.counterpartyFundAccount }),
        ...(data.reason !== undefined && { reason: data.reason }),
      },
    });

    await this.writeAuditLog(this.prisma, userId, 'UPDATE', updated.id, existing, updated);
    return updated;
  }

  // ─── Xóa giao dịch ─────────────────────────────────────────────────────
  async remove(id: string, userId?: string) {
    const existing = await this.prisma.cashFlowEntry.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Không tìm thấy giao dịch quỹ.');
    }

    this.ensureEditable(existing);

    if (existing.transferGroupId) {
      const groupEntries = await this.prisma.cashFlowEntry.findMany({
        where: { transferGroupId: existing.transferGroupId },
      });

      await this.prisma.$transaction(async (tx) => {
        await tx.cashFlowEntry.deleteMany({ where: { transferGroupId: existing.transferGroupId } });
        for (const entry of groupEntries) {
          await this.writeAuditLog(tx, userId, 'DELETE', entry.id, entry, undefined);
        }
      });

      return { deletedCount: groupEntries.length };
    }

    const deleted = await this.prisma.cashFlowEntry.delete({ where: { id } });
    await this.writeAuditLog(this.prisma, userId, 'DELETE', deleted.id, existing, undefined);
    return deleted;
  }

  async getFundBalances() {
    const entries = await this.prisma.cashFlowEntry.findMany({
      where: {
        status: 'DONE',
        fundAccount: { not: null },
      },
      select: {
        fundAccount: true,
        direction: true,
        amount: true,
        date: true,
        sourceType: true,
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const summaries = new Map<FundAccount, {
      fund: FundAccount;
      label: string;
      inflow: number;
      outflow: number;
      balance: number;
      lastTransactionAt: Date | null;
      movementCount: number;
    }>();

    for (const fund of FUND_LIST) {
      summaries.set(fund, {
        fund,
        label: this.getFundLabel(fund),
        inflow: 0,
        outflow: 0,
        balance: 0,
        lastTransactionAt: null,
        movementCount: 0,
      });
    }

    for (const entry of entries) {
      if (!entry.fundAccount) {
        continue;
      }
      const bucket = summaries.get(entry.fundAccount)!;
      const amount = Number(entry.amount ?? 0);
      if (entry.direction === 'INFLOW') {
        bucket.inflow += amount;
        bucket.balance += amount;
      } else {
        bucket.outflow += amount;
        bucket.balance -= amount;
      }
      bucket.movementCount += 1;
      if (!bucket.lastTransactionAt || entry.date > bucket.lastTransactionAt) {
        bucket.lastTransactionAt = entry.date;
      }
    }

    return [...summaries.values()];
  }

  async getFundsOverview() {
    const [funds, recent] = await Promise.all([
      this.getFundBalances(),
      this.getFundLedger({ page: 1, pageSize: 12 }),
    ]);

    return {
      totalBalance: funds.reduce((sum, fund) => sum + fund.balance, 0),
      funds,
      recentEntries: recent.data,
      meta: recent.meta,
    };
  }

  async getFundLedger(dto: ListFundLedgerDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 30;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CashFlowEntryWhereInput = {
      fundAccount: { not: null },
      ...(dto.fundAccount && { fundAccount: dto.fundAccount }),
      ...(dto.sourceType && { sourceType: dto.sourceType as CashFlowSourceType }),
      ...(dto.search && {
        OR: [
          { description: { contains: dto.search, mode: 'insensitive' } },
          { reference: { contains: dto.search, mode: 'insensitive' } },
          { notes: { contains: dto.search, mode: 'insensitive' } },
          { reason: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
      ...((dto.dateFrom || dto.dateTo) && {
        date: {
          ...(dto.dateFrom && { gte: new Date(dto.dateFrom) }),
          ...(dto.dateTo && { lte: new Date(dto.dateTo) }),
        },
      }),
    };

    const entries = await this.prisma.cashFlowEntry.findMany({
      where,
      orderBy: [{ date: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    const runningByFund = new Map<string, number>();
    const rowsAsc = entries.map((entry) => {
      const fundKey = entry.fundAccount ?? 'UNKNOWN';
      const previousBalance = runningByFund.get(fundKey) ?? 0;
      const balanceAfter = previousBalance + this.getSignedAmount(entry);
      runningByFund.set(fundKey, balanceAfter);

      return {
        ...entry,
        balanceAfter,
        signedAmount: this.getSignedAmount(entry),
        fundLabel: this.getFundLabel(entry.fundAccount),
        counterpartyFundLabel: this.getFundLabel(entry.counterpartyFundAccount),
        sourceLabel: this.getSourceLabel(entry.sourceType),
      };
    });

    const total = rowsAsc.length;
    const data = rowsAsc
      .reverse()
      .slice(skip, skip + pageSize);

    return {
      data,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async createFundEntry(dto: CreateFundEntryDto, userId: string) {
    return this.createEntry(this.prisma, {
      direction: dto.direction,
      category: dto.category,
      amount: dto.amount,
      pic: dto.pic,
      description: dto.description,
      reference: dto.reference,
      date: new Date(dto.date),
      status: 'DONE',
      notes: dto.notes,
      fundAccount: dto.fundAccount,
      sourceType: CashFlowSourceType.MANUAL,
      isLocked: false,
    }, userId);
  }

  async updateFundEntry(id: string, dto: UpdateFundEntryDto, userId: string) {
    return this.update(id, dto, userId);
  }

  async adjustFundBalance(dto: AdjustFundBalanceDto, userId: string) {
    const currentBalance = await this.getFundCurrentBalance(dto.fundAccount);
    const delta = dto.targetBalance - currentBalance;

    if (delta === 0) {
      throw new BadRequestException('Số dư quỹ hiện tại đã trùng với số dư mục tiêu.');
    }

    const direction: CashFlowDirection = delta > 0 ? 'INFLOW' : 'OUTFLOW';
    const amount = Math.abs(delta);

    return this.createEntry(this.prisma, {
      direction,
      category: 'OTHER',
      amount,
      pic: dto.pic,
      description: dto.description?.trim() || `Điều chỉnh số dư ${this.getFundLabel(dto.fundAccount)}`,
      reference: dto.reference,
      date: new Date(dto.date),
      status: 'DONE',
      notes: dto.notes,
      fundAccount: dto.fundAccount,
      reason: dto.reason,
      sourceType: CashFlowSourceType.FUND_ADJUSTMENT,
      isLocked: false,
    }, userId);
  }

  async transferBetweenFunds(dto: TransferFundDto, userId: string) {
    if (dto.fromFundAccount === dto.toFundAccount) {
      throw new BadRequestException('Quỹ nguồn và quỹ đích phải khác nhau.');
    }

    const transferGroupId = `TRF-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const description = dto.description?.trim()
      || `Chuyển quỹ ${this.getFundLabel(dto.fromFundAccount)} -> ${this.getFundLabel(dto.toFundAccount)}`;
    const date = new Date(dto.date);

    return this.prisma.$transaction(async (tx) => {
      const outflow = await this.createEntry(tx, {
        direction: 'OUTFLOW',
        category: 'DISBURSEMENT',
        amount: dto.amount,
        pic: dto.pic,
        description,
        reference: dto.reference,
        date,
        status: 'DONE',
        notes: dto.notes,
        fundAccount: dto.fromFundAccount,
        counterpartyFundAccount: dto.toFundAccount,
        sourceType: CashFlowSourceType.FUND_TRANSFER,
        transferGroupId,
        reason: dto.reason,
        isLocked: false,
      }, userId);

      const inflow = await this.createEntry(tx, {
        direction: 'INFLOW',
        category: 'DISBURSEMENT',
        amount: dto.amount,
        pic: dto.pic,
        description,
        reference: dto.reference,
        date,
        status: 'DONE',
        notes: dto.notes,
        fundAccount: dto.toFundAccount,
        counterpartyFundAccount: dto.fromFundAccount,
        sourceType: CashFlowSourceType.FUND_TRANSFER,
        transferGroupId,
        reason: dto.reason,
        isLocked: false,
      }, userId);

      return { transferGroupId, outflow, inflow };
    });
  }

  async updateFundTransfer(entryId: string, dto: TransferFundDto, userId: string) {
    const anchor = await this.prisma.cashFlowEntry.findUnique({ where: { id: entryId } });
    if (!anchor || anchor.sourceType !== CashFlowSourceType.FUND_TRANSFER || !anchor.transferGroupId) {
      throw new NotFoundException('Không tìm thấy giao dịch chuyển quỹ.');
    }

    this.ensureEditable(anchor);

    if (dto.fromFundAccount === dto.toFundAccount) {
      throw new BadRequestException('Quỹ nguồn và quỹ đích phải khác nhau.');
    }

    const groupEntries = await this.prisma.cashFlowEntry.findMany({
      where: { transferGroupId: anchor.transferGroupId },
      orderBy: { createdAt: 'asc' },
    });

    const outflow = groupEntries.find((entry) => entry.direction === 'OUTFLOW');
    const inflow = groupEntries.find((entry) => entry.direction === 'INFLOW');

    if (!outflow || !inflow) {
      throw new BadRequestException('Bộ chứng từ chuyển quỹ không đầy đủ.');
    }

    const description = dto.description?.trim()
      || `Chuyển quỹ ${this.getFundLabel(dto.fromFundAccount)} -> ${this.getFundLabel(dto.toFundAccount)}`;
    const date = new Date(dto.date);

    return this.prisma.$transaction(async (tx) => {
      const updatedOutflow = await tx.cashFlowEntry.update({
        where: { id: outflow.id },
        data: {
          amount: dto.amount,
          pic: dto.pic,
          description,
          reference: dto.reference ?? null,
          date,
          notes: dto.notes ?? null,
          fundAccount: dto.fromFundAccount,
          counterpartyFundAccount: dto.toFundAccount,
          reason: dto.reason,
        },
      });

      const updatedInflow = await tx.cashFlowEntry.update({
        where: { id: inflow.id },
        data: {
          amount: dto.amount,
          pic: dto.pic,
          description,
          reference: dto.reference ?? null,
          date,
          notes: dto.notes ?? null,
          fundAccount: dto.toFundAccount,
          counterpartyFundAccount: dto.fromFundAccount,
          reason: dto.reason,
        },
      });

      await this.writeAuditLog(tx, userId, 'UPDATE', updatedOutflow.id, outflow, updatedOutflow);
      await this.writeAuditLog(tx, userId, 'UPDATE', updatedInflow.id, inflow, updatedInflow);

      return {
        transferGroupId: anchor.transferGroupId,
        outflow: updatedOutflow,
        inflow: updatedInflow,
      };
    });
  }

  // ─── Tổng hợp dòng tiền (KPI cards) ────────────────────────────────────
  async getSummary(dateFrom?: string, dateTo?: string) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    const where = Object.keys(dateFilter).length ? { date: dateFilter } : {};

    const [inflow, outflow] = await Promise.all([
      this.prisma.cashFlowEntry.aggregate({
        where: { ...where, direction: 'INFLOW', status: 'DONE' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.cashFlowEntry.aggregate({
        where: { ...where, direction: 'OUTFLOW', status: 'DONE' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalInflow = Number(inflow._sum.amount ?? 0);
    const totalOutflow = Number(outflow._sum.amount ?? 0);

    return {
      totalInflow,
      totalOutflow,
      netCashFlow: totalInflow - totalOutflow,
      inflowCount: inflow._count,
      outflowCount: outflow._count,
    };
  }

  // ─── Báo cáo hàng tháng theo category ──────────────────────────────────
  async getMonthlyReport(year: number) {
    const entries = await this.prisma.cashFlowEntry.findMany({
      where: {
        date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        status: 'DONE',
      },
      select: { direction: true, category: true, amount: true, date: true, pic: true },
    });

    const monthly: Record<string, { inflow: number; outflow: number }> = {};
    for (let month = 1; month <= 12; month += 1) {
      monthly[`T${month}`] = { inflow: 0, outflow: 0 };
    }

    for (const entry of entries) {
      const month = `T${entry.date.getMonth() + 1}`;
      if (entry.direction === 'INFLOW') monthly[month].inflow += Number(entry.amount);
      else monthly[month].outflow += Number(entry.amount);
    }

    return Object.entries(monthly).map(([month, values]) => ({
      month,
      ...values,
      net: values.inflow - values.outflow,
    }));
  }

  // ─── Báo cáo theo PIC (nhân viên phụ trách) ────────────────────────────
  async getPicReport() {
    const entries = await this.prisma.cashFlowEntry.findMany({
      select: { pic: true, direction: true, amount: true },
    });

    const byPic: Record<string, { inflow: number; outflow: number }> = {};
    for (const entry of entries) {
      if (!byPic[entry.pic]) byPic[entry.pic] = { inflow: 0, outflow: 0 };
      if (entry.direction === 'INFLOW') byPic[entry.pic].inflow += Number(entry.amount);
      else byPic[entry.pic].outflow += Number(entry.amount);
    }

    return Object.entries(byPic)
      .map(([pic, values]) => ({ pic, ...values, net: values.inflow - values.outflow }))
      .sort((a, b) => b.inflow - a.inflow);
  }
}
