// APG Manager RMS - DTO thêm vé vào booking (với validation)
import {
  IsString, IsOptional, IsNumber, IsEnum, IsPositive, Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Airline } from '@prisma/client';

export class AddTicketDto {
  @IsString()
  passengerId: string;

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

  @IsOptional()
  @IsString()
  fareClass?: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  sellPrice: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  netPrice: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tax: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  serviceFee: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  commission: number;

  @IsOptional()
  @IsString()
  eTicketNumber?: string;

  @IsOptional()
  @IsString()
  baggageAllowance?: string;
}
