import { BadRequestException, Injectable } from '@nestjs/common';
import { FundAccount } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { FinancialLedgerService } from './financial-ledger.service';

const RECON_BOOKING_STATUSES = ['ISSUED', 'COMPLETED'] as const;

export type CreateReconciliationInput = {
  supplierId: string;
  periodFrom: string;
  periodTo: string;
  bspNet: number;
  bspCommission: number;
  fundAccount?: FundAccount | null; // quỹ thực thu hoa hồng; null = bù trừ (không đổi số dư quỹ)
  notes?: string;
  userId?: string;
};

@Injectable()
export class ReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialLedger: FinancialLedgerService,
  ) {}

  /** Số NỘI BỘ của 1 hãng trong kỳ (để so với sao kê BSP). Không lưu. */
  async preview(supplierId: string, periodFrom: Date, periodTo: Date) {
    const [bookingAgg, commissionAgg, supplier] = await Promise.all([
      this.prisma.booking.aggregate({
        where: {
          supplierId,
          deletedAt: null,
          status: { in: [...RECON_BOOKING_STATUSES] },
          issuedAt: { gte: periodFrom, lt: periodTo },
        },
        _sum: { totalNetPrice: true },
        _count: true,
      }),
      this.prisma.commissionRecord.aggregate({
        where: {
          kind: 'AIRLINE_INCOME',
          status: { not: 'CANCELLED' },
          supplierId,
          occurredAt: { gte: periodFrom, lt: periodTo },
        },
        _sum: { amount: true },
      }),
      this.prisma.supplierProfile.findUnique({ where: { id: supplierId }, select: { id: true, name: true } }),
    ]);

    return {
      supplierId,
      supplierName: supplier?.name ?? null,
      periodFrom,
      periodTo,
      internalNet: Number(bookingAgg._sum.totalNetPrice ?? 0),
      internalCommission: Number(commissionAgg._sum.amount ?? 0),
      bookingCount: bookingAgg._count,
    };
  }

  /** Lập batch đối soát (DRAFT) với số BSP nhập tay + chênh lệch so nội bộ. */
  async create(input: CreateReconciliationInput) {
    const periodFrom = new Date(input.periodFrom);
    const periodTo = new Date(input.periodTo);
    if (!(periodFrom < periodTo)) {
      throw new BadRequestException('Kỳ đối soát không hợp lệ (từ phải trước đến).');
    }

    const pv = await this.preview(input.supplierId, periodFrom, periodTo);

    return this.prisma.reconciliationBatch.create({
      data: {
        supplierId: input.supplierId,
        periodFrom,
        periodTo,
        status: 'DRAFT',
        internalNet: pv.internalNet,
        internalCommission: pv.internalCommission,
        bspNet: input.bspNet,
        bspCommission: input.bspCommission,
        netDiscrepancy: input.bspNet - pv.internalNet,
        commissionDiscrepancy: input.bspCommission - pv.internalCommission,
        fundAccount: input.fundAccount ?? null,
        notes: input.notes ?? null,
        createdBy: input.userId ?? null,
      },
    });
  }

  /**
   * Chốt đối soát: AIRLINE_INCOME ACCRUED→SETTLED cho hãng+kỳ + post COMMISSION_INCOME (FT)
   * theo số BSP thực. Nguyên tử trong 1 $transaction. Idempotent FT theo dedupeKey commSettle:<batchId>.
   */
  async confirm(id: string, userId?: string) {
    const batch = await this.prisma.reconciliationBatch.findUniqueOrThrow({ where: { id } });
    if (batch.status === 'CONFIRMED') {
      throw new BadRequestException('Đối soát đã được chốt.');
    }

    const supplier = await this.prisma.supplierProfile.findUnique({
      where: { id: batch.supplierId },
      select: { name: true },
    });

    return this.prisma.$transaction(async (tx) => {
      // 1) Chốt hoa hồng dồn tích của hãng + kỳ
      await tx.commissionRecord.updateMany({
        where: {
          kind: 'AIRLINE_INCOME',
          status: 'ACCRUED',
          supplierId: batch.supplierId,
          occurredAt: { gte: batch.periodFrom, lt: batch.periodTo },
        },
        data: { status: 'SETTLED' },
      });

      // 2) Post COMMISSION_INCOME vào sổ tiền (số BSP thực). fundAccount null = bù trừ.
      let financialTransactionId: string | null = null;
      const bspCommission = Number(batch.bspCommission);
      if (bspCommission > 0) {
        const ft = await this.financialLedger.post({
          type: 'COMMISSION_INCOME',
          direction: 'INFLOW',
          amount: bspCommission,
          occurredAt: batch.periodTo,
          dedupeKey: `commSettle:${batch.id}`,
          fundAccount: batch.fundAccount,
          supplierId: batch.supplierId,
          description: `Hoa hong BSP chot - ${supplier?.name ?? batch.supplierId}`,
          createdBy: userId,
        }, tx);
        financialTransactionId = ft.id;
      }

      // 3) Đánh dấu batch đã chốt
      return tx.reconciliationBatch.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
          confirmedBy: userId ?? null,
          confirmedAt: new Date(),
          financialTransactionId,
        },
      });
    });
  }

  async findOne(id: string) {
    return this.prisma.reconciliationBatch.findUniqueOrThrow({ where: { id } });
  }

  async list(supplierId?: string) {
    return this.prisma.reconciliationBatch.findMany({
      where: supplierId ? { supplierId } : {},
      orderBy: [{ periodFrom: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
