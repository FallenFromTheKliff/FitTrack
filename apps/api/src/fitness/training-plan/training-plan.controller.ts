import {
  Body,
  Controller,
  Delete,
  GoneException,
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
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationDTO } from '../../user/dto/user-dto';
import {
  CreateTrainingPlanDTO,
  TrainingPlanDetailResponseDTO,
  TrainingPlanExerciseResponseDTO,
  TrainingPlanScheduleDayResponseDTO,
  TrainingPlanSummaryResponseDTO,
} from './dto/training-plan.dto';
import { TrainingPlanService } from './training-plan.service';

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

function apiEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: schemaRef },
    },
    required: ['data'],
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
      meta: paginationMetaSchema,
    },
    required: ['data', 'meta'],
  };
}

@ApiTags('Fitness')
@ApiExtraModels(
  TrainingPlanSummaryResponseDTO,
  TrainingPlanDetailResponseDTO,
  TrainingPlanScheduleDayResponseDTO,
  TrainingPlanExerciseResponseDTO,
)
@Controller('fitness')
export class TrainingPlanController {
  constructor(private readonly trainingPlanService: TrainingPlanService) {}

  @Get('plans')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List the authenticated users training plans.' })
  @ApiResponse({
    status: 200,
    description: 'Training plans returned.',
    schema: paginatedEnvelopeSchema(
      getSchemaPath(TrainingPlanSummaryResponseDTO),
    ),
  })
  listPlans(@CurrentUser() user: JwtPayload, @Query() dto: PaginationDTO) {
    return this.trainingPlanService.listPlans(user.sub, dto);
  }

  @Get('plans/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary:
      'Get a single owned training plan with its schedule and exercises.',
  })
  @ApiResponse({
    status: 200,
    description: 'Training plan returned.',
    schema: apiEnvelopeSchema(getSchemaPath(TrainingPlanDetailResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Training plan not found.' })
  getPlanById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.trainingPlanService.getPlanById(user.sub, id);
  }

  @Post('plans')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateTrainingPlanDTO })
  @ApiOperation({ summary: 'Create a manual training plan.' })
  @ApiResponse({
    status: 201,
    description: 'Training plan created.',
    schema: apiEnvelopeSchema(getSchemaPath(TrainingPlanDetailResponseDTO)),
  })
  @ApiResponse({ status: 422, description: 'Invalid training plan input.' })
  createPlan(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTrainingPlanDTO,
  ) {
    return this.trainingPlanService.createPlan(user.sub, user.role, dto);
  }

  @Delete('plans/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Delete a training plan you own.' })
  @ApiResponse({ status: 200, description: 'Training plan deleted.' })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Training plan not found.' })
  async deletePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.trainingPlanService.deletePlan(user.sub, id);
    return { message: 'Training plan deleted.' };
  }

  @Post('plans/:id/assign')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Copy a coach-owned training plan to an actively related member.',
  })
  @ApiResponse({
    status: 201,
    description: 'Training plan assigned.',
    schema: apiEnvelopeSchema(getSchemaPath(TrainingPlanDetailResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Training plan not found.' })
  assignPlan(@Param('id', ParseUUIDPipe) id: string) {
    throw new GoneException(
      `Coach-user training plan assignment is no longer supported for plan ${id}.`,
    );
  }
}
