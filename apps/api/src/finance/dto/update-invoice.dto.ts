import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CustomerType, InvoiceStatus } from '@prisma/client';
import { InvoiceLineDto } from './invoice-line.dto';

export class UpdateInvoiceDto {
  @IsOptional() @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional() @IsDateString()
  invoiceDate?: string;

  @IsOptional() @IsDateString()
  periodFrom?: string;

  @IsOptional() @IsDateString()
  periodTo?: string;

  @IsOptional() @IsString()
  paymentMethod?: string;

  @IsOptional() @IsEnum(CustomerType)
  buyerType?: CustomerType;

  @IsOptional() @IsString()
  invoiceNumber?: string;

  @IsOptional() @IsString()
  invoiceSeries?: string;

  @IsOptional() @IsString()
  invoiceTemplateNo?: string;

  @IsOptional() @IsString()
  transactionId?: string;

  @IsOptional() @IsString()
  lookupUrl?: string;

  @IsOptional() @IsString()
  buyerLegalName?: string;

  @IsOptional() @IsString()
  buyerTaxCode?: string;

  @IsOptional() @IsString()
  buyerAddress?: string;

  @IsOptional() @IsString()
  buyerEmail?: string;

  @IsOptional() @IsString()
  buyerPhone?: string;

  @IsOptional() @IsString()
  buyerFullName?: string;

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

  @IsOptional() @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines?: InvoiceLineDto[];
}
