// APG Manager RMS - Finance Module (Phase A + Phase B)
import { Module } from '@nestjs/common';
import { FinanceController } from './finance.controller';
import { FinanceService } from './finance.service';
import { LedgerService } from './ledger.service';
import { SupplierService } from './supplier.service';
import { CashFlowService } from './cashflow.service';
import { ExpenseService } from './expense.service';
import { InvoiceService } from './invoice.service';
import { InvoiceImportService } from './invoice-import.service';
import { InvoiceExportService } from './invoice-export.service';
import { FinancialLedgerService } from './financial-ledger.service';
import { AutomationModule } from '../automation/automation.module';

@Module({
  imports: [AutomationModule],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    LedgerService,
    SupplierService,
    CashFlowService,
    ExpenseService,
    InvoiceService,
    InvoiceImportService,
    InvoiceExportService,
    FinancialLedgerService,
  ],
  exports: [
    FinanceService,
    LedgerService,
    SupplierService,
    CashFlowService,
    ExpenseService,
    InvoiceService,
    InvoiceImportService,
    InvoiceExportService,
    FinancialLedgerService,
  ],
})
export class FinanceModule {}
