import { Module } from '@nestjs/common';
import { TicketParserController } from './ticket-parser.controller';
import { TicketParserService } from './ticket-parser.service';

@Module({
  controllers: [TicketParserController],
  providers: [TicketParserService],
  exports: [TicketParserService],
})
export class TicketParserModule {}
