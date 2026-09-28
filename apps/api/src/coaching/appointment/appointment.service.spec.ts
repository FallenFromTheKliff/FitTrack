import { ForbiddenException, HttpException } from '@nestjs/common';
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
import { RelationshipService } from '../relationship/relationship.service';
import { CoachingCommerceService } from '../commerce/coaching-commerce.service';
import { CoachAvailabilityService } from '../availability/coach-availability.service';
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
    createConfirmedManualAppointment: jest.fn(),
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

  const relationshipService = {
    assertActiveClientRelationship: jest.fn(),
  };

  const coachingCommerceService = {
    createOneTimeCheckout: jest.fn(),
  };

  const coachAvailabilityService = {
    assertAvailable: jest.fn(),
    getSlots: jest.fn(),
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
        { provide: RelationshipService, useValue: relationshipService },
        { provide: CoachingCommerceService, useValue: coachingCommerceService },
        { provide: CoachAvailabilityService, useValue: coachAvailabilityService },
      ],
    }).compile();

    service = module.get<AppointmentService>(AppointmentService);
    jest.clearAllMocks();
    paymentRepository.findLatestPaymentsForPayableIds.mockResolvedValue([]);
    coachingCommerceService.createOneTimeCheckout.mockResolvedValue({
      hold_id: 'hold-1',
      kind: 'one_time',
      status: 'held',
      checkout_url: 'https://checkout.paymongo.com/test',
      expires_at: '2099-04-01T00:00:00.000Z',
      payment_id: 'payment-1',
    });
  });

  const makeReschedulableAppointment = (
    overrides: Record<string, unknown> = {},
  ) => ({
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
    member_notes: null,
    recurring_plan_id: null,
    recurring_schedule_item_id: null,
    recurring_state: null,
    original_scheduled_at: null,
    downpayment_paid_at: new Date('2099-03-31T08:00:00.000Z'),
    balance_paid_at: new Date('2099-03-31T08:00:00.000Z'),
    session_notes: null,
    coach_feedback: null,
    assessment_report: null,
    completed_at: null,
    coach_payout_paid_at: null,
    no_show_at: null,
    cancellation_reason: null,
    cancelled_at: null,
    created_at: new Date('2099-03-25T10:00:00.000Z'),
    updated_at: new Date('2099-03-25T10:00:00.000Z'),
    coach: { id: 'coach-1', user_id: 'coach-user-1' },
    ...overrides,
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

  it('creates a full-payment checkout hold with computed revenue', async () => {
    repo.findCoachScheduleContextOrThrow.mockResolvedValue({
      id: 'coach-1',
      hourly_rate: new Prisma.Decimal('1200'),
      gym_commission_pct: new Prisma.Decimal('20'),
      is_available_for_booking: true,
    });
    subscriptionService.hasCoachingAccess.mockResolvedValue(false);
    const result = await service.createAppointment('member-1', {
      coach_id: 'coach-1',
      scheduled_at: '2099-04-01T08:00:00.000Z',
      duration_minutes: 60,
      member_notes: 'Focus on mobility.',
    }, '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0');

    expect(coachingCommerceService.createOneTimeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'member-1',
        coachId: 'coach-1',
        durationMinutes: 60,
        idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        memberNotes: 'Focus on mobility.',
        scheduledAt: new Date('2099-04-01T08:00:00.000Z'),
        amount: new Prisma.Decimal('1200.00'),
      }),
    );
    expect(repo.createPendingAppointment).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      hold_id: 'hold-1',
      kind: 'one_time',
      checkout_url: 'https://checkout.paymongo.com/test',
    });
  });

  it('does not bypass full payment for subscription-backed member bookings', async () => {
    repo.findCoachScheduleContextOrThrow.mockResolvedValue({
      id: 'coach-1',
      hourly_rate: new Prisma.Decimal('1200'),
      gym_commission_pct: new Prisma.Decimal('20'),
      is_available_for_booking: true,
    });
    subscriptionService.hasCoachingAccess.mockResolvedValue(true);
    await service.createAppointment('member-1', {
      coach_id: 'coach-1',
      scheduled_at: '2099-04-01T08:00:00.000Z',
      duration_minutes: 60,
    }, '5d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0');

    expect(subscriptionService.hasCoachingAccess).not.toHaveBeenCalled();
    expect(coachingCommerceService.createOneTimeCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: new Prisma.Decimal('1200'),
        idempotencyKey: '5d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      }),
    );
    expect(repo.createPendingAppointment).not.toHaveBeenCalled();
  });

  it('creates staff coach appointments as full cash payments by default', async () => {
    repo.findCoachScheduleContextOrThrow.mockResolvedValue({
      id: 'coach-1',
      hourly_rate: new Prisma.Decimal('1200'),
      gym_commission_pct: new Prisma.Decimal('20'),
      is_available_for_booking: true,
    });
    repo.createConfirmedManualAppointment.mockResolvedValue({
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
      member_notes: null,
      recurring_plan_id: null,
      recurring_state: null,
      original_scheduled_at: null,
      downpayment_paid_at: new Date('2099-03-25T10:00:00.000Z'),
      balance_paid_at: new Date('2099-03-25T10:00:00.000Z'),
      created_at: new Date('2099-03-25T10:00:00.000Z'),
      updated_at: new Date('2099-03-25T10:00:00.000Z'),
    });

    await service.createStaffManualAppointment(
      'member-1',
      {
        member_id: 'member-1',
        coach_id: 'coach-1',
        scheduled_at: '2099-04-01T08:00:00.000Z',
        duration_minutes: 60,
      },
      'staff-1',
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(repo.createConfirmedManualAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentAmount: new Prisma.Decimal('1200'),
        paymentStage: PaymentStage.full,
      }),
    );
  });

  it('retires coach-managed appointments with HTTP 410', async () => {
    await expect(
      service.createCoachManagedAppointment('coach-user-1', {
        member_id: 'member-1',
        scheduled_at: '2099-04-01T08:00:00.000Z',
        duration_minutes: 60,
      }),
    ).rejects.toMatchObject({
      response: {
        status: 410,
        title: 'Coach Commercial Booking Retired',
      },
    });
    expect(relationshipService.assertActiveClientRelationship).not.toHaveBeenCalled();
    expect(repo.findCoachByUserIdOrThrow).not.toHaveBeenCalled();
    expect(repo.createConfirmedManualAppointment).not.toHaveBeenCalled();
  });

  it('retires coach-managed appointment creation with HTTP 410', async () => {
    relationshipService.assertActiveClientRelationship.mockResolvedValue(
      undefined,
    );
    repo.findCoachByUserIdOrThrow.mockResolvedValue({ id: 'coach-1' });
    repo.findCoachScheduleContextOrThrow.mockResolvedValue({
      id: 'coach-1',
      hourly_rate: new Prisma.Decimal('1200'),
      gym_commission_pct: new Prisma.Decimal('20'),
      is_available_for_booking: true,
    });
    repo.createConfirmedManualAppointment.mockResolvedValue({
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
      member_notes: null,
      recurring_plan_id: null,
      recurring_state: null,
      original_scheduled_at: null,
      downpayment_paid_at: new Date('2099-03-25T10:00:00.000Z'),
      balance_paid_at: new Date('2099-03-25T10:00:00.000Z'),
      created_at: new Date('2099-03-25T10:00:00.000Z'),
      updated_at: new Date('2099-03-25T10:00:00.000Z'),
    });

    await expect(
      service.createCoachManagedAppointment('coach-user-1', {
        member_id: 'member-1',
        scheduled_at: '2099-04-01T08:00:00.000Z',
        duration_minutes: 60,
      }),
    ).rejects.toMatchObject({
      response: {
        status: 410,
        title: 'Coach Commercial Booking Retired',
      },
    });
    expect(repo.createConfirmedManualAppointment).not.toHaveBeenCalled();
  });

  it('rejects staff coach appointment downpayments explicitly', async () => {
    await expect(
      service.createStaffManualAppointment(
        'member-1',
        {
          member_id: 'member-1',
          coach_id: 'coach-1',
          scheduled_at: '2099-04-01T08:00:00.000Z',
          duration_minutes: 60,
          payment_stage: 'downpayment' as never,
        },
        'staff-1',
        '5d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toMatchObject({
      response: {
        detail:
          'Staff-created coaching appointments must record full cash payment. Partial-payment appointments are not available in the staff flow.',
        status: 422,
        title: 'Full Cash Payment Required',
        type: 'BUSINESS_RULE_VIOLATION',
      },
    });
    expect(repo.findCoachScheduleContextOrThrow).not.toHaveBeenCalled();
    expect(repo.createConfirmedManualAppointment).not.toHaveBeenCalled();
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

  it('retires coach appointment responses with HTTP 410', async () => {
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

    await expect(
      service.respondToAppointment('coach-user-1', 'appt-1', {
        accepted: true,
      }),
    ).rejects.toMatchObject({
      response: {
        status: 410,
        title: 'Legacy Commercial Appointment Route Retired',
      },
    });
    expect(repo.updateAppointment).not.toHaveBeenCalled();
  });

  it('retires paid appointment responses with HTTP 410', async () => {
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

    await expect(
      service.respondToAppointment('coach-user-1', 'appt-1', {
        accepted: true,
      }),
    ).rejects.toMatchObject({
      response: {
        status: 410,
        title: 'Legacy Commercial Appointment Route Retired',
      },
    });
    expect(repo.updateAppointment).not.toHaveBeenCalled();
  });

  it('retires staff appointment responses with HTTP 410', async () => {
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

    await expect(
      service.respondToAppointmentAsStaff('staff-1', 'appt-1', {
        accepted: true,
      }),
    ).rejects.toMatchObject({
      response: {
        status: 410,
        title: 'Legacy Commercial Appointment Route Retired',
      },
    });
    expect(repo.findCoachByUserIdOrThrow).not.toHaveBeenCalled();
    expect(repo.updateAppointment).not.toHaveBeenCalled();
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
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
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
    await service.cancelAppointment('coach-user-1', UserRole.coach, 'appt-1', {
      reason: 'Coach unavailable.',
    });

    expect(repo.updateAppointment).toHaveBeenCalledTimes(3);
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
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
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

  it('rejects coach appointment cancellation on the appointment date', async () => {
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'confirmed',
      is_free_session: false,
      scheduled_at: new Date(),
      cancelled_at: null,
      cancellation_reason: null,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });

    await expect(
      service.cancelAppointment('staff-1', UserRole.staff, 'appt-1', {
        reason: 'Same-day cancellation.',
      }),
    ).rejects.toBeInstanceOf(HttpException);
    expect(repo.updateAppointment).not.toHaveBeenCalled();
  });

  it('retires product-visible appointment payment initiation with HTTP 410', async () => {
    await expect(
      service.initiateDownpayment(
        'member-1',
        UserRole.member,
        'appt-1',
        { provider: PaymentProvider.paymongo, payment_stage: PaymentStage.full },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toMatchObject({ status: 410 });
    expect(paymentRepository.createPayment).not.toHaveBeenCalled();
    expect(paymongoCheckoutService.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('retires member cash and downpayment attempts with HTTP 410', async () => {
    await expect(
      service.initiateDownpayment(
        'member-1',
        UserRole.member,
        'appt-1',
        { provider: PaymentProvider.cash, payment_stage: PaymentStage.full },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b3',
      ),
    ).rejects.toMatchObject({ status: 410 });

    await expect(
      service.initiateDownpayment(
        'member-1',
        UserRole.member,
        'appt-1',
        {
          provider: PaymentProvider.paymongo,
          payment_stage: PaymentStage.downpayment,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8c3',
      ),
    ).rejects.toMatchObject({ status: 410 });

    expect(
      paymentRepository.findPaymentByIdempotencyKey,
    ).not.toHaveBeenCalled();
    expect(paymentRepository.createPayment).not.toHaveBeenCalled();
  });

  it('retires appointment checkout retry routes with HTTP 410', async () => {
    await expect(
      service.initiateDownpayment(
        'member-1',
        UserRole.member,
        'appt-1',
        { provider: PaymentProvider.paymongo, payment_stage: PaymentStage.full },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8d3',
      ),
    ).rejects.toMatchObject({ status: 410 });
    expect(repo.updateAppointment).not.toHaveBeenCalled();
  });

  it('retires initial payment while a legacy appointment awaits approval', async () => {
    await expect(
      service.initiateDownpayment(
        'member-1',
        UserRole.member,
        'appt-1',
        { provider: PaymentProvider.paymongo },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b2',
      ),
    ).rejects.toMatchObject({ status: 410 });

    expect(
      paymentRepository.findLatestPaymentForPayableStage,
    ).not.toHaveBeenCalled();
    expect(paymentRepository.createPayment).not.toHaveBeenCalled();
  });

  it('retires staff collection through the product-visible payment route', async () => {
    await expect(
      service.initiateDownpayment(
        'staff-1',
        UserRole.staff,
        'appt-1',
        { provider: PaymentProvider.cash, payment_stage: PaymentStage.full },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b1',
      ),
    ).rejects.toMatchObject({ status: 410 });
    expect(paymentRepository.createPayment).not.toHaveBeenCalled();
  });

  it('retires appointment balance collection with HTTP 410', async () => {
    await expect(
      service.processBalance('staff-1', 'appt-1', {
        provider: PaymentProvider.cash,
        screenshot_url: 'https://cdn.fittrack.test/receipts/or-2026-03-23.png',
        reference_no: 'OR-123',
      }),
    ).rejects.toMatchObject({ status: 410 });
    expect(paymentRepository.createPayment).not.toHaveBeenCalled();
  });

  it('confirms pending-payment appointments when a full payment completes', async () => {
    paymentRepository.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.full,
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
      amount: '1200',
    });

    const updateCalls = repo.updateAppointment.mock.calls as Array<
      [
        string,
        {
          status: string;
          downpayment_paid_at: Date;
          balance_paid_at: Date;
        },
      ]
    >;
    const updateArgs = updateCalls[0]?.[1];

    expect(updateCalls[0]?.[0]).toBe('appt-1');
    expect(updateArgs?.status).toBe('confirmed');
    expect(updateArgs?.downpayment_paid_at).toBeInstanceOf(Date);
    expect(updateArgs?.balance_paid_at).toBeInstanceOf(Date);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      APPOINTMENT_CONFIRMED_EVENT,
      expect.objectContaining({
        appointmentId: 'appt-1',
      }),
    );
  });

  it('ignores completed coaching payments while the appointment still awaits approval', async () => {
    paymentRepository.findPaymentByIdOrThrow.mockResolvedValue({
      id: 'payment-1',
      payment_stage: PaymentStage.downpayment,
    });
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      user_id: 'member-1',
      coach_id: 'coach-1',
      status: 'pending_coach',
      is_free_session: false,
      downpayment_amount: new Prisma.Decimal('360'),
      balance_amount: new Prisma.Decimal('840'),
      downpayment_paid_at: null,
      balance_paid_at: null,
      scheduled_at: new Date('2099-04-01T08:00:00.000Z'),
      duration_minutes: 60,
      coach: { id: 'coach-1', user_id: 'coach-user-1' },
    });

    await service.handlePaymentCompleted({
      paymentId: 'payment-1',
      userId: 'member-1',
      payableType: PayableType.coaching,
      payableId: 'appt-1',
      amount: '360',
    });

    expect(repo.updateAppointment).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      APPOINTMENT_CONFIRMED_EVENT,
      expect.anything(),
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

  it('allows only the assigned coach or staff/admin to reschedule a paid one-time appointment', async () => {
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue(
      makeReschedulableAppointment(),
    );

    await expect(
      service.rescheduleAppointment(
        'other-coach-user-1',
        UserRole.coach,
        'appt-1',
        {
          scheduled_at: '2099-04-08T08:00:00.000Z',
          duration_minutes: 60,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toMatchObject({ status: 403 });

    expect(coachAvailabilityService.assertAvailable).not.toHaveBeenCalled();
    expect(repo.updateAppointment).not.toHaveBeenCalled();
  });

  it('rejects a reschedule when canonical availability reports the new slot unavailable', async () => {
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue(
      makeReschedulableAppointment(),
    );
    coachAvailabilityService.assertAvailable.mockRejectedValue(
      new HttpException('The requested coach slot is unavailable.', 409),
    );

    await expect(
      service.rescheduleAppointment(
        'coach-user-1',
        UserRole.coach,
        'appt-1',
        {
          scheduled_at: '2099-04-08T08:00:00.000Z',
          duration_minutes: 90,
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toMatchObject({ status: 409 });

    expect(coachAvailabilityService.assertAvailable).toHaveBeenCalledWith({
      coachId: 'coach-1',
      durationMinutes: 90,
      excludeAppointmentIds: ['appt-1'],
      startsAt: new Date('2099-04-08T08:00:00.000Z'),
    });
    expect(repo.updateAppointment).not.toHaveBeenCalled();
  });

  it('updates only the requested appointment session without creating commerce state', async () => {
    const updated = makeReschedulableAppointment({
      scheduled_at: new Date('2099-04-08T08:00:00.000Z'),
      duration_minutes: 90,
    });
    repo.findAppointmentLifecycleContextByIdOrThrow.mockResolvedValue(
      makeReschedulableAppointment(),
    );
    coachAvailabilityService.assertAvailable.mockResolvedValue(undefined);
    repo.updateAppointment.mockResolvedValue(updated);

    const result = await service.rescheduleAppointment(
      'coach-user-1',
      UserRole.coach,
      'appt-1',
      {
        scheduled_at: '2099-04-08T08:00:00.000Z',
        duration_minutes: 90,
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(repo.updateAppointment).toHaveBeenCalledWith('appt-1', {
      scheduled_at: new Date('2099-04-08T08:00:00.000Z'),
      duration_minutes: 90,
    });
    expect(coachingCommerceService.createOneTimeCheckout).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'appt-1',
      scheduled_at: '2099-04-08T08:00:00.000Z',
      duration_minutes: 90,
      user_id: 'member-1',
      coach_id: 'coach-1',
    });
  });

  it('treats a repeated same-payload reschedule as an idempotent replay', async () => {
    const original = makeReschedulableAppointment();
    const updated = makeReschedulableAppointment({
      scheduled_at: new Date('2099-04-08T08:00:00.000Z'),
      duration_minutes: 90,
    });
    repo.findAppointmentLifecycleContextByIdOrThrow
      .mockResolvedValueOnce(original)
      .mockResolvedValueOnce(updated);
    coachAvailabilityService.assertAvailable.mockResolvedValue(undefined);
    repo.updateAppointment.mockResolvedValue(updated);

    const payload = {
      scheduled_at: '2099-04-08T08:00:00.000Z',
      duration_minutes: 90,
    };
    const idempotencyKey = '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0';

    await service.rescheduleAppointment(
      'coach-user-1',
      UserRole.coach,
      'appt-1',
      payload,
      idempotencyKey,
    );
    await service.rescheduleAppointment(
      'coach-user-1',
      UserRole.coach,
      'appt-1',
      payload,
      idempotencyKey,
    );

    expect(repo.updateAppointment).toHaveBeenCalledTimes(1);
    expect(coachAvailabilityService.assertAvailable).toHaveBeenCalledTimes(1);
  });
});
