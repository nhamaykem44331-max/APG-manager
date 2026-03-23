// APG Manager RMS - Sales Controller
import {
  Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { SalesLeadService, CreateLeadDto, UpdateLeadStatusDto } from './sales-lead.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalesController {
  constructor(private readonly leads: SalesLeadService) {}

  // ─── Pipeline Kanban view ──────────────────────────────────────────
  @Get('pipeline')
  getPipeline(@Query('salesPerson') salesPerson?: string) {
    return this.leads.getPipeline(salesPerson);
  }

  // ─── Upcoming action alerts (Dashboard) ──────────────────────────
  @Get('upcoming')
  getUpcoming() {
    return this.leads.getUpcoming();
  }

  // ─── Danh sách leads ─────────────────────────────────────────────
  @Get()
  getAll(
    @Query('salesPerson') salesPerson?: string,
    @Query('status') status?: string,
  ) {
    return this.leads.findAll(salesPerson, status);
  }

  // ─── Chi tiết lead ───────────────────────────────────────────────
  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.leads.findOne(id);
  }

  // ─── Tạo lead mới ────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES)
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }

  // ─── Cập nhật lead ───────────────────────────────────────────────
  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES)
  update(@Param('id') id: string, @Body() dto: Partial<CreateLeadDto>) {
    return this.leads.update(id, dto);
  }

  // ─── Chuyển trạng thái (Kanban drag) ────────────────────────────
  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.SALES)
  updateStatus(@Param('id') id: string, @Body() dto: UpdateLeadStatusDto) {
    return this.leads.updateStatus(id, dto);
  }

  // ─── Xóa lead ────────────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  remove(@Param('id') id: string) {
    return this.leads.remove(id);
  }

  // ─── Seed 17 leads mẫu từ Google Sheet ──────────────────────────
  @Post('seed-sample')
  @Roles(UserRole.ADMIN)
  seedSample() {
    return this.leads.seedSampleLeads();
  }
}
