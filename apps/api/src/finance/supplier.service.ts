// APG Manager RMS - SupplierService: Quản lý hồ sơ nhà cung cấp / đối tác
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateSupplierDto, UpdateSupplierDto } from './dto';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  // Danh sách NCC kèm tổng công nợ — PERF: dùng aggregate thay vì include ledgers
  async findAll() {
    const suppliers = await this.prisma.supplierProfile.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { ledgers: true } },
      },
    });

    // Lấy tổng nợ bằng 1 query riêng thay vì include toàn bộ ledger rows
    const debtSums = await this.prisma.accountsLedger.groupBy({
      by: ['supplierId'],
      where: { status: { notIn: ['PAID', 'WRITTEN_OFF', 'REFUNDED'] as any }, supplierId: { not: null } },
      _sum: { remaining: true },
    });
    const debtMap = Object.fromEntries(
      debtSums.map(d => [d.supplierId, Number(d._sum.remaining ?? 0)])
    );

    return suppliers.map(s => ({
      ...s,
      totalDebt: debtMap[s.id] ?? 0,
      ledgerCount: s._count.ledgers,
      _count: undefined,
    }));
  }

  // Chi tiết 1 NCC + bookings + danh sách công nợ
  async findOne(id: string) {
    return this.prisma.supplierProfile.findUniqueOrThrow({
      where: { id },
      include: {
        bookings: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: {
            id: true, bookingCode: true, pnr: true,
            totalNetPrice: true, totalSellPrice: true,
            status: true, createdAt: true,
            contactName: true,
          },
        },
        ledgers: {
          where: { direction: 'PAYABLE' },
          orderBy: { dueDate: 'asc' },
          include: { payments: { orderBy: { paidAt: 'desc' } } },
        },
      },
    });
  }

  // Tạo NCC mới
  async create(dto: CreateSupplierDto) {
    return this.prisma.supplierProfile.create({ data: dto as Prisma.SupplierProfileCreateInput });
  }

  // Cập nhật NCC
  async update(id: string, dto: UpdateSupplierDto) {
    return this.prisma.supplierProfile.update({ where: { id }, data: dto as Prisma.SupplierProfileUpdateInput });
  }

  // Danh sách công nợ của 1 NCC cụ thể
  async getLedger(id: string) {
    return this.prisma.accountsLedger.findMany({
      where: { supplierId: id },
      orderBy: { dueDate: 'asc' },
      include: {
        payments: { orderBy: { paidAt: 'desc' } },
        booking: { select: { id: true, bookingCode: true } },
      },
    });
  }

  // Seed NCC mẫu từ dữ liệu vận hành thực tế
  async seedDefaults() {
    const defaults = [
      { code: 'VN', name: 'Vietnam Airlines', type: 'AIRLINE', paymentTerms: 15 },
      { code: 'VJ', name: 'Vietjet Air', type: 'AIRLINE', paymentTerms: 15 },
      { code: 'QH', name: 'Bamboo Airways', type: 'AIRLINE', paymentTerms: 15 },
      { code: 'BL', name: 'Pacific Airlines', type: 'AIRLINE', paymentTerms: 30 },
      { code: 'VU', name: 'Vietravel Airlines', type: 'AIRLINE', paymentTerms: 15 },
      { code: 'AMADEUS', name: 'Amadeus GDS', type: 'GDS_PROVIDER', paymentTerms: 30 },
      { code: 'SCCM', name: 'SCCM Group', type: 'PARTNER', contactName: 'Mr Lưu + Mr Hoan', feedbackRate: 10, paymentTerms: 30 },
      { code: 'TB_VTC', name: 'Tàu Biển VTC', type: 'PARTNER', contactName: 'Mr Sơn - Thuyền trưởng', paymentTerms: 14 },
    ];

    for (const s of defaults) {
      await this.prisma.supplierProfile.upsert({
        where: { code: s.code },
        update: {},
        create: s as never,
      });
    }
  }
}
