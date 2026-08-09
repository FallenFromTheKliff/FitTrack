import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TrimString } from '../../../common/validators';

export class CreateEquipmentItemDTO {
  @ApiProperty({ example: 'Adjustable Bench' })
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @IsNotEmpty({ message: 'name is required' })
  @MaxLength(255, { message: 'name must not exceed 255 characters' })
  name: string;

  @ApiPropertyOptional({
    example: 'Commercial-grade incline and flat workout bench.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/adjustable-bench.png',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  image_url?: string;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt({ message: 'quantity_total must be an integer' })
  @Min(0, { message: 'quantity_total must be at least 0' })
  quantity_total: number;

  @ApiProperty({ example: 6 })
  @Type(() => Number)
  @IsInt({ message: 'quantity_current must be an integer' })
  @Min(0, { message: 'quantity_current must be at least 0' })
  quantity_current: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity_maintenance must be an integer' })
  @Min(0, { message: 'quantity_maintenance must be at least 0' })
  quantity_maintenance?: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity_broken must be an integer' })
  @Min(0, { message: 'quantity_broken must be at least 0' })
  quantity_broken?: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity_missing must be an integer' })
  @Min(0, { message: 'quantity_missing must be at least 0' })
  quantity_missing?: number;

  @ApiPropertyOptional({ example: 'units', default: 'units' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'unit must be a string' })
  @MaxLength(50, { message: 'unit must not exceed 50 characters' })
  unit?: string;
}

export class UpdateEquipmentItemDTO {
  @ApiPropertyOptional({ example: 'Adjustable Bench' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'name must be a string' })
  @MaxLength(255, { message: 'name must not exceed 255 characters' })
  name?: string;

  @ApiPropertyOptional({
    example: 'Commercial-grade incline and flat workout bench.',
    nullable: true,
  })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'description must be a string' })
  description?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/adjustable-bench.png',
    nullable: true,
  })
  @IsOptional()
  @IsUrl({}, { message: 'image_url must be a valid URL' })
  image_url?: string;

  @ApiPropertyOptional({ example: 'units' })
  @IsOptional()
  @TrimString()
  @IsString({ message: 'unit must be a string' })
  @MaxLength(50, { message: 'unit must not exceed 50 characters' })
  unit?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity_total must be an integer' })
  @Min(0, { message: 'quantity_total must be at least 0' })
  quantity_total?: number;

  @ApiPropertyOptional({ example: 6 })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity_current must be an integer' })
  @Min(0, { message: 'quantity_current must be at least 0' })
  quantity_current?: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity_maintenance must be an integer' })
  @Min(0, { message: 'quantity_maintenance must be at least 0' })
  quantity_maintenance?: number;

  @ApiPropertyOptional({ example: 0, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity_broken must be an integer' })
  @Min(0, { message: 'quantity_broken must be at least 0' })
  quantity_broken?: number;

  @ApiPropertyOptional({ example: 1, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'quantity_missing must be an integer' })
  @Min(0, { message: 'quantity_missing must be at least 0' })
  quantity_missing?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;
}

export class EquipmentWriteOffDTO {
  @ApiProperty({ example: 4 })
  @Type(() => Number)
  @IsInt({ message: 'quantity_set_to must be an integer' })
  @Min(0, { message: 'quantity_set_to must be at least 0' })
  quantity_set_to: number;

  @ApiPropertyOptional({ enum: ['maintenance', 'broken', 'missing'], example: 'broken' })
  @IsOptional()
  @IsIn(['maintenance', 'broken', 'missing'], {
    message: 'status must be maintenance, broken, or missing',
  })
  status?: 'maintenance' | 'broken' | 'missing';

  @ApiProperty({
    example: 'Two benches were damaged and removed from the floor.',
  })
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(1000, { message: 'reason must not exceed 1000 characters' })
  reason: string;
}

export class ArchiveEquipmentItemDTO {
  @ApiProperty({ example: 2 })
  @Type(() => Number)
  @IsInt({ message: 'quantity_to_archive must be an integer' })
  @Min(1, { message: 'quantity_to_archive must be at least 1' })
  quantity_to_archive: number;

  @ApiProperty({
    example: 'Two benches were retired from the active floor inventory.',
  })
  @TrimString()
  @IsString({ message: 'reason must be a string' })
  @IsNotEmpty({ message: 'reason is required' })
  @MaxLength(1000, { message: 'reason must not exceed 1000 characters' })
  reason: string;
}

export class EquipmentWriteOffActorResponseDTO {
  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  id: string;

  @ApiPropertyOptional({ example: 'Morgan', nullable: true })
  first_name: string | null;

  @ApiPropertyOptional({ example: 'Reyes', nullable: true })
  last_name: string | null;
}

export class EquipmentWriteOffResponseDTO {
  @ApiProperty({ example: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  id: string;

  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  equipment_id: string;

  @ApiProperty({ example: 6 })
  quantity_before: number;

  @ApiProperty({ example: 4 })
  quantity_set_to: number;

  @ApiProperty({ example: 2 })
  quantity_lost: number;

  @ApiProperty({
    example: 'Two benches were damaged and removed from the floor.',
  })
  reason: string;

  @ApiProperty({ example: '33333333-3333-4333-8333-333333333333' })
  performed_by: string;

  @ApiPropertyOptional({
    type: EquipmentWriteOffActorResponseDTO,
    nullable: true,
  })
  performer: EquipmentWriteOffActorResponseDTO | null;

  @ApiProperty({ example: '2026-03-27T04:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T04:00:00.000Z' })
  updated_at: string;
}

export class EquipmentItemResponseDTO {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111' })
  id: string;

  @ApiProperty({ example: 'Adjustable Bench' })
  name: string;

  @ApiPropertyOptional({
    example: 'Commercial-grade incline and flat workout bench.',
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    example: 'https://cdn.fittrack.test/images/adjustable-bench.png',
    nullable: true,
  })
  image_url: string | null;

  @ApiProperty({ example: 8 })
  quantity_total: number;

  @ApiProperty({ example: 6 })
  quantity_current: number;

  @ApiProperty({
    example: { available: 6, maintenance: 1, broken: 0, missing: 1 },
  })
  status_counts: {
    available: number;
    maintenance: number | null;
    broken: number | null;
    missing: number | null;
  };

  @ApiProperty({ example: 2 })
  placed_quantity: number;

  @ApiProperty({ example: 4 })
  remaining_placeable_quantity: number;

  @ApiProperty({ example: 'units' })
  unit: string;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2026-03-27T02:00:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-03-27T03:00:00.000Z' })
  updated_at: string;
}

export class EquipmentItemDetailResponseDTO extends EquipmentItemResponseDTO {
  @ApiProperty({
    type: EquipmentWriteOffResponseDTO,
    isArray: true,
  })
  write_offs: EquipmentWriteOffResponseDTO[];
}
