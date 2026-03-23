'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Award, Target, Hash } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { formatVND, cn } from '@/lib/utils';
import { DateRange } from '@/app/(authenticated)/reports/page';

export function StaffTab({ dateRange, exportToCSV }: { dateRange: DateRange, exportToCSV: any }) {
  const { data: staffData, isLoading } = useQuery({
    queryKey: ['reports', 'staff-performance', dateRange.from, dateRange.to],
    queryFn: () => reportsApi.getStaffPerformance(dateRange.from, dateRange.to),
    select: (res) => res.data
  });

  const handleExport = () => {
    if (staffData && staffData.length > 0) {
      exportToCSV(staffData, 'NhanVien_Performance');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Hiệu suất và KPI của Nhân viên bán hàng</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-foreground hover:bg-accent/80 rounded-md transition-colors border border-border"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất dữ liệu NV
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 rounded-xl bg-accent/30 animate-pulse border border-border" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(staffData || []).slice(0, 3).map((staff: any, index: number) => (
              <div key={staff.staffId} className="card p-5 relative overflow-hidden group">
                <div className={cn(
                  "absolute top-0 right-0 w-12 h-12 flex flex-col items-center justify-center text-white rounded-bl-[20px] shadow-sm transform translate-x-2 -translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform",
                  index === 0 ? "bg-amber-400" : index === 1 ? "bg-slate-300" : "bg-orange-400"
                )}>
                  <span className="text-sm font-black translate-y-1 -translate-x-1">#{index + 1}</span>
                </div>
                
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/60 flex flex-shrink-0 items-center justify-center shadow-inner">
                    <span className="text-lg font-bold text-white">{staff.staffName.charAt(0)}</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-[14px] leading-tight flex items-center gap-1.5">
                      {staff.staffName}
                      {index === 0 && <Award className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{staff.role}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-accent/30 rounded-lg p-2.5 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Doanh thu</p>
                    <p className="text-[13px] font-bold text-foreground mt-0.5">{formatVND(staff.revenue)}</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-2.5 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Lợi nhuận</p>
                    <p className="text-[13px] font-bold text-emerald-500 mt-0.5">{formatVND(staff.profit)}</p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-2.5 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Tỷ lệ chốt</p>
                    <p className="text-[13px] font-bold text-foreground mt-0.5 flex items-center gap-1">
                      <Target className="w-3 h-3 text-muted-foreground" />
                      {staff.conversionRate.toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-accent/30 rounded-lg p-2.5 border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Tuyến nổi bật</p>
                    <p className="text-[13px] font-bold text-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">{staff.topRoute}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted-foreground bg-accent/10">
                    <th className="px-4 py-3 font-medium w-10 text-center"><Hash className="w-3 h-3 inline" /></th>
                    <th className="px-4 py-3 font-medium">Nhân sự</th>
                    <th className="px-4 py-3 font-medium text-center">Bookings</th>
                    <th className="px-4 py-3 font-medium text-center">Vé xuất</th>
                    <th className="px-4 py-3 font-medium text-right">Doanh thu</th>
                    <th className="px-4 py-3 font-medium text-right">Lợi nhuận</th>
                    <th className="px-4 py-3 font-medium text-center">Tỷ lệ chốt %</th>
                    <th className="px-4 py-3 font-medium text-center">Giá vé TB</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[13px]">
                  {(staffData || []).map((row: any, i: number) => (
                    <tr key={row.staffId} className="hover:bg-accent/20 transition-colors">
                      <td className="px-4 py-2.5 text-center font-bold text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-semibold text-foreground flex items-center gap-1.5">
                          {row.staffName}
                          {i === 0 && <Award className="w-3 h-3 text-amber-500 fill-amber-500" />}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{row.role}</p>
                      </td>
                      <td className="px-4 py-2.5 text-center font-tabular font-medium">{row.bookingCount}</td>
                      <td className="px-4 py-2.5 text-center font-tabular text-muted-foreground">{row.ticketCount}</td>
                      <td className="px-4 py-2.5 text-right font-tabular font-medium">{formatVND(row.revenue)}</td>
                      <td className="px-4 py-2.5 text-right font-tabular font-semibold text-emerald-500 border-l border-border/50 bg-emerald-500/[0.02]">
                        {formatVND(row.profit)}
                      </td>
                      <td className="px-4 py-2.5 text-center font-tabular">
                        <div className="flex flex-col items-center">
                          <span className={cn(
                            "font-semibold text-[12px]",
                            row.conversionRate > 80 ? 'text-primary' : row.conversionRate < 40 ? 'text-destructive' : ''
                          )}>{row.conversionRate.toFixed(1)}%</span>
                          <div className="w-12 h-1 bg-muted rounded-full mt-1 overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(row.conversionRate, 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-center font-tabular text-muted-foreground">
                        {Math.round(row.avgBookingValue / 1000)}k
                      </td>
                    </tr>
                  ))}
                  {(!staffData || staffData.length === 0) && (
                    <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Chưa có giao dịch của nhân viên nào</td></tr>
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
