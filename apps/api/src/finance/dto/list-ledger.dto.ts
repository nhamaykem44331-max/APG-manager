// APG Manager RMS - DTO: Lọc/tìm kiếm danh sách công nợ
import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ListLedgerDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  pageSize?: number;

  @IsOptional() @IsIn(['RECEIVABLE', 'PAYABLE'])
  direction?: string;

  @IsOptional() @IsString()
  partyType?: string;

  @IsOptional() @IsString()
  status?: string;

  @IsOptional() @IsString()
  search?: string; // Tìm trong code, description, customerCode

  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsString()
  supplierId?: string;

  @IsOptional() @IsString()
  customerCode?: string; // Filter theo mã KH: SCCM01, TB01...

  @IsOptional() @IsString()
  pic?: string; // Filter theo người phụ trách
}
