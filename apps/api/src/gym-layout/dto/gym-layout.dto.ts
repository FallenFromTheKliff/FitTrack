import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
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

  @ApiProperty({ example: 12.5 })
  @Type(() => Number)
  @IsNumber({}, { message: 'position_x must be a number' })
  position_x: number;

  @ApiProperty({ example: 7.25 })
  @Type(() => Number)
  @IsNumber({}, { message: 'position_y must be a number' })
  position_y: number;

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
