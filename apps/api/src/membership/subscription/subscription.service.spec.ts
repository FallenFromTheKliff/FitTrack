import { ConflictException, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PaymentProvider, Prisma } from '@prisma/client';

import { PaymentRepository } from '../payment/payment.repository';
import { PaymongoCheckoutService } from '../payment/paymongo-checkout.service';
import { CoachingCommerceService } from '../../coaching/commerce/coaching-commerce.service';
import { SubscriptionRepository } from './subscription.repository';
import { SubscriptionService } from './subscription.service';

describe('SubscriptionService', () => {
  let service: SubscriptionService;

  const repo = {
    listActivePlans: jest.fn(),
    listOnsiteSaleCandidates: jest.fn(),
    listMembershipAccessCandidates: jest.fn(),
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
    revokeMembershipSubscription: jest.fn(),
    grantFreeDayPass: jest.fn(),
    revokeFreeDayPass: jest.fn(),
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

  const commerceCheckoutService = {
    createSubscriptionCheckout: jest.fn(),
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
        { provide: CoachingCommerceService, useValue: commerceCheckoutService },
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

  it('maps server-filtered onsite candidates without applying client eligibility guesses', async () => {
    repo.listOnsiteSaleCandidates.mockResolvedValue([
      {
        id: 'member-1',
        displayName: 'Maria Santos',
        email: 'maria.santos@fittrack.com',
        membershipCardStatus: null,
        subscription: null,
      },
    ]);

    const result = await service.listOnsiteSaleCandidates({
      action: 'grant',
      purchase_type: 'membership_card',
    });

    expect(repo.listOnsiteSaleCandidates).toHaveBeenCalledWith({
      action: 'grant',
      purchaseType: 'membership_card',
      search: undefined,
    });
    expect(result).toEqual([
      {
        member_id: 'member-1',
        display_name: 'Maria Santos',
        email: 'maria.santos@fittrack.com',
        membership_card_status: null,
        subscription_id: null,
        subscription_status: null,
        plan_name: null,
        starts_at: null,
        expires_at: null,
      },
    ]);
  });

  it('maps generalized access candidates including free-pass expiry', async () => {
    const expiresAt = new Date('2026-08-29T10:00:00.000Z');
    repo.listMembershipAccessCandidates.mockResolvedValue([
      {
        memberId: 'member-1',
        displayName: 'Maria Santos',
        email: 'maria.santos@fittrack.com',
        membershipCardStatus: null,
        subscription: null,
        freePassExpiresAt: expiresAt,
      },
    ]);

    const result = await service.listMembershipAccessCandidates({
      action: 'revoke',
      product: 'free_day_pass',
    });

    expect(repo.listMembershipAccessCandidates).toHaveBeenCalledWith({
      action: 'revoke',
      product: 'free_day_pass',
      search: undefined,
    });
    expect(result).toEqual([
      expect.objectContaining({
        member_id: 'member-1',
        free_pass_expires_at: expiresAt.toISOString(),
      }),
    ]);
  });

  it('audits free-pass grant and returns its exact 24-hour lifecycle', async () => {
    const grantedAt = new Date('2026-08-28T10:00:00.000Z');
    const user = {
      id: 'member-1',
      free_day_pass_granted_at: grantedAt,
      free_day_pass_expires_at: new Date('2026-08-29T10:00:00.000Z'),
      free_day_pass_granted_by: 'staff-1',
      free_day_pass_redeemed_at: null,
      free_day_pass_revoked_at: null,
      free_day_pass_revoke_reason: null,
    };
    repo.grantFreeDayPass.mockResolvedValue({ before: { ...user, free_day_pass_granted_at: null, free_day_pass_expires_at: null, free_day_pass_granted_by: null }, user });

    const result = await service.grantFreeDayPass('staff-1', {
      member_id: 'member-1',
    });

    expect(result).toMatchObject({
      message: 'Free one-day pass granted.',
      member_id: 'member-1',
      expires_at: '2026-08-29T10:00:00.000Z',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'staff-1',
        action: 'FREE_DAY_PASS_GRANTED',
        entity: 'User',
        entityId: 'member-1',
      }),
    );
  });

  it('audits free-pass revocation with a required reason', async () => {
    const revokedAt = new Date('2026-08-28T12:00:00.000Z');
    const user = {
      id: 'member-1',
      free_day_pass_granted_at: new Date('2026-08-28T10:00:00.000Z'),
      free_day_pass_expires_at: new Date('2026-08-29T10:00:00.000Z'),
      free_day_pass_granted_by: 'staff-1',
      free_day_pass_redeemed_at: null,
      free_day_pass_revoked_at: revokedAt,
      free_day_pass_revoke_reason: 'Undo test grant',
    };
    repo.revokeFreeDayPass.mockResolvedValue({
      before: { ...user, free_day_pass_revoked_at: null, free_day_pass_revoke_reason: null },
      user,
    });

    const result = await service.revokeFreeDayPass(
      'staff-1',
      'member-1',
      { reason: '  Undo test grant  ' },
    );

    expect(repo.revokeFreeDayPass).toHaveBeenCalledWith(
      'member-1',
      'Undo test grant',
    );
    expect(result.revoke_reason).toBe('Undo test grant');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'staff-1',
        action: 'FREE_DAY_PASS_REVOKED',
        entityId: 'member-1',
      }),
    );
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
    repo.findActivePlanByIdOrThrow.mockResolvedValue({
      id: 'plan-1',
      name: 'Monthly Membership',
      description: 'Gym access',
      price: 1499,
      currency: 'PHP',
      duration_days: 30,
    });
    commerceCheckoutService.createSubscriptionCheckout.mockResolvedValue({
      checkout_url: 'https://checkout.paymongo.com/cs_test_123',
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
    expect(
      commerceCheckoutService.createSubscriptionCheckout,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'plan-1',
        planName: 'Monthly Membership',
        planDurationDays: 30,
      }),
    );
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
    commerceCheckoutService.createSubscriptionCheckout.mockRejectedValue(
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

  it('suspends a granted subscription and audits the staff actor separately', async () => {
    const createdAt = new Date('2026-08-01T00:00:00.000Z');
    const startsAt = new Date('2026-08-10T00:00:00.000Z');
    const expiresAt = new Date('2026-09-08T00:00:00.000Z');
    const before = {
      id: 'sub-1',
      user_id: 'member-1',
      plan_id: 'plan-1',
      payment_id: 'payment-1',
      status: 'active',
      starts_at: startsAt,
      expires_at: expiresAt,
      warned_7d_at: null,
      warned_3d_at: null,
      warned_1d_at: null,
      cancelled_at: null,
      cancellation_reason: null,
      created_at: createdAt,
      updated_at: createdAt,
      plan_name_snapshot: 'Monthly Membership',
      plan_description_snapshot: 'Gym access',
      plan_price_snapshot: new Prisma.Decimal(1499),
      plan_currency_snapshot: 'PHP',
      duration_days_snapshot: 30,
      access_consumed_at: null,
      plan: {
        id: 'plan-1',
        name: 'Monthly Membership',
        description: 'Gym access',
        price: new Prisma.Decimal(1499),
        currency: 'PHP',
        duration_days: 30,
        features: {},
        sort_order: 1,
        is_active: true,
        created_at: createdAt,
        updated_at: createdAt,
      },
    };
    const after = {
      ...before,
      status: 'suspended',
      cancelled_at: new Date('2026-08-28T12:00:00.000Z'),
      cancellation_reason: 'Undo test sale',
    };
    repo.revokeMembershipSubscription.mockResolvedValue({
      before,
      subscription: after,
    });

    const result = await service.revokeMembershipSubscription(
      'staff-1',
      'sub-1',
      { reason: '  Undo test sale  ' },
    );

    expect(repo.revokeMembershipSubscription).toHaveBeenCalledWith(
      'sub-1',
      'Undo test sale',
      expect.any(Date),
    );
    expect(result).toMatchObject({
      message: 'Gym membership access revoked.',
      subscription: {
        id: 'sub-1',
        user_id: 'member-1',
        payment_id: 'payment-1',
        status: 'suspended',
        expires_at: expiresAt.toISOString(),
      },
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'staff-1',
        action: 'SUBSCRIPTION_SUSPENDED',
        entity: 'Subscription',
        entityId: 'sub-1',
        before: expect.objectContaining({ status: 'active', user_id: 'member-1' }),
        after: expect.objectContaining({ status: 'suspended', user_id: 'member-1' }),
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
