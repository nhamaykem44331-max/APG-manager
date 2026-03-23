'use client';
// APG Manager RMS - SuppliersTab: Quản lý hồ sơ NCC / đối tác
// Fix: thêm modal "Thêm NCC" với đầy đủ form fields

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Building2, Loader2, X, Phone, Mail, CreditCard } from 'lucide-react';
import { supplierApi } from '@/lib/api';
import { cn, formatVND, LEDGER_PARTY_LABELS } from '@/lib/utils';
import type { SupplierProfile } from '@/types';

const PARTY_TYPES = [
  { value: 'AIRLINE',        label: '✈️ Hãng bay' },
  { value: 'GDS_PROVIDER',   label: '🖥️ GDS Provider' },
  { value: 'PARTNER',        label: '🤝 Đối tác' },
  { value: 'OTHER_SUPPLIER', label: '🏭 NCC khác' },
];

// ─── Form state mặc định ─────────────────────────────────────────────
const DEFAULT_FORM = {
  code: '',
  name: '',
  type: 'AIRLINE' as string,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  taxId: '',
  bankAccount: '',
  bankName: '',
  paymentTerms: '',
  notes: '',
};

export function SuppliersTab() {
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetail, setShowDetail] = useState<SupplierProfile | null>(null);
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.list().then((r) => r.data),
  });

  const suppliers: SupplierProfile[] = data ?? [];

  // Mutation: tạo NCC mới
  const createMutation = useMutation({
    mutationFn: () =>
      supplierApi.create({
        code:         form.code.trim().toUpperCase(),
        name:         form.name.trim(),
        type:         form.type,
        contactName:  form.contactName || undefined,
        contactPhone: form.contactPhone || undefined,
        contactEmail: form.contactEmail || undefined,
        taxId:        form.taxId || undefined,
        bankAccount:  form.bankAccount || undefined,
        bankName:     form.bankName || undefined,
        paymentTerms: form.paymentTerms ? Number(form.paymentTerms) : undefined,
        notes:        form.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setShowAddModal(false);
      setForm({ ...DEFAULT_FORM });
      setFormError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setFormError(msg ?? 'Không thể thêm NCC. Vui lòng thử lại.');
    },
  });

  // Mutation: seed NCC mặc định
  const seedMutation = useMutation({
    mutationFn: () => supplierApi.seedDefaults(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  });

  const handleSave = () => {
    setFormError('');
    if (!form.code.trim()) { setFormError('Vui lòng nhập mã NCC'); return; }
    if (!form.name.trim()) { setFormError('Vui lòng nhập tên NCC'); return; }
    createMutation.mutate();
  };

  const closeModal = () => {
    setShowAddModal(false);
    setForm({ ...DEFAULT_FORM });
    setFormError('');
  };

  return (
    <div className="space-y-4">
      {/* Header + Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Nhà cung cấp &amp; Đối tác</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{suppliers.length} đối tác đang hoạt động</p>
        </div>
        <div className="flex gap-2">
          {suppliers.length === 0 && (
            <button
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-2 text-xs bg-muted hover:bg-muted/80 text-foreground rounded-lg border border-border"
            >
              {seedMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
              Thêm NCC mặc định
            </button>
          )}
          {/* ← Nút này đã có onClick để mở modal */}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Thêm NCC
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Đang tải...</div>
        ) : suppliers.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Building2 className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground">Chưa có nhà cung cấp nào</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => seedMutation.mutate()}
                disabled={seedMutation.isPending}
                className="px-4 py-2 text-sm bg-muted text-foreground rounded-lg hover:bg-muted/80 disabled:opacity-50"
              >
                {seedMutation.isPending ? 'Đang thêm...' : 'Thêm NCC mẫu (VN, VJ, QH...)'}
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
              >
                + Thêm thủ công
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Mã', 'Tên NCC', 'Loại', 'Liên hệ', 'Hạn TT', 'TK Ngân hàng', 'Tổng nợ'].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {suppliers.map((s) => (
                  <tr
                    key={s.id}
                    className="hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => setShowDetail(s)}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs font-bold text-primary">{s.code}</td>
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-foreground text-xs">{s.name}</p>
                      {s.contactName && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">{s.contactName}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {LEDGER_PARTY_LABELS[s.type] ?? s.type}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">
                      {s.contactPhone ?? '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs">
                      {s.paymentTerms ? (
                        <span className="bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded-full text-[10px] font-medium">
                          {s.paymentTerms} ngày
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground font-mono">
                      {s.bankAccount ? `${s.bankAccount} (${s.bankName ?? ''})` : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-xs font-semibold">
                      {(s as SupplierProfile & { totalDebt?: number }).totalDebt && (s as SupplierProfile & { totalDebt?: number }).totalDebt! > 0 ? (
                        <span className="text-orange-500">
                          {formatVND((s as SupplierProfile & { totalDebt?: number }).totalDebt!)}
                        </span>
                      ) : (
                        <span className="text-emerald-600 opacity-70">Không nợ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Modal: Thêm NCC mới ─────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Thêm nhà cung cấp mới
              </h2>
              <button onClick={closeModal}>
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Loại NCC */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Loại đối tác *</label>
                <div className="grid grid-cols-2 gap-2">
                  {PARTY_TYPES.map((pt) => (
                    <button
                      key={pt.value}
                      onClick={() => setForm((f) => ({ ...f, type: pt.value }))}
                      className={cn(
                        'py-2 text-xs font-medium rounded-lg border-2 transition-colors text-left px-3',
                        form.type === pt.value
                          ? 'border-primary text-primary bg-primary/5'
                          : 'border-border text-muted-foreground hover:border-border/80',
                      )}
                    >
                      {pt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mã + Tên */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Mã NCC *</label>
                  <input
                    type="text"
                    placeholder="VN, VJ, AMADEUS..."
                    value={form.code}
                    onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground uppercase placeholder:normal-case focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Tên đầy đủ *</label>
                  <input
                    type="text"
                    placeholder="Vietnam Airlines..."
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />Thông tin liên hệ
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Người liên hệ</label>
                    <input
                      type="text"
                      placeholder="Ms Lan, Mr Tuấn..."
                      value={form.contactName}
                      onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Số điện thoại</label>
                    <input
                      type="text"
                      placeholder="0901234567"
                      value={form.contactPhone}
                      onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />Email</label>
                    <input
                      type="email"
                      placeholder="contact@airline.com"
                      value={form.contactEmail}
                      onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Thanh toán */}
              <div className="border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                  <CreditCard className="w-3 h-3" />Thông tin thanh toán
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Mã số thuế</label>
                    <input
                      type="text"
                      placeholder="0123456789"
                      value={form.taxId}
                      onChange={(e) => setForm((f) => ({ ...f, taxId: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Hạn thanh toán (ngày)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="15"
                      value={form.paymentTerms}
                      onChange={(e) => setForm((f) => ({ ...f, paymentTerms: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Số tài khoản ngân hàng</label>
                    <input
                      type="text"
                      placeholder="1234567890"
                      value={form.bankAccount}
                      onChange={(e) => setForm((f) => ({ ...f, bankAccount: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Ngân hàng</label>
                    <input
                      type="text"
                      placeholder="Vietcombank, BIDV..."
                      value={form.bankName}
                      onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Ghi chú */}
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Ghi chú</label>
                <textarea
                  rows={2}
                  placeholder="Điều kiện hợp tác, lưu ý đặc biệt..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none focus:outline-none"
                />
              </div>

              {/* Error */}
              {formError && (
                <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  ⚠️ {formError}
                </p>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={closeModal}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-accent transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSave}
                  disabled={createMutation.isPending}
                  className="flex-1 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                >
                  {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Lưu NCC
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal: Chi tiết NCC ─────────────────────────────────────── */}
      {showDetail && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setShowDetail(null)}
        >
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                {showDetail.name}
              </h2>
              <button onClick={() => setShowDetail(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { label: 'Mã NCC',   value: showDetail.code, mono: true },
                { label: 'Loại',     value: LEDGER_PARTY_LABELS[showDetail.type] ?? showDetail.type },
                { label: 'Liên hệ', value: showDetail.contactName },
                { label: 'Phone',   value: showDetail.contactPhone },
                { label: 'Email',   value: showDetail.contactEmail },
                { label: 'MST',     value: showDetail.taxId },
                { label: 'TK NH',   value: showDetail.bankAccount ? `${showDetail.bankAccount} – ${showDetail.bankName ?? ''}` : undefined },
                { label: 'Hạn TT',  value: showDetail.paymentTerms ? `${showDetail.paymentTerms} ngày` : undefined },
              ].filter((r) => r.value).map((row) => (
                <div key={row.label} className="flex items-start gap-3">
                  <span className="text-xs text-muted-foreground w-16 flex-shrink-0">{row.label}</span>
                  <span className={cn('text-xs text-foreground', row.mono && 'font-mono font-bold text-primary')}>{row.value}</span>
                </div>
              ))}
              {showDetail.notes && (
                <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-3 mt-2">{showDetail.notes}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
