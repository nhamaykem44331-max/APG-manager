// APG Manager RMS - DTO thêm vé vào booking (với validation)
import {
  IsString, IsOptional, IsNumber, IsEnum, IsPositive, Min, Length, IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AddTicketDto {
  // Hành khách: chỉ cần 1 trong 2 (passengerId HOẶC passengerName)
  @IsOptional() @IsString()
  passengerId?: string;

  @IsOptional() @IsString()
  passengerName?: string;       // Dùng khi tạo hành khách mới inline

  @IsOptional() @IsEnum(['ADT', 'CHD', 'INF'])
  passengerType?: 'ADT' | 'CHD' | 'INF'; // Mặc định ADT

  @IsString()
  @Length(2, 3) // IATA 2-letter, cho phép 3 cho code đặc biệt
  airline: string;

  @IsString()
  flightNumber: string;

  @IsString()
  departureCode: string;

  @IsString()
  arrivalCode: string;

  @IsString()
  departureTime: string;

  @IsString()
  arrivalTime: string;

  @IsString()
  seatClass: string;

  @IsOptional() @IsString()
  fareClass?: string;

  @IsOptional() @IsString()
  airlineBookingCode?: string;   // Mã đặt chỗ hãng bay: 64NTWM

  @Type(() => Number) @IsNumber() @IsPositive()
  sellPrice: number;

  @Type(() => Number) @IsNumber() @IsPositive()
  netPrice: number;

  @Type(() => Number) @IsNumber() @Min(0)
  tax: number;

  @Type(() => Number) @IsNumber() @Min(0)
  serviceFee: number;

  @Type(() => Number) @IsNumber() @Min(0)
  commission: number;

  @IsOptional() @IsString()
  eTicketNumber?: string;

  @IsOptional() @IsString()
  baggageAllowance?: string;

  @IsOptional() @IsBoolean()
  replaceExistingPnr?: boolean;
}
