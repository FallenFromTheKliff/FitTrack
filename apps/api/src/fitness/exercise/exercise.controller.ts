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

import { Roles } from '../../common/decorators';
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
  CreateMuscleDefinitionDTO,
  ExerciseResponseDTO,
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

  @Get('member/muscle-definitions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.member)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List active muscle definitions for member mastery filters.',
  })
  @ApiResponse({
    status: 200,
    description: 'Active muscle definitions returned.',
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
  listMemberMuscleDefinitions() {
    return this.exerciseService.listMemberMuscleDefinitions();
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

}
