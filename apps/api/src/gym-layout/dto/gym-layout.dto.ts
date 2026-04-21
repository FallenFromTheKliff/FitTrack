import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentStatus } from '@prisma/client';

import { TrimString } from '../../common/validators';

export class CreateEquipmentDTO {
  @ApiProperty({ example: 'Leg Press Station' })
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(255, { message: 'name must not exceed 255 characters' })
  name: string;

  @ApiProperty({ example: 'strength' })
  @TrimString()
  @IsString({ message: 'type must be a string' })
  @IsNotEmpty({ message: 'type is required' })
  @MaxLength(100, { message: 'type must not exceed 100 characters' })
  type: string;

  @ApiProperty({ example: 'floor-1' })
  @TrimString()
  @IsString({ message: 'floor_id must be a string' })
  @IsIn(['floor-1', 'floor-2', 'floor-3'], {
    message: 'floor_id must be one of: floor-1, floor-2, floor-3',
  })
  floor_id: 'floor-1' | 'floor-2' | 'floor-3';

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_column must be an integer' })
  @Min(1, { message: 'grid_column must be at least 1' })
  grid_column?: number;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_row must be an integer' })
  @Min(1, { message: 'grid_row must be at least 1' })
  grid_row?: number;

  @ApiPropertyOptional({ example: 67.86 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'position_x must be a number' })
  position_x?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'position_y must be a number' })
  position_y?: number;

  @ApiPropertyOptional({ example: 'leg-press', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'icon_key must be a string' })
  @MaxLength(100, { message: 'icon_key must not exceed 100 characters' })
  icon_key?: string;
}

export class UpdateEquipmentDTO {
  @ApiPropertyOptional({ example: 'Leg Press Station' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @MaxLength(255, { message: 'name must not exceed 255 characters' })
  name?: string;

  @ApiPropertyOptional({ example: 'strength' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'type must be a string' })
  @MaxLength(100, { message: 'type must not exceed 100 characters' })
  type?: string;

  @ApiPropertyOptional({ example: 'floor-2' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'floor_id must be a string' })
  @IsIn(['floor-1', 'floor-2', 'floor-3'], {
    message: 'floor_id must be one of: floor-1, floor-2, floor-3',
  })
  floor_id?: 'floor-1' | 'floor-2' | 'floor-3';

  @ApiPropertyOptional({ example: 11 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_column must be an integer' })
  @Min(1, { message: 'grid_column must be at least 1' })
  grid_column?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_row must be an integer' })
  @Min(1, { message: 'grid_row must be at least 1' })
  grid_row?: number;

  @ApiPropertyOptional({ example: 13 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'position_x must be a number' })
  position_x?: number;

  @ApiPropertyOptional({ example: 8.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'position_y must be a number' })
  position_y?: number;

  @ApiPropertyOptional({
    enum: EquipmentStatus,
    example: EquipmentStatus.maintenance,
  })
  @IsOptional()
  @IsEnum(EquipmentStatus, {
    message: `status must be one of: ${Object.values(EquipmentStatus).join(', ')}`,
  })
  status?: EquipmentStatus;

  @ApiPropertyOptional({ example: 'leg-press', nullable: true })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'icon_key must be a string' })
  @MaxLength(100, { message: 'icon_key must not exceed 100 characters' })
  icon_key?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;
}

export class GymLayoutEquipmentResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: 'Leg Press Station' })
  name: string;

  @ApiProperty({ example: 'strength' })
  type: string;

  @ApiProperty({ example: 'floor-1' })
  floor_id: 'floor-1' | 'floor-2' | 'floor-3';

  @ApiProperty({ example: 10 })
  grid_column: number;

  @ApiProperty({ example: 4 })
  grid_row: number;

  @ApiProperty({ example: 12.5 })
  position_x: number;

  @ApiProperty({ example: 7.25 })
  position_y: number;

  @ApiProperty({ enum: EquipmentStatus, example: EquipmentStatus.available })
  status: EquipmentStatus;

  @ApiPropertyOptional({ example: 'leg-press', nullable: true })
  icon_key: string | null;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-27T02:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T03:00:00.000Z' })
  updated_at: string;
}
