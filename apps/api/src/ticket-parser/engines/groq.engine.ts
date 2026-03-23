// APG Manager RMS — Groq AI Engine
// Thay thế hoàn toàn Gemini Vision
// Text PNR  → llama-3.1-8b-instant   (~200ms, 14,400 req/ngày miễn phí)
// Image/PDF → llama-3.2-11b-vision-preview (vision model)
import Groq from 'groq-sdk';
import { ConfigService } from '@nestjs/config';
import { ParseResult, ParsedTicketData } from '../dto/parsed-ticket.dto';

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích vé máy bay GDS (Amadeus, Sabre). 
Nhiệm vụ: Trích xuất TOÀN BỘ thông tin vé từ dữ liệu PNR/ảnh e-ticket và trả về JSON.

QUY TẮC QUAN TRỌNG:
1. Tên hành khách: VIẾT HOA TOÀN BỘ, không dấu kiểu NGUYEN VAN A, VU THI DIEP.
2. Gộp chặng bay: Nếu 1 hành khách có nhiều chặng (multi-segment), GỘP thành 1 ticket:
   - flightNumber: "EK248 / EK394" (nối bằng " / ")
   - departureCode: "EZE / DXB" (nối bằng " / ")  
   - arrivalCode: "DXB / HAN" (nối bằng " / ")
   - departureTime: giờ cất cánh chặng ĐẦU TIÊN
   - arrivalTime: giờ hạ cánh chặng CUỐI CÙNG
3. Mã sân bay: IATA 3 ký tự (HAN, SGN, DXB, EZE...)
4. Mã hãng bay: IATA 2 ký tự (VN, EK, QH, VJ...)
5. Ngày giờ: ISO 8601 format (2026-03-29T22:40:00+07:00)
6. PNR: 5-6 ký tự in hoa từ dòng đầu tiên của PNR text
7. Số vé (eTicketNumber): chuỗi 13 chữ số (ví dụ: 1766901714496)
8. passengerType: ADT (người lớn), CHD (trẻ em), INF (em bé)

CÁC FORMAT PNR AMADEUS THƯỜNG GẶP:
- Tên: "1.1NGUYEN/VAN A" → NGUYEN VAN A (ADT)
- Chặng: "1 EK 248Q 29MAR 7 EZEDXB HK9 2240 0030 31MAR" → EK248, EZE→DXB, Q class
- E-ticket: "1.TE 1766901714496-VN" hoặc chỉ "1766901714496"
- Hành lý: "2PC" = 2 pieces, "23K" = 23kg

LUÔN TRẢ VỀ JSON HỢP LỆ, không có text nào khác ngoài JSON:
{
  "pnr": "HURMDW",
  "tickets": [
    {
      "passengerName": "NGUYEN VAN A",
      "passengerType": "ADT",
      "airline": "EK",
      "flightNumber": "EK248 / EK394",
      "fareClass": "Q",
      "departureCode": "EZE / DXB",
      "arrivalCode": "DXB / HAN",
      "departureTime": "2026-03-29T22:40:00+07:00",
      "arrivalTime": "2026-03-31T13:15:00+07:00",
      "seatClass": "Economy",
      "eTicketNumber": "1766901714487",
      "baggageAllowance": "2PC"
    }
  ]
}`;

export class GroqEngine {
  private client: Groq;
  private textModel = 'llama-3.1-8b-instant';
  private visionModel = 'llama-3.2-11b-vision-preview';

  constructor(config: ConfigService) {
    this.client = new Groq({
      apiKey: config.get<string>('GROQ_API_KEY') ?? '',
    });
  }

  // Parse PNR text (ultra-fast ~200ms)
  async parseText(text: string): Promise<ParseResult> {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.textModel,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Phân tích PNR sau:\n\n${text.trim()}` },
        ],
        temperature: 0.1,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      return this.buildResult(raw, text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[GroqEngine] parseText error:', msg);
      return { success: false, method: 'GEMINI_VISION', pnr: null, passengerCount: 0, segmentCount: 0, totalTickets: 0, tickets: [], error: msg };
    }
  }

  // Parse image/PDF via Groq Vision
  async parseImage(imageBuffer: Buffer, mimeType: string): Promise<ParseResult> {
    try {
      const base64 = imageBuffer.toString('base64');
      const completion = await this.client.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: SYSTEM_PROMPT + '\n\nPhân tích ảnh/tài liệu e-ticket sau:' },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
            ],
          },
        ],
        temperature: 0.1,
        max_tokens: 4096,
      });

      const raw = completion.choices[0]?.message?.content ?? '{}';
      // Extract JSON from response (vision model may add extra text)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      return this.buildResult(jsonMatch ? jsonMatch[0] : raw, '');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[GroqEngine] parseImage error:', msg);
      return { success: false, method: 'GEMINI_VISION', pnr: null, passengerCount: 0, segmentCount: 0, totalTickets: 0, tickets: [], error: msg };
    }
  }

  private buildResult(jsonStr: string, rawInput: string): ParseResult {
    try {
      const parsed = JSON.parse(jsonStr);
      const tickets: ParsedTicketData[] = (parsed.tickets ?? []).map((t: any) => ({
        passengerName: t.passengerName ?? '',
        passengerType: t.passengerType ?? 'ADT',
        airline: t.airline ?? '',
        flightNumber: t.flightNumber ?? '',
        fareClass: t.fareClass ?? '',
        departureCode: t.departureCode ?? '',
        arrivalCode: t.arrivalCode ?? '',
        departureTime: t.departureTime ?? '',
        arrivalTime: t.arrivalTime ?? '',
        seatClass: t.seatClass ?? 'Economy',
        eTicketNumber: t.eTicketNumber || undefined,
        baggageAllowance: t.baggageAllowance || undefined,
      }));

      const pnr = parsed.pnr || null;
      const uniquePassengers = new Set(tickets.map(t => t.passengerName)).size;
      const uniqueSegments = new Set(tickets.map(t => t.flightNumber)).size;

      return {
        success: tickets.length > 0,
        method: 'GEMINI_VISION', // Keep for frontend compatibility
        pnr,
        passengerCount: uniquePassengers,
        segmentCount: uniqueSegments,
        totalTickets: tickets.length,
        tickets,
        raw: rawInput.substring(0, 200),
        error: tickets.length === 0 ? 'Groq không trích xuất được thông tin vé' : undefined,
      };
    } catch (parseErr) {
      return {
        success: false,
        method: 'GEMINI_VISION',
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
