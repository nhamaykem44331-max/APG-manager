import { BadRequestException, Injectable } from '@nestjs/common';
import { CashFlowSourceType, FundAccount } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateExpenseDto, ListExpenseDto } from './dto';
import { CashFlowService } from './cashflow.service';

@Injectable()
export class ExpenseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashflow: CashFlowService,
  ) {}

  async findAll(dto: ListExpenseDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 30;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (dto.category) where.category = dto.category;
    if (dto.status) where.status = dto.status;
    if (dto.search) {
      where.OR = [
        { description: { contains: dto.search, mode: 'insensitive' } },
        { notes: { contains: dto.search, mode: 'insensitive' } },
      ];
    }
    if (dto.dateFrom || dto.dateTo) {
      where.date = {
        ...(dto.dateFrom && { gte: new Date(dto.dateFrom) }),
        ...(dto.dateTo && { lte: new Date(dto.dateTo) }),
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.operatingExpense.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { date: 'desc' },
      }),
      this.prisma.operatingExpense.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async create(dto: CreateExpenseDto, userId: string) {
    if (!dto.fundAccount) {
      throw new BadRequestException('Vui lÃ²ng chá»n quá»¹ chi cho khoáº£n chi phÃ­ nÃ y.');
    }

    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.operatingExpense.create({
        data: {
          category: dto.category as never,
          description: dto.description,
          amount: dto.amount,
          date: new Date(dto.date),
          status: dto.status ?? 'DONE',
          notes: dto.notes,
          fundAccount: dto.fundAccount as FundAccount,
          createdBy: userId,
        },
      });

      await this.cashflow.syncSystemEntryBySource(
        CashFlowSourceType.OPERATING_EXPENSE,
        created.id,
        'OUTFLOW',
        {
          category: dto.category as never,
          amount: dto.amount,
          pic: 'Finance',
          description: `Chi phÃ­: ${dto.description}`,
          reference: created.id,
          date: new Date(dto.date),
          status: dto.status ?? 'DONE',
          notes: dto.notes,
          fundAccount: dto.fundAccount as FundAccount,
          isLocked: true,
        },
        tx,
      );

      return created;
    });

    return expense;
  }

  async update(id: string, data: Partial<CreateExpenseDto>) {
    const existing = await this.prisma.operatingExpense.findUniqueOrThrow({
      where: { id },
    });

    const nextCategory = data.category ?? existing.category;
    const nextDescription = data.description ?? existing.description;
    const nextAmount = data.amount ?? Number(existing.amount);
    const nextDate = data.date ? new Date(data.date) : existing.date;
    const nextStatus = data.status ?? existing.status;
    const nextNotes = data.notes !== undefined ? data.notes : existing.notes;
    const nextFundAccount = (data.fundAccount ?? existing.fundAccount) as FundAccount | null;

    if (!nextFundAccount) {
      throw new BadRequestException('Khoáº£n chi phÃ­ pháº£i gáº¯n vá»›i má»™t quá»¹ chi.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.operatingExpense.update({
        where: { id },
        data: {
          ...(data.description !== undefined && { description: data.description }),
          ...(data.amount !== undefined && { amount: data.amount }),
          ...(data.category && { category: data.category as never }),
          ...(data.status && { status: data.status }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.date && { date: new Date(data.date) }),
          ...(data.fundAccount !== undefined && { fundAccount: data.fundAccount as FundAccount }),
        },
      });

      await this.cashflow.syncSystemEntryBySource(
        CashFlowSourceType.OPERATING_EXPENSE,
        updated.id,
        'OUTFLOW',
        {
          category: nextCategory as never,
          amount: nextAmount,
          pic: 'Finance',
          description: `Chi phÃ­: ${nextDescription}`,
          reference: updated.id,
          date: nextDate,
          status: nextStatus,
          notes: nextNotes,
          fundAccount: nextFundAccount,
          isLocked: true,
        },
        tx,
      );

      return updated;
    });
  }

  async remove(id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.cashflow.deleteSystemEntriesBySource(CashFlowSourceType.OPERATING_EXPENSE, id, tx);
      return tx.operatingExpense.delete({ where: { id } });
    });
  }

  async getSummaryByCategory(dateFrom?: string, dateTo?: string) {
    const dateFilter: Record<string, Date> = {};
    if (dateFrom) dateFilter.gte = new Date(dateFrom);
    if (dateTo) dateFilter.lte = new Date(dateTo);
    const where = {
      ...(Object.keys(dateFilter).length ? { date: dateFilter } : {}),
      status: 'DONE',
    };

    const items = await this.prisma.operatingExpense.groupBy({
      by: ['category'],
      where,
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: 'desc' } },
    });

    const total = items.reduce((sum, item) => sum + Number(item._sum.amount ?? 0), 0);
    return {
      items: items.map((item) => ({
        category: item.category,
        amount: Number(item._sum.amount ?? 0),
        count: item._count,
        pct: total > 0 ? Math.round((Number(item._sum.amount ?? 0) / total) * 100) : 0,
      })),
      total,
    };
  }

  async getMonthlySummary(year: number) {
    const expenses = await this.prisma.operatingExpense.findMany({
      where: {
        date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        status: 'DONE',
      },
      select: { amount: true, date: true, category: true },
    });

    const monthly: Record<string, number> = {};
    for (let month = 1; month <= 12; month += 1) monthly[`T${month}`] = 0;

    for (const expense of expenses) {
      const month = `T${expense.date.getMonth() + 1}`;
      monthly[month] += Number(expense.amount);
    }

    return Object.entries(monthly).map(([month, total]) => ({ month, total }));
  }
}
