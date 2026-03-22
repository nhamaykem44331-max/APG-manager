"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsModule = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../common/guards/jwt-auth.guard");
const prisma_service_1 = require("../common/prisma.service");
let ReportsController = class ReportsController {
    constructor(prisma) {
        this.prisma = prisma;
    }
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
        const calcChange = (curr, prev) => prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100);
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
    async getRevenueChart(days = 7) {
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
};
__decorate([
    (0, common_1.Get)('daily'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getDaily", null);
__decorate([
    (0, common_1.Get)('revenue-chart'),
    __param(0, (0, common_1.Query)('days')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getRevenueChart", null);
__decorate([
    (0, common_1.Get)('kpi'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ReportsController.prototype, "getKpi", null);
ReportsController = __decorate([
    (0, common_1.Controller)('reports'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportsController);
let ReportsModule = class ReportsModule {
};
exports.ReportsModule = ReportsModule;
exports.ReportsModule = ReportsModule = __decorate([
    (0, common_1.Module)({
        controllers: [ReportsController],
    })
], ReportsModule);
//# sourceMappingURL=reports.module.js.map