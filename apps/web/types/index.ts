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

// ===== REPORTS (ADVANCED) =====
export interface MonthlySummary {
  month: string;
  revenue: number;
  cost: number;
  profit: number;
  profitMargin: number;
  bookingCount: number;
  ticketCount: number;
  avgTicketValue: number;
}

export interface AirlineBreakdown {
  airline: string;
  ticketCount: number;
  revenue: number;
  cost: number;
  profit: number;
  profitMargin: number;
  percentage: number;
}

export interface RouteAnalysis {
  route: string;
  departureCode: string;
  arrivalCode: string;
  ticketCount: number;
  revenue: number;
  profit: number;
  avgPrice: number;
  topAirline: string;
}

export interface SourceAnalysis {
  source: string;
  bookingCount: number;
  revenue: number;
  profit: number;
  conversionRate: number;
  avgValue: number;
}

export interface StaffPerformance {
  staffId: string;
  staffName: string;
  role: string;
  bookingCount: number;
  ticketCount: number;
  revenue: number;
  profit: number;
  profitMargin: number;
  avgBookingValue: number;
  conversionRate: number;
  topAirline: string;
  topRoute: string;
}

export interface CustomerRanking {
  customerId: string;
  customerName: string;
  customerType: string;
  vipTier: string;
  bookingCount: number;
  ticketCount: number;
  totalSpent: number;
  profit: number;
  lastBookingDate: string;
}

export interface PaymentSummaryAnalysis {
  totalPaid: number;
  totalUnpaid: number;
  totalDebt: number;
  collectionRate: number;
  methods: { method: string; transactionCount: number; totalAmount: number; percentage: number }[];
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

// ===== PHASE A: ACCOUNTS LEDGER SYSTEM =====

export type LedgerDirection = 'RECEIVABLE' | 'PAYABLE';

export type LedgerPartyType =
  | 'CUSTOMER_INDIVIDUAL'
  | 'CUSTOMER_CORPORATE'
  | 'AIRLINE'
  | 'GDS_PROVIDER'
  | 'PARTNER'
  | 'OTHER_SUPPLIER';

export interface AccountsLedger {
  id: string;
  code: string;
  direction: LedgerDirection;
  partyType: LedgerPartyType;
  customerId?: string;
  supplierId?: string;
  customerCode?: string;
  bookingId?: string;
  bookingCode?: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  issueDate: string;
  dueDate: string;
  status: DebtStatus;
  description?: string;
  invoiceNumber?: string;
  pic?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  customer?: Pick<Customer, 'id' | 'fullName' | 'phone' | 'type'>;
  supplier?: Pick<SupplierProfile, 'id' | 'code' | 'name' | 'type'>;
  booking?: { id: string; bookingCode: string; totalSellPrice: number };
  payments?: LedgerPayment[];
}

export interface LedgerPayment {
  id: string;
  ledgerId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paidAt: string;
  paidBy?: string;
  notes?: string;
  createdAt: string;
}

export interface SupplierProfile {
  id: string;
  code: string;
  name: string;
  type: LedgerPartyType;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  taxId?: string;
  bankAccount?: string;
  bankName?: string;
  creditLimit?: number;
  paymentTerms?: number;
  feedbackRate?: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  totalDebt?: number;
  ledgerCount?: number;
}

export interface LedgerSummary {
  totalReceivable: number;
  totalPayable: number;
  netPosition: number;
  overdueReceivable: number;
  overduePayable: number;
  receivableCount: number;
  payableCount: number;
}

export interface LedgerAging {
  direction: string;
  buckets: Record<string, number>;
  total: number;
}

// ===== PHASE B: DÒNG TIỀN + CHI PHÍ VẬN HÀNH =====

export type CashFlowDirection = 'INFLOW' | 'OUTFLOW';

export type CashFlowCategory =
  | 'TICKET_PAYMENT' | 'TICKET_REFUND' | 'PARTNER_FEEDBACK'
  | 'AIRLINE_PAYMENT' | 'SALARY' | 'OFFICE_RENT' | 'OFFICE_SUPPLIES'
  | 'ENTERTAINMENT' | 'TRAVEL' | 'RITUAL' | 'MARKETING' | 'TECHNOLOGY'
  | 'DISBURSEMENT' | 'OTHER';

export interface CashFlowEntry {
  id: string;
  direction: CashFlowDirection;
  category: CashFlowCategory;
  amount: number;
  pic: string;
  description: string;
  reference?: string;
  date: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface OperatingExpense {
  id: string;
  category: CashFlowCategory;
  description: string;
  amount: number;
  date: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface CashFlowSummary {
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  inflowCount: number;
  outflowCount: number;
}

export interface MonthlyFlow {
  month: string;
  inflow?: number;
  outflow?: number;
  net?: number;
  total?: number;
}

// ===== PHASE D: CRM NÂNG CAO + SALES PIPELINE =====

export type LeadStatus =
  | 'NEW' | 'CONTACTED' | 'NEGOTIATING' | 'WON' | 'ACTIVE' | 'LOST' | 'ON_HOLD';

export interface SalesLead {
  id: string;
  salesPerson: string;
  companyName: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  customerCode?: string;
  source?: string;
  description?: string;
  status: LeadStatus;
  notes?: string;
  nextAction?: string;
  nextActionDate?: string;
  estimatedValue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PipelineColumn {
  status: LeadStatus;
  leads: SalesLead[];
  count: number;
  totalValue: number;
}

export interface PipelineSummary {
  pipeline: PipelineColumn[];
  summary: {
    total: number;
    won: number;
    active: number;
    totalPipelineValue: number;
  };
}

// ==========================================
// THÔNG TIN VÉ - SMART IMPORT
// ==========================================
export interface ParsedTicketData {
  passengerName: string;
  passengerType: 'ADT' | 'CHD' | 'INF';
  airline: string;
  flightNumber: string;
  fareClass: string;
  departureCode: string;
  arrivalCode: string;
  departureTime: string;
  arrivalTime: string;
  seatClass: string;
  eTicketNumber?: string;
  baggageAllowance?: string;
  pnr?: string;
}

export interface ParseResult {
  success: boolean;
  method: 'REGEX_PNR' | 'GEMINI_VISION';
  pnr: string | null;
  passengerCount: number;
  segmentCount: number;
  totalTickets: number;
  tickets: ParsedTicketData[];
  error?: string;
}

// ============================================
// SHEET SYNC
// ============================================

export interface SheetInfo {
  title: string;
  rowCount: number;
  url: string;
}

export interface SyncResult {
  success: boolean;
  rowsProcessed: number;
  rowsWritten: number;
  sheetUrl: string;
  error?: string;
}

export interface ImportPreviewRow {
  rowIndex: number;
  pnr: string;
  contactName: string;
  route: string;
  flightDate: string;
  paxCount: number;
  airline: string;
  issueDate: string;
  costPrice: number;
  sellPrice: number;
  profit: number;
  note: string;
  customerCode: string;
  existsInDb: boolean;
  existingBookingId?: string;
  existingBookingCode?: string;
}

export interface ImportResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

