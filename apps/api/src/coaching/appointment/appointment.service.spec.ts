import { HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  Prisma,
  UserRole,
} from '@prisma/client';

import { PaymentRepository } from '../../membership/payment/payment.repository';
import { PaymongoCheckoutService } from '../../membership/payment/paymongo-checkout.service';
import { SubscriptionService } from '../../membership/subscription/subscription.service';
import { RecurringCoachingPlanService } from '../recurring-plan/recurring-coaching-plan.service';
import { AppointmentRepository } from './appointment.repository';
import { AppointmentService } from './appointment.service';
import { APPOINTMENT_CANCELLED_EVENT } from './events/appointment-cancelled.event';
import { APPOINTMENT_COMPLETED_EVENT } from './events/appointment-completed.event';
import { APPOINTMENT_CONFIRMED_EVENT } from './events/appointment-confirmed.event';

describe('AppointmentService', () => {
  let service: AppointmentService;

  const repo = {
    findCoachByUserIdOrThrow: jest.fn(),
    replaceAvailabilitySlots: jest.fn(),
    findCoachScheduleContextOrThrow: jest.fn(),
    createPendingAppointment: jest.fn(),
    getMyAppointments: jest.fn(),
    getStaffAppointments: jest.fn(),
    findAppointmentLifecycleContextByIdOrThrow: jest.fn(),
    updateAppointment: jest.fn(),
  };

  const subscriptionService = {
    hasCoachingAccess: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const paymentRepository = {
    findPaymentByIdempotencyKey: jest.fn(),
    findLatestPaymentForPayableStage: jest.fn(),
    createPayment: jest.fn(),
    updatePayment: jest.fn(),
    findPaymentByIdOrThrow: jest.fn(),
    findLatestPaymentsForPayableIds: jest.fn(),
  };

  const paymongoCheckoutService = {
    createCheckoutSession: jest.fn(),
  };

  const recurringCoachingPlanService = {
    refreshPlanProgress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentService,
        { provide: AppointmentRepository, useValue: repo },
        { provide: SubscriptionService, useValue: subscriptionService },
        { provide: PaymentRepository, useValue: paymentRepository },
        {
          provide: PaymongoCheckoutService,
          useValue: paymongoCheckoutService,
        },
        { provide: EventEmitter2, useValue: eventEmitter },
        {
          provide: RecurringCoachingPlanService,
          useValue: recurringCoachingPlanService,
        },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    jest.clearAllMocks();
    paymentRepository.findLatestPaymentsForPayableIds.mockResolvedValue([]);
  });

  it('rejects overlapping weekly availability windows for the same day', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({ id: 'coach-1' });

    await expect(
      service.setAvailability('coach-user-1', {
        slots: [
          { day_of_week: 1, start_time: '08:00', end_time: '10:00' },
          { day_of_week: 1, start_time: '09:30', end_time: '11:00' },
        ],
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(repo.replaceAvailabilitySlots).not.toHaveBeenCalled();
  });

  it('replaces availability slots after validation passes', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({ id: 'coach-1' });

    await service.setAvailability('coach-user-1', {
      slots: [{ day_of_week: 1, start_time: '08:00', end_time: '10:00' }],
    });

    expect(repo.replaceAvailabilitySlots).toHaveBeenCalledWith({
      coachId: 'coach-1',
      slots: [
        {
          dayOfWeek: 1,
          startTime: new Date(Date.UTC(1970, 0, 1, 8, 0, 0, 0)),
          endTime: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)),
        },
      ],
    });
  });

  it('replaces availability slots for a selected coach when staff manages the schedule', async () => {
    repo.findCoachScheduleContextOrThrow.mockResolvedValue({
      id: 'coach-1',
      user_id: 'coach-user-1',
    });

    await service.setAvailabilityForCoach('coach-1', {
      slots: [{ day_of_week: 2, start_time: '10:00', end_time: '12:00' }],
    });

    expect(repo.findCoachScheduleContextOrThrow).toHaveBeenCalledWith(
      'coach-1',
    );
    expect(repo.replaceAvailabilitySlots).toHaveBeenCalledWith({
      coachId: 'coach-1',
      slots: [
        {
          dayOfWeek: 2,
          startTime: new Date(Date.UTC(1970, 0, 1, 10, 0, 0, 0)),
          endTime: new Date(Date.UTC(1970, 0, 1, 12, 0, 0, 0)),
        },
      ],
    });
  });

  it('creates paid appointment requests with computed revenue splits', async () => {
    repo.findCoachScheduleContextOrThrow.mockResolvedValue({
      id: 'coach-1',
      hourly_rate: new Prisma.Decimal('1200'),
      gym_commission_pct: new Prisma.Decimal('20'),
      is_available_for_booking: true,
    });
    subscriptionService.hasCoachingAccess.mockResolvedValue(false);
    repo.createPendingAppointment.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_coach',
      is_free_session: false,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      total_amount: new Prisma.Decimal('1200.00'),
      downpayment_amount: new Prisma.Decimal('360.00'),
      balance_amount: new Prisma.Decimal('840.00'),
      gym_revenue: new Prisma.Decimal('240.00'),
      coach_earnings: new Prisma.Decimal('960.00'),
      member_notes: 'Focus on mobility.',
      created_at: new Date('2099-03-25T10:00:00.000Z'),
      updated_at: new Date('2099-03-25T10:00:00.000Z'),
    });

    const result = await service.createAppointment('member-1', {
      coach_id: 'coach-1',
      scheduled_at: '2099-04-01T08:00:00.000Z',
      duration_minutes: 60,
      member_notes: 'Focus on mobility.',
    });

    expect(repo.createPendingAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'member-1',
        coachId: 'coach-1',
        isFreeSession: false,
        totalAmount: new Prisma.Decimal('1200.00'),
        downpaymentAmount: new Prisma.Decimal('360.00'),
        balanceAmount: new Prisma.Decimal('840.00'),
        gymRevenue: new Prisma.Decimal('240.00'),
        coachEarnings: new Prisma.Decimal('960.00'),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        id: 'appt-1',
        total_amount: '1200',
        downpayment_amount: '360',
        balance_amount: '840',
      }),
    );
  });

  it('marks subscription-backed appointments as free sessions with zero payment amounts', async () => {
    repo.findCoachScheduleContextOrThrow.mockResolvedValue({
      id: 'coach-1',
      hourly_rate: new Prisma.Decimal('1200'),
      gym_commission_pct: new Prisma.Decimal('20'),
      is_available_for_booking: true,
    });
    subscriptionService.hasCoachingAccess.mockResolvedValue(true);
    repo.createPendingAppointment.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_coach',
      is_free_session: true,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      total_amount: new Prisma.Decimal('0'),
      downpayment_amount: new Prisma.Decimal('0'),
      balance_amount: new Prisma.Decimal('0'),
      gym_revenue: new Prisma.Decimal('0'),
      coach_earnings: new Prisma.Decimal('0'),
      member_notes: null,
      created_at: new Date('2099-03-25T10:00:00.000Z'),
      updated_at: new Date('2099-03-25T10:00:00.000Z'),
    });

    await service.createAppointment('member-1', {
      coach_id: 'coach-1',
      scheduled_at: '2099-04-01T08:00:00.000Z',
      duration_minutes: 60,
    });

    expect(repo.createPendingAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        isFreeSession: true,
        totalAmount: new Prisma.Decimal('0'),
        downpaymentAmount: new Prisma.Decimal('0'),
        balanceAmount: new Prisma.Decimal('0'),
      }),
    );
  });

  it('returns the authenticated members paginated appointment history', async () => {
    repo.getMyAppointments.mockResolvedValue({
      data: [
        {
          id: 'appt-1',
          user_id: 'member-1',
          coach_id: 'coach-1',
          status: 'pending_payment',
          is_free_session: false,
          scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
          duration_minutes: 60,
          total_amount: new Prisma.Decimal('1200.00'),
          downpayment_amount: new Prisma.Decimal('360.00'),
          balance_amount: new Prisma.Decimal('840.00'),
          gym_revenue: new Prisma.Decimal('240.00'),
          coach_earnings: new Prisma.Decimal('960.00'),
          downpayment_paid_at: null,
          balance_paid_at: null,
          session_notes: null,
          member_notes: 'Focus on mobility.',
          completed_at: null,
          no_show_at: null,
          cancellation_reason: null,
          cancelled_at: null,
          created_at: new Date('2099-03-25T10:00:00.000Z'),
          updated_at: new Date('2099-03-25T10:00:00.000Z'),
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    const result = await service.getMyAppointments('member-1', {
      page: 1,
      limit: 20,
      start_date: '2099-04-01',
      end_date: '2099-04-30',
    });

    expect(repo.getMyAppointments).toHaveBeenCalledWith('member-1', {
      page: 1,
      limit: 20,
      start_date: '2099-04-01',
      end_date: '2099-04-30',
    });
    expect(result.meta.total).toBe(1);
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'appt-1',
        status: 'pending_payment',
        cancellation_reason: null,
      }),
    );
  });

  it('returns the staff-owned appointment roster with member and coach summaries', async () => {
    repo.getStaffAppointments.mockResolvedValue({
      data: [
        {
          id: 'appt-1',
          user_id: 'member-1',
          coach_id: 'coach-1',
          status: 'pending_coach',
          scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
          duration_minutes: 60,
          total_amount: new Prisma.Decimal('900.00'),
          downpayment_amount: new Prisma.Decimal('270.00'),
          balance_amount: new Prisma.Decimal('630.00'),
          downpayment_paid_at: null,
          balance_paid_at: null,
          member_notes: 'Focus on shoulder stability.',
          recurring_plan_id: null,
          recurring_state: null,
          original_scheduled_at: null,
          created_at: new Date('2099-03-25T10:00:00.000Z'),
          updated_at: new Date('2099-03-25T10:00:00.000Z'),
          user: {
            id: 'member-1',
            auth_identities: [
              { identifier: 'member-1@fittrack.com', is_primary: true },
            ],
            profile: {
              first_name: 'Jamie',
              last_name: 'Rivera',
              avatar_url: null,
            },
          },
          coach: {
            id: 'coach-1',
            hourly_rate: new Prisma.Decimal('900'),
            display_name: 'Coach Profile Noah',
            contact_email: 'coach-1@fittrack.com',
            user: {
              auth_identities: [
                { identifier: 'coach-1@fittrack.com', is_primary: true },
              ],
              profile: {
                first_name: 'Noah',
                last_name: 'Reyes',
                avatar_url: null,
              },
            },
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    const result = await service.getStaffAppointments({
      page: 1,
      limit: 20,
      coach_id: 'coach-1',
    });

    expect(repo.getStaffAppointments).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      coach_id: 'coach-1',
    });
    const firstResult = result.data[0];
    expect(firstResult).toBeDefined();
    expect(firstResult?.id).toBe('appt-1');
    expect(firstResult?.status).toBe('pending_coach');
    expect(firstResult?.user.email).toBe('member-1@fittrack.com');
    expect(firstResult?.coach.hourly_rate).toBe('900');
    expect(firstResult?.coach.display_name).toBe('Coach Profile Noah');
  });

  it('confirms free appointments immediately when a coach accepts them', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({ id: 'coach-1' });
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_coach',
      is_free_session: true,
      cancelled_at: null,
      cancellation_reason: null,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });
    repo.updateAppointment.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'confirmed',
      is_free_session: true,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      total_amount: new Prisma.Decimal('0'),
      downpayment_amount: new Prisma.Decimal('0'),
      balance_amount: new Prisma.Decimal('0'),
      gym_revenue: new Prisma.Decimal('0'),
      coach_earnings: new Prisma.Decimal('0'),
      downpayment_paid_at: null,
      balance_paid_at: null,
      session_notes: null,
      member_notes: null,
      completed_at: null,
      no_show_at: null,
      cancellation_reason: null,
      cancelled_at: null,
      created_at: new Date('2099-03-25T10:00:00.000Z'),
      updated_at: new Date('2099-03-25T10:00:00.000Z'),
    });

    const result = await service.respondToAppointment(
      'coach-user-1',
      'appt-1',
      {
        accepted: true,
      },
    );

    expect(repo.updateAppointment).toHaveBeenCalledWith('appt-1', {
      status: 'confirmed',
    });
    expect(result.status).toBe('confirmed');
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      APPOINTMENT_CONFIRMED_EVENT,
      expect.objectContaining({
        appointmentId: 'appt-1',
      }),
    );
  });

  it('moves paid appointments to pending payment when a coach accepts them', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({ id: 'coach-1' });
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_coach',
      is_free_session: false,
      cancelled_at: null,
      cancellation_reason: null,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });
    repo.updateAppointment.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_payment',
      is_free_session: false,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      total_amount: new Prisma.Decimal('1200'),
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      gym_revenue: new Prisma.Decimal('240'),
      coach_earnings: new Prisma.Decimal('960'),
      downpayment_paid_at: null,
      balance_paid_at: null,
      session_notes: null,
      member_notes: null,
      completed_at: null,
      no_show_at: null,
      cancellation_reason: null,
      cancelled_at: null,
      created_at: new Date('2099-03-25T10:00:00.000Z'),
      updated_at: new Date('2099-03-25T10:00:00.000Z'),
    });

    const result = await service.respondToAppointment(
      'coach-user-1',
      'appt-1',
      {
        accepted: true,
      },
    );

    expect(repo.updateAppointment).toHaveBeenCalledWith('appt-1', {
      status: 'pending_payment',
    });
    expect(result.status).toBe('pending_payment');
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      APPOINTMENT_CONFIRMED_EVENT,
      expect.anything(),
    );
  });

  it('allows staff to accept a pending appointment without coach ownership checks', async () => {
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_coach',
      is_free_session: false,
      cancelled_at: null,
      cancellation_reason: null,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });
    repo.updateAppointment.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_payment',
      is_free_session: false,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      total_amount: new Prisma.Decimal('1200'),
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      gym_revenue: new Prisma.Decimal('240'),
      coach_earnings: new Prisma.Decimal('960'),
      downpayment_paid_at: null,
      balance_paid_at: null,
      session_notes: null,
      member_notes: null,
      completed_at: null,
      no_show_at: null,
      cancellation_reason: null,
      cancelled_at: null,
      created_at: new Date('2099-03-25T10:00:00.000Z'),
      updated_at: new Date('2099-03-25T10:00:00.000Z'),
    });

    const result = await service.respondToAppointmentAsStaff(
      'staff-1',
      'appt-1',
      {
        accepted: true,
      },
    );

    expect(repo.findCoachByUserIdOrThrow).not.toHaveBeenCalled();
    expect(repo.updateAppointment).toHaveBeenCalledWith('appt-1', {
      status: 'pending_payment',
    });
    expect(result.status).toBe('pending_payment');
  });

  it('requires a rejection reason when a coach rejects an appointment', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({ id: 'coach-1' });
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_coach',
      is_free_session: false,
      cancelled_at: null,
      cancellation_reason: null,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });

    await expect(
      service.respondToAppointment('coach-user-1', 'appt-1', {
        accepted: false,
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(repo.updateAppointment).not.toHaveBeenCalled();
  });

  it('allows the member, owning coach, and staff to cancel eligible appointments', async () => {
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'confirmed',
      is_free_session: false,
      cancelled_at: null,
      cancellation_reason: null,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });
    repo.findCoachByUserIdOrThrow.mockResolvedValue({ id: 'coach-1' });
    repo.updateAppointment.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'cancelled',
      is_free_session: false,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      total_amount: new Prisma.Decimal('1200'),
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      gym_revenue: new Prisma.Decimal('240'),
      coach_earnings: new Prisma.Decimal('960'),
      downpayment_paid_at: null,
      balance_paid_at: null,
      session_notes: null,
      member_notes: null,
      completed_at: null,
      no_show_at: null,
      cancellation_reason: 'Need to reschedule.',
      cancelled_at: new Date('2099-03-25T10:00:00.000Z'),
      created_at: new Date('2099-03-25T10:00:00.000Z'),
      updated_at: new Date('2099-03-25T10:00:00.000Z'),
    });

    await service.cancelAppointment('member-1', UserRole.member, 'appt-1', {
      reason: 'Need to reschedule.',
    });
    await expect(
      service.cancelAppointment('other-member-1', UserRole.member, 'appt-1', {
        reason: 'Not my appointment.',
      }),
    ).rejects.toBeInstanceOf(HttpException);
    await service.cancelAppointment('staff-1', UserRole.staff, 'appt-1', {
      reason: 'Manual front desk cancellation.',
    });

    expect(repo.updateAppointment).toHaveBeenCalledTimes(2);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        action: 'APPOINTMENT_CANCELLED',
        entityId: 'appt-1',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      APPOINTMENT_CANCELLED_EVENT,
      expect.objectContaining({
        appointmentId: 'appt-1',
      }),
    );
  });

  it('rejects cancellation from users who do not own the appointment', async () => {
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'confirmed',
      is_free_session: false,
      cancelled_at: null,
      cancellation_reason: null,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });

    await expect(
      service.cancelAppointment('member-2', UserRole.member, 'appt-1', {
        reason: 'Not my appointment.',
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(repo.updateAppointment).not.toHaveBeenCalled();
  });

  it('starts a paymongo downpayment checkout for a pending-payment appointment', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_payment',
      is_free_session: false,
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      downpayment_paid_at: null,
      balance_paid_at: null,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });
    paymentRepository.findLatestPaymentForPayableStage.mockResolvedValue(null);
    paymentRepository.createPayment.mockResolvedValue({
      id: 'payment-1',
      user_id: 'member-1',
      payable_type: PayableType.coaching,
      payable_id: 'appt-1',
      payment_stage: PaymentStage.downpayment,
      amount: new Prisma.Decimal('360'),
      provider: PaymentProvider.paymongo,
      idempotency_key: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      status: PaymentStatus.pending,
      gateway_metadata: null,
    });
    paymongoCheckoutService.createCheckoutSession.mockResolvedValue({
      providerRef: 'cs_1',
      checkoutUrl: 'https://checkout.paymongo.test/cs_1',
      gatewayMetadata: { checkout_url: 'https://checkout.paymongo.test/cs_1' },
    });

    const result = await service.initiateDownpayment(
      'member-1',
      UserRole.member,
      'appt-1',
      { provider: PaymentProvider.paymongo },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(paymentRepository.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payable_type: PayableType.coaching,
        payable_id: 'appt-1',
        payment_stage: PaymentStage.downpayment,
        provider: PaymentProvider.paymongo,
      }),
    );
    expect(paymongoCheckoutService.createCheckoutSession).toHaveBeenCalledWith({
      amount: 36000,
      description: 'Coaching appointment downpayment',
      idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      metadata: {
        payment_id: 'payment-1',
        appointment_id: 'appt-1',
      },
    });
    expect(result).toEqual({
      appointment_id: 'appt-1',
      status: 'pending_payment',
      checkout_url: 'https://checkout.paymongo.test/cs_1',
      payment_id: 'payment-1',
    });
  });

  it('lets staff collect a full cash payment for any member appointment using the actual total amount', async () => {
    paymentRepository.findPaymentByIdempotencyKey.mockResolvedValue(null);
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_payment',
      is_free_session: false,
      total_amount: new Prisma.Decimal('1000.00'),
      downpayment_amount: new Prisma.Decimal('300.00'),
      balance_amount: new Prisma.Decimal('700.00'),
      downpayment_paid_at: null,
      balance_paid_at: null,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 120,
      coach: { id: 'coach-1', user_id: null },
    });
    paymentRepository.findLatestPaymentForPayableStage.mockResolvedValue(null);
    paymentRepository.createPayment.mockResolvedValue({
      id: 'payment-full-1',
    });

    const result = await service.initiateDownpayment(
      'staff-1',
      UserRole.staff,
      'appt-1',
      {
        provider: PaymentProvider.cash,
        payment_stage: PaymentStage.full,
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b1',
    );

    expect(paymentRepository.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payable_type: PayableType.coaching,
        payable_id: 'appt-1',
        payment_stage: PaymentStage.full,
        amount: new Prisma.Decimal('1000.00'),
        provider: PaymentProvider.cash,
        status: PaymentStatus.awaiting_verification,
      }),
    );
    expect(result).toEqual({
      appointment_id: 'appt-1',
      status: 'pending_payment',
      checkout_url: null,
      payment_id: 'payment-full-1',
    });
  });

  it('creates an awaiting-verification cash balance payment for staff collection', async () => {
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'confirmed',
      is_free_session: false,
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      downpayment_paid_at: new Date('2099-04-01T08:15:00.000Z'),
      balance_paid_at: null,
      scheduled_at: new Date('2000-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });
    paymentRepository.findLatestPaymentForPayableStage.mockResolvedValue(null);
    paymentRepository.createPayment.mockResolvedValue({
      id: 'payment-2',
    });

    const result = await service.processBalance('staff-1', 'appt-1', {
      provider: PaymentProvider.cash,
      screenshot_url: 'https://cdn.fittrack.test/receipts/or-2026-03-23.png',
      reference_no: 'OR-123',
    });

    expect(paymentRepository.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        payable_type: PayableType.coaching,
        payable_id: 'appt-1',
        payment_stage: PaymentStage.balance,
        provider: PaymentProvider.cash,
        status: PaymentStatus.awaiting_verification,
      }),
    );
    expect(result).toEqual({
      appointment_id: 'appt-1',
      status: 'confirmed',
      checkout_url: null,
      payment_id: 'payment-2',
    });
  });

  it('confirms pending-payment appointments when a coaching downpayment completes', async () => {
    paymentRepository.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.downpayment,
    });
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_payment',
      is_free_session: false,
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      downpayment_paid_at: null,
      balance_paid_at: null,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });
    repo.updateAppointment.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'confirmed',
      is_free_session: false,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      total_amount: new Prisma.Decimal('1200'),
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      gym_revenue: new Prisma.Decimal('240'),
      coach_earnings: new Prisma.Decimal('960'),
      downpayment_paid_at: new Date('2099-04-01T08:15:00.000Z'),
      balance_paid_at: null,
      session_notes: null,
      member_notes: null,
      completed_at: null,
      no_show_at: null,
      cancellation_reason: null,
      cancelled_at: null,
      created_at: new Date('2099-03-25T10:00:00.000Z'),
      updated_at: new Date('2099-03-25T10:00:00.000Z'),
    });

    await service.handlePaymentCompleted({
      paymentId: 'payment-1',
      userId: 'member-1',
      payableType: PayableType.coaching,
      payableId: 'appt-1',
      amount: '360',
    });

    const updateCalls = repo.updateAppointment.mock.calls as Array<
      [string, { status: string; downpayment_paid_at: Date }]
    >;
    const updateArgs = updateCalls[0]?.[1];

    expect(updateCalls[0]?.[0]).toBe('appt-1');
    expect(updateArgs?.status).toBe('confirmed');
    expect(updateArgs?.downpayment_paid_at).toBeInstanceOf(Date);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      APPOINTMENT_CONFIRMED_EVENT,
      expect.objectContaining({
        appointmentId: 'appt-1',
      }),
    );
  });

  it('requires the remaining balance before a paid appointment can be completed', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({ id: 'coach-1' });
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'confirmed',
      is_free_session: false,
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      downpayment_paid_at: new Date('2099-04-01T08:15:00.000Z'),
      balance_paid_at: null,
      scheduled_at: new Date('2000-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });

    await expect(
      service.completeAppointment('coach-user-1', 'appt-1', {
        session_notes: 'Great work.',
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(repo.updateAppointment).not.toHaveBeenCalled();
  });

  it('emits a completion event after a coach completes an appointment', async () => {
    repo.findCoachByUserIdOrThrow.mockResolvedValue({ id: 'coach-1' });
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'confirmed',
      is_free_session: false,
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      downpayment_paid_at: new Date('2099-04-01T08:15:00.000Z'),
      balance_paid_at: new Date('2099-04-01T09:00:00.000Z'),
      scheduled_at: new Date('2000-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });
    repo.updateAppointment.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'completed',
      is_free_session: false,
      scheduled_at: new Date('2000-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      total_amount: new Prisma.Decimal('1200'),
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      gym_revenue: new Prisma.Decimal('240'),
      coach_earnings: new Prisma.Decimal('960'),
      downpayment_paid_at: new Date('2099-04-01T08:15:00.000Z'),
      balance_paid_at: new Date('2099-04-01T09:00:00.000Z'),
      session_notes: 'Great work.',
      member_notes: null,
      completed_at: new Date('2099-04-01T10:00:00.000Z'),
      no_show_at: null,
      cancellation_reason: null,
      cancelled_at: null,
      created_at: new Date('2099-03-25T10:00:00.000Z'),
      updated_at: new Date('2099-03-25T10:00:00.000Z'),
    });

    await service.completeAppointment('coach-user-1', 'appt-1', {
      session_notes: 'Great work.',
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      APPOINTMENT_COMPLETED_EVENT,
      expect.objectContaining({
        appointmentId: 'appt-1',
      }),
    );
  });
});
