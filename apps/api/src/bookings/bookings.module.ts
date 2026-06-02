// APG Manager RMS - Bookings Module
import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { NamedCreditService } from './named-credit.service';
import { AutomationModule } from '../automation/automation.module';
import { CustomersModule } from '../customers/customers.module';
import { FinancialLedgerService } from '../finance/financial-ledger.service';

@Module({
  imports: [AutomationModule, CustomersModule],
  controllers: [BookingsController],
  providers: [BookingsService, NamedCreditService, FinancialLedgerService],
  exports: [BookingsService, NamedCreditService],
})
export class BookingsModule {}
