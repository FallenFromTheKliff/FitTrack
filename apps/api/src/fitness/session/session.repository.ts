import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, ProgressionSourceType, SessionStatus } from '@prisma/client';

import {
  BaseRepository,
  PaginatedResult,
} from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { DateRangeDTO } from '../../user/dto/user-dto';

type WorkoutSessionSummaryRecord = Prisma.WorkoutSessionGetPayload<{
  include: typeof workoutSessionSummaryInclude;
}>;

type WorkoutSessionDetailRecord = Prisma.WorkoutSessionGetPayload<{
  include: typeof workoutSessionDetailInclude;
}>;

type ExerciseLogRecord = Prisma.ExerciseLogGetPayload<{
  include: typeof exerciseLogInclude;
}>;

type SessionPlanOwnershipRecord = {
  id: string;
  user_id: string;
};

type OneTimeWorkoutAssignmentRecord = {
  id: string;
  state: string;
  workout_session_id: string | null;
  appointment: {
    user_id: string;
    recurring_plan_id: string | null;
    scheduled_at: Date;
    status: string;
  };
};

type ActiveExerciseLookup = {
  id: string;
};

type PlanExerciseLookup = {
  id: string;
};

type PoseSessionOwnershipRecord = {
  id: string;
  user_id: string;
  exercise_log_id: string | null;
  rep_count_ai: number;
  ended_at: Date | null;
  analysis_summary: Prisma.JsonValue | null;
};

const workoutSessionPlanInclude =
  Prisma.validator<Prisma.TrainingPlanDefaultArgs>()({
    select: {
      id: true,
      title: true,
      goal: true,
      source: true,
    },
  });

const exerciseLogPoseSessionInclude =
  Prisma.validator<Prisma.PoseSessionDefaultArgs>()({
    select: {
      id: true,
      rep_count_ai: true,
      confidence_avg: true,
      analysis_summary: true,
      started_at: true,
      ended_at: true,
    },
  });

const exerciseLogInclude = Prisma.validator<Prisma.ExerciseLogInclude>()({
  exercise: true,
  pose_session: exerciseLogPoseSessionInclude,
});

const workoutSessionSummaryInclude =
  Prisma.validator<Prisma.WorkoutSessionInclude>()({
    plan: workoutSessionPlanInclude,
    _count: {
      select: {
        exercise_logs: true,
      },
    },
  });

const workoutSessionDetailInclude =
  Prisma.validator<Prisma.WorkoutSessionInclude>()({
    plan: workoutSessionPlanInclude,
    exercise_logs: {
      orderBy: [{ created_at: 'asc' }, { set_number: 'asc' }],
      include: exerciseLogInclude,
    },
  });

function readSourceRevision(
  sourceContext: Prisma.JsonValue | null | undefined,
): number | null {
  if (
    !sourceContext ||
    typeof sourceContext !== 'object' ||
    Array.isArray(sourceContext)
  ) {
    return null;
  }

  const sourceRevision = sourceContext.source_revision;
  return typeof sourceRevision === 'number' && Number.isFinite(sourceRevision)
    ? sourceRevision
    : null;
}

@Injectable()
export class WorkoutSessionRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  getMySessions(
    userId: string,
    dto: DateRangeDTO,
  ): Promise<PaginatedResult<WorkoutSessionSummaryRecord>> {
    return this.paginateByUserIdWithDateRange<WorkoutSessionSummaryRecord>(
      this.prisma.workoutSession,
      userId,
      {
        start_date: dto.start_date,
        end_date: dto.end_date,
        dateField: 'started_at',
      },
      {
        include: workoutSessionSummaryInclude,
        orderBy: [{ started_at: 'desc' }, { created_at: 'desc' }],
      },
      { page: dto.page, limit: dto.limit },
    );
  }

  findSessionByIdOrThrow(
    sessionId: string,
  ): Promise<WorkoutSessionDetailRecord> {
    return this.findByIdOrThrow<WorkoutSessionDetailRecord>(
      this.prisma.workoutSession,
      sessionId,
      'WorkoutSession',
      workoutSessionDetailInclude,
    );
  }

  findPlanOwnershipContextByIdOrThrow(
    planId: string,
  ): Promise<SessionPlanOwnershipRecord> {
    return this.findByIdOrThrow<SessionPlanOwnershipRecord>(
      this.prisma.trainingPlan,
      planId,
      'TrainingPlan',
      undefined,
      {
        id: true,
        user_id: true,
      },
    );
  }

  findOneTimeAssignmentByPlanId(
    planId: string,
  ): Promise<OneTimeWorkoutAssignmentRecord | null> {
    return this.prisma.coachWorkoutAssignment.findFirst({
      where: {
        training_plan_id: planId,
        appointment: { recurring_plan_id: null },
      },
      select: {
        id: true,
        state: true,
        workout_session_id: true,
        appointment: {
          select: {
            user_id: true,
            recurring_plan_id: true,
            scheduled_at: true,
            status: true,
          },
        },
      },
    });
  }

  findActiveExerciseById(id: string): Promise<ActiveExerciseLookup | null> {
    return this.prisma.exerciseCatalog.findFirst({
      where: {
        id,
        is_active: true,
      },
      select: {
        id: true,
      },
    });
  }

  findPlanExercise(
    planId: string,
    exerciseId: string,
    planExerciseId?: string,
  ): Promise<PlanExerciseLookup | null> {
    return this.prisma.planExercise.findFirst({
      where: {
        ...(planExerciseId ? { id: planExerciseId } : {}),
        exercise_id: exerciseId,
        schedule_day: { plan_id: planId },
      },
      orderBy: [{ order_index: 'asc' }, { created_at: 'asc' }],
      select: { id: true },
    });
  }

  listRecentExerciseLogsForAi(userId: string) {
    return this.prisma.exerciseLog.findMany({
      where: {
        user_id: userId,
        session: { status: SessionStatus.completed },
      },
      orderBy: { created_at: 'desc' },
      take: 40,
      select: {
        created_at: true,
        reps_completed: true,
        set_number: true,
        weight_kg: true,
        exercise: { select: { name: true } },
      },
    });
  }

  findPoseSessionByIdOrThrow(
    poseSessionId: string,
  ): Promise<PoseSessionOwnershipRecord> {
    return this.findByIdOrThrow<PoseSessionOwnershipRecord>(
      this.prisma.poseSession,
      poseSessionId,
      'PoseSession',
      undefined,
      {
        id: true,
        user_id: true,
        exercise_log_id: true,
        rep_count_ai: true,
        ended_at: true,
        analysis_summary: true,
      },
    );
  }

  createSession(input: {
    userId: string;
    planId: string | null;
    startedAt: Date;
    assignmentId?: string;
  }): Promise<WorkoutSessionDetailRecord> {
    if (!input.assignmentId) {
      return this.prisma.workoutSession.create({
        data: {
          user: { connect: { id: input.userId } },
          plan: input.planId ? { connect: { id: input.planId } } : undefined,
          status: SessionStatus.in_progress,
          started_at: input.startedAt,
          last_activity_at: input.startedAt,
        },
        include: workoutSessionDetailInclude,
      });
    }

    return this.transaction(async (tx) => {
      const claimed = await tx.coachWorkoutAssignment.updateMany({
        where: {
          id: input.assignmentId,
          state: 'assigned',
          workout_session_id: null,
        },
        data: { state: 'held', held_at: input.startedAt },
      });

      if (claimed.count !== 1) {
        const existing = await tx.coachWorkoutAssignment.findUnique({
          where: { id: input.assignmentId },
          select: { workout_session_id: true },
        });
        if (existing?.workout_session_id) {
          return tx.workoutSession.findUniqueOrThrow({
            where: { id: existing.workout_session_id },
            include: workoutSessionDetailInclude,
          });
        }
        throw new ConflictException('This session workout is already being started.');
      }

      const created = await tx.workoutSession.create({
        data: {
          user: { connect: { id: input.userId } },
          plan: input.planId ? { connect: { id: input.planId } } : undefined,
          status: SessionStatus.in_progress,
          started_at: input.startedAt,
          last_activity_at: input.startedAt,
        },
        include: workoutSessionDetailInclude,
      });

      await tx.coachWorkoutAssignment.update({
        where: { id: input.assignmentId },
        data: { workout_session_id: created.id },
      });

      return created;
    });
  }

  findExerciseLogById(id: string) {
    return this.prisma.exerciseLog.findUnique({ where: { id }, include: exerciseLogInclude });
  }

  async getNextWorkoutSourceRevision(sessionId: string): Promise<number> {
    const sourceEvent = await this.prisma.progressionSourceEvent.findUnique({
      where: {
        source_type_source_id: {
          source_id: sessionId,
          source_type: ProgressionSourceType.workout_session_completed,
        },
      },
      select: {
        source_context: true,
      },
    });

    return (readSourceRevision(sourceEvent?.source_context) ?? 0) + 1;
  }

  async createExerciseLog(input: {
    sessionId: string;
    userId: string;
    exerciseId: string;
    setNumber: number;
    repsCompleted: number | null;
    repsAiCounted: number | null;
    weightKg: Prisma.Decimal | null;
    durationSeconds: number | null;
    poseSessionId: string | null;
    planExerciseId: string | null;
    loggedAt: Date;
  }): Promise<ExerciseLogRecord> {
    try {
      return await this.transaction(async (tx) => {
        const created = await tx.exerciseLog.create({
          data: {
            session: { connect: { id: input.sessionId } },
            user: { connect: { id: input.userId } },
            exercise: { connect: { id: input.exerciseId } },
            plan_exercise_id: input.planExerciseId,
            set_number: input.setNumber,
            reps_completed: input.repsCompleted,
            reps_ai_counted: input.repsAiCounted,
            weight_kg: input.weightKg,
            duration_seconds: input.durationSeconds,
          },
        });

        if (input.poseSessionId) {
          const linked = await tx.poseSession.updateMany({
            where: { id: input.poseSessionId, user_id: input.userId, exercise_log_id: null },
            data: { exercise_log_id: created.id },
          });
          if (linked.count !== 1) throw new ConflictException('Pose session was already attached to a set.');
        }

        await tx.workoutSession.update({
          where: { id: input.sessionId },
          data: {
            last_activity_at: input.loggedAt,
          },
        });

        return tx.exerciseLog.findUniqueOrThrow({
          where: { id: created.id },
          include: exerciseLogInclude,
        });
      });
    } catch (error: unknown) {
      if (input.poseSessionId) {
        const pose = await this.prisma.poseSession.findUnique({ where: { id: input.poseSessionId }, select: { exercise_log_id: true } });
        const existing = pose?.exercise_log_id ? await this.findExerciseLogById(pose.exercise_log_id) : null;
        if (existing && existing.user_id === input.userId && existing.session_id === input.sessionId &&
            existing.exercise_id === input.exerciseId && existing.plan_exercise_id === input.planExerciseId &&
            existing.set_number === input.setNumber) return existing;
      }
      if (this.isDuplicateExerciseLogError(error)) {
        throw this.buildDuplicateSetConflict();
      }

      throw error;
    }
  }

  completeSession(input: {
    sessionId: string;
    completedAt: Date;
    durationSeconds: number;
    totalVolumeKg: Prisma.Decimal;
  }): Promise<WorkoutSessionDetailRecord> {
    return this.transaction(async (tx) => {
      const updated = await tx.workoutSession.update({
        where: { id: input.sessionId },
        data: {
          status: SessionStatus.completed,
          completed_at: input.completedAt,
          duration_seconds: input.durationSeconds,
          total_volume_kg: input.totalVolumeKg,
          last_activity_at: input.completedAt,
        },
        include: workoutSessionDetailInclude,
      });
      await tx.coachWorkoutAssignment.updateMany({
        where: { workout_session_id: input.sessionId },
        data: { state: 'completed', completed_at: input.completedAt },
      });
      return updated;
    });
  }

  cancelSession(
    sessionId: string,
    cancelledAt: Date,
  ): Promise<WorkoutSessionDetailRecord> {
    return this.transaction(async (tx) => {
      const updated = await tx.workoutSession.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.cancelled,
          cancelled_at: cancelledAt,
          last_activity_at: cancelledAt,
        },
        include: workoutSessionDetailInclude,
      });
      await tx.coachWorkoutAssignment.updateMany({
        where: { workout_session_id: sessionId },
        data: {
          state: 'assigned',
          workout_session_id: null,
          held_at: null,
          completed_at: null,
        },
      });
      return updated;
    });
  }

  async cancelAbandonedInProgressSessions(
    cutoff: Date,
    cancelledAt: Date,
  ): Promise<number> {
    const abandoned = await this.prisma.workoutSession.findMany({
      where: {
        status: SessionStatus.in_progress,
        last_activity_at: { lt: cutoff },
      },
      select: { id: true },
    });
    if (abandoned.length === 0) return 0;

    return this.transaction(async (tx) => {
      const result = await tx.workoutSession.updateMany({
        where: { id: { in: abandoned.map((session) => session.id) } },
        data: {
          status: SessionStatus.cancelled,
          cancelled_at: cancelledAt,
          last_activity_at: cancelledAt,
        },
      });
      await tx.coachWorkoutAssignment.updateMany({
        where: { workout_session_id: { in: abandoned.map((session) => session.id) } },
        data: {
          state: 'assigned',
          workout_session_id: null,
          held_at: null,
          completed_at: null,
        },
      });
      return result.count;
    });
  }

  private buildDuplicateSetConflict(): ConflictException {
    return new ConflictException({
      type: 'CONFLICT',
      title: 'Exercise Set Already Logged',
      status: 409,
      detail:
        'A set with this session, exercise, and set_number already exists.',
    });
  }

  private isDuplicateExerciseLogError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
