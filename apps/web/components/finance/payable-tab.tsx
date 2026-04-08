'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Search } from 'lucide-react';
import { ledgerApi } from '@/lib/api';
import {
  cn,
  DEBT_STATUS_CLASSES,
  DEBT_STATUS_LABELS,
  formatDate,
  formatVND,
  LEDGER_PARTY_LABELS,
} from '@/lib/utils';
import { PaymentModal } from './payment-modal';
import {
  getLedgerBookingRef,
  getLedgerCategoryBadgeClass,
  getLedgerCategoryEntries,
  getLedgerCategoryLabel,
  getLedgerGroupMetrics,
  matchesLedgerSearch,
  sortLedgerRows,
  type LedgerCategoryEntry,
  type LedgerGroupMetrics,
  type LedgerSortKey,
} from './ledger-tab-helpers';
import type { AccountsLedger, DebtStatus, LedgerCategory, LedgerPartyType } from '@/types';

type ViewMode = 'PNR' | 'SUPPLIER';

interface PartyOption {
  key: string;
  label: string;
  remaining: number;
}

interface PayablePnrRow extends LedgerGroupMetrics {
  key: string;
  bookingRef: string;
  supplierKey: string;
  supplierName: string;
  supplierCode?: string | null;
  partyType: LedgerPartyType;
  categoryEntries: LedgerCategoryEntry[];
  invoiceNumber?: string | null;
  paymentTargets: AccountsLedger[];
}

interface PayableSupplierRow extends LedgerGroupMetrics {
  key: string;
  supplierName: string;
  supplierCode?: string | null;
  partyType: LedgerPartyType;
  categoryEntries: LedgerCategoryEntry[];
  pnrCount: number;
}

const VIEW_TABS: Array<{ key: ViewMode; label: string }> = [
  { key: 'PNR', label: 'Theo PNR' },
  { key: 'SUPPLIER', label: 'Theo nhà NCC/Đối tác' },
];

const SORT_OPTIONS: Array<{ key: LedgerSortKey; label: string }> = [
  { key: 'remaining:desc', label: 'Nợ nhiều nhất' },
  { key: 'remaining:asc', label: 'Nợ ít nhất' },
  { key: 'dueDate:asc', label: 'Sắp đến hạn' },
  { key: 'createdAt:desc', label: 'Mới nhất' },
];

function getPayablePartyKey(ledger: AccountsLedger) {
  return ledger.supplierId ?? ledger.supplier?.code ?? ledger.supplier?.name ?? ledger.customerCode ?? 'unknown-supplier';
}

const CATEGORY_FILTER_OPTIONS: Array<{ value: 'ALL' | LedgerCategory; label: string }> = [
  { value: 'ALL', label: 'T\u1ea5t c\u1ea3 lo\u1ea1i' },
  { value: 'TICKET', label: 'V\u00e9' },
  { value: 'TICKET_CHANGE', label: '\u0110\u1ed5i v\u00e9' },
  { value: 'TICKET_REFUND', label: 'Ho\u00e0n v\u00e9' },
  { value: 'HLKG', label: 'HLKG' },
  { value: 'SERVICE', label: 'D\u1ecbch v\u1ee5' },
];

function getPayablePartyName(ledger: AccountsLedger) {
  return ledger.supplier?.name ?? ledger.customerCode ?? 'Chưa gán NCC';
}

function getGroupStatusClass(status: DebtStatus) {
  return cn('text-[10px] px-2 py-0.5 rounded-full font-medium', DEBT_STATUS_CLASSES[status]);
}

function CategoryBadges({ entries }: { entries: LedgerCategoryEntry[] }) {
  const visibleEntries = entries.slice(0, 2);
  const hiddenCount = entries.length - visibleEntries.length;

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleEntries.map((entry) => (
        <div key={entry.key} className="flex items-center gap-1">
          <span className={getLedgerCategoryBadgeClass(entry.category)}>
            {getLedgerCategoryLabel(entry.category)}
          </span>
          {entry.serviceCode && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              {entry.serviceCode}
            </span>
          )}
        </div>
      ))}
      {hiddenCount > 0 && (
        <span className="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

export function PayableTab() {
  const [viewMode, setViewMode] = useState<ViewMode>('PNR');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<LedgerSortKey>('remaining:desc');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | LedgerCategory>('ALL');
  const [paying, setPaying] = useState<AccountsLedger[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ledger', 'PAYABLE', 'full-list'],
    queryFn: () =>
      ledgerApi
        .list({ direction: 'PAYABLE', pageSize: '1000', sortBy: 'createdAt', sortOrder: 'desc' })
        .then((response) => response.data),
  });

  const ledgers: AccountsLedger[] = data?.data ?? [];
  const outstandingLedgers = useMemo(
    () => ledgers.filter((ledger) => Number(ledger.remaining) > 0),
    [ledgers],
  );

  const supplierOptions = useMemo<PartyOption[]>(() => {
    const groups = new Map<string, { label: string; remaining: number }>();

    for (const ledger of outstandingLedgers) {
      const key = getPayablePartyKey(ledger);
      const existing = groups.get(key);
      if (existing) {
        existing.remaining += Number(ledger.remaining);
      } else {
        groups.set(key, {
          label: ledger.supplier?.code
            ? `${getPayablePartyName(ledger)} (${ledger.supplier.code})`
            : getPayablePartyName(ledger),
          remaining: Number(ledger.remaining),
        });
      }
    }

    return [...groups.entries()]
      .map(([key, value]) => ({ key, label: value.label, remaining: value.remaining }))
      .sort((a, b) => b.remaining - a.remaining);
  }, [outstandingLedgers]);

  const filteredLedgers = useMemo(
    () =>
      ledgers.filter((ledger) => {
        if (supplierFilter !== 'ALL' && getPayablePartyKey(ledger) !== supplierFilter) {
          return false;
        }
        if (categoryFilter !== 'ALL' && ledger.category !== categoryFilter) {
          return false;
        }
        return matchesLedgerSearch(ledger, search);
      }),
    [ledgers, search, supplierFilter, categoryFilter],
  );

  const pnrRows = useMemo<PayablePnrRow[]>(() => {
    const groups = new Map<string, AccountsLedger[]>();

    for (const ledger of filteredLedgers) {
      const key = `${getLedgerBookingRef(ledger)}::${getPayablePartyKey(ledger)}`;
      const bucket = groups.get(key) ?? [];
      bucket.push(ledger);
      groups.set(key, bucket);
    }

    const rows = [...groups.entries()].map(([key, bucket]) => {
      const first = bucket[0];
      const metrics = getLedgerGroupMetrics(bucket);
      const openLedgers = bucket.filter(
        (ledger) => Number(ledger.remaining) > 0 && ledger.status !== 'WRITTEN_OFF',
      );

      return {
        key,
        bookingRef: getLedgerBookingRef(first),
        supplierKey: getPayablePartyKey(first),
        supplierName: getPayablePartyName(first),
        supplierCode: first.supplier?.code,
        partyType: first.partyType,
        categoryEntries: getLedgerCategoryEntries(bucket),
        invoiceNumber: bucket.length === 1 ? first.invoiceNumber : null,
        paymentTargets: openLedgers,
        ...metrics,
      };
    });

    return sortLedgerRows(rows, sort);
  }, [filteredLedgers, sort]);

  const supplierRows = useMemo<PayableSupplierRow[]>(() => {
    const groups = new Map<string, AccountsLedger[]>();

    for (const ledger of filteredLedgers) {
      const key = getPayablePartyKey(ledger);
      const bucket = groups.get(key) ?? [];
      bucket.push(ledger);
      groups.set(key, bucket);
    }

    const rows = [...groups.entries()].map(([key, bucket]) => {
      const first = bucket[0];
      const metrics = getLedgerGroupMetrics(bucket);
      const pnrCount = new Set(bucket.map((ledger) => getLedgerBookingRef(ledger))).size;

      return {
        key,
        supplierName: getPayablePartyName(first),
        supplierCode: first.supplier?.code,
        partyType: first.partyType,
        categoryEntries: getLedgerCategoryEntries(bucket),
        pnrCount,
        ...metrics,
      };
    });

    return sortLedgerRows(rows, sort);
  }, [filteredLedgers, sort]);

  const totalAP = outstandingLedgers.reduce((sum, ledger) => sum + Number(ledger.remaining), 0);
  const overdueAP = outstandingLedgers
    .filter(
      (ledger) =>
        ledger.status === 'OVERDUE' || new Date(ledger.dueDate).getTime() < Date.now(),
    )
    .reduce((sum, ledger) => sum + Number(ledger.remaining), 0);
  const activeSupplierCount = new Set(outstandingLedgers.map((ledger) => getPayablePartyKey(ledger))).size;
  const activePnrCount = new Set(outstandingLedgers.map((ledger) => getLedgerBookingRef(ledger))).size;
  const activeRows = viewMode === 'PNR' ? pnrRows : supplierRows;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng phải trả', value: formatVND(totalAP), color: 'text-orange-500' },
          { label: 'Quá hạn', value: formatVND(overdueAP), color: 'text-red-500' },
          { label: 'NCC / Đối tác đang nợ', value: `${activeSupplierCount} đơn vị`, color: 'text-foreground' },
          { label: 'PNR đang nợ', value: `${activePnrCount} PNR`, color: 'text-foreground' },
        ].map((kpi) => (
          <div key={kpi.label} className="card p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className={cn('text-lg font-bold mt-1', kpi.color)}>{kpi.value}</p>
          </div>
        ))}
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {VIEW_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                  viewMode === tab.key
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 md:flex-row xl:min-w-[620px]">
            <select
              value={supplierFilter}
              onChange={(event) => setSupplierFilter(event.target.value)}
              className="h-10 min-w-[240px] rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">Tất cả NCC / Đối tác</option>
              {supplierOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label} · {formatVND(option.remaining)}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value as 'ALL' | LedgerCategory)}
              className="h-10 min-w-[180px] rounded-lg border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {CATEGORY_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder={
                  viewMode === 'PNR'
                    ? 'Tìm PNR, mã booking, NCC, hóa đơn...'
                    : 'Tìm NCC, đối tác, mã công nợ...'
                }
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <p className="text-xs text-muted-foreground">
            {viewMode === 'PNR'
              ? 'Danh sách nợ chia theo từng PNR để ghi nhận thanh toán trực tiếp.'
              : 'Công nợ được gộp theo từng nhà cung cấp / đối tác để xem số nợ tổng.'}
          </p>

          <div className="flex flex-wrap gap-2 text-xs">
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setSort(option.key)}
                className={cn(
                  'rounded-md px-2.5 py-1 font-medium transition-colors',
                  sort === option.key
                    ? 'bg-foreground text-background'
                    : 'bg-accent text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : activeRows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Không có dữ liệu phải trả phù hợp</div>
        ) : viewMode === 'PNR' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['PNR / Booking', 'NCC / Đối tác', 'Loại', 'Tổng nợ', 'Đã trả', 'Còn lại', 'Hạn', 'Trạng thái', ''].map((header) => (
                    <th key={header} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pnrRows.map((row) => {
                  const isOverdue = row.status === 'OVERDUE';
                  return (
                    <tr key={row.key} className={cn('transition-colors hover:bg-muted/30', isOverdue && 'bg-red-500/5')}>
                      <td className="px-4 py-2.5">
                        <p className="font-mono text-xs font-semibold text-orange-500">{row.bookingRef}</p>
                        {row.invoiceNumber && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">Hóa đơn: {row.invoiceNumber}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-foreground">{row.supplierName}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{LEDGER_PARTY_LABELS[row.partyType]}</p>
                        {row.supplierCode && (
                          <p className="mt-0.5 text-[10px] font-mono text-primary">{row.supplierCode}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        <CategoryBadges entries={row.categoryEntries} />
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-foreground">{formatVND(row.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-xs text-emerald-600">{formatVND(row.paidAmount)}</td>
                      <td className="px-4 py-2.5 text-xs font-bold text-orange-500">{formatVND(row.remaining)}</td>
                      <td className={cn('px-4 py-2.5 text-xs', isOverdue && 'font-semibold text-red-500')}>
                        {isOverdue && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                        {formatDate(row.dueDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={getGroupStatusClass(row.status)}>{DEBT_STATUS_LABELS[row.status]}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {row.paymentTargets.length > 0 ? (
                          <button
                            onClick={() => setPaying(row.paymentTargets)}
                            className="whitespace-nowrap rounded-md bg-orange-600 px-2.5 py-1 text-[10px] text-white hover:bg-orange-700"
                          >
                            Ghi TT
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['NCC / Đối tác', 'Loại', 'PNR', 'Tổng nợ', 'Đã trả', 'Còn lại', 'Hạn gần nhất', 'Trạng thái', ''].map((header) => (
                    <th key={header} className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {supplierRows.map((row) => {
                  const isOverdue = row.status === 'OVERDUE';
                  return (
                    <tr key={row.key} className={cn('transition-colors hover:bg-muted/30', isOverdue && 'bg-red-500/5')}>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-medium text-foreground">{row.supplierName}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">{LEDGER_PARTY_LABELS[row.partyType]}</p>
                        {row.supplierCode && (
                          <p className="mt-0.5 text-[10px] font-mono text-primary">{row.supplierCode}</p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        <CategoryBadges entries={row.categoryEntries} />
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.pnrCount} PNR</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-foreground">{formatVND(row.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-xs text-emerald-600">{formatVND(row.paidAmount)}</td>
                      <td className="px-4 py-2.5 text-xs font-bold text-orange-500">{formatVND(row.remaining)}</td>
                      <td className={cn('px-4 py-2.5 text-xs', isOverdue && 'font-semibold text-red-500')}>
                        {isOverdue && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                        {formatDate(row.dueDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={getGroupStatusClass(row.status)}>{DEBT_STATUS_LABELS[row.status]}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => {
                            setViewMode('PNR');
                            setSupplierFilter(row.key);
                          }}
                          className="whitespace-nowrap rounded-md border border-border px-2.5 py-1 text-[10px] text-muted-foreground hover:text-foreground"
                        >
                          Xem PNR
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paying && <PaymentModal ledgers={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}
