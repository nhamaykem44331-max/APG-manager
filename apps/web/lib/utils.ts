// APG Manager RMS - Utility functions
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Kết hợp className với Tailwind merge
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format tiền VND - luôn hiển thị đầy đủ với dấu chấm phân cách hàng nghìn
// Ví dụ: 2000000 -> "2.000.000 ₫"
export function formatVND(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  if (isNaN(num)) return '0 ₫';
  return num.toLocaleString('vi-VN') + ' ₫';
}

// Format số không có ký hiệu tiền (dùng cho biểu đồ, bảng)
export function formatNumber(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  if (isNaN(num)) return '0';
  return num.toLocaleString('vi-VN');
}

// Chuyển chuỗi có dấu chấm thành số thuần ("2.000.000" -> 2000000)
export function parseMoneyInput(value: string): number {
  const cleaned = value.replace(/\./g, '').replace(/[^0-9-]/g, '');
  return parseInt(cleaned, 10) || 0;
}

// Format giá trị input thành chuỗi có dấu chấm khi người dùng gõ
// "2000000" -> "2.000.000"
export function formatMoneyInput(raw: string): string {
  const digits = raw.replace(/\./g, '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  return Number(digits).toLocaleString('vi-VN');
}

// Backward-compat alias
export const formatVNDFull = formatVND;

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

// ===== ACCOUNTS LEDGER CONSTANTS =====

export const LEDGER_DIRECTION_LABELS: Record<string, string> = {
  RECEIVABLE: 'Phải thu (AR)',
  PAYABLE: 'Phải trả (AP)',
};

export const LEDGER_PARTY_LABELS: Record<string, string> = {
  CUSTOMER_INDIVIDUAL: '👤 Khách lẻ',
  CUSTOMER_CORPORATE: '🏢 Khách DN',
  AIRLINE: '✈️ Hãng bay',
  GDS_PROVIDER: '🖥️ GDS',
  PARTNER: '🤝 Đối tác',
  OTHER_SUPPLIER: '🏭 NCC khác',
};

export const DEBT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Đang nợ',
  PARTIAL_PAID: 'Trả một phần',
  PAID: 'Đã thanh toán',
  OVERDUE: 'Quá hạn',
  WRITTEN_OFF: 'Xóa nợ',
};

export const DEBT_STATUS_CLASSES: Record<string, string> = {
  ACTIVE: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PARTIAL_PAID: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  PAID: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  OVERDUE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  WRITTEN_OFF: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

// ===== PHASE B: DÒNG TIỀN + CHI PHÍ =====

export const CASHFLOW_CATEGORY_LABELS: Record<string, string> = {
  TICKET_PAYMENT: '🎫 Thu tiền vé',
  TICKET_REFUND: '↩️ Hoàn vé',
  PARTNER_FEEDBACK: '🤝 Hoa hồng đối tác',
  AIRLINE_PAYMENT: '✈️ Nạp/TT hãng bay',
  SALARY: '💰 Lương NV',
  OFFICE_RENT: '🏢 Thuê VP',
  OFFICE_SUPPLIES: '🖊️ Đồ dùng VP',
  ENTERTAINMENT: '🍽️ Tiếp khách',
  TRAVEL: '🚗 Công tác phí',
  RITUAL: '🪷 Lễ / Phong thủy',
  MARKETING: '📣 Marketing',
  TECHNOLOGY: '💻 Công nghệ',
  DISBURSEMENT: '🏦 Giải ngân',
  OTHER: '📦 Khác',
};

export const CASHFLOW_CATEGORY_COLORS: Record<string, string> = {
  TICKET_PAYMENT: '#3b82f6',
  TICKET_REFUND: '#f59e0b',
  PARTNER_FEEDBACK: '#8b5cf6',
  AIRLINE_PAYMENT: '#0ea5e9',
  SALARY: '#ec4899',
  OFFICE_RENT: '#f97316',
  OFFICE_SUPPLIES: '#84cc16',
  ENTERTAINMENT: '#14b8a6',
  TRAVEL: '#6366f1',
  RITUAL: '#f43f5e',
  MARKETING: '#a855f7',
  TECHNOLOGY: '#06b6d4',
  DISBURSEMENT: '#10b981',
  OTHER: '#94a3b8',
};
