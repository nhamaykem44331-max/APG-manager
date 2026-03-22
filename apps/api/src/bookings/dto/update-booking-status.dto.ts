// APG Manager RMS - DTO chuyển trạng thái booking
import { IsString, IsOptional } from 'class-validator';

export class UpdateBookingStatusDto {
  @IsString()
  toStatus: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
