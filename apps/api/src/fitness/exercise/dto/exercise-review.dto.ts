import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ExerciseCategory,
  ExerciseReviewSubmissionStatus,
} from '@prisma/client';
import {
  IsArray,
  IsEnum,
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
}

export class ExerciseReviewSubmissionResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

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
    type: [Number],
    example: [14, 18, 43, 27, 21, 30],
    nullable: true,
  })
  @IsArray()
  evidence_bars: number[] | null;

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
}
