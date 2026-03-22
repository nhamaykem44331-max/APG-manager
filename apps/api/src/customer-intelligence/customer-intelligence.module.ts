// APG Manager RMS - Customer Intelligence Module
import { Module } from '@nestjs/common';
import { PrismaModule } from '../common/prisma.module';
import { CustomerIntelligenceService } from './customer-intelligence.service';
import { InteractionsService } from './interactions.service';
import { CustomerIntelligenceController } from './customer-intelligence.controller';

@Module({
  imports: [PrismaModule],
  controllers: [CustomerIntelligenceController],
  providers: [CustomerIntelligenceService, InteractionsService],
  exports: [CustomerIntelligenceService],
})
export class CustomerIntelligenceModule {}
