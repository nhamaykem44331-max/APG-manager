// APG Manager RMS - Tài chính (Tab-based: Tổng quan, Đối soát, Công nợ, Deposit)
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, TrendingUp, AlertCircle, RefreshCw,
  ArrowUpCircle, Clock, CheckCircle2, Loader2,
  BarChart3, CreditCard,
} from 'lucide-react';
import { financeApi } from '@/lib/api';
import {
  cn, formatVND, formatVNDFull, formatDate, AIRLINE_NAMES, AIRLINE_COLORS,
} from '@/lib/utils';
import { RevenueChart } from '@/components/charts/revenue-chart';

const TABS = [
  { key: 'overview', label: 'Tổng quan', icon: BarChart3 },
  { key: 'deposits', label: 'Deposit hãng bay', icon: CreditCard },
  { key: 'debts', label: 'Công nợ', icon: AlertCircle },
  { key: 'reconcile', label: 'Đối soát', icon: CheckCircle2 },
];

// Revenue chart data mẫu
const SAMPLE_CHART = [
  { date: 'T2', revenue: 42_000_000, profit: 4_200_000 },
  { date: 'T3', revenue: 38_000_000, profit: 3_800_000 },
  { date: 'T4', revenue: 55_000_000, profit: 5_500_000 },
  { date: 'T5', revenue: 47_000_000, profit: 4_700_000 },
  { date: 'T6', revenue: 63_000_000, profit: 6_300_000 },
  { date: 'T7', revenue: 71_000_000, profit: 7_100_000 },
  { date: 'CN', revenue: 45_000_000, profit: 4_500_000 },
];

export default function FinancePage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Tài chính</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Quản lý doanh thu, lợi nhuận, công nợ và đối soát
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium',
              'border-b-2 -mb-px transition-colors',
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'deposits' && <DepositsTab />}
      {activeTab === 'debts' && <DebtsTab />}
      {activeTab === 'reconcile' && <ReconcileTab />}
    </div>
  );
}

// ===== TAB: TỔNG QUAN =====
function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: () => financeApi.getDashboard(),
    select: (r) => r.data,
  });

  const stats = data ?? {
    month: { revenue: 1_200_000_000, profit: 120_000_000, bookings: 380 },
    today: { revenue: 45_200_000, profit: 4_800_000, bookings: 23 },
    deposits: [],
    debt: { total: 350_000_000, count: 8 },
  };

  return (
    <div className="space-y-5">
      {/* KPI 4 ô */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Doanh thu tháng', value: formatVND(stats.month.revenue),
            sub: `${stats.month.bookings} booking`, icon: TrendingUp, color: 'text-blue-500',
          },
          {
            label: 'Lợi nhuận tháng', value: formatVND(stats.month.profit),
            sub: `${((stats.month.profit / stats.month.revenue) * 100).toFixed(1)}% margin`,
            icon: Wallet, color: 'text-emerald-500',
          },
          {
            label: 'Công nợ active', value: formatVND(stats.debt.total),
            sub: `${stats.debt.count} khách`, icon: AlertCircle, color: 'text-orange-500',
          },
          {
            label: 'Doanh thu hôm nay', value: formatVND(stats.today.revenue),
            sub: `LN: ${formatVND(stats.today.profit)}`, icon: ArrowUpCircle, color: 'text-purple-500',
          },
        ].map((card) => (
          <div key={card.label} className={cn('card p-4', isLoading && 'animate-pulse')}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{card.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
              </div>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <card.icon className={cn('w-4.5 h-4.5', card.color)} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <RevenueChart data={SAMPLE_CHART} />

      {/* Lợi nhuận theo hãng - bar list */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Doanh thu theo hãng bay (tháng này)</h3>
        <div className="space-y-3">
          {[
            { airline: 'VN', revenue: 580_000_000, pct: 48 },
            { airline: 'VJ', revenue: 360_000_000, pct: 30 },
            { airline: 'QH', revenue: 168_000_000, pct: 14 },
            { airline: 'BL', revenue: 72_000_000, pct: 6 },
            { airline: 'VU', revenue: 24_000_000, pct: 2 },
          ].map((row) => (
            <div key={row.airline} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground">
                  {AIRLINE_NAMES[row.airline]}
                </span>
                <span className="text-muted-foreground">{formatVND(row.revenue)} · {row.pct}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${row.pct}%`,
                    backgroundColor: AIRLINE_COLORS[row.airline],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== TAB: DEPOSIT =====
function DepositsTab() {
  const queryClient = useQueryClient();
  const [topupAirline, setTopupAirline] = useState<string | null>(null);
  const [topupAmount, setTopupAmount] = useState('');

  const { data: deposits, isLoading } = useQuery({
    queryKey: ['deposits'],
    queryFn: () => financeApi.getDeposits(),
    select: (r) => r.data,
  });

  const topupMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      financeApi.updateDeposit(id, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      setTopupAirline(null);
      setTopupAmount('');
    },
  });

  const sampleDeposits = [
    { id: 'VN', airline: 'VN', balance: 450_000_000, alertThreshold: 50_000_000, lastTopUp: 200_000_000 },
    { id: 'VJ', airline: 'VJ', balance: 18_000_000, alertThreshold: 30_000_000, lastTopUp: 100_000_000 },
    { id: 'QH', airline: 'QH', balance: 120_000_000, alertThreshold: 20_000_000, lastTopUp: 80_000_000 },
    { id: 'BL', airline: 'BL', balance: 45_000_000, alertThreshold: 15_000_000, lastTopUp: 50_000_000 },
    { id: 'VU', airline: 'VU', balance: 25_000_000, alertThreshold: 10_000_000, lastTopUp: 30_000_000 },
  ];

  const depositList = deposits ?? sampleDeposits;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Theo dõi số dư tài khoản đặt cọc tại các hãng hàng không. Cảnh báo khi số dư thấp hơn ngưỡng.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {depositList.map((d: { id: string; airline: string; balance: number; alertThreshold: number; lastTopUp: number }) => {
          const isLow = d.balance < d.alertThreshold;
          const pct = Math.min(100, Math.round((d.balance / (d.alertThreshold * 4)) * 100));

          return (
            <div key={d.id} className={cn(
              'card p-5',
              isLow && 'ring-1 ring-red-500/40',
            )}>
              {/* Airline header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: AIRLINE_COLORS[d.airline] }}
                  >
                    {d.airline}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{AIRLINE_NAMES[d.airline]}</p>
                    {isLow && (
                      <p className="text-[10px] text-red-500 font-medium">⚠ Sắp hết</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Balance */}
              <p className="text-2xl font-bold text-foreground">{formatVND(d.balance)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ngưỡng cảnh báo: {formatVND(d.alertThreshold)}
              </p>

              {/* Progress bar */}
              <div className="w-full bg-muted rounded-full h-1.5 mt-3">
                <div
                  className="h-1.5 rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isLow ? '#ef4444' : AIRLINE_COLORS[d.airline],
                  }}
                />
              </div>

              {/* Top-up form */}
              {topupAirline === d.id ? (
                <div className="mt-3 flex gap-2">
                  <input
                    type="number"
                    placeholder="Số tiền nạp (VND)"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    className="flex-1 px-2 py-1.5 text-xs rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => topupMutation.mutate({ id: d.id, amount: Number(topupAmount) })}
                    disabled={topupMutation.isPending || !topupAmount}
                    className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
                  >
                    {topupMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Nạp'}
                  </button>
                  <button
                    onClick={() => setTopupAirline(null)}
                    className="px-2 py-1.5 text-xs border border-border rounded hover:bg-accent text-muted-foreground"
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setTopupAirline(d.id)}
                  className="mt-3 w-full py-1.5 text-xs border border-border rounded hover:bg-accent text-muted-foreground transition-colors"
                >
                  + Nạp tiền
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== TAB: CÔNG NỢ =====
function DebtsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['debts'],
    queryFn: () => financeApi.getDebts(),
    select: (r) => r.data,
  });

  const aging = { '0-30': 150_000_000, '30-60': 100_000_000, '60-90': 80_000_000, '>90': 20_000_000 };
  const totalDebt = Object.values(aging).reduce((a, b) => a + b, 0);

  const DEBT_COLORS = { '0-30': '#3b82f6', '30-60': '#f59e0b', '60-90': '#f97316', '>90': '#ef4444' };
  const DEBT_STATUS: Record<string, string> = {
    ACTIVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    PARTIAL_PAID: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  const DEBT_STATUS_LABEL: Record<string, string> = {
    ACTIVE: 'Đang nợ', PARTIAL_PAID: 'Trả một phần', OVERDUE: 'Quá hạn', PAID: 'Đã trả',
  };

  return (
    <div className="space-y-5">
      {/* Aging chart */}
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Phân tích tuổi nợ</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(aging).map(([bucket, amount]) => (
            <div key={bucket} className="text-center p-3 rounded-lg bg-muted/40">
              <div
                className="text-lg font-bold"
                style={{ color: DEBT_COLORS[bucket as keyof typeof DEBT_COLORS] }}
              >
                {formatVND(amount)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{bucket} ngày</p>
              <p className="text-[10px] text-muted-foreground">
                {Math.round((amount / totalDebt) * 100)}%
              </p>
            </div>
          ))}
        </div>
        {/* Total bar */}
        <div className="mt-4 flex rounded-full overflow-hidden h-2">
          {Object.entries(aging).map(([bucket, amount]) => (
            <div
              key={bucket}
              style={{
                width: `${Math.round((amount / totalDebt) * 100)}%`,
                backgroundColor: DEBT_COLORS[bucket as keyof typeof DEBT_COLORS],
              }}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 text-right">
          Tổng: {formatVNDFull(totalDebt)}
        </p>
      </div>

      {/* Debt table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Danh sách công nợ</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Khách hàng', 'Tổng nợ', 'Đã trả', 'Còn lại', 'Hạn TT', 'Trạng thái', ''].map(h => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SAMPLE_DEBTS.map((debt) => (
                <tr key={debt.id} className="hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground text-sm">{debt.customerName}</p>
                    <p className="text-xs text-muted-foreground">{debt.phone}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">{formatVND(debt.total)}</td>
                  <td className="px-4 py-3 text-emerald-500">{formatVND(debt.paid)}</td>
                  <td className="px-4 py-3 font-semibold text-orange-500">{formatVND(debt.remaining)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(debt.dueDate)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-block px-2 py-0.5 rounded-full text-[10px] font-medium', DEBT_STATUS[debt.status] ?? '')}>
                      {DEBT_STATUS_LABEL[debt.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-primary hover:underline">Nhắc nợ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ===== TAB: ĐỐI SOÁT =====
function ReconcileTab() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<null | {
    totalTickets: number; totalRevenue: number; totalProfit: number;
  }>(null);

  const handleRun = async () => {
    setIsRunning(true);
    try {
      const res = await financeApi.getDashboard();
      // Giả lập kết quả đối soát
      setResult({
        totalTickets: 23,
        totalRevenue: 45_200_000,
        totalProfit: 4_800_000,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Chạy đối soát</h3>
        <p className="text-xs text-muted-foreground mb-4">
          So sánh giá net thực tế với bảng giá hãng bay. Tự động chạy lúc 06:00 hàng ngày qua n8n.
        </p>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={cn(
              'px-3 py-2 text-sm rounded-lg border border-border bg-background',
              'text-foreground focus:outline-none focus:ring-1 focus:ring-primary',
            )}
          />
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-primary text-white hover:bg-primary/90 transition-colors',
              'disabled:opacity-50',
            )}
          >
            {isRunning
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <RefreshCw className="w-3.5 h-3.5" />
            }
            {isRunning ? 'Đang chạy...' : 'Chạy đối soát'}
          </button>
        </div>

        {/* Kết quả đối soát */}
        {result && (
          <div className="mt-5 p-4 rounded-lg bg-muted/40 border border-border">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-medium text-foreground">
                Đối soát ngày {formatDate(selectedDate)} hoàn tất
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Vé đã xuất', value: result.totalTickets.toString() },
                { label: 'Doanh thu', value: formatVND(result.totalRevenue) },
                { label: 'Lợi nhuận', value: formatVND(result.totalProfit) },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="text-lg font-bold text-foreground">{item.value}</p>
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-emerald-500 mt-3 text-center">
              ✅ Không phát hiện chênh lệch. Báo cáo đã gửi Telegram.
            </p>
          </div>
        )}
      </div>

      {/* Lịch sử đối soát */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Lịch sử đối soát gần đây</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Ngày', 'Vé', 'Doanh thu', 'Lợi nhuận', 'Chênh lệch', 'Trạng thái'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {[
              { date: '20/03/2026', tickets: 21, revenue: 41_500_000, profit: 4_100_000, diff: 0, ok: true },
              { date: '19/03/2026', tickets: 18, revenue: 35_200_000, profit: 3_500_000, diff: -150_000, ok: false },
              { date: '18/03/2026', tickets: 25, revenue: 52_300_000, profit: 5_200_000, diff: 0, ok: true },
            ].map((row) => (
              <tr key={row.date} className="hover:bg-accent/30 transition-colors">
                <td className="px-4 py-3 text-sm text-foreground">{row.date}</td>
                <td className="px-4 py-3 text-sm text-foreground">{row.tickets}</td>
                <td className="px-4 py-3 text-sm text-foreground">{formatVND(row.revenue)}</td>
                <td className="px-4 py-3 text-sm text-emerald-500">{formatVND(row.profit)}</td>
                <td className={cn('px-4 py-3 text-xs font-medium', row.diff < 0 ? 'text-red-500' : 'text-muted-foreground')}>
                  {row.diff < 0 ? formatVND(row.diff) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                    row.ok ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                           : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                  )}>
                    {row.ok ? '✅ Khớp' : '⚠ Chênh lệch'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Dữ liệu mẫu công nợ
const SAMPLE_DEBTS = [
  {
    id: '1', customerName: 'Thép Miền Bắc', phone: '0243456789',
    total: 180_000_000, paid: 50_000_000, remaining: 130_000_000,
    dueDate: '2026-03-15', status: 'OVERDUE',
  },
  {
    id: '2', customerName: 'Nguyễn Văn Hải', phone: '0901111222',
    total: 8_500_000, paid: 5_000_000, remaining: 3_500_000,
    dueDate: '2026-03-30', status: 'PARTIAL_PAID',
  },
  {
    id: '3', customerName: 'Công ty Du lịch Sao Mai', phone: '0282345678',
    total: 45_000_000, paid: 0, remaining: 45_000_000,
    dueDate: '2026-04-10', status: 'ACTIVE',
  },
];
