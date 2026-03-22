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
    <div className="max-w-[1400px] space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/customers" className="p-1.5 rounded-md hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        <div className="flex items-center gap-3 flex-1">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/80 to-primary flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-lg font-bold text-white">
              {cust.fullName.split(' ').pop()?.charAt(0) ?? '?'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-foreground">{cust.fullName}</h1>
              <span className={cn(
                'inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold',
                VIP_BADGE[cust.vipTier] ?? VIP_BADGE.NORMAL,
              )}>
                {VIP_TIER_LABELS[cust.vipTier]}
              </span>
              {cust.type === 'CORPORATE' && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  <Building2 className="w-3 h-3" /> Doanh nghiệp
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{cust.phone}</span>
              {cust.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{cust.email}</span>}
            </div>
          </div>
        </div>

        {/* RFM Summary */}
        {rfm && (
          <div className="hidden md:flex items-center gap-3">
            <div className="text-center px-3 py-1.5 rounded-lg bg-card border border-border">
              <p className="text-lg font-bold text-foreground">{rfm.totalScore}</p>
              <p className="text-[10px] text-muted-foreground">RFM Score</p>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-card border border-border">
              <p className="text-sm font-semibold text-foreground">
                {SEGMENT_LABELS[rfm.segment]?.emoji} {SEGMENT_LABELS[rfm.segment]?.label}
              </p>
              <p className="text-[10px] text-muted-foreground">Phân khúc</p>
            </div>
            <div className="text-center px-3 py-1.5 rounded-lg bg-card border border-border">
              <p className={cn('text-sm font-semibold', CHURN_COLORS[rfm.churnRisk])}>
                {rfm.churnRisk === 'LOW' ? '🟢 Thấp' : rfm.churnRisk === 'MEDIUM' ? '🟡 TB' : '🔴 Cao'}
              </p>
              <p className="text-[10px] text-muted-foreground">Rủi ro rời</p>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng chi tiêu', value: formatVND(Number(cust.totalSpent)), icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Tổng booking', value: cust.totalBookings.toString(), icon: Plane, color: 'text-blue-500' },
          { label: 'Chi năm nay', value: formatVND(stats?.yearlySpend ?? 0), icon: Activity, color: 'text-purple-500' },
          { label: 'TB/vé', value: formatVND(stats?.averageTicketValue ?? 0), icon: CreditCard, color: 'text-orange-500' },
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

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-primary text-primary'
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
          <h3 className="text-sm font-semibold text-foreground mb-4">Thông tin cá nhân</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              { label: 'Họ tên', value: customer.fullName },
              { label: 'Điện thoại', value: customer.phone },
              { label: 'Email', value: customer.email ?? '—' },
              { label: 'CCCD/CMND', value: customer.idNumber ?? '—' },
              { label: 'Hộ chiếu', value: customer.passport ?? '—' },
              { label: 'Ngày sinh', value: customer.dateOfBirth ? formatDate(customer.dateOfBirth) : '—' },
              { label: 'Ghế ưa thích', value: customer.preferredSeat ?? '—' },
              { label: 'Ngày tạo', value: formatDate(customer.createdAt) },
            ].map((row) => (
              <div key={row.label}>
                <p className="text-xs text-muted-foreground mb-0.5">{row.label}</p>
                <p className="font-medium text-foreground">{row.value}</p>
              </div>
            ))}
          </div>

          {customer.type === 'CORPORATE' && (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-xs font-semibold text-muted-foreground mb-3">Thông tin doanh nghiệp</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Tên công ty</p>
                  <p className="font-medium text-foreground">{customer.companyName ?? '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Mã số thuế</p>
                  <p className="font-medium text-foreground">{customer.companyTaxId ?? '—'}</p>
                </div>
              </div>
            </div>
          )}

          {customer.tags && customer.tags.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {customer.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-medium">
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
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              Phân tích RFM
            </h3>
            <div className="space-y-3">
              {[
                { label: 'Recency (gần đây)', score: rfm.recency, detail: `${rfm.lastBookingDays} ngày trước` },
                { label: 'Frequency (tần suất)', score: rfm.frequency, detail: `${customer.totalBookings} booking` },
                { label: 'Monetary (chi tiêu)', score: rfm.monetary, detail: formatVND(Number(customer.totalSpent)) },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="text-foreground font-medium">{item.score}/5</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${(item.score / 5) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Routes */}
        {stats && stats.topRoutes.length > 0 && (
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Tuyến bay hay đi</h3>
            <div className="space-y-2">
              {stats.topRoutes.map((route) => (
                <div key={route.route} className="flex items-center justify-between text-sm">
                  <span className="font-mono font-medium text-foreground">{route.route}</span>
                  <span className="text-xs text-muted-foreground">{route.count} lần</span>
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
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Mã booking', 'Trạng thái', 'Nguồn', 'Giá bán', 'Lợi nhuận', 'Thanh toán', 'Ngày tạo'].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((b) => (
              <tr
                key={b.id}
                className="hover:bg-accent/40 transition-colors cursor-pointer"
                onClick={() => window.location.href = `/bookings/${b.id}`}
              >
                <td className="px-4 py-3 font-mono font-medium text-primary">{b.bookingCode}</td>
                <td className="px-4 py-3">
                  <span className={cn('inline-block px-2 py-0.5 rounded-full text-[10px] font-medium', BOOKING_STATUS_CLASSES[b.status])}>
                    {BOOKING_STATUS_LABELS[b.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{b.source}</td>
                <td className="px-4 py-3 font-medium text-foreground">{formatVND(b.totalSellPrice)}</td>
                <td className="px-4 py-3 text-emerald-500 font-medium">+{formatVND(b.profit)}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium',
                    b.paymentStatus === 'PAID' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    b.paymentStatus === 'PARTIAL' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                    b.paymentStatus === 'UNPAID' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                  )}>
                    {b.paymentStatus === 'PAID' ? 'Đã TT' : b.paymentStatus === 'PARTIAL' ? 'Một phần' : 'Chưa TT'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(b.createdAt)}</td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Chưa có booking nào
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Ghi nhận tương tác
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="card p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Tương tác mới</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Loại tương tác</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(INTERACTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kênh</label>
              <select
                value={formData.channel}
                onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tiêu đề</label>
            <input
              type="text"
              placeholder="VD: Gọi báo giá HAN-SGN"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nội dung</label>
              <textarea
                placeholder="Chi tiết cuộc trao đổi..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Kết quả</label>
              <textarea
                placeholder="VD: Đã đặt vé, Hẹn gọi lại..."
                value={formData.outcome}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.subject || createMutation.isPending}
              className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
            >
              {createMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Send className="w-3.5 h-3.5" />
              Lưu
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent"
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
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {['Mô tả', 'Tổng nợ', 'Đã trả', 'Còn lại', 'Trạng thái', 'Hạn', 'Ngày tạo'].map((h) => (
                <th key={h} className="text-left text-xs font-medium text-muted-foreground px-4 py-2.5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {list.map((d, i) => (
              <tr key={i} className="hover:bg-accent/40 transition-colors">
                <td className="px-4 py-3 text-foreground">{(d.description as string) ?? '—'}</td>
                <td className="px-4 py-3 font-medium text-foreground">{formatVND(Number(d.totalAmount ?? 0))}</td>
                <td className="px-4 py-3 text-emerald-500">{formatVND(Number(d.paidAmount ?? 0))}</td>
                <td className="px-4 py-3 font-bold text-red-500">{formatVND(Number(d.remaining ?? 0))}</td>
                <td className="px-4 py-3">
                  <span className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium',
                    d.status === 'ACTIVE' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                    d.status === 'OVERDUE' && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                    d.status === 'PAID' && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                    d.status === 'PARTIAL_PAID' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                  )}>
                    {d.status as string}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {d.dueDate ? formatDate(d.dueDate as string) : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {d.createdAt ? formatDate(d.createdAt as string) : '—'}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Không có công nợ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
            className="flex-1 px-3 py-2 text-sm rounded-md bg-background border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <button
            onClick={() => createMutation.mutate(newNote)}
            disabled={!newNote.trim() || createMutation.isPending}
            className="self-end px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
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
