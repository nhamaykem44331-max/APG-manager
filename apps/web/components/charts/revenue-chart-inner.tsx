'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatVND } from '@/lib/utils';

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

const SERIES_COLORS = {
  revenue: '#FBBF24',
  profit: '#A3E635',
  receivable: '#EF4444',
  payable: '#94A3B8',
} as const;

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[170px] rounded-md border border-border bg-card p-2.5 text-[12px] shadow-sm">
      <p className="mb-2 font-medium text-muted-foreground">{label}</p>
      <div className="space-y-2">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground capitalize">
                {entry.name === 'revenue'
                  ? 'Doanh thu'
                  : entry.name === 'profit'
                    ? 'Lợi nhuận'
                    : entry.name === 'receivable'
                      ? 'Công nợ phải thu'
                      : 'Công nợ phải trả'}
              </span>
            </div>
            <span className="font-tabular font-medium text-foreground">
              {formatVND(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueChartInner({ data, title, subtitle }: RevenueChartProps) {
  const hasDebtSeries = data.some((item) => (item.receivable ?? 0) > 0 || (item.payable ?? 0) > 0);
  const resolvedTitle = title ?? (hasDebtSeries ? 'Timeline doanh thu, lợi nhuận & công nợ' : 'Doanh thu & Lợi nhuận');
  const resolvedSubtitle = subtitle ?? 'Theo ngày trong kỳ đang xem';

  return (
    <div className="card p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-medium text-foreground">{resolvedTitle}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{resolvedSubtitle}</p>
        </div>
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: SERIES_COLORS.revenue }} />
            <span className="text-muted-foreground">Doanh thu</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: SERIES_COLORS.profit }} />
            <span className="text-muted-foreground">Lợi nhuận</span>
          </div>
          {hasDebtSeries && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: SERIES_COLORS.receivable }} />
                <span className="text-muted-foreground">Phải thu</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-3 rounded-full" style={{ backgroundColor: SERIES_COLORS.payable }} />
                <span className="text-muted-foreground">Phải trả</span>
              </div>
            </>
          )}
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />

          <XAxis
            axisLine={false}
            dataKey="date"
            dy={10}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
          />

          <YAxis
            axisLine={false}
            dx={-5}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickFormatter={(value) => formatVND(value)}
            tickLine={false}
            width={84}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '4 4', strokeWidth: 1 }}
          />

          <Line
            activeDot={{ r: 4, fill: SERIES_COLORS.revenue, stroke: '#F59E0B', strokeWidth: 2 }}
            dataKey="revenue"
            dot={false}
            name="revenue"
            stroke={SERIES_COLORS.revenue}
            strokeWidth={2}
            type="linear"
          />

          <Line
            activeDot={{ r: 4, fill: SERIES_COLORS.profit, stroke: '#84CC16', strokeWidth: 2 }}
            dataKey="profit"
            dot={false}
            name="profit"
            stroke={SERIES_COLORS.profit}
            strokeWidth={1.5}
            type="linear"
          />

          {hasDebtSeries && (
            <Line
              activeDot={{ r: 4, fill: SERIES_COLORS.receivable, stroke: '#DC2626', strokeWidth: 2 }}
              dataKey="receivable"
              dot={false}
              name="receivable"
              stroke={SERIES_COLORS.receivable}
              strokeWidth={1.5}
              type="stepAfter"
            />
          )}

          {hasDebtSeries && (
            <Line
              activeDot={{ r: 4, fill: SERIES_COLORS.payable, stroke: '#64748B', strokeWidth: 2 }}
              dataKey="payable"
              dot={false}
              name="payable"
              stroke={SERIES_COLORS.payable}
              strokeWidth={1.5}
              type="stepAfter"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
