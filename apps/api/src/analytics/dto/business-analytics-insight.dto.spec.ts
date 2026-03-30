import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { InsightFocus, InsightPeriod } from '@prisma/client';

import {
  BusinessInsightFilterDTO,
  GenerateBusinessInsightDTO,
} from './business-analytics-insight.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Business analytics insight DTO validation', () => {
  it('accepts a valid business insight generation request', async () => {
    const dto = plainToInstance(GenerateBusinessInsightDTO, {
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      focus: InsightFocus.inventory,
      period: InsightPeriod.custom,
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an end date before the start date', async () => {
    const dto = plainToInstance(GenerateBusinessInsightDTO, {
      start_date: '2026-03-31',
      end_date: '2026-03-01',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'end_date must be on or after start_date',
    );
  });

  it('rejects unsupported focus values', async () => {
    const dto = plainToInstance(GenerateBusinessInsightDTO, {
      focus: 'staffing',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'focus must be one of: overview, revenue, attendance, membership, coaching, inventory',
    );
  });

  it('rejects unsupported history period filters', async () => {
    const dto = plainToInstance(BusinessInsightFilterDTO, {
      period: 'hourly',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'period must be one of: daily, weekly, monthly, yearly, custom',
    );
  });
});
