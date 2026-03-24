// APG Manager RMS - DTO: Ghi nhận thanh toán công nợ
import { IsString, IsOptional, IsNumber, IsPositive, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class PayLedgerDto {
  @Type(() => Number) @IsNumber() @IsPositive()
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional() @IsString()
  reference?: string; // Mã giao dịch / UNC / biên lai

  @IsOptional() @IsDateString()
  paidAt?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  fundAccount?: string;  // 'CASH_OFFICE' | 'BANK_HTX' | 'BANK_PERSONAL'
}
