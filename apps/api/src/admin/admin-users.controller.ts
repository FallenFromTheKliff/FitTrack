import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { CurrentUser, Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { UpdateMembershipCardDto, UpgradeToCoachDto } from './dto/admin.dto';
import { AdminUsersService } from './admin-users.service';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.staff, UserRole.coach)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary:
      'List member and staff directory records for the admin members screen.',
  })
  getAllUsers(@CurrentUser() user: JwtPayload) {
    return this.adminUsersService.getAll(user.role);
  }

  @Delete(':id')
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary: 'Archive a user directory record by soft deleting the account.',
  })
  softDeleteUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminUsersService.softDeleteUser(id, user.sub, user.role);
  }

  @Patch(':id/restore')
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary: 'Restore an archived user directory record to active status.',
  })
  restoreUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminUsersService.restoreUser(id, user.sub, user.role);
  }

  @Post('upgrade-to-coach')
  @Roles(UserRole.admin)
  @ApiOperation({
    summary:
      'Upgrade an existing member or staff account into a coach account.',
  })
  upgradeToCoach(
    @Body() dto: UpgradeToCoachDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminUsersService.upgradeToCoach(dto, user.sub);
  }

  @Patch(':id/membership-card')
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary:
      'Grant or revoke membership-card access for a member directory record.',
  })
  updateMembershipCard(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMembershipCardDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminUsersService.updateMembershipCard(id, dto, user.sub);
  }

  @Patch(':id/verify-non-member')
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary:
      'Promote a pending member account to verified non-member without granting membership-card access.',
  })
  verifyNonMember(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminUsersService.verifyNonMember(id, user.sub, user.role);
  }
}
