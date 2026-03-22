// APG Manager RMS - Utility functions
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Kết hợp className với Tailwind merge
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format tiền VND
export function formatVND(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`;
  }
  return amount.toLocaleString('vi-VN') + '₫';
}

// Format tiền đầy đủ
export function formatVNDFull(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

// Format ngày tháng tiếng Việt
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

// Format ngày giờ
export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// Format thời gian bay (HH:MM)
export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// Tính % thay đổi
export function calcChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

// Màu hãng bay
export const AIRLINE_COLORS: Record<string, string> = {
  VN: '#1a56db',  // Vietnam Airlines - xanh
  VJ: '#e02424',  // Vietjet - đỏ
  QH: '#057a55',  // Bamboo - xanh lá
  BL: '#c27803',  // Pacific Airlines - vàng
  VU: '#7e3af2',  // Vietravel - tím
  OTHER: '#6b7280',
};

// Tên đầy đủ hãng bay
export const AIRLINE_NAMES: Record<string, string> = {
  VN: 'Vietnam Airlines',
  VJ: 'Vietjet Air',
  QH: 'Bamboo Airways',
  BL: 'Pacific Airlines',
  VU: 'Vietravel Airlines',
  OTHER: 'Khác',
};

// Label trạng thái booking tiếng Việt
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  NEW: 'Mới',
  PROCESSING: 'Đang xử lý',
  QUOTED: 'Đã báo giá',
  PENDING_PAYMENT: 'Chờ thanh toán',
  ISSUED: 'Đã xuất vé',
  COMPLETED: 'Hoàn thành',
  CHANGED: 'Đã đổi',
  REFUNDED: 'Đã hoàn',
  CANCELLED: 'Đã hủy',
};

// CSS class cho badge trạng thái
export const BOOKING_STATUS_CLASSES: Record<string, string> = {
  NEW: 'status-new',
  PROCESSING: 'status-processing',
  QUOTED: 'status-quoted',
  PENDING_PAYMENT: 'status-pending',
  ISSUED: 'status-issued',
  COMPLETED: 'status-completed',
  CHANGED: 'status-refunded',
  REFUNDED: 'status-refunded',
  CANCELLED: 'status-cancelled',
};

// Label nguồn booking
export const BOOKING_SOURCE_LABELS: Record<string, string> = {
  WEBSITE: '🌐 Website',
  ZALO: '💬 Zalo',
  MESSENGER: '💬 Messenger',
  PHONE: '📞 Điện thoại',
  WALK_IN: '🚶 Trực tiếp',
  REFERRAL: '👥 Giới thiệu',
};

// Label VIP tier
export const VIP_TIER_LABELS: Record<string, string> = {
  NORMAL: 'Thường',
  SILVER: '⭐ Bạc',
  GOLD: '⭐ Vàng',
  PLATINUM: '💎 Platinum',
};
