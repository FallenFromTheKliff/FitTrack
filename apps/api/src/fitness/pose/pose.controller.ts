import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
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
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  FinalizePoseSessionDTO,
  PoseProfileFilterDTO,
  PoseProfileResponseDTO,
  PoseSessionResponseDTO,
} from './dto/pose.dto';
import { PoseService } from './pose.service';

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

@ApiTags('Pose')
@ApiExtraModels(PoseSessionResponseDTO, PoseProfileResponseDTO)
@Controller('pose')
export class PoseController {
  constructor(private readonly poseService: PoseService) {}

  @Get('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get a single owned pose session summary.' })
  @ApiResponse({
    status: 200,
    description: 'Pose session returned.',
    schema: apiEnvelopeSchema(getSchemaPath(PoseSessionResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Pose session not found.' })
  getSessionById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.poseService.getPoseSessionById(user.sub, id);
  }

  @Post('sessions/:id/finalize')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: FinalizePoseSessionDTO })
  @ApiOperation({ summary: 'Finalize an owned pose session manually.' })
  @ApiResponse({
    status: 200,
    description: 'Pose session finalized.',
    schema: apiEnvelopeSchema(getSchemaPath(PoseSessionResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Pose session not found.' })
  finalizeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: FinalizePoseSessionDTO,
  ) {
    return this.poseService.finalizePoseSessionById(user.sub, id, dto);
  }

  @Get('profiles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List pose profiles. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Pose profiles returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(PoseProfileResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  listProfiles(@Query() dto: PoseProfileFilterDTO) {
    return this.poseService.listPoseProfiles(dto);
  }
}
