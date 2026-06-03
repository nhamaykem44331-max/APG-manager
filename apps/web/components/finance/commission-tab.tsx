'use client';
// APG Manager RMS - CommissionTab: hoa hồng 2 chiều (nhận từ hãng / trả đối tác) — GĐ3a

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, X, HandCoins, Plus, Users } from 'lucide-react';
import { commissionApi, supplierApi } from '@/lib/api';
import { cn, formatVND, formatDate } from '@/lib/utils';
import type { SupplierProfile } from '@/types';

const FUND_OPTIONS = [
  { value: 'CASH_OFFICE', label: 'Quỹ tiền mặt VP' },
  { value: 'BANK_HTX', label: 'TK BIDV HTX' },
  { value: 'BANK_PERSONAL', label: 'TK MB cá nhân' },
];

const KIND_LABEL: Record<string, string> = { AIRLINE_INCOME: 'Nhận từ hãng', PARTNER_PAYOUT: 'Trả đối tác' };
const STATUS_LABEL: Record<string, string> = { ACCRUED: 'Dồn tích', SETTLED: 'Đã chốt', CANCELLED: 'Đã hủy' };

type CommissionRow = {
  id: string; kind: string; status: string; amount: string | number; occurredAt: string;
  supplierId: string | null; description: string;
};

type PartnerSummary = {
  partner: { id: string; code: string; name: string };
  totals: { customerCount: number; bookingCount: number; revenue: number; profit: number; paidFeedback: number };
  customers: { id: string; fullName: string; customerCode: string | null; bookings: number; revenue: number; profit: number }[];
  payouts: { id: string; amount: string | number; status: string; occurredAt: string; description: string }[];
};

export function CommissionTab() {
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [amount, setAmount] = useState('');
  const [fundAccount, setFundAccount] = useState('CASH_OFFICE');
  const [date, setDate] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');

  const { data: recordsRaw, isLoading } = useQuery({
    queryKey: ['commission-records'],
    queryFn: () => commissionApi.list().then((r) => r.data),
  });
  const records: CommissionRow[] = Array.isArray(recordsRaw) ? recordsRaw : (recordsRaw as { data?: CommissionRow[] })?.data ?? [];

  const { data: suppliersRaw } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.list().then((r) => r.data),
  });
  const suppliers: SupplierProfile[] = Array.isArray(suppliersRaw) ? suppliersRaw : (suppliersRaw as { data?: SupplierProfile[] })?.data ?? [];
  const partners = suppliers.filter((s) => s.type === 'PARTNER');
  const supplierName = useMemo(() => {
    const m = new Map<string, string>();
    suppliers.forEach((s) => m.set(s.id, s.name));
    return m;
  }, [suppliers]);

  const { data: partnerSummary } = useQuery<PartnerSummary | undefined>({
    queryKey: ['partner-summary', selectedPartnerId],
    queryFn: () => commissionApi.partnerSummary(selectedPartnerId).then((r) => r.data),
    enabled: !!selectedPartnerId,
  });

  const num = (v: string | number) => Number(v ?? 0);
  const totalIncome = records.filter((r) => r.kind === 'AIRLINE_INCOME' && r.status !== 'CANCELLED').reduce((s, r) => s + num(r.amount), 0);
  const totalPayout = records.filter((r) => r.kind === 'PARTNER_PAYOUT' && r.status !== 'CANCELLED').reduce((s, r) => s + num(r.amount), 0);

  const payMutation = useMutation({
    mutationFn: () => commissionApi.payPartner({
      partnerId, amount: Number(amount), fundAccount,
      date: date || undefined, reference: reference || undefined, notes: notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['commission-records'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
      qc.invalidateQueries({ queryKey: ['cashflow'] });
      closeModal();
    },
    onError: (err: unknown) => setFormError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không trả được hoa hồng.'),
  });

  const closeModal = () => {
    setShowModal(false); setPartnerId(''); setAmount(''); setFundAccount('CASH_OFFICE');
    setDate(''); setReference(''); setNotes(''); setFormError('');
  };

  const handlePay = () => {
    setFormError('');
    if (!partnerId) { setFormError('Vui lòng chọn đối tác.'); return; }
    if (!amount || Number(amount) <= 0) { setFormError('Số tiền phải lớn hơn 0.'); return; }
    payMutation.mutate();
  };

  return (
    <div className="space-y-4">
      {/* KPI 2 chiều */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3.5">
          <p className="text-[12px] font-medium text-muted-foreground">Hoa hồng nhận từ hãng</p>
          <p className="mt-1 font-tabular text-[24px] font-bold text-emerald-500">{formatVND(totalIncome)}</p>
          <p className="text-[11px] text-muted-foreground">dồn tích + đã chốt</p>
        </div>
        <div className="card p-3.5">
          <p className="text-[12px] font-medium text-muted-foreground">Hoa hồng trả đối tác</p>
          <p className="mt-1 font-tabular text-[24px] font-bold text-orange-500">{formatVND(totalPayout)}</p>
          <p className="text-[11px] text-muted-foreground">đã chi</p>
        </div>
      </div>

      {/* Tổng hợp theo đối tác giới thiệu (đầu mối đem về vs đã feedback) */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Theo đối tác giới thiệu</h3>
        </div>
        <select
          value={selectedPartnerId}
          onChange={(e) => setSelectedPartnerId(e.target.value)}
          className="w-full sm:max-w-xs px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">— Chọn đối tác để xem đầu mối —</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </select>

        {selectedPartnerId && partnerSummary && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg bg-accent/40 p-3">
                <p className="text-[11px] text-muted-foreground">Số khách đầu mối</p>
                <p className="font-tabular text-[16px] font-bold text-foreground">{partnerSummary.totals.customerCount}</p>
                <p className="text-[10px] text-muted-foreground">{partnerSummary.totals.bookingCount} booking</p>
              </div>
              <div className="rounded-lg bg-accent/40 p-3">
                <p className="text-[11px] text-muted-foreground">Doanh số đem về</p>
                <p className="font-tabular text-[16px] font-bold text-foreground">{formatVND(partnerSummary.totals.revenue)}</p>
              </div>
              <div className="rounded-lg bg-accent/40 p-3">
                <p className="text-[11px] text-muted-foreground">Lãi đem về</p>
                <p className="font-tabular text-[16px] font-bold text-emerald-500">{formatVND(partnerSummary.totals.profit)}</p>
              </div>
              <div className="rounded-lg bg-accent/40 p-3">
                <p className="text-[11px] text-muted-foreground">Đã feedback</p>
                <p className="font-tabular text-[16px] font-bold text-orange-500">{formatVND(partnerSummary.totals.paidFeedback)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
              <p className="text-[11px] text-muted-foreground">Hoa hồng đối tác thỏa thuận từng đợt — số liệu trên chỉ là cơ sở tham khảo để thương lượng.</p>
              <button
                onClick={() => { setPartnerId(selectedPartnerId); setShowModal(true); }}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <HandCoins className="w-3.5 h-3.5" /> Trả hoa hồng
              </button>
            </div>

            {partnerSummary.customers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {['Khách giới thiệu', 'Mã KH', 'Booking', 'Doanh số', 'Lãi'].map((h) => (
                        <th key={h} className="text-left text-[11px] font-semibold text-muted-foreground px-3 py-2 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {partnerSummary.customers.map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-xs text-foreground">{c.fullName}</td>
                        <td className="px-3 py-2 text-xs font-mono text-primary">{c.customerCode ?? '—'}</td>
                        <td className="px-3 py-2 text-xs font-tabular text-muted-foreground">{c.bookings}</td>
                        <td className="px-3 py-2 text-xs font-tabular text-foreground">{formatVND(c.revenue)}</td>
                        <td className="px-3 py-2 text-xs font-tabular text-emerald-500">{formatVND(c.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-[12px] text-muted-foreground px-1">Chưa có khách nào gắn đối tác này. Vào hồ sơ khách → chọn &quot;Đối tác giới thiệu&quot;.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Sổ hoa hồng 2 chiều</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{records.length} bản ghi</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Trả hoa hồng đối tác
        </button>
      </div>

      {/* Bảng records */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : records.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <HandCoins className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground">Chưa có bản ghi hoa hồng nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Ngày', 'Chiều', 'Đối tượng', 'Số tiền', 'Trạng thái', 'Diễn giải'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.occurredAt)}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium',
                        r.kind === 'AIRLINE_INCOME' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-orange-500/10 text-orange-500')}>
                        {KIND_LABEL[r.kind] ?? r.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-foreground">{r.supplierId ? (supplierName.get(r.supplierId) ?? r.supplierId) : '—'}</td>
                    <td className={cn('px-3 py-2.5 text-xs font-tabular font-semibold', r.kind === 'AIRLINE_INCOME' ? 'text-emerald-500' : 'text-orange-500')}>
                      {r.kind === 'AIRLINE_INCOME' ? '+' : '−'}{formatVND(num(r.amount))}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium',
                        r.status === 'SETTLED' ? 'bg-emerald-500/10 text-emerald-500'
                          : r.status === 'ACCRUED' ? 'bg-amber-500/10 text-amber-500' : 'bg-muted text-muted-foreground')}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[280px] truncate">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: trả hoa hồng đối tác */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2"><HandCoins className="w-4 h-4 text-primary" />Trả hoa hồng đối tác</h2>
              <button onClick={closeModal}><X className="w-4 h-4 text-muted-foreground hover:text-foreground" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Đối tác *</label>
                <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option value="">— Chọn đối tác —</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                </select>
                {partners.length === 0 && <p className="text-[11px] text-amber-500">Chưa có NCC loại Đối tác. Thêm ở tab NCC &amp; Đối tác.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Số tiền *</label>
                  <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground font-tabular focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Quỹ chi *</label>
                  <select value={fundAccount} onChange={(e) => setFundAccount(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    {FUND_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Ngày chi</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Tham chiếu</label>
                  <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Đợt T6..."
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ghi chú</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Hoa hồng giới thiệu..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none" />
              </div>
              {formError && <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">⚠️ {formError}</p>}
              <div className="flex gap-2 pt-1">
                <button onClick={closeModal} className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-accent transition-colors">Hủy</button>
                <button onClick={handlePay} disabled={payMutation.isPending}
                  className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                  {payMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Xác nhận chi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
