import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AnalyticsQueryDTO } from './analytics.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Analytics DTO validation', () => {
  it('accepts a valid analytics query', async () => {
    const dto = plainToInstance(AnalyticsQueryDTO, {
      start_date: '2025-01-01',
      end_date: '2025-01-31',
      period: 'weekly',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an end date before the start date', async () => {
    const dto = plainToInstance(AnalyticsQueryDTO, {
      start_date: '2025-01-31',
      end_date: '2025-01-01',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'end_date must be on or after start_date',
    );
  });

  it('rejects unsupported analytics periods', async () => {
    const dto = plainToInstance(AnalyticsQueryDTO, {
      period: 'hourly',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'period must be one of: daily, weekly, monthly, yearly',
    );
  });
});
