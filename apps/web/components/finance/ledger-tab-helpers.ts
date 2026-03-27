'use client';

import type { AccountsLedger, DebtStatus } from '@/types';

export type LedgerSortKey = 'remaining:desc' | 'remaining:asc' | 'dueDate:asc' | 'createdAt:desc';

export interface LedgerGroupMetrics {
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  dueDate: string;
  createdAt: string;
  latestPaymentAt?: string | null;
  status: DebtStatus;
}

export function getLedgerBookingRef(ledger: AccountsLedger) {
  return ledger.booking?.pnr ?? ledger.booking?.bookingCode ?? ledger.bookingCode ?? ledger.code;
}

export function getLedgerLatestPaymentAt(ledgers: AccountsLedger[]) {
  return ledgers
    .flatMap((ledger) => ledger.payments ?? [])
    .map((payment) => payment.paidAt)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
}

export function getLedgerGroupMetrics(ledgers: AccountsLedger[]): LedgerGroupMetrics {
  const totalAmount = ledgers.reduce((sum, ledger) => sum + Number(ledger.totalAmount), 0);
  const paidAmount = ledgers.reduce((sum, ledger) => sum + Number(ledger.paidAmount), 0);
  const remaining = ledgers.reduce((sum, ledger) => sum + Number(ledger.remaining), 0);

  const unpaidLedgers = ledgers.filter((ledger) => Number(ledger.remaining) > 0);
  const dueSource = unpaidLedgers.length > 0 ? unpaidLedgers : ledgers;
  const dueDate = [...dueSource]
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]?.dueDate
    ?? ledgers[0]?.dueDate
    ?? new Date().toISOString();

  const createdAt = [...ledgers]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt
    ?? new Date().toISOString();

  let status: DebtStatus = 'ACTIVE';
  if (remaining <= 0) {
    status = 'PAID';
  } else if (
    unpaidLedgers.some((ledger) =>
      ledger.status === 'OVERDUE' || new Date(ledger.dueDate).getTime() < Date.now(),
    )
  ) {
    status = 'OVERDUE';
  } else if (paidAmount > 0) {
    status = 'PARTIAL_PAID';
  }

  return {
    totalAmount,
    paidAmount,
    remaining,
    dueDate,
    createdAt,
    latestPaymentAt: getLedgerLatestPaymentAt(ledgers),
    status,
  };
}

export function sortLedgerRows<T extends LedgerGroupMetrics>(rows: T[], sort: LedgerSortKey) {
  const [sortBy, sortOrder] = sort.split(':') as [string, 'asc' | 'desc'];
  const direction = sortOrder === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const aValue = sortBy === 'remaining'
      ? a.remaining
      : sortBy === 'dueDate'
        ? new Date(a.dueDate).getTime()
        : new Date(a.createdAt).getTime();
    const bValue = sortBy === 'remaining'
      ? b.remaining
      : sortBy === 'dueDate'
        ? new Date(b.dueDate).getTime()
        : new Date(b.createdAt).getTime();

    if (aValue === bValue) return 0;
    return aValue > bValue ? direction : -direction;
  });
}

export function matchesLedgerSearch(ledger: AccountsLedger, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;

  const haystack = [
    ledger.code,
    ledger.description,
    ledger.invoiceNumber,
    ledger.notes,
    ledger.customerCode,
    ledger.bookingCode,
    ledger.booking?.bookingCode,
    ledger.booking?.pnr,
    ledger.customer?.fullName,
    ledger.customer?.customerCode,
    ledger.supplier?.name,
    getLedgerBookingRef(ledger),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(query);
}
