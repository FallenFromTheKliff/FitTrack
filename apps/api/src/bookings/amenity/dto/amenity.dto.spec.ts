import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateAmenityDTO, UpdateAmenityDTO } from './amenity.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Amenity DTO validation', () => {
  it('requires a name for amenity creation', async () => {
    const dto = plainToInstance(CreateAmenityDTO, {
      type: 'basketball_court',
    });

    expect(extractMessages(await validate(dto))).toContain('name is required');
  });

  it('rejects capacities below one', async () => {
    const dto = plainToInstance(CreateAmenityDTO, {
      name: 'Main Court',
      type: 'basketball_court',
      capacity: 0,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'capacity must be at least 1',
    );
  });

  it('rejects negative hourly rates', async () => {
    const dto = plainToInstance(CreateAmenityDTO, {
      name: 'Main Court',
      type: 'basketball_court',
      hourly_rate: -1,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'hourly_rate must be at least 0',
    );
  });

  it('accepts partial amenity updates', async () => {
    const dto = plainToInstance(UpdateAmenityDTO, {
      is_active: false,
      hourly_rate: 750,
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
