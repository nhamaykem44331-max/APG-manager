// APG Manager RMS — Ticket Parser Service
// Strategy: Regex first (<100ms, free) → Gemini 2.0 Flash fallback (~3-6s)
import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parsePNRText } from './engines/pnr-regex.engine';
import { GeminiVisionEngine } from './engines/gemini-vision.engine';
import { ParseResult } from './dto/parsed-ticket.dto';

@Injectable()
export class TicketParserService {
  private gemini: GeminiVisionEngine;

  constructor(config: ConfigService) {
    this.gemini = new GeminiVisionEngine(config);
  }

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
          `${regexResult.segmentCount} segs, ${regexResult.totalTickets} tickets (<100ms)`
        );
        return regexResult;
      }
      console.log('[TicketParser] Regex incomplete → fallback to Gemini 2.0 Flash...');
    } catch (regexErr) {
      console.warn('[TicketParser] Regex error → fallback to Gemini:', regexErr);
    }

    // ── Step 2: Gemini 2.0 Flash fallback (for complex/non-Amadeus formats) ──
    return this.parseWithGemini(text);
  }

  async parseFile(fileBuffer: Buffer, mimeType: string): Promise<ParseResult> {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException(
        `File type không hỗ trợ: ${mimeType}. Chấp nhận: JPEG, PNG, WebP, GIF, PDF`
      );
    }
    return this.parseWithGemini(undefined, fileBuffer, mimeType);
  }

  private async parseWithGemini(text?: string, fileBuffer?: Buffer, mimeType?: string): Promise<ParseResult> {
    try {
      const buffer = text ? Buffer.from(text.trim(), 'utf-8') : fileBuffer!;
      const type = text ? 'text/plain' : mimeType!;
      const result = await this.gemini.parseImage(buffer, type);

      // Translate Gemini errors to Vietnamese
      if (!result.success && result.error) {
        const err = result.error.toLowerCase();
        if (err.includes('429') || err.includes('quota') || err.includes('resource_exhausted')) {
          throw new HttpException(
            'Gemini AI đang bận (rate limit). Vui lòng đợi 30 giây rồi thử lại.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
      }
      return result;
    } catch (err) {
      if (err instanceof HttpException) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.toLowerCase().includes('resource_exhausted')) {
        throw new HttpException(
          'Gemini AI đang bận (rate limit). Vui lòng đợi 30 giây rồi thử lại.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new HttpException(`Gemini lỗi: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }
}
