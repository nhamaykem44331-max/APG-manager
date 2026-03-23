'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  LayoutDashboard, Plane, Users, Wallet,
  Search as SearchIcon, BarChart3, Settings,
  LogOut, Target, ChevronDown, ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { signOut } from 'next-auth/react';

// Cấu hình menu sidebar
const TOP_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/bookings', label: 'Bookings', icon: Plane },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/finance', label: 'Finance', icon: Wallet },
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

function NavItem({ item, isActive }: { item: any; isActive: boolean }) {
  const Icon = item.icon;
  const content = (
    <div
      className={cn(
        'group flex items-center h-[32px] px-2.5 mx-3 rounded-md transition-colors duration-100',
        isActive
          ? 'bg-accent text-foreground font-medium'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      )}
    >
      <Icon className={cn('w-4 h-4 mr-2.5 flex-shrink-0', isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')} strokeWidth={isActive ? 2 : 1.5} />
      <span className="text-[13px] flex-1 truncate">{item.label}</span>
      {item.external && <ExternalLink className="w-3 h-3 text-muted-foreground/50 ml-1" />}
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  // Xử lý đổi tên admin -> Đức Anh theo yêu cầu
  let userName = session?.user?.name || 'Vũ Đức Anh';
  if (userName.toLowerCase() === 'admin' || userName === 'Administrator' || userName === 'Đức Anh') {
    userName = 'Vũ Đức Anh';
  }
  const roleName = session?.user?.role || 'ADMIN';
  const initial = userName.charAt(0).toUpperCase();

  if (!mounted) {
    return (
      <aside className="relative flex flex-col h-screen border-r bg-background border-border w-[240px] flex-shrink-0" />
    );
  }

  return (
    <aside className="relative flex flex-col h-screen border-r bg-background border-border w-[240px] flex-shrink-0">
      
      {/* Logo Area (Top Left) */}
      <div className="flex items-center h-14 pl-4 pr-3 mx-2 mt-2 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center w-[26px] h-[26px] bg-foreground rounded-lg flex-shrink-0 overflow-hidden">
             {/* Fallback styling for monochrome logo */}
            <Plane className="w-[14px] h-[14px] text-background rotate-45 transform" />
            <img 
              src="/logo-apg.png" 
              alt="Logo" 
              className="absolute inset-0 w-full h-full object-contain grayscale brightness-0 invert dark:brightness-100 dark:invert-0 bg-foreground" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <span className="text-[14px] font-bold tracking-tight text-foreground truncate">
            APG RMS Manager
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-3 py-2">
        <div className="relative group flex items-center">
          <SearchIcon className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Find..." 
            className="w-full h-[32px] pl-8 pr-6 rounded-md bg-transparent border border-border text-[13px] focus:outline-none focus:border-muted-foreground/30 focus:ring-1 focus:ring-muted-foreground/30 transition-all placeholder:text-muted-foreground/70 text-foreground"
          />
          <div className="absolute right-2 flex items-center justify-center w-4 h-4 rounded-[4px] bg-accent/50 border border-border text-[10px] text-muted-foreground font-medium pointer-events-none">
            F
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto pb-4 pt-1 custom-scrollbar">
        <div className="space-y-0.5">
          {TOP_ITEMS.map((item) => <NavItem key={item.href} item={item} isActive={isActive(item.href)} />)}
        </div>

        <div className="mt-6 mb-2 px-5">
          <p className="text-[11px] font-medium text-muted-foreground tracking-wide select-none">ANALYTICS</p>
        </div>
        <div className="space-y-0.5">
          {ANALYTICS_ITEMS.map((item) => <NavItem key={item.href} item={item} isActive={isActive(item.href)} />)}
        </div>

        <div className="mt-6 mb-2 px-5">
          <p className="text-[11px] font-medium text-muted-foreground tracking-wide select-none">WORKSPACE</p>
        </div>
        <div className="space-y-0.5">
          {EXTERNAL_ITEMS.map((item) => <NavItem key={item.href} item={item} isActive={isActive(item.href)} />)}
          {SETTINGS_ITEMS.map((item) => <NavItem key={item.href} item={item} isActive={isActive(item.href)} />)}
        </div>
      </nav>

      {/* Bottom User Area */}
      <div className="p-3 border-t border-border mt-auto">
        <div className="flex justify-between items-center h-10 px-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer select-none">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-[22px] h-[22px] rounded-full bg-gradient-to-br from-[#FF4D4D] to-[#F9CB28] flex items-center justify-center flex-shrink-0 text-white font-semibold text-[11px] shadow-sm">
              {initial}
            </div>
            <span className="text-[13px] font-medium text-foreground truncate max-w-[100px]">{userName}</span>
            <div className="flex items-center justify-center px-1.5 h-4 rounded-full bg-accent text-[9px] text-muted-foreground font-semibold flex-shrink-0 border border-border/50 uppercase">
              {roleName}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); signOut(); }} className="flex p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors" title="Đăng xuất">
            <LogOut className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 hover:text-red-500 transition-colors" />
          </button>
        </div>
      </div>

    </aside>
  );
}
