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

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { CurrentUser, Roles } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ExerciseService } from './exercise.service';
import {
  CreateMuscleDefinitionDTO,
  CreateExerciseDTO,
  ExerciseFilterDTO,
  ExerciseResponseDTO,
  MuscleDefinitionFilterDTO,
  MuscleDefinitionResponseDTO,
  UpdateMuscleDefinitionDTO,
  UpdateExerciseDTO,
} from './dto/exercise.dto';
import {
  CreateExerciseDraftProposalDTO,
  CreateExerciseReviewSubmissionDTO,
  ExerciseDraftProposalResponseDTO,
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
@ApiExtraModels(
  CreateExerciseDraftProposalDTO,
  CreateMuscleDefinitionDTO,
  CreateExerciseReviewSubmissionDTO,
  ExerciseDraftProposalResponseDTO,
  ExerciseResponseDTO,
  ExerciseReviewSubmissionResponseDTO,
  MuscleDefinitionResponseDTO,
)
@Controller('fitness')
export class ExerciseController {
  constructor(private readonly exerciseService: ExerciseService) {}

  @Get('muscle-definitions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List canonical muscle definitions for exercise authoring.',
  })
  @ApiResponse({
    status: 200,
    description: 'Muscle definitions returned.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(MuscleDefinitionResponseDTO) },
        },
      },
    },
  })
  listMuscleDefinitions(@Query() dto: MuscleDefinitionFilterDTO) {
    return this.exerciseService.listMuscleDefinitions(dto);
  }

  @Post('muscle-definitions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateMuscleDefinitionDTO })
  @ApiOperation({ summary: 'Create a custom muscle definition.' })
  @ApiResponse({
    status: 201,
    description: 'Muscle definition created.',
    schema: apiEnvelopeSchema(getSchemaPath(MuscleDefinitionResponseDTO)),
  })
  createMuscleDefinition(@Body() dto: CreateMuscleDefinitionDTO) {
    return this.exerciseService.createMuscleDefinition(dto);
  }

  @Patch('muscle-definitions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateMuscleDefinitionDTO })
  @ApiOperation({ summary: 'Update a muscle definition.' })
  @ApiResponse({
    status: 200,
    description: 'Muscle definition updated.',
    schema: apiEnvelopeSchema(getSchemaPath(MuscleDefinitionResponseDTO)),
  })
  updateMuscleDefinition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMuscleDefinitionDTO,
  ) {
    return this.exerciseService.updateMuscleDefinition(id, dto);
  }

  @Patch('muscle-definitions/:id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Archive a muscle definition.' })
  @ApiResponse({
    status: 200,
    description: 'Muscle definition archived.',
    schema: apiEnvelopeSchema(getSchemaPath(MuscleDefinitionResponseDTO)),
  })
  archiveMuscleDefinition(@Param('id', ParseUUIDPipe) id: string) {
    return this.exerciseService.archiveMuscleDefinition(id);
  }

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

  @Post('exercises/custom')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.member, UserRole.coach)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateExerciseDTO })
  @ApiOperation({
    summary:
      'Create a custom exercise that can be used immediately in workout presets.',
  })
  @ApiResponse({
    status: 201,
    description: 'Custom exercise created.',
    schema: apiEnvelopeSchema(getSchemaPath(ExerciseResponseDTO)),
  })
  @ApiResponse({ status: 409, description: 'Exercise name already exists.' })
  createCustomExercise(@Body() dto: CreateExerciseDTO) {
    return this.exerciseService.createExercise({
      ...dto,
      description:
        dto.description?.trim() ||
        'Custom exercise created from the workout preset builder.',
    });
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

  @Post('exercise-review-submissions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateExerciseReviewSubmissionDTO })
  @ApiOperation({
    summary:
      'Submit a member-created exercise draft from a live mobile pose session.',
  })
  @ApiResponse({
    status: 201,
    description: 'Review submission created.',
    schema: apiEnvelopeSchema(
      getSchemaPath(ExerciseReviewSubmissionResponseDTO),
    ),
  })
  @ApiResponse({
    status: 403,
    description: 'User cannot submit exercise drafts.',
  })
  createReviewSubmission(
    @Body() dto: CreateExerciseReviewSubmissionDTO,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.exerciseService.createReviewSubmission(dto, user.sub);
  }

  @Post('exercise-draft-proposals')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateExerciseDraftProposalDTO })
  @ApiOperation({
    summary:
      'Generate a safe exercise draft proposal from mobile pose evidence.',
  })
  @ApiResponse({
    status: 201,
    description: 'Draft proposal generated.',
    schema: apiEnvelopeSchema(getSchemaPath(ExerciseDraftProposalResponseDTO)),
  })
  @ApiResponse({
    status: 403,
    description: 'User cannot generate exercise drafts.',
  })
  createExerciseDraftProposal(
    @Body() dto: CreateExerciseDraftProposalDTO,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.exerciseService.createExerciseDraftProposal(dto, user.sub);
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
    @CurrentUser() user: JwtPayload,
  ) {
    return this.exerciseService.updateReviewSubmission(id, dto, user.sub);
  }
}
