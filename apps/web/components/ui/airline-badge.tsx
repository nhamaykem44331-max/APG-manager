'use client';
import { getAirlineLogo, getAirlineName } from '@/lib/airline-utils';
import { cn } from '@/lib/utils';

interface AirlineBadgeProps {
  code: string;
  showName?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

export function AirlineBadge({ code, showName = true, size = 'sm', className }: AirlineBadgeProps) {
  const imgSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <img
        src={getAirlineLogo(code, size === 'sm' ? 32 : 64)}
        alt={code}
        className={cn(imgSize, 'rounded-sm object-contain')}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
      {showName ? (
        <span className="text-[13px]">{getAirlineName(code)}</span>
      ) : (
        <span className="text-[13px] font-mono">{code}</span>
      )}
    </span>
  );
}
