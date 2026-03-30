import { Controller, Get, Query, UseGuards } from '@nestjs/common';
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
import { AnalyticsService } from './analytics.service';
import {
  AnalyticsAttendanceResponseDTO,
  AnalyticsCoachBreakdownDTO,
  AnalyticsCoachesResponseDTO,
  AnalyticsMembersResponseDTO,
  AnalyticsAttendanceSeriesPointDTO,
  AnalyticsOverviewResponseDTO,
  AnalyticsQueryDTO,
  AnalyticsRevenueResponseDTO,
  AnalyticsRevenueSeriesPointDTO,
  AnalyticsRevenueTotalsDTO,
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
  AnalyticsAttendanceSeriesPointDTO,
  AnalyticsCoachBreakdownDTO,
  AnalyticsCoachesResponseDTO,
  AnalyticsMembersResponseDTO,
  AnalyticsOverviewResponseDTO,
  AnalyticsRevenueResponseDTO,
  AnalyticsRevenueTotalsDTO,
  AnalyticsRevenueSeriesPointDTO,
)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
}
