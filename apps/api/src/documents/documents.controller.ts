// APG Manager — Documents Controller (PDF download endpoints)
import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  /** GET /documents/invoice/:bookingId — Download hóa đơn bán hàng PDF */
  @Get('invoice/:bookingId')
  async downloadInvoice(
    @Param('bookingId') bookingId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.documentsService.generateInvoice(bookingId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="hoa-don-${bookingId.slice(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /documents/quotation/:bookingId — Download báo giá PDF */
  @Get('quotation/:bookingId')
  async downloadQuotation(
    @Param('bookingId') bookingId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.documentsService.generateQuotation(bookingId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="bao-gia-${bookingId.slice(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  /** GET /documents/receipt/:id?type=THU|CHI — Download phiếu thu/chi PDF */
  @Get('receipt/:id')
  async downloadReceipt(
    @Param('id') id: string,
    @Query('type') type: 'THU' | 'CHI' = 'THU',
    @Res() res: Response,
  ) {
    const docType = type === 'CHI' ? 'CHI' : 'THU';
    const buffer = await this.documentsService.generateReceipt(id, docType);
    const prefix = docType === 'THU' ? 'phieu-thu' : 'phieu-chi';
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${prefix}-${id.slice(0, 8)}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }
}
