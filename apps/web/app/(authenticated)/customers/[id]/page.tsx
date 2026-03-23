// APG Manager RMS - Chi tiết Khách hàng (Customer Detail Page)
'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, User, Phone, Mail,
  CreditCard, Plane, MessageSquare,
  StickyNote, Loader2, Plus, Pin,
  Send, Building2, TrendingUp, Activity, Shield,
} from 'lucide-react';
import {
  customersApi, customerIntelligenceApi, interactionsApi,
} from '@/lib/api';
import {
  cn, formatVND, formatVNDFull, formatDate, formatDateTime,
  VIP_TIER_LABELS, BOOKING_STATUS_LABELS, BOOKING_STATUS_CLASSES,
} from '@/lib/utils';
import { PageHeader } from '@/components/ui/page-header';
import { DataTable } from '@/components/ui/data-table';
import type {
  Customer, Booking, CustomerInteraction, CustomerNote,
  RfmScore, CustomerStats, TimelineItem,
} from '@/types';

// ===== CONSTANTS =====

const TABS = [
  { key: 'profile', label: 'Hồ sơ', icon: User },
  { key: 'bookings', label: 'Booking', icon: Plane },
  { key: 'interactions', label: 'Tương tác', icon: MessageSquare },
  { key: 'debts', label: 'Công nợ', icon: CreditCard },
  { key: 'notes', label: 'Ghi chú', icon: StickyNote },
] as const;

type TabKey = typeof TABS[number]['key'];

const VIP_BADGE: Record<string, string> = {
  PLATINUM: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  GOLD:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  SILVER:   'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  NORMAL:   'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const CHURN_COLORS: Record<string, string> = {
  LOW: 'text-emerald-500',
  MEDIUM: 'text-yellow-500',
  HIGH: 'text-red-500',
};

const SEGMENT_LABELS: Record<string, { label: string; emoji: string }> = {
  CHAMPION: { label: 'Champion', emoji: '🏆' },
  LOYAL: { label: 'Trung thành', emoji: '💎' },
  POTENTIAL: { label: 'Tiềm năng', emoji: '🌟' },
  NEW: { label: 'Mới', emoji: '🆕' },
  AT_RISK: { label: 'Nguy cơ', emoji: '⚠️' },
  LOST: { label: 'Đã mất', emoji: '❌' },
  REGULAR: { label: 'Thường', emoji: '📋' },
};

const INTERACTION_ICONS: Record<string, string> = {
  CALL: '📞', MEETING: '🤝', MESSAGE: '💬', FOLLOW_UP: '🔄',
  QUOTATION: '📋', COMPLAINT: '⚠️', FEEDBACK: '💡', OTHER: '📌',
};

const INTERACTION_TYPE_LABELS: Record<string, string> = {
  CALL: 'Cuộc gọi', MEETING: 'Gặp mặt', MESSAGE: 'Tin nhắn', FOLLOW_UP: 'Follow-up',
  QUOTATION: 'Báo giá', COMPLAINT: 'Khiếu nại', FEEDBACK: 'Phản hồi', OTHER: 'Khác',
};

const CHANNEL_LABELS: Record<string, string> = {
  PHONE: '📞 Điện thoại', ZALO: '💬 Zalo', MESSENGER: '💬 Messenger',
  EMAIL: '📧 Email', IN_PERSON: '🤝 Trực tiếp', WEBSITE: '🌐 Website',
};

// ===== MAIN COMPONENT =====

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('profile');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Fetch customer data
  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => customersApi.get(id),
    select: (r) => r.data as Customer & { bookings?: Booking[]; debts?: unknown[] },
  });

  // Fetch RFM score
  const { data: rfm } = useQuery({
    queryKey: ['customer-rfm', id],
    queryFn: () => customerIntelligenceApi.getRfm(id),
    select: (r) => r.data as RfmScore,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['customer-stats', id],
    queryFn: () => customersApi.getStats(id),
    select: (r) => r.data as CustomerStats,
  });

  if (!mounted) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const cust: Customer = customer ?? SAMPLE_CUSTOMER;

  return (
    <div className="max-w-[1400px] space-y-6">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <Link href="/customers" className="p-1 rounded-md hover:bg-accent transition-colors -ml-1">
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center shadow-sm">
                <span className="text-[13px] font-bold text-white">
                  {cust.fullName.split(' ').pop()?.charAt(0) ?? '?'}
                </span>
              </div>
              <span>{cust.fullName}</span>
            </div>
          </div>
        }
        description={
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold',
              VIP_BADGE[cust.vipTier] ?? VIP_BADGE.NORMAL,
            )}>
              {VIP_TIER_LABELS[cust.vipTier]}
            </span>
            {cust.type === 'CORPORATE' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-500/10 text-orange-600 dark:text-orange-400">
                <Building2 className="w-3 h-3" /> Doanh nghiệp
              </span>
            )}
            <span className="mx-1 text-border">•</span>
            <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-muted-foreground" /> {cust.phone}</span>
            {cust.email && (
              <>
                <span className="mx-1 text-border">•</span>
                <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-muted-foreground" /> {cust.email}</span>
              </>
            )}
          </div>
        }
        actions={
          rfm ? (
            <div className="hidden md:flex items-center gap-2">
              <div className="text-center px-3 py-1.5 rounded-md bg-card border border-border">
                <p className="text-sm font-bold text-foreground">{rfm.totalScore}</p>
                <p className="text-[10px] text-muted-foreground">RFM Score</p>
              </div>
              <div className="text-center px-3 py-1.5 rounded-md bg-card border border-border">
                <p className="text-[13px] font-semibold text-foreground">
                  {SEGMENT_LABELS[rfm.segment]?.emoji} {SEGMENT_LABELS[rfm.segment]?.label}
                </p>
                <p className="text-[10px] text-muted-foreground">Phân khúc</p>
              </div>
              <div className="text-center px-3 py-1.5 rounded-md bg-card border border-border">
                <p className={cn('text-[13px] font-semibold', CHURN_COLORS[rfm.churnRisk])}>
                  {rfm.churnRisk === 'LOW' ? '🟢 Thấp' : rfm.churnRisk === 'MEDIUM' ? '🟡 TB' : '🔴 Cao'}
                </p>
                <p className="text-[10px] text-muted-foreground">Rủi ro rời</p>
              </div>
            </div>
          ) : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tổng chi tiêu', value: formatVND(Number(cust.totalSpent)), icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Tổng booking', value: cust.totalBookings.toString(), icon: Plane, color: 'text-blue-500' },
          { label: 'Chi năm nay', value: formatVND(stats?.yearlySpend ?? 0), icon: Activity, color: 'text-purple-500' },
          { label: 'TB/vé', value: formatVND(stats?.averageTicketValue ?? 0), icon: CreditCard, color: 'text-orange-500' },
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 h-10 text-[13px] font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'profile' && <ProfileTab customer={cust} rfm={rfm} stats={stats} />}
        {activeTab === 'bookings' && <BookingsTab customerId={id} bookings={(customer as unknown as Record<string, unknown>)?.bookings as Booking[] | undefined} />}
        {activeTab === 'interactions' && <InteractionsTab customerId={id} />}
        {activeTab === 'debts' && <DebtsTab debts={(customer as unknown as Record<string, unknown>)?.debts as Record<string, unknown>[] | undefined} />}
        {activeTab === 'notes' && <NotesTab customerId={id} />}
      </div>
    </div>
  );
}

// ===== TAB COMPONENTS =====

function ProfileTab({ customer, rfm, stats }: { customer: Customer; rfm?: RfmScore; stats?: CustomerStats }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: Info */}
      <div className="lg:col-span-2 space-y-4">
        <div className="card p-5">
          <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
            <h3 className="text-[13px] font-medium text-foreground">Thông tin cá nhân</h3>
          </div>
          <div className="flex flex-col text-[13px]">
            {[
              { label: 'Họ tên', value: customer.fullName },
              { label: 'Điện thoại', value: customer.phone },
              { label: 'Email', value: customer.email ?? '—' },
              { label: 'CCCD/CMND', value: customer.idNumber ?? '—', mono: true },
              { label: 'Hộ chiếu', value: customer.passport ?? '—', mono: true },
              { label: 'Ngày sinh', value: customer.dateOfBirth ? formatDate(customer.dateOfBirth) : '—' },
              { label: 'Ghế ưa thích', value: customer.preferredSeat ?? '—' },
              { label: 'Ngày tạo', value: formatDate(customer.createdAt) },
            ].map((row, idx, arr) => (
              <div key={row.label} className={cn('flex items-center justify-between py-2.5', idx !== arr.length - 1 && 'border-b border-border/50')}>
                <span className="text-muted-foreground">{row.label}</span>
                <span className={cn('font-medium text-foreground', row.mono && 'font-mono text-primary')}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>

          {customer.type === 'CORPORATE' && (
            <div className="mt-5 pt-5 border-t border-border">
              <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
                <h4 className="text-[13px] font-medium text-foreground">Thông tin doanh nghiệp</h4>
              </div>
              <div className="flex flex-col text-[13px]">
                <div className="flex items-center justify-between py-2.5 border-b border-border/50">
                  <span className="text-muted-foreground">Tên công ty</span>
                  <span className="font-medium text-foreground">{customer.companyName ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="text-muted-foreground">Mã số thuế</span>
                  <span className="font-medium font-mono text-primary">{customer.companyTaxId ?? '—'}</span>
                </div>
              </div>
            </div>
          )}

          {customer.tags && customer.tags.length > 0 && (
            <div className="mt-5 pt-5 border-t border-border">
              <p className="text-[11px] text-muted-foreground mb-2 uppercase tracking-wide">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {customer.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-[11px] bg-accent text-foreground font-medium border border-border">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: RFM & Stats */}
      <div className="space-y-4">
        {/* RFM Card */}
        {rfm && (
          <div className="card p-5">
            <h3 className="text-[13px] font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              Phân tích RFM
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Recency (gần đây)', score: rfm.recency, detail: `${rfm.lastBookingDays} ngày trước` },
                { label: 'Frequency (tần suất)', score: rfm.frequency, detail: `${customer.totalBookings} booking` },
                { label: 'Monetary (chi tiêu)', score: rfm.monetary, detail: formatVND(Number(customer.totalSpent)) },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-[11px] uppercase tracking-wide mb-1.5">
                    <span className="text-muted-foreground font-medium">{item.label}</span>
                    <span className="text-foreground font-semibold">{item.score}/5</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-foreground rounded-full transition-all"
                      style={{ width: `${(item.score / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Routes */}
        {stats && stats.topRoutes.length > 0 && (
          <div className="card p-5">
            <h3 className="text-[13px] font-semibold text-foreground mb-3">Tuyến bay hay đi</h3>
            <div className="space-y-2.5">
              {stats.topRoutes.map((route) => (
                <div key={route.route} className="flex items-center justify-between text-[13px]">
                  <span className="font-mono font-medium text-foreground">{route.route}</span>
                  <span className="text-muted-foreground">{route.count} lần</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingsTab({ customerId, bookings }: { customerId: string; bookings?: Booking[] }) {
  const list = bookings ?? SAMPLE_BOOKINGS;

  return (
    <div className="mx-[-16px] sm:mx-0">
      <DataTable
        data={list}
        onRowClick={(b) => window.location.href = `/bookings/${b.id}`}
        columns={[
          {
            header: 'PNR',
            cell: (b: Booking) => (
              <div className="flex flex-col gap-0">
                <span className="font-mono font-bold tracking-widest text-[13px]">{b.pnr || '—'}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{b.bookingCode}</span>
              </div>
            ),
          },
          {
            header: 'Trạng thái',
            cell: (b) => (
              <span className={cn('inline-block px-1.5 py-0.5 rounded text-[11px] font-medium', BOOKING_STATUS_CLASSES[b.status])}>
                {BOOKING_STATUS_LABELS[b.status]}
              </span>
            ),
          },
          {
            header: 'Nguồn',
            accessorKey: 'source',
            className: 'text-muted-foreground',
          },
          {
            header: 'Giá bán',
            cell: (b) => <span className="font-medium inline-block font-tabular text-foreground">{formatVND(b.totalSellPrice)}</span>,
            className: 'text-right',
          },
          {
            header: 'Lợi nhuận',
            cell: (b) => <span className="text-emerald-500 font-medium inline-block font-tabular">+{formatVND(b.profit)}</span>,
            className: 'text-right',
          },
          {
            header: 'Thanh toán',
            cell: (b) => (
              <span className={cn(
                'px-1.5 py-0.5 rounded text-[11px] font-medium inline-block',
                b.paymentStatus === 'PAID' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                b.paymentStatus === 'PARTIAL' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
                b.paymentStatus === 'UNPAID' && 'bg-red-500/10 text-red-600 dark:text-red-400',
              )}>
                {b.paymentStatus === 'PAID' ? 'Đã TT' : b.paymentStatus === 'PARTIAL' ? 'Một phần' : 'Chưa TT'}
              </span>
            ),
          },
          {
            header: 'Ngày tạo',
            cell: (b) => <span className="text-muted-foreground font-tabular">{formatDate(b.createdAt)}</span>,
            className: 'text-right',
          },
        ]}
      />
    </div>
  );
}

function InteractionsTab({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    type: 'CALL', channel: 'PHONE', subject: '', content: '', outcome: '', duration: '',
  });

  const { data: interactionsData } = useQuery({
    queryKey: ['customer-interactions', customerId],
    queryFn: () => interactionsApi.list(customerId),
    select: (r) => r.data,
  });

  const createMutation = useMutation({
    mutationFn: (data: unknown) => interactionsApi.create(customerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-interactions', customerId] });
      setShowForm(false);
      setFormData({ type: 'CALL', channel: 'PHONE', subject: '', content: '', outcome: '', duration: '' });
    },
  });

  const interactions: CustomerInteraction[] = interactionsData?.data ?? [];

  return (
    <div className="space-y-4">
      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-3 h-9 rounded-md text-[13px] font-medium bg-foreground text-background hover:opacity-90 transition-all active:scale-[0.98]"
        >
          <Plus className="w-3.5 h-3.5" />
          Ghi nhận tương tác
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-5 space-y-4">
          <h3 className="text-[13px] font-semibold text-foreground">Tương tác mới</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Loại tương tác</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(INTERACTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Kênh</label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                className="w-full px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Tiêu đề</label>
            <input
              type="text"
              placeholder="VD: Gọi báo giá HAN-SGN"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 h-9 text-[13px] rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Nội dung</label>
              <textarea
                placeholder="Chi tiết cuộc trao đổi..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-[13px] rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Kết quả</label>
              <textarea
                placeholder="VD: Đã đặt vé, Hẹn gọi lại..."
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-[13px] rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.subject || createMutation.isPending}
              className="px-4 h-9 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 transition-all"
            >
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Send className="w-3.5 h-3.5" />
              Lưu
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 h-9 border border-border bg-background rounded-md text-[13px] text-muted-foreground hover:bg-accent transition-all"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Interactions list */}
      <div className="space-y-2">
        {interactions.map((interaction) => (
          <div key={interaction.id} className="card p-4 flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-sm">
              {INTERACTION_ICONS[interaction.type] ?? '📌'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-foreground">{interaction.subject}</p>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {INTERACTION_TYPE_LABELS[interaction.type]}
                </span>
              </div>
              {interaction.content && (
                <p className="text-xs text-muted-foreground mb-1">{interaction.content}</p>
              )}
              {interaction.outcome && (
                <p className="text-xs text-emerald-500 font-medium">→ {interaction.outcome}</p>
              )}
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                <span>{formatDateTime(interaction.createdAt)}</span>
                <span>{interaction.staff?.fullName}</span>
                {interaction.duration && <span>{interaction.duration} phút</span>}
              </div>
            </div>
          </div>
        ))}

        {interactions.length === 0 && (
          <div className="card p-8 text-center text-muted-foreground text-sm">
            Chưa có tương tác nào được ghi nhận
          </div>
        )}
      </div>
    </div>
  );
}

function DebtsTab({ debts }: { debts?: Record<string, unknown>[] }) {
  const list = debts ?? [];

  return (
    <div className="mx-[-16px] sm:mx-0">
      <DataTable
        data={list}
        columns={[
          {
            header: 'Mô tả',
            accessorKey: 'description',
            className: 'text-foreground',
          },
          {
            header: 'Tổng nợ',
            cell: (d) => <span className="font-medium inline-block font-tabular text-foreground">{formatVND(Number(d.totalAmount ?? 0))}</span>,
            className: 'text-right',
          },
          {
            header: 'Đã trả',
            cell: (d) => <span className="text-emerald-500 font-medium inline-block font-tabular">{formatVND(Number(d.paidAmount ?? 0))}</span>,
            className: 'text-right',
          },
          {
            header: 'Còn lại',
            cell: (d) => <span className="font-bold text-red-500 inline-block font-tabular">{formatVND(Number(d.remaining ?? 0))}</span>,
            className: 'text-right',
          },
          {
            header: 'Trạng thái',
            cell: (d) => (
              <span className={cn(
                'px-1.5 py-0.5 rounded text-[11px] font-medium inline-block',
                d.status === 'ACTIVE' && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                d.status === 'OVERDUE' && 'bg-red-500/10 text-red-600 dark:text-red-400',
                d.status === 'PAID' && 'bg-green-500/10 text-green-600 dark:text-green-400',
                d.status === 'PARTIAL_PAID' && 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400',
              )}>
                {d.status as string}
              </span>
            ),
          },
          {
            header: 'Hạn',
            cell: (d) => <span className="text-muted-foreground font-tabular">{d.dueDate ? formatDate(d.dueDate as string) : '—'}</span>,
            className: 'text-right',
          },
          {
            header: 'Ngày tạo',
            cell: (d) => <span className="text-muted-foreground font-tabular">{d.createdAt ? formatDate(d.createdAt as string) : '—'}</span>,
            className: 'text-right',
          },
        ]}
      />
    </div>
  );
}

function NotesTab({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient();
  const [newNote, setNewNote] = useState('');

  const { data: notes = [] } = useQuery({
    queryKey: ['customer-notes', customerId],
    queryFn: () => interactionsApi.listNotes(customerId),
    select: (r) => (r.data ?? []) as CustomerNote[],
  });

  const createMutation = useMutation({
    mutationFn: (content: string) => interactionsApi.createNote(customerId, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes', customerId] });
      setNewNote('');
    },
  });

  const togglePin = useMutation({
    mutationFn: (note: CustomerNote) =>
      interactionsApi.updateNote(customerId, note.id, { isPinned: !note.isPinned }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes', customerId] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: (noteId: string) => interactionsApi.deleteNote(customerId, noteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-notes', customerId] });
    },
  });

  return (
    <div className="space-y-4">
      {/* New note form */}
      <div className="card p-4">
        <div className="flex gap-2">
          <textarea
            placeholder="Thêm ghi chú nội bộ..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            rows={2}
            className="flex-1 px-3 py-2 text-[13px] rounded-md bg-transparent border-none focus:outline-none resize-none placeholder:text-muted-foreground min-h-[40px] leading-relaxed"
          />
          <button
            onClick={() => createMutation.mutate(newNote)}
            disabled={!newNote.trim() || createMutation.isPending}
            className="self-end px-4 h-9 bg-foreground text-background rounded-md text-[13px] font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 transition-all"
          >
            {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <Plus className="w-3.5 h-3.5" />
            Thêm
          </button>
        </div>
      </div>

      {/* Notes list */}
      <div className="space-y-2">
        {notes.map((note) => (
          <div key={note.id} className={cn('card p-4', note.isPinned && 'border-primary/30 bg-primary/5')}>
            <div className="flex items-start gap-2">
              <div className="flex-1">
                {note.isPinned && (
                  <span className="text-[10px] text-primary font-semibold flex items-center gap-0.5 mb-1">
                    <Pin className="w-2.5 h-2.5" /> Đã ghim
                  </span>
                )}
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span>{note.staff?.fullName}</span>
                  <span>{formatDateTime(note.createdAt)}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => togglePin.mutate(note)}
                  className={cn(
                    'p-1 rounded hover:bg-accent transition-colors',
                    note.isPinned ? 'text-primary' : 'text-muted-foreground',
                  )}
                  title={note.isPinned ? 'Bỏ ghim' : 'Ghim'}
                >
                  <Pin className="w-3 h-3" />
                </button>
                <button
                  onClick={() => { if (confirm('Xóa ghi chú này?')) deleteNote.mutate(note.id); }}
                  className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Xóa"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        ))}

        {notes.length === 0 && (
          <div className="card p-8 text-center text-muted-foreground text-sm">
            Chưa có ghi chú nào
          </div>
        )}
      </div>
    </div>
  );
}

// ===== SAMPLE DATA =====

const SAMPLE_CUSTOMER: Customer = {
  id: '1', fullName: 'Nguyễn Văn Minh', phone: '0901234567',
  email: 'minh@example.com', type: 'INDIVIDUAL', vipTier: 'GOLD',
  totalSpent: 85_000_000, totalBookings: 24, tags: ['thường_bay_SGN', 'VIP'],
  createdAt: '2024-01-15T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z',
  preferredSeat: 'Cửa sổ',
};

const SAMPLE_BOOKINGS: Booking[] = [
  {
    id: '1', bookingCode: 'APG-260321-023', customerId: 'c1', staffId: 's1',
    status: 'COMPLETED', source: 'PHONE', contactName: 'Nguyễn Văn Minh',
    contactPhone: '0901234567', totalSellPrice: 5_700_000, totalNetPrice: 5_100_000,
    totalFees: 150_000, profit: 450_000, paymentMethod: 'BANK_TRANSFER',
    paymentStatus: 'PAID', createdAt: '2026-03-21T08:30:00Z', updatedAt: '2026-03-21T10:00:00Z',
  },
  {
    id: '2', bookingCode: 'APG-260315-011', customerId: 'c1', staffId: 's1',
    status: 'ISSUED', source: 'ZALO', contactName: 'Nguyễn Văn Minh',
    contactPhone: '0901234567', totalSellPrice: 3_200_000, totalNetPrice: 2_800_000,
    totalFees: 100_000, profit: 300_000, paymentMethod: 'MOMO',
    paymentStatus: 'PAID', createdAt: '2026-03-15T14:00:00Z', updatedAt: '2026-03-15T16:00:00Z',
  },
  {
    id: '3', bookingCode: 'APG-260301-005', customerId: 'c1', staffId: 's1',
    status: 'CANCELLED', source: 'PHONE', contactName: 'Nguyễn Văn Minh',
    contactPhone: '0901234567', totalSellPrice: 0, totalNetPrice: 0,
    totalFees: 0, profit: 0, paymentMethod: 'CASH',
    paymentStatus: 'UNPAID', createdAt: '2026-03-01T09:00:00Z', updatedAt: '2026-03-01T12:00:00Z',
  },
];
