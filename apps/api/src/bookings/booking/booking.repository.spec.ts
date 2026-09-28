import { HttpException } from '@nestjs/common';
import { BookingRepository } from './booking.repository';

type MockCallSource = { mock: { calls: unknown[][] } };

function lastCallArgument<T>(mock: MockCallSource): T {
  const argument = mock.mock.calls.at(-1)?.[0];
  if (argument === undefined)
    throw new Error('Expected the mock to be called.');
  return argument as T;
}

async function expectHttpDetail(
  request: Promise<unknown>,
  expected: string,
): Promise<void> {
  try {
    await request;
    throw new Error('Expected the request to reject.');
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    const response = error.getResponse() as { detail?: string };
    expect(response.detail).toContain(expected);
  }
}

describe('BookingRepository', () => {
  const payment = {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  const amenity = {
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  };

  const amenityBooking = {
    count: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const coachProfile = { findUnique: jest.fn() };
  const coachAppointment = { findMany: jest.fn() };
  const commerceCheckoutHold = {
    count: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
  };
  const auditLog = { create: jest.fn() };

  const prisma = {
    amenity,
    amenityBooking,
    auditLog,
    coachAppointment,
    coachProfile,
    commerceCheckoutHold,
    payment,
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };

  let repository: BookingRepository;

  beforeEach(() => {
    repository = new BookingRepository(prisma as never);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (
        callback: (client: {
          amenity: typeof amenity;
          amenityBooking: typeof amenityBooking;
          auditLog: typeof auditLog;
          coachAppointment: typeof coachAppointment;
          coachProfile: typeof coachProfile;
          commerceCheckoutHold: typeof commerceCheckoutHold;
          payment: typeof payment;
          $executeRaw: typeof prisma.$executeRaw;
        }) => unknown,
      ) =>
        callback({
          amenity,
          amenityBooking,
          auditLog,
          coachAppointment,
          coachProfile,
          commerceCheckoutHold,
          payment,
          $executeRaw: prisma.$executeRaw,
        }),
    );
    amenity.findUnique.mockResolvedValue({
      capacity: 1,
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      status: 'available',
    });
    amenityBooking.findMany.mockResolvedValue([]);
    coachAppointment.findMany.mockResolvedValue([]);
    coachProfile.findUnique.mockResolvedValue({
      availability_slots: [
        {
          day_of_week: 2,
          end_time: new Date(Date.UTC(1970, 0, 1, 23, 59)),
          start_time: new Date(Date.UTC(1970, 0, 1, 0, 0)),
        },
      ],
      is_available_for_booking: true,
    });
    commerceCheckoutHold.count.mockResolvedValue(0);
    commerceCheckoutHold.findMany.mockResolvedValue([]);
    commerceCheckoutHold.updateMany.mockResolvedValue({ count: 0 });
    payment.findMany.mockResolvedValue([]);
    payment.count.mockResolvedValue(0);
    payment.updateMany.mockResolvedValue({ count: 0 });
  });

  it('lists overlapping bookings using active capacity statuses only', async () => {
    const rangeStart = new Date('2026-03-24T10:00:00.000Z');
    const rangeEnd = new Date('2026-03-24T11:00:00.000Z');
    amenityBooking.findMany.mockResolvedValue([{ id: 'booking-1' }]);

    await repository.listActiveOverlappingBookings(
      'amenity-1',
      rangeStart,
      rangeEnd,
    );

    expect(amenityBooking.findMany).toHaveBeenCalledWith({
      where: {
        amenity_id: 'amenity-1',
        status: { in: ['pending', 'confirmed', 'balance_pending'] },
        starts_at: { lt: rangeEnd },
        ends_at: { gt: rangeStart },
      },
      include: undefined,
      orderBy: { starts_at: 'asc' },
      select: undefined,
    });
  });

  it('counts active overlapping bookings for capacity checks', async () => {
    const rangeStart = new Date('2026-03-24T10:00:00.000Z');
    const rangeEnd = new Date('2026-03-24T11:00:00.000Z');
    amenityBooking.count.mockResolvedValue(2);

    await repository.countActiveOverlappingBookings(
      'amenity-1',
      rangeStart,
      rangeEnd,
    );

    expect(amenityBooking.count).toHaveBeenCalledWith({
      where: {
        amenity_id: 'amenity-1',
        status: { in: ['pending', 'confirmed', 'balance_pending'] },
        starts_at: { lt: rangeEnd },
        ends_at: { gt: rangeStart },
      },
    });
  });

  it('loads a booking only for its owner', async () => {
    amenityBooking.findUnique.mockResolvedValue({
      id: 'booking-1',
      user_id: 'user-1',
    });

    await repository.findBookingByIdAndAssertOwnership('booking-1', 'user-1');

    expect(amenityBooking.findUnique).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      include: {
        amenity: true,
        coach: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
    });
  });

  it('paginates member booking history by booking start time', async () => {
    amenityBooking.findMany.mockResolvedValue([{ id: 'booking-1' }]);
    amenityBooking.count.mockResolvedValue(1);

    await repository.getMyBookings('user-1', {
      page: 1,
      limit: 20,
      start_date: '2026-03-01',
      end_date: '2026-03-31',
    });

    expect(amenityBooking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          user_id: 'user-1',
          starts_at: {
            gte: new Date('2026-02-28T16:00:00.000Z'),
            lte: new Date('2026-03-31T15:59:59.999Z'),
          },
        },
        orderBy: { starts_at: 'desc' },
      }),
    );
  });

  it('uses a safe user projection for admin booking reads', async () => {
    amenityBooking.findMany.mockResolvedValue([{ id: 'booking-1' }]);
    amenityBooking.count.mockResolvedValue(1);

    await repository.getAllBookings({
      page: 1,
      limit: 20,
    });

    const findManyCalls = amenityBooking.findMany.mock.calls as Array<
      [
        {
          include: { amenity: true; user: { select: Record<string, boolean> } };
        },
      ]
    >;
    const include = findManyCalls[0]?.[0]?.include;

    expect(include).toEqual({
      amenity: true,
      coach: {
        include: {
          user: {
            include: {
              profile: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          role: true,
          status: true,
          email_verified_at: true,
          phone_verified_at: true,
          created_at: true,
          updated_at: true,
          profile: true,
        },
      },
    });
    expect(include.user.select).not.toHaveProperty('qr_code_token');
  });

  it('cancels an active maintenance-affected booking atomically with an operational reason and audit', async () => {
    amenityBooking.findUniqueOrThrow.mockResolvedValue({
      amenity: { name: 'Boxing Ring', status: 'maintenance' },
      amenity_id: 'amenity-1',
      cancellation_reason: null,
      cancelled_at: null,
      id: 'booking-1',
      status: 'confirmed',
      total_amount: { toString: () => '900.00' },
    });
    amenityBooking.update.mockResolvedValue({
      amenity_id: 'amenity-1',
      cancellation_reason: 'VENUE_MAINTENANCE',
      id: 'booking-1',
      status: 'cancelled',
    });

    const result = await repository.cancelBookingForMaintenance({
      actorUserId: 'staff-1',
      bookingId: 'booking-1',
      cancelledAt: new Date('2026-08-14T10:00:00.000Z'),
      note: 'Unsafe floor.',
    });

    expect(result).toEqual(
      expect.objectContaining({
        cancellation_reason: 'VENUE_MAINTENANCE',
        status: 'cancelled',
      }),
    );
    expect(
      lastCallArgument<{ data: { cancellation_reason: string } }>(
        amenityBooking.update,
      ).data.cancellation_reason,
    ).toBe('VENUE_MAINTENANCE');
    expect(
      lastCallArgument<{ data: { action: string } }>(auditLog.create).data
        .action,
    ).toBe('BOOKING_CANCELLED_MAINTENANCE');
  });

  it('reschedules a maintenance-affected booking while preserving its commercial record and auditing the move', async () => {
    const startsAt = new Date('2026-08-20T01:00:00.000Z');
    const endsAt = new Date('2026-08-20T02:00:00.000Z');
    amenityBooking.findUniqueOrThrow.mockResolvedValue({
      amenity: { name: 'Boxing Ring', status: 'maintenance' },
      amenity_id: 'amenity-1',
      coach_id: null,
      ends_at: new Date('2026-08-15T03:00:00.000Z'),
      id: 'booking-1',
      starts_at: new Date('2026-08-15T02:00:00.000Z'),
      status: 'confirmed',
      total_amount: { toString: () => '1200.00' },
    });
    amenityBooking.count.mockResolvedValue(0);
    amenity.findUnique.mockResolvedValue({
      capacity: 1,
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      status: 'available',
    });
    amenity.findUniqueOrThrow.mockResolvedValue({
      hourly_rate: { toString: () => '900.00' },
      name: 'Basketball Court',
    });
    amenityBooking.update.mockResolvedValue({
      amenity_id: 'amenity-2',
      id: 'booking-1',
      starts_at: startsAt,
      status: 'confirmed',
    });

    await repository.rescheduleBookingForMaintenance({
      actorUserId: 'staff-1',
      amenityId: 'amenity-2',
      bookingId: 'booking-1',
      endsAt,
      note: 'Maintenance move.',
      startsAt,
    });

    expect(amenityBooking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: {
        amenity_id: 'amenity-2',
        ends_at: endsAt,
        starts_at: startsAt,
      },
    });
    expect(payment.create).not.toHaveBeenCalled();
    expect(payment.updateMany).not.toHaveBeenCalled();
    expect(
      lastCallArgument<{
        data: {
          action: string;
          after: {
            payment_preserved: boolean;
            total_amount_preserved: string;
          };
        };
      }>(auditLog.create).data,
    ).toMatchObject({
      action: 'BOOKING_RESCHEDULED',
      after: {
        payment_preserved: true,
        total_amount_preserved: '1200.00',
      },
    });
  });

  it('rejects a reschedule when the replacement becomes unavailable inside the transaction', async () => {
    amenityBooking.findUniqueOrThrow.mockResolvedValue({
      amenity: { name: 'Boxing Ring', status: 'maintenance' },
      amenity_id: 'amenity-1',
      coach_id: null,
      ends_at: new Date('2026-08-15T03:00:00.000Z'),
      id: 'booking-1',
      starts_at: new Date('2026-08-15T02:00:00.000Z'),
      status: 'confirmed',
      total_amount: { toString: () => '1200.00' },
    });
    amenityBooking.count.mockResolvedValue(0);
    amenity.findUnique.mockResolvedValue({
      capacity: 1,
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      status: 'maintenance',
    });

    await expect(
      repository.rescheduleBookingForMaintenance({
        actorUserId: 'staff-1',
        amenityId: 'amenity-2',
        bookingId: 'booking-1',
        endsAt: new Date('2026-08-20T02:00:00.000Z'),
        startsAt: new Date('2026-08-20T01:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(amenityBooking.update).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a reschedule when replacement capacity is consumed before commit', async () => {
    amenityBooking.findUniqueOrThrow.mockResolvedValue({
      amenity: { name: 'Boxing Ring', status: 'maintenance' },
      amenity_id: 'amenity-1',
      coach_id: null,
      ends_at: new Date('2026-08-15T03:00:00.000Z'),
      id: 'booking-1',
      starts_at: new Date('2026-08-15T02:00:00.000Z'),
      status: 'confirmed',
      total_amount: { toString: () => '1200.00' },
    });
    amenityBooking.count.mockResolvedValue(1);
    amenity.findUnique.mockResolvedValue({
      capacity: 1,
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      status: 'available',
    });

    await expect(
      repository.rescheduleBookingForMaintenance({
        actorUserId: 'staff-1',
        amenityId: 'amenity-2',
        bookingId: 'booking-1',
        endsAt: new Date('2026-08-20T02:00:00.000Z'),
        startsAt: new Date('2026-08-20T01:00:00.000Z'),
      }),
    ).rejects.toMatchObject({ status: 409 });
    expect(amenityBooking.update).not.toHaveBeenCalled();
  });

  it('returns only fully paid venue add-ons owned by the authenticated coach', async () => {
    const paidBooking = {
      id: 'booking-paid',
      coach_id: 'coach-1',
      starts_at: new Date('2099-03-24T10:00:00.000Z'),
      created_at: new Date('2099-03-20T10:00:00.000Z'),
    };
    const unpaidBooking = {
      id: 'booking-unpaid',
      coach_id: 'coach-1',
      starts_at: new Date('2099-03-25T10:00:00.000Z'),
      created_at: new Date('2099-03-20T10:00:00.000Z'),
    };
    amenityBooking.findMany.mockResolvedValue([paidBooking, unpaidBooking]);
    payment.findMany.mockResolvedValue([{ payable_id: 'booking-paid' }]);

    const result = await repository.getCoachVenueWork('coach-user-1', {
      page: 1,
      limit: 20,
    });

    expect(result.data).toEqual([paidBooking]);
    expect(
      lastCallArgument<{
        where: { coach: unknown; status: { in: string[] } };
      }>(amenityBooking.findMany).where,
    ).toMatchObject({
      coach: { is: { user_id: 'coach-user-1' } },
      status: {
        in: ['confirmed', 'completed', 'cancelled', 'no_show'],
      },
    });
    expect(payment.findMany).toHaveBeenCalledWith({
      where: {
        payable_id: { in: ['booking-paid', 'booking-unpaid'] },
        payable_type: 'booking',
        payment_stage: 'full',
        status: 'completed',
      },
      select: { payable_id: true },
    });
  });

  it('authorizes venue delivery only for the assigned coach with full payment provenance', async () => {
    amenityBooking.findFirst.mockResolvedValue({ id: 'booking-1' });
    payment.count.mockResolvedValue(1);
    commerceCheckoutHold.count.mockResolvedValue(0);

    await expect(
      repository.isFullyPaidCoachVenueWork('booking-1', 'coach-user-1'),
    ).resolves.toBe(true);
    expect(amenityBooking.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        coach: { is: { user_id: 'coach-user-1' } },
        total_amount: { gt: 0 },
      },
      select: { id: true },
    });
  });

  it('persists optional coach linkage on confirmed free bookings', async () => {
    const startsAt = new Date('2099-03-24T10:00:00.000Z');
    const endsAt = new Date('2099-03-24T11:00:00.000Z');
    amenityBooking.count.mockResolvedValue(0);
    amenityBooking.create.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });

    await repository.createConfirmedFreeBooking({
      userId: 'user-1',
      amenityId: 'amenity-1',
      coachId: 'coach-1',
      startsAt,
      endsAt,
      notes: 'Coach-linked scrimmage.',
      totalAmount: 0 as never,
      downpaymentAmount: 0 as never,
      balanceAmount: 0 as never,
    });

    expect(
      lastCallArgument<{ data: Record<string, unknown> }>(amenityBooking.create)
        .data,
    ).toMatchObject({
      user: { connect: { id: 'user-1' } },
      amenity: { connect: { id: 'amenity-1' } },
      coach: { connect: { id: 'coach-1' } },
      starts_at: startsAt,
      ends_at: endsAt,
    });
  });

  it('revalidates maintenance inside the booking transaction', async () => {
    amenity.findUnique.mockResolvedValue({
      capacity: 1,
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      status: 'maintenance',
    });

    const rejected = repository.createConfirmedFreeBooking({
      userId: 'user-1',
      amenityId: 'maintenance-venue',
      startsAt: new Date('2099-03-24T10:00:00.000Z'),
      endsAt: new Date('2099-03-24T11:00:00.000Z'),
      totalAmount: 0 as never,
      downpaymentAmount: 0 as never,
      balanceAmount: 0 as never,
    });
    await expectHttpDetail(rejected, 'under maintenance');
    expect(amenityBooking.create).not.toHaveBeenCalled();
  });

  it('persists optional coach linkage on pending paid bookings', async () => {
    const startsAt = new Date('2099-03-24T10:00:00.000Z');
    const endsAt = new Date('2099-03-24T11:00:00.000Z');
    amenityBooking.count.mockResolvedValue(0);
    amenityBooking.create.mockResolvedValue({
      id: 'booking-1',
      status: 'pending',
    });
    payment.create.mockResolvedValue({
      id: 'payment-1',
      payable_type: 'booking',
    });

    await repository.createPendingBookingWithPayment({
      userId: 'user-1',
      amenityId: 'amenity-1',
      coachId: 'coach-1',
      startsAt,
      endsAt,
      notes: 'Coach-linked training block.',
      totalAmount: 1000 as never,
      downpaymentAmount: 300 as never,
      balanceAmount: 700 as never,
      paymentAmount: 300 as never,
      paymentStage: 'downpayment' as never,
      paymentStatus: 'pending' as never,
      idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      provider: 'paymongo',
    });

    expect(
      lastCallArgument<{ data: Record<string, unknown> }>(amenityBooking.create)
        .data,
    ).toMatchObject({
      user: { connect: { id: 'user-1' } },
      amenity: { connect: { id: 'amenity-1' } },
      coach: { connect: { id: 'coach-1' } },
      starts_at: startsAt,
      ends_at: endsAt,
    });
  });

  it('stores full cash booking initiations as awaiting verification payments', async () => {
    const startsAt = new Date('2099-03-24T10:00:00.000Z');
    const endsAt = new Date('2099-03-24T11:00:00.000Z');
    amenityBooking.count.mockResolvedValue(0);
    amenityBooking.create.mockResolvedValue({
      id: 'booking-1',
      status: 'pending',
    });
    payment.create.mockResolvedValue({
      id: 'payment-1',
      payment_stage: 'full',
      provider: 'cash',
      status: 'awaiting_verification',
    });

    await repository.createPendingBookingWithPayment({
      userId: 'user-1',
      amenityId: 'amenity-1',
      startsAt,
      endsAt,
      totalAmount: 800 as never,
      downpaymentAmount: 800 as never,
      balanceAmount: 0 as never,
      paymentAmount: 800 as never,
      paymentStage: 'full' as never,
      paymentStatus: 'awaiting_verification' as never,
      idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      provider: 'cash' as never,
    });

    expect(
      lastCallArgument<{ data: Record<string, unknown> }>(payment.create).data,
    ).toMatchObject({
      payment_stage: 'full',
      amount: 800,
      provider: 'cash',
      status: 'awaiting_verification',
    });
  });

  it('cancels a booking by setting status and cancelled timestamp', async () => {
    const cancelledAt = new Date('2026-03-24T12:00:00.000Z');
    amenityBooking.update.mockResolvedValue({
      id: 'booking-1',
      status: 'cancelled',
    });

    await repository.cancelBooking('booking-1', cancelledAt);

    expect(amenityBooking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: {
        status: 'cancelled',
        cancelled_at: cancelledAt,
      },
      include: undefined,
    });
  });

  it('creates a balance payment and marks the booking balance_pending in one transaction', async () => {
    amenityBooking.update.mockResolvedValue({
      id: 'booking-1',
      status: 'balance_pending',
    });
    payment.create.mockResolvedValue({
      id: 'payment-1',
      payment_stage: 'balance',
      provider: 'cash',
    });

    await repository.createBalancePendingPayment({
      bookingId: 'booking-1',
      userId: 'user-1',
      amount: 560,
      provider: 'cash' as never,
      referenceNo: 'OR-123',
      screenshotUrl: 'https://cdn.fittrack.test/receipt.png',
      idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    });

    expect(amenityBooking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: 'balance_pending' },
    });
    const paymentCreateCalls = payment.create.mock.calls as Array<
      [{ data: Record<string, unknown> }]
    >;
    const paymentCreateArgs = paymentCreateCalls[0]?.[0];

    expect(paymentCreateArgs.data).toMatchObject({
      payable_type: 'booking',
      payable_id: 'booking-1',
      payment_stage: 'balance',
      provider: 'cash',
      provider_ref: 'OR-123',
      screenshot_url: 'https://cdn.fittrack.test/receipt.png',
      status: 'awaiting_verification',
    });
  });

  it('settles a booking balance while keeping the booking confirmed', async () => {
    const paidAt = new Date('2026-03-24T12:00:00.000Z');
    amenityBooking.update.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });

    await repository.completeBookingBalance('booking-1', paidAt);

    expect(amenityBooking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: {
        status: 'confirmed',
        balance_paid_at: paidAt,
      },
      include: undefined,
    });
  });

  it('stamps both payment timestamps when a booking is fully paid up front', async () => {
    const paidAt = new Date('2026-03-24T12:00:00.000Z');
    amenityBooking.update.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });

    await repository.confirmBookingFullPayment('booking-1', paidAt);

    expect(amenityBooking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: {
        status: 'confirmed',
        downpayment_paid_at: paidAt,
        balance_paid_at: paidAt,
      },
      include: undefined,
    });
  });

  it('marks confirmed bookings as no_show only when the grace window has passed', async () => {
    const eligibleStartsAt = new Date('2026-03-24T10:30:00.000Z');
    amenityBooking.updateMany.mockResolvedValue({ count: 1 });

    await repository.markBookingNoShowIfEligible('booking-1', eligibleStartsAt);

    expect(amenityBooking.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        status: 'confirmed',
        starts_at: { lte: eligibleStartsAt },
      },
      data: {
        status: 'no_show',
      },
    });
  });

  it('completes past free bookings only after they end', async () => {
    const now = new Date('2026-03-24T12:00:00.000Z');
    amenityBooking.updateMany.mockResolvedValue({ count: 1 });

    await repository.completePastFreeBookings(now);

    const updateManyCalls = amenityBooking.updateMany.mock.calls as Array<
      [
        {
          data: Record<string, unknown>;
          where: {
            balance_amount: { toString(): string };
            ends_at: { lte: Date };
            status: string;
          };
        },
      ]
    >;
    const updateArgs = updateManyCalls[0]?.[0];

    expect(updateArgs.where.status).toBe('confirmed');
    expect(updateArgs.where.balance_amount.toString()).toBe('0');
    expect(updateArgs.where.ends_at).toEqual({ lte: now });
    expect(updateArgs.data).toEqual({
      status: 'completed',
      completed_at: now,
    });
  });
});
