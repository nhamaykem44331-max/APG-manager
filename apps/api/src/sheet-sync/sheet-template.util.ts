import { SheetRow } from './dto/sheet-row.dto';

export const BOOKING_SHEET_TEMPLATE_VERSION = 'APG_BOOKING_SYNC_V2';

type SheetColumnKey = keyof SheetRow;

type SheetColumnDefinition = {
  key: SheetColumnKey;
  header: string;
  aliases?: string[];
};

export const BOOKING_SHEET_COLUMNS: SheetColumnDefinition[] = [
  { key: 'stt', header: 'STT' },
  { key: 'pnr', header: 'PNR' },
  { key: 'contactName', header: 'Tên đại diện', aliases: ['Tên Đại Diện', 'Ten dai dien', 'Contact Name'] },
  { key: 'dob', header: 'DOB', aliases: ['Ngày sinh', 'Date of Birth'] },
  { key: 'route', header: 'Hành trình', aliases: ['Hanh trinh', 'Route'] },
  { key: 'flightDate', header: 'Ngày bay', aliases: ['Khoi hanh', 'Khởi hành', 'Flight Date'] },
  { key: 'paxCount', header: 'SL Pax', aliases: ['So luong khach', 'Pax Count'] },
  { key: 'airline', header: 'Hãng', aliases: ['Hang bay', 'Airline'] },
  { key: 'supplier', header: 'Nhà cung cấp', aliases: ['Nha cung cap', 'Supplier'] },
  { key: 'issueDate', header: 'Ngày bán (ngày xuất vé)', aliases: ['Ngay ban', 'Ngay xuat ve', 'Issue Date'] },
  { key: 'costPrice', header: 'Giá vốn', aliases: ['Gia von', 'Cost Price'] },
  { key: 'sellPrice', header: 'REV FIT', aliases: ['Gia ban', 'Sell Price'] },
  { key: 'profit', header: 'Lợi nhuận FIT', aliases: ['Lãi/Lỗ', 'Loi nhuan fit', 'Profit'] },
  { key: 'note', header: 'Note', aliases: ['Ghi chú', 'Note goc', 'Note gốc'] },
  { key: 'pending', header: 'PENDING', aliases: ['Cong no', 'Còn lại', 'PENDING goc', 'PENDING gốc'] },
  { key: 'customerCode', header: 'Mã KH', aliases: ['Mã khách hàng', 'Ma khach hang', 'Customer Code'] },
  { key: 'syncKey', header: 'SYNC_KEY' },
  { key: 'bookingId', header: 'BOOKING_ID', aliases: ['Booking ID'] },
  { key: 'bookingCode', header: 'Mã booking', aliases: ['Booking Code', 'Ma booking'] },
  { key: 'contactPhone', header: 'Điện thoại', aliases: ['Phone', 'Số điện thoại', 'So dien thoai'] },
  { key: 'customerName', header: 'Tên khách hàng', aliases: ['Customer Name', 'Ten khach hang'] },
  { key: 'customerId', header: 'CUSTOMER_ID', aliases: ['Customer ID'] },
  { key: 'customerType', header: 'Loại khách hàng', aliases: ['Customer Type', 'Loai khach hang'] },
  { key: 'bookingStatus', header: 'Trạng thái booking', aliases: ['Trạng thái', 'Booking Status', 'Trang thai booking'] },
  { key: 'paymentStatus', header: 'Trạng thái thanh toán', aliases: ['Payment Status', 'Trang thai thanh toan'] },
  { key: 'paymentMethod', header: 'Phương thức thanh toán', aliases: ['Payment Method', 'Phuong thuc thanh toan'] },
  { key: 'bookingSource', header: 'Nguồn booking', aliases: ['Booking Source', 'Source', 'Nguon booking'] },
  { key: 'createdAt', header: 'Ngày tạo', aliases: ['Created At', 'Ngay tao'] },
  { key: 'updatedAt', header: 'Ngày cập nhật', aliases: ['Updated At', 'Ngay cap nhat'] },
  { key: 'issuedAtIso', header: 'Ngày xuất vé ISO', aliases: ['Issued At ISO', 'Ngay xuat ve ISO'] },
  { key: 'firstDepartureAt', header: 'Khởi hành đầu tiên', aliases: ['First Departure At', 'Khoi hanh dau tien'] },
  { key: 'lastArrivalAt', header: 'Điểm đến cuối', aliases: ['Last Arrival At', 'Diem den cuoi'] },
  { key: 'flightNumbers', header: 'Số hiệu chuyến bay', aliases: ['Flight Numbers', 'So hieu chuyen bay'] },
  { key: 'airlineBookingCodes', header: 'Mã đặt chỗ hãng', aliases: ['Airline Booking Codes', 'Ma dat cho hang'] },
  { key: 'passengerNames', header: 'Hành khách', aliases: ['Passenger Names', 'Hanh khach'] },
  { key: 'staffId', header: 'STAFF_ID', aliases: ['Staff ID'] },
  { key: 'staffName', header: 'Phụ trách', aliases: ['Nhân viên', 'Staff Name', 'Phu trach'] },
  { key: 'supplierId', header: 'SUPPLIER_ID', aliases: ['Supplier ID'] },
  { key: 'supplierCode', header: 'Mã NCC', aliases: ['Supplier Code', 'Ma NCC'] },
  { key: 'supplierName', header: 'Tên NCC', aliases: ['Supplier Name', 'Ten NCC'] },
  { key: 'gdsBookingId', header: 'GDS_BOOKING_ID', aliases: ['GDS Booking ID'] },
  { key: 'internalNotes', header: 'Ghi chú nội bộ', aliases: ['Internal Notes', 'Ghi chu noi bo'] },
  { key: 'totalFees', header: 'Tổng phí', aliases: ['Total Fees', 'Tong phi'] },
  { key: 'paidAmount', header: 'Tổng đã thanh toán', aliases: ['Paid Amount', 'Tong da thanh toan'] },
  { key: 'latestPaymentAt', header: 'Thanh toán gần nhất', aliases: ['Latest Payment At', 'Thanh toan gan nhat'] },
  { key: 'bookingJson', header: 'BOOKING_JSON', aliases: ['Booking JSON'] },
  { key: 'templateVersion', header: 'TEMPLATE_VERSION', aliases: ['Template Version'] },
];

export const BOOKING_SHEET_HEADERS = BOOKING_SHEET_COLUMNS.map((column) => column.header);

export function normalizeSheetHeader(value?: string | number | null) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toUpperCase();
}

export function buildSheetColumnMap(headerRow: Array<string | number | null | undefined>) {
  const headerIndexByNormalizedValue = new Map<string, number>();

  headerRow.forEach((cell, index) => {
    const normalized = normalizeSheetHeader(cell);
    if (!normalized || headerIndexByNormalizedValue.has(normalized)) {
      return;
    }
    headerIndexByNormalizedValue.set(normalized, index);
  });

  const columnMap = new Map<SheetColumnKey, number>();

  for (const column of BOOKING_SHEET_COLUMNS) {
    const candidates = [column.header, ...(column.aliases ?? [])];
    const matchedHeader = candidates
      .map((candidate) => normalizeSheetHeader(candidate))
      .find((candidate) => headerIndexByNormalizedValue.has(candidate));

    if (matchedHeader) {
      columnMap.set(column.key, headerIndexByNormalizedValue.get(matchedHeader)!);
    }
  }

  return columnMap;
}

export function getSheetCellValue(
  row: Array<string | number | null | undefined>,
  columnMap: Map<SheetColumnKey, number>,
  key: SheetColumnKey,
) {
  const index = columnMap.get(key);
  if (index === undefined) {
    return '';
  }

  return String(row[index] ?? '').trim();
}

export function getSheetNumberValue(
  row: Array<string | number | null | undefined>,
  columnMap: Map<SheetColumnKey, number>,
  key: SheetColumnKey,
) {
  const raw = getSheetCellValue(row, columnMap, key);
  const normalized = raw.replace(/[^\d.-]/g, '');
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function sheetRowToValues(row: SheetRow) {
  return BOOKING_SHEET_COLUMNS.map((column) => row[column.key] ?? '');
}

export function hasAnySheetValue(row: Array<string | number | null | undefined>) {
  return row.some((cell) => String(cell ?? '').trim() !== '');
}

export function columnIndexToLetter(index: number) {
  let value = index + 1;
  let letters = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
}
