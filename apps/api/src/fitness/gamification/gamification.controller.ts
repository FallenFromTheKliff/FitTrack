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

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ActiveMemberCardGuard } from '../../common/guards/active-member-card.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationDTO } from '../../user/dto/user-dto';
import {
  IntegritySummaryResponseDTO,
  LeaderboardEntryResponseDTO,
  MasteryFilterDTO,
  MilestoneListFilterDTO,
  MilestoneProgressResponseDTO,
  MuscleMasteryResponseDTO,
  ProgressionProfileResponseDTO,
  ProgressionSourceListFilterDTO,
  ProgressionSourceSummaryResponseDTO,
  RankingProfileResponseDTO,
  SeasonStandingResponseDTO,
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
        },
      },
    },
  };
}

@ApiTags('Fitness')
@ApiExtraModels(
  MuscleMasteryResponseDTO,
  LeaderboardEntryResponseDTO,
  ProgressionProfileResponseDTO,
  ProgressionSourceSummaryResponseDTO,
  RankingProfileResponseDTO,
  SeasonStandingResponseDTO,
  MilestoneProgressResponseDTO,
  IntegritySummaryResponseDTO,
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
    @Query() dto: MilestoneListFilterDTO,
  ) {
    return this.gamificationService.getMilestoneProgress(user.sub, dto);
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

  @Get('leaderboard')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the gym-wide XP leaderboard.' })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(LeaderboardEntryResponseDTO)),
  })
  listLeaderboard(@Query() dto: PaginationDTO) {
    return this.gamificationService.getLeaderboard(dto);
  }
}
