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
exports.CustomerIntelligenceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
let CustomerIntelligenceService = class CustomerIntelligenceService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getRfmScore(customerId) {
        const customer = await this.prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                bookings: {
                    where: { status: { in: ['ISSUED', 'COMPLETED'] } },
                    orderBy: { createdAt: 'desc' },
                    select: { createdAt: true, totalSellPrice: true },
                },
            },
        });
        if (!customer)
            throw new Error(`Không tìm thấy khách hàng ID: ${customerId}`);
        const now = new Date();
        const bookings = customer.bookings;
        const lastBookingDays = bookings.length > 0
            ? Math.floor((now.getTime() - new Date(bookings[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
            : 999;
        const totalBookings = bookings.length;
        const totalSpent = Number(customer.totalSpent);
        const recency = lastBookingDays <= 30 ? 5 : lastBookingDays <= 60 ? 4 : lastBookingDays <= 120 ? 3 : lastBookingDays <= 365 ? 2 : 1;
        const frequency = totalBookings >= 20 ? 5 : totalBookings >= 10 ? 4 : totalBookings >= 5 ? 3 : totalBookings >= 2 ? 2 : 1;
        const monetary = totalSpent >= 200_000_000 ? 5 : totalSpent >= 50_000_000 ? 4 : totalSpent >= 10_000_000 ? 3 : totalSpent >= 3_000_000 ? 2 : 1;
        const totalScore = recency + frequency + monetary;
        const segment = this.classifySegment(recency, frequency, monetary);
        const churnRisk = this.calculateChurnRisk(lastBookingDays, totalBookings);
        return {
            customerId,
            customerName: customer.fullName,
            recency,
            frequency,
            monetary,
            totalScore,
            segment,
            lastBookingDays,
            churnRisk,
        };
    }
    async getSegments() {
        const customers = await this.prisma.customer.findMany({
            include: {
                bookings: {
                    where: { status: { in: ['ISSUED', 'COMPLETED'] } },
                    orderBy: { createdAt: 'desc' },
                    select: { createdAt: true, totalSellPrice: true },
                },
            },
        });
        const segments = {
            CHAMPION: { count: 0, revenue: 0, customers: [] },
            LOYAL: { count: 0, revenue: 0, customers: [] },
            POTENTIAL: { count: 0, revenue: 0, customers: [] },
            NEW: { count: 0, revenue: 0, customers: [] },
            AT_RISK: { count: 0, revenue: 0, customers: [] },
            LOST: { count: 0, revenue: 0, customers: [] },
            REGULAR: { count: 0, revenue: 0, customers: [] },
        };
        const now = new Date();
        for (const customer of customers) {
            const bookings = customer.bookings;
            const lastBookingDays = bookings.length > 0
                ? Math.floor((now.getTime() - new Date(bookings[0].createdAt).getTime()) / (1000 * 60 * 60 * 24))
                : 999;
            const totalSpent = Number(customer.totalSpent);
            const totalBookings = bookings.length;
            const r = lastBookingDays <= 30 ? 5 : lastBookingDays <= 60 ? 4 : lastBookingDays <= 120 ? 3 : lastBookingDays <= 365 ? 2 : 1;
            const f = totalBookings >= 20 ? 5 : totalBookings >= 10 ? 4 : totalBookings >= 5 ? 3 : totalBookings >= 2 ? 2 : 1;
            const m = totalSpent >= 200_000_000 ? 5 : totalSpent >= 50_000_000 ? 4 : totalSpent >= 10_000_000 ? 3 : totalSpent >= 3_000_000 ? 2 : 1;
            const segment = this.classifySegment(r, f, m);
            segments[segment].count += 1;
            segments[segment].revenue += totalSpent;
            segments[segment].customers.push({
                id: customer.id,
                fullName: customer.fullName,
                phone: customer.phone,
                vipTier: customer.vipTier,
                totalSpent,
                totalBookings,
                lastBookingDays,
            });
        }
        return segments;
    }
    async getAtRiskCustomers() {
        const segments = await this.getSegments();
        return [
            ...segments.AT_RISK.customers,
            ...segments.LOST.customers,
        ];
    }
    async getTodayFollowUps() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        return this.prisma.customerInteraction.findMany({
            where: {
                followUpAt: { gte: today, lt: tomorrow },
            },
            include: {
                customer: { select: { id: true, fullName: true, phone: true, vipTier: true } },
                staff: { select: { id: true, fullName: true } },
            },
            orderBy: { followUpAt: 'asc' },
        });
    }
    async getCustomerTimeline(customerId) {
        const [bookings, interactions, communications] = await Promise.all([
            this.prisma.booking.findMany({
                where: { customerId },
                orderBy: { createdAt: 'desc' },
                take: 50,
                select: {
                    id: true, bookingCode: true, status: true,
                    totalSellPrice: true, source: true, createdAt: true,
                    tickets: { take: 1, select: { departureCode: true, arrivalCode: true } },
                },
            }),
            this.prisma.customerInteraction.findMany({
                where: { customerId },
                orderBy: { createdAt: 'desc' },
                take: 50,
                include: { staff: { select: { fullName: true } } },
            }),
            this.prisma.communicationLog.findMany({
                where: { customerId },
                orderBy: { createdAt: 'desc' },
                take: 50,
            }),
        ]);
        const timeline = [
            ...bookings.map(b => ({
                type: 'BOOKING',
                date: b.createdAt,
                data: b,
            })),
            ...interactions.map(i => ({
                type: 'INTERACTION',
                date: i.createdAt,
                data: i,
            })),
            ...communications.map(c => ({
                type: 'COMMUNICATION',
                date: c.createdAt,
                data: c,
            })),
        ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return timeline.slice(0, 50);
    }
    classifySegment(r, f, m) {
        if (r >= 4 && f >= 4 && m >= 4)
            return 'CHAMPION';
        if (r >= 3 && f >= 3 && m >= 3)
            return 'LOYAL';
        if (r >= 4 && f <= 2 && m <= 2)
            return 'POTENTIAL';
        if (r >= 4 && f === 1)
            return 'NEW';
        if (r <= 2 && f >= 2)
            return 'AT_RISK';
        if (r === 1 && f === 1)
            return 'LOST';
        return 'REGULAR';
    }
    calculateChurnRisk(lastBookingDays, totalBookings) {
        if (lastBookingDays > 180 || (totalBookings > 3 && lastBookingDays > 90))
            return 'HIGH';
        if (lastBookingDays > 60)
            return 'MEDIUM';
        return 'LOW';
    }
};
exports.CustomerIntelligenceService = CustomerIntelligenceService;
exports.CustomerIntelligenceService = CustomerIntelligenceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomerIntelligenceService);
//# sourceMappingURL=customer-intelligence.service.js.map