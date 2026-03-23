import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { SheetSyncService } from './sheet-sync.service';

@Injectable()
export class ExcelExportService {
  constructor(private syncService: SheetSyncService) {}

  async exportToExcel(options: {
    from?: string;
    to?: string;
    statuses?: string[];
  }): Promise<{ buffer: Buffer; filename: string; rowCount: number }> {
    
    // Fetch bookings with the EXACT SAME logic as Google Sheets Push
    const filter = {
      from: options.from ? new Date(options.from) : undefined,
      to: options.to ? new Date(options.to) : undefined,
      status: options.statuses ?? ['ISSUED', 'COMPLETED'],
    };
    const bookings = await this.syncService.fetchBookingsForExport(filter);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Thống kê Vé FIT');

    // Headers mapped beautifully with APG's standard reporting format 
    const headers = [
      'STT', 'PNR', 'Tên Đại Diện', 'DOB', 'Hành trình',
      'Ngày bay', 'SL Pax', 'Hãng', 'Nhà Cung Cấp',
      'Ngày bán (ngày xuất vé)', 'Giá Vốn', 'REV FIT',
      'Lợi Nhuận FIT', 'Note', 'PENDING', 'Mã KH',
    ];
    
    const headerRow = ws.addRow(headers);
    headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };

    ws.columns = [
      { width: 6 },   { width: 10 },  { width: 25 },  { width: 12 },
      { width: 20 },  { width: 18 },  { width: 8 },   { width: 8 },
      { width: 15 },  { width: 20 },  { width: 15 },  { width: 15 },
      { width: 15 },  { width: 40 },  { width: 12 },  { width: 10 },
    ];

    let rowIdx = 0;
    for (const bk of bookings) {
      rowIdx++;
      const row = ws.addRow([
        bk.stt, bk.pnr, bk.contactName, bk.dob, bk.route,
        bk.flightDate, bk.paxCount, bk.airline, bk.supplier,
        bk.issueDate, bk.costPrice, bk.sellPrice, bk.profit,
        bk.note, bk.pending, bk.customerCode,
      ]);

      [11, 12, 13].forEach(col => { (row.getCell(col) as any).numFmt = '#,##0'; });

      const profitCell = row.getCell(13);
      if (bk.profit > 0) profitCell.font = { color: { argb: 'FF16A34A' } };
      else if (bk.profit < 0) profitCell.font = { color: { argb: 'FFDC2626' } };

      if (rowIdx % 2 === 0) {
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8F9FA' } };
      }
    }

    const summaryRow = ws.addRow([
      '', '', '', '', '', '', '', '', '', 'TỔNG CỘNG',
      bookings.reduce((s, b) => s + b.costPrice, 0),
      bookings.reduce((s, b) => s + b.sellPrice, 0),
      bookings.reduce((s, b) => s + b.profit, 0),
    ]);
    
    summaryRow.font = { bold: true };
    [11, 12, 13].forEach(col => { (summaryRow.getCell(col) as any).numFmt = '#,##0'; });

    const buffer = await wb.xlsx.writeBuffer() as unknown as Buffer;
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `Thong_ke_ve_FIT_APG_${dateStr}.xlsx`;

    return { buffer, filename, rowCount: rowIdx };
  }
}
