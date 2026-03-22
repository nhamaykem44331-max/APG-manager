// APG Manager RMS - Booking Detail Page (Part 3: Add Ticket + Add Payment)
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plane, User, Clock, CreditCard,
  Loader2, Phone, Plus, CheckCircle2, AlertTriangle, XCircle, Banknote,
} from 'lucide-react';
import { bookingsApi } from '@/lib/api';
import {
  cn, formatVND, formatDateTime, formatTime,
  BOOKING_STATUS_LABELS, BOOKING_STATUS_CLASSES,
  BOOKING_SOURCE_LABELS, AIRLINE_NAMES, AIRLINE_COLORS,
} from '@/lib/utils';
import { MoneyInput } from '@/components/ui/money-input';
import type { Booking, BookingStatus } from '@/types';

// ────────────────────────────────────────────────────
// Status state machine
// ────────────────────────────────────────────────────
const NEXT_ACTIONS: Record<string, { status: BookingStatus; label: string; variant: string }[]> = {
  NEW:             [{ status: 'PROCESSING',      label: 'Bắt đầu xử lý',   variant: 'primary' }, { status: 'CANCELLED', label: 'Hủy', variant: 'danger' }],
  PROCESSING:      [{ status: 'QUOTED',           label: 'Đã báo giá',      variant: 'primary' }, { status: 'CANCELLED', label: 'Hủy', variant: 'danger' }],
  QUOTED:          [{ status: 'PENDING_PAYMENT',  label: 'Chờ thanh toán',  variant: 'primary' }, { status: 'CANCELLED', label: 'Hủy', variant: 'danger' }],
  PENDING_PAYMENT: [{ status: 'ISSUED',           label: '✈ Xuất vé',       variant: 'success' }, { status: 'CANCELLED', label: 'Hủy', variant: 'danger' }],
  ISSUED:          [{ status: 'COMPLETED',        label: 'Hoàn thành',      variant: 'success' }, { status: 'REFUNDED',  label: 'Hoàn vé', variant: 'warning' }],
  COMPLETED:       [],
  CHANGED:         [{ status: 'ISSUED',           label: 'Xuất vé mới',     variant: 'primary' }],
  REFUNDED:        [],
  CANCELLED:       [],
};

const AIRLINES = ['VN', 'QH', 'VJ', 'BL', 'VU', '0V', 'VH'] as const;
const PAYMENT_METHODS = [
  { value: 'CASH',          label: 'Tiền mặt' },
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
  { value: 'CARD',          label: 'Thẻ ngân hàng' },
  { value: 'MOMO',          label: 'MoMo' },
  { value: 'ZALOPAY',       label: 'ZaloPay' },
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
      <label className="block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        {...props}
        className={cn(
          'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background',
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
      <label className="block text-xs font-medium text-muted-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <select
        {...props}
        className={cn(
          'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background',
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
  const [form, setForm] = useState({
    passengerName: '',
    passengerType: 'ADT',
    airline: 'VN',
    flightNumber: '',
    departureCode: '',
    arrivalCode: '',
    departureTime: '',
    arrivalTime: '',
    seatClass: 'Economy',
    fareClass: '',
    airlineBookingCode: '',  // Mã đặt chỗ hãng bay: 64NTWM
    sellPrice: '',
    netPrice: '',
    tax: '0',
    serviceFee: '0',
    commission: '0',
    eTicketNumber: '',
    baggageAllowance: '',
  });
  const [error, setError] = useState('');

  const profit = (Number(form.sellPrice) || 0)
    - (Number(form.netPrice) || 0)
    - (Number(form.tax) || 0)
    - (Number(form.serviceFee) || 0)
    + (Number(form.commission) || 0);

  const mutation = useMutation({
    mutationFn: () => bookingsApi.addTicket(bookingId, {
      passengerName: form.passengerName,
      passengerType: form.passengerType,
      airline: form.airline,
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
      tax: Number(form.tax),
      serviceFee: Number(form.serviceFee),
      commission: Number(form.commission),
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
              <FormSelect label="Hãng bay" required value={form.airline} onChange={set('airline')}>
                {AIRLINES.map(a => (
                  <option key={a} value={a}>{AIRLINE_NAMES?.[a] ?? a}</option>
                ))}
              </FormSelect>
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

          {/* Pricing */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Giá vé (VND)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <MoneyInput label="Giá bán (khách)" required value={form.sellPrice} onChange={v => setForm(p => ({...p, sellPrice: v}))} placeholder="2.500.000" />
              <MoneyInput label="Giá net (hãng)" required value={form.netPrice} onChange={v => setForm(p => ({...p, netPrice: v}))} placeholder="2.200.000" />
              <MoneyInput label="Thuế & phí (TAX)" value={form.tax} onChange={v => setForm(p => ({...p, tax: v}))} placeholder="0" />
              <MoneyInput label="Phí dịch vụ" value={form.serviceFee} onChange={v => setForm(p => ({...p, serviceFee: v}))} placeholder="0" />
              <MoneyInput label="Hoa hồng (Commission)" value={form.commission} onChange={v => setForm(p => ({...p, commission: v}))} placeholder="0" />

              {/* Profit preview */}
              <div className="space-y-1">
                <label className="block text-xs font-medium text-muted-foreground">Lợi nhuận (tính ngay)</label>
                <div className={cn(
                  'w-full px-3 py-2 text-sm rounded-lg border font-semibold',
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
        <div className="px-6 py-4 border-t border-border flex gap-3 flex-shrink-0">
          <button
            type="submit"
            form="add-ticket-form"
            disabled={mutation.isPending}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Thêm vé
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-accent"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Add Payment Modal
// ────────────────────────────────────────────────────
function AddPaymentModal({ bookingId, totalSellPrice, onClose }: { bookingId: string; totalSellPrice: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    amount: '',
    method: 'BANK_TRANSFER',
    reference: '',
    paidAt: new Date().toISOString().slice(0, 16),
    notes: '',
  });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => bookingsApi.addPayment(bookingId, {
      amount: Number(form.amount),
      method: form.method,
      reference: form.reference || undefined,
      paidAt: form.paidAt,
      notes: form.notes || undefined,
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
    if (!form.amount || Number(form.amount) <= 0) { setError('Vui lòng nhập số tiền hợp lệ'); return; }
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
          {/* Amount + quick-fill */}
          <div className="space-y-2">
            <MoneyInput
              label="Số tiền (VND)"
              required
              value={form.amount}
              onChange={(v) => setForm(p => ({ ...p, amount: v }))}
              placeholder="2.000.000"
              className="[&_input]:text-lg [&_input]:font-bold [&_input]:py-2.5"
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

          <FormSelect label="Hình thức thanh toán" required value={form.method} onChange={set('method')}>
            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </FormSelect>

          <FormInput label="Mã giao dịch / Tham chiếu" placeholder="GD123456..." value={form.reference} onChange={set('reference')} />
          <FormInput label="Thời gian thanh toán" type="datetime-local" value={form.paidAt} onChange={set('paidAt')} />

          <div className="space-y-1">
            <label className="block text-xs font-medium text-muted-foreground">Ghi chú</label>
            <textarea
              placeholder="Ghi chú thêm..."
              value={form.notes}
              onChange={set('notes')}
              rows={2}
              className={cn(
                'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background',
                'text-foreground placeholder:text-muted-foreground resize-none',
                'focus:outline-none focus:ring-1 focus:ring-primary',
              )}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-500">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Xác nhận thanh toán
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:bg-accent"
            >
              Hủy
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
  const methodLabel: Record<string, string> = {
    CASH: 'Tiền mặt', BANK_TRANSFER: 'Chuyển khoản', CARD: 'Thẻ ngân hàng',
    MOMO: 'MoMo', ZALOPAY: 'ZaloPay',
  };
  return (
    <div className="flex items-center justify-between py-2.5 px-1 border-b border-border/50 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{methodLabel[payment.method] ?? payment.method}</p>
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
// Main Page
// ────────────────────────────────────────────────────
export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [statusReason, setStatusReason]   = useState('');
  const [confirmAction, setConfirmAction] = useState<{ status: BookingStatus; label: string } | null>(null);
  const [showAddTicket, setShowAddTicket]   = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id),
    select: (r) => r.data as Booking,
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
      <div className="flex items-center gap-3">
        <Link href="/bookings" className="p-1.5 rounded-md hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground font-mono">{bk.bookingCode}</h1>
            <span className={cn('inline-block px-2.5 py-1 rounded-full text-xs font-semibold', BOOKING_STATUS_CLASSES[bk.status])}>
              {BOOKING_STATUS_LABELS[bk.status]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {BOOKING_SOURCE_LABELS[bk.source]} · {formatDateTime(bk.createdAt)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap justify-end">
          {canAddTicket && (
            <button
              onClick={() => setShowAddTicket(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm vé
            </button>
          )}
          {canAddPayment && (
            <button
              onClick={() => setShowAddPayment(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20 flex items-center gap-1.5 transition-colors"
            >
              <Banknote className="w-3.5 h-3.5" /> Ghi thanh toán
            </button>
          )}
          {actions.map((action) => (
            <button
              key={action.status}
              onClick={() => setConfirmAction({ status: action.status, label: action.label })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                action.variant === 'primary' && 'bg-primary text-white hover:bg-primary/90',
                action.variant === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-700',
                action.variant === 'danger'  && 'bg-red-600 text-white hover:bg-red-700',
                action.variant === 'warning' && 'bg-orange-500 text-white hover:bg-orange-600',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Details (70%) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Contact info */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Thông tin liên hệ
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tên liên hệ</p>
                <p className="font-medium text-foreground">{bk.contactName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Số điện thoại</p>
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  {bk.contactPhone}
                </p>
              </div>
              {bk.pnr && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mã PNR (GDS)</p>
                  <p className="font-mono font-bold text-primary">{bk.pnr}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nguồn</p>
                <p className="text-foreground">{BOOKING_SOURCE_LABELS[bk.source]}</p>
              </div>
            </div>
            {bk.notes && (
              <div className="mt-4 p-3 bg-muted/40 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Ghi chú</p>
                <p className="text-sm text-foreground">{bk.notes}</p>
              </div>
            )}
          </div>

          {/* Tickets */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Plane className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Hành trình</h3>
              <span className="ml-auto text-xs text-muted-foreground">{bk.tickets?.length ?? 0} vé</span>
              {canAddTicket && (
                <button
                  onClick={() => setShowAddTicket(true)}
                  className="ml-2 flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium"
                >
                  <Plus className="w-3.5 h-3.5" /> Thêm
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
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="px-2 py-0.5 rounded text-white text-xs font-bold"
                          style={{ backgroundColor: AIRLINE_COLORS[ticket.airline] ?? '#64748b' }}
                        >
                          {ticket.airline}
                        </div>
                        <span className="text-sm font-mono font-medium text-foreground">{ticket.flightNumber}</span>
                        <span className="text-xs text-muted-foreground">{ticket.seatClass}</span>
                        {ticket.fareClass && (
                          <span className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">{ticket.fareClass}</span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{formatVND(ticket.sellPrice)}</p>
                        <p className="text-xs text-emerald-500">LN: +{formatVND(ticket.profit)}</p>
                      </div>
                    </div>

                    {/* Route */}
                    <div className="flex items-center gap-3">
                      <div className="text-center">
                        <p className="text-xl font-bold text-foreground">{ticket.departureCode}</p>
                        <p className="text-xs text-muted-foreground">{formatTime(ticket.departureTime)}</p>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 border-t border-dashed border-border" />
                        <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                        <div className="flex-1 border-t border-dashed border-border" />
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-foreground">{ticket.arrivalCode}</p>
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
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Tài chính
            </h3>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Giá bán (khách)',    value: formatVND(bk.totalSellPrice),  bold: false },
                { label: 'Giá net (hãng bay)', value: formatVND(bk.totalNetPrice),   bold: false },
                { label: 'Phí dịch vụ',        value: formatVND(bk.totalFees),       bold: false },
                { label: 'Lợi nhuận',           value: `+${formatVND(bk.profit)}`,   bold: true,  green: true },
              ].map((row) => (
                <div key={row.label} className={cn('flex justify-between', row.bold && 'pt-2 border-t border-border')}>
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
                <span className="text-sm text-muted-foreground">Trạng thái thanh toán</span>
                <span className={cn(
                  'px-2.5 py-0.5 rounded-full text-xs font-medium',
                  bk.paymentStatus === 'PAID'    && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  bk.paymentStatus === 'PARTIAL' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                  bk.paymentStatus === 'UNPAID'  && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                )}>
                  {bk.paymentStatus === 'PAID'    ? '✅ Đã thanh toán đủ'
                   : bk.paymentStatus === 'PARTIAL' ? '⚠ Thanh toán một phần'
                   : '❌ Chưa thanh toán'}
                </span>
              </div>
              {Number(bk.totalSellPrice) > 0 && (
                <div className="flex items-center justify-between text-sm">
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
              <div className="mt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">Lịch sử nhận tiền</p>
                {(bk.payments ?? []).map(p => <PaymentRow key={p.id} payment={p} />)}
              </div>
            )}
            {canAddPayment && (
              <button
                onClick={() => setShowAddPayment(true)}
                className="mt-3 w-full py-2 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:border-emerald-500 hover:text-emerald-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Ghi nhận thanh toán mới
              </button>
            )}
          </div>
        </div>

        {/* Right: Timeline + Staff */}
        <div className="space-y-4">
          {/* Status timeline */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Lịch sử trạng thái
            </h3>
            <div className="space-y-3">
              {(bk.statusHistory ?? []).map((log, i) => (
                <div key={log.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                      i === 0 ? 'bg-primary' : 'bg-muted-foreground/40',
                    )} />
                    {i < (bk.statusHistory?.length ?? 0) - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="pb-3 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {BOOKING_STATUS_LABELS[log.toStatus as BookingStatus] ?? log.toStatus}
                    </p>
                    {log.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">{log.reason}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Staff info */}
          <div className="card p-4">
            <p className="text-xs text-muted-foreground mb-1">Nhân viên phụ trách</p>
            <p className="text-sm font-medium text-foreground">{bk.staff?.fullName ?? 'Chưa phân công'}</p>
            {bk.staff?.email && <p className="text-xs text-muted-foreground">{bk.staff.email}</p>}
          </div>

          {/* Quick stats */}
          <div className="card p-4 space-y-3 text-sm">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tóm tắt</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Số vé</span>
              <span className="font-medium text-foreground">{bk.tickets?.length ?? 0} vé</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng thu</span>
              <span className="font-medium text-foreground">{formatVND(bk.totalSellPrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Lợi nhuận</span>
              <span className="font-bold text-emerald-500">+{formatVND(bk.profit)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Đã thu</span>
              <span className={cn('font-medium', totalPaid >= Number(bk.totalSellPrice) ? 'text-emerald-500' : 'text-orange-500')}>
                {formatVND(totalPaid)}
              </span>
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
          onClose={() => setShowAddPayment(false)}
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
