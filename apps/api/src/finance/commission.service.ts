import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommissionKind, CommissionStatus, FundAccount, LedgerPartyType, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CashFlowService } from './cashflow.service';
import { FinancialLedgerService } from './financial-ledger.service';
import { TxnDedupe } from './txn-type.util';
import { CUSTOMER_REVENUE_STATUSES } from '../customers/customer-metrics.constants';

type DbClient = Prisma.TransactionClient | PrismaClient;

export type PayPartnerInput = {
  partnerId: string; // supplierId của đối tác (LedgerPartyType.PARTNER)
  amount: number;
  fundAccount: FundAccount;
  date?: string;
  reference?: string;
  notes?: string;
  reason?: string;
  userId?: string;
};

@Injectable()
export class CommissionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashflow: CashFlowService,
    private readonly financialLedger: FinancialLedgerService,
  ) {}

  /**
   * Dồn tích hoa hồng NHẬN từ hãng khi xuất vé = Σ ticket.commission (vé ACTIVE).
   * Idempotent theo booking (dedupeKey commAccrual:<bookingId>): xuất lại / sửa vé -> cập nhật, không nhân đôi.
   * KHÔNG phải dòng tiền -> CHƯA post FinancialTransaction (chốt thực thu ở GĐ3b đối soát BSP).
   */
  async accrueAirlineIncomeForBooking(bookingId: string, userId?: string, tx: DbClient = this.prisma) {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: { tickets: { where: { status: 'ACTIVE' }, select: { commission: true } } },
    });
    if (!booking) return null;

    const dedupeKey = `commAccrual:${bookingId}`;
    const existing = await tx.commissionRecord.findUnique({ where: { dedupeKey } });
    if (existing && existing.status !== 'ACCRUED') {
      return existing; // đã chốt/hủy ở đối soát -> không dồn tích đè lên
    }

    const total = booking.tickets.reduce((sum, t) => sum + Number(t.commission), 0);
    if (!(total > 0)) {
      // Không còn hoa hồng (vé sửa về 0 / hủy) -> gỡ bản dồn tích chưa chốt.
      await tx.commissionRecord.deleteMany({ where: { dedupeKey, status: 'ACCRUED' } });
      return null;
    }

    const occurredAt = booking.issuedAt ?? new Date();
    return tx.commissionRecord.upsert({
      where: { dedupeKey },
      update: { amount: total, supplierId: booking.supplierId, occurredAt },
      create: {
        kind: 'AIRLINE_INCOME',
        status: 'ACCRUED',
        amount: total,
        occurredAt,
        dedupeKey,
        bookingId,
        supplierId: booking.supplierId,
        description: `Hoa hồng hãng — Booking ${booking.bookingCode}`,
        createdBy: userId ?? null,
      },
    });
  }

  /**
   * Trả hoa hồng đối tác giới thiệu (NHẬP TAY theo đợt). Chạm tiền:
   * CashFlowEntry (PARTNER_FEEDBACK, OUTFLOW, locked) + FinancialTransaction (cùng tx) + CommissionRecord (SETTLED).
   */
  async payPartner(input: PayPartnerInput) {
    if (!(input.amount > 0)) {
      throw new BadRequestException('Số tiền trả hoa hồng phải lớn hơn 0.');
    }
    if (!input.fundAccount) {
      throw new BadRequestException('Vui lòng chọn quỹ chi để trả hoa hồng đối tác.');
    }

    const partner = await this.prisma.supplierProfile.findUnique({ where: { id: input.partnerId } });
    if (!partner) {
      throw new BadRequestException('Không tìm thấy đối tác.');
    }
    if (partner.type !== LedgerPartyType.PARTNER) {
      throw new BadRequestException('Chỉ được trả hoa hồng cho nhà cung cấp loại Đối tác (PARTNER).');
    }

    const paidAt = input.date ? new Date(input.date) : new Date();
    const description = `Tra hoa hong doi tac ${partner.name}`;

    return this.prisma.$transaction(async (tx) => {
      const cfe = await this.cashflow.recordSystemEntry({
        direction: 'OUTFLOW',
        category: 'PARTNER_FEEDBACK',
        amount: input.amount,
        pic: 'Finance',
        description,
        reference: input.reference ?? null,
        date: paidAt,
        status: 'DONE',
        notes: input.notes ?? null,
        fundAccount: input.fundAccount,
        sourceType: 'MANUAL',
        reason: input.reason ?? null,
        isLocked: true,
      }, tx, input.userId);

      // dedupeKey FT = cashflow:<cfeId> để khớp đúng key backfill suy ra (sourceType=MANUAL).
      const ft = await this.financialLedger.post({
        type: 'PARTNER_FEEDBACK',
        direction: 'OUTFLOW',
        amount: input.amount,
        occurredAt: paidAt,
        dedupeKey: TxnDedupe.manual(cfe.id),
        fundAccount: input.fundAccount,
        supplierId: partner.id,
        pic: 'Finance',
        description,
        reference: input.reference ?? null,
        reason: input.reason ?? null,
        createdBy: input.userId,
      }, tx);

      const record = await tx.commissionRecord.create({
        data: {
          kind: 'PARTNER_PAYOUT',
          status: 'SETTLED',
          amount: input.amount,
          occurredAt: paidAt,
          dedupeKey: `partnerPayout:${cfe.id}`,
          supplierId: partner.id,
          financialTransactionId: ft.id,
          description,
          reference: input.reference ?? null,
          reason: input.reason ?? null,
          createdBy: input.userId ?? null,
        },
      });

      return { commission: record, cashFlowEntry: cfe, financialTransaction: ft };
    });
  }

  /** Danh sách hoa hồng 2 chiều (lọc theo kind/status/hãng). */
  async list(filters: { kind?: CommissionKind; status?: CommissionStatus; supplierId?: string } = {}) {
    return this.prisma.commissionRecord.findMany({
      where: {
        ...(filters.kind && { kind: filters.kind }),
        ...(filters.status && { status: filters.status }),
        ...(filters.supplierId && { supplierId: filters.supplierId }),
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  /**
   * Tổng hợp 1 đối tác giới thiệu: đầu mối đã đem về (doanh số + lãi từ booking của khách
   * được gắn referredByPartnerId) so với hoa hồng feedback đã trả — cơ sở để thương lượng đợt tới.
   * Hoa hồng đối tác là thỏa thuận từng đợt (không công thức), nên đây CHỈ là số liệu tham khảo.
   */
  async partnerSummary(partnerId: string) {
    const partner = await this.prisma.supplierProfile.findUnique({
      where: { id: partnerId },
      select: { id: true, code: true, name: true, type: true, contactName: true },
    });
    if (!partner) {
      throw new NotFoundException('Khong tim thay doi tac.');
    }

    // Khách do đối tác này giới thiệu
    const customers = await this.prisma.customer.findMany({
      where: { referredByPartnerId: partnerId },
      select: { id: true, fullName: true, customerCode: true, phone: true },
      orderBy: { createdAt: 'desc' },
    });
    const customerIds = customers.map((c) => c.id);

    // Doanh số + lãi theo từng khách (chỉ booking tính doanh thu, cùng chuẩn với thống kê khách)
    const byCustomer = customerIds.length
      ? await this.prisma.booking.groupBy({
          by: ['customerId'],
          where: {
            customerId: { in: customerIds },
            deletedAt: null,
            status: { in: CUSTOMER_REVENUE_STATUSES },
          },
          _sum: { totalSellPrice: true, profit: true },
          _count: { id: true },
        })
      : [];
    const aggMap = new Map(
      byCustomer.map((b) => [
        b.customerId ?? '',
        { revenue: Number(b._sum.totalSellPrice ?? 0), profit: Number(b._sum.profit ?? 0), bookings: b._count.id },
      ]),
    );

    const customerRows = customers.map((c) => {
      const a = aggMap.get(c.id) ?? { revenue: 0, profit: 0, bookings: 0 };
      return { ...c, bookings: a.bookings, revenue: a.revenue, profit: a.profit };
    });

    const totals = {
      customerCount: customers.length,
      bookingCount: customerRows.reduce((s, c) => s + c.bookings, 0),
      revenue: customerRows.reduce((s, c) => s + c.revenue, 0),
      profit: customerRows.reduce((s, c) => s + c.profit, 0),
      paidFeedback: 0,
    };

    // Hoa hồng feedback đã trả cho đối tác này
    const [paidAgg, payouts] = await Promise.all([
      this.prisma.commissionRecord.aggregate({
        where: { kind: 'PARTNER_PAYOUT', supplierId: partnerId, status: { not: 'CANCELLED' } },
        _sum: { amount: true },
      }),
      this.prisma.commissionRecord.findMany({
        where: { kind: 'PARTNER_PAYOUT', supplierId: partnerId },
        orderBy: { occurredAt: 'desc' },
        take: 100,
        select: { id: true, amount: true, status: true, occurredAt: true, description: true, reference: true },
      }),
    ]);
    totals.paidFeedback = Number(paidAgg._sum.amount ?? 0);

    return { partner, totals, customers: customerRows, payouts };
  }
}
