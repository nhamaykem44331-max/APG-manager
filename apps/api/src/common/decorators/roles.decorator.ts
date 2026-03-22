// APG Manager RMS - Decorator @Roles() (phân quyền theo vai trò)
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

// Dùng: @Roles(UserRole.ADMIN, UserRole.MANAGER) trên route
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
