import { GoneException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { PaymongoWebhookService } from './paymongo-webhook.service';
import { PAYMENT_FAILED_EVENT } from './events/payment-failed.event';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';
import { CoachingCommerceService } from '../../coaching/commerce/coaching-commerce.service';
import { PaymongoCheckoutService } from './paymongo-checkout.service';

describe('PaymentService', () => {
  let service: PaymentService;

  const repo = {
    getMyPayments: jest.fn(),
    findPaymentByIdForOwnerOrThrow: jest.fn(),
    findPaymentByIdForStaffOrThrow: jest.fn(),
    getAllPayments: jest.fn(),
    createPayment: jest.fn(),
    findPaymentByIdOrThrow: jest.fn(),
    findCommerceCheckoutForReconciliationOrThrow: jest.fn(),
    findPaymentByGatewayEventId: jest.fn(),
    findPaymentByProviderRefOrThrow: jest.fn(),
    updatePayment: jest.fn(),
    completePaymongoMembershipCardPayment: jest.fn(),
    failPaymongoMembershipCardPayment: jest.fn(),
    completePaymongoCommerceCheckout: jest.fn(),
    cancelPaymongoCommerceCheckout: jest.fn(),
    failPaymongoCommerceCheckout: jest.fn(),
    findSubscriptionPaymentContextOrThrow: jest.fn(),
    findBookingPaymentContextOrThrow: jest.fn(),
    findCoachingPaymentContextOrThrow: jest.fn(),
  };

  const paymongoWebhookService = {
    parseAndVerify: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const paymongoCheckoutService = {
    retrieveCheckoutSession: jest.fn(),
    expireCheckoutSession: jest.fn(),
  };

  const commerceCheckoutService = {
    getHoldStatusForUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PaymentRepository, useValue: repo },
        { provide: PaymongoWebhookService, useValue: paymongoWebhookService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: CoachingCommerceService, useValue: commerceCheckoutService },
        { provide: PaymongoCheckoutService, useValue: paymongoCheckoutService },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();
  });

  it('allows only the member owner role to reconcile a checkout hold', async () => {
    await expect(
      service.reconcileCheckoutHold('hold-1', 'staff-1', UserRole.staff),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      repo.findCommerceCheckoutForReconciliationOrThrow,
    ).not.toHaveBeenCalled();
  });

  it('allows only the member owner role to cancel a checkout hold', async () => {
    await expect(
      service.cancelCheckoutHold('hold-1', 'staff-1', UserRole.staff),
    ).rejects.toMatchObject({ status: 403 });
    expect(repo.findCommerceCheckoutForReconciliationOrThrow).not.toHaveBeenCalled();
    expect(paymongoCheckoutService.retrieveCheckoutSession).not.toHaveBeenCalled();
  });

  it('keeps a processing provider checkout locked during cancellation', async () => {
    const context = createReconciliationContext();
    repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(context);
    paymongoCheckoutService.retrieveCheckoutSession.mockResolvedValue(
      createRetrievedSession({
        payments: [],
        paymentIntentStatus: 'processing',
        status: 'processing',
      }),
    );

    await expect(
      service.cancelCheckoutHold(
        context.hold.id,
        context.hold.user_id,
        UserRole.member,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(paymongoCheckoutService.expireCheckoutSession).not.toHaveBeenCalled();
    expect(repo.cancelPaymongoCommerceCheckout).not.toHaveBeenCalled();
  });

  it('expires and releases an active unpaid provider checkout', async () => {
    const context = createReconciliationContext();
    repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(context);
    paymongoCheckoutService.retrieveCheckoutSession
      .mockResolvedValueOnce(
        createRetrievedSession({
          payments: [],
          paymentIntentStatus: 'requires_payment_method',
          status: 'active',
        }),
      )
      .mockResolvedValueOnce(
        createRetrievedSession({
          payments: [],
          paymentIntentStatus: 'cancelled',
          status: 'expired',
        }),
      );
    paymongoCheckoutService.expireCheckoutSession.mockResolvedValue({
      id: 'cs_hold_1',
      paymentIntentStatus: 'cancelled',
      status: 'expired',
      type: 'checkout_session',
    });
    repo.cancelPaymongoCommerceCheckout.mockResolvedValue({
      payment: { ...context.payment, status: PaymentStatus.failed },
      productCreated: false,
      productId: null,
      productKind: context.hold.kind,
      transitioned: true,
    });
    commerceCheckoutService.getHoldStatusForUser.mockResolvedValue({
      hold_id: context.hold.id,
      state: 'failed',
    });

    await expect(
      service.cancelCheckoutHold(
        context.hold.id,
        context.hold.user_id,
        UserRole.member,
      ),
    ).resolves.toMatchObject({ state: 'failed' });
    expect(paymongoCheckoutService.expireCheckoutSession).toHaveBeenCalledWith(
      'cs_hold_1',
    );
    expect(repo.cancelPaymongoCommerceCheckout).toHaveBeenCalledWith(
      context.payment.id,
      {
        rejectionReason: 'Checkout cancelled by member before payment completed.',
      },
    );
  });

  it('keeps the hold when provider closure fails', async () => {
    const context = createReconciliationContext();
    repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(context);
    paymongoCheckoutService.retrieveCheckoutSession.mockResolvedValue(
      createRetrievedSession({
        payments: [],
        paymentIntentStatus: 'requires_payment_method',
        status: 'active',
      }),
    );
    paymongoCheckoutService.expireCheckoutSession.mockRejectedValue(
      new Error('provider unavailable'),
    );

    await expect(
      service.cancelCheckoutHold(
        context.hold.id,
        context.hold.user_id,
        UserRole.member,
      ),
    ).rejects.toThrow('provider unavailable');
    expect(repo.cancelPaymongoCommerceCheckout).not.toHaveBeenCalled();
  });

  it('reconciles a paid provider race instead of releasing the hold', async () => {
    const context = createReconciliationContext();
    const activeSession = createRetrievedSession({
      payments: [],
      paymentIntentStatus: 'requires_payment_method',
      status: 'active',
    });
    const paidSession = createRetrievedSession();
    repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(context);
    paymongoCheckoutService.retrieveCheckoutSession
      .mockResolvedValueOnce(activeSession)
      .mockResolvedValueOnce(paidSession)
      .mockResolvedValueOnce(paidSession);
    paymongoCheckoutService.expireCheckoutSession.mockResolvedValue({
      id: 'cs_hold_1',
      paymentIntentStatus: 'succeeded',
      status: 'expired',
      type: 'checkout_session',
    });
    repo.completePaymongoCommerceCheckout.mockResolvedValue({
      payment: { ...context.payment, status: PaymentStatus.completed },
      productCreated: true,
      productId: 'appointment-1',
      productKind: context.hold.kind,
      transitioned: true,
    });
    commerceCheckoutService.getHoldStatusForUser.mockResolvedValue({
      hold_id: context.hold.id,
      state: 'succeeded',
    });

    await expect(
      service.cancelCheckoutHold(
        context.hold.id,
        context.hold.user_id,
        UserRole.member,
      ),
    ).resolves.toMatchObject({ state: 'succeeded' });
    expect(repo.completePaymongoCommerceCheckout).toHaveBeenCalled();
    expect(repo.cancelPaymongoCommerceCheckout).not.toHaveBeenCalled();
  });

  it('returns completed local state without touching the provider during cancellation', async () => {
    const context = createReconciliationContext();
    context.hold.status = CommerceCheckoutHoldStatus.consumed;
    context.payment.status = PaymentStatus.completed;
    repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(context);
    commerceCheckoutService.getHoldStatusForUser.mockResolvedValue({
      hold_id: context.hold.id,
      state: 'succeeded',
    });

    await expect(
      service.cancelCheckoutHold(
        context.hold.id,
        context.hold.user_id,
        UserRole.member,
      ),
    ).resolves.toMatchObject({ state: 'succeeded' });
    expect(paymongoCheckoutService.retrieveCheckoutSession).not.toHaveBeenCalled();
    expect(repo.cancelPaymongoCommerceCheckout).not.toHaveBeenCalled();
  });
  it('returns the current hold state without completing when PayMongo is not paid', async () => {
    const context = createReconciliationContext();
    repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(
      context,
    );
    paymongoCheckoutService.retrieveCheckoutSession.mockResolvedValue(
      createRetrievedSession({ payments: [] }),
    );
    commerceCheckoutService.getHoldStatusForUser.mockResolvedValue({
      hold_id: context.hold.id,
      state: 'pending',
    });

    await expect(
      service.reconcileCheckoutHold(
        context.hold.id,
        context.hold.user_id,
        UserRole.member,
      ),
    ).resolves.toMatchObject({ state: 'pending' });
    expect(repo.completePaymongoCommerceCheckout).not.toHaveBeenCalled();
  });

  it.each(Object.values(CommerceCheckoutHoldKind))(
    'reconciles a verified paid %s commerce checkout through the atomic completion path',
    async (kind) => {
      const context = createReconciliationContext(kind);
      repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(
        context,
      );
      paymongoCheckoutService.retrieveCheckoutSession.mockResolvedValue(
        createRetrievedSession({ kind }),
      );
      repo.completePaymongoCommerceCheckout.mockResolvedValue({
        payment: context.payment,
        productCreated: true,
        productId: 'product-1',
        productKind: kind,
        transitioned: true,
      });
      commerceCheckoutService.getHoldStatusForUser.mockResolvedValue({
        hold_id: context.hold.id,
        state: 'succeeded',
      });

      await expect(
        service.reconcileCheckoutHold(
          context.hold.id,
          context.hold.user_id,
          UserRole.member,
        ),
      ).resolves.toMatchObject({ state: 'succeeded' });

      expect(repo.completePaymongoCommerceCheckout).toHaveBeenCalledWith(
        context.payment.id,
        expect.objectContaining({
          gatewayEventId: 'reconcile:cs_hold_1:pay_hold_1',
          verifiedAt: new Date('2026-08-14T03:00:00.000Z'),
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'payment.completed',
        expect.objectContaining({ paymentId: context.payment.id }),
      );
      jest.clearAllMocks();
    },
  );

  it.each([
    ['session', { sessionId: 'cs_other' }],
    ['amount', { amount: 7600 }],
    ['currency', { currency: 'USD' }],
    ['metadata', { paymentId: 'payment-other' }],
  ])(
    'rejects a paid provider %s mismatch without fulfillment',
    async (_name, change) => {
      const context = createReconciliationContext();
      repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(
        context,
      );
      paymongoCheckoutService.retrieveCheckoutSession.mockResolvedValue(
        createRetrievedSession(change),
      );

      await expect(
        service.reconcileCheckoutHold(
          context.hold.id,
          context.hold.user_id,
          UserRole.member,
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect(repo.completePaymongoCommerceCheckout).not.toHaveBeenCalled();
    },
  );

  it('returns an already-consumed checkout without retrieving PayMongo again', async () => {
    const context = createReconciliationContext();
    context.hold.status = CommerceCheckoutHoldStatus.consumed;
    context.payment.status = PaymentStatus.completed;
    repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(
      context,
    );
    commerceCheckoutService.getHoldStatusForUser.mockResolvedValue({
      hold_id: context.hold.id,
      state: 'succeeded',
    });

    await expect(
      service.reconcileCheckoutHold(
        context.hold.id,
        context.hold.user_id,
        UserRole.member,
      ),
    ).resolves.toMatchObject({ state: 'succeeded' });
    expect(
      paymongoCheckoutService.retrieveCheckoutSession,
    ).not.toHaveBeenCalled();
    expect(repo.completePaymongoCommerceCheckout).not.toHaveBeenCalled();
  });

  it('keeps a later signed webhook harmless after reconciliation completed first', async () => {
    const context = createReconciliationContext();
    repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(
      context,
    );
    paymongoCheckoutService.retrieveCheckoutSession.mockResolvedValue(
      createRetrievedSession(),
    );
    repo.completePaymongoCommerceCheckout
      .mockResolvedValueOnce({
        payment: context.payment,
        productCreated: true,
        productId: 'booking-1',
        productKind: CommerceCheckoutHoldKind.venue,
        transitioned: true,
      })
      .mockResolvedValueOnce({
        payment: { ...context.payment, status: PaymentStatus.completed },
        productCreated: true,
        productId: 'booking-1',
        productKind: CommerceCheckoutHoldKind.venue,
        transitioned: false,
      });
    commerceCheckoutService.getHoldStatusForUser.mockResolvedValue({
      hold_id: context.hold.id,
      state: 'succeeded',
    });

    await service.reconcileCheckoutHold(
      context.hold.id,
      context.hold.user_id,
      UserRole.member,
    );

    repo.findPaymentByGatewayEventId.mockResolvedValue(null);
    repo.findPaymentByProviderRefOrThrow.mockResolvedValue({
      ...context.payment,
      status: PaymentStatus.completed,
    });
    paymongoWebhookService.parseAndVerify.mockReturnValue({
      data: {
        id: 'evt_late_signed_webhook',
        type: 'event',
        attributes: {
          type: 'checkout_session.payment.paid',
          livemode: false,
          data: {
            id: 'cs_hold_1',
            type: 'checkout_session',
            attributes: {
              paid_at: 1786676400,
              payments: [],
            },
          },
          previous_data: {},
        },
      },
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 't=1,te=signed'),
    ).resolves.toEqual({ message: 'SUCCESS' });
    expect(repo.completePaymongoCommerceCheckout).toHaveBeenCalledTimes(2);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it('emits one completion when reconciliation races the signed webhook', async () => {
    const context = createReconciliationContext();
    repo.findCommerceCheckoutForReconciliationOrThrow.mockResolvedValue(
      context,
    );
    paymongoCheckoutService.retrieveCheckoutSession.mockResolvedValue(
      createRetrievedSession(),
    );
    commerceCheckoutService.getHoldStatusForUser.mockResolvedValue({
      hold_id: context.hold.id,
      state: 'succeeded',
    });
    repo.findPaymentByGatewayEventId.mockResolvedValue(null);
    repo.findPaymentByProviderRefOrThrow.mockResolvedValue(context.payment);
    repo.completePaymongoCommerceCheckout
      .mockResolvedValueOnce({
        payment: context.payment,
        productCreated: true,
        productId: 'booking-1',
        productKind: CommerceCheckoutHoldKind.venue,
        transitioned: true,
      })
      .mockResolvedValueOnce({
        payment: { ...context.payment, status: PaymentStatus.completed },
        productCreated: true,
        productId: 'booking-1',
        productKind: CommerceCheckoutHoldKind.venue,
        transitioned: false,
      });
    paymongoWebhookService.parseAndVerify.mockReturnValue({
      data: {
        id: 'evt_racing_signed_webhook',
        type: 'event',
        attributes: {
          type: 'checkout_session.payment.paid',
          livemode: false,
          data: {
            id: 'cs_hold_1',
            type: 'checkout_session',
            attributes: { paid_at: 1786676400, payments: [] },
          },
          previous_data: {},
        },
      },
    });

    await Promise.all([
      service.reconcileCheckoutHold(
        context.hold.id,
        context.hold.user_id,
        UserRole.member,
      ),
      service.handleWebhook(Buffer.from('{}'), 't=1,te=signed'),
    ]);

    expect(repo.completePaymongoCommerceCheckout).toHaveBeenCalledTimes(2);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it('retires manual subscription payments with HTTP 410', async () => {
    await expect(
      service.submitManualPayment('member-1', UserRole.member, {
        payable_type: PayableType.subscription,
        payable_id: 'sub-1',
        payment_stage: PaymentStage.full,
        amount: 1499,
        screenshot_url: 'https://cdn.fittrack.test/receipt.png',
        reference_no: 'OR-123',
      }),
    ).rejects.toMatchObject({ status: 410 });
    expect(repo.createPayment).not.toHaveBeenCalled();
  });

  it('retires staff manual payments for another member with HTTP 410', async () => {
    await expect(
      service.submitManualPayment('staff-1', UserRole.staff, {
        payable_type: PayableType.subscription,
        payable_id: 'sub-1',
        payment_stage: PaymentStage.full,
        amount: 1499,
        screenshot_url: 'https://cdn.fittrack.test/receipt.png',
        reference_no: 'OR-123',
      }),
    ).rejects.toMatchObject({ status: 410 });
    expect(repo.createPayment).not.toHaveBeenCalled();
  });

  it('retires cross-owner manual subscription payments before ownership checks', async () => {
    await expect(
      service.submitManualPayment('member-2', UserRole.member, {
        payable_type: PayableType.subscription,
        payable_id: 'sub-1',
        payment_stage: PaymentStage.full,
        amount: 1499,
        screenshot_url: 'https://cdn.fittrack.test/receipt.png',
        reference_no: 'OR-123',
      }),
    ).rejects.toBeInstanceOf(GoneException);
    expect(repo.findSubscriptionPaymentContextOrThrow).not.toHaveBeenCalled();
  });

  it('retires manual booking balance payments with HTTP 410', async () => {
    await expect(
      service.submitManualPayment('member-1', UserRole.member, {
        payable_type: PayableType.booking,
        payable_id: 'booking-1',
        payment_stage: PaymentStage.balance,
        amount: 560,
        screenshot_url: 'https://cdn.fittrack.test/receipt.png',
        reference_no: 'OR-123',
      }),
    ).rejects.toBeInstanceOf(GoneException);
    expect(repo.createPayment).not.toHaveBeenCalled();
  });

  it('retires manual coaching balance payments with HTTP 410', async () => {
    await expect(
      service.submitManualPayment('member-1', UserRole.member, {
        payable_type: PayableType.coaching,
        payable_id: 'appt-1',
        payment_stage: PaymentStage.balance,
        amount: 840,
        screenshot_url: 'https://cdn.fittrack.test/receipt.png',
        reference_no: 'OR-123',
      }),
    ).rejects.toBeInstanceOf(GoneException);
    expect(repo.createPayment).not.toHaveBeenCalled();
  });

  it('retires member cash membership-card payment submissions', async () => {
    await expect(
      service.submitManualPayment('member-1', UserRole.member, {
        payable_type: PayableType.membership_card,
        payable_id: 'card-1',
        payment_stage: PaymentStage.full,
        amount: 400,
        screenshot_url: 'https://cdn.fittrack.test/receipt.png',
        reference_no: 'OR-CARD-123',
      }),
    ).rejects.toBeInstanceOf(GoneException);

    expect(repo.createPayment).not.toHaveBeenCalled();
  });

  it('returns any payment to staff without ownership enforcement', async () => {
    repo.findPaymentByIdForStaffOrThrow.mockResolvedValue({ id: 'payment-1' });

    await service.getPaymentById('payment-1', 'staff-1', UserRole.staff);

    expect(repo.findPaymentByIdForStaffOrThrow).toHaveBeenCalledWith(
      'payment-1',
    );
    expect(repo.findPaymentByIdForOwnerOrThrow).not.toHaveBeenCalled();
  });

  it('retires manual payment approval with HTTP 410', async () => {
    repo.findPaymentByIdForStaffOrThrow.mockResolvedValue({
      id: 'payment-1',
      user_id: 'member-1',
      payable_type: PayableType.subscription,
      payable_id: 'sub-1',
      status: 'awaiting_verification',
      amount: 1499,
    });
    await expect(
      service.verifyPayment('payment-1', { action: 'approve' }, 'admin-1'),
    ).rejects.toBeInstanceOf(GoneException);
    expect(repo.updatePayment).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('retires manual payment rejection with HTTP 410', async () => {
    repo.findPaymentByIdForStaffOrThrow.mockResolvedValue({
      id: 'payment-1',
      user_id: 'member-1',
      payable_type: PayableType.subscription,
      payable_id: 'sub-1',
      status: 'awaiting_verification',
      amount: 1499,
    });
    await expect(
      service.verifyPayment(
        'payment-1',
        { action: 'reject', rejection_reason: 'Receipt was unreadable.' },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(GoneException);
    expect(repo.updatePayment).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects verification attempts for payments not awaiting review', async () => {
    repo.findPaymentByIdForStaffOrThrow.mockResolvedValue({
      id: 'payment-1',
      status: 'pending',
      amount: 1499,
      user_id: 'member-1',
      payable_type: PayableType.subscription,
      payable_id: 'sub-1',
    });

    await expect(
      service.verifyPayment('payment-1', { action: 'approve' }, 'admin-1'),
    ).rejects.toBeInstanceOf(GoneException);
  });

  it('retires admin/staff verification for membership-card payments', async () => {
    repo.findPaymentByIdForStaffOrThrow.mockResolvedValue({
      id: 'payment-card-1',
      status: 'awaiting_verification',
      amount: 400,
      user_id: 'member-1',
      payable_type: PayableType.membership_card,
      payable_id: 'card-1',
    });

    await expect(
      service.verifyPayment('payment-card-1', { action: 'approve' }, 'admin-1'),
    ).rejects.toBeInstanceOf(GoneException);

    expect(repo.updatePayment).not.toHaveBeenCalled();
  });

  it('returns the retired response before validating a membership-card rejection reason', async () => {
    repo.findPaymentByIdForStaffOrThrow.mockResolvedValue({
      id: 'payment-card-1',
      status: 'awaiting_verification',
      amount: 400,
      user_id: 'member-1',
      payable_type: PayableType.membership_card,
      payable_id: 'card-1',
    });

    await expect(
      service.verifyPayment('payment-card-1', { action: 'reject' }, 'admin-1'),
    ).rejects.toBeInstanceOf(GoneException);

    expect(repo.updatePayment).not.toHaveBeenCalled();
  });

  it('acknowledges duplicate webhook events without duplicating side effects', async () => {
    paymongoWebhookService.parseAndVerify.mockReturnValue({
      data: {
        id: 'evt_1',
        type: 'event',
        attributes: {
          type: 'checkout_session.payment.paid',
          livemode: false,
          data: {
            id: 'cs_1',
            type: 'checkout_session',
            attributes: {},
          },
          previous_data: {},
        },
      },
    });
    repo.findPaymentByGatewayEventId.mockResolvedValue({ id: 'payment-1' });

    const result = await service.handleWebhook(
      Buffer.from('{}'),
      't=1700000000,te=signature',
    );

    expect(result).toEqual({ message: 'SUCCESS' });
    expect(repo.updatePayment).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      'payment.completed',
      expect.anything(),
    );
  });

  it('consumes a successful commerce hold webhook exactly once', async () => {
    paymongoWebhookService.parseAndVerify.mockReturnValue({
      data: {
        id: 'evt_hold_paid_1',
        type: 'event',
        attributes: {
          type: 'checkout_session.payment.paid',
          livemode: false,
          data: {
            id: 'cs_hold_1',
            type: 'checkout_session',
            attributes: { paid_at: 1700000000 },
          },
          previous_data: {},
        },
      },
    });
    repo.findPaymentByGatewayEventId.mockResolvedValue(null);
    repo.findPaymentByProviderRefOrThrow.mockResolvedValue({
      id: 'payment-hold-1',
      user_id: 'member-1',
      payable_type: PayableType.commerce_checkout_hold,
      payable_id: 'hold-1',
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.processing,
      amount: 1499,
    });
    repo.completePaymongoCommerceCheckout.mockResolvedValue({
      payment: {
        id: 'payment-hold-1',
        user_id: 'member-1',
        payable_type: PayableType.commerce_checkout_hold,
        payable_id: 'hold-1',
        amount: 1499,
      },
      productCreated: true,
      productId: 'appt-1',
      productKind: 'one_time',
      transitioned: true,
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 't=1700000000,te=signature'),
    ).resolves.toEqual({ message: 'SUCCESS' });

    expect(repo.completePaymongoCommerceCheckout).toHaveBeenCalledWith(
      'payment-hold-1',
      expect.objectContaining({
        gatewayEventId: 'evt_hold_paid_1',
        verifiedAt: new Date('2023-11-14T22:13:20.000Z'),
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.completed',
      expect.objectContaining({
        paymentId: 'payment-hold-1',
        payableType: PayableType.commerce_checkout_hold,
        payableId: 'hold-1',
      }),
    );
    expect(repo.updatePayment).not.toHaveBeenCalled();
  });

  it('releases a commerce hold when PayMongo reports payment failure', async () => {
    paymongoWebhookService.parseAndVerify.mockReturnValue({
      data: {
        id: 'evt_hold_failed_1',
        type: 'event',
        attributes: {
          type: 'payment.failed',
          livemode: false,
          data: {
            id: 'pay_hold_failed_1',
            type: 'payment',
            attributes: {
              failed_message: 'card declined',
              metadata: { payment_id: 'payment-hold-1' },
              status: 'failed',
            },
          },
          previous_data: {},
        },
      },
    });
    repo.findPaymentByGatewayEventId.mockResolvedValue(null);
    repo.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-hold-1',
      user_id: 'member-1',
      payable_type: PayableType.commerce_checkout_hold,
      payable_id: 'hold-1',
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.processing,
      amount: 1499,
    });
    repo.failPaymongoCommerceCheckout.mockResolvedValue({
      payment: {
        id: 'payment-hold-1',
        user_id: 'member-1',
        payable_type: PayableType.commerce_checkout_hold,
        payable_id: 'hold-1',
        amount: 1499,
      },
      productCreated: false,
      productId: null,
      productKind: 'one_time',
      transitioned: true,
    });

    await expect(
      service.handleWebhook(Buffer.from('{}'), 't=1700000000,te=signature'),
    ).resolves.toEqual({ message: 'SUCCESS' });

    expect(repo.failPaymongoCommerceCheckout).toHaveBeenCalledWith(
      'payment-hold-1',
      expect.objectContaining({
        gatewayEventId: 'evt_hold_failed_1',
        rejectionReason: 'card declined',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PAYMENT_FAILED_EVENT,
      expect.objectContaining({
        paymentId: 'payment-hold-1',
        payableType: PayableType.commerce_checkout_hold,
        payableId: 'hold-1',
        reason: 'card declined',
      }),
    );
    expect(repo.updatePayment).not.toHaveBeenCalled();
  });

  it('marks a matching PayMongo payment complete and emits payment.completed', async () => {
    paymongoWebhookService.parseAndVerify.mockReturnValue({
      data: {
        id: 'evt_1',
        type: 'event',
        attributes: {
          type: 'checkout_session.payment.paid',
          livemode: false,
          data: {
            id: 'cs_1',
            type: 'checkout_session',
            attributes: {
              checkout_url: 'https://checkout.paymongo.com/cs_1',
              paid_at: 1700000000,
              payment_method_used: 'gcash',
              payments: [
                {
                  id: 'pay_1',
                  type: 'payment',
                  attributes: {
                    amount: 149900,
                    currency: 'PHP',
                    external_reference_number: '1234',
                    paid_at: 1700000000,
                    status: 'paid',
                  },
                },
              ],
              reference_number: '1234',
              status: 'active',
            },
          },
          previous_data: {},
        },
      },
    });
    repo.findPaymentByGatewayEventId.mockResolvedValue(null);
    repo.findPaymentByProviderRefOrThrow.mockResolvedValue({
      id: 'payment-1',
      user_id: 'member-1',
      payable_type: PayableType.subscription,
      payable_id: 'sub-1',
      provider_ref: 'cs_1',
      provider: PaymentProvider.paymongo,
      gateway_metadata: {
        checkout_url: 'https://checkout.paymongo.com/cs_1',
      },
      status: 'processing',
      amount: 1499,
    });
    repo.updatePayment.mockResolvedValue({ id: 'payment-1' });

    const result = await service.handleWebhook(
      Buffer.from('{}'),
      't=1700000000,te=signature',
    );

    expect(result).toEqual({ message: 'SUCCESS' });
    expect(repo.updatePayment).toHaveBeenCalledWith(
      'payment-1',
      expect.objectContaining({
        status: 'completed',
        verified_at: new Date('2023-11-14T22:13:20.000Z'),
        gateway_event_id: 'evt_1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.completed',
      expect.objectContaining({
        paymentId: 'payment-1',
        userId: 'member-1',
        payableType: PayableType.subscription,
        payableId: 'sub-1',
      }),
    );
  });

  it('marks a matching PayMongo payment failed and emits payment.failed', async () => {
    paymongoWebhookService.parseAndVerify.mockReturnValue({
      data: {
        id: 'evt_failed_1',
        type: 'event',
        attributes: {
          type: 'payment.failed',
          livemode: false,
          data: {
            id: 'pay_failed_1',
            type: 'payment',
            attributes: {
              amount: 149900,
              currency: 'PHP',
              failed_message: 'card declined',
              metadata: {
                payment_id: 'payment-1',
              },
              status: 'failed',
            },
          },
          previous_data: {},
        },
      },
    });
    repo.findPaymentByGatewayEventId.mockResolvedValue(null);
    repo.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-1',
      user_id: 'member-1',
      payable_type: PayableType.subscription,
      payable_id: 'sub-1',
      provider_ref: 'cs_1',
      provider: PaymentProvider.paymongo,
      gateway_metadata: {
        checkout_url: 'https://checkout.paymongo.com/cs_1',
      },
      status: 'processing',
      amount: 1499,
    });
    repo.updatePayment.mockResolvedValue({ id: 'payment-1' });

    const result = await service.handleWebhook(
      Buffer.from('{}'),
      't=1700000000,te=signature',
    );

    expect(result).toEqual({ message: 'SUCCESS' });
    expect(repo.updatePayment).toHaveBeenCalledWith(
      'payment-1',
      expect.objectContaining({
        status: 'failed',
        gateway_event_id: 'evt_failed_1',
        rejection_reason: 'card declined',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PAYMENT_FAILED_EVENT,
      expect.objectContaining({
        paymentId: 'payment-1',
        userId: 'member-1',
        payableType: PayableType.subscription,
        payableId: 'sub-1',
        reason: 'card declined',
      }),
    );
  });
});

function createReconciliationContext(
  kind: CommerceCheckoutHoldKind = CommerceCheckoutHoldKind.venue,
) {
  const payment = {
    amount: new Prisma.Decimal('75'),
    created_at: new Date('2026-08-14T02:55:00.000Z'),
    currency: 'PHP',
    gateway_event_id: null,
    gateway_metadata: {
      checkout_url: 'https://checkout.paymongo.com/cs_hold_1',
    },
    id: 'payment-hold-1',
    idempotency_key: 'checkout-idempotency-1',
    payable_id: 'hold-1',
    payable_type: PayableType.commerce_checkout_hold,
    payment_stage: PaymentStage.full,
    provider: PaymentProvider.paymongo,
    provider_ref: 'cs_hold_1',
    rejection_reason: null,
    screenshot_url: null,
    status: PaymentStatus.pending,
    updated_at: new Date('2026-08-14T02:55:00.000Z'),
    user_id: 'member-1',
    verified_at: null,
    verified_by: null,
  };
  return {
    hold: {
      amenity_id: kind === CommerceCheckoutHoldKind.venue ? 'venue-1' : null,
      amount: new Prisma.Decimal('75'),
      appointment_id: null,
      booking_id: null,
      coach_id: null,
      consumed_at: null,
      created_at: new Date('2026-08-14T02:55:00.000Z'),
      currency: 'PHP',
      duration_minutes: 60,
      end_date: null,
      ends_at: new Date('2026-08-14T04:00:00.000Z'),
      expires_at: new Date('2026-08-14T03:10:00.000Z'),
      failure_reason: null,
      id: 'hold-1',
      idempotency_key: 'checkout-idempotency-1',
      kind,
      member_notes: null,
      membership_card_id: null,
      membership_plan_id: null,
      payment_id: payment.id,
      preferred_days: [],
      preferred_time: null,
      recurring_plan_id: null,
      released_at: null,
      scheduled_at: new Date('2026-08-14T03:00:00.000Z'),
      session_count: null,
      start_date: null,
      status: CommerceCheckoutHoldStatus.held,
      subscription_id: null,
      updated_at: new Date('2026-08-14T02:55:00.000Z'),
      user_id: 'member-1',
    },
    payment,
  };
}

function createRetrievedSession(input?: {
  amount?: number;
  currency?: string;
  kind?: CommerceCheckoutHoldKind;
  paymentId?: string;
  payments?: unknown[];
  paymentIntentStatus?: string | null;
  sessionId?: string;
  status?: string;
}) {
  const amount = input?.amount ?? 7500;
  const currency = input?.currency ?? 'PHP';
  return {
    attributes: {
      line_items: [{ amount, currency, quantity: 1 }],
      metadata: {
        coaching_checkout_hold_id: 'hold-1',
        hold_id: 'hold-1',
        kind: input?.kind ?? CommerceCheckoutHoldKind.venue,
        payment_id: input?.paymentId ?? 'payment-hold-1',
      },
      paid_at: 1786676400,
      payments: input?.payments ?? [
        {
          id: 'pay_hold_1',
          type: 'payment',
          attributes: {
            amount,
            currency,
            paid_at: 1786676400,
            status: 'paid',
          },
        },
      ],
      payment_intent:
        input?.paymentIntentStatus === undefined
          ? undefined
          : { attributes: { status: input.paymentIntentStatus } },
      status: input?.status ?? 'paid',
    },
    id: input?.sessionId ?? 'cs_hold_1',
    type: 'checkout_session',
  };
}
