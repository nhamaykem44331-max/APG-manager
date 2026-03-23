// APG Manager RMS - Danh sách Booking
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Plus, Download, Search, Filter, ChevronLeft, ChevronRight, FileText, Loader2
} from 'lucide-react';
import { bookingsApi } from '@/lib/api';
import {
  cn, formatVND, formatDateTime,
  BOOKING_STATUS_LABELS, BOOKING_STATUS_CLASSES,
  BOOKING_SOURCE_LABELS, AIRLINE_NAMES,
} from '@/lib/utils';
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

  // Tạo booking nhanh → chuyển thẳng tới trang thêm vé
  const quickCreateMutation = useMutation({
    mutationFn: () => bookingsApi.create({
      contactName: 'Khách hàng mới',
      contactPhone: '',
      source: 'PHONE',
      paymentMethod: 'BANK_TRANSFER',
    }),
    onSuccess: (res: any) => {
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

  const bookings: Booking[] = data?.data ?? SAMPLE_BOOKINGS;
  const total: number = data?.total ?? SAMPLE_BOOKINGS.length;
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
      header: 'Mã booking',
      cell: (b) => <span className="font-mono font-medium text-foreground">{b.bookingCode}</span>,
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
              ? AIRLINE_NAMES[b.tickets[0].airline] ?? b.tickets[0].airline
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
        </div>
      </div>

      <SheetSyncPanel isOpen={isSheetSyncOpen} onClose={() => setIsSheetSyncOpen(false)} />
    </div>
  );
}

// Dữ liệu mẫu
const SAMPLE_BOOKINGS: Booking[] = [
  {
    id: '1', bookingCode: 'APG-260321-023', customerId: 'c1', staffId: 's1',
    status: 'ISSUED', source: 'PHONE', contactPhone: '0901234567',
    contactName: 'Nguyễn Văn Minh', totalSellPrice: 2_850_000, totalNetPrice: 2_500_000,
    totalFees: 50_000, profit: 300_000, paymentMethod: 'BANK_TRANSFER',
    paymentStatus: 'PAID', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    tickets: [{ id: 't1', bookingId: '1', passengerId: 'p1', airline: 'VN',
      flightNumber: 'VN123', departureCode: 'HAN', arrivalCode: 'SGN',
      departureTime: new Date().toISOString(), arrivalTime: new Date().toISOString(),
      seatClass: 'Economy', sellPrice: 2_850_000, netPrice: 2_500_000,
      tax: 0, serviceFee: 50_000, commission: 0, profit: 300_000, status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }],
  },
  {
    id: '2', bookingCode: 'APG-260321-022', customerId: 'c2', staffId: 's1',
    status: 'PENDING_PAYMENT', source: 'ZALO', contactPhone: '0912345678',
    contactName: 'Trần Thị Hoa', totalSellPrice: 1_450_000, totalNetPrice: 1_300_000,
    totalFees: 30_000, profit: 120_000, paymentMethod: 'MOMO',
    paymentStatus: 'UNPAID', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: '3', bookingCode: 'APG-260321-021', customerId: 'c3', staffId: 's1',
    status: 'PROCESSING', source: 'WEBSITE', contactPhone: '0923456789',
    contactName: 'Lê Quốc Hùng', totalSellPrice: 5_700_000, totalNetPrice: 5_100_000,
    totalFees: 150_000, profit: 450_000, paymentMethod: 'CASH',
    paymentStatus: 'PARTIAL', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
];
