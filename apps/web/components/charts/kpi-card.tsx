// APG Manager RMS - KPI Card (Vercel Style + Accent Colors)
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  change?: number;       // % thay đổi so với hôm qua
  loading?: boolean;
  accentColor?: 'blue' | 'emerald' | 'amber' | 'red' | 'purple' | 'default';
}

const ACCENT_CLASSES = {
  blue:    { value: 'text-blue-500',    dot: 'bg-blue-500' },
  emerald: { value: 'text-emerald-500', dot: 'bg-emerald-500' },
  amber:   { value: 'text-amber-500',   dot: 'bg-amber-500' },
  red:     { value: 'text-red-500',     dot: 'bg-red-500' },
  purple:  { value: 'text-purple-500',  dot: 'bg-purple-500' },
  default: { value: 'text-foreground',  dot: 'bg-foreground' },
};

export function KpiCard({
  label,
  value,
  change,
  loading = false,
  accentColor,
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

  const accent = ACCENT_CLASSES[accentColor ?? 'default'];

  return (
    <div className="card p-4">
      <div className="flex flex-col gap-1">
        {/* Label với color dot */}
        <div className="flex items-center gap-2">
          {accentColor && accentColor !== 'default' && (
            <div className={cn('w-1.5 h-1.5 rounded-full', accent.dot)} />
          )}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>

        {/* Value — dùng accent color */}
        <p className={cn(
          'text-2xl font-semibold font-tabular tracking-tight',
          accent.value,
        )}>
          {value}
        </p>

        {/* Change indicator — giữ xanh/đỏ cho tăng/giảm */}
        {change !== undefined && (
          <div className={cn(
            'inline-flex items-center gap-1 mt-1 text-2xs font-medium',
            change > 0 && 'text-emerald-500',
            change < 0 && 'text-red-500',
            change === 0 && 'text-muted-foreground',
          )}>
            <span>
              {change > 0 ? '↑ ' : ''}
              {change < 0 ? '↓ ' : ''}
              {Math.abs(change)}%
            </span>
            <span className="text-muted-foreground text-2xs font-normal ml-0.5">so với trước đó</span>
          </div>
        )}
      </div>
    </div>
  );
}
