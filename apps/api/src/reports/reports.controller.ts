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

  // 1a. GET /reports/monthly-summary?months=6
  @Get('monthly-summary')
  async getMonthlySummary(@Query('months') monthsStr = '6') {
    const monthsFilter = parseInt(monthsStr, 10) || 6;
    const now = new Date();
    // Start date is the first day of the month `monthsFilter - 1` months ago
    const startDate = new Date(now.getFullYear(), now.getMonth() - monthsFilter + 1, 1);

    const bookings = await this.prisma.booking.findMany({
      where: {
        status: { in: ['ISSUED', 'COMPLETED'] },
        createdAt: { gte: startDate },
      },
      include: {
        _count: { select: { tickets: true } }
      }
    });

    const grouped = bookings.reduce((acc, b) => {
      const monthKey = `T${b.createdAt.getMonth() + 1}/${b.createdAt.getFullYear()}`;
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthKey,
          revenue: 0, cost: 0, profit: 0,
          bookingCount: 0, ticketCount: 0,
          dateValue: new Date(b.createdAt.getFullYear(), b.createdAt.getMonth(), 1) // for sorting
        };
      }
      acc[monthKey].revenue += Number(b.totalSellPrice || 0);
      acc[monthKey].cost += Number(b.totalNetPrice || 0);
      acc[monthKey].profit += Number(b.profit || 0);
      acc[monthKey].bookingCount += 1;
      acc[monthKey].ticketCount += b._count.tickets || 0;
      return acc;
    }, {} as Record<string, any>);

    return Object.values(grouped).sort((a: any, b: any) => a.dateValue.getTime() - b.dateValue.getTime()).map((item: any) => ({
      month: item.month,
      revenue: item.revenue,
      cost: item.cost,
      profit: item.profit,
      profitMargin: item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0,
      bookingCount: item.bookingCount,
      ticketCount: item.ticketCount,
      avgTicketValue: item.ticketCount > 0 ? item.revenue / item.ticketCount : 0
    }));
  }

  // 1b. GET /reports/airline-breakdown
  @Get('airline-breakdown')
  async getAirlineBreakdown(@Query('from') fromStr?: string, @Query('to') toStr?: string) {
    const whereCondition: any = {
      booking: { status: { in: ['ISSUED', 'COMPLETED'] } }
    };
    if (fromStr) whereCondition.booking.createdAt = { ...whereCondition.booking.createdAt, gte: new Date(fromStr) };
    if (toStr) whereCondition.booking.createdAt = { ...whereCondition.booking.createdAt, lte: new Date(toStr) };

    const grouped = await this.prisma.ticket.groupBy({
      by: ['airline'],
      where: whereCondition,
      _count: { id: true },
      _sum: { sellPrice: true, netPrice: true, profit: true },
      orderBy: { _sum: { sellPrice: 'desc' } }
    });

    const totalRevenue = grouped.reduce((sum, g) => sum + Number(g._sum.sellPrice || 0), 0);

    return grouped.map(g => {
      const rev = Number(g._sum.sellPrice || 0);
      return {
        airline: g.airline,
        ticketCount: g._count.id,
        revenue: rev,
        cost: Number(g._sum.netPrice || 0),
        profit: Number(g._sum.profit || 0),
        profitMargin: rev > 0 ? (Number(g._sum.profit || 0) / rev) * 100 : 0,
        percentage: totalRevenue > 0 ? (rev / totalRevenue) * 100 : 0
      };
    });
  }

  // 1c. GET /reports/route-analysis
  @Get('route-analysis')
  async getRouteAnalysis(@Query('from') from?: string, @Query('to') to?: string, @Query('limit') limit = '20') {
    const whereCond: any = { booking: { status: { in: ['ISSUED', 'COMPLETED'] } } };
    if (from) whereCond.booking.createdAt = { ...whereCond.booking.createdAt, gte: new Date(from) };
    if (to) whereCond.booking.createdAt = { ...whereCond.booking.createdAt, lte: new Date(to) };

    const tickets = await this.prisma.ticket.findMany({
      where: whereCond,
      select: { departureCode: true, arrivalCode: true, sellPrice: true, profit: true, airline: true }
    });

    const routeMap = tickets.reduce((acc, t) => {
      if (!t.departureCode || !t.arrivalCode) return acc;
      const rKey = `${t.departureCode}-${t.arrivalCode}`;
      if (!acc[rKey]) acc[rKey] = {
        route: rKey, departureCode: t.departureCode, arrivalCode: t.arrivalCode,
        ticketCount: 0, revenue: 0, profit: 0, airlines: {} as Record<string, number>
      };
      
      acc[rKey].ticketCount += 1;
      acc[rKey].revenue += Number(t.sellPrice || 0);
      acc[rKey].profit += Number(t.profit || 0);
      acc[rKey].airlines[t.airline || 'OTHER'] = (acc[rKey].airlines[t.airline || 'OTHER'] || 0) + 1;
      return acc;
    }, {} as Record<string, any>);

    const arr = Object.values(routeMap).map((r: any) => {
      const topAirline = Object.entries(r.airlines).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A';
      return {
        route: r.route,
        departureCode: r.departureCode,
        arrivalCode: r.arrivalCode,
        ticketCount: r.ticketCount,
        revenue: r.revenue,
        profit: r.profit,
        avgPrice: r.ticketCount > 0 ? r.revenue / r.ticketCount : 0,
        topAirline
      };
    }).sort((a: any, b: any) => b.ticketCount - a.ticketCount);

    return arr.slice(0, parseInt(limit, 10) || 20);
  }

  // 1d. GET /reports/source-analysis
  @Get('source-analysis')
  async getSourceAnalysis(@Query('from') from?: string, @Query('to') to?: string) {
    const whereCond: any = {};
    if (from || to) {
      whereCond.createdAt = {};
      if (from) whereCond.createdAt.gte = new Date(from);
      if (to) whereCond.createdAt.lte = new Date(to);
    }

    const allBookings = await this.prisma.booking.groupBy({
      by: ['source'],
      where: whereCond,
      _count: { id: true }
    });

    const successBookings = await this.prisma.booking.groupBy({
      by: ['source'],
      where: { ...whereCond, status: { in: ['ISSUED', 'COMPLETED'] } },
      _count: { id: true },
      _sum: { totalSellPrice: true, profit: true }
    });

    const totalMap = Object.fromEntries(allBookings.map(b => [b.source, b._count.id]));

    return successBookings.map(b => {
      const totalInSource = totalMap[b.source] || 0;
      const successCount = b._count.id;
      return {
        source: b.source || 'UNKNOWN',
        bookingCount: successCount,
        revenue: Number(b._sum.totalSellPrice || 0),
        profit: Number(b._sum.profit || 0),
        conversionRate: totalInSource > 0 ? (successCount / totalInSource) * 100 : 0,
        avgValue: successCount > 0 ? Number(b._sum.totalSellPrice || 0) / successCount : 0
      };
    });
  }

  // 1e. GET /reports/staff-performance
  @Get('staff-performance')
  async getStaffPerformance(@Query('from') from?: string, @Query('to') to?: string) {
    const whereCond: any = {};
    if (from || to) {
      whereCond.createdAt = {};
      if (from) whereCond.createdAt.gte = new Date(from);
      if (to) whereCond.createdAt.lte = new Date(to);
    }

    // Lấy count tổng để tính conversion params
    const allBookingsCount = await this.prisma.booking.groupBy({
      by: ['staffId'],
      where: whereCond,
      _count: { id: true }
    });

    const successBookings = await this.prisma.booking.findMany({
      where: { ...whereCond, status: { in: ['ISSUED', 'COMPLETED'] } },
      include: {
        tickets: { select: { airline: true, departureCode: true, arrivalCode: true } }
      }
    });

    const staffMap = successBookings.reduce((acc, b) => {
      if (!acc[b.staffId]) {
        acc[b.staffId] = {
          successCount: 0, ticketCount: 0, revenue: 0, profit: 0,
          airlines: {} as Record<string, number>,
          routes: {} as Record<string, number>
        };
      }
      const st = acc[b.staffId];
      st.successCount += 1;
      st.revenue += Number(b.totalSellPrice || 0);
      st.profit += Number(b.profit || 0);

      b.tickets.forEach(t => {
        st.ticketCount += 1;
        if (t.airline) st.airlines[t.airline] = (st.airlines[t.airline] || 0) + 1;
        if (t.departureCode && t.arrivalCode) {
          const rKey = `${t.departureCode}-${t.arrivalCode}`;
          st.routes[rKey] = (st.routes[rKey] || 0) + 1;
        }
      });
      return acc;
    }, {} as Record<string, any>);

    const staffIds = [
      ...new Set([...allBookingsCount.map(s => s.staffId), ...Object.keys(staffMap)])
    ];
    
    const users = await this.prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, fullName: true, role: true }
    });

    const totalCountMap = Object.fromEntries(allBookingsCount.map(s => [s.staffId, s._count.id]));

    return users.map(u => {
      const st = staffMap[u.id] || { successCount: 0, ticketCount: 0, revenue: 0, profit: 0, airlines: {}, routes: {} };
      const totalBookings = totalCountMap[u.id] || 0;
      
      const topAirline = Object.entries(st.airlines).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A';
      const topRoute = Object.entries(st.routes).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'N/A';

      return {
        staffId: u.id,
        staffName: u.fullName,
        role: u.role,
        bookingCount: st.successCount,
        ticketCount: st.ticketCount,
        revenue: st.revenue,
        profit: st.profit,
        profitMargin: st.revenue > 0 ? (st.profit / st.revenue) * 100 : 0,
        avgBookingValue: st.successCount > 0 ? st.revenue / st.successCount : 0,
        conversionRate: totalBookings > 0 ? (st.successCount / totalBookings) * 100 : 0,
        topAirline,
        topRoute
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }

  // 1f. GET /reports/customer-ranking
  @Get('customer-ranking')
  async getCustomerRanking(@Query('from') from?: string, @Query('to') to?: string, @Query('limit') limit = '20') {
    const whereCond: any = { status: { in: ['ISSUED', 'COMPLETED'] } };
    if (from || to) {
      whereCond.createdAt = {};
      if (from) whereCond.createdAt.gte = new Date(from);
      if (to) whereCond.createdAt.lte = new Date(to);
    }

    const rank = await this.prisma.booking.groupBy({
      by: ['customerId'],
      where: whereCond,
      _count: { id: true },
      _sum: { totalSellPrice: true, profit: true },
      _max: { createdAt: true },
      orderBy: { _sum: { totalSellPrice: 'desc' } },
      take: parseInt(limit, 10) || 20
    });

    const customerIds = rank.map(r => r.customerId);
    const customers = await this.prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, fullName: true, companyName: true, type: true, vipTier: true },
    });
    
    // This assumes we can just get total tickets easily by grouping by bookingId and mapping it. 
    // Faster way: findMany tickets where bookingId in (bookings of these customers). Since we want tickets per customer:
    const custTicketCounts = await this.prisma.ticket.findMany({
      where: { booking: { customerId: { in: customerIds }, status: { in: ['ISSUED', 'COMPLETED'] } } },
      select: { id: true, booking: { select: { customerId: true } } }
    });
    const ticketCountMap = custTicketCounts.reduce((acc, t) => {
      acc[t.booking.customerId] = (acc[t.booking.customerId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const cmap = Object.fromEntries(customers.map(c => [c.id, c]));

    return rank.map(r => {
      const c = cmap[r.customerId];
      return {
        customerId: r.customerId,
        customerName: c?.type === 'CORPORATE' ? c.companyName || c.fullName : c?.fullName || 'Unknown',
        customerType: c?.type || 'INDIVIDUAL',
        vipTier: c?.vipTier || 'NORMAL',
        bookingCount: r._count.id,
        ticketCount: ticketCountMap[r.customerId] || 0,
        totalSpent: Number(r._sum.totalSellPrice || 0),
        profit: Number(r._sum.profit || 0),
        lastBookingDate: r._max.createdAt
      };
    });
  }

  // 1g. GET /reports/payment-analysis
  @Get('payment-analysis')
  async getPaymentAnalysis(@Query('from') from?: string, @Query('to') to?: string) {
    const whereCond: any = { status: { in: ['ISSUED', 'COMPLETED'] } };
    if (from || to) {
      whereCond.createdAt = {};
      if (from) whereCond.createdAt.gte = new Date(from);
      if (to) whereCond.createdAt.lte = new Date(to);
    }

    const payStats = await this.prisma.booking.groupBy({
      by: ['paymentMethod'],
      where: whereCond,
      _count: { id: true },
      _sum: { totalSellPrice: true }
    });

    const totalPaidSum = await this.prisma.booking.aggregate({
      where: { ...whereCond, paymentStatus: 'PAID' },
      _sum: { totalSellPrice: true }
    });

    const totalAllSum = payStats.reduce((sum, p) => sum + Number(p._sum.totalSellPrice || 0), 0);
    const totalPaid = Number(totalPaidSum._sum.totalSellPrice || 0);
    const totalUnpaid = totalAllSum - totalPaid;

    const debts = await this.prisma.debt.aggregate({
      where: { status: { not: 'PAID' } },
      _sum: { remaining: true }
    });

    const methods = payStats.map(p => ({
      method: p.paymentMethod || 'UNKNOWN',
      transactionCount: p._count.id,
      totalAmount: Number(p._sum.totalSellPrice || 0),
      percentage: totalAllSum > 0 ? (Number(p._sum.totalSellPrice || 0) / totalAllSum) * 100 : 0
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      totalPaid,
      totalUnpaid,
      totalDebt: Number(debts._sum.remaining || 0),
      collectionRate: totalAllSum > 0 ? (totalPaid / totalAllSum) * 100 : 0,
      methods
    };
  }
}
