'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface ColumnDef<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  compact?: boolean;
  tableClassName?: string;
  // Pagination info
  pageIndex?: number;
  pageCount?: number;
  canPreviousPage?: boolean;
  canNextPage?: boolean;
  previousPage?: () => void;
  nextPage?: () => void;
  totalRecords?: number;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  onRowClick,
  emptyMessage = 'No data available',
  compact = false,
  tableClassName,
  pageIndex,
  pageCount,
  canPreviousPage,
  canNextPage,
  previousPage,
  nextPage,
  totalRecords,
}: DataTableProps<T>) {
  const cellPadding = compact ? 'px-2.5 py-2' : 'px-3.5 py-2.5';
  const headerPadding = compact ? 'bg-muted/20 px-2.5 py-2 text-[11.5px]' : 'bg-muted/20 px-3.5 py-2.5 text-[12px]';
  const bodyText = compact ? 'text-[12px]' : 'text-[12.5px]';

  return (
    <div className="flex flex-col w-full">
      <div className="w-full overflow-hidden rounded-lg border border-border/80 bg-card">
        <div className="w-full overflow-x-auto">
          <table className={cn('w-full text-left border-collapse', tableClassName)}>
            <thead>
              <tr className="border-b border-border">
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={cn(
                      headerPadding,
                      'font-medium text-muted-foreground whitespace-nowrap',
                      col.className
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                // Skeleton loading (5 rows)
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skeleton-${i}`} className="border-b border-border last:border-0 bg-background">
                    {columns.map((col, j) => (
                      <td key={`skeleton-td-${j}`} className={cn(cellPadding, col.className)}>
                        <div className="h-4 bg-muted/60 animate-pulse rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={columns.length} className="bg-background py-10 text-center text-[12px] text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                // Data rows
                data.map((row, i) => (
                  <tr
                    key={i}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={cn(
                      'border-b border-border last:border-0 bg-background transition-colors duration-100 group',
                      onRowClick ? 'cursor-pointer hover:bg-accent/30' : 'hover:bg-accent/10'
                    )}
                  >
                    {columns.map((col, j) => (
                      <td key={j} className={cn(cellPadding, bodyText, 'text-foreground', col.className)}>
                        {col.cell ? col.cell(row) : col.accessorKey ? (row[col.accessorKey] as React.ReactNode) : null}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Vercel-style compact pagination inside the table border */}
        {(pageCount !== undefined && pageCount > 1) && (
          <div className="flex items-center justify-between border-t border-border bg-background px-3.5 py-2.5">
            <div className="text-[12px] text-muted-foreground">
              {totalRecords !== undefined ? `Total: ${totalRecords}` : `Page ${pageIndex! + 1} of ${pageCount}`}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={previousPage}
                disabled={!canPreviousPage}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition-colors hover:border-border hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4 text-foreground/70" />
              </button>
              <button
                onClick={nextPage}
                disabled={!canNextPage}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-transparent transition-colors hover:border-border hover:bg-accent disabled:pointer-events-none disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4 text-foreground/70" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
