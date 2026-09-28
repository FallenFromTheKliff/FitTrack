import { PoseProfileKind, Prisma } from '@prisma/client';

import { PoseRepository } from './pose.repository';

describe('PoseRepository', () => {
  const poseSession = {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };

  const poseExerciseProfile = {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  };

  const progressionSourceEvent = {
    findUnique: jest.fn(),
  };

  const prisma = {
    $transaction: jest.fn(),
    poseSession,
    poseExerciseProfile,
    progressionSourceEvent,
  };

  let repo: PoseRepository;

  beforeEach(() => {
    repo = new PoseRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('creates a pose session for the connected user', async () => {
    poseSession.create.mockResolvedValue({ id: 'pose-1' });

    await repo.createPoseSession({
      userId: 'user-1',
      exerciseHint: 'Barbell Back Squat',
      startedAt: new Date('2026-03-27T08:00:00.000Z'),
    });

    expect(poseSession.create).toHaveBeenCalledWith({
      data: {
        user: { connect: { id: 'user-1' } },
        exercise_hint: 'Barbell Back Squat',
        started_at: new Date('2026-03-27T08:00:00.000Z'),
      },
      select: {
        id: true,
        user_id: true,
        exercise_hint: true,
        rep_count_ai: true,
        started_at: true,
        ended_at: true,
      },
    });
  });

  it('loads active bootstrap profiles and narrows by canonical hint when possible', async () => {
    poseExerciseProfile.findMany.mockResolvedValue([{ id: 'profile-1' }]);

    await repo.listBootstrapPoseProfiles({
      exerciseHint: 'Barbell Back Squat',
      canonicalHint: 'squat',
    });

    expect(poseExerciseProfile.findMany).toHaveBeenCalledWith({
      where: {
        is_active: true,
        OR: [
          { canonical_name: 'squat' },
          {
            exercise: {
              name: {
                contains: 'Barbell Back Squat',
                mode: 'insensitive',
              },
            },
          },
        ],
      },
      orderBy: [{ canonical_name: 'asc' }, { created_at: 'desc' }],
      select: {
        id: true,
        canonical_name: true,
        profile_kind: true,
        landmark_signature: true,
        angle_signature: true,
        orientation_signature: true,
        movement_pattern: true,
        visibility_pattern: true,
        dominant_joint: true,
        tolerance: true,
        rep_thresholds: true,
        rep_rules: true,
      },
    });
  });

  it('derives the next pose source revision from the stored progression source event', async () => {
    progressionSourceEvent.findUnique.mockResolvedValue({
      source_context: {
        source_revision: 4,
      },
    });

    await expect(repo.getNextPoseSourceRevision('pose-1')).resolves.toBe(5);

    expect(progressionSourceEvent.findUnique).toHaveBeenCalledWith({
      where: {
        source_type_source_id: {
          source_id: 'pose-1',
          source_type: 'pose_session_finalized',
        },
      },
      select: {
        source_context: true,
      },
    });
  });

  it('finalizes pose sessions transactionally and attaches any learned profile it creates', async () => {
    const transactionClient = {
      poseExerciseProfile: {
        create: jest.fn().mockResolvedValue({ id: 'profile-learned-1' }),
      },
      poseSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'pose-1' }),
      },
    };
    prisma.$transaction.mockImplementation(
      async (
        callback: (tx: typeof transactionClient) => Promise<{ id: string }>,
      ) => callback(transactionClient),
    );

    await repo.finalizePoseSession({
      poseSessionId: 'pose-1',
      endedAt: new Date('2026-03-27T08:05:00.000Z'),
      repCountAi: 12,
      confidenceAvg: 0.925,
      detectedExerciseName: 'squat',
      detectedProfileId: null,
      classificationConfidence: 0.94,
      subjectLockConfidence: 0.88,
      analysisSummary: {
        reps_detected: 12,
        form_feedback: ['Keep your chest up.'],
      },
      learnedProfile: {
        canonicalName: 'squat',
        exerciseId: null,
        landmarkSignature: { left_shoulder: [0.1, 0.2] },
        angleSignature: { hip_knee_ankle: 92.4 },
        orientationSignature: { body_orientation: 'upright' },
        movementPattern: { tracked_joint: 'knee_angle' },
        visibilityPattern: { min_visibility: 0.5 },
        repRules: { rep_start_angle: 88 },
      },
    });

    expect(transactionClient.poseExerciseProfile.create).toHaveBeenCalledWith({
      data: {
        exercise_id: null,
        canonical_name: 'squat',
        profile_kind: PoseProfileKind.learned,
        landmark_signature: { left_shoulder: [0.1, 0.2] },
        angle_signature: { hip_knee_ankle: 92.4 },
        orientation_signature: { body_orientation: 'upright' },
        movement_pattern: { tracked_joint: 'knee_angle' },
        visibility_pattern: { min_visibility: 0.5 },
        dominant_joint: undefined,
        tolerance: null,
        rep_thresholds: Prisma.JsonNull,
        rep_rules: { rep_start_angle: 88 },
      },
      select: {
        id: true,
      },
    });

    const updateCalls = transactionClient.poseSession.updateMany.mock.calls as [
      [
        {
          where: { id: string; ended_at: null };
          data: {
            ended_at: Date;
            rep_count_ai: number;
            confidence_avg: Prisma.Decimal | null;
            detected_exercise_name: string | null;
            detected_profile_id: string | null;
            classification_confidence: Prisma.Decimal | null;
            subject_lock_confidence: Prisma.Decimal | null;
            analysis_summary: Record<string, unknown>;
          };
        },
      ],
    ];
    const [updateArgs] = updateCalls[0];

    expect(updateArgs.where).toEqual({ id: 'pose-1', ended_at: null });
    expect(updateArgs.data.ended_at).toEqual(
      new Date('2026-03-27T08:05:00.000Z'),
    );
    expect(updateArgs.data.rep_count_ai).toBe(12);
    expect(updateArgs.data.confidence_avg?.toString()).toBe('0.925');
    expect(updateArgs.data.detected_exercise_name).toBe('squat');
    expect(updateArgs.data.detected_profile_id).toBe('profile-learned-1');
    expect(updateArgs.data.classification_confidence?.toString()).toBe('0.94');
    expect(updateArgs.data.subject_lock_confidence?.toString()).toBe('0.88');
    expect(updateArgs.data.analysis_summary).toEqual({
      reps_detected: 12,
      form_feedback: ['Keep your chest up.'],
    });
  });

  it('loads a pose-session summary by id', async () => {
    poseSession.findUnique.mockResolvedValue({ id: 'pose-1' });

    await repo.findPoseSessionByIdOrThrow('pose-1');

    expect(poseSession.findUnique).toHaveBeenCalledWith({
      where: { id: 'pose-1' },
      include: undefined,
      select: {
        id: true,
        user_id: true,
        exercise_log_id: true,
        exercise_log: {
          select: {
            id: true,
            session_id: true,
          },
        },
        exercise_hint: true,
        rep_count_ai: true,
        confidence_avg: true,
        detected_exercise_name: true,
        detected_profile_id: true,
        classification_confidence: true,
        subject_lock_confidence: true,
        analysis_summary: true,
        started_at: true,
        ended_at: true,
        created_at: true,
        updated_at: true,
      },
    });
  });

  it('lists pose profiles with pagination and filters', async () => {
    poseExerciseProfile.findMany.mockResolvedValue([{ id: 'profile-1' }]);
    poseExerciseProfile.count.mockResolvedValue(12);

    const result = await repo.listPoseProfiles({
      page: 2,
      limit: 5,
      canonical_name: 'squat',
      profile_kind: PoseProfileKind.seed,
    });

    expect(poseExerciseProfile.findMany).toHaveBeenCalledWith({
      where: {
        canonical_name: {
          contains: 'squat',
          mode: 'insensitive',
        },
        profile_kind: PoseProfileKind.seed,
      },
      orderBy: [{ canonical_name: 'asc' }, { created_at: 'desc' }],
      select: {
        id: true,
        exercise_id: true,
        canonical_name: true,
        profile_kind: true,
        landmark_signature: true,
        angle_signature: true,
        orientation_signature: true,
        movement_pattern: true,
        visibility_pattern: true,
        dominant_joint: true,
        tolerance: true,
        rep_thresholds: true,
        rep_rules: true,
        sample_count: true,
        confidence_threshold: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        exercise: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      skip: 5,
      take: 5,
    });
    expect(poseExerciseProfile.count).toHaveBeenCalledWith({
      where: {
        canonical_name: {
          contains: 'squat',
          mode: 'insensitive',
        },
        profile_kind: PoseProfileKind.seed,
      },
    });
    expect(result.meta).toEqual({
      page: 2,
      limit: 5,
      total: 12,
      total_pages: 3,
    });
  });
});
