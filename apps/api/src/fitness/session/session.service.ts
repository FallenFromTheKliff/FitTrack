import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, SessionStatus } from '@prisma/client';

import { PaginatedResult } from '../../common/base-repository/base-repository';
import { DateRangeDTO } from '../../user/dto/user-dto';
import {
  ExerciseLogResponseDTO,
  LogExerciseSetDTO,
  StartSessionDTO,
  WorkoutSessionPlanSummaryResponseDTO,
  WorkoutSessionDetailResponseDTO,
  WorkoutSessionSummaryResponseDTO,
} from './dto/session.dto';
import {
  WORKOUT_SESSION_COMPLETED_EVENT,
  type WorkoutSessionCompletedEvent,
} from './events/workout-session-completed.event';
import { WorkoutSessionRepository } from './session.repository';

type SessionDetailRecord = Awaited<
  ReturnType<WorkoutSessionRepository['findSessionByIdOrThrow']>
>;

type SessionSummaryRecord = Awaited<
  ReturnType<WorkoutSessionRepository['getMySessions']>
>['data'][number];

type ExerciseLogRecord = Awaited<
  ReturnType<WorkoutSessionRepository['createExerciseLog']>
>;

@Injectable()
export class WorkoutSessionService {
  constructor(
    private readonly repo: WorkoutSessionRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async listSessions(
    userId: string,
    dto: DateRangeDTO,
  ): Promise<PaginatedResult<WorkoutSessionSummaryResponseDTO>> {
    const result = await this.repo.getMySessions(userId, dto);

    return {
      data: result.data.map((session) => this.toSummaryResponse(session)),
      meta: result.meta,
    };
  }

  async getSessionById(
    userId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailResponseDTO> {
    const session = await this.repo.findSessionByIdOrThrow(sessionId);
    this.assertSessionOwner(session, userId);
    return this.toDetailResponse(session);
  }

  async startSession(
    userId: string,
    dto: StartSessionDTO,
  ): Promise<WorkoutSessionDetailResponseDTO> {
    if (dto.plan_id) {
      const plan = await this.repo.findPlanOwnershipContextByIdOrThrow(
        dto.plan_id,
      );

      if (plan.user_id !== userId) {
        throw new ForbiddenException({
          type: 'FORBIDDEN',
          title: 'Workout Session Forbidden',
          status: 403,
          detail: 'You can only start workout sessions from your own plans.',
        });
      }
    }

    const created = await this.repo.createSession({
      userId,
      planId: dto.plan_id ?? null,
      startedAt: new Date(),
    });

    return this.toDetailResponse(created);
  }

  async logSet(
    userId: string,
    sessionId: string,
    dto: LogExerciseSetDTO,
  ): Promise<ExerciseLogResponseDTO> {
    const session = await this.repo.findSessionByIdOrThrow(sessionId);
    this.assertSessionOwner(session, userId);
    this.assertSessionInProgress(session);

    const exercise = await this.repo.findActiveExerciseById(dto.exercise_id);
    if (!exercise) {
      throw this.buildValidationException(
        'Invalid Exercise',
        'The selected exercise is missing or inactive.',
      );
    }

    let repsAiCounted: number | null = null;
    if (dto.pose_session_id) {
      const poseSession = await this.repo.findPoseSessionByIdOrThrow(
        dto.pose_session_id,
      );

      if (poseSession.user_id !== userId) {
        throw new ForbiddenException({
          type: 'FORBIDDEN',
          title: 'Pose Session Forbidden',
          status: 403,
          detail:
            'You can only attach your own pose sessions to a workout set.',
        });
      }

      if (poseSession.exercise_log_id) {
        throw new ConflictException({
          type: 'CONFLICT',
          title: 'Pose Session Already Linked',
          status: 409,
          detail:
            'This pose session is already linked to another exercise log.',
        });
      }

      repsAiCounted = poseSession.rep_count_ai;
    }

    const created = await this.repo.createExerciseLog({
      sessionId,
      userId,
      exerciseId: exercise.id,
      setNumber: dto.set_number,
      repsCompleted: dto.reps_completed ?? null,
      repsAiCounted,
      weightKg:
        dto.weight_kg === undefined ? null : new Prisma.Decimal(dto.weight_kg),
      durationSeconds: dto.duration_seconds ?? null,
      poseSessionId: dto.pose_session_id ?? null,
      loggedAt: new Date(),
    });

    return this.toExerciseLogResponse(created);
  }

  async completeSession(
    userId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailResponseDTO> {
    const session = await this.repo.findSessionByIdOrThrow(sessionId);
    this.assertSessionOwner(session, userId);
    this.assertSessionInProgress(session);

    const completedAt = new Date();
    const durationSeconds = Math.max(
      0,
      Math.floor((completedAt.getTime() - session.started_at.getTime()) / 1000),
    );
    const totalVolumeKg = session.exercise_logs.reduce(
      (total, log) =>
        total.plus(
          (log.weight_kg ?? new Prisma.Decimal(0)).times(
            log.reps_completed ?? log.reps_ai_counted ?? 0,
          ),
        ),
      new Prisma.Decimal(0),
    );

    const updated = await this.repo.completeSession({
      sessionId,
      completedAt,
      durationSeconds,
      totalVolumeKg,
    });

    this.emitWorkoutSessionCompleted({
      sessionId: updated.id,
      userId: updated.user_id,
      planId: updated.plan_id ?? null,
      completedAt: completedAt.toISOString(),
      durationSeconds,
      totalVolumeKg: totalVolumeKg.toFixed(2),
      exerciseLogCount: updated.exercise_logs.length,
    });

    return this.toDetailResponse(updated);
  }

  async cancelSession(
    userId: string,
    sessionId: string,
  ): Promise<WorkoutSessionDetailResponseDTO> {
    const session = await this.repo.findSessionByIdOrThrow(sessionId);
    this.assertSessionOwner(session, userId);
    this.assertSessionInProgress(session);

    const updated = await this.repo.cancelSession(sessionId, new Date());
    return this.toDetailResponse(updated);
  }

  private assertSessionOwner(
    session: Pick<SessionDetailRecord, 'user_id'>,
    userId: string,
  ): void {
    if (session.user_id !== userId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Workout Session Forbidden',
        status: 403,
        detail: 'You can only access your own workout sessions.',
      });
    }
  }

  private assertSessionInProgress(
    session: Pick<SessionDetailRecord, 'status'>,
  ): void {
    if (session.status !== SessionStatus.in_progress) {
      throw this.buildValidationException(
        'Workout Session Not Active',
        'Only in-progress workout sessions can be updated.',
      );
    }
  }

  private buildValidationException(
    title: string,
    detail: string,
  ): HttpException {
    return new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title,
        status: 422,
        detail,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private toSummaryResponse(
    session: SessionSummaryRecord,
  ): WorkoutSessionSummaryResponseDTO {
    return {
      id: session.id,
      user_id: session.user_id,
      plan_id: session.plan_id ?? null,
      status: session.status,
      started_at: session.started_at.toISOString(),
      completed_at: session.completed_at?.toISOString() ?? null,
      cancelled_at: session.cancelled_at?.toISOString() ?? null,
      duration_seconds: session.duration_seconds ?? null,
      total_volume_kg: session.total_volume_kg?.toString() ?? null,
      last_activity_at: session.last_activity_at.toISOString(),
      exercise_log_count: session._count.exercise_logs,
      plan: this.toPlanSummary(session.plan),
      created_at: session.created_at.toISOString(),
      updated_at: session.updated_at.toISOString(),
    };
  }

  private toDetailResponse(
    session: SessionDetailRecord,
  ): WorkoutSessionDetailResponseDTO {
    return {
      id: session.id,
      user_id: session.user_id,
      plan_id: session.plan_id ?? null,
      status: session.status,
      started_at: session.started_at.toISOString(),
      completed_at: session.completed_at?.toISOString() ?? null,
      cancelled_at: session.cancelled_at?.toISOString() ?? null,
      duration_seconds: session.duration_seconds ?? null,
      total_volume_kg: session.total_volume_kg?.toString() ?? null,
      last_activity_at: session.last_activity_at.toISOString(),
      exercise_log_count: session.exercise_logs.length,
      plan: this.toPlanSummary(session.plan),
      created_at: session.created_at.toISOString(),
      updated_at: session.updated_at.toISOString(),
      exercise_logs: session.exercise_logs.map((log) =>
        this.toExerciseLogResponse(log),
      ),
    };
  }

  private toExerciseLogResponse(
    log: ExerciseLogRecord,
  ): ExerciseLogResponseDTO {
    return {
      id: log.id,
      session_id: log.session_id,
      user_id: log.user_id,
      plan_exercise_id: log.plan_exercise_id ?? null,
      exercise_id: log.exercise_id,
      exercise_name: log.exercise.name,
      set_number: log.set_number,
      reps_completed: log.reps_completed ?? null,
      reps_ai_counted: log.reps_ai_counted ?? null,
      weight_kg: log.weight_kg?.toString() ?? null,
      duration_seconds: log.duration_seconds ?? null,
      pose_session: log.pose_session
        ? {
            id: log.pose_session.id,
            rep_count_ai: log.pose_session.rep_count_ai,
            confidence_avg: log.pose_session.confidence_avg?.toString() ?? null,
            started_at: log.pose_session.started_at.toISOString(),
            ended_at: log.pose_session.ended_at?.toISOString() ?? null,
          }
        : null,
      created_at: log.created_at.toISOString(),
      updated_at: log.updated_at.toISOString(),
    };
  }

  private toPlanSummary(
    plan: {
      id: string;
      title: string;
      goal: WorkoutSessionPlanSummaryResponseDTO['goal'];
      source: WorkoutSessionPlanSummaryResponseDTO['source'];
    } | null,
  ): WorkoutSessionPlanSummaryResponseDTO | null {
    if (!plan) {
      return null;
    }

    return {
      id: plan.id,
      title: plan.title,
      goal: plan.goal,
      source: plan.source,
    };
  }

  private emitWorkoutSessionCompleted(
    event: WorkoutSessionCompletedEvent,
  ): void {
    this.eventEmitter.emit(WORKOUT_SESSION_COMPLETED_EVENT, event);
  }
}
