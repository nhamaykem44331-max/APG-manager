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
import { PageHeader } from '@/components/ui/page-header';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { cn, formatVND, BOOKING_STATUS_LABELS, BOOKING_STATUS_CLASSES } from '@/lib/utils';
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

  const recentBookings = bookingsData?.data ?? SAMPLE_BOOKINGS;
  const lowDeposits = (depositsData ?? []).filter(
    (d: { balance: number; alertThreshold: number }) => d.balance < d.alertThreshold
  );

  const columns: ColumnDef<SampleBooking>[] = [
    {
      header: 'Mã vé',
      accessorKey: 'pnr',
      cell: (b) => b.pnr
        ? <span className="font-mono font-bold text-foreground tracking-widest text-[13px]">{b.pnr}</span>
        : <span className="text-muted-foreground text-[11px] italic">Chưa có PNR</span>,
    },
    {
      header: 'Khách hàng',
      accessorKey: 'contactName',
      cell: (b) => <span className="font-medium text-foreground truncate max-w-[150px] inline-block align-bottom">{b.contactName}</span>,
    },
    {
      header: 'Tuyến',
      accessorKey: 'route',
      cell: (b) => <span className="text-muted-foreground">{b.route}</span>,
    },
    {
      header: 'Giá trị',
      accessorKey: 'totalSellPrice',
      cell: (b) => <span className="font-tabular font-medium">{formatVND(b.totalSellPrice)}</span>,
    },
    {
      header: 'Trạng thái',
      accessorKey: 'status',
      cell: (b) => (
        <span className={cn('inline-flex items-center', BOOKING_STATUS_CLASSES[b.status] ?? 'badge-default')}>
          {BOOKING_STATUS_LABELS[b.status] ?? b.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 max-w-[1400px]">
      <PageHeader
        title="Dashboard"
        description="Tổng quan hoạt động hôm nay"
        actions={
          <span className="text-[13px] text-muted-foreground px-3 py-1.5 rounded-md border border-border bg-card">
            {new Date().toLocaleDateString('vi-VN', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </span>
        }
      />

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Vé xuất hôm nay"
          value="23"
          change={15}
        />
        <KpiCard
          label="Doanh thu ngày"
          value="45.2M"
          change={8}
        />
        <KpiCard
          label="Lợi nhuận ngày"
          value="4.8M"
          change={12}
        />
        <KpiCard
          label="Booking chờ xử lý"
          value="7"
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
        <div className="lg:col-span-2 flex flex-col gap-3">
          <h3 className="text-[14px] font-medium text-foreground">Recent Bookings</h3>
          <DataTable
            columns={columns as any}
            data={recentBookings}
            isLoading={bookingsLoading}
            emptyMessage="Không có booking nào gần đây."
          />
        </div>

        {/* Panel cảnh báo */}
        <div className="card flex flex-col">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-[13px] font-medium text-foreground">Cảnh báo hệ thống</h3>
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
      <div className="flex flex-wrap gap-2">
        <Link
          href="/bookings/new"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium',
            'bg-foreground text-background hover:opacity-90',
            'transition-all duration-150 active:scale-[0.98] border border-transparent',
          )}
        >
          <Plus className="w-4 h-4" />
          Tạo Booking mới
        </Link>

        <Link
          href="https://book.tanphuapg.com"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium',
            'bg-card border border-border text-foreground',
            'hover:bg-accent transition-all duration-150 active:scale-[0.98]',
          )}
        >
          <Search className="w-4 h-4 text-muted-foreground" />
          Tra cứu giá vé
        </Link>

        <button
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium',
            'bg-card border border-border text-foreground',
            'hover:bg-accent transition-all duration-150 active:scale-[0.98]',
          )}
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
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
  pnr?: string;
  contactName: string;
  route: string;
  totalSellPrice: number;
  profit: number;
  status: string;
  createdAt: string;
}

function AlertItem({
  type,
  text,
  time,
}: {
  type: 'warning' | 'error' | 'info';
  text: string;
  time: string;
}) {
  const isError = type === 'error';
  const isWarning = type === 'warning';
  
  return (
    <div className={cn(
      'px-3 py-2.5 rounded-md border text-[13px] flex items-center justify-between gap-3',
      isError ? 'bg-destructive/10 border-destructive/20 text-destructive' :
      isWarning ? 'bg-warning/10 border-warning/20 text-warning' :
      'bg-accent border-border text-foreground'
    )}>
      <p className="font-medium leading-snug truncate">{text}</p>
      <p className="opacity-60 text-[11px] whitespace-nowrap flex-shrink-0">{time}</p>
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
