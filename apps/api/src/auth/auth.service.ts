// APG Manager RMS - Auth Service (xử lý đăng nhập, JWT, refresh token)
import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { normalizePermissions } from '../users/user-permissions';

// Kiểu dữ liệu JWT payload
interface JwtPayload {
  sub: string;    // user ID
  email: string;
  role: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private config: ConfigService,
  ) {}

  // Xác thực email + password (dùng cho LocalStrategy)
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      return null;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return null;
    }

    return user;
  }

  // Đăng nhập - trả về access token + refresh token
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Cập nhật thời gian đăng nhập cuối
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, {
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
        secret: this.config.get('JWT_SECRET') + '_refresh',
      }),
      user: this.sanitizeUser(user),
    };
  }

  // Làm mới access token
  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get('JWT_SECRET') + '_refresh',
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user || !user.isActive) {
        throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa');
      }

      const newPayload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };

      return {
        accessToken: this.jwtService.sign(newPayload),
      };
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
  }

  // Lấy thông tin user hiện tại
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản');
    }

    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new UnauthorizedException('Không tìm thấy tài khoản');
    }

    if (dto.email && dto.email.trim().toLowerCase() !== existingUser.email) {
      const conflict = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
        select: { id: true },
      });

      if (conflict && conflict.id !== userId) {
        throw new BadRequestException('Email đã tồn tại trong hệ thống');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email?.trim().toLowerCase(),
        fullName: dto.fullName?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
      },
    });

    return this.sanitizeUser(user);
  }

  // Đổi mật khẩu
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new UnauthorizedException('Không tìm thấy tài khoản');
    }

    // Kiểm tra mật khẩu cũ
    const isMatch = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    // Hash mật khẩu mới
    const hashedPassword = await bcrypt.hash(dto.newPassword, 12);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Đổi mật khẩu thành công' };
  }

  // Loại bỏ trường nhạy cảm trước khi trả về client
  private sanitizeUser(user: User) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safeUser } = user;
    return {
      ...safeUser,
      permissions: normalizePermissions(safeUser.permissions, safeUser.role),
    };
  }
}
