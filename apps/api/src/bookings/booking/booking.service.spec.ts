import {
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction } from '../../audit/audit.service';
import { CoachService } from '../../coaching/coach/coach.service';

import { PaymentRepository } from '../../membership/payment/payment.repository';
import { PaymongoCheckoutService } from '../../membership/payment/paymongo-checkout.service';
import { SubscriptionService } from '../../membership/subscription/subscription.service';
import { AmenityRepository } from '../amenity/amenity.repository';
import { BookingRepository } from './booking.repository';
import { BookingService } from './booking.service';
import { BOOKING_CANCELLED_EVENT } from './events/booking-cancelled.event';
import { BOOKING_CONFIRMED_EVENT } from './events/booking-confirmed.event';

function findSlot(
  slots: Awaited<ReturnType<BookingService['getAvailability']>>,
  startsAt: string,
) {
  return slots.find((slot) => slot.starts_at === startsAt);
}

describe('BookingService', () => {
  const bookingRepository = {
    listActiveOverlappingBookings: jest.fn(),
    createConfirmedFreeBooking: jest.fn(),
    createPendingBookingWithPayment: jest.fn(),
    findBookingWithAmenityByIdOrThrow: jest.fn(),
    findBookingByIdAndAssertOwnership: jest.fn(),
    getMyBookings: jest.fn(),
    getAllBookings: jest.fn(),
    cancelBooking: jest.fn(),
    confirmBookingDownpayment: jest.fn(),
    confirmBookingFullPayment: jest.fn(),
    createBalancePendingPayment: jest.fn(),
    completeBookingBalance: jest.fn(),
  };

  const amenityRepository = {
    findActiveAmenityByIdOrThrow: jest.fn(),
  };

  const paymentRepository = {
    findPaymentByIdempotencyKey: jest.fn(),
    findLatestPaymentForPayableStage: jest.fn(),
    findPaymentByIdOrThrow: jest.fn(),
    updatePayment: jest.fn(),
  };

  const paymongoCheckoutService = {
    createCheckoutSession: jest.fn(),
  };

  const subscriptionService = {
    hasSubscriptionAccess: jest.fn(),
  };

  const coachService = {
    assertCoachReservableForBookingWindow: jest.fn(),
  };

  const redis = {
    set: jest.fn(),
    del: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  let service: BookingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: BookingRepository, useValue: bookingRepository },
        { provide: AmenityRepository, useValue: amenityRepository },
        { provide: PaymentRepository, useValue: paymentRepository },
        {
          provide: PaymongoCheckoutService,
          useValue: paymongoCheckoutService,
        },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: CoachService, useValue: coachService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    jest.clearAllMocks();
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
  });

  it('validates optional coach add-ons and stores the linked coach on free bookings', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('0'),
      requires_subscription: false,
    });
    coachService.assertCoachReservableForBookingWindow.mockResolvedValue(
      undefined,
    );
    bookingRepository.createConfirmedFreeBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });

    const result = await service.createBooking(
      'member-1',
      {
        amenity_id: 'amenity-1',
        coach_id: '7e9f96f7-8efe-5598-a978-5cd6ecf73a06',
        starts_at: '2099-03-24T10:00:00.000Z',
        ends_at: '2099-03-24T11:00:00.000Z',
        provider: PaymentProvider.paymongo,
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(
      coachService.assertCoachReservableForBookingWindow,
    ).toHaveBeenCalledWith(
      '7e9f96f7-8efe-5598-a978-5cd6ecf73a06',
      new Date('2099-03-24T10:00:00.000Z'),
      new Date('2099-03-24T11:00:00.000Z'),
    );
    expect(bookingRepository.createConfirmedFreeBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        coachId: '7e9f96f7-8efe-5598-a978-5cd6ecf73a06',
      }),
    );
    expect(result).toEqual({
      booking_id: 'booking-1',
      status: 'confirmed',
      checkout_url: null,
    });
  });

  it('marks slots unavailable when active bookings reach amenity capacity', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      capacity: 1,
    });
    bookingRepository.listActiveOverlappingBookings.mockResolvedValue([
      {
        starts_at: new Date('2026-03-24T10:00:00.000Z'),
        ends_at: new Date('2026-03-24T11:00:00.000Z'),
      },
    ]);

    const slots = await service.getAvailability({
      amenity_id: 'amenity-1',
      date: '2026-03-24',
    });

    expect(findSlot(slots, '2026-03-24T09:30:00.000Z')).toMatchObject({
      available: true,
    });
    expect(findSlot(slots, '2026-03-24T10:00:00.000Z')).toMatchObject({
      available: false,
    });
    expect(findSlot(slots, '2026-03-24T10:30:00.000Z')).toMatchObject({
      available: false,
    });
    expect(findSlot(slots, '2026-03-24T11:00:00.000Z')).toMatchObject({
      available: true,
    });
  });

  it('keeps partially booked slots available when capacity remains', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      capacity: 2,
    });
    bookingRepository.listActiveOverlappingBookings.mockResolvedValue([
      {
        starts_at: new Date('2026-03-24T10:00:00.000Z'),
        ends_at: new Date('2026-03-24T11:00:00.000Z'),
      },
    ]);

    const slots = await service.getAvailability({
      amenity_id: 'amenity-1',
      date: '2026-03-24',
    });

    expect(findSlot(slots, '2026-03-24T10:00:00.000Z')).toMatchObject({
      available: true,
    });
    expect(findSlot(slots, '2026-03-24T10:30:00.000Z')).toMatchObject({
      available: true,
    });
  });

  it('surfaces inactive or missing amenity errors from the active amenity lookup', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockRejectedValue(
      new NotFoundException(),
    );

    await expect(
      service.getAvailability({
        amenity_id: 'amenity-1',
        date: '2026-03-24',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('denies subscription-required amenities to members without access', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: true,
    });
    subscriptionService.hasSubscriptionAccess.mockResolvedValue(false);

    await expect(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2099-03-24T10:00:00.000Z',
          ends_at: '2099-03-24T11:00:00.000Z',
          provider: PaymentProvider.paymongo,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('loads member booking history through the repository', async () => {
    bookingRepository.getMyBookings.mockResolvedValue({
      data: [{ id: 'booking-1' }],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    const result = await service.getMyBookings('member-1', {
      page: 1,
      limit: 20,
    });

    expect(bookingRepository.getMyBookings).toHaveBeenCalledWith('member-1', {
      page: 1,
      limit: 20,
    });
    expect(result.meta.total).toBe(1);
  });

  it('loads all bookings through the repository', async () => {
    bookingRepository.getAllBookings.mockResolvedValue({
      data: [{ id: 'booking-1' }],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    const result = await service.getAllBookings({ page: 1, limit: 20 });

    expect(bookingRepository.getAllBookings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
    expect(result.meta.total).toBe(1);
  });

  it('confirms pending bookings for admin and staff schedule flows', async () => {
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

    const result = await service.confirmPendingBooking('booking-1', 'staff-1');

    expect(bookingRepository.confirmBookingDownpayment).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Date),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      BOOKING_CONFIRMED_EVENT,
      expect.objectContaining({
        bookingId: 'booking-1',
        userId: 'member-1',
        amenityId: 'amenity-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'staff-1',
        action: AuditAction.BOOKING_CONFIRMED,
        entityId: 'booking-1',
      }),
    );
    expect(result).toEqual({
      booking: { id: 'booking-1', status: 'confirmed' },
      message: 'Booking confirmed successfully',
    });
  });

  it('rejects pending bookings for admin and staff schedule flows', async () => {
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      user_id: 'member-1',
      amenity_id: 'amenity-1',
      status: 'pending',
      cancelled_at: null,
    });
    bookingRepository.cancelBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'cancelled',
    });

    const result = await service.rejectPendingBooking(
      'booking-1',
      'admin-1',
      'Duplicate request',
    );

    expect(bookingRepository.cancelBooking).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Date),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'admin-1',
        action: AuditAction.BOOKING_CANCELLED,
        entityId: 'booking-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      BOOKING_CANCELLED_EVENT,
      expect.objectContaining({
        bookingId: 'booking-1',
        userId: 'member-1',
        amenityId: 'amenity-1',
      }),
    );
    expect(result).toEqual({
      booking: { id: 'booking-1', status: 'cancelled' },
      message: 'Booking rejected successfully',
    });
  });

  it('releases acquired slot locks when another reservation is already in progress', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: false,
    });
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);

    await expect(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2099-03-24T10:00:00.000Z',
          ends_at: '2099-03-24T11:00:00.000Z',
          provider: PaymentProvider.paymongo,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(redis.del).toHaveBeenCalledWith(
      'booking_lock:amenity-1:20990324-1000',
    );
  });

  it('releases slot locks when the repository reports a DB overlap conflict', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: false,
    });
    bookingRepository.createPendingBookingWithPayment.mockRejectedValue(
      new ConflictException('duplicate'),
    );

    await expect(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2099-03-24T10:00:00.000Z',
          ends_at: '2099-03-24T11:00:00.000Z',
          provider: PaymentProvider.paymongo,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(redis.del).toHaveBeenCalledTimes(2);
  });

  it('confirms zero-cost bookings immediately without creating a payment', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Community Ring',
      hourly_rate: new Prisma.Decimal('0'),
      requires_subscription: false,
    });
    bookingRepository.createConfirmedFreeBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });

    const result = await service.createBooking(
      'member-1',
      {
        amenity_id: 'amenity-1',
        starts_at: '2099-03-24T10:00:00.000Z',
        ends_at: '2099-03-24T11:00:00.000Z',
        provider: PaymentProvider.cash,
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(bookingRepository.createConfirmedFreeBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'member-1',
        totalAmount: new Prisma.Decimal('0'),
        downpaymentAmount: new Prisma.Decimal('0'),
        balanceAmount: new Prisma.Decimal('0'),
      }),
    );
    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).not.toHaveBeenCalled();
    expect(result).toEqual({
      booking_id: 'booking-1',
      status: 'confirmed',
      checkout_url: null,
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      BOOKING_CONFIRMED_EVENT,
      expect.objectContaining({
        bookingId: 'booking-1',
        userId: 'member-1',
        amenityId: 'amenity-1',
      }),
    );
  });

  it('creates a PayMongo checkout for paid bookings and stores checkout metadata', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: false,
    });
    bookingRepository.createPendingBookingWithPayment.mockResolvedValue({
      booking: { id: 'booking-1', status: 'pending' },
      payment: {
        id: 'payment-1',
        payment_stage: PaymentStage.downpayment,
        idempotency_key: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        amount: new Prisma.Decimal('240'),
      },
    });
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      providerRef: 'cs_test_123',
      checkoutUrl: 'https://checkout.paymongo.com/cs_test_123',
      gatewayMetadata: {
        checkout_url: 'https://checkout.paymongo.com/cs_test_123',
      },
    });

    const result = await service.createBooking(
      'member-1',
      {
        amenity_id: 'amenity-1',
        starts_at: '2099-03-24T10:00:00.000Z',
        ends_at: '2099-03-24T11:00:00.000Z',
        provider: PaymentProvider.paymongo,
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        downpaymentAmount: new Prisma.Decimal('240.00'),
        balanceAmount: new Prisma.Decimal('560.00'),
        paymentAmount: new Prisma.Decimal('240.00'),
        paymentStage: PaymentStage.downpayment,
        paymentStatus: PaymentStatus.pending,
        totalAmount: new Prisma.Decimal('800.00'),
      }),
    );
    expect(paymongoCheckoutService.createCheckoutSession).toHaveBeenCalledWith({
      amount: 24000,
      description: 'Main Court booking downpayment',
      idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      metadata: {
        payment_id: 'payment-1',
        booking_id: 'booking-1',
      },
    });
    expect(paymentRepository.updatePayment).toHaveBeenCalledWith(
      'payment-1',
      expect.objectContaining({
        status: PaymentStatus.processing,
        provider_ref: 'cs_test_123',
      }),
    );
    expect(result).toEqual({
      booking_id: 'booking-1',
      status: 'pending',
      checkout_url: 'https://checkout.paymongo.com/cs_test_123',
    });
  });

  it('creates an awaiting-verification cash payment for split booking initiation', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: false,
    });
    bookingRepository.createPendingBookingWithPayment.mockResolvedValue({
      booking: { id: 'booking-1', status: 'pending' },
      payment: {
        id: 'payment-1',
        payment_stage: PaymentStage.downpayment,
        amount: new Prisma.Decimal('240'),
      },
    });

    const result = await service.createBooking(
      'member-1',
      {
        amenity_id: 'amenity-1',
        starts_at: '2099-03-24T10:00:00.000Z',
        ends_at: '2099-03-24T11:00:00.000Z',
        provider: PaymentProvider.cash,
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentAmount: new Prisma.Decimal('240.00'),
        paymentStage: PaymentStage.downpayment,
        paymentStatus: PaymentStatus.awaiting_verification,
        provider: PaymentProvider.cash,
      }),
    );
    expect(paymongoCheckoutService.createCheckoutSession).not.toHaveBeenCalled();
    expect(result).toEqual({
      booking_id: 'booking-1',
      status: 'pending',
      checkout_url: null,
    });
  });

  it('returns the existing booking checkout when the same idempotency key is retried', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.downpayment,
      user_id: 'member-1',
      payable_type: 'booking',
      payable_id: 'booking-1',
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.processing,
      idempotency_key: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      gateway_metadata: {
        checkout_url: 'https://checkout.paymongo.com/cs_test_123',
      } as Prisma.JsonObject,
    });
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      user_id: 'member-1',
      status: 'pending',
      amenity: { name: 'Main Court' },
    });

    const result = await service.createBooking(
      'member-1',
      {
        amenity_id: 'amenity-1',
        starts_at: '2099-03-24T10:00:00.000Z',
        ends_at: '2099-03-24T11:00:00.000Z',
        provider: PaymentProvider.paymongo,
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(result).toEqual({
      booking_id: 'booking-1',
      status: 'pending',
      checkout_url: 'https://checkout.paymongo.com/cs_test_123',
    });
    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).not.toHaveBeenCalled();
  });

  it('returns the existing cash booking request when the same idempotency key is retried', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.full,
      user_id: 'member-1',
      payable_type: 'booking',
      payable_id: 'booking-1',
      provider: PaymentProvider.cash,
      status: PaymentStatus.awaiting_verification,
      idempotency_key: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      gateway_metadata: null,
    });
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      user_id: 'member-1',
      status: 'pending',
      amenity: { name: 'Main Court' },
    });

    const result = await service.createBooking(
      'member-1',
      {
        amenity_id: 'amenity-1',
        starts_at: '2099-03-24T10:00:00.000Z',
        ends_at: '2099-03-24T11:00:00.000Z',
        provider: PaymentProvider.cash,
        payment_stage: 'full',
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(result).toEqual({
      booking_id: 'booking-1',
      status: 'pending',
      checkout_url: null,
    });
  });

  it('requires a valid idempotency key when creating a booking', async () => {
    await expect(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2099-03-24T10:00:00.000Z',
          ends_at: '2099-03-24T11:00:00.000Z',
          provider: PaymentProvider.paymongo,
        },
        'not-a-uuid',
      ),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('confirms pending booking downpayments on shared payment completion', async () => {
    paymentRepository.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.downpayment,
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

    await service.handlePaymentCompleted({
      paymentId: 'payment-1',
      userId: 'member-1',
      payableType: 'booking',
      payableId: 'booking-1',
      amount: '240',
    });

    expect(bookingRepository.confirmBookingDownpayment).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Date),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      BOOKING_CONFIRMED_EVENT,
      expect.objectContaining({
        bookingId: 'booking-1',
        userId: 'member-1',
        amenityId: 'amenity-1',
      }),
    );
  });

  it('confirms full-payment bookings by stamping both payment timestamps', async () => {
    paymentRepository.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.full,
    });
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      user_id: 'member-1',
      amenity_id: 'amenity-1',
      status: 'pending',
      downpayment_paid_at: null,
      balance_paid_at: null,
      starts_at: new Date('2099-03-24T10:00:00.000Z'),
      ends_at: new Date('2099-03-24T11:00:00.000Z'),
    });
    bookingRepository.confirmBookingFullPayment.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });

    await service.handlePaymentCompleted({
      paymentId: 'payment-1',
      userId: 'member-1',
      payableType: 'booking',
      payableId: 'booking-1',
      amount: '800',
    });

    expect(bookingRepository.confirmBookingFullPayment).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Date),
    );
  });

  it('rejects balance collection before the booking start time', async () => {
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      user_id: 'member-1',
      status: 'confirmed',
      starts_at: new Date('2099-03-24T10:00:00.000Z'),
      balance_amount: new Prisma.Decimal('560.00'),
      amenity: { name: 'Main Court' },
    });

    await expect(
      service.processBalance('booking-1', {
        provider: PaymentProvider.paymongo,
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('creates a PayMongo balance checkout for eligible bookings', async () => {
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      user_id: 'member-1',
      status: 'confirmed',
      starts_at: new Date('2000-03-24T10:00:00.000Z'),
      balance_amount: new Prisma.Decimal('560.00'),
      amenity: { name: 'Main Court' },
    });
    paymentRepository.findLatestPaymentForPayableStage.mockResolvedValue(null);
    bookingRepository.createBalancePendingPayment.mockResolvedValue({
      booking: { id: 'booking-1', status: 'balance_pending' },
      payment: {
        id: 'payment-1',
        payment_stage: PaymentStage.balance,
        idempotency_key: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        amount: new Prisma.Decimal('560.00'),
      },
    });
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      providerRef: 'cs_test_balance_123',
      checkoutUrl: 'https://checkout.paymongo.com/cs_test_balance_123',
      gatewayMetadata: {
        checkout_url: 'https://checkout.paymongo.com/cs_test_balance_123',
      },
    });

    const result = await service.processBalance('booking-1', {
      provider: PaymentProvider.paymongo,
    });

    expect(
      paymentRepository.findLatestPaymentForPayableStage,
    ).toHaveBeenCalledWith(
      PayableType.booking,
      'booking-1',
      PaymentStage.balance,
    );
    expect(bookingRepository.createBalancePendingPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        bookingId: 'booking-1',
        provider: PaymentProvider.paymongo,
        amount: new Prisma.Decimal('560.00'),
      }),
    );
    const checkoutCalls = paymongoCheckoutService.createCheckoutSession.mock
      .calls as Array<
      [
        {
          amount: number;
          description: string;
          idempotencyKey: string;
          metadata: Record<string, string>;
        },
      ]
    >;
    const checkoutArgs = checkoutCalls[0]?.[0];

    expect(checkoutArgs).toMatchObject({
      amount: 56000,
      description: 'Main Court booking balance',
      metadata: {
        payment_id: 'payment-1',
        booking_id: 'booking-1',
      },
    });
    expect(checkoutArgs.idempotencyKey).toEqual(expect.any(String));
    expect(result).toEqual({
      booking_id: 'booking-1',
      status: 'balance_pending',
      checkout_url: 'https://checkout.paymongo.com/cs_test_balance_123',
    });
  });

  it('reuses an existing cash balance attempt without creating another payment', async () => {
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      user_id: 'member-1',
      status: 'balance_pending',
      starts_at: new Date('2000-03-24T10:00:00.000Z'),
      balance_amount: new Prisma.Decimal('560.00'),
      amenity: { name: 'Main Court' },
    });
    paymentRepository.findLatestPaymentForPayableStage.mockResolvedValue({
      id: 'payment-1',
      provider: PaymentProvider.cash,
      status: PaymentStatus.awaiting_verification,
      gateway_metadata: null,
    });

    const result = await service.processBalance('booking-1', {
      provider: PaymentProvider.cash,
      screenshot_url: 'https://cdn.fittrack.test/receipt.png',
      reference_no: 'OR-123',
    });

    expect(
      bookingRepository.createBalancePendingPayment,
    ).not.toHaveBeenCalled();
    expect(result).toEqual({
      booking_id: 'booking-1',
      status: 'balance_pending',
      checkout_url: null,
    });
  });

  it('completes balance_pending bookings on shared balance payment completion', async () => {
    paymentRepository.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.balance,
    });
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      status: 'balance_pending',
      balance_paid_at: null,
    });
    bookingRepository.completeBookingBalance.mockResolvedValue({
      id: 'booking-1',
      status: 'completed',
    });

    await service.handlePaymentCompleted({
      paymentId: 'payment-1',
      userId: 'member-1',
      payableType: PayableType.booking,
      payableId: 'booking-1',
      amount: '560',
    });

    expect(bookingRepository.completeBookingBalance).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Date),
    );
  });

  it('rejects cancellation when a booking is not in a cancellable state', async () => {
    bookingRepository.findBookingByIdAndAssertOwnership.mockResolvedValue({
      id: 'booking-1',
      amenity_id: 'amenity-1',
      status: 'balance_pending',
      cancelled_at: null,
    });

    await expect(
      service.cancelBooking('booking-1', 'member-1'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('cancels a booking and emits audit plus booking cancellation events', async () => {
    bookingRepository.findBookingByIdAndAssertOwnership.mockResolvedValue({
      id: 'booking-1',
      amenity_id: 'amenity-1',
      status: 'confirmed',
      cancelled_at: null,
    });
    bookingRepository.cancelBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'cancelled',
    });

    await service.cancelBooking('booking-1', 'member-1');

    expect(bookingRepository.cancelBooking).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Date),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'member-1',
        action: AuditAction.BOOKING_CANCELLED,
        entityId: 'booking-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      BOOKING_CANCELLED_EVENT,
      expect.objectContaining({
        bookingId: 'booking-1',
        userId: 'member-1',
        amenityId: 'amenity-1',
      }),
    );
  });
});
