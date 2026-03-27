// APG Manager RMS - Finance Controller (Phase A: Ledger/Supplier + Phase B: CashFlow/Expense)
import {
  Body, Controller, Delete, Get, Param, Patch, Post, Query, Request, Res, StreamableFile,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FinanceService } from './finance.service';
import { LedgerService } from './ledger.service';
import { SupplierService } from './supplier.service';
import { CashFlowService } from './cashflow.service';
import { ExpenseService } from './expense.service';
import { InvoiceService } from './invoice.service';
import { InvoiceImportService } from './invoice-import.service';
import { InvoiceExportService } from './invoice-export.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  CreateLedgerDto, PayLedgerDto, ListLedgerDto,
  CreateCashFlowDto, ListCashFlowDto,
  CreateExpenseDto, ListExpenseDto,
  CreateSupplierDto, UpdateSupplierDto,
  ListFundLedgerDto, CreateFundEntryDto, UpdateFundEntryDto,
  AdjustFundBalanceDto, TransferFundDto,
  CreateInvoiceDto, CreateInvoiceFromBookingsDto,
  CreateDebtStatementExportDto,
  CreateInvoiceAttachmentDto,
  CreateOutgoingRequestExportDto,
  ListInvoiceCoverageDto,
  ListInvoiceDebtStatementDto,
  ListInvoiceExportBatchesDto,
  ListInvoiceImportBatchesDto,
  ListInvoicesDto,
  ReviewInvoiceImportDto,
  UpdateInvoiceDto,
} from './dto';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(
    private service: FinanceService,
    private ledger: LedgerService,
    private supplier: SupplierService,
    private cashflow: CashFlowService,
    private expense: ExpenseService,
    private invoice: InvoiceService,
    private invoiceImport: InvoiceImportService,
    private invoiceExport: InvoiceExportService,
  ) {}

  // ─── Finance cũ (giữ nguyên) ───────────────────────────────────────
  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboard();
  }

  // ─── Invoice (Phase 1) ──────────────────────────────────────────────
  @Get('invoices/summary')
  getInvoiceSummary() {
    return this.invoice.getSummary();
  }

  @Get('invoices/coverage')
  getInvoiceCoverage(@Query() query: ListInvoiceCoverageDto) {
    return this.invoice.getCoverageQueue(query);
  }

  @Get('invoices')
  getInvoices(@Query() query: ListInvoicesDto) {
    return this.invoice.findAll(query);
  }

  @Get('invoices/debt-statement')
  getInvoiceDebtStatement(@Query() query: ListInvoiceDebtStatementDto) {
    return this.invoice.getDebtStatement(query);
  }

  @Get('invoices/import-batches')
  getInvoiceImportBatches(@Query() query: ListInvoiceImportBatchesDto) {
    return this.invoiceImport.list(query);
  }

  @Get('invoices/import-batches/:id')
  getInvoiceImportBatchOne(@Param('id') id: string) {
    return this.invoiceImport.findOne(id);
  }

  @Post('invoices/import-batches/upload')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 12 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (allowed.includes(file.mimetype)) {
        cb(null, true);
        return;
      }

      cb(new Error('Chi chap nhan JPEG, PNG, WebP hoac PDF cho OCR hoa don.'), false);
    },
  }))
  uploadInvoiceImportBatch(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { supplierId?: string; notes?: string; externalUrl?: string },
    @Request() req: { user: { id: string } },
  ) {
    return this.invoiceImport.upload(file, body, req.user.id);
  }

  @Patch('invoices/import-batches/:id/review')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  reviewInvoiceImportBatch(
    @Param('id') id: string,
    @Body() dto: ReviewInvoiceImportDto,
  ) {
    return this.invoiceImport.review(id, dto);
  }

  @Post('invoices/import-batches/:id/commit')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  commitInvoiceImportBatch(
    @Param('id') id: string,
    @Request() req: { user: { id: string } },
  ) {
    return this.invoiceImport.commit(id, req.user.id);
  }

  @Get('invoices/export-batches')
  getInvoiceExportBatches(@Query() query: ListInvoiceExportBatchesDto) {
    return this.invoiceExport.list(query);
  }

  @Post('invoices/export-batches/debt-statement')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createDebtStatementExport(
    @Body() dto: CreateDebtStatementExportDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.invoiceExport.exportDebtStatement(dto, req.user.id);
  }

  @Post('invoices/export-batches/outgoing-request')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createOutgoingRequestExport(
    @Body() dto: CreateOutgoingRequestExportDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.invoiceExport.exportOutgoingRequest(dto, req.user.id);
  }

  @Get('invoices/export-batches/:id/download')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.MANAGER)
  async downloadInvoiceExportBatch(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { batch, absolutePath } = await this.invoiceExport.getDownloadMeta(id);
    res.setHeader('Content-Type', batch.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${batch.fileName}"`);
    return new StreamableFile((await import('fs')).createReadStream(absolutePath));
  }

  @Get('invoices/:id')
  getInvoiceOne(@Param('id') id: string) {
    return this.invoice.findOne(id);
  }

  @Post('invoices')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createInvoice(@Body() dto: CreateInvoiceDto, @Request() req: { user: { id: string } }) {
    return this.invoice.create(dto, req.user.id);
  }

  @Post('invoices/outgoing-from-bookings')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createOutgoingInvoiceFromBookings(
    @Body() dto: CreateInvoiceFromBookingsDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.invoice.createOutgoingFromBookings(dto, req.user.id);
  }

  @Post('invoices/incoming-from-bookings')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createIncomingInvoiceFromBookings(
    @Body() dto: CreateInvoiceFromBookingsDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.invoice.createIncomingFromBookings(dto, req.user.id);
  }

  @Patch('invoices/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  updateInvoice(
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.invoice.update(id, dto, req.user.id);
  }

  @Post('invoices/:id/attachments')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  addInvoiceAttachment(
    @Param('id') id: string,
    @Body() dto: CreateInvoiceAttachmentDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.invoice.addAttachment(id, dto, req.user.id);
  }

  @Get('debts')
  getDebts(@Query() query: { page?: number; pageSize?: number; status?: string }) {
    return this.service.getDebts(query);
  }

  @Get('debts/aging')
  getDebtAging() {
    return this.service.getDebtAging();
  }

  @Get('deposits')
  getDeposits() {
    return this.service.getDeposits();
  }

  @Patch('deposits/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  updateDeposit(
    @Param('id') id: string,
    @Body() body: {
      amount: number;
      notes?: string;
      fundAccount?: string;
      reference?: string;
      date?: string;
      pic?: string;
    },
    @Request() req: { user: { id: string; fullName?: string } },
  ) {
    return this.service.updateDeposit(id, {
      amount: body.amount,
      notes: body.notes,
      fundAccount: body.fundAccount,
      reference: body.reference,
      date: body.date,
      pic: body.pic ?? req.user.fullName,
      userId: req.user.id,
    });
  }

  @Post('deposits')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createDeposit(
    @Body() body: { airline: string; alertThreshold?: number },
  ) {
    return this.service.createDeposit(body.airline, body.alertThreshold ?? 5_000_000);
  }

  @Post('reconciliation/run')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.MANAGER)
  runReconciliation(@Body() body: { date?: string }) {
    const date = body.date ? new Date(body.date) : new Date();
    return this.service.runReconciliation(date);
  }

  // ─── Ledger (Công nợ 2 chiều AR/AP) ───────────────────────────────
  @Get('ledger/summary')
  getLedgerSummary() {
    return this.ledger.getSummary();
  }

  @Get('ledger/aging')
  getLedgerAging(@Query('direction') direction?: string) {
    return this.ledger.getAging(direction);
  }

  @Get('ledger/overdue')
  getLedgerOverdue() {
    return this.ledger.getOverdue();
  }

  @Get('ledger/statement/:customerId')
  getLedgerStatement(@Param('customerId') customerId: string) {
    return this.ledger.getStatement(customerId);
  }

  @Get('ledger/:id')
  getLedgerOne(@Param('id') id: string) {
    return this.ledger.findOne(id);
  }

  @Get('ledger')
  getLedgerList(@Query() query: ListLedgerDto) {
    return this.ledger.findAll(query);
  }

  @Post('ledger')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createLedger(@Body() dto: CreateLedgerDto, @Request() req: { user: { id: string } }) {
    return this.ledger.create(dto, req.user.id);
  }

  @Patch('ledger/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  updateLedger(@Param('id') id: string, @Body() dto: Partial<CreateLedgerDto>) {
    return this.ledger.update(id, dto);
  }

  @Post('ledger/:id/pay')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  payLedger(
    @Param('id') id: string,
    @Body() dto: PayLedgerDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.ledger.pay(id, dto, req.user.id);
  }

  // ─── Suppliers (Nhà cung cấp / Đối tác) ───────────────────────────
  @Get('suppliers')
  getSuppliers() {
    return this.supplier.findAll();
  }

  @Get('suppliers/:id/ledger')
  getSupplierLedger(@Param('id') id: string) {
    return this.supplier.getLedger(id);
  }

  @Get('suppliers/:id')
  getSupplierOne(@Param('id') id: string) {
    return this.supplier.findOne(id);
  }

  // Seed NCC mặc định từ dữ liệu vận hành — Đặt TRƯỚC @Post('suppliers') để tránh NestJS match sai route
  @Post('suppliers/seed-defaults')
  @Roles(UserRole.ADMIN)
  seedSuppliers() {
    return this.supplier.seedDefaults();
  }

  @Post('suppliers')
  @Roles(UserRole.ADMIN)
  createSupplier(@Body() dto: CreateSupplierDto) {
    return this.supplier.create(dto);
  }

  @Patch('suppliers/:id')
  @Roles(UserRole.ADMIN)
  updateSupplier(@Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    return this.supplier.update(id, dto);
  }

  // ─── Phase B: Dòng tiền (CashFlow) ────────────────────────────────
  @Get('cashflow/fund-balances')
  getFundBalances() {
    return this.cashflow.getFundBalances();
  }

  @Get('funds/summary')
  getFundsSummary() {
    return this.cashflow.getFundsOverview();
  }

  @Get('funds/ledger')
  getFundsLedger(@Query() query: ListFundLedgerDto) {
    return this.cashflow.getFundLedger(query);
  }

  @Post('funds/entry')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createFundEntry(@Body() dto: CreateFundEntryDto, @Request() req: { user: { id: string } }) {
    return this.cashflow.createFundEntry(dto, req.user.id);
  }

  @Patch('funds/entry/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  updateFundEntry(
    @Param('id') id: string,
    @Body() dto: UpdateFundEntryDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.cashflow.updateFundEntry(id, dto, req.user.id);
  }

  @Post('funds/adjust')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  adjustFundBalance(
    @Body() dto: AdjustFundBalanceDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.cashflow.adjustFundBalance(dto, req.user.id);
  }

  @Post('funds/transfer')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  transferFund(
    @Body() dto: TransferFundDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.cashflow.transferBetweenFunds(dto, req.user.id);
  }

  @Patch('funds/transfer/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  updateFundTransfer(
    @Param('id') id: string,
    @Body() dto: TransferFundDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.cashflow.updateFundTransfer(id, dto, req.user.id);
  }

  @Delete('funds/entry/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  deleteFundEntry(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.cashflow.remove(id, req.user.id);
  }

  @Get('cashflow/summary')
  getCashFlowSummary(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.cashflow.getSummary(dateFrom, dateTo);
  }

  @Get('cashflow/monthly')
  getCashFlowMonthly(@Query('year') year?: string) {
    return this.cashflow.getMonthlyReport(parseInt(year ?? new Date().getFullYear().toString()));
  }

  @Get('cashflow/by-pic')
  getCashFlowByPic() {
    return this.cashflow.getPicReport();
  }

  @Get('cashflow')
  getCashFlows(@Query() query: ListCashFlowDto) {
    return this.cashflow.findAll(query);
  }

  @Post('cashflow')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createCashFlow(@Body() dto: CreateCashFlowDto, @Request() req: { user: { id: string } }) {
    return this.cashflow.create(dto, req.user.id);
  }

  @Patch('cashflow/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  updateCashFlow(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCashFlowDto>,
    @Request() req: { user: { id: string } },
  ) {
    return this.cashflow.update(id, dto, req.user.id);
  }

  @Delete('cashflow/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  deleteCashFlow(@Param('id') id: string, @Request() req: { user: { id: string } }) {
    return this.cashflow.remove(id, req.user.id);
  }

  // ─── Phase B: Chi phí vận hành (Expenses) ─────────────────────────
  @Get('expenses/summary')
  getExpenseSummary(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.expense.getSummaryByCategory(dateFrom, dateTo);
  }

  @Get('expenses/monthly')
  getExpenseMonthly(@Query('year') year?: string) {
    return this.expense.getMonthlySummary(parseInt(year ?? new Date().getFullYear().toString()));
  }

  @Get('expenses')
  getExpenses(@Query() query: ListExpenseDto) {
    return this.expense.findAll(query);
  }

  @Post('expenses')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  createExpense(@Body() dto: CreateExpenseDto, @Request() req: { user: { id: string } }) {
    return this.expense.create(dto, req.user.id);
  }

  @Patch('expenses/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  updateExpense(@Param('id') id: string, @Body() dto: Partial<CreateExpenseDto>) {
    return this.expense.update(id, dto);
  }

  @Delete('expenses/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  deleteExpense(@Param('id') id: string) {
    return this.expense.remove(id);
  }
}
