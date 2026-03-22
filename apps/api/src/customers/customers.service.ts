// APG Manager RMS - Customers Service (CRM khách hàng)
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma, VipTier } from '@prisma/client';
import { IsString, IsOptional, IsEnum, IsNumber, Min, IsArray } from 'class-validator';
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

import { IsIn } from 'class-validator';

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

  // Chi tiết khách hàng kèm lịch sử booking
  async findOne(id: string) {
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
  async update(id: string, data: Partial<CreateCustomerDto>) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data });
  }

  // Thống kê khách hàng (CLV, tuyến hay đi, tần suất)
  async getStats(id: string) {
    const customer = await this.findOne(id);

    const bookings = await this.prisma.booking.findMany({
      where: { customerId: id, status: { in: ['ISSUED', 'COMPLETED'] } },
      include: { tickets: true },
    });

    // Tuyến bay hay đi nhất
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

    // Doanh thu năm nay
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const yearlyBookings = bookings.filter(b => new Date(b.createdAt) >= startOfYear);
    const yearlySpend = yearlyBookings.reduce(
      (sum, b) => sum + Number(b.totalSellPrice), 0
    );

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
