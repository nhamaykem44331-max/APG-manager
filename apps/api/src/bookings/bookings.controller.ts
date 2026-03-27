// APG Manager RMS - Bookings Controller (REST API endpoints)
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole, User } from '@prisma/client';
import {
  CreateBookingDto, UpdateBookingDto,
  UpdateBookingStatusDto, ListBookingsDto,
  AddTicketDto, AddPaymentDto,
} from './dto/index';

@Controller('bookings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  // GET /bookings - Danh sách booking
  @Get()
  async findAll(@Query() query: ListBookingsDto) {
    return this.bookingsService.findAll(query);
  }

  // GET /bookings/:id - Chi tiết booking
  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.bookingsService.findOne(id);
  }

  // POST /bookings - Tạo booking mới
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateBookingDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.create(dto, user.id);
  }

  // PATCH /bookings/:id - Cập nhật booking
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.update(id, dto, user);
  }

  // PATCH /bookings/:id/status - Chuyển trạng thái
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateBookingStatusDto,
    @CurrentUser() user: User,
  ) {
    return this.bookingsService.updateStatus(id, dto, user.id);
  }

  // POST /bookings/:id/tickets - Thêm vé
  @Post(':id/tickets')
  @HttpCode(HttpStatus.CREATED)
  async addTicket(
    @Param('id') id: string,
    @Body() dto: AddTicketDto,
  ) {
    return this.bookingsService.addTicket(id, dto);
  }

  // DELETE /bookings/:id/tickets - Xóa toàn bộ hành trình/vé của booking
  @Delete(':id/tickets')
  async clearTickets(@Param('id') id: string) {
    return this.bookingsService.clearTickets(id);
  }

  // POST /bookings/:id/payments - Ghi nhận thanh toán
  @Post(':id/payments')
  @HttpCode(HttpStatus.CREATED)
  async addPayment(
    @Param('id') id: string,
    @Body() dto: AddPaymentDto,
  ) {
    return this.bookingsService.addPayment(id, dto);
  }

  // GET /bookings/:id/timeline - Lịch sử trạng thái
  @Get(':id/timeline')
  async getTimeline(@Param('id') id: string) {
    const booking = await this.bookingsService.findOne(id);
    return booking.statusHistory;
  }

  // DELETE /bookings/:id - Soft delete (chỉ ADMIN)
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.bookingsService.remove(id, user.id);
  }
}
