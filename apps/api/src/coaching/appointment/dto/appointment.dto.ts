import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AppointmentStatus,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  RecurringCoachingSessionState,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsBoolean,
  IsArray,
  IsEnum,
  IsISO8601,
  IsIn,
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
import { CommerceCheckoutReturnInputDTO } from '../../commerce/dto/checkout-return.dto';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export enum CoachAppointmentBookingMode {
  single = 'single',
  pack = 'pack',
  recurring = 'recurring',
}

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

export class CoachAvailabilityQueryDTO {
  @ApiProperty({ example: '2026-08-20' })
  @IsISO8601(
    { strict: false },
    { message: 'date must be a valid ISO 8601 date string' },
  )
  date: string;

  @ApiProperty({ example: 60 })
  @Type(() => Number)
  @IsInt({ message: 'duration_minutes must be an integer' })
  @Min(30, { message: 'duration_minutes must be at least 30' })
  @Max(180, { message: 'duration_minutes must not exceed 180' })
  duration_minutes: number;
}

export class CoachAvailabilitySlotResponseDTO {
  @ApiProperty({ example: true })
  available: boolean;

  @ApiProperty({ example: [] })
  conflict_reasons: string[];

  @ApiProperty({ example: 60 })
  duration_minutes: number;

  @ApiProperty({ example: '2026-08-20T02:00:00.000Z' })
  end_at: string;

  @ApiProperty({ example: '2026-08-20T01:00:00.000Z' })
  start_at: string;
}

export class CreateAppointmentDTO extends CommerceCheckoutReturnInputDTO {
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

  @ApiPropertyOptional({
    enum: CoachAppointmentBookingMode,
    example: CoachAppointmentBookingMode.single,
  })
  @IsOptional()
  @IsEnum(CoachAppointmentBookingMode, {
    message: `booking_mode must be one of: ${Object.values(CoachAppointmentBookingMode).join(', ')}`,
  })
  booking_mode?: CoachAppointmentBookingMode;

  @ApiPropertyOptional({
    example: 3,
    description:
      'Requested number of coaching sessions for pack or recurring booking intent.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'session_count must be an integer' })
  @Min(1, { message: 'session_count must be at least 1' })
  @Max(12, { message: 'session_count must not exceed 12' })
  session_count?: number;
}

export class CreateCoachManagedAppointmentDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID('all', { message: 'member_id must be a valid UUID' })
  member_id: string;

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

  @ApiPropertyOptional({
    example: 'Coach scheduled a follow-up mobility and strength session.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'member_notes must be a string' })
  @MaxLength(500, { message: 'member_notes must not exceed 500 characters' })
  member_notes?: string;
}

export class RescheduleAppointmentDTO {
  @ApiProperty({
    example: '2026-04-08T08:00:00.000Z',
    description:
      'New start time for this paid one-time appointment. This changes this session only.',
  })
  @IsISO8601(
    {},
    { message: 'scheduled_at must be a valid ISO 8601 date string' },
  )
  scheduled_at: string;

  @ApiProperty({
    example: 60,
    description:
      'New duration for this session only; the paid entitlement is preserved.',
  })
  @Type(() => Number)
  @IsInt({ message: 'duration_minutes must be an integer' })
  @Min(30, { message: 'duration_minutes must be at least 30' })
  @Max(180, { message: 'duration_minutes must not exceed 180' })
  duration_minutes: number;
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
    enum: [PaymentProvider.paymongo],
    example: PaymentProvider.paymongo,
  })
  @IsIn([PaymentProvider.paymongo], {
    message: 'provider must be paymongo for appointment checkout',
  })
  provider: PaymentProvider;

  @ApiPropertyOptional({
    enum: [PaymentStage.full],
    example: PaymentStage.full,
    description:
      'Legacy product-visible appointment payment is retired; this field remains full-only for compatibility.',
  })
  @IsOptional()
  @IsIn([PaymentStage.full], {
    message: 'payment_stage must be full',
  })
  payment_stage?: 'full';
}

export class AppointmentBalanceDTO {
  @ApiProperty({
    enum: [PaymentProvider.paymongo],
    example: PaymentProvider.paymongo,
  })
  @IsIn([PaymentProvider.paymongo], {
    message: 'provider must be paymongo for legacy compatibility only',
  })
  provider: PaymentProvider;
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

  @ApiPropertyOptional({
    example: 'Client held stable form on all working sets.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'coach_feedback must be a string' })
  @MaxLength(2000, { message: 'coach_feedback must not exceed 2000 characters' })
  coach_feedback?: string;

  @ApiPropertyOptional({
    example: 'Assessment: progressed from goblet squats to barbell back squats.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'assessment_report must be a string' })
  @MaxLength(4000, {
    message: 'assessment_report must not exceed 4000 characters',
  })
  assessment_report?: string;
}

export class SubmitCoachFeedbackDTO {
  @ApiProperty({
    example: 'Keep the same warm-up and add one mobility set next session.',
  })
  @TrimString()
  @IsString({ message: 'coach_feedback must be a string' })
  @IsNotEmpty({ message: 'coach_feedback is required' })
  @MaxLength(2000, { message: 'coach_feedback must not exceed 2000 characters' })
  coach_feedback: string;

  @ApiPropertyOptional({
    example: 'Session report: improved lower-body control and tempo.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'assessment_report must be a string' })
  @MaxLength(4000, {
    message: 'assessment_report must not exceed 4000 characters',
  })
  assessment_report?: string;
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

  @ApiPropertyOptional({
    example: '44444444-4444-4444-8444-444444444444',
    nullable: true,
  })
  payment_id?: string | null;
}

export class AppointmentCoachResponseDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  id: string;

  @ApiPropertyOptional({ example: '900.00', nullable: true })
  hourly_rate: string | null;

  @ApiPropertyOptional({ example: 'Morgan Cruz', nullable: true })
  display_name: string | null;

  @ApiPropertyOptional({ example: 'coach@fittrack.com', nullable: true })
  contact_email: string | null;
}

export class AppointmentReviewResponseDTO {
  @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
  id: string;

  @ApiProperty({ example: 5 })
  rating: number;

  @ApiPropertyOptional({ example: 'Great coaching session.', nullable: true })
  comment: string | null;

  @ApiProperty({ example: '2026-04-01T10:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-01T10:00:00.000Z' })
  updated_at: string;
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
    enum: PaymentStage,
    nullable: true,
    description:
      'Latest non-failed payment stage requested for this appointment. Used by clients to reflect whether the member selected a full-payment or downpayment flow before verification completes.',
  })
  active_payment_stage?: PaymentStage | null;

  @ApiPropertyOptional({
    example: '77777777-7777-4777-8777-777777777777',
    nullable: true,
    description:
      'Latest non-failed payment id for this appointment, when a payment request exists.',
  })
  active_payment_id?: string | null;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    nullable: true,
    description:
      'Latest non-failed payment status for this appointment, used to gate staff/admin payment approval.',
  })
  active_payment_status?: PaymentStatus | null;

  @ApiPropertyOptional({
    enum: PaymentProvider,
    nullable: true,
    description:
      'Latest non-failed payment provider for this appointment, when a payment request exists.',
  })
  active_payment_provider?: PaymentProvider | null;

  @ApiPropertyOptional({
    example: 'Completed a full lower-body strength session.',
    nullable: true,
  })
  session_notes: string | null;

  @ApiPropertyOptional({
    example: 'Keep the same warm-up and add one mobility set next session.',
    nullable: true,
  })
  coach_feedback: string | null;

  @ApiPropertyOptional({
    example: 'Session report: improved lower-body control and tempo.',
    nullable: true,
  })
  assessment_report: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T09:00:00.000Z', nullable: true })
  completed_at: string | null;

  @ApiPropertyOptional({ example: '2026-04-05T09:00:00.000Z', nullable: true })
  coach_payout_paid_at?: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T09:30:00.000Z', nullable: true })
  no_show_at: string | null;

  @ApiPropertyOptional({
    example: 'Need to reschedule for next week.',
    nullable: true,
  })
  cancellation_reason: string | null;

  @ApiPropertyOptional({ example: '2026-03-30T10:00:00.000Z', nullable: true })
  cancelled_at: string | null;

  @ApiPropertyOptional({ type: AppointmentCoachResponseDTO, nullable: true })
  coach?: AppointmentCoachResponseDTO | null;

  @ApiPropertyOptional({ type: AppointmentReviewResponseDTO, nullable: true })
  review?: AppointmentReviewResponseDTO | null;

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

  @ApiPropertyOptional({ example: 'member@fittrack.test', nullable: true })
  email: string | null;

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

  @ApiPropertyOptional({ example: '900.00', nullable: true })
  total_amount?: string | null;

  @ApiPropertyOptional({ example: '270.00', nullable: true })
  downpayment_amount?: string | null;

  @ApiPropertyOptional({ example: '630.00', nullable: true })
  balance_amount?: string | null;

  @ApiPropertyOptional({ example: '180.00', nullable: true })
  gym_revenue?: string | null;

  @ApiPropertyOptional({ example: '720.00', nullable: true })
  coach_earnings?: string | null;

  @ApiPropertyOptional({ example: '2026-05-01T10:00:00.000Z', nullable: true })
  downpayment_paid_at?: string | null;

  @ApiPropertyOptional({ example: '2026-05-01T10:00:00.000Z', nullable: true })
  balance_paid_at?: string | null;

  @ApiPropertyOptional({
    enum: PaymentStage,
    nullable: true,
    description:
      'Latest non-failed payment stage requested for this coach appointment.',
  })
  active_payment_stage?: PaymentStage | null;

  @ApiPropertyOptional({
    example: '77777777-7777-4777-8777-777777777777',
    nullable: true,
  })
  active_payment_id?: string | null;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    nullable: true,
  })
  active_payment_status?: PaymentStatus | null;

  @ApiPropertyOptional({
    enum: PaymentProvider,
    nullable: true,
  })
  active_payment_provider?: PaymentProvider | null;

  @ApiPropertyOptional({
    example: 'Focus on mobility and shoulder stability.',
    nullable: true,
  })
  member_notes: string | null;

  @ApiPropertyOptional({
    example: 'Completed a full lower-body strength session.',
    nullable: true,
  })
  session_notes: string | null;

  @ApiPropertyOptional({
    example: 'Keep the same warm-up and add one mobility set next session.',
    nullable: true,
  })
  coach_feedback: string | null;

  @ApiPropertyOptional({
    example: 'Session report: improved lower-body control and tempo.',
    nullable: true,
  })
  assessment_report: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T09:00:00.000Z', nullable: true })
  completed_at: string | null;

  @ApiPropertyOptional({ example: '2026-04-05T09:00:00.000Z', nullable: true })
  coach_payout_paid_at?: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T09:30:00.000Z', nullable: true })
  no_show_at?: string | null;

  @ApiPropertyOptional({ example: 'Member cancelled from front desk.', nullable: true })
  cancellation_reason?: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T07:30:00.000Z', nullable: true })
  cancelled_at?: string | null;

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

  @ApiPropertyOptional({ type: AppointmentReviewResponseDTO, nullable: true })
  review?: AppointmentReviewResponseDTO | null;

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

  @ApiPropertyOptional({ example: 'Coach Mara Santos', nullable: true })
  display_name: string | null;

  @ApiPropertyOptional({ example: 'coach.mara@fittrack.com', nullable: true })
  contact_email: string | null;

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

  @ApiPropertyOptional({ example: '900.00', nullable: true })
  total_amount?: string | null;

  @ApiPropertyOptional({ example: '270.00', nullable: true })
  downpayment_amount?: string | null;

  @ApiPropertyOptional({ example: '630.00', nullable: true })
  balance_amount?: string | null;

  @ApiPropertyOptional({ example: '180.00', nullable: true })
  gym_revenue?: string | null;

  @ApiPropertyOptional({ example: '720.00', nullable: true })
  coach_earnings?: string | null;

  @ApiPropertyOptional({ example: '2026-05-01T10:00:00.000Z', nullable: true })
  downpayment_paid_at?: string | null;

  @ApiPropertyOptional({ example: '2026-05-01T10:00:00.000Z', nullable: true })
  balance_paid_at?: string | null;

  @ApiPropertyOptional({
    enum: PaymentStage,
    nullable: true,
    description:
      'Latest non-failed payment stage requested for this appointment. Used by staff surfaces to reflect whether the current appointment is in a full-payment or downpayment flow before verification completes.',
  })
  active_payment_stage?: PaymentStage | null;

  @ApiPropertyOptional({
    example: '77777777-7777-4777-8777-777777777777',
    nullable: true,
    description:
      'Latest non-failed payment id for this appointment, when a payment request exists.',
  })
  active_payment_id?: string | null;

  @ApiPropertyOptional({
    enum: PaymentStatus,
    nullable: true,
    description:
      'Latest non-failed payment status for this appointment, used to decide whether staff/admin can approve payment.',
  })
  active_payment_status?: PaymentStatus | null;

  @ApiPropertyOptional({
    enum: PaymentProvider,
    nullable: true,
    description:
      'Latest non-failed payment provider for this appointment, when a payment request exists.',
  })
  active_payment_provider?: PaymentProvider | null;

  @ApiPropertyOptional({
    example: 'Focus on mobility and shoulder stability.',
    nullable: true,
  })
  member_notes: string | null;

  @ApiPropertyOptional({
    example: 'Completed a full lower-body strength session.',
    nullable: true,
  })
  session_notes: string | null;

  @ApiPropertyOptional({
    example: 'Keep the same warm-up and add one mobility set next session.',
    nullable: true,
  })
  coach_feedback: string | null;

  @ApiPropertyOptional({
    example: 'Session report: improved lower-body control and tempo.',
    nullable: true,
  })
  assessment_report: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T09:00:00.000Z', nullable: true })
  completed_at: string | null;

  @ApiPropertyOptional({ example: '2026-04-05T09:00:00.000Z', nullable: true })
  coach_payout_paid_at?: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T09:30:00.000Z', nullable: true })
  no_show_at?: string | null;

  @ApiPropertyOptional({ example: 'Member cancelled from front desk.', nullable: true })
  cancellation_reason?: string | null;

  @ApiPropertyOptional({ example: '2026-04-01T07:30:00.000Z', nullable: true })
  cancelled_at?: string | null;

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

  @ApiPropertyOptional({ type: AppointmentReviewResponseDTO, nullable: true })
  review?: AppointmentReviewResponseDTO | null;

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
