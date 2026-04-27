import { ConflictException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentProvider, Prisma } from '@prisma/client';

import { PaymentRepository } from '../payment/payment.repository';
import { PaymongoCheckoutService } from '../payment/paymongo-checkout.service';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  const repo = {
    listActivePlans: jest.fn(),
    findActivePlanByIdOrThrow: jest.fn(),
    createPlan: jest.fn(),
    updatePlan: jest.fn(),
    findCurrentSubscriptionByUserId: jest.fn(),
    findCurrentSubscriptionByUserIdOrThrow: jest.fn(),
    findCancellableSubscriptionByUserIdOrThrow: jest.fn(),
    findSubscriptionByIdOrThrow: jest.fn(),
    createPendingSubscriptionWithPayment: jest.fn(),
    activateSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    hasSubscriptionAccess: jest.fn(),
    hasCoachingAccess: jest.fn(),
  };

  const paymentRepo = {
    findPaymentByIdempotencyKey: jest.fn(),
    updatePayment: jest.fn(),
  };

  const paymongoCheckoutService = {
    createCheckoutSession: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionService,
        { provide: SubscriptionRepository, useValue: repo },
        { provide: PaymentRepository, useValue: paymentRepo },
        {
          provide: PaymongoCheckoutService,
          useValue: paymongoCheckoutService,
        },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<SubscriptionService>(SubscriptionService);
    jest.clearAllMocks();
  });

  it('lists only active plans through the repository', async () => {
    repo.listActivePlans.mockResolvedValue({
      data: [{ id: 'plan-1', name: 'Monthly Membership' }],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    const result = await service.listPlans({ page: 1, limit: 20 });

    expect(repo.listActivePlans).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(result.meta.total).toBe(1);
  });

  it('creates a plan with default optional values', async () => {
    repo.createPlan.mockResolvedValue({ id: 'plan-1' });

    await service.createPlan({
      name: 'Monthly Membership',
      price: 1499,
      duration_days: 30,
    });

    expect(repo.createPlan).toHaveBeenCalledWith({
      name: 'Monthly Membership',
      description: null,
      price: 1499,
      duration_days: 30,
      features: {},
      sort_order: 0,
      includes_coaching: false,
    });
  });

  it('updates only fields provided in the DTO', async () => {
    repo.updatePlan.mockResolvedValue({ id: 'plan-1', is_active: false });

    await service.updatePlan('plan-1', {
      price: 999,
      is_active: false,
    });

    expect(repo.updatePlan).toHaveBeenCalledWith('plan-1', {
      price: 999,
      is_active: false,
    });
  });

  it('returns the current subscription for the authenticated member', async () => {
    repo.findCurrentSubscriptionByUserId.mockResolvedValue({
      id: 'sub-1',
      status: 'active',
      plan: { id: 'plan-1', name: 'Monthly Membership' },
    });

    const result = await service.getMySubscription('member-1');

    expect(repo.findCurrentSubscriptionByUserId).toHaveBeenCalledWith(
      'member-1',
    );
    expect(result.id).toBe('sub-1');
  });

  it('delegates coaching access checks to the repository', async () => {
    repo.hasCoachingAccess.mockResolvedValue(true);

    await expect(service.hasCoachingAccess('member-1')).resolves.toBe(true);
    expect(repo.hasCoachingAccess).toHaveBeenCalledWith('member-1');
  });

  it('requires a valid idempotency key when subscribing', async () => {
    await expect(
      service.subscribe(
        'member-1',
        {
          plan_id: '3f27a1c4-2c31-4e67-9a56-53d9d0c7d4c1',
          provider: PaymentProvider.paymongo,
        },
        'not-a-uuid',
      ),
    ).rejects.toThrow(HttpException);
  });

  it('returns the existing checkout url when the same idempotency key is retried', async () => {
    paymentRepo.findPaymentByIdempotencyKey.mockResolvedValue({
      id: 'payment-1',
      user_id: 'member-1',
      payable_type: 'subscription',
      payable_id: 'sub-1',
      provider: PaymentProvider.paymongo,
      status: 'processing',
      idempotency_key: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      gateway_metadata: {
        checkout_url: 'https://checkout.paymongo.com/cs_test_123',
      } as Prisma.JsonObject,
    });
    repo.findSubscriptionByIdOrThrow.mockResolvedValue({
      id: 'sub-1',
      user_id: 'member-1',
      status: 'pending_payment',
      plan: { id: 'plan-1', name: 'Monthly Membership', duration_days: 30 },
    });

    const result = await service.subscribe(
      'member-1',
      {
        plan_id: '3f27a1c4-2c31-4e67-9a56-53d9d0c7d4c1',
        provider: PaymentProvider.paymongo,
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(result).toEqual({
      checkout_url: 'https://checkout.paymongo.com/cs_test_123',
    });
    expect(repo.createPendingSubscriptionWithPayment).not.toHaveBeenCalled();
    expect(
      paymongoCheckoutService.createCheckoutSession,
    ).not.toHaveBeenCalled();
  });

  it('rejects subscription creation when there is already an active or pending subscription', async () => {
    paymentRepo.findPaymentByIdempotencyKey.mockResolvedValue(null);
    repo.findActivePlanByIdOrThrow.mockResolvedValue({
      id: 'plan-1',
      name: 'Monthly Membership',
      price: 1499,
    });
    repo.createPendingSubscriptionWithPayment.mockRejectedValue(
      new ConflictException('duplicate'),
    );

    await expect(
      service.subscribe(
        'member-1',
        {
          plan_id: '3f27a1c4-2c31-4e67-9a56-53d9d0c7d4c1',
          provider: PaymentProvider.paymongo,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('cancels an active subscription and emits an audit event', async () => {
    repo.findCancellableSubscriptionByUserIdOrThrow.mockResolvedValue({
      id: 'sub-1',
      status: 'active',
      cancelled_at: null,
      cancellation_reason: null,
    });
    repo.updateSubscription.mockResolvedValue({ id: 'sub-1' });

    await service.cancelSubscription('member-1', {
      reason: 'Travelling for work',
    });

    expect(repo.updateSubscription).toHaveBeenCalledWith(
      'sub-1',
      expect.objectContaining({
        status: 'cancelled',
        cancellation_reason: 'Travelling for work',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'member-1',
        action: 'SUBSCRIPTION_CANCELLED',
        entityId: 'sub-1',
      }),
    );
  });

  it('activates a pending subscription when a subscription payment completes', async () => {
    repo.findSubscriptionByIdOrThrow.mockResolvedValue({
      id: 'sub-1',
      status: 'pending_payment',
      payment_id: null,
      plan: { id: 'plan-1', duration_days: 30 },
    });
    repo.activateSubscription.mockResolvedValue({ id: 'sub-1' });

    await service.handlePaymentCompleted({
      paymentId: 'payment-1',
      userId: 'member-1',
      payableType: 'subscription',
      payableId: 'sub-1',
      amount: '1499',
    });

    expect(repo.activateSubscription).toHaveBeenCalledWith(
      'sub-1',
      'payment-1',
      expect.any(Date),
      expect.any(Date),
    );
  });
});
