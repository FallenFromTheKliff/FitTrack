import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CreatorState,
  ExerciseCategory,
  ExerciseReviewSubmissionStatus,
} from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { TrimString } from '../../../common/validators';
import { PaginationDTO } from '../../../user/dto/user-dto';

export class ExerciseReviewSubmissionFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({
    enum: ExerciseReviewSubmissionStatus,
    example: ExerciseReviewSubmissionStatus.pending,
  })
  @IsOptional()
  @IsEnum(ExerciseReviewSubmissionStatus, {
    message: `status must be one of: ${Object.values(ExerciseReviewSubmissionStatus).join(', ')}`,
  })
  status?: ExerciseReviewSubmissionStatus;

  @ApiPropertyOptional({ example: 'hammer curl' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search must not exceed 100 characters' })
  search?: string;

  @ApiPropertyOptional({
    enum: ExerciseCategory,
    example: ExerciseCategory.strength,
  })
  @IsOptional()
  @IsEnum(ExerciseCategory, {
    message: `category must be one of: ${Object.values(ExerciseCategory).join(', ')}`,
  })
  category?: ExerciseCategory;

  @ApiPropertyOptional({ example: 'arms' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'muscle_group must be a string' })
  @MaxLength(100, {
    message: 'muscle_group must not exceed 100 characters',
  })
  muscle_group?: string;
}

export class CreateExerciseReviewSubmissionDTO {
  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', { message: 'pose_session_id must be a valid UUID' })
  pose_session_id?: string | null;

  @ApiPropertyOptional({ example: 'Mobile pose-created dumbbell curl' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'title must be a string' })
  @MaxLength(255, { message: 'title must not exceed 255 characters' })
  title?: string;

  @ApiProperty({ example: 'Dumbbell Bicep Curl Variation' })
  @TrimString()
  @IsString({ message: 'proposed_name must be a string' })
  @IsNotEmpty({ message: 'proposed_name is required' })
  @MaxLength(255, {
    message: 'proposed_name must not exceed 255 characters',
  })
  proposed_name: string;

  @ApiProperty({
    example: 'Three clean reps captured with a stable elbow-dominant pattern.',
  })
  @TrimString()
  @IsString({ message: 'summary must be a string' })
  @IsNotEmpty({ message: 'summary is required' })
  @MaxLength(255, { message: 'summary must not exceed 255 characters' })
  summary: string;

  @ApiPropertyOptional({ example: 'member creator session' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'origin_label must be a string' })
  @MaxLength(100, { message: 'origin_label must not exceed 100 characters' })
  origin_label?: string;

  @ApiPropertyOptional({ example: '3 reps captured' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'trigger_label must be a string' })
  @MaxLength(100, { message: 'trigger_label must not exceed 100 characters' })
  trigger_label?: string;

  @ApiPropertyOptional({ example: 'mobile pose rig' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'source_label must be a string' })
  @MaxLength(100, { message: 'source_label must not exceed 100 characters' })
  source_label?: string;

  @ApiPropertyOptional({ example: 'ai draft' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'queue_tag must be a string' })
  @MaxLength(100, { message: 'queue_tag must not exceed 100 characters' })
  queue_tag?: string;

  @ApiPropertyOptional({ example: 'dumbbell curl', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'match_hint must be a string' })
  @MaxLength(255, { message: 'match_hint must not exceed 255 characters' })
  match_hint?: string;

  @ApiProperty({ enum: ExerciseCategory, example: ExerciseCategory.strength })
  @IsEnum(ExerciseCategory, {
    message: `category must be one of: ${Object.values(ExerciseCategory).join(', ')}`,
  })
  category: ExerciseCategory;

  @ApiProperty({ example: 'arms' })
  @TrimString()
  @IsString({ message: 'muscle_group must be a string' })
  @IsNotEmpty({ message: 'muscle_group is required' })
  @MaxLength(100, {
    message: 'muscle_group must not exceed 100 characters',
  })
  muscle_group: string;

  @ApiPropertyOptional({
    description:
      'Structured multi-muscle target allocation proposed by the exercise editor.',
    example: [
      { allocationPercent: 70, muscleGroup: 'biceps', role: 'primary' },
      { allocationPercent: 20, muscleGroup: 'forearms', role: 'secondary' },
    ],
    nullable: true,
    type: 'array',
  })
  @IsOptional()
  muscle_targets?: unknown;

  @ApiPropertyOptional({
    additionalProperties: true,
    description:
      'Pose movement contract and optional start/peak/end skeleton rig preview.',
    nullable: true,
    type: 'object',
  })
  @IsOptional()
  movement_profile?: unknown;

  @ApiPropertyOptional({
    additionalProperties: true,
    description:
      'Editable grip and subject-lock gesture thresholds for live pose integrity.',
    nullable: true,
    type: 'object',
  })
  @IsOptional()
  hand_shape_profile?: unknown;

  @ApiPropertyOptional({
    example:
      'Elbow-dominant curl pattern captured from a member-created movement.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    example:
      'Keep elbows near the torso, curl to peak contraction, then lower with control.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'instructions must be a string' })
  instructions?: string;

  @ApiPropertyOptional({
    additionalProperties: true,
    description:
      'Legacy evidence bar array or mobile pose draft evidence with rig keyframes.',
    nullable: true,
    type: 'object',
  })
  @IsOptional()
  evidence_bars?: unknown;
}

export class CreateExerciseDraftProposalDTO {
  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', { message: 'pose_session_id must be a valid UUID' })
  pose_session_id?: string | null;

  @ApiPropertyOptional({ example: 'Dumbbell Bicep Curl Variation' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'proposed_name must be a string' })
  @MaxLength(255, {
    message: 'proposed_name must not exceed 255 characters',
  })
  proposed_name?: string;

  @ApiPropertyOptional({
    example: 'Three clean reps captured with a stable elbow-dominant pattern.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'summary must be a string' })
  @MaxLength(255, { message: 'summary must not exceed 255 characters' })
  summary?: string;

  @ApiPropertyOptional({
    enum: ExerciseCategory,
    example: ExerciseCategory.strength,
  })
  @IsOptional()
  @IsEnum(ExerciseCategory, {
    message: `category must be one of: ${Object.values(ExerciseCategory).join(', ')}`,
  })
  category?: ExerciseCategory;

  @ApiPropertyOptional({ example: 'biceps' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'muscle_group must be a string' })
  @MaxLength(100, {
    message: 'muscle_group must not exceed 100 characters',
  })
  muscle_group?: string;

  @ApiPropertyOptional({
    description: 'Structured multi-muscle target allocation.',
    nullable: true,
    type: 'array',
  })
  @IsOptional()
  muscle_targets?: unknown;

  @ApiPropertyOptional({
    additionalProperties: true,
    description:
      'Pose movement contract and optional start/peak/end skeleton rig preview.',
    nullable: true,
    type: 'object',
  })
  @IsOptional()
  movement_profile?: unknown;

  @ApiPropertyOptional({
    additionalProperties: true,
    description:
      'Editable grip and subject-lock gesture thresholds for live pose integrity.',
    nullable: true,
    type: 'object',
  })
  @IsOptional()
  hand_shape_profile?: unknown;

  @ApiPropertyOptional({
    additionalProperties: true,
    description:
      'Mobile pose draft evidence with rig keyframes, angles, and integrity notes.',
    nullable: true,
    type: 'object',
  })
  @IsOptional()
  evidence?: unknown;

  @ApiPropertyOptional({
    example:
      'Elbow-dominant curl pattern captured from a member-created movement.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    example:
      'Keep elbows near the torso, curl to peak contraction, then lower with control.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'instructions must be a string' })
  instructions?: string;
}

export class ExerciseDraftProposalResponseDTO {
  @ApiProperty({
    enum: ['ai', 'deterministic_fallback'],
    example: 'deterministic_fallback',
  })
  proposal_source: 'ai' | 'deterministic_fallback';

  @ApiProperty({ example: 0.72 })
  confidence: number;

  @ApiProperty({ example: 'Dumbbell Bicep Curl Variation' })
  proposed_name: string;

  @ApiProperty({
    example: 'Three clean reps captured with elbow-dominant evidence.',
  })
  summary: string;

  @ApiProperty({ enum: ExerciseCategory, example: ExerciseCategory.strength })
  category: ExerciseCategory;

  @ApiProperty({ example: 'biceps' })
  muscle_group: string;

  @ApiPropertyOptional({
    description: 'Structured multi-muscle target allocation.',
    nullable: true,
    type: 'array',
  })
  muscle_targets: unknown[];

  @ApiPropertyOptional({
    additionalProperties: true,
    description: 'Pose movement contract and skeleton rig preview.',
    nullable: true,
    type: 'object',
  })
  movement_profile: Record<string, unknown>;

  @ApiPropertyOptional({
    additionalProperties: true,
    description: 'Grip and subject-lock gesture thresholds.',
    nullable: true,
    type: 'object',
  })
  hand_shape_profile: Record<string, unknown>;

  @ApiPropertyOptional({
    additionalProperties: true,
    description: 'Draft evidence used to create the proposal.',
    nullable: true,
    type: 'object',
  })
  evidence: Record<string, unknown>;

  @ApiProperty({
    example:
      'Dumbbell Bicep Curl Variation generated from pose evidence and editable movement thresholds.',
  })
  description: string;

  @ApiProperty({
    example:
      'Use the visual rig to confirm start, peak contraction, and return before publishing.',
  })
  instructions: string;

  @ApiProperty({
    example: ['AI unavailable; deterministic proposal generated.'],
    type: 'array',
  })
  review_warnings: string[];
}

export class UpdateExerciseReviewSubmissionDTO {
  @ApiPropertyOptional({
    enum: ExerciseReviewSubmissionStatus,
    example: ExerciseReviewSubmissionStatus.left_private,
  })
  @IsOptional()
  @IsEnum(ExerciseReviewSubmissionStatus, {
    message: `status must be one of: ${Object.values(ExerciseReviewSubmissionStatus).join(', ')}`,
  })
  status?: ExerciseReviewSubmissionStatus;

  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    nullable: true,
  })
  @IsOptional()
  @IsUUID('4', { message: 'published_exercise_id must be a valid UUID' })
  published_exercise_id?: string;

  @ApiPropertyOptional({
    example:
      'Published after matching the trunk-dominant pattern to Cable Chop.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'review_notes must be a string' })
  @MaxLength(500, { message: 'review_notes must not exceed 500 characters' })
  review_notes?: string;

  @ApiPropertyOptional({
    enum: CreatorState,
    example: CreatorState.candidate,
  })
  @IsOptional()
  @IsEnum(CreatorState, {
    message: `creator_state must be one of: ${Object.values(CreatorState).join(', ')}`,
  })
  creator_state?: CreatorState;

  @ApiPropertyOptional({
    example:
      'Candidate has two high-signal submissions and no integrity concerns.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'creator_governance_note must be a string' })
  @MaxLength(500, {
    message: 'creator_governance_note must not exceed 500 characters',
  })
  creator_governance_note?: string;
}

export class ExerciseReviewSubmissionResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiPropertyOptional({ example: 'Ava Rivera', nullable: true })
  creator_display_name: string | null;

  @ApiPropertyOptional({ example: 'seed.member.active@fittrack.com', nullable: true })
  creator_email: string | null;

  @ApiPropertyOptional({
    example: '33333333-3333-4333-8333-333333333333',
    nullable: true,
  })
  pose_session_id: string | null;

  @ApiPropertyOptional({
    example: '44444444-4444-4444-8444-444444444444',
    nullable: true,
  })
  published_exercise_id: string | null;

  @ApiProperty({
    enum: ExerciseReviewSubmissionStatus,
    example: ExerciseReviewSubmissionStatus.pending,
  })
  status: ExerciseReviewSubmissionStatus;

  @ApiProperty({ example: 'Single-leg hold variation' })
  title: string;

  @ApiProperty({ example: 'Single-leg balance hold' })
  proposed_name: string;

  @ApiProperty({
    example: 'Balance-focused custom hold with unilateral stability bias',
  })
  summary: string;

  @ApiProperty({ example: 'client custom' })
  origin_label: string;

  @ApiProperty({ example: 'unknown after 3 reps' })
  trigger_label: string;

  @ApiProperty({ example: 'asymmetry surfaced' })
  source_label: string;

  @ApiProperty({ example: 'edge case' })
  queue_tag: string;

  @ApiPropertyOptional({ example: 'single-leg reach hold', nullable: true })
  match_hint: string | null;

  @ApiProperty({ enum: ExerciseCategory, example: ExerciseCategory.balance })
  category: ExerciseCategory;

  @ApiProperty({ example: 'core' })
  muscle_group: string;

  @ApiPropertyOptional({
    description: 'Structured multi-muscle target allocation.',
    nullable: true,
    type: 'array',
  })
  muscle_targets: unknown[] | null;

  @ApiPropertyOptional({
    additionalProperties: true,
    description: 'Pose movement contract and skeleton rig preview.',
    nullable: true,
    type: 'object',
  })
  movement_profile: Record<string, unknown> | null;

  @ApiPropertyOptional({
    additionalProperties: true,
    description: 'Grip and subject-lock gesture thresholds.',
    nullable: true,
    type: 'object',
  })
  hand_shape_profile: Record<string, unknown> | null;

  @ApiPropertyOptional({
    example:
      'Static single-leg hold that emphasizes hip control, trunk alignment, and slow corrective balance reactions.',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    example:
      'Keep the standing knee soft, square the hips, and hold the trunk upright while resisting sway.',
    nullable: true,
  })
  instructions: string | null;

  @ApiPropertyOptional({
    oneOf: [
      { type: 'array', items: { type: 'number' } },
      { type: 'object', additionalProperties: true },
    ],
    example: [14, 18, 43, 27, 21, 30],
    nullable: true,
  })
  evidence_bars: number[] | Record<string, unknown> | null;

  @ApiPropertyOptional({
    example: 'Published from live review queue.',
    nullable: true,
  })
  review_notes: string | null;

  @ApiProperty({ example: '2026-04-21T00:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-21T00:00:00.000Z' })
  updated_at: string;

  @ApiPropertyOptional({
    example: '2026-04-21T00:00:00.000Z',
    nullable: true,
  })
  reviewed_at: string | null;

  @ApiProperty({ enum: CreatorState, example: CreatorState.candidate })
  creator_state: CreatorState;

  @ApiProperty({ example: 'Candidate' })
  creator_state_label: string;

  @ApiProperty({ example: 4 })
  creator_submission_count: number;

  @ApiProperty({ example: 2 })
  creator_published_count: number;

  @ApiProperty({ example: 1 })
  creator_rejected_count: number;

  @ApiProperty({ example: 78 })
  creator_candidate_score: number;

  @ApiPropertyOptional({
    example:
      'Candidate has two high-signal submissions and no integrity concerns.',
    nullable: true,
  })
  creator_governance_note: string | null;

  @ApiPropertyOptional({
    example: '2026-04-21T00:00:00.000Z',
    nullable: true,
  })
  creator_last_state_changed_at: string | null;

  @ApiPropertyOptional({
    example: '2026-04-21T00:00:00.000Z',
    nullable: true,
  })
  creator_profile_updated_at: string | null;
}
