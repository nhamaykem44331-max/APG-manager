import * as React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
      {...props}
    >
      <div>
        <h1 className="text-sm font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <div className="mt-0.5 text-[12px] text-muted-foreground">{description}</div>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-1.5">
          {actions}
        </div>
      )}
    </div>
  );
}
