import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { CashFlowCategory, CashFlowDirection, FundAccount } from '@prisma/client';

export class ListFundLedgerDto {
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) pageSize?: number;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsDateString() dateFrom?: string;
  @IsOptional() @IsDateString() dateTo?: string;
  @IsOptional() @IsEnum(FundAccount) fundAccount?: FundAccount;
  @IsOptional() @IsString() sourceType?: string;
}

export class CreateFundEntryDto {
  @IsEnum(CashFlowDirection)
  direction: CashFlowDirection;

  @IsEnum(CashFlowCategory)
  category: CashFlowCategory;

  @Type(() => Number) @IsNumber() @IsPositive()
  amount: number;

  @IsEnum(FundAccount)
  fundAccount: FundAccount;

  @IsString()
  pic: string;

  @IsString()
  description: string;

  @IsOptional() @IsString()
  reference?: string;

  @IsDateString()
  date: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class UpdateFundEntryDto {
  @IsOptional() @IsEnum(CashFlowDirection)
  direction?: CashFlowDirection;

  @IsOptional() @IsEnum(CashFlowCategory)
  category?: CashFlowCategory;

  @IsOptional() @Type(() => Number) @IsNumber() @IsPositive()
  amount?: number;

  @IsOptional() @IsEnum(FundAccount)
  fundAccount?: FundAccount;

  @IsOptional() @IsString()
  pic?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  reference?: string;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  reason?: string;
}

export class AdjustFundBalanceDto {
  @IsEnum(FundAccount)
  fundAccount: FundAccount;

  @Type(() => Number) @IsNumber() @Min(0)
  targetBalance: number;

  @IsString()
  reason: string;

  @IsString()
  pic: string;

  @IsDateString()
  date: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  reference?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class TransferFundDto {
  @IsEnum(FundAccount)
  fromFundAccount: FundAccount;

  @IsEnum(FundAccount)
  toFundAccount: FundAccount;

  @Type(() => Number) @IsNumber() @IsPositive()
  amount: number;

  @IsString()
  pic: string;

  @IsDateString()
  date: string;

  @IsString()
  reason: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  reference?: string;

  @IsOptional() @IsString()
  notes?: string;
}
