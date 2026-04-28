import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AmenityType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

import { TrimString } from '../../../common/validators';

const FACILITY_FLOOR_IDS = ['floor-1', 'floor-2', 'floor-3'] as const;

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

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'minimum_hours must be an integer' })
  @Min(1, { message: 'minimum_hours must be at least 1' })
  minimum_hours?: number;

  @ApiPropertyOptional({ example: 'basketball' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'icon_key must be a string' })
  @MaxLength(100, { message: 'icon_key must not exceed 100 characters' })
  icon_key?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/facilities/main-court.jpg',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  @MaxLength(500, { message: 'image_url must not exceed 500 characters' })
  image_url?: string;

  @ApiPropertyOptional({ example: 9, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_column must be an integer' })
  @Min(1, { message: 'grid_column must be at least 1' })
  grid_column?: number;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_row must be an integer' })
  @Min(1, { message: 'grid_row must be at least 1' })
  grid_row?: number;

  @ApiPropertyOptional({ example: 6, default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_width must be an integer' })
  @Min(1, { message: 'grid_width must be at least 1' })
  grid_width?: number;

  @ApiPropertyOptional({ example: 4, default: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_height must be an integer' })
  @Min(1, { message: 'grid_height must be at least 1' })
  grid_height?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean({ message: 'is_reservable must be a boolean value' })
  is_reservable?: boolean;

  @ApiPropertyOptional({ example: 3, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'display_order must be an integer' })
  @Min(0, { message: 'display_order must be at least 0' })
  display_order?: number;

  @ApiPropertyOptional({ example: 'floor-1', enum: FACILITY_FLOOR_IDS })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'floor_id must be a string' })
  @IsIn(FACILITY_FLOOR_IDS, {
    message: `floor_id must be one of: ${FACILITY_FLOOR_IDS.join(', ')}`,
  })
  floor_id?: (typeof FACILITY_FLOOR_IDS)[number];
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

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'minimum_hours must be an integer' })
  @Min(1, { message: 'minimum_hours must be at least 1' })
  minimum_hours?: number;

  @ApiPropertyOptional({ example: 'basketball' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'icon_key must be a string' })
  @MaxLength(100, { message: 'icon_key must not exceed 100 characters' })
  icon_key?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/facilities/main-court.jpg',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  @MaxLength(500, { message: 'image_url must not exceed 500 characters' })
  image_url?: string;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_column must be an integer' })
  @Min(1, { message: 'grid_column must be at least 1' })
  grid_column?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_row must be an integer' })
  @Min(1, { message: 'grid_row must be at least 1' })
  grid_row?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_width must be an integer' })
  @Min(1, { message: 'grid_width must be at least 1' })
  grid_width?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_height must be an integer' })
  @Min(1, { message: 'grid_height must be at least 1' })
  grid_height?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_reservable must be a boolean value' })
  is_reservable?: boolean;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'display_order must be an integer' })
  @Min(0, { message: 'display_order must be at least 0' })
  display_order?: number;

  @ApiPropertyOptional({ example: 'floor-1', enum: FACILITY_FLOOR_IDS })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'floor_id must be a string' })
  @IsIn(FACILITY_FLOOR_IDS, {
    message: `floor_id must be one of: ${FACILITY_FLOOR_IDS.join(', ')}`,
  })
  floor_id?: (typeof FACILITY_FLOOR_IDS)[number];
}
