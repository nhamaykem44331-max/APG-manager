import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class InvoiceLineDto {
  @IsOptional() @IsString()
  bookingId?: string;

  @IsOptional() @IsString()
  bookingCode?: string;

  @IsOptional() @IsString()
  pnr?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  ticketIds?: string[];

  @IsString()
  description: string;

  @IsOptional() @IsString()
  passengerName?: string;

  @IsOptional() @IsString()
  passengerType?: string;

  @IsOptional() @IsString()
  route?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  quantity?: number;

  @IsOptional() @IsString()
  unitName?: string;

  @IsOptional() @IsString()
  currencyCode?: string;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  unitPrice?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  amountBeforeVat?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  vatRate?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  vatAmount?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  amount?: number;

  @IsOptional() @Type(() => Number) @IsNumber() @Min(0)
  serviceFee?: number;

  @IsOptional() @IsString()
  notes?: string;
}
