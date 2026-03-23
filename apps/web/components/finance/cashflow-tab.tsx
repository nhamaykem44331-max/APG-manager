'use client';
// APG Manager RMS - CashFlowTab: Tab Dòng tiền thực tế (Phase B)
// Nguồn dữ liệu: Google Sheet "Dòng tiền KHÁCH LẺ"
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  TrendingUp, TrendingDown, ArrowLeftRight, Plus, Loader2, Search, X,
} from 'lucide-react';
import { cashflowApi } from '@/lib/api';
import {
  cn, formatVND, formatDate, CASHFLOW_CATEGORY_LABELS, CASHFLOW_CATEGORY_COLORS,
} from '@/lib/utils';
import type { CashFlowEntry, CashFlowSummary, MonthlyFlow } from '@/types';

const PICS = ['Ms Thanh', 'Mr Đức Anh', 'Mr Phong', 'Mr Giang', 'Mr Triết', 'Mr Chính'];

const CATEGORIES = Object.entries(CASHFLOW_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

export function CashFlowTab() {
  const qc = useQueryClient();
  const [dirFilter, setDirFilter] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [form, setForm] = useState({
    direction: 'INFLOW',
    category: 'TICKET_PAYMENT',
    amount: '',
    pic: 'Ms Thanh',
    description: '',
    reference: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const params: Record<string, string> = { pageSize: '50' };
  if (dirFilter) params.direction = dirFilter;
  if (catFilter) params.category = catFilter;
  if (search) params.search = search;

  const { data: summaryData } = useQuery({
    queryKey: ['cashflow', 'summary'],
    queryFn: () => cashflowApi.getSummary().then((r) => r.data as CashFlowSummary),
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['cashflow', 'list', dirFilter, catFilter, search],
    queryFn: () => cashflowApi.list(params).then((r) => r.data),
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['cashflow', 'monthly'],
    queryFn: () => cashflowApi.getMonthly().then((r) => r.data as MonthlyFlow[]),
  });

  const createMutation = useMutation({
    mutationFn: () => cashflowApi.create({
      ...form,
      amount: Number(form.amount.replace(/\./g, '')),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cashflow'] });
      setShowForm(false);
      setForm({ direction: 'INFLOW', category: 'TICKET_PAYMENT', amount: '', pic: 'Ms Thanh', description: '', reference: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    },
  });

  const entries: CashFlowEntry[] = listData?.data ?? [];
  const summary = summaryData;
  const monthly = monthlyData ?? [];

  // Format với dấu chấm khi nhập
  const handleAmountChange = (v: string) => {
    const raw = v.replace(/\D/g, '');
    const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setForm((f) => ({ ...f, amount: formatted }));
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="card p-4 border-l-4 border-l-emerald-500">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground">Tổng tiền vào</p>
            </div>
            <p className="text-xl font-bold text-emerald-500 mt-1">{formatVND(summary.totalInflow)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.inflowCount} giao dịch</p>
          </div>
          <div className="card p-4 border-l-4 border-l-red-500">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <p className="text-xs text-muted-foreground">Tổng tiền ra</p>
            </div>
            <p className="text-xl font-bold text-red-500 mt-1">{formatVND(summary.totalOutflow)}</p>
            <p className="text-[10px] text-muted-foreground">{summary.outflowCount} giao dịch</p>
          </div>
          <div className={cn('card p-4 border-l-4', summary.netCashFlow >= 0 ? 'border-l-blue-500' : 'border-l-orange-500')}>
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-blue-500" />
              <p className="text-xs text-muted-foreground">Dòng tiền ròng</p>
            </div>
            <p className={cn('text-xl font-bold mt-1', summary.netCashFlow >= 0 ? 'text-blue-500' : 'text-orange-500')}>
              {summary.netCashFlow >= 0 ? '+' : ''}{formatVND(summary.netCashFlow)}
            </p>
          </div>
        </div>
      )}

      {/* Monthly mini-chart */}
      {monthly.length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs font-semibold text-muted-foreground mb-3">Dòng tiền theo tháng</h3>
          <div className="flex items-end gap-1 h-16">
            {monthly.map((m) => {
              const maxVal = Math.max(...monthly.map((x) => Math.max(x.inflow ?? 0, x.outflow ?? 0)));
              const inH = maxVal > 0 ? ((m.inflow ?? 0) / maxVal) * 100 : 0;
              const outH = maxVal > 0 ? ((m.outflow ?? 0) / maxVal) * 100 : 0;
              return (
                <div key={m.month} className="flex-1 flex items-end gap-px" title={`${m.month}: +${formatVND(m.inflow ?? 0)} / -${formatVND(m.outflow ?? 0)}`}>
                  <div className="flex-1 bg-emerald-500/70 rounded-t transition-all" style={{ height: `${inH}%` }} />
                  <div className="flex-1 bg-red-500/70 rounded-t transition-all" style={{ height: `${outH}%` }} />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1">
            {monthly.filter((_, i) => i % 3 === 0).map((m) => (
              <span key={m.month} className="text-[10px] text-muted-foreground">{m.month}</span>
            ))}
          </div>
          <div className="flex gap-3 mt-1">
            <span className="text-[10px] flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500/70 inline-block" />Vào</span>
            <span className="text-[10px] flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500/70 inline-block" />Ra</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Direction filter */}
        <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
          {[{ k: '', l: 'Tất cả' }, { k: 'INFLOW', l: '📥 Vào' }, { k: 'OUTFLOW', l: '📤 Ra' }].map((t) => (
            <button key={t.k} onClick={() => setDirFilter(t.k)}
              className={cn('px-3 py-1.5 text-xs rounded-md font-medium transition-colors',
                dirFilter === t.k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >{t.l}</button>
          ))}
        </div>
        <select
          value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none"
        >
          <option value="">Tất cả loại</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" placeholder="Tìm mô tả, PNR..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none"
          />
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 ml-auto"
        >
          <Plus className="w-3.5 h-3.5" />Thêm giao dịch
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Không có giao dịch</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Ngày', 'Loại', 'Mô tả', 'Tham chiếu', 'PIC', 'Số tiền'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {entries.map((e) => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: CASHFLOW_CATEGORY_COLORS[e.category] + '20', color: CASHFLOW_CATEGORY_COLORS[e.category] }}
                      >
                        {CASHFLOW_CATEGORY_LABELS[e.category]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-foreground max-w-[200px] truncate" title={e.description}>{e.description}</td>
                    <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground">{e.reference ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{e.pic}</td>
                    <td className={cn('px-4 py-2.5 text-xs font-bold', e.direction === 'INFLOW' ? 'text-emerald-600' : 'text-red-500')}>
                      {e.direction === 'INFLOW' ? '+' : '-'}{formatVND(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">Thêm giao dịch dòng tiền</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              {/* Direction */}
              <div className="flex gap-2">
                {[{ v: 'INFLOW', l: '📥 Tiền vào', c: 'text-emerald-600 border-emerald-500' },
                  { v: 'OUTFLOW', l: '📤 Tiền ra', c: 'text-red-500 border-red-500' }].map((d) => (
                  <button key={d.v} onClick={() => setForm((f) => ({ ...f, direction: d.v }))}
                    className={cn('flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-colors',
                      form.direction === d.v ? d.c + ' bg-current/5' : 'border-border text-muted-foreground'
                    )}
                  >{d.l}</button>
                ))}
              </div>
              {/* Category */}
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              {/* Amount */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Số tiền (VNĐ)</label>
                <input type="text" inputMode="numeric" placeholder="0" value={form.amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              {/* Description */}
              <input type="text" placeholder="Mô tả *" required value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {/* Reference + PIC */}
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="PNR / Tham chiếu" value={form.reference}
                  onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                  className="px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
                />
                <select value={form.pic} onChange={(e) => setForm((f) => ({ ...f, pic: e.target.value }))}
                  className="px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
                >
                  {PICS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              {/* Date */}
              <input type="date" value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
              />
              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 text-sm border border-border rounded-xl text-muted-foreground hover:bg-accent"
                >Hủy</button>
                <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.description || !form.amount}
                  className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
