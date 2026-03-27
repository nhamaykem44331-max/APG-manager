import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { SheetSyncService } from './sheet-sync.service';
import { BOOKING_SHEET_HEADERS, sheetRowToValues } from './sheet-template.util';

@Injectable()
export class ExcelExportService {
  constructor(private syncService: SheetSyncService) {}

  async exportToExcel(options: {
    from?: string;
    to?: string;
    statuses?: string[];
  }): Promise<{ buffer: Buffer; filename: string; rowCount: number }> {
    const bookings = await this.syncService.fetchBookingsForExport({
      from: options.from ? new Date(options.from) : undefined,
      to: options.to ? new Date(options.to) : undefined,
      status: options.statuses ?? ['ISSUED', 'COMPLETED'],
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Thong ke Ve FIT');

    const headerRow = worksheet.addRow(BOOKING_SHEET_HEADERS);
    headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E78' },
    };

    worksheet.columns = BOOKING_SHEET_HEADERS.map((header) => ({
      width: Math.max(14, Math.min(36, header.length + 4)),
    }));

    bookings.forEach((booking, index) => {
      const row = worksheet.addRow(sheetRowToValues(booking));
      if ((index + 1) % 2 === 0) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF7FAFC' },
        };
      }
    });

    worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: BOOKING_SHEET_HEADERS.length },
    };

    const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
    const dateLabel = new Date().toISOString().slice(0, 10);
    const filename = `APG_Booking_Sync_Template_${dateLabel}.xlsx`;

    return { buffer, filename, rowCount: bookings.length };
  }
}
