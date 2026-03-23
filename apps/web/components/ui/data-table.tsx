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
  pageIndex,
  pageCount,
  canPreviousPage,
  canNextPage,
  previousPage,
  nextPage,
  totalRecords,
}: DataTableProps<T>) {
  return (
    <div className="flex flex-col w-full">
      <div className="w-full overflow-hidden rounded-[8px] border border-border bg-card">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border">
                {columns.map((col, i) => (
                  <th
                    key={i}
                    className={cn(
                      'py-3 px-4 font-medium text-[13px] text-muted-foreground whitespace-nowrap bg-background',
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
                      <td key={`skeleton-td-${j}`} className={cn('py-3 px-4', col.className)}>
                        <div className="h-4 bg-muted/60 animate-pulse rounded w-3/4" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                // Empty state
                <tr>
                  <td colSpan={columns.length} className="py-12 text-center bg-background text-[13px] text-muted-foreground">
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
                      onRowClick ? 'cursor-pointer hover:bg-accent/40' : 'hover:bg-accent/10'
                    )}
                  >
                    {columns.map((col, j) => (
                      <td key={j} className={cn('py-3 px-4 text-[13px] text-foreground', col.className)}>
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-background">
            <div className="text-[13px] text-muted-foreground">
              {totalRecords !== undefined ? `Total: ${totalRecords}` : `Page ${pageIndex! + 1} of ${pageCount}`}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={previousPage}
                disabled={!canPreviousPage}
                className="flex items-center justify-center w-7 h-7 rounded border border-transparent hover:border-border hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-foreground/70" />
              </button>
              <button
                onClick={nextPage}
                disabled={!canNextPage}
                className="flex items-center justify-center w-7 h-7 rounded border border-transparent hover:border-border hover:bg-accent disabled:opacity-50 disabled:pointer-events-none transition-colors"
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
