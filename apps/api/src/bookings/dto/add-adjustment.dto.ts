// APG Manager RMS - Add Adjustment DTO (Hoàn/Đổi vé)
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export enum AdjustmentTypeDto {
  CHANGE = 'CHANGE',
  REFUND_CREDIT = 'REFUND_CREDIT',
  REFUND_CASH = 'REFUND_CASH',
}

export class AddAdjustmentDto {
  @IsEnum(AdjustmentTypeDto)
  type: AdjustmentTypeDto;

  /** Phí đổi vé (hãng thu) — chỉ dùng khi type = CHANGE */
  @IsOptional()
  @IsNumber()
  @Min(0)
  changeFee?: number;

  /** Thu khách thêm — chỉ dùng khi type = CHANGE */
  @IsOptional()
  @IsNumber()
  @Min(0)
  chargeToCustomer?: number;

  /** Số tiền hoàn — dùng cho REFUND_CREDIT / REFUND_CASH */
  @IsOptional()
  @IsNumber()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
