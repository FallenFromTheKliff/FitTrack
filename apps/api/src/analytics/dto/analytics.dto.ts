import { IsIn, IsISO8601, IsOptional } from 'class-validator';
import {
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

import { IsOnOrAfter } from '../../common/validators';

export const ANALYTICS_PERIODS = [
  'daily',
  'weekly',
  'monthly',
  'yearly',
] as const;

export type AnalyticsPeriod = (typeof ANALYTICS_PERIODS)[number];

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

  @ApiProperty({
    isArray: true,
    oneOf: [{ $ref: getSchemaPath(AnalyticsRevenueSeriesPointDTO) }],
    type: AnalyticsRevenueSeriesPointDTO,
  })
  series: AnalyticsRevenueSeriesPointDTO[];
}
