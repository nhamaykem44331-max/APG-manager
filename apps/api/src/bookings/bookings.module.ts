// APG Manager RMS - Bookings Module
import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { AutomationModule } from '../automation/automation.module';
import { CustomersModule } from '../customers/customers.module';

@Module({
  imports: [AutomationModule, CustomersModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
