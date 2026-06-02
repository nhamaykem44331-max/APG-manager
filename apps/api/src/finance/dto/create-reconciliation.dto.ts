import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FundAccount } from '@prisma/client';

export class PreviewReconciliationDto {
  @IsString()
  supplierId: string;

  @IsDateString()
  periodFrom: string;

  @IsDateString()
  periodTo: string;
}

export class CreateReconciliationDto {
  @IsString()
  supplierId: string;

  @IsDateString()
  periodFrom: string;

  @IsDateString()
  periodTo: string;

  @Type(() => Number) @IsNumber() @Min(0)
  bspNet: number;

  @Type(() => Number) @IsNumber() @Min(0)
  bspCommission: number;

  @IsOptional() @IsEnum(FundAccount)
  fundAccount?: FundAccount;

  @IsOptional() @IsString()
  notes?: string;
}
