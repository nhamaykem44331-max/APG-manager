import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ResetOperationalDataDto } from './dto/reset-operational-data.dto';
import { SystemService } from './system.service';

@Controller('system')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Public()
  @Get('health')
  getHealth() {
    return this.systemService.getHealth();
  }

  @Post('data/reset-operational')
  @Roles(UserRole.ADMIN)
  resetOperationalData(
    @CurrentUser('id') currentUserId: string,
    @Body() dto: ResetOperationalDataDto,
  ) {
    return this.systemService.resetOperationalData(currentUserId, dto);
  }
}
