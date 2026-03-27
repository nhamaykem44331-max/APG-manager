import * as React from 'react';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (val: string) => void;
  filters?: React.ReactNode;
}

export function FilterBar({
  searchPlaceholder = 'Tìm kiếm...',
  searchValue,
  onSearchChange,
  filters,
  className,
  ...props
}: FilterBarProps) {
  return (
    <div
      className={cn(
        'mb-3 flex flex-col flex-wrap items-start gap-1.5 sm:flex-row sm:items-center',
        className,
      )}
      {...props}
    >
      {/* Search Input */}
      {onSearchChange !== undefined && (
        <div className="relative w-full flex-shrink-0 sm:w-[280px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-[34px] w-full rounded-lg border border-border/80 bg-card/60 pl-8 pr-3 text-[12px] outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Additional Filters */}
      {filters && (
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {filters}
        </div>
      )}
    </div>
  );
}
