// APG Manager RMS - Automation Module (n8n integration)
import { Module } from '@nestjs/common';
import { N8nService } from './n8n.service';

@Module({
  providers: [N8nService],
  exports: [N8nService],
})
export class AutomationModule {}
