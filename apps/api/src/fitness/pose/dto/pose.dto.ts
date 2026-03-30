import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PoseProfileKind } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { TrimString } from '../../../common/validators';
import { PaginationDTO } from '../../../user/dto/user-dto';

export const poseSessionEndReasons = [
  'client_disconnect',
  'manual_stop',
  'session_completed',
] as const;

export type PoseSessionEndReason = (typeof poseSessionEndReasons)[number];

export class FinalizePoseSessionDTO {
  @ApiPropertyOptional({
    enum: poseSessionEndReasons,
    example: 'manual_stop',
  })
  @IsOptional()
  @IsIn(poseSessionEndReasons, {
    message: `ended_reason must be one of: ${poseSessionEndReasons.join(', ')}`,
  })
  ended_reason?: PoseSessionEndReason;
}

export class PoseProfileFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ example: 'squat' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'canonical_name must be a string' })
  @MaxLength(100, {
    message: 'canonical_name must not exceed 100 characters',
  })
  canonical_name?: string;

  @ApiPropertyOptional({ enum: PoseProfileKind, example: PoseProfileKind.seed })
  @IsOptional()
  @IsEnum(PoseProfileKind, {
    message: `profile_kind must be one of: ${Object.values(PoseProfileKind).join(', ')}`,
  })
  profile_kind?: PoseProfileKind;
}

export class PoseSessionResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  user_id: string;

  @ApiPropertyOptional({
    example: '44444444-4444-4444-8444-444444444444',
    nullable: true,
  })
  exercise_log_id: string | null;

  @ApiPropertyOptional({ example: 'Barbell Back Squat', nullable: true })
  exercise_hint: string | null;

  @ApiProperty({ example: 12 })
  rep_count_ai: number;

  @ApiPropertyOptional({ example: '0.925', nullable: true })
  confidence_avg: string | null;

  @ApiPropertyOptional({ example: 'squat', nullable: true })
  detected_exercise_name: string | null;

  @ApiPropertyOptional({
    example: '55555555-5555-4555-8555-555555555555',
    nullable: true,
  })
  detected_profile_id: string | null;

  @ApiPropertyOptional({ example: '0.944', nullable: true })
  classification_confidence: string | null;

  @ApiPropertyOptional({ example: '0.887', nullable: true })
  subject_lock_confidence: string | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: {
      reps_detected: 12,
      form_feedback: ['Keep your knees tracking over your toes.'],
    },
  })
  analysis_summary: Record<string, unknown> | null;

  @ApiProperty({ example: '2026-03-27T08:00:00.000Z' })
  started_at: string;

  @ApiPropertyOptional({
    example: '2026-03-27T08:03:00.000Z',
    nullable: true,
  })
  ended_at: string | null;

  @ApiProperty({ example: '2026-03-27T08:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T08:03:00.000Z' })
  updated_at: string;
}

export class PoseProfileResponseDTO {
  @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
  id: string;

  @ApiPropertyOptional({
    example: '77777777-7777-4777-8777-777777777777',
    nullable: true,
  })
  exercise_id: string | null;

  @ApiPropertyOptional({ example: 'Barbell Back Squat', nullable: true })
  exercise_name: string | null;

  @ApiProperty({ example: 'squat' })
  canonical_name: string;

  @ApiProperty({ enum: PoseProfileKind, example: PoseProfileKind.seed })
  profile_kind: PoseProfileKind;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { left_shoulder: [0.1, 0.3], right_shoulder: [0.9, 0.3] },
  })
  landmark_signature: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { hip_knee_ankle: 92.4 },
  })
  angle_signature: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: { rep_start_angle: 88, rep_end_angle: 172 },
  })
  rep_rules: Record<string, unknown> | null;

  @ApiProperty({ example: 14 })
  sample_count: number;

  @ApiPropertyOptional({ example: '0.850', nullable: true })
  confidence_threshold: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-27T08:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T08:03:00.000Z' })
  updated_at: string;
}
