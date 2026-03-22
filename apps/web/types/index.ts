// APG Manager RMS - TypeScript Types (toàn bộ kiểu dữ liệu chia sẻ)

// ===== ENUMS =====

export type UserRole = 'ADMIN' | 'MANAGER' | 'SALES' | 'ACCOUNTANT';

export type BookingStatus =
  | 'NEW'
  | 'PROCESSING'
  | 'QUOTED'
  | 'PENDING_PAYMENT'
  | 'ISSUED'
  | 'COMPLETED'
  | 'CHANGED'
  | 'REFUNDED'
  | 'CANCELLED';

export type BookingSource =
  | 'WEBSITE' | 'ZALO' | 'MESSENGER' | 'PHONE' | 'WALK_IN' | 'REFERRAL';

export type PaymentMethod =
  | 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'MOMO' | 'VNPAY' | 'DEBT';

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'REFUNDED';

export type CustomerType = 'INDIVIDUAL' | 'CORPORATE';

export type VipTier = 'NORMAL' | 'SILVER' | 'GOLD' | 'PLATINUM';

export type Airline = 'VN' | 'VJ' | 'QH' | 'BL' | 'VU' | 'OTHER';

export type DebtStatus = 'ACTIVE' | 'PARTIAL_PAID' | 'PAID' | 'OVERDUE' | 'WRITTEN_OFF';

// ===== MODELS =====

export interface User {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  fullName: string;
  phone: string;
  email?: string;
  idNumber?: string;
  passport?: string;
  dateOfBirth?: string;
  type: CustomerType;
  companyName?: string;
  companyTaxId?: string;
  vipTier: VipTier;
  totalSpent: number;
  totalBookings: number;
  preferredSeat?: string;
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Booking {
  id: string;
  bookingCode: string;
  customerId: string;
  staffId: string;
  status: BookingStatus;
  source: BookingSource;
  contactPhone: string;
  contactName: string;
  totalSellPrice: number;
  totalNetPrice: number;
  totalFees: number;
  profit: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  pnr?: string;
  gdsBookingId?: string;
  notes?: string;
  internalNotes?: string;
  createdAt: string;
  updatedAt: string;
  issuedAt?: string;
  // Relations
  customer?: Customer;
  staff?: User;
  tickets?: Ticket[];
  payments?: Payment[];
  statusHistory?: BookingStatusLog[];
}

export interface Ticket {
  id: string;
  bookingId: string;
  passengerId: string;
  airline: Airline;
  flightNumber: string;
  departureCode: string;
  arrivalCode: string;
  departureTime: string;
  arrivalTime: string;
  seatClass: string;
  fareClass?: string;
  airlineBookingCode?: string;  // Mã đặt chỗ hãng bay (e.g. 64NTWM)
  sellPrice: number;
  netPrice: number;
  tax: number;
  serviceFee: number;
  commission: number;
  profit: number;
  eTicketNumber?: string;
  baggageAllowance?: string;
  status: string;
  createdAt: string;
  passenger?: Passenger;
}

export interface Passenger {
  id: string;
  customerId?: string;
  fullName: string;
  dateOfBirth?: string;
  gender?: string;
  idNumber?: string;
  passport?: string;
  phone?: string;
  email?: string;
  type: string; // ADT/CHD/INF
  createdAt: string;
}

export interface Payment {
  id: string;
  bookingId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidAt: string;
  notes?: string;
  createdAt: string;
}

export interface BookingStatusLog {
  id: string;
  bookingId: string;
  fromStatus: BookingStatus;
  toStatus: BookingStatus;
  changedBy: string;
  reason?: string;
  createdAt: string;
}

export interface AirlineDeposit {
  id: string;
  airline: Airline;
  balance: number;
  lastTopUp: number;
  lastTopUpAt?: string;
  alertThreshold: number;
  notes?: string;
  updatedAt: string;
}

// ===== API RESPONSE =====

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ===== DASHBOARD =====

export interface DashboardStats {
  ticketsToday: number;
  ticketsTodayChange: number;
  revenueToday: number;
  revenueTodayChange: number;
  profitToday: number;
  profitTodayChange: number;
  pendingBookings: number;
}

export interface RevenueChartData {
  date: string;
  revenue: number;
  profit: number;
  tickets: number;
}

export interface AirlineChartData {
  airline: string;
  value: number;
  color: string;
}

// ===== AUTH =====

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

// ===== CUSTOMER INTELLIGENCE =====

export type InteractionType =
  | 'CALL' | 'MEETING' | 'MESSAGE' | 'FOLLOW_UP'
  | 'QUOTATION' | 'COMPLAINT' | 'FEEDBACK' | 'OTHER';

export type InteractionChannel =
  | 'PHONE' | 'ZALO' | 'MESSENGER' | 'EMAIL' | 'IN_PERSON' | 'WEBSITE';

export interface CustomerInteraction {
  id: string;
  customerId: string;
  staffId: string;
  type: InteractionType;
  channel: InteractionChannel;
  subject: string;
  content?: string;
  outcome?: string;
  followUpAt?: string;
  duration?: number;
  createdAt: string;
  staff?: { id: string; fullName: string };
}

export interface CustomerNote {
  id: string;
  customerId: string;
  staffId: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  staff?: { id: string; fullName: string };
}

export interface RfmScore {
  customerId: string;
  customerName: string;
  recency: number;
  frequency: number;
  monetary: number;
  totalScore: number;
  segment: string;
  lastBookingDays: number;
  churnRisk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface TimelineItem {
  type: 'BOOKING' | 'INTERACTION' | 'COMMUNICATION';
  date: string;
  data: Record<string, unknown>;
}

export interface CustomerStats {
  totalBookings: number;
  totalSpent: number;
  yearlySpend: number;
  vipTier: VipTier;
  topRoutes: { route: string; count: number }[];
  lastBookingDate: string | null;
  averageTicketValue: number;
}

