import { Controller, Get, Post, Body, Query, Res, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
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
}
