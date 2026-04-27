import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import {
  AdminCreatorStateDTO,
  AdminCreatorStateResponseDTO,
  AdminGamificationOverviewResponseDTO,
  AdminGrantModerationDTO,
  AdminIntegrityCaseResponseDTO,
  AdminProgressionGrantResponseDTO,
  AdminRankingOverrideDTO,
  AdminRankingOverrideResponseDTO,
  AdminSeasonGovernanceResponseDTO,
  AdminSeasonStatusDTO,
  CreateIntegrityCaseDTO,
  ResolveIntegrityCaseDTO,
} from './dto/gamification.dto';
import { GamificationService } from './gamification.service';

function singleEnvelopeSchema(itemSchemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: {
        $ref: itemSchemaRef,
      },
    },
  };
}

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@ApiExtraModels(
  AdminGamificationOverviewResponseDTO,
  AdminSeasonGovernanceResponseDTO,
  AdminCreatorStateResponseDTO,
  AdminProgressionGrantResponseDTO,
  AdminRankingOverrideResponseDTO,
  AdminIntegrityCaseResponseDTO,
)
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller('admin/gamification')
export class GamificationAdminController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('overview')
  @ApiOperation({
    summary: 'Load the admin gamification governance overview.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin gamification overview loaded.',
    schema: singleEnvelopeSchema(
      getSchemaPath(AdminGamificationOverviewResponseDTO),
    ),
  })
  getOverview() {
    return this.gamificationService.getAdminOverview();
  }

  @Patch('seasons/:seasonId/status')
  @ApiOperation({
    summary: 'Move a gamification season through the admin lifecycle.',
  })
  @ApiResponse({
    status: 200,
    description: 'Season lifecycle status updated.',
    schema: singleEnvelopeSchema(
      getSchemaPath(AdminSeasonGovernanceResponseDTO),
    ),
  })
  updateSeasonStatus(
    @Param('seasonId', ParseUUIDPipe) seasonId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminSeasonStatusDTO,
  ) {
    return this.gamificationService.adminUpdateSeasonStatus(
      user.sub,
      seasonId,
      dto,
    );
  }

  @Patch('creators/:userId')
  @ApiOperation({
    summary: 'Update a member creator-governance state.',
  })
  @ApiResponse({
    status: 200,
    description: 'Creator governance state updated.',
    schema: singleEnvelopeSchema(getSchemaPath(AdminCreatorStateResponseDTO)),
  })
  updateCreatorState(
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminCreatorStateDTO,
  ) {
    return this.gamificationService.adminUpdateCreatorState(
      user.sub,
      targetUserId,
      dto,
    );
  }

  @Patch('progression-grants/:grantId/void')
  @ApiOperation({
    summary: 'Void a progression grant and record the moderation action.',
  })
  @ApiResponse({
    status: 200,
    description: 'Progression grant voided.',
    schema: singleEnvelopeSchema(
      getSchemaPath(AdminProgressionGrantResponseDTO),
    ),
  })
  voidProgressionGrant(
    @Param('grantId', ParseUUIDPipe) grantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminGrantModerationDTO,
  ) {
    return this.gamificationService.adminVoidProgressionGrant(
      user.sub,
      grantId,
      dto,
    );
  }

  @Patch('progression-grants/:grantId/restore')
  @ApiOperation({
    summary: 'Restore a previously voided progression grant.',
  })
  @ApiResponse({
    status: 200,
    description: 'Progression grant restored.',
    schema: singleEnvelopeSchema(
      getSchemaPath(AdminProgressionGrantResponseDTO),
    ),
  })
  restoreProgressionGrant(
    @Param('grantId', ParseUUIDPipe) grantId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminGrantModerationDTO,
  ) {
    return this.gamificationService.adminRestoreProgressionGrant(
      user.sub,
      grantId,
      dto,
    );
  }

  @Patch('ranking/:userId')
  @ApiOperation({
    summary: 'Apply an admin ranking override to a member profile.',
  })
  @ApiResponse({
    status: 200,
    description: 'Ranking override applied.',
    schema: singleEnvelopeSchema(
      getSchemaPath(AdminRankingOverrideResponseDTO),
    ),
  })
  applyRankingOverride(
    @Param('userId', ParseUUIDPipe) targetUserId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminRankingOverrideDTO,
  ) {
    return this.gamificationService.adminApplyRankingOverride(
      user.sub,
      targetUserId,
      dto,
    );
  }

  @Post('integrity-cases')
  @ApiOperation({
    summary: 'Create a new integrity case and its initial integrity event.',
  })
  @ApiResponse({
    status: 201,
    description: 'Integrity case created.',
    schema: singleEnvelopeSchema(getSchemaPath(AdminIntegrityCaseResponseDTO)),
  })
  createIntegrityCase(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateIntegrityCaseDTO,
  ) {
    return this.gamificationService.adminCreateIntegrityCase(user.sub, dto);
  }

  @Patch('integrity-cases/:caseId/resolve')
  @ApiOperation({
    summary: 'Resolve an integrity case through an explicit moderation action.',
  })
  @ApiResponse({
    status: 200,
    description: 'Integrity case resolved.',
    schema: singleEnvelopeSchema(getSchemaPath(AdminIntegrityCaseResponseDTO)),
  })
  resolveIntegrityCase(
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: ResolveIntegrityCaseDTO,
  ) {
    return this.gamificationService.adminResolveIntegrityCase(
      user.sub,
      caseId,
      dto,
    );
  }
}
