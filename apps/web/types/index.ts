// APG Manager RMS - TypeScript Types (toàn bộ kiểu dữ liệu chia sẻ)

// ===== ENUMS =====

export type UserRole = 'ADMIN' | 'MANAGER' | 'SALES' | 'ACCOUNTANT';
export type UserPermissionModule =
  | 'dashboard'
  | 'bookings'
  | 'customers'
  | 'finance'
  | 'reports'
  | 'sales'
  | 'priceLookup'
  | 'settings';

export type UserPermissionAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'export';

export type UserPermissions = Record<UserPermissionModule, Record<UserPermissionAction, boolean>>;

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

export type AdjustmentType = 'CHANGE' | 'REFUND_CREDIT' | 'REFUND_CASH';

export type BookingSource =
  | 'WEBSITE' | 'ZALO' | 'MESSENGER' | 'PHONE' | 'WALK_IN' | 'REFERRAL';

export type PaymentMethod =
  | 'CASH' | 'BANK_TRANSFER' | 'CREDIT_CARD' | 'MOMO' | 'VNPAY' | 'DEBT';

export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'REFUNDED';

export type CustomerType = 'INDIVIDUAL' | 'CORPORATE';
export type InvoiceDirection = 'INCOMING' | 'OUTGOING';
export type InvoiceSourceType = 'MANUAL' | 'BOOKING_BATCH' | 'OCR_IMPORT' | 'MISA_IMPORT';
export type InvoiceStatus =
  | 'ELIGIBLE'
  | 'DRAFT'
  | 'READY_FOR_EXPORT'
  | 'EXPORTED_TO_MISA'
  | 'ISSUED_IN_MISA'
  | 'SENT_TO_CUSTOMER'
  | 'VIEWED'
  | 'PAID'
  | 'PARTIAL_PAID'
  | 'CANCELLED'
  | 'ADJUSTED'
  | 'OCR_PENDING'
  | 'NEED_REVIEW'
  | 'VERIFIED'
  | 'MATCHED'
  | 'INVALID'
  | 'REJECTED'
  | 'NOT_REQUESTED';
export type InvoiceAttachmentType = 'IMAGE' | 'PDF' | 'XML' | 'EXCEL' | 'OTHER';
export type InvoiceImportStatus = 'OCR_PENDING' | 'NEED_REVIEW' | 'VERIFIED' | 'IMPORTED' | 'FAILED';
export type InvoiceExportType = 'DEBT_STATEMENT' | 'OUTGOING_REQUEST';

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
  permissions?: UserPermissions;
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
  customerCode?: string;
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
  businessDate?: string;
  updatedAt: string;
  issuedAt?: string;
  // Relations
  customer?: Customer;
  staff?: User;
  tickets?: Ticket[];
  payments?: Payment[];
  statusHistory?: BookingStatusLog[];
  // Nhà cung cấp vé
  supplierId?: string;
  supplier?: Pick<SupplierProfile, 'id' | 'code' | 'name' | 'type' | 'contactName'>;
  ledgers?: { id: string; code: string; direction: string; status: string; remaining: number; totalAmount: number; createdAt: string }[];
  adjustments?: BookingAdjustment[];
}

export interface BookingAdjustment {
  id: string;
  bookingId: string;
  type: AdjustmentType;
  changeFee: number;
  chargeToCustomer: number;
  refundAmount: number;
  notes?: string;
  createdBy?: string;
  createdAt: string;
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

export interface DashboardOverviewMetric {
  monthRevenue: number;
  monthProfit: number;
  profitMargin: number;
  ticketsSold: number;
  receivable: number;
  payable: number;
  bankHtx: number;
  cashOffice: number;
}

export interface DashboardOverviewTimelinePoint {
  date: string;
  revenue: number;
  profit: number;
  receivable: number;
  payable: number;
}

export interface DashboardOverviewAirline {
  airline: string;
  value: number;
  percent: number;
}

export interface DashboardOverviewBooking {
  id: string;
  bookingCode: string;
  pnr?: string | null;
  contactName: string;
  route: string;
  totalSellPrice: number;
  status: string;
  createdAt: string;
}

export interface DashboardOverviewAlert {
  type: 'warning' | 'error' | 'info' | 'success';
  text: string;
  time: string;
}

export interface DashboardOverview {
  summary: DashboardOverviewMetric;
  timeline: DashboardOverviewTimelinePoint[];
  airlines: DashboardOverviewAirline[];
  recentBookings: DashboardOverviewBooking[];
  alerts: DashboardOverviewAlert[];
  generatedAt: string;
}

export interface RevenueChartData {
  date: string;
  revenue: number;
  profit: number;
  tickets: number;
  receivable?: number;
  payable?: number;
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
  totalRevenue: number;
  totalProfit: number;
  totalPaid: number;
  outstandingDebt: number;
  activeDebts: number;
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
  customer?: Pick<Customer, 'id' | 'fullName' | 'phone' | 'type' | 'customerCode'>;
  supplier?: Pick<SupplierProfile, 'id' | 'code' | 'name' | 'type'>;
  booking?: { id: string; bookingCode: string; pnr?: string | null; totalSellPrice: number };
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

export interface InvoiceLineItem {
  id: string;
  invoiceId: string;
  lineNo: number;
  bookingId?: string | null;
  bookingCode?: string | null;
  pnr?: string | null;
  ticketIds: string[];
  description: string;
  passengerName?: string | null;
  passengerType?: string | null;
  route?: string | null;
  quantity: number;
  unitName?: string | null;
  currencyCode: string;
  unitPrice: number;
  amountBeforeVat: number;
  vatRate: number;
  vatAmount: number;
  amount: number;
  serviceFee: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceAttachment {
  id: string;
  invoiceId: string;
  type: InvoiceAttachmentType;
  fileName: string;
  mimeType?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
}

export interface InvoiceReviewLog {
  id: string;
  invoiceId: string;
  action: string;
  fromStatus?: InvoiceStatus | null;
  toStatus?: InvoiceStatus | null;
  payload?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: string;
}

export type InvoicePaymentState = 'NO_LEDGER' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface InvoiceLedgerPreview {
  id: string;
  code: string;
  direction: LedgerDirection;
  status: DebtStatus;
  bookingId?: string | null;
  bookingCode?: string | null;
  invoiceNumber?: string | null;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  dueDate: string;
}

export interface InvoiceLedgerSummary {
  ledgerCount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  overdueAmount: number;
  overdueCount: number;
  paymentStatus: InvoicePaymentState;
  ledgers: InvoiceLedgerPreview[];
}

export interface InvoiceLinkedBooking {
  id: string;
  bookingCode: string;
  pnr?: string | null;
  status: BookingStatus;
  issuedAt?: string | null;
  paymentStatus: PaymentStatus;
  route: string;
  passengerSummary: string;
  customerId: string;
  customerName: string;
  supplierId?: string | null;
  supplierName?: string | null;
  totalSellPrice: number;
  totalNetPrice: number;
}

export interface InvoiceBusinessLinkage {
  linkedBookingCount: number;
  unmatchedLineCount: number;
  duplicatePnrCount: number;
  counterpartyMatched: boolean;
  counterpartyMismatchCount: number;
}

export interface InvoiceRecord {
  id: string;
  code: string;
  direction: InvoiceDirection;
  sourceType: InvoiceSourceType;
  status: InvoiceStatus;
  invoiceDate: string;
  periodFrom?: string | null;
  periodTo?: string | null;
  currencyCode: string;
  paymentMethod?: string | null;
  customerId?: string | null;
  supplierId?: string | null;
  buyerType?: CustomerType | null;
  invoiceNumber?: string | null;
  invoiceSeries?: string | null;
  invoiceTemplateNo?: string | null;
  transactionId?: string | null;
  lookupUrl?: string | null;
  sellerLegalName?: string | null;
  sellerTaxCode?: string | null;
  sellerAddress?: string | null;
  sellerEmail?: string | null;
  sellerPhone?: string | null;
  sellerBankAccount?: string | null;
  sellerBankName?: string | null;
  buyerLegalName?: string | null;
  buyerTaxCode?: string | null;
  buyerAddress?: string | null;
  buyerEmail?: string | null;
  buyerPhone?: string | null;
  buyerFullName?: string | null;
  supplierLegalName?: string | null;
  supplierTaxCode?: string | null;
  supplierAddress?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierBankAccount?: string | null;
  supplierBankName?: string | null;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  tags: string[];
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: Pick<Customer, 'id' | 'fullName' | 'phone' | 'email' | 'type' | 'companyName' | 'companyTaxId' | 'customerCode'> | null;
  supplier?: Pick<SupplierProfile, 'id' | 'code' | 'name' | 'type' | 'taxId' | 'contactName' | 'contactPhone' | 'contactEmail' | 'bankAccount' | 'bankName'> | null;
  lines: InvoiceLineItem[];
  attachments: InvoiceAttachment[];
  reviews: InvoiceReviewLog[];
  linkedBookings?: InvoiceLinkedBooking[];
  paymentSummary?: InvoiceLedgerSummary & {
    ledgerDirection: LedgerDirection;
  };
  businessLinkage?: InvoiceBusinessLinkage;
}

export interface InvoiceSummary {
  incomingCount: number;
  incomingTotal: number;
  outgoingCount: number;
  outgoingTotal: number;
  reviewQueueCount: number;
  readyForExportCount: number;
  eligibleBookingCount: number;
  missingSupplierCount: number;
  missingIncomingCount: number;
  missingOutgoingCount: number;
  receivableOutstandingCount: number;
  receivableOutstandingAmount: number;
  payableOutstandingCount: number;
  payableOutstandingAmount: number;
  receivableOverdueAmount: number;
  payableOverdueAmount: number;
}

export type InvoiceCoverageStatus = 'READY' | 'MISSING' | 'MISSING_SUPPLIER';

export interface InvoiceCoveragePreview {
  id: string;
  code: string;
  direction: InvoiceDirection;
  status: InvoiceStatus;
  invoiceNumber?: string | null;
  invoiceDate: string;
}

export interface InvoiceCoverageItem {
  bookingId: string;
  bookingCode: string;
  pnr?: string | null;
  bookingStatus: BookingStatus;
  issuedAt?: string | null;
  paymentStatus: PaymentStatus;
  route: string;
  passengerSummary: string;
  customerId: string;
  customerType?: CustomerType | null;
  customerName: string;
  customerTaxCode?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  supplierCode?: string | null;
  totalSellPrice: number;
  totalNetPrice: number;
  incomingStatus: InvoiceCoverageStatus;
  outgoingStatus: Exclude<InvoiceCoverageStatus, 'MISSING_SUPPLIER'>;
  incomingInvoices: InvoiceCoveragePreview[];
  outgoingInvoices: InvoiceCoveragePreview[];
  receivableSummary: InvoiceLedgerSummary;
  payableSummary: InvoiceLedgerSummary;
}

export interface InvoiceDebtStatementRow {
  rowNo: number;
  bookingId: string;
  bookingCode: string;
  pnr: string;
  issuedAt: string;
  route: string;
  passengerSummary: string;
  currencyCode: string;
  ticketQuantity: number;
  unitPrice: number;
  vatAmount: number;
  totalAmount: number;
  notes?: string | null;
  paymentMethod: PaymentMethod;
  bookingPaymentStatus: PaymentStatus;
  outgoingInvoice?: {
    id: string;
    code: string;
    status: InvoiceStatus;
    invoiceNumber?: string | null;
    invoiceDate: string;
  } | null;
  receivableSummary: InvoiceLedgerSummary;
}

export interface InvoiceDebtStatement {
  generatedAt: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  seller: {
    sellerLegalName: string;
    sellerTaxCode: string;
    sellerAddress: string;
    sellerEmail: string;
    sellerPhone: string;
    sellerBankAccount: string;
    sellerBankName: string;
  };
  customer?: Pick<Customer, 'id' | 'fullName' | 'phone' | 'email' | 'type' | 'companyName' | 'companyTaxId' | 'customerCode'> | null;
  rows: InvoiceDebtStatementRow[];
  summary: {
    bookingCount: number;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    overdueAmount: number;
    paymentMethods: PaymentMethod[];
  };
}

export interface InvoiceImportBatchInvoicePreview {
  id: string;
  code: string;
  direction: InvoiceDirection;
  status: InvoiceStatus;
  invoiceNumber?: string | null;
  invoiceDate: string;
}

export interface InvoiceImportBatch {
  id: string;
  status: InvoiceImportStatus;
  supplierId?: string | null;
  invoiceId?: string | null;
  fileName: string;
  mimeType?: string | null;
  fileSize?: number | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  ocrProvider?: string | null;
  errorMessage?: string | null;
  extractedData?: Record<string, unknown> | null;
  reviewedData?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: Pick<SupplierProfile, 'id' | 'code' | 'name' | 'taxId'> | null;
  invoice?: InvoiceImportBatchInvoicePreview | null;
}

export interface InvoiceExportBatch {
  id: string;
  type: InvoiceExportType;
  invoiceId?: string | null;
  customerId?: string | null;
  fileName: string;
  filePath: string;
  mimeType: string;
  rowCount: number;
  filters?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
  createdBy?: string | null;
  createdAt: string;
  customer?: Pick<Customer, 'id' | 'fullName' | 'companyName' | 'customerCode' | 'companyTaxId'> | null;
  invoice?: InvoiceImportBatchInvoicePreview | null;
}

// ===== PHASE B: DÒNG TIỀN + CHI PHÍ VẬN HÀNH =====

export type CashFlowDirection = 'INFLOW' | 'OUTFLOW';
export type FundAccount = 'CASH_OFFICE' | 'BANK_HTX' | 'BANK_PERSONAL';
export type CashFlowSourceType =
  | 'MANUAL'
  | 'BOOKING_PAYMENT'
  | 'LEDGER_PAYMENT'
  | 'OPERATING_EXPENSE'
  | 'FUND_TRANSFER'
  | 'FUND_ADJUSTMENT'
  | 'DEPOSIT_TOPUP';

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
  fundAccount?: FundAccount | null;
  counterpartyFundAccount?: FundAccount | null;
  pic: string;
  description: string;
  reference?: string;
  date: string;
  status: string;
  notes?: string;
  reason?: string | null;
  sourceType?: CashFlowSourceType | null;
  sourceId?: string | null;
  transferGroupId?: string | null;
  isLocked?: boolean;
  updatedAt?: string;
  balanceAfter?: number;
  signedAmount?: number;
  fundLabel?: string;
  counterpartyFundLabel?: string;
  sourceLabel?: string;
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
  fundAccount?: FundAccount | null;
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

export interface FundBalanceSummary {
  fund: FundAccount;
  label: string;
  inflow: number;
  outflow: number;
  balance: number;
  lastTransactionAt?: string | null;
  movementCount: number;
}

export interface FundsOverview {
  totalBalance: number;
  funds: FundBalanceSummary[];
  recentEntries: CashFlowEntry[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export interface FundLedgerResponse {
  data: CashFlowEntry[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
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

export type ParseTripType = 'ONE_WAY' | 'ROUND_TRIP' | 'MULTI_CITY' | 'UNKNOWN';

export interface ParseResult {
  success: boolean;
  method: 'REGEX_PNR' | 'GROQ_AI' | 'N8N_WEBHOOK';
  pnr: string | null;
  tripType?: ParseTripType;
  passengerCount: number;
  segmentCount: number;
  totalTickets: number;
  tickets: ParsedTicketData[];
  warnings?: string[];
  raw?: string;
  error?: string;
}

// ============================================
// SHEET SYNC
// ============================================

export interface SheetInfo {
  title: string;
  rowCount: number;
  url: string;
  columnCount: number;
  templateVersion: string;
  headers: string[];
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
  syncKey: string;
  bookingId: string;
  bookingCode: string;
  pnr: string;
  contactName: string;
  contactPhone: string;
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
  bookingStatus: string;
  paymentStatus: string;
  staffName: string;
  templateVersion: string;
  hasStructuredSnapshot: boolean;
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

export interface ResetOperationalDataResult {
  success: boolean;
  message: string;
  confirmedBy: string;
  deleted: {
    auditLogs: number;
    customers: number;
    bookings: number;
    tickets: number;
    passengers: number;
    payments: number;
    debts: number;
    bookingStatusLogs: number;
    customerInteractions: number;
    customerNotes: number;
    communicationLogs: number;
    ledgers: number;
    ledgerPayments: number;
    cashFlowEntries: number;
    operatingExpenses: number;
    dailyReconciliations: number;
  };
  preserved: {
    users: number;
    supplierProfiles: number;
    airlineDeposits: number;
  };
}

