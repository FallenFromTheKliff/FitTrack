import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ExerciseCategory, FitnessGoal, PlanSource } from '@prisma/client';

import { TrimString } from '../../../common/validators';

export class CreateTrainingPlanExerciseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  @IsUUID(undefined, { message: 'exercise_id must be a valid UUID' })
  exercise_id: string;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt({ message: 'sets must be an integer' })
  @Min(1, { message: 'sets must be at least 1' })
  sets: number;

  @ApiPropertyOptional({ example: 10, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'reps must be an integer' })
  @Min(1, { message: 'reps must be at least 1' })
  reps?: number;

  @ApiPropertyOptional({ example: 90, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'duration_seconds must be an integer' })
  @Min(1, { message: 'duration_seconds must be at least 1' })
  duration_seconds?: number;

  @ApiPropertyOptional({ example: 60, nullable: true, default: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'rest_seconds must be an integer' })
  @Min(0, { message: 'rest_seconds must be at least 0' })
  rest_seconds?: number;

  @ApiPropertyOptional({ example: 80, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'weight_kg_target must be a number' })
  @Min(0, { message: 'weight_kg_target must be at least 0' })
  weight_kg_target?: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'order_index must be an integer' })
  @Min(0, { message: 'order_index must be at least 0' })
  order_index?: number;
}

export class CreateTrainingPlanScheduleDayDTO {
  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'week_number must be an integer' })
  @Min(1, { message: 'week_number must be at least 1' })
  week_number: number;

  @ApiProperty({ example: 1, description: '0 = Sunday, 6 = Saturday' })
  @Type(() => Number)
  @IsInt({ message: 'day_of_week must be an integer' })
  @Min(0, { message: 'day_of_week must be at least 0' })
  @Max(6, { message: 'day_of_week must not exceed 6' })
  day_of_week: number;

  @ApiPropertyOptional({ example: 'Push Day', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'focus_label must be a string' })
  @MaxLength(100, {
    message: 'focus_label must not exceed 100 characters',
  })
  focus_label?: string;

  @ApiProperty({
    type: CreateTrainingPlanExerciseDTO,
    isArray: true,
  })
  @IsArray({ message: 'exercises must be an array' })
  @ArrayMinSize(1, { message: 'exercises must contain at least 1 item' })
  @ValidateNested({ each: true })
  @Type(() => CreateTrainingPlanExerciseDTO)
  exercises: CreateTrainingPlanExerciseDTO[];
}

export class CreateTrainingPlanDTO {
  @ApiProperty({ example: 'Upper / Lower Strength Builder' })
  @TrimString()
  @IsString({ message: 'title must be a string' })
  @IsNotEmpty({ message: 'title is required' })
  @MaxLength(255, { message: 'title must not exceed 255 characters' })
  title: string;

  @ApiProperty({ enum: FitnessGoal, example: FitnessGoal.bulking })
  @IsEnum(FitnessGoal, {
    message: `goal must be one of: ${Object.values(FitnessGoal).join(', ')}`,
  })
  goal: FitnessGoal;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt({ message: 'duration_weeks must be an integer' })
  @Min(1, { message: 'duration_weeks must be at least 1' })
  @Max(52, { message: 'duration_weeks must not exceed 52' })
  duration_weeks: number;

  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt({ message: 'days_per_week must be an integer' })
  @Min(1, { message: 'days_per_week must be at least 1' })
  @Max(7, { message: 'days_per_week must not exceed 7' })
  days_per_week: number;

  @ApiProperty({
    type: CreateTrainingPlanScheduleDayDTO,
    isArray: true,
  })
  @IsArray({ message: 'schedule must be an array' })
  @ArrayMinSize(1, { message: 'schedule must contain at least 1 item' })
  @ValidateNested({ each: true })
  @Type(() => CreateTrainingPlanScheduleDayDTO)
  schedule: CreateTrainingPlanScheduleDayDTO[];
}

export class AssignTrainingPlanDTO {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID(undefined, { message: 'member_id must be a valid UUID' })
  member_id: string;
}

export class TrainingPlanExerciseResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  exercise_id: string;

  @ApiProperty({ example: 'Barbell Back Squat' })
  exercise_name: string;

  @ApiProperty({ example: 'legs' })
  muscle_group: string;

  @ApiProperty({ enum: ExerciseCategory, example: ExerciseCategory.strength })
  category: ExerciseCategory;

  @ApiProperty({ example: 4 })
  sets: number;

  @ApiPropertyOptional({ example: 10, nullable: true })
  reps: number | null;

  @ApiPropertyOptional({ example: 90, nullable: true })
  duration_seconds: number | null;

  @ApiProperty({ example: 60 })
  rest_seconds: number;

  @ApiPropertyOptional({ example: '80', nullable: true })
  weight_kg_target: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  notes: string | null;

  @ApiProperty({ example: 0 })
  order_index: number;
}

export class TrainingPlanScheduleDayResponseDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  id: string;

  @ApiProperty({ example: 1 })
  week_number: number;

  @ApiProperty({ example: 1 })
  day_of_week: number;

  @ApiPropertyOptional({ example: 'Push Day', nullable: true })
  focus_label: string | null;

  @ApiPropertyOptional({ example: null, nullable: true })
  notes: string | null;

  @ApiProperty({
    type: TrainingPlanExerciseResponseDTO,
    isArray: true,
  })
  exercises: TrainingPlanExerciseResponseDTO[];
}

export class TrainingPlanSummaryResponseDTO {
  @ApiProperty({ example: '55555555-5555-4555-8555-555555555555' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiPropertyOptional({
    example: '66666666-6666-4666-8666-666666666666',
    nullable: true,
  })
  coach_id: string | null;

  @ApiProperty({ enum: PlanSource, example: PlanSource.self_created })
  source: PlanSource;

  @ApiProperty({ example: 'Upper / Lower Strength Builder' })
  title: string;

  @ApiProperty({ enum: FitnessGoal, example: FitnessGoal.bulking })
  goal: FitnessGoal;

  @ApiProperty({ example: 8 })
  duration_weeks: number;

  @ApiProperty({ example: 4 })
  days_per_week: number;

  @ApiProperty({ example: false })
  is_active: boolean;

  @ApiProperty({ example: false })
  is_template: boolean;

  @ApiProperty({ example: '2026-03-26T02:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-26T03:00:00.000Z' })
  updated_at: string;
}

export class TrainingPlanDetailResponseDTO extends TrainingPlanSummaryResponseDTO {
  @ApiProperty({
    type: TrainingPlanScheduleDayResponseDTO,
    isArray: true,
  })
  schedule_days: TrainingPlanScheduleDayResponseDTO[];
}

export class TrainingProgressionSuggestionResponseDTO {
  @ApiProperty({ example: '77777777-7777-4777-8777-777777777777' })
  plan_exercise_id: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  exercise_id: string;

  @ApiProperty({ example: 'Barbell Bench Press' })
  exercise_name: string;

  @ApiProperty({
    enum: ['increase_load', 'increase_reps', 'maintain'],
    example: 'increase_load',
  })
  action: 'increase_load' | 'increase_reps' | 'maintain';

  @ApiPropertyOptional({ example: 10, nullable: true })
  suggested_reps: number | null;

  @ApiPropertyOptional({ example: 42.5, nullable: true })
  suggested_weight_kg: number | null;

  @ApiProperty({ enum: ['high', 'medium', 'low'], example: 'medium' })
  confidence: 'high' | 'medium' | 'low';

  @ApiProperty({
    example:
      'Recent completed sets met the prescribed rep target. Add a small load increase.',
  })
  rationale: string;

  @ApiProperty({ example: 'history-rule-v1' })
  source_revision: 'history-rule-v1';
}
