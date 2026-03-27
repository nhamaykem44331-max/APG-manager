import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ListInvoiceDebtStatementDto {
  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsDateString()
  dateFrom?: string;

  @IsOptional() @IsDateString()
  dateTo?: string;

  @IsOptional() @IsString()
  search?: string;
}
