import { IsDateString, IsString } from 'class-validator';

export class CreateDebtStatementExportDto {
  @IsString()
  customerId: string;

  @IsDateString()
  dateFrom: string;

  @IsDateString()
  dateTo: string;
}
