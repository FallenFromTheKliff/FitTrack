import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';

import { ActiveMemberCardGuard } from '../../common/guards/active-member-card.guard';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  DetectPoseEquipmentDTO,
  PoseEquipmentDetectionResponseDTO,
} from './dto/pose.dto';
import { PoseService } from './pose.service';

function apiEnvelopeSchema(dataRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: dataRef },
    },
    required: ['data'],
  };
}

type EquipmentFrameUpload = {
  buffer?: Buffer;
  mimetype?: string;
  originalname?: string;
  size?: number;
};

type EquipmentFrameUploadBody = {
  camera_facing_mode?: string;
  exercise_hint?: string;
};

@ApiTags('Workout Equipment')
@ApiExtraModels(PoseEquipmentDetectionResponseDTO)
@Controller('workout/equipment')
export class WorkoutEquipmentController {
  constructor(private readonly poseService: PoseService) {}

  @Post('detect')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: DetectPoseEquipmentDTO })
  @ApiOperation({
    summary:
      'Detect visible workout equipment through the configured local or hosted provider.',
  })
  @ApiResponse({
    status: 200,
    description: 'Equipment context returned.',
    schema: apiEnvelopeSchema(getSchemaPath(PoseEquipmentDetectionResponseDTO)),
  })
  detectEquipment(@Body() dto: DetectPoseEquipmentDTO) {
    return this.poseService.detectPoseEquipment(dto);
  }

  @Post('detect-file')
  @UseGuards(JwtAuthGuard, ActiveMemberCardGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 6 * 1024 * 1024,
      },
    }),
  )
  @HttpCode(200)
  @ApiBearerAuth('access-token')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        camera_facing_mode: {
          enum: ['user', 'environment'],
          nullable: true,
          type: 'string',
        },
        exercise_hint: {
          nullable: true,
          type: 'string',
        },
        file: {
          format: 'binary',
          type: 'string',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary:
      'Detect visible workout equipment from an uploaded mobile snapshot file.',
  })
  @ApiResponse({
    status: 200,
    description: 'Equipment context returned.',
    schema: apiEnvelopeSchema(getSchemaPath(PoseEquipmentDetectionResponseDTO)),
  })
  detectEquipmentFile(
    @UploadedFile() file: EquipmentFrameUpload | undefined,
    @Body() body: EquipmentFrameUploadBody,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException({
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Invalid Equipment Frame',
        status: 400,
        detail: 'A snapshot file is required.',
      });
    }

    const cameraFacingMode =
      body.camera_facing_mode === 'user' ||
      body.camera_facing_mode === 'environment'
        ? body.camera_facing_mode
        : undefined;

    return this.poseService.detectPoseEquipment({
      camera_facing_mode: cameraFacingMode,
      exercise_hint:
        typeof body.exercise_hint === 'string' ? body.exercise_hint : null,
      frame_b64: file.buffer.toString('base64'),
    });
  }
}
