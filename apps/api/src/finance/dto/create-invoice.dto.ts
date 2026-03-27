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
import {
  CustomerType,
  InvoiceDirection,
  InvoiceSourceType,
  InvoiceStatus,
} from '@prisma/client';
import { InvoiceLineDto } from './invoice-line.dto';

export class CreateInvoiceDto {
  @IsEnum(InvoiceDirection)
  direction: InvoiceDirection;

  @IsOptional() @IsEnum(InvoiceSourceType)
  sourceType?: InvoiceSourceType;

  @IsOptional() @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  @IsOptional() @IsDateString()
  invoiceDate?: string;

  @IsOptional() @IsDateString()
  periodFrom?: string;

  @IsOptional() @IsDateString()
  periodTo?: string;

  @IsOptional() @IsString()
  currencyCode?: string;

  @IsOptional() @IsString()
  paymentMethod?: string;

  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsString()
  supplierId?: string;

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
  sellerLegalName?: string;

  @IsOptional() @IsString()
  sellerTaxCode?: string;

  @IsOptional() @IsString()
  sellerAddress?: string;

  @IsOptional() @IsString()
  sellerEmail?: string;

  @IsOptional() @IsString()
  sellerPhone?: string;

  @IsOptional() @IsString()
  sellerBankAccount?: string;

  @IsOptional() @IsString()
  sellerBankName?: string;

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  lines: InvoiceLineDto[];
}
