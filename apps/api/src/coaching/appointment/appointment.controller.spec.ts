import { GUARDS_METADATA } from '@nestjs/common/constants';
import { UserRole } from '@prisma/client';

import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AppointmentController } from './appointment.controller';

function getGuardMetadata(
  methodName:
    | 'setAvailability'
    | 'createAppointment'
    | 'getMyAppointments'
    | 'getCoachAppointments'
    | 'respondToAppointment'
    | 'cancelAppointment'
    | 'initiateDownpayment'
    | 'processBalance'
    | 'completeAppointment'
    | 'submitCoachFeedback',
): unknown[] | undefined {
  return Reflect.getMetadata(
    GUARDS_METADATA,
    AppointmentController.prototype[methodName],
  ) as unknown[] | undefined;
}

function getRolesMetadata(
  methodName:
    | 'setAvailability'
    | 'getCoachAppointments'
    | 'respondToAppointment'
    | 'processBalance'
    | 'completeAppointment'
    | 'submitCoachFeedback',
): UserRole[] | undefined {
  return Reflect.getMetadata(
    ROLES_KEY,
    AppointmentController.prototype[methodName],
  ) as UserRole[] | undefined;
}

describe('AppointmentController', () => {
  const appointmentService = {
    createAppointment: jest.fn(),
    setAvailability: jest.fn(),
    getCoachAppointments: jest.fn(),
    getMyAppointments: jest.fn(),
    respondToAppointment: jest.fn(),
    respondToAppointmentAsStaff: jest.fn(),
    cancelAppointment: jest.fn(),
    initiateDownpayment: jest.fn(),
    processBalance: jest.fn(),
    submitCoachFeedback: jest.fn(),
    completeAppointment: jest.fn(),
    completeAppointmentAsStaff: jest.fn(),
  };

  let controller: AppointmentController;

  beforeEach(() => {
    controller = new AppointmentController(appointmentService as never);
    jest.clearAllMocks();
  });

  it('keeps coach availability replacement on the authenticated coach surface', async () => {
    appointmentService.setAvailability.mockResolvedValue(null);

    await controller.setAvailability(
      { sub: 'coach-user-1' } as never,
      { slots: [] },
    );

    expect(appointmentService.setAvailability).toHaveBeenCalledWith(
      'coach-user-1',
      { slots: [] },
    );
    expect(getGuardMetadata('setAvailability')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('setAvailability')).toEqual([
      UserRole.coach,
    ]);
  });

  it('creates appointment requests through the service for authenticated users', async () => {
    appointmentService.createAppointment.mockResolvedValue({ id: 'appt-1' });

    await controller.createAppointment({ sub: 'member-1' } as never, {
      coach_id: 'coach-1',
      scheduled_at: '2026-04-01T08:00:00.000Z',
      duration_minutes: 60,
    });

    expect(appointmentService.createAppointment).toHaveBeenCalledWith(
      'member-1',
      {
        coach_id: 'coach-1',
        scheduled_at: '2026-04-01T08:00:00.000Z',
        duration_minutes: 60,
      },
    );
    expect(getGuardMetadata('createAppointment')).toEqual([JwtAuthGuard]);
  });

  it('gets the authenticated members appointment history through JWT auth', async () => {
    appointmentService.getMyAppointments.mockResolvedValue({
      data: [],
      meta: {},
    });

    await controller.getMyAppointments({ sub: 'member-1' } as never, {
      page: 1,
      limit: 20,
    });

    expect(appointmentService.getMyAppointments).toHaveBeenCalledWith(
      'member-1',
      { page: 1, limit: 20 },
    );
    expect(getGuardMetadata('getMyAppointments')).toEqual([JwtAuthGuard]);
  });

  it('loads the authenticated coach schedule for coach users', async () => {
    appointmentService.getCoachAppointments.mockResolvedValue({
      data: [],
      meta: {},
    });

    await controller.getCoachAppointments(
      { sub: 'coach-user-1' } as never,
      { limit: 20 },
    );

    expect(appointmentService.getCoachAppointments).toHaveBeenCalledWith(
      'coach-user-1',
      { limit: 20 },
    );
    expect(getGuardMetadata('getCoachAppointments')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('getCoachAppointments')).toEqual([UserRole.coach]);
  });

  it('locks appointment responses to coach users', async () => {
    appointmentService.respondToAppointment.mockResolvedValue({
      id: 'appt-1',
    });

    await controller.respondToAppointment(
      'appt-1',
      { sub: 'coach-user-1' } as never,
      { accepted: true },
    );

    expect(appointmentService.respondToAppointment).toHaveBeenCalledWith(
      'coach-user-1',
      'appt-1',
      { accepted: true },
    );
    expect(getGuardMetadata('respondToAppointment')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('respondToAppointment')).toEqual([UserRole.coach]);
  });

  it('returns the generic payment-policy message after cancelling an appointment', async () => {
    appointmentService.cancelAppointment.mockResolvedValue(undefined);

    await expect(
      controller.cancelAppointment(
        'appt-1',
        { sub: 'member-1', role: UserRole.member } as never,
        { reason: 'Need to reschedule.' },
      ),
    ).resolves.toEqual({
        message: 'Appointment cancelled. Payment handling follows the applicable payment policy.',
    });

    expect(appointmentService.cancelAppointment).toHaveBeenCalledWith(
      'member-1',
      UserRole.member,
      'appt-1',
      { reason: 'Need to reschedule.' },
    );
    expect(getGuardMetadata('cancelAppointment')).toEqual([JwtAuthGuard]);
  });

  it('passes the idempotency key through for appointment payment checkout', async () => {
    appointmentService.initiateDownpayment.mockResolvedValue({
      appointment_id: 'appt-1',
      status: 'pending_payment',
      checkout_url: 'https://checkout.paymongo.test/appt-1',
    });

    await controller.initiateDownpayment(
      'appt-1',
      { sub: 'member-1', role: UserRole.member } as never,
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      { provider: 'paymongo' },
    );

    expect(appointmentService.initiateDownpayment).toHaveBeenCalledWith(
      'member-1',
      UserRole.member,
      'appt-1',
      { provider: 'paymongo' },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );
    expect(getGuardMetadata('initiateDownpayment')).toEqual([JwtAuthGuard]);
  });

  it('locks balance collection to staff and admin roles', async () => {
    appointmentService.processBalance.mockResolvedValue({
      appointment_id: 'appt-1',
      status: 'confirmed',
      checkout_url: null,
    });

    await controller.processBalance('appt-1', { sub: 'staff-1' } as never, {
      provider: 'cash',
      reference_no: 'OR-123',
    });

    expect(appointmentService.processBalance).toHaveBeenCalledWith(
      'staff-1',
      'appt-1',
      { provider: 'cash', reference_no: 'OR-123' },
    );
    expect(getGuardMetadata('processBalance')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('processBalance')).toEqual([
      UserRole.admin,
      UserRole.staff,
    ]);
  });

  it('locks appointment completion to coach users', async () => {
    appointmentService.completeAppointment.mockResolvedValue({
      id: 'appt-1',
    });

    await controller.completeAppointment(
      'appt-1',
      { sub: 'coach-user-1' } as never,
      { session_notes: 'Strong lower-body session.' },
    );

    expect(appointmentService.completeAppointment).toHaveBeenCalledWith(
      'coach-user-1',
      'appt-1',
      { session_notes: 'Strong lower-body session.' },
    );
    expect(getGuardMetadata('completeAppointment')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('completeAppointment')).toEqual([UserRole.coach]);
  });

  it('submits coach feedback through coach-owned appointment endpoint', async () => {
    appointmentService.submitCoachFeedback.mockResolvedValue({ id: 'appt-1' });

    await controller.submitCoachFeedback(
      'appt-1',
      { sub: 'coach-user-1' } as never,
      { coach_feedback: 'Keep tempo steady.' },
    );

    expect(appointmentService.submitCoachFeedback).toHaveBeenCalledWith(
      'coach-user-1',
      'appt-1',
      { coach_feedback: 'Keep tempo steady.' },
    );
    expect(getGuardMetadata('submitCoachFeedback')).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(getRolesMetadata('submitCoachFeedback')).toEqual([UserRole.coach]);
  });
});
