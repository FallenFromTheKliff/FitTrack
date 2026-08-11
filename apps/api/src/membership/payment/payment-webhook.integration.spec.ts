import { EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  MembershipCardSource,
  PayableType,
  PaymentProvider,
  Prisma,
} from '@prisma/client';

import { MembershipCardRepository } from '../card/card.repository';
import { MembershipCardService } from '../card/card.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { PaymongoCheckoutService } from './paymongo-checkout.service';
import {
  PAYMONGO_CHECKOUT_SESSION_PAID_EVENT,
  PaymongoWebhookEvent,
  PaymongoWebhookService,
} from './paymongo-webhook.service';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';
import { SubscriptionRepository } from '../subscription/subscription.repository';
import { SubscriptionService } from '../subscription/subscription.service';

type PaymentRecord = Awaited<
  ReturnType<PaymentRepository['findPaymentByProviderRefOrThrow']>
>;
type SubscriptionRecord = Awaited<
  ReturnType<SubscriptionRepository['findSubscriptionByIdOrThrow']>
>;
type MembershipCardRecord = Awaited<
  ReturnType<MembershipCardRepository['findMembershipCardByIdOrThrow']>
>;

function flushAsyncEvents(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
}

describe('Payment webhook integration', () => {
  let moduleRef: TestingModule;
  let paymentService: PaymentService;

  const paymentRepo = {
    findPaymentByGatewayEventId: jest.fn(),
    findPaymentByProviderRefOrThrow: jest.fn(),
    updatePayment: jest.fn(),
    completePaymongoMembershipCardPayment: jest.fn(),
    failPaymongoMembershipCardPayment: jest.fn(),
    findPaymentByIdempotencyKey: jest.fn(),
  };

  const subscriptionRepo = {
    findSubscriptionByIdOrThrow: jest.fn(),
    activateSubscription: jest.fn(),
  };
  const membershipCardRepo = {
    findMembershipCardByIdOrThrow: jest.fn(),
    findMembershipCardWithUserProfileByIdOrThrow: jest.fn(),
    activateMembershipCard: jest.fn(),
    revokeMembershipCard: jest.fn(),
  };

  const paymongoWebhookService = {
    parseAndVerify: jest.fn(),
  };

  const paymongoCheckoutService = {
    createCheckoutSession: jest.fn(),
  };
  const notificationsService = {
    dispatch: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [
        PaymentService,
        SubscriptionService,
        MembershipCardService,
        { provide: PaymentRepository, useValue: paymentRepo },
        { provide: SubscriptionRepository, useValue: subscriptionRepo },
        { provide: MembershipCardRepository, useValue: membershipCardRepo },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: PaymongoWebhookService, useValue: paymongoWebhookService },
        { provide: PaymongoCheckoutService, useValue: paymongoCheckoutService },
      ],
    }).compile();

    await moduleRef.init();
    paymentService = moduleRef.get(PaymentService);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('acknowledges a PayMongo webhook and activates the linked subscription once', async () => {
    const event = createCheckoutPaidEvent();
    const payment = createProcessingPayment();

    paymongoWebhookService.parseAndVerify.mockReturnValue(event);
    paymentRepo.findPaymentByGatewayEventId.mockResolvedValue(null);
    paymentRepo.findPaymentByProviderRefOrThrow.mockResolvedValue(payment);
    paymentRepo.updatePayment.mockResolvedValue({
      ...payment,
      status: 'completed',
      gateway_event_id: event.data.id,
    });
    subscriptionRepo.findSubscriptionByIdOrThrow.mockResolvedValue(
      createPendingSubscription(),
    );
    subscriptionRepo.activateSubscription.mockResolvedValue({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      status: 'active',
    });

    const result = await paymentService.handleWebhook(
      Buffer.from(JSON.stringify(event), 'utf8'),
      't=123,te=fake',
    );
    await flushAsyncEvents();

    expect(result).toEqual({ message: 'SUCCESS' });
    expect(paymentRepo.findPaymentByGatewayEventId).toHaveBeenCalledWith(
      'evt_test_checkout_paid',
    );
    expect(paymentRepo.findPaymentByProviderRefOrThrow).toHaveBeenCalledWith(
      'cs_test_checkout',
    );
    expect(paymentRepo.updatePayment).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({
        status: 'completed',
        gateway_event_id: 'evt_test_checkout_paid',
      }),
    );
    expect(subscriptionRepo.activateSubscription).toHaveBeenCalledWith(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      payment.id,
      expect.any(Date),
      expect.any(Date),
    );
  });

  it('treats duplicate gateway events as idempotent acknowledgements', async () => {
    const event = createCheckoutPaidEvent();

    paymongoWebhookService.parseAndVerify.mockReturnValue(event);
    paymentRepo.findPaymentByGatewayEventId.mockResolvedValue({
      ...createProcessingPayment(),
      gateway_event_id: 'evt_test_checkout_paid',
    });

    const result = await paymentService.handleWebhook(
      Buffer.from(JSON.stringify(event), 'utf8'),
      't=123,te=fake',
    );
    await flushAsyncEvents();

    expect(result).toEqual({ message: 'SUCCESS' });
    expect(paymentRepo.findPaymentByProviderRefOrThrow).not.toHaveBeenCalled();
    expect(paymentRepo.updatePayment).not.toHaveBeenCalled();
    expect(subscriptionRepo.activateSubscription).not.toHaveBeenCalled();
  });

  it('acknowledges a PayMongo webhook and activates the linked membership card once', async () => {
    const event = createCheckoutPaidEvent({
      checkoutSessionId: 'cs_test_card_checkout',
      eventId: 'evt_test_card_checkout_paid',
      checkoutUrl: 'https://checkout.paymongo.com/cs_test_card_checkout',
      metadata: {
        membership_card_id: 'card-1',
        payment_id: 'payment-card-1',
      },
      referenceNumber: 'GCASH-CARD-1234',
    });
    const payment = createProcessingMembershipCardPayment();

    paymongoWebhookService.parseAndVerify.mockReturnValue(event);
    paymentRepo.findPaymentByGatewayEventId.mockResolvedValue(null);
    paymentRepo.findPaymentByProviderRefOrThrow.mockResolvedValue(payment);
    paymentRepo.completePaymongoMembershipCardPayment.mockResolvedValue({
      payment: {
        ...payment,
        status: 'completed',
        gateway_event_id: event.data.id,
      },
      transitioned: true,
      membershipCardStateChanged: true,
    });
    membershipCardRepo.findMembershipCardWithUserProfileByIdOrThrow.mockResolvedValue(
      {
        ...createPendingMembershipCard(),
        status: 'active',
      },
    );

    const result = await paymentService.handleWebhook(
      Buffer.from(JSON.stringify(event), 'utf8'),
      't=123,te=fake',
    );
    await flushAsyncEvents();

    expect(result).toEqual({ message: 'SUCCESS' });
    expect(paymentRepo.findPaymentByProviderRefOrThrow).toHaveBeenCalledWith(
      'cs_test_card_checkout',
    );
    expect(
      paymentRepo.completePaymongoMembershipCardPayment,
    ).toHaveBeenCalledWith(
      payment.id,
      expect.objectContaining({
        gatewayEventId: event.data.id,
        verifiedAt: expect.any(Date) as unknown as Date,
      }),
    );
    expect(membershipCardRepo.activateMembershipCard).not.toHaveBeenCalled();
    expect(subscriptionRepo.activateSubscription).not.toHaveBeenCalled();
  });
});

function createCheckoutPaidEvent(input?: {
  checkoutSessionId?: string;
  checkoutUrl?: string;
  eventId?: string;
  metadata?: Record<string, string>;
  referenceNumber?: string;
}): PaymongoWebhookEvent {
  const checkoutSessionId = input?.checkoutSessionId ?? 'cs_test_checkout';
  const checkoutUrl =
    input?.checkoutUrl ?? `https://checkout.paymongo.com/${checkoutSessionId}`;
  const referenceNumber = input?.referenceNumber ?? 'GCASH-1234';

  return {
    data: {
      id: input?.eventId ?? 'evt_test_checkout_paid',
      type: 'event',
      attributes: {
        type: PAYMONGO_CHECKOUT_SESSION_PAID_EVENT,
        livemode: false,
        data: {
          id: checkoutSessionId,
          type: 'checkout_session',
          attributes: {
            checkout_url: checkoutUrl,
            metadata: input?.metadata ?? {
              payment_id: 'payment-1',
              subscription_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            },
            paid_at: 1770000000,
            payment_method_used: 'gcash',
            payments: [
              {
                id: 'pm_pay_1',
                type: 'payment',
                attributes: {
                  amount: 149900,
                  currency: 'PHP',
                  external_reference_number: referenceNumber,
                  paid_at: 1770000000,
                  status: 'paid',
                },
              },
            ],
            reference_number: referenceNumber,
            status: 'paid',
          },
        },
        previous_data: {},
      },
    },
  };
}

function createProcessingPayment(): PaymentRecord {
  return {
    id: 'payment-1',
    user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    payable_type: PayableType.subscription,
    payable_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    payment_stage: 'full',
    amount: new Prisma.Decimal('1499'),
    currency: 'PHP',
    provider: PaymentProvider.paymongo,
    provider_ref: 'cs_test_checkout',
    gateway_event_id: null,
    idempotency_key: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    status: 'processing',
    gateway_metadata: {
      checkout_url: 'https://checkout.paymongo.com/cs_test_checkout',
    },
    screenshot_url: null,
    rejection_reason: null,
    verified_by: null,
    verified_at: null,
    created_at: new Date('2026-03-24T00:00:00.000Z'),
    updated_at: new Date('2026-03-24T00:00:00.000Z'),
  };
}

function createProcessingMembershipCardPayment(): PaymentRecord {
  return {
    id: 'payment-card-1',
    user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    payable_type: PayableType.membership_card,
    payable_id: 'card-1',
    payment_stage: 'full',
    amount: new Prisma.Decimal('400'),
    currency: 'PHP',
    provider: PaymentProvider.paymongo,
    provider_ref: 'cs_test_card_checkout',
    gateway_event_id: null,
    idempotency_key: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    status: 'pending',
    gateway_metadata: {
      checkout_url: 'https://checkout.paymongo.com/cs_test_card_checkout',
    },
    screenshot_url: null,
    rejection_reason: null,
    verified_by: null,
    verified_at: null,
    created_at: new Date('2026-03-24T00:00:00.000Z'),
    updated_at: new Date('2026-03-24T00:00:00.000Z'),
  };
}

function createPendingSubscription(): SubscriptionRecord {
  return {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    plan_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    payment_id: null,
    status: 'pending_payment',
    starts_at: null,
    expires_at: null,
    warned_7d_at: null,
    warned_3d_at: null,
    warned_1d_at: null,
    cancelled_at: null,
    cancellation_reason: null,
    created_at: new Date('2026-03-24T00:00:00.000Z'),
    updated_at: new Date('2026-03-24T00:00:00.000Z'),
    plan: {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      name: 'Monthly Membership',
      description: null,
      price: new Prisma.Decimal('1499'),
      currency: 'PHP',
      duration_days: 30,
      features: {},
      sort_order: 0,
      includes_coaching: false,
      is_active: true,
      created_at: new Date('2026-03-24T00:00:00.000Z'),
      updated_at: new Date('2026-03-24T00:00:00.000Z'),
    },
  };
}

function createPendingMembershipCard(): MembershipCardRecord {
  return {
    id: 'card-1',
    user_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    source: MembershipCardSource.paymongo,
    status: 'pending_verification',
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
