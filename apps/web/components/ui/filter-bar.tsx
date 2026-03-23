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
    <div className={cn('flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-wrap mb-4', className)} {...props}>
      {/* Search Input */}
      {onSearchChange !== undefined && (
        <div className="relative w-full sm:w-64 flex-shrink-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-[13px] rounded-md border border-border bg-transparent outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all placeholder:text-muted-foreground"
          />
        </div>
      )}

      {/* Additional Filters */}
      {filters && (
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {filters}
        </div>
      )}
    </div>
  );
}
