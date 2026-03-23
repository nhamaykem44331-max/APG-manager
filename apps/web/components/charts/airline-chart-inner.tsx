'use client';

import { AIRLINE_COLORS, AIRLINE_NAMES } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface AirlineChartProps {
  data: Array<{
    airline: string;
    value: number;
    percent: number;
  }>;
}

export function AirlineChartInner({ data }: AirlineChartProps) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-[13px] font-semibold text-foreground">Phân bổ theo hãng bay</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Tháng này</p>
      </div>

      <div className="space-y-4">
        {data.map((row) => (
          <div key={row.airline} className="space-y-1.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-foreground">
                {AIRLINE_NAMES[row.airline] ?? row.airline}
              </span>
              <span className="text-muted-foreground font-tabular">
                {row.value} vé · {row.percent.toFixed(1)}%
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${row.percent}%`,
                  backgroundColor: AIRLINE_COLORS[row.airline] ?? '#6b7280',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
