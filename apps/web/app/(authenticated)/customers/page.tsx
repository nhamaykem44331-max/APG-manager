'use client';

import { useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Building2,
  Loader2,
  Mail,
  Phone,
  Plus,
  Star,
  Users,
  X,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { FilterBar } from '@/components/ui/filter-bar';
import { DataTable } from '@/components/ui/data-table';
import { customersApi } from '@/lib/api';
import { cn, formatDate, formatVND, VIP_TIER_LABELS } from '@/lib/utils';
import type { Customer } from '@/types';

const VIP_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'PLATINUM', label: 'Platinum' },
  { key: 'GOLD', label: 'Vàng' },
  { key: 'SILVER', label: 'Bạc' },
  { key: 'NORMAL', label: 'Thường' },
];

const TYPE_FILTERS = [
  { key: '', label: 'Tất cả' },
  { key: 'INDIVIDUAL', label: 'Cá nhân' },
  { key: 'CORPORATE', label: 'Doanh nghiệp' },
];

const VIP_DOT: Record<string, string> = {
  PLATINUM: 'bg-purple-500',
  GOLD: 'bg-amber-500',
  SILVER: 'bg-slate-400',
  NORMAL: 'bg-muted-foreground/40',
};

function getCustomerCodeBadgeClass(type?: string) {
  return type === 'CORPORATE'
    ? 'bg-orange-500/12 text-orange-500 border border-orange-500/20'
    : 'bg-primary/10 text-primary border border-primary/20';
}

export default function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [vipFilter, setVipFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    type: 'INDIVIDUAL',
    vipTier: 'NORMAL',
    companyName: '',
    companyTaxId: '',
    passport: '',
    idNumber: '',
  });

  const createMutation = useMutation({
    mutationFn: (data: typeof addForm) => customersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      setShowAddModal(false);
      setAddForm({
        fullName: '',
        phone: '',
        email: '',
        type: 'INDIVIDUAL',
        vipTier: 'NORMAL',
        companyName: '',
        companyTaxId: '',
        passport: '',
        idNumber: '',
      });
    },
  });

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['customers', search, vipFilter, typeFilter, page],
    queryFn: () =>
      customersApi.list({
        search: search || undefined,
        vipTier: vipFilter || undefined,
        type: typeFilter || undefined,
        page,
        pageSize,
      } as Record<string, string | number>),
    select: (response) => response.data,
  });

  const customers: Customer[] = data?.data ?? SAMPLE_CUSTOMERS;
  const total = data?.total ?? SAMPLE_CUSTOMERS.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-sm text-destructive">Không thể tải danh sách khách hàng. Vui lòng thử lại.</p>
        <button
          onClick={() => refetch()}
          className="rounded-md border border-border px-4 py-2 text-xs hover:bg-accent"
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] space-y-5">
      <PageHeader
        title="Khách hàng"
        description={`CRM · ${total.toLocaleString('vi-VN')} khách hàng`}
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-[12px] font-medium text-background transition-all hover:opacity-90 active:scale-[0.98]"
          >
            <Plus className="h-3.5 w-3.5" />
            Thêm mới
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Tổng khách', value: total, icon: Users, color: 'text-blue-500' },
          { label: 'Platinum', value: 3, icon: Star, color: 'text-purple-500' },
          { label: 'Doanh nghiệp', value: 12, icon: Building2, color: 'text-orange-500' },
          { label: 'Mới tháng này', value: 8, icon: Plus, color: 'text-green-500' },
        ].map((item) => (
          <div key={item.label} className="card flex min-h-[88px] flex-col justify-between p-3.5">
            <div className="flex items-start justify-between">
              <p className="text-[12px] font-medium text-muted-foreground">{item.label}</p>
              <item.icon className={cn('h-3.5 w-3.5', item.color)} />
            </div>
            <p className="font-tabular text-[28px] font-bold tracking-tight text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <FilterBar
          searchPlaceholder="Tên, SĐT, email, mã KH..."
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          filters={
            <>
              <div className="mr-0.5 flex gap-1 border-r border-border pr-2.5">
                {TYPE_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => {
                      setTypeFilter(filter.key);
                      setPage(1);
                    }}
                    className={cn(
                      'rounded-lg border border-transparent px-2.5 py-1 text-[12px] font-medium transition-colors',
                      typeFilter === filter.key
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:border-border hover:bg-accent',
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1">
                {VIP_FILTERS.map((filter) => (
                  <button
                    key={filter.key}
                    onClick={() => {
                      setVipFilter(filter.key);
                      setPage(1);
                    }}
                    className={cn(
                      'rounded-lg border border-transparent px-2.5 py-1 text-[12px] font-medium transition-colors',
                      vipFilter === filter.key
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:border-border hover:bg-accent',
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </>
          }
        />

        <DataTable
          data={customers}
          isLoading={isLoading}
          onRowClick={(customer) => {
            window.location.href = `/customers/${customer.id}`;
          }}
          columns={[
            {
              header: 'Khách hàng',
              cell: (customer) => (
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-accent">
                    <span className="text-xs font-bold text-foreground">
                      {customer.fullName.split(' ').pop()?.charAt(0) ?? '?'}
                    </span>
                  </div>
                  <div>
                    <p className="text-[12.5px] font-medium text-foreground">{customer.fullName}</p>
                    {customer.companyName && (
                      <p className="text-[10px] text-muted-foreground">{customer.companyName}</p>
                    )}
                  </div>
                </div>
              ),
            },
            {
              header: 'Liên hệ',
              cell: (customer) => (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-foreground">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {customer.phone}
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="max-w-36 truncate">{customer.email}</span>
                    </div>
                  )}
                </div>
              ),
            },
            {
              header: 'Mã khách hàng',
              cell: (customer) => (
                <span
                  className={cn(
                    'inline-flex min-w-[88px] items-center justify-center rounded-md px-2 py-0.5 text-[11px] font-medium font-mono',
                    customer.customerCode
                      ? getCustomerCodeBadgeClass(customer.type)
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {customer.customerCode || 'Đang cấp mã'}
                </span>
              ),
            },
            {
              header: 'VIP',
              cell: (customer) => (
                <div className="flex items-center gap-1.5">
                  <div className={cn('h-1.5 w-1.5 rounded-full', VIP_DOT[customer.vipTier] ?? VIP_DOT.NORMAL)} />
                  <span className="text-[12px] text-muted-foreground">
                    {VIP_TIER_LABELS[customer.vipTier]}
                  </span>
                </div>
              ),
            },
            {
              header: 'Tổng chi',
              cell: (customer) => (
                <span className="inline-block font-tabular font-medium text-foreground">
                  {formatVND(customer.totalSpent)}
                </span>
              ),
              className: 'text-right',
            },
            {
              header: 'Booking',
              accessorKey: 'totalBookings',
              className: 'text-center font-tabular text-muted-foreground',
            },
            {
              header: 'Ngày tạo',
              cell: (customer) => (
                <span className="font-tabular text-muted-foreground">{formatDate(customer.createdAt)}</span>
              ),
              className: 'text-right',
            },
          ]}
          pageIndex={page - 1}
          pageCount={totalPages}
          canPreviousPage={page > 1}
          canNextPage={page < totalPages}
          previousPage={() => setPage((current) => current - 1)}
          nextPage={() => setPage((current) => current + 1)}
          totalRecords={total}
        />
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-primary" />
                Thêm khách hàng mới
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-md p-1 transition-colors hover:bg-accent"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="mb-2 flex w-max gap-2 rounded-lg bg-accent/50 p-1">
                <button
                  type="button"
                  onClick={() => setAddForm((form) => ({ ...form, type: 'INDIVIDUAL' }))}
                  className={cn(
                    'rounded-md px-4 py-1.5 text-xs font-medium transition-all',
                    addForm.type === 'INDIVIDUAL'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Cá nhân
                </button>
                <button
                  type="button"
                  onClick={() => setAddForm((form) => ({ ...form, type: 'CORPORATE' }))}
                  className={cn(
                    'rounded-md px-4 py-1.5 text-xs font-medium transition-all',
                    addForm.type === 'CORPORATE'
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  Doanh nghiệp
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field label="Họ và tên *">
                  <input
                    type="text"
                    placeholder="Tên khách hàng"
                    value={addForm.fullName}
                    onChange={(event) => setAddForm((form) => ({ ...form, fullName: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary"
                  />
                </Field>

                <Field label="Số điện thoại *">
                  <input
                    type="tel"
                    placeholder="09..."
                    value={addForm.phone}
                    onChange={(event) => setAddForm((form) => ({ ...form, phone: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary"
                  />
                </Field>

                <Field label="Hạng thành viên">
                  <select
                    value={addForm.vipTier}
                    onChange={(event) => setAddForm((form) => ({ ...form, vipTier: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary"
                  >
                    <option value="NORMAL">Thường</option>
                    <option value="SILVER">Bạc</option>
                    <option value="GOLD">Vàng</option>
                    <option value="PLATINUM">Platinum</option>
                  </select>
                </Field>

                <Field label="Email">
                  <input
                    type="email"
                    placeholder="example@email.com"
                    value={addForm.email}
                    onChange={(event) => setAddForm((form) => ({ ...form, email: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary"
                  />
                </Field>

                <Field label="CCCD / CMND">
                  <input
                    type="text"
                    placeholder="Căn cước công dân"
                    value={addForm.idNumber}
                    onChange={(event) => setAddForm((form) => ({ ...form, idNumber: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary"
                  />
                </Field>

                <Field label="Passport">
                  <input
                    type="text"
                    placeholder="Số hộ chiếu"
                    value={addForm.passport}
                    onChange={(event) => setAddForm((form) => ({ ...form, passport: event.target.value }))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary"
                  />
                </Field>

                {addForm.type === 'CORPORATE' && (
                  <>
                    <Field label="Tên công ty xuất hóa đơn">
                      <input
                        type="text"
                        placeholder="Tên công ty..."
                        value={addForm.companyName}
                        onChange={(event) => setAddForm((form) => ({ ...form, companyName: event.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary"
                      />
                    </Field>

                    <Field label="Mã số thuế">
                      <input
                        type="text"
                        placeholder="Mã số thuế..."
                        value={addForm.companyTaxId}
                        onChange={(event) => setAddForm((form) => ({ ...form, companyTaxId: event.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-shadow focus:ring-1 focus:ring-primary"
                      />
                    </Field>
                  </>
                )}
              </div>

              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
                Mã khách hàng sẽ được hệ thống tự động cấp khi lưu.
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-4">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => createMutation.mutate(addForm)}
                disabled={!addForm.fullName || !addForm.phone || createMutation.isPending}
                className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Lưu khách hàng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const SAMPLE_CUSTOMERS: Customer[] = [
  {
    id: '1',
    fullName: 'Nguyen Van Minh',
    phone: '0901234567',
    email: 'minh@example.com',
    type: 'INDIVIDUAL',
    vipTier: 'GOLD',
    customerCode: 'KH000001',
    totalSpent: 85_000_000,
    totalBookings: 24,
    tags: ['thuong_bay_SGN'],
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
  },
  {
    id: '2',
    fullName: 'Cong ty TNHH Thep Mien Bac',
    phone: '0243456789',
    email: 'booking@thepmienbac.vn',
    type: 'CORPORATE',
    companyName: 'Thep Mien Bac',
    companyTaxId: '0123456789',
    vipTier: 'PLATINUM',
    customerCode: 'KH000002',
    totalSpent: 450_000_000,
    totalBookings: 120,
    tags: ['VIP', 'doanh_nghiep'],
    createdAt: '2023-06-01T00:00:00Z',
    updatedAt: '2026-03-10T00:00:00Z',
  },
  {
    id: '3',
    fullName: 'Tran Thi Hoa',
    phone: '0912345678',
    email: 'hoa.tran@gmail.com',
    type: 'INDIVIDUAL',
    vipTier: 'SILVER',
    customerCode: 'KH000003',
    totalSpent: 18_500_000,
    totalBookings: 7,
    tags: [],
    createdAt: '2025-03-20T00:00:00Z',
    updatedAt: '2026-02-15T00:00:00Z',
  },
  {
    id: '4',
    fullName: 'Le Quoc Hung',
    phone: '0923456789',
    type: 'INDIVIDUAL',
    vipTier: 'NORMAL',
    customerCode: 'KH000004',
    totalSpent: 5_200_000,
    totalBookings: 2,
    tags: [],
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  },
];
