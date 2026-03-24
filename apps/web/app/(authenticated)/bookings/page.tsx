// APG Manager RMS - Danh sách Booking
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Plus, Download, Search, Filter, ChevronLeft, ChevronRight, FileText, Loader2, Plane
} from 'lucide-react';
import { bookingsApi } from '@/lib/api';
import {
  cn, formatVND, formatDateTime,
  BOOKING_STATUS_LABELS, BOOKING_STATUS_CLASSES,
  BOOKING_SOURCE_LABELS,
} from '@/lib/utils';
import { getAirlineName } from '@/lib/airline-utils';
import { AirlineBadge } from '@/components/ui/airline-badge';
import type { Booking } from '@/types';
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

export default function BookingsPage() {
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [isSheetSyncOpen, setIsSheetSyncOpen] = useState(false);

  // Tạo booking nhanh -> vào thẳng trang chi tiết và mở modal nhập nhanh
  // FIX 2 frontend: quick-create không gửi contactPhone rỗng
  const quickCreateMutation = useMutation({
    mutationFn: () => bookingsApi.create({
      contactName: 'Khách hàng mới',
      contactPhone: `QUICK-${Date.now()}`,
      source: 'PHONE',
      paymentMethod: 'BANK_TRANSFER',
    }),
    onSuccess: (res: any) => {
      window.sessionStorage.setItem('booking:openQuickImport', res.data.id);
      router.push(`/bookings/${res.data.id}`);
    },
  });

  // Fetch danh sách booking
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bookings', activeStatus, searchTerm, page],
    queryFn: () => bookingsApi.list({
      status: activeStatus || undefined,
      search: searchTerm || undefined,
      page,
      pageSize,
    } as Record<string, string | number>),
    select: (res) => res.data,
  });

  // FIX 9: Bỏ SAMPLE_BOOKINGS, dùng empty array + empty state
  const bookings: Booking[] = data?.data ?? [];
  const total: number = data?.total ?? 0;
  const showEmptyState = !isLoading && bookings.length === 0;
  const totalPages = Math.ceil(total / pageSize);

  if (isError) {
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
      cell: (b) => b.pnr
        ? <span className="font-mono font-bold text-foreground tracking-widest text-[14px]">{b.pnr}</span>
        : <span className="text-muted-foreground text-[11px] italic">Chưa có PNR</span>,
    },
    {
      header: 'Khách hàng',
      cell: (b) => (
        <div className="flex flex-col gap-0.5">
          <p className="font-medium text-foreground truncate max-w-[150px]">{b.contactName}</p>
          <p className="text-[11px] text-muted-foreground">{b.contactPhone}</p>
        </div>
      ),
    },
    {
      header: 'Chuyến bay',
      cell: (b) => (
        <div className="flex flex-col gap-0.5">
          <p className="text-foreground">
            {b.tickets?.[0]
              ? `${b.tickets[0].departureCode} → ${b.tickets[0].arrivalCode}`
              : '—'
            }
          </p>
          <p className="text-[11px] text-muted-foreground">
            {b.tickets?.[0]
              ? <AirlineBadge code={b.tickets[0].airline} size="sm" />
              : BOOKING_SOURCE_LABELS[b.source]
            }
          </p>
        </div>
      ),
    },
    {
      header: 'Giá bán',
      cell: (b) => <span className="font-medium font-tabular text-foreground">{formatVND(b.totalSellPrice)}</span>,
    },
    {
      header: 'Lãi/Lỗ',
      cell: (b) => (
        <span className="font-medium font-tabular text-emerald-500 text-xs">
          +{formatVND(b.profit)}
        </span>
      ),
    },
    {
      header: 'Trạng thái',
      cell: (b) => (
        <span className={cn(
          'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
          BOOKING_STATUS_CLASSES[b.status] ?? 'badge-default',
        )}>
          {BOOKING_STATUS_LABELS[b.status]}
        </span>
      ),
    },
    {
      header: 'Nhân viên',
      cell: (b) => <span className="text-muted-foreground">{b.staff?.fullName?.split(' ').pop() ?? '—'}</span>,
    },
    {
      header: 'Ngày tạo',
      cell: (b) => <span className="text-muted-foreground whitespace-nowrap">{formatDateTime(b.createdAt)}</span>,
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">
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
          searchPlaceholder="Search by booking code, name, phone..."
          searchValue={searchTerm}
          onSearchChange={(v) => { setSearchTerm(v); setPage(1); }}
          filters={
            <button className={cn(
              'flex items-center gap-1.5 px-3 h-[32px] rounded-md text-[13px] font-medium',
              'border border-border text-muted-foreground hover:bg-accent bg-background',
            )}>
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filters</span>
            </button>
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
      </div>

      <SheetSyncPanel isOpen={isSheetSyncOpen} onClose={() => setIsSheetSyncOpen(false)} />
    </div>
  );
}
