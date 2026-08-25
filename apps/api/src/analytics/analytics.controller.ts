import {
  Body,
  Controller,
  Get,
  HttpCode,
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
  ApiProduces,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';

import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AnalyticsPdfExportService } from './analytics-pdf-export.service';
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsAttendanceResponseDTO,
  AnalyticsAttendancePeakHourDTO,
  AnalyticsAttendanceSeriesPointDTO,
  AnalyticsCoachBreakdownDTO,
  AnalyticsCoachesResponseDTO,
  AnalyticsDailyInsightsDTO,
  AnalyticsMembersResponseDTO,
  AnalyticsOverviewResponseDTO,
  AnalyticsPerformanceKpisDTO,
  AnalyticsQueryDTO,
  AnalyticsRecentActivityDTO,
  AnalyticsRevenueResponseDTO,
  AnalyticsRevenueSeriesPointDTO,
  AnalyticsRevenueTotalsDTO,
  AnalyticsSnapshotResponseDTO,
  ExportAnalyticsPdfDTO,
  AnalyticsSystemAlertDTO,
  AnalyticsTopRevenueSourceDTO,
} from './dto/analytics.dto';

function apiEnvelopeSchema(schemaRef: string) {
  return {
    type: 'object',
    properties: {
      data: { $ref: schemaRef },
    },
    required: ['data'],
  };
}

@ApiTags('Analytics')
@ApiExtraModels(
  AnalyticsAttendanceResponseDTO,
  AnalyticsAttendancePeakHourDTO,
  AnalyticsAttendanceSeriesPointDTO,
  AnalyticsCoachBreakdownDTO,
  AnalyticsCoachesResponseDTO,
  AnalyticsDailyInsightsDTO,
  AnalyticsMembersResponseDTO,
  AnalyticsOverviewResponseDTO,
  AnalyticsPerformanceKpisDTO,
  AnalyticsRecentActivityDTO,
  AnalyticsRevenueResponseDTO,
  AnalyticsRevenueTotalsDTO,
  AnalyticsRevenueSeriesPointDTO,
  AnalyticsSnapshotResponseDTO,
  AnalyticsSystemAlertDTO,
  AnalyticsTopRevenueSourceDTO,
)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly analyticsPdfExportService: AnalyticsPdfExportService,
  ) {}

  @Get('snapshot')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Get the merged analytics dashboard snapshot. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics snapshot returned.',
    schema: apiEnvelopeSchema(getSchemaPath(AnalyticsSnapshotResponseDTO)),
  })
  getSnapshot() {
    return this.analyticsService.getSnapshot();
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get analytics overview KPIs. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Analytics overview returned.',
    schema: apiEnvelopeSchema(getSchemaPath(AnalyticsOverviewResponseDTO)),
  })
  getOverview(@Query() dto: AnalyticsQueryDTO) {
    return this.analyticsService.getOverview(dto);
  }

  @Get('revenue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get analytics revenue breakdown. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Analytics revenue breakdown returned.',
    schema: apiEnvelopeSchema(getSchemaPath(AnalyticsRevenueResponseDTO)),
  })
  getRevenue(@Query() dto: AnalyticsQueryDTO) {
    return this.analyticsService.getRevenue(dto);
  }

  @Get('attendance')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get analytics attendance trends. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Analytics attendance trends returned.',
    schema: apiEnvelopeSchema(getSchemaPath(AnalyticsAttendanceResponseDTO)),
  })
  getAttendance(@Query() dto: AnalyticsQueryDTO) {
    return this.analyticsService.getAttendance(dto);
  }

  @Get('members')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get analytics member counts. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Analytics member counts returned.',
    schema: apiEnvelopeSchema(getSchemaPath(AnalyticsMembersResponseDTO)),
  })
  getMembers(@Query() dto: AnalyticsQueryDTO) {
    return this.analyticsService.getMembers(dto);
  }

  @Get('coaches')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get analytics coach earnings. Admin only.' })
  @ApiResponse({
    status: 200,
    description: 'Analytics coach earnings returned.',
    schema: apiEnvelopeSchema(getSchemaPath(AnalyticsCoachesResponseDTO)),
  })
  getCoaches(@Query() dto: AnalyticsQueryDTO) {
    return this.analyticsService.getCoaches(dto);
  }

  @Post('export/pdf')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.admin)
  @ApiBearerAuth('access-token')
  @ApiProduces('application/pdf')
  @ApiBody({ type: ExportAnalyticsPdfDTO })
  @ApiOperation({
    summary:
      'Export the current analytics view as a PDF, optionally reusing a saved AI insight. Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Analytics PDF generated.',
    schema: {
      format: 'binary',
      type: 'string',
    },
  })
  async exportPdf(
    @Body() dto: ExportAnalyticsPdfDTO,
    @Res() response: Response,
  ) {
    const result = await this.analyticsPdfExportService.exportPdf(dto);
    response.setHeader('content-type', 'application/pdf');
    response.setHeader(
      'content-disposition',
      `attachment; filename="${result.fileName}"`,
    );
    response.setHeader('content-length', String(result.buffer.length));
    response.send(result.buffer);
  }
}
