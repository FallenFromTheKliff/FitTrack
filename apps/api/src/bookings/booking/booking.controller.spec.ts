import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BookingController } from './booking.controller';

function getGuardMetadata(
  methodName:
    | 'getAvailability'
    | 'createBooking'
    | 'getMyBookings'
    | 'getAllBookings'
    | 'getCoachVenueWork'
    | 'completeCoachVenueWork'
    | 'cancelCoachVenueWork'
    | 'markCoachVenueWorkNoShow'
    | 'cancelBooking'
    | 'processBalance',
): unknown[] | undefined {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    BookingController.prototype,
    methodName,
  )?.value;

  if (typeof handler !== 'function') {
    return undefined;
  }

  return Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName:
    | 'getAllBookings'
    | 'getCoachVenueWork'
    | 'completeCoachVenueWork'
    | 'cancelCoachVenueWork'
    | 'markCoachVenueWorkNoShow'
    | 'processBalance',
): UserRole[] | undefined {
  const handler: unknown = Object.getOwnPropertyDescriptor(
    BookingController.prototype,
    methodName,
  )?.value;

  if (typeof handler !== 'function') {
    return undefined;
  }

  return Reflect.getMetadata(ROLES_KEY, handler) as UserRole[] | undefined;
}

describe('BookingController', () => {
  const bookingService = {
    getAvailability: jest.fn(),
    createBooking: jest.fn(),
    getMyBookings: jest.fn(),
    getAllBookings: jest.fn(),
    getCoachVenueWork: jest.fn(),
    completeCoachVenueWork: jest.fn(),
    cancelCoachVenueWork: jest.fn(),
    markCoachVenueWorkNoShow: jest.fn(),
    cancelBooking: jest.fn(),
    processBalance: jest.fn(),
  };

  let controller: BookingController;

  beforeEach(() => {
    controller = new BookingController(bookingService as never);
    jest.clearAllMocks();
  });

  it('protects availability lookups with JWT auth', () => {
    expect(getGuardMetadata('getAvailability')).toEqual([JwtAuthGuard]);
  });

  it('protects booking creation with JWT auth', () => {
    expect(getGuardMetadata('createBooking')).toEqual([JwtAuthGuard]);
  });

  it('protects member booking history with JWT auth', () => {
    expect(getGuardMetadata('getMyBookings')).toEqual([JwtAuthGuard]);
  });

  it('locks admin booking reads to admin and staff', () => {
    expect(getGuardMetadata('getAllBookings')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('getAllBookings')).toEqual([
      UserRole.admin,
      UserRole.staff,
    ]);
  });

  it('protects booking cancellation with JWT auth', () => {
    expect(getGuardMetadata('cancelBooking')).toEqual([JwtAuthGuard]);
  });

  it.each([
    'getCoachVenueWork',
    'completeCoachVenueWork',
    'cancelCoachVenueWork',
    'markCoachVenueWorkNoShow',
  ] as const)('locks %s to the coach role', (methodName) => {
    expect(getGuardMetadata(methodName)).toEqual([JwtAuthGuard, RolesGuard]);
    expect(getRolesMetadata(methodName)).toEqual([UserRole.coach]);
  });

  it('locks balance collection to admin and staff roles', () => {
    expect(getGuardMetadata('processBalance')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('processBalance')).toEqual([
      UserRole.admin,
      UserRole.staff,
    ]);
  });

  it('loads availability through the booking service', async () => {
    bookingService.getAvailability.mockResolvedValue([{ available: true }]);

    await controller.getAvailability({
      amenity_id: 'amenity-1',
      date: '2026-03-24',
    });

    expect(bookingService.getAvailability).toHaveBeenCalledWith({
      amenity_id: 'amenity-1',
      date: '2026-03-24',
    });
  });

  it('creates bookings through the booking service', async () => {
    bookingService.createBooking.mockResolvedValue({
      booking_id: 'booking-1',
      status: 'pending',
      checkout_url: 'https://checkout.paymongo.com/cs_test_123',
    });

    await controller.createBooking(
      { role: UserRole.member, sub: 'member-1' } as never,
      {
        amenity_id: 'amenity-1',
        starts_at: '2026-03-24T10:00:00.000Z',
        ends_at: '2026-03-24T11:00:00.000Z',
        provider: 'paymongo',
      } as never,
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(bookingService.createBooking).toHaveBeenCalledWith(
      'member-1',
      {
        amenity_id: 'amenity-1',
        starts_at: '2026-03-24T10:00:00.000Z',
        ends_at: '2026-03-24T11:00:00.000Z',
        provider: 'paymongo',
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      UserRole.member,
    );
  });

  it('loads member booking history through the booking service', async () => {
    bookingService.getMyBookings.mockResolvedValue({ data: [], meta: {} });

    await controller.getMyBookings(
      { sub: 'member-1' } as never,
      { page: 1, limit: 20 } as never,
    );

    expect(bookingService.getMyBookings).toHaveBeenCalledWith('member-1', {
      page: 1,
      limit: 20,
    });
  });

  it('loads all bookings through the booking service', async () => {
    bookingService.getAllBookings.mockResolvedValue({ data: [], meta: {} });

    await controller.getAllBookings({ page: 1, limit: 20 } as never);

    expect(bookingService.getAllBookings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('returns a generic cancellation message after cancelling', async () => {
    bookingService.cancelBooking.mockResolvedValue(undefined);

    await expect(
      controller.cancelBooking('booking-1', { sub: 'member-1' } as never),
    ).resolves.toEqual({
      message: 'Booking cancelled.',
    });
    expect(bookingService.cancelBooking).toHaveBeenCalledWith(
      'booking-1',
      'member-1',
    );
  });

  it('starts booking balance collection through the booking service', async () => {
    bookingService.processBalance.mockResolvedValue({
      booking_id: 'booking-1',
      status: 'balance_pending',
      checkout_url: null,
    });

    await controller.processBalance('booking-1', {
      provider: 'cash',
      screenshot_url: 'https://cdn.fittrack.test/receipt.png',
      reference_no: 'OR-123',
    } as never);

    expect(bookingService.processBalance).toHaveBeenCalledWith('booking-1', {
      provider: 'cash',
      screenshot_url: 'https://cdn.fittrack.test/receipt.png',
      reference_no: 'OR-123',
    });
  });
});
