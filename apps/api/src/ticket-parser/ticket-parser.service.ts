// APG Manager RMS — Ticket Parser Service
// Router: detect input type → dispatch tới engine phù hợp
import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Removed unused parsePNRText
import { GeminiVisionEngine } from './engines/gemini-vision.engine';
import { ParseResult } from './dto/parsed-ticket.dto';

@Injectable()
export class TicketParserService {
  private gemini: GeminiVisionEngine;

  constructor(config: ConfigService) {
    this.gemini = new GeminiVisionEngine(config);
  }

  // Route 1: Parse PNR text (Chuyển sang dùng hoàn toàn Gemini AI theo yêu cầu)
  async parseText(text: string): Promise<ParseResult> {
    if (!text || text.trim().length < 10) {
      throw new BadRequestException('PNR text quá ngắn');
    }
    
    // Sử dụng Gemini AI cho toàn bộ text input thay vì Regex để nhận diện thông minh hơn
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

  // Fallback: gửi text thô cho Gemini khi regex không parse được
  private async parseWithGeminiText(text: string): Promise<ParseResult> {
    // Tạo buffer text giả dạng để gửi qua Gemini text mode
    // Gemini 3 Flash cũng xử lý text rất tốt
    const textBuffer = Buffer.from(text, 'utf-8');
    return this.gemini.parseImage(textBuffer, 'text/plain');
  }
}
