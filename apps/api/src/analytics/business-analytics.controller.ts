import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BusinessAnalyticsInsightService } from './business-analytics-insight.service';
import {
  BusinessInsightFilterDTO,
  BusinessInsightRequesterProfileResponseDTO,
  BusinessInsightRequesterResponseDTO,
  BusinessInsightRunDetailResponseDTO,
  BusinessInsightRunSummaryResponseDTO,
  GenerateBusinessInsightDTO,
} from './dto/business-analytics-insight.dto';

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

@ApiTags('Business Analytics')
@ApiExtraModels(
  BusinessInsightRequesterProfileResponseDTO,
  BusinessInsightRequesterResponseDTO,
  BusinessInsightRunSummaryResponseDTO,
  BusinessInsightRunDetailResponseDTO,
)
@ApiBearerAuth('access-token')
@Controller('business-analytics')
export class BusinessAnalyticsController {
  constructor(
    private readonly businessAnalyticsInsightService: BusinessAnalyticsInsightService,
  ) {}

  @Post('insights')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBody({ type: GenerateBusinessInsightDTO })
  @ApiOperation({ summary: 'Generate AI business insights. Admin only.' })
  @ApiResponse({
    status: 201,
    description: 'Business insight generated.',
    schema: apiEnvelopeSchema(
      getSchemaPath(BusinessInsightRunDetailResponseDTO),
    ),
  })
  @ApiResponse({
    status: 502,
    description: 'AI business-insight generation returned an invalid payload.',
  })
  @ApiResponse({
    status: 503,
    description: 'AI business-insight generation is unavailable.',
  })
  generateInsight(
    @CurrentUser() user: JwtPayload,
    @Body() dto: GenerateBusinessInsightDTO,
  ) {
    return this.businessAnalyticsInsightService.generateInsight(user.sub, dto);
  }

  @Get('insights')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'List business insight runs. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Business insight history returned.',
    schema: paginatedEnvelopeSchema(
      getSchemaPath(BusinessInsightRunSummaryResponseDTO),
    ),
  })
  getInsightHistory(@Query() dto: BusinessInsightFilterDTO) {
    return this.businessAnalyticsInsightService.getInsightHistory(dto);
  }

  @Get('insights/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({ summary: 'Get one business insight run. Admin only.' })
  @ApiParam({
    name: 'id',
    type: String,
    format: 'uuid',
    example: '33333333-3333-4333-8333-333333333333',
    description: 'Business insight run id.',
  })
  @ApiResponse({
    status: 200,
    description: 'Business insight run returned.',
    schema: apiEnvelopeSchema(
      getSchemaPath(BusinessInsightRunDetailResponseDTO),
    ),
  })
  @ApiResponse({ status: 404, description: 'Business insight run not found.' })
  getInsightById(@Param('id', ParseUUIDPipe) id: string) {
    return this.businessAnalyticsInsightService.getInsightById(id);
  }
}
