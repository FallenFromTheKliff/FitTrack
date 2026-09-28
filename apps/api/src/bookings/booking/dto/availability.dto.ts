import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

export class AvailabilityQueryDTO {
  @ApiProperty({
    format: 'uuid',
    example: '11111111-1111-1111-1111-111111111111',
  })
  @Matches(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    { message: 'amenity_id must be a valid UUID' },
  )
  amenity_id: string;

  @ApiProperty({
    example: '2026-03-24',
    description: 'Availability date in YYYY-MM-DD format.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date: string;
}

export class AvailabilitySlotDTO {
  @ApiProperty({ example: '2026-03-24T10:00:00.000Z' })
  starts_at: string;

  @ApiProperty({ example: '2026-03-24T10:30:00.000Z' })
  ends_at: string;

  @ApiProperty({ example: true })
  available: boolean;
}
