// APG Manager RMS - Booking Detail Page
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Plane, User, Clock, CreditCard,
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  Phone, Mail, MapPin,
} from 'lucide-react';
import { bookingsApi } from '@/lib/api';
import {
  cn, formatVND, formatDateTime, formatTime,
  BOOKING_STATUS_LABELS, BOOKING_STATUS_CLASSES,
  BOOKING_SOURCE_LABELS, AIRLINE_NAMES, AIRLINE_COLORS,
} from '@/lib/utils';
import type { Booking, BookingStatus } from '@/types';

// Allowed transitions từ mỗi status
const NEXT_ACTIONS: Record<string, { status: BookingStatus; label: string; variant: string }[]> = {
  NEW:             [{ status: 'PROCESSING', label: 'Bắt đầu xử lý', variant: 'primary' }, { status: 'CANCELLED', label: 'Hủy', variant: 'danger' }],
  PROCESSING:      [{ status: 'QUOTED', label: 'Đã báo giá', variant: 'primary' }, { status: 'CANCELLED', label: 'Hủy', variant: 'danger' }],
  QUOTED:          [{ status: 'PENDING_PAYMENT', label: 'Chờ thanh toán', variant: 'primary' }, { status: 'CANCELLED', label: 'Hủy', variant: 'danger' }],
  PENDING_PAYMENT: [{ status: 'ISSUED', label: '✈ Xuất vé', variant: 'success' }, { status: 'CANCELLED', label: 'Hủy', variant: 'danger' }],
  ISSUED:          [{ status: 'COMPLETED', label: 'Hoàn thành', variant: 'success' }, { status: 'REFUNDED', label: 'Hoàn vé', variant: 'warning' }],
  COMPLETED:       [],
  CHANGED:         [{ status: 'ISSUED', label: 'Xuất vé mới', variant: 'primary' }],
  REFUNDED:        [],
  CANCELLED:       [],
};

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [statusReason, setStatusReason] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ status: BookingStatus; label: string } | null>(null);

  const { data: booking, isLoading } = useQuery({
    queryKey: ['booking', id],
    queryFn: () => bookingsApi.get(id),
    select: (r) => r.data as Booking,
  });

  const statusMutation = useMutation({
    mutationFn: (toStatus: BookingStatus) =>
      bookingsApi.updateStatus(id, { status: toStatus, reason: statusReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking', id] });
      setConfirmAction(null);
      setStatusReason('');
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Dùng dữ liệu mẫu nếu chưa có API
  const bk: Booking = booking ?? SAMPLE_BOOKING;
  const actions = NEXT_ACTIONS[bk.status] ?? [];

  return (
    <div className="max-w-[1200px] space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/bookings" className="p-1.5 rounded-md hover:bg-accent transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-foreground font-mono">{bk.bookingCode}</h1>
            <span className={cn(
              'inline-block px-2.5 py-1 rounded-full text-xs font-semibold',
              BOOKING_STATUS_CLASSES[bk.status],
            )}>
              {BOOKING_STATUS_LABELS[bk.status]}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {BOOKING_SOURCE_LABELS[bk.source]} · {formatDateTime(bk.createdAt)}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          {actions.map((action) => (
            <button
              key={action.status}
              onClick={() => setConfirmAction({ status: action.status, label: action.label })}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                action.variant === 'primary' && 'bg-primary text-white hover:bg-primary/90',
                action.variant === 'success' && 'bg-emerald-600 text-white hover:bg-emerald-700',
                action.variant === 'danger'  && 'bg-red-600 text-white hover:bg-red-700',
                action.variant === 'warning' && 'bg-orange-500 text-white hover:bg-orange-600',
              )}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Details (70%) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Booking info */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Thông tin liên hệ
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tên liên hệ</p>
                <p className="font-medium text-foreground">{bk.contactName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Số điện thoại</p>
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                  {bk.contactPhone}
                </p>
              </div>
              {bk.pnr && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mã PNR (GDS)</p>
                  <p className="font-mono font-bold text-primary">{bk.pnr}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Nguồn</p>
                <p className="text-foreground">{BOOKING_SOURCE_LABELS[bk.source]}</p>
              </div>
            </div>
            {bk.notes && (
              <div className="mt-4 p-3 bg-muted/40 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Ghi chú</p>
                <p className="text-sm text-foreground">{bk.notes}</p>
              </div>
            )}
          </div>

          {/* Tickets */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Plane className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Hành trình</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {bk.tickets?.length ?? 0} chặng
              </span>
            </div>
            <div className="divide-y divide-border">
              {(bk.tickets ?? SAMPLE_BOOKING.tickets ?? []).map((ticket) => (
                <div key={ticket.id} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="px-2 py-0.5 rounded text-white text-xs font-bold"
                        style={{ backgroundColor: AIRLINE_COLORS[ticket.airline] }}
                      >
                        {ticket.airline}
                      </div>
                      <span className="text-sm font-mono font-medium text-foreground">
                        {ticket.flightNumber}
                      </span>
                      <span className="text-xs text-muted-foreground">{ticket.seatClass}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-foreground">{formatVND(ticket.sellPrice)}</p>
                      <p className="text-xs text-emerald-500">LN: +{formatVND(ticket.profit)}</p>
                    </div>
                  </div>

                  {/* Route */}
                  <div className="flex items-center gap-3">
                    <div className="text-center">
                      <p className="text-xl font-bold text-foreground">{ticket.departureCode}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(ticket.departureTime)}</p>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <div className="flex-1 border-t border-dashed border-border" />
                      <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                      <div className="flex-1 border-t border-dashed border-border" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-foreground">{ticket.arrivalCode}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(ticket.arrivalTime)}</p>
                    </div>
                  </div>

                  {/* Passenger */}
                  {ticket.passenger && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Hành khách: <span className="text-foreground">{ticket.passenger.fullName}</span>
                      {ticket.eTicketNumber && ` · Vé: ${ticket.eTicketNumber}`}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Financial summary */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Tài chính
            </h3>
            <div className="space-y-2.5 text-sm">
              {[
                { label: 'Giá bán (khách)',  value: formatVND(bk.totalSellPrice), bold: false },
                { label: 'Giá net (hãng bay)', value: formatVND(bk.totalNetPrice), bold: false },
                { label: 'Phí dịch vụ',      value: formatVND(bk.totalFees), bold: false },
                { label: 'Lợi nhuận',        value: `+${formatVND(bk.profit)}`, bold: true, green: true },
              ].map((row) => (
                <div key={row.label} className={cn('flex justify-between', row.bold && 'pt-2 border-t border-border')}>
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={cn('font-medium', row.green ? 'text-emerald-500' : 'text-foreground')}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Payment status */}
            <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Thanh toán</span>
              <span className={cn(
                'px-2.5 py-0.5 rounded-full text-xs font-medium',
                bk.paymentStatus === 'PAID'    && 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                bk.paymentStatus === 'PARTIAL' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                bk.paymentStatus === 'UNPAID'  && 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
              )}>
                {bk.paymentStatus === 'PAID' ? '✅ Đã thanh toán đủ'
                 : bk.paymentStatus === 'PARTIAL' ? '⚠ Thanh toán một phần'
                 : '❌ Chưa thanh toán'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Timeline (30%) */}
        <div className="space-y-4">
          {/* Status timeline */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Lịch sử trạng thái
            </h3>
            <div className="space-y-3">
              {(bk.statusHistory ?? SAMPLE_BOOKING.statusHistory ?? []).map((log, i) => (
                <div key={log.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                      i === 0 ? 'bg-primary' : 'bg-muted-foreground/40',
                    )} />
                    {i < (bk.statusHistory?.length ?? 0) - 1 && (
                      <div className="w-px flex-1 bg-border mt-1" />
                    )}
                  </div>
                  <div className="pb-3 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {BOOKING_STATUS_LABELS[log.toStatus]}
                    </p>
                    {log.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">{log.reason}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Staff info */}
          <div className="card p-4">
            <p className="text-xs text-muted-foreground mb-1">Nhân viên phụ trách</p>
            <p className="text-sm font-medium text-foreground">{bk.staff?.fullName ?? 'Chưa phân công'}</p>
          </div>
        </div>
      </div>

      {/* Confirm status change modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-base font-semibold text-foreground mb-2">
              Xác nhận: {confirmAction.label}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Booking <span className="font-mono text-primary">{bk.bookingCode}</span> sẽ được chuyển sang trạng thái{' '}
              <strong>{BOOKING_STATUS_LABELS[confirmAction.status]}</strong>.
            </p>

            <textarea
              placeholder="Ghi chú lý do (không bắt buộc)..."
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              rows={2}
              className={cn(
                'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background',
                'text-foreground placeholder:text-muted-foreground resize-none',
                'focus:outline-none focus:ring-1 focus:ring-primary mb-4',
              )}
            />

            <div className="flex gap-2">
              <button
                onClick={() => statusMutation.mutate(confirmAction.status)}
                disabled={statusMutation.isPending}
                className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {statusMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Xác nhận
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent"
              >
                Hủy bỏ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Dữ liệu mẫu
const SAMPLE_BOOKING: Booking = {
  id: '1', bookingCode: 'APG-260321-023',
  customerId: 'c1', staffId: 's1',
  status: 'PENDING_PAYMENT', source: 'PHONE',
  contactName: 'Nguyễn Văn Minh', contactPhone: '0901234567',
  totalSellPrice: 5_700_000, totalNetPrice: 5_100_000,
  totalFees: 150_000, profit: 450_000,
  paymentMethod: 'BANK_TRANSFER', paymentStatus: 'UNPAID',
  pnr: 'ABCXYZ', notes: 'Khách yêu cầu ghế cửa sổ',
  createdAt: '2026-03-21T08:30:00Z', updatedAt: '2026-03-21T10:00:00Z',
  staff: { id: 's1', email: 'sales1@tanphuapg.com', fullName: 'Nguyễn Thị Hương', role: 'SALES', isActive: true, createdAt: '', updatedAt: '' },
  tickets: [{
    id: 't1', bookingId: '1', passengerId: 'p1',
    airline: 'QH', flightNumber: 'QH201',
    departureCode: 'HAN', arrivalCode: 'PQC',
    departureTime: '2026-04-15T06:30:00Z', arrivalTime: '2026-04-15T08:45:00Z',
    seatClass: 'Economy', fareClass: 'G',
    sellPrice: 1_900_000, netPrice: 1_700_000, tax: 0, serviceFee: 50_000, commission: 0, profit: 150_000,
    status: 'ACTIVE', createdAt: '2026-03-21T08:30:00Z',
    passenger: { id: 'p1', fullName: 'Nguyễn Văn Minh', type: 'ADT', createdAt: '' },
  }, {
    id: 't2', bookingId: '1', passengerId: 'p2',
    airline: 'QH', flightNumber: 'QH202',
    departureCode: 'HAN', arrivalCode: 'PQC',
    departureTime: '2026-04-15T06:30:00Z', arrivalTime: '2026-04-15T08:45:00Z',
    seatClass: 'Economy', fareClass: 'G',
    sellPrice: 1_900_000, netPrice: 1_700_000, tax: 0, serviceFee: 50_000, commission: 0, profit: 150_000,
    status: 'ACTIVE', createdAt: '2026-03-21T08:30:00Z',
    passenger: { id: 'p2', fullName: 'Trần Thị Mai', type: 'ADT', createdAt: '' },
  }, {
    id: 't3', bookingId: '1', passengerId: 'p3',
    airline: 'QH', flightNumber: 'QH203',
    departureCode: 'HAN', arrivalCode: 'PQC',
    departureTime: '2026-04-15T06:30:00Z', arrivalTime: '2026-04-15T08:45:00Z',
    seatClass: 'Economy', fareClass: 'Q',
    sellPrice: 1_900_000, netPrice: 1_700_000, tax: 0, serviceFee: 50_000, commission: 0, profit: 150_000,
    status: 'ACTIVE', createdAt: '2026-03-21T08:30:00Z',
    passenger: { id: 'p3', fullName: 'Lê Văn Nam (CHD)', type: 'CHD', createdAt: '' },
  }],
  statusHistory: [
    { id: 'l1', bookingId: '1', fromStatus: 'NEW', toStatus: 'NEW', changedBy: 's1', reason: 'Tạo booking mới', createdAt: '2026-03-21T08:30:00Z' },
    { id: 'l2', bookingId: '1', fromStatus: 'NEW', toStatus: 'PROCESSING', changedBy: 's1', createdAt: '2026-03-21T08:45:00Z' },
    { id: 'l3', bookingId: '1', fromStatus: 'PROCESSING', toStatus: 'QUOTED', changedBy: 's1', reason: 'Đã gửi báo giá cho khách', createdAt: '2026-03-21T09:15:00Z' },
    { id: 'l4', bookingId: '1', fromStatus: 'QUOTED', toStatus: 'PENDING_PAYMENT', changedBy: 's1', createdAt: '2026-03-21T10:00:00Z' },
  ],
};
