import * as React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  label: React.ReactNode;
  value: React.ReactNode;
  badge?: React.ReactNode;
}

export function StatCard({ label, value, badge, className, ...props }: StatCardProps) {
  return (
    <div className={cn('bg-accent rounded-lg p-3', className)} {...props}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        {badge && <div>{badge}</div>}
      </div>
      <p className="text-xl font-semibold font-tabular tracking-tight text-foreground mt-1 truncate">
        {value}
      </p>
    </div>
  );
}
