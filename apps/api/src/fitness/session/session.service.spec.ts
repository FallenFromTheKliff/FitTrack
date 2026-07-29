import {
  ConflictException,
  ForbiddenException,
  HttpException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { FitnessGoal, PlanSource, Prisma, SessionStatus } from '@prisma/client';

import { ActivityLevelService } from '../../user/activity-level.service';
import {
  WORKOUT_SESSION_COMPLETED_EVENT,
  type WorkoutSessionCompletedEvent,
} from './events/workout-session-completed.event';
import { WorkoutSessionRepository } from './session.repository';
import { WorkoutSessionService } from './session.service';

describe('WorkoutSessionService', () => {
  let service: WorkoutSessionService;

  const repo = {
    getMySessions: jest.fn(),
    findSessionByIdOrThrow: jest.fn(),
    findPlanOwnershipContextByIdOrThrow: jest.fn(),
    findActiveExerciseById: jest.fn(),
    findPlanExercise: jest.fn(),
    findPoseSessionByIdOrThrow: jest.fn(),
    getNextWorkoutSourceRevision: jest.fn(),
    createSession: jest.fn(),
    createExerciseLog: jest.fn(),
    completeSession: jest.fn(),
    cancelSession: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const activityLevelService = {
    recalculateForUser: jest.fn(),
  };

  const makeSession = (overrides: Record<string, unknown> = {}) => ({
    id: 'session-1',
    user_id: 'user-1',
    plan_id: 'plan-1',
    status: SessionStatus.in_progress,
    started_at: new Date('2026-03-26T08:00:00.000Z'),
    completed_at: null,
    cancelled_at: null,
    duration_seconds: null,
    total_volume_kg: null,
    last_activity_at: new Date('2026-03-26T08:15:00.000Z'),
    created_at: new Date('2026-03-26T08:00:00.000Z'),
    updated_at: new Date('2026-03-26T08:15:00.000Z'),
    plan: {
      id: 'plan-1',
      title: 'Upper / Lower Strength Builder',
      goal: FitnessGoal.bulking,
      source: PlanSource.self_created,
    },
    exercise_logs: [
      {
        id: 'log-1',
        session_id: 'session-1',
        user_id: 'user-1',
        plan_exercise_id: null,
        exercise_id: 'exercise-1',
        set_number: 1,
        reps_target: null,
        reps_completed: 12,
        reps_ai_counted: null,
        weight_kg: new Prisma.Decimal('40'),
        duration_seconds: null,
        created_at: new Date('2026-03-26T08:10:00.000Z'),
        updated_at: new Date('2026-03-26T08:10:00.000Z'),
        exercise: {
          id: 'exercise-1',
          name: 'Barbell Back Squat',
          muscle_group: 'legs',
        },
        pose_session: null,
      },
    ],
    ...overrides,
  });

  const makeSessionListItem = (overrides: Record<string, unknown> = {}) => ({
    id: 'session-1',
    user_id: 'user-1',
    plan_id: 'plan-1',
    status: SessionStatus.completed,
    started_at: new Date('2026-03-26T08:00:00.000Z'),
    completed_at: new Date('2026-03-26T08:45:00.000Z'),
    cancelled_at: null,
    duration_seconds: 2700,
    total_volume_kg: new Prisma.Decimal('1440.00'),
    last_activity_at: new Date('2026-03-26T08:45:00.000Z'),
    created_at: new Date('2026-03-26T08:00:00.000Z'),
    updated_at: new Date('2026-03-26T08:45:00.000Z'),
    plan: {
      id: 'plan-1',
      title: 'Upper / Lower Strength Builder',
      goal: FitnessGoal.bulking,
      source: PlanSource.self_created,
    },
    _count: {
      exercise_logs: 3,
    },
    ...overrides,
  });

  const makeExerciseLog = (overrides: Record<string, unknown> = {}) => ({
    id: 'log-2',
    session_id: 'session-1',
    user_id: 'user-1',
    plan_exercise_id: null,
    exercise_id: 'exercise-1',
    set_number: 2,
    reps_target: null,
    reps_completed: 10,
    reps_ai_counted: 12,
    weight_kg: new Prisma.Decimal('42.5'),
    duration_seconds: null,
    created_at: new Date('2026-03-26T08:18:00.000Z'),
    updated_at: new Date('2026-03-26T08:18:00.000Z'),
    exercise: {
      id: 'exercise-1',
      name: 'Barbell Back Squat',
      muscle_group: 'legs',
    },
    pose_session: {
      id: 'pose-1',
      rep_count_ai: 12,
      confidence_avg: new Prisma.Decimal('0.925'),
      analysis_summary: null,
      started_at: new Date('2026-03-26T08:16:00.000Z'),
      ended_at: new Date('2026-03-26T08:18:00.000Z'),
    },
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkoutSessionService,
        { provide: WorkoutSessionRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ActivityLevelService, useValue: activityLevelService },
      ],
    }).compile();

    service = module.get<WorkoutSessionService>(WorkoutSessionService);
    jest.clearAllMocks();
    repo.getNextWorkoutSourceRevision.mockResolvedValue(1);
  });

  it('maps paginated session history to summary DTOs', async () => {
    repo.getMySessions.mockResolvedValue({
      data: [makeSessionListItem()],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(service.listSessions('user-1', {})).resolves.toEqual({
      data: [
        expect.objectContaining({
          id: 'session-1',
          total_volume_kg: '1440',
          exercise_log_count: 3,
        }),
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
  });

  it('starts a session from an owned plan', async () => {
    repo.findPlanOwnershipContextByIdOrThrow.mockResolvedValue({
      id: 'plan-1',
      user_id: 'user-1',
    });
    repo.createSession.mockResolvedValue(makeSession());

    await expect(
      service.startSession('user-1', { plan_id: 'plan-1' }),
    ).resolves.toEqual(expect.objectContaining({ id: 'session-1' }));

    const [startInput] = repo.createSession.mock.calls as [
      [{ userId: string; planId: string; startedAt: Date }],
    ];

    expect(startInput[0]).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        planId: 'plan-1',
      }),
    );
    expect(startInput[0].startedAt).toBeInstanceOf(Date);
  });

  it('rejects starting a session from a plan owned by another user', async () => {
    repo.findPlanOwnershipContextByIdOrThrow.mockResolvedValue({
      id: 'plan-1',
      user_id: 'other-user-1',
    });

    await expect(
      service.startSession('user-1', { plan_id: 'plan-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('logs a set with linked pose session rep counts', async () => {
    repo.findSessionByIdOrThrow.mockResolvedValue(makeSession());
    repo.findActiveExerciseById.mockResolvedValue({ id: 'exercise-1' });
    repo.findPlanExercise.mockResolvedValue({ id: 'plan-exercise-1' });
    repo.findPoseSessionByIdOrThrow.mockResolvedValue({
      id: 'pose-1',
      user_id: 'user-1',
      exercise_log_id: null,
      rep_count_ai: 12,
    });
    repo.createExerciseLog.mockResolvedValue(makeExerciseLog());

    const result = await service.logSet('user-1', 'session-1', {
      exercise_id: 'exercise-1',
      set_number: 2,
      reps_completed: 10,
      weight_kg: 42.5,
      pose_session_id: 'pose-1',
    });

    expect(repo.createExerciseLog).toHaveBeenCalledWith(
      expect.objectContaining({
        repsAiCounted: 12,
        poseSessionId: 'pose-1',
        planExerciseId: 'plan-exercise-1',
      }),
    );
    expect(result.pose_session?.id).toBe('pose-1');
    expect(result.reps_ai_counted).toBe(12);
  });

  it('rejects logging sets against a completed session', async () => {
    repo.findSessionByIdOrThrow.mockResolvedValue(
      makeSession({ status: SessionStatus.completed }),
    );

    await expect(
      service.logSet('user-1', 'session-1', {
        exercise_id: 'exercise-1',
        set_number: 1,
      }),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('rejects pose sessions that are already linked elsewhere', async () => {
    repo.findSessionByIdOrThrow.mockResolvedValue(makeSession());
    repo.findActiveExerciseById.mockResolvedValue({ id: 'exercise-1' });
    repo.findPoseSessionByIdOrThrow.mockResolvedValue({
      id: 'pose-1',
      user_id: 'user-1',
      exercise_log_id: 'log-9',
      rep_count_ai: 9,
    });

    await expect(
      service.logSet('user-1', 'session-1', {
        exercise_id: 'exercise-1',
        set_number: 1,
        pose_session_id: 'pose-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('completes a session, computes totals, and emits the stable completion event', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-26T08:30:00.000Z'));
    repo.findSessionByIdOrThrow.mockResolvedValue(makeSession());
    repo.completeSession.mockResolvedValue(
      makeSession({
        status: SessionStatus.completed,
        completed_at: new Date('2026-03-26T08:30:00.000Z'),
        duration_seconds: 1800,
        total_volume_kg: new Prisma.Decimal('480.00'),
        last_activity_at: new Date('2026-03-26T08:30:00.000Z'),
      }),
    );

    await expect(
      service.completeSession('user-1', 'session-1'),
    ).resolves.toEqual(
      expect.objectContaining({ status: SessionStatus.completed }),
    );

    const [completeInput] = repo.completeSession.mock.calls as [
      [
        {
          sessionId: string;
          completedAt: Date;
          durationSeconds: number;
          totalVolumeKg: Prisma.Decimal;
        },
      ],
    ];

    expect(completeInput[0]).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        completedAt: new Date('2026-03-26T08:30:00.000Z'),
        durationSeconds: 1800,
      }),
    );
    expect(completeInput[0].totalVolumeKg).toBeInstanceOf(Prisma.Decimal);
    const [emittedEventName, emittedEvent] = eventEmitter.emit.mock
      .calls[0] as [string, WorkoutSessionCompletedEvent];

    expect(emittedEventName).toBe(WORKOUT_SESSION_COMPLETED_EVENT);
    expect(emittedEvent).toEqual(
      expect.objectContaining({
        eventType: 'progression_source_recorded',
        sourceType: 'workout_session_completed',
        sourceRevision: 1,
        idempotencyKey: 'workout_session_completed:session-1:1',
        sessionId: 'session-1',
        userId: 'user-1',
        durationSeconds: 1800,
        totalVolumeKg: '480.00',
        validationState: 'validated',
      }),
    );
    expect(repo.getNextWorkoutSourceRevision).toHaveBeenCalledWith('session-1');
    expect(emittedEvent.correlation).toEqual(
      expect.objectContaining({
        sessionId: 'session-1',
        exerciseLogIds: ['log-1'],
      }),
    );
    expect(emittedEvent.exerciseSummaries).toEqual([
      expect.objectContaining({
        exerciseLogId: 'log-1',
        muscleGroupHint: 'legs',
        exerciseNameSnapshot: 'Barbell Back Squat',
      }),
    ]);
    jest.useRealTimers();
  });

  it('accepts completion while surfacing linked pose integrity advisories', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-26T08:30:00.000Z'));
    const flaggedPoseSession = {
      id: 'pose-1',
      rep_count_ai: 12,
      confidence_avg: new Prisma.Decimal('0.925'),
      analysis_summary: {
        integrity_state: 'suspicious',
        terminal_state: 'flagged',
        review_required_markers: ['low_classification_confidence'],
      },
      started_at: new Date('2026-03-26T08:16:00.000Z'),
      ended_at: new Date('2026-03-26T08:18:00.000Z'),
    };
    repo.findSessionByIdOrThrow.mockResolvedValue(
      makeSession({
        exercise_logs: [makeExerciseLog({ pose_session: flaggedPoseSession })],
      }),
    );
    repo.completeSession.mockResolvedValue(
      makeSession({
        status: SessionStatus.completed,
        completed_at: new Date('2026-03-26T08:30:00.000Z'),
        duration_seconds: 1800,
        total_volume_kg: new Prisma.Decimal('510.00'),
        last_activity_at: new Date('2026-03-26T08:30:00.000Z'),
        exercise_logs: [makeExerciseLog({ pose_session: flaggedPoseSession })],
      }),
    );

    await service.completeSession('user-1', 'session-1');

    const [, emittedEvent] = eventEmitter.emit.mock.calls[0] as [
      string,
      WorkoutSessionCompletedEvent,
    ];
    expect(emittedEvent.validationState).toBe('validated');
    expect(emittedEvent.integrityState).toBe('suspicious');
    expect(emittedEvent.eligibilityState).toBe('eligible');
    expect(emittedEvent.terminalState).toBe('accepted');
    expect(emittedEvent.validationMetadata).toEqual({
      hasPoseEvidence: true,
      hasManualWeightInput: true,
      containsFlaggedSets: true,
      correctionOrigin: 'linked_pose_session',
      sourceQualityNotes: [
        'integrity_advisory_present',
        'linked_pose_sessions_present',
        'pose_session_requires_review:pose-1',
      ],
    });
    jest.useRealTimers();
  });

  it('bumps workout source revision when a completion source is replayed', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-26T08:30:00.000Z'));
    repo.getNextWorkoutSourceRevision.mockResolvedValue(3);
    repo.findSessionByIdOrThrow.mockResolvedValue(makeSession());
    repo.completeSession.mockResolvedValue(
      makeSession({
        status: SessionStatus.completed,
        completed_at: new Date('2026-03-26T08:30:00.000Z'),
        duration_seconds: 1800,
        total_volume_kg: new Prisma.Decimal('480.00'),
        last_activity_at: new Date('2026-03-26T08:30:00.000Z'),
      }),
    );

    await service.completeSession('user-1', 'session-1');

    const [, emittedEvent] = eventEmitter.emit.mock.calls[0] as [
      string,
      WorkoutSessionCompletedEvent,
    ];
    expect(emittedEvent.sourceRevision).toBe(3);
    expect(emittedEvent.idempotencyKey).toBe(
      'workout_session_completed:session-1:3',
    );
    jest.useRealTimers();
  });

  it('cancels an owned in-progress session', async () => {
    repo.findSessionByIdOrThrow.mockResolvedValue(makeSession());
    repo.cancelSession.mockResolvedValue(
      makeSession({
        status: SessionStatus.cancelled,
        cancelled_at: new Date('2026-03-26T08:20:00.000Z'),
      }),
    );

    const result = await service.cancelSession('user-1', 'session-1');

    expect(repo.cancelSession).toHaveBeenCalledWith(
      'session-1',
      expect.any(Date),
    );
    expect(result.status).toBe(SessionStatus.cancelled);
  });
});
