import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateGymProfileDTO } from './gym-knowledge.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Gym knowledge DTO validation', () => {
  it('allows a valid non-auth provider contact email for the shared gym profile', async () => {
    const dto = plainToInstance(UpdateGymProfileDTO, {
      name: 'SERTFIT Gym',
      phone: '+639281234567',
      location: 'Pasay City, Metro Manila, Philippines',
      email: 'contact@sertfit.com',
      opening_time: '06:00',
      closing_time: '22:00',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('still rejects malformed gym contact emails', async () => {
    const dto = plainToInstance(UpdateGymProfileDTO, {
      name: 'SERTFIT Gym',
      phone: '+639281234567',
      location: 'Pasay City, Metro Manila, Philippines',
      email: 'contact-at-sertfit',
      opening_time: '06:00',
      closing_time: '22:00',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'email must be a valid email address',
    );
  });
});
