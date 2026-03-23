// APG Manager RMS - Module gốc ứng dụng
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { CustomersModule } from './customers/customers.module';
import { FinanceModule } from './finance/finance.module';
import { CustomerIntelligenceModule } from './customer-intelligence/customer-intelligence.module';
import { ReportsModule } from './reports/reports.module';
import { AutomationModule } from './automation/automation.module';
import { PrismaModule } from './common/prisma.module';
import { SalesModule } from './sales/sales.module';
import { TicketParserModule } from './ticket-parser/ticket-parser.module';
import { SheetSyncModule } from './sheet-sync/sheet-sync.module';
import { FlightsModule } from './flights/flights.module';

@Module({
  imports: [
    // Cấu hình môi trường
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Rate limiting - chống spam API
    ThrottlerModule.forRoot([{
      ttl: 60000,    // 1 phút
      limit: 100,    // 100 request/phút
    }]),

    // Modules nghiệp vụ
    PrismaModule,
    AuthModule,
    BookingsModule,
    CustomersModule,
    FinanceModule,
    CustomerIntelligenceModule,
    ReportsModule,
    AutomationModule,
    SalesModule,
    TicketParserModule,
    SheetSyncModule,
    FlightsModule, // FIX 10: Đăng ký Flights Module (airports data + search endpoint)
  ],
})
export class AppModule {}
