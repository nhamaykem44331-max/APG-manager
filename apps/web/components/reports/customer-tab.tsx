'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, Crown, Briefcase, User } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { formatVND, cn } from '@/lib/utils';
import { DateRange } from '@/app/(authenticated)/reports/page';

export function CustomerTab({ dateRange, exportToCSV }: { dateRange: DateRange, exportToCSV: any }) {
  const { data: customerData, isLoading } = useQuery({
    queryKey: ['reports', 'customer-ranking', dateRange.from, dateRange.to],
    queryFn: () => reportsApi.getCustomerRanking(dateRange.from, dateRange.to, 50),
    select: (res) => res.data
  });

  const { data: sourceData, isLoading: sLoading } = useQuery({
    queryKey: ['reports', 'source-analysis', dateRange.from, dateRange.to],
    queryFn: () => reportsApi.getSourceAnalysis(dateRange.from, dateRange.to),
    select: (res) => res.data
  });

  const handleExport = () => {
    if (customerData && customerData.length > 0) {
      exportToCSV(customerData, 'DanhSach_KhachHang_VIP');
    }
  };

  const getTierColor = (tier: string) => {
    switch(tier) {
      case 'PLATINUM': return 'bg-slate-800 text-slate-100 border-slate-700';
      case 'GOLD': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'SILVER': return 'bg-zinc-100 text-zinc-700 border-zinc-200';
      default: return 'bg-accent/50 text-foreground border-border';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Phân tích chuyên sâu về Khách hàng</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-foreground hover:bg-accent/80 rounded-md transition-colors border border-border"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất dữ liệu KH
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
        {/* Nguồn khách */}
        <div className="card p-5 h-full">
          <h3 className="text-[13px] font-semibold text-foreground mb-4">Hiệu quả Nguồn Truy Cập</h3>
          {sLoading ? (
            <div className="h-40 bg-accent/30 animate-pulse rounded-md" />
          ) : (
            <div className="space-y-4">
              {(sourceData || []).map((source: any) => (
                <div key={source.source} className="bg-accent/20 border border-border rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[12px] font-semibold px-2 py-0.5 bg-background rounded-md border border-border shadow-sm">
                      {source.source}
                    </span>
                    <span className="text-[12px] font-bold text-foreground">{formatVND(source.revenue)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Bookings</p>
                      <p className="text-[12px] font-medium">{source.bookingCount}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Tỷ lệ chốt</p>
                      <p className="text-[12px] font-medium text-primary">{source.conversionRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Giá TB</p>
                      <p className="text-[12px] font-medium">{Math.round(source.avgValue / 1000)}k</p>
                    </div>
                  </div>
                </div>
              ))}
              {(!sourceData || sourceData.length === 0) && (
                <p className="text-[12px] text-muted-foreground text-center py-4">Chưa có nguồn khách hàng nào</p>
              )}
            </div>
          )}
        </div>

        {/* Khách hàng VIP */}
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-border bg-accent/20">
            <h3 className="text-[13px] font-semibold flex items-center gap-2">
              <Crown className="w-4 h-4 text-amber-500" />
              Bảng Vàng Khách Hàng (Top 50)
            </h3>
          </div>
          <div className="overflow-x-auto h-[400px] overflow-y-auto no-scrollbar relative">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-background/95 backdrop-blur z-10 shadow-sm">
                <tr className="border-b border-border text-[11px] text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Khách hàng / Doanh nghiệp</th>
                  <th className="px-4 py-3 font-medium text-center">Hạng thẻ</th>
                  <th className="px-4 py-3 font-medium text-center">Bookings</th>
                  <th className="px-4 py-3 font-medium text-center">Vé mua</th>
                  <th className="px-4 py-3 font-medium text-right">Tổng chi tiêu</th>
                  <th className="px-4 py-3 font-medium text-right">Lợi nhuận</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-[13px]">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Đang tải...</td></tr>
                ) : (customerData || []).map((row: any) => (
                  <tr key={row.customerId} className="hover:bg-accent/20 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-accent/50 flex items-center justify-center flex-shrink-0">
                          {row.customerType === 'CORPORATE' ? (
                            <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                          ) : (
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <p className="font-semibold">{row.customerName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-bold border shadow-sm",
                        getTierColor(row.vipTier)
                      )}>
                        {row.vipTier}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center font-tabular font-medium">{row.bookingCount}</td>
                    <td className="px-4 py-2.5 text-center font-tabular text-muted-foreground">{row.ticketCount}</td>
                    <td className="px-4 py-2.5 text-right font-tabular text-foreground font-semibold">{formatVND(row.totalSpent)}</td>
                    <td className="px-4 py-2.5 text-right font-tabular text-emerald-500 font-semibold">{formatVND(row.profit)}</td>
                  </tr>
                ))}
                {!isLoading && (!customerData || customerData.length === 0) && (
                  <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Không có dữ liệu chi tiêu</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
