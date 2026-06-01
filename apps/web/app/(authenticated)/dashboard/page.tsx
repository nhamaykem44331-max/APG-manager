'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Banknote, ChevronRight, Clock, Plus, RefreshCw, Search, Ticket } from 'lucide-react';
import Link from 'next/link';
import { AirlineChart } from '@/components/charts/airline-chart';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { dashboardApi } from '@/lib/api';
import { BOOKING_STATUS_CLASSES, BOOKING_STATUS_LABELS, cn, formatDateTime, formatVND } from '@/lib/utils';
import { useMobileViewport } from '@/hooks/use-mobile-viewport';
import type { DashboardOverview, DashboardOverviewAlert, DashboardOverviewBooking } from '@/types';

const METRIC_CARD_STYLES = {
  amber: {
    line: 'bg-amber-400',
    value: 'text-amber-600 dark:text-amber-400',
    glow: 'bg-amber-500/5',
  },
  lime: {
    line: 'bg-lime-400',
    value: 'text-lime-600 dark:text-lime-400',
    glow: 'bg-lime-500/5',
  },
  violet: {
    line: 'bg-violet-400',
    value: 'text-violet-600 dark:text-violet-400',
    glow: 'bg-violet-500/5',
  },
  rose: {
    line: 'bg-rose-400',
    value: 'text-rose-600 dark:text-rose-400',
    glow: 'bg-rose-500/5',
  },
  red: {
    line: 'bg-red-500',
    value: 'text-red-600 dark:text-red-500',
    glow: 'bg-red-500/5',
  },
  slate: {
    line: 'bg-slate-400',
    value: 'text-slate-700 dark:text-slate-200',
    glow: 'bg-slate-500/5',
  },
  emerald: {
    line: 'bg-emerald-400',
    value: 'text-emerald-600 dark:text-emerald-400',
    glow: 'bg-emerald-500/5',
  },
  cyan: {
    line: 'bg-cyan-400',
    value: 'text-cyan-700 dark:text-cyan-400',
    glow: 'bg-cyan-500/5',
  },
} as const;

type MetricTone = keyof typeof METRIC_CARD_STYLES;

function MetricCard({
  label,
  value,
  helper,
  tone,
  loading,
}: {
  label: string;
  value: string;
  helper?: string;
  tone: MetricTone;
  loading?: boolean;
}) {
  const style = METRIC_CARD_STYLES[tone];

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className={cn('h-1.5 animate-pulse', style.line)} />
        <div className="space-y-3 p-4">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          <div className="h-8 w-36 animate-pulse rounded bg-muted" />
          <div className="h-3 w-24 animate-pulse rounded bg-muted/70" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-xl border border-border bg-card', style.glow)}>
      <div className={cn('h-1.5', style.line)} />
      <div className="p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className={cn('mt-3 text-[28px] font-semibold tracking-tight', style.value)}>{value}</p>
        <p className="mt-2 text-xs text-muted-foreground">{helper ?? 'Số liệu realtime từ dữ liệu thật'}</p>
      </div>
    </div>
  );
}

function AlertItem({ alert }: { alert: DashboardOverviewAlert }) {
  const styles = {
    warning: 'alert-warning',
    error: 'alert-error',
    info: 'alert-info',
    success: 'alert-success',
  } as const;

  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-[13px]', styles[alert.type])}>
      <p className="truncate font-medium leading-snug">{alert.text}</p>
      <span className="shrink-0 text-[11px] opacity-70">{alert.time}</span>
    </div>
  );
}

function MobileDashboard({
  overview,
  isLoading,
}: {
  overview?: DashboardOverview;
  isLoading: boolean;
}) {
  const summary = overview?.summary;
  const recentBookings = overview?.recentBookings ?? [];
  const alerts = overview?.alerts ?? [];
  const pendingBookings = recentBookings.filter((booking) => (
    booking.status === 'PENDING_PAYMENT'
    || booking.status === 'PROCESSING'
    || booking.status === 'NEW'
  ));
  const urgentBookings = pendingBookings.length > 0 ? pendingBookings.slice(0, 4) : recentBookings.slice(0, 4);
  const todayLabel = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="mx-auto max-w-md space-y-4 pb-2">
      <header className="flex items-start justify-between gap-3 pt-1">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Khong gian lam viec
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">
            Dashboard tong quan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{todayLabel}</p>
        </div>
        <Link
          href="/bookings"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground active:bg-accent"
          aria-label="Mo bookings"
        >
          <Ticket className="h-4 w-4" />
        </Link>
      </header>

      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Hom nay</p>
            <h2 className="mt-1 text-xl font-semibold leading-tight text-foreground">Viec can xu ly truoc</h2>
          </div>
          <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            {pendingBookings.length} cho xu ly
          </span>
        </div>
        <Link
          href="/bookings?create=1"
          className="mt-4 flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" />
          Create Booking
        </Link>
      </section>

      <section className="grid grid-cols-2 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[110px] animate-pulse rounded-xl border border-border bg-card" />
          ))
        ) : (
          <>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-xs text-muted-foreground">Ve thang nay</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{summary?.ticketsSold ?? 0}</p>
              <span className="mt-3 inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                Da ban
              </span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-xs text-muted-foreground">Cho thanh toan</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{pendingBookings.length}</p>
              <span className="mt-3 inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Cho TT
              </span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-xs text-muted-foreground">Cong no phai thu</p>
              <p className="mt-2 truncate text-2xl font-semibold text-foreground">{formatVND(summary?.receivable ?? 0)}</p>
              <span className="mt-3 inline-flex rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                Con no
              </span>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5">
              <p className="text-xs text-muted-foreground">Lai/lo thang</p>
              <p className="mt-2 truncate text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                {formatVND(summary?.monthProfit ?? 0)}
              </p>
              <span className="mt-3 inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Loi nhuan
              </span>
            </div>
          </>
        )}
      </section>

      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">Can thao tac nhanh</h2>
          <Link href="/bookings" className="text-xs font-medium text-primary">Mo /bookings</Link>
        </div>
        <div className="space-y-2.5">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-[96px] animate-pulse rounded-xl border border-border bg-card" />
            ))
          ) : urgentBookings.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
              Chua co booking can xu ly trong danh sach gan day.
            </div>
          ) : (
            urgentBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="block rounded-xl border border-border bg-card p-3.5 active:bg-accent"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-semibold tracking-[0.16em] text-foreground">
                      {booking.pnr || booking.bookingCode}
                    </p>
                    <p className="mt-1 truncate text-sm font-medium text-foreground">{booking.contactName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{booking.route || 'Chua co hanh trinh'}</p>
                  </div>
                  <span className={cn('shrink-0', BOOKING_STATUS_CLASSES[booking.status] ?? 'badge-default')}>
                    {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5" />
                    {formatVND(booking.totalSellPrice)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDateTime(booking.createdAt)}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <Link href="/bookings" className="flex min-h-[48px] items-center justify-between rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground active:bg-accent">
          Booking
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/bookings?queue=ticket" className="flex min-h-[48px] items-center justify-between rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground active:bg-accent">
          Ticket
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/bookings?filter=date" className="flex min-h-[48px] items-center justify-between rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground active:bg-accent">
          Loc ngay booking
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
        <Link href="/bookings?tab=named-credits" className="flex min-h-[48px] items-center justify-between rounded-xl border border-border bg-card px-3 text-sm font-medium text-foreground active:bg-accent">
          Dinh Danh
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </section>

      {alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold text-foreground">Can luu y</h2>
          {alerts.slice(0, 3).map((alert) => (
            <div key={`${alert.type}-${alert.text}`} className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <p className="line-clamp-2 font-medium text-foreground">{alert.text}</p>
                <p className="mt-1 text-xs text-muted-foreground">{alert.time}</p>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const isMobile = useMobileViewport();
  const { data: overview, isLoading } = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: () => dashboardApi.getOverview(),
    select: (response) => response.data as DashboardOverview,
  });

  const summary = overview?.summary;
  const recentBookings = overview?.recentBookings ?? [];
  const alerts = overview?.alerts ?? [];

  const columns: ColumnDef<DashboardOverviewBooking>[] = [
    {
      header: 'Mã vé',
      accessorKey: 'pnr',
      cell: (booking) => booking.pnr
        ? <span className="font-mono text-[13px] font-bold tracking-widest text-foreground">{booking.pnr}</span>
        : <span className="text-[11px] italic text-muted-foreground">Chưa có PNR</span>,
    },
    {
      header: 'Khách hàng',
      accessorKey: 'contactName',
      cell: (booking) => (
        <span className="inline-block max-w-[180px] truncate font-medium text-foreground">{booking.contactName}</span>
      ),
    },
    {
      header: 'Tuyến',
      accessorKey: 'route',
      cell: (booking) => <span className="text-muted-foreground">{booking.route}</span>,
    },
    {
      header: 'Giá trị',
      accessorKey: 'totalSellPrice',
      cell: (booking) => <span className="font-medium font-tabular">{formatVND(booking.totalSellPrice)}</span>,
    },
    {
      header: 'Trạng thái',
      accessorKey: 'status',
      cell: (booking) => (
        <span className={cn('inline-flex items-center', BOOKING_STATUS_CLASSES[booking.status] ?? 'badge-default')}>
          {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
        </span>
      ),
    },
  ];

  const generatedAt = overview?.generatedAt ? formatDateTime(overview.generatedAt) : '';

  if (isMobile) {
    return <MobileDashboard overview={overview} isLoading={isLoading} />;
  }

  return (
    <div className="max-w-[1500px] space-y-6">
      <PageHeader
        title="Dashboard"
        description="Tổng quan vận hành và tài chính tháng này"
        actions={(
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] text-muted-foreground">
            <span>{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            {generatedAt ? <span className="hidden text-xs opacity-70 md:inline">• Cập nhật {generatedAt}</span> : null}
          </div>
        )}
      />

      <section className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Doanh thu tháng này"
            value={formatVND(summary?.monthRevenue ?? 0)}
            helper="Tổng doanh thu booking đã xuất hoặc hoàn thành"
            tone="amber"
            loading={isLoading}
          />
          <MetricCard
            label="Lợi nhuận tháng"
            value={formatVND(summary?.monthProfit ?? 0)}
            helper="Lợi nhuận ròng theo dữ liệu booking thực tế"
            tone="lime"
            loading={isLoading}
          />
          <MetricCard
            label="Tỷ suất lợi nhuận"
            value={`${(summary?.profitMargin ?? 0).toFixed(1)}%`}
            helper="Tỷ lệ lợi nhuận trên doanh thu tháng"
            tone="violet"
            loading={isLoading}
          />
          <MetricCard
            label="Tổng số vé đã bán trong tháng"
            value={(summary?.ticketsSold ?? 0).toLocaleString('vi-VN')}
            helper="Đếm theo vé logic: 1 PNR cho 1 khách = 1 vé"
            tone="rose"
            loading={isLoading}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Công nợ phải thu"
            value={formatVND(summary?.receivable ?? 0)}
            helper="Tổng công nợ phải thu còn lại"
            tone="red"
            loading={isLoading}
          />
          <MetricCard
            label="Công nợ phải trả"
            value={formatVND(summary?.payable ?? 0)}
            helper="Tổng công nợ phải trả còn lại"
            tone="slate"
            loading={isLoading}
          />
          <MetricCard
            label="Quỹ TK BIDV HTX"
            value={formatVND(summary?.bankHtx ?? 0)}
            helper="Số dư quỹ từ dòng tiền thực tế"
            tone="cyan"
            loading={isLoading}
          />
          <MetricCard
            label="Quỹ tiền mặt"
            value={formatVND(summary?.cashOffice ?? 0)}
            helper="Số dư quỹ tiền mặt văn phòng"
            tone="emerald"
            loading={isLoading}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart data={overview?.timeline ?? []} />
        </div>
        <div>
          <AirlineChart data={overview?.airlines ?? []} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="flex flex-col gap-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-[14px] font-medium text-foreground">Booking gần đây</h3>
            {generatedAt ? <span className="text-xs text-muted-foreground">Dữ liệu thật • {generatedAt}</span> : null}
          </div>
          <DataTable
            columns={columns}
            data={recentBookings}
            isLoading={isLoading}
            emptyMessage="Chưa có booking phát sinh gần đây."
          />
        </div>

        <div className="card flex flex-col">
          <div className="border-b border-border px-5 py-4">
            <h3 className="text-[13px] font-medium text-foreground">Cảnh báo hệ thống</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Chỉ hiển thị dữ liệu thật từ deposit, công nợ và booking</p>
          </div>
          <div className="space-y-2.5 p-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-[42px] animate-pulse rounded-lg border border-border bg-muted/40" />
              ))
            ) : (
              alerts.map((alert) => (
                <AlertItem key={`${alert.type}-${alert.text}`} alert={alert} />
              ))
            )}
          </div>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/bookings"
          className={cn(
            'flex items-center gap-2 rounded-md border border-transparent bg-foreground px-3 py-1.5 text-[13px] font-medium text-background transition-all duration-150 hover:opacity-90 active:scale-[0.98]',
          )}
        >
          <Plus className="h-4 w-4" />
          Tạo Booking mới
        </Link>

        <Link
          href="https://book.tanphuapg.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-all duration-150 hover:bg-accent active:scale-[0.98]',
          )}
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          Tra cứu giá vé
        </Link>

        <button
          type="button"
          className={cn(
            'flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-all duration-150 hover:bg-accent active:scale-[0.98]',
          )}
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          Đối soát hôm nay
        </button>
      </div>
    </div>
  );
}
