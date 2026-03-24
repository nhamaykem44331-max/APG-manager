// APG Manager — PDF Helper (shared utilities for all PDF document types)
import PDFDocument from 'pdfkit';

/** Company info for all documents */
export const COMPANY = {
  name: 'CÔNG TY TNHH DV DU LỊCH TÂN PHÚ APG',
  shortName: 'Tân Phú APG',
  address: 'Phước Long, Nha Trang, Khánh Hòa',
  phone: '0258 xxxx xxx',
  email: 'info@tanphuapg.com',
  taxId: 'XXXXXXXXXX',
};

/** Format VND currency */
export function fmtVND(n: number | null | undefined): string {
  if (n == null) return '0 đ';
  return n.toLocaleString('vi-VN') + ' đ';
}

/** Format date DD/MM/YYYY */
export function fmtDate(d: Date | string | null): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  const dd = dt.getDate().toString().padStart(2, '0');
  const mm = (dt.getMonth() + 1).toString().padStart(2, '0');
  const yyyy = dt.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/** Format datetime DD/MM/YYYY HH:mm */
export function fmtDateTime(d: Date | string | null): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  const hh = dt.getHours().toString().padStart(2, '0');
  const mi = dt.getMinutes().toString().padStart(2, '0');
  return `${fmtDate(d)} ${hh}:${mi}`;
}

/** Number to Vietnamese words (simplified for amounts) */
export function numberToVietnamese(n: number): string {
  const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  if (n === 0) return 'Không đồng';
  let result = '';
  const ty = Math.floor(n / 1_000_000_000);
  const trieu = Math.floor((n % 1_000_000_000) / 1_000_000);
  const nghin = Math.floor((n % 1_000_000) / 1_000);
  const don = n % 1_000;
  if (ty > 0) result += readThreeDigits(ty) + ' tỷ ';
  if (trieu > 0) result += readThreeDigits(trieu) + ' triệu ';
  if (nghin > 0) result += readThreeDigits(nghin) + ' nghìn ';
  if (don > 0) result += readThreeDigits(don);
  result = result.trim() + ' đồng';
  return result.charAt(0).toUpperCase() + result.slice(1);

  function readThreeDigits(num: number): string {
    const h = Math.floor(num / 100);
    const t = Math.floor((num % 100) / 10);
    const u = num % 10;
    let s = '';
    if (h > 0) s += units[h] + ' trăm ';
    else if (num < 100 && result.length > 0) s += 'không trăm ';
    if (t > 1) s += units[t] + ' mươi ';
    else if (t === 1) s += 'mười ';
    else if (t === 0 && h > 0 && u > 0) s += 'lẻ ';
    if (u === 1 && t > 1) s += 'mốt';
    else if (u === 5 && t > 0) s += 'lăm';
    else if (u > 0) s += units[u];
    return s.trim();
  }
}

/** Payment method labels */
export const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Tiền mặt',
  BANK_TRANSFER: 'Chuyển khoản ngân hàng',
  CREDIT_CARD: 'Thẻ ngân hàng',
  MOMO: 'Ví MoMo',
  VNPAY: 'VNPay',
  DEBT: 'Công nợ',
};

export const FUND_LABELS: Record<string, string> = {
  CASH_OFFICE: 'Quỹ tiền mặt văn phòng',
  BANK_HTX: 'TK BIDV HTX (3900543757)',
  BANK_PERSONAL: 'TK MB cá nhân (996106688)',
};

/** Create a new PDF doc with A4 settings and standard margins */
export function createPdfDoc(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'A4',
    margins: { top: 40, bottom: 40, left: 50, right: 50 },
    info: {
      Title: 'APG Manager Document',
      Author: COMPANY.shortName,
      Creator: 'APG Manager RMS',
    },
  });
}

/** Draw company header at top of document */
export function drawHeader(
  doc: PDFKit.PDFDocument,
  docTitle: string,
  docNumber: string,
  date: Date | string,
) {
  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

  // Company info (left)
  doc.fontSize(9).font('Helvetica-Bold').text(COMPANY.name, { continued: false });
  doc.fontSize(7.5).font('Helvetica')
    .text(COMPANY.address)
    .text(`ĐT: ${COMPANY.phone} | Email: ${COMPANY.email}`)
    .text(`MST: ${COMPANY.taxId}`);

  doc.moveDown(1);

  // Horizontal line
  const y = doc.y;
  doc.moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.margins.left + pageW, y)
    .lineWidth(1).stroke('#333333');
  doc.moveDown(0.5);

  // Title centered
  doc.fontSize(16).font('Helvetica-Bold')
    .text(docTitle, { align: 'center' });
  doc.fontSize(9).font('Helvetica')
    .text(`So: ${docNumber}`, { align: 'center' })
    .text(`Ngay: ${fmtDate(date)}`, { align: 'center' });
  doc.moveDown(1);
}

/** Draw a simple table */
export function drawTable(
  doc: PDFKit.PDFDocument,
  headers: { label: string; width: number; align?: 'left' | 'center' | 'right' }[],
  rows: string[][],
) {
  const startX = doc.page.margins.left;
  const rowH = 20;
  let y = doc.y;

  // Check if we need a new page
  const neededH = (rows.length + 1) * rowH + 10;
  if (y + neededH > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
    y = doc.y;
  }

  // Header row
  doc.fontSize(8).font('Helvetica-Bold');
  let x = startX;
  for (const h of headers) {
    doc.rect(x, y, h.width, rowH).fill('#f0f0f0').stroke('#cccccc');
    doc.fillColor('#333333').text(h.label, x + 4, y + 5, {
      width: h.width - 8, align: h.align || 'left',
    });
    x += h.width;
  }
  y += rowH;

  // Data rows
  doc.font('Helvetica').fontSize(8);
  for (const row of rows) {
    x = startX;
    for (let i = 0; i < headers.length; i++) {
      doc.rect(x, y, headers[i].width, rowH).stroke('#cccccc');
      doc.fillColor('#333333').text(row[i] || '', x + 4, y + 5, {
        width: headers[i].width - 8, align: headers[i].align || 'left',
      });
      x += headers[i].width;
    }
    y += rowH;
  }

  doc.y = y + 10;
}

/** Draw signature block at bottom */
export function drawSignatures(
  doc: PDFKit.PDFDocument,
  labels: string[],
) {
  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = pageW / labels.length;
  const startX = doc.page.margins.left;

  // Ensure enough space
  if (doc.y + 80 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }

  doc.moveDown(2);
  const y = doc.y;

  doc.fontSize(8).font('Helvetica-Bold');
  labels.forEach((label, i) => {
    doc.text(label, startX + i * colW, y, { width: colW, align: 'center' });
    doc.fontSize(7).font('Helvetica')
      .text('(Ky, ghi ro ho ten)', startX + i * colW, y + 12, { width: colW, align: 'center' });
  });
}

/** Convert PDFDocument to Buffer */
export function pdfToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}
