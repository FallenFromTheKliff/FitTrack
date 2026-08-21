import {
  AppointmentStatus,
  BookingStatus,
  CommerceCheckoutHoldStatus,
  PaymentStatus,
} from '@prisma/client';

import { CoachAvailabilityService } from './coach-availability.service';

describe('CoachAvailabilityService', () => {
  const coachProfile = { findUnique: jest.fn() };
  const coachAppointment = { findMany: jest.fn() };
  const amenityBooking = { findMany: jest.fn() };
  const commerceCheckoutHold = {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  };
  const payment = { updateMany: jest.fn() };
  const prisma = {
    coachProfile,
    coachAppointment,
    amenityBooking,
    commerceCheckoutHold,
    payment,
  };

  let service: CoachAvailabilityService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CoachAvailabilityService(prisma as never);
    commerceCheckoutHold.findMany.mockResolvedValue([]);
    commerceCheckoutHold.updateMany.mockResolvedValue({ count: 0 });
    payment.updateMany.mockResolvedValue({ count: 0 });
    coachAppointment.findMany.mockResolvedValue([]);
    amenityBooking.findMany.mockResolvedValue([]);
  });

  it('returns available for an active coach with an open working slot', async () => {
    coachProfile.findUnique.mockResolvedValue({
      is_available_for_booking: true,
      availability_slots: [
        {
          day_of_week: 3,
          start_time: new Date('1970-01-01T08:00:00.000Z'),
          end_time: new Date('1970-01-01T18:00:00.000Z'),
        },
      ],
    });

    const result = await service.check({
      coachId: 'coach-1',
      durationMinutes: 60,
      startsAt: new Date('2026-08-12T01:00:00.000Z'),
      now: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(result).toEqual({ available: true, conflictReasons: [] });
    expect(coachProfile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'coach-1' } }),
    );
    expect(coachAppointment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          coach_id: 'coach-1',
          status: AppointmentStatus.confirmed,
        }),
      }),
    );
    expect(amenityBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          coach_id: 'coach-1',
          status: BookingStatus.confirmed,
        }),
      }),
    );
  });

  it('blocks a confirmed venue booking assigned to the coach', async () => {
    coachProfile.findUnique.mockResolvedValue({
      is_available_for_booking: true,
      availability_slots: [
        {
          day_of_week: 3,
          start_time: new Date('1970-01-01T08:00:00.000Z'),
          end_time: new Date('1970-01-01T18:00:00.000Z'),
        },
      ],
    });
    amenityBooking.findMany.mockResolvedValue([{ id: 'venue-booking-1' }]);

    const result = await service.check({
      coachId: 'coach-1',
      durationMinutes: 60,
      startsAt: new Date('2026-08-12T01:00:00.000Z'),
      now: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(result).toEqual({
      available: false,
      conflictReasons: ['coach_venue_booking_conflict'],
    });
  });

  it('reports appointment and checkout-hold conflicts', async () => {
    coachProfile.findUnique.mockResolvedValue({
      is_available_for_booking: true,
      availability_slots: [
        {
          day_of_week: 3,
          start_time: new Date('1970-01-01T08:00:00.000Z'),
          end_time: new Date('1970-01-01T18:00:00.000Z'),
        },
      ],
    });
    coachAppointment.findMany.mockResolvedValue([
      {
        id: 'appointment-1',
        scheduled_at: new Date('2026-08-12T01:30:00.000Z'),
        duration_minutes: 60,
      },
    ]);
    commerceCheckoutHold.findMany.mockResolvedValue([
      {
        id: 'hold-1',
        scheduled_at: new Date('2026-08-12T01:30:00.000Z'),
        duration_minutes: 60,
      },
    ]);

    const result = await service.check({
      coachId: 'coach-1',
      durationMinutes: 60,
      startsAt: new Date('2026-08-12T01:00:00.000Z'),
      now: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(result.available).toBe(false);
    expect(result.conflictReasons).toEqual([
      'coach_appointment_conflict',
      'checkout_hold_conflict',
    ]);
  });

  it('blocks an active long venue hold that starts outside the appointment lookback', async () => {
    coachProfile.findUnique.mockResolvedValue({
      is_available_for_booking: true,
      availability_slots: [
        {
          day_of_week: 3,
          start_time: new Date('1970-01-01T08:00:00.000Z'),
          end_time: new Date('1970-01-01T18:00:00.000Z'),
        },
      ],
    });
    commerceCheckoutHold.findMany.mockResolvedValue([
      {
        id: 'long-venue-hold',
        scheduled_at: new Date('2026-08-11T21:00:00.000Z'),
        duration_minutes: 300,
      },
    ]);

    const result = await service.check({
      coachId: 'coach-1',
      durationMinutes: 60,
      startsAt: new Date('2026-08-12T01:00:00.000Z'),
      now: new Date('2026-08-01T00:00:00.000Z'),
    });

    expect(result.conflictReasons).toContain('checkout_hold_conflict');
    expect(commerceCheckoutHold.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          scheduled_at: { lt: new Date('2026-08-12T02:00:00.000Z') },
        }),
      }),
    );
  });

  it('builds half-hour gym slots with the exact UTC+8 date and time', async () => {
    coachProfile.findUnique.mockResolvedValue({
      is_available_for_booking: true,
      availability_slots: [
        {
          day_of_week: 3,
          start_time: new Date('1970-01-01T00:30:00.000Z'),
          end_time: new Date('1970-01-01T01:00:00.000Z'),
        },
      ],
    });

    const slots = await service.getSlots({
      coachId: 'coach-1',
      date: '2026-08-12',
      durationMinutes: 30,
    });

    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({
      start_at: '2026-08-11T16:30:00.000Z',
      end_at: '2026-08-11T17:00:00.000Z',
      available: true,
    });
  });

  it('expires held checkout attempts and their pending payments atomically', async () => {
    const now = new Date('2026-08-13T00:00:00.000Z');
    commerceCheckoutHold.findMany.mockResolvedValue([
      { id: 'hold-1' },
      { id: 'hold-2' },
    ]);

    const count = await CoachAvailabilityService.expireHoldsWithClient(
      prisma as never,
      now,
    );

    expect(count).toBe(2);
    expect(commerceCheckoutHold.findMany).toHaveBeenCalledWith({
      where: {
        status: CommerceCheckoutHoldStatus.held,
        expires_at: { lte: now },
      },
      select: { id: true },
    });
    expect(commerceCheckoutHold.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['hold-1', 'hold-2'] },
        status: CommerceCheckoutHoldStatus.held,
      },
      data: expect.objectContaining({
        status: CommerceCheckoutHoldStatus.expired,
        released_at: now,
      }),
    });
    expect(payment.updateMany).toHaveBeenCalledWith({
      where: {
        payable_type: 'commerce_checkout_hold',
        payable_id: { in: ['hold-1', 'hold-2'] },
        status: { in: [PaymentStatus.pending, PaymentStatus.processing] },
      },
      data: {
        rejection_reason: 'Checkout hold expired before payment completed.',
        status: PaymentStatus.failed,
      },
    });
  });
});
