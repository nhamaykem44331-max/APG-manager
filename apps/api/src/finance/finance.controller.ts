// APG Manager RMS - Finance Controller (Phase A: Ledger/Supplier + Phase B: CashFlow/Expense)
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { LedgerService } from './ledger.service';
import { SupplierService } from './supplier.service';
import { CashFlowService } from './cashflow.service';
import { ExpenseService } from './expense.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import {
  CreateLedgerDto, PayLedgerDto, ListLedgerDto,
  CreateCashFlowDto, ListCashFlowDto,
  CreateExpenseDto, ListExpenseDto,
  CreateSupplierDto, UpdateSupplierDto,
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
  ) {}

  // ─── Finance cũ (giữ nguyên) ───────────────────────────────────────
  @Get('dashboard')
  getDashboard() {
    return this.service.getDashboard();
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
    @Body() body: { amount: number; notes?: string },
  ) {
    return this.service.updateDeposit(id, body.amount, body.notes);
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
  updateCashFlow(@Param('id') id: string, @Body() dto: Partial<CreateCashFlowDto>) {
    return this.cashflow.update(id, dto);
  }

  @Delete('cashflow/:id')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT)
  deleteCashFlow(@Param('id') id: string) {
    return this.cashflow.remove(id);
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
