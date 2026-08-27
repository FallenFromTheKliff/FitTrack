import { Transform, type TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ExerciseCategory,
  ExerciseTrackingMode,
  ProgressionIconKind,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

import { TrimString } from '../../../common/validators';
import { PaginationDTO } from '../../../user/dto/user-dto';

function getRawTransformValue({ value, obj, key }: TransformFnParams): unknown {
  if (!obj || typeof key !== 'string') {
    return value;
  }

  const record = obj as Record<string, unknown>;
  return key in record ? record[key] : value;
}

function transformBooleanInput(params: TransformFnParams): unknown {
  const rawValue = getRawTransformValue(params);

  if (typeof rawValue !== 'string') {
    return rawValue;
  }

  const normalized = rawValue.trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return rawValue;
}

export class CreateExerciseDTO {
  @ApiPropertyOptional({
    type: 'array',
    description: 'Exact spelling/synonym labels.',
  })
  @IsOptional()
  aliases?: unknown;

  @ApiProperty({ example: 'Barbell Back Squat' })
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(255, { message: 'name must not exceed 255 characters' })
  name: string;

  @ApiProperty({ example: 'legs' })
  @TrimString()
  @IsString({ message: 'muscle_group must be a string' })
  @IsNotEmpty({ message: 'muscle_group is required' })
  @MaxLength(100, {
    message: 'muscle_group must not exceed 100 characters',
  })
  muscle_group: string;

  @ApiPropertyOptional({
    description:
      'Structured multi-muscle target allocation for exercise editing.',
    example: [
      { allocationPercent: 70, muscleGroup: 'chest', role: 'primary' },
      { allocationPercent: 20, muscleGroup: 'triceps', role: 'secondary' },
      { allocationPercent: 10, muscleGroup: 'core', role: 'stabilizer' },
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
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  movement_profile_override?: unknown;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @IsOptional()
  @IsString()
  movement_family_id?: string | null;

  @ApiPropertyOptional({ enum: ExerciseTrackingMode })
  @IsOptional()
  @IsEnum(ExerciseTrackingMode)
  tracking_mode?: ExerciseTrackingMode;

  @ApiPropertyOptional({
    additionalProperties: true,
    description:
      'Editable grip and subject-lock gesture thresholds for live pose integrity.',
    nullable: true,
    type: 'object',
  })
  @IsOptional()
  hand_shape_profile?: unknown;

  @ApiProperty({ enum: ExerciseCategory, example: ExerciseCategory.strength })
  @IsEnum(ExerciseCategory, {
    message: `category must be one of: ${Object.values(ExerciseCategory).join(', ')}`,
  })
  category: ExerciseCategory;

  @ApiPropertyOptional({
    example: 'Compound lower-body movement that targets quads and glutes.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    example: 'Keep your chest up and drive through the floor.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'instructions must be a string' })
  instructions?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/videos/barbell-back-squat.mp4',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({}, { message: 'video_url must be a valid URL' })
  video_url?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/barbell-back-squat.png',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  image_url?: string;
}

export class UpdateExerciseDTO {
  @ApiPropertyOptional({
    type: 'array',
    description: 'Exact spelling/synonym labels.',
  })
  @IsOptional()
  aliases?: unknown;

  @ApiPropertyOptional({ example: 'Barbell Back Squat' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @MaxLength(255, { message: 'name must not exceed 255 characters' })
  name?: string;

  @ApiPropertyOptional({ example: 'legs' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'muscle_group must be a string' })
  @MaxLength(100, {
    message: 'muscle_group must not exceed 100 characters',
  })
  muscle_group?: string;

  @ApiPropertyOptional({
    description:
      'Structured multi-muscle target allocation for exercise editing.',
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
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  movement_profile_override?: unknown;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  @IsOptional()
  @IsString()
  movement_family_id?: string | null;

  @ApiPropertyOptional({ enum: ExerciseTrackingMode })
  @IsOptional()
  @IsEnum(ExerciseTrackingMode)
  tracking_mode?: ExerciseTrackingMode;

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
    enum: ExerciseCategory,
    example: ExerciseCategory.strength,
  })
  @IsOptional()
  @IsEnum(ExerciseCategory, {
    message: `category must be one of: ${Object.values(ExerciseCategory).join(', ')}`,
  })
  category?: ExerciseCategory;

  @ApiPropertyOptional({
    example: 'Compound lower-body movement that targets quads and glutes.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    example: 'Keep your chest up and drive through the floor.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'instructions must be a string' })
  instructions?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/videos/barbell-back-squat.mp4',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({}, { message: 'video_url must be a valid URL' })
  video_url?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/barbell-back-squat.png',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  image_url?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;
}

export class ExerciseFilterDTO extends PaginationDTO {
  @ApiPropertyOptional({ example: 'legs' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'muscle_group must be a string' })
  @MaxLength(100, {
    message: 'muscle_group must not exceed 100 characters',
  })
  muscle_group?: string;

  @ApiPropertyOptional({
    enum: ExerciseCategory,
    example: ExerciseCategory.strength,
  })
  @IsOptional()
  @IsEnum(ExerciseCategory, {
    message: `category must be one of: ${Object.values(ExerciseCategory).join(', ')}`,
  })
  category?: ExerciseCategory;

  @ApiPropertyOptional({
    example: 'squat',
    description: 'Searches name, muscle group, description, and instructions.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search must not exceed 100 characters' })
  search?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Include archived exercises in library queries.',
  })
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'include_inactive must be a boolean value' })
  include_inactive?: boolean;
}

export class ExerciseResponseDTO {
  @ApiProperty({ type: 'array' })
  aliases: unknown[];

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: 'Barbell Back Squat' })
  name: string;

  @ApiProperty({ example: 'legs' })
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
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  movement_profile_override: Record<string, unknown> | null;

  @ApiPropertyOptional({
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  movement_family: Record<string, unknown> | null;

  @ApiProperty({ enum: ExerciseTrackingMode })
  tracking_mode: ExerciseTrackingMode;

  @ApiPropertyOptional({
    nullable: true,
    type: 'object',
    additionalProperties: true,
  })
  movement_contract_identity: Record<string, unknown>;

  @ApiPropertyOptional({
    additionalProperties: true,
    description: 'Grip and subject-lock gesture thresholds.',
    nullable: true,
    type: 'object',
  })
  hand_shape_profile: Record<string, unknown> | null;

  @ApiProperty({ enum: ExerciseCategory, example: ExerciseCategory.strength })
  category: ExerciseCategory;

  @ApiPropertyOptional({
    example: 'Compound lower-body movement that targets quads and glutes.',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    example: 'Keep your chest up and drive through the floor.',
    nullable: true,
  })
  instructions: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/videos/barbell-back-squat.mp4',
    nullable: true,
  })
  video_url: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/barbell-back-squat.png',
    nullable: true,
  })
  image_url: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-26T02:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-26T03:00:00.000Z' })
  updated_at: string;
}

export class UpdateMovementFamilyContractDTO {
  @ApiProperty({ type: 'object', additionalProperties: true })
  @IsObject()
  movement_profile: unknown;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
  })
  @IsOptional()
  hand_shape_profile?: unknown;
}

export class MuscleDefinitionResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: 'biceps' })
  key: string;

  @ApiProperty({ example: 'Biceps' })
  name: string;

  @ApiProperty({ example: 'arms' })
  body_region: string;

  @ApiProperty({ example: ['bis'], type: [String] })
  aliases: string[];

  @ApiProperty({
    enum: ProgressionIconKind,
    example: ProgressionIconKind.library,
    nullable: true,
  })
  icon_kind: ProgressionIconKind | null;

  @ApiProperty({ example: 'dumbbell', nullable: true })
  icon_key: string | null;

  @ApiProperty({
    example: 'uploads/muscles/custom-icon.png',
    nullable: true,
  })
  icon_asset_key: string | null;

  @ApiProperty({ example: 40 })
  sort_order: number;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: true })
  is_system: boolean;

  @ApiProperty({ example: '2026-05-02T03:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-05-02T03:00:00.000Z' })
  updated_at: string;
}

export class MuscleDefinitionFilterDTO {
  @ApiPropertyOptional({ example: 'bicep' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'search must be a string' })
  @MaxLength(100, { message: 'search must not exceed 100 characters' })
  search?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Include archived muscle definitions.',
  })
  @IsOptional()
  @Transform((params) => transformBooleanInput(params))
  @IsBoolean({ message: 'include_archived must be a boolean value' })
  include_archived?: boolean;
}

export class CreateMuscleDefinitionDTO {
  @ApiPropertyOptional({ example: 'biceps' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'key must be a string' })
  @MaxLength(100, { message: 'key must not exceed 100 characters' })
  key?: string;

  @ApiProperty({ example: 'Biceps' })
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(120, { message: 'name must not exceed 120 characters' })
  name: string;

  @ApiProperty({ example: 'arms' })
  @TrimString()
  @IsString({ message: 'body_region must be a string' })
  @IsNotEmpty({ message: 'body_region is required' })
  @MaxLength(80, { message: 'body_region must not exceed 80 characters' })
  body_region: string;

  @ApiPropertyOptional({
    enum: ProgressionIconKind,
    example: ProgressionIconKind.library,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ProgressionIconKind, {
    message: 'icon_kind must be a valid progression icon kind',
  })
  icon_kind?: ProgressionIconKind | null;

  @ApiPropertyOptional({ example: 'dumbbell', nullable: true })
  @IsOptional()
  @IsString({ message: 'icon_key must be a string' })
  @MaxLength(100, { message: 'icon_key must not exceed 100 characters' })
  icon_key?: string | null;

  @ApiPropertyOptional({
    example: 'uploads/muscles/custom-icon.png',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'icon_asset_key must be a string' })
  @MaxLength(500, {
    message: 'icon_asset_key must not exceed 500 characters',
  })
  icon_asset_key?: string | null;

  @ApiPropertyOptional({ example: ['bis'], type: [String] })
  @IsOptional()
  @IsArray({ message: 'aliases must be an array' })
  @IsString({ each: true, message: 'aliases must contain strings' })
  aliases?: string[];

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsInt({ message: 'sort_order must be an integer' })
  @Min(0, { message: 'sort_order cannot be negative' })
  sort_order?: number;
}

export class UpdateMuscleDefinitionDTO {
  @ApiPropertyOptional({ example: 'Biceps' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @MaxLength(120, { message: 'name must not exceed 120 characters' })
  name?: string;

  @ApiPropertyOptional({ example: 'arms' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'body_region must be a string' })
  @MaxLength(80, { message: 'body_region must not exceed 80 characters' })
  body_region?: string;

  @ApiPropertyOptional({
    enum: ProgressionIconKind,
    example: ProgressionIconKind.library,
    nullable: true,
  })
  @IsOptional()
  @IsEnum(ProgressionIconKind, {
    message: 'icon_kind must be a valid progression icon kind',
  })
  icon_kind?: ProgressionIconKind | null;

  @ApiPropertyOptional({ example: 'dumbbell', nullable: true })
  @IsOptional()
  @IsString({ message: 'icon_key must be a string' })
  @MaxLength(100, { message: 'icon_key must not exceed 100 characters' })
  icon_key?: string | null;

  @ApiPropertyOptional({
    example: 'uploads/muscles/custom-icon.png',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: 'icon_asset_key must be a string' })
  @MaxLength(500, {
    message: 'icon_asset_key must not exceed 500 characters',
  })
  icon_asset_key?: string | null;

  @ApiPropertyOptional({ example: ['bis'], type: [String] })
  @IsOptional()
  @IsArray({ message: 'aliases must be an array' })
  @IsString({ each: true, message: 'aliases must contain strings' })
  aliases?: string[];

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsInt({ message: 'sort_order must be an integer' })
  @Min(0, { message: 'sort_order cannot be negative' })
  sort_order?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;
}
