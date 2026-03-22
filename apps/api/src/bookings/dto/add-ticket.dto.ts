// APG Manager RMS - DTO thêm vé vào booking (với validation)
import {
  IsString, IsOptional, IsNumber, IsEnum, IsPositive, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Airline } from '@prisma/client';

export class AddTicketDto {
  // Hành khách: chỉ cần 1 trong 2 (passengerId HOẶC passengerName)
  @IsOptional() @IsString()
  passengerId?: string;

  @IsOptional() @IsString()
  passengerName?: string;       // Dùng khi tạo hành khách mới inline

  @IsOptional() @IsEnum(['ADT', 'CHD', 'INF'])
  passengerType?: 'ADT' | 'CHD' | 'INF'; // Mặc định ADT

  @IsEnum(Airline)
  airline: Airline;

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
}
