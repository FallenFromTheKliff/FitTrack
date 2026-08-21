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
import { ActiveMemberCardGuard } from '../../common/guards/active-member-card.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  AnalyzePoseSequenceDTO,
  DetectPoseEquipmentDTO,
  PoseFrameAnalysisResponseDTO,
  FinalizePoseSessionDTO,
  PoseEquipmentDetectionResponseDTO,
  PoseProfileFilterDTO,
  PoseSessionBootstrapResponseDTO,
  PoseProfileResponseDTO,
  PoseSessionResponseDTO,
  StartPoseSessionDTO,
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
@ApiExtraModels(
  PoseSessionBootstrapResponseDTO,
  PoseFrameAnalysisResponseDTO,
  PoseEquipmentDetectionResponseDTO,
  PoseSessionResponseDTO,
  PoseProfileResponseDTO,
)
@Controller('pose')
export class PoseController {
  constructor(private readonly poseService: PoseService) {}

  @Post('sessions/start')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: StartPoseSessionDTO })
  @ApiOperation({ summary: 'Start an owned pose session.' })
  @ApiResponse({
    status: 201,
    description: 'Pose session started.',
    schema: apiEnvelopeSchema(getSchemaPath(PoseSessionBootstrapResponseDTO)),
  })
  startSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: StartPoseSessionDTO,
  ) {
    return this.poseService.startPoseSessionForUser(user.sub, dto);
  }

  @Get('sessions/:id')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
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

  @Post('sessions/:id/analyze')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: AnalyzePoseSequenceDTO })
  @ApiOperation({
    summary:
      'Analyze owned pose input for a session using either a keypoint sequence or a native frame snapshot.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pose input analyzed.',
    schema: apiEnvelopeSchema(getSchemaPath(PoseFrameAnalysisResponseDTO)),
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Pose session not found.' })
  analyzeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: AnalyzePoseSequenceDTO,
  ) {
    return this.poseService.analyzePoseSessionById(user.sub, id, dto);
  }

  @Post('equipment/analyze')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: DetectPoseEquipmentDTO })
  @ApiOperation({
    summary:
      'Detect visible workout equipment from a hosted provider without persisting the raw frame.',
  })
  @ApiResponse({
    status: 200,
    description: 'Equipment context returned.',
    schema: apiEnvelopeSchema(getSchemaPath(PoseEquipmentDetectionResponseDTO)),
  })
  detectEquipment(@Body() dto: DetectPoseEquipmentDTO) {
    return this.poseService.detectPoseEquipment(dto);
  }

  @Post('sessions/:id/finalize')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
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
