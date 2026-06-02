// Phân loại + sinh dedupeKey cho FinancialTransaction.
// Thuần (không decorator Nest) để cả app NestJS lẫn script backfill (ts-node) dùng chung,
// đảm bảo dual-write (live) và backfill (dữ liệu cũ) phát sinh ĐÚNG CÙNG key/type -> không đếm trùng.
import { CashFlowCategory, CashFlowDirection, CashFlowSourceType, TxnType } from '@prisma/client';

const OPEX_CATEGORIES: CashFlowCategory[] = [
  'SALARY',
  'OFFICE_RENT',
  'OFFICE_SUPPLIES',
  'ENTERTAINMENT',
  'TRAVEL',
  'RITUAL',
  'MARKETING',
  'TECHNOLOGY',
];

/** Suy ra TxnType từ (sourceType, category, direction) của một CashFlowEntry. */
export function mapTxnType(
  sourceType: CashFlowSourceType | null,
  category: CashFlowCategory,
  direction: CashFlowDirection,
): TxnType {
  if (sourceType === 'FUND_TRANSFER') return 'FUND_TRANSFER';
  if (sourceType === 'FUND_ADJUSTMENT') return 'ADJUSTMENT';
  if (sourceType === 'DEPOSIT_TOPUP') return 'DEPOSIT_TOPUP';
  if (sourceType === 'OPERATING_EXPENSE') return 'OPERATING_EXPENSE';
  if (sourceType === 'LEDGER_PAYMENT') return direction === 'INFLOW' ? 'AR_COLLECTION' : 'AP_PAYMENT';
  if (category === 'TICKET_REFUND') return 'CUSTOMER_REFUND';
  if (category === 'PARTNER_FEEDBACK') return 'PARTNER_FEEDBACK';
  if (category === 'AIRLINE_PAYMENT') return 'AP_PAYMENT';
  if (category === 'TICKET_PAYMENT' && direction === 'INFLOW') return 'TICKET_SALE_RECEIPT';
  if (OPEX_CATEGORIES.includes(category)) return 'OPERATING_EXPENSE';
  return direction === 'INFLOW' ? 'OTHER_INCOME' : 'OTHER_EXPENSE';
}

/**
 * Bộ sinh dedupeKey ổn định theo CHỨNG TỪ NGUỒN. Dùng chung ở caller (dual-write) và backfill
 * để cùng một sự kiện tiền luôn ra cùng một key (1 sự kiện = 1 FinancialTransaction vĩnh viễn).
 */
export const TxnDedupe = {
  ledgerPayment: (ledgerPaymentId: string) => `ledgerPayment:${ledgerPaymentId}`,
  payment: (paymentId: string) => `payment:${paymentId}`,
  depositTopUp: (cfeSourceId: string) => cfeSourceId, // CFE.sourceId đã là "deposit-topup:<id>:<ts>"
  expense: (expenseId: string) => `expense:${expenseId}`,
  manual: (cfeId: string) => `cashflow:${cfeId}`,
  adjust: (cfeId: string) => `adjust:${cfeId}`,
  transferLeg: (transferGroupId: string, leg: 'OUT' | 'IN') => `transferLeg:${transferGroupId}:${leg}`,
  legacyCfe: (cfeId: string) => `cfe:${cfeId}`,
};

/** Suy ra dedupeKey từ một CashFlowEntry đã lưu (cho backfill); khớp đúng key dual-write phát sinh. */
export function dedupeKeyFromCashFlow(e: {
  id: string;
  sourceType: CashFlowSourceType | null;
  sourceId: string | null;
  transferGroupId: string | null;
  direction: CashFlowDirection;
}): string {
  if (e.sourceType === 'LEDGER_PAYMENT' && e.sourceId) return TxnDedupe.ledgerPayment(e.sourceId);
  if (e.sourceType === 'BOOKING_PAYMENT' && e.sourceId) return TxnDedupe.payment(e.sourceId);
  if (e.sourceType === 'DEPOSIT_TOPUP' && e.sourceId) return TxnDedupe.depositTopUp(e.sourceId);
  if (e.sourceType === 'OPERATING_EXPENSE' && e.sourceId) return TxnDedupe.expense(e.sourceId);
  if (e.sourceType === 'FUND_TRANSFER' && e.transferGroupId) {
    return TxnDedupe.transferLeg(e.transferGroupId, e.direction === 'OUTFLOW' ? 'OUT' : 'IN');
  }
  if (e.sourceType === 'FUND_ADJUSTMENT') return TxnDedupe.adjust(e.id);
  if (e.sourceType === 'MANUAL') return TxnDedupe.manual(e.id);
  return TxnDedupe.legacyCfe(e.id); // CFE cũ không gắn nguồn (vd thu tiền mặt booking trước cutover)
}
