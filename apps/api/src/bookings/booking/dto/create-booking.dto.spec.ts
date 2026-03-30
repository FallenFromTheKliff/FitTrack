import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateBookingDTO, ProcessBalanceDTO } from './create-booking.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('CreateBookingDTO validation', () => {
  it('requires a valid amenity id', async () => {
    const dto = plainToInstance(CreateBookingDTO, {
      amenity_id: 'bad-id',
      starts_at: '2026-03-24T10:00:00.000Z',
      ends_at: '2026-03-24T11:00:00.000Z',
      provider: 'paymongo',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'amenity_id must be a valid UUID',
    );
  });

  it('requires ISO timestamps for booking windows', async () => {
    const dto = plainToInstance(CreateBookingDTO, {
      amenity_id: '11111111-1111-4111-8111-111111111111',
      starts_at: '03/24/2026 10:00',
      ends_at: '2026-03-24T11:00:00.000Z',
      provider: 'paymongo',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'starts_at must be a valid ISO 8601 date string',
    );
  });

  it('accepts a valid booking create payload', async () => {
    const dto = plainToInstance(CreateBookingDTO, {
      amenity_id: '11111111-1111-4111-8111-111111111111',
      starts_at: '2026-03-24T10:00:00.000Z',
      ends_at: '2026-03-24T11:00:00.000Z',
      provider: 'paymongo',
      notes: 'Birthday game booking.',
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('ProcessBalanceDTO validation', () => {
  it('requires a valid screenshot URL for cash balance collection', async () => {
    const dto = plainToInstance(ProcessBalanceDTO, {
      provider: 'cash',
      screenshot_url: 'not-a-url',
      reference_no: 'OR-123',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'screenshot_url must be a valid URL',
    );
  });

  it('accepts a paymongo balance request without cash-only fields', async () => {
    const dto = plainToInstance(ProcessBalanceDTO, {
      provider: 'paymongo',
    });

    expect(await validate(dto)).toHaveLength(0);
  });
});
