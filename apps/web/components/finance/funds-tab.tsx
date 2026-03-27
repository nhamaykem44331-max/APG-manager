'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, CreditCard, Landmark, Pencil, RefreshCcw, Search, ShieldCheck, Trash2, Wallet, X } from 'lucide-react';
import { fundsApi } from '@/lib/api';
import { CASHFLOW_CATEGORY_LABELS, cn, formatDateTime, formatVND, parseMoneyInput } from '@/lib/utils';
import { MoneyInput } from '@/components/ui/money-input';
import type { CashFlowEntry, CashFlowSourceType, FundAccount, FundLedgerResponse, FundsOverview } from '@/types';

const funds = [
  { value: 'CASH_OFFICE', label: 'Quỹ tiền mặt VP', short: 'TM VP', icon: Wallet, tone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { value: 'BANK_HTX', label: 'TK BIDV HTX', short: 'BIDV HTX', icon: Landmark, tone: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  { value: 'BANK_PERSONAL', label: 'TK MB cá nhân', short: 'MB cá nhân', icon: CreditCard, tone: 'text-orange-500 bg-orange-500/10 border-orange-500/20' },
] as const satisfies Array<{ value: FundAccount; label: string; short: string; icon: typeof Wallet; tone: string }>;

const sourceOptions: Array<{ value: '' | CashFlowSourceType; label: string }> = [
  { value: '', label: 'Tất cả nguồn' },
  { value: 'MANUAL', label: 'Thủ công' },
  { value: 'BOOKING_PAYMENT', label: 'Booking' },
  { value: 'LEDGER_PAYMENT', label: 'Công nợ' },
  { value: 'OPERATING_EXPENSE', label: 'Chi phí VP' },
  { value: 'FUND_TRANSFER', label: 'Chuyển quỹ' },
  { value: 'FUND_ADJUSTMENT', label: 'Điều chỉnh' },
  { value: 'DEPOSIT_TOPUP', label: 'Deposit' },
];

const inputClass = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary';

function fundMeta(fund?: FundAccount | null) {
  return funds.find((item) => item.value === fund) ?? funds[0];
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['funds'] });
  qc.invalidateQueries({ queryKey: ['cashflow'] });
}

export function FundsTab() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const defaultPic = session?.user?.name ?? 'Finance';
  const [search, setSearch] = useState('');
  const [fundFilter, setFundFilter] = useState<'' | FundAccount>('');
  const [sourceFilter, setSourceFilter] = useState<'' | CashFlowSourceType>('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [entry, setEntry] = useState<CashFlowEntry | null>(null);
  const [showEntry, setShowEntry] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [entryForm, setEntryForm] = useState({ direction: 'INFLOW', category: 'OTHER', amount: '', fundAccount: 'CASH_OFFICE' as FundAccount, pic: defaultPic, description: '', reference: '', date: new Date().toISOString().slice(0, 10), notes: '', reason: '' });
  const [adjustForm, setAdjustForm] = useState({ fundAccount: 'CASH_OFFICE' as FundAccount, targetBalance: '', reason: '', pic: defaultPic, date: new Date().toISOString().slice(0, 10), description: '', reference: '', notes: '' });
  const [transferForm, setTransferForm] = useState({ fromFundAccount: 'CASH_OFFICE' as FundAccount, toFundAccount: 'BANK_HTX' as FundAccount, amount: '', reason: '', pic: defaultPic, date: new Date().toISOString().slice(0, 10), description: '', reference: '', notes: '' });

  const params: Record<string, string | number> = { page: 1, pageSize: 50 };
  if (search) params.search = search;
  if (fundFilter) params.fundAccount = fundFilter;
  if (sourceFilter) params.sourceType = sourceFilter;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  const { data: summary } = useQuery({ queryKey: ['funds', 'summary'], queryFn: () => fundsApi.getSummary().then((r) => r.data as FundsOverview) });
  const { data: ledger, isLoading } = useQuery({ queryKey: ['funds', 'ledger', params], queryFn: () => fundsApi.listLedger(params).then((r) => r.data as FundLedgerResponse) });

  const createEntry = useMutation({ mutationFn: () => fundsApi.createEntry({ direction: entryForm.direction, category: entryForm.category, amount: parseMoneyInput(entryForm.amount), fundAccount: entryForm.fundAccount, pic: entryForm.pic, description: entryForm.description, reference: entryForm.reference || undefined, date: entryForm.date, notes: entryForm.notes || undefined }), onSuccess: () => { invalidate(qc); setShowEntry(false); setEntry(null); } });
  const updateEntry = useMutation({ mutationFn: () => fundsApi.updateEntry(entry!.id, { direction: entryForm.direction, category: entryForm.category, amount: parseMoneyInput(entryForm.amount), fundAccount: entryForm.fundAccount, pic: entryForm.pic, description: entryForm.description, reference: entryForm.reference || undefined, date: entryForm.date, notes: entryForm.notes || undefined, reason: entryForm.reason || undefined }), onSuccess: () => { invalidate(qc); setShowEntry(false); setEntry(null); } });
  const adjust = useMutation({ mutationFn: () => fundsApi.adjustBalance({ fundAccount: adjustForm.fundAccount, targetBalance: parseMoneyInput(adjustForm.targetBalance), reason: adjustForm.reason, pic: adjustForm.pic, date: adjustForm.date, description: adjustForm.description || undefined, reference: adjustForm.reference || undefined, notes: adjustForm.notes || undefined }), onSuccess: () => { invalidate(qc); setShowAdjust(false); } });
  const transfer = useMutation({ mutationFn: () => entry?.transferGroupId ? fundsApi.updateTransfer(entry.id, { ...transferForm, amount: parseMoneyInput(transferForm.amount) }) : fundsApi.transfer({ ...transferForm, amount: parseMoneyInput(transferForm.amount) }), onSuccess: () => { invalidate(qc); setShowTransfer(false); setEntry(null); } });
  const remove = useMutation({ mutationFn: (id: string) => fundsApi.removeEntry(id), onSuccess: () => invalidate(qc) });

  const openManual = (direction: 'INFLOW' | 'OUTFLOW', row?: CashFlowEntry) => {
    setEntry(row ?? null);
    setEntryForm(row ? { direction: row.direction, category: row.category, amount: String(Number(row.amount ?? 0)), fundAccount: (row.fundAccount ?? 'CASH_OFFICE') as FundAccount, pic: row.pic, description: row.description, reference: row.reference ?? '', date: row.date.slice(0, 10), notes: row.notes ?? '', reason: row.reason ?? '' } : { direction, category: direction === 'INFLOW' ? 'TICKET_PAYMENT' : 'OTHER', amount: '', fundAccount: direction === 'INFLOW' ? 'BANK_HTX' : 'CASH_OFFICE', pic: defaultPic, description: '', reference: '', date: new Date().toISOString().slice(0, 10), notes: '', reason: '' });
    setShowEntry(true);
  };

  const openTransfer = (row?: CashFlowEntry) => {
    setEntry(row ?? null);
    setTransferForm(row ? { fromFundAccount: (row.direction === 'OUTFLOW' ? row.fundAccount : row.counterpartyFundAccount) as FundAccount, toFundAccount: (row.direction === 'INFLOW' ? row.fundAccount : row.counterpartyFundAccount) as FundAccount, amount: String(Number(row.amount ?? 0)), reason: row.reason ?? '', pic: row.pic, date: row.date.slice(0, 10), description: row.description, reference: row.reference ?? '', notes: row.notes ?? '' } : { fromFundAccount: 'CASH_OFFICE', toFundAccount: 'BANK_HTX', amount: '', reason: '', pic: defaultPic, date: new Date().toISOString().slice(0, 10), description: '', reference: '', notes: '' });
    setShowTransfer(true);
  };

  const rows = ledger?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Sổ quỹ hệ thống</p>
          <p className="mt-2 text-3xl font-bold font-tabular tracking-tight text-foreground">{formatVND(summary?.totalBalance ?? 0)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Số dư quỹ chạy liên tục, điều chỉnh có lý do, chuyển quỹ đối ứng 2 đầu và khóa chứng từ nguồn.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openManual('INFLOW')} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"><ArrowDownLeft className="h-4 w-4" />Thu công</button>
          <button onClick={() => openManual('OUTFLOW')} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"><ArrowUpRight className="h-4 w-4" />Chi công</button>
          <button onClick={() => openTransfer()} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"><ArrowRightLeft className="h-4 w-4" />Chuyển quỹ nội bộ</button>
          <button onClick={() => setShowAdjust(true)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"><RefreshCcw className="h-4 w-4" />Điều chỉnh số dư</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(summary?.funds ?? funds.map((item) => ({ fund: item.value, label: item.label, inflow: 0, outflow: 0, balance: 0, movementCount: 0 }))).map((item) => {
          const meta = fundMeta(item.fund);
          const Icon = meta.icon;
          return <div key={item.fund} className={cn('card border p-5', meta.tone.split(' ')[2])}><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className={cn('flex h-11 w-11 items-center justify-center rounded-xl', meta.tone.split(' ')[1])}><Icon className={cn('h-5 w-5', meta.tone.split(' ')[0])} /></div><div><p className="text-sm font-semibold text-foreground">{item.label}</p><p className="text-xs text-muted-foreground">Mã quỹ: {item.fund}</p></div></div><div className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{item.movementCount} GD</div></div><p className="mt-5 text-3xl font-bold font-tabular tracking-tight text-foreground">{formatVND(item.balance)}</p><div className="mt-4 grid grid-cols-2 gap-3 border-t border-border/60 pt-4"><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tiền vào</p><p className="mt-1 text-sm font-semibold font-tabular text-emerald-500">{formatVND(item.inflow)}</p></div><div><p className="text-[10px] uppercase tracking-wide text-muted-foreground">Tiền ra</p><p className="mt-1 text-sm font-semibold font-tabular text-red-500">{formatVND(item.outflow)}</p></div></div></div>;
        })}
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mô tả, tham chiếu, lý do..." className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" /></div>
          <select value={fundFilter} onChange={(e) => setFundFilter(e.target.value as '' | FundAccount)} className={inputClass}><option value="">Tất cả quỹ</option>{funds.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as '' | CashFlowSourceType)} className={inputClass}>{sourceOptions.map((o) => <option key={o.label} value={o.value}>{o.label}</option>)}</select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Sổ chi tiết quỹ</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Chứng từ booking, công nợ, chi phí và deposit tự động bị khóa; giao dịch thủ công mới được sửa xóa tại sổ quỹ.
          </p>
        </div>
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Đang tải sổ quỹ...</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Chưa có giao dịch quỹ nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {['Ngày', 'Quỹ', 'Nguồn', 'Mô tả', 'Thu/Chi', 'Số dư sau', 'Hành động'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const meta = fundMeta(row.fundAccount);
                  const Icon = meta.icon;
                  const locked = !!row.isLocked;
                  const isTransfer = row.sourceType === 'FUND_TRANSFER' && row.transferGroupId;

                  return (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <p className="text-sm font-medium text-foreground">{formatDateTime(row.date)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{row.pic}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex items-center gap-2">
                          <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', meta.tone.split(' ')[1])}>
                            <Icon className={cn('h-4 w-4', meta.tone.split(' ')[0])} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{meta.short}</p>
                            {row.counterpartyFundAccount ? (
                              <p className="text-xs text-muted-foreground">Đối ứng: {fundMeta(row.counterpartyFundAccount).short}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2 py-1 text-[11px] font-medium',
                            locked ? 'border-blue-500/30 bg-blue-500/10 text-blue-400' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
                          )}
                        >
                          {row.sourceLabel ?? row.sourceType ?? 'Legacy'}
                        </span>
                        {locked ? (
                          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
                            Sửa tại chứng từ nguồn
                          </p>
                        ) : null}
                      </td>
                      <td className="max-w-[340px] px-4 py-3 align-top">
                        <p className="text-sm font-medium text-foreground">{row.description}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {CASHFLOW_CATEGORY_LABELS[row.category] ?? row.category}
                          {row.reference ? ` - ${row.reference}` : ''}
                        </p>
                        {row.reason ? (
                          <p className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-xs text-amber-300">
                            Lý do: {row.reason}
                          </p>
                        ) : null}
                      </td>
                      <td
                        className={cn(
                          'whitespace-nowrap px-4 py-3 align-top text-sm font-bold font-tabular',
                          row.direction === 'INFLOW' ? 'text-emerald-500' : 'text-red-500',
                        )}
                      >
                        {row.direction === 'INFLOW' ? '+' : '-'}
                        {formatVND(row.amount)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top text-sm font-semibold font-tabular text-foreground">
                        {formatVND(row.balanceAfter)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 align-top">
                        <div className="flex gap-2">
                          {locked ? (
                            <span className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground">Khóa</span>
                          ) : (
                            <>
                              <button
                                onClick={() => (isTransfer ? openTransfer(row) : openManual(row.direction, row))}
                                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Sửa
                              </button>
                              <button
                                onClick={() => window.confirm(`Bạn chắc chắn muốn xóa "${row.description}"?`) && remove.mutate(row.id)}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-500/20 px-2.5 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                Xóa
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showEntry ? (
        <Modal title={entry ? 'Chỉnh sửa giao dịch quỹ' : 'Phiếu thu/chi quỹ'} onClose={() => { setShowEntry(false); setEntry(null); }}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setEntryForm((s) => ({ ...s, direction: 'INFLOW' }))} className={cn('rounded-lg border px-3 py-2 text-sm font-medium', entryForm.direction === 'INFLOW' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-border text-muted-foreground')}>Thu vào</button>
              <button onClick={() => setEntryForm((s) => ({ ...s, direction: 'OUTFLOW' }))} className={cn('rounded-lg border px-3 py-2 text-sm font-medium', entryForm.direction === 'OUTFLOW' ? 'border-red-500 bg-red-500/10 text-red-400' : 'border-border text-muted-foreground')}>Chi ra</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select value={entryForm.category} onChange={(e) => setEntryForm((s) => ({ ...s, category: e.target.value }))} className={inputClass}>{Object.entries(CASHFLOW_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <select value={entryForm.fundAccount} onChange={(e) => setEntryForm((s) => ({ ...s, fundAccount: e.target.value as FundAccount }))} className={inputClass}>{funds.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
            </div>
            <MoneyInput label="Số tiền" required value={entryForm.amount} onChange={(value) => setEntryForm((s) => ({ ...s, amount: value }))} />
            <input value={entryForm.description} onChange={(e) => setEntryForm((s) => ({ ...s, description: e.target.value }))} placeholder="Mô tả giao dịch" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input value={entryForm.reference} onChange={(e) => setEntryForm((s) => ({ ...s, reference: e.target.value }))} placeholder="Tham chiếu" className={inputClass} />
              <input value={entryForm.pic} onChange={(e) => setEntryForm((s) => ({ ...s, pic: e.target.value }))} placeholder="PIC" className={inputClass} />
            </div>
            <input type="date" value={entryForm.date} onChange={(e) => setEntryForm((s) => ({ ...s, date: e.target.value }))} className={inputClass} />
            {entry?.sourceType === 'FUND_ADJUSTMENT' ? <input value={entryForm.reason} onChange={(e) => setEntryForm((s) => ({ ...s, reason: e.target.value }))} placeholder="Lý do điều chỉnh" className={inputClass} /> : null}
            <textarea rows={3} value={entryForm.notes} onChange={(e) => setEntryForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Ghi chú" className={cn(inputClass, 'resize-none')} />
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setShowEntry(false); setEntry(null); }} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent">Hủy</button>
              <button onClick={() => entry ? updateEntry.mutate() : createEntry.mutate()} disabled={(createEntry.isPending || updateEntry.isPending) || !entryForm.amount || !entryForm.description || !entryForm.pic} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">Lưu</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showAdjust ? (
        <Modal title="Điều chỉnh số dư quỹ" onClose={() => setShowAdjust(false)}>
          <div className="space-y-3">
            <select value={adjustForm.fundAccount} onChange={(e) => setAdjustForm((s) => ({ ...s, fundAccount: e.target.value as FundAccount }))} className={inputClass}>{funds.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select>
            <MoneyInput label="Số dư mục tiêu" required value={adjustForm.targetBalance} onChange={(value) => setAdjustForm((s) => ({ ...s, targetBalance: value }))} />
            <input value={adjustForm.reason} onChange={(e) => setAdjustForm((s) => ({ ...s, reason: e.target.value }))} placeholder="Lý do điều chỉnh bắt buộc" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input value={adjustForm.pic} onChange={(e) => setAdjustForm((s) => ({ ...s, pic: e.target.value }))} placeholder="PIC" className={inputClass} />
              <input type="date" value={adjustForm.date} onChange={(e) => setAdjustForm((s) => ({ ...s, date: e.target.value }))} className={inputClass} />
            </div>
            <input value={adjustForm.description} onChange={(e) => setAdjustForm((s) => ({ ...s, description: e.target.value }))} placeholder="Mô tả chứng từ" className={inputClass} />
            <input value={adjustForm.reference} onChange={(e) => setAdjustForm((s) => ({ ...s, reference: e.target.value }))} placeholder="Số chứng từ" className={inputClass} />
            <textarea rows={3} value={adjustForm.notes} onChange={(e) => setAdjustForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Ghi chú" className={cn(inputClass, 'resize-none')} />
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">Điều chỉnh số dư bắt buộc phải có lý do để đối chiếu về sau.</div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setShowAdjust(false)} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent">Hủy</button>
              <button onClick={() => adjust.mutate()} disabled={adjust.isPending || !adjustForm.targetBalance || !adjustForm.reason || !adjustForm.pic} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">Xác nhận</button>
            </div>
          </div>
        </Modal>
      ) : null}

      {showTransfer ? (
        <Modal title={entry?.transferGroupId ? 'Chỉnh sửa chuyển quỹ nội bộ' : 'Chuyển quỹ nội bộ'} onClose={() => { setShowTransfer(false); setEntry(null); }}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select value={transferForm.fromFundAccount} onChange={(e) => setTransferForm((s) => ({ ...s, fromFundAccount: e.target.value as FundAccount }))} className={inputClass}>{funds.map((f) => <option key={f.value} value={f.value}>Từ: {f.label}</option>)}</select>
              <select value={transferForm.toFundAccount} onChange={(e) => setTransferForm((s) => ({ ...s, toFundAccount: e.target.value as FundAccount }))} className={inputClass}>{funds.map((f) => <option key={f.value} value={f.value}>Đến: {f.label}</option>)}</select>
            </div>
            <MoneyInput label="Số tiền chuyển" required value={transferForm.amount} onChange={(value) => setTransferForm((s) => ({ ...s, amount: value }))} />
            <input value={transferForm.reason} onChange={(e) => setTransferForm((s) => ({ ...s, reason: e.target.value }))} placeholder="Lý do chuyển quỹ" className={inputClass} />
            <div className="grid grid-cols-2 gap-3">
              <input value={transferForm.pic} onChange={(e) => setTransferForm((s) => ({ ...s, pic: e.target.value }))} placeholder="PIC" className={inputClass} />
              <input type="date" value={transferForm.date} onChange={(e) => setTransferForm((s) => ({ ...s, date: e.target.value }))} className={inputClass} />
            </div>
            <input value={transferForm.description} onChange={(e) => setTransferForm((s) => ({ ...s, description: e.target.value }))} placeholder="Diễn giải" className={inputClass} />
            <input value={transferForm.reference} onChange={(e) => setTransferForm((s) => ({ ...s, reference: e.target.value }))} placeholder="Số chứng từ" className={inputClass} />
            <textarea rows={3} value={transferForm.notes} onChange={(e) => setTransferForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Ghi chú" className={cn(inputClass, 'resize-none')} />
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">Mỗi lần chuyển quỹ tạo đồng thời 1 bút toán chi ở quỹ nguồn và 1 bút toán thu ở quỹ đích.</div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setShowTransfer(false); setEntry(null); }} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent">Hủy</button>
              <button onClick={() => transfer.mutate()} disabled={transfer.isPending || !transferForm.amount || !transferForm.reason || !transferForm.pic || transferForm.fromFundAccount === transferForm.toFundAccount} className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50">{entry?.transferGroupId ? 'Cập nhật' : 'Xác nhận'}</button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl"><div className="flex items-center justify-between border-b border-border px-5 py-4"><h2 className="text-sm font-semibold text-foreground">{title}</h2><button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></div><div className="p-5">{children}</div></div></div>;
}
