// APG Manager RMS - Biểu đồ Doanh thu 7 ngày (Recharts line + area)
'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { formatVND } from '@/lib/utils';

interface RevenueChartProps {
  data: Array<{
    date: string;
    revenue: number;
    profit: number;
  }>;
}

// Tooltip tùy chỉnh tiếng Việt
function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="text-muted-foreground mb-2 font-medium">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 py-0.5">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="text-foreground font-semibold">
            {formatVND(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Doanh thu & Lợi nhuận</h3>
          <p className="text-xs text-muted-foreground mt-0.5">7 ngày gần nhất</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            {/* Gradient fill cho doanh thu */}
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            {/* Gradient fill cho lợi nhuận */}
            <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />

          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
          />

          <YAxis
            tickFormatter={(v) => formatVND(v)}
            tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false}
            tickLine={false}
            width={55}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            formatter={(value) =>
              value === 'revenue' ? 'Doanh thu' : 'Lợi nhuận'
            }
            wrapperStyle={{ fontSize: '11px' }}
          />

          <Area
            type="monotone"
            dataKey="revenue"
            name="revenue"
            stroke="#3b82f6"
            strokeWidth={2}
            fill="url(#colorRevenue)"
            dot={{ r: 3, fill: '#3b82f6' }}
            activeDot={{ r: 5 }}
          />

          <Area
            type="monotone"
            dataKey="profit"
            name="profit"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#colorProfit)"
            dot={{ r: 3, fill: '#10b981' }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
