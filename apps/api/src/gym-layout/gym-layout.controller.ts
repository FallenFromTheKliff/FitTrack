import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import {
  CreateEquipmentDTO,
  FacilityFloorPlanMediaResponseDTO,
  GymLayoutEquipmentResponseDTO,
  UpdateFacilityFloorPlanMediaDTO,
  UpdateEquipmentDTO,
} from './dto/gym-layout.dto';
import { GymLayoutService } from './gym-layout.service';

function apiEnvelopeSchema(ref: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: ref },
    },
  };
}

function arrayEnvelopeSchema(ref: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: ref },
      },
    },
  };
}

@ApiTags('Gym Layout')
@ApiExtraModels(GymLayoutEquipmentResponseDTO, FacilityFloorPlanMediaResponseDTO)
@Controller('gym-layout')
export class GymLayoutController {
  constructor(private readonly gymLayoutService: GymLayoutService) {}

  @Get('equipment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List active equipment on the gym layout map.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gym layout equipment returned.',
    schema: arrayEnvelopeSchema(getSchemaPath(GymLayoutEquipmentResponseDTO)),
  })
  listEquipment() {
    return this.gymLayoutService.listEquipment();
  }

  @Get('equipment/archived')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List archived equipment from the gym layout map. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Archived gym layout equipment returned.',
    schema: arrayEnvelopeSchema(getSchemaPath(GymLayoutEquipmentResponseDTO)),
  })
  listArchivedEquipment() {
    return this.gymLayoutService.listArchivedEquipment();
  }

  @Get('floor-plans/media')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List persisted floor-plan media for the facility map.',
  })
  @ApiResponse({
    status: 200,
    description: 'Floor-plan media returned.',
    schema: arrayEnvelopeSchema(
      getSchemaPath(FacilityFloorPlanMediaResponseDTO),
    ),
  })
  listFloorPlanMedia() {
    return this.gymLayoutService.listFloorPlanMedia();
  }

  @Post('equipment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateEquipmentDTO })
  @ApiOperation({
    summary: 'Create a gym layout equipment record. Admin only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Gym layout equipment created.',
    schema: apiEnvelopeSchema(getSchemaPath(GymLayoutEquipmentResponseDTO)),
  })
  createEquipment(@Body() dto: CreateEquipmentDTO) {
    return this.gymLayoutService.createEquipment(dto);
  }

  @Patch('equipment/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateEquipmentDTO })
  @ApiOperation({
    summary: 'Update a gym layout equipment record. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gym layout equipment updated.',
    schema: apiEnvelopeSchema(getSchemaPath(GymLayoutEquipmentResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Equipment not found.' })
  updateEquipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipmentDTO,
  ) {
    return this.gymLayoutService.updateEquipment(id, dto);
  }

  @Patch('equipment/:id/restore')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Restore archived equipment to the gym layout map. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Gym layout equipment restored.',
    schema: apiEnvelopeSchema(getSchemaPath(GymLayoutEquipmentResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Equipment not found.' })
  restoreEquipment(@Param('id', ParseUUIDPipe) id: string) {
    return this.gymLayoutService.restoreEquipment(id);
  }

  @Patch('floor-plans/:floorId/media')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateFacilityFloorPlanMediaDTO })
  @ApiOperation({
    summary: 'Update the persisted image for a facility floor plan. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Floor-plan media updated.',
    schema: apiEnvelopeSchema(
      getSchemaPath(FacilityFloorPlanMediaResponseDTO),
    ),
  })
  updateFloorPlanMedia(
    @Param('floorId') floorId: string,
    @Body() dto: UpdateFacilityFloorPlanMediaDTO,
  ) {
    return this.gymLayoutService.updateFloorPlanMedia(floorId, dto);
  }

  @Delete('equipment/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Soft-delete a gym layout equipment record. Admin only.',
  })
  @ApiResponse({ status: 200, description: 'Gym layout equipment deleted.' })
  @ApiResponse({ status: 404, description: 'Equipment not found.' })
  async deleteEquipment(@Param('id', ParseUUIDPipe) id: string) {
    await this.gymLayoutService.deleteEquipment(id);
    return { message: 'Equipment deleted from gym layout.' };
  }
}
