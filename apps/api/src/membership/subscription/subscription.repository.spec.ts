import { ConflictException, NotFoundException } from '@nestjs/common';

import { SubscriptionRepository } from './subscription.repository';

interface SubscriptionFindFirstArgs {
  where: {
    user_id: string;
    status: { in: string[] };
    starts_at: { lte: Date };
    expires_at: { gt: Date };
  };
  include: { plan: true };
  orderBy: Array<{ created_at: 'desc' }>;
}

interface SubscriptionCountArgs {
  where: {
    user_id: string;
    status: { in: string[] };
    starts_at: { lte: Date };
    expires_at: { gt: Date };
    user: {
      is: {
        role: string;
        status: string;
        deletedAt: null;
        OR: Array<Record<string, unknown>>;
        deletion_requests: { none: { status: string } };
      };
    };
  };
}

interface DuplicateSubscriptionFindFirstArgs {
  where: {
    user_id: string;
    OR: Array<Record<string, unknown>>;
  };
  select: { id: true };
}

interface SubscriptionCreateArgs {
  data: {
    user: { connect: { id: string } };
    plan: { connect: { id: string } };
    status: string;
  };
  include: { plan: true };
}

interface PaymentCreateArgs {
  data: {
    user: { connect: { id: string } };
    payable_type: string;
    payable_id: string;
    payment_stage: string;
    amount: number;
    provider: string;
    idempotency_key: string;
    status: string;
  };
}

interface TransactionClientMock {
  subscription: {
    findFirst: jest.Mock<
      Promise<{ id: string } | null>,
      [DuplicateSubscriptionFindFirstArgs]
    >;
    updateMany: jest.Mock;
    create: jest.Mock<
      Promise<{
        id: string;
        user_id: string;
        status: string;
        plan: { id: string; name: string };
      }>,
      [SubscriptionCreateArgs]
    >;
  };
  membershipPlan: {
    findUniqueOrThrow: jest.Mock;
  };
  $executeRaw: jest.Mock;
  payment: {
    create: jest.Mock<
      Promise<{
        id: string;
        payable_id: string;
        idempotency_key: string;
      }>,
      [PaymentCreateArgs]
    >;
  };
}

describe('SubscriptionRepository', () => {
  const membershipPlan = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const subscription = {
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };

  const payment = {
    create: jest.fn(),
  };

  const user = {
    findMany: jest.fn(),
  };

  const prisma = {
    membershipPlan,
    subscription,
    payment,
    user,
    $transaction: jest.fn(),
  };

  let repo: SubscriptionRepository;

  beforeEach(() => {
    repo = new SubscriptionRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('paginates active plans ordered by sort order then creation date', async () => {
    membershipPlan.findMany.mockResolvedValue([{ id: 'plan-1' }]);
    membershipPlan.count.mockResolvedValue(1);

    const result = await repo.listActivePlans({ page: 2, limit: 5 });

    expect(membershipPlan.findMany).toHaveBeenCalledWith({
      where: { is_active: true },
      orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
      skip: 5,
      take: 5,
    });
    expect(membershipPlan.count).toHaveBeenCalledWith({
      where: { is_active: true },
    });
    expect(result.meta.page).toBe(2);
  });

  it('filters public plan reads to active plans only', async () => {
    membershipPlan.findFirst.mockResolvedValue(null);

    await expect(repo.findActivePlanByIdOrThrow('plan-1')).rejects.toThrow(
      NotFoundException,
    );

    expect(membershipPlan.findFirst).toHaveBeenCalledWith({
      where: { id: 'plan-1', is_active: true },
      include: undefined,
      orderBy: undefined,
    });
  });

  it('loads only a timestamp-valid active subscription', async () => {
    subscription.findFirst.mockResolvedValue({ id: 'sub-1' });

    await repo.findCurrentSubscriptionByUserIdOrThrow('member-1');

    const calls = subscription.findFirst.mock.calls as Array<
      [SubscriptionFindFirstArgs]
    >;
    const args = calls[0]?.[0];

    expect(args).toBeDefined();
    expect(args?.where.user_id).toBe('member-1');
    expect(args?.where.status).toEqual({
      in: ['active', 'past_due', 'cancelled'],
    });
    expect(args?.where.starts_at.lte).toBeInstanceOf(Date);
    expect(args?.where.expires_at.gt).toBeInstanceOf(Date);
    expect(args?.include).toEqual({ plan: true });
    expect(args?.orderBy).toEqual([{ created_at: 'desc' }]);
  });

  it('uses the shared access rule for attendance-style subscription checks', async () => {
    subscription.count.mockResolvedValue(1);

    const hasAccess = await repo.hasSubscriptionAccess('member-1');

    const calls = subscription.count.mock.calls as Array<
      [SubscriptionCountArgs]
    >;
    const args = calls[0]?.[0];

    expect(args).toBeDefined();
    expect(args?.where.user_id).toBe('member-1');
    expect(args?.where.status).toEqual({
      in: ['active', 'past_due', 'cancelled'],
    });
    expect(args?.where.starts_at.lte).toBeInstanceOf(Date);
    expect(args?.where.expires_at.gt).toBeInstanceOf(Date);
    expect(args?.where.user).toEqual({
      is: {
        role: 'member',
        status: 'active',
        deletedAt: null,
        OR: [
          { email_verified_at: { not: null } },
          { phone_verified_at: { not: null } },
        ],
        deletion_requests: { none: { status: 'pending' } },
      },
    });
    expect(hasAccess).toBe(true);
  });

  it('uses the same timestamp-valid gym membership rule for coaching access', async () => {
    subscription.count.mockResolvedValue(1);

    const hasAccess = await repo.hasCoachingAccess('member-1');

    const calls = subscription.count.mock.calls as Array<[SubscriptionCountArgs]>;
    const args = calls[0]?.[0];

    expect(args?.where.status).toEqual({
      in: ['active', 'past_due', 'cancelled'],
    });
    expect(args?.where.starts_at.lte).toBeInstanceOf(Date);
    expect(args?.where.expires_at.gt).toBeInstanceOf(Date);
    expect(hasAccess).toBe(true);
  });

  it('builds server-side membership-card grant candidates with search and eligibility guards', async () => {
    user.findMany.mockResolvedValue([
      {
        id: 'member-1',
        auth_identities: [{ identifier: 'maria.santos@fittrack.com' }],
        membership_card: null,
        profile: { first_name: 'Maria', last_name: 'Santos' },
        subscriptions: [],
      },
    ]);

    await expect(
      repo.listOnsiteSaleCandidates({
        action: 'grant',
        purchaseType: 'membership_card',
        search: 'Maria Santos',
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: 'member-1',
        displayName: 'Maria Santos',
        email: 'maria.santos@fittrack.com',
        membershipCardStatus: null,
        subscription: null,
      }),
    ]);

    const args = user.findMany.mock.calls[0]?.[0];
    expect(args.take).toBe(50);
    expect(args.where.NOT).toEqual({
      membership_card: { is: { status: 'active' } },
    });
    expect(args.where.AND).toHaveLength(2);
  });

  it('excludes active, pending, and held Gym Membership grants in the candidate query', async () => {
    user.findMany.mockResolvedValue([]);

    await repo.listOnsiteSaleCandidates({
      action: 'grant',
      purchaseType: 'gym_membership',
    });

    const args = user.findMany.mock.calls[0]?.[0];
    expect(args.where.subscriptions.none.OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: { in: ['active', 'past_due', 'cancelled'] } }),
        { status: 'pending_payment' },
      ]),
    );
    expect(args.where.commerce_checkout_holds.none).toEqual(
      expect.objectContaining({
        kind: 'subscription',
        status: 'held',
        expires_at: { gt: expect.any(Date) },
      }),
    );
  });

  it('lists only current free-pass revoke candidates and exposes expiry', async () => {
    const expiresAt = new Date('2026-08-29T10:00:00.000Z');
    user.findMany.mockResolvedValue([
      {
        id: 'member-1',
        auth_identities: [{ identifier: 'maria.santos@fittrack.com' }],
        membership_card: null,
        free_day_pass_expires_at: expiresAt,
        profile: { first_name: 'Maria', last_name: 'Santos' },
        subscriptions: [],
      },
    ]);

    const result = await repo.listMembershipAccessCandidates({
      action: 'revoke',
      product: 'free_day_pass',
    });

    expect(result).toEqual([
      expect.objectContaining({
        memberId: 'member-1',
        freePassExpiresAt: expiresAt,
      }),
    ]);
    const args = user.findMany.mock.calls[0]?.[0];
    expect(args.where.free_day_pass_granted_at).toEqual({ not: null });
    expect(args.where.free_day_pass_expires_at.gt).toBeInstanceOf(Date);
    expect(args.where.free_day_pass_redeemed_at).toBeNull();
    expect(args.where.free_day_pass_revoked_at).toBeNull();
  });

  it('grants a fresh 24-hour free pass and resets a prior lifecycle', async () => {
    const grantedAt = new Date('2026-08-28T10:00:00.000Z');
    const before = {
      id: 'member-1',
      role: 'member',
      status: 'active',
      deletedAt: null,
      email_verified_at: new Date('2026-08-01T00:00:00.000Z'),
      phone_verified_at: null,
      free_day_pass_granted_at: new Date('2026-08-26T10:00:00.000Z'),
      free_day_pass_expires_at: new Date('2026-08-27T10:00:00.000Z'),
      free_day_pass_granted_by: 'staff-old',
      free_day_pass_redeemed_at: new Date('2026-08-26T11:00:00.000Z'),
      free_day_pass_revoked_at: null,
      free_day_pass_revoke_reason: null,
    };
    const after = {
      ...before,
      free_day_pass_granted_at: grantedAt,
      free_day_pass_expires_at: new Date('2026-08-29T10:00:00.000Z'),
      free_day_pass_granted_by: 'staff-1',
      free_day_pass_redeemed_at: null,
    };
    const tx = {
      $executeRaw: jest.fn(),
      accountDeletionRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      commerceCheckoutHold: { findFirst: jest.fn().mockResolvedValue(null) },
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
      user: {
        findUnique: jest.fn().mockResolvedValue(before),
        update: jest.fn().mockResolvedValue(after),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await repo.grantFreeDayPass('member-1', 'staff-1', grantedAt);

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: {
        free_day_pass_granted_at: grantedAt,
        free_day_pass_expires_at: new Date('2026-08-29T10:00:00.000Z'),
        free_day_pass_granted_by: 'staff-1',
        free_day_pass_redeemed_at: null,
        free_day_pass_revoked_at: null,
        free_day_pass_revoke_reason: null,
      },
      select: expect.any(Object),
    });
    expect(result.user.free_day_pass_expires_at).toEqual(
      new Date('2026-08-29T10:00:00.000Z'),
    );
    expect(result.user.free_day_pass_redeemed_at).toBeNull();
  });

  it('rejects a free-pass grant when Gym Membership access is current or pending', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      accountDeletionRequest: { findFirst: jest.fn().mockResolvedValue(null) },
      commerceCheckoutHold: { findFirst: jest.fn().mockResolvedValue(null) },
      subscription: { findFirst: jest.fn().mockResolvedValue({ id: 'sub-1' }) },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'member-1',
          role: 'member',
          status: 'active',
          deletedAt: null,
          email_verified_at: new Date(),
          phone_verified_at: null,
          free_day_pass_granted_at: null,
          free_day_pass_expires_at: null,
          free_day_pass_granted_by: null,
          free_day_pass_redeemed_at: null,
          free_day_pass_revoked_at: null,
          free_day_pass_revoke_reason: null,
        }),
        update: jest.fn(),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await expect(
      repo.grantFreeDayPass('member-1', 'staff-1'),
    ).rejects.toThrow(ConflictException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('revokes an unused free pass while preserving its grant fields', async () => {
    const revokedAt = new Date('2026-08-28T12:00:00.000Z');
    const before = {
      id: 'member-1',
      role: 'member',
      status: 'active',
      deletedAt: null,
      email_verified_at: new Date('2026-08-01T00:00:00.000Z'),
      phone_verified_at: null,
      free_day_pass_granted_at: new Date('2026-08-28T10:00:00.000Z'),
      free_day_pass_expires_at: new Date('2026-08-29T10:00:00.000Z'),
      free_day_pass_granted_by: 'staff-1',
      free_day_pass_redeemed_at: null,
      free_day_pass_revoked_at: null,
      free_day_pass_revoke_reason: null,
    };
    const after = {
      ...before,
      free_day_pass_revoked_at: revokedAt,
      free_day_pass_revoke_reason: 'Undo test grant',
    };
    const tx = {
      $executeRaw: jest.fn(),
      user: {
        findUnique: jest.fn().mockResolvedValue(before),
        update: jest.fn().mockResolvedValue(after),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await repo.revokeFreeDayPass(
      'member-1',
      'Undo test grant',
      revokedAt,
    );

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'member-1' },
      data: {
        free_day_pass_revoked_at: revokedAt,
        free_day_pass_revoke_reason: 'Undo test grant',
      },
      select: expect.any(Object),
    });
    expect(result.user.free_day_pass_granted_by).toBe('staff-1');
    expect(result.user.free_day_pass_revoke_reason).toBe('Undo test grant');
  });

  it('revokes a current Gym Membership atomically and preserves history fields', async () => {
    const now = new Date();
    const before = {
      id: 'subscription-1',
      user_id: 'member-1',
      plan_id: 'plan-1',
      status: 'active',
      starts_at: new Date(now.getTime() - 60_000),
      expires_at: new Date(now.getTime() + 86_400_000),
      cancelled_at: null,
      cancellation_reason: null,
      plan: { id: 'plan-1', name: 'Monthly Membership' },
    };
    const after = {
      ...before,
      status: 'suspended',
      cancelled_at: now,
      cancellation_reason: 'Undo test sale',
    };
    const tx = {
      $executeRaw: jest.fn(),
      subscription: {
        findUnique: jest.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(before),
        update: jest.fn().mockResolvedValue(after),
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    const result = await repo.revokeMembershipSubscription(
      'subscription-1',
      'Undo test sale',
      now,
    );

    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.subscription.update).toHaveBeenCalledWith({
      where: { id: 'subscription-1' },
      data: {
        status: 'suspended',
        cancelled_at: now,
        cancellation_reason: 'Undo test sale',
      },
      include: { plan: true },
    });
    expect(result.before).toMatchObject({ status: 'active', expires_at: before.expires_at });
    expect(result.subscription).toMatchObject({
      status: 'suspended',
      expires_at: before.expires_at,
      plan_id: 'plan-1',
    });
  });

  it('creates a pending subscription and payment inside one transaction', async () => {
    const findFirstMock = jest
      .fn<
        Promise<{ id: string } | null>,
        [DuplicateSubscriptionFindFirstArgs]
      >()
      .mockResolvedValue(null);
    const createSubscriptionMock = jest
      .fn<
        Promise<{
          id: string;
          user_id: string;
          status: string;
          plan: { id: string; name: string };
        }>,
        [SubscriptionCreateArgs]
      >()
      .mockResolvedValue({
        id: 'sub-1',
        user_id: 'member-1',
        status: 'pending_payment',
        plan: { id: 'plan-1', name: 'Monthly Membership' },
      });
    const createPaymentMock = jest
      .fn<
        Promise<{
          id: string;
          payable_id: string;
          idempotency_key: string;
        }>,
        [PaymentCreateArgs]
      >()
      .mockResolvedValue({
        id: 'payment-1',
        payable_id: 'sub-1',
        idempotency_key: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      });
    const tx: TransactionClientMock = {
      $executeRaw: jest.fn(),
      membershipPlan: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          currency: 'PHP',
          description: 'Monthly gym access',
          duration_days: 30,
          id: 'plan-1',
          name: 'Monthly Membership',
          price: 1499,
        }),
      },
      subscription: {
        findFirst: findFirstMock,
        create: createSubscriptionMock,
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      payment: {
        create: createPaymentMock,
      },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: TransactionClientMock) => Promise<unknown>) =>
        callback(tx),
    );

    const result = await repo.createPendingSubscriptionWithPayment({
      userId: 'member-1',
      planId: 'plan-1',
      amount: 1499,
      idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      provider: 'paymongo',
    });

    const calls = tx.subscription.findFirst.mock.calls;
    const args = calls[0]?.[0];
    const paymentCalls = tx.payment.create.mock.calls;
    const paymentArgs = paymentCalls[0]?.[0];

    expect(args?.where.user_id).toBe('member-1');
    expect(args?.where.OR).toEqual([
      { status: 'pending_payment' },
      expect.objectContaining({
        status: { in: ['active', 'past_due', 'cancelled'] },
        starts_at: { lte: expect.any(Date) },
        expires_at: { gt: expect.any(Date) },
      }),
    ]);
    expect(paymentArgs?.data.payable_type).toBe('subscription');
    expect(paymentArgs?.data.payable_id).toBe('sub-1');
    expect(paymentArgs?.data.status).toBe('pending');
    expect(result.payment.id).toBe('payment-1');
  });

  it('replays an existing cash Gym Membership sale without creating another entitlement', async () => {
    const existingPayment = {
      id: 'payment-cash-1',
      payable_id: 'subscription-1',
      payable_type: 'subscription',
      provider: 'cash',
      status: 'completed',
      user_id: 'member-1',
    };
    const existingSubscription = {
      id: 'subscription-1',
      plan_id: 'plan-1',
      plan: { id: 'plan-1', name: 'Monthly Gym Access' },
      status: 'active',
      user_id: 'member-1',
    };
    const tx = {
      $executeRaw: jest.fn(),
      payment: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(existingPayment),
      },
      subscription: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(existingSubscription),
      },
      membershipCard: { create: jest.fn(), update: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await expect(
      repo.recordCashMembership({
        actorId: 'staff-1',
        idempotencyKey: 'cash-replay-1',
        memberId: 'member-1',
        planId: 'plan-1',
        purchaseType: 'gym_membership',
      }),
    ).resolves.toMatchObject({
      payment: existingPayment,
      replayed: true,
      subscription: existingSubscription,
    });

    expect(tx.subscription.create).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.membershipCard.create).not.toHaveBeenCalled();
    expect(tx.membershipCard.update).not.toHaveBeenCalled();
  });

  it('rejects a cash Gym Membership idempotency replay with a different plan', async () => {
    const existingPayment = {
      id: 'payment-cash-2',
      payable_id: 'subscription-2',
      payable_type: 'subscription',
      provider: 'cash',
      status: 'completed',
      user_id: 'member-1',
    };
    const existingSubscription = {
      id: 'subscription-2',
      plan_id: 'plan-1',
      plan: { id: 'plan-1', name: 'Monthly Gym Access' },
      status: 'active',
      user_id: 'member-1',
    };
    const tx = {
      $executeRaw: jest.fn(),
      payment: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(existingPayment),
      },
      subscription: {
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(existingSubscription),
      },
      membershipCard: { create: jest.fn(), update: jest.fn() },
    };
    prisma.$transaction.mockImplementation(
      (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    );

    await expect(
      repo.recordCashMembership({
        actorId: 'staff-1',
        idempotencyKey: 'cash-replay-2',
        memberId: 'member-1',
        planId: 'plan-2',
        purchaseType: 'gym_membership',
      }),
    ).rejects.toMatchObject({
      response: {
        status: 409,
        title: 'Idempotency Payload Mismatch',
      },
    });

    expect(tx.subscription.create).not.toHaveBeenCalled();
    expect(tx.payment.create).not.toHaveBeenCalled();
    expect(tx.membershipCard.create).not.toHaveBeenCalled();
    expect(tx.membershipCard.update).not.toHaveBeenCalled();
  });
});
