import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CoachFilterDTO, UpdateCoachProfileDTO } from './coach.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Coach DTO validation', () => {
  it('rejects commission percentages above one hundred', async () => {
    const dto = plainToInstance(UpdateCoachProfileDTO, {
      gym_commission_pct: 101,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'gym_commission_pct must not exceed 100',
    );
  });

  it('rejects negative max rates when filtering coaches', async () => {
    const dto = plainToInstance(CoachFilterDTO, {
      max_rate: -1,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'max_rate must be at least 0',
    );
  });

  it('accepts partial coach profile updates', async () => {
    const dto = plainToInstance(UpdateCoachProfileDTO, {
      specialization: 'Strength and conditioning',
      is_available_for_booking: false,
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
