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
