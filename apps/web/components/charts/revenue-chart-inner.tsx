'use client';

import {
  Line,
  LineChart,
  CartesianGrid,
  Legend,
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
  }>;
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-card border border-border rounded-md shadow-sm p-3 text-[13px] min-w-[150px]">
      <p className="text-muted-foreground mb-3 font-medium">{label}</p>
      <div className="space-y-2">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground capitalize">{entry.name === 'revenue' ? 'Doanh thu' : 'Lợi nhuận'}</span>
            </div>
            <span className="text-foreground font-medium font-tabular">
              {formatVND(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RevenueChartInner({ data }: RevenueChartProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-[14px] font-medium text-foreground">Doanh thu & Lợi nhuận</h3>
        </div>
        <div className="flex items-center gap-4 text-[12px]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-0.5 rounded-full bg-foreground" />
            <span className="text-muted-foreground">Doanh thu</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-0.5 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">Lợi nhuận</span>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            dy={10}
          />

          <YAxis
            tickFormatter={(value) => formatVND(value)}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={70}
            dx={-10}
          />

          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '4 4' }} 
          />

          <Line
            type="monotone"
            dataKey="revenue"
            name="revenue"
            stroke="hsl(var(--foreground))"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(var(--background))', stroke: 'hsl(var(--foreground))', strokeWidth: 2 }}
          />

          <Line
            type="monotone"
            dataKey="profit"
            name="profit"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: 'hsl(var(--background))', stroke: 'hsl(var(--muted-foreground))', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
