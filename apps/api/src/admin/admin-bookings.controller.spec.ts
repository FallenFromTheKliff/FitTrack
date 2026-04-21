import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AdminBookingsController } from './admin-bookings.controller';

function getMethod(name: 'getAllBookings' | 'confirmBooking' | 'rejectBooking') {
  return Object.getOwnPropertyDescriptor(AdminBookingsController.prototype, name)
    ?.value as Function | undefined;
}

describe('AdminBookingsController', () => {
  const bookingService = {
    getAllBookings: jest.fn(),
    confirmPendingBooking: jest.fn(),
    rejectPendingBooking: jest.fn(),
  };

  const controller = new AdminBookingsController(bookingService as never);

  it('protects the controller with JWT and role guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminBookingsController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, AdminBookingsController)).toEqual([
      UserRole.admin,
    ]);
  });

  it('loads bookings through the live booking service', async () => {
    bookingService.getAllBookings.mockResolvedValue({
      data: [{ id: 'booking-1' }],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      controller.getAllBookings({ page: 1, limit: 20 } as never),
    ).resolves.toEqual({
      data: [{ id: 'booking-1' }],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    expect(bookingService.getAllBookings).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('confirms a pending booking through the live booking service', async () => {
    bookingService.confirmPendingBooking.mockResolvedValue({
      message: 'Booking confirmed successfully',
    });

    await expect(
      controller.confirmBooking('booking-1', { sub: 'admin-1' } as never),
    ).resolves.toEqual({
      message: 'Booking confirmed successfully',
    });
    expect(bookingService.confirmPendingBooking).toHaveBeenCalledWith(
      'booking-1',
      'admin-1',
    );
  });

  it('rejects a pending booking through the live booking service', async () => {
    bookingService.rejectPendingBooking.mockResolvedValue({
      message: 'Booking rejected successfully',
    });

    await expect(
      controller.rejectBooking(
        'booking-1',
        { sub: 'admin-1' } as never,
        'Duplicate request',
      ),
    ).resolves.toEqual({
      message: 'Booking rejected successfully',
    });
    expect(bookingService.rejectPendingBooking).toHaveBeenCalledWith(
      'booking-1',
      'admin-1',
      'Duplicate request',
    );
  });

  it('defines the expected controller methods', () => {
    expect(typeof getMethod('getAllBookings')).toBe('function');
    expect(typeof getMethod('confirmBooking')).toBe('function');
    expect(typeof getMethod('rejectBooking')).toBe('function');
  });
});
