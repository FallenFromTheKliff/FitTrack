import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
  AdminGamificationSeasonListItemDTO,
  AdminGrantModerationDTO,
  AdminIntegrityCaseResponseDTO,
  AdminManualExpGrantDTO,
  AdminProgressionGrantResponseDTO,
  AdminRankingOverrideDTO,
  AdminRankingOverrideResponseDTO,
  AdminSeasonStandingFilterDTO,
  AdminSeasonStandingRowDTO,
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
  AdminGamificationSeasonListItemDTO,
  AdminManualExpGrantDTO,
  AdminSeasonGovernanceResponseDTO,
  AdminSeasonStandingRowDTO,
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

  @Get('seasons')
  @ApiOperation({
    summary: 'List gamification seasons for admin filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gamification seasons loaded.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(AdminGamificationSeasonListItemDTO) },
        },
      },
    },
  })
  listSeasons() {
    return this.gamificationService.listAdminSeasons();
  }

  @Get('season-standings')
  @ApiOperation({
    summary: 'List all-season participant performance for admins.',
  })
  @ApiResponse({
    status: 200,
    description: 'Season standings loaded.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(AdminSeasonStandingRowDTO) },
        },
        meta: {
          type: 'object',
          properties: {
            page: { type: 'number', example: 1 },
            limit: { type: 'number', example: 20 },
            total: { type: 'number', example: 1 },
            total_pages: { type: 'number', example: 1 },
          },
        },
      },
    },
  })
  listSeasonStandings(@Query() dto: AdminSeasonStandingFilterDTO) {
    return this.gamificationService.listAdminSeasonStandings(dto);
  }

  @Post('manual-exp-grants')
  @ApiOperation({
    summary:
      'Manually allocate approved EXP for a non-camera or coach-verified session.',
  })
  @ApiResponse({
    status: 201,
    description: 'Manual EXP grant created.',
    schema: singleEnvelopeSchema(
      getSchemaPath(AdminProgressionGrantResponseDTO),
    ),
  })
  createManualExpGrant(
    @CurrentUser() user: JwtPayload,
    @Body() dto: AdminManualExpGrantDTO,
  ) {
    return this.gamificationService.adminCreateManualExpGrant(user.sub, dto);
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
