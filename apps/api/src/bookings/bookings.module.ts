// APG Manager RMS - Bookings Module
import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { NamedCreditService } from './named-credit.service';
import { AutomationModule } from '../automation/automation.module';
import { CustomersModule } from '../customers/customers.module';
import { FinanceModule } from '../finance/finance.module';

@Module({
  imports: [AutomationModule, CustomersModule, FinanceModule],
  controllers: [BookingsController],
  providers: [BookingsService, NamedCreditService],
  exports: [BookingsService, NamedCreditService],
})
export class BookingsModule {}
