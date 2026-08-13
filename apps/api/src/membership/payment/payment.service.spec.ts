import { GoneException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  UserRole,
} from '@prisma/client';

import { PaymongoWebhookService } from './paymongo-webhook.service';
import { PAYMENT_FAILED_EVENT } from './events/payment-failed.event';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';
import { CoachingCommerceService } from '../../coaching/commerce/coaching-commerce.service';

describe('PaymentService', () => {
  let service: PaymentService;

  const repo = {
    getMyPayments: jest.fn(),
    findPaymentByIdForOwnerOrThrow: jest.fn(),
    findPaymentByIdForStaffOrThrow: jest.fn(),
    getAllPayments: jest.fn(),
    createPayment: jest.fn(),
    findPaymentByIdOrThrow: jest.fn(),
    findPaymentByGatewayEventId: jest.fn(),
    findPaymentByProviderRefOrThrow: jest.fn(),
    updatePayment: jest.fn(),
    completePaymongoMembershipCardPayment: jest.fn(),
    failPaymongoMembershipCardPayment: jest.fn(),
    completePaymongoCommerceCheckout: jest.fn(),
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
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();
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
