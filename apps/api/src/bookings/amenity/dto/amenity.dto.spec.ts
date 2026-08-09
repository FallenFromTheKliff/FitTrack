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
      floor_id: 'floor-2',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects invalid floor ids', async () => {
    const dto = plainToInstance(CreateAmenityDTO, {
      name: 'Studio Beta',
      type: 'other',
      floor_id: 'annex',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'floor_id must be one of: floor-1, floor-2, floor-3',
    );
  });

  it('accepts normalized venue image media settings', async () => {
    const dto = plainToInstance(UpdateAmenityDTO, {
      image_fit: 'contain',
      image_focal_x: 0.25,
      image_focal_y: 0.75,
      image_crop_zoom: 2,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects invalid venue image media settings', async () => {
    const dto = plainToInstance(UpdateAmenityDTO, {
      image_fit: 'stretch',
      image_focal_x: -0.1,
      image_focal_y: 1.1,
      image_crop_zoom: 5,
    });
    const messages = extractMessages(await validate(dto));

    expect(messages).toContain('image_fit must be cover or contain');
    expect(messages).toContain('image_focal_x must be at least 0');
    expect(messages).toContain('image_focal_y must be at most 1');
    expect(messages).toContain('image_crop_zoom must be at most 4');
  });
});
