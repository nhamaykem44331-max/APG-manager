// APG Manager RMS — Gemini 3 Flash Vision Engine
// Extract ticket data từ ảnh/PDF e-ticket
// Model: gemini-3-flash-preview
// Cost: ~$0.50/1M input tokens (~400 VNĐ/e-ticket image)

import { GoogleGenAI } from '@google/genai';
import { ConfigService } from '@nestjs/config';
import { ParseResult, ParsedTicketData } from '../dto/parsed-ticket.dto';

// JSON schema cho Gemini structured output
const TICKET_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    pnr: { type: 'string', description: 'Mã đặt chỗ / Booking code (5-6 ký tự)' },
    tickets: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          passengerName: { type: 'string', description: 'Tên hành khách đầy đủ (HOA TOAN BOI, viết hoa)' },
          passengerType: { type: 'string', enum: ['ADT', 'CHD', 'INF'], description: 'Loại hành khách' },
          airline: { type: 'string', description: 'Mã hãng bay IATA 2 ký tự: VN, VJ, QH, EK, SQ...' },
          flightNumber: { type: 'string', description: 'Số hiệu chuyến bay: VN219, EK395...' },
          fareClass: { type: 'string', description: 'Hạng đặt chỗ 1 ký tự: Y, Q, O, M, R...' },
          departureCode: { type: 'string', description: 'Mã sân bay đi IATA 3 ký tự: HAN, SGN...' },
          arrivalCode: { type: 'string', description: 'Mã sân bay đến IATA 3 ký tự' },
          departureTime: { type: 'string', description: 'Ngày giờ khởi hành ISO 8601: 2026-03-24T19:00:00+07:00' },
          arrivalTime: { type: 'string', description: 'Ngày giờ đến ISO 8601: 2026-03-24T21:10:00+07:00' },
          seatClass: { type: 'string', enum: ['Economy', 'Business', 'First'], description: 'Hạng ghế' },
          eTicketNumber: { type: 'string', description: 'Số vé điện tử (13 chữ số): 7382319652997' },
          baggageAllowance: { type: 'string', description: 'Hành lý ký gửi: 23kg, 30kg, 1PC...' },
        },
        required: ['passengerName', 'airline', 'flightNumber', 'departureCode', 'arrivalCode', 'departureTime', 'arrivalTime', 'seatClass'],
      },
    },
  },
  required: ['tickets'],
};

const EXTRACTION_PROMPT = `Bạn là chuyên gia phân tích vé máy bay. Hãy trích xuất TOÀN BỘ thông tin vé từ hình ảnh/PDF/Text này.

Quy tắc QUAN TRỌNG:
- Tên hành khách viết HOA TOÀN BỘ, format UNICODE không dấu: VU THI DIEP, NGUYEN VAN A.
- Mã hãng bay IATA 2 ký tự: VN, VJ, QH, EK, 9G...
- Mã sân bay IATA 3 ký tự (HAN, SGN, DAD...) và Ngày giờ phải theo chuẩn ISO 8601 (2026-03-24T19:00:00+07:00).
- GỘP CHẶNG BAY (Quan trọng nhất!): Nếu MỘT hành khách có NHIỀU CHẶNG BAY (Ví dụ: Khứ hồi HAN-PQC, PQC-HAN), BẮT BUỘC phải gộp chung thành MỘT bản ghi (ticket) duy nhất cho hành khách đó. KHÔNG ĐƯỢC tách thành 2 tickets.
  Cụ thể cách gộp cho chặng 1 và chặng 2:
  - Chuyến bay (flightNumber): nối bằng dấu " / " (ví dụ: VN219 / VN220)
  - Sân bay đi (departureCode): nối bằng " / " (ví dụ: HAN / PQC)
  - Sân bay đến (arrivalCode): nối bằng " / " (ví dụ: PQC / HAN)
  - Ngày giờ đi (departureTime): Lấy giờ cất cánh của chặng ĐẦU TIÊN
  - Ngày giờ đến (arrivalTime): Lấy giờ hạ cánh của chặng CUỐI CÙNG
  - Hạng đặt chỗ (fareClass), hạng ghế (seatClass), hành lý: nối bằng " / " nếu khác nhau, nếu giống thì ghi 1 lần.
- Nếu không đọc được trường nào, hãy để chuỗi rỗng.

Trả về mảng JSON theo schema đã định nghĩa.`;

export class GeminiVisionEngine {
  private client: GoogleGenAI;
  private model: string;

  constructor(config: ConfigService) {
    this.client = new GoogleGenAI({
      apiKey: config.get<string>('GEMINI_API_KEY') ?? '',
    });
    this.model = config.get<string>('GEMINI_MODEL') ?? 'gemini-3-flash-preview';
  }

  async parseImage(imageBuffer: Buffer, mimeType: string): Promise<ParseResult> {
    try {
      // Support for text fallback parsing
      const parts = mimeType === 'text/plain'
        ? [{ text: EXTRACTION_PROMPT + '\n\nDữ liệu PNR:\n' + imageBuffer.toString('utf-8') }]
        : [
            { text: EXTRACTION_PROMPT },
            { 
              inlineData: { 
                mimeType, 
                data: imageBuffer.toString('base64') 
              } 
            },
          ];

      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: parts,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: TICKET_EXTRACTION_SCHEMA,
          temperature: 0.1,  // Thấp = chính xác hơn
        },
      });

      const text = response.text ?? '';
      const parsed = JSON.parse(text);

      const tickets: ParsedTicketData[] = (parsed.tickets || []).map((t: Record<string, string>) => ({
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
        eTicketNumber: t.eTicketNumber,
        baggageAllowance: t.baggageAllowance,
        pnr: parsed.pnr,
      }));

      // Đếm unique passengers và segments
      const uniquePax = new Set(tickets.map(t => t.passengerName));
      const uniqueSeg = new Set(tickets.map(t => `${t.flightNumber}-${t.departureCode}-${t.arrivalCode}`));

      return {
        success: tickets.length > 0,
        method: 'GEMINI_VISION',
        pnr: parsed.pnr ?? null,
        passengerCount: uniquePax.size,
        segmentCount: uniqueSeg.size,
        totalTickets: tickets.length,
        tickets,
      };
    } catch (error) {
      console.error('[GeminiVisionEngine] Error:', error);
      return {
        success: false,
        method: 'GEMINI_VISION',
        pnr: null,
        passengerCount: 0,
        segmentCount: 0,
        totalTickets: 0,
        tickets: [],
        error: error instanceof Error ? error.message : 'Gemini extraction failed',
      };
    }
  }
}
