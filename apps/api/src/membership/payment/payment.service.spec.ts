import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PayableType, PaymentStage, UserRole } from '@prisma/client';

import { PaymongoWebhookService } from './paymongo-webhook.service';
import { PAYMENT_FAILED_EVENT } from './events/payment-failed.event';
import { PaymentRepository } from './payment.repository';
import { PaymentService } from './payment.service';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PaymentRepository, useValue: repo },
        { provide: PaymongoWebhookService, useValue: paymongoWebhookService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    jest.clearAllMocks();
  });

  it('creates an awaiting-verification cash payment for a subscription owner', async () => {
    repo.findSubscriptionPaymentContextOrThrow.mockResolvedValue({
      id: 'sub-1',
      user_id: 'member-1',
    });
    repo.createPayment.mockResolvedValue({ id: 'payment-1' });

    await service.submitManualPayment('member-1', UserRole.member, {
      payable_type: PayableType.subscription,
      payable_id: 'sub-1',
      payment_stage: PaymentStage.full,
      amount: 1499,
      screenshot_url: 'https://cdn.fittrack.test/receipt.png',
      reference_no: 'OR-123',
    });

    expect(repo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payable_type: PayableType.subscription,
        payable_id: 'sub-1',
        payment_stage: PaymentStage.full,
        amount: 1499,
        provider_ref: 'OR-123',
        status: 'awaiting_verification',
        screenshot_url: 'https://cdn.fittrack.test/receipt.png',
      }),
    );
  });

  it('lets staff submit a manual payment for another members subscription', async () => {
    repo.findSubscriptionPaymentContextOrThrow.mockResolvedValue({
      id: 'sub-1',
      user_id: 'member-1',
    });
    repo.createPayment.mockResolvedValue({ id: 'payment-1' });

    await service.submitManualPayment('staff-1', UserRole.staff, {
      payable_type: PayableType.subscription,
      payable_id: 'sub-1',
      payment_stage: PaymentStage.full,
      amount: 1499,
      screenshot_url: 'https://cdn.fittrack.test/receipt.png',
      reference_no: 'OR-123',
    });

    expect(repo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payable_type: PayableType.subscription,
        payable_id: 'sub-1',
        payment_stage: PaymentStage.full,
        amount: 1499,
        provider_ref: 'OR-123',
        status: 'awaiting_verification',
        screenshot_url: 'https://cdn.fittrack.test/receipt.png',
      }),
    );
  });

  it('blocks members from submitting manual payments for another users subscription', async () => {
    repo.findSubscriptionPaymentContextOrThrow.mockResolvedValue({
      id: 'sub-1',
      user_id: 'member-1',
    });

    await expect(
      service.submitManualPayment('member-2', UserRole.member, {
        payable_type: PayableType.subscription,
        payable_id: 'sub-1',
        payment_stage: PaymentStage.full,
        amount: 1499,
        screenshot_url: 'https://cdn.fittrack.test/receipt.png',
        reference_no: 'OR-123',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('creates an awaiting-verification cash payment for a booking owner', async () => {
    repo.findBookingPaymentContextOrThrow.mockResolvedValue({
      id: 'booking-1',
      user_id: 'member-1',
    });
    repo.createPayment.mockResolvedValue({ id: 'payment-1' });

    await service.submitManualPayment('member-1', UserRole.member, {
      payable_type: PayableType.booking,
      payable_id: 'booking-1',
      payment_stage: PaymentStage.balance,
      amount: 560,
      screenshot_url: 'https://cdn.fittrack.test/receipt.png',
      reference_no: 'OR-123',
    });

    expect(repo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payable_type: PayableType.booking,
        payable_id: 'booking-1',
        payment_stage: PaymentStage.balance,
        amount: 560,
        provider_ref: 'OR-123',
        status: 'awaiting_verification',
      }),
    );
  });

  it('creates an awaiting-verification cash payment for a coaching appointment owner', async () => {
    repo.findCoachingPaymentContextOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
    });
    repo.createPayment.mockResolvedValue({ id: 'payment-1' });

    await service.submitManualPayment('member-1', UserRole.member, {
      payable_type: PayableType.coaching,
      payable_id: 'appt-1',
      payment_stage: PaymentStage.balance,
      amount: 840,
      screenshot_url: 'https://cdn.fittrack.test/receipt.png',
      reference_no: 'OR-123',
    });

    expect(repo.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payable_type: PayableType.coaching,
        payable_id: 'appt-1',
        payment_stage: PaymentStage.balance,
        amount: 840,
        provider_ref: 'OR-123',
        status: 'awaiting_verification',
      }),
    );
  });

  it('returns any payment to staff without ownership enforcement', async () => {
    repo.findPaymentByIdForStaffOrThrow.mockResolvedValue({ id: 'payment-1' });

    await service.getPaymentById('payment-1', 'staff-1', UserRole.staff);

    expect(repo.findPaymentByIdForStaffOrThrow).toHaveBeenCalledWith(
      'payment-1',
    );
    expect(repo.findPaymentByIdForOwnerOrThrow).not.toHaveBeenCalled();
  });

  it('verifies an awaiting payment and emits audit plus completion events on approval', async () => {
    repo.findPaymentByIdForStaffOrThrow.mockResolvedValue({
      id: 'payment-1',
      user_id: 'member-1',
      payable_type: PayableType.subscription,
      payable_id: 'sub-1',
      status: 'awaiting_verification',
      amount: 1499,
    });
    repo.updatePayment.mockResolvedValue({ id: 'payment-1' });

    await service.verifyPayment('payment-1', { action: 'approve' }, 'admin-1');

    expect(repo.updatePayment).toHaveBeenCalledWith(
      'payment-1',
      expect.objectContaining({
        status: 'completed',
        verifier: { connect: { id: 'admin-1' } },
        rejection_reason: null,
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        action: 'PAYMENT_VERIFIED',
        entityId: 'payment-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'payment.completed',
      expect.objectContaining({
        paymentId: 'payment-1',
        userId: 'member-1',
        payableType: PayableType.subscription,
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'account.activity',
      expect.objectContaining({
        action: 'payment_approved',
        actorId: 'admin-1',
        targetRole: UserRole.member,
        targetUserId: 'member-1',
      }),
    );
  });

  it('emits payment.failed when an awaiting payment is rejected', async () => {
    repo.findPaymentByIdForStaffOrThrow.mockResolvedValue({
      id: 'payment-1',
      user_id: 'member-1',
      payable_type: PayableType.subscription,
      payable_id: 'sub-1',
      status: 'awaiting_verification',
      amount: 1499,
    });
    repo.updatePayment.mockResolvedValue({ id: 'payment-1' });

    await service.verifyPayment(
      'payment-1',
      { action: 'reject', rejection_reason: 'Receipt was unreadable.' },
      'admin-1',
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      PAYMENT_FAILED_EVENT,
      expect.objectContaining({
        paymentId: 'payment-1',
        userId: 'member-1',
        payableType: PayableType.subscription,
        reason: 'Receipt was unreadable.',
      }),
    );
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      'payment.completed',
      expect.anything(),
    );
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
    ).rejects.toThrow(ForbiddenException);
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
});
