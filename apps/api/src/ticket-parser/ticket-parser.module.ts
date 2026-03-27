import { Module } from '@nestjs/common';
import { AutomationModule } from '../automation/automation.module';
import { TicketParserController } from './ticket-parser.controller';
import { TicketParserService } from './ticket-parser.service';

@Module({
  imports: [AutomationModule],
  controllers: [TicketParserController],
  providers: [TicketParserService],
  exports: [TicketParserService],
})
export class TicketParserModule {}
