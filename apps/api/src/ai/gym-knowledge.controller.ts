import {
  Body,
  Controller,
  Get,
  Patch,
  ParseArrayPipe,
  Post,
  Put,
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

import { Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { PaginationDTO } from '../user/dto/user-dto';
import {
  CreateGymFaqEntryDTO,
  CreateGymSpecialScheduleDTO,
  GymFaqEntryResponseDTO,
  GymProfileResponseDTO,
  GymOperatingHourResponseDTO,
  GymSpecialScheduleResponseDTO,
  UpdateGymProfileDTO,
  UpsertGymOperatingHoursDTO,
} from './dto/gym-knowledge.dto';
import { GymKnowledgeService } from './gym-knowledge.service';

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

function arrayEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: schemaRef },
      },
    },
    required: ['data'],
  };
}

function apiEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: schemaRef },
    },
    required: ['data'],
  };
}

function paginatedEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: schemaRef },
      },
      meta: paginationMetaSchema,
    },
    required: ['data', 'meta'],
  };
}

@ApiTags('Gym Chat Knowledge')
@ApiExtraModels(
  GymOperatingHourResponseDTO,
  GymSpecialScheduleResponseDTO,
  GymFaqEntryResponseDTO,
  GymProfileResponseDTO,
)
@Controller('gym-chat/knowledge')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@ApiBearerAuth('access-token')
export class GymKnowledgeController {
  constructor(private readonly gymKnowledgeService: GymKnowledgeService) {}

  @Get('profile')
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({
    summary: 'Get the shared gym profile snapshot for admin surfaces.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gym profile returned.',
    schema: apiEnvelopeSchema(getSchemaPath(GymProfileResponseDTO)),
  })
  getGymProfile() {
    return this.gymKnowledgeService.getGymProfile();
  }

  @Put('profile')
  @ApiOperation({
    summary: 'Replace the shared gym profile snapshot. Admin only.',
  })
  @ApiBody({ type: UpdateGymProfileDTO })
  @ApiResponse({
    status: 200,
    description: 'Gym profile updated.',
    schema: apiEnvelopeSchema(getSchemaPath(GymProfileResponseDTO)),
  })
  updateGymProfile(@Body() dto: UpdateGymProfileDTO) {
    return this.gymKnowledgeService.updateGymProfile(dto);
  }

  @Get('hours')
  @ApiOperation({ summary: 'List active gym operating hours. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Operating hours returned.',
    schema: arrayEnvelopeSchema(getSchemaPath(GymOperatingHourResponseDTO)),
  })
  getOperatingHours() {
    return this.gymKnowledgeService.getOperatingHours();
  }

  @Put('hours')
  @ApiOperation({
    summary:
      'Replace the authoritative weekly gym operating hours. Admin only.',
  })
  @ApiBody({
    type: UpsertGymOperatingHoursDTO,
    isArray: true,
    description: 'Full weekly operating-hours snapshot.',
  })
  @ApiResponse({
    status: 200,
    description: 'Operating hours replaced.',
    schema: arrayEnvelopeSchema(getSchemaPath(GymOperatingHourResponseDTO)),
  })
  replaceOperatingHours(
    @Body(
      new ParseArrayPipe({
        items: UpsertGymOperatingHoursDTO,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    dto: UpsertGymOperatingHoursDTO[],
  ) {
    return this.gymKnowledgeService.replaceOperatingHours(dto);
  }

  @Get('special-schedules')
  @ApiOperation({ summary: 'List active gym special schedules. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Special schedules returned.',
    schema: paginatedEnvelopeSchema(
      getSchemaPath(GymSpecialScheduleResponseDTO),
    ),
  })
  getSpecialSchedules(@Query() dto: PaginationDTO) {
    return this.gymKnowledgeService.getSpecialSchedules(dto);
  }

  @Post('special-schedules')
  @ApiOperation({ summary: 'Create a gym special schedule. Admin only.' })
  @ApiResponse({
    status: 201,
    description: 'Special schedule created.',
    schema: apiEnvelopeSchema(getSchemaPath(GymSpecialScheduleResponseDTO)),
  })
  createSpecialSchedule(@Body() dto: CreateGymSpecialScheduleDTO) {
    return this.gymKnowledgeService.createSpecialSchedule(dto);
  }

  @Get('faqs')
  @ApiOperation({ summary: 'List active gym FAQ entries. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'FAQ entries returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(GymFaqEntryResponseDTO)),
  })
  getFaqEntries(@Query() dto: PaginationDTO) {
    return this.gymKnowledgeService.getFaqEntries(dto);
  }

  @Post('faqs')
  @ApiOperation({ summary: 'Create a gym FAQ entry. Admin only.' })
  @ApiResponse({
    status: 201,
    description: 'FAQ entry created.',
    schema: apiEnvelopeSchema(getSchemaPath(GymFaqEntryResponseDTO)),
  })
  createFaqEntry(@Body() dto: CreateGymFaqEntryDTO) {
    return this.gymKnowledgeService.createFaqEntry(dto);
  }
}
