import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { AnalyticsQueryDTO, ExportAnalyticsPdfDTO } from './analytics.dto';

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
      period: 'quarterly',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'period must be one of: hourly, daily, weekly, monthly, yearly',
    );
  });

  it('accepts a valid saved insight id for PDF export', async () => {
    const dto = plainToInstance(ExportAnalyticsPdfDTO, {
      insight_run_id: '33333333-3333-4333-8333-333333333333',
      selected_sections: ['recommendations'],
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a malformed saved insight id for PDF export', async () => {
    const dto = plainToInstance(ExportAnalyticsPdfDTO, {
      insight_run_id: 'latest-insight',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'insight_run_id must be a valid UUID',
    );
  });
});
