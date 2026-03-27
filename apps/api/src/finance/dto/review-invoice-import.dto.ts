import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { InvoiceImportStatus } from '@prisma/client';
import { InvoiceLineDto } from './invoice-line.dto';

export class ReviewInvoiceImportDto {
  @IsOptional() @IsEnum(InvoiceImportStatus)
  status?: InvoiceImportStatus;

  @IsOptional() @IsString()
  supplierId?: string;

  @IsOptional() @IsString()
  invoiceNumber?: string;

  @IsOptional() @IsString()
  invoiceSeries?: string;

  @IsOptional() @IsDateString()
  invoiceDate?: string;

  @IsOptional() @IsString()
  paymentMethod?: string;

  @IsOptional() @IsString()
  supplierLegalName?: string;

  @IsOptional() @IsString()
  supplierTaxCode?: string;

  @IsOptional() @IsString()
  supplierAddress?: string;

  @IsOptional() @IsString()
  supplierEmail?: string;

  @IsOptional() @IsString()
  supplierPhone?: string;

  @IsOptional() @IsString()
  supplierBankAccount?: string;

  @IsOptional() @IsString()
  supplierBankName?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines?: InvoiceLineDto[];
}
