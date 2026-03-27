import { UserRole } from '@prisma/client';
import { IsBoolean, IsEmail, IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @MinLength(2, { message: 'Họ tên tối thiểu 2 ký tự' })
  fullName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsEnum(UserRole, { message: 'Vai trò không hợp lệ' })
  role: UserRole;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu tối thiểu 8 ký tự' })
  password: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  permissions?: Record<string, unknown>;
}
