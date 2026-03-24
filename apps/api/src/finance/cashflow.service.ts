// APG Manager RMS - CashFlowService: Quản lý dòng tiền thực tế
// (nguồn: Google Sheet "Dòng tiền KHÁCH LẺ" - 217 giao dịch)
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCashFlowDto, ListCashFlowDto } from './dto';

@Injectable()
export class CashFlowService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Danh sách giao dịch có filter + phân trang ───────────────────
  async findAll(dto: ListCashFlowDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 30;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = {};
    if (dto.direction) where.direction = dto.direction;
    if (dto.category) where.category = dto.category;
    if (dto.status) where.status = dto.status;
    if (dto.pic) where.pic = { contains: dto.pic, mode: 'insensitive' };
    if (dto.search) {
      where.OR = [
        { description: { contains: dto.search, mode: 'insensitive' } },
        { reference: { contains: dto.search, mode: 'insensitive' } },
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
      this.prisma.cashFlowEntry.findMany({
        where, skip, take: pageSize, orderBy: { date: 'desc' },
      }),
      this.prisma.cashFlowEntry.count({ where }),
    ]);

    return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
  }

  // ─── Tạo giao dịch mới ───────────────────────────────────────────
  async create(dto: CreateCashFlowDto, userId: string) {
    return this.prisma.cashFlowEntry.create({
      data: {
        direction: dto.direction as never,
        category: dto.category as never,
        amount: dto.amount,
        pic: dto.pic,
        description: dto.description,
        reference: dto.reference,
        date: new Date(dto.date),
        status: dto.status ?? 'DONE',
        notes: dto.notes,
        createdBy: userId,
      },
    });
  }

  // ─── Cập nhật giao dịch ──────────────────────────────────────────
  async update(id: string, data: Partial<CreateCashFlowDto>) {
    return this.prisma.cashFlowEntry.update({
      where: { id },
      data: {
        ...(data.description && { description: data.description }),
        ...(data.amount && { amount: data.amount }),
        ...(data.pic && { pic: data.pic }),
        ...(data.status && { status: data.status }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.reference !== undefined && { reference: data.reference }),
        ...(data.date && { date: new Date(data.date) }),
      },
    });
  }

  // ─── Xóa giao dịch ───────────────────────────────────────────────
  async remove(id: string) {
    return this.prisma.cashFlowEntry.delete({ where: { id } });
  }

  // ─── Tổng hợp dòng tiền (KPI cards) ─────────────────────────────
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

  // ─── Báo cáo hàng tháng theo category ────────────────────────────
  async getMonthlyReport(year: number) {
    const entries = await this.prisma.cashFlowEntry.findMany({
      where: {
        date: { gte: new Date(`${year}-01-01`), lt: new Date(`${year + 1}-01-01`) },
        status: 'DONE',
      },
      select: { direction: true, category: true, amount: true, date: true, pic: true },
    });

    // Group by month
    const monthly: Record<string, { inflow: number; outflow: number }> = {};
    for (let m = 1; m <= 12; m++) {
      monthly[`T${m}`] = { inflow: 0, outflow: 0 };
    }

    for (const e of entries) {
      const month = `T${e.date.getMonth() + 1}`;
      if (e.direction === 'INFLOW') monthly[month].inflow += Number(e.amount);
      else monthly[month].outflow += Number(e.amount);
    }

    return Object.entries(monthly).map(([month, vals]) => ({
      month,
      ...vals,
      net: vals.inflow - vals.outflow,
    }));
  }

  // ─── Báo cáo theo PIC (nhân viên phụ trách) ──────────────────────
  async getPicReport() {
    const entries = await this.prisma.cashFlowEntry.findMany({
      select: { pic: true, direction: true, amount: true },
    });

    const byPic: Record<string, { inflow: number; outflow: number }> = {};
    for (const e of entries) {
      if (!byPic[e.pic]) byPic[e.pic] = { inflow: 0, outflow: 0 };
      if (e.direction === 'INFLOW') byPic[e.pic].inflow += Number(e.amount);
      else byPic[e.pic].outflow += Number(e.amount);
    }

    return Object.entries(byPic).map(([pic, vals]) => ({
      pic, ...vals, net: vals.inflow - vals.outflow,
    })).sort((a, b) => b.inflow - a.inflow);
  }

  // ─── Số dư theo quỹ tiền (CASH_OFFICE / BANK_HTX / BANK_PERSONAL) ─
  async getFundBalances() {
    const funds = ['CASH_OFFICE', 'BANK_HTX', 'BANK_PERSONAL'];
    const balances = await Promise.all(funds.map(async (fund) => {
      const [inflow, outflow] = await Promise.all([
        this.prisma.cashFlowEntry.aggregate({
          where: { direction: 'INFLOW', status: 'DONE', notes: { contains: fund } },
          _sum: { amount: true },
        }),
        this.prisma.cashFlowEntry.aggregate({
          where: { direction: 'OUTFLOW', status: 'DONE', notes: { contains: fund } },
          _sum: { amount: true },
        }),
      ]);
      return {
        fund,
        label: fund === 'CASH_OFFICE' ? 'Quỹ tiền mặt VP'
          : fund === 'BANK_HTX' ? 'TK BIDV HTX' : 'TK MB cá nhân',
        inflow: Number(inflow._sum.amount ?? 0),
        outflow: Number(outflow._sum.amount ?? 0),
        balance: Number(inflow._sum.amount ?? 0) - Number(outflow._sum.amount ?? 0),
      };
    }));
    return balances;
  }
}
