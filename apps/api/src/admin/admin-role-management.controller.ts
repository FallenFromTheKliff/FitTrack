import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { UpgradeToCoachDto } from './dto/admin.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller('admin')
export class AdminRoleManagementController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Post('upgrade-to-coach')
  @ApiOperation({
    summary: 'Upgrade an existing member or staff account into a coach account.',
  })
  @ApiResponse({
    status: 201,
    description: 'Coach profile created and user role updated.',
  })
  upgradeToCoach(@Body() dto: UpgradeToCoachDto) {
    return this.adminUsersService.upgradeToCoach(dto);
  }
}
