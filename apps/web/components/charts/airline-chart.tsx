'use client';

import dynamic from 'next/dynamic';

interface AirlineChartProps {
  data: Array<{
    airline: string;
    value: number;
    percent: number;
  }>;
}

const AirlineChartInner = dynamic(
  () => import('./airline-chart-inner').then((module) => module.AirlineChartInner),
  {
    ssr: false,
    loading: () => (
      <div className="card p-5">
        <div className="space-y-2 mb-4">
          <div className="h-4 w-32 rounded bg-muted/60 animate-pulse" />
          <div className="h-3 w-20 rounded bg-muted/40 animate-pulse" />
        </div>
        <div className="h-[220px] rounded-xl bg-muted/40 animate-pulse" />
      </div>
    ),
  },
);

export function AirlineChart(props: AirlineChartProps) {
  return <AirlineChartInner {...props} />;
}
