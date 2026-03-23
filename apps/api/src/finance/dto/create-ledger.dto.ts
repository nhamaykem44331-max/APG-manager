// APG Manager RMS - DTO: Tạo mới công nợ (AccountsLedger)
import { IsString, IsOptional, IsEnum, IsNumber, IsPositive, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { LedgerDirection, LedgerPartyType } from '@prisma/client';

export class CreateLedgerDto {
  @IsEnum(LedgerDirection)
  direction: LedgerDirection;

  @IsEnum(LedgerPartyType)
  partyType: LedgerPartyType;

  // Liên kết đối tượng (chỉ 1 trong 2)
  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsString()
  supplierId?: string;

  @IsOptional() @IsString()
  customerCode?: string; // Mã KH nội bộ: SCCM01, TB01...

  // Liên kết nguồn gốc
  @IsOptional() @IsString()
  bookingId?: string;

  @IsOptional() @IsString()
  bookingCode?: string;

  // Số tiền
  @Type(() => Number) @IsNumber() @IsPositive()
  totalAmount: number;

  // Thời hạn
  @IsDateString()
  dueDate: string;

  // Thông tin bổ sung
  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  invoiceNumber?: string;

  @IsOptional() @IsString()
  pic?: string; // Người phụ trách

  @IsOptional() @IsString()
  notes?: string;
}
