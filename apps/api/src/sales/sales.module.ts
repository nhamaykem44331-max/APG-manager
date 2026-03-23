// APG Manager RMS - Sales Module (Phase D)
import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesLeadService } from './sales-lead.service';

@Module({
  controllers: [SalesController],
  providers: [SalesLeadService],
  exports: [SalesLeadService],
})
export class SalesModule {}
