// APG Manager RMS - Danh sách Booking
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Plus, Download, Search, Filter, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { bookingsApi } from '@/lib/api';
import {
  cn, formatVND, formatDateTime,
  BOOKING_STATUS_LABELS, BOOKING_STATUS_CLASSES,
  BOOKING_SOURCE_LABELS, AIRLINE_NAMES,
} from '@/lib/utils';
import type { Booking } from '@/types';

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
  const [activeStatus, setActiveStatus] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch danh sách booking
  const { data, isLoading } = useQuery({
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

  return (
    <div className="space-y-4 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Đặt vé & Booking</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Quản lý toàn bộ booking của đại lý
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm',
            'border border-border text-muted-foreground hover:bg-accent transition-colors',
          )}>
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>
          <Link
            href="/bookings/new"
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium',
              'bg-primary text-white hover:bg-primary/90 transition-colors',
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Tạo Booking
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm mã booking, tên khách, SĐT..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className={cn(
              'w-full pl-8 pr-3 py-2 text-sm rounded-md',
              'bg-background border border-border',
              'text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-1 focus:ring-primary',
            )}
          />
        </div>
        <button className={cn(
          'flex items-center gap-1.5 px-3 py-2 rounded-md text-sm',
          'border border-border text-muted-foreground hover:bg-accent',
        )}>
          <Filter className="w-3.5 h-3.5" />
          Bộ lọc
        </button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setActiveStatus(tab.key); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
              activeStatus === tab.key
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Mã booking', 'Khách hàng', 'Chuyến bay', 'Giá bán', 'Lợi nhuận', 'Trạng thái', 'NV', 'Ngày tạo'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-muted rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                bookings.map((booking) => (
                  <tr
                    key={booking.id}
                    className="hover:bg-accent/40 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/bookings/${booking.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {booking.bookingCode}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground truncate max-w-32">{booking.contactName}</p>
                      <p className="text-xs text-muted-foreground">{booking.contactPhone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-foreground text-xs">
                        {booking.tickets?.[0]
                          ? `${booking.tickets[0].departureCode} → ${booking.tickets[0].arrivalCode}`
                          : '—'
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {booking.tickets?.[0]
                          ? AIRLINE_NAMES[booking.tickets[0].airline] ?? booking.tickets[0].airline
                          : BOOKING_SOURCE_LABELS[booking.source]
                        }
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {formatVND(booking.totalSellPrice)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-emerald-500 font-medium text-xs">
                        +{formatVND(booking.profit)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium',
                        BOOKING_STATUS_CLASSES[booking.status] ?? 'status-new',
                      )}>
                        {BOOKING_STATUS_LABELS[booking.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {booking.staff?.fullName?.split(' ').pop() ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(booking.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Hiển thị {bookings.length} / {total} booking
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-xs px-2 text-foreground">
              {page} / {totalPages || 1}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
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
