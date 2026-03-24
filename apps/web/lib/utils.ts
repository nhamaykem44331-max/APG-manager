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

// Màu hãng bay — brand colors chính xác
export const AIRLINE_COLORS: Record<string, string> = {
  // === Nội địa Việt Nam ===
  VN: '#0A4D8C',   // Vietnam Airlines — xanh navy đậm
  VJ: '#EC1C24',   // Vietjet Air — đỏ tươi
  QH: '#00875A',   // Bamboo Airways — xanh lá tre
  BL: '#F7941D',   // Pacific Airlines — cam
  VU: '#6B21A8',   // Vietravel Airlines — tím
  // === Quốc tế phổ biến ===
  EK: '#D71921',   // Emirates — đỏ đậm
  SQ: '#F5BE10',   // Singapore Airlines — vàng gold
  TG: '#6B2C8F',   // Thai Airways — tím
  CX: '#006564',   // Cathay Pacific — xanh ngọc đậm
  MH: '#1C3F94',   // Malaysia Airlines — xanh navy
  KE: '#00267F',   // Korean Air — xanh dương đậm
  QR: '#5C0632',   // Qatar Airways — burgundy
  OD: '#E87722',   // Batik Air — cam
  AK: '#DA291C',   // AirAsia — đỏ
  TR: '#FFD700',   // Scoot — vàng
  CZ: '#E41F26',   // China Southern — đỏ
  CA: '#E60012',   // Air China — đỏ
  NH: '#1E3C6E',   // ANA — xanh navy
  JL: '#CC0000',   // Japan Airlines — đỏ
  BR: '#006847',   // EVA Air — xanh lá
  CI: '#E5007E',   // China Airlines — magenta
  PR: '#0033A0',   // Philippine Airlines — xanh dương
  LJ: '#232F7E',   // Jin Air — xanh navy
  '7C': '#F47920', // Jeju Air — cam
  '9G': '#1E90FF', // Air Arabia — xanh dương
  OTHER: '#6B7280',
};

// Tạo lighter version cho background (10% opacity)
export function getAirlineBgColor(code: string): string {
  const hex = AIRLINE_COLORS[code] || AIRLINE_COLORS.OTHER;
  return `${hex}1A`; // 10% opacity hex
}

// Palette cho charts — Vercel-compatible, contrast tốt trên dark bg
export const CHART_COLORS = {
  revenue: '#3B82F6',      // Blue-500 — doanh thu
  profit: '#10B981',       // Emerald-500 — lợi nhuận
  cost: '#6B7280',         // Gray-500 — chi phí
  debt: '#F59E0B',         // Amber-500 — công nợ
  overdue: '#EF4444',      // Red-500 — quá hạn
  paid: '#10B981',         // Emerald — đã thanh toán
  pending: '#F59E0B',      // Amber — chờ
  cancelled: '#6B7280',    // Gray — hủy
};

// Payment method colors
export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  CASH: '#10B981',          // Emerald — tiền mặt
  BANK_TRANSFER: '#3B82F6', // Blue — chuyển khoản
  CREDIT_CARD: '#8B5CF6',   // Purple — thẻ
  MOMO: '#EC4899',          // Pink — MoMo
  VNPAY: '#3B82F6',         // Blue — VNPay
  DEBT: '#F59E0B',          // Amber — công nợ
};

// VIP tier colors
export const VIP_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  NORMAL:   { text: 'text-muted-foreground', bg: 'bg-muted',             border: 'border-border' },
  SILVER:   { text: 'text-gray-400',         bg: 'bg-gray-500/10',       border: 'border-gray-500/30' },
  GOLD:     { text: 'text-amber-500',        bg: 'bg-amber-500/10',      border: 'border-amber-500/30' },
  PLATINUM: { text: 'text-purple-400',       bg: 'bg-purple-500/10',     border: 'border-purple-500/30' },
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
