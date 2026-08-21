import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Body, Patch } from '@nestjs/common';
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
import { ActiveMemberCardGuard } from '../../common/guards/active-member-card.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AchievementReviewResponseDTO,
  AdminMilestoneEvidenceFilterDTO,
  IntegritySummaryResponseDTO,
  LeaderboardEntryResponseDTO,
  LeaderboardFilterDTO,
  MasteryFilterDTO,
  MilestoneEvidenceSubmissionResponseDTO,
  MilestoneListFilterDTO,
  MilestoneProgressResponseDTO,
  MuscleLeaderboardFilterDTO,
  MuscleLeaderboardRowDTO,
  MuscleMasteryResponseDTO,
  ProgressionProfileResponseDTO,
  ProgressionSourceListFilterDTO,
  ProgressionSourceSummaryResponseDTO,
  RankingProfileResponseDTO,
  ReviewMilestoneEvidenceDTO,
  SeasonStandingResponseDTO,
  SeasonHistorySummaryDTO,
  SeasonTopPerformerFilterDTO,
  SubmitMilestoneEvidenceDTO,
  UpdateRankingProfileDTO,
} from './dto/gamification.dto';
import { GamificationService } from './gamification.service';

function arrayEnvelopeSchema(itemSchemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: itemSchemaRef },
      },
    },
  };
}

function paginatedEnvelopeSchema(itemSchemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: itemSchemaRef },
      },
      meta: {
        type: 'object',
        properties: {
          page: { type: 'number', example: 1 },
          limit: { type: 'number', example: 20 },
          total: { type: 'number', example: 1 },
          total_pages: { type: 'number', example: 1 },
          next_cursor: { type: 'string', nullable: true },
          snapshot: { type: 'string', format: 'date-time' },
        },
      },
    },
  };
}

@ApiTags('Fitness')
@ApiExtraModels(
  AchievementReviewResponseDTO,
  MuscleMasteryResponseDTO,
  MuscleLeaderboardRowDTO,
  LeaderboardEntryResponseDTO,
  ProgressionProfileResponseDTO,
  ProgressionSourceSummaryResponseDTO,
  RankingProfileResponseDTO,
  SeasonStandingResponseDTO,
  MilestoneProgressResponseDTO,
  MilestoneEvidenceSubmissionResponseDTO,
  IntegritySummaryResponseDTO,
  SeasonHistorySummaryDTO,
)
@Controller('fitness')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('progression-sources')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "List the authenticated user's recent progression source events.",
  })
  @ApiResponse({
    status: 200,
    description: 'Progression source events returned.',
    schema: paginatedEnvelopeSchema(
      getSchemaPath(ProgressionSourceSummaryResponseDTO),
    ),
  })
  listProgressionSources(
    @CurrentUser() user: JwtPayload,
    @Query() dto: ProgressionSourceListFilterDTO,
  ) {
    return this.gamificationService.listProgressionSources(user.sub, dto);
  }

  @Get('progression-profile')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Get the authenticated user's progression backbone summary.",
  })
  @ApiResponse({
    status: 200,
    description: 'Progression backbone summary returned.',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(ProgressionProfileResponseDTO) },
      },
    },
  })
  getProgressionProfile(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getProgressionProfile(user.sub);
  }

  @Get('ranking-profile')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Get the authenticated user's ranking visibility preferences.",
  })
  @ApiResponse({
    status: 200,
    description: 'Ranking profile returned.',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(RankingProfileResponseDTO) },
      },
    },
  })
  getRankingProfile(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getRankingProfile(user.sub);
  }

  @Patch('ranking-profile')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Update the authenticated user's ranking visibility preferences.",
  })
  @ApiResponse({
    status: 200,
    description: 'Ranking profile updated.',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(RankingProfileResponseDTO) },
      },
    },
  })
  updateRankingProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateRankingProfileDTO,
  ) {
    return this.gamificationService.updateRankingProfile(user.sub, dto);
  }

  @Get('season-standing')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: "Get the authenticated user's active season standing summary.",
  })
  @ApiResponse({
    status: 200,
    description: 'Active season standing returned.',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(SeasonStandingResponseDTO) },
      },
    },
  })
  getActiveSeasonStanding(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getActiveSeasonStanding(user.sub);
  }

  @Get('milestone-reviews')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List DB-backed achievement milestone reviews for operators.',
  })
  @ApiResponse({
    status: 200,
    description: 'Milestone review records returned.',
    schema: arrayEnvelopeSchema(getSchemaPath(AchievementReviewResponseDTO)),
  })
  listMilestoneReviews() {
    return this.gamificationService.listAchievementReviews();
  }

  @Get('milestone-evidence')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List member-submitted milestone proof for staff review.',
  })
  @ApiResponse({
    status: 200,
    description: 'Milestone evidence records returned.',
    schema: paginatedEnvelopeSchema(
      getSchemaPath(MilestoneEvidenceSubmissionResponseDTO),
    ),
  })
  listMilestoneEvidence(@Query() dto: AdminMilestoneEvidenceFilterDTO) {
    return this.gamificationService.listMilestoneEvidenceSubmissions(dto);
  }

  @Patch('milestone-evidence/:evidenceSubmissionId/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Approve or reject a submitted milestone proof item.',
  })
  @ApiResponse({
    status: 200,
    description: 'Milestone evidence reviewed.',
    schema: {
      type: 'object',
      properties: {
        data: {
          $ref: getSchemaPath(MilestoneEvidenceSubmissionResponseDTO),
        },
      },
    },
  })
  reviewMilestoneEvidence(
    @CurrentUser() user: JwtPayload,
    @Param('evidenceSubmissionId', ParseUUIDPipe)
    evidenceSubmissionId: string,
    @Body() dto: ReviewMilestoneEvidenceDTO,
  ) {
    return this.gamificationService.reviewMilestoneEvidence(
      user.sub,
      evidenceSubmissionId,
      dto,
    );
  }

  @Get('milestones')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "List the authenticated user's milestone progress for the backbone MVP.",
  })
  @ApiResponse({
    status: 200,
    description: 'Milestone progress returned.',
    schema: arrayEnvelopeSchema(getSchemaPath(MilestoneProgressResponseDTO)),
  })
  listMilestones(
    @CurrentUser() user: JwtPayload,
    @Query() dto?: MilestoneListFilterDTO,
  ) {
    return dto
      ? this.gamificationService.getMilestoneProgress(user.sub, dto)
      : this.gamificationService.getMilestoneProgress(user.sub);
  }

  @Post('milestones/:milestoneDefinitionId/claim')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Claim an unlocked milestone for the authenticated user.',
  })
  @ApiResponse({
    status: 201,
    description: 'Milestone claimed.',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(MilestoneProgressResponseDTO) },
      },
    },
  })
  claimMilestone(
    @CurrentUser() user: JwtPayload,
    @Param('milestoneDefinitionId', ParseUUIDPipe)
    milestoneDefinitionId: string,
  ) {
    return this.gamificationService.claimMilestone(
      user.sub,
      milestoneDefinitionId,
    );
  }

  @Post('milestones/:milestoneDefinitionId/evidence')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Submit image or MP4 evidence for a manual milestone.',
  })
  @ApiResponse({
    status: 201,
    description: 'Milestone evidence submitted for review.',
    schema: {
      type: 'object',
      properties: {
        data: {
          $ref: getSchemaPath(MilestoneEvidenceSubmissionResponseDTO),
        },
      },
    },
  })
  submitMilestoneEvidence(
    @CurrentUser() user: JwtPayload,
    @Param('milestoneDefinitionId', ParseUUIDPipe)
    milestoneDefinitionId: string,
    @Body() dto: SubmitMilestoneEvidenceDTO,
  ) {
    return this.gamificationService.submitMilestoneEvidence(
      user.sub,
      milestoneDefinitionId,
      dto,
    );
  }

  @Get('integrity-summary')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      "Get the authenticated user's integrity summary for progression governance.",
  })
  @ApiResponse({
    status: 200,
    description: 'Integrity summary returned.',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(IntegritySummaryResponseDTO) },
      },
    },
  })
  getIntegritySummary(@CurrentUser() user: JwtPayload) {
    return this.gamificationService.getIntegritySummary(user.sub);
  }

  @Get('mastery')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List the authenticated users muscle mastery progress.',
  })
  @ApiResponse({
    status: 200,
    description: 'Muscle mastery progress returned.',
    schema: arrayEnvelopeSchema(getSchemaPath(MuscleMasteryResponseDTO)),
  })
  listMastery(@CurrentUser() user: JwtPayload, @Query() dto: MasteryFilterDTO) {
    return this.gamificationService.getMuscleMastery(user.sub, dto);
  }

  @Get('muscle-leaderboard')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List lifetime or season-scoped EXP ranking for one muscle.',
  })
  @ApiResponse({
    status: 200,
    schema: paginatedEnvelopeSchema(getSchemaPath(MuscleLeaderboardRowDTO)),
  })
  listMuscleLeaderboard(
    @CurrentUser() user: JwtPayload,
    @Query() dto: MuscleLeaderboardFilterDTO,
  ) {
    return this.gamificationService.listMuscleLeaderboard(dto, user.sub);
  }

  @Get('season-history')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List closed season history with top-three or top-ten performers.',
  })
  @ApiResponse({
    status: 200,
    schema: arrayEnvelopeSchema(getSchemaPath(SeasonHistorySummaryDTO)),
  })
  listSeasonHistory(@Query() dto: SeasonTopPerformerFilterDTO) {
    return this.gamificationService.listSeasonHistory(dto);
  }

  @Get('leaderboard')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the gym-wide XP leaderboard.' })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(LeaderboardEntryResponseDTO)),
  })
  listLeaderboard(@Query() dto: LeaderboardFilterDTO) {
    return this.gamificationService.getLeaderboard(dto);
  }
}
