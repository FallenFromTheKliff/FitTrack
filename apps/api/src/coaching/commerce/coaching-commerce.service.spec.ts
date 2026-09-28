import { ConflictException } from '@nestjs/common';
import {
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
} from '@prisma/client';

import { CoachingCommerceService } from './coaching-commerce.service';

describe('CoachingCommerceService', () => {
  const commerceCheckoutHold = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
  };
  const payment = {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = {
    commerceCheckoutHold,
    payment,
    $transaction: jest.fn(),
  };
  const paymongoCheckoutService = {
    createCheckoutSession: jest.fn(),
  };

  let service: CoachingCommerceService;

  const makeHold = (overrides: Record<string, unknown> = {}) => ({
    id: 'hold-1',
    user_id: 'member-1',
    coach_id: 'coach-1',
    amenity_id: null,
    appointment_id: null,
    booking_id: null,
    membership_card_id: null,
    recurring_plan_id: null,
    subscription_id: null,
    payment_id: 'payment-1',
    amount: new Prisma.Decimal('1200'),
    duration_minutes: 60,
    end_date: null,
    ends_at: null,
    expires_at: new Date('2099-04-01T00:15:00.000Z'),
    failure_reason: null,
    idempotency_key: 'attempt-1',
    kind: CommerceCheckoutHoldKind.one_time,
    member_notes: null,
    preferred_days: [],
    preferred_time: null,
    scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
    session_count: null,
    start_date: null,
    status: CommerceCheckoutHoldStatus.held,
    consumed_at: null,
    released_at: null,
    payment: {
      id: 'payment-1',
      amount: new Prisma.Decimal('1200'),
      idempotency_key: 'attempt-1',
      gateway_metadata: {
        checkout_url: 'https://checkout.paymongo.com/existing',
      },
      rejection_reason: null,
      payable_id: 'hold-1',
      payable_type: 'commerce_checkout_hold',
      payment_stage: PaymentStage.full,
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.pending,
      user_id: 'member-1',
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CoachingCommerceService(
      prisma as never,
      paymongoCheckoutService as never,
    );
  });

  it('returns the existing one-time checkout for a repeated idempotency key', async () => {
    const hold = makeHold();
    commerceCheckoutHold.findUnique.mockResolvedValue(hold);

    const result = await service.createOneTimeCheckout({
      amount: new Prisma.Decimal('1200'),
      coachId: 'coach-1',
      durationMinutes: 60,
      idempotencyKey: 'attempt-1',
      scheduledAt: new Date('2099-04-01T08:00:00.000Z'),
      userId: 'member-1',
    });

    expect(result).toMatchObject({
      checkout_url: 'https://checkout.paymongo.com/existing',
      hold_id: 'hold-1',
      kind: CommerceCheckoutHoldKind.one_time,
      payment_id: 'payment-1',
      status: CommerceCheckoutHoldStatus.held,
    });
    expect(commerceCheckoutHold.findUnique).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(paymongoCheckoutService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('starts checkout once when an existing held attempt has no checkout URL yet', async () => {
    const holdWithoutUrl = makeHold({
      payment: {
        ...makeHold().payment,
        gateway_metadata: null,
      },
    });
    const holdWithUrl = makeHold({
      payment: {
        ...makeHold().payment,
        gateway_metadata: {
          checkout_url: 'https://checkout.paymongo.com/resumed',
        },
      },
    });
    commerceCheckoutHold.findUnique
      .mockResolvedValueOnce(holdWithoutUrl)
      .mockResolvedValueOnce(holdWithoutUrl)
      .mockResolvedValue(holdWithUrl);
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      providerRef: 'cs-resumed',
      checkoutUrl: 'https://checkout.paymongo.com/resumed',
      gatewayMetadata: {
        checkout_url: 'https://checkout.paymongo.com/resumed',
      },
    });
    payment.update.mockResolvedValue(holdWithUrl.payment);

    const input = {
      amount: new Prisma.Decimal('1200'),
      coachId: 'coach-1',
      durationMinutes: 60,
      idempotencyKey: 'attempt-1',
      returnTarget: 'expo_web',
      returnUrl: 'https://local.expo.app/checkout-return',
      scheduledAt: new Date('2099-04-01T08:00:00.000Z'),
      userId: 'member-1',
    };

    const first = await service.createOneTimeCheckout(input);
    const second = await service.createOneTimeCheckout(input);

    expect(first.checkout_url).toBe('https://checkout.paymongo.com/resumed');
    expect(second.checkout_url).toBe('https://checkout.paymongo.com/resumed');
    expect(paymongoCheckoutService.createCheckoutSession).toHaveBeenCalledTimes(1);
    expect(paymongoCheckoutService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 120000,
        idempotencyKey: 'attempt-1',
        cancelQuery: {
          client: 'expo_web',
          flow: 'coach-single',
          hold_id: 'hold-1',
          return_url: 'https://local.expo.app/checkout-return',
        },
        successQuery: {
          client: 'expo_web',
          flow: 'coach-single',
          hold_id: 'hold-1',
          return_url: 'https://local.expo.app/checkout-return',
        },
        metadata: expect.objectContaining({
          coaching_checkout_hold_id: 'hold-1',
          hold_id: 'hold-1',
          payment_id: 'payment-1',
        }),
      }),
    );
  });

  it('reuses a valid live monthly hold for the same idempotency key', async () => {
    const hold = makeHold({
      end_date: new Date('2099-05-01T00:00:00.000Z'),
      kind: CommerceCheckoutHoldKind.monthly,
      session_count: 4,
      start_date: new Date('2099-04-01T00:00:00.000Z'),
    });
    commerceCheckoutHold.findUnique.mockResolvedValue(hold);

    const input = {
      amount: new Prisma.Decimal('12000'),
      coachId: 'coach-1',
      durationMinutes: 60,
      endDate: new Date('2099-05-01T00:00:00.000Z'),
      idempotencyKey: 'attempt-monthly-1',
      sessionCount: 4,
      startDate: new Date('2099-04-01T00:00:00.000Z'),
      userId: 'member-1',
    };

    const first = await service.createMonthlyCheckout(input);
    const second = await service.createMonthlyCheckout(input);

    expect(first).toMatchObject({
      hold_id: 'hold-1',
      kind: CommerceCheckoutHoldKind.monthly,
      payment_id: 'payment-1',
      status: CommerceCheckoutHoldStatus.held,
    });
    expect(second).toEqual(first);
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(paymongoCheckoutService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('passes the monthly hold id through PayMongo idempotency and return URLs', async () => {
    const idempotencyKey = 'attempt-monthly-2';
    const createdHold = makeHold({
      end_date: new Date('2099-05-01T00:00:00.000Z'),
      id: 'hold-monthly-2',
      kind: CommerceCheckoutHoldKind.monthly,
      payment: {
        ...makeHold().payment,
        gateway_metadata: null,
        id: 'payment-monthly-2',
        idempotency_key: idempotencyKey,
        payable_id: 'hold-monthly-2',
      },
      payment_id: 'payment-monthly-2',
      session_count: 4,
      start_date: new Date('2099-04-01T00:00:00.000Z'),
    });
    const tx = {
      $executeRaw: jest.fn(),
      commerceCheckoutHold: {
        create: jest.fn().mockResolvedValue(createdHold),
        findFirst: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdHold),
        update: jest.fn().mockResolvedValue(createdHold),
      },
      recurringCoachingPlan: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      payment: {
        create: jest.fn().mockResolvedValue(createdHold.payment),
      },
    };
    commerceCheckoutHold.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      gatewayMetadata: {
        checkout_url: 'https://checkout.paymongo.com/monthly-2',
      },
      providerRef: 'cs-monthly-2',
      checkoutUrl: 'https://checkout.paymongo.com/monthly-2',
    });
    payment.update.mockResolvedValue({
      ...createdHold.payment,
      gateway_metadata: {
        checkout_url: 'https://checkout.paymongo.com/monthly-2',
      },
    });

    const result = await service.createMonthlyCheckout({
      amount: new Prisma.Decimal('12000'),
      coachId: 'coach-1',
      durationMinutes: 60,
      endDate: new Date('2099-05-01T00:00:00.000Z'),
      idempotencyKey,
      sessionCount: 4,
      startDate: new Date('2099-04-01T00:00:00.000Z'),
      userId: 'member-1',
    });

    expect(result).toMatchObject({
      checkout_url: 'https://checkout.paymongo.com/monthly-2',
      hold_id: 'hold-monthly-2',
      kind: CommerceCheckoutHoldKind.monthly,
      payment_id: 'payment-monthly-2',
      status: CommerceCheckoutHoldStatus.held,
    });
    expect(paymongoCheckoutService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelQuery: {
          client: 'web',
          flow: 'coach-monthly',
          hold_id: 'hold-monthly-2',
        },
        idempotencyKey,
        metadata: expect.objectContaining({
          hold_id: 'hold-monthly-2',
          payment_id: 'payment-monthly-2',
        }),
        successQuery: {
          client: 'web',
          flow: 'coach-monthly',
          hold_id: 'hold-monthly-2',
        },
      }),
    );
    expect(tx.commerceCheckoutHold.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        idempotency_key: idempotencyKey,
        kind: CommerceCheckoutHoldKind.monthly,
        session_count: 4,
      }),
    });
  });

  it('blocks a monthly checkout when the member already has an active plan', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      commerceCheckoutHold: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      recurringCoachingPlan: {
        findFirst: jest.fn().mockResolvedValue({ id: 'active-plan-1' }),
      },
    };
    commerceCheckoutHold.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );

    await expect(
      service.createMonthlyCheckout({
        amount: new Prisma.Decimal('12000'),
        coachId: 'coach-2',
        durationMinutes: 60,
        endDate: new Date('2099-05-01T00:00:00.000Z'),
        idempotencyKey: 'attempt-monthly-member-conflict',
        sessionCount: 4,
        startDate: new Date('2099-04-01T00:00:00.000Z'),
        userId: 'member-1',
      }),
    ).rejects.toMatchObject({
      response: {
        conflict_kind: 'active_entitlement',
        status: 409,
        type: 'RECURRING_COACHING_ACTIVE_ENTITLEMENT',
      },
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.recurringCoachingPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ member_id: 'member-1' }),
      }),
    );
  });

  it('marks membership-card PayMongo returns as mobile when requested', async () => {
    const idempotencyKey = 'attempt-card-mobile-1';
    const createdHold = makeHold({
      id: 'hold-card-mobile-1',
      idempotency_key: idempotencyKey,
      kind: CommerceCheckoutHoldKind.membership_card,
      payment: {
        ...makeHold().payment,
        gateway_metadata: null,
        id: 'payment-card-mobile-1',
        idempotency_key: idempotencyKey,
        payable_id: 'hold-card-mobile-1',
      },
      payment_id: 'payment-card-mobile-1',
    });
    const tx = {
      $executeRaw: jest.fn(),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          deletedAt: null,
          email_verified_at: new Date(),
          phone_verified_at: null,
          role: 'member',
          status: 'active',
        }),
      },
      accountDeletionRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      membershipCard: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      commerceCheckoutHold: {
        create: jest.fn().mockResolvedValue(createdHold),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdHold),
        update: jest.fn().mockResolvedValue(createdHold),
      },
      payment: {
        create: jest.fn().mockResolvedValue(createdHold.payment),
      },
    };
    commerceCheckoutHold.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      checkoutUrl: 'https://checkout.paymongo.com/card-mobile-1',
      gatewayMetadata: {
        checkout_url: 'https://checkout.paymongo.com/card-mobile-1',
      },
      providerRef: 'cs-card-mobile-1',
    });
    payment.update.mockResolvedValue({
      ...createdHold.payment,
      gateway_metadata: {
        checkout_url: 'https://checkout.paymongo.com/card-mobile-1',
      },
    });

    await service.createMembershipCardCheckout({
      amount: new Prisma.Decimal('400'),
      idempotencyKey,
      returnTarget: 'mobile',
      userId: 'member-1',
    });

    expect(paymongoCheckoutService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelQuery: {
          client: 'mobile',
          flow: 'membership-card',
          hold_id: 'hold-card-mobile-1',
        },
        successQuery: {
          client: 'mobile',
          flow: 'membership-card',
          hold_id: 'hold-card-mobile-1',
        },
      }),
    );
  });

  it('uses membership subscription return context and persists hold_id/client/flow', async () => {
    const idempotencyKey = 'attempt-subscription-1';
    const createdHold = makeHold({
      id: 'hold-subscription-1',
      idempotency_key: idempotencyKey,
      kind: CommerceCheckoutHoldKind.subscription,
      payment: {
        ...makeHold().payment,
        amount: new Prisma.Decimal('12000'),
        gateway_metadata: null,
        id: 'payment-subscription-1',
        idempotency_key: idempotencyKey,
        payable_id: 'hold-subscription-1',
      },
      payment_id: 'payment-subscription-1',
    });
    const tx = {
      $executeRaw: jest.fn(),
      user: {
        findUnique: jest.fn().mockResolvedValue({
          deletedAt: null,
          email_verified_at: new Date(),
          phone_verified_at: null,
          role: 'member',
          status: 'active',
        }),
      },
      accountDeletionRequest: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      commerceCheckoutHold: {
        create: jest.fn().mockResolvedValue(createdHold),
        findFirst: jest.fn().mockResolvedValue(null),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdHold),
        update: jest.fn().mockResolvedValue(createdHold),
      },
      subscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      payment: {
        create: jest.fn().mockResolvedValue(createdHold.payment),
      },
    };
    commerceCheckoutHold.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      checkoutUrl: 'https://checkout.paymongo.com/subscription-1',
      gatewayMetadata: {
        checkout_url: 'https://checkout.paymongo.com/subscription-1',
      },
      providerRef: 'cs-subscription-1',
    });
    payment.update.mockResolvedValue({
      ...createdHold.payment,
      gateway_metadata: {
        checkout_url: 'https://checkout.paymongo.com/subscription-1',
      },
    });

    await service.createSubscriptionCheckout({
      amount: new Prisma.Decimal('12000'),
      idempotencyKey,
      planId: 'plan-1',
      userId: 'member-1',
    });

    expect(paymongoCheckoutService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelQuery: {
          client: 'web',
          flow: 'membership-subscription',
          hold_id: 'hold-subscription-1',
        },
        successQuery: {
          client: 'web',
          flow: 'membership-subscription',
          hold_id: 'hold-subscription-1',
        },
      }),
    );
  });

  it('expires an old hold before creating a new one-time attempt', async () => {
    const expired = makeHold({
      expires_at: new Date('2020-01-01T00:00:00.000Z'),
    });
    const createdHold = makeHold({
      id: 'hold-2',
      payment_id: 'payment-2',
      idempotency_key: 'attempt-2',
      payment: {
        ...makeHold().payment,
        id: 'payment-2',
        idempotency_key: 'attempt-2',
        gateway_metadata: null,
        payable_id: 'hold-2',
      },
    });
    const tx = {
      $executeRaw: jest.fn(),
      coachProfile: {
        findUnique: jest.fn().mockResolvedValue({
          is_available_for_booking: true,
          availability_slots: Array.from({ length: 7 }, (_, day_of_week) => ({
            day_of_week,
            start_time: new Date('1970-01-01T00:00:00.000Z'),
            end_time: new Date('1970-01-01T23:59:00.000Z'),
          })),
        }),
      },
      coachAppointment: { findMany: jest.fn().mockResolvedValue([]) },
      amenityBooking: { findMany: jest.fn().mockResolvedValue([]) },
      commerceCheckoutHold: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue(createdHold),
        update: jest.fn().mockResolvedValue(createdHold),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdHold),
      },
      payment: {
        create: jest.fn().mockResolvedValue(createdHold.payment),
      },
    };
    commerceCheckoutHold.findUnique
      .mockResolvedValueOnce(expired)
      .mockResolvedValueOnce(null);
    commerceCheckoutHold.findMany.mockResolvedValue([{ id: 'hold-1' }]);
    commerceCheckoutHold.updateMany.mockResolvedValue({ count: 1 });
    payment.updateMany.mockResolvedValue({ count: 1 });
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      providerRef: 'cs-new',
      checkoutUrl: 'https://checkout.paymongo.com/new',
      gatewayMetadata: { checkout_url: 'https://checkout.paymongo.com/new' },
    });
    payment.update.mockResolvedValue({
      ...createdHold.payment,
      gateway_metadata: { checkout_url: 'https://checkout.paymongo.com/new' },
    });

    const result = await service.createOneTimeCheckout({
      amount: new Prisma.Decimal('1200'),
      coachId: 'coach-1',
      durationMinutes: 60,
      idempotencyKey: 'attempt-2',
      scheduledAt: new Date('2099-04-01T08:00:00.000Z'),
      userId: 'member-1',
    });

    expect(result.hold_id).toBe('hold-2');
    expect(commerceCheckoutHold.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CommerceCheckoutHoldStatus.expired }),
      }),
    );
    expect(payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PaymentStatus.failed }),
      }),
    );
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotency_key: 'attempt-2',
          payment_stage: PaymentStage.full,
          payable_type: 'commerce_checkout_hold',
          provider: PaymentProvider.paymongo,
        }),
      }),
    );
  });

  it('persists an optional venue coach on the checkout hold', async () => {
    const idempotencyKey = 'attempt-venue-coach-1';
    const createdHold = makeHold({
      amenity_id: 'amenity-1',
      amount: new Prisma.Decimal('800'),
      coach_id: 'coach-venue-1',
      duration_minutes: null,
      ends_at: new Date('2099-04-01T09:00:00.000Z'),
      id: 'hold-venue-coach-1',
      idempotency_key: idempotencyKey,
      kind: CommerceCheckoutHoldKind.venue,
      payment: {
        ...makeHold().payment,
        amount: new Prisma.Decimal('800'),
        gateway_metadata: null,
        id: 'payment-venue-coach-1',
        idempotency_key: idempotencyKey,
        payable_id: 'hold-venue-coach-1',
      },
      payment_id: 'payment-venue-coach-1',
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
    });
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
        findMany: jest.fn().mockResolvedValue([]),
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
        create: jest.fn().mockResolvedValue(createdHold),
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn().mockResolvedValue(createdHold),
        update: jest.fn().mockResolvedValue(createdHold),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      payment: {
        create: jest.fn().mockResolvedValue(createdHold.payment),
      },
    };
    commerceCheckoutHold.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      checkoutUrl: 'https://checkout.paymongo.com/venue-coach-1',
      gatewayMetadata: {
        checkout_url: 'https://checkout.paymongo.com/venue-coach-1',
      },
      providerRef: 'cs-venue-coach-1',
    });
    payment.update.mockResolvedValue({
      ...createdHold.payment,
      gateway_metadata: {
        checkout_url: 'https://checkout.paymongo.com/venue-coach-1',
      },
    });

    await service.createVenueCheckout({
      amenityId: 'amenity-1',
      amount: new Prisma.Decimal('800'),
      coachId: 'coach-venue-1',
      endsAt: new Date('2099-04-01T09:00:00.000Z'),
      idempotencyKey,
      startsAt: new Date('2099-04-01T08:00:00.000Z'),
      userId: 'member-1',
    });

    expect(tx.commerceCheckoutHold.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        coach: { connect: { id: 'coach-venue-1' } },
        duration_minutes: 60,
        kind: CommerceCheckoutHoldKind.venue,
      }),
    });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
    expect(tx.$executeRaw).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      'coach-venue-1:2099-04-01',
    );
    expect(tx.$executeRaw).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      'amenity-1:2099-04-01',
    );
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.commerceCheckoutHold.findMany.mock.invocationCallOrder[0],
    );
    expect(
      tx.commerceCheckoutHold.findMany.mock.invocationCallOrder[0],
    ).toBeLessThan(tx.commerceCheckoutHold.create.mock.invocationCallOrder[0]);
    expect(paymongoCheckoutService.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        cancelQuery: {
          client: 'web',
          flow: 'venue-booking',
          hold_id: 'hold-venue-coach-1',
        },
        successQuery: {
          client: 'web',
          flow: 'venue-booking',
          hold_id: 'hold-venue-coach-1',
        },
      }),
    );
  });

  it('serializes venue coach holds and rejects an exact live-hold overlap', async () => {
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
        findMany: jest.fn().mockResolvedValue([]),
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
        create: jest.fn(),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              ends_at: new Date('2099-04-01T11:00:00.000Z'),
              id: 'hold-venue-existing',
              scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
            },
          ])
          .mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      payment: { updateMany: jest.fn() },
    };
    commerceCheckoutHold.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );

    await expect(
      service.createVenueCheckout({
        amenityId: 'amenity-2',
        amount: new Prisma.Decimal('800'),
        coachId: 'coach-venue-1',
        endsAt: new Date('2099-04-01T11:30:00.000Z'),
        idempotencyKey: 'attempt-venue-overlap-1',
        startsAt: new Date('2099-04-01T10:30:00.000Z'),
        userId: 'member-2',
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
      'coach-venue-1:2099-04-01',
    );
    expect(tx.commerceCheckoutHold.create).not.toHaveBeenCalled();
    expect(paymongoCheckoutService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('rejects a maintenance venue while creating the checkout hold transaction', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      amenity: {
        findUnique: jest.fn().mockResolvedValue({
          capacity: 1,
          is_active: true,
          is_mapped: true,
          is_reservable: true,
          status: 'maintenance',
        }),
      },
      amenityBooking: { count: jest.fn() },
      commerceCheckoutHold: {
        count: jest.fn(),
        create: jest.fn(),
      },
    };
    commerceCheckoutHold.findUnique.mockResolvedValue(null);
    prisma.$transaction.mockImplementation(
      (callback: (value: unknown) => unknown) => callback(tx),
    );

    await expect(
      service.createVenueCheckout({
        amenityId: 'maintenance-venue',
        amount: new Prisma.Decimal('800'),
        endsAt: new Date('2099-04-01T09:00:00.000Z'),
        idempotencyKey: 'maintenance-venue-attempt',
        startsAt: new Date('2099-04-01T08:00:00.000Z'),
        userId: 'member-1',
      }),
    ).rejects.toMatchObject({
      response: { detail: expect.stringContaining('under maintenance') },
    });
    expect(tx.commerceCheckoutHold.create).not.toHaveBeenCalled();
    expect(paymongoCheckoutService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('requires a stable idempotency key for every online checkout kind', async () => {
    await expect(
      service.createOneTimeCheckout({
        amount: new Prisma.Decimal('1200'),
        coachId: 'coach-1',
        durationMinutes: 60,
        idempotencyKey: ' ',
        scheduledAt: new Date('2099-04-01T08:00:00.000Z'),
        userId: 'member-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      service.createMonthlyCheckout({
        amount: new Prisma.Decimal('12000'),
        coachId: 'coach-1',
        durationMinutes: 60,
        endDate: new Date('2099-05-01T00:00:00.000Z'),
        idempotencyKey: '',
        sessionCount: 4,
        startDate: new Date('2099-04-01T00:00:00.000Z'),
        userId: 'member-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    await expect(
      service.createVenueCheckout({
        amenityId: 'amenity-1',
        amount: new Prisma.Decimal('800'),
        endsAt: new Date('2099-04-01T09:00:00.000Z'),
        idempotencyKey: ' ',
        startsAt: new Date('2099-04-01T08:00:00.000Z'),
        userId: 'member-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
