// APG Manager RMS - Booking Detail Page (Part 3: Add Ticket + Add Payment)
'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plane, User, Clock, CreditCard,
  Loader2, Phone, Plus, CheckCircle2, AlertTriangle, XCircle, Banknote, Zap,
} from 'lucide-react';
import { bookingsApi, supplierApi, customersApi } from '@/lib/api';
import {
  cn, formatVND, formatDateTime, formatTime,
  BOOKING_STATUS_LABELS, BOOKING_STATUS_CLASSES,
  BOOKING_SOURCE_LABELS,
} from '@/lib/utils';
import { MoneyInput } from '@/components/ui/money-input';
import { PageHeader } from '@/components/ui/page-header';
import { AirlineBadge } from '@/components/ui/airline-badge';
import { getAirportName } from '@/hooks/use-airport-search';
import type { Booking, BookingStatus, SupplierProfile, Customer } from '@/types';
import { SmartImportModal } from '@/components/booking/smart-import-modal';

// ────────────────────────────────────────────────────
// Status state machine
// ────────────────────────────────────────────────────
// FIX 3: Bổ sung transitions thiếu
const NEXT_ACTIONS: Record<string, { status: BookingStatus; label: string; variant: string }[]> = {
  NEW:             [
    { status: 'PROCESSING',      label: 'Bắt đầu xử lý',   variant: 'primary' },
    { status: 'CANCELLED',       label: 'Hủy',              variant: 'danger' },
  ],
  PROCESSING:      [
    { status: 'QUOTED',           label: 'Đã báo giá',      variant: 'primary' },
    { status: 'CANCELLED',        label: 'Hủy',              variant: 'danger' },
  ],
  QUOTED:          [
    { status: 'PENDING_PAYMENT',  label: 'Chờ thanh toán',  variant: 'primary' },
    { status: 'PROCESSING',       label: 'Quay lại xử lý',  variant: 'secondary' },
    { status: 'CANCELLED',        label: 'Hủy',              variant: 'danger' },
  ],
  PENDING_PAYMENT: [
    { status: 'ISSUED',           label: '✈ Xuất vé',       variant: 'success' },
    { status: 'CANCELLED',        label: 'Hủy',              variant: 'danger' },
  ],
  ISSUED:          [
    { status: 'COMPLETED',        label: 'Hoàn thành',      variant: 'success' },
    { status: 'CHANGED',          label: 'Đổi vé',           variant: 'warning' },
    { status: 'REFUNDED',         label: 'Hoàn vé',          variant: 'warning' },
  ],
  COMPLETED:       [],
  CHANGED:         [
    { status: 'ISSUED',           label: 'Xuất vé mới',     variant: 'primary' },
    { status: 'REFUNDED',         label: 'Hoàn vé',          variant: 'warning' },
  ],
  REFUNDED:        [],
  CANCELLED:       [],
};

// FIX 5: Đồng bộ PAYMENT_METHODS với backend enum
const PAYMENT_METHODS = [
  { value: 'CASH',          label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
  { value: 'CREDIT_CARD',   label: 'Thẻ ngân hàng' },
  { value: 'MOMO',          label: 'MoMo' },
  { value: 'VNPAY',         label: 'VNPay' },
  { value: 'DEBT',          label: 'Công nợ' },
];

const SEAT_CLASSES = ['Economy', 'Business', 'First Class', 'Premium Economy'];
const PASSENGER_TYPES = [
  { value: 'ADT', label: 'Người lớn (ADT)' },
  { value: 'CHD', label: 'Trẻ em (CHD)' },
  { value: 'INF', label: 'Em bé (INF)' },
];

// ────────────────────────────────────────────────────
// Input helper
// ────────────────────────────────────────────────────
function FormInput({ label, required, className, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; required?: boolean }) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="block text-xs font-medium text-foreground mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        {...props}
        className={cn(
          'w-full px-3 h-9 text-[13px] rounded-md border border-border bg-background',
          'text-foreground placeholder:text-muted-foreground',
          'focus:outline-none focus:ring-1 focus:ring-primary',
        )}
      />
    </div>
  );
}

function FormSelect({ label, required, children, className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; required?: boolean }) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="block text-xs font-medium text-foreground mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        {...props}
        className={cn(
          'w-full px-3 h-9 text-[13px] rounded-md border border-border bg-background',
          'text-foreground focus:outline-none focus:ring-1 focus:ring-primary',
        )}
      >
        {children}
      </select>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Add Ticket Modal
// ────────────────────────────────────────────────────
function AddTicketModal({ bookingId, customerId, onClose }: { bookingId: string; customerId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  // FIX 7a: Bỏ tax, serviceFee, commission — chỉ giữ sellPrice + netPrice
  const [form, setForm] = useState({
    passengerName: '',
    passengerType: 'ADT',
    airline: '',             // FIX 4g: String tự do, không enum
    flightNumber: '',
    departureCode: '',
    arrivalCode: '',
    departureTime: '',
    arrivalTime: '',
    seatClass: 'Economy',
    fareClass: '',
    airlineBookingCode: '',
    sellPrice: '',
    netPrice: '',
    eTicketNumber: '',
    baggageAllowance: '',
  });
  const [error, setError] = useState('');

  // FIX 7a: Profit = sell - net (đơn giản)
  const profit = (Number(form.sellPrice) || 0) - (Number(form.netPrice) || 0);

  const mutation = useMutation({
    mutationFn: () => bookingsApi.addTicket(bookingId, {
      passengerName: form.passengerName,
      passengerType: form.passengerType,
      airline: form.airline.toUpperCase(),
      flightNumber: form.flightNumber.toUpperCase(),
      departureCode: form.departureCode.toUpperCase(),
      arrivalCode: form.arrivalCode.toUpperCase(),
      departureTime: form.departureTime,
      arrivalTime: form.arrivalTime,
      seatClass: form.seatClass,
      fareClass: form.fareClass || undefined,
      airlineBookingCode: form.airlineBookingCode.toUpperCase() || undefined,
      sellPrice: Number(form.sellPrice),
      netPrice: Number(form.netPrice),
      tax: 0,
      serviceFee: 0,
      commission: 0,
      eTicketNumber: form.eTicketNumber || undefined,
      baggageAllowance: form.baggageAllowance || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(typeof msg === 'string' ? msg : 'Có lỗi khi thêm vé');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.passengerName) { setError('Vui lòng nhập tên hành khách'); return; }
    if (!form.airline || form.airline.length < 2) { setError('Vui lòng nhập mã hãng bay (2 ký tự IATA)'); return; }
    if (!form.flightNumber)  { setError('Vui lòng nhập số hiệu chuyến bay'); return; }
    if (!form.departureCode || !form.arrivalCode) { setError('Vui lòng nhập sân bay đi/đến'); return; }
    if (!form.departureTime || !form.arrivalTime) { setError('Vui lòng nhập giờ khởi hành/đến'); return; }
    if (!form.sellPrice || !form.netPrice) { setError('Vui lòng nhập giá bán và giá net'); return; }
    mutation.mutate();
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Plane className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Thêm vé chuyến bay</h2>
            <p className="text-xs text-muted-foreground">Điền thông tin vé và hành khách</p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form id="add-ticket-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Passenger */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Hành khách
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <FormInput
                label="Tên hành khách" required
                placeholder="Nguyễn Văn A"
                value={form.passengerName}
                onChange={set('passengerName')}
                className="col-span-2 sm:col-span-1"
              />
              <FormSelect label="Loại hành khách" value={form.passengerType} onChange={set('passengerType')}>
                {PASSENGER_TYPES.map(pt => <option key={pt.value} value={pt.value}>{pt.label}</option>)}
              </FormSelect>
            </div>
          </div>

          {/* Flight info */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Thông tin chuyến bay
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* FIX 4g: Input text tự do cho airline IATA code + preview badge */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  Hãng bay <span className="text-red-500 ml-0.5">*</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    placeholder="VN, EK, SQ..."
                    maxLength={3}
                    value={form.airline}
                    onChange={(e) => setForm(prev => ({ ...prev, airline: e.target.value.toUpperCase() }))}
                    className={cn(
                      'w-20 px-3 h-9 text-[13px] rounded-md border border-border bg-background',
                      'text-foreground placeholder:text-muted-foreground font-mono font-bold uppercase',
                      'focus:outline-none focus:ring-1 focus:ring-primary',
                    )}
                  />
                  {form.airline.length >= 2 && <AirlineBadge code={form.airline} size="md" />}
                </div>
              </div>
              <FormInput label="Số hiệu" required placeholder="VN123" value={form.flightNumber} onChange={set('flightNumber')} />
              <FormInput label="Từ (IATA)" required placeholder="SGN" maxLength={3} value={form.departureCode} onChange={set('departureCode')} />
              <FormInput label="Đến (IATA)" required placeholder="HAN" maxLength={3} value={form.arrivalCode} onChange={set('arrivalCode')} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <FormInput label="Khởi hành" required type="datetime-local" value={form.departureTime} onChange={set('departureTime')} />
              <FormInput label="Hạ cánh" required type="datetime-local" value={form.arrivalTime} onChange={set('arrivalTime')} />
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <FormSelect label="Hạng ghế" value={form.seatClass} onChange={set('seatClass')}>
                {SEAT_CLASSES.map(s => <option key={s} value={s}>{s}</option>)}
              </FormSelect>
              <FormInput label="Mã hạng vé" placeholder="G, Y, M, B..." value={form.fareClass} onChange={set('fareClass')} />
            </div>
            {/* Booking code riêng của hãng */}
            <div className="mt-3">
              <FormInput
                label="Mã đặt chỗ hãng bay (Booking Code)"
                placeholder="Ví dụ: 64NTWM"
                value={form.airlineBookingCode}
                onChange={set('airlineBookingCode')}
                className="uppercase"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
          </div>

          {/* FIX 7a: Pricing — chỉ giữ sellPrice + netPrice */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Giá vé (VNĐ)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MoneyInput label="Giá bán (khách)" required value={form.sellPrice} onChange={v => setForm(p => ({...p, sellPrice: v}))} placeholder="2.500.000" />
              <MoneyInput label="Giá net (hãng)" required value={form.netPrice} onChange={v => setForm(p => ({...p, netPrice: v}))} placeholder="2.200.000" />

              {/* Profit preview */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground mb-1.5">Lợi nhuận (auto)</label>
                <div className={cn(
                  'w-full px-3 h-9 text-[13px] flex items-center rounded-md border font-semibold',
                  profit >= 0 ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-500' : 'border-red-500/50 bg-red-500/10 text-red-500',
                )}>
                  {profit >= 0 ? '+' : ''}{formatVND(profit)}
                </div>
              </div>
            </div>
          </div>

          {/* Extra */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Thông tin bổ sung (tuỳ chọn)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <FormInput label="Số vé điện tử (e-ticket)" placeholder="738-1234567890" value={form.eTicketNumber} onChange={set('eTicketNumber')} />
              <FormInput label="Hành lý" placeholder="23kg" value={form.baggageAllowance} onChange={set('baggageAllowance')} />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-500">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0 bg-muted/20">
          <button
            type="submit"
            form="add-ticket-form"
            disabled={mutation.isPending}
            className="flex-1 h-9 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Thêm vé
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 h-9 border border-border bg-card rounded-md text-[13px] font-medium text-foreground hover:bg-accent active:scale-[0.98] transition-all duration-150"
          >
            Hủy bỏ
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Add Payment Modal
// ────────────────────────────────────────────────────
function AddPaymentModal({ bookingId, totalSellPrice, hasCustomer, onClose }: { bookingId: string; totalSellPrice: number; hasCustomer: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    amount: '',
    method: 'BANK_TRANSFER',
    fundAccount: 'BANK_HTX',   // Default TK BIDV
    reference: '',
    paidAt: new Date().toISOString().slice(0, 16),
    notes: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => bookingsApi.addPayment(bookingId, {
      amount: form.method === 'DEBT' ? totalSellPrice : Number(form.amount),
      method: form.method,
      fundAccount: form.method === 'DEBT' ? undefined : form.fundAccount,
      reference: form.method === 'DEBT' ? undefined : (form.reference || undefined),
      paidAt: form.method === 'DEBT' ? undefined : form.paidAt,
      notes: form.method === 'DEBT' ? 'Ghi nhận công nợ phải thu' : (form.notes || undefined),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
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
    if (form.method !== 'DEBT' && (!form.amount || Number(form.amount) <= 0)) { setError('Vui lòng nhập số tiền hợp lệ'); return; }
    mutation.mutate();
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const quickAmounts = totalSellPrice > 0
    ? [
        { label: '25%', value: Math.round(totalSellPrice * 0.25) },
        { label: '50%', value: Math.round(totalSellPrice * 0.5) },
        { label: '100%', value: totalSellPrice },
      ]
    : [];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Banknote className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Ghi nhận thanh toán</h2>
            <p className="text-xs text-muted-foreground">Tổng cần thu: <strong>{formatVND(totalSellPrice)}</strong></p>
          </div>
          <button onClick={onClose} className="ml-auto text-muted-foreground hover:text-foreground">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Amount + quick-fill — hidden for DEBT */}
          {form.method !== 'DEBT' && (
            <div className="space-y-2">
              <MoneyInput
                label="Số tiền (VND)"
                required
                value={form.amount}
                onChange={(v) => setForm(p => ({ ...p, amount: String(v) }))}
                placeholder="2.000.000"
                className="[&_input]:text-[15px] [&_input]:font-bold [&_input]:h-10"
              />
              {quickAmounts.length > 0 && (
                <div className="flex gap-2">
                  {quickAmounts.map(q => (
                    <button
                      key={q.label}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, amount: String(q.value) }))}
                      className="flex-1 py-1.5 text-xs rounded-lg border border-border hover:border-primary hover:text-primary transition-colors text-muted-foreground"
                    >
                      {q.label} · {formatVND(q.value)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <FormSelect label="Hình thức thanh toán" required value={form.method} onChange={(e) => {
            setForm(p => ({ ...p, method: e.target.value, fundAccount: e.target.value === 'CASH' ? 'CASH_OFFICE' : 'BANK_HTX' }));
          }}>
            {PAYMENT_METHODS.filter(m => m.value !== 'DEBT' || hasCustomer).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </FormSelect>

          {/* Công nợ: auto-ghi nhận, ẩn các trường không cần */}
          {form.method === 'DEBT' ? (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2.5 text-[12px] text-amber-600 dark:text-amber-400">
              <p className="font-medium">Ghi nhận công nợ</p>
              <p className="mt-0.5 text-[11px] opacity-80">Số tiền sẽ được tự động ghi vào công nợ phải thu của khách hàng. Không cần chọn quỹ hay mã giao dịch.</p>
            </div>
          ) : (
            <>
              <FormSelect label="Nhận vào quỹ" required value={form.fundAccount} onChange={set('fundAccount')}>
                <option value="CASH_OFFICE">Quỹ tiền mặt VP</option>
                <option value="BANK_HTX">TK BIDV HTX (3900543757)</option>
                <option value="BANK_PERSONAL">TK MB cá nhân (996106688)</option>
              </FormSelect>

              <FormInput label="Mã giao dịch / Tham chiếu" placeholder="GD123456..." value={form.reference} onChange={set('reference')} />
              <FormInput label="Thời gian thanh toán" type="datetime-local" value={form.paidAt} onChange={set('paidAt')} />

              <div className="space-y-1">
                <label className="block text-xs font-medium text-foreground mb-1.5">Ghi chú</label>
                <textarea
                  placeholder="Ghi chú thêm..."
                  value={form.notes}
                  onChange={set('notes')}
                  rows={2}
                  className={cn(
                    'w-full px-3 py-2 text-[13px] rounded-md border border-border bg-background',
                    'text-foreground placeholder:text-muted-foreground resize-none',
                    'focus:outline-none focus:ring-1 focus:ring-primary',
                  )}
                />
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-500">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 h-9 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 active:scale-[0.98] transition-all duration-150 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Xác nhận
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 h-9 border border-border bg-card rounded-md text-[13px] font-medium text-foreground hover:bg-accent active:scale-[0.98] transition-all duration-150"
            >
              Hủy bỏ
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Payment list row
// ────────────────────────────────────────────────────
function PaymentRow({ payment }: { payment: NonNullable<Booking['payments']>[number] }) {
  // FIX 5: Sync labels với backend enum
  const methodLabel: Record<string, string> = {
    CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', CREDIT_CARD: 'Thẻ ngân hàng',
    MOMO: 'MoMo', VNPAY: 'VNPay', DEBT: 'Công nợ',
  };
  const fundLabels: Record<string, string> = {
    CASH_OFFICE: 'Tiền mặt VP', BANK_HTX: 'TK BIDV HTX', BANK_PERSONAL: 'TK MB',
  };
  const fundLabel = (payment as unknown as Record<string, unknown>).fundAccount
    ? fundLabels[(payment as unknown as Record<string, unknown>).fundAccount as string] ?? ''
    : '';
  return (
    <div className="flex items-center justify-between py-2.5 px-1 border-b border-border/50 last:border-0">
      <div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{methodLabel[payment.method] ?? payment.method}</p>
          {fundLabel && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {fundLabel}
            </span>
          )}
        </div>
        {payment.reference && (
          <p className="text-xs text-muted-foreground font-mono">{payment.reference}</p>
        )}
        <p className="text-xs text-muted-foreground">{formatDateTime(payment.paidAt)}</p>
      </div>
      <p className="text-sm font-bold text-emerald-500">+{formatVND(payment.amount)}</p>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Customer Search & Link Component
// ────────────────────────────────────────────────────
function CustomerSearchLink({ bookingId, contactPhone }: { bookingId: string; contactPhone: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const { data: searchResults } = useQuery({
    queryKey: ['customer-search', search],
    queryFn: () => customersApi.list({ search, pageSize: 5 }),
    select: (r) => r.data?.data ?? [],
    enabled: search.length >= 2,
  });

  const linkMutation = useMutation({
    mutationFn: (customerId: string) =>
      bookingsApi.update(bookingId, { customerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      setShowSearch(false);
    },
  });

  if (!showSearch) {
    return (
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">Chưa liên kết khách hàng</p>
        <button
          onClick={() => { setShowSearch(true); setSearch(contactPhone || ''); }}
          className="text-xs text-primary hover:underline font-medium"
        >
          + Tìm & liên kết KH
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo tên hoặc SĐT..."
          className={cn(
            'flex-1 px-3 h-8 text-[12px] rounded-md border border-border bg-background',
            'text-foreground placeholder:text-muted-foreground',
            'focus:outline-none focus:ring-1 focus:ring-primary',
          )}
          autoFocus
        />
        <button
          onClick={() => setShowSearch(false)}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Hủy
        </button>
      </div>
      {search.length >= 2 && (
        <div className="border border-border rounded-md divide-y divide-border/50 max-h-40 overflow-y-auto">
          {(searchResults ?? []).length === 0 ? (
            <p className="text-[11px] text-muted-foreground p-3 text-center">Không tìm thấy KH nào</p>
          ) : (
            (searchResults ?? []).map((c: { id: string; fullName: string; phone: string; type: string }) => (
              <button
                key={c.id}
                onClick={() => linkMutation.mutate(c.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-[12px] hover:bg-accent transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-foreground">{c.fullName}</p>
                  <p className="text-[11px] text-muted-foreground">{c.phone} · {c.type === 'CORPORATE' ? 'DN' : 'CN'}</p>
                </div>
                <span className="text-[10px] text-primary">Chọn</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────
// Customer Inline Display (with edit) in Booking
// ────────────────────────────────────────────────────
function CustomerInlineDisplay({ customer, bookingId }: { customer: Customer; bookingId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: customer.fullName, phone: customer.phone });

  const mutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => customersApi.update(customer.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', bookingId] });
      queryClient.invalidateQueries({ queryKey: ['customer', customer.id] });
      setEditing(false);
    },
  });

  if (editing) {
    return (
      <div className="space-y-2">
        <div className="space-y-1.5">
          <input
            value={form.fullName}
            onChange={(e) => setForm(p => ({ ...p, fullName: e.target.value }))}
            placeholder="Tên khách hàng"
            className="w-full px-3 h-7 text-[12px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="Số điện thoại"
            className="w-full px-3 h-7 text-[12px] rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => mutation.mutate({ fullName: form.fullName.trim(), phone: form.phone.trim() })}
            disabled={!form.fullName.trim() || !form.phone.trim() || mutation.isPending}
            className="text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
          >
            {mutation.isPending ? 'Đang lưu...' : 'Lưu'}
          </button>
          <button onClick={() => setEditing(false)} className="text-[11px] text-muted-foreground hover:text-foreground">Hủy</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
          {customer.fullName?.charAt(0) || 'K'}
        </div>
        <div>
          <p className="text-[13px] font-medium text-foreground">{customer.fullName}</p>
          <p className="text-[11px] text-muted-foreground">{customer.phone} · {customer.type === 'CORPORATE' ? 'Doanh nghiệp' : 'Cá nhân'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => { setForm({ fullName: customer.fullName, phone: customer.phone }); setEditing(true); }} className="text-[10px] text-primary hover:underline">Sửa</button>
        <span className={cn(
          'text-[10px] px-2 py-0.5 rounded-full font-medium',
          customer.vipTier === 'PLATINUM' ? 'bg-purple-500/10 text-purple-500' :
          customer.vipTier === 'GOLD' ? 'bg-amber-500/10 text-amber-500' :
          customer.vipTier === 'SILVER' ? 'bg-zinc-400/10 text-zinc-500' :
          'bg-accent text-muted-foreground'
        )}>
          {customer.vipTier || 'NORMAL'}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Main Page
// ────────────────────────────────────────────────────
export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [statusReason, setStatusReason]   = useState('');
  const [confirmAction, setConfirmAction] = useState<{ status: BookingStatus; label: string } | null>(null);
  const [showAddTicket, setShowAddTicket]   = useState(false);
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [quickImportInitialized, setQuickImportInitialized] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({ code: '', name: '', type: 'AIRLINE' as string, contactName: '' });

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id),
    select: (r) => r.data as Booking,
  });

  // Load danh sách NCC
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.list(),
    select: (r) => r.data as SupplierProfile[],
  });

  // Mutation cập nhật supplier cho booking
  const supplierMutation = useMutation({
    mutationFn: (supplierId: string | null) =>
      bookingsApi.update(id, { supplierId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['booking', id] }),
  });

  // Mutation tạo NCC mới
  const createSupplierMutation = useMutation({
    mutationFn: (data: typeof newSupplierForm) =>
      supplierApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      const created = (res.data as SupplierProfile);
      if (created?.id) supplierMutation.mutate(created.id);
      setShowNewSupplier(false);
      setNewSupplierForm({ code: '', name: '', type: 'AIRLINE', contactName: '' });
    },
  });

  const statusMutation = useMutation({
    mutationFn: (toStatus: BookingStatus) =>
      bookingsApi.updateStatus(id, toStatus, statusReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setConfirmAction(null);
      setStatusReason('');
    },
  });

  useEffect(() => {
    if (quickImportInitialized || !booking || typeof window === 'undefined') return;

    const pendingQuickImportId = window.sessionStorage.getItem('booking:openQuickImport');
    const url = new URL(window.location.href);
    const shouldOpenQuickImport = pendingQuickImportId === id || url.searchParams.get('quickImport') === '1';
    if (!shouldOpenQuickImport) return;

    if (pendingQuickImportId === id) {
      window.sessionStorage.removeItem('booking:openQuickImport');
    }

    if (url.searchParams.get('quickImport') === '1') {
      url.searchParams.delete('quickImport');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    }

    const canOpenQuickImport = !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(booking.status);
    setQuickImportInitialized(true);
    if (canOpenQuickImport) setShowSmartImport(true);
  }, [quickImportInitialized, booking, id]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const bk: Booking = booking ?? SAMPLE_BOOKING;
  const actions = NEXT_ACTIONS[bk.status] ?? [];
  const totalPaid = (bk.payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalRemaining = Number(bk.totalSellPrice) - totalPaid;
  const canAddTicket  = !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(bk.status);
  const canAddPayment = !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(bk.status);

  return (
    <div className="max-w-[1200px] space-y-4">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Link href="/bookings" className="p-1 rounded-md hover:bg-accent transition-colors -ml-1">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </Link>
            <div className="flex flex-col gap-0">
              <span className="font-mono font-bold tracking-widest text-[15px]">
                {bk.pnr || bk.bookingCode}
              </span>
              {bk.pnr && (
                <span className="text-[10px] text-muted-foreground font-mono">{bk.bookingCode}</span>
              )}
            </div>
            <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium', BOOKING_STATUS_CLASSES[bk.status])}>
              {BOOKING_STATUS_LABELS[bk.status]}
            </span>
          </div>
        }
        description={`${BOOKING_SOURCE_LABELS[bk.source]} · ${formatDateTime(bk.createdAt)}`}
        actions={
          <div className="flex gap-2 flex-wrap justify-end">
            {canAddTicket && (
              <>
                <button
                  onClick={() => setShowSmartImport(true)}
                  className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-secondary text-secondary-foreground border border-border hover:bg-accent flex items-center gap-1.5 transition-colors"
                  title="Nhập vé tự động từ text/ảnh"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> Nhập nhanh
                </button>
                <button
                  onClick={() => setShowAddTicket(true)}
                  className="px-3 py-1.5 rounded-md text-[13px] font-medium bg-secondary text-secondary-foreground border border-border hover:bg-accent flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 text-muted-foreground" /> Thêm vé
                </button>
              </>
            )}
            {canAddPayment && (
              <div className="relative group">
                <button
                  onClick={() => bk.customer ? setShowAddPayment(true) : null}
                  disabled={!bk.customer}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-[13px] font-medium bg-secondary text-secondary-foreground border border-border flex items-center gap-1.5 transition-colors',
                    bk.customer ? 'hover:bg-accent' : 'opacity-50 cursor-not-allowed',
                  )}
                >
                  <Banknote className="w-3.5 h-3.5 text-emerald-500" /> Ghi thanh toán
                </button>
                {!bk.customer && (
                  <div className="absolute top-full mt-1 left-0 bg-card border border-border rounded-md px-2 py-1 text-[10px] text-muted-foreground whitespace-nowrap shadow-lg hidden group-hover:block z-10">
                    Cần liên kết khách hàng trước
                  </div>
                )}
              </div>
            )}
            {actions.map((action) => (
              <button
                key={action.status}
                onClick={() => setConfirmAction({ status: action.status, label: action.label })}
                className={cn(
                  'px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors border border-transparent',
                  action.variant === 'primary' && 'bg-foreground text-background hover:opacity-90',
                  action.variant === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-700',
                  action.variant === 'danger'  && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                  action.variant === 'warning' && 'bg-warning text-warning-foreground hover:bg-warning/90',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Details (70%) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact info + Customer link */}
          <div className="card p-4">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
              <h3 className="text-[13px] font-medium text-foreground">Contact Information</h3>
              {bk.customer && (
                <Link
                  href={`/customers/${bk.customer.id}`}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Xem hồ sơ KH →
                </Link>
              )}
            </div>
            <div className="flex flex-col text-[13px]">
              <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                <span className="text-muted-foreground">Tên liên hệ</span>
                <span className="font-medium text-foreground">{bk.contactName}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                <span className="text-muted-foreground">Số điện thoại</span>
                <span className="font-medium text-foreground flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  {bk.contactPhone}
                </span>
              </div>
              {bk.pnr && (
                <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                  <span className="text-muted-foreground">Mã PNR (GDS)</span>
                  <span className="font-mono font-bold text-primary">{bk.pnr}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2.5 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground">Nguồn</span>
                <span className="text-foreground">{BOOKING_SOURCE_LABELS[bk.source]}</span>
              </div>

              {/* Linked Customer */}
              <div className="mt-3 pt-3 border-t border-border">
                {bk.customer ? (
                  <CustomerInlineDisplay customer={bk.customer} bookingId={id} />
                ) : (
                  <CustomerSearchLink bookingId={id} contactPhone={bk.contactPhone} />
                )}
              </div>
            </div>
            {bk.notes && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-[13px] text-muted-foreground mb-1">Ghi chú</p>
                <p className="text-[13px] text-foreground">{bk.notes}</p>
              </div>
            )}
          </div>

          {/* Supplier (NCC) selector */}
          <div className="card p-4">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
              <h3 className="text-[13px] font-medium text-foreground">Nhà cung cấp (NCC)</h3>
              <button
                onClick={() => setShowNewSupplier(!showNewSupplier)}
                className="text-xs text-primary hover:underline font-medium"
              >
                {showNewSupplier ? 'Hủy' : '+ Tạo NCC mới'}
              </button>
            </div>

            {/* Dropdown chọn NCC */}
            <div className="space-y-3">
              <FormSelect
                label="Chọn nhà cung cấp"
                value={bk.supplierId || ''}
                onChange={(e) => supplierMutation.mutate(e.target.value || null)}
              >
                <option value="">— Chưa chọn NCC —</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                ))}
              </FormSelect>

              {/* Supplier badge */}
              {bk.supplier && (
                <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-lg border border-border/50">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                    {bk.supplier.code?.slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-foreground">{bk.supplier.name}</p>
                    {bk.supplier.contactName && (
                      <p className="text-[11px] text-muted-foreground">{bk.supplier.contactName}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Inline form tạo NCC mới */}
              {showNewSupplier && (
                <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-border/50">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tạo NCC mới</p>
                  <div className="grid grid-cols-2 gap-2">
                    <FormInput
                      label="Mã NCC" required
                      placeholder="VN, SCCM..."
                      value={newSupplierForm.code}
                      onChange={(e) => setNewSupplierForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    />
                    <FormInput
                      label="Tên NCC" required
                      placeholder="Vietnam Airlines"
                      value={newSupplierForm.name}
                      onChange={(e) => setNewSupplierForm(p => ({ ...p, name: e.target.value }))}
                    />
                    <FormSelect
                      label="Loại"
                      value={newSupplierForm.type}
                      onChange={(e) => setNewSupplierForm(p => ({ ...p, type: e.target.value }))}
                    >
                      <option value="AIRLINE">Hãng bay</option>
                      <option value="GDS_PROVIDER">GDS Provider</option>
                      <option value="PARTNER">Đối tác</option>
                      <option value="OTHER_SUPPLIER">Khác</option>
                    </FormSelect>
                    <FormInput
                      label="Người liên hệ"
                      placeholder="Mr/Ms..."
                      value={newSupplierForm.contactName}
                      onChange={(e) => setNewSupplierForm(p => ({ ...p, contactName: e.target.value }))}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!newSupplierForm.code || !newSupplierForm.name) return;
                      createSupplierMutation.mutate(newSupplierForm);
                    }}
                    disabled={createSupplierMutation.isPending || !newSupplierForm.code || !newSupplierForm.name}
                    className="w-full mt-1 py-1.5 bg-foreground text-background rounded-md text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {createSupplierMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Tạo & Gán NCC
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tickets */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-[13px] font-medium text-foreground">Hành trình ({bk.tickets?.length ?? 0} vé)</h3>
                {bk.pnr && (
                  <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-md font-mono font-bold text-amber-600 dark:text-amber-400 text-[13px] tracking-widest">
                    {bk.pnr}
                  </span>
                )}
              </div>
              {canAddTicket && (
                <button
                  onClick={() => setShowAddTicket(true)}
                  className="flex items-center gap-1 text-[13px] text-muted-foreground hover:text-foreground font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm mới
                </button>
              )}
            </div>

            {(bk.tickets ?? []).length === 0 ? (
              <div className="p-8 text-center">
                <Plane className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Chưa có vé nào</p>
                {canAddTicket && (
                  <button
                    onClick={() => setShowAddTicket(true)}
                    className="mt-3 px-4 py-2 bg-primary/10 text-primary text-xs rounded-lg hover:bg-primary/20 font-medium"
                  >
                    + Thêm vé đầu tiên
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {(bk.tickets ?? []).map((ticket) => (
                  <div key={ticket.id} className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {/* FIX 8: AirlineBadge với logo từ Kiwi CDN */}
                        <AirlineBadge code={ticket.airline} showName={false} size="md" />
                        <span className="text-[13px] font-mono font-medium text-foreground mt-0.5">{ticket.flightNumber}</span>
                        <span className="text-[11px] text-muted-foreground mt-0.5 ml-1">{ticket.seatClass}</span>
                        {ticket.fareClass && (
                          <span className="px-1.5 py-0.5 bg-accent rounded text-[11px] font-mono mt-0.5">{ticket.fareClass}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-bold font-tabular text-foreground">{formatVND(ticket.sellPrice)}</p>
                        <p className="text-[11px] font-tabular text-emerald-500">+{formatVND(ticket.profit)}</p>
                      </div>
                    </div>

                    {/* FIX 8: Route with airport names */}
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xl font-bold text-foreground">{ticket.departureCode}</p>
                        <p className="text-[10px] text-muted-foreground">{getAirportName(ticket.departureCode)}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(ticket.departureTime)}</p>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 border-t border-dashed border-border" />
                        <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                        <div className="flex-1 border-t border-dashed border-border" />
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-foreground">{ticket.arrivalCode}</p>
                        <p className="text-[10px] text-muted-foreground">{getAirportName(ticket.arrivalCode)}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(ticket.arrivalTime)}</p>
                      </div>
                    </div>

                    {/* Passenger + eticket + booking code */}
                    {ticket.passenger && (
                      <p className="mt-2.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{ticket.passenger.fullName}</span>
                        <span className="ml-1 opacity-60">({ticket.passenger.type})</span>
                        {ticket.airlineBookingCode && (
                          <span className="ml-2 font-mono font-bold text-primary"> · Code: {ticket.airlineBookingCode}</span>
                        )}
                        {ticket.eTicketNumber && (
                          <span className="ml-2 font-mono text-primary opacity-80"> · {ticket.eTicketNumber}</span>
                        )}
                        {ticket.baggageAllowance && (
                          <span className="ml-2 opacity-60"> · {ticket.baggageAllowance}</span>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial summary */}
          <div className="card p-4">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
              <h3 className="text-[13px] font-medium text-foreground">Tài chính</h3>
            </div>
            <div className="flex flex-col text-[13px]">
              {[
                { label: 'Giá bán (khách)',    value: formatVND(bk.totalSellPrice),  bold: false },
                { label: 'Giá net (hãng bay)', value: formatVND(bk.totalNetPrice),   bold: false },
                { label: 'Phí dịch vụ',        value: formatVND(bk.totalFees),       bold: false },
                { label: 'Lợi nhuận',           value: `+${formatVND(bk.profit)}`,   bold: true,  green: true },
              ].map((row, idx, arr) => (
                <div key={row.label} className={cn('flex items-center justify-between py-2.5', idx !== arr.length - 1 && 'border-b border-border/50')}>
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={cn('font-medium', row.green ? 'text-emerald-500' : 'text-foreground')}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Payment status */}
            <div className="mt-4 pt-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Trạng thái thanh toán</span>
                <span className={cn(
                  'px-2.5 py-0.5 rounded-full text-[11px] font-medium',
                  bk.paymentStatus === 'PAID'    && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                  bk.paymentStatus === 'PARTIAL' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                  bk.paymentStatus === 'UNPAID'  && 'bg-red-500/10 text-red-600 dark:text-red-400',
                )}>
                  {bk.paymentStatus === 'PAID'    ? '✅ Đã thanh toán đủ'
                   : bk.paymentStatus === 'PARTIAL' ? '⚠ Thanh toán một phần'
                   : '❌ Chưa thanh toán'}
                </span>
              </div>
              {Number(bk.totalSellPrice) > 0 && (
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Đã thu / Còn lại</span>
                  <span className="font-medium">
                    <span className="text-emerald-500">{formatVND(totalPaid)}</span>
                    {totalRemaining > 0 && <span className="text-red-400"> / -{formatVND(totalRemaining)}</span>}
                  </span>
                </div>
              )}
            </div>

            {/* Payments list */}
            {(bk.payments ?? []).length > 0 && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs font-medium text-muted-foreground mb-2">Lịch sử nhận tiền</p>
                {(bk.payments ?? []).map(p => <PaymentRow key={p.id} payment={p} />)}
              </div>
            )}
            {canAddPayment && (
              <button
                onClick={() => setShowAddPayment(true)}
                className="mt-4 w-full py-2 border border-border bg-accent/50 rounded-lg text-xs font-medium text-foreground hover:bg-accent transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Ghi nhận thanh toán mới
              </button>
            )}
          </div>

          {/* Linked Ledgers (AR/AP) */}
          {(bk.ledgers ?? []).length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
                <h3 className="text-[13px] font-medium text-foreground">Công nợ liên kết ({bk.ledgers!.length})</h3>
              </div>
              <div className="flex flex-col text-[13px] divide-y divide-border/50">
                {bk.ledgers!.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-bold',
                        l.direction === 'RECEIVABLE'
                          ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
                      )}>
                        {l.direction === 'RECEIVABLE' ? 'AR' : 'AP'}
                      </span>
                      <span className="font-mono text-muted-foreground">{l.code}</span>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        'font-medium font-tabular',
                        l.status === 'PAID' ? 'text-emerald-500' : 'text-foreground',
                      )}>
                        {formatVND(l.remaining)}
                      </span>
                      <span className={cn(
                        'ml-2 px-1.5 py-0.5 rounded text-[10px]',
                        l.status === 'PAID' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                        l.status === 'ACTIVE' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
                        l.status === 'OVERDUE' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                        l.status === 'PARTIAL_PAID' && 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
                      )}>
                        {l.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Timeline + Staff */}
        <div className="space-y-4">
          {/* Status timeline */}
          <div className="card p-4">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
              <h3 className="text-[13px] font-medium text-foreground">Lịch sử & sự kiện</h3>
            </div>
            {(() => {
              // Merge statusHistory + ledger auto-events
              type TimelineEvent = { time: string; type: 'status' | 'ar' | 'ap'; label: string; detail?: string };
              const events: TimelineEvent[] = [
                ...(bk.statusHistory ?? []).map(h => ({
                  time: h.createdAt,
                  type: 'status' as const,
                  label: `${BOOKING_STATUS_LABELS[h.fromStatus as BookingStatus] ?? h.fromStatus} → ${BOOKING_STATUS_LABELS[h.toStatus as BookingStatus] ?? h.toStatus}`,
                  detail: h.reason || undefined,
                })),
                ...(bk.ledgers ?? []).map(l => ({
                  time: l.createdAt || new Date().toISOString(),
                  type: (l.direction === 'RECEIVABLE' ? 'ar' : 'ap') as 'ar' | 'ap',
                  label: l.direction === 'RECEIVABLE'
                    ? `Auto: Tạo AR ${l.code} — ${formatVND(l.totalAmount)}`
                    : `Auto: Tạo AP ${l.code} — ${formatVND(l.totalAmount)}`,
                  detail: l.status === 'PAID' ? 'Đã TT' : l.status === 'PARTIAL_PAID' ? 'TT 1 phần' : 'Chưa TT',
                })),
              ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

              return (
                <div className="space-y-3">
                  {events.map((ev, i) => (
                    <div key={i} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                          ev.type === 'status' ? (i === events.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40')
                            : ev.type === 'ar' ? 'bg-blue-500' : 'bg-amber-500'
                        )} />
                        {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                      </div>
                      <div className="pb-3 min-w-0">
                        <p className="text-xs font-medium text-foreground">{ev.label}</p>
                        {ev.detail && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{ev.detail}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(ev.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Staff info */}
          <div className="card p-4">
            <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
              <h3 className="text-[13px] font-medium text-foreground">Nhân viên phụ trách</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {(bk.staff?.fullName?.[0] || 'U').toUpperCase()}
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">{bk.staff?.fullName ?? 'Chưa phân công'}</p>
                {bk.staff?.email && <p className="text-[11px] text-muted-foreground">{bk.staff.email}</p>}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="card p-4">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
              <h3 className="text-[13px] font-medium text-foreground">Tóm tắt</h3>
            </div>
            <div className="flex flex-col text-[13px]">
              <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                <span className="text-muted-foreground">Số vé</span>
                <span className="font-medium text-foreground">{bk.tickets?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                <span className="text-muted-foreground">Tổng thu</span>
                <span className="font-medium font-tabular text-foreground">{formatVND(bk.totalSellPrice)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                <span className="text-muted-foreground">Lợi nhuận</span>
                <span className="font-medium font-tabular text-emerald-500">+{formatVND(bk.profit)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Đã thu</span>
                <span className={cn('font-medium font-tabular', totalPaid >= Number(bk.totalSellPrice) ? 'text-emerald-500' : 'text-amber-500')}>
                  {formatVND(totalPaid)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm status change modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-foreground mb-2">
              Xác nhận: {confirmAction.label}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Booking <span className="font-mono text-primary">{bk.bookingCode}</span> sẽ được chuyển sang{' '}
              <strong>{BOOKING_STATUS_LABELS[confirmAction.status]}</strong>.
            </p>

            <textarea
              placeholder="Ghi chú lý do (không bắt buộc)..."
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              rows={2}
              className={cn(
                'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background',
                'text-foreground placeholder:text-muted-foreground resize-none',
                'focus:outline-none focus:ring-1 focus:ring-primary mb-4',
              )}
            />

            <div className="flex gap-2">
              <button
                onClick={() => statusMutation.mutate(confirmAction.status)}
                disabled={statusMutation.isPending}
                className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {statusMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Ticket Modal */}
      {showAddTicket && (
        <AddTicketModal
          bookingId={bk.id}
          customerId={bk.customerId}
          onClose={() => setShowAddTicket(false)}
        />
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <AddPaymentModal
          bookingId={bk.id}
          totalSellPrice={Number(bk.totalSellPrice)}
          hasCustomer={!!bk.customer}
          onClose={() => setShowAddPayment(false)}
        />
      )}

      {showSmartImport && (
        <SmartImportModal
          bookingId={bk.id}
          customerId={bk.customerId}
          isOpen={showSmartImport}
          onClose={() => setShowSmartImport(false)}
          onSuccess={() => {
            setShowSmartImport(false);
            queryClient.invalidateQueries({ queryKey: ['booking', id] });
          }}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────
// Sample data (phòng khi API chưa trả về)
// ────────────────────────────────────────────────────
const SAMPLE_BOOKING: Booking = {
  id: '1', bookingCode: 'APG-260321-023',
  customerId: 'c1', staffId: 's1',
  status: 'PENDING_PAYMENT', source: 'PHONE',
  contactName: 'Nguyễn Văn Minh', contactPhone: '0901234567',
  totalSellPrice: 5_700_000, totalNetPrice: 5_100_000,
  totalFees: 150_000, profit: 450_000,
  paymentMethod: 'BANK_TRANSFER', paymentStatus: 'PARTIAL',
  pnr: 'ABCXYZ', notes: 'Khách yêu cầu ghế cửa sổ',
  createdAt: '2026-03-21T08:30:00Z', updatedAt: '2026-03-21T10:00:00Z',
  staff: { id: 's1', email: 'sales1@tanphuapg.com', fullName: 'Nguyễn Thị Hương', role: 'SALES', isActive: true, createdAt: '', updatedAt: '' },
  payments: [
    { id: 'pay1', bookingId: '1', amount: 2_000_000, method: 'BANK_TRANSFER', reference: 'GD001', paidAt: '2026-03-21T09:00:00Z', notes: 'Đặt cọc 35%', createdAt: '2026-03-21T09:00:00Z' },
  ],
  tickets: [{
    id: 't1', bookingId: '1', passengerId: 'p1',
    airline: 'QH', flightNumber: 'QH201',
    departureCode: 'HAN', arrivalCode: 'PQC',
    departureTime: '2026-04-15T06:30:00Z', arrivalTime: '2026-04-15T08:45:00Z',
    seatClass: 'Economy', fareClass: 'G',
    sellPrice: 1_900_000, netPrice: 1_700_000, tax: 0, serviceFee: 50_000, commission: 0, profit: 150_000,
    status: 'ACTIVE', eTicketNumber: '738-1234567890', baggageAllowance: '23kg', createdAt: '2026-03-21T08:30:00Z',
    passenger: { id: 'p1', fullName: 'Nguyễn Văn Minh', type: 'ADT', createdAt: '' },
  }],
  statusHistory: [
    { id: 'l1', bookingId: '1', fromStatus: 'NEW', toStatus: 'NEW', changedBy: 's1', reason: 'Tạo booking mới', createdAt: '2026-03-21T08:30:00Z' },
    { id: 'l2', bookingId: '1', fromStatus: 'NEW', toStatus: 'PROCESSING', changedBy: 's1', createdAt: '2026-03-21T08:45:00Z' },
    { id: 'l3', bookingId: '1', fromStatus: 'PROCESSING', toStatus: 'QUOTED', changedBy: 's1', reason: 'Đã gửi báo giá', createdAt: '2026-03-21T09:15:00Z' },
    { id: 'l4', bookingId: '1', fromStatus: 'QUOTED', toStatus: 'PENDING_PAYMENT', changedBy: 's1', createdAt: '2026-03-21T10:00:00Z' },
  ],
};
