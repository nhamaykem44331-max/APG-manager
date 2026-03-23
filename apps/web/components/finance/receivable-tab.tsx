'use client';
// APG Manager RMS - ReceivableTab: Tab Phải thu (AR)
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowDownCircle, AlertTriangle, Search, User, Building2 } from 'lucide-react';
import { ledgerApi } from '@/lib/api';
import { cn, formatVND, formatDate, LEDGER_PARTY_LABELS, DEBT_STATUS_LABELS, DEBT_STATUS_CLASSES } from '@/lib/utils';
import { PaymentModal } from './payment-modal';
import type { AccountsLedger } from '@/types';

const SUB_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'CUSTOMER_INDIVIDUAL', label: 'Khách lẻ' },
  { key: 'CUSTOMER_CORPORATE', label: 'Khách DN' },
  { key: 'OVERDUE', label: '🔴 Quá hạn' },
];

export function ReceivableTab() {
  const [subTab, setSubTab] = useState('');
  const [search, setSearch] = useState('');
  const [paying, setPaying] = useState<AccountsLedger | null>(null);

  const params: Record<string, string> = { direction: 'RECEIVABLE', pageSize: '50' };
  if (subTab === 'OVERDUE') params.status = 'OVERDUE';
  else if (subTab) params.partyType = subTab;
  if (search) params.search = search;

  const { data, isLoading } = useQuery({
    queryKey: ['ledger', 'RECEIVABLE', subTab, search],
    queryFn: () => ledgerApi.list(params).then((r) => r.data),
  });

  const ledgers: AccountsLedger[] = data?.data ?? [];
  const totalAR = ledgers.reduce((s, l) => s + Number(l.remaining), 0);
  const overdueAR = ledgers.filter((l) => l.status === 'OVERDUE').reduce((s, l) => s + Number(l.remaining), 0);

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng phải thu', value: formatVND(totalAR), color: 'text-blue-500' },
          { label: 'Quá hạn', value: formatVND(overdueAR), color: 'text-red-500' },
          { label: 'Khách lẻ', value: String(ledgers.filter(l => l.partyType === 'CUSTOMER_INDIVIDUAL').length) + ' KH', color: 'text-foreground' },
          { label: 'Khách DN', value: String(ledgers.filter(l => l.partyType === 'CUSTOMER_CORPORATE').length) + ' DN', color: 'text-foreground' },
        ].map((k) => (
          <div key={k.label} className="card p-4">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className={cn('text-lg font-bold mt-1', k.color)}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Sub-tabs + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {SUB_TABS.map((t) => (
            <button key={t.key} onClick={() => setSubTab(t.key)}
              className={cn('px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
                subTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >{t.label}</button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" placeholder="Tìm mã, tên KH, mã booking..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : ledgers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Không có dữ liệu</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Mã CN', 'Khách hàng', 'Loại', 'Tổng nợ', 'Đã trả', 'Còn lại', 'Hạn', 'Trạng thái', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ledgers.map((l) => {
                  const isOverdue = l.status === 'OVERDUE';
                  const partyName = l.customer?.fullName ?? l.supplier?.name ?? l.customerCode ?? '—';
                  return (
                    <tr key={l.id} className={cn('hover:bg-muted/30 transition-colors', isOverdue && 'bg-red-500/5')}>
                      <td className="px-4 py-2.5 font-mono text-xs text-primary">{l.code}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {l.partyType === 'CUSTOMER_INDIVIDUAL' ? <User className="w-3 h-3 text-muted-foreground" /> : <Building2 className="w-3 h-3 text-muted-foreground" />}
                          <span className="font-medium text-foreground text-xs">{partyName}</span>
                        </div>
                        {l.description && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[150px]">{l.description}</p>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{LEDGER_PARTY_LABELS[l.partyType]}</td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-foreground">{formatVND(l.totalAmount)}</td>
                      <td className="px-4 py-2.5 text-xs text-emerald-600">{formatVND(l.paidAmount)}</td>
                      <td className="px-4 py-2.5 text-xs font-bold text-red-500">{formatVND(l.remaining)}</td>
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
                        {l.status !== 'PAID' && l.status !== 'WRITTEN_OFF' && (
                          <button onClick={() => setPaying(l)}
                            className="px-2.5 py-1 text-[10px] bg-emerald-600 text-white rounded-md hover:bg-emerald-700 whitespace-nowrap"
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
