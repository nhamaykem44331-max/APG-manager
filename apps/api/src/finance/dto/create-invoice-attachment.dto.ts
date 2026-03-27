import { IsEnum, IsOptional, IsString } from 'class-validator';
import { InvoiceAttachmentType } from '@prisma/client';

export class CreateInvoiceAttachmentDto {
  @IsOptional() @IsEnum(InvoiceAttachmentType)
  type?: InvoiceAttachmentType;

  @IsString()
  fileName: string;

  @IsOptional() @IsString()
  mimeType?: string;

  @IsOptional() @IsString()
  storagePath?: string;

  @IsOptional() @IsString()
  externalUrl?: string;

  @IsOptional() @IsString()
  notes?: string;
}
