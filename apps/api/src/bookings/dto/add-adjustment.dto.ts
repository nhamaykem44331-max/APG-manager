import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum AdjustmentTypeDto {
  CHANGE = 'CHANGE',
  REFUND_CREDIT = 'REFUND_CREDIT',
  REFUND_CASH = 'REFUND_CASH',
  REFUND_NAMED = 'REFUND_NAMED',
  HLKG = 'HLKG',
  SERVICE = 'SERVICE',
}

export class AddAdjustmentDto {
  @IsEnum(AdjustmentTypeDto)
  type: AdjustmentTypeDto;

  // === DOI VE ===
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  changeFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  chargeToCustomer?: number;

  // === HOAN VE ===
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  airlineRefund?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  penaltyFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  apgServiceFee?: number;

  // === QUY ===
  @IsOptional()
  @IsString()
  fundAccount?: string;

  // === HOAN DINH DANH ===
  @IsOptional()
  @IsString()
  passengerName?: string;

  @IsOptional()
  @IsString()
  expiryDate?: string;

  // === HLKG / SERVICE ===
  @IsOptional()
  @IsString()
  serviceCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
