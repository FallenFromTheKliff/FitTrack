import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
  AuditActorProfileResponseDTO,
  AuditActorResponseDTO,
  AuditFilterDTO,
  AuditLogResponseDTO,
} from './dto/audit.dto';
import { AuditService } from './audit.service';

function apiEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: schemaRef },
    },
    required: ['data'],
  };
}

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

function paginatedEnvelopeSchema(itemSchemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { type: 'array', items: { $ref: itemSchemaRef } },
      meta: paginationMetaSchema,
    },
    required: ['data', 'meta'],
  };
}

@ApiTags('Audit')
@ApiExtraModels(
  AuditActorProfileResponseDTO,
  AuditActorResponseDTO,
  AuditLogResponseDTO,
)
@ApiBearerAuth('access-token')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({ summary: 'List audit logs. Admin/Staff only.' })
  @ApiResponse({
    status: 200,
    description: 'Audit logs returned.',
    schema: paginatedEnvelopeSchema(getSchemaPath(AuditLogResponseDTO)),
  })
  getAuditLogs(@Query() dto: AuditFilterDTO) {
    return this.auditService.getAuditLogs(dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.staff)
  @ApiOperation({ summary: 'Get one audit log entry. Admin/Staff only.' })
  @ApiResponse({
    status: 200,
    description: 'Audit log returned.',
    schema: apiEnvelopeSchema(getSchemaPath(AuditLogResponseDTO)),
  })
  @ApiResponse({ status: 404, description: 'Audit log not found.' })
  getAuditLogById(@Param('id', ParseUUIDPipe) id: string) {
    return this.auditService.getAuditLogById(id);
  }
}
