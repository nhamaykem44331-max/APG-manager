'use client';

import dynamic from 'next/dynamic';

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    profit: number;
  }>;
}

const RevenueChartInner = dynamic(
  () => import('./revenue-chart-inner').then((module) => module.RevenueChartInner),
  {
    ssr: false,
    loading: () => (
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <div className="h-4 w-36 rounded bg-muted/60 animate-pulse" />
            <div className="h-3 w-24 rounded bg-muted/40 animate-pulse" />
          </div>
        </div>
        <div className="h-[220px] rounded-xl bg-muted/40 animate-pulse" />
      </div>
    ),
  },
);

export function RevenueChart(props: RevenueChartProps) {
  return <RevenueChartInner {...props} />;
}
