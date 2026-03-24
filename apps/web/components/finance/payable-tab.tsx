'use client';
// APG Manager RMS - PayableTab: Tab Phải trả (AP)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Search } from 'lucide-react';
import { ledgerApi } from '@/lib/api';
import { cn, formatVND, formatDate, LEDGER_PARTY_LABELS, DEBT_STATUS_LABELS, DEBT_STATUS_CLASSES } from '@/lib/utils';
import { PaymentModal } from './payment-modal';
import type { AccountsLedger } from '@/types';

const SUB_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'AIRLINE', label: '✈️ Hãng bay' },
  { key: 'GDS_PROVIDER', label: '🖥️ GDS' },
  { key: 'PARTNER', label: '🤝 Đối tác' },
  { key: 'OVERDUE', label: '🔴 Quá hạn' },
];

export function PayableTab() {
  const [subTab, setSubTab] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('dueDate:asc');
  const [paying, setPaying] = useState<AccountsLedger | null>(null);

  const [sortBy, sortOrder] = sort.split(':');
  const params: Record<string, string> = { direction: 'PAYABLE', pageSize: '50', sortBy, sortOrder };
  if (subTab === 'OVERDUE') params.status = 'OVERDUE';
  else if (subTab) params.partyType = subTab;
  if (search) params.search = search;

  const { data, isLoading } = useQuery({
    queryKey: ['ledger', 'PAYABLE', subTab, search, sort],
    queryFn: () => ledgerApi.list(params).then((r) => r.data),
  });

  const ledgers: AccountsLedger[] = data?.data ?? [];
  const totalAP = ledgers.reduce((s, l) => s + Number(l.remaining), 0);
  const overdueAP = ledgers.filter((l) => l.status === 'OVERDUE').reduce((s, l) => s + Number(l.remaining), 0);
  const airlineAP = ledgers.filter((l) => l.partyType === 'AIRLINE').length;
  const gdsAP = ledgers.filter((l) => l.partyType === 'GDS_PROVIDER').length;

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng phải trả', value: formatVND(totalAP), color: 'text-orange-500' },
          { label: 'Quá hạn', value: formatVND(overdueAP), color: 'text-red-500' },
          { label: 'Hãng bay', value: `${airlineAP} HB`, color: 'text-foreground' },
          { label: 'GDS', value: `${gdsAP} khoản`, color: 'text-foreground' },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn('text-lg font-bold mt-1', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-4 border-b border-border w-full sm:w-auto">
          {SUB_TABS.map((t) => (
            <button key={t.key} onClick={() => setSubTab(t.key)}
              className={cn('pb-3 pt-1 text-[13px] font-medium transition-colors border-b-2 -mb-px whitespace-nowrap',
                subTab === t.key ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              )}
            >{t.label}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" placeholder="Tìm mã, NCC, hóa đơn..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Sort */}
      <div className="flex gap-2 text-xs">
        {[
          { key: 'remaining:desc', label: 'Nợ nhiều nhất' },
          { key: 'remaining:asc', label: 'Nợ ít nhất' },
          { key: 'dueDate:asc', label: 'Sắp đến hạn' },
          { key: 'createdAt:desc', label: 'Mới nhất' },
        ].map((s) => (
          <button key={s.key} onClick={() => setSort(s.key)}
            className={cn('px-2.5 py-1 rounded-md font-medium transition-colors',
              sort === s.key ? 'bg-foreground text-background' : 'bg-accent text-muted-foreground hover:text-foreground'
            )}
          >{s.label}</button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : ledgers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Không có dữ liệu phải trả</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Mã CN', 'NCC / Đối tác', 'Loại', 'Hóa đơn', 'Tổng nợ', 'Đã trả', 'Còn lại', 'Hạn', 'Trạng thái', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledgers.map((l) => {
                  const isOverdue = l.status === 'OVERDUE';
                  const partyName = l.supplier?.name ?? l.customerCode ?? '—';
                  return (
                    <tr key={l.id} className={cn('hover:bg-muted/30 transition-colors', isOverdue && 'bg-red-500/5')}>
                      <td className="px-4 py-2.5 font-mono text-xs text-orange-500">{l.code}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground text-xs">{partyName}</p>
                        {l.description && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[150px]">{l.description}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{LEDGER_PARTY_LABELS[l.partyType]}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{l.invoiceNumber ?? '—'}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold">{formatVND(l.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-xs text-emerald-600">{formatVND(l.paidAmount)}</td>
                      <td className="px-4 py-2.5 text-xs font-bold text-orange-500">{formatVND(l.remaining)}</td>
                      <td className={cn('px-4 py-2.5 text-xs', isOverdue && 'text-red-500 font-semibold')}>
                        {isOverdue && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                        {formatDate(l.dueDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium', DEBT_STATUS_CLASSES[l.status])}>
                          {DEBT_STATUS_LABELS[l.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {l.status !== 'PAID' && (
                          <button onClick={() => setPaying(l)}
                            className="px-2.5 py-1 text-[10px] bg-orange-600 text-white rounded-md hover:bg-orange-700 whitespace-nowrap"
                          >Ghi TT</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {paying && <PaymentModal ledger={paying} onClose={() => setPaying(null)} />}
    </div>
  );
}
