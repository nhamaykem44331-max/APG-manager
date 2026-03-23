'use client';

import { useQuery } from '@tanstack/react-query';
import { Download, AlertCircle, CheckCircle2, Copy } from 'lucide-react';
import { reportsApi } from '@/lib/api';
import { formatVND, cn } from '@/lib/utils';
import { DateRange } from '@/app/(authenticated)/reports/page';

export function PaymentTab({ dateRange, exportToCSV }: { dateRange: DateRange, exportToCSV: any }) {
  const { data: payData, isLoading } = useQuery({
    queryKey: ['reports', 'payment-analysis', dateRange.from, dateRange.to],
    queryFn: () => reportsApi.getPaymentAnalysis(dateRange.from, dateRange.to),
    select: (res) => res.data
  });

  const handleExport = () => {
    if (payData && payData.methods) {
      exportToCSV(payData.methods, 'ThanhToan_PhuongThuc');
    }
  };

  const methodsData = payData?.methods || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Phân tích Thu hồi Công Nợ & Thanh Toán</h2>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent text-foreground hover:bg-accent/80 rounded-md transition-colors border border-border"
        >
          <Download className="w-3.5 h-3.5" />
          Xuất dữ liệu 
        </button>
      </div>

      {isLoading ? (
        <div className="h-40 rounded-lg bg-accent/30 animate-pulse border border-border" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-5 border-l-4 border-l-primary/50 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/5 rounded-full" />
              <p className="text-[12px] font-medium text-muted-foreground flex justify-between">
                Tổng đã thu
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </p>
              <h3 className="text-2xl font-bold mt-2 font-tabular">{formatVND(payData?.totalPaid || 0)}</h3>
              <p className="text-[11px] text-muted-foreground mt-1">Trong kỳ báo cáo</p>
            </div>
            
            <div className="card p-5 border-l-4 border-l-warning/50 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-warning/5 rounded-full" />
              <p className="text-[12px] font-medium text-muted-foreground flex justify-between">
                Chưa thanh toán
                <AlertCircle className="w-4 h-4 text-warning" />
              </p>
              <h3 className="text-2xl font-bold mt-2 font-tabular">{formatVND(payData?.totalUnpaid || 0)}</h3>
              <p className="text-[11px] text-muted-foreground mt-1">Của các ticket trong kỳ</p>
            </div>

            <div className="card p-5 border-l-4 border-l-destructive/50 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-destructive/5 rounded-full" />
              <p className="text-[12px] font-medium text-muted-foreground">
                Tổng công nợ toàn hệ thống
              </p>
              <h3 className="text-2xl font-bold text-destructive mt-2 font-tabular">{formatVND(payData?.totalDebt || 0)}</h3>
              <p className="text-[11px] text-muted-foreground mt-1">Ghi nhận từ module AR Ledger</p>
            </div>

            <div className="card p-5 bg-foreground text-background relative overflow-hidden">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-background/10 rounded-full" />
              <p className="text-[12px] font-medium text-zinc-400">Tỷ lệ thu hồi</p>
              <div className="flex items-end gap-2 mt-2">
                <h3 className="text-3xl font-black font-tabular tracking-tight">{(payData?.collectionRate || 0).toFixed(1)}%</h3>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full mt-3 overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    (payData?.collectionRate || 0) >= 80 ? 'bg-emerald-500' : 'bg-warning'
                  )}
                  style={{ width: `${Math.min(payData?.collectionRate || 0, 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="card overflow-hidden mt-6">
            <div className="p-4 border-b border-border bg-accent/20">
              <h3 className="text-[13px] font-semibold flex items-center gap-2">
                <Copy className="w-4 h-4 text-primary" />
                Cơ cấu Phương thức thanh toán
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted-foreground bg-accent/10">
                    <th className="px-5 py-3 font-medium">Phương thức</th>
                    <th className="px-5 py-3 font-medium text-center">Giao dịch</th>
                    <th className="px-5 py-3 font-medium text-right">Tổng tiền</th>
                    <th className="px-5 py-3 font-medium text-right">Tỷ trọng</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[13px]">
                  {methodsData.map((row: any) => (
                    <tr key={row.method} className="hover:bg-accent/20 transition-colors">
                      <td className="px-5 py-3 font-semibold">
                        <span className="px-2 py-1 bg-background border border-border rounded-md shadow-sm text-xs">
                          {row.method}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center">{row.transactionCount}</td>
                      <td className="px-5 py-3 text-right font-tabular font-medium">{formatVND(row.totalAmount)}</td>
                      <td className="px-5 py-3 text-right font-tabular">
                        <div className="flex items-center justify-end gap-2 text-muted-foreground">
                          <span>{row.percentage.toFixed(1)}%</span>
                          <div className="w-16 h-1.5 bg-accent rounded-full overflow-hidden">
                            <div className="h-full bg-foreground rounded-full" style={{ width: `${row.percentage}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {methodsData.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Không có dữ liệu thanh toán</td></tr>
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
