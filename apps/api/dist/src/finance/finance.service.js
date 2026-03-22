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
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinanceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const n8n_service_1 = require("../automation/n8n.service");
let FinanceService = class FinanceService {
    constructor(prisma, n8n) {
        this.prisma = prisma;
        this.n8n = n8n;
    }
    async getDashboard() {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const [monthStats, dayStats, deposits, activeDebts] = await Promise.all([
            this.prisma.booking.aggregate({
                where: {
                    status: { in: ['ISSUED', 'COMPLETED'] },
                    createdAt: { gte: startOfMonth },
                },
                _sum: { totalSellPrice: true, profit: true },
                _count: true,
            }),
            this.prisma.booking.aggregate({
                where: {
                    status: { in: ['ISSUED', 'COMPLETED'] },
                    createdAt: { gte: startOfDay },
                },
                _sum: { totalSellPrice: true, profit: true },
                _count: true,
            }),
            this.prisma.airlineDeposit.findMany(),
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
    async getDebts(params) {
        const { page = 1, pageSize = 20, status } = params;
        const where = status ? { status: status } : {};
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
    async getDebtAging() {
        const now = new Date();
        const debts = await this.prisma.debt.findMany({
            where: { status: { in: ['ACTIVE', 'OVERDUE', 'PARTIAL_PAID'] } },
        });
        const buckets = { '0-30': 0, '30-60': 0, '60-90': 0, '>90': 0 };
        debts.forEach(debt => {
            const days = Math.floor((now.getTime() - new Date(debt.dueDate).getTime()) / (1000 * 60 * 60 * 24));
            const remaining = Number(debt.remaining);
            if (days <= 30)
                buckets['0-30'] += remaining;
            else if (days <= 60)
                buckets['30-60'] += remaining;
            else if (days <= 90)
                buckets['60-90'] += remaining;
            else
                buckets['>90'] += remaining;
        });
        return buckets;
    }
    async getDeposits() {
        const deposits = await this.prisma.airlineDeposit.findMany();
        for (const deposit of deposits) {
            if (Number(deposit.balance) < Number(deposit.alertThreshold)) {
                await this.n8n.sendDepositAlert(deposit.airline, Number(deposit.balance));
            }
        }
        return deposits;
    }
    async updateDeposit(id, amount, notes) {
        const deposit = await this.prisma.airlineDeposit.findUnique({ where: { id } });
        if (!deposit)
            return null;
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
    async runReconciliation(date) {
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
        const stats = tickets.reduce((acc, t) => ({
            totalTickets: acc.totalTickets + 1,
            totalRevenue: acc.totalRevenue + Number(t.sellPrice),
            totalCost: acc.totalCost + Number(t.netPrice) + Number(t.tax),
            totalProfit: acc.totalProfit + Number(t.profit),
        }), { totalTickets: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0 });
        const reconciliation = await this.prisma.dailyReconciliation.upsert({
            where: { date: startOfDay },
            create: { date: startOfDay, ...stats },
            update: stats,
        });
        await this.n8n.sendDailyReport({ date: startOfDay.toISOString(), ...stats });
        return reconciliation;
    }
};
exports.FinanceService = FinanceService;
exports.FinanceService = FinanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        n8n_service_1.N8nService])
], FinanceService);
//# sourceMappingURL=finance.service.js.map