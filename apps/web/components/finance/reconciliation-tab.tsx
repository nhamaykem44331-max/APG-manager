'use client';
// APG Manager RMS - ReconciliationTab: đối soát BSP theo hãng + kỳ (GĐ3b)

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, CheckCircle2, Scale, AlertTriangle } from 'lucide-react';
import { reconciliationApi, supplierApi } from '@/lib/api';
import { cn, formatVND, formatDate } from '@/lib/utils';
import type { SupplierProfile } from '@/types';

const FUND_OPTIONS = [
  { value: '', label: 'Bù trừ (không vào quỹ)' },
  { value: 'CASH_OFFICE', label: 'Quỹ tiền mặt VP' },
  { value: 'BANK_HTX', label: 'TK BIDV HTX' },
  { value: 'BANK_PERSONAL', label: 'TK MB cá nhân' },
];

type Preview = { internalNet: number; internalCommission: number; bookingCount: number; supplierName: string | null };
type Batch = {
  id: string; supplierId: string; periodFrom: string; periodTo: string; status: string;
  internalNet: string | number; internalCommission: string | number;
  bspNet: string | number; bspCommission: string | number;
  netDiscrepancy: string | number; commissionDiscrepancy: string | number;
};

export function ReconciliationTab() {
  const qc = useQueryClient();
  const [supplierId, setSupplierId] = useState('');
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const [bspNet, setBspNet] = useState('');
  const [bspCommission, setBspCommission] = useState('');
  const [fundAccount, setFundAccount] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [formError, setFormError] = useState('');

  const { data: suppliersRaw } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.list().then((r) => r.data),
  });
  const airlines: SupplierProfile[] = (Array.isArray(suppliersRaw) ? suppliersRaw : (suppliersRaw as { data?: SupplierProfile[] })?.data ?? [])
    .filter((s: SupplierProfile) => s.type === 'AIRLINE');

  const { data: batchesRaw, isLoading } = useQuery({
    queryKey: ['reconciliation-batches'],
    queryFn: () => reconciliationApi.list().then((r) => r.data),
  });
  const batches: Batch[] = Array.isArray(batchesRaw) ? batchesRaw : (batchesRaw as { data?: Batch[] })?.data ?? [];

  const previewMutation = useMutation({
    mutationFn: () => reconciliationApi.preview({ supplierId, periodFrom, periodTo }).then((r) => r.data as Preview),
    onSuccess: (data) => { setPreview(data); setFormError(''); },
    onError: (err: unknown) => setFormError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không lấy được số nội bộ.'),
  });

  const createMutation = useMutation({
    mutationFn: () => reconciliationApi.create({
      supplierId, periodFrom, periodTo,
      bspNet: Number(bspNet), bspCommission: Number(bspCommission),
      fundAccount: fundAccount || undefined, notes: notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation-batches'] });
      setPreview(null); setBspNet(''); setBspCommission(''); setNotes(''); setFormError('');
    },
    onError: (err: unknown) => setFormError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Không tạo được đối soát.'),
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => reconciliationApi.confirm(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation-batches'] });
      qc.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
  });

  const handlePreview = () => {
    setFormError('');
    if (!supplierId) { setFormError('Vui lòng chọn hãng.'); return; }
    if (!periodFrom || !periodTo) { setFormError('Vui lòng chọn kỳ đối soát.'); return; }
    previewMutation.mutate();
  };

  const handleCreate = () => {
    setFormError('');
    if (!preview) { setFormError('Hãy xem số nội bộ trước.'); return; }
    if (bspNet === '' || bspCommission === '') { setFormError('Nhập số net & hoa hồng theo sao kê BSP.'); return; }
    createMutation.mutate();
  };

  const num = (v: string | number) => Number(v ?? 0);

  return (
    <div className="space-y-4">
      {/* Form tạo đối soát */}
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-2 border-b border-border pb-2.5">
          <Scale className="w-4 h-4 text-primary" />
          <h3 className="text-[13px] font-semibold text-foreground">Đối soát BSP / hãng theo kỳ</h3>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Hãng *</label>
            <select
              value={supplierId}
              onChange={(e) => { setSupplierId(e.target.value); setPreview(null); }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">— Chọn hãng —</option>
              {airlines.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Từ ngày *</label>
            <input type="date" value={periodFrom} onChange={(e) => { setPeriodFrom(e.target.value); setPreview(null); }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Đến ngày *</label>
            <input type="date" value={periodTo} onChange={(e) => { setPeriodTo(e.target.value); setPreview(null); }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>

        <button
          onClick={handlePreview}
          disabled={previewMutation.isPending}
          className="flex items-center gap-1.5 px-3 py-2 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-lg border border-border disabled:opacity-50"
        >
          {previewMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
          Xem số nội bộ
        </button>

        {preview && (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-accent/40 p-3">
                <p className="text-[11px] text-muted-foreground">Net nội bộ ({preview.bookingCount} booking)</p>
                <p className="font-tabular text-[15px] font-bold text-foreground">{formatVND(preview.internalNet)}</p>
              </div>
              <div className="rounded-lg bg-accent/40 p-3">
                <p className="text-[11px] text-muted-foreground">Hoa hồng dồn tích nội bộ</p>
                <p className="font-tabular text-[15px] font-bold text-emerald-500">{formatVND(preview.internalCommission)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Net theo sao kê BSP *</label>
                <input type="number" min="0" value={bspNet} onChange={(e) => setBspNet(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground font-tabular focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Hoa hồng theo sao kê BSP *</label>
                <input type="number" min="0" value={bspCommission} onChange={(e) => setBspCommission(e.target.value)} placeholder="0"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground font-tabular focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Quỹ thực thu hoa hồng</label>
                <select value={fundAccount} onChange={(e) => setFundAccount(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  {FUND_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ghi chú</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sao kê BSP đợt..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none" />
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={createMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Tạo đối soát (DRAFT)
            </button>
          </div>
        )}

        {formError && (
          <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">⚠️ {formError}</p>
        )}
      </div>

      {/* Bảng batch đối soát */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : batches.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <Scale className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground">Chưa có đợt đối soát nào</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Kỳ', 'Net nội bộ', 'Net BSP', 'Lệch net', 'HH nội bộ', 'HH BSP', 'Lệch HH', 'Trạng thái', ''].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-3 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batches.map((b) => {
                  const netDisc = num(b.netDiscrepancy);
                  const commDisc = num(b.commissionDiscrepancy);
                  return (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2.5 text-xs text-foreground whitespace-nowrap">{formatDate(b.periodFrom)} – {formatDate(b.periodTo)}</td>
                      <td className="px-3 py-2.5 text-xs font-tabular text-muted-foreground">{formatVND(num(b.internalNet))}</td>
                      <td className="px-3 py-2.5 text-xs font-tabular text-foreground">{formatVND(num(b.bspNet))}</td>
                      <td className={cn('px-3 py-2.5 text-xs font-tabular font-semibold', netDisc === 0 ? 'text-emerald-500' : 'text-orange-500')}>
                        {netDisc !== 0 && <AlertTriangle className="inline w-3 h-3 mr-1" />}{netDisc > 0 ? '+' : ''}{formatVND(netDisc)}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-tabular text-muted-foreground">{formatVND(num(b.internalCommission))}</td>
                      <td className="px-3 py-2.5 text-xs font-tabular text-foreground">{formatVND(num(b.bspCommission))}</td>
                      <td className={cn('px-3 py-2.5 text-xs font-tabular font-semibold', commDisc === 0 ? 'text-emerald-500' : 'text-orange-500')}>
                        {commDisc > 0 ? '+' : ''}{formatVND(commDisc)}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium',
                          b.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500')}>
                          {b.status === 'CONFIRMED' ? 'Đã chốt' : 'Nháp'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {b.status === 'DRAFT' && (
                          <button
                            onClick={() => confirmMutation.mutate(b.id)}
                            disabled={confirmMutation.isPending}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50"
                          >
                            {confirmMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Chốt
                          </button>
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
    </div>
  );
}
