import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsIn,
  IsOptional,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  InsightFocus,
  InsightPeriod,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { IsOnOrAfter } from '../../common/validators';
import { PaginationDTO } from '../../user/dto/user-dto';

import { IsBoolean, IsUUID } from 'class-validator';
export const BUSINESS_INSIGHT_ANALYSIS_DEPTHS = [
  'brief',
  'detailed',
  'deep',
] as const;

export type BusinessInsightAnalysisDepth =
  (typeof BUSINESS_INSIGHT_ANALYSIS_DEPTHS)[number];

function IsUniqueArray(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isUniqueArray',
      target: target.constructor,
      propertyName: propertyName.toString(),
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return !Array.isArray(value) || new Set(value).size === value.length;
        },
        defaultMessage(): string {
          return '$property must contain unique values';
        },
      },
    });
  };
}

export class GenerateBusinessInsightDTO {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsISO8601({}, { message: 'start_date must be a valid ISO 8601 date string' })
  start_date?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsISO8601({}, { message: 'end_date must be a valid ISO 8601 date string' })
  @IsOnOrAfter('start_date', 'start_date', {
    message: 'end_date must be on or after start_date',
  })
  end_date?: string;

  @ApiPropertyOptional({
    enum: InsightPeriod,
    default: InsightPeriod.monthly,
    example: InsightPeriod.monthly,
  })
  @IsOptional()
  @IsEnum(InsightPeriod, {
    message: `period must be one of: ${Object.values(InsightPeriod).join(', ')}`,
  })
  period?: InsightPeriod = InsightPeriod.monthly;

  @ApiPropertyOptional({
    enum: InsightFocus,
    default: InsightFocus.overview,
    example: InsightFocus.overview,
  })
  @IsOptional()
  @IsEnum(InsightFocus, {
    message: `focus must be one of: ${Object.values(InsightFocus).join(', ')}`,
  })
  focus?: InsightFocus = InsightFocus.overview;

  @ApiPropertyOptional({
    enum: InsightFocus,
    isArray: true,
    minItems: 1,
    example: [InsightFocus.revenue, InsightFocus.attendance],
  })
  @IsOptional()
  @IsArray({ message: 'selected_sections must be an array' })
  @ArrayMinSize(1, {
    message: 'selected_sections must contain at least one section',
  })
  @IsUniqueArray({
    message: 'selected_sections must not contain duplicate sections',
  })
  @IsEnum(InsightFocus, {
    each: true,
    message:
      'selected_sections must contain only: ' +
      Object.values(InsightFocus).join(', '),
  })
  selected_sections?: InsightFocus[];

  @ApiPropertyOptional({
    enum: BUSINESS_INSIGHT_ANALYSIS_DEPTHS,
    default: 'brief',
    example: 'detailed',
  })
  @IsOptional()
  @IsIn(BUSINESS_INSIGHT_ANALYSIS_DEPTHS, {
    message:
      'analysis_depth must be one of: ' +
      BUSINESS_INSIGHT_ANALYSIS_DEPTHS.join(', '),
  })
  analysis_depth?: BusinessInsightAnalysisDepth = 'brief';
}

export class BusinessInsightCompatibilityDTO {
  @ApiPropertyOptional({ example: '2026-03-01' })
  @IsOptional()
  @IsISO8601({}, { message: 'start_date must be a valid ISO 8601 date string' })
  start_date?: string;

  @ApiPropertyOptional({ example: '2026-03-31' })
  @IsOptional()
  @IsISO8601({}, { message: 'end_date must be a valid ISO 8601 date string' })
  @IsOnOrAfter('start_date', 'start_date', {
    message: 'end_date must be on or after start_date',
  })
  end_date?: string;

  @ApiPropertyOptional({
    enum: InsightPeriod,
    default: InsightPeriod.monthly,
    example: InsightPeriod.monthly,
  })
  @IsOptional()
  @IsEnum(InsightPeriod, {
    message:
      'period must be one of: ' + Object.values(InsightPeriod).join(', '),
  })
  period?: InsightPeriod = InsightPeriod.monthly;
}

export class ExportBusinessInsightPdfDTO {
  @ApiPropertyOptional({ default: false, example: true })
  @IsOptional()
  @IsBoolean({ message: 'compare_previous must be a boolean' })
  compare_previous?: boolean;

  @ApiPropertyOptional({
    example: '33333333-3333-4333-8333-333333333333',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4', { message: 'previous_insight_run_id must be a valid UUID' })
  previous_insight_run_id?: string;
}

export class BusinessInsightFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({
    enum: InsightFocus,
    example: InsightFocus.revenue,
  })
  @IsOptional()
  @IsEnum(InsightFocus, {
    message: `focus must be one of: ${Object.values(InsightFocus).join(', ')}`,
  })
  focus?: InsightFocus;

  @ApiPropertyOptional({
    enum: InsightPeriod,
    example: InsightPeriod.monthly,
  })
  @IsOptional()
  @IsEnum(InsightPeriod, {
    message: `period must be one of: ${Object.values(InsightPeriod).join(', ')}`,
  })
  period?: InsightPeriod;
}

export class BusinessInsightRequesterProfileResponseDTO {
  @ApiPropertyOptional({ example: 'Maria', nullable: true })
  first_name: string | null;

  @ApiPropertyOptional({ example: 'Santos', nullable: true })
  last_name: string | null;
}

export class BusinessInsightRequesterResponseDTO {
  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
  })
  id: string;

  @ApiProperty({ enum: UserRole, example: UserRole.admin })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.active })
  status: UserStatus;

  @ApiPropertyOptional({
    type: () => BusinessInsightRequesterProfileResponseDTO,
    nullable: true,
  })
  profile: BusinessInsightRequesterProfileResponseDTO | null;
}

export class BusinessInsightRunSummaryResponseDTO {
  @ApiProperty({
    example: '33333333-3333-4333-8333-333333333333',
  })
  id: string;

  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
    nullable: true,
  })
  requested_by: string | null;

  @ApiPropertyOptional({
    type: () => BusinessInsightRequesterResponseDTO,
    nullable: true,
  })
  requester: BusinessInsightRequesterResponseDTO | null;

  @ApiProperty({ enum: InsightFocus, example: InsightFocus.overview })
  focus: InsightFocus;

  @ApiProperty({ enum: InsightPeriod, example: InsightPeriod.monthly })
  period: InsightPeriod;

  @ApiProperty({ example: '2026-03-01' })
  start_date: string;

  @ApiProperty({ example: '2026-03-31' })
  end_date: string;

  @ApiProperty({
    example:
      'Revenue stayed strong while attendance softened late in the month.',
  })
  summary: string;

  @ApiPropertyOptional({
    example: 'openrouter/openai/gpt-4.1-mini',
    nullable: true,
  })
  model_used: string | null;

  @ApiPropertyOptional({ example: 321, nullable: true })
  token_count: number | null;

  @ApiPropertyOptional({ example: 875, nullable: true })
  latency_ms: number | null;

  @ApiProperty({ example: '2026-03-30T04:00:00.000Z' })
  created_at: string;

  @ApiPropertyOptional({
    enum: BUSINESS_INSIGHT_ANALYSIS_DEPTHS,
    nullable: true,
    example: 'detailed',
  })
  analysis_depth?: BusinessInsightAnalysisDepth;

  @ApiPropertyOptional({
    enum: InsightFocus,
    isArray: true,
    nullable: true,
    example: [InsightFocus.revenue, InsightFocus.attendance],
  })
  selected_sections?: InsightFocus[];

  @ApiPropertyOptional({
    nullable: true,
    example: 'f4d1f89c8f5a3f5e6b8d4f7ab8f6d1cbe7f2d0d8e3d4c1a2b9f0c6d5e4a3b2',
  })
  data_fingerprint?: string;
}

export class BusinessInsightRunDetailResponseDTO extends BusinessInsightRunSummaryResponseDTO {
  @ApiProperty({
    type: String,
    isArray: true,
    example: ['Membership revenue outpaced coaching revenue this period.'],
  })
  highlights: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: [
      'Late-month attendance declines may reduce upsell opportunities.',
    ],
  })
  risks: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['Promote top-performing plans during peak attendance windows.'],
  })
  opportunities: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['Attendance dropped 18% during the final week of the window.'],
  })
  anomaly_flags: string[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['Review late-month staffing and class schedules.'],
  })
  recommended_actions: string[];

  @ApiPropertyOptional({ type: Object, nullable: true })
  analytics_snapshot?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  section_contexts?: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object, nullable: true })
  section_analyses?: Record<string, unknown>;

  @ApiPropertyOptional({ type: String, isArray: true })
  failed_sections?: string[];
}

export class BusinessInsightCompatibilityResponseDTO {
  @ApiProperty({ example: true })
  compatible: boolean;

  @ApiProperty({ example: 'compatible' })
  reason: string;

  @ApiProperty({
    example: 'f4d1f89c8f5a3f5e6b8d4f7ab8f6d1cbe7f2d0d8e3d4c1a2b9f0c6d5e4a3b2',
  })
  current_fingerprint: string;

  @ApiProperty({
    example: 'f4d1f89c8f5a3f5e6b8d4f7ab8f6d1cbe7f2d0d8e3d4c1a2b9f0c6d5e4a3b2',
  })
  insight_fingerprint: string;
}
