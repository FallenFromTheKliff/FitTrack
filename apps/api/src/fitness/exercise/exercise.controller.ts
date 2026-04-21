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
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ExerciseService } from './exercise.service';
import {
  CreateExerciseDTO,
  ExerciseFilterDTO,
  ExerciseResponseDTO,
  UpdateExerciseDTO,
} from './dto/exercise.dto';
import {
  ExerciseReviewSubmissionFilterDTO,
  ExerciseReviewSubmissionResponseDTO,
  UpdateExerciseReviewSubmissionDTO,
} from './dto/exercise-review.dto';

function apiEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: schemaRef },
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
@ApiExtraModels(ExerciseResponseDTO, ExerciseReviewSubmissionResponseDTO)
@Controller('fitness')
export class ExerciseController {
  constructor(private readonly exerciseService: ExerciseService) {}

  @Get('exercises')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Browse active exercises.' })
  @ApiResponse({
    status: 200,
    description: 'Exercises returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(ExerciseResponseDTO)),
  })
  listExercises(@Query() dto: ExerciseFilterDTO) {
    return this.exerciseService.listExercises(dto);
  }

  @Get('exercises/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single active exercise.' })
  @ApiResponse({
    status: 200,
    description: 'Exercise returned.',
    schema: apiEnvelopeSchema(getSchemaPath(ExerciseResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Exercise not found.' })
  getExerciseById(@Param('id', ParseUUIDPipe) id: string) {
    return this.exerciseService.getExerciseById(id);
  }

  @Post('exercises')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateExerciseDTO })
  @ApiOperation({ summary: 'Create an exercise. Admin only.' })
  @ApiResponse({
    status: 201,
    description: 'Exercise created.',
    schema: apiEnvelopeSchema(getSchemaPath(ExerciseResponseDTO)),
  })
  @ApiResponse({ status: 409, description: 'Exercise name already exists.' })
  createExercise(@Body() dto: CreateExerciseDTO) {
    return this.exerciseService.createExercise(dto);
  }

  @Patch('exercises/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateExerciseDTO })
  @ApiOperation({ summary: 'Update or deactivate an exercise. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Exercise updated.',
    schema: apiEnvelopeSchema(getSchemaPath(ExerciseResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Exercise not found.' })
  @ApiResponse({ status: 409, description: 'Exercise name already exists.' })
  updateExercise(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseDTO,
  ) {
    return this.exerciseService.updateExercise(id, dto);
  }

  @Get('exercise-review-submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List custom exercise review submissions. Admin and staff only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Review submissions returned.',
    schema: paginatedEnvelopeSchema(
      getSchemaPath(ExerciseReviewSubmissionResponseDTO),
    ),
  })
  listReviewSubmissions(@Query() dto: ExerciseReviewSubmissionFilterDTO) {
    return this.exerciseService.listReviewSubmissions(dto);
  }

  @Patch('exercise-review-submissions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateExerciseReviewSubmissionDTO })
  @ApiOperation({
    summary:
      'Update the status of a custom exercise review submission. Admin and staff only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Review submission updated.',
    schema: apiEnvelopeSchema(
      getSchemaPath(ExerciseReviewSubmissionResponseDTO),
    ),
  })
  updateReviewSubmission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateExerciseReviewSubmissionDTO,
  ) {
    return this.exerciseService.updateReviewSubmission(id, dto);
  }
}
