import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CreateSubscriptionDTO,
  CreatePlanDTO,
  PaginationDTO,
  UpdatePlanDTO,
} from './subscription.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('Subscription DTO validation', () => {
  it('rejects non-positive plan prices on create', async () => {
    const dto = plainToInstance(CreatePlanDTO, {
      name: 'Monthly Membership',
      price: 0,
      duration_days: 30,
    });

    expect(extractMessages(await validate(dto))).toContain(
      'price must be a positive number',
    );
  });

  it('rejects non-object features payloads on update', async () => {
    const dto = plainToInstance(UpdatePlanDTO, {
      features: 'locker access',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'features must be an object',
    );
  });

  it('transforms pagination query values into numbers', async () => {
    const dto = plainToInstance(PaginationDTO, {
      page: '2',
      limit: '10',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto.page).toBe(2);
    expect(dto.limit).toBe(10);
  });

  it('requires a valid UUID plan id for subscription creation', async () => {
    const dto = plainToInstance(CreateSubscriptionDTO, {
      plan_id: 'not-a-uuid',
      provider: 'paymongo',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'plan_id must be a valid UUID',
    );
  });
});
