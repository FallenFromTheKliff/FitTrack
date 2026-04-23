import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser, Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { ReviewDeletionRequestDto } from '../user/dto/deletion-request.dto';
import { AdminDeletionRequestsService } from './admin-deletion-requests.service';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin, UserRole.staff)
@Controller('admin/deletion-requests')
export class AdminDeletionRequestsController {
  constructor(
    private readonly adminDeletionRequestsService: AdminDeletionRequestsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List member account deletion requests. Admin and staff only.',
  })
  getAllDeletionRequests(@Query('status') status?: string) {
    return this.adminDeletionRequestsService.getAll(status);
  }

  @Patch(':id/approve')
  @ApiOperation({
    summary:
      'Approve a pending member account deletion request. Admin and staff only.',
  })
  approveDeletionRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewDeletionRequestDto,
  ) {
    return this.adminDeletionRequestsService.approve(
      id,
      user.sub,
      dto.reviewNotes,
    );
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary:
      'Reject a pending member account deletion request. Admin and staff only.',
  })
  rejectDeletionRequest(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ReviewDeletionRequestDto,
  ) {
    return this.adminDeletionRequestsService.reject(
      id,
      user.sub,
      dto.reviewNotes,
    );
  }
}
