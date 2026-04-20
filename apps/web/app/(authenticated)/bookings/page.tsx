// APG Manager RMS - Danh sách Booking
'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  type LucideIcon, ArrowDown, ArrowUp, ArrowUpDown, Banknote, Ban, CalendarDays, CheckCircle2, CreditCard, Download, FileText, Filter, Loader2, Plane, Plus, RefreshCw, RotateCcw, Ticket, X
} from 'lucide-react';
import { bookingsApi } from '@/lib/api';
import {
  cn, formatVND, formatDate, formatTime,
} from '@/lib/utils';
import { AirlineBadge } from '@/components/ui/airline-badge';
import type { Booking, NamedCredit } from '@/types';
import { PageHeader } from '@/components/ui/page-header';
import { FilterBar } from '@/components/ui/filter-bar';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { useRouter } from 'next/navigation';
import { SheetSyncPanel } from '@/components/booking/sheet-sync-panel';

// Tabs trạng thái
const STATUS_TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'NEW', label: 'Mới' },
  { key: 'PROCESSING', label: 'Đang xử lý' },
  { key: 'PENDING_PAYMENT', label: 'Chờ TT' },
  { key: 'ISSUED', label: 'Đã xuất' },
  { key: 'COMPLETED', label: 'Hoàn thành' },
  { key: 'CANCELLED', label: 'Đã hủy' },
];

const PAYMENT_STATUS_LABELS: Record<Booking['paymentStatus'], string> = {
  PAID: 'Đã thanh toán',
  PARTIAL: 'Một phần',
  UNPAID: 'Đang nợ',
  REFUNDED: 'Hoàn tiền',
};

const PAYMENT_STATUS_CLASSES: Record<Booking['paymentStatus'], string> = {
  PAID: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  PARTIAL: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  UNPAID: 'bg-red-500/10 text-red-600 dark:text-red-400',
  REFUNDED: 'bg-slate-500/10 text-slate-400 dark:text-slate-300',
};

const BOOKING_STATUS_META: Record<Booking['status'], {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}> = {
  NEW: { label: 'Mới', icon: Plus, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  PROCESSING: { label: 'Đang xử lý', icon: RefreshCw, color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  QUOTED: { label: 'Đã báo giá', icon: FileText, color: 'text-indigo-500', bgColor: 'bg-indigo-500/10' },
  PENDING_PAYMENT: { label: 'Chờ thanh toán', icon: Banknote, color: 'text-orange-500', bgColor: 'bg-orange-500/10' },
  ISSUED: { label: 'Đã xuất vé', icon: Ticket, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  COMPLETED: { label: 'Hoàn thành', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-600/10' },
  CHANGED: { label: 'Đổi vé', icon: RotateCcw, color: 'text-yellow-500', bgColor: 'bg-yellow-500/10' },
  REFUNDED: { label: 'Hoàn vé', icon: RotateCcw, color: 'text-pink-500', bgColor: 'bg-pink-500/10' },
  CANCELLED: { label: 'Đã hủy', icon: Ban, color: 'text-red-500', bgColor: 'bg-red-500/10' },
};

function getCustomerCodeBadgeClass(type?: string) {
  return type === 'CORPORATE'
    ? 'bg-orange-500/12 text-orange-500 border border-orange-500/20'
    : 'bg-primary/10 text-primary border border-primary/20';
}

function getPrimaryTicket(booking: Booking) {
  return (booking.tickets ?? [])[0];
}

function getLastTicket(booking: Booking) {
  const tickets = booking.tickets ?? [];
  return tickets[tickets.length - 1];
}

function formatProfit(value: number) {
  const amount = Number(value ?? 0);

  if (amount > 0) return `+${formatVND(amount)}`;
  if (amount < 0) return `-${formatVND(Math.abs(amount))}`;

  return formatVND(0);
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

type BookingSortField = 'createdAt' | 'departureTime';
type BookingSortOrder = 'asc' | 'desc';
type BookingPeriodFilter = 'all' | 'day' | 'month' | 'year';

function buildCreatedDateRange(type: BookingPeriodFilter, value: string) {
  if (!value || type === 'all') {
    return { dateFrom: undefined, dateTo: undefined };
  }

  if (type === 'day') {
    return { dateFrom: value, dateTo: value };
  }

  if (type === 'month') {
    const [year, month] = value.split('-').map(Number);
    if (!year || !month) return { dateFrom: undefined, dateTo: undefined };
    const lastDay = new Date(year, month, 0).getDate();
    return {
      dateFrom: `${year}-${String(month).padStart(2, '0')}-01`,
      dateTo: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  if (value.length !== 4) {
    return { dateFrom: undefined, dateTo: undefined };
  }

  const year = Number(value);
  if (!year) {
    return { dateFrom: undefined, dateTo: undefined };
  }

  return {
    dateFrom: `${year}-01-01`,
    dateTo: `${year}-12-31`,
  };
}

export default function BookingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'bookings' | 'named-credits'>('bookings');
  const [activeStatus, setActiveStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<BookingSortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<BookingSortOrder>('desc');
  const [periodFilterType, setPeriodFilterType] = useState<BookingPeriodFilter>('all');
  const [periodFilterValue, setPeriodFilterValue] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isSheetSyncOpen, setIsSheetSyncOpen] = useState(false);
  const [copiedPnr, setCopiedPnr] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'named-credits') {
      setActiveTab('named-credits');
    }
  }, []);

  const { dateFrom, dateTo } = useMemo(
    () => buildCreatedDateRange(periodFilterType, periodFilterValue),
    [periodFilterType, periodFilterValue],
  );

  const handleActiveTabChange = (tab: 'bookings' | 'named-credits') => {
    setActiveTab(tab);
    if (tab === 'named-credits') {
      router.push('/bookings?tab=named-credits');
      return;
    }
    router.push('/bookings');
  };

  // Tạo booking nhanh -> vào thẳng trang chi tiết
  const quickCreateMutation = useMutation({
    mutationFn: () => bookingsApi.create({
      contactName: '',
      contactPhone: '',
      source: 'PHONE',
      paymentMethod: 'BANK_TRANSFER',
    }),
    onSuccess: (res: any) => {
      router.push(`/bookings/${res.data.id}`);
    },
    onError: (error: any) => {
      console.error('Create booking failed:', error);
      alert(error?.response?.data?.message || error?.message || 'Không thể tạo booking. Vui lòng kiểm tra kết nối API.');
    },
  });

  // Fetch danh sách booking
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bookings', activeStatus, searchTerm, sortBy, sortOrder, dateFrom, dateTo, page],
    enabled: activeTab === 'bookings',
    queryFn: () => bookingsApi.list({
      status: activeStatus || undefined,
      search: searchTerm || undefined,
      sortBy,
      order: sortOrder,
      dateFrom,
      dateTo,
      page,
      pageSize,
    } as Record<string, string | number>),
    select: (res) => res.data,
  });

  const { data: creditsData = [], isLoading: creditsLoading } = useQuery({
    queryKey: ['named-credits'],
    queryFn: () => bookingsApi.getNamedCredits(),
    enabled: activeTab === 'named-credits',
    select: (res) => res.data as NamedCredit[],
  });

  const { data: creditsSummary } = useQuery({
    queryKey: ['named-credits-summary'],
    queryFn: () => bookingsApi.getNamedCreditsSummary(),
    enabled: activeTab === 'named-credits',
    select: (res) => res.data as {
      activeCount: number;
      expiringSoonCount: number;
      totalRemainingValue: number;
    },
  });

  // FIX 9: Bỏ SAMPLE_BOOKINGS, dùng empty array + empty state
  const bookings: Booking[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const showEmptyState = !isLoading && bookings.length === 0;
  const totalPages = Math.ceil(total / pageSize);

  const toggleSort = (field: BookingSortField) => {
    setPage(1);
    if (sortBy === field) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(field);
    setSortOrder(field === 'departureTime' ? 'asc' : 'desc');
  };

  const handleCopyPnr = async (event: MouseEvent<HTMLButtonElement>, pnr: string) => {
    event.stopPropagation();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(pnr);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = pnr;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopiedPnr(pnr);
      window.setTimeout(() => {
        setCopiedPnr((current) => (current === pnr ? '' : current));
      }, 1400);
    } catch (error) {
      console.error('Copy PNR failed:', error);
    }
  };

  const renderSortHeader = (label: string, field: BookingSortField) => {
    const isActive = sortBy === field;
    const Icon = !isActive ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown;

    return (
      <button
        type="button"
        onClick={() => toggleSort(field)}
        className={cn(
          'inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground',
          isActive && 'text-foreground',
        )}
        title={
          field === 'departureTime'
            ? (sortOrder === 'asc' && isActive ? 'Đang xếp ngày bay gần nhất trước' : 'Sắp xếp theo ngày bay')
            : (sortOrder === 'desc' && isActive ? 'Đang xếp ngày tạo gần nhất trước' : 'Sắp xếp theo ngày tạo')
        }
      >
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5" />
      </button>
    );
  };

  if (activeTab === 'bookings' && isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-destructive">Không thể tải danh sách booking. Vui lòng thử lại.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-xs rounded-md border border-border hover:bg-accent"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const columns: ColumnDef<Booking>[] = [
    {
      header: 'PNR',
      className: 'w-[118px]',
      cell: (b) => b.pnr
        ? (
          <button
            type="button"
            onClick={(event) => handleCopyPnr(event, b.pnr!)}
            title={copiedPnr === b.pnr ? 'Đã copy PNR' : 'Bấm để copy PNR'}
            aria-label={`Copy PNR ${b.pnr}`}
            className={cn(
              'inline-flex min-w-[84px] items-center justify-center rounded-lg border px-2.5 py-1.5 font-mono text-[12px] font-black tracking-[0.22em] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_rgba(6,182,212,0.10)] transition-all duration-150 active:scale-[0.98]',
              copiedPnr === b.pnr
                ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-300 shadow-[0_0_0_1px_rgba(52,211,153,0.18),0_0_24px_rgba(52,211,153,0.18)]'
                : 'border-cyan-400/35 bg-[linear-gradient(135deg,rgba(6,182,212,0.16),rgba(59,130,246,0.10))] text-cyan-50 hover:border-cyan-300/70 hover:bg-cyan-400/15 hover:text-white',
            )}
          >
            {b.pnr}
          </button>
        )
        : <span className="text-muted-foreground text-[11px] italic">Chưa có PNR</span>,
    },
    {
      header: 'Tên đại diện',
      className: 'w-[168px]',
      cell: (b) => (
        <div className="flex flex-col gap-0.5">
          <span className="max-w-[148px] truncate font-medium text-foreground">{b.contactName}</span>
          <span className="max-w-[148px] truncate text-[11px] text-muted-foreground">
            {b.contactPhone}
          </span>
        </div>
      ),
    },
    {
      header: 'Hành trình',
      className: 'w-[156px]',
      cell: (b) => {
        const firstTicket = getPrimaryTicket(b);
        const lastTicket = getLastTicket(b);
        const segmentCount = b.tickets?.length ?? 0;

        if (!firstTicket || !lastTicket) {
          return <span className="text-[11px] text-muted-foreground italic">Chưa có hành trình</span>;
        }

        return (
          <div className="flex flex-col gap-1">
            <span className="truncate font-medium text-foreground whitespace-nowrap">
              {`${firstTicket.departureCode} → ${lastTicket.arrivalCode}`}
            </span>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10.5px] text-muted-foreground">
              <AirlineBadge code={firstTicket.airline} size="sm" showName={false} />
              {firstTicket.flightNumber && <span className="font-mono">{firstTicket.flightNumber}</span>}
              {segmentCount > 1 && <span>{`+${segmentCount - 1} chặng`}</span>}
            </div>
          </div>
        );
      },
    },
    {
      header: renderSortHeader('Khởi hành', 'departureTime'),
      className: 'w-[96px]',
      cell: (b) => {
        const firstTicket = getPrimaryTicket(b);

        if (!firstTicket?.departureTime) {
          return <span className="text-[11px] text-muted-foreground italic">Chưa có lịch bay</span>;
        }

        return (
          <div className="flex flex-col gap-0.5 whitespace-nowrap">
            <span className="font-medium text-foreground">{formatDate(firstTicket.departureTime)}</span>
            <span className="text-[10.5px] text-muted-foreground">{formatTime(firstTicket.departureTime)}</span>
          </div>
        );
      },
    },
    {
      header: 'Giá bán',
      className: 'w-[104px] text-right',
      cell: (b) => <span className="font-medium font-tabular text-foreground">{formatVND(b.totalSellPrice)}</span>,
    },
    {
      header: 'Lãi/Lỗ',
      className: 'w-[96px] text-right',
      cell: (b) => {
        const profit = calculateBookingDisplayProfit(b);

        return (
          <span
            className={cn(
              'font-medium font-tabular',
              profit > 0 && 'text-emerald-500',
              profit < 0 && 'text-rose-500',
              profit === 0 && 'text-muted-foreground',
            )}
          >
            {formatProfit(profit)}
          </span>
        );
      },
    },
    {
      header: 'Mã khách hàng',
      className: 'w-[116px]',
      cell: (b) => (
        b.customer?.customerCode ? (
          <span
            className={cn(
              'inline-flex max-w-full items-center rounded-md px-1.5 py-0.5 text-[10.5px] font-mono font-medium',
              getCustomerCodeBadgeClass(b.customer.type),
            )}
          >
            {b.customer.customerCode}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">Đang cấp mã</span>
        )
      ),
    },
    {
      header: 'Trạng thái',
      className: 'w-[176px]',
      cell: (b) => {
        const statusMeta = BOOKING_STATUS_META[b.status];
        const StatusIcon = statusMeta.icon;

        return (
          <div className="flex min-w-0 flex-col gap-1.5">
            <span
              className={cn(
                'inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-medium whitespace-nowrap',
                statusMeta.bgColor,
                statusMeta.color,
              )}
            >
              <StatusIcon className="h-3.5 w-3.5 shrink-0" />
              <span>{statusMeta.label}</span>
            </span>
            <span
              className={cn(
                'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap',
                PAYMENT_STATUS_CLASSES[b.paymentStatus],
              )}
            >
              {PAYMENT_STATUS_LABELS[b.paymentStatus]}
            </span>
          </div>
        );
      },
    },
    {
      header: renderSortHeader('Ngày tạo', 'createdAt'),
      className: 'w-[108px]',
      cell: (b) => (
        <div className="flex flex-col gap-0.5 whitespace-nowrap">
          <span className="font-medium text-foreground">{formatDate(b.businessDate ?? b.createdAt)}</span>
          <span className="text-[10.5px] text-muted-foreground">{formatTime(b.businessDate ?? b.createdAt)}</span>
        </div>
      ),
    },
    {
      header: 'Phụ trách',
      className: 'w-[108px]',
      cell: (b) => (
        <span className={cn('block max-w-[102px] truncate font-medium', !b.staff?.fullName && 'text-muted-foreground font-normal')}>
          {b.staff?.fullName ?? 'Chưa phân công'}
        </span>
      ),
    },
  ];

  const namedCreditExpiryThreshold = new Date(Date.now() + 30 * 24 * 3600 * 1000);

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Header */}
      <PageHeader
        title="Đặt vé & Booking"
        description="Quản lý toàn bộ booking của đại lý"
        actions={
          <div className="flex items-center gap-2">
            <button className={cn(
              'flex items-center justify-center w-8 h-8 rounded-md',
              'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
            )} title="Xuất Excel">
              <Download className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsSheetSyncOpen(true)}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-md',
                'bg-card border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
              )} title="Đồng bộ Sheets">
              <FileText className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleActiveTabChange(activeTab === 'named-credits' ? 'bookings' : 'named-credits')}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium border',
                activeTab === 'named-credits'
                  ? 'border-orange-500 bg-orange-500/10 text-orange-600'
                  : 'border-border text-muted-foreground hover:bg-accent',
              )}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Quản lý Định Danh
            </button>
            <button
              onClick={() => quickCreateMutation.mutate()}
              disabled={quickCreateMutation.isPending}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium',
                'bg-foreground text-background hover:opacity-90 transition-colors disabled:opacity-50 ml-1',
              )}
            >
              {quickCreateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating...</>
              ) : (
                <><Plus className="w-4 h-4" /> Create Booking</>
              )}
            </button>
          </div>
        }
      />

      {/* Main Content */}
      <div className="flex flex-col gap-4">
        {activeTab === 'bookings' && (
          <>
        {/* Vercel-style underline tabs */}
        <div className="flex items-center gap-6 border-b border-border px-1 overflow-x-auto custom-scrollbar">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveStatus(tab.key); setPage(1); }}
              className={cn(
                'pb-2.5 text-[14px] font-medium whitespace-nowrap transition-colors relative',
                activeStatus === tab.key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {tab.label}
              {activeStatus === tab.key && (
                <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-foreground rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        <FilterBar
          searchPlaceholder="Tìm theo mã booking, PNR, tên, số điện thoại..."
          searchValue={searchTerm}
          onSearchChange={(v) => { setSearchTerm(v); setPage(1); }}
          filters={
            <>
              <div className={cn(
                'flex h-[32px] items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[12px] font-medium text-muted-foreground',
              )}>
                <Filter className="h-3.5 w-3.5" />
                <span>Lọc ngày tạo</span>
              </div>

              <select
                value={periodFilterType}
                onChange={(e) => {
                  setPeriodFilterType(e.target.value as BookingPeriodFilter);
                  setPeriodFilterValue('');
                  setPage(1);
                }}
                className="h-[32px] rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="all">Tất cả thời gian</option>
                <option value="day">Theo ngày</option>
                <option value="month">Theo tháng</option>
                <option value="year">Theo năm</option>
              </select>

              {periodFilterType === 'day' && (
                <input
                  type="date"
                  value={periodFilterValue}
                  onChange={(e) => {
                    setPeriodFilterValue(e.target.value);
                    setPage(1);
                  }}
                  className="h-[32px] rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              )}

              {periodFilterType === 'month' && (
                <input
                  type="month"
                  value={periodFilterValue}
                  onChange={(e) => {
                    setPeriodFilterValue(e.target.value);
                    setPage(1);
                  }}
                  className="h-[32px] rounded-md border border-border bg-background px-3 text-[12px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              )}

              {periodFilterType === 'year' && (
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="number"
                    inputMode="numeric"
                    min={2000}
                    max={2100}
                    placeholder="2026"
                    value={periodFilterValue}
                    onChange={(e) => {
                      setPeriodFilterValue(e.target.value.slice(0, 4));
                      setPage(1);
                    }}
                    className="h-[32px] w-[110px] rounded-md border border-border bg-background pl-8 pr-3 text-[12px] text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {periodFilterType !== 'all' && (
                <button
                  type="button"
                  onClick={() => {
                    setPeriodFilterType('all');
                    setPeriodFilterValue('');
                    setPage(1);
                  }}
                  className="flex h-[32px] items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Xóa lọc</span>
                </button>
              )}
            </>
          }
        />

        <div>
          {/* FIX 9: Empty state */}
          {showEmptyState ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Plane className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Chưa có booking nào</p>
              <button
                onClick={() => quickCreateMutation.mutate()}
                className="px-4 py-2 text-xs rounded-md bg-foreground text-background hover:opacity-90 font-medium"
              >
                + Tạo booking đầu tiên
              </button>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={bookings}
              isLoading={isLoading}
              compact
              tableClassName="table-fixed"
              onRowClick={(row) => router.push(`/bookings/${row.id}`)}
              pageIndex={page - 1}
              pageCount={totalPages}
              canPreviousPage={page > 1}
              canNextPage={page < totalPages}
              previousPage={() => setPage(p => Math.max(1, p - 1))}
              nextPage={() => setPage(p => Math.min(totalPages, p + 1))}
              totalRecords={total}
              emptyMessage="Không tìm thấy booking nào phù hợp"
            />
          )}
        </div>

          </>
        )}

        {activeTab === 'named-credits' && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Credit đang active</p>
                <p className="mt-1 text-xl font-semibold text-orange-500">{creditsSummary?.activeCount ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Sắp hết hạn (30 ngày)</p>
                <p className="mt-1 text-xl font-semibold text-red-500">{creditsSummary?.expiringSoonCount ?? 0}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Tổng giá trị còn lại</p>
                <p className="mt-1 text-xl font-semibold text-emerald-500">
                  {formatVND(creditsSummary?.totalRemainingValue ?? 0)}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {creditsLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang tải danh sách credit bảo lưu...
                </div>
              ) : creditsData.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  Chưa có credit bảo lưu nào
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-[13px]">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="px-4 py-3">Hành khách</th>
                        <th className="px-4 py-3">Hãng</th>
                        <th className="px-4 py-3">PNR gốc</th>
                        <th className="px-4 py-3">Số tiền BL</th>
                        <th className="px-4 py-3">Đã dùng</th>
                        <th className="px-4 py-3">Còn lại</th>
                        <th className="px-4 py-3">Hạn sử dụng</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creditsData.map((credit) => (
                        <tr key={credit.id} className="border-b border-border transition-colors hover:bg-accent/20">
                          <td className="px-4 py-3 font-medium">{credit.passengerName}</td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1.5">
                              <img
                                src={`https://images.kiwi.com/airlines/32/${credit.airline}.png`}
                                alt=""
                                className="h-4 w-4 rounded-sm"
                                onError={(event) => {
                                  (event.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              {credit.airline}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-xs">{credit.pnr || '—'}</td>
                          <td className="px-4 py-3 font-tabular">{formatVND(credit.creditAmount)}</td>
                          <td className="px-4 py-3 font-tabular text-muted-foreground">{formatVND(credit.usedAmount)}</td>
                          <td className="px-4 py-3 font-tabular font-medium text-emerald-500">{formatVND(credit.remainingAmount)}</td>
                          <td
                            className={cn(
                              'px-4 py-3',
                              new Date(credit.expiryDate) < namedCreditExpiryThreshold ? 'text-red-500' : 'text-muted-foreground',
                            )}
                          >
                            {formatDate(credit.expiryDate)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-medium',
                                credit.status === 'ACTIVE' && 'bg-emerald-500/10 text-emerald-500',
                                credit.status === 'PARTIAL' && 'bg-amber-500/10 text-amber-500',
                                credit.status === 'USED' && 'bg-blue-500/10 text-blue-500',
                                credit.status === 'EXPIRED' && 'bg-red-500/10 text-red-500',
                              )}
                            >
                              {credit.status === 'ACTIVE'
                                ? 'Đang BL'
                                : credit.status === 'PARTIAL'
                                  ? 'Dùng 1 phần'
                                  : credit.status === 'USED'
                                    ? 'Đã dùng'
                                    : 'Hết hạn'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {credit.status === 'ACTIVE' ? (
                              <button
                                type="button"
                                onClick={() => window.alert('Màn cấn trừ credit sẽ được hoàn thiện ở bước tiếp theo.')}
                                className="text-xs text-blue-500 hover:underline"
                              >
                                Cấn trừ
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <SheetSyncPanel isOpen={isSheetSyncOpen} onClose={() => setIsSheetSyncOpen(false)} />
    </div>
  );
}
