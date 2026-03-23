import { Module } from '@nestjs/common';
import { SheetSyncController } from './sheet-sync.controller';
import { SheetSyncService } from './sheet-sync.service';
import { ExcelExportService } from './excel-export.service';
import { GoogleSheetsClient } from './google-sheets.client';

@Module({
  controllers: [SheetSyncController],
  providers: [SheetSyncService, ExcelExportService, GoogleSheetsClient],
  exports: [SheetSyncService],
})
export class SheetSyncModule {}
