// APG Manager RMS — Ticket Parser Service
// Strategy: Regex first (<100ms, free) → Groq AI fallback (~200ms, 14,400 req/ngày)
// Groq thay thế hoàn toàn Gemini Vision
import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parsePNRText } from './engines/pnr-regex.engine';
import { GroqEngine } from './engines/groq.engine';
import { ParseResult } from './dto/parsed-ticket.dto';

@Injectable()
export class TicketParserService {
  private groq: GroqEngine;

  constructor(config: ConfigService) {
    this.groq = new GroqEngine(config);
  }

  // Route 1: Parse PNR text
  // Regex first (<100ms) → Groq fallback (~200ms)
  async parseText(text: string): Promise<ParseResult> {
    if (!text || text.trim().length < 10) {
      throw new BadRequestException('PNR text quá ngắn. Vui lòng paste toàn bộ nội dung PNR.');
    }

    // ── Step 1: Regex engine (offline, <100ms, free) ──────────────────────────
    try {
      const regexResult = parsePNRText(text);
      if (regexResult.success && regexResult.passengerCount > 0 && regexResult.segmentCount > 0) {
        console.log(
          `[TicketParser] ✅ Regex: ${regexResult.passengerCount} pax, ` +
          `${regexResult.segmentCount} segs — <100ms`
        );
        return regexResult;
      }
      console.log('[TicketParser] Regex chưa đủ dữ liệu → fallback Groq AI...');
    } catch (regexErr) {
      console.warn('[TicketParser] Regex error:', regexErr);
    }

    // ── Step 2: Groq AI fallback (~200ms) ─────────────────────────────────────
    try {
      const result = await this.groq.parseText(text);
      console.log(`[TicketParser] ✅ Groq: ${result.passengerCount} pax, PNR=${result.pnr}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
        throw new HttpException(
          'Groq AI đang bận (rate limit). Thử lại sau vài giây.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HttpException(`Groq AI lỗi: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }

  // Route 2: Parse image/PDF via Groq Vision
  async parseFile(fileBuffer: Buffer, mimeType: string): Promise<ParseResult> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException(
        `File type không hỗ trợ: ${mimeType}. Chấp nhận: JPEG, PNG, WebP, GIF, PDF`
      );
    }
    
    try {
      const result = await this.groq.parseImage(fileBuffer, mimeType);
      console.log(`[TicketParser] ✅ Groq Vision: ${result.passengerCount} pax, PNR=${result.pnr}`);
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpException(`Groq Vision lỗi: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }
}
