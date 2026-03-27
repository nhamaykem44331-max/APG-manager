import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { InvoiceExportType } from '@prisma/client';

export class ListInvoiceExportBatchesDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  pageSize?: number;

  @IsOptional() @IsEnum(InvoiceExportType)
  type?: InvoiceExportType;

  @IsOptional() @IsString()
  search?: string;
}
