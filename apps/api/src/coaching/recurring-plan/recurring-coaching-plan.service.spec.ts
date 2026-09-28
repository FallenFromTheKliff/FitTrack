import { GoneException, HttpException } from '@nestjs/common';
import {
  Prisma,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingPlanStatus,
  UserRole,
} from '@prisma/client';

import {
  RECURRING_COACHING_ACTIVE_ENTITLEMENT_CONFLICT_TYPE,
  RecurringCoachingPlanRepository,
} from './recurring-coaching-plan.repository';
import { RecurringCoachingPlanService } from './recurring-coaching-plan.service';
import { CoachingCommerceService } from '../commerce/coaching-commerce.service';
import { CoachAvailabilityService } from '../availability/coach-availability.service';

type CreatePlanWithSessionsInput = Parameters<
  RecurringCoachingPlanRepository['createPlanWithSessions']
>[0];
type FillPaidPlanWithSessionsInput = Parameters<
  RecurringCoachingPlanRepository['fillPaidPlanWithSessions']
>[0];

describe('RecurringCoachingPlanService', () => {
  const repo = {
    findActiveMember: jest.fn(),
    findCoachContext: jest.fn(),
    findCoachAuthoredTrainingPlan: jest.fn(),
    findClientProgram: jest.fn(),
    findMemberCoachEnrollment: jest.fn(),
    findConflictingAppointments: jest.fn(),
    createStaffCashEnrollment: jest.fn(),
    createPlanWithSessions: jest.fn(),
    fillPendingPlanWithSessions: jest.fn(),
    fillPaidPlanWithSessions: jest.fn(),
    findPlanWithSessions: jest.fn(),
    cancelPlan: jest.fn(),
  };
  const paymentRepository = {};
  const paymongoCheckoutService = {};
  const commerceCheckoutService = {
    createMonthlyCheckout: jest.fn(),
  };
  const coachAvailabilityService = {
    check: jest.fn(),
  };

  let service: RecurringCoachingPlanService;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findActiveMember.mockResolvedValue({ id: 'member-1' });
    repo.findCoachContext.mockResolvedValue({
      id: 'coach-1',
      is_available_for_booking: true,
      monthly_offer_active: true,
      monthly_rate: new Prisma.Decimal('12000'),
      monthly_session_count: 4,
      monthly_session_duration_minutes: 60,
      gym_commission_pct: new Prisma.Decimal('20'),
      user_id: 'coach-user-1',
      availability_slots: Array.from({ length: 7 }, (_, day_of_week) => ({
        day_of_week,
        start_time: new Date('1970-01-01T00:00:00.000Z'),
        end_time: new Date('1970-01-01T23:59:00.000Z'),
      })),
    });
    repo.findCoachAuthoredTrainingPlan.mockResolvedValue({
      id: 'training-plan-1',
    });
    repo.findClientProgram.mockResolvedValue({
      id: 'training-plan-1',
      schedule_days: [
        {
          id: 'training-day-week-1-monday',
          week_number: 1,
          day_of_week: 1,
          focus_label: 'Lower strength',
          exercises: [{ exercise: { name: 'Back Squat' } }],
        },
        {
          id: 'training-day-week-1-wednesday',
          week_number: 1,
          day_of_week: 3,
          focus_label: 'Upper push',
          exercises: [{ exercise: { name: 'Bench Press' } }],
        },
      ],
    });
    repo.findMemberCoachEnrollment.mockResolvedValue(null);
    repo.findConflictingAppointments.mockResolvedValue([]);
    repo.createStaffCashEnrollment.mockResolvedValue(makePlan({
      status: RecurringCoachingPlanStatus.active,
    }));
    coachAvailabilityService.check.mockResolvedValue({
      available: true,
      conflictReasons: [],
    });
    commerceCheckoutService.createMonthlyCheckout.mockResolvedValue({
      hold_id: 'hold-monthly-1',
      kind: 'monthly',
      status: 'held',
      checkout_url: 'https://checkout.paymongo.com/monthly-1',
      expires_at: '2099-04-01T00:00:00.000Z',
      payment_id: 'payment-monthly-1',
    });
    service = new RecurringCoachingPlanService(
      repo as never,
      paymentRepository as never,
      paymongoCheckoutService as never,
      commerceCheckoutService as never,
      coachAvailabilityService as never,
    );
  });

  const targetMonthStart = () => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));
  };

  const makeMonthlySchedule = () => {
    const start = targetMonthStart();
    const scheduledAt = (day: number) =>
      new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day, 1, 0, 0, 0),
      ).toISOString();
    return {
      coach_id: 'coach-1',
      duration_months: 1,
      frequency: 'monthly',
      member_id: 'member-1',
      preferred_days: [1],
      preferred_time: '09:00',
      schedule_items: [
        { sequence_index: 1, scheduled_at: scheduledAt(2) },
        { sequence_index: 2, scheduled_at: scheduledAt(5) },
        { sequence_index: 3, scheduled_at: scheduledAt(9) },
        { sequence_index: 4, scheduled_at: scheduledAt(12) },
      ],
      start_date: start.toISOString().slice(0, 10),
      training_plan_id: 'training-plan-1',
    };
  };

  const makePlan = (overrides: Record<string, unknown> = {}) => {
    const start = targetMonthStart();
    const end = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
    );
    return {
      id: 'plan-1',
      member_id: 'member-1',
      coach_id: 'coach-1',
      training_plan_id: null,
      frequency: 'monthly',
      preferred_days: [],
      preferred_time: new Date('1970-01-01T00:00:00.000Z'),
      start_date: start,
      end_date: end,
      quoted_amount: new Prisma.Decimal('12000'),
      coach_approved_at: null,
      status: RecurringCoachingPlanStatus.awaiting_payment,
      total_sessions: 0,
      completed_sessions: 0,
      coach: { display_name: 'Maria Santos', user_id: 'coach-user-1' },
      appointments: [],
      schedule_items: [],
      billing_cycles: [
        {
          id: 'cycle-1',
          recurring_plan_id: 'plan-1',
          cycle_start_date: start,
          cycle_end_date: end,
          due_date: start,
          grace_period_ends_at: new Date(
            start.getTime() + 7 * 24 * 60 * 60 * 1000,
          ),
          amount: new Prisma.Decimal('12000'),
          status: RecurringCoachingBillingCycleStatus.due,
          payment_id: null,
          paid_at: null,
        },
      ],
      ...overrides,
    };
  };

  it('rejects recurring plan previews that start before the current gym date', async () => {
    try {
      await service.previewPlan(
        { role: UserRole.admin, sub: 'admin-1' } as never,
        {
          coach_id: 'coach-1',
          duration_minutes: 60,
          duration_months: 1,
          frequency: 'weekly',
          member_id: 'member-1',
          preferred_days: [1],
          preferred_time: '09:00',
          start_date: '2000-01-01',
        } as never,
      );
      throw new Error('Expected previewPlan to reject a past start date.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({
        detail: 'start_date must be today or later.',
        status: 422,
        title: 'Invalid Recurring Plan Window',
        type: 'BUSINESS_RULE_VIOLATION',
      });
    }
  });

  it('includes the assigned coach display name in member plan responses', async () => {
    repo.findPlanWithSessions.mockResolvedValue(
      makePlan({
        coach: { display_name: 'Maria Santos', user_id: 'coach-user-1' },
      }),
    );

    const result = await service.getPlanSessions(
      { role: UserRole.member, sub: 'member-1' } as never,
      'plan-1',
    );

    expect(result.plan.coach_name).toBe('Maria Santos');
  });

  it('derives workout candidates and selects no more than the purchased count', async () => {
    const start = targetMonthStart();
    const result = await service.previewPlan(
      { role: UserRole.coach, sub: 'coach-user-1' } as never,
      {
        coach_id: 'coach-1',
        member_id: 'member-1',
        preferred_time: '09:00',
        start_date: start.toISOString().slice(0, 10),
        training_plan_id: 'training-plan-1',
      } as never,
    );

    expect(result).toMatchObject({
      can_confirm: true,
      purchased_session_count: 4,
      selected_session_count: 4,
      total_sessions: 4,
    });
    expect(typeof result.candidate_count).toBe('number');
    expect(typeof result.eligible_session_count).toBe('number');
    expect(result.candidate_count).toBeGreaterThan(4);
    expect(result.sessions.filter((session) => session.selected)).toHaveLength(
      4,
    );
    expect(typeof result.sessions[0]?.date).toBe('string');
    expect(result.sessions[0]).toMatchObject({
      time: '09:00',
      workout: {
        exercise_count: 1,
        exercise_names: ['Back Squat'],
        label: 'Lower strength',
      },
    });
  });

  it('requires member enrollment before creating a pre-payment derived schedule', async () => {
    const start = targetMonthStart();
    await expect(
      service.createPlan(
        { role: UserRole.coach, sub: 'coach-user-1' } as never,
        {
          coach_id: 'coach-1',
          member_id: 'member-1',
          preferred_time: '09:00',
        start_date: start.toISOString().slice(0, 10),
          training_plan_id: 'training-plan-1',
        } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        status: 403,
        title: 'Member Enrollment Required',
      },
    });
    expect(repo.createPlanWithSessions).not.toHaveBeenCalled();
  });

  it('rejects midnight as an unset monthly setup time', async () => {
    const start = targetMonthStart();

    await expect(
      service.previewPlan(
        { role: UserRole.coach, sub: 'coach-user-1' } as never,
        {
          coach_id: 'coach-1',
          member_id: 'member-1',
          preferred_time: '00:00',
          start_date: start.toISOString().slice(0, 10),
          training_plan_id: 'training-plan-1',
        } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        detail:
          'Monthly coaching setup requires a real coach availability time; 00:00 is treated as unset.',
        status: 422,
        title: 'Monthly Session Time Required',
      },
    });
  });

  it('rejects recurrence templates with more than five weekly days', async () => {
    const startDate = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    await expect(
      service.previewPlan(
        { role: UserRole.admin, sub: 'admin-1' } as never,
        {
          coach_id: 'coach-1',
          duration_minutes: 60,
          duration_months: 1,
          frequency: 'weekly',
          member_id: 'member-1',
          preferred_days: [0, 1, 2, 3, 4, 5],
          preferred_time: '09:00',
          start_date: startDate,
        } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        detail:
          'Recurring coaching plans may schedule at most 5 sessions per gym week.',
        status: 422,
      },
    });
  });

  it('allows the owning member to cancel a paid plan but rejects another member', async () => {
    const paidCycle = {
      ...makePlan().billing_cycles[0],
      paid_at: new Date(),
      status: RecurringCoachingBillingCycleStatus.paid,
    };

    repo.findPlanWithSessions.mockResolvedValue({
      appointments: [],
      billing_cycles: [paidCycle],
      coach: { user_id: 'coach-user-1' },
      coach_id: 'coach-1',
      id: 'plan-1',
      member_id: 'member-1',
      schedule_items: [],
      status: RecurringCoachingPlanStatus.active,
    });
    repo.cancelPlan.mockResolvedValue(
      makePlan({
        billing_cycles: [paidCycle],
        status: RecurringCoachingPlanStatus.cancelled,
      }),
    );

    const result = await service.cancelPlan(
      { role: UserRole.member, sub: 'member-1' } as never,
      'plan-1',
      { reason: 'member requested cancellation' } as never,
    );

    expect(repo.cancelPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        planId: 'plan-1',
        reason: 'member requested cancellation',
      }),
    );
    expect(result.plan.status).toBe(RecurringCoachingPlanStatus.cancelled);

    repo.findPlanWithSessions.mockResolvedValue({
      ...makePlan({
        billing_cycles: [paidCycle],
        member_id: 'member-2',
        status: RecurringCoachingPlanStatus.active,
      }),
      appointments: [],
      coach: { user_id: 'coach-user-1' },
      schedule_items: [],
    });

    await expect(
      service.cancelPlan(
        { role: UserRole.member, sub: 'member-1' } as never,
        'plan-1',
        { reason: 'member attempted to cancel another plan' } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        detail:
          'Only the plan owner, assigned coach, or an administrator can cancel a recurring coaching plan.',
        status: 403,
      },
    });
  });

  it('accepts an irregular explicit monthly schedule with five sessions in one gym week', async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + ((7 - start.getUTCDay()) % 7) + 7);
    start.setUTCHours(0, 0, 0, 0);
    const dateOnly = (offset: number) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    const at = (offset: number, hour: number) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + offset);
      date.setUTCHours(hour, 0, 0, 0);
      return date.toISOString();
    };

    const result = await service.previewPlan(
      { role: UserRole.coach, sub: 'coach-user-1' } as never,
      {
        coach_id: 'coach-1',
        duration_minutes: 60,
        duration_months: 1,
        end_date: dateOnly(6),
        frequency: 'monthly',
        member_id: 'member-1',
        preferred_days: [0, 1, 2, 3, 4, 5],
        preferred_time: '09:00',
        schedule_items: [
          { sequence_index: 1, scheduled_at: at(0, 1) },
          { sequence_index: 2, scheduled_at: at(1, 1) },
          { sequence_index: 3, scheduled_at: at(3, 1) },
          { sequence_index: 4, scheduled_at: at(3, 3) },
          { sequence_index: 5, scheduled_at: at(5, 1) },
        ],
        start_date: dateOnly(0),
      } as never,
    );

    expect(result).toMatchObject({
      can_confirm: true,
      conflict_count: 0,
      total_sessions: 5,
    });
    expect(coachAvailabilityService.check).toHaveBeenCalledTimes(5);
  });

  it('rejects an irregular explicit monthly schedule with six sessions in one gym week', async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + ((7 - start.getUTCDay()) % 7) + 7);
    start.setUTCHours(0, 0, 0, 0);
    const dateOnly = (offset: number) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + offset);
      return date.toISOString().slice(0, 10);
    };
    const at = (offset: number) => {
      const date = new Date(start);
      date.setUTCDate(date.getUTCDate() + offset);
      date.setUTCHours(1, 0, 0, 0);
      return date.toISOString();
    };

    await expect(
      service.previewPlan(
        { role: UserRole.coach, sub: 'coach-user-1' } as never,
        {
          coach_id: 'coach-1',
          duration_minutes: 60,
          duration_months: 1,
          end_date: dateOnly(6),
          frequency: 'monthly',
          member_id: 'member-1',
          preferred_days: [0],
          preferred_time: '09:00',
          schedule_items: Array.from({ length: 6 }, (_, index) => ({
            sequence_index: index + 1,
            scheduled_at: at(index),
          })),
          start_date: dateOnly(0),
        } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        detail:
          'Recurring coaching plans may schedule at most 5 sessions per gym week.',
        status: 422,
      },
    });
  });

  it('rejects duplicate explicit session timestamps before a plan can be created twice', async () => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 14);
    start.setUTCHours(1, 0, 0, 0);
    const dateOnly = start.toISOString().slice(0, 10);
    const scheduledAt = start.toISOString();

    await expect(
      service.previewPlan(
        { role: UserRole.coach, sub: 'coach-user-1' } as never,
        {
          coach_id: 'coach-1',
          duration_minutes: 60,
          duration_months: 1,
          end_date: dateOnly,
          frequency: 'monthly',
          member_id: 'member-1',
          preferred_days: [start.getUTCDay()],
          preferred_time: '09:00',
          schedule_items: [
            { sequence_index: 1, scheduled_at: scheduledAt },
            { sequence_index: 2, scheduled_at: scheduledAt },
          ],
          start_date: dateOnly,
        } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        detail:
          'A recurring coaching plan cannot contain duplicate session timestamps.',
        status: 409,
      },
    });
  });

  it('surfaces a coach availability conflict in an explicit preview', async () => {
    coachAvailabilityService.check.mockResolvedValue({
      available: false,
      conflictReasons: ['coach_appointment_conflict'],
    });
    const start = new Date();
    start.setUTCDate(start.getUTCDate() + 21);
    start.setUTCHours(1, 0, 0, 0);
    const dateOnly = start.toISOString().slice(0, 10);

    const result = await service.previewPlan(
      { role: UserRole.coach, sub: 'coach-user-1' } as never,
      {
        coach_id: 'coach-1',
        duration_minutes: 60,
        duration_months: 1,
        end_date: dateOnly,
        frequency: 'monthly',
        member_id: 'member-1',
        preferred_days: [start.getUTCDay()],
        preferred_time: '09:00',
        schedule_items: [
          { sequence_index: 1, scheduled_at: start.toISOString() },
        ],
        start_date: dateOnly,
      } as never,
    );

    expect(result.sessions[0]).toMatchObject({
      conflict: true,
      conflict_reasons: ['coach_appointment_conflict'],
    });
  });

  it('rejects a fresh monthly plan whose exact dates cross calendar months', async () => {
    const first = new Date();
    first.setUTCMonth(first.getUTCMonth() + 2, 28);
    first.setUTCHours(9, 0, 0, 0);
    const nextMonth = new Date(first);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1);

    await expect(
      service.createPlan(
        { role: UserRole.coach, sub: 'coach-user-1' } as never,
        {
          coach_id: 'coach-1',
          duration_minutes: 60,
          duration_months: 1,
          frequency: 'monthly',
          member_id: 'member-1',
          preferred_days: [first.getUTCDay()],
          preferred_time: '09:00',
          quoted_amount: 12000,
          schedule_items: [
            { sequence_index: 1, scheduled_at: first.toISOString() },
            {
              sequence_index: 2,
              scheduled_at: new Date(
                first.getTime() + 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
            { sequence_index: 3, scheduled_at: nextMonth.toISOString() },
            {
              sequence_index: 4,
              scheduled_at: new Date(
                nextMonth.getTime() + 24 * 60 * 60 * 1000,
              ).toISOString(),
            },
          ],
          start_date: first.toISOString().slice(0, 10),
          training_plan_id: 'training-plan-1',
        } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        status: 422,
        title: 'Single Monthly Period Required',
      },
    });
  });

  it('does not let a member create the coach-owned monthly schedule', async () => {
    const start = new Date();
    start.setUTCMonth(start.getUTCMonth() + 2, 3);
    start.setUTCHours(9, 0, 0, 0);

    await expect(
      service.createPlan(
        { role: UserRole.member, sub: 'member-1' } as never,
        {
          coach_id: 'coach-1',
          duration_months: 1,
          frequency: 'monthly',
          member_id: 'member-1',
          preferred_days: [start.getUTCDay()],
          preferred_time: '09:00',
          quoted_amount: 12000,
          schedule_items: Array.from({ length: 4 }, (_, index) => ({
            sequence_index: index + 1,
            scheduled_at: new Date(
              start.getTime() + index * 24 * 60 * 60 * 1000,
            ).toISOString(),
          })),
          start_date: start.toISOString().slice(0, 10),
          training_plan_id: 'training-plan-1',
        } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        status: 403,
        title: 'Coach Creation Required',
      },
    });
  });

  it('starts a full-payment monthly checkout without creating a plan shell', async () => {
    const requestedStart = targetMonthStart();
    requestedStart.setUTCDate(14);
    const startDate = requestedStart.toISOString().slice(0, 10);
    const expectedEnd = new Date(
      Date.UTC(
        requestedStart.getUTCFullYear(),
        requestedStart.getUTCMonth() + 1,
        13,
      ),
    );

    const result = await service.enroll(
      { role: UserRole.member, sub: 'member-1' } as never,
      { coach_id: 'coach-1', start_date: startDate },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(commerceCheckoutService.createMonthlyCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: new Prisma.Decimal('12000'),
        coachId: 'coach-1',
        durationMinutes: 60,
        endDate: expectedEnd,
        idempotencyKey: '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
        sessionCount: 4,
        startDate: requestedStart,
        userId: 'member-1',
      }),
    );
    expect(repo.createPlanWithSessions).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      hold_id: 'hold-monthly-1',
      kind: 'monthly',
      checkout_url: 'https://checkout.paymongo.com/monthly-1',
    });
  });

  it('records a staff cash enrollment for the exact selected one-month period', async () => {
    const requestedStart = targetMonthStart();
    requestedStart.setUTCDate(14);
    const startDate = requestedStart.toISOString().slice(0, 10);
    const expectedEnd = new Date(
      Date.UTC(
        requestedStart.getUTCFullYear(),
        requestedStart.getUTCMonth() + 1,
        13,
      ),
    );

    await service.createStaffCashEnrollment(
      { role: UserRole.staff, sub: 'staff-1' } as never,
      {
        coach_id: 'coach-1',
        member_id: 'member-1',
        reference_no: 'OR-101',
        start_date: startDate,
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(repo.createStaffCashEnrollment).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'staff-1',
        coachId: 'coach-1',
        endDate: expectedEnd,
        memberId: 'member-1',
        referenceNo: 'OR-101',
        startDate: requestedStart,
      }),
    );
  });

  it('does not treat an awaiting-payment row as a recurring entitlement', async () => {
    repo.findMemberCoachEnrollment.mockResolvedValue(makePlan());

    const result = await service.enroll(
      { role: UserRole.member, sub: 'member-1' } as never,
      {
        coach_id: 'coach-1',
        start_date: targetMonthStart().toISOString().slice(0, 10),
      },
      '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
    );

    expect(result).toMatchObject({
      hold_id: 'hold-monthly-1',
      kind: 'monthly',
    });
    expect(commerceCheckoutService.createMonthlyCheckout).toHaveBeenCalledTimes(
      1,
    );
  });

  it.each([
    RecurringCoachingPlanStatus.active,
    RecurringCoachingPlanStatus.paused,
  ])('keeps %s recurring plans as typed active-entitlement blockers', async (status) => {
    repo.findMemberCoachEnrollment.mockResolvedValue(makePlan({ status }));

    await expect(
      service.enroll(
        { role: UserRole.member, sub: 'member-1' } as never,
        {
          coach_id: 'coach-1',
          start_date: targetMonthStart().toISOString().slice(0, 10),
        },
        '4d36dc38-74c9-4f7e-a7d0-fd4102a4e8b0',
      ),
    ).rejects.toMatchObject({
      response: {
        conflict_kind: 'active_entitlement',
        status: 409,
        title: 'Recurring Coaching Enrollment Already Exists',
        type: RECURRING_COACHING_ACTIVE_ENTITLEMENT_CONFLICT_TYPE,
      },
    });
    expect(commerceCheckoutService.createMonthlyCheckout).not.toHaveBeenCalled();
  });

  it('passes the authenticated coach owner into the monthly client-program lookup', async () => {
    repo.findClientProgram.mockResolvedValueOnce(null);
    const startDate = targetMonthStart().toISOString().slice(0, 10);

    await expect(
      service.previewPlan(
        { role: UserRole.coach, sub: 'coach-user-1' } as never,
        {
          coach_id: 'coach-1',
          duration_minutes: 60,
          duration_months: 1,
          frequency: 'monthly',
          member_id: 'member-1',
          preferred_days: [1],
          preferred_time: '09:00',
          start_date: startDate,
          training_plan_id: 'training-plan-1',
        } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        status: 422,
        title: 'Client Program Not Found',
      },
    });
    expect(repo.findClientProgram).toHaveBeenCalledWith({
      coachUserId: 'coach-user-1',
      memberId: 'member-1',
      trainingPlanId: 'training-plan-1',
    });
  });

  it('rejects inactive monthly offers', async () => {
    repo.findCoachContext.mockResolvedValue({
      ...repo.findCoachContext.mock.results[0]?.value,
      id: 'coach-1',
      is_available_for_booking: true,
      monthly_offer_active: false,
      monthly_rate: new Prisma.Decimal('12000'),
      monthly_session_count: 4,
      monthly_session_duration_minutes: 60,
      gym_commission_pct: new Prisma.Decimal('20'),
      user_id: 'coach-user-1',
      availability_slots: [],
    });

    await expect(
      service.enroll({ role: UserRole.member, sub: 'member-1' } as never, {
        coach_id: 'coach-1',
      }),
    ).rejects.toMatchObject({
      response: {
        status: 422,
        title: 'Monthly Offer Unavailable',
      },
    });
  });

  it('does not let a coach author an unpaid shell', async () => {
    repo.findMemberCoachEnrollment.mockResolvedValue(makePlan());

    await expect(
      service.createPlan(
        { role: UserRole.coach, sub: 'coach-user-1' } as never,
        makeMonthlySchedule() as never,
      ),
    ).rejects.toMatchObject({
      response: {
        status: 403,
        title: 'Full Payment Required',
      },
    });
    expect(repo.fillPaidPlanWithSessions).not.toHaveBeenCalled();
  });

  it('fills the paid unscheduled shell instead of creating a second plan', async () => {
    const paidAt = new Date();
    const shell = makePlan({
      status: RecurringCoachingPlanStatus.active,
      billing_cycles: [
        {
          ...makePlan().billing_cycles[0],
          status: RecurringCoachingBillingCycleStatus.paid,
          paid_at: paidAt,
          payment_id: 'payment-1',
        },
      ],
    });
    repo.findMemberCoachEnrollment.mockResolvedValue(shell);
    repo.fillPaidPlanWithSessions.mockResolvedValue(
      makePlan({
        status: RecurringCoachingPlanStatus.active,
        training_plan_id: 'training-plan-1',
        total_sessions: 4,
        preferred_days: [1],
      }),
    );

    await service.createPlan(
      { role: UserRole.coach, sub: 'coach-user-1' } as never,
      makeMonthlySchedule() as never,
    );

    expect(repo.createPlanWithSessions).not.toHaveBeenCalled();
    expect(repo.fillPaidPlanWithSessions).toHaveBeenCalledTimes(1);
    const input = (
      repo.fillPaidPlanWithSessions.mock.calls as Array<
        [FillPaidPlanWithSessionsInput]
      >
    )[0]?.[0];
    expect(input).toBeDefined();
    if (!input) {
      throw new Error('Expected paid plan fill input.');
    }
    expect(input.planId).toBe('plan-1');
    expect(input.paidCycleId).toBe('cycle-1');
    expect(input.scheduleItems).toHaveLength(4);
    expect(
      input.scheduleItems.every(
        (item: { status: string }) => item.status === 'activated',
      ),
    ).toBe(true);
    expect(input.appointments).toHaveLength(4);
    expect(input.planUpdate.training_plan).toEqual({
      connect: { id: 'training-plan-1' },
    });
  });

  it('retires recurring billing-cycle payment with HTTP 410', async () => {
    await expect(
      service.initiateBillingCyclePayment(
        { role: UserRole.member, sub: 'member-1' } as never,
        'plan-1',
        'cycle-1',
        { provider: 'cash', reference_no: 'cash-1' } as never,
      ),
    ).rejects.toBeInstanceOf(GoneException);
  });
});
