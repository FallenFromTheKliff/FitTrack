import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AvailabilityQueryDTO } from './availability.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('AvailabilityQueryDTO validation', () => {
  it('requires a valid amenity id', async () => {
    const dto = plainToInstance(AvailabilityQueryDTO, {
      amenity_id: 'not-a-uuid',
      date: '2026-03-24',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'amenity_id must be a valid UUID',
    );
  });

  it('requires YYYY-MM-DD dates', async () => {
    const dto = plainToInstance(AvailabilityQueryDTO, {
      amenity_id: '11111111-1111-4111-8111-111111111111',
      date: '03/24/2026',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'date must be in YYYY-MM-DD format',
    );
  });

  it('accepts a valid availability query', async () => {
    const dto = plainToInstance(AvailabilityQueryDTO, {
      amenity_id: '11111111-1111-4111-8111-111111111111',
      date: '2026-03-24',
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
