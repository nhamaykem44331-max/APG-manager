'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  Plane,
  Users,
  Wallet,
  Search as SearchIcon,
  BarChart3,
  Settings,
  Files,
  LogOut,
  Target,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';
import { useUIStore } from '@/stores/ui.store';

const TOP_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/bookings', label: 'Bookings', icon: Plane },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/finance', label: 'Finance', icon: Wallet },
  { href: '/invoice', label: 'Invoice', icon: Files },
];

const ANALYTICS_ITEMS = [
  { href: '/sales', label: 'Sales Pipeline', icon: Target },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
];

const EXTERNAL_ITEMS = [
  { href: 'https://book.tanphuapg.com', label: 'Tra cứu giá', icon: ExternalLink, external: true },
];

const SETTINGS_ITEMS = [
  { href: '/settings', label: 'Settings', icon: Settings },
];

function NavItem({
  item,
  isActive,
  collapsed,
}: {
  item: { href: string; label: string; icon: React.ElementType; external?: boolean };
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const content = (
    <div
      title={collapsed ? item.label : undefined}
      className={cn(
        'group flex items-center transition-all duration-200',
        collapsed
          ? 'mx-auto h-10 w-10 justify-center rounded-xl'
          : 'mx-3 h-[32px] rounded-md px-2.5',
        isActive
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4 flex-shrink-0',
          !collapsed && 'mr-2.5',
          isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground',
        )}
        strokeWidth={isActive ? 2 : 1.5}
      />
      {!collapsed && <span className="flex-1 truncate text-[13px]">{item.label}</span>}
      {!collapsed && item.external && <ExternalLink className="ml-1 h-3 w-3 text-muted-foreground/50" />}
    </div>
  );

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noreferrer" className="block focus:outline-none">
        {content}
      </a>
    );
  }

  return (
    <Link href={item.href} className="block focus:outline-none">
      {content}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  let userName = session?.user?.name || 'Vũ Đức Anh';
  if (userName.toLowerCase() === 'admin' || userName === 'Administrator' || userName === 'Đức Anh') {
    userName = 'Vũ Đức Anh';
  }
  const roleName = session?.user?.role || 'ADMIN';
  const initial = userName.charAt(0).toUpperCase();

  if (!mounted) {
    return (
      <aside className="relative flex h-screen flex-shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 ease-out w-[240px]" />
    );
  }

  return (
    <aside
      className={cn(
        'relative flex h-screen flex-shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 ease-out',
        sidebarCollapsed ? 'w-[84px]' : 'w-[240px]',
      )}
    >
      <button
        type="button"
        onClick={toggleSidebar}
        title={sidebarCollapsed ? 'Mở rộng menu' : 'Thu gọn menu'}
        className="absolute right-0 top-6 z-20 hidden h-7 w-7 translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground lg:flex"
      >
        {sidebarCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>

      <div
        className={cn(
          'mx-2 mt-2 flex h-14 select-none items-center',
          sidebarCollapsed ? 'justify-center px-0' : 'justify-start pl-4 pr-3',
        )}
      >
        <div className={cn('flex min-w-0 items-center', sidebarCollapsed ? 'justify-center' : 'gap-2.5')}>
          <div className="relative flex h-7 w-7 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted">
            <Plane className="h-[14px] w-[14px] rotate-45 transform text-muted-foreground" />
            <img
              src="/logo-apg.png"
              alt="Logo"
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          {!sidebarCollapsed && (
            <span className="truncate text-[14px] font-bold tracking-tight text-foreground">
              APG RMS Manager
            </span>
          )}
        </div>
      </div>

      <div className={cn('py-2', sidebarCollapsed ? 'px-2' : 'px-3')}>
        {sidebarCollapsed ? (
          <button
            type="button"
            title="Tìm kiếm"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-transparent text-muted-foreground transition-all hover:bg-accent hover:text-foreground mx-auto"
          >
            <SearchIcon className="h-4 w-4" />
          </button>
        ) : (
          <div className="group relative flex items-center">
            <SearchIcon className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Find..."
              className="h-[32px] w-full rounded-md border border-border bg-transparent pl-8 pr-6 text-[13px] text-foreground placeholder:text-muted-foreground/70 transition-all focus:outline-none focus:border-muted-foreground/30 focus:ring-1 focus:ring-muted-foreground/30"
            />
            <div className="pointer-events-none absolute right-2 flex h-4 w-4 items-center justify-center rounded-[4px] border border-border bg-accent/50 text-[10px] font-medium text-muted-foreground">
              F
            </div>
          </div>
        )}
      </div>

      <nav className="custom-scrollbar flex-1 overflow-y-auto pb-4 pt-1">
        <div className="space-y-0.5">
          {TOP_ITEMS.map((item) => (
            <NavItem key={item.href} item={item} isActive={isActive(item.href)} collapsed={sidebarCollapsed} />
          ))}
        </div>

        <div className={cn('mb-2 mt-6', sidebarCollapsed ? 'px-0' : 'px-5')}>
          {sidebarCollapsed ? <div className="mx-auto h-px w-8 bg-border/70" /> : (
            <p className="select-none text-[11px] font-medium tracking-wide text-muted-foreground">ANALYTICS</p>
          )}
        </div>
        <div className="space-y-0.5">
          {ANALYTICS_ITEMS.map((item) => (
            <NavItem key={item.href} item={item} isActive={isActive(item.href)} collapsed={sidebarCollapsed} />
          ))}
        </div>

        <div className={cn('mb-2 mt-6', sidebarCollapsed ? 'px-0' : 'px-5')}>
          {sidebarCollapsed ? <div className="mx-auto h-px w-8 bg-border/70" /> : (
            <p className="select-none text-[11px] font-medium tracking-wide text-muted-foreground">WORKSPACE</p>
          )}
        </div>
        <div className="space-y-0.5">
          {EXTERNAL_ITEMS.map((item) => (
            <NavItem key={item.href} item={item} isActive={isActive(item.href)} collapsed={sidebarCollapsed} />
          ))}
          {SETTINGS_ITEMS.map((item) => (
            <NavItem key={item.href} item={item} isActive={isActive(item.href)} collapsed={sidebarCollapsed} />
          ))}
        </div>
      </nav>

      <div className="mt-auto border-t border-border p-3">
        {sidebarCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <div
              title={userName}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#FF4D4D] to-[#F9CB28] text-[11px] font-semibold text-white shadow-sm"
            >
              {initial}
            </div>
            <button
              onClick={() => signOut()}
              title="Đăng xuất"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-red-500"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex h-10 cursor-pointer select-none items-center justify-between rounded-md px-2 transition-colors hover:bg-accent/50">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF4D4D] to-[#F9CB28] text-[11px] font-semibold text-white shadow-sm">
                {initial}
              </div>
              <span className="max-w-[100px] truncate text-[13px] font-medium text-foreground">{userName}</span>
              <div className="flex h-4 flex-shrink-0 items-center justify-center rounded-full border border-border/50 bg-accent px-1.5 text-[9px] font-semibold uppercase text-muted-foreground">
                {roleName}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                signOut();
              }}
              className="flex rounded p-1 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              title="Đăng xuất"
            >
              <LogOut className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-colors hover:text-red-500" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
