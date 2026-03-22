// APG Manager RMS - Bookings DTOs (validate input)
import {
  IsString, IsOptional, IsEnum,
  IsInt, Min, Max, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingSource, PaymentMethod } from '@prisma/client';

// DTO tạo booking mới
export class CreateBookingDto {
  @IsString()
  customerId: string;

  @IsEnum(BookingSource)
  source: BookingSource;

  @IsString()
  contactName: string;

  @IsString()
  contactPhone: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}

// DTO cập nhật booking
export class UpdateBookingDto {
  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  pnr?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  internalNotes?: string;
}

// DTO chuyển trạng thái booking
export class UpdateBookingStatusDto {
  @IsString()
  toStatus: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

// DTO query danh sách booking
export class ListBookingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt', 'totalSellPrice', 'profit'])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}
