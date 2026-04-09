'use client';

import { cn } from '@/lib/utils';
import type { AccountsLedger, DebtStatus, LedgerCategory } from '@/types';

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

export interface LedgerCategoryEntry {
  key: string;
  category?: LedgerCategory;
  serviceCode?: string | null;
}

export const LEDGER_CATEGORY_LABELS: Record<LedgerCategory, string> = {
  TICKET: 'V\u00e9',
  TICKET_CHANGE: '\u0110\u1ed5i v\u00e9',
  TICKET_REFUND: 'Ho\u00e0n v\u00e9',
  HLKG: 'HLKG',
  SERVICE: 'D\u1ecbch v\u1ee5',
};

export function getLedgerCategoryLabel(category?: LedgerCategory) {
  return category ? LEDGER_CATEGORY_LABELS[category] : 'Kh\u00e1c';
}

export function getLedgerCategoryBadgeClass(category?: LedgerCategory) {
  return cn(
    'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
    category === 'TICKET' && 'border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-300',
    category === 'TICKET_CHANGE' && 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-300',
    category === 'TICKET_REFUND' && 'border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-300',
    category === 'HLKG' && 'border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-300',
    category === 'SERVICE' && 'border-teal-500/25 bg-teal-500/10 text-teal-600 dark:text-teal-300',
    !category && 'border-border bg-muted text-muted-foreground',
  );
}

export function getLedgerCategoryEntries(ledgers: AccountsLedger[]): LedgerCategoryEntry[] {
  const entries = new Map<string, LedgerCategoryEntry>();

  for (const ledger of ledgers) {
    const category = ledger.category;
    const serviceCode = ledger.serviceCode ?? null;
    const key = `${category ?? 'UNKNOWN'}:${serviceCode ?? ''}`;

    if (!entries.has(key)) {
      entries.set(key, { key, category, serviceCode });
    }
  }

  return [...entries.values()];
}

export function getLedgerBookingRef(ledger: AccountsLedger) {
  return ledger.booking?.pnr ?? ledger.booking?.bookingCode ?? ledger.bookingCode ?? ledger.code;
}

export function getLedgerLatestPaymentAt(ledgers: AccountsLedger[]) {
  return ledgers
    .flatMap((ledger) => ledger.payments ?? [])
    .filter((payment) => payment.method !== 'DEBT')
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
    ledger.category,
    ledger.serviceCode,
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
