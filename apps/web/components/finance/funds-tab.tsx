'use client';
// APG Manager RMS - FundsTab: Quản lý Sổ Quỹ (Fund Management)
import { useQuery } from '@tanstack/react-query';
import { financeApi } from '@/lib/api';
import { Wallet, Landmark, CreditCard, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { cn, formatVND } from '@/lib/utils';
import { DataTable } from '@/components/ui/data-table';

export function FundsTab() {
  const { data: balances, isLoading } = useQuery({
    queryKey: ['cashflow', 'fund-balances'],
    queryFn: () => financeApi.getFundBalances().then((r) => r.data),
  });

  const fundsList = balances ?? [
    { fund: 'CASH_OFFICE', label: 'Quỹ tiền mặt VP', inflow: 0, outflow: 0, balance: 0 },
    { fund: 'BANK_HTX', label: 'TK BIDV HTX', inflow: 0, outflow: 0, balance: 0 },
    { fund: 'BANK_PERSONAL', label: 'TK MB cá nhân', inflow: 0, outflow: 0, balance: 0 },
  ];

  const totalBalance = fundsList.reduce((acc: number, curr: any) => acc + curr.balance, 0);

  const getIcon = (fund: string) => {
    switch (fund) {
      case 'CASH_OFFICE': return Wallet;
      case 'BANK_HTX': return Landmark;
      case 'BANK_PERSONAL': return CreditCard;
      default: return Wallet;
    }
  };

  const getColor = (fund: string) => {
    switch (fund) {
      case 'CASH_OFFICE': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'BANK_HTX': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case 'BANK_PERSONAL': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      default: return 'text-primary bg-primary/10 border-primary/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Tổng số dư quỹ hệ thống
          </h2>
          <p className="text-3xl font-bold font-tabular tracking-tight text-foreground mt-2">
            {formatVND(totalBalance)}
          </p>
        </div>
        <button className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-foreground text-background rounded-lg hover:opacity-90 transition-all">
          <ArrowUpRight className="w-3.5 h-3.5" /> Chuyển quỹ nội bộ (Sắp ra mắt)
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {fundsList.map((f: any) => {
          const Icon = getIcon(f.fund);
          const colorClass = getColor(f.fund);
          return (
            <div key={f.fund} className={cn('card p-5 border', colorClass.split(' ')[2])}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', colorClass.split(' ')[1])}>
                    <Icon className={cn('w-5 h-5', colorClass.split(' ')[0])} />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-medium text-foreground">{f.label}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Mã quỹ: {f.fund}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-2xl font-bold font-tabular text-foreground">{formatVND(f.balance)}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-border/50">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3 text-emerald-500" /> Tiền vào
                  </p>
                  <p className="text-[12px] font-medium font-tabular mt-1 text-emerald-600 dark:text-emerald-400">
                    {formatVND(f.inflow)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3 text-red-500" /> Tiền ra
                  </p>
                  <p className="text-[12px] font-medium font-tabular mt-1 text-red-500">
                    {formatVND(f.outflow)}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[13px] font-semibold text-foreground">Giao dịch Quỹ gần đây</h3>
          <p className="text-[11px] text-muted-foreground mt-1">Lịch sử thu/chi tác động trực tiếp lên sổ quỹ</p>
        </div>
        <div className="p-8 text-center text-sm text-muted-foreground">
          Vui lòng xem chi tiết từng giao dịch tại Tab <strong>Dòng tiền</strong>.
        </div>
      </div>
    </div>
  );
}
