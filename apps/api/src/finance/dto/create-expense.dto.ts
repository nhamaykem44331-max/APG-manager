import { IsString, IsOptional, IsNumber, IsPositive, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateExpenseDto {
  @IsString()
  category: string;

  @IsString()
  description: string;

  @Type(() => Number) @IsNumber() @IsPositive()
  amount: number;

  @IsDateString()
  date: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  fundAccount?: string;  // 'CASH_OFFICE' | 'BANK_HTX' | 'BANK_PERSONAL'
}

export class ListExpenseDto {
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) pageSize?: number;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() dateFrom?: string;
  @IsOptional() @IsString() dateTo?: string;
  @IsOptional() @IsString() status?: string;
}
