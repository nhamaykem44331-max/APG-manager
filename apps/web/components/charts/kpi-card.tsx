// APG Manager RMS - KPI Card (Vercel Style)
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  change?: number;       // % thay đổi so với hôm qua
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  change,
  loading = false,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="space-y-2">
          <div className="h-3 bg-muted rounded w-20" />
          <div className="h-7 bg-muted rounded w-28" />
          <div className="h-3 bg-muted rounded w-16" />
        </div>
      </div>
    );
  }

  // Xác định hướng thay đổi
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          {label}
        </p>
        <p className="text-2xl font-semibold font-tabular tracking-tight text-foreground">
          {value}
        </p>

        {/* Inline Badge % thay đổi */}
        {change !== undefined && (
          <div className={cn(
            'inline-flex items-center gap-1 mt-1 text-2xs font-medium',
            isPositive && 'text-green-600 dark:text-green-500',
            isNegative && 'text-red-600 dark:text-red-500',
            isNeutral && 'text-muted-foreground',
          )}>
            <span>
              {isPositive ? '↑ ' : ''}
              {isNegative ? '↓ ' : ''}
              {Math.abs(change)}%
            </span>
            <span className="text-muted-foreground text-2xs font-normal ml-0.5">so với trước đó</span>
          </div>
        )}
      </div>
    </div>
  );
}
