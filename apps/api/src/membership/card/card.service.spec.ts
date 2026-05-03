import {
  MembershipCardSource,
  MembershipCardStatus,
  NotificationType,
  PaymentProvider,
  PaymentStage,
  PayableType,
  Prisma,
  UserRole,
} from '@prisma/client';

import { MembershipCardService } from './card.service';

describe('MembershipCardService', () => {
  const repo = {
    activateMembershipCard: jest.fn(),
    createOrRefreshPendingPurchase: jest.fn(),
    findMembershipCardByIdOrThrow: jest.fn(),
    findMembershipCardWithUserProfileByIdOrThrow: jest.fn(),
    findMembershipCardByUserId: jest.fn(),
    findMembershipOwnerByIdOrThrow: jest.fn(),
    revokeMembershipCard: jest.fn(),
  };

  const paymentRepo = {
    findLatestPaymentForPayableStage: jest.fn(),
    findPaymentByIdempotencyKey: jest.fn(),
    updatePayment: jest.fn(),
  };

  const paymongoCheckoutService = {
    createCheckoutSession: jest.fn(),
  };

  const notificationsService = {
    dispatch: jest.fn(),
  };

  const eventEmitter = {
    emitAsync: jest.fn(),
  };

  let service: MembershipCardService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MembershipCardService(
      repo as never,
      paymentRepo as never,
      paymongoCheckoutService as never,
      notificationsService as never,
      eventEmitter as never,
    );
  });

  it('starts a PayMongo checkout for a new membership-card purchase', async () => {
    const membershipCard = createPendingMembershipCard();
    const payment = createPendingPayment();

    repo.findMembershipOwnerByIdOrThrow.mockResolvedValue({
      id: 'member-1',
      role: UserRole.member,
      deletedAt: null,
    });
    paymentRepo.findPaymentByIdempotencyKey.mockResolvedValue(null);
    repo.findMembershipCardByUserId.mockResolvedValue(null);
    repo.createOrRefreshPendingPurchase.mockResolvedValue({
      membershipCard,
      payment,
    });
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      providerRef: 'cs_test_card_checkout',
      checkoutUrl: 'https://checkout.paymongo.test/card-1',
      gatewayMetadata: {
        checkout_url: 'https://checkout.paymongo.test/card-1',
      },
    });
    paymentRepo.updatePayment.mockResolvedValue({
      ...payment,
      status: 'processing',
      provider_ref: 'cs_test_card_checkout',
    });

    const result = await service.purchase(
      'member-1',
      { provider: PaymentProvider.paymongo },
      '44444444-4444-4444-8444-444444444444',
    );

    expect(repo.createOrRefreshPendingPurchase).toHaveBeenCalledWith({
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
      provider: PaymentProvider.paymongo,
      source: MembershipCardSource.paymongo,
      userId: 'member-1',
    });
    expect(paymongoCheckoutService.createCheckoutSession).toHaveBeenCalledWith({
      amount: 40000,
      cancelQuery: {
        flow: 'membership-card',
        portal: 'member',
        surface: 'profile',
      },
      description: 'SertFit membership card',
      idempotencyKey: payment.idempotency_key,
      metadata: {
        membership_card_id: membershipCard.id,
        payment_id: payment.id,
      },
      successQuery: {
        flow: 'membership-card',
        portal: 'member',
        surface: 'profile',
      },
    });
    expect(paymentRepo.updatePayment).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({
        gateway_metadata: {
          checkout_url: 'https://checkout.paymongo.test/card-1',
        },
        provider_ref: 'cs_test_card_checkout',
        status: 'processing',
      }),
    );
    expect(result).toMatchObject({
      checkout_url: 'https://checkout.paymongo.test/card-1',
      membership_card: membershipCard,
      message: 'Membership card checkout started.',
      payment,
    });
  });

  it('activates pending membership cards when a matching payment completes', async () => {
    const membershipCard = createPendingMembershipCard();

    repo.findMembershipCardWithUserProfileByIdOrThrow.mockResolvedValue({
      ...membershipCard,
      user: { profile: { first_name: 'Khristiane', last_name: 'Alistair' } },
    });
    repo.activateMembershipCard.mockResolvedValue({
      ...membershipCard,
      status: MembershipCardStatus.active,
    });

    await service.handlePaymentCompleted({
      paymentId: 'payment-card-1',
      userId: 'member-1',
      payableType: PayableType.membership_card,
      payableId: membershipCard.id,
      amount: '400',
      verifiedBy: null,
    });

    const [activatedCardId, activationInput] = repo.activateMembershipCard.mock
      .calls[0] as [
      string,
      {
        activatedAt: Date;
        verifiedAt: Date;
        verifiedBy: string | null;
      },
    ];
    expect(activatedCardId).toBe(membershipCard.id);
    expect(activationInput.activatedAt).toBeInstanceOf(Date);
    expect(activationInput.verifiedAt).toBeInstanceOf(Date);
    expect(activationInput.verifiedBy).toBeNull();

    const [notificationUserId, notificationType, notificationPayload] =
      notificationsService.dispatch.mock.calls[0] as [
        string,
        NotificationType,
        {
          data: {
            kind: string;
            membership_card_id: string;
            payment_id: string;
          };
          title: string;
        },
      ];
    expect(notificationUserId).toBe('member-1');
    expect(notificationType).toBe(NotificationType.payment_confirmed);
    expect(notificationPayload.title).toBe('Payment confirmed');
    expect(notificationPayload.data).toEqual(
      expect.objectContaining({
        kind: 'membership_card_payment_confirmed',
        membership_card_id: membershipCard.id,
        payment_id: 'payment-card-1',
      }),
    );
    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('emits a management activity notification when a staff review approves the card payment', async () => {
    const membershipCard = createPendingMembershipCard();

    repo.findMembershipCardWithUserProfileByIdOrThrow.mockResolvedValue({
      ...membershipCard,
      user: { profile: { first_name: 'Khristiane', last_name: 'Alistair' } },
    });
    repo.activateMembershipCard.mockResolvedValue({
      ...membershipCard,
      status: MembershipCardStatus.active,
    });

    await service.handlePaymentCompleted({
      paymentId: 'payment-card-2',
      userId: 'member-1',
      payableType: PayableType.membership_card,
      payableId: membershipCard.id,
      amount: '400',
      verifiedBy: 'staff-1',
    });

    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'account.activity',
      expect.objectContaining({
        action: 'membership_card_granted',
        actorId: 'staff-1',
        targetName: 'Khristiane Alistair',
        targetRole: UserRole.member,
        targetUserId: 'member-1',
      }),
    );
  });
});

function createPendingMembershipCard() {
  return {
    id: 'card-1',
    user_id: 'member-1',
    source: MembershipCardSource.paymongo,
    status: MembershipCardStatus.pending_verification,
    purchased_at: new Date('2026-03-24T00:00:00.000Z'),
    verified_at: null,
    verified_by: null,
    activated_at: null,
    revoked_at: null,
    revoked_by: null,
    revoke_reason: null,
    created_at: new Date('2026-03-24T00:00:00.000Z'),
    updated_at: new Date('2026-03-24T00:00:00.000Z'),
  };
}

function createPendingPayment() {
  return {
    id: 'payment-card-1',
    user_id: 'member-1',
    payable_type: PayableType.membership_card,
    payable_id: 'card-1',
    payment_stage: PaymentStage.full,
    amount: new Prisma.Decimal('400'),
    currency: 'PHP',
    provider: PaymentProvider.paymongo,
    provider_ref: null,
    gateway_event_id: null,
    idempotency_key: '44444444-4444-4444-8444-444444444444',
    status: 'pending',
    gateway_metadata: null,
    screenshot_url: null,
    rejection_reason: null,
    verified_by: null,
    verified_at: null,
    created_at: new Date('2026-03-24T00:00:00.000Z'),
    updated_at: new Date('2026-03-24T00:00:00.000Z'),
  };
}
