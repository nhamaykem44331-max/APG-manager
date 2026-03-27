// APG Manager RMS - Finance Service (tài chính, đối soát, công nợ)
import { BadRequestException, Injectable } from '@nestjs/common';
import { CashFlowSourceType, FundAccount, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { N8nService } from '../automation/n8n.service';
import {
  addReportDays,
  addReportMonths,
  buildBusinessDateFilter,
  getBookingBusinessDate,
  getReportMonthKey,
  getReportMonthLabel,
  getStartOfReportDay,
  getStartOfReportMonth,
} from '../common/reporting-date.util';
import { CashFlowService } from './cashflow.service';

const DASHBOARD_BOOKING_STATUSES = ['ISSUED', 'COMPLETED'] as const;
const ACTIVE_LEDGER_STATUSES = ['ACTIVE', 'PARTIAL_PAID', 'OVERDUE'] as const;

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private n8n: N8nService,
    private cashflow: CashFlowService,
  ) {}

  // Tổng quan tài chính realtime
  async getDashboard() {
    const now = new Date();
    const startOfMonth = getStartOfReportMonth(now);
    const startOfDay = getStartOfReportDay(now);
    const endOfDay = addReportDays(startOfDay, 1);
    const timelineStart = addReportMonths(startOfMonth, -5);
    const timelineEnd = addReportMonths(startOfMonth, 1);

    const [
      monthStats,
      dayStats,
      deposits,
      activeLedgerSummary,
      timelineBookings,
      monthTickets,
    ] = await Promise.all([
      // Thống kê tháng
      this.prisma.booking.aggregate({
        where: {
          deletedAt: null,
          status: { in: [...DASHBOARD_BOOKING_STATUSES] },
          ...buildBusinessDateFilter(startOfMonth, endOfDay),
        },
        _sum: { totalSellPrice: true, profit: true },
        _count: true,
      }),
      // Thống kê ngày
      this.prisma.booking.aggregate({
        where: {
          deletedAt: null,
          status: { in: [...DASHBOARD_BOOKING_STATUSES] },
          ...buildBusinessDateFilter(startOfDay, endOfDay),
        },
        _sum: { totalSellPrice: true, profit: true },
        _count: true,
      }),
      // Số dư deposit
      this.prisma.airlineDeposit.findMany(),
      // Tổng công nợ active thực tế từ ledger
      this.prisma.accountsLedger.aggregate({
        where: { status: { in: [...ACTIVE_LEDGER_STATUSES] } },
        _sum: { remaining: true },
        _count: { id: true },
      }),
      // Timeline doanh thu/lợi nhuận theo tháng
      this.prisma.booking.findMany({
        where: {
          deletedAt: null,
          status: { in: [...DASHBOARD_BOOKING_STATUSES] },
          ...buildBusinessDateFilter(timelineStart, timelineEnd),
        },
        select: {
          businessDate: true,
          createdAt: true,
          totalSellPrice: true,
          profit: true,
        },
      }),
      // Doanh thu theo hãng bay tháng hiện tại
      this.prisma.ticket.findMany({
        where: {
          status: 'ACTIVE',
          booking: {
            deletedAt: null,
            status: { in: [...DASHBOARD_BOOKING_STATUSES] },
            ...buildBusinessDateFilter(startOfMonth, endOfDay),
          },
        },
        select: {
          airline: true,
          sellPrice: true,
        },
      }),
    ]);

    const timelineSeed = new Map<string, { date: string; revenue: number; profit: number }>();
    for (let cursor = new Date(timelineStart); cursor < timelineEnd; cursor = addReportMonths(cursor, 1)) {
      const monthDate = new Date(cursor);
      timelineSeed.set(getReportMonthKey(monthDate), {
        date: getReportMonthLabel(monthDate),
        revenue: 0,
        profit: 0,
      });
    }

    for (const booking of timelineBookings) {
      const businessDate = getBookingBusinessDate(booking);
      if (!businessDate) {
        continue;
      }
      const bucket = timelineSeed.get(getReportMonthKey(businessDate));
      if (!bucket) {
        continue;
      }

      bucket.revenue += Number(booking.totalSellPrice ?? 0);
      bucket.profit += Number(booking.profit ?? 0);
    }

    const airlineRevenueMap = monthTickets.reduce((acc, ticket) => {
      const airline = ticket.airline || 'OTHER';
      acc[airline] = (acc[airline] ?? 0) + Number(ticket.sellPrice ?? 0);
      return acc;
    }, {} as Record<string, number>);

    const totalAirlineRevenue = Object.values(airlineRevenueMap).reduce((sum, value) => sum + value, 0);
    const airlines = Object.entries(airlineRevenueMap)
      .map(([airline, revenue]) => ({
        airline,
        revenue,
        pct: totalAirlineRevenue > 0 ? Math.round((revenue / totalAirlineRevenue) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

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
        total: Number(activeLedgerSummary._sum.remaining ?? 0),
        count: activeLedgerSummary._count.id,
      },
      timeline: Array.from(timelineSeed.values()),
      airlines,
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
  async updateDeposit(
    id: string,
    input: {
      amount: number;
      notes?: string;
      fundAccount?: string;
      reference?: string;
      date?: string;
      pic?: string;
      userId?: string;
    },
  ) {
    const deposit = await this.prisma.airlineDeposit.findUnique({ where: { id } });
    if (!deposit) return null;

    if (input.amount <= 0) {
      throw new BadRequestException('Sá»‘ tiá»n náº¡p deposit pháº£i lá»›n hÆ¡n 0.');
    }

    if (!input.fundAccount) {
      throw new BadRequestException('Vui lÃ²ng chá»n quá»¹ xuáº¥t tiá»n Ä‘á»ƒ náº¡p deposit.');
    }

    const fundAccount = input.fundAccount as FundAccount;
    const topUpAt = input.date ? new Date(input.date) : new Date();
    const sourceId = `deposit-topup:${id}:${topUpAt.getTime()}`;

    return this.prisma.$transaction(async (tx) => {
      const updatedDeposit = await tx.airlineDeposit.update({
        where: { id },
        data: {
          balance: { increment: input.amount },
          lastTopUp: input.amount,
          lastTopUpAt: topUpAt,
          notes: input.notes,
        },
      });

      await this.cashflow.recordSystemEntry({
        direction: 'OUTFLOW',
        category: 'AIRLINE_PAYMENT',
        amount: input.amount,
        pic: input.pic ?? 'Finance',
        description: `Náº¡p deposit ${deposit.airline}`,
        reference: input.reference ?? `DEPOSIT-${deposit.airline}`,
        date: topUpAt,
        status: 'DONE',
        notes: input.notes ?? `Deposit airline ${deposit.airline}`,
        fundAccount,
        sourceType: CashFlowSourceType.DEPOSIT_TOPUP,
        sourceId,
        isLocked: true,
      }, tx);

      return updatedDeposit;
    });
  }

  // Thêm deposit hãng bay mới (cho phép hãng quốc tế)
  async createDeposit(airline: string, alertThreshold: number) {
    return this.prisma.airlineDeposit.create({
      data: {
        airline: airline as never,
        balance: 0,
        alertThreshold,
        lastTopUp: 0,
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
