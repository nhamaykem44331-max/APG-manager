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
exports.CustomersService = exports.ListCustomersDto = exports.CreateCustomerDto = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const client_1 = require("@prisma/client");
class CreateCustomerDto {
}
exports.CreateCustomerDto = CreateCustomerDto;
class ListCustomersDto {
}
exports.ListCustomersDto = ListCustomersDto;
let CustomersService = class CustomersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByPhone(phone) {
        return this.prisma.customer.findUnique({ where: { phone } });
    }
    async findAll(dto) {
        const { page = 1, pageSize = 20, search, type, vipTier } = dto;
        const where = {};
        if (type)
            where.type = type;
        if (vipTier)
            where.vipTier = vipTier;
        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
                { email: { contains: search, mode: 'insensitive' } },
                { companyName: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [data, total] = await Promise.all([
            this.prisma.customer.findMany({
                where,
                orderBy: [{ totalSpent: 'desc' }, { createdAt: 'desc' }],
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.customer.count({ where }),
        ]);
        return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
    }
    async findOne(id) {
        const customer = await this.prisma.customer.findUnique({
            where: { id },
            include: {
                bookings: {
                    orderBy: { createdAt: 'desc' },
                    take: 20,
                    include: { tickets: { take: 1 } },
                },
                debts: { where: { status: { in: ['ACTIVE', 'OVERDUE', 'PARTIAL_PAID'] } } },
            },
        });
        if (!customer)
            throw new common_1.NotFoundException(`Không tìm thấy khách hàng ID: ${id}`);
        return customer;
    }
    async create(dto) {
        const existing = await this.prisma.customer.findUnique({
            where: { phone: dto.phone },
        });
        if (existing) {
            throw new common_1.ConflictException(`Số điện thoại ${dto.phone} đã được đăng ký cho khách: ${existing.fullName}`);
        }
        return this.prisma.customer.create({ data: dto });
    }
    async update(id, data) {
        await this.findOne(id);
        return this.prisma.customer.update({ where: { id }, data });
    }
    async getStats(id) {
        const customer = await this.findOne(id);
        const bookings = await this.prisma.booking.findMany({
            where: { customerId: id, status: { in: ['ISSUED', 'COMPLETED'] } },
            include: { tickets: true },
        });
        const routeCount = {};
        bookings.forEach(b => {
            b.tickets.forEach(t => {
                const route = `${t.departureCode}-${t.arrivalCode}`;
                routeCount[route] = (routeCount[route] ?? 0) + 1;
            });
        });
        const topRoutes = Object.entries(routeCount)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([route, count]) => ({ route, count }));
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        const yearlyBookings = bookings.filter(b => new Date(b.createdAt) >= startOfYear);
        const yearlySpend = yearlyBookings.reduce((sum, b) => sum + Number(b.totalSellPrice), 0);
        return {
            totalBookings: customer.totalBookings,
            totalSpent: customer.totalSpent,
            yearlySpend,
            vipTier: customer.vipTier,
            topRoutes,
            lastBookingDate: bookings[0]?.createdAt ?? null,
            averageTicketValue: bookings.length > 0
                ? Number(customer.totalSpent) / bookings.length
                : 0,
        };
    }
    async recalculateVipTier(customerId) {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        const result = await this.prisma.booking.aggregate({
            where: {
                customerId,
                status: { in: ['ISSUED', 'COMPLETED'] },
                createdAt: { gte: startOfYear },
            },
            _sum: { totalSellPrice: true },
        });
        const yearSpent = Number(result._sum.totalSellPrice ?? 0);
        let tier;
        if (yearSpent >= 200_000_000)
            tier = client_1.VipTier.PLATINUM;
        else if (yearSpent >= 50_000_000)
            tier = client_1.VipTier.GOLD;
        else if (yearSpent >= 10_000_000)
            tier = client_1.VipTier.SILVER;
        else
            tier = client_1.VipTier.NORMAL;
        await this.prisma.customer.update({
            where: { id: customerId },
            data: { vipTier: tier },
        });
        return tier;
    }
    async getUpcomingBirthdays() {
        const customers = await this.prisma.customer.findMany({
            where: { dateOfBirth: { not: null } },
            select: { id: true, fullName: true, phone: true, dateOfBirth: true, vipTier: true },
        });
        const today = new Date();
        const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        return customers.filter(c => {
            if (!c.dateOfBirth)
                return false;
            const bday = new Date(c.dateOfBirth);
            const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
            return thisYearBday >= today && thisYearBday <= sevenDaysLater;
        });
    }
};
exports.CustomersService = CustomersService;
exports.CustomersService = CustomersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CustomersService);
//# sourceMappingURL=customers.service.js.map