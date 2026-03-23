import { SheetRow } from './dto/sheet-row.dto';

// Standardized parser shared between directly mutating the live Google Sheets
// vs downloading fully baked generic XLSX archives to the user's machines.

export function formatFlightDate(tickets: { departureTime: Date }[]): string {
  if (!tickets || tickets.length === 0) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const first = tickets[0].departureTime;
  const last = tickets[tickets.length - 1].departureTime;
  const fmt = (d: Date) => `${d.getDate()}${months[d.getMonth()]}`;
  
  const firstStr = fmt(first);
  const lastStr = fmt(last);
  
  if (first.toDateString() === last.toDateString() || firstStr === lastStr) {
    return firstStr;
  }
  return `${firstStr} - ${lastStr}`;
}

export function formatSheetDate(d: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()}${months[d.getMonth()]}`;
}

export function buildRouteString(tickets: { departureCode: string; arrivalCode: string }[]): string {
  if (!tickets || tickets.length === 0) return '';
  if (tickets.length === 1) {
    return `${tickets[0].departureCode}${tickets[0].arrivalCode}`;
  }
  // Ghép liên hoàn hành trình transit VD: HAN-SGN-HAN
  let route = tickets[0].departureCode;
  for (const t of tickets) {
    route += t.arrivalCode;
  }
  return route;
}

export function convertBookingToSheetRow(bk: any, idx: number): SheetRow {
  const tickets = bk.tickets ?? [];
  const route = buildRouteString(tickets);
  const flightDate = formatFlightDate(tickets);
  const airline = tickets[0]?.airline ?? '';
  
  const uniquePax = new Set(tickets.map((t: any) => t.passengerId));

  const notePrefix = bk.paymentStatus === 'PAID' ? 'Done' : 'Pending';
  const note = bk.notes
    ? (bk.notes.startsWith('Done') || bk.notes.startsWith('Pending') ? bk.notes : `${notePrefix}. ${bk.notes}`)
    : notePrefix;

  return {
    stt: idx,
    pnr: bk.pnr ?? bk.bookingCode,
    contactName: bk.contactName || (bk.customer?.fullName ?? ''),
    dob: '',
    route,
    flightDate,
    paxCount: uniquePax.size || 1,
    airline,
    supplier: '',
    issueDate: formatSheetDate(bk.issuedAt ?? bk.createdAt),
    costPrice: Math.round(Number(bk.totalNetPrice || 0)),
    sellPrice: Math.round(Number(bk.totalSellPrice || 0)),
    profit: Math.round(Number(bk.profit || 0)),
    note,
    pending: '',
    customerCode: bk.customer?.customerCode ?? '',
  };
}
