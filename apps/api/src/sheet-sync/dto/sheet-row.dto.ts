export interface SheetRow {
  stt: number;
  pnr: string;
  contactName: string;
  dob: string;              // để trống
  route: string;            // "HANSGN", "HANSGNHAN"
  flightDate: string;       // "24Mar" hoặc "24Mar - 28Mar"
  paxCount: number;
  airline: string;          // VN, VJ, QH...
  supplier: string;         // để trống (future mapping)
  issueDate: string;        // "2026-03-24"
  costPrice: number;        // integer
  sellPrice: number;        // integer
  profit: number;           // integer
  note: string;             // "Done" / "Pending..."
  pending: string;          // để trống
  customerCode: string;     // Mã KH
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

// ============================================
// IMPORT FROM GOOGLE SHEETS
// ============================================

export interface ImportPreviewRow {
  rowIndex: number;         // Dòng gốc trên Sheet (2-based, bỏ header)
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
  // Trạng thái trùng lặp
  existsInDb: boolean;      // true nếu PNR đã có trong DB
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
