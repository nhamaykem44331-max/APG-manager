import { BadRequestException, Injectable } from '@nestjs/common';
import { FundAccount, Prisma, PrismaClient, TxnDirection, TxnType } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

type DbClient = Prisma.TransactionClient | PrismaClient;

export type PostTxnInput = {
  type: TxnType;
  direction: TxnDirection;
  amount: number; // luôn > 0
  occurredAt: Date;
  dedupeKey: string; // chống đếm trùng: "cfe:<id>", "ledgerPayment:<id>"...
  fundAccount?: FundAccount | null;
  counterpartyFundAccount?: FundAccount | null;
  transferGroupId?: string | null;
  bookingId?: string | null;
  ledgerId?: string | null;
  invoiceId?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  expenseId?: string | null;
  paymentId?: string | null;
  pic?: string | null;
  description: string;
  reference?: string | null;
  reason?: string | null;
  createdBy?: string | null;
};

@Injectable()
export class FinancialLedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cổng DUY NHẤT ghi sự kiện tiền vào sổ trung tâm (financial_transactions).
   * Idempotent theo dedupeKey: gọi lại với cùng key sẽ KHÔNG tạo bản ghi trùng.
   * Truyền `tx` để bút toán nằm cùng transaction với chứng từ nguồn (nguyên tử).
   */
  async post(input: PostTxnInput, tx: DbClient = this.prisma) {
    if (!(input.amount > 0)) {
      throw new BadRequestException('Số tiền giao dịch phải lớn hơn 0.');
    }
    if (input.type === 'ADJUSTMENT' && !input.reason?.trim()) {
      throw new BadRequestException('Điều chỉnh số dư bắt buộc có lý do.');
    }

    // Field có thể đổi khi sửa chứng từ nguồn (gọi lại post với cùng dedupeKey) -> lan sang FT.
    const mutable = {
      direction: input.direction,
      type: input.type,
      amount: new Prisma.Decimal(input.amount),
      occurredAt: input.occurredAt,
      fundAccount: input.fundAccount ?? null,
      counterpartyFundAccount: input.counterpartyFundAccount ?? null,
      transferGroupId: input.transferGroupId ?? null,
      bookingId: input.bookingId ?? null,
      ledgerId: input.ledgerId ?? null,
      invoiceId: input.invoiceId ?? null,
      customerId: input.customerId ?? null,
      supplierId: input.supplierId ?? null,
      expenseId: input.expenseId ?? null,
      paymentId: input.paymentId ?? null,
      pic: input.pic ?? null,
      description: input.description,
      reference: input.reference ?? null,
      reason: input.reason ?? null,
    };

    return tx.financialTransaction.upsert({
      where: { dedupeKey: input.dedupeKey },
      update: mutable, // giữ createdBy gốc, cập nhật phần còn lại
      create: {
        dedupeKey: input.dedupeKey,
        currency: 'VND',
        createdBy: input.createdBy ?? null,
        ...mutable,
      },
    });
  }

  /** Xóa FT theo dedupeKey (đồng bộ khi chứng từ nguồn bị xóa). Gọi trong cùng tx với xóa CFE. */
  async removeByDedupeKeys(dedupeKeys: string[], tx: DbClient = this.prisma) {
    if (dedupeKeys.length === 0) {
      return { count: 0 };
    }
    return tx.financialTransaction.deleteMany({ where: { dedupeKey: { in: dedupeKeys } } });
  }
}
