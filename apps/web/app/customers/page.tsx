// APG Manager RMS - Danh sách Khách hàng (CRM)
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Plus, Search, Users, Star, Building2,
  Phone, Mail, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { customersApi } from '@/lib/api';
import {
  cn, formatVND, formatDate, VIP_TIER_LABELS,
} from '@/lib/utils';
import type { Customer } from '@/types';

const VIP_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'PLATINUM', label: '💎 Platinum' },
  { key: 'GOLD', label: '⭐ Vàng' },
  { key: 'SILVER', label: '✨ Bạc' },
  { key: 'NORMAL', label: 'Thường' },
];

const TYPE_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'INDIVIDUAL', label: '👤 Cá nhân' },
  { key: 'CORPORATE', label: '🏢 Doanh nghiệp' },
];

// Màu VIP tier
const VIP_BADGE: Record<string, string> = {
  PLATINUM: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  GOLD:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  SILVER:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  NORMAL:   'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export default function CustomersPage() {
  const [search, setSearch] = useState('');
  const [vipFilter, setVipFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, vipFilter, typeFilter, page],
    queryFn: () => customersApi.list({
      search: search || undefined,
      vipTier: vipFilter || undefined,
      type: typeFilter || undefined,
      page, pageSize,
    } as Record<string, string | number>),
    select: (r) => r.data,
  });

  const customers: Customer[] = data?.data ?? SAMPLE_CUSTOMERS;
  const total: number = data?.total ?? SAMPLE_CUSTOMERS.length;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-5 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Khách hàng</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            CRM · {total.toLocaleString('vi-VN')} khách hàng
          </p>
        </div>
        <Link
          href="/customers/new"
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Thêm khách hàng
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng khách', value: total, icon: Users, color: 'text-blue-500' },
          { label: 'Platinum', value: 3, icon: Star, color: 'text-purple-500' },
          { label: 'Doanh nghiệp', value: 12, icon: Building2, color: 'text-orange-500' },
          { label: 'Mới tháng này', value: 8, icon: Plus, color: 'text-green-500' },
        ].map((s) => (
          <div key={s.label} className="card px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <s.icon className={cn('w-4 h-4', s.color)} />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tên, SĐT, email, công ty..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className={cn(
              'w-full pl-8 pr-3 py-2 text-sm rounded-md bg-background border border-border',
              'text-foreground placeholder:text-muted-foreground',
              'focus:outline-none focus:ring-1 focus:ring-primary',
            )}
          />
        </div>

        {/* Type filter */}
        <div className="flex gap-1">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => { setTypeFilter(f.key); setPage(1); }}
              className={cn(
                'px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
                typeFilter === f.key
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-accent',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* VIP tabs */}
      <div className="flex gap-1 flex-wrap">
        {VIP_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => { setVipFilter(f.key); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors',
              vipFilter === f.key
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Customer grid / table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {['Khách hàng', 'Liên hệ', 'Loại', 'VIP', 'Tổng chi', 'Booking', 'Ngày tạo'].map((h) => (
                  <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-muted rounded" />
                      </td>
                    ))}
                  </tr>
                ))
                : customers.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-accent/40 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/customers/${c.id}`}
                  >
                    {/* Tên */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {c.fullName.split(' ').pop()?.charAt(0) ?? '?'}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{c.fullName}</p>
                          {c.companyName && (
                            <p className="text-xs text-muted-foreground">{c.companyName}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Liên hệ */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1 text-xs text-foreground">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {c.phone}
                        </div>
                        {c.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3" />
                            <span className="truncate max-w-36">{c.email}</span>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Loại */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                        c.type === 'CORPORATE'
                          ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      )}>
                        {c.type === 'CORPORATE' ? '🏢 DN' : '👤 Cá nhân'}
                      </span>
                    </td>

                    {/* VIP */}
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-block px-2 py-0.5 rounded-full text-[10px] font-medium',
                        VIP_BADGE[c.vipTier] ?? VIP_BADGE.NORMAL,
                      )}>
                        {VIP_TIER_LABELS[c.vipTier]}
                      </span>
                    </td>

                    {/* Tổng chi */}
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-foreground">
                        {formatVND(c.totalSpent)}
                      </span>
                    </td>

                    {/* Số booking */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-foreground">{c.totalBookings}</span>
                    </td>

                    {/* Ngày tạo */}
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {formatDate(c.createdAt)}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Hiển thị {customers.length} / {total} khách hàng
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4 text-muted-foreground" />
            </button>
            <span className="text-xs px-2 text-foreground">{page} / {totalPages || 1}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded hover:bg-accent disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dữ liệu mẫu
const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: '1', fullName: 'Nguyễn Văn Minh', phone: '0901234567',
    email: 'minh@example.com', type: 'INDIVIDUAL', vipTier: 'GOLD',
    totalSpent: 85_000_000, totalBookings: 24, tags: ['thường_bay_SGN'],
    createdAt: '2024-01-15T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: '2', fullName: 'Công ty TNHH Thép Miền Bắc', phone: '0243456789',
    email: 'booking@thepmienbac.vn', type: 'CORPORATE', companyName: 'Thép Miền Bắc',
    companyTaxId: '0123456789', vipTier: 'PLATINUM',
    totalSpent: 450_000_000, totalBookings: 120, tags: ['VIP', 'doanh_nghiep'],
    createdAt: '2023-06-01T00:00:00Z', updatedAt: '2026-03-10T00:00:00Z',
  },
  {
    id: '3', fullName: 'Trần Thị Hoa', phone: '0912345678',
    email: 'hoa.tran@gmail.com', type: 'INDIVIDUAL', vipTier: 'SILVER',
    totalSpent: 18_500_000, totalBookings: 7, tags: [],
    createdAt: '2025-03-20T00:00:00Z', updatedAt: '2026-02-15T00:00:00Z',
  },
  {
    id: '4', fullName: 'Lê Quốc Hùng', phone: '0923456789',
    type: 'INDIVIDUAL', vipTier: 'NORMAL',
    totalSpent: 5_200_000, totalBookings: 2, tags: [],
    createdAt: '2026-01-10T00:00:00Z', updatedAt: '2026-01-10T00:00:00Z',
  },
];
