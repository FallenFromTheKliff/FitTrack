import {
  ConflictException,
  ForbiddenException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BookingStatus,
  EquipmentStatus,
  PayableType,
  PaymentProvider,
  PaymentStage,
  Prisma,
  UserRole,
} from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuditAction } from '../../audit/audit.service';
import { CoachService } from '../../coaching/coach/coach.service';

import { PaymentRepository } from '../../membership/payment/payment.repository';
import { PaymongoCheckoutService } from '../../membership/payment/paymongo-checkout.service';
import { MembershipCardService } from '../../membership/card/card.service';
import { SubscriptionService } from '../../membership/subscription/subscription.service';
import { AmenityRepository } from '../amenity/amenity.repository';
import { BookingRepository } from './booking.repository';
import { BookingService } from './booking.service';
import { BOOKING_CANCELLED_EVENT } from './events/booking-cancelled.event';
import { BOOKING_CONFIRMED_EVENT } from './events/booking-confirmed.event';
import { CoachingCommerceService } from '../../coaching/commerce/coaching-commerce.service';

function findSlot(
  slots: Awaited<ReturnType<BookingService['getAvailability']>>,
  startsAt: string,
) {
  return slots.find((slot) => slot.starts_at === startsAt);
}

async function expectHttpDetail(
  request: Promise<unknown>,
  expected: string,
): Promise<void> {
  try {
    await request;
    throw new Error('Expected the request to reject.');
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    const response = error.getResponse() as { detail?: string };
    expect(response.detail).toContain(expected);
  }
}

describe('BookingService', () => {
  const bookingRepository = {
    listActiveOverlappingBookings: jest.fn(),
    createConfirmedFreeBooking: jest.fn(),
    createConfirmedManualBooking: jest.fn(),
    createPendingBookingWithPayment: jest.fn(),
    findBookingWithAmenityByIdOrThrow: jest.fn(),
    findBookingByIdAndAssertOwnership: jest.fn(),
    getMyBookings: jest.fn(),
    getAllBookings: jest.fn(),
    getCoachVenueWork: jest.fn(),
    isFullyPaidCoachVenueWork: jest.fn(),
    cancelBooking: jest.fn(),
    confirmBookingDownpayment: jest.fn(),
    confirmBookingFullPayment: jest.fn(),
    createBalancePendingPayment: jest.fn(),
    completeBookingBalance: jest.fn(),
    markBookingCompleted: jest.fn(),
    markConfirmedBookingNoShow: jest.fn(),
    rescheduleBookingForMaintenance: jest.fn(),
    cancelBookingForMaintenance: jest.fn(),
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

  const commerceCheckoutService = {
    createVenueCheckout: jest.fn(),
  };

  const membershipCardService = {
    hasActiveMembershipCardAccess: jest.fn(),
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
        { provide: MembershipCardService, useValue: membershipCardService },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: CoachingCommerceService, useValue: commerceCheckoutService },
        { provide: CoachService, useValue: coachService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get<BookingService>(BookingService);
    jest.clearAllMocks();
    redis.set.mockResolvedValue('OK');
    redis.del.mockResolvedValue(1);
    membershipCardService.hasActiveMembershipCardAccess.mockResolvedValue(
      false,
    );
    commerceCheckoutService.createVenueCheckout.mockResolvedValue({
      hold_id: 'hold-venue-1',
      kind: 'venue',
      status: 'held',
      checkout_url: 'https://checkout.paymongo.com/venue-1',
      expires_at: '2099-04-01T00:00:00.000Z',
      payment_id: 'payment-venue-1',
    });
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

  it('rejects booking windows that cross the gym calendar day', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);

    try {
      await service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2099-03-24T15:30:00.000Z',
          ends_at: '2099-03-24T16:30:00.000Z',
          provider: PaymentProvider.paymongo,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      );
      throw new Error('Expected booking window validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({
        detail: 'Bookings must start and end on the same gym calendar day.',
      });
    }

    expect(
      amenityRepository.findActiveAmenityByIdOrThrow,
    ).not.toHaveBeenCalled();
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

    expect(findSlot(slots, '2026-03-24T09:00:00.000Z')).toMatchObject({
      available: true,
    });
    expect(findSlot(slots, '2026-03-24T10:00:00.000Z')).toMatchObject({
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
    expect(findSlot(slots, '2026-03-24T11:00:00.000Z')).toMatchObject({
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

  it('denies member-required amenities to members without access', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: true,
    });
    subscriptionService.hasSubscriptionAccess.mockResolvedValue(false);
    membershipCardService.hasActiveMembershipCardAccess.mockResolvedValue(
      false,
    );

    await expect(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2099-03-24T10:00:00.000Z',
          ends_at: '2099-03-24T12:00:00.000Z',
          provider: PaymentProvider.paymongo,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows member-required amenities when the member has an active membership card', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: true,
    });
    subscriptionService.hasSubscriptionAccess.mockResolvedValue(false);
    membershipCardService.hasActiveMembershipCardAccess.mockResolvedValue(true);
    commerceCheckoutService.createVenueCheckout.mockResolvedValue({
      hold_id: 'hold-membership-1',
      kind: 'venue',
      status: 'held',
      checkout_url: 'https://checkout.paymongo.com/membership-1',
      expires_at: '2099-04-01T00:00:00.000Z',
      payment_id: 'payment-membership-1',
    });

    const result = await service.createBooking(
      'member-1',
      {
        amenity_id: 'amenity-1',
        starts_at: '2099-03-24T10:00:00.000Z',
        ends_at: '2099-03-24T11:00:00.000Z',
        provider: PaymentProvider.paymongo,
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b1',
    );

    expect(result).toMatchObject({
      hold_id: 'hold-membership-1',
      payment_id: 'payment-membership-1',
      status: 'held',
    });
    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).not.toHaveBeenCalled();
    expect(
      membershipCardService.hasActiveMembershipCardAccess,
    ).toHaveBeenCalledWith('member-1');
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

  it('retires pending booking confirmation and downpayments with HTTP 410', async () => {
    await expect(
      service.confirmPendingBooking('booking-1', 'staff-1'),
    ).rejects.toMatchObject({ status: 410 });
    expect(bookingRepository.confirmBookingDownpayment).not.toHaveBeenCalled();
    expect(paymentRepository.updatePayment).not.toHaveBeenCalled();
  });

  it('reschedules a maintenance booking through the atomic repository path and emits a customer update', async () => {
    const startsAt = new Date();
    startsAt.setUTCDate(startsAt.getUTCDate() + 7);
    startsAt.setUTCHours(1, 0, 0, 0);
    const endsAt = new Date(startsAt.getTime() + 60 * 60 * 1000);
    bookingRepository.rescheduleBookingForMaintenance.mockResolvedValue({
      booking: {
        amenity_id: 'amenity-2',
        id: 'booking-1',
        starts_at: startsAt,
        user_id: 'member-1',
      },
      previousAmenityId: 'amenity-1',
      previousEndsAt: new Date('2099-03-23T11:00:00.000Z'),
      previousStartsAt: new Date('2099-03-23T10:00:00.000Z'),
    });

    await service.rescheduleBookingForMaintenance('booking-1', 'staff-1', {
      amenity_id: 'amenity-2',
      ends_at: endsAt.toISOString(),
      note: 'Court maintenance.',
      starts_at: startsAt.toISOString(),
    });

    expect(
      bookingRepository.rescheduleBookingForMaintenance,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'staff-1',
        amenityId: 'amenity-2',
        bookingId: 'booking-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'booking.rescheduled',
      expect.objectContaining({ bookingId: 'booking-1', userId: 'member-1' }),
    );
  });

  it('records venue-maintenance cancellation without the customer cancellation window', async () => {
    bookingRepository.cancelBookingForMaintenance.mockResolvedValue({
      amenity_id: 'amenity-1',
      id: 'booking-1',
      status: BookingStatus.cancelled,
      user_id: 'member-1',
    });

    await service.cancelBookingForMaintenance(
      'booking-1',
      'staff-1',
      'No replacement available.',
    );

    expect(bookingRepository.cancelBookingForMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 'staff-1',
        bookingId: 'booking-1',
        note: 'No replacement available.',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      BOOKING_CANCELLED_EVENT,
      expect.objectContaining({ bookingId: 'booking-1', userId: 'member-1' }),
    );
  });

  it('rejects availability and member checkout for a venue under maintenance', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'maintenance-venue',
      capacity: 1,
      hourly_rate: new Prisma.Decimal('800'),
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      requires_subscription: false,
      status: EquipmentStatus.maintenance,
    });

    await expectHttpDetail(
      service.getAvailability({
        amenity_id: 'maintenance-venue',
        date: '2026-09-24',
      }),
      'under maintenance',
    );

    await expectHttpDetail(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'maintenance-venue',
          starts_at: '2026-09-24T10:00:00.000Z',
          ends_at: '2026-09-24T11:00:00.000Z',
          provider: PaymentProvider.paymongo,
        },
        '2d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
      'under maintenance',
    );
    expect(commerceCheckoutService.createVenueCheckout).not.toHaveBeenCalled();
  });

  it('rejects a staff full-cash request for a venue under maintenance', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'maintenance-venue',
      capacity: 1,
      hourly_rate: new Prisma.Decimal('800'),
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      requires_subscription: false,
      status: EquipmentStatus.maintenance,
    });

    await expectHttpDetail(
      service.createStaffManualBooking(
        'member-1',
        {
          amenity_id: 'maintenance-venue',
          member_id: 'member-1',
          starts_at: '2026-09-24T10:00:00.000Z',
          ends_at: '2026-09-24T11:00:00.000Z',
          payment_stage: 'full' as never,
        },
        'staff-1',
        '3d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
      'under maintenance',
    );
    expect(
      bookingRepository.createConfirmedManualBooking,
    ).not.toHaveBeenCalled();
  });

  it('retires pending booking rejection with HTTP 410', async () => {
    await expect(
      service.rejectPendingBooking('booking-1', 'admin-1', 'Duplicate request'),
    ).rejects.toMatchObject({
      response: {
        status: 410,
        title: 'Pending Booking Rejection Retired',
      },
    });
    expect(bookingRepository.cancelBooking).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
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
          ends_at: '2099-03-24T12:00:00.000Z',
          provider: PaymentProvider.paymongo,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(redis.del).toHaveBeenCalledWith(
      'booking_lock:amenity-1:20990324-1000',
    );
  });

  it('releases slot locks when the commerce hold reports a DB overlap conflict', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: false,
    });
    commerceCheckoutService.createVenueCheckout.mockRejectedValue(
      new ConflictException('duplicate'),
    );

    await expect(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2099-03-24T10:00:00.000Z',
          ends_at: '2099-03-24T12:00:00.000Z',
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
        provider: PaymentProvider.paymongo,
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

  it('creates a full-payment venue checkout hold for paid bookings', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: false,
    });
    coachService.assertCoachReservableForBookingWindow.mockResolvedValue({
      hourly_rate: new Prisma.Decimal('0'),
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

    expect(commerceCheckoutService.createVenueCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amenityId: 'amenity-1',
        amount: new Prisma.Decimal('800.00'),
        coachId: '7e9f96f7-8efe-5598-a978-5cd6ecf73a06',
        idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        userId: 'member-1',
      }),
    );
    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).not.toHaveBeenCalled();
    expect(
      paymongoCheckoutService.createCheckoutSession,
    ).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      hold_id: 'hold-venue-1',
      kind: 'venue',
      checkout_url: 'https://checkout.paymongo.com/venue-1',
    });
  });

  it('rejects staff manual venue downpayments', async () => {
    await expectHttpDetail(
      service.createStaffManualBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          member_id: 'member-1',
          starts_at: '2099-03-24T10:00:00.000Z',
          ends_at: '2099-03-24T11:00:00.000Z',
          payment_stage: 'downpayment' as never,
        },
        'staff-1',
        '6d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
      'full cash payment',
    );
    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).not.toHaveBeenCalled();
  });

  it('requires member self-service bookings to use the full venue checkout hold', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      is_active: true,
      is_mapped: true,
      is_reservable: true,
      status: 'available',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: false,
    });
    commerceCheckoutService.createVenueCheckout.mockResolvedValue({
      hold_id: 'hold-member-1',
      kind: 'venue',
      status: 'held',
      checkout_url: 'https://checkout.paymongo.com/member-1',
      expires_at: '2099-04-01T00:00:00.000Z',
      payment_id: 'payment-member-1',
    });

    const result = await service.createBooking(
      'member-1',
      {
        amenity_id: 'amenity-1',
        starts_at: '2026-09-24T10:00:00.000Z',
        ends_at: '2026-09-24T11:00:00.000Z',
        payment_stage: 'full',
        provider: PaymentProvider.paymongo,
      },
      '8d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      UserRole.member,
    );

    expect(commerceCheckoutService.createVenueCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: new Prisma.Decimal('800.00'),
        idempotencyKey: '8d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        userId: 'member-1',
      }),
    );
    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).not.toHaveBeenCalled();
    expect(result.checkout_url).toBe('https://checkout.paymongo.com/member-1');
  });

  it('rejects member cash and downpayment booking attempts before creating a booking', async () => {
    await expect(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2026-09-24T10:00:00.000Z',
          ends_at: '2026-09-24T11:00:00.000Z',
          provider: PaymentProvider.cash,
        },
        '9d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        UserRole.member,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expectHttpDetail(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2026-09-24T10:00:00.000Z',
          ends_at: '2026-09-24T11:00:00.000Z',
          payment_stage: 'downpayment',
          provider: PaymentProvider.paymongo,
        },
        'ad36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        UserRole.member,
      ),
      'full payment',
    );
    expect(
      amenityRepository.findActiveAmenityByIdOrThrow,
    ).not.toHaveBeenCalled();
  });

  it('keeps admin and staff self-service bookings on the same full PayMongo contract', async () => {
    for (const role of [UserRole.admin, UserRole.staff]) {
      await expect(
        service.createBooking(
          'member-1',
          {
            amenity_id: 'amenity-1',
            starts_at: '2026-09-24T10:00:00.000Z',
            ends_at: '2026-09-24T11:00:00.000Z',
            provider: PaymentProvider.cash,
          },
          'bd36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
          role,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);

      await expectHttpDetail(
        service.createBooking(
          'member-1',
          {
            amenity_id: 'amenity-1',
            starts_at: '2026-09-24T10:00:00.000Z',
            ends_at: '2026-09-24T11:00:00.000Z',
            payment_stage: 'downpayment',
            provider: PaymentProvider.paymongo,
          },
          'cd36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
          role,
        ),
        'full payment',
      );
    }

    expect(
      amenityRepository.findActiveAmenityByIdOrThrow,
    ).not.toHaveBeenCalled();
  });

  it('cancels a pending self-service booking when PayMongo reports payment failure', async () => {
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-failed-1',
      amenity_id: 'amenity-1',
      starts_at: new Date('2026-09-24T02:00:00.000Z'),
      ends_at: new Date('2026-09-24T03:00:00.000Z'),
      status: 'pending',
      user_id: 'member-1',
    });
    bookingRepository.cancelBooking.mockResolvedValue({
      id: 'booking-failed-1',
      status: 'cancelled',
    });

    await service.handlePaymentFailed({
      amount: '800.00',
      failedAt: '2026-09-23T12:00:00.000Z',
      paymentId: 'payment-failed-1',
      payableId: 'booking-failed-1',
      payableType: PayableType.booking,
      reason: 'Payment declined.',
      userId: 'member-1',
    });

    expect(bookingRepository.cancelBooking).toHaveBeenCalledWith(
      'booking-failed-1',
      expect.any(Date),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      BOOKING_CANCELLED_EVENT,
      expect.objectContaining({
        bookingId: 'booking-failed-1',
        userId: 'member-1',
      }),
    );
  });

  it('rejects member booking dates beyond the one-year horizon and half-hour windows', async () => {
    await expectHttpDetail(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2099-09-24T10:00:00.000Z',
          ends_at: '2099-09-24T11:00:00.000Z',
          provider: PaymentProvider.paymongo,
        },
        'bd36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        UserRole.member,
      ),
      'one calendar year',
    );

    await expectHttpDetail(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2026-09-24T10:30:00.000Z',
          ends_at: '2026-09-24T11:30:00.000Z',
          provider: PaymentProvider.paymongo,
        },
        'cd36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        UserRole.member,
      ),
      'hourly slot',
    );
  });

  it('creates staff manual full-cash venue bookings as confirmed payments', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: false,
    });
    bookingRepository.createConfirmedManualBooking.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
    });

    const result = await service.createStaffManualBooking(
      'member-1',
      {
        amenity_id: 'amenity-1',
        member_id: 'member-1',
        starts_at: '2026-09-24T10:00:00.000Z',
        ends_at: '2026-09-24T11:00:00.000Z',
        payment_stage: 'full' as never,
      },
      'staff-1',
      '7d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(bookingRepository.createConfirmedManualBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'member-1',
        amenityId: 'amenity-1',
        paymentAmount: new Prisma.Decimal('800.00'),
        paymentStage: PaymentStage.full,
        verifiedBy: 'staff-1',
      }),
    );
    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).not.toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      BOOKING_CONFIRMED_EVENT,
      expect.objectContaining({
        amenityId: 'amenity-1',
        bookingId: 'booking-1',
        userId: 'member-1',
      }),
    );
    expect(result).toEqual({
      booking_id: 'booking-1',
      status: 'confirmed',
      checkout_url: null,
      payment_id: null,
    });
  });

  it('keeps PayMongo venue-booking initiation on the full-payment path', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Basketball Court',
      hourly_rate: new Prisma.Decimal('1200'),
      requires_subscription: false,
    });
    commerceCheckoutService.createVenueCheckout.mockResolvedValue({
      hold_id: 'hold-venue-2',
      kind: 'venue',
      status: 'held',
      checkout_url: 'https://checkout.paymongo.com/venue-2',
      expires_at: '2099-04-01T00:00:00.000Z',
      payment_id: 'payment-venue-2',
    });

    await service.createBooking(
      'member-1',
      {
        amenity_id: 'amenity-1',
        starts_at: '2099-05-13T08:00:00.000Z',
        ends_at: '2099-05-13T10:00:00.000Z',
        provider: PaymentProvider.paymongo,
        payment_stage: 'full',
      },
      '9fdd9dc8-11b8-47d2-b4d9-f0c3cc2f38ab',
    );

    expect(commerceCheckoutService.createVenueCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: new Prisma.Decimal('2400.00'),
        idempotencyKey: '9fdd9dc8-11b8-47d2-b4d9-f0c3cc2f38ab',
      }),
    );
    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).not.toHaveBeenCalled();
    expect(
      paymongoCheckoutService.createCheckoutSession,
    ).not.toHaveBeenCalled();
  });

  it('rejects cash self-service booking initiation', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: false,
    });
    await expect(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2099-03-24T10:00:00.000Z',
          ends_at: '2099-03-24T11:00:00.000Z',
          provider: PaymentProvider.cash,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toMatchObject({
      response: {
        detail:
          'Member and coach facility bookings must be paid in full through PayMongo. Cash bookings are created by the cashier flow only.',
        status: 403,
      },
    });
    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).not.toHaveBeenCalled();
  });

  it('returns the existing booking checkout when the same idempotency key is retried', async () => {
    amenityRepository.findActiveAmenityByIdOrThrow.mockResolvedValue({
      id: 'amenity-1',
      name: 'Main Court',
      hourly_rate: new Prisma.Decimal('800'),
      requires_subscription: false,
    });
    commerceCheckoutService.createVenueCheckout.mockResolvedValue({
      hold_id: 'hold-retry-1',
      kind: 'venue',
      status: 'held',
      checkout_url: 'https://checkout.paymongo.com/cs_test_123',
      expires_at: '2099-04-01T00:00:00.000Z',
      payment_id: 'payment-1',
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
      hold_id: 'hold-retry-1',
      kind: 'venue',
      status: 'held',
      checkout_url: 'https://checkout.paymongo.com/cs_test_123',
      payment_id: 'payment-1',
      expires_at: '2099-04-01T00:00:00.000Z',
    });
    expect(
      bookingRepository.createPendingBookingWithPayment,
    ).not.toHaveBeenCalled();
    expect(commerceCheckoutService.createVenueCheckout).toHaveBeenCalledTimes(
      1,
    );
  });

  it('rejects cash self-service retries even when an idempotency key exists', async () => {
    await expect(
      service.createBooking(
        'member-1',
        {
          amenity_id: 'amenity-1',
          starts_at: '2099-03-24T10:00:00.000Z',
          ends_at: '2099-03-24T11:00:00.000Z',
          provider: PaymentProvider.cash,
          payment_stage: 'full',
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toMatchObject({
      response: {
        status: 403,
        title: 'Online Payment Required',
      },
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

  it('marks booking downpayments balance-pending on shared payment completion', async () => {
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
      status: 'balance_pending',
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
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      BOOKING_CONFIRMED_EVENT,
      expect.anything(),
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

  it('retires balance collection before the booking start time with HTTP 410', async () => {
    await expect(
      service.processBalance('booking-1', {
        provider: PaymentProvider.paymongo,
      }),
    ).rejects.toMatchObject({ status: 410 });
  });

  it('retires PayMongo balance checkout with HTTP 410', async () => {
    await expect(
      service.processBalance('booking-1', {
        provider: PaymentProvider.paymongo,
      }),
    ).rejects.toMatchObject({ status: 410 });
    expect(
      bookingRepository.createBalancePendingPayment,
    ).not.toHaveBeenCalled();
    expect(
      paymongoCheckoutService.createCheckoutSession,
    ).not.toHaveBeenCalled();
  });

  it('retires existing cash balance retries with HTTP 410', async () => {
    await expect(
      service.processBalance('booking-1', {
        provider: PaymentProvider.cash,
        screenshot_url: 'https://cdn.fittrack.test/receipt.png',
        reference_no: 'OR-123',
      }),
    ).rejects.toMatchObject({ status: 410 });
    expect(
      bookingRepository.createBalancePendingPayment,
    ).not.toHaveBeenCalled();
  });

  it('settles balance_pending bookings on shared balance payment completion', async () => {
    paymentRepository.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.balance,
    });
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      status: 'balance_pending',
      balance_paid_at: null,
      balance_amount: new Prisma.Decimal('560.00'),
    });
    bookingRepository.completeBookingBalance.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
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

  it('settles outstanding booking balances even after the downpayment confirmed the booking', async () => {
    paymentRepository.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.balance,
    });
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
      balance_paid_at: null,
      balance_amount: new Prisma.Decimal('560.00'),
    });
    bookingRepository.completeBookingBalance.mockResolvedValue({
      id: 'booking-1',
      status: 'confirmed',
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
      starts_at: new Date('2099-03-24T10:00:00.000Z'),
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

  it('blocks today and tomorrow but allows cancellation two Manila calendar days ahead', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-14T15:00:00.000Z'));

    try {
      const booking = {
        id: 'booking-1',
        amenity_id: 'amenity-1',
        status: 'confirmed',
        cancelled_at: null,
        starts_at: new Date('2026-08-14T02:00:00.000Z'),
      };
      bookingRepository.findBookingByIdAndAssertOwnership.mockResolvedValue(booking);
      bookingRepository.cancelBooking.mockResolvedValue({
        id: 'booking-1',
        status: 'cancelled',
      });

      await expect(
        service.cancelBooking('booking-1', 'member-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          detail: expect.stringContaining('two calendar days'),
        }),
      });

      booking.starts_at = new Date('2026-08-15T02:00:00.000Z');
      await expect(
        service.cancelBooking('booking-1', 'member-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          detail: expect.stringContaining('two calendar days'),
        }),
      });

      booking.starts_at = new Date('2026-08-16T02:00:00.000Z');
      await expect(service.cancelBooking('booking-1', 'member-1')).resolves.toBeUndefined();
      expect(bookingRepository.cancelBooking).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects staff venue cancellation on the booking date', async () => {
    bookingRepository.findBookingWithAmenityByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      amenity_id: 'amenity-1',
      user_id: 'member-1',
      status: 'confirmed',
      cancelled_at: null,
      starts_at: new Date(),
    });

    await expect(
      service.cancelBookingAsStaff('booking-1', 'staff-1', 'Same-day change.'),
    ).rejects.toBeInstanceOf(HttpException);
    expect(bookingRepository.cancelBooking).not.toHaveBeenCalled();
  });

  it('rejects venue delivery actions for a coach who does not own paid work', async () => {
    bookingRepository.isFullyPaidCoachVenueWork.mockResolvedValue(false);

    await expect(
      service.completeCoachVenueWork('booking-1', 'other-coach-user'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(
      bookingRepository.findBookingWithAmenityByIdOrThrow,
    ).not.toHaveBeenCalled();
  });

  it('allows the assigned coach to complete fully paid venue add-on work', async () => {
    bookingRepository.isFullyPaidCoachVenueWork.mockResolvedValue(true);
    const completeSpy = jest
      .spyOn(service, 'completeConfirmedBooking')
      .mockResolvedValue(undefined);

    await expect(
      service.completeCoachVenueWork('booking-1', 'coach-user-1'),
    ).resolves.toBeUndefined();
    expect(completeSpy).toHaveBeenCalledWith('booking-1', 'coach-user-1');
  });
});
