import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TicketParserService } from './ticket-parser.service';

@Controller('tickets/parse')
@UseGuards(JwtAuthGuard)
export class TicketParserController {
  constructor(private parser: TicketParserService) {}

  @Post('text')
  @HttpCode(HttpStatus.OK)
  async parseText(@Body() body: { text: string }) {
    return this.parser.parseText(body.text);
  }

  @Post('file')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
          return;
        }

        cb(new Error('File type khong ho tro. Chap nhan: JPEG, PNG, WebP, PDF'), false);
      },
    }),
  )
  async parseFile(@UploadedFile() file: Express.Multer.File) {
    return this.parser.parseFile(file.buffer, file.mimetype, file.originalname);
  }
}
