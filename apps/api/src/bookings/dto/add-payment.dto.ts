// APG Manager RMS - DTO ghi nhận thanh toán (với validation)
import {
  IsString, IsOptional, IsNumber, IsPositive, IsEnum,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

export class AddPaymentDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  // Quỹ tiền nhận thanh toán
  @IsOptional() @IsString()
  fundAccount?: string;  // 'CASH_OFFICE' | 'BANK_HTX' | 'BANK_PERSONAL'

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  paidAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
