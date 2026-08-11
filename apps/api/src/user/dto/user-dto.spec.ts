import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DateRangeDTO,
  PaginationDTO,
  ScanQrDTO,
  UpdatePhoneDTO,
  UpdateProfileDTO,
} from './user-dto';

function extractMessages(
  errors: Awaited<ReturnType<typeof validate>>,
): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...extractMessages(error.children ?? []),
  ]);
}

describe('User DTO validation', () => {
  it('rejects blank profile names after trimming', async () => {
    const dto = plainToInstance(UpdateProfileDTO, {
      first_name: '   ',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'first_name is required',
    );
  });

  it('rejects invalid phone updates', async () => {
    const dto = plainToInstance(UpdatePhoneDTO, {
      phone_number: '09171234567',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'phone_number must be a valid Philippine mobile number in +639XXXXXXXXX format',
    );

    for (const phone_number of ['+63639171234567', '+639639171234567']) {
      const duplicatedCountryCode = plainToInstance(UpdatePhoneDTO, {
        phone_number,
      });

      expect(extractMessages(await validate(duplicatedCountryCode))).toContain(
        'phone_number must be a valid Philippine mobile number in +639XXXXXXXXX format',
      );
    }
  });

  it('accepts only canonical date-only birthdates when present', async () => {
    const omitted = plainToInstance(UpdateProfileDTO, {});
    expect(omitted.date_of_birth).toBeUndefined();
    expect(await validate(omitted)).toEqual([]);

    const valid = plainToInstance(UpdateProfileDTO, {
      date_of_birth: ' 1995-06-15 ',
    });
    expect(await validate(valid)).toEqual([]);
    expect(valid.date_of_birth).toBe('1995-06-15');

    for (const date_of_birth of [
      null,
      '1995-06-15T00:00:00.000Z',
      '1995-02-30',
    ]) {
      const invalid = plainToInstance(UpdateProfileDTO, { date_of_birth });
      const errors = await validate(invalid);

      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ property: 'date_of_birth' }),
        ]),
      );
      expect(extractMessages(errors)).toContain(
        'date_of_birth must be a valid date in YYYY-MM-DD format',
      );
    }
  });

  it('enforces the profile body metric boundaries', async () => {
    const exactMaximums = plainToInstance(UpdateProfileDTO, {
      weight_kg: 700,
      height_cm: 300,
    });
    expect(await validate(exactMaximums)).toEqual([]);

    const minimums = plainToInstance(UpdateProfileDTO, {
      weight_kg: 0,
      height_cm: 0,
    });
    const minimumErrors = extractMessages(await validate(minimums));
    expect(minimumErrors).toContain('weight_kg must be a positive number');
    expect(minimumErrors).toContain('height_cm must be a positive number');

    const aboveMaximums = plainToInstance(UpdateProfileDTO, {
      weight_kg: 700.01,
      height_cm: 300.01,
    });
    const maximumErrors = extractMessages(await validate(aboveMaximums));
    expect(maximumErrors).toContain('weight_kg must not exceed 700');
    expect(maximumErrors).toContain('height_cm must not exceed 300');
  });

  it('rejects invalid avatar URLs', async () => {
    const dto = plainToInstance(UpdateProfileDTO, {
      avatar_url: 'not a url',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'avatar_url must be a valid URL',
    );
  });

  it('rejects date ranges where end_date is earlier than start_date', async () => {
    const dto = plainToInstance(DateRangeDTO, {
      start_date: '2026-03-20',
      end_date: '2026-03-19',
    });

    expect(extractMessages(await validate(dto))).toContain(
      'end_date must be on or after start_date',
    );
  });

  it('rejects invalid pagination values', async () => {
    const dto = plainToInstance(PaginationDTO, {
      page: 0,
      limit: 101,
    });

    const messages = extractMessages(await validate(dto));
    expect(messages).toContain('page must be at least 1');
    expect(messages).toContain('limit must not exceed 100');
  });

  it('accepts the camelCase qrValue scanner payload', async () => {
    const dto = plainToInstance(ScanQrDTO, {
      qrValue: 'live-qr-value-123',
    });

    expect(extractMessages(await validate(dto))).toEqual([]);
  });

  it('requires at least one attendance QR field', async () => {
    const dto = plainToInstance(ScanQrDTO, {});

    const messages = extractMessages(await validate(dto));
    expect(messages).toContain('qrValue is required');
  });
});
