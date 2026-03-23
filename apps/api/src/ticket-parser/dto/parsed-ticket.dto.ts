// Output chung mà cả 2 engine đều trả về
export interface ParsedTicketData {
  passengerName: string;
  passengerType: 'ADT' | 'CHD' | 'INF';
  airline: string;         // IATA 2-letter: VN, VJ, QH, EK...
  flightNumber: string;    // VN219, EK395...
  fareClass: string;       // Y, Q, O, M...
  departureCode: string;   // IATA 3-letter: HAN, SGN...
  arrivalCode: string;
  departureTime: string;   // ISO: 2026-03-24T19:00:00
  arrivalTime: string;
  seatClass: string;       // Economy, Business, First
  eTicketNumber?: string;  // 13 digits: 7382319652997
  baggageAllowance?: string; // 23kg, 30kg...
  pnr?: string;            // FXGAJZ, MEGQZY...
}

export interface ParseResult {
  success: boolean;
  method: 'REGEX_PNR' | 'GEMINI_VISION';
  pnr: string | null;
  passengerCount: number;
  segmentCount: number;
  totalTickets: number;     // pax × segments
  tickets: ParsedTicketData[];
  raw?: string;             // input gốc (debug)
  error?: string;
}
