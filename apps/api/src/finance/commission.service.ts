import { BadRequestException, Injectable } from '@nestjs/common';
import { FundAccount, LedgerPartyType, Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CashFlowService } from './cashflow.service';
import { FinancialLedgerService } from './financial-ledger.service';
import { TxnDedupe } from './txn-type.util';

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
}
