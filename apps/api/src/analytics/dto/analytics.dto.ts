import { IsArray, IsIn, IsISO8601, IsOptional } from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

import { IsOnOrAfter } from '../../common/validators';

export const ANALYTICS_PERIODS = [
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

export const ANALYTICS_PDF_SECTIONS = [
  'activities',
  'alerts',
  'attendance',
  'daily',
  'inventory',
  'kpis',
  'recommendations',
  'revenue',
] as const;

export type AnalyticsPdfSection = (typeof ANALYTICS_PDF_SECTIONS)[number];

export class AnalyticsQueryDTO {
  @ApiPropertyOptional({ example: '2025-01-01' })
  @IsOptional()
  @IsISO8601({}, { message: 'start_date must be a valid ISO 8601 date string' })
  start_date?: string;

  @ApiPropertyOptional({ example: '2025-01-31' })
  @IsOptional()
  @IsISO8601({}, { message: 'end_date must be a valid ISO 8601 date string' })
  @IsOnOrAfter('start_date', 'start_date', {
    message: 'end_date must be on or after start_date',
  })
  end_date?: string;

  @ApiPropertyOptional({
    enum: ANALYTICS_PERIODS,
    default: 'monthly',
    example: 'monthly',
  })
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS, {
    message: `period must be one of: ${ANALYTICS_PERIODS.join(', ')}`,
  })
  period?: AnalyticsPeriod = 'monthly';
}

export class ExportAnalyticsPdfDTO {
  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsISO8601(
    {},
    {
      message: 'revenue_start_date must be a valid ISO 8601 date string',
    },
  )
  revenue_start_date?: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @IsISO8601(
    {},
    {
      message: 'revenue_end_date must be a valid ISO 8601 date string',
    },
  )
  @IsOnOrAfter('revenue_start_date', 'revenue_start_date', {
    message: 'revenue_end_date must be on or after revenue_start_date',
  })
  revenue_end_date?: string;

  @ApiPropertyOptional({
    enum: ANALYTICS_PERIODS,
    default: 'monthly',
    example: 'monthly',
  })
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS, {
    message: `revenue_period must be one of: ${ANALYTICS_PERIODS.join(', ')}`,
  })
  revenue_period?: AnalyticsPeriod = 'monthly';

  @ApiPropertyOptional({ example: '2026-04-10' })
  @IsOptional()
  @IsISO8601(
    {},
    {
      message: 'attendance_start_date must be a valid ISO 8601 date string',
    },
  )
  attendance_start_date?: string;

  @ApiPropertyOptional({ example: '2026-04-23' })
  @IsOptional()
  @IsISO8601(
    {},
    {
      message: 'attendance_end_date must be a valid ISO 8601 date string',
    },
  )
  @IsOnOrAfter('attendance_start_date', 'attendance_start_date', {
    message: 'attendance_end_date must be on or after attendance_start_date',
  })
  attendance_end_date?: string;

  @ApiPropertyOptional({
    enum: ANALYTICS_PERIODS,
    default: 'daily',
    example: 'daily',
  })
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS, {
    message: `attendance_period must be one of: ${ANALYTICS_PERIODS.join(', ')}`,
  })
  attendance_period?: AnalyticsPeriod = 'daily';

  @ApiPropertyOptional({
    enum: ANALYTICS_PDF_SECTIONS,
    example: ['daily', 'revenue', 'attendance'],
    isArray: true,
  })
  @IsOptional()
  @IsArray({ message: 'selected_sections must be an array' })
  @IsIn(ANALYTICS_PDF_SECTIONS, {
    each: true,
    message: `selected_sections entries must be one of: ${ANALYTICS_PDF_SECTIONS.join(', ')}`,
  })
  selected_sections?: AnalyticsPdfSection[];
}

export class AnalyticsRevenueTotalsDTO {
  @ApiProperty({ example: '4999.00' })
  membership_revenue: string;

  @ApiProperty({ example: '1200.00' })
  booking_revenue: string;

  @ApiProperty({ example: '850.00' })
  product_revenue: string;

  @ApiProperty({ example: '3000.00' })
  coaching_payments_collected: string;

  @ApiProperty({ example: '1800.00' })
  coaching_gym_revenue: string;

  @ApiProperty({ example: '8849.00' })
  total_revenue: string;
}

export class AnalyticsRevenueSeriesPointDTO extends AnalyticsRevenueTotalsDTO {
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  bucket_start: string;
}

export class AnalyticsAttendanceSeriesPointDTO {
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  bucket_start: string;

  @ApiProperty({ example: 42 })
  check_ins: number;
}

export class AnalyticsAttendancePeakHourDTO {
  @ApiProperty({ example: '18:00' })
  hour_label: string;

  @ApiProperty({ example: 34 })
  check_ins: number;
}

export class AnalyticsTopRevenueSourceDTO {
  @ApiProperty({ example: 'membership' })
  source_key: string;

  @ApiProperty({ example: 'Memberships' })
  source_label: string;

  @ApiProperty({ example: '4500.00' })
  revenue: string;

  @ApiProperty({ example: 45.7 })
  share_percentage: number;
}

export class AnalyticsDailyInsightsDTO {
  @ApiProperty({ example: 124 })
  active_members: number;

  @ApiProperty({ example: 38 })
  sessions_today: number;

  @ApiProperty({ example: 12 })
  recent_activities: number;
}

export class AnalyticsDailyInsightSeriesPointDTO {
  @ApiProperty({ example: '2026-04-23T00:00:00.000Z' })
  bucket_start: string;

  @ApiProperty({ example: 124 })
  active_members: number;

  @ApiProperty({ example: 38 })
  sessions: number;
}

export class AnalyticsDailyInsightsTrendResponseDTO {
  @ApiProperty({ example: '2026-04-10T00:00:00.000Z' })
  start_date: string;

  @ApiProperty({ example: '2026-04-23T23:59:59.999Z' })
  end_date: string;

  @ApiProperty({ enum: ANALYTICS_PERIODS, example: 'daily' })
  period: AnalyticsPeriod;

  @ApiProperty({ type: AnalyticsDailyInsightSeriesPointDTO, isArray: true })
  series: AnalyticsDailyInsightSeriesPointDTO[];
}

export class AnalyticsPerformanceKpisDTO {
  @ApiProperty({ example: '8849.00' })
  total_revenue: string;

  @ApiProperty({ example: 18 })
  total_venue_bookings: number;

  @ApiProperty({ example: 11 })
  total_coaching_appointments: number;

  @ApiProperty({ example: 9 })
  new_members: number;

  @ApiProperty({ example: 342 })
  check_ins: number;

  @ApiProperty({ example: 24 })
  coaching_sessions: number;

  @ApiProperty({ example: 124 })
  active_members: number;

  @ApiProperty({ example: 81.8 })
  session_completion_rate: number;

  @ApiProperty({ example: 4.7 })
  coach_satisfaction_rating: number;

  @ApiProperty({ example: 4.5 })
  venue_feedback_rating: number;

  @ApiProperty({ example: 12 })
  app_feedback_submissions: number;
}

export class AnalyticsSystemAlertDTO {
  @ApiProperty({ example: '2fef9891-75d5-421f-bd3d-ef0f86db02d0' })
  id: string;

  @ApiProperty({ example: 'low_stock' })
  kind: string;

  @ApiProperty({ example: 'warning' })
  severity: string;

  @ApiProperty({ example: 'Low Stock Alert' })
  title: string;

  @ApiProperty({
    example:
      'Creatine is at or below its reorder threshold and needs a restock soon.',
  })
  body: string;

  @ApiProperty({ example: 'OPEN RESTOCK' })
  action_label: string;

  @ApiProperty({
    example: '/inventory?tab=retail&modal=restock&productId=seed-product-id',
  })
  href: string;
}

export class AnalyticsRecentActivityDTO {
  @ApiProperty({ example: 'd0dfabfa-4f0f-4dc5-b583-a48427ec2f4b' })
  id: string;

  @ApiProperty({ example: 'attendance' })
  kind: string;

  @ApiProperty({ example: 'Attendance check-in' })
  title: string;

  @ApiProperty({
    example: 'Ava Rivera checked in and started a new training day.',
  })
  description: string;

  @ApiProperty({ example: '2026-04-23T05:18:00.000Z' })
  occurred_at: string;

  @ApiProperty({ example: 'Ava Rivera' })
  actor_name: string;

  @ApiProperty({ example: 'completed' })
  status: string;

  @ApiProperty({ example: 'Attendance' })
  entity_label: string;

  @ApiProperty({ example: 'attendance-log-id' })
  entity_id: string;
}

export class AnalyticsSnapshotResponseDTO {
  @ApiProperty({ example: '2026-04-23T05:20:00.000Z' })
  generated_at: string;

  @ApiProperty({ type: AnalyticsDailyInsightsDTO })
  daily_insights: AnalyticsDailyInsightsDTO;

  @ApiProperty({ type: AnalyticsPerformanceKpisDTO })
  performance_kpis: AnalyticsPerformanceKpisDTO;

  @ApiProperty({ type: AnalyticsSystemAlertDTO, isArray: true })
  system_alerts: AnalyticsSystemAlertDTO[];

  @ApiProperty({ type: AnalyticsRecentActivityDTO, isArray: true })
  recent_activities: AnalyticsRecentActivityDTO[];
}

export class AnalyticsOverviewResponseDTO {
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  start_date: string;

  @ApiProperty({ example: '2025-01-31T23:59:59.999Z' })
  end_date: string;

  @ApiProperty({ example: 342 })
  total_check_ins: number;

  @ApiProperty({ example: 18 })
  new_members: number;

  @ApiProperty({ example: 24 })
  completed_coaching_sessions: number;

  @ApiProperty({ type: AnalyticsRevenueTotalsDTO })
  revenue: AnalyticsRevenueTotalsDTO;
}

export class AnalyticsAttendanceResponseDTO {
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  start_date: string;

  @ApiProperty({ example: '2025-01-31T23:59:59.999Z' })
  end_date: string;

  @ApiProperty({ enum: ANALYTICS_PERIODS, example: 'monthly' })
  period: AnalyticsPeriod;

  @ApiProperty({ example: 342 })
  total_check_ins: number;

  @ApiProperty({ type: AnalyticsAttendancePeakHourDTO, isArray: true })
  peak_hours: AnalyticsAttendancePeakHourDTO[];

  @ApiProperty({ type: AnalyticsAttendanceSeriesPointDTO, isArray: true })
  series: AnalyticsAttendanceSeriesPointDTO[];
}

export class AnalyticsMembersResponseDTO {
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  start_date: string;

  @ApiProperty({ example: '2025-01-31T23:59:59.999Z' })
  end_date: string;

  @ApiProperty({ example: 18 })
  new_members: number;

  @ApiProperty({ example: 124 })
  active_members: number;
}

export class AnalyticsCoachBreakdownDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  coach_id: string;

  @ApiPropertyOptional({ example: 'Maria', nullable: true })
  first_name: string | null;

  @ApiPropertyOptional({ example: 'Santos', nullable: true })
  last_name: string | null;

  @ApiProperty({ example: '5400.00' })
  total_billed: string;

  @ApiProperty({ example: '1080.00' })
  gym_cut: string;

  @ApiProperty({ example: '4320.00' })
  coach_payout: string;

  @ApiProperty({ example: 6 })
  completed_sessions: number;
}

export class AnalyticsCoachesResponseDTO {
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  start_date: string;

  @ApiProperty({ example: '2025-01-31T23:59:59.999Z' })
  end_date: string;

  @ApiProperty({ type: AnalyticsCoachBreakdownDTO, isArray: true })
  coaches: AnalyticsCoachBreakdownDTO[];
}

export class AnalyticsRevenueResponseDTO {
  @ApiProperty({ example: '2025-01-01T00:00:00.000Z' })
  start_date: string;

  @ApiProperty({ example: '2025-01-31T23:59:59.999Z' })
  end_date: string;

  @ApiProperty({ enum: ANALYTICS_PERIODS, example: 'monthly' })
  period: AnalyticsPeriod;

  @ApiProperty({ type: AnalyticsRevenueTotalsDTO })
  totals: AnalyticsRevenueTotalsDTO;

  @ApiProperty({ type: AnalyticsTopRevenueSourceDTO, isArray: true })
  top_revenue_sources: AnalyticsTopRevenueSourceDTO[];

  @ApiProperty({
    isArray: true,
    oneOf: [{ $ref: getSchemaPath(AnalyticsRevenueSeriesPointDTO) }],
    type: AnalyticsRevenueSeriesPointDTO,
  })
  series: AnalyticsRevenueSeriesPointDTO[];
}
