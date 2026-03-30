import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, SessionStatus } from '@prisma/client';

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

type ActiveExerciseLookup = {
  id: string;
};

type PoseSessionOwnershipRecord = {
  id: string;
  user_id: string;
  exercise_log_id: string | null;
  rep_count_ai: number;
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
      },
    );
  }

  createSession(input: {
    userId: string;
    planId: string | null;
    startedAt: Date;
  }): Promise<WorkoutSessionDetailRecord> {
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
    loggedAt: Date;
  }): Promise<ExerciseLogRecord> {
    try {
      return await this.transaction(async (tx) => {
        const created = await tx.exerciseLog.create({
          data: {
            session: { connect: { id: input.sessionId } },
            user: { connect: { id: input.userId } },
            exercise: { connect: { id: input.exerciseId } },
            set_number: input.setNumber,
            reps_completed: input.repsCompleted,
            reps_ai_counted: input.repsAiCounted,
            weight_kg: input.weightKg,
            duration_seconds: input.durationSeconds,
          },
        });

        if (input.poseSessionId) {
          await tx.poseSession.update({
            where: { id: input.poseSessionId },
            data: {
              exercise_log: { connect: { id: created.id } },
            },
          });
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
    return this.prisma.workoutSession.update({
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
  }

  cancelSession(
    sessionId: string,
    cancelledAt: Date,
  ): Promise<WorkoutSessionDetailRecord> {
    return this.prisma.workoutSession.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.cancelled,
        cancelled_at: cancelledAt,
        last_activity_at: cancelledAt,
      },
      include: workoutSessionDetailInclude,
    });
  }

  async cancelAbandonedInProgressSessions(
    cutoff: Date,
    cancelledAt: Date,
  ): Promise<number> {
    const result = await this.prisma.workoutSession.updateMany({
      where: {
        status: SessionStatus.in_progress,
        last_activity_at: { lt: cutoff },
      },
      data: {
        status: SessionStatus.cancelled,
        cancelled_at: cancelledAt,
        last_activity_at: cancelledAt,
      },
    });

    return result.count;
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
