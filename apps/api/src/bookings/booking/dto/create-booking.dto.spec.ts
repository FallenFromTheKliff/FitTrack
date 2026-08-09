import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateStaffVenueBookingDTO } from '../../../staff/dto/staff-schedule.dto';
import { CreateBookingDTO, ProcessBalanceDTO } from './create-booking.dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

function createStaffVenueBookingPayload(amenityId: string) {
  return plainToInstance(CreateStaffVenueBookingDTO, {
    member_id: '11111111-1111-4111-8111-111111111111',
    amenity_id: amenityId,
    starts_at: '2026-08-10T10:00:00.000Z',
    ends_at: '2026-08-10T11:00:00.000Z',
  });
}

describe('CreateStaffVenueBookingDTO validation', () => {
  it('accepts a deterministic UUIDv5 amenity id', async () => {
    const errors = await validate(
      createStaffVenueBookingPayload(
        '7e9f96f7-8efe-5598-a978-5cd6ecf73a06',
      ),
    );

    expect(errors).toHaveLength(0);
  });

  it('rejects a malformed amenity id', async () => {
    const errors = await validate(
      createStaffVenueBookingPayload('not-a-venue-uuid'),
    );

    expect(extractMessages(errors)).toContain(
      'amenity_id must be a valid UUID',
    );
  });
});

describe('CreateBookingDTO validation', () => {
  it('accepts a deterministic UUIDv5 amenity id', async () => {
    const dto = plainToInstance(CreateBookingDTO, {
      amenity_id: '7e9f96f7-8efe-5598-a978-5cd6ecf73a06',
      starts_at: '2026-03-24T10:00:00.000Z',
      ends_at: '2026-03-24T11:00:00.000Z',
      provider: 'paymongo',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

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
      payment_stage: 'downpayment',
      notes: 'Birthday game booking.',
    });

    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a full-payment stage for cash booking initiation', async () => {
    const dto = plainToInstance(CreateBookingDTO, {
      amenity_id: '11111111-1111-4111-8111-111111111111',
      starts_at: '2026-03-24T10:00:00.000Z',
      ends_at: '2026-03-24T11:00:00.000Z',
      provider: 'cash',
      payment_stage: 'full',
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
