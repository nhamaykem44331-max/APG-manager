'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, RefreshCw, Search } from 'lucide-react';
import Link from 'next/link';
import { AirlineChart } from '@/components/charts/airline-chart';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { PageHeader } from '@/components/ui/page-header';
import { dashboardApi } from '@/lib/api';
import { BOOKING_STATUS_CLASSES, BOOKING_STATUS_LABELS, cn, formatDateTime, formatVND } from '@/lib/utils';
import type { DashboardOverview, DashboardOverviewAlert, DashboardOverviewBooking } from '@/types';

const METRIC_CARD_STYLES = {
  amber: {
    line: 'bg-amber-400',
    value: 'text-amber-400',
    glow: 'bg-amber-500/5',
  },
  lime: {
    line: 'bg-lime-400',
    value: 'text-lime-400',
    glow: 'bg-lime-500/5',
  },
  violet: {
    line: 'bg-violet-400',
    value: 'text-violet-400',
    glow: 'bg-violet-500/5',
  },
  rose: {
    line: 'bg-rose-400',
    value: 'text-rose-400',
    glow: 'bg-rose-500/5',
  },
  red: {
    line: 'bg-red-500',
    value: 'text-red-500',
    glow: 'bg-red-500/5',
  },
  slate: {
    line: 'bg-slate-400',
    value: 'text-slate-200',
    glow: 'bg-slate-500/5',
  },
  emerald: {
    line: 'bg-emerald-400',
    value: 'text-emerald-400',
    glow: 'bg-emerald-500/5',
  },
  cyan: {
    line: 'bg-cyan-400',
    value: 'text-cyan-400',
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
    warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    error: 'border-red-500/20 bg-red-500/10 text-red-300',
    info: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  } as const;

  return (
    <div className={cn('flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-[13px]', styles[alert.type])}>
      <p className="truncate font-medium leading-snug">{alert.text}</p>
      <span className="shrink-0 text-[11px] opacity-70">{alert.time}</span>
    </div>
  );
}

export default function DashboardPage() {
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
