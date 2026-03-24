// APG Manager RMS - Airline Utils
// Logo URL từ Kiwi CDN (1,224 hãng bay)

export function getAirlineLogo(iataCode: string, size: 32 | 64 = 64): string {
  return `https://images.kiwi.com/airlines/${size}/${iataCode.toUpperCase()}.png`;
}

// Airline name map — phổ biến nhất (mở rộng khi cần)
const AIRLINE_MAP: Record<string, string> = {
  // Vietnam
  VN: 'Vietnam Airlines',
  VJ: 'Vietjet Air',
  QH: 'Bamboo Airways',
  BL: 'Pacific Airlines',
  VU: 'Vietravel Airlines',
  '0V': 'VASCO',
  // International popular
  EK: 'Emirates',
  SQ: 'Singapore Airlines',
  CX: 'Cathay Pacific',
  TG: 'Thai Airways',
  MH: 'Malaysia Airlines',
  GA: 'Garuda Indonesia',
  QR: 'Qatar Airways',
  TK: 'Turkish Airlines',
  KE: 'Korean Air',
  OZ: 'Asiana Airlines',
  JL: 'Japan Airlines',
  NH: 'ANA',
  CZ: 'China Southern',
  CA: 'Air China',
  MU: 'China Eastern',
  HX: 'Hong Kong Airlines',
  UO: 'HK Express',
  TR: 'Scoot',
  AK: 'AirAsia',
  FD: 'Thai AirAsia',
  QZ: 'Indonesia AirAsia',
  '3K': 'Jetstar Asia',
  SL: 'Thai Lion Air',
  PG: 'Bangkok Airways',
  AI: 'Air India',
  LH: 'Lufthansa',
  BA: 'British Airways',
  AF: 'Air France',
  KL: 'KLM',
  AA: 'American Airlines',
  UA: 'United Airlines',
  DL: 'Delta Air Lines',
  QF: 'Qantas',
  NZ: 'Air New Zealand',
  ET: 'Ethiopian Airlines',
  SA: 'South African Airways',
  EY: 'Etihad Airways',
  WY: 'Oman Air',
  GF: 'Gulf Air',
  SV: 'Saudia',
  OD: 'Batik Air Malaysia',
  BI: 'Royal Brunei',
  MI: 'SilkAir',
  '5J': 'Cebu Pacific',
  PR: 'Philippine Airlines',
  MM: 'Peach Aviation',
  TW: 'T\'way Air',
  LJ: 'Jin Air',
  '7C': 'Jeju Air',
  ZE: 'Eastar Jet',
  IT: 'Tigerair Taiwan',
  BR: 'EVA Air',
  CI: 'China Airlines',
};

export function getAirlineName(code: string): string {
  return AIRLINE_MAP[code.toUpperCase()] ?? code;
}

export interface AirlineInfo {
  code: string;
  name: string;
  logo: string;
}

export function getAirlineInfo(code: string): AirlineInfo {
  const upper = code.toUpperCase();
  return {
    code: upper,
    name: AIRLINE_MAP[upper] ?? upper,
    logo: getAirlineLogo(upper),
  };
}
