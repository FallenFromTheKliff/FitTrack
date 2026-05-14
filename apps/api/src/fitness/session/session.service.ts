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
import { progressionSourceEventType } from '../progression-source.types';
import { DateRangeDTO } from '../../user/dto/user-dto';
import { ActivityLevelService } from '../../user/activity-level.service';
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
  type WorkoutSessionExerciseSummary,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

@Injectable()
export class WorkoutSessionService {
  constructor(
    private readonly repo: WorkoutSessionRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly activityLevelService: ActivityLevelService,
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
    const validationSnapshot = this.toProgressionValidationSnapshot(updated);
    const sourceRevision = await this.repo.getNextWorkoutSourceRevision(
      updated.id,
    );
    const recordedAt = new Date().toISOString();

    this.emitWorkoutSessionCompleted({
      eventType: progressionSourceEventType,
      eventVersion: 1,
      sourceType: 'workout_session_completed',
      sourceId: updated.id,
      sourceRevision,
      idempotencyKey: `workout_session_completed:${updated.id}:${sourceRevision}`,
      sessionId: updated.id,
      userId: updated.user_id,
      planId: updated.plan_id ?? null,
      occurredAt: completedAt.toISOString(),
      recordedAt,
      completedAt: completedAt.toISOString(),
      durationSeconds,
      eligibilityState: validationSnapshot.eligibilityState,
      terminalState: validationSnapshot.terminalState,
      integrityState: validationSnapshot.integrityState,
      producerSystem: 'fitness-session-service',
      producerRuntime: 'backend',
      producerContext: {
        appSurface: 'api',
        producerVersion: 'batch2-v1',
        runtimeContext: {
          sessionStatus: updated.status,
        },
      },
      correlation: this.toProgressionCorrelation(updated),
      totalVolumeKg: totalVolumeKg.toFixed(2),
      exerciseLogCount: updated.exercise_logs.length,
      exerciseSummaries: updated.exercise_logs.map((log) =>
        this.toExerciseSummary(log),
      ),
      performanceSummary: {
        durationSeconds,
        exerciseLogCount: updated.exercise_logs.length,
        exerciseSummaries: updated.exercise_logs.map((log) =>
          this.toExerciseSummary(log),
        ),
        totalVolumeKg: totalVolumeKg.toFixed(2),
      },
      validationState: validationSnapshot.validationState,
      validationMetadata: validationSnapshot.validationMetadata,
    });
    await this.activityLevelService.recalculateForUser(userId);

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

  private toExerciseSummary(
    log: ExerciseLogRecord,
  ): WorkoutSessionExerciseSummary {
    return {
      exerciseLogId: log.id,
      exerciseId: log.exercise_id,
      exerciseNameSnapshot: log.exercise.name,
      muscleGroupHint: log.exercise.muscle_group,
      setNumber: log.set_number,
      repsCompleted: log.reps_completed ?? null,
      repsAiCounted: log.reps_ai_counted ?? null,
      weightKg: log.weight_kg?.toString() ?? null,
      durationSeconds: log.duration_seconds ?? null,
      poseSessionId: log.pose_session?.id ?? null,
    };
  }

  private toProgressionCorrelation(
    session: SessionDetailRecord,
  ): WorkoutSessionCompletedEvent['correlation'] {
    const poseSessionIds = session.exercise_logs
      .map((log) => log.pose_session?.id ?? null)
      .filter((id): id is string => id !== null);

    return {
      sessionId: session.id,
      poseSessionId: poseSessionIds[0] ?? null,
      poseSessionIds,
      planId: session.plan_id ?? null,
      exerciseLogIds: session.exercise_logs.map((log) => log.id),
      linkedSourceIds: poseSessionIds.map(
        (poseSessionId) => `pose_session_finalized:${poseSessionId}`,
      ),
    };
  }

  private toValidationMetadata(
    session: SessionDetailRecord,
  ): WorkoutSessionCompletedEvent['validationMetadata'] {
    return this.toProgressionValidationSnapshot(session).validationMetadata;
  }

  private toProgressionValidationSnapshot(
    session: SessionDetailRecord,
  ): Pick<
    WorkoutSessionCompletedEvent,
    | 'eligibilityState'
    | 'integrityState'
    | 'terminalState'
    | 'validationMetadata'
    | 'validationState'
  > {
    const hasPoseEvidence = session.exercise_logs.some(
      (log) => log.pose_session !== null,
    );
    const hasManualWeightInput = session.exercise_logs.some(
      (log) => log.weight_kg !== null,
    );
    const poseSessionsNeedingReview = session.exercise_logs
      .map((log) => log.pose_session)
      .filter((poseSession) => poseSession !== null)
      .filter((poseSession) => {
        if (!poseSession.ended_at) {
          return true;
        }

        const summary = isRecord(poseSession.analysis_summary)
          ? poseSession.analysis_summary
          : null;
        if (!summary) {
          return true;
        }

        const terminalState =
          typeof summary.terminal_state === 'string'
            ? summary.terminal_state
            : null;
        const integrityState =
          typeof summary.integrity_state === 'string'
            ? summary.integrity_state
            : null;
        const reviewRequiredMarkers = toStringArray(
          summary.review_required_markers,
        );
        const sessionQualityState =
          typeof summary.session_quality_state === 'string'
            ? summary.session_quality_state
            : null;
        const progressionDisposition =
          typeof summary.progression_disposition === 'string'
            ? summary.progression_disposition
            : null;
        const equipmentConflicts = toStringArray(summary.equipment_conflicts);

        return (
          terminalState === 'flagged' ||
          terminalState === 'rejected' ||
          integrityState === 'suspicious' ||
          reviewRequiredMarkers.length > 0 ||
          summary.review_recommended === true ||
          (sessionQualityState !== null && sessionQualityState !== 'stable') ||
          (progressionDisposition !== null &&
            progressionDisposition !== 'normal') ||
          equipmentConflicts.length > 0
        );
      });
    const containsFlaggedSets = poseSessionsNeedingReview.length > 0;
    const sourceQualityNotes: string[] = [];

    if (hasPoseEvidence) {
      sourceQualityNotes.push('linked_pose_sessions_present');
    }

    poseSessionsNeedingReview.forEach((poseSession) => {
      if (!poseSession.ended_at) {
        sourceQualityNotes.push(`pose_session_unfinalized:${poseSession.id}`);
        return;
      }

      sourceQualityNotes.push(`pose_session_requires_review:${poseSession.id}`);
      const summary = isRecord(poseSession.analysis_summary)
        ? poseSession.analysis_summary
        : null;
      if (!summary) {
        return;
      }

      const sessionQualityState =
        typeof summary.session_quality_state === 'string'
          ? summary.session_quality_state
          : null;
      if (sessionQualityState && sessionQualityState !== 'stable') {
        sourceQualityNotes.push(
          `pose_session_quality:${sessionQualityState}:${poseSession.id}`,
        );
      }
      toStringArray(summary.integrity_reason_codes).forEach((reason) => {
        sourceQualityNotes.push(`pose_integrity_reason:${reason}`);
      });
      toStringArray(summary.equipment_conflicts).forEach((conflict) => {
        sourceQualityNotes.push(`pose_equipment_conflict:${conflict}`);
      });
    });

    if (containsFlaggedSets) {
      sourceQualityNotes.unshift('flagged_pose_sessions_present');
    }

    if (!containsFlaggedSets) {
      return {
        eligibilityState: 'eligible',
        integrityState: 'clean',
        terminalState: 'accepted',
        validationState: 'validated',
        validationMetadata: {
          hasPoseEvidence,
          hasManualWeightInput,
          containsFlaggedSets: false,
          correctionOrigin: null,
          sourceQualityNotes,
        },
      };
    }

    return {
      eligibilityState: 'review_required',
      integrityState: 'suspicious',
      terminalState: 'flagged',
      validationState: 'flagged',
      validationMetadata: {
        hasPoseEvidence,
        hasManualWeightInput,
        containsFlaggedSets: true,
        correctionOrigin: 'linked_pose_session',
        sourceQualityNotes,
      },
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
