import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DateRangeDTO } from '../../user/dto/user-dto';
import {
  ExerciseLogPoseSessionResponseDTO,
  ExerciseLogResponseDTO,
  LogExerciseSetDTO,
  StartSessionDTO,
  WorkoutSessionDetailResponseDTO,
  WorkoutSessionPlanSummaryResponseDTO,
  WorkoutSessionSummaryResponseDTO,
} from './dto/session.dto';
import { WorkoutSessionService } from './session.service';

const paginationMetaSchema = {
  type: 'object',
  properties: {
    page: { type: 'number', example: 1 },
    limit: { type: 'number', example: 20 },
    total: { type: 'number', example: 1 },
    total_pages: { type: 'number', example: 1 },
  },
  required: ['page', 'limit', 'total', 'total_pages'],
};

function apiEnvelopeSchema(dataRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: dataRef },
    },
    required: ['data'],
  };
}

function paginatedEnvelopeSchema(dataRef: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: dataRef },
      },
      meta: paginationMetaSchema,
    },
    required: ['data', 'meta'],
  };
}

@ApiTags('Fitness')
@ApiExtraModels(
  WorkoutSessionPlanSummaryResponseDTO,
  ExerciseLogPoseSessionResponseDTO,
  ExerciseLogResponseDTO,
  WorkoutSessionSummaryResponseDTO,
  WorkoutSessionDetailResponseDTO,
)
@Controller('fitness')
export class WorkoutSessionController {
  constructor(private readonly workoutSessionService: WorkoutSessionService) {}

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the authenticated users workout sessions.' })
  @ApiResponse({
    status: 200,
    description: 'Workout sessions returned.',
    schema: paginatedEnvelopeSchema(
      getSchemaPath(WorkoutSessionSummaryResponseDTO),
    ),
  })
  listSessions(@CurrentUser() user: JwtPayload, @Query() dto: DateRangeDTO) {
    return this.workoutSessionService.listSessions(user.sub, dto);
  }

  @Get('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get a single owned workout session with all logged sets.',
  })
  @ApiResponse({
    status: 200,
    description: 'Workout session returned.',
    schema: apiEnvelopeSchema(getSchemaPath(WorkoutSessionDetailResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Workout session not found.' })
  getSessionById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workoutSessionService.getSessionById(user.sub, id);
  }

  @Post('sessions/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: StartSessionDTO })
  @ApiOperation({ summary: 'Start an in-progress workout session.' })
  @ApiResponse({
    status: 201,
    description: 'Workout session started.',
    schema: apiEnvelopeSchema(getSchemaPath(WorkoutSessionDetailResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Training plan not found.' })
  startSession(@CurrentUser() user: JwtPayload, @Body() dto: StartSessionDTO) {
    return this.workoutSessionService.startSession(user.sub, dto);
  }

  @Post('sessions/:id/sets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: LogExerciseSetDTO })
  @ApiOperation({ summary: 'Log one exercise set for an owned session.' })
  @ApiResponse({
    status: 201,
    description: 'Exercise set logged.',
    schema: apiEnvelopeSchema(getSchemaPath(ExerciseLogResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Workout session not found.' })
  @ApiResponse({ status: 409, description: 'Duplicate set input.' })
  @ApiResponse({ status: 422, description: 'Session or exercise is invalid.' })
  logSet(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: LogExerciseSetDTO,
  ) {
    return this.workoutSessionService.logSet(user.sub, id, dto);
  }

  @Post('sessions/:id/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Complete an owned in-progress workout session.' })
  @ApiResponse({
    status: 200,
    description: 'Workout session completed.',
    schema: apiEnvelopeSchema(getSchemaPath(WorkoutSessionDetailResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Workout session not found.' })
  @ApiResponse({ status: 422, description: 'Workout session is not active.' })
  completeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workoutSessionService.completeSession(user.sub, id);
  }

  @Post('sessions/:id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cancel an owned in-progress workout session.' })
  @ApiResponse({
    status: 200,
    description: 'Workout session cancelled.',
    schema: apiEnvelopeSchema(getSchemaPath(WorkoutSessionDetailResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Workout session not found.' })
  @ApiResponse({ status: 422, description: 'Workout session is not active.' })
  cancelSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.workoutSessionService.cancelSession(user.sub, id);
  }
}
