import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PaginationDTO } from '../../user/dto/user-dto';
import {
  LeaderboardEntryResponseDTO,
  MasteryFilterDTO,
  MuscleMasteryResponseDTO,
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
@ApiExtraModels(MuscleMasteryResponseDTO, LeaderboardEntryResponseDTO)
@Controller('fitness')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('mastery')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
