import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { FundAccount } from '@prisma/client';

export class PayPartnerDto {
  @IsString()
  partnerId: string;

  @Type(() => Number) @IsNumber() @IsPositive()
  amount: number;

  @IsEnum(FundAccount)
  fundAccount: FundAccount;

  @IsOptional() @IsDateString()
  date?: string;

  @IsOptional() @IsString()
  reference?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsString()
  reason?: string;
}
