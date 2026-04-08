'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { XCircle, Banknote, Loader2 } from 'lucide-react';
import { ledgerApi } from '@/lib/api';
import { cn, formatVND } from '@/lib/utils';
import { MoneyInput } from '@/components/ui/money-input';
import type { AccountsLedger } from '@/types';

const METHODS = [
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
  { value: 'MOMO', label: 'MoMo' },
  { value: 'VNPAY', label: 'VNPay' },
];

interface Props {
  ledgers: AccountsLedger[];
  onClose: () => void;
}

export function PaymentModal({ ledgers, onClose }: Props) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('BANK_TRANSFER');
  const [fundAccount, setFundAccount] = useState('BANK_HTX');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const orderedLedgers = useMemo(
    () => [...ledgers].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [ledgers],
  );
  const primaryLedger = orderedLedgers[0]!;
  const isBatch = orderedLedgers.length > 1;
  const isReceivable = primaryLedger.direction === 'RECEIVABLE';
  const bookingRef = primaryLedger.booking?.pnr ?? primaryLedger.booking?.bookingCode ?? primaryLedger.bookingCode ?? primaryLedger.code;
  const partyName = primaryLedger.customer?.fullName ?? primaryLedger.supplier?.name ?? primaryLedger.customerCode ?? '—';
  const remaining = orderedLedgers.reduce((sum, ledger) => sum + Number(ledger.remaining), 0);

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        amount: Number(amount),
        method,
        fundAccount,
        reference: reference || undefined,
        notes: notes || undefined,
      };

      if (isBatch) {
        return ledgerApi.payBatch({
          ledgerIds: orderedLedgers.map((ledger) => ledger.id),
          ...payload,
        });
      }

      return ledgerApi.pay(primaryLedger.id, payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ledger'] });
      qc.invalidateQueries({ queryKey: ['bookings'] });

      const bookingIds = new Set(orderedLedgers.map((ledger) => ledger.bookingId).filter(Boolean));
      for (const bookingId of bookingIds) {
        qc.invalidateQueries({ queryKey: ['booking', bookingId] });
      }

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
    if (!amount || Number(amount) <= 0) {
      setError('Vui lòng nhập số tiền hợp lệ');
      return;
    }
    if (Number(amount) > remaining) {
      setError(`Số tiền vượt quá số còn lại (${formatVND(remaining)})`);
      return;
    }
    mutation.mutate();
  };

  const fills = [
    { label: '50%', v: Math.floor(remaining * 0.5) },
    { label: '100%', v: remaining },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
            <Banknote className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-foreground">Ghi nhận thanh toán</h2>
            <p className="truncate text-xs text-muted-foreground">
              {isBatch ? `${bookingRef} · ${orderedLedgers.length} khoản nợ` : primaryLedger.code} · {partyName} · Còn lại:{' '}
              <strong className="text-red-500">{formatVND(remaining)}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div className="space-y-2">
            <MoneyInput label="Số tiền" required value={amount} onChange={setAmount} placeholder="0" />
            <div className="flex gap-2">
              {fills.map((fill) => (
                <button
                  key={fill.label}
                  type="button"
                  onClick={() => setAmount(String(fill.v))}
                  className="flex-1 rounded-lg border border-border py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                >
                  {fill.label} · {formatVND(fill.v)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setMethod(item.value);
                  setFundAccount(item.value === 'CASH' ? 'CASH_OFFICE' : 'BANK_HTX');
                }}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left text-xs font-medium transition-colors',
                  method === item.value
                    ? 'border border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:bg-accent',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {isReceivable ? 'Thu vào quỹ' : 'Chi từ quỹ'}
            </label>
            <select
              value={fundAccount}
              onChange={(e) => setFundAccount(e.target.value)}
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
              placeholder="GD123456..."
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Ghi chú</label>
            <textarea
              rows={2}
              placeholder="Ghi chú nội bộ..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-500">
              {error}
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
              disabled={mutation.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Xác nhận
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
