import { IsArray, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateInvoiceFromBookingsDto {
  @IsArray() @IsString({ each: true })
  bookingIds: string[];

  @IsOptional() @IsDateString()
  invoiceDate?: string;

  @IsOptional() @IsDateString()
  periodFrom?: string;

  @IsOptional() @IsDateString()
  periodTo?: string;

  @IsOptional() @IsString()
  notes?: string;

  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[];
}
