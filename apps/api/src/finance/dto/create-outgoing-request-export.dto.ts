import { IsString } from 'class-validator';

export class CreateOutgoingRequestExportDto {
  @IsString()
  invoiceId: string;
}
