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
import { PageHeader } from '@/components/ui/page-header';
import { FilterBar } from '@/components/ui/filter-bar';
import { DataTable } from '@/components/ui/data-table';
import { X, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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

// Màu VIP tier dạng chấm tròn (Vercel style)
const VIP_DOT: Record<string, string> = {
  PLATINUM: 'bg-purple-500',
  GOLD:     'bg-amber-500',
  SILVER:   'bg-slate-400',
  NORMAL:   'bg-muted-foreground/40',
};

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [vipFilter, setVipFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Add Customer Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: '', phone: '', email: '', type: 'INDIVIDUAL', vipTier: 'NORMAL',
    companyName: '', companyTaxId: '', passport: '', idNumber: '',
  });

  const generateRandomKey = (length: number) => {
    return Math.random().toString(36).substring(2, 2 + length);
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => customersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowAddModal(false);
      setAddForm({
        fullName: '', phone: '', email: '', type: 'INDIVIDUAL', vipTier: 'NORMAL',
        companyName: '', companyTaxId: '', passport: '', idNumber: '',
      });
    },
  });

  const { data, isLoading, isError, refetch } = useQuery({
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

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-destructive">Không thể tải danh sách khách hàng. Vui lòng thử lại.</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 text-xs rounded-md border border-border hover:bg-accent"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] space-y-6">
      {/* Header */}
      <PageHeader
        title="Khách hàng"
        description={`CRM · ${total.toLocaleString('vi-VN')} khách hàng`}
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 h-9 rounded-md text-[13px] font-medium bg-foreground text-background hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            Thêm mới
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tổng khách', value: total, icon: Users, color: 'text-blue-500' },
          { label: 'Platinum', value: 3, icon: Star, color: 'text-purple-500' },
          { label: 'Doanh nghiệp', value: 12, icon: Building2, color: 'text-orange-500' },
          { label: 'Mới tháng này', value: 8, icon: Plus, color: 'text-green-500' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex flex-col justify-between min-h-[100px]">
            <div className="flex items-start justify-between">
              <p className="text-[13px] font-medium text-muted-foreground">{s.label}</p>
              <s.icon className={cn('w-4 h-4', s.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold font-tabular tracking-tight text-foreground">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {/* Filters */}
        <FilterBar
          searchPlaceholder="Tên, SĐT, email..."
          searchValue={search}
          onSearchChange={(v) => { setSearch(v); setPage(1); }}
          filters={
            <>
              {/* Type filter */}
              <div className="flex gap-1 border-r border-border pr-3 mr-1">
                {TYPE_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setTypeFilter(f.key); setPage(1); }}
                    className={cn(
                      'px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                      typeFilter === f.key
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-accent border border-transparent hover:border-border',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              {/* VIP tabs */}
              <div className="flex gap-1 flex-wrap">
                {VIP_FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => { setVipFilter(f.key); setPage(1); }}
                    className={cn(
                      'px-2.5 py-1.5 rounded-md text-[13px] font-medium transition-colors',
                      vipFilter === f.key
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-accent border border-transparent hover:border-border',
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </>
          }
        />

      {/* Customer table */}
      <DataTable
        data={customers}
        isLoading={isLoading}
        onRowClick={(c) => window.location.href = `/customers/${c.id}`}
        columns={[
          {
            header: 'Khách hàng',
            cell: (c) => (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm bg-accent flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-foreground">
                    {c.fullName.split(' ').pop()?.charAt(0) ?? '?'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-foreground">{c.fullName}</p>
                  {c.companyName && (
                    <p className="text-[11px] text-muted-foreground">{c.companyName}</p>
                  )}
                </div>
              </div>
            ),
          },
          {
            header: 'Liên hệ',
            cell: (c) => (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5 text-foreground">
                  <Phone className="w-3 h-3 text-muted-foreground" />
                  {c.phone}
                </div>
                {c.email && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Mail className="w-3 h-3" />
                    <span className="truncate max-w-36">{c.email}</span>
                  </div>
                )}
              </div>
            ),
          },
          {
            header: 'Loại',
            cell: (c) => (
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  c.type === 'CORPORATE' ? 'bg-orange-500' : 'bg-blue-500',
                )} />
                <span className="text-[13px] text-muted-foreground">
                  {c.type === 'CORPORATE' ? 'Doanh nghiệp' : 'Cá nhân'}
                </span>
              </div>
            ),
          },
          {
            header: 'VIP',
            cell: (c) => (
              <div className="flex items-center gap-1.5">
                <div className={cn('w-1.5 h-1.5 rounded-full', VIP_DOT[c.vipTier] ?? VIP_DOT.NORMAL)} />
                <span className="text-[13px] text-muted-foreground">
                  {VIP_TIER_LABELS[c.vipTier]}
                </span>
              </div>
            ),
          },
          {
            header: 'Tổng chi',
            cell: (c) => (
              <span className="font-medium inline-block font-tabular text-foreground">
                {formatVND(c.totalSpent)}
              </span>
            ),
            className: 'text-right',
          },
          {
            header: 'Booking',
            accessorKey: 'totalBookings',
            className: 'text-center text-muted-foreground font-tabular',
          },
          {
            header: 'Ngày tạo',
            cell: (c) => <span className="text-muted-foreground font-tabular">{formatDate(c.createdAt)}</span>,
            className: 'text-right',
          },
        ]}
        pageIndex={page - 1}
        pageCount={totalPages || 1}
        canPreviousPage={page > 1}
        canNextPage={page < (totalPages || 1)}
        previousPage={() => setPage(p => p - 1)}
        nextPage={() => setPage(p => p + 1)}
        totalRecords={total}
      />
      </div>

      {/* TẠO MỚI KHÁCH HÀNG MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" /> Thêm khách hàng mới
              </h2>
              <button onClick={() => setShowAddModal(false)} className="hover:bg-accent p-1 rounded-md transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex-1 space-y-5">
              <div className="flex gap-2 p-1 bg-accent/50 rounded-lg w-max mb-2">
                <button type="button" onClick={() => setAddForm(f => ({ ...f, type: 'INDIVIDUAL' }))}
                  className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all", addForm.type === 'INDIVIDUAL' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >👤 Cá nhân</button>
                <button type="button" onClick={() => setAddForm(f => ({ ...f, type: 'CORPORATE' }))}
                  className={cn("px-4 py-1.5 text-xs font-medium rounded-md transition-all", addForm.type === 'CORPORATE' ? "bg-orange-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >🏢 Doanh nghiệp</button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Họ và tên *</label>
                  <input type="text" placeholder="Tên khách hàng" required value={addForm.fullName}
                    onChange={(e) => setAddForm(f => ({ ...f, fullName: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Số điện thoại *</label>
                  <input type="tel" placeholder="09..." required value={addForm.phone}
                    onChange={(e) => setAddForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Hạng thành viên</label>
                  <select value={addForm.vipTier} onChange={(e) => setAddForm(f => ({ ...f, vipTier: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none transition-shadow"
                  >
                    <option value="NORMAL">Thường</option>
                    <option value="SILVER">Bạc</option>
                    <option value="GOLD">Vàng</option>
                    <option value="PLATINUM">Platinum</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                  <input type="email" placeholder="example@email.com" value={addForm.email}
                    onChange={(e) => setAddForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">CCCD / CMND</label>
                  <input type="text" placeholder="Căn cước công dân" value={addForm.idNumber}
                    onChange={(e) => setAddForm(f => ({ ...f, idNumber: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Hộ chiếu (Passport)</label>
                  <input type="text" placeholder="Số hộ chiếu" value={addForm.passport}
                    onChange={(e) => setAddForm(f => ({ ...f, passport: e.target.value }))}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none transition-shadow"
                  />
                </div>

                {addForm.type === 'CORPORATE' && (
                  <>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide line-clamp-1">Tên công ty xuất hóa đơn</label>
                      <input type="text" placeholder="Tên công ty..." value={addForm.companyName}
                        onChange={(e) => setAddForm(f => ({ ...f, companyName: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none transition-shadow"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2 sm:col-span-1">
                      <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Mã số thuế</label>
                      <input type="text" placeholder="Mã số thuế..." value={addForm.companyTaxId}
                        onChange={(e) => setAddForm(f => ({ ...f, companyTaxId: e.target.value }))}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-1 focus:ring-primary outline-none transition-shadow"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="px-5 py-4 border-t border-border bg-muted/30 flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg hover:bg-accent transition-colors"
              >Hủy</button>
              <button 
                type="button" 
                onClick={() => createMutation.mutate({ ...addForm, code: 'C' + generateRandomKey(6).toUpperCase() })}
                disabled={!addForm.fullName || !addForm.phone || createMutation.isPending}
                className="px-6 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Lưu khách hàng
              </button>
            </div>
          </div>
        </div>
      )}
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
