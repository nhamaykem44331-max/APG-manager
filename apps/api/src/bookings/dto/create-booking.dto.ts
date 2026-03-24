// APG Manager RMS - DTO tạo booking mới
import {
  IsString, IsOptional, IsEnum,
} from 'class-validator';
import { BookingSource, PaymentMethod } from '@prisma/client';

export class CreateBookingDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsEnum(BookingSource)
  source: BookingSource;

  @IsString()
  contactName: string;

  @IsString()
  contactPhone: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  // PNR từ GDS (Amadeus, Sabre...) - tuỳ chọn ở luồng tạo nhanh
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
