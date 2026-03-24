// APG Manager RMS - Customers Service (CRM khách hàng)
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma, VipTier } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsNumber, Min, IsArray, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerDto {
  @IsString()
  fullName: string;

  @IsString()
  phone: string;

  @IsOptional() @IsString()
  email?: string;

  @IsOptional() @IsString()
  idNumber?: string;

  @IsOptional() @IsString()
  passport?: string;

  @IsOptional() @IsString()
  dateOfBirth?: string;

  @IsOptional() @IsIn(['INDIVIDUAL', 'CORPORATE'])
  type?: 'INDIVIDUAL' | 'CORPORATE';

  @IsOptional() @IsString()
  companyName?: string;

  @IsOptional() @IsString()
  companyTaxId?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];
}



export class ListCustomersDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  pageSize?: number;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  type?: string;

  @IsOptional() @IsEnum(VipTier)
  vipTier?: string;
}

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  // Tìm kiếm khách hàng theo SĐT (auto-detect khi tạo booking)
  async findByPhone(phone: string) {
    return this.prisma.customer.findUnique({ where: { phone } });
  }

  // Danh sách khách hàng
  async findAll(dto: ListCustomersDto) {
    const { page = 1, pageSize = 20, search, type, vipTier } = dto;

    const where: Prisma.CustomerWhereInput = {};
    if (type) where.type = type as Prisma.EnumCustomerTypeFilter;
    if (vipTier) where.vipTier = vipTier as VipTier;
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

  // Chi tiết khách hàng kèm lịch sử booking + công nợ
  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: {
        bookings: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            tickets: { take: 1 },
            supplier: { select: { code: true, name: true } },
            _count: { select: { tickets: true, payments: true } },
          },
        },
        ledgers: {
          where: { direction: 'RECEIVABLE' },
          orderBy: { dueDate: 'asc' },
          select: { id: true, code: true, totalAmount: true, remaining: true, status: true, dueDate: true },
        },
        interactions: { take: 10, orderBy: { createdAt: 'desc' } },
        customerNotes: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer) throw new NotFoundException(`Không tìm thấy khách hàng ID: ${id}`);
    return customer;
  }

  // Tạo khách hàng mới
  async create(dto: CreateCustomerDto) {
    // Kiểm tra số điện thoại đã tồn tại chưa
    const existing = await this.prisma.customer.findUnique({
      where: { phone: dto.phone },
    });

    if (existing) {
      throw new ConflictException(
        `Số điện thoại ${dto.phone} đã được đăng ký cho khách: ${existing.fullName}`
      );
    }

    return this.prisma.customer.create({ data: dto });
  }

  // Cập nhật thông tin khách hàng
  async update(id: string, data: Partial<CreateCustomerDto> & { vipTier?: string }) {
    await this.findOne(id);
    const updated = await this.prisma.customer.update({ where: { id }, data: data as never });

    // Auto-classify VIP tier nếu không chỉ định thủ công
    if (!data.vipTier) {
      try {
        await this.autoClassifyVipTier(id);
      } catch (e) {
        console.log('[VIP-TIER] Auto-classify error:', e);
      }
    }
    return updated;
  }

  // Auto VIP: NORMAL < 50M, SILVER 50-100M, GOLD 100-500M, PLATINUM > 500M
  async autoClassifyVipTier(customerId: string) {
    const bookingSum = await this.prisma.booking.aggregate({
      where: { customerId, deletedAt: null, status: { in: ['ISSUED', 'COMPLETED'] } },
      _sum: { totalSellPrice: true },
    });
    const totalSpent = Number(bookingSum._sum.totalSellPrice ?? 0);

    let tier: VipTier = 'NORMAL';
    if (totalSpent >= 500_000_000) tier = 'PLATINUM';
    else if (totalSpent >= 100_000_000) tier = 'GOLD';
    else if (totalSpent >= 50_000_000) tier = 'SILVER';

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { vipTier: tier, totalSpent },
    });
    console.log(`[VIP-TIER] Customer ${customerId}: totalSpent=${totalSpent}, tier=${tier}`);
  }

  // Thống kê khách hàng (CLV, tài chính tổng hợp)
  async getStats(id: string) {
    const customer = await this.prisma.customer.findUniqueOrThrow({ where: { id } });

    const [bookingStats, debtStats, paymentTotal] = await Promise.all([
      this.prisma.booking.aggregate({
        where: { customerId: id, deletedAt: null, status: { in: ['ISSUED', 'COMPLETED'] } },
        _sum: { totalSellPrice: true, profit: true },
        _count: { id: true },
      }),
      this.prisma.accountsLedger.aggregate({
        where: { customerId: id, direction: 'RECEIVABLE', status: { not: 'PAID' } },
        _sum: { remaining: true },
        _count: { id: true },
      }),
      this.prisma.payment.aggregate({
        where: { booking: { customerId: id } },
        _sum: { amount: true },
      }),
    ]);

    // Top routes
    const bookings = await this.prisma.booking.findMany({
      where: { customerId: id, status: { in: ['ISSUED', 'COMPLETED'] } },
      include: { tickets: true },
    });

    const routeCount: Record<string, number> = {};
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

    // Yearly spend
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const yearlyBookings = bookings.filter(b => new Date(b.createdAt) >= startOfYear);
    const yearlySpend = yearlyBookings.reduce((sum, b) => sum + Number(b.totalSellPrice), 0);

    return {
      totalBookings: bookingStats._count.id,
      totalRevenue: Number(bookingStats._sum.totalSellPrice ?? 0),
      totalProfit: Number(bookingStats._sum.profit ?? 0),
      totalPaid: Number(paymentTotal._sum.amount ?? 0),
      outstandingDebt: Number(debtStats._sum.remaining ?? 0),
      activeDebts: debtStats._count.id,
      totalSpent: customer.totalSpent,
      yearlySpend,
      vipTier: customer.vipTier,
      topRoutes,
      lastBookingDate: bookings[0]?.createdAt ?? null,
      averageTicketValue: bookings.length > 0 ? Number(customer.totalSpent) / bookings.length : 0,
    };
  }

  // Tự động tính lại VIP tier sau mỗi booking hoàn thành
  async recalculateVipTier(customerId: string) {
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

    let tier: VipTier;
    if (yearSpent >= 200_000_000) tier = VipTier.PLATINUM;
    else if (yearSpent >= 50_000_000) tier = VipTier.GOLD;
    else if (yearSpent >= 10_000_000) tier = VipTier.SILVER;
    else tier = VipTier.NORMAL;

    await this.prisma.customer.update({
      where: { id: customerId },
      data: { vipTier: tier },
    });

    return tier;
  }

  // Khách sắp sinh nhật trong 7 ngày tới (gửi thông báo)
  async getUpcomingBirthdays() {
    const customers = await this.prisma.customer.findMany({
      where: { dateOfBirth: { not: null } },
      select: { id: true, fullName: true, phone: true, dateOfBirth: true, vipTier: true },
    });

    const today = new Date();
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return customers.filter(c => {
      if (!c.dateOfBirth) return false;
      const bday = new Date(c.dateOfBirth);
      const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      return thisYearBday >= today && thisYearBday <= sevenDaysLater;
    });
  }
}
