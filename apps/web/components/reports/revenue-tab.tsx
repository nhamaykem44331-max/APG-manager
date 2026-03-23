'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { formatVND, formatNumber, cn } from '@/lib/utils';
import { DateRange } from '@/app/(authenticated)/reports/page';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

export function RevenueTab({ dateRange, exportToCSV }: { dateRange: DateRange, exportToCSV: any }) {
  const { data: routeData, isLoading: rLoading } = useQuery({
    queryKey: ['reports', 'route-analysis', dateRange.from, dateRange.to],
    queryFn: () => reportsApi.getRouteAnalysis(dateRange.from, dateRange.to, 15),
    select: (res) => res.data
  });

  const { data: monthData, isLoading: mLoading } = useQuery({
    queryKey: ['reports', 'monthly-summary', 12],
    queryFn: () => reportsApi.getMonthlySummary(12),
    select: (res) => res.data
  });

  const handleExport = () => {
    if (monthData && monthData.length > 0) {
      exportToCSV(monthData, 'DoanhThu_12Thang_Truoc');
    }
  };

  const calcTotals = () => {
    if (!monthData) return { revenue: 0, cost: 0, profit: 0, bookings: 0, tickets: 0 };
    return monthData.reduce((acc: any, row: any) => ({
      revenue: acc.revenue + row.revenue,
      cost: acc.cost + row.cost,
      profit: acc.profit + row.profit,
      bookings: acc.bookings + row.bookingCount,
      tickets: acc.tickets + row.ticketCount
    }), { revenue: 0, cost: 0, profit: 0, bookings: 0, tickets: 0 });
  };
  const totals = calcTotals();

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Phân tích chuyên sâu về Doanh thu</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-foreground hover:bg-accent/80 rounded-md transition-colors border border-border"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất dữ liệu 12 Tháng
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bảng tháng */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border bg-accent/20">
            <h3 className="text-[13px] font-semibold">Biến động 12 tháng gần nhất</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[11px] text-muted-foreground bg-accent/10">
                  <th className="px-4 py-2 font-medium">Tháng</th>
                  <th className="px-4 py-2 font-medium text-right">Doanh thu</th>
                  <th className="px-4 py-2 font-medium text-right">Chi phí</th>
                  <th className="px-4 py-2 font-medium text-right">Lợi nhuận</th>
                  <th className="px-4 py-2 font-medium text-center">Margin</th>
                  <th className="px-4 py-2 font-medium text-center">Booking</th>
                  <th className="px-4 py-2 font-medium text-center">Vé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[13px]">
                {mLoading ? (
                  <tr><td colSpan={7} className="text-center py-4 text-muted-foreground">Đang tải...</td></tr>
                ) : (monthData || []).map((row: any) => (
                  <tr key={row.month} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2.5 font-medium">{row.month}</td>
                    <td className="px-4 py-2.5 text-right font-tabular">{formatVND(row.revenue)}</td>
                    <td className="px-4 py-2.5 text-right font-tabular text-muted-foreground">{formatVND(row.cost)}</td>
                    <td className="px-4 py-2.5 text-right font-tabular text-emerald-500">{formatVND(row.profit)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-medium",
                        row.profitMargin >= 15 ? 'bg-emerald-500/10 text-emerald-500' :
                        row.profitMargin >= 10 ? 'bg-warning/10 text-warning' :
                        'bg-destructive/10 text-destructive'
                      )}>{row.profitMargin.toFixed(1)}%</span>
                    </td>
                    <td className="px-4 py-2.5 text-center">{row.bookingCount}</td>
                    <td className="px-4 py-2.5 text-center">{row.ticketCount}</td>
                  </tr>
                ))}
                {!mLoading && monthData && monthData.length > 0 && (
                  <tr className="bg-accent/30 font-semibold border-t-2 border-border">
                    <td className="px-4 py-3">TỔNG</td>
                    <td className="px-4 py-3 text-right">{formatVND(totals.revenue)}</td>
                    <td className="px-4 py-3 text-right">{formatVND(totals.cost)}</td>
                    <td className="px-4 py-3 text-right text-emerald-500">{formatVND(totals.profit)}</td>
                    <td className="px-4 py-3 text-center">-</td>
                    <td className="px-4 py-3 text-center">{totals.bookings}</td>
                    <td className="px-4 py-3 text-center">{totals.tickets}</td>
                  </tr>
                )}
                {!mLoading && (!monthData || monthData.length === 0) && (
                  <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Không có dữ liệu trong khoảng thời gian này</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Biểu đồ tháng */}
        <div className="card p-5 h-full min-h-[400px]">
          <h3 className="text-[13px] font-semibold mb-4 text-foreground">Biểu đồ Lợi nhuận vs Chi phí</h3>
          {mLoading ? (
             <div className="h-[350px] w-full flex items-center justify-center border border-border rounded-md bg-accent/20 animate-pulse">
               <p className="text-sm text-muted-foreground">Đang tải biểu đồ...</p>
             </div>
          ) : !monthData || monthData.length === 0 ? (
             <div className="h-[350px] w-full flex items-center justify-center border border-dashed border-border rounded-md bg-accent/10">
               <p className="text-sm text-muted-foreground">Chưa có dữ liệu để vẽ biểu đồ</p>
             </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={monthData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(val) => formatNumber(val)} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={65} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(val: number) => formatVND(val)}
                  cursor={{ fill: 'hsl(var(--accent))', opacity: 0.4 }}
                />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="cost" stackId="a" name="Chi phí" fill="#64748b" maxBarSize={40} radius={[0, 0, 4, 4]} />
                <Bar dataKey="profit" stackId="a" name="Lợi nhuận" fill="#10b981" maxBarSize={40} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-border bg-accent/20 flex items-center justify-between">
          <h3 className="text-[13px] font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Top tuyến bay mang lại doanh thu
          </h3>
          <p className="text-[11px] text-muted-foreground text-right mt-1">Lọc theo khoảng thời gian trên</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-[11px] text-muted-foreground bg-accent/10">
                <th className="px-4 py-2 font-medium">Tuyến bay</th>
                <th className="px-4 py-2 font-medium text-center">Số vé</th>
                <th className="px-4 py-2 font-medium text-right">Doanh thu</th>
                <th className="px-4 py-2 font-medium text-right">Lợi nhuận</th>
                <th className="px-4 py-2 font-medium text-right">Giá TB/Vé</th>
                <th className="px-4 py-2 font-medium text-center">Hãng phổ biến</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-[13px]">
              {rLoading ? (
                <tr><td colSpan={6} className="text-center py-4 text-muted-foreground">Đang tải...</td></tr>
              ) : (routeData || []).map((row: any) => (
                <tr key={row.route} className="hover:bg-accent/20 transition-colors">
                  <td className="px-4 py-2.5 font-medium">{row.departureCode} → {row.arrivalCode}</td>
                  <td className="px-4 py-2.5 text-center">{row.ticketCount}</td>
                  <td className="px-4 py-2.5 text-right font-tabular">{formatVND(row.revenue)}</td>
                  <td className="px-4 py-2.5 text-right font-tabular text-emerald-500">{formatVND(row.profit)}</td>
                  <td className="px-4 py-2.5 text-right font-tabular text-muted-foreground">{formatVND(row.avgPrice)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-semibold">
                      {row.topAirline}
                    </span>
                  </td>
                </tr>
              ))}
              {!rLoading && (!routeData || routeData.length === 0) && (
                <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Không có dữ liệu tuyến bay nào</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
