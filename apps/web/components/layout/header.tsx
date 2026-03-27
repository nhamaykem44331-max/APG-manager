// APG Manager RMS - Vercel-style Header
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useSession } from 'next-auth/react';
import {
  Menu, ChevronDown, MoreHorizontal, Bell,
  Sun, Moon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { useState, useEffect } from 'react';

// Map path -> breadcrumb label
const BREADCRUMB_MAP: Record<string, string> = {
  dashboard: 'Overview',
  bookings: 'Bookings',
  customers: 'Customers',
  finance: 'Finance',
  invoice: 'Invoice',
  flights: 'Flights',
  reports: 'Reports',
  settings: 'Settings',
  new: 'Tạo mới',
  sales: 'Sales Pipeline',
};

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const { setMobileSidebarOpen } = useUIStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Tạo breadcrumb từ pathname
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: BREADCRUMB_MAP[seg] ?? seg,
    href: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  if (!mounted) {
    return <header className="h-[52px] border-b border-border bg-background flex-shrink-0" />;
  }

  return (
    <header className="h-[52px] border-b border-border bg-background flex items-center justify-between px-4 sm:px-6 flex-shrink-0">
      
      {/* Left / Mobile menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="lg:hidden p-1.5 -ml-2 rounded-md hover:bg-accent text-muted-foreground"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Center Breadcrumbs */}
      <div className="absolute left-[50%] -translate-x-[50%] hidden md:flex items-center">
        <nav className="flex items-center text-[13px] whitespace-nowrap">
          <span className="text-muted-foreground">Observability</span>
          <span className="mx-2 text-muted-foreground/40 font-light">/</span>
          {breadcrumbs.length > 0 ? (
            breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center">
                {i > 0 && <span className="mx-2 text-muted-foreground/40 font-light">/</span>}
                {crumb.isLast ? (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors">
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))
          ) : (
            <span className="text-foreground font-medium">Overview</span>
          )}
        </nav>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        <button 
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent text-muted-foreground transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <button className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent text-muted-foreground transition-colors">
          <Bell className="w-4 h-4" />
        </button>
        <button className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-accent text-muted-foreground transition-colors">
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

    </header>
  );
}
