import { HttpException } from '@nestjs/common';
import {
  Prisma,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingPlanStatus,
  UserRole,
} from '@prisma/client';

import { RecurringCoachingPlanRepository } from './recurring-coaching-plan.repository';
import { RecurringCoachingPlanService } from './recurring-coaching-plan.service';

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
    findMemberCoachEnrollment: jest.fn(),
    findConflictingAppointments: jest.fn(),
    createPlanWithSessions: jest.fn(),
    fillPaidPlanWithSessions: jest.fn(),
    findPlanWithSessions: jest.fn(),
  };
  const paymentRepository = {};
  const paymongoCheckoutService = {};

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
    repo.findMemberCoachEnrollment.mockResolvedValue(null);
    repo.findConflictingAppointments.mockResolvedValue([]);
    service = new RecurringCoachingPlanService(
      repo as never,
      paymentRepository as never,
      paymongoCheckoutService as never,
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
      coach: { user_id: 'coach-user-1' },
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

  it('keeps recurring plan mutations read-only for members', async () => {
    repo.findPlanWithSessions.mockResolvedValue({
      appointments: [],
      billing_cycles: [],
      coach: { user_id: 'coach-user-1' },
      coach_id: 'coach-1',
      id: 'plan-1',
      member_id: 'member-1',
      schedule_items: [],
      status: 'awaiting_payment',
    });

    await expect(
      service.cancelPlan(
        { role: UserRole.member, sub: 'member-1' } as never,
        'plan-1',
        { reason: 'member attempted to cancel' } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        detail:
          'Only the assigned coach or an administrator can change a recurring coaching plan.',
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
    expect(repo.findConflictingAppointments).toHaveBeenCalledTimes(5);
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
    repo.findConflictingAppointments.mockResolvedValue([
      { id: 'appointment-1' },
    ]);
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

  it('creates a paid-first enrollment shell without schedule rows or sessions', async () => {
    const shell = makePlan();
    repo.createPlanWithSessions.mockResolvedValue(shell);

    await service.enroll({ role: UserRole.member, sub: 'member-1' } as never, {
      coach_id: 'coach-1',
      start_date: targetMonthStart().toISOString().slice(0, 10),
    });

    const input = (
      repo.createPlanWithSessions.mock.calls as Array<
        [CreatePlanWithSessionsInput]
      >
    )[0]?.[0];
    expect(input).toBeDefined();
    if (!input) {
      throw new Error('Expected enrollment creation input.');
    }
    expect(input.plan.status).toBe(
      RecurringCoachingPlanStatus.awaiting_payment,
    );
    expect(input.plan.preferred_days).toEqual([]);
    expect(input.plan.total_sessions).toBe(0);
    expect(input.scheduleItems).toBeUndefined();
    expect(input.appointments).toBeUndefined();
    expect(input.billingCycles).toHaveLength(1);
    expect(Number(input.billingCycles[0]?.amount)).toBe(12000);
  });

  it('rejects duplicate pending or active enrollment', async () => {
    repo.findMemberCoachEnrollment.mockResolvedValue(makePlan());

    await expect(
      service.enroll({ role: UserRole.member, sub: 'member-1' } as never, {
        coach_id: 'coach-1',
      }),
    ).rejects.toMatchObject({
      response: {
        status: 409,
        title: 'Recurring Coaching Enrollment Already Exists',
      },
    });
    expect(repo.createPlanWithSessions).not.toHaveBeenCalled();
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

  it('forbids cash as a member recurring-cycle payment method', async () => {
    repo.findPlanWithSessions.mockResolvedValue(
      makePlan({
        status: RecurringCoachingPlanStatus.awaiting_payment,
      }),
    );

    await expect(
      service.initiateBillingCyclePayment(
        { role: UserRole.member, sub: 'member-1' } as never,
        'plan-1',
        'cycle-1',
        { provider: 'cash', reference_no: 'cash-1' } as never,
      ),
    ).rejects.toMatchObject({
      response: {
        status: 403,
        title: 'Online Payment Required',
      },
    });
  });
});
