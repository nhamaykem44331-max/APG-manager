// APG Manager RMS - Dashboard (trang chủ sau khi đăng nhập)
'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Plane, DollarSign, TrendingUp, Clock,
  AlertTriangle, Plus, Search, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { KpiCard } from '@/components/charts/kpi-card';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { AirlineChart } from '@/components/charts/airline-chart';
import { cn, formatVND, formatDateTime, BOOKING_STATUS_LABELS, BOOKING_STATUS_CLASSES } from '@/lib/utils';
import { dashboardApi, bookingsApi, financeApi } from '@/lib/api';

// Dữ liệu mẫu khi chưa có API
const SAMPLE_REVENUE_DATA = [
  { date: 'T2', revenue: 42_000_000, profit: 4_200_000 },
  { date: 'T3', revenue: 38_000_000, profit: 3_800_000 },
  { date: 'T4', revenue: 55_000_000, profit: 5_500_000 },
  { date: 'T5', revenue: 47_000_000, profit: 4_700_000 },
  { date: 'T6', revenue: 63_000_000, profit: 6_300_000 },
  { date: 'T7', revenue: 71_000_000, profit: 7_100_000 },
  { date: 'CN', revenue: 45_000_000, profit: 4_500_000 },
];

const SAMPLE_AIRLINE_DATA = [
  { airline: 'VN', value: 142, percent: 40 },
  { airline: 'VJ', value: 98,  percent: 28 },
  { airline: 'QH', value: 71,  percent: 20 },
  { airline: 'BL', value: 35,  percent: 10 },
  { airline: 'VU', value: 7,   percent: 2  },
];

export default function DashboardPage() {
  // Fetch booking gần nhất
  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ['dashboard-bookings'],
    queryFn: () => bookingsApi.list({ pageSize: 5, sortBy: 'createdAt', order: 'desc' }),
    select: (res) => res.data,
  });

  // Fetch deposit cảnh báo
  const { data: depositsData } = useQuery({
    queryKey: ['deposits'],
    queryFn: () => financeApi.getDeposits(),
    select: (res) => res.data,
  });

  const recentBookings = bookingsData?.data ?? [];
  const lowDeposits = (depositsData ?? []).filter(
    (d: { balance: number; alertThreshold: number }) => d.balance < d.alertThreshold
  );

  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Tổng quan hoạt động hôm nay
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString('vi-VN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>
      </div>

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Vé xuất hôm nay"
          value="23"
          change={15}
          icon={Plane}
          iconColor="text-blue-500"
        />
        <KpiCard
          label="Doanh thu ngày"
          value="45.2M"
          change={8}
          icon={DollarSign}
          iconColor="text-emerald-500"
        />
        <KpiCard
          label="Lợi nhuận ngày"
          value="4.8M"
          change={12}
          icon={TrendingUp}
          iconColor="text-purple-500"
        />
        <KpiCard
          label="Booking chờ xử lý"
          value="7"
          icon={Clock}
          iconColor="text-orange-500"
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <RevenueChart data={SAMPLE_REVENUE_DATA} />
        </div>
        <div>
          <AirlineChart data={SAMPLE_AIRLINE_DATA} />
        </div>
      </div>

      {/* Row 3: Recent bookings + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Booking gần nhất */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Booking gần nhất
            </h3>
            <Link
              href="/bookings"
              className="text-xs text-primary hover:underline"
            >
              Xem tất cả →
            </Link>
          </div>

          <div className="divide-y divide-border">
            {bookingsLoading ? (
              // Skeleton loading
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3 animate-pulse">
                  <div className="w-24 h-3 bg-muted rounded" />
                  <div className="flex-1 h-3 bg-muted rounded" />
                  <div className="w-16 h-3 bg-muted rounded" />
                  <div className="w-16 h-5 bg-muted rounded-full" />
                </div>
              ))
            ) : recentBookings.length === 0 ? (
              // Dữ liệu mẫu hiển thị khi chưa có API
              SAMPLE_BOOKINGS.map((booking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))
            ) : (
              recentBookings.map((booking: SampleBooking) => (
                <BookingRow key={booking.id} booking={booking} />
              ))
            )}
          </div>
        </div>

        {/* Panel cảnh báo */}
        <div className="card">
          <div className="px-5 py-3.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              ⚠️ Cảnh báo
            </h3>
          </div>
          <div className="p-4 space-y-2.5">
            {/* Deposit thấp */}
            {lowDeposits.length === 0 ? (
              <AlertItem
                type="warning"
                text="Deposit VJ còn 2.1M - sắp hết"
                time="Vừa cập nhật"
              />
            ) : (
              lowDeposits.map((d: { airline: string; balance: number }) => (
                <AlertItem
                  key={d.airline}
                  type="warning"
                  text={`Deposit ${d.airline} còn ${formatVND(d.balance)}`}
                  time="Realtime"
                />
              ))
            )}

            <AlertItem
              type="error"
              text="3 khách doanh nghiệp quá hạn thanh toán"
              time="2 giờ trước"
            />
            <AlertItem
              type="info"
              text="Vé APG-260321-012 chưa được xuất"
              time="45 phút trước"
            />
            <AlertItem
              type="info"
              text="2 khách sinh nhật tuần này"
              time="Định kỳ"
            />
          </div>
        </div>
      </div>

      {/* Row 4: Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/bookings/new"
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
            'bg-primary text-white hover:bg-primary/90',
            'transition-all duration-150 active:scale-95',
          )}
        >
          <Plus className="w-4 h-4" />
          Tạo Booking mới
        </Link>

        <Link
          href="/flights"
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
            'bg-card border border-border text-foreground',
            'hover:bg-accent transition-all duration-150 active:scale-95',
          )}
        >
          <Search className="w-4 h-4" />
          Tra cứu giá vé
        </Link>

        <button
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium',
            'bg-card border border-border text-foreground',
            'hover:bg-accent transition-all duration-150 active:scale-95',
          )}
        >
          <RefreshCw className="w-4 h-4" />
          Đối soát hôm nay
        </button>
      </div>
    </div>
  );
}

// Kiểu dữ liệu booking mẫu
interface SampleBooking {
  id: string;
  bookingCode: string;
  contactName: string;
  route: string;
  totalSellPrice: number;
  profit: number;
  status: string;
  createdAt: string;
}

// Component row booking
function BookingRow({ booking }: { booking: SampleBooking }) {
  return (
    <Link
      href={`/bookings/${booking.id}`}
      className="flex items-center gap-3 px-5 py-3 hover:bg-accent/50 transition-colors"
    >
      <div className="w-24 flex-shrink-0">
        <p className="text-xs font-mono font-medium text-primary">
          {booking.bookingCode}
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{booking.contactName}</p>
        <p className="text-xs text-muted-foreground">{booking.route}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-medium text-foreground">
          {formatVND(booking.totalSellPrice)}
        </p>
        <p className="text-xs text-emerald-500">
          +{formatVND(booking.profit)}
        </p>
      </div>
      <div className="flex-shrink-0">
        <span className={cn(
          'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium',
          BOOKING_STATUS_CLASSES[booking.status] ?? 'status-new',
        )}>
          {BOOKING_STATUS_LABELS[booking.status] ?? booking.status}
        </span>
      </div>
    </Link>
  );
}

// Component alert item
function AlertItem({
  type,
  text,
  time,
}: {
  type: 'warning' | 'error' | 'info';
  text: string;
  time: string;
}) {
  const styles = {
    warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-600 dark:text-yellow-400',
    error:   'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400',
    info:    'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400',
  };

  return (
    <div className={cn('px-3 py-2.5 rounded-lg border text-xs', styles[type])}>
      <p className="font-medium leading-snug">{text}</p>
      <p className="opacity-60 mt-0.5">{time}</p>
    </div>
  );
}

// Dữ liệu mẫu khi chưa có backend
const SAMPLE_BOOKINGS: SampleBooking[] = [
  {
    id: '1',
    bookingCode: 'APG-260321-023',
    contactName: 'Nguyễn Văn Minh',
    route: 'HAN → SGN · VN123',
    totalSellPrice: 2_850_000,
    profit: 285_000,
    status: 'ISSUED',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    bookingCode: 'APG-260321-022',
    contactName: 'Trần Thị Hoa',
    route: 'SGN → DAD · VJ456',
    totalSellPrice: 1_450_000,
    profit: 145_000,
    status: 'PENDING_PAYMENT',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    bookingCode: 'APG-260321-021',
    contactName: 'Lê Quốc Hùng (3 khách)',
    route: 'HAN → PQC · QH789',
    totalSellPrice: 5_700_000,
    profit: 570_000,
    status: 'PROCESSING',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    bookingCode: 'APG-260321-020',
    contactName: 'Phạm Thu Thủy',
    route: 'DAD → HAN · VN321',
    totalSellPrice: 1_850_000,
    profit: 185_000,
    status: 'NEW',
    createdAt: new Date().toISOString(),
  },
];
