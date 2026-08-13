import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CoachWorkoutAssignmentSource,
  CoachWorkoutAssignmentState,
  PaymentProvider,
  RecurringCoachingBillingCycleStatus,
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
  IsIn,
  IsNumber,
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

export class RecurringCoachingScheduleItemDTO {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'sequence_index must be an integer' })
  @Min(1, { message: 'sequence_index must be at least 1' })
  @Max(120, { message: 'sequence_index must not exceed 120' })
  sequence_index: number;

  @ApiProperty({ example: '2026-05-06T05:00:00.000Z' })
  @IsISO8601(
    {},
    { message: 'scheduled_at must be a valid ISO 8601 date string' },
  )
  scheduled_at: string;

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'duration_minutes must be an integer' })
  @Min(30, { message: 'duration_minutes must be at least 30' })
  @Max(180, { message: 'duration_minutes must not exceed 180' })
  duration_minutes?: number;

  @ApiPropertyOptional({ example: 1200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'amount must be a valid amount with at most 2 decimals' },
  )
  @Min(0, { message: 'amount must not be negative' })
  amount?: number;
}

export class RecurringCoachingPlanBaseDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  @IsUUID('all', { message: 'member_id must be a valid UUID' })
  member_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id: string;

  @ApiPropertyOptional({
    enum: RecurringCoachingFrequency,
    example: RecurringCoachingFrequency.weekly,
  })
  @IsOptional()
  @IsEnum(RecurringCoachingFrequency, {
    message: `frequency must be one of: ${Object.values(RecurringCoachingFrequency).join(', ')}`,
  })
  frequency?: RecurringCoachingFrequency;

  @ApiPropertyOptional({ example: [2, 4] })
  @IsOptional()
  @IsArray({ message: 'preferred_days must be an array' })
  @ArrayMinSize(1, { message: 'preferred_days must include at least one day' })
  @ArrayMaxSize(7, { message: 'preferred_days must not exceed 7 entries' })
  @Type(() => Number)
  @IsInt({ each: true, message: 'preferred_days entries must be integers' })
  @Min(0, { each: true, message: 'preferred_days entries must be at least 0' })
  @Max(6, { each: true, message: 'preferred_days entries must not exceed 6' })
  preferred_days?: number[];

  @ApiPropertyOptional({ example: '09:00' })
  @IsOptional()
  @Matches(TIME_PATTERN, {
    message: 'preferred_time must be a valid 24-hour time in HH:mm format',
  })
  preferred_time?: string;

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

  @ApiPropertyOptional({
    example: 14400,
    description:
      'Fixed full price for the requested monthly schedule. No wallet or credit balance is created.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'quoted_amount must be a valid amount with at most 2 decimals' },
  )
  @Min(0, { message: 'quoted_amount must not be negative' })
  quoted_amount?: number;

  @ApiPropertyOptional({ example: '77777777-7777-4777-8777-777777777777' })
  @IsOptional()
  @IsUUID('all', { message: 'training_plan_id must be a valid UUID' })
  training_plan_id?: string;

  @ApiPropertyOptional({
    example: [0, 2],
    description:
      'Zero-based indexes of generated workout candidates to keep. If omitted, the earliest candidates up to the purchased session count are selected.',
  })
  @IsOptional()
  @IsArray({ message: 'selected_candidate_indexes must be an array' })
  @ArrayMaxSize(120, {
    message: 'selected_candidate_indexes must not exceed 120 entries',
  })
  @Type(() => Number)
  @IsInt({
    each: true,
    message: 'selected_candidate_indexes entries must be integers',
  })
  @Min(0, {
    each: true,
    message: 'selected_candidate_indexes entries must be at least 0',
  })
  @Max(119, {
    each: true,
    message: 'selected_candidate_indexes entries must not exceed 119',
  })
  selected_candidate_indexes?: number[];

  @ApiPropertyOptional({
    type: RecurringCoachingScheduleItemDTO,
    isArray: true,
  })
  @IsOptional()
  @IsArray({ message: 'schedule_items must be an array' })
  @ArrayMaxSize(120, {
    message: 'schedule_items must not exceed 120 entries',
  })
  @ValidateNested({ each: true })
  @Type(() => RecurringCoachingScheduleItemDTO)
  schedule_items?: RecurringCoachingScheduleItemDTO[];
}

export class EnrollRecurringCoachingPlanDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id: string;

  @ApiPropertyOptional({
    example: '2026-05-01',
    description:
      'The calendar month to purchase. If omitted, the current gym month is used.',
  })
  @IsOptional()
  @IsISO8601(
    { strict: false },
    { message: 'start_date must be a valid ISO date string' },
  )
  start_date?: string;
}

export class CreateStaffRecurringCashEnrollmentDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID('all', { message: 'member_id must be a valid UUID' })
  member_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id: string;

  @ApiPropertyOptional({ example: '2026-08-01' })
  @IsOptional()
  @IsISO8601(
    { strict: false },
    { message: 'start_date must be a valid ISO date string' },
  )
  start_date?: string;

  @ApiPropertyOptional({ example: 'OR-COACH-2026-001' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'reference_no must be a string' })
  @MaxLength(100, { message: 'reference_no must not exceed 100 characters' })
  reference_no?: string;
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

export class InitiateRecurringBillingCyclePaymentDTO {
  @ApiProperty({
    enum: PaymentProvider,
    example: PaymentProvider.paymongo,
  })
  @IsIn([PaymentProvider.paymongo], {
    message: 'provider must be paymongo for recurring billing checkout',
  })
  provider: PaymentProvider;
}

export class RecurringCoachingBillingCycleResponseDTO {
  @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
  id: string;

  @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
  recurring_plan_id: string;

  @ApiProperty({ example: '2026-05-01' })
  cycle_start_date: string;

  @ApiProperty({ example: '2026-05-31' })
  cycle_end_date: string;

  @ApiProperty({ example: '2026-05-01' })
  due_date: string;

  @ApiProperty({ example: '2026-05-08T00:00:00.000Z' })
  grace_period_ends_at: string;

  @ApiProperty({ example: '2400.00' })
  amount: string;

  @ApiProperty({ enum: RecurringCoachingBillingCycleStatus })
  status: RecurringCoachingBillingCycleStatus;

  @ApiPropertyOptional({ example: '77777777-7777-4777-8777-777777777777' })
  payment_id: string | null;

  @ApiPropertyOptional({ example: '2026-05-01T09:00:00.000Z' })
  paid_at: string | null;
}

export class RecurringBillingCycleCheckoutResponseDTO {
  @ApiProperty({
    type: RecurringCoachingBillingCycleResponseDTO,
  })
  billing_cycle: RecurringCoachingBillingCycleResponseDTO;

  @ApiPropertyOptional({
    example: 'https://checkout.paymongo.com/cs_test_123',
  })
  checkout_url: string | null;

  @ApiProperty({ example: '88888888-8888-4888-8888-888888888888' })
  payment_id: string;
}

export class RecurringCoachingWorkoutCandidateDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  id: string;

  @ApiPropertyOptional({ example: 'Lower strength' })
  label: string | null;

  @ApiProperty({ example: 2 })
  week_number: number;

  @ApiProperty({ example: 1 })
  day_of_week: number;

  @ApiProperty({ example: 3 })
  exercise_count: number;

  @ApiProperty({ example: ['Back Squat', 'Romanian Deadlift'] })
  exercise_names: string[];
}

export class RecurringCoachingPlanPreviewSessionDTO {
  @ApiProperty({ example: 0 })
  candidate_index: number;

  @ApiProperty({ example: '2026-05-06' })
  date: string;

  @ApiProperty({ example: '09:00' })
  time: string;

  @ApiProperty({ example: true })
  selected: boolean;

  @ApiProperty({ example: false })
  conflict: boolean;

  @ApiProperty({ example: '2026-05-06T01:00:00.000Z' })
  scheduled_at: string;

  @ApiProperty({ example: '2026-05-06T02:00:00.000Z' })
  ends_at: string;

  @ApiProperty({ example: 60 })
  duration_minutes: number;

  @ApiProperty({ type: RecurringCoachingWorkoutCandidateDTO, nullable: true })
  workout: RecurringCoachingWorkoutCandidateDTO | null;

  @ApiProperty({ example: [] })
  conflict_reasons: string[];
}

export class RecurringCoachingPlanPreviewResponseDTO {
  @ApiProperty({ example: true })
  can_confirm: boolean;

  @ApiProperty({ example: 12 })
  candidate_count: number;

  @ApiProperty({ example: 12 })
  eligible_session_count: number;

  @ApiProperty({ example: 4 })
  selected_session_count: number;

  @ApiProperty({ example: 4 })
  purchased_session_count: number;

  @ApiProperty({ example: 4 })
  total_sessions: number;

  @ApiProperty({ example: 0 })
  conflict_count: number;

  @ApiProperty({ example: false })
  venue_conflicts_checked: boolean;

  @ApiProperty({
    example:
      'Coach appointments do not currently reserve venues, so venue conflict checks are deferred.',
  })
  venue_conflicts_note: string;

  @ApiProperty({ type: RecurringCoachingPlanPreviewSessionDTO, isArray: true })
  sessions: RecurringCoachingPlanPreviewSessionDTO[];
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

  @ApiProperty({ example: '2026-05-06' })
  date: string;

  @ApiProperty({ example: '09:00' })
  time: string;

  @ApiPropertyOptional({ example: true })
  exception_override: boolean;

  @ApiPropertyOptional({ example: false })
  conflict: boolean;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: {
      sequence_index: 1,
      training_schedule_day_id: '44444444-4444-4444-8444-444444444444',
      source: CoachWorkoutAssignmentSource.automatic,
      state: CoachWorkoutAssignmentState.assigned,
    },
  })
  workout_assignment: {
    sequence_index: number;
    training_schedule_day_id: string;
    source: CoachWorkoutAssignmentSource;
    state: CoachWorkoutAssignmentState;
  } | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  workout: {
    id: string;
    label: string | null;
    week_number: number;
    day_of_week: number;
    exercise_count: number;
    exercise_names: string[];
  } | null;
}

export class RecurringCoachingScheduleItemResponseDTO {
  @ApiProperty({ example: '99999999-9999-4999-8999-999999999999' })
  id: string;

  @ApiProperty({ example: 1 })
  sequence_index: number;

  @ApiProperty({ example: '2026-05-06T05:00:00.000Z' })
  scheduled_at: string;

  @ApiProperty({ example: 60 })
  duration_minutes: number;

  @ApiProperty({ example: '1200.00' })
  amount: string;

  @ApiProperty({ example: 'pending_payment' })
  status: string;

  @ApiPropertyOptional({ example: null })
  appointment_id: string | null;

  @ApiPropertyOptional({ example: '44444444-4444-4444-8444-444444444444' })
  training_schedule_day_id: string | null;
}

export class RecurringCoachingPlanResponseDTO {
  @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
  id: string;

  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  member_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  coach_id: string;

  @ApiPropertyOptional({ example: '77777777-7777-4777-8777-777777777777' })
  training_plan_id: string | null;

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

  @ApiProperty({ example: '14400.00' })
  quoted_amount: string;

  @ApiPropertyOptional({ example: '2026-05-01T01:00:00.000Z' })
  coach_approved_at: string | null;

  @ApiPropertyOptional({
    type: RecurringCoachingScheduleItemResponseDTO,
    isArray: true,
  })
  schedule_items?: RecurringCoachingScheduleItemResponseDTO[];

  @ApiPropertyOptional({
    type: RecurringCoachingBillingCycleResponseDTO,
    isArray: true,
  })
  billing_cycles?: RecurringCoachingBillingCycleResponseDTO[];
}
