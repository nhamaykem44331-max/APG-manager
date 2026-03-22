// APG Manager RMS - Header (breadcrumb, dark mode, thông báo, user menu)
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import {
  Sun, Moon, Bell, Menu, ChevronRight,
  User, LogOut, Settings, KeyRound,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { useState, useEffect } from 'react';

// Map path -> breadcrumb label tiếng Việt
const BREADCRUMB_MAP: Record<string, string> = {
  dashboard: 'Dashboard',
  bookings: 'Đặt vé & Booking',
  customers: 'Khách hàng',
  finance: 'Tài chính',
  flights: 'Tra cứu giá vé',
  reports: 'Báo cáo',
  settings: 'Cài đặt',
  new: 'Tạo mới',
};

export function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const { setMobileSidebarOpen } = useUIStore();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
    return (
      <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4 flex-shrink-0" />
    );
  }

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-4 flex-shrink-0">
      {/* Mobile: hamburger menu */}
      <button
        onClick={() => setMobileSidebarOpen(true)}
        className="lg:hidden p-1.5 rounded-md hover:bg-accent transition-colors"
        aria-label="Mở menu"
      >
        <Menu className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 flex-1 min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            )}
            {crumb.isLast ? (
              <span className="text-sm truncate text-foreground font-medium">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="text-sm truncate text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Dark mode toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-md hover:bg-accent transition-colors"
          aria-label="Chuyển dark/light mode"
        >
          {theme === 'dark'
            ? <Sun className="w-4 h-4 text-muted-foreground" />
            : <Moon className="w-4 h-4 text-muted-foreground" />
          }
        </button>

        {/* Notification bell */}
        <button className="relative p-2 rounded-md hover:bg-accent transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          {/* Badge số thông báo chưa đọc */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md',
              'hover:bg-accent transition-colors',
            )}
          >
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground hidden sm:block max-w-28 truncate">
              {session?.user?.name ?? '...'}
            </span>
          </button>

          {/* Dropdown menu */}
          {userMenuOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className={cn(
                'absolute right-0 top-full mt-1 z-20',
                'w-52 rounded-lg border border-border bg-card shadow-lg',
                'py-1 animate-fade-in',
              )}>
                {/* User info */}
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-foreground truncate">
                    {session?.user?.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {session?.user?.email}
                  </p>
                </div>

                <MenuItem icon={Settings} label="Cài đặt" href="/settings" />
                <MenuItem icon={KeyRound} label="Đổi mật khẩu" href="/settings/password" />

                <div className="border-t border-border mt-1 pt-1">
                  <button
                    onClick={() => signOut({ callbackUrl: '/auth/login' })}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-sm',
                      'text-red-500 hover:bg-red-500/10 transition-colors',
                    )}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Đăng xuất
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

// Item trong dropdown menu
function MenuItem({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-accent transition-colors"
    >
      <Icon className="w-3.5 h-3.5 text-muted-foreground" />
      {label}
    </a>
  );
}
