import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
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
import type { Response } from 'express';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { BusinessAnalyticsInsightService } from './business-analytics-insight.service';
import { BusinessAnalyticsInsightPdfExportService } from './business-analytics-insight-pdf-export.service';
import {
  BusinessInsightCompatibilityDTO,
  BusinessInsightCompatibilityResponseDTO,
  BusinessInsightFilterDTO,
  BusinessInsightRequesterProfileResponseDTO,
  BusinessInsightRequesterResponseDTO,
  BusinessInsightRunDetailResponseDTO,
  BusinessInsightRunSummaryResponseDTO,
  GenerateBusinessInsightDTO,
} from './dto/business-analytics-insight.dto';

import { ExportBusinessInsightPdfDTO } from './dto/business-analytics-insight.dto';

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
    private readonly businessAnalyticsInsightPdfExportService?: BusinessAnalyticsInsightPdfExportService,
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

  @Post('insights/:id/compatibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBody({ type: BusinessInsightCompatibilityDTO })
  @ApiOperation({
    summary: 'Check a saved insight against current analytics. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Saved insight compatibility returned.',
    schema: apiEnvelopeSchema(
      getSchemaPath(BusinessInsightCompatibilityResponseDTO),
    ),
  })
  async checkInsightCompatibility(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BusinessInsightCompatibilityDTO,
  ) {
    return {
      data: await this.businessAnalyticsInsightService.checkInsightCompatibility(
        id,
        dto,
      ),
    };
  }

  @Get('insights/:id/export/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiOperation({
    summary: 'Export a saved business insight snapshot as PDF. Admin only.',
  })
  async exportInsightPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    if (!this.businessAnalyticsInsightPdfExportService) {
      throw new Error('Business insight PDF export is not configured.');
    }
    const result =
      await this.businessAnalyticsInsightPdfExportService.exportInsightPdf(id);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="' + result.fileName + '"',
    );
    response.send(result.buffer);
  }

  @Post('insights/:id/export/pdf')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBody({ type: ExportBusinessInsightPdfDTO })
  @ApiOperation({
    summary:
      'Export a saved business insight PDF with optional previous-insight comparison. Admin only.',
  })
  async exportInsightPdfWithOptions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExportBusinessInsightPdfDTO,
    @Res() response: Response,
  ) {
    if (!this.businessAnalyticsInsightPdfExportService) {
      throw new Error('Business insight PDF export is not configured.');
    }
    const result =
      await this.businessAnalyticsInsightPdfExportService.exportInsightPdf(id, {
        comparePrevious: dto.compare_previous,
        previousInsightId: dto.previous_insight_run_id,
      });
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="' + result.fileName + '"',
    );
    response.send(result.buffer);
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
