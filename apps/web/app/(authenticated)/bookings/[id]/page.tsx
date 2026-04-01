// APG Manager RMS - Booking Detail Page (Part 3: Add Ticket + Add Payment)
'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plane, User, Clock, CreditCard,
  Loader2, Phone, Plus, CheckCircle2, AlertTriangle, XCircle, Banknote, Zap, FileText,
  ChevronDown, Check, Save, Edit3, RotateCcw, Ban, RefreshCw, Ticket, Search, Trash2,
} from 'lucide-react';
import { authApi, bookingsApi, supplierApi, customersApi, documentsApi, usersApi } from '@/lib/api';
import {
  cn, formatDate, formatVND, formatDateTime, formatTime, normalizeLegacyVietnameseText,
  BOOKING_STATUS_LABELS, BOOKING_STATUS_CLASSES,
  BOOKING_SOURCE_LABELS,
} from '@/lib/utils';
import { MoneyInput } from '@/components/ui/money-input';
import { PageHeader } from '@/components/ui/page-header';
import { AirlineBadge } from '@/components/ui/airline-badge';
import { getAirportName } from '@/hooks/use-airport-search';
import type { AdjustmentType, Booking, BookingStatus, SupplierProfile, Customer, User as AppUser } from '@/types';
import { SmartImportModal } from '@/components/booking/smart-import-modal';
import { AdjustmentModal } from '@/components/booking/adjustment-modal';
import type { BookingAdjustment } from '@/types';

function getCustomerCodeBadgeClass(type?: string) {
  return type === 'CORPORATE'
    ? 'bg-orange-500/12 text-orange-500 border border-orange-500/20'
    : 'bg-primary/10 text-primary border border-primary/20';
}

function toDateTimeLocalValue(value?: string | Date | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60_000));
  return localDate.toISOString().slice(0, 16);
}

function getUserInitial(name?: string | null) {
  return (name?.trim().charAt(0) || 'U').toUpperCase();
}

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

// All statuses with icons and colors for the dropdown menu
const ALL_STATUSES: { key: BookingStatus; label: string; icon: React.ElementType; color: string; bgColor: string }[] = [
  { key: 'NEW',             label: 'Mới',             icon: Plus,          color: 'text-blue-500',    bgColor: 'bg-blue-500/10' },
  { key: 'PROCESSING',      label: 'Đang xử lý',     icon: RefreshCw,     color: 'text-amber-500',   bgColor: 'bg-amber-500/10' },
  { key: 'QUOTED',          label: 'Đã báo giá',     icon: FileText,      color: 'text-indigo-500',  bgColor: 'bg-indigo-500/10' },
  { key: 'PENDING_PAYMENT', label: 'Chờ thanh toán',  icon: Banknote,      color: 'text-orange-500',  bgColor: 'bg-orange-500/10' },
  { key: 'ISSUED',          label: 'Đã xuất vé',     icon: Ticket,        color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  { key: 'COMPLETED',       label: 'Hoàn thành',      icon: CheckCircle2,  color: 'text-green-600',   bgColor: 'bg-green-600/10' },
  { key: 'CHANGED',         label: 'Đổi vé',          icon: RotateCcw,     color: 'text-yellow-500',  bgColor: 'bg-yellow-500/10' },
  { key: 'REFUNDED',        label: 'Hoàn vé',         icon: RotateCcw,     color: 'text-pink-500',    bgColor: 'bg-pink-500/10' },
  { key: 'CANCELLED',       label: 'Đã hủy',          icon: Ban,           color: 'text-red-500',     bgColor: 'bg-red-500/10' },
];

// FIX 5: Đồng bộ PAYMENT_METHODS với backend enum
type StatusAction = {
  status: BookingStatus;
  label: string;
  variant: string;
  kind?: 'forward' | 'rollback';
};

function getAvailableStatusActions(booking: Pick<Booking, 'status' | 'statusHistory'>): StatusAction[] {
  const directActions = NEXT_ACTIONS[booking.status] ?? [];
  const actionMap = new Map<BookingStatus, StatusAction>(
    directActions.map((action) => [action.status, { ...action, kind: 'forward' as const }]),
  );

  const visitedStatuses = new Set<BookingStatus>();
  for (const entry of booking.statusHistory ?? []) {
    if (entry.fromStatus !== booking.status) {
      visitedStatuses.add(entry.fromStatus);
    }
    if (entry.toStatus !== booking.status) {
      visitedStatuses.add(entry.toStatus);
    }
  }

  for (const status of ALL_STATUSES.map((item) => item.key)) {
    if (status === booking.status || !visitedStatuses.has(status) || actionMap.has(status)) {
      continue;
    }

    actionMap.set(status, {
      status,
      label: `Quay về ${BOOKING_STATUS_LABELS[status]}`,
      variant: 'secondary',
      kind: 'rollback',
    });
  }

  return ALL_STATUSES
    .map((item) => item.key)
    .map((status) => actionMap.get(status))
    .filter((action): action is StatusAction => Boolean(action));
}

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
  const router = useRouter();
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
  const isDebtEntry = payment.method === 'DEBT';
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
      <div className="flex items-center gap-2">
        <p className={cn(
          'text-sm font-bold',
          isDebtEntry ? 'text-red-400' : 'text-emerald-500',
        )}>
          {isDebtEntry ? '-' : '+'}{formatVND(payment.amount)}
        </p>
        {!isDebtEntry && (
          <a
            href={documentsApi.receiptUrl(payment.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            title="In phiếu thu"
          >
            <FileText className="w-3 h-3" /> PT
          </a>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────
// Customer Search & Link Component
// ────────────────────────────────────────────────────
function FinancialSummaryCard({
  booking,
  passengerCount,
  totalSellPrice,
  totalNetPrice,
  totalProfit,
  totalPaid,
  totalRemaining,
  canAddPayment,
  onAddPayment,
}: {
  booking: Booking;
  passengerCount: number;
  totalSellPrice: number;
  totalNetPrice: number;
  totalProfit: number;
  totalPaid: number;
  totalRemaining: number;
  canAddPayment: boolean;
  onAddPayment: () => void;
}) {
  const sellLabel = passengerCount > 0 ? `Giá bán (Thu khách) x ${passengerCount}` : 'Giá bán (Thu khách)';
  const netLabel = passengerCount > 0 ? `Giá net (NCC) x ${passengerCount}` : 'Giá net (NCC)';

  return (
    <div className="card p-3.5">
      <div className="mb-1.5 flex items-center justify-between border-b border-border pb-2.5">
        <h3 className="text-[13px] font-medium text-foreground">Tài chính</h3>
      </div>
      <div className="flex flex-col text-[13px]">
        {[
          { label: sellLabel, value: formatVND(totalSellPrice), green: false },
          { label: netLabel, value: formatVND(totalNetPrice), green: false },
          { label: 'Phí dịch vụ', value: formatVND(booking.totalFees), green: false },
          ...(((booking.adjustments || []).reduce((sum, a) => sum + (a.type === 'CHANGE' ? a.changeFee : 0), 0) > 0)
            ? [{ label: 'Phí đổi vé (NCC)', value: formatVND((booking.adjustments || []).reduce((sum, a) => sum + (a.type === 'CHANGE' ? a.changeFee : 0), 0)), green: false }]
            : []),
          ...(((booking.adjustments || []).reduce((sum, a) => sum + (a.type === 'CHANGE' ? a.chargeToCustomer : 0), 0) > 0)
            ? [{ label: 'Phụ thu đổi vé (Thu khách)', value: formatVND((booking.adjustments || []).reduce((sum, a) => sum + (a.type === 'CHANGE' ? a.chargeToCustomer : 0), 0)), green: false }]
            : []),
          ...(((booking.adjustments || []).reduce((sum, a) => sum + (a.refundAmount || 0), 0) > 0)
            ? [{ label: 'Khách được hoàn', value: formatVND((booking.adjustments || []).reduce((sum, a) => sum + (a.refundAmount || 0), 0)), green: false }]
            : []),
          { label: 'Lợi nhuận', value: `+${formatVND(totalProfit)}`, green: true },
        ].map((row, idx, arr) => (
          <div key={row.label} className={cn('flex items-center justify-between py-2', idx !== arr.length - 1 && 'border-b border-border/50')}>
            <span className="text-muted-foreground">{row.label}</span>
            <span className={cn('font-medium', row.green ? 'text-emerald-500' : 'text-foreground')}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-3.5 space-y-2.5 border-t border-border pt-3.5">
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-muted-foreground">Trạng thái thanh toán</span>
          <span
            className={cn(
              'rounded-full px-2.5 py-0.5 text-[11px] font-medium',
              booking.paymentStatus === 'PAID' && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
              booking.paymentStatus === 'PARTIAL' && 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
              booking.paymentStatus === 'UNPAID' && 'bg-red-500/10 text-red-600 dark:text-red-400',
            )}
          >
            {booking.paymentStatus === 'PAID'
              ? 'Đã thanh toán đủ'
              : booking.paymentStatus === 'PARTIAL'
                ? 'Thanh toán một phần'
                : 'Chưa thanh toán'}
          </span>
        </div>
        {totalSellPrice > 0 && (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted-foreground">Đã thu / Còn lại</span>
            <span className="font-medium">
              <span className="text-emerald-500">{formatVND(totalPaid)}</span>
              {totalRemaining > 0 && <span className="text-red-400"> / -{formatVND(totalRemaining)}</span>}
            </span>
          </div>
        )}
      </div>

      {(booking.payments ?? []).length > 0 && (
        <div className="mt-3 border-t border-border pt-2.5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Lịch sử nhận tiền</p>
          {(booking.payments ?? []).map((payment) => <PaymentRow key={payment.id} payment={payment} />)}
        </div>
      )}

      {canAddPayment && (
        <button
          onClick={onAddPayment}
          className="mt-3.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-accent/50 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
        >
          <Plus className="w-3.5 h-3.5" /> Ghi nhận thanh toán mới
        </button>
      )}
    </div>
  );
}

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
          placeholder="Tìm theo tên, SĐT hoặc mã KH..."
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
            (searchResults ?? []).map((c: { id: string; fullName: string; phone: string; type: string; customerCode?: string }) => (
              <button
                key={c.id}
                onClick={() => linkMutation.mutate(c.id)}
                className="w-full flex items-center justify-between px-3 py-2 text-[12px] hover:bg-accent transition-colors text-left"
              >
                <div>
                  <p className="font-medium text-foreground">{c.fullName}</p>
                  {c.customerCode && (
                    <p className={cn('inline-flex w-max items-center rounded-md px-1.5 py-0.5 text-[10px] font-mono mt-1', getCustomerCodeBadgeClass(c.type))}>{c.customerCode}</p>
                  )}
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
// Edit Contact Modal
// ────────────────────────────────────────────────────
function EditContactModal({ 
  booking, 
  onClose,
}: { 
  booking: Booking; 
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const isPresetSource = ['WEBSITE', 'ZALO', 'MESSENGER', 'PHONE', 'WALK_IN', 'REFERRAL'].includes(booking.source);
  
  const [form, setForm] = useState({
    contactName: booking.customer?.fullName || booking.contactName,
    contactPhone: booking.customer?.phone || booking.contactPhone,
    sourceType: isPresetSource ? booking.source : 'OTHER',
    customSource: isPresetSource ? '' : booking.source,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const finalSource = form.sourceType === 'OTHER' ? form.customSource : form.sourceType;
      
      // Bản thân Customer có thay đổi name/phone không?
      if (booking.customer) {
        if (booking.customer.fullName !== form.contactName || booking.customer.phone !== form.contactPhone) {
          await customersApi.update(booking.customer.id, {
            fullName: form.contactName,
            phone: form.contactPhone,
          });
        }
      }

      // Cập nhật booking record
      await bookingsApi.update(booking.id, {
        contactName: form.contactName,
        contactPhone: form.contactPhone,
        source: finalSource,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      if (booking.customer) {
        queryClient.invalidateQueries({ queryKey: ['customer', booking.customer.id] });
        queryClient.invalidateQueries({ queryKey: ['customers'] });
      }
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card w-full max-w-sm rounded-xl border border-border shadow-lg p-5">
        <h3 className="text-[15px] font-bold text-foreground mb-4">Cập nhật thông tin liên hệ</h3>
        
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Tên liên hệ</label>
            <input
              value={form.contactName}
              onChange={e => setForm(p => ({ ...p, contactName: e.target.value }))}
              placeholder="Tên khách hàng"
              className="w-full px-3 h-9 text-[13px] rounded-md border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Số điện thoại</label>
            <input
              value={form.contactPhone}
              onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))}
              placeholder="Nhập số điện thoại"
              className="w-full px-3 h-9 text-[13px] rounded-md border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-foreground">Nguồn khách</label>
            <select
              value={form.sourceType}
              onChange={e => setForm(p => ({ ...p, sourceType: e.target.value }))}
              className="w-full px-3 h-9 text-[13px] rounded-md border border-border bg-background focus:ring-1 focus:ring-primary outline-none"
            >
              {Object.entries(BOOKING_SOURCE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
              <option value="OTHER">Khác (Nhập tay)...</option>
            </select>
            {form.sourceType === 'OTHER' && (
              <input
                value={form.customSource}
                onChange={e => setForm(p => ({ ...p, customSource: e.target.value }))}
                placeholder="Nhập nguồn tùy chỉnh..."
                className="w-full px-3 h-9 text-[13px] rounded-md border border-border bg-background mt-2 focus:ring-1 focus:ring-primary outline-none"
                autoFocus
              />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            Hủy
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.contactName.trim() || !form.contactPhone.trim() || (form.sourceType === 'OTHER' && !form.customSource.trim())}
            className="px-4 py-2 text-[13px] font-medium bg-primary text-primary-foreground rounded-md disabled:opacity-50"
          >
            {mutation.isPending ? 'Đang lưu...' : 'Lưu cập nhật'}
          </button>
        </div>
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
  const router = useRouter();

  const [statusReason, setStatusReason]   = useState('');
  const [confirmAction, setConfirmAction] = useState<{ status: BookingStatus; label: string } | null>(null);
  const [showAddTicket, setShowAddTicket]   = useState(false);
  const [showSmartImport, setShowSmartImport] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [defaultAdjustmentType, setDefaultAdjustmentType] = useState<AdjustmentType | undefined>(undefined);
  const [quickImportInitialized, setQuickImportInitialized] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({ code: '', name: '', type: 'AIRLINE' as string, contactName: '' });
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Inline edit state for contact info
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [contactEditMode, setContactEditMode] = useState<'manual' | 'search'>('manual');
  const [contactSearchQuery, setContactSearchQuery] = useState('');
  const [editForm, setEditForm] = useState({ contactName: '', contactPhone: '', customerCode: '', source: '', notes: '' });
  const [bookingMetaForm, setBookingMetaForm] = useState({ staffId: '', createdAt: '' });

  // Load danh sách KH gợi ý khi tìm kiếm
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  
  const { data: customerSearchResults, isFetching: isSearchingCustomers } = useQuery({
    queryKey: ['customers-search', contactSearchQuery],
    queryFn: () => customersApi.list({ search: contactSearchQuery, pageSize: 5 }),
    select: (r) => r.data?.data ?? [],
    enabled: showCustomerDropdown,
  });

  // Supplier search state
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const supplierDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(e.target as Node)) {
        setShowStatusDropdown(false);
      }
      if (supplierDropdownRef.current && !supplierDropdownRef.current.contains(e.target as Node)) {
        setShowSupplierDropdown(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id),
    select: (r) => r.data as Booking,
  });
  const { data: currentUser } = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => authApi.me(),
    select: (response) => response.data as AppUser,
  });

  const isAdmin = currentUser?.role === 'ADMIN';

  const { data: staffOptions = [] } = useQuery({
    enabled: isAdmin,
    queryKey: ['booking-staff-options'],
    queryFn: () => usersApi.list(),
    select: (response) =>
      ((response.data as AppUser[]) ?? [])
        .filter((user) => user.isActive)
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'vi')),
  });

  useEffect(() => {
    if (!booking) return;

    setBookingMetaForm({
      staffId: booking.staffId || currentUser?.id || '',
      createdAt: toDateTimeLocalValue(booking.businessDate ?? booking.createdAt),
    });
  }, [booking?.id, booking?.staffId, booking?.businessDate, booking?.createdAt, currentUser?.id]);

  // Load danh sách NCC
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => supplierApi.list().then((r) => r.data),
    select: (raw) => {
      if (Array.isArray(raw)) return raw as SupplierProfile[];
      if (raw && Array.isArray((raw as { data?: unknown }).data)) return (raw as { data: SupplierProfile[] }).data;
      return [] as SupplierProfile[];
    },
  });

  // Mutation cập nhật supplier cho booking
  const supplierMutation = useMutation({
    mutationFn: (supplierId: string | null) =>
      bookingsApi.update(id, { supplierId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
  });

  // ── Global Save Button Mutation ──────────────────────────────
  const [saveSuccess, setSaveSuccess] = useState(false);
  const globalSaveMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        supplierId: booking?.supplierId ?? null,
      };

      const currentCreatedAt = toDateTimeLocalValue(booking?.businessDate ?? booking?.createdAt);
      if (bookingMetaForm.createdAt && bookingMetaForm.createdAt !== currentCreatedAt) {
        payload.createdAt = new Date(bookingMetaForm.createdAt).toISOString();
      }

      if (isAdmin && bookingMetaForm.staffId && bookingMetaForm.staffId !== booking?.staffId) {
        payload.staffId = bookingMetaForm.staffId;
      }

      await bookingsApi.update(id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message?.toString()
        || 'Không thể lưu cập nhật booking lúc này.';
      window.alert(message);
    },
  });

  const clearTicketsMutation = useMutation({
    mutationFn: () => bookingsApi.clearTickets(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message?.toString()
        || 'Không thể xóa hành trình. Vui lòng kiểm tra lại dữ liệu liên quan.';
      window.alert(message);
    },
  });

  // Mutation xóa vĩnh viễn booking (chỉ CANCELLED)
  const hardDeleteMutation = useMutation({
    mutationFn: () => bookingsApi.hardDelete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      router.push('/bookings');
    },
    onError: (error) => {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message?.toString()
        || 'Không thể xóa booking. Vui lòng thử lại.';
      window.alert(message);
    },
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
      queryClient.invalidateQueries({ queryKey: ['ledger'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      setConfirmAction(null);
      setStatusReason('');
    },
  });

  // Mutation lưu thông tin liên hệ (inline edit)
  const saveContactMutation = useMutation({
    mutationFn: async () => {
      const normalizedCustomerCode = editForm.customerCode.trim();

      if (booking?.customer?.id) {
        await customersApi.update(booking.customer.id, {
          fullName: editForm.contactName,
          phone: editForm.contactPhone,
          ...(normalizedCustomerCode ? { customerCode: normalizedCustomerCode } : {}),
        });
      }

      return bookingsApi.update(id, {
        contactName: editForm.contactName,
        contactPhone: editForm.contactPhone,
        source: editForm.source,
        notes: editForm.notes,
      });
    },
    onSuccess: async () => {
      if (booking?.customer?.id) {
        await queryClient.invalidateQueries({ queryKey: ['customer', booking.customer.id] });
      }
      await queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setIsEditingContact(false);
    },
  });

  const linkCustomerMutation = useMutation({
    mutationFn: (customer: Pick<Customer, 'id' | 'fullName' | 'phone' | 'customerCode'>) =>
      bookingsApi.update(id, { customerId: customer.id }),
    onSuccess: async (_, customer) => {
      setEditForm((prev) => ({
        ...prev,
        contactName: customer.fullName || '',
        contactPhone: customer.phone || '',
        customerCode: customer.customerCode || '',
      }));
      setShowCustomerDropdown(false);
      await queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setIsEditingContact(false);
    },
  });

  // Start inline edit mode
  const startEditing = useCallback(() => {
    if (!booking) return;
    setEditForm({
      contactName: booking.customer?.fullName || booking.contactName,
      contactPhone: booking.customer?.phone || booking.contactPhone,
      customerCode: booking.customer?.customerCode || '',
      source: booking.source,
      notes: booking.notes || '',
    });
    setIsEditingContact(true);
  }, [booking]);

  // Auto-edit mode for newly created bookings
  useEffect(() => {
    if (booking && booking.status === 'NEW' && (!booking.contactName || booking.contactName === 'Khách hàng mới')) {
      startEditing();
    }
  }, [booking, startEditing]);

  // Nhóm vé theo chuyến bay để hiển thị gọn gàng hơn
  const groupedFlights = useMemo(() => {
    if (!booking?.tickets) return [];
    
    // Key format: "VN-VN249-HAN-SGN-2024-03-24T15:30:00.000Z"
    const grouped = new Map<string, {
      airline: string;
      flightNumber: string;
      departureCode: string;
      arrivalCode: string;
      departureTime: string | Date;
      arrivalTime: string | Date;
      sellPrice: number;
      profit: number;
      tickets: typeof booking.tickets;
    }>();

    for (const t of booking.tickets) {
      const gDate = new Date(t.departureTime).toISOString();
      const key = `${t.airline}-${t.flightNumber}-${t.departureCode}-${t.arrivalCode}-${gDate}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          airline: t.airline,
          flightNumber: t.flightNumber,
          departureCode: t.departureCode,
          arrivalCode: t.arrivalCode,
          departureTime: t.departureTime,
          arrivalTime: t.arrivalTime,
          sellPrice: 0,
          profit: 0,
          tickets: []
        });
      }
      
      const groupItem = grouped.get(key)!;
      groupItem.tickets.push(t);
      // We sum up the prices logically to show flight totals if needed
      groupItem.sellPrice += Number(t.sellPrice);
      groupItem.profit += Number(t.profit);
    }

    return Array.from(grouped.values()).sort((a, b) => 
      new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime()
    );
  }, [booking?.tickets]);

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

    const hasFinancialLock = (booking.payments?.length ?? 0) > 0 || (booking.ledgers?.length ?? 0) > 0;
    const canOpenQuickImport = !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(booking.status) && !hasFinancialLock;
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
  const passengerCount = bk.tickets?.length ?? 0;
  const totalSellPrice = passengerCount > 0
    ? (bk.tickets ?? []).reduce((sum, ticket) => sum + Number(ticket.sellPrice || 0), 0)
    : Number(bk.totalSellPrice);
  const totalNetPrice = passengerCount > 0
    ? (bk.tickets ?? []).reduce((sum, ticket) => sum + Number(ticket.netPrice || 0), 0)
    : Number(bk.totalNetPrice);
  const totalProfit = passengerCount > 0
    ? (bk.tickets ?? []).reduce((sum, ticket) => sum + Number(ticket.profit || 0), 0)
    : Number(bk.profit);
  const validPayments = (bk.payments ?? []).filter(p => p.method !== 'DEBT');
  const totalPaid = validPayments.reduce((s, p) => s + Number(p.amount), 0);
  const totalRemaining = totalSellPrice - totalPaid;
  const hasFinancialLock = (bk.payments?.length ?? 0) > 0 || (bk.ledgers?.length ?? 0) > 0;
  const hasCustomer = Boolean(bk.customerId) && bk.contactName !== 'Khách hàng mới';
  const hasSupplier = Boolean(bk.supplierId);
  const isReady = hasCustomer && hasSupplier;
  const canAddTicket  = !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(bk.status);
  const canEditItinerary = canAddTicket && !hasFinancialLock;
  const canAddPayment = !['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(bk.status) && isReady;
  const selectedStaff =
    staffOptions.find((user) => user.id === bookingMetaForm.staffId)
    ?? bk.staff
    ?? currentUser
    ?? null;
  const closeAdjustmentModal = () => {
    setShowAdjustmentModal(false);
    setDefaultAdjustmentType(undefined);
  };

  return (
    <div className="max-w-[1320px] space-y-3.5">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-2.5">
            <Link href="/bookings" className="-ml-1 rounded-lg p-1.5 transition-colors hover:bg-accent">
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

            {/* Status Dropdown (Option B) */}
            <div className="relative" ref={statusDropdownRef}>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[10.5px] font-semibold transition-all duration-150',
                  'hover:shadow-md cursor-pointer active:scale-[0.97]',
                  BOOKING_STATUS_CLASSES[bk.status],
                  'border-current/20',
                )}
              >
                {(() => { const s = ALL_STATUSES.find(s => s.key === bk.status); return s ? <s.icon className="w-3 h-3" /> : null; })()}
                {BOOKING_STATUS_LABELS[bk.status]}
                <ChevronDown className={cn('w-3 h-3 transition-transform', showStatusDropdown && 'rotate-180')} />
              </button>

              {/* Dropdown menu */}
              {showStatusDropdown && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-2xl z-50 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                  <p className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Chuyển trạng thái</p>
                  <div className="my-1 border-t border-border/50" />
                  {ALL_STATUSES.map((st) => {
                    const isCurrent = st.key === bk.status;
                    const allowed = !isCurrent;
                    const requiresReady = st.key === 'PENDING_PAYMENT' || st.key === 'ISSUED';
                    const isDisabled = requiresReady && !isReady;
                    const Icon = st.icon;

                    return (
                      <button
                        key={st.key}
                        disabled={isDisabled}
                        onClick={() => {
                          if (isCurrent || isDisabled) return;
                          setShowStatusDropdown(false);
                          setConfirmAction({ status: st.key, label: `Chuyển sang ${st.label}` });
                        }}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-[13px] transition-colors text-left',
                          isCurrent && 'bg-accent/60 font-semibold',
                          !isCurrent && allowed && !isDisabled && 'hover:bg-accent cursor-pointer',
                          isDisabled && 'opacity-30 cursor-not-allowed',
                        )}
                      >
                        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', st.bgColor)}>
                          <Icon className={cn('w-3.5 h-3.5', st.color)} />
                        </div>
                        <span className={cn('flex-1', isCurrent ? 'text-foreground' : isDisabled ? 'text-muted-foreground' : 'text-foreground')}>
                          {st.label}
                        </span>
                        {isCurrent && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                        {!isCurrent && allowed && !isDisabled && (
                          <span className="text-[10px] text-primary font-medium flex-shrink-0">Chọn</span>
                        )}
                        {!isCurrent && isDisabled && (
                          <span className="text-[10px] text-amber-500 font-medium flex-shrink-0">Thiếu KH/NCC</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        }
        description={`${BOOKING_SOURCE_LABELS[bk.source]} · ${formatDateTime(bk.businessDate ?? bk.createdAt)}`}
        actions={
          <div className="flex flex-wrap justify-end gap-1.5">
            {canAddTicket && (
              <>
                <button
                  onClick={() => {
                    if (!canEditItinerary) return;
                    setShowSmartImport(true);
                  }}
                  disabled={!canEditItinerary}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  title={canEditItinerary ? 'Nhập vé tự động từ text/ảnh' : 'Booking đã có thanh toán hoặc bút toán liên quan, không thể nhập thêm hành trình'}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" /> Nhập nhanh
                </button>
                <button
                  onClick={() => {
                    if (!canEditItinerary) return;
                    setShowAddTicket(true);
                  }}
                  disabled={!canEditItinerary}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                  title={canEditItinerary ? 'Thêm vé thủ công' : 'Booking đã có thanh toán hoặc bút toán liên quan, không thể thêm hành trình'}
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
                    'flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[12px] font-medium text-secondary-foreground transition-colors',
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
            {/* PDF document buttons */}
            {['ISSUED', 'COMPLETED', 'CHANGED'].includes(bk.status) && (
              <button
                onClick={() => {
                  setDefaultAdjustmentType('HLKG');
                  setShowAdjustmentModal(true);
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 text-[12px] font-medium text-fuchsia-400 transition-colors hover:bg-fuchsia-500/15"
                title="Ghi nhận nghiệp vụ HLKG"
              >
                <RotateCcw className="w-3.5 h-3.5" /> HLKG
              </button>
            )}
            {['ISSUED', 'COMPLETED', 'CHANGED'].includes(bk.status) && (
              <button
                onClick={() => {
                  setDefaultAdjustmentType('CHANGE');
                  setShowAdjustmentModal(true);
                }}
                className="flex h-8 items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 text-[12px] font-medium text-orange-400 transition-colors hover:bg-orange-500/15"
                title="Ghi nhận nghiệp vụ hoàn vé hoặc đổi vé"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Hoàn, Đổi
              </button>
            )}
            {false && (
            <a
              href={documentsApi.quotationUrl(id)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-accent"
              title="Tải báo giá PDF"
            >
              <FileText className="w-3.5 h-3.5 text-blue-500" /> Báo giá
            </a>
            )}
            {['ISSUED', 'COMPLETED'].includes(bk.status) && (
              <a
                href={documentsApi.invoiceUrl(id)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 text-[12px] font-medium text-secondary-foreground transition-colors hover:bg-accent"
                title="Tải hoá đơn PDF"
              >
                <FileText className="w-3.5 h-3.5 text-emerald-500" /> Hóa đơn
              </a>
            )}
            {/* Cancel button — shown if status allows */}
            {(NEXT_ACTIONS[bk.status] ?? []).some(a => a.status === 'CANCELLED') && (
              <button
                onClick={() => setConfirmAction({ status: 'CANCELLED' as BookingStatus, label: 'Hủy booking' })}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-destructive px-3 text-[12px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
              >
                Hủy
              </button>
            )}
            {/* Hard delete button — only for CANCELLED bookings */}
            {bk.status === 'CANCELLED' && (
              <button
                onClick={() => {
                  if (hardDeleteMutation.isPending) return;
                  const shouldDelete = window.confirm(
                    `Bạn có chắc muốn XÓA VĨNH VIỄN booking ${bk.pnr || bk.bookingCode}?\n\nHành động này không thể hoàn tác. Tất cả dữ liệu liên quan (vé, thanh toán, bút toán, lịch sử trạng thái) sẽ bị xóa hoàn toàn.`
                  );
                  if (shouldDelete) hardDeleteMutation.mutate();
                }}
                disabled={hardDeleteMutation.isPending}
                className="flex h-8 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-[12px] font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                title="Xóa vĩnh viễn booking đã hủy"
              >
                {hardDeleteMutation.isPending ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang xóa...</>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5" /> Xóa vĩnh viễn</>
                )}
              </button>
            )}
            {/* GLOBAL SAVE BUTTON */}
            <button
              onClick={() => globalSaveMutation.mutate()}
              disabled={globalSaveMutation.isPending}
              className={cn(
                'flex h-8 items-center gap-1.5 rounded-lg border px-3.5 text-[12px] font-semibold transition-all shadow-sm',
                saveSuccess
                  ? 'bg-emerald-500 text-white border-emerald-600'
                  : 'bg-primary text-white border-primary hover:bg-primary/90 active:scale-[0.97]',
              )}
            >
              {globalSaveMutation.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang lưu...</>
              ) : saveSuccess ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu!</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> Save</>
              )}
            </button>
          </div>
        }
      />

      {(!hasCustomer || !hasSupplier) && (
        <div className="space-y-2">
          {!hasCustomer && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
              <div>
                <p className="font-medium text-amber-100">Booking chưa liên kết khách hàng hợp lệ.</p>
                <p className="mt-1 text-xs text-amber-200/80">Cần chọn khách hàng trước khi ghi nhận thanh toán hoặc chuyển sang Chờ thanh toán / Đã xuất vé.</p>
              </div>
            </div>
          )}
          {!hasSupplier && (
            <div className="flex items-start gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-orange-400" />
              <div>
                <p className="font-medium text-orange-100">Booking chưa gắn nhà cung cấp / hãng.</p>
                <p className="mt-1 text-xs text-orange-200/80">Cần chọn NCC trước khi chuyển sang Chờ thanh toán hoặc Đã xuất vé.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Left: Details (70%) */}
        <div className="flex flex-col gap-3 lg:col-span-2">
          {/* Side-by-side Contact & Supplier to save space */}
          <div className="order-2 grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Contact info + Customer link — with inline edit mode */}
            <div className="card p-3.5">
              <div className="mb-1.5 flex items-center justify-between border-b border-border pb-2.5">
                <h3 className="text-[13px] font-medium text-foreground">Contact Information</h3>
                <div className="flex items-center gap-3">
                  {!isEditingContact ? (
                    <button
                      onClick={startEditing}
                      className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Sửa
                    </button>
                  ) : (
                    <span className="text-[10px] text-amber-500 font-medium">Đang chỉnh sửa</span>
                  )}
                  {bk.customer && (
                    <Link
                      href={`/customers/${bk.customer.id}`}
                      className="text-[11px] text-primary hover:underline font-medium"
                    >
                      Xem hồ sơ KH →
                    </Link>
                  )}
                </div>
              </div>

              {isEditingContact ? (
                /* ─── Inline Edit Mode ─── */
                <div className="space-y-2.5">
                  {/* Tabs for Search vs Manual */}
                  <div className="flex rounded-lg bg-muted/50 p-0.5">
                    <button
                      type="button"
                      onClick={() => setContactEditMode('search')}
                      className={cn(
                        'flex-1 rounded-md py-1.25 text-[10.5px] font-medium transition-colors',
                        contactEditMode === 'search' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Tìm khách có sẵn
                    </button>
                    <button
                      type="button"
                      onClick={() => setContactEditMode('manual')}
                      className={cn(
                        'flex-1 rounded-md py-1.25 text-[10.5px] font-medium transition-colors',
                        contactEditMode === 'manual' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      Nhập thủ công
                    </button>
                  </div>

                  {contactEditMode === 'search' ? (
                    /* Search Customer Mode */
                    <div className="space-y-2.5 pt-1" ref={customerDropdownRef}>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <input
                          type="text"
                          value={contactSearchQuery}
                          onChange={(e) => {
                            setContactSearchQuery(e.target.value);
                            setShowCustomerDropdown(true);
                          }}
                          onFocus={() => setShowCustomerDropdown(true)}
                          placeholder="Tìm theo tên, SĐT hoặc mã KH..."
                          className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-8 text-[12px] outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        {contactSearchQuery && (
                          <button
                            onClick={() => {
                              setContactSearchQuery('');
                              setShowCustomerDropdown(true);
                            }}
                            className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground flex items-center justify-center rounded-full hover:bg-accent"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      
                      {showCustomerDropdown && (
                        <div className="max-h-[220px] divide-y divide-border/50 overflow-y-auto rounded-md border border-border bg-card">
                          {isSearchingCustomers ? (
                            <p className="text-[12px] text-muted-foreground p-3 text-center flex items-center justify-center gap-1.5">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang tìm...
                            </p>
                          ) : customerSearchResults.length === 0 ? (
                            <p className="text-[12px] text-muted-foreground p-3 text-center">Không tìm thấy khách hàng</p>
                          ) : (
                            customerSearchResults.map((c: Pick<Customer, 'id' | 'fullName' | 'phone' | 'type' | 'customerCode'>) => (
                              <button
                                type="button"
                                key={c.id}
                                onClick={() => linkCustomerMutation.mutate(c)}
                                disabled={linkCustomerMutation.isPending}
                                className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                 <div>
                                   <p className="text-[13px] font-medium text-foreground">{c.fullName}</p>
                                   {c.customerCode && (
                                     <p className={cn('inline-flex w-max items-center rounded-md px-1.5 py-0.5 text-[10px] font-mono mt-1', getCustomerCodeBadgeClass(c.type))}>{c.customerCode}</p>
                                   )}
                                   <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                     {c.phone}
                                    <span className="opacity-50">•</span>
                                    {c.type === 'CORPORATE' ? 'Doanh nghiệp' : 'Cá nhân'}
                                  </p>
                                </div>
                                <span className="text-[10px] px-2 py-1 bg-primary/10 text-primary rounded-md font-medium">
                                  {linkCustomerMutation.isPending ? 'Đang lưu...' : 'Chọn'}
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                      {linkCustomerMutation.error && (
                        <p className="text-[12px] text-destructive">
                          {(linkCustomerMutation.error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message?.toString()
                            || 'Không thể liên kết khách hàng. Vui lòng thử lại.'}
                        </p>
                      )}
                      
                      <div className="pt-1.5">
                        <button
                          onClick={() => setIsEditingContact(false)}
                          className="h-8 w-full rounded-md border border-border text-[12px] text-muted-foreground transition-colors hover:bg-accent"
                        >
                          Hủy
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Manual Input Mode */
                    <>
                      <div className="space-y-1.5 pt-1">
                        <label className="text-[11px] font-medium text-muted-foreground">Tên liên hệ</label>
                        <input
                          value={editForm.contactName}
                          onChange={e => setEditForm(p => ({ ...p, contactName: e.target.value }))}
                          placeholder="Tên khách hàng"
                          className="h-8 w-full rounded-md border border-border bg-background px-3 text-[12px] outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-muted-foreground">Số điện thoại</label>
                        <input
                          value={editForm.contactPhone}
                          onChange={e => setEditForm(p => ({ ...p, contactPhone: e.target.value }))}
                          placeholder="0901234567"
                          className="h-8 w-full rounded-md border border-border bg-background px-3 text-[12px] outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-muted-foreground">Mã khách hàng</label>
                        <input
                          value={editForm.customerCode}
                          onChange={e => setEditForm(p => ({ ...p, customerCode: e.target.value.toUpperCase() }))}
                          placeholder="KH000123"
                          disabled={!booking?.customer}
                          className="h-8 w-full rounded-md border border-border bg-background px-3 font-mono text-[12px] uppercase outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          {booking?.customer ? 'Mã này sẽ đồng bộ trực tiếp với hồ sơ khách hàng đang liên kết.' : 'Liên kết khách hàng trước để chỉnh mã khách hàng.'}
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-muted-foreground">Nguồn khách</label>
                        <select
                          value={Object.keys(BOOKING_SOURCE_LABELS).includes(editForm.source) ? editForm.source : 'OTHER'}
                          onChange={e => setEditForm(p => ({ ...p, source: e.target.value }))}
                          className="h-8 w-full rounded-md border border-border bg-background px-3 text-[12px] outline-none focus:ring-1 focus:ring-primary"
                        >
                          {Object.entries(BOOKING_SOURCE_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-medium text-muted-foreground">Ghi chú</label>
                        <textarea
                          value={editForm.notes}
                          onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                          placeholder="Ghi chú về booking..."
                          rows={2}
                          className="w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-primary resize-none"
                        />
                      </div>
                      <div className="flex gap-1.5 pt-1">
                        <button
                          onClick={() => saveContactMutation.mutate()}
                          disabled={saveContactMutation.isPending || !editForm.contactName.trim() || !editForm.contactPhone.trim()}
                          className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md bg-primary text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          {saveContactMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          💾 Lưu thay đổi
                        </button>
                        <button
                          onClick={() => setIsEditingContact(false)}
                          className="h-8 rounded-md border border-border px-3 text-[12px] text-muted-foreground transition-colors hover:bg-accent"
                        >
                          Hủy
                        </button>
                      </div>
                      {saveContactMutation.error && (
                        <p className="text-[12px] text-destructive">
                          {(saveContactMutation.error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message?.toString()
                            || 'Không thể cập nhật khách hàng. Vui lòng thử lại.'}
                        </p>
                      )}
                    </>
                  )}
                </div>
              ) : (
                /* ─── Read-only Mode ─── */
                <div className="flex flex-col text-[12.5px]">
                  <div className="flex items-center justify-between border-b border-border/50 py-2">
                    <span className="text-muted-foreground">Tên liên hệ</span>
                    <span className="font-medium text-foreground text-right flex flex-col items-end">
                      {bk.customer ? bk.customer.fullName : bk.contactName}
                      {bk.customer && (
                        <span className="text-[10px] text-muted-foreground font-normal">
                          Khách {bk.customer.type === 'CORPORATE' ? 'Doanh nghiệp' : 'Cá nhân'}
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/50 py-2">
                    <span className="text-muted-foreground">Số điện thoại</span>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                      {bk.customer ? bk.customer.phone : bk.contactPhone}
                    </span>
                  </div>
                  {bk.customer?.customerCode && (
                    <div className="flex items-center justify-between border-b border-border/50 py-2">
                      <span className="text-muted-foreground">Mã khách hàng</span>
                      <span className={cn('inline-flex items-center rounded-md px-2 py-1 text-[11px] font-mono font-medium', getCustomerCodeBadgeClass(bk.customer.type))}>
                        {bk.customer.customerCode}
                      </span>
                    </div>
                  )}
                  {bk.pnr && (
                    <div className="flex items-center justify-between border-b border-border/50 py-2">
                      <span className="text-muted-foreground">Mã PNR (GDS)</span>
                      <span className="font-mono font-bold text-primary">{bk.pnr}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between border-b border-border/50 py-2 last:border-0">
                    <span className="text-muted-foreground">Nguồn</span>
                    <span className="text-foreground">{BOOKING_SOURCE_LABELS[bk.source] || bk.source}</span>
                  </div>

                  {/* Linked Customer Link */}
                  {!bk.customer && (
                    <div className="mt-2.5 border-t border-border pt-2.5">
                      <CustomerSearchLink bookingId={id} contactPhone={bk.contactPhone} />
                    </div>
                  )}
                </div>
              )}
              {!isEditingContact && bk.notes && (
                <div className="mt-3 border-t border-border pt-2.5">
                  <p className="text-[13px] text-muted-foreground mb-1">Ghi chú</p>
                  <p className="text-[13px] text-foreground">{bk.notes}</p>
                </div>
              )}
            </div>

            {/* Supplier (NCC) selector */}
            <div className="card p-3.5">
              <div className="mb-1.5 flex items-center justify-between border-b border-border pb-2.5">
                <h3 className="text-[13px] font-medium text-foreground">Nhà cung cấp (NCC)</h3>
                <button
                  onClick={() => setShowNewSupplier(!showNewSupplier)}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  {showNewSupplier ? 'Hủy' : '+ Tạo NCC mới'}
                </button>
              </div>

              {/* Dropdown chọn NCC */}
              <div className="space-y-2.5" ref={supplierDropdownRef}>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={supplierSearchQuery}
                    placeholder={bk.supplier ? "Sửa NCC (Tìm tên/mã)..." : "Tìm theo mã hoặc tên NCC..."}
                    onChange={(e) => {
                      setSupplierSearchQuery(e.target.value);
                      setShowSupplierDropdown(true);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    className="h-8 w-full rounded-md border border-border bg-background pl-8 pr-8 text-[12px] outline-none focus:ring-1 focus:ring-primary"
                  />
                  {supplierSearchQuery && (
                    <button
                      onClick={() => {
                        setSupplierSearchQuery('');
                        setShowSupplierDropdown(true);
                      }}
                      className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground flex items-center justify-center rounded-full hover:bg-accent"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                  
                  {/* Dropdown Results */}
                  {showSupplierDropdown && (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[220px] overflow-y-auto rounded-md border border-border bg-card shadow-lg">
                      {/* Option to clear NCC */}
                      {bk.supplierId && (
                        <button
                          onClick={() => {
                            supplierMutation.mutate(null);
                            setShowSupplierDropdown(false);
                            setSupplierSearchQuery('');
                          }}
                          className="w-full flex items-center px-3 py-2 text-[12px] text-destructive hover:bg-destructive/10 transition-colors text-left border-b border-border/50"
                        >
                          <Ban className="w-3.5 h-3.5 mr-2" /> Xóa nhà cung cấp hiện tại
                        </button>
                      )}
                      
                      {(() => {
                        const val = supplierSearchQuery.toLowerCase();
                        const filtered = (suppliers ?? []).filter(s => 
                          !val || s.name.toLowerCase().includes(val) || s.code.toLowerCase().includes(val)
                        );
                        
                        if (filtered.length === 0) {
                          return <p className="text-[12px] text-muted-foreground p-3 text-center">Không tìm thấy NCC nào</p>;
                        }
                        
                        return filtered.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              supplierMutation.mutate(s.id);
                              setShowSupplierDropdown(false);
                              setSupplierSearchQuery('');
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-2 text-[12px] hover:bg-accent transition-colors text-left border-b border-border/50 last:border-0",
                              bk.supplierId === s.id && "bg-primary/5"
                            )}
                          >
                            <div>
                              <p className={cn("font-medium", bk.supplierId === s.id ? "text-primary" : "text-foreground")}>
                                {s.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <span className={cn("px-1 rounded bg-muted font-mono font-bold", bk.supplierId === s.id && "bg-primary/10 text-primary")}>
                                  {s.code}
                                </span>
                                {s.contactName && <span>• {s.contactName}</span>}
                              </p>
                            </div>
                            {bk.supplierId === s.id ? (
                              <CheckCircle2 className="w-4 h-4 text-primary" />
                            ) : (
                              <span className="text-[10px] px-2 py-1 bg-primary/10 text-primary rounded-md font-medium opacity-0 group-hover:opacity-100">Chọn</span>
                            )}
                          </button>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                {supplierMutation.error && (
                  <p className="text-[12px] text-destructive">
                    {(supplierMutation.error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message?.toString()
                      || 'Không thể cập nhật nhà cung cấp. Vui lòng thử lại.'}
                  </p>
                )}

                {bk.supplier ? (
                  <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-accent/40 px-3 py-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary font-mono">
                      {bk.supplier.code?.slice(0, 2) || 'NCC'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-foreground truncate">{bk.supplier.name}</p>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                          {bk.supplier.code}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {bk.supplier.contactName || 'Chưa có thông tin liên hệ'}
                      </p>
                    </div>
                    {supplierMutation.isPending && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
                    )}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/70 px-3 py-2.5 text-[12px] text-muted-foreground">
                    Chưa chọn nhà cung cấp cho booking này.
                  </div>
                )}

                {/* Inline form tạo NCC mới */}
                {showNewSupplier && (
                  <div className="space-y-2 rounded-lg border border-border/50 bg-muted/30 p-3">
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
                      className="mt-1 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-foreground text-xs font-medium text-background hover:opacity-90 disabled:opacity-50"
                    >
                      {createSupplierMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Tạo & Gán NCC
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tickets */}
          <div className="order-1 card overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-3">
                <h3 className="text-[13px] font-medium text-foreground">Hành trình ({bk.tickets?.length ?? 0} vé)</h3>
                {bk.pnr && (bk.tickets?.length ?? 0) > 0 && (
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[12px] font-bold tracking-widest text-amber-600 dark:text-amber-400">
                    {bk.pnr}
                  </span>
                )}
              </div>
              {canAddTicket && (
                <div className="flex items-center gap-3">
                  {(bk.tickets?.length ?? 0) > 0 && (
                    <button
                      onClick={() => {
                        if (clearTicketsMutation.isPending) return;
                        const shouldClear = window.confirm('Xóa toàn bộ thông tin hành trình hiện tại và đưa booking về trạng thái chưa có vé?');
                        if (shouldClear) clearTicketsMutation.mutate();
                      }}
                      disabled={clearTicketsMutation.isPending || !canEditItinerary}
                      className="flex items-center gap-1 text-[12px] font-medium text-destructive/80 hover:text-destructive disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {clearTicketsMutation.isPending ? 'Đang xóa...' : 'Xóa hành trình'}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (!canEditItinerary) return;
                      setShowAddTicket(true);
                    }}
                    disabled={!canEditItinerary}
                    className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    title={canEditItinerary ? 'Thêm hành trình thủ công' : 'Booking đã có thanh toán hoặc bút toán liên quan, không thể thêm hành trình'}
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm mới
                  </button>
                </div>
              )}
            </div>

            {(bk.tickets ?? []).length === 0 ? (
              <div className="p-8 text-center">
                <Plane className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Chưa có vé nào</p>
                {canAddTicket && (
                  <button
                    onClick={() => {
                      if (!canEditItinerary) return;
                      setShowAddTicket(true);
                    }}
                    disabled={!canEditItinerary}
                    className="mt-3 rounded-lg bg-primary/10 px-4 py-2 text-xs font-medium text-primary hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    + Thêm vé đầu tiên
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {groupedFlights.map((flight, fIdx) => (
                  <div key={fIdx} className="p-3.5">
                    <div className="mb-2.5 flex items-center justify-between border-b border-border/50 pb-2.5">
                      <div className="flex items-center gap-2">
                        <AirlineBadge code={flight.airline} showName={false} size="md" />
                        <span className="text-[13px] font-mono font-medium text-foreground mt-0.5">{flight.flightNumber}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[13px] font-bold font-tabular text-foreground">{formatVND(flight.sellPrice)}</p>
                        <p className="text-[11px] font-tabular text-emerald-500">+{formatVND(flight.profit)} (Tổng)</p>
                      </div>
                    </div>

                    <div className="mx-auto mb-3 flex max-w-md items-center gap-2.5">
                      <div className="text-center w-24">
                        <p className="text-lg font-bold text-foreground">{flight.departureCode}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getAirportName(flight.departureCode)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatTime(flight.departureTime)} <span className="text-[10px] opacity-70">({new Date(flight.departureTime).toLocaleDateString('vi-VN')})</span></p>
                      </div>
                      <div className="flex-1 flex items-center gap-2">
                        <div className="flex-1 border-t border-dashed border-border/60" />
                        <Plane className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <div className="flex-1 border-t border-dashed border-border/60" />
                      </div>
                      <div className="text-center w-24">
                        <p className="text-lg font-bold text-foreground">{flight.arrivalCode}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{getAirportName(flight.arrivalCode)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{formatTime(flight.arrivalTime)}</p>
                      </div>
                    </div>

                    <div className="mt-2.5 overflow-hidden rounded-lg border border-border/30 bg-muted/20">
                      <div className="grid grid-cols-1 divide-y divide-border/30">
                        {flight.tickets.map((ticket, idx) => (
                          <div key={ticket.id || idx} className="flex items-center justify-between p-2 transition-colors hover:bg-muted/30">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span className="min-w-[22px] text-[10px] font-semibold text-muted-foreground">
                                  {groupedFlights.slice(0, fIdx).reduce((sum, group) => sum + group.tickets.length, 0) + idx + 1}.
                                </span>
                                <span className="text-[12px] font-bold text-foreground uppercase tracking-tight">
                                  {ticket.passenger?.fullName || 'CHƯA CÓ TÊN'}
                                </span>
                                <span className="text-[9px] bg-muted-foreground/10 text-muted-foreground px-1 py-0.5 rounded font-mono">
                                  {ticket.passenger?.type || 'ADT'}
                                </span>
                                {ticket.airlineBookingCode && (
                                  <span className="text-[10px] font-mono text-primary bg-primary/10 px-1 py-0.5 rounded">
                                    {ticket.airlineBookingCode}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground mt-1">
                                <span className="font-medium text-foreground">{ticket.seatClass} {ticket.fareClass}</span>
                                {ticket.eTicketNumber && (
                                  <span>· Số vé: <span className="font-mono">{ticket.eTicketNumber}</span></span>
                                )}
                                {ticket.baggageAllowance && (
                                  <span>· Hành lý: {ticket.baggageAllowance}</span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[12px] font-bold font-tabular text-foreground">{formatVND(ticket.sellPrice)}</p>
                              <p className="text-[10px] font-tabular text-emerald-500">+{formatVND(ticket.profit)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Financial summary */}
          <div className="hidden card p-3.5">
            <div className="mb-1.5 flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-[13px] font-medium text-foreground">Tài chính</h3>
            </div>
            <div className="flex flex-col text-[13px]">
              {[
                { label: 'Giá bán (khách)',    value: formatVND(bk.totalSellPrice),  bold: false },
                { label: 'Giá net (hãng bay)', value: formatVND(bk.totalNetPrice),   bold: false },
                { label: 'Phí dịch vụ',        value: formatVND(bk.totalFees),       bold: false },
                { label: 'Lợi nhuận',           value: `+${formatVND(bk.profit)}`,   bold: true,  green: true },
              ].map((row, idx, arr) => (
                <div key={row.label} className={cn('flex items-center justify-between py-2', idx !== arr.length - 1 && 'border-b border-border/50')}>
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={cn('font-medium', row.green ? 'text-emerald-500' : 'text-foreground')}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Payment status */}
            <div className="mt-3.5 space-y-2.5 border-t border-border pt-3.5">
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
              <div className="mt-3 border-t border-border pt-2.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">Lịch sử nhận tiền</p>
                {(bk.payments ?? []).map(p => <PaymentRow key={p.id} payment={p} />)}
              </div>
            )}
            {canAddPayment && (
              <button
                onClick={() => setShowAddPayment(true)}
                className="mt-3.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-accent/50 text-[12px] font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Plus className="w-3.5 h-3.5" /> Ghi nhận thanh toán mới
              </button>
            )}
          </div>

          {/* Lịch sử Hoàn/Đổi vé */}
          {(bk.adjustments ?? []).length > 0 && (
            <div className="order-2 card mb-3 mt-3 p-4">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Lịch sử Hoàn / Đổi vé
              </h3>
              <div className="space-y-3">
                {(bk.adjustments ?? []).map((adj: BookingAdjustment) => (
                  <div key={adj.id} className="rounded-lg border border-border p-3 text-[13px]">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-medium',
                          adj.type === 'CHANGE'
                            ? 'bg-blue-500/10 text-blue-500'
                            : adj.type === 'REFUND_CASH'
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-orange-500/10 text-orange-500',
                        )}
                      >
                        {adj.type === 'CHANGE' ? 'Đổi vé' : adj.type === 'REFUND_CASH' ? 'Hoàn tiền' : 'Hoàn bảo lưu'}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(adj.createdAt)}</span>
                    </div>

                    <div className="space-y-1 text-xs">
                      {adj.type === 'CHANGE' && (
                        <>
                          {Number(adj.chargeToCustomer) > 0 && (
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">Thu thêm KH (AR):</span>
                              <span className="font-tabular text-amber-500">+{formatVND(adj.chargeToCustomer)}</span>
                            </div>
                          )}
                          {Number(adj.changeFee) > 0 && (
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">Phí đổi trả NCC (AP):</span>
                              <span className="font-tabular text-red-400">-{formatVND(adj.changeFee)}</span>
                            </div>
                          )}
                        </>
                      )}

                      {(adj.type === 'REFUND_CASH' || adj.type === 'REFUND_CREDIT') && (
                        <>
                          {Number(adj.airlineRefund) > 0 && (
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">NCC hoàn APG:</span>
                              <span className="font-tabular text-emerald-500">+{formatVND(adj.airlineRefund)}</span>
                            </div>
                          )}
                          {Number(adj.penaltyFee) > 0 && (
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">Phí hoàn (hãng thu):</span>
                              <span className="font-tabular text-muted-foreground">{formatVND(adj.penaltyFee)}</span>
                            </div>
                          )}
                          {Number(adj.refundAmount) > 0 && (
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">Hoàn KH:</span>
                              <span className="font-tabular text-red-500">-{formatVND(adj.refundAmount)}</span>
                            </div>
                          )}
                          {Number(adj.apgServiceFee) > 0 && (
                            <div className="flex justify-between gap-3">
                              <span className="text-muted-foreground">Phí xử lý APG:</span>
                              <span className="font-tabular text-emerald-500">+{formatVND(adj.apgServiceFee)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {adj.notes && (
                      <p className="mt-2 italic text-xs text-muted-foreground">
                        {normalizeLegacyVietnameseText(adj.notes)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked Ledgers (AR/AP) */}
          {(bk.ledgers ?? []).length > 0 && (
            <div className="order-3 card p-3.5">
              <div className="mb-1.5 flex items-center justify-between border-b border-border pb-2.5">
                <h3 className="text-[13px] font-medium text-foreground">Công nợ liên kết ({bk.ledgers!.length})</h3>
              </div>
              <div className="flex flex-col text-[13px] divide-y divide-border/50">
                {bk.ledgers!.map((l) => (
                  <div key={l.id} className="flex items-center justify-between py-2">
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

          {(bk.creditsCreated ?? []).length > 0 && (
            <div className="order-4 card p-3.5">
              <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
                <h3 className="text-[13px] font-medium text-foreground">Định danh tạo từ booking ({bk.creditsCreated!.length})</h3>
              </div>
              <div className="space-y-3">
                {bk.creditsCreated!.map((credit) => (
                  <div key={credit.id} className="rounded-xl border border-border p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{credit.passengerName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono">{credit.airline}</span>
                          {credit.ticketNumber && <span>Vé: {credit.ticketNumber}</span>}
                          {credit.pnr && <span className="font-mono">{credit.pnr}</span>}
                          {credit.customer?.fullName && <span>Khách: {credit.customer.fullName}</span>}
                        </div>
                      </div>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                          credit.status === 'PARTIAL'
                            ? 'bg-amber-500/10 text-amber-500'
                            : 'bg-emerald-500/10 text-emerald-500',
                        )}
                      >
                        {credit.status === 'PARTIAL' ? 'Đã dùng một phần' : 'Còn hiệu lực'}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="rounded-lg bg-muted/40 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Giá trị còn lại</p>
                        <p className="mt-1 text-sm font-semibold text-emerald-500">{formatVND(credit.remainingAmount)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Tổng credit</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatVND(credit.creditAmount)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/40 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">Hạn dùng</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">{formatDate(credit.expiryDate)}</p>
                      </div>
                    </div>

                    {credit.notes && (
                      <p className="mt-2 text-xs italic text-muted-foreground">
                        {normalizeLegacyVietnameseText(credit.notes)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Timeline + Staff */}
        <div className="space-y-3">
          <FinancialSummaryCard
            booking={bk}
            passengerCount={passengerCount}
            totalSellPrice={totalSellPrice}
            totalNetPrice={totalNetPrice}
            totalProfit={totalProfit}
            totalPaid={totalPaid}
            totalRemaining={totalRemaining}
            canAddPayment={canAddPayment}
            onAddPayment={() => setShowAddPayment(true)}
          />

          {/* Status timeline */}
          <div className="card p-3.5">
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2.5">
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
                  detail: normalizeLegacyVietnameseText(h.reason) || undefined,
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
                <div className="space-y-2.5">
                  {events.map((ev, i) => (
                    <div key={i} className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                          ev.type === 'status' ? (i === events.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40')
                            : ev.type === 'ar' ? 'bg-blue-500' : 'bg-amber-500'
                        )} />
                        {i < events.length - 1 && <div className="mt-1 w-px flex-1 bg-border" />}
                      </div>
                      <div className="min-w-0 pb-2.5">
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
          {/* Booking meta */}
          <div className="card p-3.5">
            <div className="mb-2.5 flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-[13px] font-medium text-foreground">Nhân viên phụ trách</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-muted-foreground">
                  {getUserInitial(selectedStaff?.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {selectedStaff?.fullName ?? 'Chưa phân công'}
                  </p>
                  {selectedStaff?.email && (
                    <p className="truncate text-[11px] text-muted-foreground">{selectedStaff.email}</p>
                  )}
                </div>
              </div>

              {isAdmin ? (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-muted-foreground">
                    Chọn nhân viên phụ trách
                  </label>
                  <select
                    value={bookingMetaForm.staffId}
                    onChange={(e) => setBookingMetaForm((prev) => ({ ...prev, staffId: e.target.value }))}
                    className={cn(
                      'w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground',
                      'focus:outline-none focus:ring-1 focus:ring-primary',
                    )}
                  >
                    <option value="">Chọn nhân viên</option>
                    {staffOptions.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.fullName}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Mặc định booking gắn với tài khoản đang đăng nhập. Admin có thể đổi sang nhân viên phụ trách thực tế.
                  </p>
                </div>
              ) : null}
            </div>
            <div className="hidden flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                {(bk.staff?.fullName?.[0] || 'U').toUpperCase()}
              </div>
              <div>
                <p className="text-[13px] font-medium text-foreground">{bk.staff?.fullName ?? 'Chưa phân công'}</p>
                {bk.staff?.email && <p className="text-[11px] text-muted-foreground">{bk.staff.email}</p>}
              </div>
            </div>
          </div>

          <div className="card p-3.5">
            <div className="mb-2.5 flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-[13px] font-medium text-foreground">Ngày tạo</h3>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[11px] font-medium text-muted-foreground">
                Thời điểm tạo booking
              </label>
              <input
                type="datetime-local"
                value={bookingMetaForm.createdAt}
                onChange={(e) => setBookingMetaForm((prev) => ({ ...prev, createdAt: e.target.value }))}
                className={cn(
                  'w-full rounded-md border border-border bg-background px-3 py-2 text-[12px] text-foreground',
                  'focus:outline-none focus:ring-1 focus:ring-primary',
                )}
              />
              <p className="text-[10px] text-muted-foreground">
                Nếu lúc tạo booking chưa nhập ngày tạo, hệ thống sẽ tự lấy thời điểm tạo thực tế tại lúc thêm booking.
              </p>
            </div>
          </div>

          {/* Quick stats */}
          <div className="hidden card p-3.5">
            <div className="mb-1.5 flex items-center justify-between border-b border-border pb-2.5">
              <h3 className="text-[13px] font-medium text-foreground">Tóm tắt</h3>
            </div>
            <div className="flex flex-col text-[13px]">
              <div className="flex items-center justify-between border-b border-border/50 py-2">
                <span className="text-muted-foreground">Số vé</span>
                <span className="font-medium text-foreground">{bk.tickets?.length ?? 0}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 py-2">
                <span className="text-muted-foreground">Tổng thu</span>
                <span className="font-medium font-tabular text-foreground">{formatVND(bk.totalSellPrice)}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border/50 py-2">
                <span className="text-muted-foreground">Lợi nhuận</span>
                <span className="font-medium font-tabular text-emerald-500">+{formatVND(bk.profit)}</span>
              </div>
              <div className="flex items-center justify-between py-2">
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
          customerId={bk.customerId ?? ''}
          onClose={() => setShowAddTicket(false)}
        />
      )}

      {/* Add Payment Modal */}
      {showAddPayment && (
        <AddPaymentModal
          bookingId={bk.id}
          totalSellPrice={totalSellPrice}
          hasCustomer={hasCustomer}
          onClose={() => setShowAddPayment(false)}
        />
      )}

      {showSmartImport && (
        <SmartImportModal
          bookingId={bk.id}
          customerId={bk.customerId ?? ''}
          isOpen={showSmartImport}
          onClose={() => setShowSmartImport(false)}
          onSuccess={() => {
            setShowSmartImport(false);
            queryClient.invalidateQueries({ queryKey: ['booking', id] });
          }}
        />
      )}

      {/* Tích hợp modal */}
      {showAdjustmentModal && (
        <AdjustmentModal
          bookingId={bk.id}
          isOpen={showAdjustmentModal}
          defaultType={defaultAdjustmentType}
          onClose={closeAdjustmentModal}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['booking', id] });
            queryClient.invalidateQueries({ queryKey: ['ledger'] });
            queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
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
