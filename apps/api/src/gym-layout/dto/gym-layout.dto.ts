import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  IsUrl,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EquipmentStatus } from '@prisma/client';

import { TrimString } from '../../common/validators';

const FACILITY_FLOOR_IDS = ['floor-1', 'floor-2', 'floor-3'] as const;

export class FacilityGridCellDTO {
  @ApiProperty({ example: 1, minimum: 1, maximum: 14 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  column: number;

  @ApiProperty({ example: 1, minimum: 1, maximum: 10 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  row: number;
}

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

  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222' })
  @IsUUID(undefined, { message: 'inventory_item_id must be a UUID' })
  inventory_item_id: string;

  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  @IsUUID(undefined, { message: 'venue_id must be a UUID' })
  venue_id: string;

  @ApiProperty({ example: 10, minimum: 1, maximum: 14 })
  @Type(() => Number)
  @IsInt({ message: 'grid_column must be an integer' })
  @Min(1, { message: 'grid_column must be at least 1' })
  @Max(14, { message: 'grid_column must be at most 14' })
  grid_column: number;

  @ApiProperty({ example: 4, minimum: 1, maximum: 10 })
  @Type(() => Number)
  @IsInt({ message: 'grid_row must be an integer' })
  @Min(1, { message: 'grid_row must be at least 1' })
  @Max(10, { message: 'grid_row must be at most 10' })
  grid_row: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_width must be an integer' })
  @Min(1, { message: 'grid_width must be at least 1' })
  grid_width?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_height must be an integer' })
  @Min(1, { message: 'grid_height must be at least 1' })
  grid_height?: number;

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

  @ApiPropertyOptional({ example: '22222222-2222-4222-8222-222222222222' })
  @IsOptional()
  @IsUUID(undefined, { message: 'inventory_item_id must be a UUID' })
  inventory_item_id?: string;

  @ApiPropertyOptional({ example: '33333333-3333-4333-8333-333333333333' })
  @IsOptional()
  @IsUUID(undefined, { message: 'venue_id must be a UUID' })
  venue_id?: string;

  @ApiPropertyOptional({ example: 11 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_column must be an integer' })
  @Min(1, { message: 'grid_column must be at least 1' })
  @Max(14, { message: 'grid_column must be at most 14' })
  grid_column?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_row must be an integer' })
  @Min(1, { message: 'grid_row must be at least 1' })
  @Max(10, { message: 'grid_row must be at most 10' })
  grid_row?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_width must be an integer' })
  @Min(1, { message: 'grid_width must be at least 1' })
  grid_width?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'grid_height must be an integer' })
  @Min(1, { message: 'grid_height must be at least 1' })
  grid_height?: number;

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

  @ApiPropertyOptional({ example: 2, nullable: true })
  grid_width: number | null;

  @ApiPropertyOptional({ example: 2, nullable: true })
  grid_height: number | null;

  @ApiPropertyOptional({
    example: '22222222-2222-4222-8222-222222222222',
    nullable: true,
  })
  inventory_item_id: string | null;

  @ApiPropertyOptional({
    example: '33333333-3333-4333-8333-333333333333',
    nullable: true,
  })
  venue_id: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/bench.png',
    nullable: true,
  })
  image_url: string | null;

  @ApiProperty({ example: 1 })
  placed_quantity: number;

  @ApiPropertyOptional({ example: 3, nullable: true })
  remaining_placeable_quantity: number | null;

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

export class UpdateFacilityFloorPlanMediaDTO {
  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/facilities/floor-1.png',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  @MaxLength(500, { message: 'image_url must not exceed 500 characters' })
  image_url?: string | null;

  @ApiPropertyOptional({ type: [FacilityGridCellDTO] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacilityGridCellDTO)
  footprint_cells?: FacilityGridCellDTO[];

  @ApiPropertyOptional({ type: [FacilityGridCellDTO] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacilityGridCellDTO)
  path_cells?: FacilityGridCellDTO[];

  @ApiPropertyOptional({ type: [FacilityGridCellDTO] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacilityGridCellDTO)
  entry_cells?: FacilityGridCellDTO[];

  @ApiPropertyOptional({ type: [FacilityGridCellDTO] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FacilityGridCellDTO)
  exit_cells?: FacilityGridCellDTO[];
}

export class FacilityFloorPlanMediaResponseDTO {
  @ApiProperty({ example: 'floor-1', enum: FACILITY_FLOOR_IDS })
  floor_id: (typeof FACILITY_FLOOR_IDS)[number];

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/facilities/floor-1.png',
    nullable: true,
  })
  image_url: string | null;

  @ApiProperty({ example: 14 })
  grid_width: number;

  @ApiProperty({ example: 10 })
  grid_height: number;

  @ApiProperty({ type: [FacilityGridCellDTO] })
  footprint_cells: FacilityGridCellDTO[];

  @ApiProperty({ type: [FacilityGridCellDTO] })
  path_cells: FacilityGridCellDTO[];

  @ApiProperty({ type: [FacilityGridCellDTO] })
  entry_cells: FacilityGridCellDTO[];

  @ApiProperty({ type: [FacilityGridCellDTO] })
  exit_cells: FacilityGridCellDTO[];

  @ApiProperty({ example: '2026-04-28T03:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-04-28T03:00:00.000Z' })
  updated_at: string;
}
