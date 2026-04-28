import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  RecurringCoachingFrequency,
  RecurringCoachingPlanStatus,
  RecurringCoachingSessionState,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { TrimString } from '../../../common/validators';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class RecurringCoachingPlanBaseDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  @IsUUID('all', { message: 'member_id must be a valid UUID' })
  member_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id: string;

  @ApiProperty({
    enum: RecurringCoachingFrequency,
    example: RecurringCoachingFrequency.weekly,
  })
  @IsEnum(RecurringCoachingFrequency, {
    message: `frequency must be one of: ${Object.values(RecurringCoachingFrequency).join(', ')}`,
  })
  frequency: RecurringCoachingFrequency;

  @ApiProperty({ example: [2, 4] })
  @IsArray({ message: 'preferred_days must be an array' })
  @ArrayMinSize(1, { message: 'preferred_days must include at least one day' })
  @ArrayMaxSize(7, { message: 'preferred_days must not exceed 7 entries' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'preferred_days entries must be integers' })
  @Min(0, { each: true, message: 'preferred_days entries must be at least 0' })
  @Max(6, { each: true, message: 'preferred_days entries must not exceed 6' })
  preferred_days: number[];

  @ApiProperty({ example: '09:00' })
  @Matches(TIME_PATTERN, {
    message: 'preferred_time must be a valid 24-hour time in HH:mm format',
  })
  preferred_time: string;

  @ApiProperty({ example: '2026-05-01' })
  @IsISO8601(
    { strict: false },
    { message: 'start_date must be a valid ISO date string' },
  )
  start_date: string;

  @ApiPropertyOptional({ example: '2026-11-01' })
  @IsOptional()
  @IsISO8601(
    { strict: false },
    { message: 'end_date must be a valid ISO date string' },
  )
  end_date?: string;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'duration_months must be an integer' })
  @Min(1, { message: 'duration_months must be at least 1' })
  @Max(12, { message: 'duration_months must not exceed 12' })
  duration_months?: number;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'duration_minutes must be an integer' })
  @Min(30, { message: 'duration_minutes must be at least 30' })
  @Max(180, { message: 'duration_minutes must not exceed 180' })
  duration_minutes?: number;

  @ApiPropertyOptional({ example: 'Long-term strength plan.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'member_notes must be a string' })
  @MaxLength(500, { message: 'member_notes must not exceed 500 characters' })
  member_notes?: string;
}

export class PreviewRecurringCoachingPlanDTO extends RecurringCoachingPlanBaseDTO {}

export class RecurringPlanSessionOverrideDTO {
  @ApiProperty({
    example: '2026-05-05T09:00:00.000Z',
    description: 'The original scheduled_at value from the preview response.',
  })
  @IsISO8601(
    {},
    { message: 'scheduled_at must be a valid ISO 8601 date string' },
  )
  scheduled_at: string;

  @ApiProperty({ enum: ['schedule', 'skip', 'reschedule', 'swap_coach'] })
  @IsEnum(['schedule', 'skip', 'reschedule', 'swap_coach'], {
    message: 'action must be schedule, skip, reschedule, or swap_coach',
  })
  action: 'schedule' | 'skip' | 'reschedule' | 'swap_coach';

  @ApiPropertyOptional({ example: '2026-05-05T10:00:00.000Z' })
  @ValidateIf((dto: RecurringPlanSessionOverrideDTO) =>
    ['reschedule', 'swap_coach'].includes(dto.action),
  )
  @IsISO8601(
    {},
    { message: 'new_scheduled_at must be a valid ISO 8601 date string' },
  )
  new_scheduled_at?: string;

  @ApiPropertyOptional({ example: '22222222-2222-4222-8222-222222222222' })
  @ValidateIf(
    (dto: RecurringPlanSessionOverrideDTO) => dto.action === 'swap_coach',
  )
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id?: string;

  @ApiPropertyOptional({ example: 'Member requested another slot.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;
}

export class CreateRecurringCoachingPlanDTO extends RecurringCoachingPlanBaseDTO {
  @ApiPropertyOptional({ type: RecurringPlanSessionOverrideDTO, isArray: true })
  @IsOptional()
  @IsArray({ message: 'session_overrides must be an array' })
  @ArrayMaxSize(120, {
    message: 'session_overrides must not exceed 120 entries',
  })
  @ValidateNested({ each: true })
  @Type(() => RecurringPlanSessionOverrideDTO)
  session_overrides?: RecurringPlanSessionOverrideDTO[];
}

export class UpdateRecurringPlanSessionDTO {
  @ApiProperty({ enum: ['reschedule', 'skip'] })
  @IsEnum(['reschedule', 'skip'], {
    message: 'action must be reschedule or skip',
  })
  action: 'reschedule' | 'skip';

  @ApiPropertyOptional({ example: '2026-05-12T10:00:00.000Z' })
  @ValidateIf(
    (dto: UpdateRecurringPlanSessionDTO) => dto.action === 'reschedule',
  )
  @IsISO8601(
    {},
    { message: 'new_scheduled_at must be a valid ISO 8601 date string' },
  )
  new_scheduled_at?: string;

  @ApiPropertyOptional({ example: '22222222-2222-4222-8222-222222222222' })
  @IsOptional()
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id?: string;

  @ApiPropertyOptional({ example: 'Member conflict.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;
}

export class BulkUpdateRecurringPlanSessionsDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  @IsUUID('all', { message: 'from_session_id must be a valid UUID' })
  from_session_id: string;

  @ApiPropertyOptional({ example: '22222222-2222-4222-8222-222222222222' })
  @IsOptional()
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id?: string;

  @ApiPropertyOptional({
    enum: RecurringCoachingFrequency,
    example: RecurringCoachingFrequency.weekly,
  })
  @IsOptional()
  @IsEnum(RecurringCoachingFrequency, {
    message: `frequency must be one of: ${Object.values(RecurringCoachingFrequency).join(', ')}`,
  })
  frequency?: RecurringCoachingFrequency;

  @ApiPropertyOptional({ example: [3] })
  @IsOptional()
  @IsArray({ message: 'preferred_days must be an array' })
  @ArrayMinSize(1, { message: 'preferred_days must include at least one day' })
  @ArrayMaxSize(7, { message: 'preferred_days must not exceed 7 entries' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'preferred_days entries must be integers' })
  @Min(0, { each: true, message: 'preferred_days entries must be at least 0' })
  @Max(6, { each: true, message: 'preferred_days entries must not exceed 6' })
  preferred_days?: number[];

  @ApiPropertyOptional({ example: '10:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, {
    message: 'preferred_time must be a valid 24-hour time in HH:mm format',
  })
  preferred_time?: string;
}

export class CancelRecurringCoachingPlanDTO {
  @ApiPropertyOptional({ example: 'Member requested cancellation.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;
}

export class RecurringCoachingPlanSessionResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: 'plan-1' })
  recurring_plan_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  coach_id: string;

  @ApiProperty({ example: '2026-05-05T09:00:00.000Z' })
  scheduled_at: string;

  @ApiProperty({ example: 60 })
  duration_minutes: number;

  @ApiProperty({ enum: RecurringCoachingSessionState })
  recurring_state: RecurringCoachingSessionState | null;

  @ApiProperty({ example: 'confirmed' })
  status: string;

  @ApiPropertyOptional({ example: true })
  exception_override: boolean;

  @ApiPropertyOptional({ example: false })
  conflict: boolean;
}

export class RecurringCoachingPlanResponseDTO {
  @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
  id: string;

  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  member_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  coach_id: string;

  @ApiProperty({ enum: RecurringCoachingFrequency })
  frequency: RecurringCoachingFrequency;

  @ApiProperty({ example: [2] })
  preferred_days: number[];

  @ApiProperty({ example: '09:00' })
  preferred_time: string;

  @ApiProperty({ example: '2026-05-01' })
  start_date: string;

  @ApiProperty({ example: '2026-11-01' })
  end_date: string;

  @ApiProperty({ enum: RecurringCoachingPlanStatus })
  status: RecurringCoachingPlanStatus;

  @ApiProperty({ example: 24 })
  total_sessions: number;

  @ApiProperty({ example: 3 })
  completed_sessions: number;
}
