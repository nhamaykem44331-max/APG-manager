import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { InvoiceDirection, InvoiceStatus } from '@prisma/client';

export class ListInvoicesDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  pageSize?: number;

  @IsOptional() @IsEnum(InvoiceDirection)
  direction?: InvoiceDirection;

  @IsOptional() @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsString()
  supplierId?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;

  @IsOptional() @IsString()
  sortBy?: string;

  @IsOptional() @IsString()
  sortOrder?: 'asc' | 'desc';
}
