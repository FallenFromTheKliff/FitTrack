import { ExecutionContext } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { firstValueFrom, of, throwError } from 'rxjs';

import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';
import { BookingHoursInterceptor } from './booking-hours.interceptor';

function makeContext(
  handlerName: string,
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    getClass: () => ({ name: 'BookingController' }),
    getHandler: () => ({ name: handlerName }),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('BookingHoursInterceptor', () => {
  const gymOperatingHour = { findFirst: jest.fn() };
  const gymSpecialSchedule = { findFirst: jest.fn() };
  const prisma = { gymOperatingHour, gymSpecialSchedule };
  let interceptor: BookingHoursInterceptor;

  beforeEach(() => {
    jest.clearAllMocks();
    gymSpecialSchedule.findFirst.mockResolvedValue({
      closes_at: new Date('1970-01-01T17:00:00.000Z'),
      is_closed: false,
      opens_at: new Date('1970-01-01T09:00:00.000Z'),
      reason: 'Temporary hours',
    });
    interceptor = new BookingHoursInterceptor(prisma as never);
  });

  it('maps available, full, and out-of-hours slots to explicit statuses', async () => {
    const context = makeContext('getAvailability', {
      query: { date: '2026-08-12' },
    });
    const next = {
      handle: jest.fn(() =>
        of([
          {
            starts_at: '2026-08-12T01:00:00.000Z',
            ends_at: '2026-08-12T02:00:00.000Z',
            available: true,
          },
          {
            starts_at: '2026-08-12T02:00:00.000Z',
            ends_at: '2026-08-12T03:00:00.000Z',
            available: false,
          },
          {
            starts_at: '2026-08-12T00:00:00.000Z',
            ends_at: '2026-08-12T01:00:00.000Z',
            available: true,
          },
        ]),
      ),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual([
      expect.objectContaining({ available: true, status: 'available' }),
      expect.objectContaining({ available: false, status: 'full' }),
      expect.objectContaining({ available: false, status: 'unavailable' }),
    ]);
  });

  it('decorates the production response envelope and preserves the standard contract', async () => {
    const context = makeContext('getAvailability', {
      query: { date: '2026-08-12' },
    });
    const responseInterceptor = new ResponseInterceptor();
    const response = responseInterceptor.intercept(context, {
      handle: () =>
        of([
          {
            starts_at: '2026-08-12T01:00:00.000Z',
            ends_at: '2026-08-12T02:00:00.000Z',
            available: true,
          },
          {
            starts_at: '2026-08-12T02:00:00.000Z',
            ends_at: '2026-08-12T03:00:00.000Z',
            available: false,
          },
          {
            starts_at: '2026-08-12T00:00:00.000Z',
            ends_at: '2026-08-12T01:00:00.000Z',
            available: true,
          },
        ]),
    });
    const next = { handle: jest.fn(() => response) };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({
      data: [
        expect.objectContaining({ available: true, status: 'available' }),
        expect.objectContaining({ available: false, status: 'full' }),
        expect.objectContaining({ available: false, status: 'unavailable' }),
      ],
    });
  });

  it('preserves metadata for an empty wrapped availability response', async () => {
    const context = makeContext('getAvailability', {
      query: { date: '2026-08-12' },
    });
    const next = {
      handle: jest.fn(() =>
        of({
          data: [],
          meta: { source: 'availability' },
          request_id: 'request-1',
        }),
      ),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({
      data: [],
      meta: { source: 'availability' },
      request_id: 'request-1',
    });
  });

  it('marks every slot unavailable when effective gym hours are closed', async () => {
    gymSpecialSchedule.findFirst.mockResolvedValue({
      closes_at: null,
      is_closed: true,
      opens_at: null,
      reason: 'Holiday closure',
    });
    const context = makeContext('getAvailability', {
      query: { date: '2026-08-12' },
    });
    const next = {
      handle: jest.fn(() =>
        of([
          {
            starts_at: '2026-08-12T01:00:00.000Z',
            ends_at: '2026-08-12T02:00:00.000Z',
            available: true,
          },
        ]),
      ),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual([
      expect.objectContaining({ available: false, status: 'unavailable' }),
    ]);
  });

  it('rejects malformed availability payloads instead of treating them as empty', async () => {
    const context = makeContext('getAvailability', {
      query: { date: '2026-08-12' },
    });
    const next = {
      handle: jest.fn(() => of({ data: { slots: [] } })),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toThrow(
      'Booking availability response must be an array or an envelope containing an array.',
    );
  });

  it('propagates upstream availability errors without substituting empty slots', async () => {
    const context = makeContext('getAvailability', {
      query: { date: '2026-08-12' },
    });
    const upstreamError = new Error('availability backend unavailable');
    const next = {
      handle: jest.fn(() => throwError(() => upstreamError)),
    };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(upstreamError);
  });

  it('rejects a member booking before the legacy service for out-of-hours windows', async () => {
    const context = makeContext('createBooking', {
      body: {
        starts_at: '2026-08-12T00:00:00.000Z',
        ends_at: '2026-08-12T01:00:00.000Z',
      },
      user: { role: UserRole.member },
    });
    const next = { handle: jest.fn(() => of({ booking_id: 'booking-1' })) };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).rejects.toMatchObject({
      response: {
        status: 400,
        type: 'OUTSIDE_GYM_HOURS',
      },
    });
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('delegates a valid member booking after the effective-hours assertion', async () => {
    const context = makeContext('createBooking', {
      body: {
        starts_at: '2026-08-12T01:00:00.000Z',
        ends_at: '2026-08-12T02:00:00.000Z',
      },
      user: { role: UserRole.member },
    });
    const next = { handle: jest.fn(() => of({ booking_id: 'booking-1' })) };

    await expect(
      firstValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({ booking_id: 'booking-1' });
    expect(next.handle).toHaveBeenCalledTimes(1);
  });
});
