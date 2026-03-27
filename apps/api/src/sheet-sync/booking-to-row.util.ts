import { BOOKING_SHEET_TEMPLATE_VERSION } from './sheet-template.util';
import { SheetRow } from './dto/sheet-row.dto';

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toIsoString(value?: Date | string | null) {
  if (!value) {
    return '';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function formatSheetDate(value?: Date | string | null) {
  if (!value) {
    return '';
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const day = parsed.getDate().toString().padStart(2, '0');
  const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatFlightDate(tickets: Array<{ departureTime?: Date | string | null }>) {
  if (!tickets || tickets.length === 0) {
    return '';
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parsedDates = tickets
    .map((ticket) => ticket.departureTime)
    .filter(Boolean)
    .map((value) => new Date(value as Date | string))
    .filter((value) => !Number.isNaN(value.getTime()));

  if (parsedDates.length === 0) {
    return '';
  }

  const first = parsedDates[0];
  const last = parsedDates[parsedDates.length - 1];
  const formatValue = (date: Date) => `${date.getDate()}${months[date.getMonth()]}`;

  if (first.toDateString() === last.toDateString()) {
    return formatValue(first);
  }

  return `${formatValue(first)} - ${formatValue(last)}`;
}

export function buildRouteString(tickets: Array<{ departureCode?: string | null; arrivalCode?: string | null }>) {
  if (!tickets || tickets.length === 0) {
    return '';
  }

  const codes = [tickets[0].departureCode, ...tickets.map((ticket) => ticket.arrivalCode)]
    .map((code) => String(code ?? '').trim().toUpperCase())
    .filter(Boolean);

  return codes.join('-');
}

function buildBookingSnapshot(bk: any) {
  return {
    id: bk.id ?? '',
    bookingCode: bk.bookingCode ?? '',
    pnr: bk.pnr ?? '',
    gdsBookingId: bk.gdsBookingId ?? '',
    status: bk.status ?? '',
    source: bk.source ?? '',
    paymentMethod: bk.paymentMethod ?? '',
    paymentStatus: bk.paymentStatus ?? '',
    contactName: bk.contactName ?? '',
    contactPhone: bk.contactPhone ?? '',
    totalSellPrice: toNumber(bk.totalSellPrice),
    totalNetPrice: toNumber(bk.totalNetPrice),
    totalFees: toNumber(bk.totalFees),
    profit: toNumber(bk.profit),
    notes: bk.notes ?? '',
    internalNotes: bk.internalNotes ?? '',
    createdAt: toIsoString(bk.createdAt),
    updatedAt: toIsoString(bk.updatedAt),
    issuedAt: toIsoString(bk.issuedAt),
    customer: bk.customer
      ? {
          id: bk.customer.id ?? '',
          fullName: bk.customer.fullName ?? '',
          phone: bk.customer.phone ?? '',
          email: bk.customer.email ?? '',
          type: bk.customer.type ?? '',
          customerCode: bk.customer.customerCode ?? '',
          dateOfBirth: toIsoString(bk.customer.dateOfBirth),
          companyName: bk.customer.companyName ?? '',
        }
      : null,
    staff: bk.staff
      ? {
          id: bk.staff.id ?? '',
          fullName: bk.staff.fullName ?? '',
          email: bk.staff.email ?? '',
          role: bk.staff.role ?? '',
        }
      : null,
    supplier: bk.supplier
      ? {
          id: bk.supplier.id ?? '',
          code: bk.supplier.code ?? '',
          name: bk.supplier.name ?? '',
          type: bk.supplier.type ?? '',
          contactName: bk.supplier.contactName ?? '',
        }
      : null,
    tickets: (bk.tickets ?? []).map((ticket: any) => ({
      id: ticket.id ?? '',
      passengerId: ticket.passengerId ?? '',
      airline: ticket.airline ?? '',
      flightNumber: ticket.flightNumber ?? '',
      departureCode: ticket.departureCode ?? '',
      arrivalCode: ticket.arrivalCode ?? '',
      departureTime: toIsoString(ticket.departureTime),
      arrivalTime: toIsoString(ticket.arrivalTime),
      seatClass: ticket.seatClass ?? '',
      fareClass: ticket.fareClass ?? '',
      airlineBookingCode: ticket.airlineBookingCode ?? '',
      sellPrice: toNumber(ticket.sellPrice),
      netPrice: toNumber(ticket.netPrice),
      tax: toNumber(ticket.tax),
      serviceFee: toNumber(ticket.serviceFee),
      commission: toNumber(ticket.commission),
      profit: toNumber(ticket.profit),
      eTicketNumber: ticket.eTicketNumber ?? '',
      baggageAllowance: ticket.baggageAllowance ?? '',
      status: ticket.status ?? '',
      createdAt: toIsoString(ticket.createdAt),
      passenger: ticket.passenger
        ? {
            id: ticket.passenger.id ?? '',
            customerId: ticket.passenger.customerId ?? '',
            fullName: ticket.passenger.fullName ?? '',
            dateOfBirth: toIsoString(ticket.passenger.dateOfBirth),
            gender: ticket.passenger.gender ?? '',
            idNumber: ticket.passenger.idNumber ?? '',
            passport: ticket.passenger.passport ?? '',
            phone: ticket.passenger.phone ?? '',
            email: ticket.passenger.email ?? '',
            type: ticket.passenger.type ?? '',
          }
        : null,
    })),
    payments: (bk.payments ?? []).map((payment: any) => ({
      id: payment.id ?? '',
      amount: toNumber(payment.amount),
      method: payment.method ?? '',
      reference: payment.reference ?? '',
      paidAt: toIsoString(payment.paidAt),
      notes: payment.notes ?? '',
      fundAccount: payment.fundAccount ?? '',
      createdAt: toIsoString(payment.createdAt),
    })),
    statusHistory: (bk.statusHistory ?? []).map((entry: any) => ({
      id: entry.id ?? '',
      fromStatus: entry.fromStatus ?? '',
      toStatus: entry.toStatus ?? '',
      changedBy: entry.changedBy ?? '',
      reason: entry.reason ?? '',
      createdAt: toIsoString(entry.createdAt),
    })),
    ledgers: (bk.ledgers ?? []).map((ledger: any) => ({
      id: ledger.id ?? '',
      code: ledger.code ?? '',
      direction: ledger.direction ?? '',
      status: ledger.status ?? '',
      remaining: toNumber(ledger.remaining),
      totalAmount: toNumber(ledger.totalAmount),
      createdAt: toIsoString(ledger.createdAt),
    })),
  };
}

export function convertBookingToSheetRow(bk: any, idx: number): SheetRow {
  const tickets = bk.tickets ?? [];
  const payments = (bk.payments ?? []).filter((payment: any) => payment.method !== 'DEBT');
  const route = buildRouteString(tickets);
  const flightDate = formatFlightDate(tickets);
  const firstTicket = tickets[0];
  const lastTicket = tickets[tickets.length - 1];
  const airlines = [...new Set(tickets.map((ticket: any) => String(ticket.airline ?? '').trim()).filter(Boolean))];
  const flightNumbers = [...new Set(tickets.map((ticket: any) => String(ticket.flightNumber ?? '').trim()).filter(Boolean))];
  const airlineBookingCodes = [...new Set(tickets.map((ticket: any) => String(ticket.airlineBookingCode ?? '').trim()).filter(Boolean))];
  const passengerNames = [
    ...new Set(
      tickets
        .map((ticket: any) => String(ticket.passenger?.fullName ?? '').trim())
        .filter(Boolean),
    ),
  ];

  const uniquePaxIds = new Set(
    tickets
      .map((ticket: any) => String(ticket.passengerId ?? '').trim())
      .filter(Boolean),
  );

  const paidAmount = payments.reduce((sum: number, payment: any) => sum + toNumber(payment.amount), 0);
  const remainingAmount = Math.max(toNumber(bk.totalSellPrice) - paidAmount, 0);
  const notePrefix = bk.paymentStatus === 'PAID' ? 'Done' : 'Pending';
  const note = bk.notes
    ? (bk.notes.startsWith('Done') || bk.notes.startsWith('Pending') ? bk.notes : `${notePrefix}. ${bk.notes}`)
    : notePrefix;
  const snapshot = buildBookingSnapshot(bk);

  return {
    stt: idx,
    pnr: bk.pnr ?? '',
    contactName: bk.contactName || bk.customer?.fullName || '',
    dob: formatSheetDate(bk.customer?.dateOfBirth ?? tickets[0]?.passenger?.dateOfBirth ?? null),
    route,
    flightDate,
    paxCount: uniquePaxIds.size || passengerNames.length || 1,
    airline: airlines.join(', '),
    supplier: bk.supplier?.name ?? bk.supplier?.code ?? '',
    issueDate: formatSheetDate(bk.issuedAt ?? bk.createdAt),
    costPrice: Math.round(toNumber(bk.totalNetPrice)),
    sellPrice: Math.round(toNumber(bk.totalSellPrice)),
    profit: Math.round(toNumber(bk.profit)),
    note,
    pending: remainingAmount > 0 ? Math.round(remainingAmount).toString() : '',
    customerCode: bk.customer?.customerCode ?? '',
    syncKey: bk.bookingCode ? `BOOK:${bk.bookingCode}` : bk.id ?? '',
    bookingId: bk.id ?? '',
    bookingCode: bk.bookingCode ?? '',
    contactPhone: bk.contactPhone ?? bk.customer?.phone ?? '',
    customerName: bk.customer?.fullName ?? bk.contactName ?? '',
    customerId: bk.customer?.id ?? '',
    customerType: bk.customer?.type ?? '',
    bookingStatus: bk.status ?? '',
    paymentStatus: bk.paymentStatus ?? '',
    paymentMethod: bk.paymentMethod ?? '',
    bookingSource: bk.source ?? '',
    createdAt: toIsoString(bk.createdAt),
    updatedAt: toIsoString(bk.updatedAt),
    issuedAtIso: toIsoString(bk.issuedAt),
    firstDepartureAt: toIsoString(firstTicket?.departureTime),
    lastArrivalAt: toIsoString(lastTicket?.arrivalTime),
    flightNumbers: flightNumbers.join(', '),
    airlineBookingCodes: airlineBookingCodes.join(', '),
    passengerNames: passengerNames.join(', '),
    staffId: bk.staff?.id ?? '',
    staffName: bk.staff?.fullName ?? '',
    supplierId: bk.supplier?.id ?? '',
    supplierCode: bk.supplier?.code ?? '',
    supplierName: bk.supplier?.name ?? '',
    gdsBookingId: bk.gdsBookingId ?? '',
    internalNotes: bk.internalNotes ?? '',
    totalFees: Math.round(toNumber(bk.totalFees)),
    paidAmount: Math.round(paidAmount),
    latestPaymentAt: toIsoString(payments[0]?.paidAt),
    bookingJson: JSON.stringify(snapshot),
    templateVersion: BOOKING_SHEET_TEMPLATE_VERSION,
  };
}
