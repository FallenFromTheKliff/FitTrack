import {
  buildCoachPlanCalendarMonth,
  buildCoachPlanCalendarWeek,
  isCoachManagedTrainingPlan,
} from '@fittrack/app-core';
import type {
  TrainingPlanDetailRecord,
  WorkoutSessionSummaryRecord,
} from '@fittrack/types';

const plan: TrainingPlanDetailRecord = {
  coachId: 'coach-1',
  createdAt: '2026-08-01T00:00:00.000Z',
  daysPerWeek: 3,
  durationWeeks: 4,
  goal: 'maintenance',
  id: 'coach-plan-1',
  isActive: true,
  isTemplate: false,
  source: 'coach_assigned',
  title: 'Coach plan',
  updatedAt: '2026-08-01T00:00:00.000Z',
  userId: 'member-1',
  scheduleDays: [0, 1, 2].map((dayOfWeek) => ({
    dayOfWeek,
    exercises: [
      {
        category: 'strength',
        durationSeconds: null,
        exerciseId: `exercise-${dayOfWeek}`,
        exerciseName: 'Barbell Bench Press',
        id: `plan-exercise-${dayOfWeek}`,
        muscleGroup: 'Chest',
        notes: null,
        orderIndex: 0,
        reps: 8,
        restSeconds: 90,
        sets: 3,
        weightKgTarget: 30,
      },
    ],
    focusLabel: 'Push',
    id: `schedule-${dayOfWeek}`,
    notes: null,
    weekNumber: 1,
  })),
};

function session(
  overrides: Partial<WorkoutSessionSummaryRecord>,
): WorkoutSessionSummaryRecord {
  return {
    cancelledAt: null,
    completedAt: null,
    createdAt: '2026-08-02T04:00:00.000Z',
    durationSeconds: null,
    exerciseLogCount: 0,
    id: 'session-1',
    lastActivityAt: '2026-08-02T04:00:00.000Z',
    plan: null,
    planId: plan.id,
    startedAt: '2026-08-02T04:00:00.000Z',
    status: 'in_progress',
    totalVolumeKg: null,
    updatedAt: '2026-08-02T04:00:00.000Z',
    userId: plan.userId,
    ...overrides,
  };
}

describe('coach plan calendar', () => {
  it('derives completed, scheduled, skipped, and empty days from real session states', () => {
    const week = buildCoachPlanCalendarWeek(
      plan,
      [
        session({
          completedAt: '2026-08-02T05:00:00.000Z',
          id: 'completed',
          startedAt: '2026-08-02T04:00:00.000Z',
          status: 'completed',
        }),
        session({
          cancelledAt: '2026-08-04T05:00:00.000Z',
          id: 'skipped',
          startedAt: '2026-08-04T04:00:00.000Z',
          status: 'cancelled',
        }),
      ],
      new Date('2026-08-05T04:00:00.000Z'),
    );

    expect(week.map((day) => day.state)).toEqual([
      'completed',
      'scheduled',
      'skipped',
      'empty',
      'empty',
      'empty',
      'empty',
    ]);
  });

  it('prefers completed evidence when a legacy record contains both timestamps', () => {
    const week = buildCoachPlanCalendarWeek(
      plan,
      [
        session({
          cancelledAt: '2026-08-02T05:00:00.000Z',
          completedAt: '2026-08-02T05:30:00.000Z',
          status: 'completed',
        }),
      ],
      new Date('2026-08-05T04:00:00.000Z'),
    );

    expect(week[0]?.state).toBe('completed');
  });

  it('prioritizes completed and skipped sessions over later in-progress retries', () => {
    const week = buildCoachPlanCalendarWeek(
      plan,
      [
        session({
          id: 'completed-first',
          completedAt: '2026-08-02T05:00:00.000Z',
          startedAt: '2026-08-02T04:00:00.000Z',
          status: 'completed',
        }),
        session({
          id: 'in-progress-later',
          startedAt: '2026-08-02T06:00:00.000Z',
          status: 'in_progress',
        }),
        session({
          id: 'skipped-first',
          cancelledAt: '2026-08-04T05:00:00.000Z',
          startedAt: '2026-08-04T04:00:00.000Z',
          status: 'cancelled',
        }),
        session({
          id: 'in-progress-after-skip',
          startedAt: '2026-08-04T06:00:00.000Z',
          status: 'in_progress',
        }),
      ],
      new Date('2026-08-05T04:00:00.000Z'),
    );

    expect(week[0]?.state).toBe('completed');
    expect(week[2]?.state).toBe('skipped');
  });

  it('keeps coach-plan recognition stable for canonical and legacy records', () => {
    expect(
      isCoachManagedTrainingPlan({ coachId: null, source: 'coach_assigned' }),
    ).toBe(true);
    expect(
      isCoachManagedTrainingPlan({
        coachId: 'coach-1',
        source: 'self_created',
      }),
    ).toBe(true);
    expect(
      isCoachManagedTrainingPlan({ coachId: null, source: 'self_created' }),
    ).toBe(false);
  });

  it('renders irregular monthly weeks and repeats the last coach schedule', () => {
    const irregularPlan: TrainingPlanDetailRecord = {
      ...plan,
      scheduleDays: [
        { ...plan.scheduleDays[0]!, dayOfWeek: 0, weekNumber: 1 },
        { ...plan.scheduleDays[0]!, dayOfWeek: 1, weekNumber: 2 },
        { ...plan.scheduleDays[0]!, dayOfWeek: 2, weekNumber: 3 },
        { ...plan.scheduleDays[0]!, dayOfWeek: 3, weekNumber: 4 },
      ],
    };

    const month = buildCoachPlanCalendarMonth(
      irregularPlan,
      [],
      new Date('2026-08-15T04:00:00.000Z'),
    );
    const day = (dateKey: string) =>
      month.find((candidate) => candidate.dateKey === dateKey);

    expect(month).toHaveLength(42);
    expect(day('2026-08-03')?.scheduleDays[0]?.weekNumber).toBe(2);
    expect(day('2026-08-11')?.scheduleDays[0]?.weekNumber).toBe(3);
    expect(day('2026-08-19')?.scheduleDays[0]?.weekNumber).toBe(4);
    expect(day('2026-08-26')?.scheduleDays[0]?.weekNumber).toBe(4);
    expect(day('2026-08-27')?.state).toBe('empty');
  });
});
