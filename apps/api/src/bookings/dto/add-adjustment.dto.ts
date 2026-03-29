import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum AdjustmentTypeDto {
  CHANGE = 'CHANGE',
  REFUND_CREDIT = 'REFUND_CREDIT',
  REFUND_CASH = 'REFUND_CASH',
}

export class AddAdjustmentDto {
  @IsEnum(AdjustmentTypeDto)
  type: AdjustmentTypeDto;

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
