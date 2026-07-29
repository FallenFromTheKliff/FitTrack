import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { FitnessGoal, PlanSource, SessionStatus } from '@prisma/client';

export class StartSessionDTO {
  @ApiPropertyOptional({ example: '11111111-1111-4111-8111-111111111111' })
  @IsOptional()
  @IsUUID(undefined, { message: 'plan_id must be a valid UUID' })
  plan_id?: string;
}

export class LogExerciseSetDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID(undefined, { message: 'exercise_id must be a valid UUID' })
  exercise_id: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'set_number must be an integer' })
  @Min(1, { message: 'set_number must be at least 1' })
  set_number: number;

  @ApiPropertyOptional({ example: 12, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'reps_completed must be an integer' })
  @Min(0, { message: 'reps_completed must be at least 0' })
  reps_completed?: number;

  @ApiPropertyOptional({ example: 40, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowInfinity: false, allowNaN: false, maxDecimalPlaces: 2 },
    { message: 'weight_kg must be a finite number' },
  )
  @Min(0, { message: 'weight_kg must be at least 0' })
  @Max(1000, { message: 'weight_kg must not exceed 1000' })
  weight_kg?: number;

  @ApiPropertyOptional({ example: 45, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'duration_seconds must be an integer' })
  @Min(1, { message: 'duration_seconds must be at least 1' })
  duration_seconds?: number;

  @ApiPropertyOptional({ example: '33333333-3333-4333-8333-333333333333' })
  @IsOptional()
  @IsUUID('4', { message: 'pose_session_id must be a valid UUID' })
  pose_session_id?: string;
}

export class WorkoutSessionPlanSummaryResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: 'Upper / Lower Strength Builder' })
  title: string;

  @ApiProperty({ enum: FitnessGoal, example: FitnessGoal.bulking })
  goal: FitnessGoal;

  @ApiProperty({ enum: PlanSource, example: PlanSource.self_created })
  source: PlanSource;
}

export class ExerciseLogPoseSessionResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: 14 })
  rep_count_ai: number;

  @ApiPropertyOptional({ example: '0.934', nullable: true })
  confidence_avg: string | null;

  @ApiProperty({ example: '2026-03-26T08:00:00.000Z' })
  started_at: string;

  @ApiPropertyOptional({ example: '2026-03-26T08:03:00.000Z', nullable: true })
  ended_at: string | null;
}

export class ExerciseLogResponseDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  id: string;

  @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
  session_id: string;

  @ApiProperty({ example: '66666666-6666-4666-8666-666666666666' })
  user_id: string;

  @ApiPropertyOptional({
    example: '77777777-7777-4777-8777-777777777777',
    nullable: true,
  })
  plan_exercise_id: string | null;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  exercise_id: string;

  @ApiProperty({ example: 'Barbell Back Squat' })
  exercise_name: string;

  @ApiProperty({ example: 1 })
  set_number: number;

  @ApiPropertyOptional({ example: 12, nullable: true })
  reps_completed: number | null;

  @ApiPropertyOptional({ example: 14, nullable: true })
  reps_ai_counted: number | null;

  @ApiPropertyOptional({ example: '40', nullable: true })
  weight_kg: string | null;

  @ApiPropertyOptional({ example: 45, nullable: true })
  duration_seconds: number | null;

  @ApiPropertyOptional({
    type: ExerciseLogPoseSessionResponseDTO,
    nullable: true,
  })
  pose_session: ExerciseLogPoseSessionResponseDTO | null;

  @ApiProperty({ example: '2026-03-26T08:10:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-26T08:10:00.000Z' })
  updated_at: string;
}

export class WorkoutSessionSummaryResponseDTO {
  @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
  id: string;

  @ApiProperty({ example: '88888888-8888-4888-8888-888888888888' })
  user_id: string;

  @ApiPropertyOptional({
    example: '11111111-1111-4111-8111-111111111111',
    nullable: true,
  })
  plan_id: string | null;

  @ApiProperty({ enum: SessionStatus, example: SessionStatus.in_progress })
  status: SessionStatus;

  @ApiProperty({ example: '2026-03-26T08:00:00.000Z' })
  started_at: string;

  @ApiPropertyOptional({ example: '2026-03-26T09:00:00.000Z', nullable: true })
  completed_at: string | null;

  @ApiPropertyOptional({ example: '2026-03-26T08:40:00.000Z', nullable: true })
  cancelled_at: string | null;

  @ApiPropertyOptional({ example: 3600, nullable: true })
  duration_seconds: number | null;

  @ApiPropertyOptional({ example: '1440.00', nullable: true })
  total_volume_kg: string | null;

  @ApiProperty({ example: '2026-03-26T08:25:00.000Z' })
  last_activity_at: string;

  @ApiProperty({ example: 3 })
  exercise_log_count: number;

  @ApiPropertyOptional({
    type: WorkoutSessionPlanSummaryResponseDTO,
    nullable: true,
  })
  plan: WorkoutSessionPlanSummaryResponseDTO | null;

  @ApiProperty({ example: '2026-03-26T08:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-26T08:25:00.000Z' })
  updated_at: string;
}

export class WorkoutSessionDetailResponseDTO extends WorkoutSessionSummaryResponseDTO {
  @ApiProperty({
    type: ExerciseLogResponseDTO,
    isArray: true,
  })
  exercise_logs: ExerciseLogResponseDTO[];
}
