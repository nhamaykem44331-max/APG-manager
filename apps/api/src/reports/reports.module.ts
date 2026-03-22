// APG Manager RMS - Reports Module
import { Module, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
class ReportsController {
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

    // Tính % thay đổi
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

  // GET /reports/revenue-chart - Biểu đồ doanh thu 7 ngày
  @Get('revenue-chart')
  async getRevenueChart(@Query('days') days = 7) {
    const result = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const nextDay = new Date(day.getTime() + 86400000);

      const stats = await this.prisma.booking.aggregate({
        where: {
          status: { in: ['ISSUED', 'COMPLETED'] },
          createdAt: { gte: day, lt: nextDay },
        },
        _sum: { totalSellPrice: true, profit: true },
        _count: { id: true },
      });

      result.push({
        date: day.toLocaleDateString('vi-VN', { weekday: 'short' }),
        revenue: Number(stats._sum.totalSellPrice ?? 0),
        profit: Number(stats._sum.profit ?? 0),
        tickets: stats._count.id,
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

    // Lấy tên nhân viên
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

@Module({
  controllers: [ReportsController],
})
export class ReportsModule {}
