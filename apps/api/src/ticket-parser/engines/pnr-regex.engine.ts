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
  date: string;
  departureISO: string | null;
  arrivalISO: string | null;
}

const STRUCTURED_AIRLINE_MAP: Record<string, string> = {
  'VIETNAM AIRLINES': 'VN',
  'VIETJET AIR': 'VJ',
  'BAMBOO AIRWAYS': 'QH',
  'PACIFIC AIRLINES': 'BL',
  'JETSTAR PACIFIC': 'BL',
  'VIETRAVEL AIRLINES': 'VU',
  'EMIRATES': 'EK',
  'SINGAPORE AIRLINES': 'SQ',
  'THAI AIRWAYS': 'TG',
  'KOREAN AIR': 'KE',
  'ASIANA AIRLINES': 'OZ',
  'JAPAN AIRLINES': 'JL',
  'ANA': 'NH',
  'ALL NIPPON AIRWAYS': 'NH',
  'CATHAY PACIFIC': 'CX',
};

const STRUCTURED_AIRPORT_MAP: Array<[RegExp, string]> = [
  [/^(HAN|HA NOI|HANOI|NOI BAI)$/, 'HAN'],
  [/^(SGN|HO CHI MINH|TP HCM|TPHCM|SAI GON|TAN SON NHAT)$/, 'SGN'],
  [/^(DAD|DA NANG)$/, 'DAD'],
  [/^(PQC|PHU QUOC)$/, 'PQC'],
  [/^(CXR|CAM RANH|NHA TRANG)$/, 'CXR'],
  [/^(TOKYO|TYO|NARITA|NRT)$/, 'NRT'],
  [/^(HANEDA|HND)$/, 'HND'],
  [/^(OSAKA|KIX)$/, 'KIX'],
  [/^(SEOUL|ICN|INCHEON)$/, 'ICN'],
  [/^(BUSAN|PUS)$/, 'PUS'],
  [/^(BANGKOK|BKK|SUVARNABHUMI)$/, 'BKK'],
  [/^(SINGAPORE|SIN|CHANGI)$/, 'SIN'],
  [/^(HONG KONG|HKG)$/, 'HKG'],
  [/^(TAIPEI|TPE)$/, 'TPE'],
  [/^(KAOHSIUNG|KHH)$/, 'KHH'],
  [/^(DUBAI|DXB)$/, 'DXB'],
  [/^(ABU DHABI|AUH)$/, 'AUH'],
  [/^(DOHA|DOH)$/, 'DOH'],
  [/^(ISTANBUL|IST)$/, 'IST'],
  [/^(PARIS|CDG)$/, 'CDG'],
  [/^(FRANKFURT|FRA)$/, 'FRA'],
  [/^(AMSTERDAM|AMS)$/, 'AMS'],
  [/^(LONDON|LHR|HEATHROW)$/, 'LHR'],
  [/^(SYDNEY|SYD)$/, 'SYD'],
  [/^(MELBOURNE|MEL)$/, 'MEL'],
  [/^(SAN FRANCISCO|SFO)$/, 'SFO'],
  [/^(LOS ANGELES|LAX)$/, 'LAX'],
  [/^(NEW YORK|JFK)$/, 'JFK'],
  [/^(VANCOUVER|YVR)$/, 'YVR'],
  [/^(TORONTO|YYZ)$/, 'YYZ'],
];

export function parsePNRText(raw: string): ParseResult {
  const structuredResult = parseStructuredReservationTextV2(raw);
  if (structuredResult) {
    return structuredResult;
  }

  const text = raw.trim();
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim());

  let pnr: string | null = null;
  const passengers = extractPassengers(lines);
  const segments: RawSegment[] = [];
  const eTickets: Record<number, string> = {};

  const pnrMatch = text.match(/^([A-Z0-9]{5,6})\s*$/m);
  if (pnrMatch) {
    pnr = pnrMatch[1];
  }

  const segPatterns = [
    /(\d+)\s+([A-Z0-9]{2})\s+(\d{1,4})([A-Z])\s+(\d{1,2}[A-Z]{3})\s+\d\s+([A-Z]{3})([A-Z]{3})\s+HK(\d+)\s+(\d{4})\s+(\d{4})(?:\s+(\d{1,2}[A-Z]{3}))?/g,
    /(\d+)\s+([A-Z0-9]{2})(\d{1,4})\s+([A-Z])\s+(\d{1,2}[A-Z]{3})\s+\d\s+([A-Z]{3})([A-Z]{3})\s+HK(\d+)[\s\d]*?(\d{4})\s+(\d{4})(?:\s+(\d{1,2}[A-Z]{3}))?/g,
  ];

  for (const regex of segPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const segNum = parseInt(match[1], 10);
      if (segments.find((segment) => segment.segNum === segNum)) {
        continue;
      }

      const departureDate = parseAmadeusDate(match[5]);
      const arrivalDate = match[11] ? parseAmadeusDate(match[11]) : departureDate;

      segments.push({
        segNum,
        airline: match[2],
        flightNumber: `${match[2]}${match[3]}`,
        fareClass: match[4],
        departureCode: match[6],
        arrivalCode: match[7],
        paxCount: parseInt(match[8], 10),
        departureTime: fmtTime(match[9]),
        arrivalTime: fmtTime(match[10]),
        date: match[5],
        departureISO: departureDate ? `${departureDate}T${fmtTime(match[9])}:00+07:00` : null,
        arrivalISO: arrivalDate ? `${arrivalDate}T${fmtTime(match[10])}:00+07:00` : null,
      });
    }
  }
  segments.sort((a, b) => a.segNum - b.segNum);

  let teMatch: RegExpExecArray | null;
  const teRegex = /(\d+)\.TE\s+(\d{13})/g;
  while ((teMatch = teRegex.exec(text)) !== null) {
    eTickets[parseInt(teMatch[1], 10)] = teMatch[2];
  }

  let faMatch: RegExpExecArray | null;
  const faTicketRegex = /FA\s+PAX\s+(\d{3})-\s*[\r\n\s]*(\d{10})\/[^\r\n]*[\r\n]+\s*[^\r\n]*\/P(\d+)/gi;
  while ((faMatch = faTicketRegex.exec(text)) !== null) {
    eTickets[parseInt(faMatch[3], 10)] = `${faMatch[1]}${faMatch[2]}`;
  }

  if (Object.keys(eTickets).length === 0) {
    const standalone = text.match(/^(\d{13})\s*$/m);
    if (standalone && passengers[0]) {
      eTickets[passengers[0].index] = standalone[1];
    }
  }

  const teKeys = Object.keys(eTickets).map(Number);
  const paxKeys = passengers.map((passenger) => passenger.index);
  if (teKeys.length > 0 && paxKeys.length > 0) {
    const offset = Math.min(...teKeys) - Math.min(...paxKeys);
    if (offset !== 0) {
      const shifted: Record<number, string> = {};
      for (const [key, value] of Object.entries(eTickets)) {
        shifted[parseInt(key, 10) - offset] = value;
      }
      for (const key of Object.keys(eTickets)) {
        delete eTickets[parseInt(key, 10)];
      }
      Object.assign(eTickets, shifted);
    }
  }

  for (const passenger of passengers) {
    passenger.eTicket = eTickets[passenger.index] || null;
  }

  const expectedPassengerCount = estimateExpectedPassengerCount(text, passengers, segments, eTickets);
  const tickets: ParsedTicketData[] = [];

  for (const passenger of passengers) {
    if (segments.length === 0) {
      continue;
    }

    if (segments.length === 1) {
      const segment = segments[0];
      tickets.push({
        passengerName: passenger.fullName,
        passengerType: passenger.type,
        airline: segment.airline,
        flightNumber: segment.flightNumber,
        fareClass: segment.fareClass,
        departureCode: segment.departureCode,
        arrivalCode: segment.arrivalCode,
        departureTime: segment.departureISO ?? '',
        arrivalTime: segment.arrivalISO ?? '',
        seatClass: guessSeatClass(segment.fareClass),
        eTicketNumber: passenger.eTicket ?? undefined,
        baggageAllowance: undefined,
        pnr: pnr ?? undefined,
      });
      continue;
    }

    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const mergedAirline = [...new Set(segments.map((segment) => segment.airline))][0];

    tickets.push({
      passengerName: passenger.fullName,
      passengerType: passenger.type,
      airline: mergedAirline,
      flightNumber: segments.map((segment) => segment.flightNumber).join(' / '),
      fareClass: segments.map((segment) => segment.fareClass).join(' / '),
      departureCode: segments.map((segment) => segment.departureCode).join(' / '),
      arrivalCode: segments.map((segment) => segment.arrivalCode).join(' / '),
      departureTime: firstSegment.departureISO ?? '',
      arrivalTime: lastSegment.arrivalISO ?? '',
      seatClass: guessSeatClass(firstSegment.fareClass),
      eTicketNumber: passenger.eTicket ?? undefined,
      baggageAllowance: undefined,
      pnr: pnr ?? undefined,
    });
  }

  return {
    success: passengers.length > 0 && segments.length > 0 && passengers.length >= expectedPassengerCount,
    method: 'REGEX_PNR',
    pnr,
    passengerCount: passengers.length,
    segmentCount: segments.length,
    totalTickets: tickets.length,
    tickets,
    error: expectedPassengerCount > passengers.length
      ? `Regex parser chi nhan ${passengers.length}/${expectedPassengerCount} khach`
      : undefined,
  };
}

function parseStructuredReservationTextV2(raw: string): ParseResult | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const looksStructured = lines.some((line) => line.includes(':'))
    && lines.some((line) => /^(?:MR|MRS|MS|MSTR|CHD|INF|ADT)\s+/i.test(line));

  if (!looksStructured) {
    return null;
  }

  let pnr: string | null = null;
  let routeText = '';
  let departureDate = '';
  let timeRange = '';
  let flightNumber = '';
  let airlineText = '';
  let seatClass = 'Economy';
  let baggageAllowance: string | undefined;
  const passengers: RawPassenger[] = [];

  for (const line of lines) {
    if (/^[-=]{3,}$/.test(line)) {
      continue;
    }

    const separatorIndex = line.indexOf(':');
    const key = separatorIndex >= 0 ? stripStructuredText(line.slice(0, separatorIndex)) : '';
    const value = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() : '';
    const normalizedValue = stripStructuredText(value);

    if (!pnr && /^[A-Z0-9]{5,6}$/i.test(value)) {
      pnr = value.toUpperCase();
      continue;
    }

    if (!departureDate && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      departureDate = value;
      continue;
    }

    if (!timeRange) {
      const [departureClock = '', arrivalClock = ''] = value.split(/\s*(?:-|\u2013|\u2014)\s*/);
      if (/^\d{2}:\d{2}$/.test(departureClock) && /^\d{2}:\d{2}$/.test(arrivalClock)) {
        timeRange = `${departureClock}|${arrivalClock}`;
        continue;
      }
    }

    if (!flightNumber && /^[A-Z0-9]{2,3}\s*\d{1,4}$/i.test(value)) {
      flightNumber = value.replace(/\s+/g, '').toUpperCase();
      continue;
    }

    if (!routeText && separatorIndex >= 0 && /(?:-|\u2013|\u2014|>)/.test(value) && /\p{L}/u.test(value)) {
      routeText = value;
      continue;
    }

    if (!airlineText && separatorIndex >= 0 && /^[\p{L}\s.&-]+$/u.test(value) && normalizedValue.length >= 6) {
      airlineText = value;
      continue;
    }

    if ((key.includes('HANG GHE') || key.includes('SEAT CLASS')) && value) {
      seatClass = value;
      continue;
    }

    if ((key.includes('HANH LY') || key.includes('BAGGAGE')) && value) {
      baggageAllowance = value;
      continue;
    }

    const passengerMatch = line.match(/^(?:(MR|MRS|MS|MSTR|CHD|INF|ADT)\s+)?([\p{L}][\p{L}\s'-]+)$/iu);
    if (passengerMatch && !line.includes(':')) {
      const normalizedName = stripStructuredText(passengerMatch[2]);
      if (normalizedName.split(' ').length >= 2) {
        passengers.push({
          index: passengers.length + 1,
          fullName: normalizedName,
          type: titleToPassengerType(passengerMatch[1]),
          eTicket: null,
        });
      }
    }
  }

  if (!passengers.length || !flightNumber || !departureDate || !timeRange) {
    return null;
  }

  const routeParts = routeText.split(/\s*(?:-|\u2013|\u2014|>)\s*/);
  const departureCode = resolveStructuredAirportCode(routeParts[0] ?? '');
  const arrivalCode = resolveStructuredAirportCode(routeParts[1] ?? '');
  const { departureTime, arrivalTime } = buildStructuredTimes(departureDate, timeRange);
  const airline = resolveStructuredAirlineCode(airlineText, flightNumber);

  const tickets: ParsedTicketData[] = passengers.map((passenger) => ({
    passengerName: passenger.fullName,
    passengerType: passenger.type,
    airline,
    flightNumber,
    fareClass: '',
    departureCode,
    arrivalCode,
    departureTime,
    arrivalTime,
    seatClass,
    eTicketNumber: undefined,
    baggageAllowance,
    pnr: pnr ?? undefined,
  }));

  return {
    success: true,
    method: 'REGEX_PNR',
    pnr,
    passengerCount: passengers.length,
    segmentCount: 1,
    totalTickets: tickets.length,
    tickets,
  };
}

function stripStructuredText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function titleToPassengerType(title?: string): 'ADT' | 'CHD' | 'INF' {
  const normalizedTitle = (title ?? '').toUpperCase();
  if (normalizedTitle === 'INF') {
    return 'INF';
  }
  if (normalizedTitle === 'CHD') {
    return 'CHD';
  }
  return 'ADT';
}

function resolveStructuredAirlineCode(airlineText: string, flightNumber: string): string {
  const byFlight = flightNumber.match(/^([A-Z0-9]{2})/)?.[1];
  if (byFlight) {
    return byFlight;
  }

  const normalized = stripStructuredText(airlineText);
  return STRUCTURED_AIRLINE_MAP[normalized] ?? normalized.match(/\b([A-Z0-9]{2})\b/)?.[1] ?? '';
}

function resolveStructuredAirportCode(value: string): string {
  const normalized = stripStructuredText(value)
    .replace(/\s+/g, ' ')
    .trim();
  const collapsed = normalized.replace(/[^A-Z]/g, '');

  if (/^[A-Z]{3}$/.test(normalized)) {
    return normalized;
  }

  if (collapsed === 'HNI') {
    return 'HAN';
  }

  for (const [pattern, code] of STRUCTURED_AIRPORT_MAP) {
    if (pattern.test(normalized)) {
      return code;
    }
  }

  return normalized.split(' ')[0] || '';
}

function buildStructuredTimes(dateString: string, timeRange: string): { departureTime: string; arrivalTime: string } {
  const [day, month, year] = dateString.split('/');
  const [departureClock, arrivalClock] = timeRange.split('|');
  const departureTime = `${year}-${month}-${day}T${departureClock}:00+07:00`;

  const departureDate = new Date(`${year}-${month}-${day}T${departureClock}:00+07:00`);
  const arrivalDate = new Date(`${year}-${month}-${day}T${arrivalClock}:00+07:00`);
  if (arrivalDate.getTime() < departureDate.getTime()) {
    arrivalDate.setDate(arrivalDate.getDate() + 1);
  }

  const arrivalTime = `${arrivalDate.getFullYear()}-${String(arrivalDate.getMonth() + 1).padStart(2, '0')}-${String(arrivalDate.getDate()).padStart(2, '0')}T${arrivalClock}:00+07:00`;

  return { departureTime, arrivalTime };
}

function extractPassengers(lines: string[]): RawPassenger[] {
  const passengersByIndex = new Map<number, RawPassenger>();
  let lastIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = normalizeParserLine(lines[i]).toUpperCase();
    if (!line || isSegmentLine(line)) {
      continue;
    }

    const multiMatches = [...line.matchAll(/(\d+)\.\d([A-Z][A-Z/\s]+?)(?=\s{2,}\d+\.\d|\s*$)/g)];
    if (multiMatches.length > 0) {
      for (const match of multiMatches) {
        const index = parseInt(match[1], 10);
        if (passengersByIndex.has(index)) {
          continue;
        }
        const passenger = buildPassenger(
          index,
          match[2].replace(/\s+(MR|MS|MRS|MSTR|INF)\s*$/i, ''),
          'ADT',
        );
        if (passenger) {
          passengersByIndex.set(index, passenger);
          lastIndex = passenger.index;
        }
      }
      continue;
    }

    const indexedMatch = line.match(/^(\d+)\.\s*(.+)$/);
    if (indexedMatch && /[A-Z][A-Z' -]*\/[A-Z]/.test(indexedMatch[2])) {
      let entry = line;
      while (i + 1 < lines.length) {
        const nextLine = normalizeParserLine(lines[i + 1]).toUpperCase();
        if (!nextLine || isSegmentLine(nextLine) || /^\d+\.\s*/.test(nextLine)) {
          break;
        }
        if (isPassengerContinuationLine(nextLine)) {
          entry += ` ${nextLine}`;
          i += 1;
          continue;
        }
        break;
      }

      const passenger = parsePassengerEntry(entry, parseInt(indexedMatch[1], 10));
      if (passenger && !passengersByIndex.has(passenger.index)) {
        passengersByIndex.set(passenger.index, passenger);
        lastIndex = passenger.index;
      }
      continue;
    }

    if (looksLikeLoosePassengerLine(line)) {
      const syntheticIndex = nextPassengerIndex(passengersByIndex, lastIndex + 1);
      const passenger = parsePassengerEntry(`${syntheticIndex}.${line}`, syntheticIndex);
      if (passenger && !passengersByIndex.has(passenger.index)) {
        passengersByIndex.set(passenger.index, passenger);
        lastIndex = passenger.index;
      }
    }
  }

  return [...passengersByIndex.values()].sort((a, b) => a.index - b.index);
}

function parsePassengerEntry(line: string, fallbackIndex: number): RawPassenger | null {
  const match = line.match(/^(\d+)\.\s*(.+)$/);
  const index = match ? parseInt(match[1], 10) : fallbackIndex;
  const rawBody = (match?.[2] ?? line).trim().toUpperCase();
  const passengerType = inferPassengerType(rawBody);
  const cleanedName = rawBody
    .replace(/\b(MR|MRS|MS|MISS|MSTR|ADT|CHD|INF)\b(?=\s|\(|$)/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return buildPassenger(index, cleanedName, passengerType);
}

function buildPassenger(index: number, rawName: string, type: 'ADT' | 'CHD' | 'INF'): RawPassenger | null {
  const parts = rawName
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length < 2) {
    return null;
  }

  const fullName = `${parts[0]} ${parts.slice(1).join(' ')}`.replace(/\s+/g, ' ').trim();
  if (fullName.split(' ').length < 2) {
    return null;
  }

  return {
    index,
    fullName,
    type,
    eTicket: null,
  };
}

function inferPassengerType(rawLine: string): 'ADT' | 'CHD' | 'INF' {
  if (/\bINF\b|\(INF\b/i.test(rawLine)) {
    return 'INF';
  }
  if (/\bCHD\b|\(CHD\b|\bMSTR\b/i.test(rawLine)) {
    return 'CHD';
  }
  return 'ADT';
}

function normalizeParserLine(line: string): string {
  return line.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function isPassengerContinuationLine(line: string): boolean {
  return /^(MR|MRS|MS|MISS|MSTR|INF)(?:\b|\()/i.test(line);
}

function looksLikeLoosePassengerLine(line: string): boolean {
  return /^[A-Z][A-Z' -]*\/[A-Z][A-Z/\s'-]+(?:\s+(?:MR|MRS|MS|MISS|MSTR|INF))?(?:\([^)]*\))?\s*$/i.test(line);
}

function isSegmentLine(line: string): boolean {
  return /^(\d+)\s+[A-Z0-9]{2}\s+\d{1,4}[A-Z]?\s+\d{1,2}[A-Z]{3}\b/i.test(line)
    || /^(\d+)\s+[A-Z0-9]{2}\d{1,4}\s+[A-Z]\s+\d{1,2}[A-Z]{3}\b/i.test(line);
}

function nextPassengerIndex(passengers: Map<number, RawPassenger>, startAt: number): number {
  let index = Math.max(1, startAt);
  while (passengers.has(index)) {
    index += 1;
  }
  return index;
}

function estimateExpectedPassengerCount(
  rawText: string,
  passengers: RawPassenger[],
  segments: RawSegment[],
  eTickets: Record<number, string>,
): number {
  const maxPassengerIndex = passengers.reduce((max, passenger) => Math.max(max, passenger.index), 0);
  const maxTicketIndex = Object.keys(eTickets).reduce((max, key) => Math.max(max, parseInt(key, 10)), 0);
  const maxSegmentPax = segments.reduce((max, segment) => Math.max(max, segment.paxCount), 0);
  const fareSummaryPax = extractFareSummaryPassengerCount(rawText);

  return Math.max(
    passengers.length,
    maxPassengerIndex,
    maxTicketIndex,
    maxSegmentPax,
    fareSummaryPax,
  );
}

function extractFareSummaryPassengerCount(rawText: string): number {
  const normalized = rawText
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toUpperCase();

  let total = 0;
  const regex = /\*\s*(\d+)\s*(NG(?:\s*LON)?|NGUOI\s*LON|ADT|CHD|TRE\s*EM|TREEM|INF)\b/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(normalized)) !== null) {
    total += parseInt(match[1], 10);
  }
  return total;
}

function parseAmadeusDate(value: string): string | null {
  const months: Record<string, string> = {
    JAN: '01',
    FEB: '02',
    MAR: '03',
    APR: '04',
    MAY: '05',
    JUN: '06',
    JUL: '07',
    AUG: '08',
    SEP: '09',
    OCT: '10',
    NOV: '11',
    DEC: '12',
  };
  const match = value.match(/(\d{1,2})([A-Z]{3})/);
  if (!match || !months[match[2]]) {
    return null;
  }

  const year = new Date().getFullYear();
  const candidate = `${year}-${months[match[2]]}-${match[1].padStart(2, '0')}`;
  const candidateDate = new Date(candidate);
  const now = new Date();

  if (candidateDate < new Date(now.getTime() - 90 * 86400000)) {
    return `${year + 1}-${months[match[2]]}-${match[1].padStart(2, '0')}`;
  }

  return candidate;
}

function fmtTime(value: string): string {
  return `${value.slice(0, 2)}:${value.slice(2, 4)}`;
}

function guessSeatClass(fareClass: string): string {
  const first = fareClass.split(' / ')[0].trim();
  if ('FAP'.includes(first)) {
    return 'First';
  }
  if ('CDJZI'.includes(first)) {
    return 'Business';
  }
  return 'Economy';
}
