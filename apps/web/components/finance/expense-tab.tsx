'use client';
// APG Manager RMS - ExpenseTab: Tab Chi phí vận hành (Phase B)
// Nguồn: Google Sheet "Chi phí vận hành" - 209 khoản chi
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Loader2, Search, X } from 'lucide-react';
import { expenseApi } from '@/lib/api';
import {
  cn, formatVND, formatDate, CASHFLOW_CATEGORY_LABELS, CASHFLOW_CATEGORY_COLORS,
} from '@/lib/utils';
import type { OperatingExpense, MonthlyFlow } from '@/types';

const EXPENSE_CATEGORIES = [
  'SALARY', 'OFFICE_RENT', 'OFFICE_SUPPLIES', 'ENTERTAINMENT',
  'TRAVEL', 'RITUAL', 'MARKETING', 'TECHNOLOGY', 'PARTNER_FEEDBACK',
  'AIRLINE_PAYMENT', 'DISBURSEMENT', 'OTHER',
].map((v) => ({ value: v, label: CASHFLOW_CATEGORY_LABELS[v] ?? v }));

export function ExpenseTab() {
  const qc = useQueryClient();
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    category: 'OFFICE_SUPPLIES',
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });

  const params: Record<string, string> = { pageSize: '50' };
  if (catFilter) params.category = catFilter;
  if (search) params.search = search;

  const { data: summaryData } = useQuery({
    queryKey: ['expenses', 'summary'],
    queryFn: () => expenseApi.getSummary().then((r) => r.data),
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ['expenses', 'list', catFilter, search],
    queryFn: () => expenseApi.list(params).then((r) => r.data),
  });

  const { data: monthlyData } = useQuery({
    queryKey: ['expenses', 'monthly'],
    queryFn: () => expenseApi.getMonthly().then((r) => r.data as MonthlyFlow[]),
  });

  const createMutation = useMutation({
    mutationFn: () => expenseApi.create({
      ...form,
      amount: Number(form.amount.replace(/\./g, '')),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      setShowForm(false);
      setForm({ category: 'OFFICE_SUPPLIES', description: '', amount: '', date: new Date().toISOString().slice(0, 10), notes: '' });
    },
  });

  const expenses: OperatingExpense[] = listData?.data ?? [];
  const summary = summaryData;
  const monthly: MonthlyFlow[] = monthlyData ?? [];

  const handleAmountChange = (v: string) => {
    const raw = v.replace(/\D/g, '');
    const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    setForm((f) => ({ ...f, amount: formatted }));
  };

  return (
    <div className="space-y-4">
      {/* KPI + Category Summary */}
      {summary && (
        <>
          <div className="card p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground">Tổng chi phí vận hành</h3>
              <p className="text-xl font-bold text-red-500">{formatVND(summary.total)}</p>
            </div>
            {/* Category breakdown bar */}
            <div className="flex rounded-full overflow-hidden h-2 mb-3">
              {(summary.items as { category: string; amount: number; pct: number }[]).slice(0, 8).map((item: { category: string; amount: number; pct: number }) => (
                <div key={item.category}
                  title={`${CASHFLOW_CATEGORY_LABELS[item.category]}: ${formatVND(item.amount)} (${item.pct}%)`}
                  style={{ width: `${item.pct}%`, backgroundColor: CASHFLOW_CATEGORY_COLORS[item.category] }}
                />
              ))}
            </div>
            {/* Top categories */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(summary.items as { category: string; amount: number; pct: number }[]).slice(0, 4).map((item: { category: string; amount: number; pct: number }) => (
                <div key={item.category} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: CASHFLOW_CATEGORY_COLORS[item.category] }} />
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground truncate">{CASHFLOW_CATEGORY_LABELS[item.category]}</p>
                    <p className="text-xs font-semibold text-foreground">{formatVND(item.amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly trend */}
          {monthly.length > 0 && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold text-muted-foreground mb-3">Chi phí theo tháng</h3>
              <div className="flex items-end gap-1 h-14">
                {monthly.map((m) => {
                  const maxVal = Math.max(...monthly.map((x) => x.total ?? 0), 1);
                  const h = ((m.total ?? 0) / maxVal) * 100;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-0.5" title={`${m.month}: ${formatVND(m.total ?? 0)}`}>
                      <div className="w-full bg-red-500/70 rounded-t transition-all" style={{ height: `${h}%` }} />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                {monthly.filter((_, i) => i % 3 === 0).map((m) => (
                  <span key={m.month} className="text-[10px] text-muted-foreground">{m.month}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none"
        >
          <option value="">Tất cả danh mục</option>
          {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div className="relative flex-1 min-w-[150px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" placeholder="Tìm mô tả..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none"
          />
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 ml-auto"
        >
          <Plus className="w-3.5 h-3.5" />Thêm chi phí
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : expenses.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Chưa có chi phí nào</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Ngày', 'Danh mục', 'Mô tả', 'Ghi chú', 'Số tiền'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {expenses.map((e) => (
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
                    <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[150px] truncate">{e.notes ?? '—'}</td>
                    <td className="px-4 py-2.5 text-xs font-bold text-red-500">-{formatVND(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold">Thêm chi phí vận hành</h2>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
              >
                {EXPENSE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input type="text" placeholder="Mô tả chi phí *" required value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Số tiền (VNĐ)</label>
                <input type="text" inputMode="numeric" placeholder="0" value={form.amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <input type="date" value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
              />
              <textarea rows={2} placeholder="Ghi chú..." value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none focus:outline-none"
              />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-accent">Hủy</button>
                <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !form.description || !form.amount}
                  className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
