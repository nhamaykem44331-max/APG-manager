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
exports.BookingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../common/prisma.service");
const n8n_service_1 = require("../automation/n8n.service");
const STATUS_TRANSITIONS = {
    NEW: ['PROCESSING', 'CANCELLED'],
    PROCESSING: ['QUOTED', 'CANCELLED'],
    QUOTED: ['PENDING_PAYMENT', 'PROCESSING', 'CANCELLED'],
    PENDING_PAYMENT: ['ISSUED', 'CANCELLED'],
    ISSUED: ['COMPLETED', 'CHANGED', 'REFUNDED'],
    COMPLETED: [],
    CHANGED: ['ISSUED', 'REFUNDED'],
    REFUNDED: [],
    CANCELLED: [],
};
let BookingsService = class BookingsService {
    constructor(prisma, n8n) {
        this.prisma = prisma;
        this.n8n = n8n;
    }
    async findAll(dto) {
        const { page = 1, pageSize = 20, status, source, search, sortBy = 'createdAt', order = 'desc', } = dto;
        const where = {};
        if (status)
            where.status = status;
        if (source)
            where.source = source;
        if (search) {
            where.OR = [
                { bookingCode: { contains: search, mode: 'insensitive' } },
                { contactName: { contains: search, mode: 'insensitive' } },
                { contactPhone: { contains: search } },
                { pnr: { contains: search, mode: 'insensitive' } },
            ];
        }
        const [data, total] = await Promise.all([
            this.prisma.booking.findMany({
                where,
                include: {
                    customer: { select: { id: true, fullName: true, vipTier: true } },
                    staff: { select: { id: true, fullName: true } },
                    tickets: { take: 1 },
                },
                orderBy: { [sortBy]: order },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.booking.count({ where }),
        ]);
        return {
            data,
            total,
            page,
            pageSize,
            totalPages: Math.ceil(total / pageSize),
        };
    }
    async findOne(id) {
        const booking = await this.prisma.booking.findUnique({
            where: { id },
            include: {
                customer: true,
                staff: { select: { id: true, fullName: true, email: true, role: true } },
                tickets: { include: { passenger: true } },
                payments: { orderBy: { paidAt: 'desc' } },
                statusHistory: { orderBy: { createdAt: 'asc' } },
            },
        });
        if (!booking) {
            throw new common_1.NotFoundException(`Không tìm thấy booking ID: ${id}`);
        }
        return booking;
    }
    async create(dto, staffId) {
        const bookingCode = await this.generateBookingCode();
        const booking = await this.prisma.booking.create({
            data: {
                bookingCode,
                customerId: dto.customerId,
                staffId,
                source: dto.source,
                contactName: dto.contactName,
                contactPhone: dto.contactPhone,
                paymentMethod: dto.paymentMethod,
                notes: dto.notes,
                internalNotes: dto.internalNotes,
            },
            include: {
                customer: { select: { fullName: true, phone: true } },
                staff: { select: { fullName: true } },
            },
        });
        await this.prisma.bookingStatusLog.create({
            data: {
                bookingId: booking.id,
                fromStatus: 'NEW',
                toStatus: 'NEW',
                changedBy: staffId,
                reason: 'Tạo booking mới',
            },
        });
        await this.n8n.triggerWebhook('/booking-new', {
            bookingCode: booking.bookingCode,
            customerName: booking.customer.fullName,
            customerPhone: booking.customer.phone,
            staffName: booking.staff.fullName,
        });
        return booking;
    }
    async update(id, dto) {
        await this.findOne(id);
        return this.prisma.booking.update({
            where: { id },
            data: dto,
        });
    }
    async updateStatus(id, dto, changedBy) {
        const booking = await this.findOne(id);
        const allowedTransitions = STATUS_TRANSITIONS[booking.status];
        const targetStatus = dto.toStatus;
        if (!allowedTransitions.includes(targetStatus)) {
            throw new common_1.BadRequestException(`Không thể chuyển từ "${booking.status}" sang "${targetStatus}". ` +
                `Cho phép: ${allowedTransitions.join(', ') || 'Không có (trạng thái cuối)'}`);
        }
        const [updated] = await this.prisma.$transaction([
            this.prisma.booking.update({
                where: { id },
                data: {
                    status: targetStatus,
                    issuedAt: targetStatus === 'ISSUED' ? new Date() : undefined,
                },
            }),
            this.prisma.bookingStatusLog.create({
                data: {
                    bookingId: id,
                    fromStatus: booking.status,
                    toStatus: targetStatus,
                    changedBy,
                    reason: dto.reason,
                },
            }),
        ]);
        if (targetStatus === 'ISSUED' || targetStatus === 'CANCELLED') {
            await this.n8n.triggerWebhook('/booking-status', {
                bookingCode: booking.bookingCode,
                customerName: booking.customer?.fullName,
                customerPhone: booking.customer?.phone,
                status: targetStatus,
                reason: dto.reason,
            });
        }
        return updated;
    }
    async addTicket(bookingId, ticketData) {
        await this.findOne(bookingId);
        const ticket = await this.prisma.ticket.create({
            data: {
                bookingId,
                ...ticketData,
                profit: (ticketData.sellPrice ?? 0)
                    - (ticketData.netPrice ?? 0)
                    - (ticketData.tax ?? 0)
                    - (ticketData.serviceFee ?? 0)
                    + (ticketData.commission ?? 0),
            },
        });
        await this.recalculateBookingTotals(bookingId);
        return ticket;
    }
    async addPayment(bookingId, paymentData) {
        await this.findOne(bookingId);
        const payment = await this.prisma.payment.create({
            data: {
                bookingId,
                ...paymentData,
            },
        });
        await this.updatePaymentStatus(bookingId);
        await this.n8n.triggerWebhook('/payment', {
            bookingId,
            amount: payment.amount,
            method: payment.method,
            reference: payment.reference,
        });
        return payment;
    }
    async recalculateBookingTotals(bookingId) {
        const tickets = await this.prisma.ticket.findMany({
            where: { bookingId, status: 'ACTIVE' },
        });
        const totals = tickets.reduce((acc, t) => ({
            totalSellPrice: acc.totalSellPrice + Number(t.sellPrice),
            totalNetPrice: acc.totalNetPrice + Number(t.netPrice) + Number(t.tax),
            totalFees: acc.totalFees + Number(t.serviceFee),
            profit: acc.profit + Number(t.profit),
        }), { totalSellPrice: 0, totalNetPrice: 0, totalFees: 0, profit: 0 });
        await this.prisma.booking.update({
            where: { id: bookingId },
            data: totals,
        });
    }
    async updatePaymentStatus(bookingId) {
        const [booking, payments] = await Promise.all([
            this.prisma.booking.findUnique({ where: { id: bookingId } }),
            this.prisma.payment.findMany({ where: { bookingId } }),
        ]);
        if (!booking)
            return;
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
        const totalSell = Number(booking.totalSellPrice);
        let paymentStatus;
        if (totalPaid >= totalSell)
            paymentStatus = 'PAID';
        else if (totalPaid > 0)
            paymentStatus = 'PARTIAL';
        else
            paymentStatus = 'UNPAID';
        await this.prisma.booking.update({
            where: { id: bookingId },
            data: { paymentStatus },
        });
    }
    async generateBookingCode() {
        const now = new Date();
        const yy = now.getFullYear().toString().slice(-2);
        const mm = (now.getMonth() + 1).toString().padStart(2, '0');
        const dd = now.getDate().toString().padStart(2, '0');
        const prefix = `APG-${yy}${mm}${dd}`;
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const count = await this.prisma.booking.count({
            where: { createdAt: { gte: startOfDay } },
        });
        const seq = (count + 1).toString().padStart(3, '0');
        return `${prefix}-${seq}`;
    }
};
exports.BookingsService = BookingsService;
exports.BookingsService = BookingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        n8n_service_1.N8nService])
], BookingsService);
//# sourceMappingURL=bookings.service.js.map