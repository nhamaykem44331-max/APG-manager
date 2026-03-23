// APG Manager RMS — PNR Regex Parser Engine
// Parse PNR text từ Amadeus GDS, miễn phí, <100ms
// Hỗ trợ: Amadeus international (EK, VN, QH...) và domestic (9G, VJ...)
// Hỗ trợ: multi-pax (1-50 pax), multi-segment, TE e-ticket lines

import { ParseResult, ParsedTicketData } from '../dto/parsed-ticket.dto';

interface RawPassenger {
  index: number;
  fullName: string;
  type: 'ADT' | 'CHD' | 'INF';
  eTicket: string | null;
}

interface RawSegment {
  segNum: number;
  airline: string;
  flightNumber: string;
  fareClass: string;
  departureCode: string;
  arrivalCode: string;
  paxCount: number;
  departureTime: string;
  arrivalTime: string;
  date: string;           // "27MAR"
  departureISO: string | null;
  arrivalISO: string | null;
}

export function parsePNRText(raw: string): ParseResult {
  const text = raw.trim();
  const lines = text.split('\n').map(l => l.trimEnd()).filter(l => l.trim());

  let pnr: string | null = null;
  const passengers: RawPassenger[] = [];
  const segments: RawSegment[] = [];
  const eTickets: Record<number, string> = {};

  // === 1. PNR CODE ===
  const pnrMatch = text.match(/^([A-Z0-9]{5,6})\s*$/m);
  if (pnrMatch) pnr = pnrMatch[1];

  // === 2. PASSENGERS ===
  for (const line of lines) {
    // Format A: multi-pax trên 1 dòng "1.1NGUYEN/VAN DUONG  2.1CHU/THANH BANG"
    const fmtA = [...line.matchAll(/(\d+)\.\d([A-Z][A-Z\/\s]+?)(?=\s{2,}\d+\.\d|\s*$)/g)];
    if (fmtA.length > 0) {
      for (const m of fmtA) {
        const idx = parseInt(m[1]);
        const rawName = m[2].trim().replace(/\s+(MR|MS|MRS|MSTR|INF)\s*$/i, '');
        const parts = rawName.split('/');
        passengers.push({
          index: idx,
          fullName: `${parts[0]} ${parts.slice(1).join(' ')}`.replace(/\s+/g, ' ').trim(),
          type: 'ADT',
          eTicket: null,
        });
      }
      continue;
    }
    // Format B: single-pax "1.NGUYEN/CONG PHONG MR(ADT)"
    const fmtB = line.match(/(\d+)\.([A-Z][A-Z\/\s]+?)(?:\s+(MR|MS|MRS|MSTR))?\s*(?:\((\w+)\))?\s*$/);
    if (fmtB && !line.match(/\d+\s+[A-Z]{2}\s*\d/)) {
      const idx = parseInt(fmtB[1]);
      if (!passengers.find(p => p.index === idx)) {
        const rawName = fmtB[2].trim();
        const parts = rawName.split('/');
        passengers.push({
          index: idx,
          fullName: `${parts[0]} ${parts.slice(1).join(' ')}`.replace(/\s+/g, ' ').trim(),
          type: (fmtB[4] as 'ADT' | 'CHD' | 'INF') || 'ADT',
          eTicket: null,
        });
      }
    }
  }

  // === 3. FLIGHT SEGMENTS ===
  const segPatterns = [
    // "1 EK 395Q 27MAR 5 HANDXB HK1 0025 0455"
    /(\d+)\s+([A-Z0-9]{2})\s+(\d{1,4})([A-Z])\s+(\d{1,2}[A-Z]{3})\s+\d\s+([A-Z]{3})([A-Z]{3})\s+HK(\d+)\s+(\d{4})\s+(\d{4})/g,
    // "2  9G1215 O 24MAR 2 HANPQC HK1 13320 1525"
    /(\d+)\s+([A-Z0-9]{2})(\d{1,4})\s+([A-Z])\s+(\d{1,2}[A-Z]{3})\s+\d\s+([A-Z]{3})([A-Z]{3})\s+HK(\d+)[\s\d]*?(\d{4})\s+(\d{4})/g,
  ];
  for (const regex of segPatterns) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(text)) !== null) {
      const segNum = parseInt(m[1]);
      if (segments.find(s => s.segNum === segNum)) continue;
      const depDate = parseAmadeusDate(m[5]);
      segments.push({
        segNum,
        airline: m[2],
        flightNumber: `${m[2]}${m[3]}`,
        fareClass: m[4],
        departureCode: m[6],
        arrivalCode: m[7],
        paxCount: parseInt(m[8]),
        departureTime: fmtTime(m[9]),
        arrivalTime: fmtTime(m[10]),
        date: m[5],
        departureISO: depDate ? `${depDate}T${fmtTime(m[9])}:00:00+07:00` : null, // Added timezone
        arrivalISO: depDate ? `${depDate}T${fmtTime(m[10])}:00:00+07:00` : null, // Added timezone
      });
    }
  }
  segments.sort((a, b) => a.segNum - b.segNum);

  // === 4. E-TICKETS ===
  // TE lines: "2.TE 1766901714474-VN NGUYE/N..."
  let teMatch: RegExpExecArray | null;
  const teRegex = /(\d+)\.TE\s+(\d{13})/g;
  while ((teMatch = teRegex.exec(text)) !== null) {
    eTickets[parseInt(teMatch[1])] = teMatch[2];
  }
  // Standalone 13-digit (single pax)
  if (Object.keys(eTickets).length === 0) {
    const standalone = text.match(/^(\d{13})\s*$/m);
    if (standalone && passengers[0]) {
      eTickets[passengers[0].index] = standalone[1];
    }
  }
  // Correct TE index offset (TE starts from 2 when pax starts from 1)
  const teKeys = Object.keys(eTickets).map(Number);
  const paxKeys = passengers.map(p => p.index);
  if (teKeys.length > 0 && paxKeys.length > 0) {
    const offset = Math.min(...teKeys) - Math.min(...paxKeys);
    if (offset !== 0) {
      const shifted: Record<number, string> = {};
      for (const [k, v] of Object.entries(eTickets)) shifted[parseInt(k) - offset] = v;
      Object.keys(eTickets).forEach(k => delete eTickets[parseInt(k)]);
      Object.assign(eTickets, shifted);
    }
  }
  // Assign to passengers
  for (const pax of passengers) {
    pax.eTicket = eTickets[pax.index] || null;
  }

  // === 5. GENERATE TICKETS — 1 ticket per passenger, all segments merged ===
  // Quy tắc: 1 PNR = 1 vé/khách. Multi-segment gộp thành 1 vé.
  // VD: EZE→DXB + DXB→HAN = flightNumber "EK248 / EK394", dep "EZE / DXB", arr "DXB / HAN"
  const tickets: ParsedTicketData[] = [];
  
  for (const pax of passengers) {
    if (segments.length === 0) continue;
    
    if (segments.length === 1) {
      // Single segment — đơn giản
      const seg = segments[0];
      tickets.push({
        passengerName: pax.fullName,
        passengerType: pax.type,
        airline: seg.airline,
        flightNumber: seg.flightNumber,
        fareClass: seg.fareClass,
        departureCode: seg.departureCode,
        arrivalCode: seg.arrivalCode,
        departureTime: seg.departureISO ?? '',
        arrivalTime: seg.arrivalISO ?? '',
        seatClass: guessSeatClass(seg.fareClass),
        eTicketNumber: pax.eTicket ?? undefined,
        baggageAllowance: undefined,
        pnr: pnr ?? undefined,
      });
    } else {
      // Multi-segment — gộp tất cả thành 1 vé
      const firstSeg = segments[0];
      const lastSeg = segments[segments.length - 1];
      
      // Lấy unique airlines (VD: EK/EK → chỉ EK, EK/VN → EK/VN)
      const uniqueAirlines = [...new Set(segments.map(s => s.airline))];
      const mergedAirline = uniqueAirlines[0]; // Hãng đầu tiên làm chính
      
      tickets.push({
        passengerName: pax.fullName,
        passengerType: pax.type,
        airline: mergedAirline,
        flightNumber: segments.map(s => s.flightNumber).join(' / '),
        fareClass: segments.map(s => s.fareClass).join(' / '),
        departureCode: segments.map(s => s.departureCode).join(' / '),
        arrivalCode: segments.map(s => s.arrivalCode).join(' / '),
        departureTime: firstSeg.departureISO ?? '',
        arrivalTime: lastSeg.arrivalISO ?? '',
        seatClass: guessSeatClass(firstSeg.fareClass),
        eTicketNumber: pax.eTicket ?? undefined,
        baggageAllowance: undefined,
        pnr: pnr ?? undefined,
      });
    }
  }

  return {
    success: passengers.length > 0 && segments.length > 0,
    method: 'REGEX_PNR',
    pnr,
    passengerCount: passengers.length,
    segmentCount: segments.length,
    totalTickets: tickets.length,
    tickets,
  };
}

// === HELPERS ===
function parseAmadeusDate(d: string): string | null {
  const M: Record<string, string> = { JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12' };
  const m = d.match(/(\d{1,2})([A-Z]{3})/);
  return m && M[m[2]] ? `${new Date().getFullYear()}-${M[m[2]]}-${m[1].padStart(2, '0')}` : null;
}
function fmtTime(t: string): string { return `${t.slice(0,2)}:${t.slice(2,4)}`; }
function guessSeatClass(fc: string): string {
  if ('FAP'.includes(fc)) return 'First';
  if ('CDJZI'.includes(fc)) return 'Business';
  return 'Economy';
}
