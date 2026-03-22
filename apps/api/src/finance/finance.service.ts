// APG Manager RMS - Finance Service (tài chính, đối soát, công nợ)
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { N8nService } from '../automation/n8n.service';

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private n8n: N8nService,
  ) {}

  // Tổng quan tài chính realtime
  async getDashboard() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [monthStats, dayStats, deposits, activeDebts] = await Promise.all([
      // Thống kê tháng
      this.prisma.booking.aggregate({
        where: {
          status: { in: ['ISSUED', 'COMPLETED'] },
          createdAt: { gte: startOfMonth },
        },
        _sum: { totalSellPrice: true, profit: true },
        _count: true,
      }),
      // Thống kê ngày
      this.prisma.booking.aggregate({
        where: {
          status: { in: ['ISSUED', 'COMPLETED'] },
          createdAt: { gte: startOfDay },
        },
        _sum: { totalSellPrice: true, profit: true },
        _count: true,
      }),
      // Số dư deposit
      this.prisma.airlineDeposit.findMany(),
      // Tổng công nợ active
      this.prisma.debt.aggregate({
        where: { status: { in: ['ACTIVE', 'OVERDUE', 'PARTIAL_PAID'] } },
        _sum: { remaining: true },
        _count: true,
      }),
    ]);

    return {
      month: {
        revenue: Number(monthStats._sum.totalSellPrice ?? 0),
        profit: Number(monthStats._sum.profit ?? 0),
        bookings: monthStats._count,
      },
      today: {
        revenue: Number(dayStats._sum.totalSellPrice ?? 0),
        profit: Number(dayStats._sum.profit ?? 0),
        bookings: dayStats._count,
      },
      deposits: deposits.map(d => ({
        airline: d.airline,
        balance: Number(d.balance),
        alertThreshold: Number(d.alertThreshold),
        isLow: Number(d.balance) < Number(d.alertThreshold),
      })),
      debt: {
        total: Number(activeDebts._sum.remaining ?? 0),
        count: activeDebts._count,
      },
    };
  }

  // Danh sách công nợ
  async getDebts(params: { page?: number; pageSize?: number; status?: string }) {
    const { page = 1, pageSize = 20, status } = params;

    const where = status ? { status: status as Prisma.EnumDebtStatusFilter } : {};

    const [data, total] = await Promise.all([
      this.prisma.debt.findMany({
        where,
        include: {
          customer: { select: { id: true, fullName: true, phone: true, type: true } },
        },
        orderBy: { dueDate: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.debt.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  // Báo cáo aging công nợ (0-30, 30-60, 60-90, >90 ngày)
  async getDebtAging() {
    const now = new Date();
    const debts = await this.prisma.debt.findMany({
      where: { status: { in: ['ACTIVE', 'OVERDUE', 'PARTIAL_PAID'] } },
    });

    const buckets: Record<string, number> = { 'Chưa đến hạn': 0, '0-30': 0, '30-60': 0, '60-90': 0, '>90': 0 };

    debts.forEach(debt => {
      const days = Math.floor(
        (now.getTime() - new Date(debt.dueDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      const remaining = Number(debt.remaining);

      if (days <= 0) buckets['Chưa đến hạn'] += remaining;
      else if (days <= 30) buckets['0-30'] += remaining;
      else if (days <= 60) buckets['30-60'] += remaining;
      else if (days <= 90) buckets['60-90'] += remaining;
      else buckets['>90'] += remaining;
    });

    return buckets;
  }

  // Lấy số dư deposit các hãng
  async getDeposits() {
    return this.prisma.airlineDeposit.findMany();
  }

  // Nạp tiền / cập nhật deposit
  async updateDeposit(id: string, amount: number, notes?: string) {
    const deposit = await this.prisma.airlineDeposit.findUnique({ where: { id } });
    if (!deposit) return null;

    return this.prisma.airlineDeposit.update({
      where: { id },
      data: {
        balance: { increment: amount },
        lastTopUp: amount,
        lastTopUpAt: new Date(),
        notes,
      },
    });
  }

  // Chạy đối soát ngày
  async runReconciliation(date: Date) {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        booking: {
          issuedAt: { gte: startOfDay, lt: endOfDay },
          status: { in: ['ISSUED', 'COMPLETED'] },
        },
      },
      include: { booking: true },
    });

    const stats = tickets.reduce(
      (acc, t) => ({
        totalTickets: acc.totalTickets + 1,
        totalRevenue: acc.totalRevenue + Number(t.sellPrice),
        totalCost: acc.totalCost + Number(t.netPrice) + Number(t.tax),
        totalProfit: acc.totalProfit + Number(t.profit),
      }),
      { totalTickets: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0 },
    );

    // Lưu kết quả đối soát
    const reconciliation = await this.prisma.dailyReconciliation.upsert({
      where: { date: startOfDay },
      create: { date: startOfDay, ...stats },
      update: stats,
    });

    // Gửi báo cáo qua Telegram
    await this.n8n.sendDailyReport({ date: startOfDay.toISOString(), ...stats });

    return reconciliation;
  }
}
