import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { InvoiceImportStatus } from '@prisma/client';

export class ListInvoiceImportBatchesDto {
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(1)
  pageSize?: number;

  @IsOptional() @IsEnum(InvoiceImportStatus)
  status?: InvoiceImportStatus;

  @IsOptional() @IsString()
  search?: string;
}
