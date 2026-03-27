import {
  BadRequestException, Controller, Get, Post, Body, Query, Res, UseGuards,
  HttpCode, HttpStatus, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { SheetSyncService } from './sheet-sync.service';
import { ExcelExportService } from './excel-export.service';

@Controller('sheet-sync')
@UseGuards(JwtAuthGuard)
export class SheetSyncController {
  constructor(
    private syncService: SheetSyncService,
    private excelService: ExcelExportService,
  ) {}

  @Get('info')
  async getSheetInfo() {
    return this.syncService.getSheetInfo();
  }

  @Post('push')
  @HttpCode(HttpStatus.OK)
  async pushToSheets(@Body() body: {
    mode: 'APPEND' | 'REPLACE_ALL';
    from?: string;
    to?: string;
    statuses?: string[];
  }) {
    return this.syncService.pushToSheets(body);
  }

  @Get('export')
  async exportExcel(
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const result = await this.excelService.exportToExcel({ from, to });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Get('preview')
  async previewFromSheets(
    @Query('startRow') startRow?: string,
    @Query('maxRows') maxRows?: string,
  ) {
    return this.syncService.previewFromSheets({
      startRow: startRow ? parseInt(startRow) : undefined,
      maxRows: maxRows ? parseInt(maxRows) : undefined,
    });
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importFromSheets(@Body() body: { rowIndices: number[] }) {
    return this.syncService.importFromSheets(body.rowIndices);
  }

  @Post('excel/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const isExcel = file.originalname.toLowerCase().endsWith('.xlsx');
      if (isExcel) {
        cb(null, true);
        return;
      }
      cb(new Error('Chi ho tro file .xlsx cho tab import Excel.'), false);
    },
  }))
  async previewExcelFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('startRow') startRow?: string,
    @Query('maxRows') maxRows?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Vui long chon file Excel .xlsx de xem truoc.');
    }

    return this.syncService.previewFromExcel(file.buffer, {
      startRow: startRow ? parseInt(startRow, 10) : undefined,
      maxRows: maxRows ? parseInt(maxRows, 10) : undefined,
    });
  }

  @Post('excel/import')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const isExcel = file.originalname.toLowerCase().endsWith('.xlsx');
      if (isExcel) {
        cb(null, true);
        return;
      }
      cb(new Error('Chi ho tro file .xlsx cho tab import Excel.'), false);
    },
  }))
  async importExcelFile(
    @UploadedFile() file: Express.Multer.File,
    @Body('rowIndices') rowIndicesRaw?: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Vui long chon file Excel .xlsx de import.');
    }

    const rowIndices = this.parseRowIndices(rowIndicesRaw);
    return this.syncService.importFromExcel(file.buffer, rowIndices);
  }

  private parseRowIndices(raw?: string) {
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'number')) {
        throw new Error('invalid');
      }
      return parsed;
    } catch {
      throw new BadRequestException('rowIndices khong hop le.');
    }
  }
}
