import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  NutritionUnit,
} from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { TrimString } from '../../common/validators';

export class TdeeProfileResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: '75.50' })
  weight_kg: string;

  @ApiProperty({ example: '175.00' })
  height_cm: string;

  @ApiProperty({ example: 28 })
  age: number;

  @ApiProperty({ enum: Gender, example: Gender.male })
  gender: Gender;

  @ApiProperty({
    enum: ActivityLevel,
    example: ActivityLevel.moderate,
  })
  activity_level: ActivityLevel;

  @ApiProperty({ enum: FitnessGoal, example: FitnessGoal.cutting })
  fitness_goal: FitnessGoal;

  @ApiProperty({ example: '1700.25' })
  bmr_calories: string;

  @ApiProperty({ example: '2450.50' })
  tdee_calories: string;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-27T05:00:00.000Z' })
  calculated_at: string;

  @ApiProperty({ example: '2026-03-27T05:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T05:00:00.000Z' })
  updated_at: string;
}

export class MacroTargetResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  tdee_profile_id: string;

  @ApiProperty({ example: '2200.00' })
  target_calories: string;

  @ApiProperty({ example: '180.00' })
  protein_g: string;

  @ApiProperty({ example: '210.00' })
  carbs_g: string;

  @ApiProperty({ example: '65.00' })
  fat_g: string;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-27T05:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T05:00:00.000Z' })
  updated_at: string;
}

export class ActiveTdeeResponseDTO {
  @ApiProperty({ type: () => TdeeProfileResponseDTO })
  tdee: TdeeProfileResponseDTO;

  @ApiProperty({ type: () => MacroTargetResponseDTO })
  macros: MacroTargetResponseDTO;
}

export class RecalculateTdeeDTO {
  @ApiPropertyOptional({ enum: ActivityLevel })
  @IsOptional()
  @IsEnum(ActivityLevel, {
    message: `activity_level must be one of: ${Object.values(ActivityLevel).join(', ')}`,
  })
  activity_level?: ActivityLevel;

  @ApiPropertyOptional({ enum: FitnessGoal })
  @IsOptional()
  @IsEnum(FitnessGoal, {
    message: `fitness_goal must be one of: ${Object.values(FitnessGoal).join(', ')}`,
  })
  fitness_goal?: FitnessGoal;

  @ApiPropertyOptional({ example: 75.5 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'weight_kg must be a positive number' })
  @Max(500, { message: 'weight_kg must not exceed 500' })
  weight_kg?: number;

  @ApiPropertyOptional({ example: 175 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'height_cm must be a positive number' })
  @Max(300, { message: 'height_cm must not exceed 300' })
  height_cm?: number;

  @ApiPropertyOptional({ enum: Gender })
  @IsOptional()
  @IsEnum(Gender, {
    message: `gender must be one of: ${Object.values(Gender).join(', ')}`,
  })
  gender?: Gender;
}

export class LogNutritionDTO {
  @ApiProperty({ example: '2026-03-27' })
  @IsISO8601({}, { message: 'log_date must be a valid ISO 8601 date string' })
  log_date: string;

  @ApiProperty({ example: 'Breakfast' })
  @TrimString()
  @IsString({ message: 'meal_name must be a string' })
  @IsNotEmpty({ message: 'meal_name is required' })
  @MaxLength(100, { message: 'meal_name must not exceed 100 characters' })
  meal_name: string;

  @ApiProperty({ example: 'Greek yogurt' })
  @TrimString()
  @IsString({ message: 'food_item must be a string' })
  @IsNotEmpty({ message: 'food_item is required' })
  @MaxLength(255, { message: 'food_item must not exceed 255 characters' })
  food_item: string;

  @ApiProperty({ example: 320 })
  @Type(() => Number)
  @IsPositive({ message: 'calories must be a positive number' })
  calories: number;

  @ApiProperty({ example: 28 })
  @Type(() => Number)
  @Min(0, { message: 'protein_g must be at least 0' })
  protein_g: number;

  @ApiProperty({ example: 22 })
  @Type(() => Number)
  @Min(0, { message: 'carbs_g must be at least 0' })
  carbs_g: number;

  @ApiProperty({ example: 11 })
  @Type(() => Number)
  @Min(0, { message: 'fat_g must be at least 0' })
  fat_g: number;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsPositive({ message: 'quantity must be a positive number' })
  quantity: number;

  @ApiProperty({ enum: NutritionUnit, example: NutritionUnit.serving })
  @IsEnum(NutritionUnit, {
    message: `unit must be one of: ${Object.values(NutritionUnit).join(', ')}`,
  })
  unit: NutritionUnit;
}

export class UpdateNutritionLogDTO {
  @ApiPropertyOptional({ example: 'Lunch' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'meal_name must be a string' })
  @IsNotEmpty({ message: 'meal_name must not be empty' })
  @MaxLength(100, { message: 'meal_name must not exceed 100 characters' })
  meal_name?: string;

  @ApiPropertyOptional({ example: 'Chicken breast' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'food_item must be a string' })
  @IsNotEmpty({ message: 'food_item must not be empty' })
  @MaxLength(255, { message: 'food_item must not exceed 255 characters' })
  food_item?: string;

  @ApiPropertyOptional({ example: 480 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'calories must be a positive number' })
  calories?: number;

  @ApiPropertyOptional({ example: 45 })
  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'protein_g must be at least 0' })
  protein_g?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'carbs_g must be at least 0' })
  carbs_g?: number;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @Min(0, { message: 'fat_g must be at least 0' })
  fat_g?: number;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive({ message: 'quantity must be a positive number' })
  quantity?: number;

  @ApiPropertyOptional({ enum: NutritionUnit, example: NutritionUnit.serving })
  @IsOptional()
  @IsEnum(NutritionUnit, {
    message: `unit must be one of: ${Object.values(NutritionUnit).join(', ')}`,
  })
  unit?: NutritionUnit;
}

export class NutritionLogResponseDTO {
  @ApiProperty({ example: '44444444-4444-4444-8444-444444444444' })
  id: string;

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  user_id: string;

  @ApiPropertyOptional({
    type: String,
    example: '33333333-3333-4333-8333-333333333333',
    nullable: true,
  })
  macro_target_id: string | null;

  @ApiProperty({ example: '2026-03-27T00:00:00.000Z' })
  log_date: string;

  @ApiProperty({ example: 'Breakfast' })
  meal_name: string;

  @ApiProperty({ example: 'Greek yogurt' })
  food_item: string;

  @ApiProperty({ example: '320.00' })
  calories: string;

  @ApiProperty({ example: '28.00' })
  protein_g: string;

  @ApiProperty({ example: '22.00' })
  carbs_g: string;

  @ApiProperty({ example: '11.00' })
  fat_g: string;

  @ApiProperty({ example: '1.00' })
  quantity: string;

  @ApiProperty({ enum: NutritionUnit, example: NutritionUnit.serving })
  unit: NutritionUnit;

  @ApiProperty({ example: '2026-03-27T05:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T05:00:00.000Z' })
  updated_at: string;
}

export class DailyMacroTotalsResponseDTO {
  @ApiProperty({ example: '1800.00' })
  calories: string;

  @ApiProperty({ example: '145.00' })
  protein_g: string;

  @ApiProperty({ example: '190.00' })
  carbs_g: string;

  @ApiProperty({ example: '55.00' })
  fat_g: string;
}

export class NutritionCoachingInsightResponseDTO {
  @ApiProperty({ example: 'protein-recovery-window' })
  id: string;

  @ApiProperty({
    enum: ['info', 'opportunity', 'warning', 'recovery'],
    example: 'opportunity',
  })
  priority: 'info' | 'opportunity' | 'warning' | 'recovery';

  @ApiProperty({ example: 'Fuel the streak with protein first' })
  title: string;

  @ApiProperty({
    example:
      'Your training streak is active and protein is still behind target. Prioritize a protein-forward meal before chasing extra calories.',
  })
  message: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['active_progression_streak', 'protein_remaining'],
  })
  reason_codes: string[];

  @ApiProperty({
    enum: ['nutrition_summary', 'progression_summary'],
    example: 'progression_summary',
  })
  source: 'nutrition_summary' | 'progression_summary';
}

export class DailyNutritionSummaryResponseDTO {
  @ApiProperty({ example: '2026-03-27' })
  date: string;

  @ApiPropertyOptional({
    example: '33333333-3333-4333-8333-333333333333',
    nullable: true,
  })
  macro_target_id: string | null;

  @ApiProperty({ type: () => DailyMacroTotalsResponseDTO })
  logged: DailyMacroTotalsResponseDTO;

  @ApiPropertyOptional({
    type: () => DailyMacroTotalsResponseDTO,
    nullable: true,
  })
  target: DailyMacroTotalsResponseDTO | null;

  @ApiPropertyOptional({
    type: () => DailyMacroTotalsResponseDTO,
    nullable: true,
  })
  remaining: DailyMacroTotalsResponseDTO | null;

  @ApiProperty({
    type: () => NutritionCoachingInsightResponseDTO,
    isArray: true,
  })
  coaching: NutritionCoachingInsightResponseDTO[];
}

export class DailySummaryDateQueryDTO {
  @ApiProperty({ example: '2026-03-27' })
  @IsISO8601({}, { message: 'date must be a valid ISO 8601 date string' })
  date: string;
}
