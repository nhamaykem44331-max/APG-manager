'use client';

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { AIRLINE_COLORS, AIRLINE_NAMES } from '@/lib/utils';

interface AirlineChartProps {
  data: Array<{
    airline: string;
    value: number;
    percent: number;
  }>;
}

function CustomTooltip({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { percent: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];

  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs">
      <p className="font-medium text-foreground">{AIRLINE_NAMES[item.name] ?? item.name}</p>
      <p className="text-muted-foreground mt-1">
        {item.value} vé ({item.payload.percent}%)
      </p>
    </div>
  );
}

export function AirlineChartInner({ data }: AirlineChartProps) {
  return (
    <div className="card p-5">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-foreground">Phân bổ theo hãng bay</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Tháng này</p>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            nameKey="airline"
          >
            {data.map((entry) => (
              <Cell
                key={entry.airline}
                fill={AIRLINE_COLORS[entry.airline] ?? '#6b7280'}
                stroke="transparent"
              />
            ))}
          </Pie>

          <Tooltip content={<CustomTooltip />} />

          <Legend
            formatter={(value) => (
              <span className="text-xs text-muted-foreground">
                {AIRLINE_NAMES[value] ?? value}
              </span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
