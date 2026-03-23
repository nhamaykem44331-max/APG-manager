// APG Manager RMS - SupplierService: Quản lý hồ sơ nhà cung cấp / đối tác
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  // Danh sách NCC kèm tổng công nợ
  async findAll() {
    const suppliers = await this.prisma.supplierProfile.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        ledgers: {
          where: { status: { not: 'PAID' } },
          select: { remaining: true },
        },
      },
    });

    return suppliers.map((s) => ({
      ...s,
      totalDebt: s.ledgers.reduce((sum, l) => sum + Number(l.remaining), 0),
      ledgerCount: s.ledgers.length,
      ledgers: undefined,
    }));
  }

  // Chi tiết 1 NCC + danh sách công nợ
  async findOne(id: string) {
    return this.prisma.supplierProfile.findUniqueOrThrow({
      where: { id },
      include: {
        ledgers: {
          orderBy: { dueDate: 'asc' },
          include: { payments: { orderBy: { paidAt: 'desc' } } },
        },
      },
    });
  }

  // Tạo NCC mới
  async create(data: {
    code: string; name: string; type: string;
    contactName?: string; contactPhone?: string; contactEmail?: string;
    taxId?: string; bankAccount?: string; bankName?: string;
    creditLimit?: number; paymentTerms?: number; feedbackRate?: number; notes?: string;
  }) {
    return this.prisma.supplierProfile.create({ data: data as never });
  }

  // Cập nhật NCC
  async update(id: string, data: Record<string, unknown>) {
    return this.prisma.supplierProfile.update({ where: { id }, data });
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
