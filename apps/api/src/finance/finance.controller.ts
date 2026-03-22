// APG Manager RMS - Finance Controller
import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('finance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinanceController {
  constructor(private service: FinanceService) {}

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

  @Post('reconciliation/run')
  @Roles(UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.MANAGER)
  runReconciliation(@Body() body: { date?: string }) {
    const date = body.date ? new Date(body.date) : new Date();
    return this.service.runReconciliation(date);
  }
}
