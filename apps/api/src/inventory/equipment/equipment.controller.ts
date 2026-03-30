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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PaginationDTO } from '../../user/dto/user-dto';
import {
  CreateEquipmentItemDTO,
  EquipmentItemDetailResponseDTO,
  EquipmentItemResponseDTO,
  EquipmentWriteOffDTO,
  EquipmentWriteOffResponseDTO,
  UpdateEquipmentItemDTO,
} from './dto/equipment.dto';
import { EquipmentService } from './equipment.service';

function apiEnvelopeSchema(ref: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: ref },
    },
  };
}

function paginatedEnvelopeSchema(ref: string) {
  return {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { $ref: ref },
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

@ApiTags('Inventory')
@ApiExtraModels(
  EquipmentItemResponseDTO,
  EquipmentItemDetailResponseDTO,
  EquipmentWriteOffResponseDTO,
)
@Controller('inventory')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get('equipment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'List equipment items. Admin and staff only.' })
  @ApiResponse({
    status: 200,
    description: 'Equipment items returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(EquipmentItemResponseDTO)),
  })
  listEquipment(@Query() dto: PaginationDTO) {
    return this.equipmentService.listEquipmentItems(dto);
  }

  @Get('equipment/:id/writeoffs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'List equipment write-off history. Admin and staff only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Equipment write-off history returned.',
    schema: paginatedEnvelopeSchema(
      getSchemaPath(EquipmentWriteOffResponseDTO),
    ),
  })
  @ApiResponse({ status: 404, description: 'Equipment item not found.' })
  listWriteOffHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() dto: PaginationDTO,
  ) {
    return this.equipmentService.getWriteOffHistory(id, dto);
  }

  @Get('equipment/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get a single equipment item with write-off history.',
  })
  @ApiResponse({
    status: 200,
    description: 'Equipment item returned.',
    schema: apiEnvelopeSchema(getSchemaPath(EquipmentItemDetailResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Equipment item not found.' })
  getEquipmentById(@Param('id', ParseUUIDPipe) id: string) {
    return this.equipmentService.getEquipmentItemById(id);
  }

  @Post('equipment')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: CreateEquipmentItemDTO })
  @ApiOperation({ summary: 'Create an equipment item. Admin only.' })
  @ApiResponse({
    status: 201,
    description: 'Equipment item created.',
    schema: apiEnvelopeSchema(getSchemaPath(EquipmentItemResponseDTO)),
  })
  @ApiResponse({ status: 422, description: 'Invalid equipment quantities.' })
  createEquipment(@Body() dto: CreateEquipmentItemDTO) {
    return this.equipmentService.createEquipmentItem(dto);
  }

  @Patch('equipment/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: UpdateEquipmentItemDTO })
  @ApiOperation({ summary: 'Update an equipment item. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Equipment item updated.',
    schema: apiEnvelopeSchema(getSchemaPath(EquipmentItemResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Equipment item not found.' })
  updateEquipment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEquipmentItemDTO,
  ) {
    return this.equipmentService.updateEquipmentItem(id, dto);
  }

  @Post('equipment/:id/writeoff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiBearerAuth('access-token')
  @ApiBody({ type: EquipmentWriteOffDTO })
  @ApiOperation({
    summary: 'Write off equipment quantity. Admin and staff only.',
  })
  @ApiResponse({
    status: 201,
    description: 'Equipment write-off recorded.',
    schema: apiEnvelopeSchema(getSchemaPath(EquipmentWriteOffResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Equipment item not found.' })
  @ApiResponse({ status: 422, description: 'Invalid write-off quantity.' })
  writeOffEquipment(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: EquipmentWriteOffDTO,
  ) {
    return this.equipmentService.writeOffEquipment(user.sub, id, dto);
  }
}
