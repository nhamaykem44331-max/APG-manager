// APG Manager RMS - ExpenseService: Quản lý chi phí vận hành
// (nguồn: Google Sheet "Chi phí vận hành" - 209 khoản chi)
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface CreateExpenseDto {
  category: string;
  description: string;
  amount: number;
  date: string;
  status?: string;
  notes?: string;
}

export interface ListExpenseDto {
  page?: number;
  pageSize?: number;
  category?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Danh sách chi phí có filter ─────────────────────────────────
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
        where, skip, take: pageSize, orderBy: { date: 'desc' },
      }),
      this.prisma.operatingExpense.count({ where }),
    ]);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  // ─── Tạo chi phí mới ─────────────────────────────────────────────
  async create(dto: CreateExpenseDto, userId: string) {
    return this.prisma.operatingExpense.create({
      data: {
        category: dto.category as never,
        description: dto.description,
        amount: dto.amount,
        date: new Date(dto.date),
        status: dto.status ?? 'DONE',
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  // ─── Cập nhật chi phí ────────────────────────────────────────────
  async update(id: string, data: Partial<CreateExpenseDto>) {
    return this.prisma.operatingExpense.update({
      where: { id },
      data: {
        ...(data.description && { description: data.description }),
        ...(data.amount && { amount: data.amount }),
        ...(data.category && { category: data.category as never }),
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.date && { date: new Date(data.date) }),
      },
    });
  }

  // ─── Xóa chi phí ─────────────────────────────────────────────────
  async remove(id: string) {
    return this.prisma.operatingExpense.delete({ where: { id } });
  }

  // ─── Tổng hợp chi phí theo category (cho pie chart) ──────────────
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

    const total = items.reduce((s, i) => s + Number(i._sum.amount ?? 0), 0);
    return {
      items: items.map((i) => ({
        category: i.category,
        amount: Number(i._sum.amount ?? 0),
        count: i._count,
        pct: total > 0 ? Math.round((Number(i._sum.amount ?? 0) / total) * 100) : 0,
      })),
      total,
    };
  }

  // ─── Báo cáo chi phí hàng tháng ──────────────────────────────────
  async getMonthlySummary(year: number) {
    const expenses = await this.prisma.operatingExpense.findMany({
      where: {
        date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        status: 'DONE',
      },
      select: { amount: true, date: true, category: true },
    });

    const monthly: Record<string, number> = {};
    for (let m = 1; m <= 12; m++) monthly[`T${m}`] = 0;

    for (const e of expenses) {
      const month = `T${e.date.getMonth() + 1}`;
      monthly[month] += Number(e.amount);
    }

    return Object.entries(monthly).map(([month, total]) => ({ month, total }));
  }
}
