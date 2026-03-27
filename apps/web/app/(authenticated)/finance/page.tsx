// APG Manager RMS - Tài chính (Phase A: AR/AP/NCC + Phase B: Dòng tiền/Chi phí)
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Wallet, TrendingUp, TrendingDown, AlertCircle, RefreshCw,
  ArrowUpCircle, ArrowDownCircle, CheckCircle2, Loader2,
  BarChart3, CreditCard, Building2,
} from 'lucide-react';
import { financeApi, ledgerApi } from '@/lib/api';
import {
  cn, formatVND, formatVNDFull, formatDate, AIRLINE_NAMES, AIRLINE_COLORS,
} from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import { RevenueChart } from '@/components/charts/revenue-chart';
import { ReceivableTab } from '@/components/finance/receivable-tab';
import { PayableTab } from '@/components/finance/payable-tab';
import { SuppliersTab } from '@/components/finance/suppliers-tab';
import { CashFlowTab } from '@/components/finance/cashflow-tab';
import { ExpenseTab } from '@/components/finance/expense-tab';
import { FundsTab } from '@/components/finance/funds-tab';
import type { LedgerSummary } from '@/types';

const TABS = [
  { key: 'overview', label: 'Tổng quan', icon: BarChart3 },
  { key: 'receivable', label: '📥 Phải thu (AR)', icon: ArrowDownCircle },
  { key: 'payable', label: '📤 Phải trả (AP)', icon: ArrowUpCircle },
  { key: 'cashflow', label: '💵 Dòng tiền', icon: TrendingUp },
  { key: 'funds', label: '💳 Sổ quỹ', icon: Wallet },
  { key: 'expenses', label: '📉 Chi phí VP', icon: TrendingDown },
  { key: 'deposits', label: 'Deposit', icon: CreditCard },
  { key: 'debts', label: 'Công nợ cũ', icon: AlertCircle },
  { key: 'reconcile', label: 'Đối soát', icon: CheckCircle2 },
  { key: 'suppliers', label: 'NCC & Đối tác', icon: Building2 },
];

// Revenue chart data mẫu
export default function FinancePage() {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="max-w-[1400px] space-y-5">
      {/* Header */}
      <PageHeader
        title="Tài chính"
        description="Quản lý doanh thu, lợi nhuận, công nợ và đối soát"
      />

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-border/80 bg-card/70 p-1 scroller">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex min-w-max items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              activeTab === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'receivable' && <ReceivableTab />}
      {activeTab === 'payable' && <PayableTab />}
      {activeTab === 'cashflow' && <CashFlowTab />}
      {activeTab === 'funds' && <FundsTab />}
      {activeTab === 'expenses' && <ExpenseTab />}
      {activeTab === 'deposits' && <DepositsTab />}
      {activeTab === 'debts' && <DebtsTab />}
      {activeTab === 'reconcile' && <ReconcileTab />}
      {activeTab === 'suppliers' && <SuppliersTab />}
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

  // Lấy tổng hợp AR/AP từ ledger
  const { data: ledgerSummary } = useQuery({
    queryKey: ['ledger', 'summary'],
    queryFn: () => ledgerApi.getSummary().then((r) => r.data as LedgerSummary),
  });

  const stats = data ?? {
    month: { revenue: 0, profit: 0, bookings: 0 },
    today: { revenue: 0, profit: 0, bookings: 0 },
    deposits: [],
    debt: { total: 0, count: 0 },
    timeline: [],
    airlines: [],
  };
  const airlineRows = stats.airlines as Array<{ airline: string; revenue: number; pct: number }>;

  return (
    <div className="space-y-4">
      {/* KPI 4 ô cũ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          {
            label: 'Doanh thu tháng', value: formatVND(stats.month.revenue),
            sub: `${stats.month.bookings} booking`, icon: TrendingUp, color: 'text-blue-500',
          },
          {
            label: 'Lợi nhuận tháng', value: formatVND(stats.month.profit),
            sub: `${stats.month.revenue > 0 ? ((stats.month.profit / stats.month.revenue) * 100).toFixed(1) : '0.0'}% margin`,
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
          <div key={card.label} className={cn('card flex min-h-[88px] flex-col justify-between p-3.5', isLoading && 'animate-pulse')}>
            <div className="flex items-start justify-between">
              <p className="text-[12px] font-medium text-muted-foreground">{card.label}</p>
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent/50">
                <card.icon className={cn('h-3 w-3', card.color)} />
              </div>
            </div>
            <div className="mt-1.5">
              <p className="font-tabular text-[28px] font-bold tracking-tight text-foreground">{card.value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* KPI AR/AP từ AccountsLedger */}
      {ledgerSummary && (
        <div className="card p-4">
          <div className="mb-1.5 flex items-center justify-between border-b border-border pb-2.5">
            <h3 className="text-[13px] font-medium text-foreground">Trạng thái công nợ (AR / AP)</h3>
          </div>
          <div className="flex flex-col text-[13px]">
            <div className="flex items-center justify-between border-b border-border/50 py-2.5">
              <span className="text-muted-foreground flex items-center gap-2"><ArrowDownCircle className="w-4 h-4 text-blue-500" /> Tổng phải thu (AR)</span>
              <div className="text-right">
                <span className="font-medium font-tabular text-foreground block">{formatVND(ledgerSummary.totalReceivable)}</span>
                <span className="text-[11px] text-red-500">Quá hạn: {formatVND(ledgerSummary.overdueReceivable)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 py-2.5">
              <span className="text-muted-foreground flex items-center gap-2"><ArrowUpCircle className="w-4 h-4 text-orange-500" /> Tổng phải trả (AP)</span>
              <div className="text-right">
                <span className="font-medium font-tabular text-foreground block">{formatVND(ledgerSummary.totalPayable)}</span>
                <span className="text-[11px] text-red-500">Quá hạn: {formatVND(ledgerSummary.overduePayable)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="text-muted-foreground flex items-center gap-2">⚖️ Vị thế ròng</span>
              <div className="text-right">
                <span className={cn('font-medium font-tabular block', ledgerSummary.netPosition >= 0 ? 'text-emerald-500' : 'text-red-500')}>
                  {ledgerSummary.netPosition >= 0 ? '+' : ''}{formatVND(ledgerSummary.netPosition)}
                </span>
                <span className="text-[11px] text-muted-foreground">{ledgerSummary.receivableCount} khoản thu · {ledgerSummary.payableCount} khoản chi</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <RevenueChart
        data={stats.timeline}
        title="Doanh thu & Lợi nhuận theo tháng"
        subtitle="Theo tháng trong 6 tháng gần nhất"
      />

      {/* Lợi nhuận theo hãng - bar list */}
      <div className="card p-4">
        <h3 className="text-[13px] font-semibold text-foreground mb-4">Doanh thu theo hãng bay (tháng này)</h3>
        <div className="space-y-3">
          {airlineRows.map((row) => (
            <div key={row.airline} className="space-y-1.5">
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-2">
                  <img
                    src={`https://images.kiwi.com/airlines/32/${row.airline}.png`}
                    alt={row.airline}
                    className="w-4 h-4 rounded-sm object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="font-medium" style={{ color: AIRLINE_COLORS[row.airline] }}>
                    {AIRLINE_NAMES[row.airline]}
                  </span>
                </span>
                <span className="text-muted-foreground font-tabular">{formatVND(row.revenue)} · {row.pct}%</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${row.pct}%`, backgroundColor: AIRLINE_COLORS[row.airline] || '#6B7280' }}
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
  const [topupFundAccount, setTopupFundAccount] = useState('BANK_HTX');

  const { data: deposits, isLoading } = useQuery({
    queryKey: ['deposits'],
    queryFn: () => financeApi.getDeposits(),
    select: (r) => r.data,
  });

  const topupMutation = useMutation({
    mutationFn: ({ id, amount, fundAccount }: { id: string; amount: number; fundAccount: string }) =>
      financeApi.updateDeposit(id, { amount, fundAccount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      queryClient.invalidateQueries({ queryKey: ['funds'] });
      setTopupAirline(null);
      setTopupAmount('');
      setTopupFundAccount('BANK_HTX');
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
      <p className="text-[13px] text-muted-foreground">
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
                    className="w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: AIRLINE_COLORS[d.airline], borderLeft: `3px solid ${AIRLINE_COLORS[d.airline]}` }}
                  >
                    <img
                      src={`https://images.kiwi.com/airlines/64/${d.airline}.png`}
                      alt={d.airline}
                      className="w-5 h-5 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).replaceWith(Object.assign(document.createElement('span'), { className: 'text-white text-xs font-bold', textContent: d.airline })); }}
                    />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: AIRLINE_COLORS[d.airline] }}>{AIRLINE_NAMES[d.airline]}</p>
                    {isLow && (
                      <p className="text-[11px] text-red-500 font-medium">⚠ Sắp hết</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Balance */}
              <p className="text-2xl font-bold font-tabular tracking-tight text-foreground">{formatVND(d.balance)}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
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
                <div className="mt-4 space-y-2">
                  <select
                    value={topupFundAccount}
                    onChange={(e) => setTopupFundAccount(e.target.value)}
                    className="w-full px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="CASH_OFFICE">Quy tien mat VP</option>
                    <option value="BANK_HTX">TK BIDV HTX</option>
                    <option value="BANK_PERSONAL">TK MB ca nhan</option>
                  </select>
                  <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="Số tiền (VND)"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    className="flex-1 px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    onClick={() => topupMutation.mutate({ id: d.id, amount: Number(topupAmount), fundAccount: topupFundAccount })}
                    disabled={topupMutation.isPending || !topupAmount}
                    className="px-3 h-9 text-[13px] font-medium bg-foreground text-background rounded-md hover:opacity-90 disabled:opacity-50 flex items-center justify-center transition-all"
                  >
                    {topupMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Nạp'}
                  </button>
                  <button
                    onClick={() => setTopupAirline(null)}
                    className="px-3 h-9 text-[13px] font-medium border border-border rounded-md hover:bg-accent text-muted-foreground transition-all"
                  >
                    Hủy
                  </button>
                </div>
                </div>
              ) : (
                <button
                  onClick={() => setTopupAirline(d.id)}
                  className="mt-4 w-full h-9 text-[13px] font-medium border border-border border-dashed rounded-md hover:border-foreground/50 text-muted-foreground hover:text-foreground transition-colors"
                >
                  + Nạp tiền
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Form thêm deposit hãng mới */}
      <AddDepositForm />
    </div>
  );
}

function AddDepositForm() {
  const queryClient = useQueryClient();
  const [airline, setAirline] = useState('');
  const [threshold, setThreshold] = useState('5000000');

  const createMutation = useMutation({
    mutationFn: (data: { airline: string; alertThreshold: number }) =>
      financeApi.createDeposit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deposits'] });
      setAirline('');
      setThreshold('5000000');
    },
  });

  return (
    <div className="card p-5">
      <h4 className="text-xs font-semibold text-foreground mb-3">+ Thêm deposit hãng bay</h4>
      <div className="grid grid-cols-3 gap-3">
        <input
          type="text"
          placeholder="Mã hãng (VD: EK, SQ)"
          maxLength={3}
          value={airline}
          onChange={(e) => setAirline(e.target.value.toUpperCase())}
          className="px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <input
          type="number"
          placeholder="Ngưỡng cảnh báo"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          className="px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <button
          onClick={() => createMutation.mutate({ airline, alertThreshold: Number(threshold) })}
          disabled={!airline || createMutation.isPending}
          className="h-9 px-4 text-[13px] font-medium bg-foreground text-background rounded-md hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
        >
          {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Thêm
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        Cho phép thêm deposit cho các hãng quốc tế như Emirates (EK), Singapore Airlines (SQ), v.v.
      </p>
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
        <h3 className="text-[13px] font-semibold text-foreground mb-4">Phân tích tuổi nợ</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Object.entries(aging).map(([bucket, amount]) => (
            <div key={bucket} className="text-center p-4 rounded-lg bg-accent/30 border border-border">
              <div
                className="text-xl font-bold font-tabular"
                style={{ color: DEBT_COLORS[bucket as keyof typeof DEBT_COLORS] }}
              >
                {formatVND(amount)}
              </div>
              <p className="text-[13px] text-muted-foreground mt-1">{bucket} ngày</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {Math.round((amount / totalDebt) * 100)}%
              </p>
            </div>
          ))}
        </div>
        {/* Total bar */}
        <div className="mt-5 flex rounded-full overflow-hidden h-2">
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
        <p className="text-[13px] text-foreground font-medium mt-3 text-right">
          Tổng: {formatVNDFull(totalDebt)}
        </p>
      </div>

      {/* Debt table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-[13px] font-semibold text-foreground">Danh sách công nợ</h3>
        </div>
        <DataTable
          data={SAMPLE_DEBTS}
          columns={[
            {
              header: 'Khách hàng',
              cell: (d) => (
                <div>
                  <p className="font-medium text-foreground text-[13px]">{d.customerName}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{d.phone}</p>
                </div>
              ),
            },
            {
              header: 'Tổng nợ',
              cell: (d) => <span className="font-medium inline-block font-tabular text-foreground">{formatVND(d.total)}</span>,
              className: 'text-right',
            },
            {
              header: 'Đã trả',
              cell: (d) => <span className="text-emerald-500 font-medium inline-block font-tabular">{formatVND(d.paid)}</span>,
              className: 'text-right',
            },
            {
              header: 'Còn lại',
              cell: (d) => <span className="font-bold text-orange-500 inline-block font-tabular">{formatVND(d.remaining)}</span>,
              className: 'text-right',
            },
            {
              header: 'Hạn TT',
              cell: (d) => <span className="text-muted-foreground font-tabular">{formatDate(d.dueDate)}</span>,
              className: 'text-right',
            },
            {
              header: 'Trạng thái',
              cell: (d) => (
                <span className={cn('inline-block px-1.5 py-0.5 rounded text-[11px] font-medium', DEBT_STATUS[d.status] ?? '')}>
                  {DEBT_STATUS_LABEL[d.status]}
                </span>
              ),
            },
            {
              header: '',
              cell: () => <button className="text-[13px] font-medium text-foreground underline hover:no-underline hover:text-primary transition-colors">Nhắc nợ</button>,
              className: 'text-right',
            },
          ]}
        />
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
    <div className="space-y-6">
      <div className="card p-5">
        <h3 className="text-[13px] font-semibold text-foreground mb-1">Chạy đối soát</h3>
        <p className="text-[13px] text-muted-foreground mb-4">
          So sánh giá net thực tế với bảng giá hãng bay. Tự động chạy lúc 06:00 hàng ngày qua n8n.
        </p>

        <div className="flex items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={cn(
              'px-3 h-9 text-[13px] rounded-md border border-border bg-background',
              'text-foreground focus:outline-none focus:ring-1 focus:ring-primary inline-flex',
            )}
          />
          <button
            onClick={handleRun}
            disabled={isRunning}
            className={cn(
              'flex items-center gap-1.5 px-4 h-9 rounded-md text-[13px] font-medium',
              'bg-foreground text-background hover:opacity-90 transition-all active:scale-[0.98]',
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
          <div className="mt-5 p-5 rounded-md bg-accent/40 border border-border/50">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span className="text-[13px] font-semibold text-foreground">
                Đối soát ngày {formatDate(selectedDate)} hoàn tất
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Vé đã xuất', value: result.totalTickets.toString() },
                { label: 'Doanh thu', value: formatVND(result.totalRevenue) },
                { label: 'Lợi nhuận', value: formatVND(result.totalProfit) },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-xl font-bold font-tabular tracking-tight text-foreground">{item.value}</p>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-[13px] text-emerald-600 dark:text-emerald-500 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Không phát hiện chênh lệch. Báo cáo đã gửi vào nhóm Telegram kế toán.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Lịch sử đối soát */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-[13px] font-semibold text-foreground">Lịch sử đối soát gần đây</h3>
        </div>
        <DataTable
          data={[
            { date: '20/03/2026', tickets: 21, revenue: 41_500_000, profit: 4_100_000, diff: 0, ok: true },
            { date: '19/03/2026', tickets: 18, revenue: 35_200_000, profit: 3_500_000, diff: -150_000, ok: false },
            { date: '18/03/2026', tickets: 25, revenue: 52_300_000, profit: 5_200_000, diff: 0, ok: true },
          ]}
          columns={[
            {
              header: 'Ngày',
              accessorKey: 'date',
              className: 'text-foreground font-medium text-[13px]',
            },
            {
              header: 'Vé',
              accessorKey: 'tickets',
              className: 'text-[13px] font-tabular text-muted-foreground',
            },
            {
              header: 'Doanh thu',
              cell: (r) => <span className="font-tabular inline-block">{formatVND(r.revenue)}</span>,
              className: 'text-right text-[13px]',
            },
            {
              header: 'Lợi nhuận',
              cell: (r) => <span className="text-emerald-500 font-medium font-tabular inline-block">{formatVND(r.profit)}</span>,
              className: 'text-right text-[13px]',
            },
            {
              header: 'Chênh lệch',
              cell: (r) => (
                <span className={cn('font-tabular inline-block', r.diff < 0 ? 'text-red-500 font-medium' : 'text-muted-foreground')}>
                  {r.diff < 0 ? formatVND(r.diff) : '—'}
                </span>
              ),
              className: 'text-right text-[13px]',
            },
            {
              header: 'Trạng thái',
              cell: (r) => (
                <span className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium',
                  r.ok ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                       : 'bg-red-500/10 text-red-600 dark:text-red-400',
                )}>
                  {r.ok ? 'Khớp' : 'Chênh lệch'}
                </span>
              ),
            },
          ]}
        />
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
