// APG Manager RMS — Ticket Parser Controller
// POST /api/v1/tickets/parse/text  — parse PNR text
// POST /api/v1/tickets/parse/file  — parse image/PDF via Gemini
import {
  Controller, Post, Body, UseGuards, UseInterceptors,
  UploadedFile, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Timeout } from '@nestjs/common';
import { TicketParserService } from './ticket-parser.service';

@Controller('tickets/parse')
@UseGuards(JwtAuthGuard)
export class TicketParserController {

  constructor(private parser: TicketParserService) {}

  // POST /tickets/parse/text — Nhập PNR text
  @Post('text')
  @HttpCode(HttpStatus.OK)
  async parseText(@Body() body: { text: string }) {
    return this.parser.parseText(body.text);
  }

  // POST /tickets/parse/file — Upload ảnh/PDF
  @Post('file')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (allowed.includes(file.mimetype)) cb(null, true);
      else cb(new Error('File type không hỗ trợ. Chấp nhận: JPEG, PNG, WebP, PDF'), false);
    },
  }))
  async parseFile(@UploadedFile() file: Express.Multer.File) {
    return this.parser.parseFile(file.buffer, file.mimetype);
  }
}
