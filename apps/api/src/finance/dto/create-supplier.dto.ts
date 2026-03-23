import { IsString, IsOptional, IsNumber, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { LedgerPartyType } from '@prisma/client';

export class CreateSupplierDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsEnum(LedgerPartyType)
  type: LedgerPartyType;

  @IsOptional() @IsString()
  contactName?: string;

  @IsOptional() @IsString()
  contactPhone?: string;

  @IsOptional() @IsString()
  contactEmail?: string;

  @IsOptional() @IsString()
  taxId?: string;

  @IsOptional() @IsString()
  bankAccount?: string;

  @IsOptional() @IsString()
  bankName?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  creditLimit?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  paymentTerms?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  feedbackRate?: number;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateSupplierDto {
  @IsOptional() @IsString()
  name?: string;

  @IsOptional() @IsString()
  contactName?: string;

  @IsOptional() @IsString()
  contactPhone?: string;

  @IsOptional() @IsString()
  contactEmail?: string;

  @IsOptional() @IsString()
  taxId?: string;

  @IsOptional() @IsString()
  bankAccount?: string;

  @IsOptional() @IsString()
  bankName?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  creditLimit?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  paymentTerms?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  feedbackRate?: number;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional()
  isActive?: boolean;
}
