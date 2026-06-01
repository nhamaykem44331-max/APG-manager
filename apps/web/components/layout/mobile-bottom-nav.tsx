'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { LayoutDashboard, Plus, Search, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, match: 'dashboard' },
  { href: '/bookings', label: 'Booking', icon: Search, match: 'bookings' },
  { href: '/bookings?queue=ticket', label: 'Ticket', icon: Ticket, match: 'ticket' },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queue = searchParams.get('queue');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2 backdrop-blur lg:hidden">
      <div className="mx-auto grid max-w-md grid-cols-[1fr_1fr_64px_1fr] items-end gap-1">
        {NAV_ITEMS.slice(0, 2).map((item) => {
          const Icon = item.icon;
          const active = item.match === 'dashboard'
            ? pathname.startsWith('/dashboard')
            : pathname.startsWith('/bookings') && queue !== 'ticket';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors',
                active ? 'bg-accent text-foreground' : 'text-muted-foreground active:bg-accent/70',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <Link
          href="/bookings?create=1"
          aria-label="Create Booking"
          className="mx-auto -mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </Link>

        {NAV_ITEMS.slice(2).map((item) => {
          const Icon = item.icon;
          const active = pathname.startsWith('/bookings') && queue === 'ticket';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors',
                active ? 'bg-accent text-foreground' : 'text-muted-foreground active:bg-accent/70',
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
