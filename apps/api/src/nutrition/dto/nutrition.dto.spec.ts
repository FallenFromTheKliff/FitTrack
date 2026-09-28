import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  NutritionLogFilterDTO,
  UpdateNutritionLogDTO,
} from './nutrition.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Nutrition DTO validation', () => {
  it('accepts canonical nutrition log filters and trims search text', async () => {
    const dto = plainToInstance(NutritionLogFilterDTO, {
      page: '2',
      limit: '10',
      start_date: '2026-03-01',
      end_date: '2026-03-31',
      search: '  chicken  ',
      meal_type: 'Lunch',
      sort: 'oldest',
    });

    expect(await validate(dto)).toEqual([]);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
    expect(dto.search).toBe('chicken');
  });

  it('defaults nutrition log sort to newest', async () => {
    const dto = plainToInstance(NutritionLogFilterDTO, {});

    expect(await validate(dto)).toEqual([]);
    expect(dto.sort).toBe('newest');
  });

  it('rejects unsupported nutrition log filter values', async () => {
    const dto = plainToInstance(NutritionLogFilterDTO, {
      meal_type: 'Brunch',
      sort: 'calories',
    });

    const messages = extractMessages(await validate(dto));
    expect(messages).toContain(
      'meal_type must be one of: Breakfast, Lunch, Dinner, Snack, Pre-workout, Post-workout',
    );
    expect(messages).toContain('sort must be one of: newest, oldest');
  });

  it('accepts the create-compatible log date on partial updates', async () => {
    const dto = plainToInstance(UpdateNutritionLogDTO, {
      log_date: '2026-03-28',
    });

    expect(await validate(dto)).toEqual([]);
  });

  it('rejects invalid nutrition log dates on partial updates', async () => {
    const dto = plainToInstance(UpdateNutritionLogDTO, {
      log_date: 'not-a-date',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'log_date must be a valid ISO 8601 date string',
    );
  });
});
