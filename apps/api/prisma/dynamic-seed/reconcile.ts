import {
  AppointmentStatus,
  CoachWorkoutAssignmentSource,
  CoachWorkoutAssignmentState,
  RecurringCoachingScheduleItemStatus,
  RecurringCoachingSessionState,
} from '@prisma/client';
import { seedId } from './ids';
import { daysFrom } from './time';
import type { DynamicSeedContext } from './types';

function scheduleItemStatus(status: AppointmentStatus) {
  // A no-show is terminal history. It must never look like an activated
  // payable schedule item even though the appointment itself remains in the
  // no-show state for reporting and reschedule flows.
  if (
    status === AppointmentStatus.cancelled ||
    status === AppointmentStatus.no_show
  ) {
    return RecurringCoachingScheduleItemStatus.cancelled;
  }
  return RecurringCoachingScheduleItemStatus.activated;
}

function recurringSessionState(status: AppointmentStatus) {
  if (status === AppointmentStatus.completed) {
    return RecurringCoachingSessionState.completed;
  }
  if (status === AppointmentStatus.cancelled) {
    return RecurringCoachingSessionState.cancelled;
  }
  if (status === AppointmentStatus.no_show) {
    return RecurringCoachingSessionState.skipped;
  }
  return RecurringCoachingSessionState.generated;
}

export async function reconcileCoachingContracts(ctx: DynamicSeedContext) {
  const [plans, coachProfiles, trainingPlans, appointments] = await Promise.all(
    [
      ctx.prisma.recurringCoachingPlan.findMany({
        select: {
          id: true,
          member_id: true,
          coach_id: true,
          quoted_amount: true,
        },
      }),
      ctx.prisma.coachProfile.findMany({
        select: { id: true, user_id: true },
      }),
      ctx.prisma.trainingPlan.findMany({
        where: { source: 'coach_assigned', is_template: false },
        select: { id: true, user_id: true, coach_id: true },
      }),
      ctx.prisma.coachAppointment.findMany({
        orderBy: { scheduled_at: 'asc' },
        select: {
          id: true,
          completed_at: true,
          coach_id: true,
          duration_minutes: true,
          recurring_plan_id: true,
          scheduled_at: true,
          status: true,
          total_amount: true,
          user_id: true,
        },
      }),
    ],
  );

  const coachUserIds = new Map(
    coachProfiles.map((profile) => [profile.id, profile.user_id]),
  );
  const trainingPlanIds = trainingPlans.map((plan) => plan.id);
  const [scheduleDays, workoutSessions] = await Promise.all([
    ctx.prisma.trainingScheduleDay.findMany({
      where: {
        plan_id: { in: trainingPlanIds },
        exercises: { some: {} },
      },
      orderBy: [
        { plan_id: 'asc' },
        { week_number: 'asc' },
        { day_of_week: 'asc' },
      ],
      select: {
        day_of_week: true,
        exercises: {
          select: {
            duration_seconds: true,
            exercise_id: true,
            id: true,
            reps: true,
            sets: true,
            weight_kg_target: true,
          },
        },
        id: true,
        plan_id: true,
        week_number: true,
      },
    }),
    ctx.prisma.workoutSession.findMany({
      where: { plan_id: { in: trainingPlanIds }, status: 'completed' },
      orderBy: { started_at: 'asc' },
      select: { id: true, plan_id: true, user_id: true },
    }),
  ]);

  const planAppointments = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    if (!appointment.recurring_plan_id) {
      continue;
    }
    const rows = planAppointments.get(appointment.recurring_plan_id) ?? [];
    rows.push(appointment);
    planAppointments.set(appointment.recurring_plan_id, rows);
  }
  const scheduleDayByPlan = new Map<string, typeof scheduleDays>();
  for (const day of scheduleDays) {
    const rows = scheduleDayByPlan.get(day.plan_id) ?? [];
    rows.push(day);
    scheduleDayByPlan.set(day.plan_id, rows);
  }
  const sessionsByPlanAndUser = new Map<string, typeof workoutSessions>();
  for (const session of workoutSessions) {
    const key = `${session.plan_id}:${session.user_id}`;
    const rows = sessionsByPlanAndUser.get(key) ?? [];
    rows.push(session);
    sessionsByPlanAndUser.set(key, rows);
  }
  const trainingPlanByOwner = new Map<string, (typeof trainingPlans)[number]>();
  for (const trainingPlan of trainingPlans) {
    trainingPlanByOwner.set(
      `${trainingPlan.user_id}:${trainingPlan.coach_id}`,
      trainingPlan,
    );
  }
  const sessionCursorByPlanAndUser = new Map<string, number>();
  const workoutSessionModel = ctx.prisma.workoutSession as unknown as {
    create?: (input: { data: Record<string, unknown> }) => Promise<unknown>;
  };
  let scheduleItemCount = 0;
  let assignmentCount = 0;

  for (const plan of plans) {
    const memberAppointments = planAppointments.get(plan.id) ?? [];
    const coachUserId = coachUserIds.get(plan.coach_id);
    const trainingPlan = coachUserId
      ? trainingPlanByOwner.get(`${plan.member_id}:${coachUserId}`)
      : undefined;
    if (!trainingPlan) {
      continue;
    }

    const days = scheduleDayByPlan.get(trainingPlan.id) ?? [];
    if (days.length === 0) {
      continue;
    }

    await ctx.prisma.recurringCoachingPlan.update({
      where: { id: plan.id },
      data: {
        completed_sessions: memberAppointments.filter(
          (appointment) => appointment.status === AppointmentStatus.completed,
        ).length,
        quoted_amount: plan.quoted_amount,
        total_sessions: memberAppointments.length,
        training_plan_id: trainingPlan.id,
      },
    });

    for (const [sequenceIndex, appointment] of memberAppointments.entries()) {
      const scheduleDay = days[sequenceIndex % days.length];
      const scheduleItemId = seedIdForScheduleItem(appointment.id);
      await ctx.prisma.recurringCoachingScheduleItem.upsert({
        where: { id: scheduleItemId },
        update: {
          amount: appointment.total_amount,
          duration_minutes: appointment.duration_minutes,
          scheduled_at: appointment.scheduled_at,
          sequence_index: sequenceIndex,
          status: scheduleItemStatus(appointment.status),
          training_schedule_day_id: scheduleDay.id,
          created_at: daysFrom(appointment.scheduled_at, -7, 9),
        },
        create: {
          id: scheduleItemId,
          amount: appointment.total_amount,
          duration_minutes: appointment.duration_minutes,
          recurring_plan_id: plan.id,
          scheduled_at: appointment.scheduled_at,
          sequence_index: sequenceIndex,
          status: scheduleItemStatus(appointment.status),
          training_schedule_day_id: scheduleDay.id,
          created_at: daysFrom(appointment.scheduled_at, -7, 9),
        },
      });
      await ctx.prisma.coachAppointment.update({
        where: { id: appointment.id },
        data: {
          recurring_schedule_item_id: scheduleItemId,
          recurring_state: recurringSessionState(appointment.status),
        },
      });
      scheduleItemCount += 1;

      const sessionRows = sessionsByPlanAndUser.get(
        `${trainingPlan.id}:${appointment.user_id}`,
      );
      const sessionKey = `${trainingPlan.id}:${appointment.user_id}`;
      const sessionCursor = sessionCursorByPlanAndUser.get(sessionKey) ?? 0;
      let workoutSession =
        appointment.status === AppointmentStatus.completed
          ? sessionRows?.[sessionCursor]
          : undefined;
      if (
        appointment.status === AppointmentStatus.completed &&
        !workoutSession
      ) {
        const fallbackScheduleDay = days[sequenceIndex % days.length];
        const fallbackExercises = fallbackScheduleDay?.exercises ?? [];
        if (fallbackExercises.length === 0) {
          throw new Error(
            `completed appointment ${appointment.id} has no complete authored workout day`,
          );
        }
        const repairedSession = {
          completed_at:
            appointment.completed_at ??
            new Date(appointment.scheduled_at.getTime() + 3_600_000),
          created_at: daysFrom(appointment.scheduled_at, -1, 9),
          duration_seconds: appointment.duration_minutes * 60,
          id: seedId(`workout-session:reconcile:${appointment.id}`),
          last_activity_at:
            appointment.completed_at ??
            new Date(appointment.scheduled_at.getTime() + 3_600_000),
          plan: { connect: { id: trainingPlan.id } },
          started_at: appointment.scheduled_at,
          status: 'completed',
          total_volume_kg: fallbackExercises.reduce(
            (total, exercise) =>
              total +
              Number(exercise.weight_kg_target ?? 0) *
                Number(exercise.reps ?? 0) *
                Number(exercise.sets),
            0,
          ),
          user: { connect: { id: appointment.user_id } },
          exercise_logs: {
            create: fallbackExercises.flatMap((exercise) =>
              Array.from({ length: exercise.sets }, (_, setIndex) => ({
                created_at: new Date(
                  Math.min(
                    (
                      appointment.completed_at ??
                      new Date(appointment.scheduled_at.getTime() + 3_600_000)
                    ).getTime() - 1_000,
                    appointment.scheduled_at.getTime() +
                      (10 + setIndex * 3) * 60_000,
                  ),
                ),
                duration_seconds:
                  exercise.reps === null ? exercise.duration_seconds : null,
                exercise: { connect: { id: exercise.exercise_id } },
                plan_exercise_id: exercise.id,
                reps_completed: exercise.reps,
                reps_target: exercise.reps,
                set_number: setIndex + 1,
                user: { connect: { id: appointment.user_id } },
                weight_kg: exercise.weight_kg_target,
              })),
            ),
          },
        };
        if (!workoutSessionModel.create) {
          throw new Error(
            `completed appointment ${appointment.id} has no repairable workout session`,
          );
        }
        await workoutSessionModel.create({ data: repairedSession });
        workoutSession = {
          id: repairedSession.id,
          plan_id: trainingPlan.id,
          user_id: appointment.user_id,
        };
        sessionRows?.push(workoutSession);
      }
      if (workoutSession) {
        sessionCursorByPlanAndUser.set(sessionKey, sessionCursor + 1);
      }
      const terminalWithoutSession =
        appointment.status === AppointmentStatus.cancelled ||
        appointment.status === AppointmentStatus.no_show;
      const assignmentState = workoutSession
        ? CoachWorkoutAssignmentState.completed
        : terminalWithoutSession
          ? CoachWorkoutAssignmentState.skipped
          : CoachWorkoutAssignmentState.assigned;
      const overrideReason = null;
      const assignmentId = seedIdForAssignment(appointment.id);
      await ctx.prisma.coachWorkoutAssignment.upsert({
        where: { id: assignmentId },
        update: {
          assigned_at: daysFrom(appointment.scheduled_at, -7, 9),
          completed_at:
            assignmentState === CoachWorkoutAssignmentState.completed
              ? appointment.completed_at
              : null,
          held_at:
            assignmentState === CoachWorkoutAssignmentState.assigned
              ? null
              : appointment.scheduled_at,
          override_reason: overrideReason,
          sequence_index: sequenceIndex,
          source: CoachWorkoutAssignmentSource.automatic,
          state: assignmentState,
          training_plan_id: trainingPlan.id,
          training_schedule_day_id: scheduleDay.id,
          workout_session_id: workoutSession?.id ?? null,
          created_at: daysFrom(appointment.scheduled_at, -7, 9),
        },
        create: {
          id: assignmentId,
          appointment_id: appointment.id,
          assigned_at: daysFrom(appointment.scheduled_at, -7, 9),
          completed_at:
            assignmentState === CoachWorkoutAssignmentState.completed
              ? appointment.completed_at
              : null,
          held_at:
            assignmentState === CoachWorkoutAssignmentState.assigned
              ? null
              : appointment.scheduled_at,
          override_reason: overrideReason,
          sequence_index: sequenceIndex,
          source: CoachWorkoutAssignmentSource.automatic,
          state: assignmentState,
          training_plan_id: trainingPlan.id,
          training_schedule_day_id: scheduleDay.id,
          workout_session_id: workoutSession?.id ?? null,
          created_at: daysFrom(appointment.scheduled_at, -7, 9),
        },
      });
      assignmentCount += 1;
    }
  }

  const qaOneTimeAppointment = appointments.find(
    (appointment) =>
      appointment.user_id === ctx.state.userIds['member-active'] &&
      appointment.recurring_plan_id === null,
  );
  if (qaOneTimeAppointment) {
    const coachUserId = coachUserIds.get(qaOneTimeAppointment.coach_id);
    const trainingPlan = coachUserId
      ? trainingPlanByOwner.get(
          `${qaOneTimeAppointment.user_id}:${coachUserId}`,
        )
      : undefined;
    const scheduleDay = trainingPlan
      ? (scheduleDayByPlan.get(trainingPlan.id) ?? []).find(
          (candidate) => candidate.week_number === 1,
        )
      : undefined;
    if (trainingPlan && scheduleDay) {
      const assignmentId = seedIdForAssignment(qaOneTimeAppointment.id);
      await ctx.prisma.coachWorkoutAssignment.upsert({
        where: { id: assignmentId },
        update: {
          assigned_at: daysFrom(qaOneTimeAppointment.scheduled_at, -1, 9),
          completed_at: null,
          held_at: null,
          override_reason:
            'One-week coach assignment retained for one-time coaching QA.',
          sequence_index: 0,
          source: CoachWorkoutAssignmentSource.coach_override,
          state: CoachWorkoutAssignmentState.assigned,
          training_plan_id: trainingPlan.id,
          training_schedule_day_id: scheduleDay.id,
          workout_session_id: null,
          created_at: daysFrom(qaOneTimeAppointment.scheduled_at, -1, 9),
        },
        create: {
          id: assignmentId,
          appointment_id: qaOneTimeAppointment.id,
          assigned_at: daysFrom(qaOneTimeAppointment.scheduled_at, -1, 9),
          completed_at: null,
          held_at: null,
          override_reason:
            'One-week coach assignment retained for one-time coaching QA.',
          sequence_index: 0,
          source: CoachWorkoutAssignmentSource.coach_override,
          state: CoachWorkoutAssignmentState.assigned,
          training_plan_id: trainingPlan.id,
          training_schedule_day_id: scheduleDay.id,
          workout_session_id: null,
          created_at: daysFrom(qaOneTimeAppointment.scheduled_at, -1, 9),
        },
      });
      ctx.notableIds.qaRidgeOneTimeAppointmentId = qaOneTimeAppointment.id;
      ctx.notableIds.qaRidgeOneTimeAssignmentId = assignmentId;
    }
  }

  ctx.notableIds.coachingScheduleItemCount = String(scheduleItemCount);
  ctx.notableIds.coachWorkoutAssignmentCount = String(assignmentCount);
}

function seedIdForScheduleItem(appointmentId: string) {
  return seedId(`recurring-schedule-item:${appointmentId}`);
}

function seedIdForAssignment(appointmentId: string) {
  return seedId(`coach-workout-assignment:${appointmentId}`);
}
