import {
  MembershipCardSource,
  MembershipCardStatus,
  NotificationType,
  PaymentProvider,
  PayableType,
  Prisma,
  UserRole,
} from '@prisma/client';

import { MembershipCardService } from './card.service';

describe('MembershipCardService', () => {
  const repo = {
    activateMembershipCard: jest.fn(),
    findMembershipCardByIdOrThrow: jest.fn(),
    findMembershipCardWithUserProfileByIdOrThrow: jest.fn(),
    findMembershipCardByUserId: jest.fn(),
    findMembershipOwnerByIdOrThrow: jest.fn(),
    getMembershipCardPrice: jest.fn(),
    revokeMembershipCard: jest.fn(),
  };

  const commerceCheckoutService = {
    createMembershipCardCheckout: jest.fn(),
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
      commerceCheckoutService as never,
      notificationsService as never,
      eventEmitter as never,
    );
  });

  it('starts a PayMongo checkout for a new membership-card purchase', async () => {
    repo.findMembershipOwnerByIdOrThrow.mockResolvedValue({
      id: 'member-1',
      role: UserRole.member,
      deletedAt: null,
    });
    repo.findMembershipCardByUserId.mockResolvedValue(null);
    repo.getMembershipCardPrice.mockResolvedValue(new Prisma.Decimal('400'));
    const checkout = {
      checkout_url: 'https://checkout.paymongo.test/card-1',
      hold_id: 'hold-card-1',
      kind: 'membership_card',
      payment_id: 'payment-card-1',
      status: 'held',
    };
    commerceCheckoutService.createMembershipCardCheckout.mockResolvedValue(
      checkout,
    );

    const result = await service.purchase(
      'member-1',
      { provider: PaymentProvider.paymongo },
      '44444444-4444-4444-8444-444444444444',
    );

    expect(repo.getMembershipCardPrice).toHaveBeenCalledTimes(1);
    expect(
      commerceCheckoutService.createMembershipCardCheckout,
    ).toHaveBeenCalledWith({
      amount: new Prisma.Decimal('400'),
      idempotencyKey: '44444444-4444-4444-8444-444444444444',
      returnTarget: 'web',
      userId: 'member-1',
    });
    expect(result).toEqual(checkout);
  });

  it('passes the mobile return target through membership-card checkout creation', async () => {
    repo.findMembershipOwnerByIdOrThrow.mockResolvedValue({
      id: 'member-1',
      role: UserRole.member,
      deletedAt: null,
    });
    repo.findMembershipCardByUserId.mockResolvedValue(null);
    repo.getMembershipCardPrice.mockResolvedValue(new Prisma.Decimal('400'));
    commerceCheckoutService.createMembershipCardCheckout.mockResolvedValue({
      checkout_url: 'https://checkout.paymongo.test/card-mobile',
    });

    await service.purchase(
      'member-1',
      { provider: PaymentProvider.paymongo, return_target: 'mobile' },
      '55555555-5555-4555-8555-555555555555',
    );

    expect(commerceCheckoutService.createMembershipCardCheckout).toHaveBeenCalledWith({
      amount: new Prisma.Decimal('400'),
      idempotencyKey: '55555555-5555-4555-8555-555555555555',
      returnTarget: 'mobile',
      userId: 'member-1',
    });
  });

  it('retires member cash membership-card requests without creating access or payment records', async () => {
    repo.findMembershipOwnerByIdOrThrow.mockResolvedValue({
      id: 'member-1',
      role: UserRole.member,
      deletedAt: null,
    });

    await expect(
      service.purchase(
        'member-1',
        { provider: PaymentProvider.cash },
        '44444444-4444-4444-8444-444444444444',
      ),
    ).rejects.toMatchObject({
      status: 410,
    });

    expect(
      commerceCheckoutService.createMembershipCardCheckout,
    ).not.toHaveBeenCalled();
  });

  it('notifies after a matching PayMongo completion has atomically activated the card', async () => {
    const membershipCard = {
      ...createPendingMembershipCard(),
      status: MembershipCardStatus.active,
    };

    repo.findMembershipCardWithUserProfileByIdOrThrow.mockResolvedValue({
      ...membershipCard,
      user: { profile: { first_name: 'Khristiane', last_name: 'Alistair' } },
    });

    await service.handlePaymentCompleted({
      paymentId: 'payment-card-1',
      userId: 'member-1',
      payableType: PayableType.membership_card,
      payableId: membershipCard.id,
      amount: '400',
      verifiedBy: null,
      membershipCardActivationCommitted: true,
    });

    expect(repo.activateMembershipCard).not.toHaveBeenCalled();

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

  it('emits a management activity notification for a trusted grant event', async () => {
    const membershipCard = {
      ...createPendingMembershipCard(),
      status: MembershipCardStatus.active,
    };

    repo.findMembershipCardWithUserProfileByIdOrThrow.mockResolvedValue({
      ...membershipCard,
      user: { profile: { first_name: 'Khristiane', last_name: 'Alistair' } },
    });

    await service.handlePaymentCompleted({
      paymentId: 'payment-card-2',
      userId: 'member-1',
      payableType: PayableType.membership_card,
      payableId: membershipCard.id,
      amount: '400',
      verifiedBy: 'staff-1',
      membershipCardActivationCommitted: true,
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

  it('does not activate or notify from an unmarked completion event', async () => {
    const membershipCard = createPendingMembershipCard();

    repo.findMembershipCardWithUserProfileByIdOrThrow.mockResolvedValue({
      ...membershipCard,
      user: { profile: { first_name: 'Khristiane', last_name: 'Alistair' } },
    });

    await service.handlePaymentCompleted({
      paymentId: 'payment-card-3',
      userId: 'member-1',
      payableType: PayableType.membership_card,
      payableId: membershipCard.id,
      amount: '400',
      verifiedBy: null,
    });

    expect(repo.activateMembershipCard).not.toHaveBeenCalled();
    expect(notificationsService.dispatch).not.toHaveBeenCalled();
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
