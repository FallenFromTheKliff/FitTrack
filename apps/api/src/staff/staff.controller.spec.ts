import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';
import { StaffController } from './staff.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

describe('StaffController', () => {
  const staffService = {
    getDashboardStats: jest.fn(),
    getAllUsers: jest.fn(),
    getAllCoaches: jest.fn(),
  };
  const bookingService = {
    getAllBookings: jest.fn(),
    confirmPendingBooking: jest.fn(),
    rejectPendingBooking: jest.fn(),
  };
  const appointmentService = {
    cancelAppointment: jest.fn(),
    completeAppointmentAsStaff: jest.fn(),
    getStaffAppointments: jest.fn(),
    respondToAppointmentAsStaff: jest.fn(),
    setAvailabilityForCoach: jest.fn(),
  };
  const coachService = {
    updateManagedProfile: jest.fn(),
  };

  const controller = new StaffController(
    staffService as never,
    bookingService as never,
    appointmentService as never,
    coachService as never,
  );

  it('protects the controller with JWT and role guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, StaffController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, StaffController)).toEqual([
      UserRole.staff,
      UserRole.admin,
    ]);
  });

  it('loads dashboard stats through the staff service', async () => {
    staffService.getDashboardStats.mockResolvedValue({ total: 3 });

    await expect(controller.getDashboardStats()).resolves.toEqual({ total: 3 });
    expect(staffService.getDashboardStats).toHaveBeenCalledTimes(1);
  });

  it('loads users through the staff service', async () => {
    staffService.getAllUsers.mockResolvedValue([{ id: 'user-1' }]);

    await expect(controller.getAllUsers()).resolves.toEqual([{ id: 'user-1' }]);
    expect(staffService.getAllUsers).toHaveBeenCalledTimes(1);
  });

  it('loads coaches through the staff service', async () => {
    staffService.getAllCoaches.mockResolvedValue([
      {
        id: 'coach-1',
        monthlyOfferActive: true,
        monthlyOfferDescription: 'Four focused sessions.',
        monthlyRate: 4800,
        monthlySessionCount: 4,
        monthlySessionDurationMinutes: 60,
      },
    ]);

    await expect(controller.getAllCoaches()).resolves.toEqual([
      expect.objectContaining({
        id: 'coach-1',
        monthlyOfferActive: true,
        monthlyRate: 4800,
        monthlySessionCount: 4,
        monthlySessionDurationMinutes: 60,
      }),
    ]);
    expect(staffService.getAllCoaches).toHaveBeenCalledTimes(1);
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

  it('loads coach appointments through the appointment service', async () => {
    appointmentService.getStaffAppointments.mockResolvedValue({
      data: [{ id: 'appointment-1' }],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      controller.getAllAppointments({ page: 1, limit: 20 } as never),
    ).resolves.toEqual({
      data: [{ id: 'appointment-1' }],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    expect(appointmentService.getStaffAppointments).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('replaces coach availability through the appointment service', async () => {
    appointmentService.setAvailabilityForCoach.mockResolvedValue(undefined);

    await expect(
      controller.replaceCoachAvailability('coach-1', {
        slots: [],
      } as never),
    ).resolves.toBeNull();
    expect(appointmentService.setAvailabilityForCoach).toHaveBeenCalledWith(
      'coach-1',
      { slots: [] },
    );
  });

  it('updates a coach profile through the coach service', async () => {
    coachService.updateManagedProfile.mockResolvedValue({
      id: 'coach-1',
      bio: 'Updated bio',
    });

    await expect(
      controller.updateCoachProfile('coach-1', {
        bio: 'Updated bio',
        is_available_for_booking: false,
      }),
    ).resolves.toEqual({
      id: 'coach-1',
      bio: 'Updated bio',
    });
    expect(coachService.updateManagedProfile).toHaveBeenCalledWith('coach-1', {
      bio: 'Updated bio',
      is_available_for_booking: false,
    });
  });

  it('preserves pending booking confirmation only as a 410 boundary', async () => {
    bookingService.confirmPendingBooking.mockRejectedValue(
      Object.assign(new Error('retired'), { status: 410 }),
    );

    await expect(
      controller.confirmBooking('booking-1', { sub: 'staff-1' } as never),
    ).rejects.toMatchObject({ status: 410 });
    expect(bookingService.confirmPendingBooking).toHaveBeenCalledWith(
      'booking-1',
      'staff-1',
    );
  });

  it('preserves pending booking rejection only as a 410 boundary', async () => {
    bookingService.rejectPendingBooking.mockRejectedValue(
      Object.assign(new Error('retired'), { status: 410 }),
    );

    await expect(
      controller.rejectBooking(
        'booking-1',
        { sub: 'staff-1' } as never,
        'Duplicate request',
      ),
    ).rejects.toMatchObject({ status: 410 });
    expect(bookingService.rejectPendingBooking).toHaveBeenCalledWith(
      'booking-1',
      'staff-1',
      'Duplicate request',
    );
  });

  it('responds to a coaching appointment through the appointment service', async () => {
    appointmentService.respondToAppointmentAsStaff.mockResolvedValue({
      id: 'appointment-1',
    });

    await expect(
      controller.respondToAppointment(
        'appointment-1',
        { sub: 'staff-1' } as never,
        { accepted: true },
      ),
    ).resolves.toEqual({
      id: 'appointment-1',
    });
    expect(appointmentService.respondToAppointmentAsStaff).toHaveBeenCalledWith(
      'staff-1',
      'appointment-1',
      { accepted: true },
    );
  });

  it('completes a coaching appointment through the appointment service', async () => {
    appointmentService.completeAppointmentAsStaff.mockResolvedValue({
      id: 'appointment-1',
    });

    await expect(
      controller.completeAppointment(
        'appointment-1',
        { sub: 'staff-1' } as never,
        { session_notes: 'Completed on time.' },
      ),
    ).resolves.toEqual({
      id: 'appointment-1',
    });
    expect(appointmentService.completeAppointmentAsStaff).toHaveBeenCalledWith(
      'staff-1',
      'appointment-1',
      {
        session_notes: 'Completed on time.',
      },
    );
  });

  it('cancels a coaching appointment through the appointment service', async () => {
    appointmentService.cancelAppointment.mockResolvedValue(undefined);

    await expect(
      controller.cancelAppointment(
        'appointment-1',
        { sub: 'staff-1', role: UserRole.staff } as never,
        { reason: 'Staff rescheduled the slot.' },
      ),
    ).resolves.toEqual({
      message: 'Appointment cancelled. Paid downpayments are non-refundable.',
    });
    expect(appointmentService.cancelAppointment).toHaveBeenCalledWith(
      'staff-1',
      UserRole.staff,
      'appointment-1',
      { reason: 'Staff rescheduled the slot.' },
    );
  });
});
