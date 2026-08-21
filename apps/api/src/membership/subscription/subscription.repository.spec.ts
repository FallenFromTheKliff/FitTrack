import { NotFoundException } from '@nestjs/common';

import { SubscriptionRepository } from './subscription.repository';

interface SubscriptionFindFirstArgs {
  where: {
    user_id: string;
    OR: [
      { status: { in: string[] } },
      { status: string; expires_at: { gt: Date } },
    ];
  };
  include: { plan: true };
  orderBy: Array<{ created_at: 'desc' }>;
}

interface SubscriptionCountArgs {
  where: {
    user_id: string;
    OR: [
      { status: { in: string[] } },
      { status: string; expires_at: { gt: Date } },
    ];
  };
}

interface DuplicateSubscriptionFindFirstArgs {
  where: {
    user_id: string;
    status: { in: string[] };
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
  };

  const payment = {
    create: jest.fn(),
  };

  const prisma = {
    membershipPlan,
    subscription,
    payment,
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

  it('loads the current subscription from active-like statuses or cancelled access', async () => {
    subscription.findFirst.mockResolvedValue({ id: 'sub-1' });

    await repo.findCurrentSubscriptionByUserIdOrThrow('member-1');

    const calls = subscription.findFirst.mock.calls as Array<
      [SubscriptionFindFirstArgs]
    >;
    const args = calls[0]?.[0];

    expect(args).toBeDefined();
    expect(args?.where.user_id).toBe('member-1');
    expect(args?.where.OR[0]).toEqual({
      status: { in: ['active', 'past_due', 'pending_payment'] },
    });
    expect(args?.where.OR[1].status).toBe('cancelled');
    expect(args?.where.OR[1].expires_at.gt).toBeInstanceOf(Date);
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
    expect(args?.where.OR[0]).toEqual({
      status: { in: ['active', 'past_due'] },
    });
    expect(args?.where.OR[1].status).toBe('cancelled');
    expect(args?.where.OR[1].expires_at.gt).toBeInstanceOf(Date);
    expect(hasAccess).toBe(true);
  });

  it('filters coaching access checks to plans that include coaching', async () => {
    subscription.count.mockResolvedValue(1);

    const hasAccess = await repo.hasCoachingAccess('member-1');

    const calls = subscription.count.mock.calls as Array<
      [
        SubscriptionCountArgs & {
          where: SubscriptionCountArgs['where'] & {
            plan: { includes_coaching: boolean };
          };
        },
      ]
    >;
    const args = calls[0]?.[0];

    expect(args?.where.plan).toEqual({ includes_coaching: true });
    expect(hasAccess).toBe(true);
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
      subscription: {
        findFirst: findFirstMock,
        create: createSubscriptionMock,
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

    expect(args?.where).toEqual({
      user_id: 'member-1',
      status: { in: ['active', 'past_due', 'pending_payment'] },
    });
    expect(paymentArgs?.data.payable_type).toBe('subscription');
    expect(paymentArgs?.data.payable_id).toBe('sub-1');
    expect(paymentArgs?.data.status).toBe('pending');
    expect(result.payment.id).toBe('payment-1');
  });
});
