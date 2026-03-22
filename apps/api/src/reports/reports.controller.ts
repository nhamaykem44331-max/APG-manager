// APG Manager RMS - Reports Controller
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  // GET /reports/daily - Báo cáo ngày (KPI Dashboard)
  @Get('daily')
  async getDaily() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);

    const [today, yesterday] = await Promise.all([
      this.prisma.booking.aggregate({
        where: { status: { in: ['ISSUED', 'COMPLETED'] }, createdAt: { gte: todayStart } },
        _sum: { totalSellPrice: true, profit: true },
        _count: { id: true },
      }),
      this.prisma.booking.aggregate({
        where: {
          status: { in: ['ISSUED', 'COMPLETED'] },
          createdAt: { gte: yesterdayStart, lt: todayStart },
        },
        _sum: { totalSellPrice: true, profit: true },
        _count: { id: true },
      }),
    ]);

    const pendingCount = await this.prisma.booking.count({
      where: { status: { in: ['NEW', 'PROCESSING', 'QUOTED', 'PENDING_PAYMENT'] } },
    });

    const calcChange = (curr: number, prev: number) =>
      prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100);

    const todayTickets = today._count.id;
    const todayRevenue = Number(today._sum.totalSellPrice ?? 0);
    const todayProfit = Number(today._sum.profit ?? 0);
    const yestTickets = yesterday._count.id;
    const yestRevenue = Number(yesterday._sum.totalSellPrice ?? 0);
    const yestProfit = Number(yesterday._sum.profit ?? 0);

    return {
      ticketsToday: todayTickets,
      ticketsTodayChange: calcChange(todayTickets, yestTickets),
      revenueToday: todayRevenue,
      revenueTodayChange: calcChange(todayRevenue, yestRevenue),
      profitToday: todayProfit,
      profitTodayChange: calcChange(todayProfit, yestProfit),
      pendingBookings: pendingCount,
    };
  }

  // GET /reports/revenue-chart - Biểu đồ doanh thu 7 ngày (Tối ưu N+1 query)
  @Get('revenue-chart')
  async getRevenueChart(@Query('days') daysString = '7') {
    const days = parseInt(daysString, 10) || 7;
    const result = [];
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);

    // Lấy tất cả booking trong khoảng thời gian bằng 1 query
    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: ['ISSUED', 'COMPLETED'] },
        createdAt: { gte: startDate },
      },
      select: { createdAt: true, totalSellPrice: true, profit: true },
    });

    // Gom nhóm trên bộ nhớ
    const grouped = bookings.reduce((acc, b) => {
      const dateStr = b.createdAt.toLocaleDateString('vi-VN', { weekday: 'short', month: 'numeric', day: 'numeric' });
      if (!acc[dateStr]) acc[dateStr] = { revenue: 0, profit: 0, tickets: 0 };
      acc[dateStr].revenue += Number(b.totalSellPrice);
      acc[dateStr].profit += Number(b.profit);
      acc[dateStr].tickets += 1;
      return acc;
    }, {} as Record<string, { revenue: number; profit: number; tickets: number }>);

    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const dateStr = day.toLocaleDateString('vi-VN', { weekday: 'short', month: 'numeric', day: 'numeric' });
      result.push({
        date: dateStr,
        revenue: grouped[dateStr]?.revenue || 0,
        profit: grouped[dateStr]?.profit || 0,
        tickets: grouped[dateStr]?.tickets || 0,
      });
    }

    return result;
  }

  // GET /reports/kpi - KPI team
  @Get('kpi')
  async getKpi() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const staffStats = await this.prisma.booking.groupBy({
      by: ['staffId'],
      where: {
        status: { in: ['ISSUED', 'COMPLETED'] },
        createdAt: { gte: startOfMonth },
      },
      _sum: { totalSellPrice: true, profit: true },
      _count: { id: true },
      orderBy: { _sum: { totalSellPrice: 'desc' } },
    });

    const staffIds = staffStats.map(s => s.staffId);
    const staffUsers = await this.prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, fullName: true },
    });

    const staffMap = Object.fromEntries(staffUsers.map(u => [u.id, u.fullName]));

    return staffStats.map(s => ({
      staffId: s.staffId,
      staffName: staffMap[s.staffId] ?? 'Unknown',
      totalRevenue: Number(s._sum.totalSellPrice ?? 0),
      totalProfit: Number(s._sum.profit ?? 0),
      totalBookings: s._count.id,
    }));
  }
}
