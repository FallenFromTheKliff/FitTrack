import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PayableType,
  PaymentStage,
  PaymentStatus,
  PaymentProvider,
} from '@prisma/client';

import { PaymentRepository } from '../../membership/payment/payment.repository';
import { PaymongoCheckoutService } from '../../membership/payment/paymongo-checkout.service';
import {
  PAYMENT_COMPLETED_EVENT,
  PaymentCompletedEvent,
} from '../../membership/payment/events/payment-completed.event';
import { SubscriptionService } from '../../membership/subscription/subscription.service';
import { AmenityRepository } from '../amenity/amenity.repository';
import { BookingRepository } from './booking.repository';
import { BookingService } from './booking.service';
import { BOOKING_CONFIRMED_EVENT } from './events/booking-confirmed.event';

function flushAsyncEvents(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
}

describe('Booking payment integration', () => {
  let moduleRef: TestingModule;
  let eventEmitter: EventEmitter2;

  const bookingRepository = {
    findBookingWithAmenityByIdOrThrow: jest.fn(),
    confirmBookingDownpayment: jest.fn(),
    completeBookingBalance: jest.fn(),
  };

  const paymentRepository = {
    findPaymentByIdOrThrow: jest.fn(),
    findPaymentByIdempotencyKey: jest.fn(),
    findLatestPaymentForPayableStage: jest.fn(),
    updatePayment: jest.fn(),
  };

  const amenityRepository = {
    findActiveAmenityByIdOrThrow: jest.fn(),
  };

  const paymongoCheckoutService = {
    createCheckoutSession: jest.fn(),
  };

  const subscriptionService = {
    hasSubscriptionAccess: jest.fn(),
  };

  const redis = {
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot({ wildcard: false, delimiter: '.' }),
      ],
      providers: [
        BookingService,
        { provide: BookingRepository, useValue: bookingRepository },
        { provide: PaymentRepository, useValue: paymentRepository },
        { provide: AmenityRepository, useValue: amenityRepository },
        {
          provide: PaymongoCheckoutService,
          useValue: paymongoCheckoutService,
        },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    await moduleRef.init();
    eventEmitter = moduleRef.get(EventEmitter2);
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('confirms pending bookings when the shared payment.completed event carries a downpayment', async () => {
    const bookingConfirmedListener = jest.fn();
    eventEmitter.on(BOOKING_CONFIRMED_EVENT, bookingConfirmedListener);

    paymentRepository.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.downpayment,
      status: PaymentStatus.completed,
      provider: PaymentProvider.paymongo,
    });
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      user_id: 'member-1',
      amenity_id: 'amenity-1',
      status: 'pending',
      downpayment_paid_at: null,
      starts_at: new Date('2099-03-24T10:00:00.000Z'),
      ends_at: new Date('2099-03-24T11:00:00.000Z'),
    });
    bookingRepository.confirmBookingDownpayment.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });

    eventEmitter.emit(
      PAYMENT_COMPLETED_EVENT,
      createPaymentCompletedEvent({
        paymentId: 'payment-1',
        payableId: 'booking-1',
        amount: '240',
      }),
    );
    await flushAsyncEvents();

    expect(paymentRepository.findPaymentByIdOrThrow).toHaveBeenCalledWith(
      'payment-1',
    );
    expect(bookingRepository.confirmBookingDownpayment).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Date),
    );
    expect(bookingConfirmedListener).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        userId: 'member-1',
        amenityId: 'amenity-1',
      }),
    );
  });

  it('completes balance_pending bookings when the shared payment.completed event carries a balance payment', async () => {
    paymentRepository.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-2',
      payment_stage: PaymentStage.balance,
      status: PaymentStatus.completed,
      provider: PaymentProvider.cash,
    });
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-2',
      status: 'balance_pending',
      balance_paid_at: null,
    });
    bookingRepository.completeBookingBalance.mockResolvedValue({
      id: 'booking-2',
      status: 'completed',
    });

    eventEmitter.emit(
      PAYMENT_COMPLETED_EVENT,
      createPaymentCompletedEvent({
        paymentId: 'payment-2',
        payableId: 'booking-2',
        amount: '560',
      }),
    );
    await flushAsyncEvents();

    expect(paymentRepository.findPaymentByIdOrThrow).toHaveBeenCalledWith(
      'payment-2',
    );
    expect(bookingRepository.completeBookingBalance).toHaveBeenCalledWith(
      'booking-2',
      expect.any(Date),
    );
  });
});

function createPaymentCompletedEvent(
  overrides: Partial<PaymentCompletedEvent> = {},
): PaymentCompletedEvent {
  return {
    paymentId: 'payment-1',
    userId: 'member-1',
    payableType: PayableType.booking,
    payableId: 'booking-1',
    amount: '240',
    ...overrides,
  };
}
