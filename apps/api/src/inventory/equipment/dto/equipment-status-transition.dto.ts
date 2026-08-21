import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Min } from 'class-validator';

export const EQUIPMENT_STATUS_BUCKETS = [
  'available',
  'maintenance',
  'broken',
  'missing',
] as const;

export type EquipmentStatusBucket = (typeof EQUIPMENT_STATUS_BUCKETS)[number];

export class EquipmentStatusTransitionDTO {
  @ApiProperty({ enum: EQUIPMENT_STATUS_BUCKETS, example: 'available' })
  @IsIn(EQUIPMENT_STATUS_BUCKETS)
  source_status: EquipmentStatusBucket;

  @ApiProperty({ enum: EQUIPMENT_STATUS_BUCKETS, example: 'maintenance' })
  @IsIn(EQUIPMENT_STATUS_BUCKETS)
  destination_status: EquipmentStatusBucket;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt({ message: 'quantity must be an integer' })
  @Min(1, { message: 'quantity must be at least 1' })
  quantity: number;
}
