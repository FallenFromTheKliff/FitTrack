import { BookingRepository } from './booking.repository';

describe('BookingRepository', () => {
  const payment = {
    create: jest.fn(),
  };

  const amenityBooking = {
    count: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };

  const prisma = {
    amenityBooking,
    payment,
    $transaction: jest.fn(),
  };

  let repository: BookingRepository;

  beforeEach(() => {
    repository = new BookingRepository(prisma as never);
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (
        callback: (client: {
          amenityBooking: typeof amenityBooking;
          payment: typeof payment;
        }) => unknown,
      ) =>
        callback({
          amenityBooking,
          payment,
        }),
    );
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
      include: undefined,
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
            gte: new Date('2026-03-01'),
            lte: new Date('2026-03-31'),
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

  it('completes a booking balance by stamping payment timestamps', async () => {
    const paidAt = new Date('2026-03-24T12:00:00.000Z');
    amenityBooking.update.mockResolvedValue({
      id: 'booking-1',
      status: 'completed',
    });

    await repository.completeBookingBalance('booking-1', paidAt);

    expect(amenityBooking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: {
        status: 'completed',
        balance_paid_at: paidAt,
        completed_at: paidAt,
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
