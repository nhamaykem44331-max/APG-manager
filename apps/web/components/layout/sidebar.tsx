// APG Manager RMS - Sidebar Navigation (collapsible, mobile-friendly)
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard, Plane, Users, Wallet,
  Search, BarChart3, Settings, ChevronLeft,
  ChevronRight, Building2, LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui.store';
import { signOut } from 'next-auth/react';

// Cấu hình menu sidebar
const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/bookings', label: 'Đặt vé', icon: Plane },
  { href: '/customers', label: 'Khách hàng', icon: Users },
  { href: '/finance', label: 'Tài chính', icon: Wallet },
  { href: '/flights', label: 'Tra cứu giá', icon: Search },
  { href: '/reports', label: 'Báo cáo', icon: BarChart3 },
];

const BOTTOM_ITEMS = [
  { href: '/settings', label: 'Cài đặt', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  // Tránh hydration mismatch - render skeleton khi chưa mount
  if (!mounted) {
    return (
      <aside className="relative flex flex-col h-screen border-r bg-card border-border w-[260px]">
        <div className="flex items-center h-16 border-b border-border px-4 gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary" />
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        'relative flex flex-col h-screen border-r transition-all duration-300 ease-in-out',
        'bg-card border-border',
        sidebarCollapsed ? 'w-16' : 'w-[260px]',
      )}
    >
      {/* Logo & Brand */}
      <div className={cn(
        'flex items-center h-16 border-b border-border px-4 flex-shrink-0',
        sidebarCollapsed ? 'justify-center' : 'gap-3',
      )}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Plane className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-foreground leading-tight">APG Manager</p>
            <p className="text-[10px] text-muted-foreground leading-tight">Tân Phú APG</p>
          </div>
        )}
      </div>

      {/* Navigation chính */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            collapsed={sidebarCollapsed}
          />
        ))}
      </nav>

      {/* Bottom items */}
      <div className="px-2 py-2 border-t border-border space-y-0.5">
        {BOTTOM_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            item={item}
            isActive={isActive(item.href)}
            collapsed={sidebarCollapsed}
          />
        ))}

        {/* User info & logout */}
        <div className={cn(
          'flex items-center mt-2 px-2 py-2 rounded-lg',
          'hover:bg-accent cursor-pointer transition-colors',
          sidebarCollapsed ? 'justify-center' : 'gap-3',
        )}
          onClick={() => signOut({ callbackUrl: '/auth/login' })}
        >
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-primary" />
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium truncate text-foreground">
                  {session?.user?.name ?? 'Loading...'}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {session?.user?.role ?? ''}
                </p>
              </div>
              <LogOut className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            </>
          )}
        </div>
      </div>

      {/* Toggle collapse button */}
      <button
        onClick={toggleSidebar}
        className={cn(
          'absolute -right-3 top-20 z-10',
          'w-6 h-6 rounded-full border border-border bg-card',
          'flex items-center justify-center',
          'hover:bg-accent transition-colors shadow-sm',
        )}
        aria-label={sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}
      >
        {sidebarCollapsed
          ? <ChevronRight className="w-3 h-3 text-muted-foreground" />
          : <ChevronLeft className="w-3 h-3 text-muted-foreground" />
        }
      </button>
    </aside>
  );
}

// Component từng item menu
function NavItem({
  item,
  isActive,
  collapsed,
}: {
  item: { href: string; label: string; icon: React.ElementType };
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center rounded-lg px-2 py-2 text-sm transition-all duration-150',
        'hover:bg-accent hover:text-accent-foreground',
        collapsed ? 'justify-center' : 'gap-3',
        isActive
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground',
      )}
    >
      <Icon className={cn(
        'w-4 h-4 flex-shrink-0',
        isActive ? 'text-primary' : 'text-muted-foreground',
      )} />
      {!collapsed && (
        <span className="truncate">{item.label}</span>
      )}
      {/* Active indicator */}
      {isActive && !collapsed && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary" />
      )}
    </Link>
  );
}
