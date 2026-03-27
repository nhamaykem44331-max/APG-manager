export interface SheetRow {
  stt: number;
  pnr: string;
  contactName: string;
  dob: string;
  route: string;
  flightDate: string;
  paxCount: number;
  airline: string;
  supplier: string;
  issueDate: string;
  costPrice: number;
  sellPrice: number;
  profit: number;
  note: string;
  pending: string;
  customerCode: string;
  syncKey: string;
  bookingId: string;
  bookingCode: string;
  contactPhone: string;
  customerName: string;
  customerId: string;
  customerType: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  bookingSource: string;
  createdAt: string;
  updatedAt: string;
  issuedAtIso: string;
  firstDepartureAt: string;
  lastArrivalAt: string;
  flightNumbers: string;
  airlineBookingCodes: string;
  passengerNames: string;
  staffId: string;
  staffName: string;
  supplierId: string;
  supplierCode: string;
  supplierName: string;
  gdsBookingId: string;
  internalNotes: string;
  totalFees: number;
  paidAmount: number;
  latestPaymentAt: string;
  bookingJson: string;
  templateVersion: string;
}

export interface SyncResult {
  success: boolean;
  rowsProcessed: number;
  rowsWritten: number;
  sheetUrl: string;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  rowCount: number;
  fileSize: number;
}

export interface SheetInfo {
  title?: string | null;
  rowCount?: number | null;
  url: string;
  columnCount: number;
  templateVersion: string;
  headers: string[];
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
