// APG Manager RMS - Finance Service (tài chính, đối soát, công nợ)
import { BadRequestException, Injectable } from '@nestjs/common';
import { CashFlowSourceType, FundAccount } from '@prisma/client';
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
import { FinancialLedgerService } from './financial-ledger.service';
import { TxnDedupe } from './txn-type.util';

const DASHBOARD_BOOKING_STATUSES = ['ISSUED', 'COMPLETED'] as const;
const ACTIVE_LEDGER_STATUSES = ['ACTIVE', 'PARTIAL_PAID', 'OVERDUE'] as const;

@Injectable()
export class FinanceService {
  constructor(
    private prisma: PrismaService,
    private n8n: N8nService,
    private cashflow: CashFlowService,
    private financialLedger: FinancialLedgerService,
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
      commissionIncomeMonth,
      partnerPayoutMonth,
      opexMonth,
    ] = await this.prisma.$transaction([
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
      // Hoa hồng NHẬN từ hãng (dồn tích) trong tháng — vào net lãi
      this.prisma.commissionRecord.aggregate({
        where: { kind: 'AIRLINE_INCOME', status: { not: 'CANCELLED' }, occurredAt: { gte: startOfMonth, lt: endOfDay } },
        _sum: { amount: true },
      }),
      // Hoa hồng TRẢ đối tác trong tháng — trừ khỏi net lãi
      this.prisma.commissionRecord.aggregate({
        where: { kind: 'PARTNER_PAYOUT', status: { not: 'CANCELLED' }, occurredAt: { gte: startOfMonth, lt: endOfDay } },
        _sum: { amount: true },
      }),
      // Chi phí vận hành trong tháng — trừ khỏi net lãi
      this.prisma.operatingExpense.aggregate({
        where: { status: 'DONE', date: { gte: startOfMonth, lt: endOfDay } },
        _sum: { amount: true },
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

    // Net lãi = lãi gộp vé (sell−net) + hoa hồng nhận từ hãng − hoa hồng trả đối tác − chi phí VP
    const grossMargin = Number(monthStats._sum.profit ?? 0);
    const commissionIncome = Number(commissionIncomeMonth._sum.amount ?? 0);
    const partnerPayout = Number(partnerPayoutMonth._sum.amount ?? 0);
    const opex = Number(opexMonth._sum.amount ?? 0);
    const netProfit = grossMargin + commissionIncome - partnerPayout - opex;

    return {
      month: {
        revenue: Number(monthStats._sum.totalSellPrice ?? 0),
        profit: grossMargin, // lãi gộp vé (giữ nguyên nghĩa cũ)
        netProfit,
        breakdown: { grossMargin, commissionIncome, partnerPayout, opex },
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
      }, tx, input.userId);

      await this.financialLedger.post({
        type: 'DEPOSIT_TOPUP',
        direction: 'OUTFLOW',
        amount: input.amount,
        occurredAt: topUpAt,
        dedupeKey: TxnDedupe.depositTopUp(sourceId),
        fundAccount,
        pic: input.pic ?? 'Finance',
        description: `Nạp deposit ${deposit.airline}`,
        reference: input.reference ?? `DEPOSIT-${deposit.airline}`,
        createdBy: input.userId,
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
