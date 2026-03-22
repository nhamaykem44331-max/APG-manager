// APG Manager RMS - Customers Controller
import {
  Controller, Get, Post, Patch, Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { CustomersService, CreateCustomerDto, ListCustomersDto } from './customers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private service: CustomersService) {}

  @Get()
  findAll(@Query() query: ListCustomersDto) {
    return this.service.findAll(query);
  }

  @Get('birthdays')
  getBirthdays() {
    return this.service.getUpcomingBirthdays();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/stats')
  getStats(@Param('id') id: string) {
    return this.service.getStats(id);
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateCustomerDto>) {
    return this.service.update(id, dto);
  }
}
