import { HttpException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { RecurringCoachingPlanService } from './recurring-coaching-plan.service';

describe('RecurringCoachingPlanService', () => {
  const repo = {
    findActiveMember: jest.fn(),
    findCoachContext: jest.fn(),
    findConflictingAppointments: jest.fn(),
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
      user_id: 'coach-user-1',
      availability_slots: Array.from({ length: 7 }, (_, day_of_week) => ({
        day_of_week,
        start_time: new Date('1970-01-01T00:00:00.000Z'),
        end_time: new Date('1970-01-01T23:59:00.000Z'),
      })),
    });
    repo.findConflictingAppointments.mockResolvedValue([]);
    service = new RecurringCoachingPlanService(
      repo as never,
      paymentRepository as never,
      paymongoCheckoutService as never,
    );
  });

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
        detail: 'Recurring coaching plans may schedule at most 5 sessions per gym week.',
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
        preferred_days: [0],
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
        detail: 'Recurring coaching plans may schedule at most 5 sessions per gym week.',
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
        detail: 'A recurring coaching plan cannot contain duplicate session timestamps.',
        status: 409,
      },
    });
  });

  it('surfaces a coach availability conflict in an explicit preview', async () => {
    repo.findConflictingAppointments.mockResolvedValue([{ id: 'appointment-1' }]);
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
        schedule_items: [{ sequence_index: 1, scheduled_at: start.toISOString() }],
        start_date: dateOnly,
      } as never,
    );

    expect(result.sessions[0]).toMatchObject({
      conflict: true,
      conflict_reasons: ['coach_appointment_conflict'],
    });
  });
});
