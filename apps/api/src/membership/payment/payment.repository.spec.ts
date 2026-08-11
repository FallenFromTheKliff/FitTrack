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

  const prisma = {
    payment,
    subscription,
    membershipCard,
    user,
    $transaction: jest.fn(),
  };

  let repo: PaymentRepository;

  beforeEach(() => {
    repo = new PaymentRepository(prisma as never);
    jest.clearAllMocks();
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
});
