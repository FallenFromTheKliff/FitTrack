import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AppointmentStatus,
  PaymentProvider,
  RecurringCoachingSessionState,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsArray,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { TrimString } from '../../../common/validators';
import { DateRangeDTO } from '../../../user/dto/user-dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class AvailabilitySlotInputDTO {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'day_of_week must be an integer' })
  @Min(0, { message: 'day_of_week must be at least 0' })
  @Max(6, { message: 'day_of_week must not exceed 6' })
  day_of_week: number;

  @ApiProperty({ example: '08:00' })
  @Matches(TIME_PATTERN, {
    message: 'start_time must be a valid 24-hour time in HH:mm format',
  })
  start_time: string;

  @ApiProperty({ example: '10:00' })
  @Matches(TIME_PATTERN, {
    message: 'end_time must be a valid 24-hour time in HH:mm format',
  })
  end_time: string;
}

export class SetAvailabilityDTO {
  @ApiProperty({
    type: AvailabilitySlotInputDTO,
    isArray: true,
    example: [{ day_of_week: 1, start_time: '08:00', end_time: '10:00' }],
  })
  @IsArray({ message: 'slots must be an array' })
  @ArrayMaxSize(50, { message: 'slots must not exceed 50 entries' })
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotInputDTO)
  slots: AvailabilitySlotInputDTO[];
}

export class CreateAppointmentDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id: string;

  @ApiProperty({ example: '2026-04-01T08:00:00.000Z' })
  @IsISO8601(
    {},
    { message: 'scheduled_at must be a valid ISO 8601 date string' },
  )
  scheduled_at: string;

  @ApiProperty({ example: 60 })
  @Type(() => Number)
  @IsInt({ message: 'duration_minutes must be an integer' })
  @Min(30, { message: 'duration_minutes must be at least 30' })
  @Max(180, { message: 'duration_minutes must not exceed 180' })
  duration_minutes: number;

  @ApiPropertyOptional({ example: 'Focus on mobility and shoulder stability.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'member_notes must be a string' })
  @MaxLength(500, { message: 'member_notes must not exceed 500 characters' })
  member_notes?: string;
}

export class RespondAppointmentDTO {
  @ApiProperty({ example: true })
  @IsBoolean({ message: 'accepted must be a boolean value' })
  accepted: boolean;

  @ApiPropertyOptional({
    example: 'The requested time is no longer available.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'rejection_reason must be a string' })
  @MaxLength(500, {
    message: 'rejection_reason must not exceed 500 characters',
  })
  rejection_reason?: string;
}

export class CancelAppointmentDTO {
  @ApiPropertyOptional({ example: 'Need to reschedule for next week.' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @MaxLength(500, { message: 'reason must not exceed 500 characters' })
  reason?: string;
}

export class InitiateAppointmentPaymentDTO {
  @ApiProperty({
    enum: PaymentProvider,
    example: PaymentProvider.paymongo,
  })
  @IsEnum(PaymentProvider, {
    message: `provider must be one of: ${Object.values(PaymentProvider).join(', ')}`,
  })
  provider: PaymentProvider;
}

export class AppointmentBalanceDTO {
  @ApiProperty({
    enum: PaymentProvider,
    example: PaymentProvider.paymongo,
  })
  @IsEnum(PaymentProvider, {
    message: `provider must be one of: ${Object.values(PaymentProvider).join(', ')}`,
  })
  provider: PaymentProvider;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/receipts/or-2026-03-23.png',
  })
  @ValidateIf(
    (dto: AppointmentBalanceDTO) => dto.provider === PaymentProvider.cash,
  )
  @IsUrl({}, { message: 'screenshot_url must be a valid URL' })
  screenshot_url?: string;

  @ApiPropertyOptional({ example: 'OR-2026-001' })
  @ValidateIf(
    (dto: AppointmentBalanceDTO) => dto.provider === PaymentProvider.cash,
  )
  @TrimString()
  @IsString({ message: 'reference_no must be a string' })
  @IsNotEmpty({ message: 'reference_no is required' })
  @MaxLength(100, { message: 'reference_no must not exceed 100 characters' })
  reference_no?: string;
}

export class CompleteAppointmentDTO {
  @ApiPropertyOptional({
    example: 'Completed a full lower-body strength session.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'session_notes must be a string' })
  @MaxLength(2000, { message: 'session_notes must not exceed 2000 characters' })
  session_notes?: string;
}

export class AppointmentCheckoutResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  appointment_id: string;

  @ApiProperty({
    enum: AppointmentStatus,
    example: AppointmentStatus.pending_payment,
  })
  status: AppointmentStatus;

  @ApiPropertyOptional({
    example: 'https://checkout.paymongo.com/cs_test_123',
    nullable: true,
  })
  checkout_url?: string | null;
}

export class AppointmentResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  user_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  coach_id: string;

  @ApiProperty({
    enum: AppointmentStatus,
    example: AppointmentStatus.pending_coach,
  })
  status: AppointmentStatus;

  @ApiProperty({ example: false })
  is_free_session: boolean;

  @ApiProperty({ example: '2026-04-01T08:00:00.000Z' })
  scheduled_at: string;

  @ApiProperty({ example: 60 })
  duration_minutes: number;

  @ApiProperty({ example: '1200.00' })
  total_amount: string;

  @ApiProperty({ example: '360.00' })
  downpayment_amount: string;

  @ApiProperty({ example: '840.00' })
  balance_amount: string;

  @ApiProperty({ example: '240.00' })
  gym_revenue: string;

  @ApiProperty({ example: '960.00' })
  coach_earnings: string;

  @ApiPropertyOptional({
    example: 'Focus on mobility and shoulder stability.',
    nullable: true,
  })
  member_notes: string | null;

  @ApiPropertyOptional({
    example: '55555555-5555-4555-8555-555555555555',
    nullable: true,
  })
  recurring_plan_id?: string | null;

  @ApiPropertyOptional({
    enum: RecurringCoachingSessionState,
    nullable: true,
  })
  recurring_state?: RecurringCoachingSessionState | null;

  @ApiPropertyOptional({ example: '2026-04-01T08:00:00.000Z', nullable: true })
  original_scheduled_at?: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T08:15:00.000Z', nullable: true })
  downpayment_paid_at: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T08:50:00.000Z', nullable: true })
  balance_paid_at: string | null;

  @ApiPropertyOptional({
    example: 'Completed a full lower-body strength session.',
    nullable: true,
  })
  session_notes: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T09:00:00.000Z', nullable: true })
  completed_at: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T09:30:00.000Z', nullable: true })
  no_show_at: string | null;

  @ApiPropertyOptional({
    example: 'Need to reschedule for next week.',
    nullable: true,
  })
  cancellation_reason: string | null;

  @ApiPropertyOptional({ example: '2026-03-30T10:00:00.000Z', nullable: true })
  cancelled_at: string | null;

  @ApiProperty({ example: '2026-03-25T10:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-25T10:00:00.000Z' })
  updated_at: string;
}

export class CoachScheduleUserProfileResponseDTO {
  @ApiPropertyOptional({ example: 'Jamie', nullable: true })
  first_name: string | null;

  @ApiPropertyOptional({ example: 'Rivera', nullable: true })
  last_name: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/avatars/jamie-rivera.png',
    nullable: true,
  })
  avatar_url: string | null;
}

export class CoachScheduleUserResponseDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  id: string;

  @ApiProperty({ type: CoachScheduleUserProfileResponseDTO })
  profile: CoachScheduleUserProfileResponseDTO;
}

export class CoachScheduleAppointmentResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  user_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  coach_id: string;

  @ApiProperty({
    enum: AppointmentStatus,
    example: AppointmentStatus.pending_coach,
  })
  status: AppointmentStatus;

  @ApiProperty({ example: '2026-04-01T08:00:00.000Z' })
  scheduled_at: string;

  @ApiProperty({ example: 60 })
  duration_minutes: number;

  @ApiPropertyOptional({
    example: 'Focus on mobility and shoulder stability.',
    nullable: true,
  })
  member_notes: string | null;

  @ApiPropertyOptional({
    example: '55555555-5555-4555-8555-555555555555',
    nullable: true,
  })
  recurring_plan_id?: string | null;

  @ApiPropertyOptional({
    enum: RecurringCoachingSessionState,
    nullable: true,
  })
  recurring_state?: RecurringCoachingSessionState | null;

  @ApiPropertyOptional({ example: '2026-04-01T08:00:00.000Z', nullable: true })
  original_scheduled_at?: string | null;

  @ApiProperty({ type: CoachScheduleUserResponseDTO })
  user: CoachScheduleUserResponseDTO;

  @ApiProperty({ example: '2026-03-25T10:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-25T10:00:00.000Z' })
  updated_at: string;
}

export class StaffAppointmentProfileResponseDTO {
  @ApiPropertyOptional({ example: 'Jamie', nullable: true })
  first_name: string | null;

  @ApiPropertyOptional({ example: 'Rivera', nullable: true })
  last_name: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/avatars/jamie-rivera.png',
    nullable: true,
  })
  avatar_url: string | null;
}

export class StaffAppointmentMemberResponseDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  id: string;

  @ApiPropertyOptional({ example: 'member@fittrack.test', nullable: true })
  email: string | null;

  @ApiProperty({ type: StaffAppointmentProfileResponseDTO })
  profile: StaffAppointmentProfileResponseDTO;
}

export class StaffAppointmentCoachResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  id: string;

  @ApiPropertyOptional({ example: '900.00', nullable: true })
  hourly_rate: string | null;

  @ApiProperty({ type: StaffAppointmentProfileResponseDTO })
  profile: StaffAppointmentProfileResponseDTO;
}

export class StaffAppointmentResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  user_id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  coach_id: string;

  @ApiProperty({
    enum: AppointmentStatus,
    example: AppointmentStatus.pending_coach,
  })
  status: AppointmentStatus;

  @ApiProperty({ example: '2026-04-01T08:00:00.000Z' })
  scheduled_at: string;

  @ApiProperty({ example: 60 })
  duration_minutes: number;

  @ApiPropertyOptional({
    example: 'Focus on mobility and shoulder stability.',
    nullable: true,
  })
  member_notes: string | null;

  @ApiPropertyOptional({
    example: '55555555-5555-4555-8555-555555555555',
    nullable: true,
  })
  recurring_plan_id?: string | null;

  @ApiPropertyOptional({
    enum: RecurringCoachingSessionState,
    nullable: true,
  })
  recurring_state?: RecurringCoachingSessionState | null;

  @ApiPropertyOptional({ example: '2026-04-01T08:00:00.000Z', nullable: true })
  original_scheduled_at?: string | null;

  @ApiProperty({ type: StaffAppointmentMemberResponseDTO })
  user: StaffAppointmentMemberResponseDTO;

  @ApiProperty({ type: StaffAppointmentCoachResponseDTO })
  coach: StaffAppointmentCoachResponseDTO;

  @ApiProperty({ example: '2026-03-25T10:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-25T10:00:00.000Z' })
  updated_at: string;
}

export class StaffAppointmentFilterDTO extends DateRangeDTO {
  @ApiPropertyOptional({ example: '22222222-2222-4222-8222-222222222222' })
  @IsOptional()
  @IsUUID('all', { message: 'coach_id must be a valid UUID' })
  coach_id?: string;

  @ApiPropertyOptional({
    enum: AppointmentStatus,
    example: AppointmentStatus.pending_coach,
  })
  @IsOptional()
  @IsEnum(AppointmentStatus, {
    message: `status must be one of: ${Object.values(AppointmentStatus).join(', ')}`,
  })
  status?: AppointmentStatus;
}
