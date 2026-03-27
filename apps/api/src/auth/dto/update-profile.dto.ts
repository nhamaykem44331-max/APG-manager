import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  fullName?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
