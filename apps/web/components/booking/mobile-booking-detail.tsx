'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Plane,
  Plus,
  Ticket,
  User,
  Zap,
} from 'lucide-react';
import { AirlineBadge } from '@/components/ui/airline-badge';
import { cn, formatDate, formatDateTime, formatTime, formatVND } from '@/lib/utils';
import type { Booking, BookingStatus } from '@/types';

const STATUS_LABELS: Record<Booking['status'], string> = {
  NEW: 'Mới',
  PROCESSING: 'Đang xử lý',
  QUOTED: 'Đã báo giá',
  PENDING_PAYMENT: 'Chờ thanh toán',
  ISSUED: 'Đã xuất vé',
  COMPLETED: 'Hoàn thành',
  CHANGED: 'Đổi vé',
  REFUNDED: 'Hoàn vé',
  CANCELLED: 'Đã hủy',
};

const PAYMENT_LABELS: Record<Booking['paymentStatus'], string> = {
  PAID: 'Đã thanh toán',
  PARTIAL: 'Một phần',
  UNPAID: 'Còn nợ',
  REFUNDED: 'Hoàn tiền',
};

type StatusAction = {
  status: BookingStatus;
  label: string;
  variant: string;
  kind?: 'forward' | 'rollback';
};

function getPrimaryTicket(booking: Booking) {
  return (booking.tickets ?? [])[0];
}

function getLastTicket(booking: Booking) {
  const tickets = booking.tickets ?? [];
  return tickets[tickets.length - 1];
}

function getRouteLabel(booking: Booking) {
  const firstTicket = getPrimaryTicket(booking);
  const lastTicket = getLastTicket(booking);

  if (!firstTicket || !lastTicket) {
    return 'Chưa có hành trình';
  }

  return `${firstTicket.departureCode} -> ${lastTicket.arrivalCode}`;
}

function getStatusClass(status: Booking['status']) {
  if (status === 'ISSUED' || status === 'COMPLETED') {
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }
  if (status === 'PENDING_PAYMENT' || status === 'PROCESSING') {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  }
  if (status === 'CANCELLED' || status === 'REFUNDED') {
    return 'bg-red-500/10 text-red-600 dark:text-red-400';
  }
  return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
}

function getPaymentClass(status: Booking['paymentStatus']) {
  if (status === 'PAID') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  if (status === 'PARTIAL') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
  if (status === 'REFUNDED') return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
  return 'bg-red-500/10 text-red-600 dark:text-red-400';
}

function formatProfit(value: number) {
  if (value > 0) return `+${formatVND(value)}`;
  if (value < 0) return `-${formatVND(Math.abs(value))}`;
  return formatVND(0);
}

export function MobileBookingDetail({
  booking,
  totalSellPrice,
  totalNetPrice,
  totalProfit,
  totalPaid,
  totalRemaining,
  effectivePaymentStatus,
  canAddTicket,
  canEditItinerary,
  canAddPayment,
  statusActions,
  isStatusPending,
  onAddTicket,
  onSmartImport,
  onAddPayment,
  onConfirmStatus,
}: {
  booking: Booking;
  totalSellPrice: number;
  totalNetPrice: number;
  totalProfit: number;
  totalPaid: number;
  totalRemaining: number;
  effectivePaymentStatus: Booking['paymentStatus'];
  canAddTicket: boolean;
  canEditItinerary: boolean;
  canAddPayment: boolean;
  statusActions: StatusAction[];
  isStatusPending: boolean;
  onAddTicket: () => void;
  onSmartImport: () => void;
  onAddPayment: () => void;
  onConfirmStatus: (action: StatusAction) => void;
}) {
  const firstTicket = getPrimaryTicket(booking);
  const primaryStatusAction = statusActions.find((action) => action.status === 'ISSUED') ?? statusActions[0];

  async function copyPnr() {
    if (!booking.pnr) return;
    await navigator.clipboard.writeText(booking.pnr);
  }

  return (
    <div className="mx-auto max-w-md space-y-3 pb-28">
      <header className="sticky top-0 z-20 -mx-3 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <div className="flex items-start gap-3">
          <Link
            href="/bookings"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground active:bg-accent"
            aria-label="Quay lại danh sách"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-base font-bold tracking-[0.18em] text-foreground">
                {booking.pnr || booking.bookingCode}
              </p>
              {booking.pnr && (
                <button
                  type="button"
                  onClick={copyPnr}
                  className="flex h-8 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2 text-xs font-medium text-primary"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', getStatusClass(booking.status))}>
                {STATUS_LABELS[booking.status]}
              </span>
              <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', getPaymentClass(effectivePaymentStatus))}>
                {PAYMENT_LABELS[effectivePaymentStatus]}
              </span>
            </div>
          </div>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Hành trình</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{getRouteLabel(booking)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {firstTicket?.departureTime
                ? `${formatDate(firstTicket.departureTime)} ${formatTime(firstTicket.departureTime)}`
                : 'Bổ sung vé hoặc Smart Import để có lịch bay.'}
            </p>
          </div>
          <Plane className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
        </div>

        {firstTicket && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
            <AirlineBadge code={firstTicket.airline} size="sm" showName={false} />
            <span className="font-mono">{firstTicket.flightNumber}</span>
            <span>{booking.tickets?.length ?? 0} vé</span>
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">Giá bán</p>
          <p className="mt-2 truncate text-xl font-semibold font-tabular text-foreground">{formatVND(totalSellPrice)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">Lãi/Lỗ</p>
          <p className={cn(
            'mt-2 truncate text-xl font-semibold font-tabular',
            totalProfit > 0 && 'text-emerald-600 dark:text-emerald-400',
            totalProfit < 0 && 'text-red-600 dark:text-red-400',
            totalProfit === 0 && 'text-muted-foreground',
          )}>
            {formatProfit(totalProfit)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">Giá net</p>
          <p className="mt-2 truncate text-lg font-semibold font-tabular text-foreground">{formatVND(totalNetPrice)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">Còn phải thu</p>
          <p className="mt-2 truncate text-lg font-semibold font-tabular text-amber-600 dark:text-amber-400">{formatVND(totalRemaining)}</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Khách hàng</h2>
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Tên</span>
            <span className="text-right font-medium text-foreground">{booking.customer?.fullName || booking.contactName || 'Khách hàng mới'}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Số điện thoại</span>
            <span className="text-right font-medium text-foreground">{booking.customer?.phone || booking.contactPhone || 'Chưa có'}</span>
          </div>
          {booking.customer?.customerCode && (
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Mã khách hàng</span>
              <span className="font-mono text-xs font-semibold text-primary">{booking.customer.customerCode}</span>
            </div>
          )}
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Phụ trách</span>
            <span className="text-right font-medium text-foreground">{booking.staff?.fullName ?? 'Chưa phân công'}</span>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Thanh toán</h2>
          <Banknote className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-2.5 text-sm">
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Đã thu thật</span>
            <span className="font-semibold font-tabular text-emerald-600 dark:text-emerald-400">{formatVND(totalPaid)}</span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-muted-foreground">Còn lại</span>
            <span className="font-semibold font-tabular text-amber-600 dark:text-amber-400">{formatVND(totalRemaining)}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onAddPayment}
          disabled={!canAddPayment}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Banknote className="h-4 w-4" />
          Ghi nhận thanh toán
        </button>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Timeline xử lý</h2>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="space-y-3">
          {(booking.statusHistory ?? []).slice(-5).reverse().map((item) => (
            <div key={item.id} className="flex gap-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {STATUS_LABELS[item.toStatus] ?? item.toStatus}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                {item.reason && <p className="mt-1 text-xs text-muted-foreground">{item.reason}</p>}
              </div>
            </div>
          ))}
          {(booking.statusHistory ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có timeline trạng thái.</p>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSmartImport}
          disabled={!canEditItinerary}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground disabled:opacity-50"
        >
          <Zap className="h-4 w-4 text-amber-500" />
          Smart Import
        </button>
        <button
          type="button"
          onClick={onAddTicket}
          disabled={!canAddTicket || !canEditItinerary}
          className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-foreground disabled:opacity-50"
        >
          <Ticket className="h-4 w-4 text-muted-foreground" />
          Thêm vé
        </button>
      </section>

      {primaryStatusAction && (
        <div className="fixed inset-x-0 bottom-[82px] z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => onConfirmStatus(primaryStatusAction)}
            disabled={isStatusPending}
            className="mx-auto flex min-h-[48px] w-full max-w-md items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {isStatusPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {primaryStatusAction.label}
          </button>
        </div>
      )}
    </div>
  );
}
