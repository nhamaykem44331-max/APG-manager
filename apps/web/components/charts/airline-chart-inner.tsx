'use client';

import { AIRLINE_NAMES, AIRLINE_COLORS } from '@/lib/utils';

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

      {data.length === 0 ? (
        <div className="flex h-[220px] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
          Chưa có vé phát sinh trong tháng này
        </div>
      ) : (
      <div className="space-y-3.5">
        {data.map((row) => {
          const color = AIRLINE_COLORS[row.airline] || '#6B7280';
          return (
            <div key={row.airline} className="space-y-1.5">
              <div className="flex items-center justify-between text-[13px]">
                {/* Tên hãng với logo + brand color */}
                <span className="flex items-center gap-2">
                  <img
                    src={`https://images.kiwi.com/airlines/64/${row.airline}.png`}
                    alt={row.airline}
                    className="w-4 h-4 rounded-sm object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="font-medium" style={{ color }}>
                    {AIRLINE_NAMES[row.airline] ?? row.airline}
                  </span>
                </span>
                <span className="text-muted-foreground font-tabular">
                  {row.value} vé · {row.percent.toFixed(1)}%
                </span>
              </div>
              {/* Progress bar dùng brand color */}
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${row.percent}%`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
