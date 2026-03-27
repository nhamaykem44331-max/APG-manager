'use client';

import dynamic from 'next/dynamic';

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    profit: number;
    receivable?: number;
    payable?: number;
  }>;
  title?: string;
  subtitle?: string;
}

const RevenueChartInner = dynamic(
  () => import('./revenue-chart-inner').then((module) => module.RevenueChartInner),
  {
    ssr: false,
    loading: () => (
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-4 w-36 rounded bg-muted/60 animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
          </div>
        </div>
        <div className="h-[200px] rounded-lg bg-muted/40 animate-pulse" />
      </div>
    ),
  },
);

export function RevenueChart(props: RevenueChartProps) {
  return <RevenueChartInner {...props} />;
}
