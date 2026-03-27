import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../common/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { normalizePermissions } from './user-permissions';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: [
        { role: 'asc' },
        { fullName: 'asc' },
      ],
    });

    return users.map((user) => this.sanitizeUser(user));
  }

  async createUser(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
      select: { id: true },
    });

    if (existing) {
      throw new BadRequestException('Email đã tồn tại trong hệ thống');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        password: hashedPassword,
        fullName: dto.fullName.trim(),
        phone: dto.phone?.trim() || null,
        role: dto.role,
        isActive: dto.isActive ?? true,
        permissions: normalizePermissions(dto.permissions, dto.role),
      },
    });

    return this.sanitizeUser(user);
  }

  async updateUser(userId: string, dto: UpdateUserDto, currentUserId: string) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundException('Không tìm thấy tài khoản');
    }

    const nextRole = dto.role ?? existingUser.role;
    const nextIsActive = dto.isActive ?? existingUser.isActive;
    await this.ensureAdminSafety(existingUser.id, existingUser.role, nextRole, nextIsActive, currentUserId);

    if (dto.email && dto.email.trim().toLowerCase() !== existingUser.email) {
      const conflict = await this.prisma.user.findUnique({
        where: { email: dto.email.trim().toLowerCase() },
        select: { id: true },
      });

      if (conflict && conflict.id !== existingUser.id) {
        throw new BadRequestException('Email đã tồn tại trong hệ thống');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: dto.email?.trim().toLowerCase(),
        fullName: dto.fullName?.trim(),
        phone: dto.phone === undefined ? undefined : dto.phone.trim() || null,
        role: nextRole,
        isActive: nextIsActive,
        password: dto.newPassword ? await bcrypt.hash(dto.newPassword, 12) : undefined,
        permissions: dto.permissions
          ? normalizePermissions(dto.permissions, nextRole)
          : existingUser.permissions
            ? normalizePermissions(existingUser.permissions, nextRole)
            : normalizePermissions(undefined, nextRole),
      },
    });

    return this.sanitizeUser(user);
  }

  private async ensureAdminSafety(
    targetUserId: string,
    currentRole: UserRole,
    nextRole: UserRole,
    nextIsActive: boolean,
    currentUserId: string,
  ) {
    const isAdminBeingDemoted = currentRole === UserRole.ADMIN && nextRole !== UserRole.ADMIN;
    const isAdminBeingDisabled = currentRole === UserRole.ADMIN && !nextIsActive;

    if (!isAdminBeingDemoted && !isAdminBeingDisabled) {
      return;
    }

    if (targetUserId === currentUserId && !nextIsActive) {
      throw new BadRequestException('Bạn không thể tự khóa chính tài khoản admin đang đăng nhập');
    }

    const otherActiveAdmins = await this.prisma.user.count({
      where: {
        id: { not: targetUserId },
        role: UserRole.ADMIN,
        isActive: true,
      },
    });

    if (otherActiveAdmins === 0) {
      throw new BadRequestException('Hệ thống phải luôn còn ít nhất 1 tài khoản admin đang hoạt động');
    }
  }

  private sanitizeUser<T extends { password?: string | null; role: UserRole; permissions?: unknown }>(user: T) {
    const { password, ...safeUser } = user;
    return {
      ...safeUser,
      permissions: normalizePermissions(safeUser.permissions, safeUser.role),
    };
  }
}
