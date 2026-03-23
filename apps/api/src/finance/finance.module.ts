// APG Manager RMS - Finance Module (Phase A + Phase B)
import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { LedgerService } from './ledger.service';
import { SupplierService } from './supplier.service';
import { CashFlowService } from './cashflow.service';
import { ExpenseService } from './expense.service';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [AutomationModule],
  controllers: [FinanceController],
  providers: [FinanceService, LedgerService, SupplierService, CashFlowService, ExpenseService],
  exports: [FinanceService, LedgerService, SupplierService, CashFlowService, ExpenseService],
})
export class FinanceModule {}
