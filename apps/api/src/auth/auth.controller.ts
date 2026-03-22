// APG Manager RMS - Auth Controller (endpoints đăng nhập, token, user)
import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { User } from '@prisma/client';

@Controller('auth')
@UseGuards(JwtAuthGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  // POST /api/v1/auth/login - Đăng nhập
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // POST /api/v1/auth/refresh - Làm mới token
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshToken(body.refreshToken);
  }

  // POST /api/v1/auth/logout - Đăng xuất (client xóa token)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    // JWT stateless - client tự xóa token
    // Nếu cần blacklist token, thêm Redis sau
    return { message: 'Đăng xuất thành công' };
  }

  // GET /api/v1/auth/me - Thông tin user đang đăng nhập
  @Get('me')
  async getMe(@CurrentUser() user: User) {
    return this.authService.getMe(user.id);
  }

  // PUT /api/v1/auth/change-password - Đổi mật khẩu
  @Put('change-password')
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }
}
