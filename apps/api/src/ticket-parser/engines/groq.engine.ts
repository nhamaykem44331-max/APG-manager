import Groq from 'groq-sdk';
import { ConfigService } from '@nestjs/config';
import { ParseResult, ParsedTicketData } from '../dto/parsed-ticket.dto';
import { parsePNRText } from './pnr-regex.engine';

function stripDiacritics(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .toUpperCase()
    .trim();
}

const SYSTEM_PROMPT = `Ban la chuyen gia phan tich ve may bay GDS (Amadeus, Sabre).
Nhiem vu: trich xuat toan bo thong tin ve tu du lieu PNR/anh e-ticket va tra ve JSON hop le.

QUY TAC QUAN TRONG:
1. passengerName phai chep dung tu nguon, viet hoa, khong tu y doi ky tu.
2. passengerType chi nhan ADT, CHD, INF.
3. flightNumber dung dinh dang nhu VN6150 hoac EK248 / EK394.
4. departureCode va arrivalCode la ma IATA 3 ky tu.
5. departureTime va arrivalTime phai la ISO 8601.
6. pnr la ma 5-6 ky tu in hoa.
7. eTicketNumber neu co phai la chuoi 13 chu so.
8. Neu mot hanh khach co nhieu chang, gop thanh 1 ticket.

Chi tra ve JSON:
{
  "pnr": "ABC123",
  "tickets": [
    {
      "passengerName": "NGUYEN VAN A",
      "passengerType": "ADT",
      "airline": "VN",
      "flightNumber": "VN6150",
      "fareClass": "L",
      "departureCode": "SGN",
      "arrivalCode": "CXR",
      "departureTime": "2026-04-01T19:10:00+07:00",
      "arrivalTime": "2026-04-01T20:20:00+07:00",
      "seatClass": "Economy",
      "eTicketNumber": "7382319890424",
      "baggageAllowance": "23KG"
    }
  ]
}`;

function normalizePassengerName(value: string): string {
  return stripDiacritics(
    value
      .replace(/\b(MR|MRS|MS|MISS|MSTR|ADT|CHD|INF)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function extractPassengerNamesFromRawText(rawInput: string): string[] {
  if (!rawInput.trim()) {
    return [];
  }

  const structuredNames = rawInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^[-=]{3,}$/.test(line))
    .filter((line) => !/^(code|pnr|hanh trinh|ngay di|thoi gian bay|so hieu cb|hang hang khong|thoi gian giu cho)\s*:/i.test(line))
    .map((line) => line.match(/^(?:MR|MRS|MS|MSTR|ADT|CHD|INF)\s+(.+)$/i)?.[1] ?? '')
    .map((line) => normalizePassengerName(line))
    .filter(Boolean);

  if (structuredNames.length > 0) {
    return structuredNames;
  }

  const regexResult = parsePNRText(rawInput);
  return regexResult.tickets.map((ticket) => normalizePassengerName(ticket.passengerName));
}

export class GroqEngine {
  private client: Groq;
  private textModel = 'llama-3.1-8b-instant';
  private visionModel = 'llama-3.2-11b-vision-preview';

  constructor(config: ConfigService) {
    this.client = new Groq({
      apiKey: config.get<string>('GROQ_API_KEY') ?? '',
    });
  }

  async parseText(text: string): Promise<ParseResult> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.textModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Phan tich PNR sau:\n\n${text.trim()}` },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      return this.buildResult(raw, text);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[GroqEngine] parseText error:', message);
      return {
        success: false,
        method: 'GROQ_AI',
        pnr: null,
        passengerCount: 0,
        segmentCount: 0,
        totalTickets: 0,
        tickets: [],
        error: message,
      };
    }
  }

  async parseImage(imageBuffer: Buffer, mimeType: string): Promise<ParseResult> {
    try {
      const base64 = imageBuffer.toString('base64');
      const completion = await this.client.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: `${SYSTEM_PROMPT}\n\nPhan tich anh/tai lieu e-ticket sau:` },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      return this.buildResult(jsonMatch ? jsonMatch[0] : raw, '');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[GroqEngine] parseImage error:', message);
      return {
        success: false,
        method: 'GROQ_AI',
        pnr: null,
        passengerCount: 0,
        segmentCount: 0,
        totalTickets: 0,
        tickets: [],
        error: message,
      };
    }
  }

  private buildResult(jsonStr: string, rawInput: string): ParseResult {
    try {
      const parsed = JSON.parse(jsonStr);
      let tickets: ParsedTicketData[] = (parsed.tickets ?? []).map((ticket: any) => ({
        passengerName: normalizePassengerName(ticket.passengerName ?? ''),
        passengerType: ticket.passengerType ?? 'ADT',
        airline: ticket.airline ?? '',
        flightNumber: ticket.flightNumber ?? '',
        fareClass: ticket.fareClass ?? '',
        departureCode: ticket.departureCode ?? '',
        arrivalCode: ticket.arrivalCode ?? '',
        departureTime: ticket.departureTime ?? '',
        arrivalTime: ticket.arrivalTime ?? '',
        seatClass: ticket.seatClass ?? 'Economy',
        eTicketNumber: ticket.eTicketNumber || undefined,
        baggageAllowance: ticket.baggageAllowance || undefined,
      }));

      const regexResult = rawInput.trim() ? parsePNRText(rawInput) : null;
      const regexTickets = regexResult?.tickets ?? [];
      const rawPassengerNames = extractPassengerNamesFromRawText(rawInput);

      if (rawPassengerNames.length === tickets.length) {
        tickets = tickets.map((ticket, index) => ({
          ...ticket,
          passengerName: rawPassengerNames[index],
        }));
      }

      if (regexTickets.length >= tickets.length && regexTickets.length > 0) {
        const byName = new Map(
          tickets.map((ticket) => [normalizePassengerName(ticket.passengerName), ticket] as const),
        );
        const baseTicket = tickets[0] ?? regexTickets[0];
        tickets = regexTickets.map((regexTicket) => {
          const existing = byName.get(normalizePassengerName(regexTicket.passengerName));
          const source = existing ?? baseTicket;
          return {
            ...source,
            passengerName: normalizePassengerName(regexTicket.passengerName),
            passengerType: regexTicket.passengerType,
            eTicketNumber: regexTicket.eTicketNumber ?? existing?.eTicketNumber,
          };
        });
      }

      const pnr = parsed.pnr || regexResult?.pnr || null;
      const uniquePassengers = new Set(tickets.map((ticket) => ticket.passengerName)).size;
      const uniqueSegments = new Set(tickets.map((ticket) => ticket.flightNumber)).size;

      return {
        success: tickets.length > 0,
        method: 'GROQ_AI',
        pnr,
        passengerCount: uniquePassengers,
        segmentCount: uniqueSegments,
        totalTickets: tickets.length,
        tickets,
        raw: rawInput.substring(0, 200),
        error: tickets.length === 0 ? 'Groq khong trich xuat duoc thong tin ve' : undefined,
      };
    } catch (parseErr) {
      return {
        success: false,
        method: 'GROQ_AI',
        pnr: null,
        passengerCount: 0,
        segmentCount: 0,
        totalTickets: 0,
        tickets: [],
        error: `JSON parse error: ${parseErr}`,
      };
    }
  }
}
