import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { MasteryRank, Prisma } from '@prisma/client';

import type { PaginationDTO } from '../../user/dto/user-dto';
import { UserService } from '../../user/user.service';
import { type PoseSessionFinalizedEvent } from '../pose/events/pose-session-finalized.event';
import { type WorkoutSessionCompletedEvent } from '../session/events/workout-session-completed.event';
import { GAMIFICATION_RANK_UP_EVENT } from './events/rank-up.event';
import { GamificationRepository } from './gamification.repository';
import { GamificationService } from './gamification.service';

describe('GamificationService', () => {
  let service: GamificationService;

  const repo = {
    applyRankingOverride: jest.fn(),
    applyWorkoutCompletionProgression: jest.fn(),
    createIntegrityCase: jest.fn(),
    getAdminOverview: jest.fn(),
    getActiveSeasonStanding: jest.fn(),
    getIntegrityCaseById: jest.fn(),
    getIntegritySummary: jest.fn(),
    getMilestoneProgressById: jest.fn(),
    getProgressionProfile: jest.fn(),
    getProgressionGrantById: jest.fn(),
    getRankingProfile: jest.fn(),
    getSeasonById: jest.fn(),
    listRankingProfiles: jest.fn(),
    listMilestoneProgress: jest.fn(),
    listMuscleMastery: jest.fn(),
    listProgressionSources: jest.fn(),
    listLeaderboardTotals: jest.fn(),
    listAdminMilestoneDefinitions: jest.fn(),
    listAdminSeasons: jest.fn(),
    listAdminSeasonStandings: jest.fn(),
    listWorkoutCompletionLogs: jest.fn(),
    recordPoseSessionProgressionSource: jest.fn(),
    reconcileWorkoutSourceReviewFromPose: jest.fn(),
    resolveIntegrityCase: jest.fn(),
    restoreProgressionGrant: jest.fn(),
    syncMilestoneProgressForUser: jest.fn(),
    updateCreatorState: jest.fn(),
    upsertRankingProfile: jest.fn(),
    upsertMuscleMasteryProgress: jest.fn(),
    updateMuscleMasteryRank: jest.fn(),
    updateSeasonStatus: jest.fn(),
    claimMilestoneProgress: jest.fn(),
    voidProgressionGrant: jest.fn(),
  };

  const userService = {
    listGamificationParticipants: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const makeWorkoutCompletedEvent = (
    overrides: Partial<WorkoutSessionCompletedEvent> = {},
  ): WorkoutSessionCompletedEvent => ({
    eventType: 'progression_source_recorded',
    eventVersion: 1,
    sourceType: 'workout_session_completed',
    sourceId: 'session-1',
    sourceRevision: 1,
    idempotencyKey: 'workout_session_completed:session-1:1',
    sessionId: 'session-1',
    userId: 'user-1',
    planId: null,
    occurredAt: '2026-03-27T03:00:00.000Z',
    recordedAt: '2026-03-27T03:00:05.000Z',
    completedAt: '2026-03-27T03:00:00.000Z',
    durationSeconds: 1800,
    totalVolumeKg: '800.00',
    exerciseLogCount: 3,
    eligibilityState: 'eligible',
    terminalState: 'accepted',
    integrityState: 'clean',
    validationState: 'validated',
    producerSystem: 'fitness-session-service',
    producerRuntime: 'backend',
    producerContext: {
      appSurface: 'api',
      producerVersion: 'batch2-v1',
      runtimeContext: { sessionStatus: 'completed' },
    },
    correlation: {
      sessionId: 'session-1',
      poseSessionId: 'pose-1',
      poseSessionIds: ['pose-1'],
      planId: null,
      exerciseLogIds: ['log-1', 'log-2', 'log-3'],
      linkedSourceIds: ['pose_session_finalized:pose-1'],
    },
    exerciseSummaries: [
      {
        exerciseLogId: 'log-1',
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Barbell Back Squat',
        muscleGroupHint: 'legs',
        setNumber: 1,
        repsCompleted: 10,
        repsAiCounted: null,
        weightKg: '50',
        durationSeconds: null,
        poseSessionId: null,
      },
      {
        exerciseLogId: 'log-2',
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Barbell Back Squat',
        muscleGroupHint: 'legs',
        setNumber: 2,
        repsCompleted: 8,
        repsAiCounted: null,
        weightKg: '25',
        durationSeconds: null,
        poseSessionId: 'pose-1',
      },
      {
        exerciseLogId: 'log-3',
        exerciseId: 'exercise-2',
        exerciseNameSnapshot: 'Bench Press',
        muscleGroupHint: 'chest',
        setNumber: 1,
        repsCompleted: 12,
        repsAiCounted: null,
        weightKg: '20',
        durationSeconds: null,
        poseSessionId: null,
      },
    ],
    performanceSummary: {
      durationSeconds: 1800,
      exerciseLogCount: 3,
      totalVolumeKg: '800.00',
      exerciseSummaries: [
        {
          exerciseLogId: 'log-1',
          exerciseId: 'exercise-1',
          exerciseNameSnapshot: 'Barbell Back Squat',
          muscleGroupHint: 'legs',
          setNumber: 1,
          repsCompleted: 10,
          repsAiCounted: null,
          weightKg: '50',
          durationSeconds: null,
          poseSessionId: null,
        },
        {
          exerciseLogId: 'log-2',
          exerciseId: 'exercise-1',
          exerciseNameSnapshot: 'Barbell Back Squat',
          muscleGroupHint: 'legs',
          setNumber: 2,
          repsCompleted: 8,
          repsAiCounted: null,
          weightKg: '25',
          durationSeconds: null,
          poseSessionId: 'pose-1',
        },
        {
          exerciseLogId: 'log-3',
          exerciseId: 'exercise-2',
          exerciseNameSnapshot: 'Bench Press',
          muscleGroupHint: 'chest',
          setNumber: 1,
          repsCompleted: 12,
          repsAiCounted: null,
          weightKg: '20',
          durationSeconds: null,
          poseSessionId: null,
        },
      ],
    },
    validationMetadata: {
      hasPoseEvidence: true,
      hasManualWeightInput: true,
      containsFlaggedSets: false,
      correctionOrigin: null,
      sourceQualityNotes: ['linked_pose_sessions_present'],
    },
    ...overrides,
  });

  const makePoseSessionFinalizedEvent = (
    overrides: Partial<PoseSessionFinalizedEvent> = {},
  ): PoseSessionFinalizedEvent => ({
    eventType: 'progression_source_recorded',
    eventVersion: 1,
    sourceType: 'pose_session_finalized',
    sourceId: 'pose-1',
    sourceRevision: 1,
    idempotencyKey: 'pose_session_finalized:pose-1:1',
    userId: 'user-1',
    occurredAt: '2026-03-27T08:05:00.000Z',
    recordedAt: '2026-03-27T08:05:00.000Z',
    startedAt: '2026-03-27T08:00:00.000Z',
    endedAt: '2026-03-27T08:05:00.000Z',
    terminalState: 'flagged',
    eligibilityState: 'review_required',
    integrityState: 'suspicious',
    producerSystem: 'pose-service',
    producerRuntime: 'web',
    producerContext: {
      appSurface: 'pose',
      producerVersion: 'batch2-v1',
      runtimeContext: {
        connectionMode: 'socket',
        endedReason: 'client_disconnect',
        subjectLockMode: 'single_subject',
      },
    },
    correlation: {
      sessionId: 'session-1',
      poseSessionId: 'pose-1',
      poseSessionIds: ['pose-1'],
      planId: null,
      exerciseLogIds: ['log-1'],
      linkedSourceIds: ['workout_session_completed:session-1'],
    },
    detectionSummary: {
      exerciseHint: 'Barbell Back Squat',
      detectedExerciseName: 'squat',
      candidateExercises: ['squat'],
      classificationSource: 'classifier',
      classificationConfidence: 0.62,
      averageConfidence: 0.61,
      matchedProfileId: 'profile-1',
      movementContractSnapshot: {
        exercise: 'squat',
        dominant_joint: 'knee',
        rep_thresholds: {
          down: { angle: 88, tolerance: 12 },
          up: { angle: 168, tolerance: 12 },
        },
        secondary_check: 'hips_back',
        oscillating_joints: ['hip', 'knee'],
      },
    },
    repEvidenceSummary: {
      finalRepCount: 12,
      dominantJoint: 'knee',
      oscillatingJoints: ['hip', 'knee'],
      rawAngleDataCount: 0,
      rawAngleDataReference: 'embedded',
      formFeedback: ['Keep your chest up.'],
    },
    qualitySummary: {
      cameraFacingMode: 'user',
      landmarkSchema: 'mediapipe_pose_v1',
      subjectLocked: true,
      subjectLockConfidence: 0.55,
      reliableFrameCount: 6,
      fallbackUsed: false,
      degradedReason: null,
      integrityMarkers: ['low_classification_confidence'],
    },
    policyInputs: {
      weightInputKg: null,
      manualEntryPresent: false,
      reviewRequiredMarkers: ['low_classification_confidence'],
    },
    ...overrides,
  });

  const makeMilestoneRecord = (
    status: 'in_progress' | 'unlocked' | 'claimed' = 'unlocked',
    definitionOverrides: Record<string, unknown> = {},
    progressOverrides: Record<string, unknown> | null = {},
  ) => ({
    id: 'milestone-1',
    key: 'first-workout-complete',
    title: 'First Workout Complete',
    description: 'Complete your first tracked workout session.',
    category: 'training',
    trigger_type: 'source_event',
    condition_payload: { target: 1, metric: 'completed_workout_sessions' },
    evidence_requirement: 'none',
    verification_policy: 'auto',
    reward_payload: { badge_tone: 'ember' },
    is_active: true,
    is_hidden: false,
    retired_at: null,
    created_at: new Date('2026-03-27T01:00:00.000Z'),
    updated_at: new Date('2026-03-27T01:00:00.000Z'),
    ...definitionOverrides,
    user_progress:
      progressOverrides === null
        ? []
        : [
            {
              id: 'progress-1',
              user_id: 'user-1',
              milestone_definition_id: 'milestone-1',
              status,
              progress_value: status === 'in_progress' ? 0 : 1,
              progress_payload: null,
              unlocked_at:
                status === 'in_progress'
                  ? null
                  : new Date('2026-03-27T03:00:00.000Z'),
              claimed_at:
                status === 'claimed'
                  ? new Date('2026-03-27T03:10:00.000Z')
                  : null,
              created_at: new Date('2026-03-27T03:00:00.000Z'),
              updated_at: new Date('2026-03-27T03:00:00.000Z'),
              ...progressOverrides,
            },
          ],
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: GamificationRepository, useValue: repo },
        { provide: UserService, useValue: userService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps mastery rows to response DTOs with display rank text', async () => {
    repo.listMuscleMastery.mockResolvedValue([
      {
        id: 'mastery-1',
        user_id: 'user-1',
        muscle_group: 'legs',
        total_volume_kg: new Prisma.Decimal('12500.00'),
        xp_points: 10250,
        rank: MasteryRank.adamantite,
        last_ranked_at: new Date('2026-03-27T03:00:00.000Z'),
        created_at: new Date('2026-03-27T02:00:00.000Z'),
        updated_at: new Date('2026-03-27T03:30:00.000Z'),
      },
    ]);

    await expect(service.getMuscleMastery('user-1', {})).resolves.toEqual([
      expect.objectContaining({
        id: 'mastery-1',
        muscle_group: 'legs',
        total_volume_kg: '12500.00',
        xp_points: 10250,
        rank: MasteryRank.adamantite,
        rank_display: 'Adamantite+ (250 EXP)',
      }),
    ]);
  });

  it('builds the leaderboard from participant profiles and total xp', async () => {
    userService.listGamificationParticipants.mockResolvedValue([
      {
        user_id: 'user-1',
        display_name: 'Alpha Coach',
        avatar_url: null,
      },
      {
        user_id: 'user-2',
        display_name: 'Bravo Member',
        avatar_url: 'https://cdn.fittrack.test/avatars/bravo.png',
      },
      {
        user_id: 'user-3',
        display_name: 'Charlie Member',
        avatar_url: null,
      },
    ]);
    repo.listLeaderboardTotals.mockResolvedValue([
      { user_id: 'user-2', total_xp: 450 },
      { user_id: 'user-1', total_xp: 900 },
    ]);
    repo.listRankingProfiles.mockResolvedValue([]);

    const result = await service.getLeaderboard({ page: 1, limit: 2 });

    expect(result).toEqual({
      data: [
        {
          rank_position: 1,
          user_id: 'user-1',
          display_name: 'Alpha Coach',
          avatar_url: null,
          total_xp: 900,
        },
        {
          rank_position: 2,
          user_id: 'user-2',
          display_name: 'Bravo Member',
          avatar_url: 'https://cdn.fittrack.test/avatars/bravo.png',
          total_xp: 450,
        },
      ],
      meta: {
        page: 1,
        limit: 2,
        total: 3,
        total_pages: 2,
      },
    });
  });

  it('uses zero xp for participants without mastery rows', async () => {
    userService.listGamificationParticipants.mockResolvedValue([
      {
        user_id: 'user-3',
        display_name: 'Charlie Member',
        avatar_url: null,
      },
    ]);
    repo.listLeaderboardTotals.mockResolvedValue([]);
    repo.listRankingProfiles.mockResolvedValue([]);

    await expect(service.getLeaderboard({} as PaginationDTO)).resolves.toEqual({
      data: [
        {
          rank_position: 1,
          user_id: 'user-3',
          display_name: 'Charlie Member',
          avatar_url: null,
          total_xp: 0,
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('honors anonymous and private ranking profiles when building the leaderboard', async () => {
    userService.listGamificationParticipants.mockResolvedValue([
      {
        user_id: 'user-1',
        display_name: 'Alpha Coach',
        avatar_url: null,
      },
      {
        user_id: 'user-2',
        display_name: 'Bravo Member',
        avatar_url: null,
      },
      {
        user_id: 'user-3',
        display_name: 'Charlie Member',
        avatar_url: null,
      },
    ]);
    repo.listLeaderboardTotals.mockResolvedValue([
      { user_id: 'user-1', total_xp: 900 },
      { user_id: 'user-2', total_xp: 450 },
      { user_id: 'user-3', total_xp: 100 },
    ]);
    repo.listRankingProfiles.mockResolvedValue([
      {
        user_id: 'user-2',
        visibility: 'anonymous',
        governance_status: 'anonymized_by_user',
        display_alias: 'Anonymous Phoenix',
        updated_at: new Date('2026-03-27T02:00:00.000Z'),
      },
      {
        user_id: 'user-3',
        visibility: 'private',
        governance_status: 'hidden_by_user',
        display_alias: null,
        updated_at: new Date('2026-03-27T02:00:00.000Z'),
      },
    ]);

    await expect(service.getLeaderboard({} as PaginationDTO)).resolves.toEqual({
      data: [
        {
          rank_position: 1,
          user_id: 'user-1',
          display_name: 'Alpha Coach',
          avatar_url: null,
          total_xp: 900,
        },
        {
          rank_position: 2,
          user_id: 'user-2',
          display_name: 'Anonymous Phoenix',
          avatar_url: null,
          total_xp: 450,
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 2,
        total_pages: 1,
      },
    });
  });

  it('computes per-muscle-group deltas with bodyweight xp fallback', () => {
    const deltas = service.computeDeltas([
      {
        exerciseLogId: 'log-1',
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Barbell Back Squat',
        muscleGroupHint: 'legs',
        setNumber: 1,
        repsCompleted: 12,
        repsAiCounted: null,
        weightKg: '50',
        durationSeconds: null,
        poseSessionId: null,
      },
      {
        exerciseLogId: 'log-2',
        exerciseId: 'exercise-1',
        exerciseNameSnapshot: 'Barbell Back Squat',
        muscleGroupHint: 'legs',
        setNumber: 2,
        repsCompleted: null,
        repsAiCounted: 15,
        weightKg: null,
        durationSeconds: null,
        poseSessionId: null,
      },
      {
        exerciseLogId: 'log-3',
        exerciseId: 'exercise-2',
        exerciseNameSnapshot: 'Bench Press',
        muscleGroupHint: 'chest',
        setNumber: 1,
        repsCompleted: 10,
        repsAiCounted: null,
        weightKg: '20',
        durationSeconds: null,
        poseSessionId: null,
      },
    ]);

    expect(deltas.get('legs')).toEqual({
      xp: 61,
      volumeKg: new Prisma.Decimal('600'),
    });
    expect(deltas.get('chest')).toEqual({
      xp: 20,
      volumeKg: new Prisma.Decimal('200'),
    });
  });

  it('promotes to the highest mastery tier crossed by xp or volume', () => {
    expect(service.evaluateRank(500, new Prisma.Decimal('4000'))).toBe(
      MasteryRank.silver,
    );
    expect(service.evaluateRank(400, new Prisma.Decimal('5500'))).toBe(
      MasteryRank.silver,
    );
    expect(service.evaluateRank(2100, new Prisma.Decimal('51000'))).toBe(
      MasteryRank.platinum,
    );
    expect(service.evaluateRank(2500, new Prisma.Decimal('100500'))).toBe(
      MasteryRank.adamantite,
    );
  });

  it('updates rank timestamps only when the rank changes', async () => {
    repo.upsertMuscleMasteryProgress.mockResolvedValue({
      id: 'mastery-1',
      user_id: 'user-1',
      muscle_group: 'legs',
      total_volume_kg: new Prisma.Decimal('5200'),
      xp_points: 520,
      rank: MasteryRank.bronze,
      last_ranked_at: null,
      created_at: new Date('2026-03-27T01:00:00.000Z'),
      updated_at: new Date('2026-03-27T01:00:00.000Z'),
    });
    repo.updateMuscleMasteryRank.mockResolvedValue({
      id: 'mastery-1',
      user_id: 'user-1',
      muscle_group: 'legs',
      total_volume_kg: new Prisma.Decimal('5200'),
      xp_points: 520,
      rank: MasteryRank.silver,
      last_ranked_at: new Date('2026-03-27T02:00:00.000Z'),
      created_at: new Date('2026-03-27T01:00:00.000Z'),
      updated_at: new Date('2026-03-27T02:00:00.000Z'),
    });

    await expect(
      service.upsertMastery('user-1', 'legs', {
        xp: 520,
        volumeKg: new Prisma.Decimal('5200'),
      }),
    ).resolves.toMatchObject({
      rank: MasteryRank.silver,
    });

    expect(repo.updateMuscleMasteryRank).toHaveBeenCalledWith(
      expect.objectContaining({
        masteryId: 'mastery-1',
        rank: MasteryRank.silver,
      }),
    );

    const [[rankUpdateInput]] = repo.updateMuscleMasteryRank.mock.calls as [
      [{ masteryId: string; rank: MasteryRank; rankedAt: Date }],
    ];

    expect(rankUpdateInput.rankedAt).toBeInstanceOf(Date);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      GAMIFICATION_RANK_UP_EVENT,
      expect.objectContaining({
        userId: 'user-1',
        muscleGroup: 'legs',
        oldRank: MasteryRank.bronze,
        newRank: MasteryRank.silver,
      }),
    );
  });

  it('keeps last_ranked_at untouched when no new rank is crossed', async () => {
    repo.upsertMuscleMasteryProgress.mockResolvedValue({
      id: 'mastery-1',
      user_id: 'user-1',
      muscle_group: 'legs',
      total_volume_kg: new Prisma.Decimal('2500'),
      xp_points: 250,
      rank: MasteryRank.bronze,
      last_ranked_at: null,
      created_at: new Date('2026-03-27T01:00:00.000Z'),
      updated_at: new Date('2026-03-27T01:00:00.000Z'),
    });

    await service.upsertMastery('user-1', 'legs', {
      xp: 250,
      volumeKg: new Prisma.Decimal('2500'),
    });

    expect(repo.updateMuscleMasteryRank).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('groups workout completion deltas before upserting mastery', async () => {
    const event = makeWorkoutCompletedEvent();
    repo.applyWorkoutCompletionProgression.mockResolvedValue({
      alreadyProcessed: false,
      rankUpdates: [],
      seasonPointsGranted: 94,
      sourceStatus: 'applied',
      totalXpGranted: 94,
    });

    await service.handleWorkoutCompleted(event);

    const applyCalls = repo.applyWorkoutCompletionProgression.mock
      .calls as Array<
      [
        {
          completedAt: Date;
          deltas: Array<{
            muscleGroup: string;
            volumeKgDelta: Prisma.Decimal;
            xpDelta: number;
          }>;
          exerciseLogCount: number;
          integrityState: string;
          recordedAt: Date;
          sessionId: string;
          sourceContext: Record<string, unknown>;
          sourceQualityNotes: string[];
          totalVolumeKg: Prisma.Decimal;
          userId: string;
          validationState: string;
        },
      ]
    >;
    const [applyInput] = applyCalls[0] ?? [];

    expect(applyInput).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        sessionId: 'session-1',
        completedAt: new Date('2026-03-27T03:00:00.000Z'),
        recordedAt: new Date('2026-03-27T03:00:05.000Z'),
        totalVolumeKg: new Prisma.Decimal('800.00'),
        exerciseLogCount: 3,
        deltas: [
          {
            muscleGroup: 'legs',
            xpDelta: 70,
            volumeKgDelta: new Prisma.Decimal('700'),
          },
          {
            muscleGroup: 'chest',
            xpDelta: 24,
            volumeKgDelta: new Prisma.Decimal('240'),
          },
        ],
      }),
    );
    expect(applyInput.sourceContext).toEqual(
      expect.objectContaining({
        event_type: 'progression_source_recorded',
        source_type: 'workout_session_completed',
        validation_state: 'validated',
      }),
    );
    expect(applyInput.validationState).toBe('validated');
    expect(applyInput.integrityState).toBe('clean');
    expect(applyInput.sourceQualityNotes).toEqual([
      'linked_pose_sessions_present',
    ]);
  });

  it('emits an audit record when a workout completion is reduced for review', async () => {
    repo.applyWorkoutCompletionProgression.mockResolvedValue({
      alreadyProcessed: false,
      integrityEventId: 'integrity-event-1',
      rankUpdates: [],
      seasonPointsGranted: 94,
      sourceStatus: 'reduced',
      totalXpGranted: 94,
    });

    await service.handleWorkoutCompleted(
      makeWorkoutCompletedEvent({
        validationState: 'flagged',
        integrityState: 'suspicious',
        eligibilityState: 'review_required',
        terminalState: 'flagged',
        validationMetadata: {
          hasPoseEvidence: true,
          hasManualWeightInput: true,
          containsFlaggedSets: true,
          correctionOrigin: 'linked_pose_session',
          sourceQualityNotes: [
            'flagged_pose_sessions_present',
            'pose_session_requires_review:pose-1',
          ],
        },
      }),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'audit.log',
      expect.objectContaining({
        userId: 'user-1',
        action: 'workout.session.flagged',
        entity: 'progression_source_event',
        entityId: 'session-1',
      }),
    );
  });

  it('records pose-session source facts through the backbone with integrity escalation when flagged', async () => {
    repo.recordPoseSessionProgressionSource.mockResolvedValue({
      alreadyProcessed: false,
      integrityEventId: 'integrity-event-1',
      sourceStatus: 'reduced',
    });
    repo.reconcileWorkoutSourceReviewFromPose.mockResolvedValue({
      updated: true,
      integrityEventId: 'integrity-event-2',
      sourceStatus: 'reduced',
    });

    await service.handlePoseSessionFinalized(makePoseSessionFinalizedEvent());

    const poseSourceCalls = repo.recordPoseSessionProgressionSource.mock
      .calls as Array<
      [
        {
          userId: string;
          poseSessionId: string;
          occurredAt: Date;
          recordedAt: Date;
          sourceRevision: number;
          sourceStatus: string;
          integrityState: string;
          integrityMarkers: string[];
          integrityRiskLevel: string;
          sourceContext: {
            source_type: string;
            terminal_state: string;
            eligibility_state: string;
          };
        },
      ]
    >;
    const poseSourceInput = poseSourceCalls[0][0];
    expect(poseSourceInput.userId).toBe('user-1');
    expect(poseSourceInput.poseSessionId).toBe('pose-1');
    expect(poseSourceInput.occurredAt).toEqual(
      new Date('2026-03-27T08:05:00.000Z'),
    );
    expect(poseSourceInput.recordedAt).toEqual(
      new Date('2026-03-27T08:05:00.000Z'),
    );
    expect(poseSourceInput.sourceRevision).toBe(1);
    expect(poseSourceInput.sourceStatus).toBe('reduced');
    expect(poseSourceInput.integrityState).toBe('suspicious');
    expect(poseSourceInput.integrityMarkers).toEqual([
      'low_classification_confidence',
    ]);
    expect(poseSourceInput.integrityRiskLevel).toBe('medium');
    expect(poseSourceInput.sourceContext.source_type).toBe(
      'pose_session_finalized',
    );
    expect(poseSourceInput.sourceContext.terminal_state).toBe('flagged');
    expect(poseSourceInput.sourceContext.eligibility_state).toBe(
      'review_required',
    );
    expect(repo.reconcileWorkoutSourceReviewFromPose).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      poseSessionId: 'pose-1',
      recordedAt: new Date('2026-03-27T08:05:00.000Z'),
      reviewNotes: [
        'pose_session_requires_review',
        'pose_review_marker:low_classification_confidence',
        'pose_integrity_marker:low_classification_confidence',
      ],
    });
    const auditCalls = eventEmitter.emit.mock.calls as Array<
      [
        string,
        {
          userId: string;
          action: string;
          entity: string;
          entityId: string;
        },
      ]
    >;
    const auditEvent = auditCalls.find((call) => call[0] === 'audit.log')?.[1];
    expect(auditEvent).toBeDefined();
    if (!auditEvent) {
      throw new Error('Missing audit.log event');
    }
    expect(auditEvent.userId).toBe('user-1');
    expect(auditEvent.action).toBe('pose.session.flagged');
    expect(auditEvent.entity).toBe('progression_source_event');
    expect(auditEvent.entityId).toBe('pose-1');
  });

  it('returns progression profile defaults when no backbone profile exists yet', async () => {
    repo.getProgressionProfile.mockResolvedValue(null);

    await expect(service.getProgressionProfile('user-1')).resolves.toEqual({
      user_id: 'user-1',
      total_xp: 0,
      current_streak: 0,
      longest_streak: 0,
      current_season_points: 0,
      ranking_visibility: 'public',
      ranking_governance_status: 'normal',
      integrity_risk_level: 'low',
      active_season: null,
      last_progressed_at: null,
      created_at: null,
      updated_at: null,
    });
  });

  it('maps progression source records into a stable consumer summary', async () => {
    repo.listProgressionSources.mockResolvedValue({
      data: [
        {
          id: 'source-1',
          user_id: 'user-1',
          source_type: 'workout_session_completed',
          source_id: 'session-1',
          source_status: 'reduced',
          source_context: {
            occurred_at: '2026-03-27T03:00:00.000Z',
            recorded_at: '2026-03-27T03:00:05.000Z',
            validation_state: 'flagged',
            terminal_state: 'flagged',
            eligibility_state: 'review_required',
            integrity_state: 'suspicious',
            producer_runtime: 'backend',
            correlation: {
              session_id: 'session-1',
              pose_session_id: 'pose-1',
              pose_session_ids: ['pose-1'],
              exercise_log_ids: ['log-1'],
              linked_source_ids: ['pose_session_finalized:pose-1'],
            },
            validation_metadata: {
              source_quality_notes: ['flagged_pose_sessions_present'],
            },
          },
          processed_at: new Date('2026-03-27T03:01:00.000Z'),
          created_at: new Date('2026-03-27T03:00:05.000Z'),
          updated_at: new Date('2026-03-27T03:01:00.000Z'),
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    await expect(
      service.listProgressionSources('user-1', { page: 1, limit: 20 }),
    ).resolves.toEqual({
      data: [
        {
          id: 'source-1',
          source_type: 'workout_session_completed',
          source_id: 'session-1',
          source_status: 'reduced',
          occurred_at: '2026-03-27T03:00:00.000Z',
          recorded_at: '2026-03-27T03:00:05.000Z',
          processed_at: '2026-03-27T03:01:00.000Z',
          validation_state: 'flagged',
          terminal_state: 'flagged',
          eligibility_state: 'review_required',
          integrity_state: 'suspicious',
          producer_runtime: 'backend',
          session_id: 'session-1',
          pose_session_id: 'pose-1',
          pose_session_ids: ['pose-1'],
          exercise_log_ids: ['log-1'],
          linked_source_ids: ['pose_session_finalized:pose-1'],
          source_quality_notes: ['flagged_pose_sessions_present'],
          created_at: '2026-03-27T03:00:05.000Z',
          updated_at: '2026-03-27T03:01:00.000Z',
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });
    expect(repo.listProgressionSources).toHaveBeenCalledWith({
      userId: 'user-1',
      page: 1,
      limit: 20,
      sourceType: undefined,
      sourceStatus: undefined,
    });
  });

  it('updates the ranking profile with anonymous-safe defaults', async () => {
    repo.upsertRankingProfile.mockResolvedValue({
      user_id: 'user-1',
      visibility: 'anonymous',
      governance_status: 'anonymized_by_user',
      display_alias: 'Anonymous Athlete',
      updated_at: new Date('2026-03-27T03:00:00.000Z'),
    });

    await expect(
      service.updateRankingProfile('user-1', {
        visibility: 'anonymous',
      }),
    ).resolves.toEqual({
      user_id: 'user-1',
      visibility: 'anonymous',
      governance_status: 'anonymized_by_user',
      display_alias: 'Anonymous Athlete',
      updated_at: '2026-03-27T03:00:00.000Z',
    });

    expect(repo.upsertRankingProfile).toHaveBeenCalledWith({
      userId: 'user-1',
      visibility: 'anonymous',
      governanceStatus: 'anonymized_by_user',
      displayAlias: 'Anonymous Athlete',
    });
  });

  it('returns a default ranking profile when the member has never customized visibility', async () => {
    repo.getRankingProfile.mockResolvedValue(null);

    await expect(service.getRankingProfile('user-1')).resolves.toEqual({
      user_id: 'user-1',
      visibility: 'public',
      governance_status: 'normal',
      display_alias: null,
      updated_at: null,
    });
  });

  it('returns active season standing defaults when there is no active season yet', async () => {
    repo.getActiveSeasonStanding.mockResolvedValue(null);

    await expect(service.getActiveSeasonStanding('user-1')).resolves.toEqual({
      user_id: 'user-1',
      season: null,
      season_points: 0,
      rank_position: null,
      is_hidden: false,
      is_disqualified: false,
      last_earned_at: null,
    });
  });

  it('normalizes legacy admin milestone proof settings on read', async () => {
    const timestamp = new Date('2026-03-27T01:00:00.000Z');
    repo.listAdminMilestoneDefinitions.mockResolvedValue({
      data: [
        {
          id: 'milestone-legacy',
          key: 'legacy-proof-rule',
          title: 'Legacy Proof Rule',
          description: 'A rule created before proof review was retired.',
          category: 'training',
          trigger_type: 'source_event',
          condition_payload: {
            metric: 'completed_workout_sessions',
            target: 1,
          },
          reward_payload: null,
          status: 'active',
          verification_policy: 'auto_then_review',
          evidence_requirement: 'image_or_video',
          is_active: true,
          is_hidden: false,
          sort_order: 1,
          starts_at: null,
          ends_at: null,
          retired_at: null,
          archived_at: null,
          archived_by_user_id: null,
          created_by_user_id: null,
          updated_by_user_id: null,
          created_at: timestamp,
          updated_at: timestamp,
          _count: { evidence_submissions: 3, user_progress: 4 },
          pending_review_count: 2,
          unlocked_count: 1,
        },
      ],
      meta: { page: 1, limit: 10, total: 1, total_pages: 1 },
    });

    const result = await service.listAdminMilestoneDefinitions({});

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        evidence_requirement: 'none',
        pending_review_count: 0,
        verification_policy: 'auto',
      }),
    );
  });

  it('maps visible milestone progress and suppresses still-hidden locked rows', async () => {
    repo.listMilestoneProgress.mockResolvedValue([
      {
        id: 'milestone-1',
        key: 'first-workout-complete',
        title: 'First Workout Complete',
        description: 'Complete your first tracked workout session.',
        category: 'training',
        trigger_type: 'source_event',
        condition_payload: { target: 1, metric: 'completed_workout_sessions' },
        evidence_requirement: 'none',
        verification_policy: 'auto',
        reward_payload: { badge_tone: 'ember' },
        is_active: true,
        is_hidden: false,
        retired_at: null,
        created_at: new Date('2026-03-27T01:00:00.000Z'),
        updated_at: new Date('2026-03-27T01:00:00.000Z'),
        user_progress: [
          {
            id: 'progress-1',
            user_id: 'user-1',
            milestone_definition_id: 'milestone-1',
            status: 'unlocked',
            progress_value: 1,
            progress_payload: null,
            unlocked_at: new Date('2026-03-27T03:00:00.000Z'),
            claimed_at: null,
            created_at: new Date('2026-03-27T03:00:00.000Z'),
            updated_at: new Date('2026-03-27T03:00:00.000Z'),
          },
        ],
      },
      {
        id: 'milestone-2',
        key: 'secret-streak',
        title: 'Secret Streak',
        description: 'Stay consistent for three days.',
        category: 'consistency',
        trigger_type: 'streak',
        condition_payload: { target: 3, metric: 'current_streak' },
        evidence_requirement: 'none',
        verification_policy: 'auto',
        reward_payload: null,
        is_active: true,
        is_hidden: true,
        retired_at: null,
        created_at: new Date('2026-03-27T01:00:00.000Z'),
        updated_at: new Date('2026-03-27T01:00:00.000Z'),
        user_progress: [],
      },
      {
        id: 'milestone-3',
        key: 'secret-unlocked',
        title: 'Secret Unlocked',
        description: 'A hidden milestone should appear after it is unlocked.',
        category: 'consistency',
        trigger_type: 'streak',
        condition_payload: { target: 5, metric: 'current_streak' },
        evidence_requirement: 'none',
        verification_policy: 'auto',
        reward_payload: null,
        is_active: true,
        is_hidden: true,
        retired_at: null,
        created_at: new Date('2026-03-27T01:00:00.000Z'),
        updated_at: new Date('2026-03-27T01:00:00.000Z'),
        user_progress: [
          {
            id: 'progress-3',
            user_id: 'user-1',
            milestone_definition_id: 'milestone-3',
            status: 'unlocked',
            progress_value: 5,
            progress_payload: null,
            unlocked_at: new Date('2026-03-28T03:00:00.000Z'),
            claimed_at: null,
            created_at: new Date('2026-03-28T03:00:00.000Z'),
            updated_at: new Date('2026-03-28T03:00:00.000Z'),
          },
        ],
      },
    ]);

    await expect(
      service.getMilestoneProgress('user-1', { include_locked: true }),
    ).resolves.toEqual([
      {
        milestone_definition_id: 'milestone-1',
        key: 'first-workout-complete',
        title: 'First Workout Complete',
        description: 'Complete your first tracked workout session.',
        category: 'training',
        trigger_type: 'source_event',
        condition_payload: { target: 1, metric: 'completed_workout_sessions' },
        target_value: 1,
        progress_value: 1,
        progress_percent: 100,
        status: 'unlocked',
        is_hidden: false,
        reward_payload: { badge_tone: 'ember' },
        evidence_requirement: 'none',
        verification_policy: 'auto',
        unlocked_at: '2026-03-27T03:00:00.000Z',
        claimed_at: null,
        updated_at: '2026-03-27T03:00:00.000Z',
      },
      {
        milestone_definition_id: 'milestone-3',
        key: 'secret-unlocked',
        title: 'Secret Unlocked',
        description: 'A hidden milestone should appear after it is unlocked.',
        category: 'consistency',
        trigger_type: 'streak',
        condition_payload: { target: 5, metric: 'current_streak' },
        target_value: 5,
        progress_value: 5,
        progress_percent: 100,
        status: 'unlocked',
        is_hidden: true,
        reward_payload: null,
        evidence_requirement: 'none',
        verification_policy: 'auto',
        unlocked_at: '2026-03-28T03:00:00.000Z',
        claimed_at: null,
        updated_at: '2026-03-28T03:00:00.000Z',
      },
    ]);
  });

  it('claims an unlocked milestone and maps the claimed response', async () => {
    repo.getMilestoneProgressById.mockResolvedValue(
      makeMilestoneRecord('unlocked'),
    );
    repo.claimMilestoneProgress.mockResolvedValue(
      makeMilestoneRecord('claimed'),
    );

    await expect(
      service.claimMilestone('user-1', 'milestone-1'),
    ).resolves.toMatchObject({
      milestone_definition_id: 'milestone-1',
      status: 'claimed',
      claimed_at: '2026-03-27T03:10:00.000Z',
    });
    expect(repo.claimMilestoneProgress).toHaveBeenCalledWith(
      'user-1',
      'milestone-1',
    );
  });

  it('treats already claimed milestones as idempotent claim success', async () => {
    repo.getMilestoneProgressById.mockResolvedValue(
      makeMilestoneRecord('claimed'),
    );

    await expect(
      service.claimMilestone('user-1', 'milestone-1'),
    ).resolves.toMatchObject({
      milestone_definition_id: 'milestone-1',
      status: 'claimed',
    });
    expect(repo.claimMilestoneProgress).not.toHaveBeenCalled();
  });

  it('rejects milestone claims before unlock and hides locked hidden definitions', async () => {
    repo.getMilestoneProgressById.mockResolvedValueOnce(
      makeMilestoneRecord('in_progress'),
    );

    await expect(
      service.claimMilestone('user-1', 'milestone-1'),
    ).rejects.toThrow(BadRequestException);
    expect(repo.claimMilestoneProgress).not.toHaveBeenCalled();

    repo.getMilestoneProgressById.mockResolvedValueOnce(
      makeMilestoneRecord('in_progress', { is_hidden: true }),
    );

    await expect(
      service.claimMilestone('user-1', 'milestone-1'),
    ).rejects.toThrow(NotFoundException);
    expect(repo.claimMilestoneProgress).not.toHaveBeenCalled();
  });

  it('returns integrity summary defaults when the member has no integrity profile yet', async () => {
    repo.getIntegritySummary.mockResolvedValue({
      profile: null,
      recentCases: [],
    });

    await expect(service.getIntegritySummary('user-1')).resolves.toEqual({
      user_id: 'user-1',
      risk_level: 'low',
      open_case_count: 0,
      last_flagged_at: null,
      last_resolved_at: null,
      recent_cases: [],
    });
  });

  it('maps the admin gamification overview into operator sections', async () => {
    repo.getAdminOverview.mockResolvedValue({
      activeSeason: {
        id: 'season-1',
        title: 'Spring 2026',
        status: 'active',
        rules_version: 'season-rules-v1',
        auto_start_next: true,
        starts_at: new Date('2026-04-01T00:00:00.000Z'),
        ends_at: new Date('2026-06-30T23:59:59.000Z'),
        activated_at: new Date('2026-04-01T00:00:00.000Z'),
        closed_at: null,
        archived_at: null,
        standings: [
          {
            user_id: 'user-1',
            is_hidden: true,
            is_disqualified: false,
          },
        ],
      },
      creatorCounts: {
        none: 0,
        candidate: 1,
        pending_review: 0,
        approved: 2,
        suspended: 0,
        revoked: 0,
      },
      creatorProfiles: [
        {
          user_id: 'user-2',
          state: 'candidate',
          admin_notes: 'Strong submissions.',
          last_state_changed_at: new Date('2026-04-03T00:00:00.000Z'),
          user: {
            profile: { first_name: 'Casey', last_name: 'Creator' },
            exercise_review_submissions: [
              { status: 'published' },
              { status: 'pending' },
            ],
          },
        },
      ],
      disqualifiedRankingCount: 0,
      escalatedCaseCount: 1,
      governedRankingCount: 1,
      hiddenRankingCount: 1,
      highRiskProfileCount: 1,
      integrityCases: [
        {
          id: 'case-1',
          user_id: 'user-1',
          status: 'open',
          summary: 'Rep spike review.',
          opened_at: new Date('2026-04-02T00:00:00.000Z'),
          user: { profile: { first_name: 'Riley', last_name: 'Runner' } },
          integrity_events: [{ risk_level: 'medium' }, { risk_level: 'high' }],
        },
      ],
      openCaseCount: 2,
      rankingProfiles: [
        {
          user_id: 'user-1',
          visibility: 'public',
          governance_status: 'hidden_by_admin',
          display_alias: null,
          admin_note: 'Hold visibility.',
          updated_at: new Date('2026-04-04T00:00:00.000Z'),
          user: { profile: { first_name: 'Riley', last_name: 'Runner' } },
        },
      ],
      recentCorrectionCount: 3,
      recentModerationActions: [
        {
          id: 'action-1',
          action_type: 'hide_from_rankings',
          target_user_id: 'user-1',
          target_user: {
            profile: { first_name: 'Riley', last_name: 'Runner' },
          },
          rationale: 'Hold visibility.',
          progression_grant_id: null,
          integrity_case_id: null,
          season_id: 'season-1',
          created_at: new Date('2026-04-05T00:00:00.000Z'),
        },
      ],
    });

    await expect(service.getAdminOverview()).resolves.toMatchObject({
      active_season: {
        id: 'season-1',
        standing_count: 1,
        hidden_count: 1,
      },
      integrity: {
        open_case_count: 2,
        cases: [
          {
            case_id: 'case-1',
            member_name: 'Riley Runner',
            risk_level: 'high',
          },
        ],
      },
      rankings: {
        governed_profile_count: 1,
        profiles: [
          {
            user_id: 'user-1',
            season_is_hidden: true,
          },
        ],
      },
      creators: {
        candidate_count: 1,
        profiles: [
          {
            user_id: 'user-2',
            state_label: 'Candidate',
            published_submission_count: 1,
            submission_count: 2,
          },
        ],
      },
      audit: {
        recent_correction_count: 3,
        recent_actions: [
          {
            id: 'action-1',
            target_name: 'Riley Runner',
          },
        ],
      },
    });
  });

  it('maps admin season filter options', async () => {
    repo.listAdminSeasons.mockResolvedValue([
      {
        id: 'season-1',
        title: 'Spring 2026',
        status: 'active',
        rules_version: 'season-rules-v1',
        auto_start_next: true,
        starts_at: new Date('2026-04-01T00:00:00.000Z'),
        ends_at: new Date('2026-06-30T23:59:59.000Z'),
        activated_at: new Date('2026-04-01T00:00:00.000Z'),
        closed_at: null,
        archived_at: null,
        standings: [{ user_id: 'user-1' }, { user_id: 'user-2' }],
      },
    ]);

    await expect(service.listAdminSeasons()).resolves.toEqual([
      {
        id: 'season-1',
        title: 'Spring 2026',
        status: 'active',
        rules_version: 'season-rules-v1',
        auto_start_next: true,
        starts_at: '2026-04-01T00:00:00.000Z',
        ends_at: '2026-06-30T23:59:59.000Z',
        activated_at: '2026-04-01T00:00:00.000Z',
        closed_at: null,
        archived_at: null,
        standing_count: 2,
        hidden_count: 0,
        disqualified_count: 0,
      },
    ]);
    expect(repo.listAdminSeasons).toHaveBeenCalledWith({
      includeArchived: true,
    });
  });

  it('maps admin season standings including hidden and private participants', async () => {
    repo.listAdminSeasonStandings.mockResolvedValue({
      data: [
        {
          user_id: 'user-1',
          season_id: 'season-1',
          season_points: 240,
          rank_position: 3,
          is_hidden: true,
          is_disqualified: false,
          last_earned_at: new Date('2026-04-05T00:00:00.000Z'),
          season: {
            id: 'season-1',
            title: 'Spring 2026',
            status: 'active',
          },
          user: {
            profile: { first_name: 'Riley', last_name: 'Runner' },
            progression_profile: { total_xp: 900 },
            ranking_profile: {
              visibility: 'private',
              governance_status: 'hidden_by_admin',
              display_alias: 'Quiet Lifter',
            },
            muscle_mastery: [
              { muscle_group: 'legs', xp_points: 420 },
              { muscle_group: 'chest', xp_points: 180 },
            ],
            milestone_progress: [
              { status: 'claimed' },
              { status: 'unlocked' },
              { status: 'in_progress' },
            ],
          },
        },
      ],
      meta: { page: 1, limit: 8, total: 1, total_pages: 1 },
    });

    await expect(
      service.listAdminSeasonStandings({
        limit: 8,
        page: 1,
        search: 'riley',
        visibility: 'private',
        governance_status: 'hidden_by_admin',
      }),
    ).resolves.toEqual({
      data: [
        {
          user_id: 'user-1',
          member_name: 'Riley Runner',
          display_alias: 'Quiet Lifter',
          season_id: 'season-1',
          season_title: 'Spring 2026',
          season_status: 'active',
          season_points: 240,
          rank_position: 3,
          total_xp: 900,
          top_muscle: 'legs',
          top_muscle_xp: 420,
          milestone_unlocked_count: 2,
          milestone_claimed_count: 1,
          visibility: 'private',
          governance_status: 'hidden_by_admin',
          is_hidden: true,
          is_disqualified: false,
          last_earned_at: '2026-04-05T00:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 8, total: 1, total_pages: 1 },
    });
    expect(repo.listAdminSeasonStandings).toHaveBeenCalledWith(
      expect.objectContaining({
        governanceStatus: 'hidden_by_admin',
        limit: 8,
        page: 1,
        search: 'riley',
        visibility: 'private',
      }),
    );
  });

  it('updates a season through allowed lifecycle transitions', async () => {
    repo.getSeasonById.mockResolvedValue({
      id: 'season-1',
      status: 'active',
    });
    repo.updateSeasonStatus.mockResolvedValue({
      seasonId: 'season-1',
      title: 'Spring 2026',
      status: 'closed',
      autoStartNext: true,
      activatedAt: new Date('2026-04-01T00:00:00.000Z'),
      closedAt: new Date('2026-06-30T23:59:59.000Z'),
      archivedAt: null,
    });

    await expect(
      service.adminUpdateSeasonStatus('admin-1', 'season-1', {
        status: 'closed',
        rationale: 'Season ended after review.',
      }),
    ).resolves.toEqual({
      season_id: 'season-1',
      title: 'Spring 2026',
      status: 'closed',
      auto_start_next: true,
      activated_at: '2026-04-01T00:00:00.000Z',
      closed_at: '2026-06-30T23:59:59.000Z',
      archived_at: null,
    });
  });

  it('rejects unsafe season lifecycle jumps', async () => {
    repo.getSeasonById.mockResolvedValue({
      id: 'season-1',
      status: 'archived',
    });

    await expect(
      service.adminUpdateSeasonStatus('admin-1', 'season-1', {
        status: 'active',
        rationale: 'Reopen archived season.',
      }),
    ).rejects.toThrow('Cannot move a archived season to active.');
  });

  it('updates creator governance state through the repository path', async () => {
    repo.updateCreatorState.mockResolvedValue({
      userId: 'user-1',
      userName: 'Casey Creator',
      state: 'approved',
      adminNotes: 'Creator workflow enabled.',
      lastStateChangedAt: new Date('2026-04-03T00:00:00.000Z'),
      moderationActionId: 'action-creator-1',
    });

    await expect(
      service.adminUpdateCreatorState('admin-1', 'user-1', {
        state: 'approved',
        rationale: 'High-signal submissions.',
        admin_notes: 'Creator workflow enabled.',
      }),
    ).resolves.toEqual({
      user_id: 'user-1',
      member_name: 'Casey Creator',
      state: 'approved',
      state_label: 'Approved',
      admin_notes: 'Creator workflow enabled.',
      last_state_changed_at: '2026-04-03T00:00:00.000Z',
      moderation_action_id: 'action-creator-1',
    });
  });

  it('voids a progression grant through the moderation repository path', async () => {
    repo.getProgressionGrantById.mockResolvedValue({
      id: 'grant-1',
      user_id: 'user-1',
      grant_status: 'applied',
      source_event: null,
    });
    repo.voidProgressionGrant.mockResolvedValue({
      grantId: 'grant-1',
      userId: 'user-1',
      grantStatus: 'voided',
      moderationActionId: 'action-1',
      totalXp: 120,
      currentSeasonPoints: 40,
    });

    await expect(
      service.adminVoidProgressionGrant('admin-1', 'grant-1', {
        rationale: 'Manual moderation review.',
      }),
    ).resolves.toEqual({
      grant_id: 'grant-1',
      user_id: 'user-1',
      grant_status: 'voided',
      moderation_action_type: 'void_progression_grant',
      moderation_action_id: 'action-1',
      total_xp: 120,
      current_season_points: 40,
    });
  });

  it('applies an admin ranking override through the repository path', async () => {
    repo.applyRankingOverride.mockResolvedValue({
      userId: 'user-1',
      visibility: 'public',
      governanceStatus: 'hidden_by_admin',
      displayAlias: null,
      adminNote: 'Hold until review.',
      seasonIsHidden: true,
      seasonIsDisqualified: false,
      moderationActionId: 'action-2',
    });

    await expect(
      service.adminApplyRankingOverride('admin-1', 'user-1', {
        governance_status: 'hidden_by_admin',
        rationale: 'Hold until review.',
        admin_note: 'Hold until review.',
      }),
    ).resolves.toEqual({
      user_id: 'user-1',
      visibility: 'public',
      governance_status: 'hidden_by_admin',
      display_alias: null,
      admin_note: 'Hold until review.',
      season_is_hidden: true,
      season_is_disqualified: false,
      moderation_action_id: 'action-2',
    });
  });

  it('allows admin ranking restore to normal participation', async () => {
    repo.applyRankingOverride.mockResolvedValue({
      userId: 'user-1',
      visibility: 'public',
      governanceStatus: 'normal',
      displayAlias: null,
      adminNote: null,
      seasonIsHidden: false,
      seasonIsDisqualified: false,
      moderationActionId: 'action-restore-1',
    });

    await expect(
      service.adminApplyRankingOverride('admin-1', 'user-1', {
        governance_status: 'normal',
        rationale: 'Manual review cleared the ranking hold.',
      }),
    ).resolves.toMatchObject({
      user_id: 'user-1',
      governance_status: 'normal',
      season_is_hidden: false,
      season_is_disqualified: false,
    });
  });

  it('creates an integrity case through the repository path', async () => {
    repo.createIntegrityCase.mockResolvedValue({
      caseId: 'case-1',
      userId: 'user-1',
      status: 'open',
      riskLevel: 'medium',
      openCaseCount: 1,
      summary: 'Suspicious session.',
      moderationActionId: null,
    });

    await expect(
      service.adminCreateIntegrityCase('admin-1', {
        user_id: 'user-1',
        event_type: 'rep_pattern_anomaly',
        risk_level: 'medium',
        summary: 'Suspicious session.',
      }),
    ).resolves.toEqual({
      case_id: 'case-1',
      user_id: 'user-1',
      status: 'open',
      risk_level: 'medium',
      open_case_count: 1,
      summary: 'Suspicious session.',
      moderation_action_id: null,
    });
  });

  it('rejects resolving an integrity case into a non-terminal state', async () => {
    repo.getIntegrityCaseById.mockResolvedValue({
      id: 'case-1',
      user_id: 'user-1',
      status: 'open',
    });

    await expect(
      service.adminResolveIntegrityCase('admin-1', 'case-1', {
        status: 'under_review',
        rationale: 'Not ready.',
      }),
    ).rejects.toThrow('resolved_valid or resolved_invalid');
  });

  it('emits rank-up notifications for progression rank changes returned by the repository', async () => {
    repo.applyWorkoutCompletionProgression.mockResolvedValue({
      alreadyProcessed: false,
      rankUpdates: [
        {
          userId: 'user-1',
          muscleGroup: 'legs',
          oldRank: MasteryRank.bronze,
          newRank: MasteryRank.silver,
          rankedAt: new Date('2026-03-27T03:00:00.000Z'),
        },
      ],
      seasonPointsGranted: 50,
      sourceStatus: 'applied',
      totalXpGranted: 50,
    });

    await service.handleWorkoutCompleted(
      makeWorkoutCompletedEvent({
        totalVolumeKg: '500.00',
        exerciseLogCount: 1,
        exerciseSummaries: [
          {
            exerciseLogId: 'log-1',
            exerciseId: 'exercise-1',
            exerciseNameSnapshot: 'Barbell Back Squat',
            muscleGroupHint: 'legs',
            setNumber: 1,
            repsCompleted: 10,
            repsAiCounted: null,
            weightKg: '50',
            durationSeconds: null,
            poseSessionId: null,
          },
        ],
        performanceSummary: {
          durationSeconds: 1800,
          exerciseLogCount: 1,
          totalVolumeKg: '500.00',
          exerciseSummaries: [
            {
              exerciseLogId: 'log-1',
              exerciseId: 'exercise-1',
              exerciseNameSnapshot: 'Barbell Back Squat',
              muscleGroupHint: 'legs',
              setNumber: 1,
              repsCompleted: 10,
              repsAiCounted: null,
              weightKg: '50',
              durationSeconds: null,
              poseSessionId: null,
            },
          ],
        },
      }),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      GAMIFICATION_RANK_UP_EVENT,
      expect.objectContaining({
        userId: 'user-1',
        muscleGroup: 'legs',
        oldRank: MasteryRank.bronze,
        newRank: MasteryRank.silver,
        rankedAt: '2026-03-27T03:00:00.000Z',
      }),
    );
  });

  it('never throws back into the caller flow when the listener fails', async () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    repo.applyWorkoutCompletionProgression.mockRejectedValue(
      new Error('db down'),
    );

    await expect(
      service.handleWorkoutCompleted(
        makeWorkoutCompletedEvent({
          totalVolumeKg: '0.00',
          exerciseLogCount: 0,
          exerciseSummaries: [],
          performanceSummary: {
            durationSeconds: 1800,
            exerciseLogCount: 0,
            totalVolumeKg: '0.00',
            exerciseSummaries: [],
          },
          validationMetadata: {
            hasPoseEvidence: false,
            hasManualWeightInput: false,
            containsFlaggedSets: false,
            correctionOrigin: null,
            sourceQualityNotes: [],
          },
        }),
      ),
    ).resolves.toBeUndefined();

    expect(loggerError).toHaveBeenCalledWith(
      'Failed to process workout completion gamification for session session-1',
      expect.stringContaining('db down'),
    );
  });

  it('never throws back into the caller flow when the pose-source listener fails', async () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    repo.recordPoseSessionProgressionSource.mockRejectedValue(
      new Error('pose source write failed'),
    );

    await expect(
      service.handlePoseSessionFinalized(makePoseSessionFinalizedEvent()),
    ).resolves.toBeUndefined();

    expect(loggerError).toHaveBeenCalledWith(
      'Failed to record pose-session backbone fact for source pose-1',
      expect.stringContaining('pose source write failed'),
    );
  });
});
