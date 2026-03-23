'use client';

import { useQuery } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { formatVND, cn, AIRLINE_COLORS, AIRLINE_NAMES } from '@/lib/utils';
import { DateRange } from '@/app/(authenticated)/reports/page';

export function AirlineTab({ dateRange, exportToCSV }: { dateRange: DateRange, exportToCSV: any }) {
  const { data: airlineData, isLoading } = useQuery({
    queryKey: ['reports', 'airline-breakdown', dateRange.from, dateRange.to],
    queryFn: () => reportsApi.getAirlineBreakdown(dateRange.from, dateRange.to),
    select: (res) => res.data
  });

  const handleExport = () => {
    if (airlineData && airlineData.length > 0) {
      exportToCSV(airlineData, 'HangBay_MarketShare');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Thị phần Hãng hàng không</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-foreground hover:bg-accent/80 rounded-md transition-colors border border-border"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất dữ liệu Hãng
        </button>
      </div>

      {isLoading ? (
        <div className="h-40 rounded-lg bg-accent/30 animate-pulse border border-border" />
      ) : (
        <>
          {/* Market Share Stacked Bar */}
          <div className="card p-5">
            <h3 className="text-[13px] font-semibold text-foreground mb-4">Phân bổ Doanh thu</h3>
            <div className="w-full h-4 rounded-full overflow-hidden flex shadow-inner border border-border">
              {(airlineData || []).map((row: any) => (
                <div
                  key={row.airline}
                  className="h-full group relative cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ width: `${row.percentage}%`, backgroundColor: AIRLINE_COLORS[row.airline] || '#6b7280' }}
                >
                  <div className="absolute opacity-0 group-hover:opacity-100 bg-foreground text-background text-[10px] px-2 py-1 rounded bottom-full mb-1 left-1/2 -translate-x-1/2 whitespace-nowrap z-10 pointer-events-none transition-opacity font-medium shadow-md">
                    {AIRLINE_NAMES[row.airline] || row.airline}: {row.percentage.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex flex-wrap gap-4 mt-4 justify-center">
              {(airlineData || []).map((row: any) => (
                <div key={row.airline} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: AIRLINE_COLORS[row.airline] || '#6b7280' }} />
                  <span className="text-[11px] font-medium">{AIRLINE_NAMES[row.airline] || row.airline}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted-foreground bg-accent/10">
                    <th className="px-5 py-3 font-medium">Hãng hàng không</th>
                    <th className="px-5 py-3 font-medium text-center">Số lượng vé</th>
                    <th className="px-5 py-3 font-medium text-right">Doanh thu</th>
                    <th className="px-5 py-3 font-medium text-right">Chi phí Net</th>
                    <th className="px-5 py-3 font-medium text-right">Lợi nhuận</th>
                    <th className="px-5 py-3 font-medium text-center">Margin %</th>
                    <th className="px-5 py-3 font-medium text-center">Thị phần</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[13px]">
                  {(airlineData || []).map((row: any, i: number) => (
                    <tr key={row.airline} className="hover:bg-accent/20 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-transparent",
                            i === 0 ? 'ring-primary/30' : ''
                          )} style={{ backgroundColor: AIRLINE_COLORS[row.airline] || '#6b7280' }}>
                            {row.airline}
                          </span>
                          <div>
                            <p className="font-semibold">{AIRLINE_NAMES[row.airline] || row.airline}</p>
                            {i === 0 && <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium tracking-wide">TOP 1</span>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-center font-tabular font-medium">{row.ticketCount}</td>
                      <td className="px-5 py-3 text-right font-tabular text-foreground">{formatVND(row.revenue)}</td>
                      <td className="px-5 py-3 text-right font-tabular text-muted-foreground">{formatVND(row.cost)}</td>
                      <td className="px-5 py-3 text-right font-tabular font-semibold text-emerald-500">{formatVND(row.profit)}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={cn(
                          "px-2 py-0.5 rounded-md text-[11px] font-medium border",
                          row.profitMargin >= 10 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200/50' : 'bg-destructive/10 text-destructive border-destructive/20'
                        )}>{row.profitMargin.toFixed(1)}%</span>
                      </td>
                      <td className="px-5 py-3 text-center font-tabular font-semibold">
                        {row.percentage.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                  {(!airlineData || airlineData.length === 0) && (
                    <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Không có dữ liệu trong thời gian này</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
