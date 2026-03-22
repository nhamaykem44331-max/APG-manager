// APG Manager RMS - Decorator @CurrentUser() (lấy user đang đăng nhập)
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@prisma/client';

// Dùng: @CurrentUser() user: User trong controller
export const CurrentUser = createParamDecorator(
  (_data: keyof User | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as User;

    // Nếu truyền field cụ thể, chỉ trả về field đó
    if (_data) {
      return user[_data];
    }

    return user;
  },
);
