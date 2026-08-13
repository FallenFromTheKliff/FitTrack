import {
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { PaymentRepository } from './payment.repository';

describe('PaymentRepository', () => {
  const payment = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };

  const membershipCard = {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };

  const user = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  const subscription = {
    findUnique: jest.fn(),
  };

  const commerceCheckoutHold = {
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };

  const prisma = {
    payment,
    subscription,
    membershipCard,
    user,
    commerceCheckoutHold,
    $transaction: jest.fn(),
  };

  let repo: PaymentRepository;

  beforeEach(() => {
    repo = new PaymentRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('looks up payments by the stable idempotency key', async () => {
    payment.findUnique.mockResolvedValue({ id: 'payment-1' });

    await expect(repo.findPaymentByIdempotencyKey('attempt-1')).resolves.toEqual(
      { id: 'payment-1' },
    );
    expect(payment.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { idempotency_key: 'attempt-1' } }),
    );
  });

  it('filters the admin payments queue by status and payable type', async () => {
    payment.findMany.mockResolvedValue([{ id: 'payment-1' }]);
    payment.count.mockResolvedValue(1);

    const result = await repo.getAllPayments({
      status: 'awaiting_verification',
      payable_type: 'subscription',
      page: 1,
      limit: 20,
    });

    expect(payment.findMany).toHaveBeenCalledWith({
      where: {
        status: 'awaiting_verification',
        payable_type: 'subscription',
      },
      include: {
        user: { include: { profile: true } },
        verifier: { include: { profile: true } },
      },
      orderBy: { created_at: 'desc' },
      skip: 0,
      take: 20,
    });
    expect(result.meta.total).toBe(1);
  });

  it('atomically claims a PayMongo membership-card success and activates only its pending card', async () => {
    const pendingPayment = {
      id: 'payment-card-1',
      user_id: 'member-1',
      payable_type: 'membership_card',
      payable_id: 'card-1',
      provider: 'paymongo',
      status: 'processing',
    };
    const completedPayment = { ...pendingPayment, status: 'completed' };
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValueOnce(pendingPayment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue(completedPayment),
      },
      membershipCard: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'card-1',
          user_id: 'member-1',
          source: 'paymongo',
          status: 'pending_verification',
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'member-1',
          status: 'pending',
          qr_code_token: null,
        }),
        update: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );

    const result = await repo.completePaymongoMembershipCardPayment(
      'payment-card-1',
      {
        gatewayEventId: 'evt-card-1',
        gatewayMetadata: { last_webhook: { event_id: 'evt-card-1' } },
        verifiedAt: new Date('2026-08-11T00:00:00.000Z'),
      },
    );

    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          provider: 'paymongo',
          payable_type: 'membership_card',
          status: { in: ['pending', 'processing'] },
        }) as unknown as Record<string, unknown>,
      }),
    );
    expect(tx.membershipCard.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: 'paymongo',
          status: 'pending_verification',
        }) as unknown as Record<string, unknown>,
      }),
    );
    expect(result).toEqual({
      payment: completedPayment,
      transitioned: true,
      membershipCardStateChanged: true,
    });
  });

  it('does not re-activate or re-emit a completed membership-card payment transition', async () => {
    const completedPayment = {
      id: 'payment-card-1',
      user_id: 'member-1',
      payable_type: 'membership_card',
      payable_id: 'card-1',
      provider: 'paymongo',
      status: 'completed',
    };
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(completedPayment),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUnique: jest.fn().mockResolvedValue(completedPayment),
      },
      membershipCard: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );

    await expect(
      repo.completePaymongoMembershipCardPayment('payment-card-1', {
        gatewayEventId: 'evt-card-duplicate',
        gatewayMetadata: {},
        verifiedAt: new Date(),
      }),
    ).resolves.toEqual({
      payment: completedPayment,
      transitioned: false,
      membershipCardStateChanged: false,
    });
    expect(tx.membershipCard.updateMany).not.toHaveBeenCalled();
  });

  it('marks an expired commerce hold payment failed without creating a product', async () => {
    const verifiedAt = new Date('2026-08-13T00:00:00.000Z');
    const pendingPayment = {
      id: 'payment-hold-1',
      user_id: 'member-1',
      payable_type: 'commerce_checkout_hold',
      payable_id: 'hold-1',
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.pending,
    };
    const hold = {
      id: 'hold-1',
      kind: CommerceCheckoutHoldKind.one_time,
      status: CommerceCheckoutHoldStatus.held,
      expires_at: new Date('2026-08-12T23:59:00.000Z'),
    };
    const failedPayment = { ...pendingPayment, status: PaymentStatus.failed };
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(pendingPayment),
        update: jest.fn().mockResolvedValue(failedPayment),
      },
      commerceCheckoutHold: {
        findUnique: jest.fn().mockResolvedValue(hold),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );

    await expect(
      repo.completePaymongoCommerceCheckout('payment-hold-1', {
        gatewayEventId: 'evt-expired-1',
        gatewayMetadata: { checkout_url: 'https://checkout.paymongo.com/expired' },
        verifiedAt,
      }),
    ).resolves.toMatchObject({
      payment: failedPayment,
      productCreated: false,
      productKind: CommerceCheckoutHoldKind.one_time,
      transitioned: true,
    });
    expect(tx.commerceCheckoutHold.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hold-1', status: CommerceCheckoutHoldStatus.held },
        data: expect.objectContaining({ status: CommerceCheckoutHoldStatus.expired }),
      }),
    );
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'payment-hold-1' },
        data: expect.objectContaining({
          gateway_event_id: 'evt-expired-1',
          status: PaymentStatus.failed,
        }),
      }),
    );
  });

  it('fails a commerce hold and releases it on a failed webhook', async () => {
    const paymentRecord = {
      id: 'payment-hold-1',
      user_id: 'member-1',
      payable_type: 'commerce_checkout_hold',
      payable_id: 'hold-1',
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.processing,
    };
    const hold = {
      id: 'hold-1',
      kind: CommerceCheckoutHoldKind.venue,
      status: CommerceCheckoutHoldStatus.held,
    };
    const failedPayment = { ...paymentRecord, status: PaymentStatus.failed };
    const tx = {
      payment: {
        findUnique: jest.fn().mockResolvedValue(paymentRecord),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(failedPayment),
      },
      commerceCheckoutHold: {
        findUnique: jest.fn().mockResolvedValue(hold),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );

    await expect(
      repo.failPaymongoCommerceCheckout('payment-hold-1', {
        gatewayEventId: 'evt-failed-1',
        gatewayMetadata: { failed_message: 'card declined' },
        rejectionReason: 'card declined',
      }),
    ).resolves.toMatchObject({
      payment: failedPayment,
      productCreated: false,
      productKind: CommerceCheckoutHoldKind.venue,
      transitioned: true,
    });
    expect(tx.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'payment-hold-1',
          status: { in: [PaymentStatus.pending, PaymentStatus.processing] },
        },
      }),
    );
    expect(tx.commerceCheckoutHold.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hold-1', status: CommerceCheckoutHoldStatus.held },
        data: expect.objectContaining({ status: CommerceCheckoutHoldStatus.failed }),
      }),
    );
  });

  it('does not transition a commerce hold twice for a duplicate paid webhook', async () => {
    const completedPayment = {
      id: 'payment-hold-1',
      payable_type: 'commerce_checkout_hold',
      payable_id: 'hold-1',
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.completed,
    };
    const consumedHold = {
      id: 'hold-1',
      kind: CommerceCheckoutHoldKind.monthly,
      status: CommerceCheckoutHoldStatus.consumed,
      recurring_plan_id: 'plan-1',
    };
    const tx = {
      payment: { findUnique: jest.fn().mockResolvedValue(completedPayment) },
      commerceCheckoutHold: {
        findUnique: jest.fn().mockResolvedValue(consumedHold),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );

    await expect(
      repo.completePaymongoCommerceCheckout('payment-hold-1', {
        gatewayEventId: 'evt-duplicate-1',
        gatewayMetadata: {},
        verifiedAt: new Date('2026-08-13T00:00:00.000Z'),
      }),
    ).resolves.toEqual({
      payment: completedPayment,
      productCreated: true,
      productId: 'plan-1',
      productKind: CommerceCheckoutHoldKind.monthly,
      transitioned: false,
    });
  });

  it('creates a paid venue booking with the coach preserved by its hold', async () => {
    const verifiedAt = new Date('2026-08-13T00:00:00.000Z');
    const pendingPayment = {
      amount: new Prisma.Decimal('800'),
      id: 'payment-venue-coach-1',
      payable_id: 'hold-venue-coach-1',
      payable_type: 'commerce_checkout_hold',
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.pending,
      user_id: 'member-1',
      verified_at: verifiedAt,
    };
    const completedPayment = {
      ...pendingPayment,
      status: PaymentStatus.completed,
    };
    const hold = {
      amenity_id: 'amenity-1',
      booking_id: null,
      coach_id: 'coach-venue-1',
      ends_at: new Date('2026-08-13T02:00:00.000Z'),
      expires_at: new Date('2026-08-13T00:15:00.000Z'),
      id: 'hold-venue-coach-1',
      kind: CommerceCheckoutHoldKind.venue,
      member_notes: 'Coach-assisted court session',
      scheduled_at: new Date('2026-08-13T01:00:00.000Z'),
      status: CommerceCheckoutHoldStatus.held,
      user_id: 'member-1',
    };
    const consumedHold = {
      ...hold,
      booking_id: 'booking-venue-coach-1',
      status: CommerceCheckoutHoldStatus.consumed,
    };
    const tx = {
      $executeRaw: jest.fn(),
      amenity: {
        findUnique: jest.fn().mockResolvedValue({
          capacity: 2,
          is_reservable: true,
        }),
      },
      amenityBooking: {
        count: jest.fn().mockResolvedValue(0),
        create: jest
          .fn()
          .mockResolvedValue({ id: 'booking-venue-coach-1' }),
      },
      coachAppointment: { findMany: jest.fn().mockResolvedValue([]) },
      coachProfile: {
        findUnique: jest.fn().mockResolvedValue({
          availability_slots: Array.from({ length: 7 }, (_, day_of_week) => ({
            day_of_week,
            end_time: new Date('1970-01-01T23:59:00.000Z'),
            start_time: new Date('1970-01-01T00:00:00.000Z'),
          })),
          is_available_for_booking: true,
        }),
      },
      commerceCheckoutHold: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(hold),
        update: jest.fn().mockResolvedValue(consumedHold),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(pendingPayment),
        findUniqueOrThrow: jest.fn().mockResolvedValue(completedPayment),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );

    await expect(
      repo.completePaymongoCommerceCheckout('payment-venue-coach-1', {
        gatewayEventId: 'evt-venue-coach-1',
        gatewayMetadata: {},
        verifiedAt,
      }),
    ).resolves.toMatchObject({
      productCreated: true,
      productId: 'booking-venue-coach-1',
      productKind: CommerceCheckoutHoldKind.venue,
      transitioned: true,
    });
    expect(tx.amenityBooking.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        coach: { connect: { id: 'coach-venue-1' } },
        user: { connect: { id: 'member-1' } },
      }),
    });
    expect(tx.$executeRaw).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'coach-venue-1:2026-08-13',
    );
    expect(tx.$executeRaw).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'amenity-1:2026-08-13',
    );
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.commerceCheckoutHold.findMany.mock.invocationCallOrder[0],
    );
    expect(tx.$executeRaw.mock.invocationCallOrder[1]).toBeLessThan(
      tx.amenityBooking.create.mock.invocationCallOrder[0],
    );
  });

  it('rolls back paid venue fulfillment when another live coach hold overlaps', async () => {
    const verifiedAt = new Date('2026-08-13T00:00:00.000Z');
    const pendingPayment = {
      amount: new Prisma.Decimal('800'),
      id: 'payment-venue-race-1',
      payable_id: 'hold-venue-race-1',
      payable_type: 'commerce_checkout_hold',
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.pending,
      user_id: 'member-1',
      verified_at: verifiedAt,
    };
    const hold = {
      amenity_id: 'amenity-1',
      coach_id: 'coach-venue-1',
      ends_at: new Date('2026-08-13T02:30:00.000Z'),
      expires_at: new Date('2026-08-13T00:15:00.000Z'),
      id: 'hold-venue-race-1',
      kind: CommerceCheckoutHoldKind.venue,
      scheduled_at: new Date('2026-08-13T01:30:00.000Z'),
      status: CommerceCheckoutHoldStatus.held,
      user_id: 'member-1',
    };
    const tx = {
      $executeRaw: jest.fn(),
      amenityBooking: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      coachAppointment: { findMany: jest.fn().mockResolvedValue([]) },
      coachProfile: {
        findUnique: jest.fn().mockResolvedValue({
          availability_slots: Array.from({ length: 7 }, (_, day_of_week) => ({
            day_of_week,
            end_time: new Date('1970-01-01T23:59:00.000Z'),
            start_time: new Date('1970-01-01T00:00:00.000Z'),
          })),
          is_available_for_booking: true,
        }),
      },
      commerceCheckoutHold: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              ends_at: new Date('2026-08-13T02:00:00.000Z'),
              id: 'hold-venue-existing',
              scheduled_at: new Date('2026-08-13T00:30:00.000Z'),
            },
          ])
          .mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(hold),
        update: jest.fn(),
      },
      payment: {
        findUnique: jest.fn().mockResolvedValue(pendingPayment),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );

    await expect(
      repo.completePaymongoCommerceCheckout('payment-venue-race-1', {
        gatewayEventId: 'evt-venue-race-1',
        gatewayMetadata: {},
        verifiedAt,
      }),
    ).rejects.toMatchObject({
      response: {
        conflict_reasons: ['checkout_hold_conflict'],
        title: 'Coach Slot Unavailable',
      },
    });
    expect(tx.$executeRaw).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'coach-venue-1:2026-08-13',
    );
    expect(tx.amenityBooking.create).not.toHaveBeenCalled();
    expect(tx.commerceCheckoutHold.update).not.toHaveBeenCalled();
  });
});
