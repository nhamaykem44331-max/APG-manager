import { IsString, IsOptional, IsNumber, IsEnum, IsPositive, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { CashFlowDirection, CashFlowCategory } from '@prisma/client';

export class CreateCashFlowDto {
  @IsEnum(CashFlowDirection)
  direction: CashFlowDirection;

  @IsEnum(CashFlowCategory)
  category: CashFlowCategory;

  @Type(() => Number) @IsNumber() @IsPositive()
  amount: number;

  @IsString()
  pic: string;

  @IsString()
  description: string;

  @IsOptional() @IsString()
  reference?: string;

  @IsDateString()
  date: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  notes?: string;
}

export class ListCashFlowDto {
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) pageSize?: number;
  @IsOptional() @IsString() direction?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() pic?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() status?: string;
}
