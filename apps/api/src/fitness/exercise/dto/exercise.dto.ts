import { Transform, type TransformFnParams } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExerciseCategory } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
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
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: 'Barbell Back Squat' })
  name: string;

  @ApiProperty({ example: 'legs' })
  muscle_group: string;

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
