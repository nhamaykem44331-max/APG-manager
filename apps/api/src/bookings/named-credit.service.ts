import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class NamedCreditService {
  constructor(private prisma: PrismaService) {}

  async findAll(filters?: { status?: string; customerId?: string; airline?: string }) {
    const where: Record<string, unknown> = {};

    if (filters?.status) where.status = filters.status;
    if (filters?.customerId) where.customerId = filters.customerId;
    if (filters?.airline) where.airline = filters.airline.toUpperCase();

    return this.prisma.namedCredit.findMany({
      where,
      include: {
        customer: { select: { id: true, fullName: true, phone: true } },
        booking: { select: { id: true, bookingCode: true, pnr: true } },
        usedInBooking: { select: { id: true, bookingCode: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });
  }

  async create(
    data: {
      bookingId: string;
      customerId: string;
      passengerName: string;
      airline: string;
      ticketNumber?: string;
      pnr?: string;
      creditAmount: number;
      expiryDate: string;
      notes?: string;
      createdBy: string;
    },
    client?: PrismaClientLike,
  ) {
    const prisma = client ?? this.prisma;

    return prisma.namedCredit.create({
      data: {
        bookingId: data.bookingId,
        customerId: data.customerId,
        passengerName: data.passengerName.trim().toUpperCase(),
        airline: data.airline.trim().toUpperCase(),
        ticketNumber: data.ticketNumber,
        pnr: data.pnr?.trim().toUpperCase(),
        creditAmount: data.creditAmount,
        usedAmount: 0,
        remainingAmount: data.creditAmount,
        expiryDate: new Date(data.expiryDate),
        notes: data.notes,
        createdBy: data.createdBy,
      },
    });
  }

  async applyToBooking(creditId: string, bookingId: string, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('Số tiền cấn trừ phải lớn hơn 0');
    }

    const credit = await this.prisma.namedCredit.findUniqueOrThrow({
      where: { id: creditId },
    });

    if (credit.status === 'USED' || credit.status === 'EXPIRED') {
      throw new BadRequestException('Credit đã hết hạn hoặc đã sử dụng hết');
    }

    if (new Date() > credit.expiryDate) {
      await this.prisma.namedCredit.update({
        where: { id: creditId },
        data: { status: 'EXPIRED' },
      });
      throw new BadRequestException('Credit đã quá hạn sử dụng');
    }

    if (amount > Number(credit.remainingAmount)) {
      throw new BadRequestException(`Chỉ còn ${credit.remainingAmount} trong credit`);
    }

    const newUsed = Number(credit.usedAmount) + amount;
    const newRemaining = Number(credit.creditAmount) - newUsed;
    const newStatus = newRemaining <= 0 ? 'USED' : 'PARTIAL';

    return this.prisma.namedCredit.update({
      where: { id: creditId },
      data: {
        usedAmount: newUsed,
        remainingAmount: Math.max(0, newRemaining),
        status: newStatus as any,
        usedInBookingId: bookingId,
        usedAt: new Date(),
      },
    });
  }

  async getSummary() {
    const [active, expiringSoon, totalValue] = await Promise.all([
      this.prisma.namedCredit.count({ where: { status: 'ACTIVE' } }),
      this.prisma.namedCredit.count({
        where: {
          status: 'ACTIVE',
          expiryDate: { lte: new Date(Date.now() + 30 * 24 * 3600 * 1000) },
        },
      }),
      this.prisma.namedCredit.aggregate({
        where: { status: { in: ['ACTIVE', 'PARTIAL'] } },
        _sum: { remainingAmount: true },
      }),
    ]);

    return {
      activeCount: active,
      expiringSoonCount: expiringSoon,
      totalRemainingValue: Number(totalValue._sum.remainingAmount ?? 0),
    };
  }
}
