import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, VipTier } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../common/prisma.service';

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

  @IsOptional() @IsEnum(VipTier)
  vipTier?: VipTier;

  @IsOptional() @IsString()
  companyName?: string;

  @IsOptional() @IsString()
  companyTaxId?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsString()
  customerCode?: string;
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
  private readonly customerCodePrefix = 'KH';

  constructor(private prisma: PrismaService) {}

  private normalizeCustomerCode(code?: string | null) {
    const normalized = code?.trim().toUpperCase();
    return normalized ? normalized : undefined;
  }

  private toOptionalString(value?: string | null) {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }

  private isCustomerCodeUniqueConstraint(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private async generateCustomerCode() {
    const existingCodes = await this.prisma.customer.findMany({
      where: { customerCode: { startsWith: this.customerCodePrefix } },
      select: { customerCode: true },
      take: 1000,
      orderBy: { customerCode: 'desc' },
    });

    const maxSequence = existingCodes.reduce((max, customer) => {
      const match = customer.customerCode?.match(/^KH(\d+)$/);
      if (!match) return max;
      return Math.max(max, Number(match[1]));
    }, 0);

    return `${this.customerCodePrefix}${(maxSequence + 1).toString().padStart(6, '0')}`;
  }

  private buildCreateData(dto: CreateCustomerDto, customerCode: string): Prisma.CustomerCreateInput {
    return {
      fullName: dto.fullName.trim(),
      phone: dto.phone.trim(),
      email: this.toOptionalString(dto.email),
      idNumber: this.toOptionalString(dto.idNumber),
      passport: this.toOptionalString(dto.passport),
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      type: dto.type ?? 'INDIVIDUAL',
      vipTier: dto.vipTier ?? 'NORMAL',
      companyName: this.toOptionalString(dto.companyName),
      companyTaxId: this.toOptionalString(dto.companyTaxId),
      notes: this.toOptionalString(dto.notes),
      tags: dto.tags ?? [],
      customerCode,
    };
  }

  private buildUpdateData(data: Partial<CreateCustomerDto> & { vipTier?: string }): Prisma.CustomerUpdateInput {
    return {
      ...(data.fullName !== undefined && { fullName: data.fullName.trim() }),
      ...(data.phone !== undefined && { phone: data.phone.trim() }),
      ...(data.email !== undefined && { email: this.toOptionalString(data.email) }),
      ...(data.idNumber !== undefined && { idNumber: this.toOptionalString(data.idNumber) }),
      ...(data.passport !== undefined && { passport: this.toOptionalString(data.passport) }),
      ...(data.dateOfBirth !== undefined && { dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.vipTier !== undefined && { vipTier: data.vipTier as VipTier }),
      ...(data.companyName !== undefined && { companyName: this.toOptionalString(data.companyName) }),
      ...(data.companyTaxId !== undefined && { companyTaxId: this.toOptionalString(data.companyTaxId) }),
      ...(data.notes !== undefined && { notes: this.toOptionalString(data.notes) }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.customerCode !== undefined && {
        customerCode: this.normalizeCustomerCode(data.customerCode) ?? null,
      }),
    };
  }

  async ensureCustomerCode(customerId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, customerCode: true },
    });

    if (!customer) {
      throw new NotFoundException(`Khong tim thay khach hang ID: ${customerId}`);
    }

    if (customer.customerCode) {
      return customer.customerCode;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const nextCode = await this.generateCustomerCode();

      try {
        const updated = await this.prisma.customer.updateMany({
          where: { id: customer.id, customerCode: null },
          data: { customerCode: nextCode },
        });

        if (updated.count > 0) {
          return nextCode;
        }

        const current = await this.prisma.customer.findUnique({
          where: { id: customer.id },
          select: { customerCode: true },
        });

        if (current?.customerCode) {
          return current.customerCode;
        }
      } catch (error) {
        if (this.isCustomerCodeUniqueConstraint(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Khong the cap ma khach hang. Vui long thu lai.');
  }

  async findByPhone(phone: string) {
    const customer = await this.prisma.customer.findUnique({ where: { phone } });
    if (!customer) return null;

    if (!customer.customerCode) {
      customer.customerCode = await this.ensureCustomerCode(customer.id);
    }

    return customer;
  }

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
        { customerCode: { contains: search, mode: 'insensitive' } },
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

    for (const customer of data) {
      if (!customer.customerCode) {
        customer.customerCode = await this.ensureCustomerCode(customer.id);
      }
    }

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

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
          select: {
            id: true,
            code: true,
            totalAmount: true,
            remaining: true,
            status: true,
            dueDate: true,
          },
        },
        interactions: { take: 10, orderBy: { createdAt: 'desc' } },
        customerNotes: { take: 10, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Khong tim thay khach hang ID: ${id}`);
    }

    if (!customer.customerCode) {
      customer.customerCode = await this.ensureCustomerCode(id);
    }

    return customer;
  }

  async create(input: CreateCustomerDto | { data: CreateCustomerDto; select?: { id: boolean } }) {
    const dto = 'data' in input ? input.data : input;
    const normalizedPhone = dto.phone.trim();

    const existing = await this.prisma.customer.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existing) {
      throw new ConflictException(
        `So dien thoai ${dto.phone} da duoc dang ky cho khach: ${existing.fullName}`,
      );
    }

    const normalizedCustomerCode = this.normalizeCustomerCode(dto.customerCode);

    if (normalizedCustomerCode) {
      const existingCode = await this.prisma.customer.findUnique({
        where: { customerCode: normalizedCustomerCode },
        select: { id: true },
      });

      if (existingCode) {
        throw new ConflictException(`Ma khach hang ${normalizedCustomerCode} da ton tai.`);
      }
    }

    const createDto: CreateCustomerDto = {
      ...dto,
      phone: normalizedPhone,
      customerCode: normalizedCustomerCode,
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const customerCode = normalizedCustomerCode ?? await this.generateCustomerCode();

      try {
        return await this.prisma.customer.create({
          data: this.buildCreateData(createDto, customerCode),
        });
      } catch (error) {
        if (!normalizedCustomerCode && this.isCustomerCodeUniqueConstraint(error)) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('Khong the tao khach hang voi ma duy nhat. Vui long thu lai.');
  }

  async update(id: string, data: Partial<CreateCustomerDto> & { vipTier?: string }) {
    await this.findOne(id);

    const normalizedCustomerCode = data.customerCode !== undefined
      ? this.normalizeCustomerCode(data.customerCode)
      : undefined;

    if (normalizedCustomerCode) {
      const existingCode = await this.prisma.customer.findUnique({
        where: { customerCode: normalizedCustomerCode },
        select: { id: true },
      });

      if (existingCode && existingCode.id !== id) {
        throw new ConflictException(`Ma khach hang ${normalizedCustomerCode} da ton tai.`);
      }
    }

    try {
      const updated = await this.prisma.customer.update({
        where: { id },
        data: this.buildUpdateData({
          ...data,
          ...(data.customerCode !== undefined ? { customerCode: normalizedCustomerCode } : {}),
        }) as never,
      });

      if (!updated.customerCode) {
        updated.customerCode = await this.ensureCustomerCode(id);
      }

      if (!data.vipTier) {
        try {
          await this.autoClassifyVipTier(id);
        } catch (error) {
          console.log('[VIP-TIER] Auto-classify error:', error);
        }
      }

      return updated;
    } catch (error) {
      if (this.isCustomerCodeUniqueConstraint(error)) {
        throw new ConflictException(`Ma khach hang ${normalizedCustomerCode} da ton tai.`);
      }
      throw error;
    }
  }

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

    const bookings = await this.prisma.booking.findMany({
      where: { customerId: id, status: { in: ['ISSUED', 'COMPLETED'] } },
      include: { tickets: true },
    });

    const routeCount: Record<string, number> = {};
    bookings.forEach((booking) => {
      booking.tickets.forEach((ticket) => {
        const route = `${ticket.departureCode}-${ticket.arrivalCode}`;
        routeCount[route] = (routeCount[route] ?? 0) + 1;
      });
    });

    const topRoutes = Object.entries(routeCount)
      .sort(([, left], [, right]) => right - left)
      .slice(0, 3)
      .map(([route, count]) => ({ route, count }));

    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const yearlyBookings = bookings.filter((booking) => new Date(booking.createdAt) >= startOfYear);
    const yearlySpend = yearlyBookings.reduce((sum, booking) => sum + Number(booking.totalSellPrice), 0);

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

  async getUpcomingBirthdays() {
    const customers = await this.prisma.customer.findMany({
      where: { dateOfBirth: { not: null } },
      select: { id: true, fullName: true, phone: true, dateOfBirth: true, vipTier: true },
    });

    const today = new Date();
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    return customers.filter((customer) => {
      if (!customer.dateOfBirth) return false;
      const birthday = new Date(customer.dateOfBirth);
      const thisYearBirthday = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
      return thisYearBirthday >= today && thisYearBirthday <= sevenDaysLater;
    });
  }
}
