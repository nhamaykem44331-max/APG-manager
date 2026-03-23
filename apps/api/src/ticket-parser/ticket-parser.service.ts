// APG Manager RMS — Ticket Parser Service
// Router: detect input type → dispatch tới engine phù hợp
// Strategy: Regex first (fast, zero-cost) → fallback to Gemini AI
import { Injectable, BadRequestException } from '@nestjs/common';
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

  // Route 1: Parse PNR text
  // Strategy: Regex (fast, free, offline) → Gemini AI fallback
  async parseText(text: string): Promise<ParseResult> {
    if (!text || text.trim().length < 10) {
      throw new BadRequestException('PNR text quá ngắn');
    }

    // === Step 1: Try Regex engine first (offline, <100ms) ===
    try {
      const regexResult = parsePNRText(text);
      // Consider regex successful if we found at least 1 passenger AND 1 segment
      if (regexResult.success && regexResult.passengerCount > 0 && regexResult.segmentCount > 0) {
        console.log(
          `[TicketParser] Regex success: ${regexResult.passengerCount} pax, ${regexResult.segmentCount} segs, ${regexResult.totalTickets} tickets`
        );
        return regexResult;
      }
      console.log('[TicketParser] Regex returned incomplete result, falling back to Gemini...');
    } catch (regexErr) {
      console.warn('[TicketParser] Regex engine threw error, falling back to Gemini:', regexErr);
    }

    // === Step 2: Fallback to Gemini AI for complex/unrecognized formats ===
    console.log('[TicketParser] Using Gemini AI for text parsing...');
    return this.parseWithGeminiText(text);
  }

  // Route 2: Parse image/PDF (Gemini Vision)
  async parseFile(fileBuffer: Buffer, mimeType: string): Promise<ParseResult> {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf',
    ];
    if (!allowedTypes.includes(mimeType)) {
      throw new BadRequestException(
        `File type không hỗ trợ: ${mimeType}. Chấp nhận: JPEG, PNG, WebP, GIF, PDF`
      );
    }
    return this.gemini.parseImage(fileBuffer, mimeType);
  }

  // Fallback: send text to Gemini when regex can't parse it
  private async parseWithGeminiText(text: string): Promise<ParseResult> {
    const textBuffer = Buffer.from(text, 'utf-8');
    return this.gemini.parseImage(textBuffer, 'text/plain');
  }
}
