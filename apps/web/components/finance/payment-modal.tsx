'use client';
// APG Manager RMS - PaymentModal: Modal ghi nhận thanh toán công nợ (dùng chung AR/AP)
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle, Banknote, Loader2 } from 'lucide-react';
import { ledgerApi } from '@/lib/api';
import { cn, formatVND } from '@/lib/utils';
import { MoneyInput } from '@/components/ui/money-input';
import type { AccountsLedger } from '@/types';

const METHODS = [
  { value: 'CASH', label: '💵 Tiền mặt' },
  { value: 'BANK_TRANSFER', label: '🏦 Chuyển khoản' },
  { value: 'MOMO', label: '💜 MoMo' },
  { value: 'VNPAY', label: '🔵 VNPay' },
];

interface Props {
  ledger: AccountsLedger;
  onClose: () => void;
}

export function PaymentModal({ ledger, onClose }: Props) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [fundAccount, setFundAccount] = useState('BANK_HTX');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const partyName = ledger.customer?.fullName ?? ledger.supplier?.name ?? ledger.customerCode ?? '—';
  const remaining = Number(ledger.remaining);

  const mutation = useMutation({
    mutationFn: () => ledgerApi.pay(ledger.id, {
      amount: Number(amount),
      method,
      fundAccount,
      reference: reference || undefined,
      notes: notes || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Có lỗi khi ghi nhận thanh toán');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!amount || Number(amount) <= 0) { setError('Vui lòng nhập số tiền hợp lệ'); return; }
    if (Number(amount) > remaining) { setError(`Số tiền vượt quá số còn lại (${formatVND(remaining)})`); return; }
    mutation.mutate();
  };

  // Quick-fill shortcuts
  const fills = [
    { label: '50%', v: Math.floor(remaining * 0.5) },
    { label: '100%', v: remaining },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Banknote className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Ghi nhận thanh toán</h2>
            <p className="text-xs text-muted-foreground truncate">
              {ledger.code} · {partyName} · Còn lại: <strong className="text-red-500">{formatVND(remaining)}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Amount */}
          <div className="space-y-2">
            <MoneyInput label="Số tiền" required value={amount} onChange={setAmount} placeholder="0" />
            <div className="flex gap-2">
              {fills.map((f) => (
                <button key={f.label} type="button"
                  onClick={() => setAmount(String(f.v))}
                  className="flex-1 py-1.5 text-xs rounded-lg border border-border hover:border-primary hover:text-primary transition-colors text-muted-foreground"
                >
                  {f.label} · {formatVND(f.v)}
                </button>
              ))}
            </div>
          </div>

          {/* Method */}
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button key={m.value} type="button" onClick={() => {
                setMethod(m.value);
                setFundAccount(m.value === 'CASH' ? 'CASH_OFFICE' : 'BANK_HTX');
              }}
                className={cn('px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left',
                  method === m.value ? 'bg-primary/15 border border-primary text-primary' : 'border border-border text-muted-foreground hover:bg-accent'
                )}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Chọn quỹ */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Chi từ quỹ</label>
            <select value={fundAccount} onChange={(e) => setFundAccount(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="CASH_OFFICE">Quỹ tiền mặt VP</option>
              <option value="BANK_HTX">TK BIDV HTX (3900543757)</option>
              <option value="BANK_PERSONAL">TK MB cá nhân (996106688)</option>
            </select>
          </div>

          {/* Reference */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Mã giao dịch / Tham chiếu</label>
            <input type="text" placeholder="GD123456..."
              value={reference} onChange={(e) => setReference(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Ghi chú</label>
            <textarea rows={2} placeholder="Ghi chú nội bộ..."
              value={notes} onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 text-sm border border-border rounded-xl text-muted-foreground hover:bg-accent"
            >Hủy</button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              Xác nhận
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
