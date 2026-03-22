// APG Manager RMS - KPI Card (dashboard thống kê)
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  change?: number;       // % thay đổi so với hôm qua
  icon: React.ElementType;
  iconColor?: string;
  loading?: boolean;
}

export function KpiCard({
  label,
  value,
  change,
  icon: Icon,
  iconColor = 'text-primary',
  loading = false,
}: KpiCardProps) {
  if (loading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            <div className="h-3 bg-muted rounded w-24" />
            <div className="h-7 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-16" />
          </div>
          <div className="w-10 h-10 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  // Xác định hướng thay đổi
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  return (
    <div className="card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground mt-1 truncate">
            {value}
          </p>

          {/* Badge % thay đổi */}
          {change !== undefined && (
            <div className={cn(
              'inline-flex items-center gap-1 mt-2 px-1.5 py-0.5 rounded text-xs font-medium',
              isPositive && 'bg-green-500/10 text-green-600 dark:text-green-400',
              isNegative && 'bg-red-500/10 text-red-600 dark:text-red-400',
              isNeutral && 'bg-muted text-muted-foreground',
            )}>
              {isPositive && <TrendingUp className="w-3 h-3" />}
              {isNegative && <TrendingDown className="w-3 h-3" />}
              {isNeutral && <Minus className="w-3 h-3" />}
              <span>
                {isPositive ? '+' : ''}{change}% so với hôm qua
              </span>
            </div>
          )}
        </div>

        {/* Icon */}
        <div className={cn(
          'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3',
          'bg-primary/10',
        )}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
      </div>
    </div>
  );
}
