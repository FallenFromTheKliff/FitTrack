import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmenityType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

import { TrimString } from '../../../common/validators';

export class CreateAmenityDTO {
  @ApiProperty({ example: 'Main Court' })
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name: string;

  @ApiProperty({ enum: AmenityType, example: AmenityType.basketball_court })
  @IsEnum(AmenityType, {
    message: `type must be one of: ${Object.values(AmenityType).join(', ')}`,
  })
  type: AmenityType;

  @ApiPropertyOptional({
    example: 'Full-size basketball court with scoreboard access.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  @MaxLength(500, { message: 'description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'capacity must be an integer' })
  @Min(1, { message: 'capacity must be at least 1' })
  capacity?: number;

  @ApiPropertyOptional({ example: 800, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'hourly_rate must be a number' })
  @Min(0, { message: 'hourly_rate must be at least 0' })
  hourly_rate?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean({ message: 'requires_subscription must be a boolean value' })
  requires_subscription?: boolean;
}

export class UpdateAmenityDTO {
  @ApiPropertyOptional({ example: 'Main Court' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @MaxLength(100, { message: 'name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    enum: AmenityType,
    example: AmenityType.basketball_court,
  })
  @IsOptional()
  @IsEnum(AmenityType, {
    message: `type must be one of: ${Object.values(AmenityType).join(', ')}`,
  })
  type?: AmenityType;

  @ApiPropertyOptional({
    example: 'Full-size basketball court with scoreboard access.',
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  @MaxLength(500, { message: 'description must not exceed 500 characters' })
  description?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'capacity must be an integer' })
  @Min(1, { message: 'capacity must be at least 1' })
  capacity?: number;

  @ApiPropertyOptional({ example: 800 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'hourly_rate must be a number' })
  @Min(0, { message: 'hourly_rate must be at least 0' })
  hourly_rate?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean({ message: 'requires_subscription must be a boolean value' })
  requires_subscription?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;
}
