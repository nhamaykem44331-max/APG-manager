'use client';

import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { formatVND, cn } from '@/lib/utils';
import { DateRange } from '@/app/(authenticated)/reports/page';
import { StatCard } from '@/components/ui/stat-card';
import { RevenueChart } from '@/components/charts/revenue-chart';

export function OverviewTab({ dateRange, exportToCSV }: { dateRange: DateRange, exportToCSV: any }) {
  // Fetch monthly summary for basic KPI cards
  const { data: monthData, isLoading: mLoading } = useQuery({
    queryKey: ['reports', 'monthly-summary', 6],
    queryFn: () => reportsApi.getMonthlySummary(6),
    select: (res) => res.data
  });

  // Fetch dynamic revenue chart based on days from latest dateRange
  const calculateDaysFromRange = () => {
    if (!dateRange.from || !dateRange.to) return 7;
    const from = new Date(dateRange.from).getTime();
    const to = new Date(dateRange.to).getTime();
    const days = Math.round((to - from) / (1000 * 3600 * 24)) + 1;
    return days > 0 ? days : 7;
  };
  const days = calculateDaysFromRange();

  const { data: chartData, isLoading: cLoading } = useQuery({
    queryKey: ['reports', 'revenue-chart', days],
    queryFn: () => reportsApi.getRevenueChart(days),
    select: (res) => res.data
  });

  // KPI logic
  const currentMonthData = monthData?.[monthData.length - 1] || null;
  const previousMonthData = monthData?.[monthData.length - 2] || null;

  const calcChange = (curr: number, prev: number) => 
    prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100);

  const revChange = currentMonthData && previousMonthData ? calcChange(currentMonthData.revenue, previousMonthData.revenue) : 0;
  const profitChange = currentMonthData && previousMonthData ? calcChange(currentMonthData.profit, previousMonthData.profit) : 0;
  const tktChange = currentMonthData && previousMonthData ? calcChange(currentMonthData.ticketCount, previousMonthData.ticketCount) : 0;

  const revBadge = (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium font-tabular", revChange >= 0 ? "text-emerald-500 bg-emerald-500/10" : "text-destructive bg-destructive/10")}>
      {revChange > 0 ? '+' : ''}{revChange}%
    </span>
  );
  
  const profitBadge = (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium font-tabular", profitChange >= 0 ? "text-emerald-500 bg-emerald-500/10" : "text-destructive bg-destructive/10")}>
      {profitChange > 0 ? '+' : ''}{profitChange}%
    </span>
  );

  const tktBadge = (
    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium font-tabular", tktChange >= 0 ? "text-emerald-500 bg-emerald-500/10" : "text-destructive bg-destructive/10")}>
      {tktChange > 0 ? '+' : ''}{tktChange}%
    </span>
  );

  const handleExport = () => {
    if (chartData && chartData.length > 0) {
      exportToCSV(chartData, 'Overview_Revenue');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Tổng quan hiệu quả kinh doanh</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-foreground hover:bg-accent/80 rounded-md transition-colors border border-border"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất dữ liệu
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={
            <div className="flex flex-col gap-0.5">
              <span>Doanh thu kỳ</span>
              <span className="text-[10px] text-muted-foreground opacity-80">So với tháng trước</span>
            </div>
          }
          value={mLoading ? '...' : formatVND(currentMonthData?.revenue || 0)}
          badge={currentMonthData && previousMonthData ? revBadge : undefined}
        />
        <StatCard
          label={
            <div className="flex flex-col gap-0.5">
              <span>Lợi nhuận</span>
              <span className="text-[10px] text-muted-foreground opacity-80">Margin hiện tại: {(currentMonthData?.profitMargin || 0).toFixed(1)}%</span>
            </div>
          }
          value={mLoading ? '...' : formatVND(currentMonthData?.profit || 0)}
          badge={currentMonthData && previousMonthData ? profitBadge : undefined}
        />
        <StatCard
          label={
            <div className="flex flex-col gap-0.5">
              <span>Tổng hợp Booking</span>
              <span className="text-[10px] text-muted-foreground opacity-80">Booking thành công</span>
            </div>
          }
          value={mLoading ? '...' : String(currentMonthData?.bookingCount || 0)}
        />
        <StatCard
          label={
            <div className="flex flex-col gap-0.5">
              <span>Số vé kích hoạt</span>
              <span className="text-[10px] text-muted-foreground opacity-80">Tổng vé xuất</span>
            </div>
          }
          value={mLoading ? '...' : String(currentMonthData?.ticketCount || 0)}
          badge={currentMonthData && previousMonthData ? tktBadge : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-4">
        {cLoading ? (
          <div className="h-[260px] rounded-lg bg-accent/30 animate-pulse border border-border" />
        ) : (
          <RevenueChart data={chartData || []} />
        )}
      </div>
    </div>
  );
}
