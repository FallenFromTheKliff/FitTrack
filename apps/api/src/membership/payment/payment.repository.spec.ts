import { PaymentRepository } from './payment.repository';

describe('PaymentRepository', () => {
  const payment = {
    findMany: jest.fn(),
    count: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const subscription = {
    findUnique: jest.fn(),
  };

  const prisma = {
    payment,
    subscription,
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
});
