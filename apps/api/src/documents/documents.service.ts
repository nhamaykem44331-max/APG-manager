// APG Manager — Documents Service (PDF generation for Invoice, Quotation, Receipt)
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import {
  createPdfDoc, drawHeader, drawTable, drawSignatures, pdfToBuffer,
  fmtVND, fmtDate, fmtDateTime, numberToVietnamese,
  COMPANY, PAYMENT_LABELS, FUND_LABELS,
} from './pdf.helper';

@Injectable()
export class DocumentsService {
  constructor(private prisma: PrismaService) {}

  // ─── INVOICE (Hóa đơn bán hàng) ──────────────────
  async generateInvoice(bookingId: string): Promise<Buffer> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        staff: { select: { fullName: true } },
        tickets: { include: { passenger: true } },
        payments: true,
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const doc = createPdfDoc();

    // Header
    const docNumber = `HD-${booking.bookingCode}`;
    drawHeader(doc, 'HOA DON BAN HANG', docNumber, booking.createdAt);

    // Customer info
    doc.fontSize(9).font('Helvetica');
    doc.text(`Khach hang: ${booking.customer?.fullName || booking.contactName}`, { continued: false });
    doc.text(`Dien thoai: ${booking.customer?.phone || booking.contactPhone}`);
    if (booking.customer?.email) doc.text(`Email: ${booking.customer.email}`);
    doc.text(`Nhan vien: ${booking.staff?.fullName || 'N/A'}`);
    doc.text(`Nguon: ${booking.source}`);
    doc.moveDown(0.5);

    // Tickets table
    const headers = [
      { label: 'STT', width: 30, align: 'center' as const },
      { label: 'Hanh khach', width: 100 },
      { label: 'Chuyen bay', width: 80 },
      { label: 'Hanh trinh', width: 80 },
      { label: 'Ngay bay', width: 70 },
      { label: 'Gia ban', width: 80, align: 'right' as const },
    ];

    const rows = (booking.tickets || []).map((t, i) => [
      String(i + 1),
      `${t.passenger?.fullName || 'N/A'} (${t.passenger?.type || 'ADT'})`,
      `${t.airline} ${t.flightNumber}`,
      `${t.departureCode} -> ${t.arrivalCode}`,
      fmtDate(t.departureTime),
      fmtVND(Number(t.sellPrice)),
    ]);

    if (rows.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').text('CHI TIET VE MAY BAY', { align: 'left' });
      doc.moveDown(0.3);
      drawTable(doc, headers, rows);
    }

    // Pricing summary
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica');
    const totalSell = Number(booking.totalSellPrice) || 0;

    doc.text(`Tong gia ban:       ${fmtVND(totalSell)}`, { align: 'right' });
    doc.fontSize(8).text(`(${numberToVietnamese(totalSell)})`, { align: 'right' });
    doc.moveDown(0.3);

    // Payment info
    const actualPayments = (booking.payments ?? []).filter((payment) => payment.method !== 'DEBT');

    if (actualPayments.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').text('THANH TOAN', { align: 'left' });
      doc.moveDown(0.3);

      const payHeaders = [
        { label: 'STT', width: 30, align: 'center' as const },
        { label: 'Ngay', width: 90 },
        { label: 'Hinh thuc', width: 120 },
        { label: 'Ma GD', width: 100 },
        { label: 'So tien', width: 100, align: 'right' as const },
      ];
      const payRows = actualPayments.map((p, i) => [
        String(i + 1),
        fmtDateTime(p.paidAt),
        PAYMENT_LABELS[p.method] || p.method,
        p.reference || '',
        fmtVND(Number(p.amount)),
      ]);
      drawTable(doc, payHeaders, payRows);

      const totalPaid = actualPayments.reduce((s, p) => s + Number(p.amount), 0);
      const remaining = totalSell - totalPaid;
      doc.fontSize(9).font('Helvetica');
      doc.text(`Da thanh toan: ${fmtVND(totalPaid)}`, { align: 'right' });
      if (remaining > 0) {
        doc.font('Helvetica-Bold')
          .text(`Con lai: ${fmtVND(remaining)}`, { align: 'right' });
      }
    }

    // Signatures
    drawSignatures(doc, ['Nguoi mua hang', 'Nguoi ban hang', 'Thu truong don vi']);

    return pdfToBuffer(doc);
  }

  // ─── QUOTATION (Báo giá) ──────────────────────────
  async generateQuotation(bookingId: string): Promise<Buffer> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        staff: { select: { fullName: true } },
        tickets: { include: { passenger: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const doc = createPdfDoc();

    // Header
    const docNumber = `BG-${booking.bookingCode}`;
    drawHeader(doc, 'BAO GIA DICH VU VE MAY BAY', docNumber, new Date());

    // Customer info
    doc.fontSize(9).font('Helvetica');
    doc.text(`Kinh gui: ${booking.customer?.fullName || booking.contactName}`);
    doc.text(`Dien thoai: ${booking.customer?.phone || booking.contactPhone}`);
    if (booking.customer?.email) doc.text(`Email: ${booking.customer.email}`);
    doc.moveDown(0.3);
    doc.text(`${COMPANY.shortName} xin gui den Quy khach bao gia dich vu ve may bay nhu sau:`);
    doc.moveDown(0.5);

    // Flight details table
    const headers = [
      { label: 'STT', width: 25, align: 'center' as const },
      { label: 'Hanh khach', width: 90 },
      { label: 'Loai', width: 35, align: 'center' as const },
      { label: 'Chuyen bay', width: 70 },
      { label: 'Hanh trinh', width: 70 },
      { label: 'Ngay bay', width: 65 },
      { label: 'Hang', width: 50 },
      { label: 'Don gia', width: 75, align: 'right' as const },
    ];

    const tickets = booking.tickets || [];
    const rows = tickets.map((t, i) => [
      String(i + 1),
      t.passenger?.fullName || 'N/A',
      t.passenger?.type || 'ADT',
      `${t.airline} ${t.flightNumber}`,
      `${t.departureCode}-${t.arrivalCode}`,
      fmtDate(t.departureTime),
      t.seatClass || 'Economy',
      fmtVND(Number(t.sellPrice)),
    ]);

    if (rows.length > 0) {
      drawTable(doc, headers, rows);
    } else {
      doc.fontSize(9).font('Helvetica')
        .text('(Chua co thong tin ve chi tiet — vui long lien he de duoc tu van)', { align: 'center' });
      doc.moveDown(1);
    }

    // Total
    const totalSell = Number(booking.totalSellPrice) || 0;
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica-Bold')
      .text(`TONG CONG: ${fmtVND(totalSell)}`, { align: 'right' });
    doc.fontSize(8).font('Helvetica')
      .text(`(${numberToVietnamese(totalSell)})`, { align: 'right' });

    // Terms
    doc.moveDown(1);
    doc.fontSize(9).font('Helvetica-Bold').text('DIEU KHOAN:');
    doc.fontSize(8).font('Helvetica');
    doc.text('1. Bao gia co hieu luc trong 24 gio ke tu ngay phat hanh.');
    doc.text('2. Gia ve co the thay doi tuy theo tinh trang cho cua hang bay.');
    doc.text('3. Sau khi xuat ve, ve khong duoc hoan/doi (tuy theo dieu kien ve).');
    doc.text('4. Vui long thanh toan truoc khi xuat ve de dam bao gia ve.');
    doc.moveDown(0.5);

    // Payment info
    doc.fontSize(9).font('Helvetica-Bold').text('THONG TIN THANH TOAN:');
    doc.fontSize(8).font('Helvetica');
    doc.text(`Cong ty: ${COMPANY.name}`);
    doc.text(`TK: 3900543757 — BIDV`);
    doc.text(`Hoac: 996106688 — MB Bank`);

    // Contact
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica')
      .text(`Nhan vien phu trach: ${booking.staff?.fullName || 'N/A'}`);
    doc.text(`Hotline: ${COMPANY.phone}`);

    // Signatures
    drawSignatures(doc, ['Nguoi lap', 'Phe duyet']);

    return pdfToBuffer(doc);
  }

  // ─── RECEIPT / VOUCHER (Phiếu thu / Phiếu chi) ───
  async generateReceipt(id: string, type: 'THU' | 'CHI'): Promise<Buffer> {
    if (type === 'THU') {
      return this.generatePhieuThu(id);
    } else {
      return this.generatePhieuChi(id);
    }
  }

  /** Phiếu thu — from a booking payment */
  private async generatePhieuThu(paymentId: string): Promise<Buffer> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            customer: true,
            staff: { select: { fullName: true } },
          },
        },
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const booking = payment.booking;
    const doc = createPdfDoc();

    // Header
    const docNumber = `PT-${booking.bookingCode}-${paymentId.slice(-4).toUpperCase()}`;
    drawHeader(doc, 'PHIEU THU', docNumber, payment.paidAt || payment.createdAt);

    // Info
    doc.fontSize(9).font('Helvetica');
    doc.text(`Ho ten nguoi nop tien: ${booking.customer?.fullName || booking.contactName}`);
    doc.text(`Dien thoai: ${booking.customer?.phone || booking.contactPhone}`);
    doc.moveDown(0.3);
    doc.text(`Ly do nop: Thanh toan ve may bay — Booking ${booking.bookingCode}`);
    doc.moveDown(0.5);

    // Amount
    const amount = Number(payment.amount);
    doc.fontSize(11).font('Helvetica-Bold')
      .text(`So tien: ${fmtVND(amount)}`, { align: 'center' });
    doc.fontSize(9).font('Helvetica')
      .text(`(Bang chu: ${numberToVietnamese(amount)})`, { align: 'center' });
    doc.moveDown(0.5);

    // Details
    doc.fontSize(9).font('Helvetica');
    doc.text(`Hinh thuc: ${PAYMENT_LABELS[payment.method] || payment.method}`);
    const fundAccount = (payment as unknown as Record<string, unknown>).fundAccount as string;
    if (fundAccount) {
      doc.text(`Nhan vao quy: ${FUND_LABELS[fundAccount] || fundAccount}`);
    }
    if (payment.reference) {
      doc.text(`Ma giao dich: ${payment.reference}`);
    }
    if (payment.notes) {
      doc.text(`Ghi chu: ${payment.notes}`);
    }
    doc.text(`Nhan vien thu: ${booking.staff?.fullName || 'N/A'}`);

    // Signatures
    drawSignatures(doc, ['Nguoi nop tien', 'Nguoi thu tien', 'Thu quy']);

    return pdfToBuffer(doc);
  }

  /** Phiếu chi — from a CashFlowEntry */
  private async generatePhieuChi(entryId: string): Promise<Buffer> {
    const entry = await this.prisma.cashFlowEntry.findUnique({
      where: { id: entryId },
    });
    if (!entry) throw new NotFoundException('CashFlow entry not found');

    const doc = createPdfDoc();

    // Header
    const docNumber = `PC-${entryId.slice(-6).toUpperCase()}`;
    drawHeader(doc, 'PHIEU CHI', docNumber, entry.date || entry.createdAt);

    // Info
    doc.fontSize(9).font('Helvetica');
    doc.text(`Ly do chi: ${entry.description || ''}`);
    doc.text(`Danh muc: ${entry.category || ''}`);
    doc.text(`Nguoi phu trach: ${entry.pic || 'N/A'}`);
    doc.moveDown(0.5);

    // Amount
    const amount = Math.abs(Number(entry.amount));
    doc.fontSize(11).font('Helvetica-Bold')
      .text(`So tien: ${fmtVND(amount)}`, { align: 'center' });
    doc.fontSize(9).font('Helvetica')
      .text(`(Bang chu: ${numberToVietnamese(amount)})`, { align: 'center' });
    doc.moveDown(0.5);

    // Details
    doc.fontSize(9).font('Helvetica');
    if (entry.reference) {
      doc.text(`Ma giao dich: ${entry.reference}`);
    }
    if (entry.notes) {
      doc.text(`Ghi chu: ${entry.notes}`);
    }

    // Signatures
    drawSignatures(doc, ['Nguoi nhan tien', 'Nguoi chi tien', 'Ke toan truong', 'Thu truong don vi']);

    return pdfToBuffer(doc);
  }
}
