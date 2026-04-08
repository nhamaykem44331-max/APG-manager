'use client';

import { useState } from 'react';
import { AlertTriangle, Banknote, Loader2, XCircle } from 'lucide-react';
import { MoneyInput } from '@/components/ui/money-input';
import { cn, formatVND } from '@/lib/utils';

export interface PaymentEntryPayload {
  amount: number;
  method: string;
  fundAccount?: string;
  reference?: string;
  paidAt?: string;
  notes?: string;
}

export interface PaymentMethodOption {
  value: string;
  label: string;
}

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'CREDIT_CARD', label: 'Thẻ ngân hàng' },
  { value: 'MOMO', label: 'MoMo' },
  { value: 'VNPAY', label: 'VNPay' },
];

export const PAYMENT_METHOD_OPTIONS_WITH_DEBT: PaymentMethodOption[] = [
  ...PAYMENT_METHOD_OPTIONS,
  { value: 'DEBT', label: 'Công nợ' },
];

interface PaymentEntryModalProps {
  contextLine?: string;
  remainingAmount: number;
  direction: 'RECEIVABLE' | 'PAYABLE';
  methods: PaymentMethodOption[];
  isPending?: boolean;
  error?: string;
  onClearError?: () => void;
  onSubmit: (payload: PaymentEntryPayload) => void;
  onClose: () => void;
}

function getDefaultPaidAtValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function PaymentEntryModal({
  contextLine,
  remainingAmount,
  direction,
  methods,
  isPending = false,
  error,
  onClearError,
  onSubmit,
  onClose,
}: PaymentEntryModalProps) {
  const [form, setForm] = useState({
    amount: '',
    method: methods[0]?.value ?? 'BANK_TRANSFER',
    fundAccount: 'BANK_HTX',
    reference: '',
    paidAt: getDefaultPaidAtValue(),
    notes: '',
  });
  const [localError, setLocalError] = useState('');

  const isDebt = form.method === 'DEBT';
  const summaryLabel = direction === 'PAYABLE' ? 'Còn cần trả' : 'Còn cần thu';
  const fundLabel = direction === 'PAYABLE' ? 'Chi từ quỹ' : 'Thu vào quỹ';
  const visibleError = localError || error;

  const quickFills = remainingAmount > 0
    ? [
        { label: '25%', value: Math.round(remainingAmount * 0.25) },
        { label: '50%', value: Math.round(remainingAmount * 0.5) },
        { label: '100%', value: remainingAmount },
      ]
    : [];

  function clearErrors() {
    if (localError) {
      setLocalError('');
    }
    onClearError?.();
  }

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    clearErrors();
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleMethodChange(method: string) {
    clearErrors();
    setForm((prev) => ({
      ...prev,
      method,
      fundAccount: method === 'CASH' ? 'CASH_OFFICE' : 'BANK_HTX',
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    clearErrors();

    if (!isDebt && (!form.amount || Number(form.amount) <= 0)) {
      setLocalError('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    if (!isDebt && Number(form.amount) > remainingAmount) {
      setLocalError(`Số tiền vượt quá số còn lại (${formatVND(remainingAmount)})`);
      return;
    }

    onSubmit({
      amount: isDebt ? remainingAmount : Number(form.amount),
      method: form.method,
      fundAccount: isDebt ? undefined : form.fundAccount,
      reference: isDebt ? undefined : form.reference.trim() || undefined,
      paidAt: isDebt ? undefined : form.paidAt,
      notes: form.notes.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <Banknote className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-foreground">Ghi nhận thanh toán</h2>
            {contextLine && (
              <p className="truncate text-xs text-muted-foreground">{contextLine}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {summaryLabel}: <strong>{formatVND(remainingAmount)}</strong>
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {!isDebt && (
            <div className="space-y-2">
              <MoneyInput
                label="Số tiền"
                required
                value={form.amount}
                onChange={(value) => updateField('amount', String(value))}
                placeholder="0"
              />
              {quickFills.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {quickFills.map((fill) => (
                    <button
                      key={fill.label}
                      type="button"
                      onClick={() => updateField('amount', String(fill.value))}
                      className="rounded-lg border border-border py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {fill.label} · {formatVND(fill.value)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Hình thức thanh toán</label>
            <div className="grid grid-cols-2 gap-2">
              {methods.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleMethodChange(item.value)}
                  className={cn(
                    'rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors',
                    form.method === item.value
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border text-muted-foreground hover:bg-accent',
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {isDebt ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-600 dark:text-amber-400">
              <p className="font-medium">Ghi nhận công nợ</p>
              <p className="mt-0.5 text-[11px] opacity-80">
                Số tiền sẽ được ghi nhận vào công nợ phải thu mà không cần nhập quỹ hay thời gian thanh toán.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{fundLabel}</label>
                <select
                  value={form.fundAccount}
                  onChange={(e) => updateField('fundAccount', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="CASH_OFFICE">Quỹ tiền mặt VP</option>
                  <option value="BANK_HTX">TK BIDV HTX (3900543757)</option>
                  <option value="BANK_PERSONAL">TK MB cá nhân (996106688)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Mã giao dịch / Tham chiếu</label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(e) => updateField('reference', e.target.value)}
                  placeholder="GD123456..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Thời gian thanh toán</label>
                <input
                  type="datetime-local"
                  value={form.paidAt}
                  onChange={(e) => updateField('paidAt', e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Ghi chú</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder="Ghi chú thêm..."
                  className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </>
          )}

          {visibleError && (
            <p className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {visibleError}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm text-muted-foreground hover:bg-accent"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Xác nhận
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
