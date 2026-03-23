'use client';

import { AIRLINE_NAMES } from '@/lib/utils';
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
        {data.map((row, index) => (
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
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  index === 0 ? "bg-foreground" :
                  index === 1 ? "bg-foreground/80 dark:bg-foreground/80" :
                  index === 2 ? "bg-foreground/60 dark:bg-foreground/60" :
                  index === 3 ? "bg-foreground/40 dark:bg-foreground/40" : 
                  "bg-foreground/20 dark:bg-foreground/20"
                )}
                style={{ width: `${row.percent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
