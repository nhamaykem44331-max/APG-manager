// APG Manager RMS — Ticket Parser Service
// 100% Gemini AI — no regex fallback
// Model: gemini-3.1-flash-lite-preview
import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeminiVisionEngine } from './engines/gemini-vision.engine';
import { ParseResult } from './dto/parsed-ticket.dto';

@Injectable()
export class TicketParserService {
  private gemini: GeminiVisionEngine;

  constructor(config: ConfigService) {
    this.gemini = new GeminiVisionEngine(config);
  }

  // Route 1: Parse PNR text — 100% Gemini AI
  async parseText(text: string): Promise<ParseResult> {
    if (!text || text.trim().length < 10) {
      throw new BadRequestException('PNR text quá ngắn. Vui lòng paste toàn bộ nội dung PNR.');
    }

    try {
      const textBuffer = Buffer.from(text.trim(), 'utf-8');
      const result = await this.gemini.parseImage(textBuffer, 'text/plain');
      
      if (!result.success && result.error) {
        // Translate known Gemini errors to Vietnamese
        const errMsg = result.error.toLowerCase();
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('rate limit') || errMsg.includes('resource_exhausted')) {
          throw new HttpException(
            'Gemini AI đang bận (rate limit). Vui lòng đợi 30 giây rồi thử lại.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (errMsg.includes('api_key') || errMsg.includes('invalid key') || errMsg.includes('unauthorized')) {
          throw new HttpException(
            'Gemini API key không hợp lệ. Liên hệ Admin.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        if (errMsg.includes('model') && errMsg.includes('not found')) {
          throw new HttpException(
            'Gemini model không tồn tại. Liên hệ Admin kiểm tra cấu hình GEMINI_MODEL.',
            HttpStatus.BAD_GATEWAY,
          );
        }
      }
      
      return result;
    } catch (err) {
      // Re-throw HttpException as-is
      if (err instanceof HttpException) throw err;
      
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('resource_exhausted')) {
        throw new HttpException(
          'Gemini AI đang bận (rate limit). Vui lòng đợi 30 giây rồi thử lại.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      
      throw new HttpException(
        `Gemini AI lỗi: ${msg}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
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
    
    try {
      const result = await this.gemini.parseImage(fileBuffer, mimeType);
      
      if (!result.success && result.error) {
        const errMsg = result.error.toLowerCase();
        if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('resource_exhausted')) {
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
      throw new HttpException(`Gemini Vision lỗi: ${msg}`, HttpStatus.BAD_GATEWAY);
    }
  }
}
