'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Copy,
  Filter,
  Loader2,
  Plane,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { bookingsApi } from '@/lib/api';
import { cn, formatDate, formatTime, formatVND } from '@/lib/utils';
import { AirlineBadge } from '@/components/ui/airline-badge';
import type { Booking, BookingSource, PaymentMethod } from '@/types';

type BookingPeriodFilter = 'all' | 'day' | 'month' | 'year';

const MOBILE_STATUS_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'NEW', label: 'Mới' },
  { key: 'PROCESSING', label: 'Đang xử lý' },
  { key: 'PENDING_PAYMENT', label: 'Chờ TT' },
  { key: 'ISSUED', label: 'Đã xuất' },
];

const MOBILE_STATUS_LABELS: Record<Booking['status'], string> = {
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

const MOBILE_PAYMENT_LABELS: Record<Booking['paymentStatus'], string> = {
  PAID: 'Đã thanh toán',
  PARTIAL: 'Một phần',
  UNPAID: 'Còn nợ',
  REFUNDED: 'Hoàn tiền',
};

const SOURCE_OPTIONS: { value: '' | BookingSource; label: string }[] = [
  { value: '', label: 'Tất cả nguồn' },
  { value: 'PHONE', label: 'Điện thoại' },
  { value: 'ZALO', label: 'Zalo' },
  { value: 'MESSENGER', label: 'Messenger' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'WALK_IN', label: 'Trực tiếp' },
  { value: 'REFERRAL', label: 'Giới thiệu' },
];

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Chuyển khoản' },
  { value: 'CASH', label: 'Tiền mặt' },
  { value: 'CREDIT_CARD', label: 'Thẻ ngân hàng' },
  { value: 'MOMO', label: 'MoMo' },
  { value: 'VNPAY', label: 'VNPay' },
  { value: 'DEBT', label: 'Công nợ' },
];

function getPrimaryTicket(booking: Booking) {
  return (booking.tickets ?? [])[0];
}

function getLastTicket(booking: Booking) {
  const tickets = booking.tickets ?? [];
  return tickets[tickets.length - 1];
}

function calculateBookingDisplayProfit(booking: Booking) {
  const adjustments = booking.adjustments ?? [];
  const serviceRevenue = adjustments.reduce((sum, adj) => sum + ((adj.type === 'HLKG' || adj.type === 'SERVICE') ? Number(adj.chargeToCustomer || 0) : 0), 0);
  const serviceCost = adjustments.reduce((sum, adj) => sum + ((adj.type === 'HLKG' || adj.type === 'SERVICE') ? Number(adj.changeFee || 0) : 0), 0);
  const changeRevenue = adjustments.reduce((sum, adj) => sum + (adj.type === 'CHANGE' ? Number(adj.chargeToCustomer || 0) : 0), 0);
  const changeCost = adjustments.reduce((sum, adj) => sum + (adj.type === 'CHANGE' ? Number(adj.changeFee || 0) : 0), 0);
  const refundAmount = adjustments.reduce((sum, adj) => sum + ((adj.type === 'REFUND_CASH' || adj.type === 'REFUND_CREDIT') ? Number(adj.refundAmount || 0) : 0), 0);
  const refundAirline = adjustments.reduce((sum, adj) => sum + ((adj.type === 'REFUND_CASH' || adj.type === 'REFUND_CREDIT') ? Number(adj.airlineRefund || 0) : 0), 0);
  const refundPenalty = adjustments.reduce((sum, adj) => sum + ((adj.type === 'REFUND_CASH' || adj.type === 'REFUND_CREDIT') ? Number(adj.penaltyFee || 0) : 0), 0);
  const refundServiceFee = adjustments.reduce((sum, adj) => sum + ((adj.type === 'REFUND_CASH' || adj.type === 'REFUND_CREDIT') ? Number(adj.apgServiceFee || 0) : 0), 0);
  const baseProfit = (booking.tickets?.length ?? 0) > 0
    ? (booking.tickets ?? []).reduce((sum, ticket) => sum + Number(ticket.profit || 0), 0)
    : Number(booking.profit ?? 0);

  return baseProfit
    + (serviceRevenue - serviceCost)
    + (changeRevenue - changeCost)
    + (refundAirline + refundServiceFee - refundAmount - refundPenalty);
}

function formatProfit(value: number) {
  if (value > 0) return `+${formatVND(value)}`;
  if (value < 0) return `-${formatVND(Math.abs(value))}`;
  return formatVND(0);
}

function getRouteLabel(booking: Booking) {
  const firstTicket = getPrimaryTicket(booking);
  const lastTicket = getLastTicket(booking);

  if (!firstTicket || !lastTicket) {
    return 'Chưa có hành trình';
  }

  return `${firstTicket.departureCode} -> ${lastTicket.arrivalCode}`;
}

function getSourceLabel(source: string) {
  return SOURCE_OPTIONS.find((item) => item.value === source)?.label ?? source;
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

interface MobileBookingsViewProps {
  activeStatus: string;
  setActiveStatus: (status: string) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  sourceFilter: string;
  setSourceFilter: (value: string) => void;
  periodFilterType: BookingPeriodFilter;
  setPeriodFilterType: (value: BookingPeriodFilter) => void;
  periodFilterValue: string;
  setPeriodFilterValue: (value: string) => void;
  page: number;
  setPage: (value: number | ((current: number) => number)) => void;
  bookings: Booking[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function MobileBookingsView({
  activeStatus,
  setActiveStatus,
  searchTerm,
  setSearchTerm,
  sourceFilter,
  setSourceFilter,
  periodFilterType,
  setPeriodFilterType,
  periodFilterValue,
  setPeriodFilterValue,
  page,
  setPage,
  bookings,
  total,
  totalPages,
  isLoading,
  isError,
  refetch,
}: MobileBookingsViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTicketQueue = searchParams.get('queue') === 'ticket';
  const shouldOpenCreate = searchParams.get('create') === '1';
  const shouldOpenFilter = searchParams.get('filter') === 'date';
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (shouldOpenCreate) {
      setIsCreateOpen(true);
    }
    if (shouldOpenFilter) {
      setIsFilterOpen(true);
    }
  }, [shouldOpenCreate, shouldOpenFilter]);

  const visibleBookings = useMemo(() => {
    if (!isTicketQueue) return bookings;

    return bookings.filter((booking) => (
      booking.status === 'PENDING_PAYMENT'
      || booking.status === 'PROCESSING'
      || !booking.pnr
      || booking.paymentStatus === 'UNPAID'
    ));
  }, [bookings, isTicketQueue]);

  const activeFilterCount = [
    activeStatus,
    sourceFilter,
    periodFilterType !== 'all' ? periodFilterValue || periodFilterType : '',
  ].filter(Boolean).length;

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 1600);
  }

  async function copyPnr(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast('Đã copy PNR');
    } catch {
      showToast('Không copy được PNR');
    }
  }

  function clearFilters() {
    setActiveStatus('');
    setSourceFilter('');
    setPeriodFilterType('all');
    setPeriodFilterValue('');
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-md space-y-3 pb-2">
      <header className="space-y-3 pt-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {isTicketQueue ? 'Hàng đợi xử lý' : 'Danh sách booking'}
            </p>
            <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
              {isTicketQueue ? 'Ticket cần xử lý' : 'Booking'}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isTicketQueue ? `${visibleBookings.length} việc trong trang hiện tại` : `${total} booking`}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Create
          </button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Tìm mã booking, PNR, tên, số điện thoại..."
            className="h-12 w-full rounded-xl border border-border bg-card pl-10 pr-11 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setPage(1);
              }}
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground active:bg-accent"
              aria-label="Xóa tìm kiếm"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {!isTicketQueue && (
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {MOBILE_STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveStatus(tab.key);
                setPage(1);
              }}
              className={cn(
                'min-h-[38px] shrink-0 rounded-full border px-3 text-sm font-medium transition-colors',
                activeStatus === tab.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-muted-foreground active:bg-accent',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setIsFilterOpen(true)}
          className="flex min-h-[42px] items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground active:bg-accent"
        >
          <Filter className="h-4 w-4 text-muted-foreground" />
          Lọc ngày booking
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
              {activeFilterCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => refetch()}
          className="flex min-h-[42px] items-center rounded-xl border border-border bg-card px-3 text-sm font-medium text-muted-foreground active:bg-accent"
        >
          Tải lại
        </button>
      </div>

      {isError ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Không thể tải danh sách booking.</p>
              <button type="button" onClick={() => refetch()} className="mt-2 font-medium underline">
                Thử lại
              </button>
            </div>
          </div>
        </div>
      ) : isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-[148px] animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : visibleBookings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-5 text-center">
          <Plane className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium text-foreground">
            {isTicketQueue ? 'Chưa có ticket cần xử lý' : 'Chưa có booking phù hợp'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Thử đổi bộ lọc hoặc tạo booking mới.</p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 min-h-[44px] rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            + Create Booking
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleBookings.map((booking) => (
            <BookingMobileCard
              key={booking.id}
              booking={booking}
              onCopyPnr={copyPnr}
              onOpen={() => router.push(`/bookings/${booking.id}`)}
            />
          ))}
        </div>
      )}

      {!isTicketQueue && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="min-h-[40px] rounded-lg px-3 text-sm font-medium text-muted-foreground disabled:opacity-40"
          >
            Trước
          </button>
          <span className="text-xs text-muted-foreground">
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            className="min-h-[40px] rounded-lg px-3 text-sm font-medium text-muted-foreground disabled:opacity-40"
          >
            Sau
          </button>
        </div>
      )}

      <MobileFilterSheet
        isOpen={isFilterOpen}
        activeStatus={activeStatus}
        sourceFilter={sourceFilter}
        periodFilterType={periodFilterType}
        periodFilterValue={periodFilterValue}
        onClose={() => setIsFilterOpen(false)}
        onClear={clearFilters}
        onApply={(next) => {
          setActiveStatus(next.activeStatus);
          setSourceFilter(next.sourceFilter);
          setPeriodFilterType(next.periodFilterType);
          setPeriodFilterValue(next.periodFilterValue);
          setPage(1);
          setIsFilterOpen(false);
        }}
      />

      <MobileCreateBookingSheet
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          if (shouldOpenCreate) {
            router.replace('/bookings');
          }
        }}
      />

      {toast && (
        <div className="fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-xl border border-border bg-foreground px-4 py-3 text-center text-sm font-medium text-background shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}

function BookingMobileCard({
  booking,
  onCopyPnr,
  onOpen,
}: {
  booking: Booking;
  onCopyPnr: (value: string) => void;
  onOpen: () => void;
}) {
  const firstTicket = getPrimaryTicket(booking);
  const route = getRouteLabel(booking);
  const profit = calculateBookingDisplayProfit(booking);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
      }}
      className="block w-full rounded-xl border border-border bg-card p-3.5 text-left active:bg-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {booking.pnr ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onCopyPnr(booking.pnr!);
                }}
                className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2.5 font-mono text-[12px] font-bold tracking-[0.18em] text-primary"
              >
                {booking.pnr}
                <Copy className="h-3.5 w-3.5" />
              </button>
            ) : (
              <span className="inline-flex min-h-[34px] items-center rounded-lg border border-border bg-muted px-2.5 text-xs font-medium text-muted-foreground">
                Chưa có PNR
              </span>
            )}
            <span className="truncate font-mono text-[11px] text-muted-foreground">{booking.bookingCode}</span>
          </div>
          <p className="mt-2 truncate text-[15px] font-semibold text-foreground">{booking.contactName || 'Khách hàng mới'}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{booking.contactPhone || 'Chưa có số điện thoại'}</p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
      </div>

      <div className="mt-3 rounded-lg border border-border/70 bg-background/60 px-3 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-foreground">{route}</p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {firstTicket ? (
                <>
                  <AirlineBadge code={firstTicket.airline} size="sm" showName={false} />
                  {firstTicket.flightNumber && <span className="font-mono">{firstTicket.flightNumber}</span>}
                  {firstTicket.departureTime && <span>{formatDate(firstTicket.departureTime)} {formatTime(firstTicket.departureTime)}</span>}
                </>
              ) : (
                <span>{getSourceLabel(booking.source)}</span>
              )}
            </div>
          </div>
          <Plane className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', getStatusClass(booking.status))}>
          {MOBILE_STATUS_LABELS[booking.status]}
        </span>
        <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-medium', getPaymentClass(booking.paymentStatus))}>
          {MOBILE_PAYMENT_LABELS[booking.paymentStatus]}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {booking.staff?.fullName ?? 'Chưa phân công'}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 text-xs">
        <div>
          <p className="text-muted-foreground">Giá bán</p>
          <p className="mt-1 font-semibold font-tabular text-foreground">{formatVND(booking.totalSellPrice)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Lãi/Lỗ</p>
          <p className={cn(
            'mt-1 font-semibold font-tabular',
            profit > 0 && 'text-emerald-600 dark:text-emerald-400',
            profit < 0 && 'text-red-600 dark:text-red-400',
            profit === 0 && 'text-muted-foreground',
          )}>
            {formatProfit(profit)}
          </p>
        </div>
      </div>
    </div>
  );
}

function MobileFilterSheet({
  isOpen,
  activeStatus,
  sourceFilter,
  periodFilterType,
  periodFilterValue,
  onClose,
  onClear,
  onApply,
}: {
  isOpen: boolean;
  activeStatus: string;
  sourceFilter: string;
  periodFilterType: BookingPeriodFilter;
  periodFilterValue: string;
  onClose: () => void;
  onClear: () => void;
  onApply: (value: {
    activeStatus: string;
    sourceFilter: string;
    periodFilterType: BookingPeriodFilter;
    periodFilterValue: string;
  }) => void;
}) {
  const [draft, setDraft] = useState({
    activeStatus,
    sourceFilter,
    periodFilterType,
    periodFilterValue,
  });

  useEffect(() => {
    if (!isOpen) return;
    setDraft({ activeStatus, sourceFilter, periodFilterType, periodFilterValue });
  }, [activeStatus, isOpen, periodFilterType, periodFilterValue, sourceFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 lg:hidden">
      <button type="button" className="absolute inset-0 h-full w-full" aria-label="Đóng bộ lọc" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Bộ lọc booking</h2>
            <p className="text-xs text-muted-foreground">Lọc nhanh bằng trạng thái, nguồn và ngày booking.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-border">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5">
          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Trạng thái</p>
            <div className="grid grid-cols-2 gap-2">
              {MOBILE_STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, activeStatus: tab.key }))}
                  className={cn(
                    'min-h-[44px] rounded-xl border px-3 text-left text-sm font-medium',
                    draft.activeStatus === tab.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Nguồn booking</p>
            <select
              value={draft.sourceFilter}
              onChange={(event) => setDraft((current) => ({ ...current, sourceFilter: event.target.value }))}
              className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            >
              {SOURCE_OPTIONS.map((source) => (
                <option key={source.value || 'all'} value={source.value}>{source.label}</option>
              ))}
            </select>
          </section>

          <section className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Ngày booking</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['all', 'Tất cả'],
                ['day', 'Theo ngày'],
                ['month', 'Theo tháng'],
                ['year', 'Theo năm'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((current) => ({
                    ...current,
                    periodFilterType: value,
                    periodFilterValue: '',
                  }))}
                  className={cn(
                    'min-h-[44px] rounded-xl border px-3 text-left text-sm font-medium',
                    draft.periodFilterType === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {draft.periodFilterType === 'day' && (
              <input
                type="date"
                value={draft.periodFilterValue}
                onChange={(event) => setDraft((current) => ({ ...current, periodFilterValue: event.target.value }))}
                className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            )}
            {draft.periodFilterType === 'month' && (
              <input
                type="month"
                value={draft.periodFilterValue}
                onChange={(event) => setDraft((current) => ({ ...current, periodFilterValue: event.target.value }))}
                className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            )}
            {draft.periodFilterType === 'year' && (
              <div className="relative">
                <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="number"
                  inputMode="numeric"
                  min={2000}
                  max={2100}
                  placeholder="2026"
                  value={draft.periodFilterValue}
                  onChange={(event) => setDraft((current) => ({ ...current, periodFilterValue: event.target.value.slice(0, 4) }))}
                  className="h-12 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </section>
        </div>

        <div className="sticky bottom-0 mt-5 grid grid-cols-[1fr_1.4fr] gap-2 bg-background pt-3">
          <button
            type="button"
            onClick={() => {
              onClear();
              onClose();
            }}
            className="min-h-[48px] rounded-xl border border-border text-sm font-semibold text-foreground"
          >
            Xóa lọc
          </button>
          <button
            type="button"
            onClick={() => onApply(draft)}
            className="min-h-[48px] rounded-xl bg-primary text-sm font-semibold text-primary-foreground"
          >
            Áp dụng lọc
          </button>
        </div>
      </div>
    </div>
  );
}

function MobileCreateBookingSheet({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    contactName: '',
    contactPhone: '',
    pnr: '',
    source: 'PHONE' as BookingSource,
    paymentMethod: 'BANK_TRANSFER' as PaymentMethod,
    notes: '',
  });

  const mutation = useMutation({
    mutationFn: () => bookingsApi.create({
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone.trim(),
      source: form.source,
      paymentMethod: form.paymentMethod,
      pnr: form.pnr.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }),
    onSuccess: (response) => {
      const created = response.data as Booking;
      onClose();
      router.push(`/bookings/${created.id}`);
    },
    onError: (err) => {
      const message = (err as { response?: { data?: { message?: string | string[] } }; message?: string })?.response?.data?.message;
      setError(Array.isArray(message) ? message[0] : message || 'Không thể tạo booking. Vui lòng thử lại.');
    },
  });

  useEffect(() => {
    if (isOpen) setError('');
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 lg:hidden">
      <button type="button" className="absolute inset-0 h-full w-full" aria-label="Đóng tạo booking" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl border border-border bg-background p-4 pb-[max(env(safe-area-inset-bottom),1rem)] shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Create Booking</h2>
            <p className="text-xs text-muted-foreground">Nhập nhanh thông tin tối thiểu, bổ sung vé ở màn chi tiết.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full border border-border">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError('');
            mutation.mutate();
          }}
        >
          <section className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Thông tin khách</p>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">Khách hàng / mã khách hàng</span>
              <input
                value={form.contactName}
                onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                placeholder="Tên khách hàng"
                className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">Số điện thoại</span>
              <input
                value={form.contactPhone}
                onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
                placeholder="0901234567"
                inputMode="tel"
                className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
          </section>

          <section className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Vé / PNR</p>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">PNR nếu đã có</span>
              <input
                value={form.pnr}
                onChange={(event) => setForm((current) => ({ ...current, pnr: event.target.value.toUpperCase() }))}
                placeholder="ABC123"
                className="h-12 w-full rounded-xl border border-border bg-card px-3 font-mono text-sm uppercase tracking-[0.14em] outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-foreground">Nguồn booking</span>
                <select
                  value={form.source}
                  onChange={(event) => setForm((current) => ({ ...current, source: event.target.value as BookingSource }))}
                  className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {SOURCE_OPTIONS.filter((source) => source.value).map((source) => (
                    <option key={source.value} value={source.value}>{source.label}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-foreground">Thanh toán</span>
                <select
                  value={form.paymentMethod}
                  onChange={(event) => setForm((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))}
                  className="h-12 w-full rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  {PAYMENT_OPTIONS.map((payment) => (
                    <option key={payment.value} value={payment.value}>{payment.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">Ghi chú</span>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                placeholder="Thông tin thêm cho booking..."
                rows={3}
                className="w-full resize-none rounded-xl border border-border bg-card px-3 py-3 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </label>
          </section>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="sticky bottom-0 grid grid-cols-[1fr_1.4fr] gap-2 bg-background pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] rounded-xl border border-border text-sm font-semibold text-foreground"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Tạo booking
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
