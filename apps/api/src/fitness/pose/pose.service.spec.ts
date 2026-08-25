import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PoseProfileKind, Prisma, UserStatus } from '@prisma/client';
import type Redis from 'ioredis';
import type { Socket } from 'socket.io';

import { AiPythonClientService } from '../../ai/ai-python-client.service';
import { ExerciseService } from '../exercise/exercise.service';
import type {
  AnalyzePoseSequenceDTO,
  DetectPoseEquipmentDTO,
  FinalizePoseSessionDTO,
} from './dto/pose.dto';
import { PoseRepository } from './pose.repository';
import { PoseService } from './pose.service';
import { buildFallbackPoseMovementContract } from '../../../../../packages/utils/pose';
describe('PoseService', () => {
  let service: PoseService;
  const originalFetch = global.fetch;

  const repo = {
    createPoseSession: jest.fn(),
    listBootstrapPoseProfiles: jest.fn(),
    finalizePoseSession: jest.fn(),
    findPoseSessionByIdOrThrow: jest.fn(),
    getNextPoseSourceRevision: jest.fn(),
    listPoseProfiles: jest.fn(),
    deletePoseSessionById: jest.fn(),
    updatePoseSessionAnalysis: jest.fn(),
    upsertLearnedPoseProfile: jest.fn(),
  };

  const jwtService = {
    verifyAsync: jest.fn(),
  };

  const config = {
    get: jest.fn((key: string, fallback?: string) =>
      key === 'jwt.secret' ? 'jwt-secret' : (fallback ?? ''),
    ),
  };

  const aiClient = {
    bootstrapPoseSession: jest.fn(),
    analyzePoseFrame: jest.fn(),
    analyzePoseSequence: jest.fn(),
    detectEquipment: jest.fn(),
    finalizePoseSession: jest.fn(),
  };

  const redis = {
    get: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  const exerciseService = {
    resolveExerciseContract: jest.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoseService,
        { provide: PoseRepository, useValue: repo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: AiPythonClientService, useValue: aiClient },
        { provide: ExerciseService, useValue: exerciseService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get<PoseService>(PoseService);
    jest.clearAllMocks();
    config.get.mockImplementation((key: string, fallback?: string) =>
      key === 'jwt.secret' ? 'jwt-secret' : (fallback ?? ''),
    );
    global.fetch = originalFetch;
    repo.getNextPoseSourceRevision.mockResolvedValue(1);
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  function makePoseSessionDetail(
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return {
      id: 'pose-1',
      user_id: 'user-1',
      exercise_log_id: null,
      exercise_log: null,
      exercise_hint: 'Barbell Back Squat',
      rep_count_ai: 6,
      confidence_avg: new Prisma.Decimal('0.900'),
      detected_exercise_name: null,
      detected_profile_id: null,
      classification_confidence: null,
      subject_lock_confidence: null,
      analysis_summary: null,
      started_at: new Date('2026-03-27T08:00:00.000Z'),
      ended_at: null,
      created_at: new Date('2026-03-27T08:00:00.000Z'),
      updated_at: new Date('2026-03-27T08:00:00.000Z'),
      ...overrides,
    };
  }

  function makeAnalyzeDto(
    overrides: Partial<AnalyzePoseSequenceDTO> = {},
  ): AnalyzePoseSequenceDTO {
    return {
      landmark_schema: 'mediapipe_pose_v1',
      camera_facing_mode: 'user',
      exercise_hint: 'Barbell Back Squat',
      frames: [
        {
          captured_at_ms: 1712844369000,
          keypoints: Array.from({ length: 33 }, () => ({
            x: 0.1,
            y: 0.2,
            z: 0,
            visibility: 0.95,
          })),
        },
      ],
      signals: {
        angles: [
          {
            captured_at_ms: 1712844369000,
            elbow: 150,
            shoulder: 92,
            hip: 124,
            knee: 91,
          },
        ],
        orientation: {
          body_orientation: 'upright',
          torso_slope_deg: 72,
          vector: { x: 0.01, y: 0.18 },
        },
        visibility: {
          average_visibility: 0.95,
          feet_visibility: 0.94,
          low_confidence_landmarks: [],
          reliable_frame_count: 1,
          wrist_visibility: 0.92,
        },
        hip: {
          average_y: 0.52,
          range_y: 0.01,
          stable: true,
        },
        temporal: {
          amplitudes: {
            elbow: 8,
            hip: 12,
            knee: 18,
            shoulder: 6,
          },
          oscillating_joints: ['hip', 'knee'],
        },
      },
      ...overrides,
    };
  }

  function makeFrameAnalyzeDto(
    overrides: Partial<AnalyzePoseSequenceDTO> = {},
  ): AnalyzePoseSequenceDTO {
    return {
      camera_facing_mode: 'environment',
      exercise_hint: 'Barbell Back Squat',
      frame_b64: 'frame-data',
      ...overrides,
    };
  }

  function makeDetectEquipmentDto(
    overrides: Partial<DetectPoseEquipmentDTO> = {},
  ): DetectPoseEquipmentDTO {
    return {
      camera_facing_mode: 'environment',
      exercise_hint: 'Dumbbell Bicep Curl',
      frame_b64: 'frame-data',
      ...overrides,
    };
  }

  it('authenticates socket tokens and mirrors HTTP guard blacklist checks', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      role: 'member',
      status: UserStatus.active,
      jti: 'jti-1',
    });
    redis.get.mockResolvedValue(null);

    await expect(
      service.authenticateSocket({
        handshake: {
          auth: { token: 'Bearer token-1' },
          headers: {},
          query: {},
        },
      } as unknown as Socket),
    ).resolves.toEqual(
      expect.objectContaining({
        sub: 'user-1',
        status: UserStatus.active,
      }),
    );

    expect(jwtService.verifyAsync).toHaveBeenCalledWith('token-1', {
      secret: 'jwt-secret',
    });
    expect((redis as unknown as Pick<Redis, 'get'>).get).toHaveBeenCalledWith(
      'token_blacklist:jti-1',
    );
  });

  it('rejects suspended or blacklisted websocket users', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      role: 'member',
      status: UserStatus.suspended,
      jti: 'jti-1',
    });
    redis.get.mockResolvedValue(null);

    await expect(
      service.authenticateSocket({
        handshake: {
          auth: { token: 'token-1' },
          headers: {},
          query: {},
        },
      } as unknown as Socket),
    ).rejects.toBeInstanceOf(ForbiddenException);

    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      role: 'member',
      status: UserStatus.active,
      jti: 'jti-1',
    });
    redis.get.mockResolvedValue('revoked');

    await expect(
      service.authenticateSocket({
        handshake: {
          auth: { token: 'token-1' },
          headers: {},
          query: {},
        },
      } as unknown as Socket),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('creates pose sessions, loads candidate profiles, and bootstraps the Python lifecycle', async () => {
    repo.createPoseSession.mockResolvedValue({
      id: 'pose-1',
      user_id: 'user-1',
      exercise_hint: 'Barbell Back Squat',
      rep_count_ai: 0,
      started_at: new Date('2026-03-27T08:00:00.000Z'),
      ended_at: null,
    });
    repo.listBootstrapPoseProfiles.mockResolvedValue([
      {
        id: 'profile-1',
        canonical_name: 'squat',
        profile_kind: PoseProfileKind.seed,
        landmark_signature: { left_shoulder: [0.1, 0.2] },
        angle_signature: { hip_knee_ankle: 92.4 },
        orientation_signature: {},
        movement_pattern: {},
        visibility_pattern: {},
        dominant_joint: null,
        tolerance: null,
        rep_thresholds: null,
        rep_rules: { rep_start_angle: 88 },
      },
    ]);
    aiClient.bootstrapPoseSession.mockResolvedValue({
      status: 'ready',
      accepted_fps: 15,
      subject_lock_mode: 'single_subject',
    });

    await expect(
      service.startPoseSession('user-1', 'Barbell Back Squat'),
    ).resolves.toEqual({
      poseSessionId: 'pose-1',
      userId: 'user-1',
      exerciseHint: 'Barbell Back Squat',
      repCountAi: 0,
      confidenceSum: 0,
      confidenceSamples: 0,
      acceptedFps: 15,
      subjectLockMode: 'single_subject',
    });

    expect(repo.listBootstrapPoseProfiles).toHaveBeenCalledWith({
      exerciseHint: null,
      canonicalHint: null,
    });
    expect(aiClient.bootstrapPoseSession).toHaveBeenCalledWith({
      poseSessionId: 'pose-1',
      exerciseHint: null,
      starterCatalog: [
        'squat',
        'bench_press',
        'bicep_curl',
        'dip',
        'plank',
        'pull_up',
        'push_up',
        'shoulder_press',
      ],
      candidateProfiles: [],
    });
  });

  it('cleans up the persisted pose session when bootstrap fails', async () => {
    repo.createPoseSession.mockResolvedValue({
      id: 'pose-1',
      user_id: 'user-1',
      exercise_hint: 'Barbell Back Squat',
      rep_count_ai: 0,
      started_at: new Date('2026-03-27T08:00:00.000Z'),
      ended_at: null,
    });
    repo.listBootstrapPoseProfiles.mockResolvedValue([]);
    aiClient.bootstrapPoseSession.mockRejectedValue(
      new Error('bootstrap down'),
    );

    await expect(
      service.startPoseSession('user-1', 'Barbell Back Squat'),
    ).rejects.toThrow('bootstrap down');

    expect(repo.deletePoseSessionById).toHaveBeenCalledWith('pose-1');
  });

  it('analyzes frames against the session-keyed Python contract and applies rep deltas', async () => {
    aiClient.analyzePoseFrame.mockResolvedValue({
      rep_event: true,
      rep_count_delta: 2,
      confidence: 0.91,
      exercise_class: 'squat',
      subject_locked: true,
      subject_lock_confidence: 0.87,
      phase: 'rising',
      form_feedback: ['Keep your chest up.'],
    });

    const result = await service.analyzeFrame(
      {
        poseSessionId: 'pose-1',
        userId: 'user-1',
        exerciseHint: 'Barbell Back Squat',
        repCountAi: 1,
        confidenceSum: 0,
        confidenceSamples: 0,
        acceptedFps: 15,
        subjectLockMode: 'single_subject',
      },
      'frame-data',
    );

    expect(aiClient.analyzePoseFrame).toHaveBeenCalledWith({
      poseSessionId: 'pose-1',
      frameBase64: 'frame-data',
    });
    expect(result.analysis).toEqual(
      expect.objectContaining({
        rep_event: true,
        rep_count_delta: 2,
        phase: 'rising',
      }),
    );
    expect(result.nextState.repCountAi).toBe(1);
    expect(result.nextState.confidenceSum).toBe(0.91);
    expect(result.nextState.confidenceSamples).toBe(1);
  });

  it('returns a movement contract from an existing preset without calling AI sequence analysis', async () => {
    repo.findPoseSessionByIdOrThrow.mockResolvedValue(makePoseSessionDetail());
    repo.listBootstrapPoseProfiles.mockResolvedValue([
      {
        id: 'profile-1',
        canonical_name: 'squat',
        profile_kind: PoseProfileKind.seed,
        landmark_signature: { left_shoulder: [0.1, 0.2] },
        angle_signature: {
          bottom: { knee: [80, 96] },
          top: { knee: [160, 174] },
        },
        orientation_signature: { body_orientation: 'upright' },
        movement_pattern: {
          tracked_joint: 'knee',
          oscillating_landmarks: ['hip', 'knee'],
        },
        visibility_pattern: {
          required_landmarks: [
            'left_shoulder',
            'right_shoulder',
            'left_ankle',
            'right_ankle',
          ],
        },
        dominant_joint: 'knee',
        tolerance: new Prisma.Decimal('12'),
        rep_thresholds: {
          down: { angle: 88, tolerance: 12 },
          up: { angle: 166, tolerance: 10 },
        },
        rep_rules: { depth_check: 'hip_depth' },
      },
    ]);
    repo.updatePoseSessionAnalysis.mockResolvedValue(
      makePoseSessionDetail({
        detected_exercise_name: 'squat',
        detected_profile_id: 'profile-1',
      }),
    );
    const squatFallback = buildFallbackPoseMovementContract('squat');
    if (!squatFallback) throw new Error('squat contract missing');
    const authoritativeContract = {
      ...squatFallback,
      repThresholds: {
        down: { angle: 101, tolerance: 7 },
        up: { angle: 159, tolerance: 8 },
      },
    };
    exerciseService.resolveExerciseContract.mockResolvedValueOnce({
      tracking_mode: 'inherit',
      movement_profile: { movementContract: authoritativeContract },
      movement_contract_identity: {
        exerciseId: 'exercise-squat',
        familyKey: 'squat',
        revision: 7,
        source: 'family',
        trackingMode: 'inherit',
      },
    });

    const result = await service.analyzePoseSessionById(
      'user-1',
      'pose-1',
      makeAnalyzeDto(),
    );

    expect(aiClient.analyzePoseSequence).not.toHaveBeenCalled();
    expect(exerciseService.resolveExerciseContract).toHaveBeenCalledWith({
      exerciseId: null,
      label: 'squat',
    });
    expect(repo.updatePoseSessionAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        poseSessionId: 'pose-1',
        detectedExerciseName: 'squat',
        detectedProfileId: 'profile-1',
      }),
    );
    const updateAnalysisMock =
      repo.updatePoseSessionAnalysis as jest.MockedFunction<
        (input: { analysisSummary: unknown }) => Promise<unknown>
      >;
    const persistedAnalysis =
      updateAnalysisMock.mock.calls[0]?.[0].analysisSummary;
    expect(persistedAnalysis).toMatchObject({
      movement_contract: {
        rep_thresholds: {
          down: { angle: 101, tolerance: 7 },
          up: { angle: 159, tolerance: 8 },
        },
      },
      movement_contract_identity: {
        exerciseId: 'exercise-squat',
        familyKey: 'squat',
        revision: 7,
        source: 'family',
        trackingMode: 'inherit',
      },
    });
    expect(result).toMatchObject({
      pose_session_id: 'pose-1',
      confidence: 1,
      exercise_class: 'squat',
      matched_profile_id: 'profile-1',
      classification_source: 'preset',
      needs_confirmation: false,
      processing_mode: 'sequence',
      rep_event: false,
      rep_count_delta: 0,
      phase: null,
      movement_contract: {
        exercise: 'squat',
        dominant_joint: 'knee',
        rep_model: 'bilateral',
        required_sides: 'both',
        primary_joints: ['left_knee', 'right_knee'],
        phase_order: ['setup', 'down', 'up'],
        secondary_check: 'hip_depth',
        oscillating_joints: ['hip', 'knee'],
        rep_thresholds: {
          down: { angle: 101, tolerance: 7 },
          up: { angle: 159, tolerance: 8 },
        },
      },
      movement_contract_identity: {
        exerciseId: 'exercise-squat',
        familyKey: 'squat',
        revision: 7,
        source: 'family',
        trackingMode: 'inherit',
      },
    });
    expect(result.movement_contract?.rep_thresholds).not.toEqual({
      down: { angle: 88, tolerance: 12 },
      up: { angle: 166, tolerance: 10 },
    });
  });

  it('fails closed when a matching preset has no authoritative family resolution', async () => {
    repo.findPoseSessionByIdOrThrow.mockResolvedValue(makePoseSessionDetail());
    repo.listBootstrapPoseProfiles.mockResolvedValue([
      {
        id: 'profile-1',
        canonical_name: 'squat',
        profile_kind: PoseProfileKind.seed,
        landmark_signature: { left_shoulder: [0.1, 0.2] },
        angle_signature: {
          bottom: { knee: [80, 96] },
          top: { knee: [160, 174] },
        },
        orientation_signature: { body_orientation: 'upright' },
        movement_pattern: {
          tracked_joint: 'knee',
          oscillating_landmarks: ['hip', 'knee'],
        },
        visibility_pattern: {
          required_landmarks: [
            'left_shoulder',
            'right_shoulder',
            'left_ankle',
            'right_ankle',
          ],
        },
        dominant_joint: 'knee',
        tolerance: new Prisma.Decimal('12'),
        rep_thresholds: {
          down: { angle: 88, tolerance: 12 },
          up: { angle: 166, tolerance: 10 },
        },
        rep_rules: { depth_check: 'hip_depth' },
      },
    ]);
    aiClient.analyzePoseSequence.mockResolvedValue({
      confidence: 0.96,
      exercise_class: 'squat',
      matched_profile_id: 'profile-1',
      movement_contract: {
        exercise: 'squat',
        dominant_joint: 'knee',
        rep_thresholds: {
          down: { angle: 88, tolerance: 12 },
          up: { angle: 166, tolerance: 10 },
        },
        secondary_check: 'hip_depth',
        oscillating_joints: ['hip', 'knee'],
      },
      classification_source: 'classifier',
      needs_confirmation: false,
      candidate_exercises: ['squat'],
      form_feedback: [],
      learned_profile: null,
      subject_locked: true,
      subject_lock_confidence: 0.9,
    });
    repo.updatePoseSessionAnalysis.mockResolvedValue(
      makePoseSessionDetail({ detected_exercise_name: 'squat' }),
    );

    const result = await service.analyzePoseSessionById(
      'user-1',
      'pose-1',
      makeAnalyzeDto(),
    );

    expect(exerciseService.resolveExerciseContract).toHaveBeenCalledWith({
      exerciseId: null,
      label: 'squat',
    });
    expect(aiClient.analyzePoseSequence).toHaveBeenCalled();
    expect(result.needs_confirmation).toBe(true);
    expect(result.movement_contract).toBeNull();
    expect(result.movement_contract_identity).toBeNull();
  });

  it('falls back to AI sequence classification when the hinted preset does not match the live pose signals', async () => {
    repo.findPoseSessionByIdOrThrow.mockResolvedValue(makePoseSessionDetail());
    repo.listBootstrapPoseProfiles.mockResolvedValue([
      {
        id: 'profile-1',
        canonical_name: 'squat',
        profile_kind: PoseProfileKind.seed,
        landmark_signature: { anchors: ['hips', 'knees', 'ankles'] },
        angle_signature: {
          bottom: { knee: [80, 96] },
          top: { knee: [160, 174] },
        },
        orientation_signature: { body_orientation: 'upright' },
        movement_pattern: {
          tracked_joint: 'knee',
          oscillating_landmarks: ['hip', 'knee'],
        },
        visibility_pattern: {
          required_landmarks: [
            'left_shoulder',
            'right_shoulder',
            'left_ankle',
            'right_ankle',
          ],
        },
        dominant_joint: 'knee',
        tolerance: new Prisma.Decimal('12'),
        rep_thresholds: {
          down: { angle: 88, tolerance: 12 },
          up: { angle: 166, tolerance: 10 },
        },
        rep_rules: { depth_check: 'hip_depth' },
      },
    ]);
    aiClient.analyzePoseSequence.mockResolvedValue({
      confidence: 0.92,
      exercise_class: 'push_up',
      matched_profile_id: null,
      movement_contract: {
        exercise: 'push_up',
        dominant_joint: 'elbow',
        rep_thresholds: {
          down: { angle: 82, tolerance: 12 },
          up: { angle: 166, tolerance: 10 },
        },
        secondary_check: 'body_line',
        oscillating_joints: ['elbow', 'shoulder'],
      },
      classification_source: 'classifier',
      needs_confirmation: false,
      candidate_exercises: ['push_up', 'bench_press', 'plank'],
      form_feedback: ['Keep the body in one line.'],
      learned_profile: null,
      subject_locked: true,
      subject_lock_confidence: 0.81,
    });
    repo.updatePoseSessionAnalysis.mockResolvedValue(
      makePoseSessionDetail({
        detected_exercise_name: 'push_up',
        detected_profile_id: null,
      }),
    );

    const result = await service.analyzePoseSessionById(
      'user-1',
      'pose-1',
      makeAnalyzeDto({
        signals: {
          ...makeAnalyzeDto().signals,
          angles: [
            {
              captured_at_ms: 1712844369000,
              elbow: 82,
              shoulder: 95,
              hip: 148,
              knee: 165,
              ankle: 104,
              left_ankle: 102,
              right_ankle: 106,
            },
          ],
          orientation: {
            body_orientation: 'horizontal',
            torso_slope_deg: 21,
            vector: { x: 0.02, y: 0.48 },
          },
          visibility: {
            average_visibility: 0.92,
            feet_visibility: 0.62,
            low_confidence_landmarks: [],
            reliable_frame_count: 1,
            wrist_visibility: 0.9,
          },
          hip: {
            average_y: 0.54,
            range_y: 0.06,
            stable: false,
          },
          temporal: {
            amplitudes: {
              elbow: 32,
              hip: 14,
              knee: 6,
              shoulder: 18,
            },
            oscillating_joints: ['elbow', 'shoulder'],
          },
        },
      }),
    );

    expect(aiClient.analyzePoseSequence).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseHint: null,
      }),
    );
    type SequenceCall = [
      {
        signals?: {
          angles?: Array<Record<string, number | null>>;
        };
      },
    ];
    const sequenceCalls = aiClient.analyzePoseSequence.mock
      .calls as unknown as SequenceCall[];
    const forwardedAngles = sequenceCalls[0]?.[0]?.signals?.angles?.[0];
    expect(forwardedAngles?.ankle).toBe(104);
    expect(forwardedAngles?.left_ankle).toBe(102);
    expect(forwardedAngles?.right_ankle).toBe(106);
    expect(result.exercise_class).toBe('push_up');
    expect(result.classification_source).toBe('classifier');
    expect(result.processing_mode).toBe('sequence');
    expect(result.movement_contract).toBeNull();
    expect(result.needs_confirmation).toBe(true);
  });

  it('accepts native frame payloads through the owned analyze endpoint', async () => {
    repo.findPoseSessionByIdOrThrow.mockResolvedValue(makePoseSessionDetail());
    repo.listBootstrapPoseProfiles.mockResolvedValue([
      {
        id: 'profile-1',
        canonical_name: 'squat',
        profile_kind: PoseProfileKind.seed,
        landmark_signature: { left_shoulder: [0.1, 0.2] },
        angle_signature: {
          bottom: { knee: [80, 96] },
          top: { knee: [160, 174] },
        },
        orientation_signature: { body_orientation: 'upright' },
        movement_pattern: {
          tracked_joint: 'knee',
          oscillating_landmarks: ['hip', 'knee'],
        },
        visibility_pattern: {
          required_landmarks: [
            'left_shoulder',
            'right_shoulder',
            'left_ankle',
            'right_ankle',
          ],
        },
        dominant_joint: 'knee',
        tolerance: new Prisma.Decimal('12'),
        rep_thresholds: {
          down: { angle: 88, tolerance: 12 },
          up: { angle: 166, tolerance: 10 },
        },
        rep_rules: { depth_check: 'hip_depth' },
      },
    ]);
    aiClient.analyzePoseFrame.mockResolvedValue({
      confidence: 0.74,
      exercise_class: 'squat',
      matched_profile_id: null,
      movement_contract: null,
      classification_source: 'preset',
      needs_confirmation: false,
      processing_mode: 'legacy_frame',
      rep_event: false,
      rep_count_delta: 0,
      phase: null,
      candidate_exercises: ['squat'],
      form_feedback: [
        'Native snapshot mode can detect the exercise, but automatic rep counting still needs the native landmark runtime.',
      ],
      learned_profile: null,
      subject_locked: true,
      subject_lock_confidence: 0.72,
    });
    repo.updatePoseSessionAnalysis.mockResolvedValue(
      makePoseSessionDetail({
        detected_exercise_name: 'squat',
        detected_profile_id: 'profile-1',
      }),
    );

    const frameAuthoritativeContract =
      buildFallbackPoseMovementContract('squat');
    if (!frameAuthoritativeContract) throw new Error('squat contract missing');
    exerciseService.resolveExerciseContract.mockResolvedValueOnce({
      tracking_mode: 'inherit',
      movement_profile: { movementContract: frameAuthoritativeContract },
      movement_contract_identity: {
        exerciseId: 'exercise-squat',
        familyKey: 'squat',
        revision: 3,
        source: 'family',
        trackingMode: 'inherit',
      },
    });

    const result = await service.analyzePoseSessionById(
      'user-1',
      'pose-1',
      makeFrameAnalyzeDto(),
    );

    expect(aiClient.analyzePoseFrame).toHaveBeenCalledWith({
      poseSessionId: 'pose-1',
      frameBase64: 'frame-data',
    });
    expect(aiClient.analyzePoseSequence).not.toHaveBeenCalled();
    expect(repo.updatePoseSessionAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        poseSessionId: 'pose-1',
        detectedExerciseName: 'squat',
        detectedProfileId: 'profile-1',
      }),
    );
    expect(result).toMatchObject({
      pose_session_id: 'pose-1',
      exercise_class: 'squat',
      matched_profile_id: 'profile-1',
      processing_mode: 'legacy_frame',
      rep_event: false,
      rep_count_delta: 0,
      phase: null,
      movement_contract: {
        exercise: 'squat',
        dominant_joint: 'knee',
        rep_model: 'bilateral',
        required_sides: 'both',
        primary_joints: ['left_knee', 'right_knee'],
        phase_order: ['setup', 'down', 'up'],
        secondary_check: 'hip_depth',
        oscillating_joints: ['hip', 'knee'],
      },
    });
  });

  it('keeps an incomplete learned profile manual-only', async () => {
    repo.findPoseSessionByIdOrThrow.mockResolvedValue(makePoseSessionDetail());
    repo.listBootstrapPoseProfiles.mockResolvedValue([
      {
        id: 'profile-push-up',
        canonical_name: 'push_up',
        profile_kind: PoseProfileKind.learned,
        landmark_signature: { anchors: ['shoulders', 'hips', 'ankles'] },
        angle_signature: { elbow_center: 112 },
        orientation_signature: { body_orientation: 'horizontal' },
        movement_pattern: {
          tracked_joint: 'elbow',
          oscillating_landmarks: ['elbow', 'shoulder'],
        },
        visibility_pattern: {
          required_landmarks: [
            'left_shoulder',
            'right_shoulder',
            'left_ankle',
            'right_ankle',
          ],
        },
        dominant_joint: 'elbow',
        tolerance: null,
        rep_thresholds: null,
        rep_rules: {
          body_line: 'Maintain a straight line from shoulders to ankles.',
        },
      },
    ]);
    aiClient.analyzePoseSequence.mockResolvedValue({
      confidence: 0.93,
      exercise_class: null,
      matched_profile_id: 'profile-push-up',
      movement_contract: null,
      classification_source: 'classifier',
      needs_confirmation: true,
      candidate_exercises: ['push_up'],
      form_feedback: [],
      learned_profile: null,
      subject_locked: true,
      subject_lock_confidence: 0.86,
    });
    repo.upsertLearnedPoseProfile.mockResolvedValue({
      id: 'profile-push-up-learned',
      exercise_id: null,
      canonical_name: 'push_up',
      profile_kind: PoseProfileKind.learned,
      landmark_signature: { anchors: ['shoulders', 'hips', 'ankles'] },
      angle_signature: { elbow_center: 112 },
      orientation_signature: { body_orientation: 'horizontal' },
      movement_pattern: {
        tracked_joint: 'elbow',
        oscillating_landmarks: ['elbow', 'shoulder'],
      },
      visibility_pattern: {
        required_landmarks: [
          'left_shoulder',
          'right_shoulder',
          'left_ankle',
          'right_ankle',
        ],
      },
      dominant_joint: 'elbow',
      tolerance: new Prisma.Decimal('14'),
      rep_thresholds: {
        down: { angle: 84, tolerance: 14 },
        up: { angle: 166, tolerance: 14 },
      },
      rep_rules: {
        body_line: 'Maintain a straight line from shoulders to ankles.',
      },
      sample_count: 3,
      confidence_threshold: new Prisma.Decimal('0.93'),
      is_active: true,
      created_at: new Date('2026-03-27T08:00:00.000Z'),
      updated_at: new Date('2026-03-27T08:05:00.000Z'),
      exercise: null,
    });
    repo.updatePoseSessionAnalysis.mockResolvedValue(
      makePoseSessionDetail({
        detected_exercise_name: 'push_up',
        detected_profile_id: null,
      }),
    );

    const result = await service.analyzePoseSessionById(
      'user-1',
      'pose-1',
      makeAnalyzeDto({
        exercise_hint: 'Barbell Back Squat',
        signals: {
          angles: [
            {
              captured_at_ms: 1712844369000,
              elbow: 86,
              shoulder: 101,
              hip: 151,
              knee: 167,
            },
            {
              captured_at_ms: 1712844369400,
              elbow: 146,
              shoulder: 112,
              hip: 158,
              knee: 169,
            },
          ],
          orientation: {
            body_orientation: 'horizontal',
            torso_slope_deg: 18,
            vector: { x: 0.03, y: 0.51 },
          },
          visibility: {
            average_visibility: 0.93,
            feet_visibility: 0.58,
            low_confidence_landmarks: [],
            reliable_frame_count: 2,
            wrist_visibility: 0.9,
          },
          hip: {
            average_y: 0.53,
            range_y: 0.05,
            stable: false,
          },
          temporal: {
            amplitudes: {
              elbow: 34,
              hip: 12,
              knee: 4,
              shoulder: 18,
            },
            oscillating_joints: ['elbow', 'shoulder'],
          },
        },
      }),
    );

    expect(repo.upsertLearnedPoseProfile).not.toHaveBeenCalled();
    expect(result.exercise_class).toBe('push_up');
    expect(result.matched_profile_id).toBeNull();
    expect(result.needs_confirmation).toBe(true);
    expect(result.movement_contract).toBeNull();
    expect(result.movement_contract_identity).toBeNull();
  });

  it('returns provider-unavailable equipment metadata when hosted detection is not configured', async () => {
    await expect(
      service.detectPoseEquipment(makeDetectEquipmentDto()),
    ).resolves.toEqual({
      equipment_confidence: null,
      equipment_conflicts: ['equipment_provider_unavailable'],
      equipment_context: null,
      equipment_detections: [],
      equipment_source: null,
      provider_enabled: false,
    });
  });

  it('maps hosted provider predictions into normalized equipment context', async () => {
    config.get.mockImplementation((key: string, fallback?: string | number) => {
      switch (key) {
        case 'jwt.secret':
          return 'jwt-secret';
        case 'equipmentDetection.provider':
          return 'roboflow';
        case 'equipmentDetection.roboflowApiKey':
          return 'rf-test-key';
        case 'equipmentDetection.roboflowModelId':
          return 'gym-equipment/1';
        case 'equipmentDetection.roboflowApiBaseUrl':
          return 'https://example.roboflow.test';
        case 'equipmentDetection.requestTimeoutMs':
          return 2500;
        default:
          return fallback ?? '';
      }
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          image: { height: 800, width: 1000 },
          predictions: [
            {
              class: 'dumbbell',
              confidence: 0.88,
              height: 160,
              width: 240,
              x: 500,
              y: 400,
            },
          ],
        }),
    }) as typeof global.fetch;

    await expect(
      service.detectPoseEquipment(makeDetectEquipmentDto()),
    ).resolves.toEqual({
      equipment_confidence: 0.88,
      equipment_conflicts: [],
      equipment_context: 'dumbbell',
      equipment_detections: [
        {
          confidence: 0.88,
          height: 0.2,
          label: 'dumbbell',
          width: 0.24,
          x: 0.38,
          y: 0.4,
        },
      ],
      equipment_source: 'provider_api',
      provider_enabled: true,
    });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.roboflow.test/gym-equipment/1?api_key=rf-test-key',
      expect.objectContaining({
        body: 'frame-data',
        method: 'POST',
      }),
    );
  });

  it('maps local AI equipment detections into the existing equipment contract', async () => {
    config.get.mockImplementation((key: string, fallback?: string | number) => {
      switch (key) {
        case 'jwt.secret':
          return 'jwt-secret';
        case 'ai.apiBaseUrl':
          return 'http://127.0.0.1:8000';
        case 'equipmentDetection.provider':
          return 'local_ai';
        default:
          return fallback ?? '';
      }
    });
    aiClient.detectEquipment.mockResolvedValue({
      equipment_confidence: 0.91,
      equipment_conflicts: [],
      equipment_context: 'dumbbell',
      equipment_detections: [
        {
          confidence: 0.91,
          height: 0.18,
          label: 'Dumbbell',
          width: 0.22,
          x: 0.42,
          y: 0.48,
        },
      ],
      equipment_family: 'dumbbell',
    });

    await expect(
      service.detectPoseEquipment(makeDetectEquipmentDto()),
    ).resolves.toEqual({
      equipment_confidence: 0.91,
      equipment_conflicts: [],
      equipment_context: 'dumbbell',
      equipment_detections: [
        {
          confidence: 0.91,
          height: 0.18,
          label: 'Dumbbell',
          width: 0.22,
          x: 0.42,
          y: 0.48,
        },
      ],
      equipment_source: 'provider_api',
      provider_enabled: true,
    });

    expect(aiClient.detectEquipment).toHaveBeenCalledWith({
      cameraFacingMode: 'environment',
      exerciseHint: 'Dumbbell Bicep Curl',
      frameBase64: 'frame-data',
    });
  });

  it('ignores low-confidence or exercise-name-only provider predictions', async () => {
    config.get.mockImplementation((key: string, fallback?: string | number) => {
      switch (key) {
        case 'jwt.secret':
          return 'jwt-secret';
        case 'equipmentDetection.provider':
          return 'roboflow';
        case 'equipmentDetection.roboflowApiKey':
          return 'rf-test-key';
        case 'equipmentDetection.roboflowModelId':
          return 'gym-equipment/1';
        case 'equipmentDetection.roboflowApiBaseUrl':
          return 'https://example.roboflow.test';
        case 'equipmentDetection.requestTimeoutMs':
          return 2500;
        default:
          return fallback ?? '';
      }
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          predictions: [
            { class: 'curl', confidence: 0.99 },
            { class: 'dumbbell', confidence: 0.31 },
          ],
        }),
    }) as typeof global.fetch;

    await expect(
      service.detectPoseEquipment(makeDetectEquipmentDto()),
    ).resolves.toEqual({
      equipment_confidence: null,
      equipment_conflicts: [],
      equipment_context: null,
      equipment_detections: [],
      equipment_source: null,
      provider_enabled: true,
    });
  });

  it('finalizes open pose sessions through Python and persists learned-profile metadata', async () => {
    repo.findPoseSessionByIdOrThrow.mockResolvedValue(makePoseSessionDetail());
    aiClient.finalizePoseSession.mockResolvedValue({
      detected_exercise_name: 'squat',
      matched_profile_id: null,
      classification_confidence: 0.94,
      subject_lock_confidence: 0.88,
      analysis_summary: {
        reps_detected: 12,
        form_feedback: ['Keep your chest up.'],
        average_confidence: 0.91,
        dominant_joint_angles: { hip_knee_ankle: 92.4 },
      },
      learned_profile: {
        canonical_name: 'squat',
        landmark_signature: { left_shoulder: [0.1, 0.2] },
        angle_signature: { hip_knee_ankle: 92.4 },
        orientation_signature: {},
        movement_pattern: {},
        visibility_pattern: {},
        dominant_joint: null,
        tolerance: null,
        rep_thresholds: null,
        rep_rules: { rep_start_angle: 88 },
      },
    });
    repo.finalizePoseSession.mockResolvedValue(
      makePoseSessionDetail({
        rep_count_ai: 12,
        confidence_avg: new Prisma.Decimal('0.910'),
        detected_exercise_name: 'squat',
        detected_profile_id: 'profile-learned-1',
        classification_confidence: new Prisma.Decimal('0.940'),
        subject_lock_confidence: new Prisma.Decimal('0.880'),
        analysis_summary: {
          reps_detected: 12,
          form_feedback: ['Keep your chest up.'],
          average_confidence: 0.91,
          dominant_joint_angles: { hip_knee_ankle: 92.4 },
        },
        ended_at: new Date('2026-03-27T08:05:00.000Z'),
        updated_at: new Date('2026-03-27T08:05:00.000Z'),
      }),
    );

    const result = await service.finalizePoseSession(
      {
        poseSessionId: 'pose-1',
        userId: 'user-1',
        exerciseHint: 'Barbell Back Squat',
        repCountAi: 10,
        confidenceSum: 2.73,
        confidenceSamples: 3,
        acceptedFps: 15,
        subjectLockMode: 'single_subject',
      },
      'client_disconnect',
    );

    expect(aiClient.finalizePoseSession).toHaveBeenCalledWith({
      poseSessionId: 'pose-1',
    });
    const finalizeCalls = repo.finalizePoseSession.mock.calls as Array<
      [
        {
          poseSessionId: string;
          repCountAi: number;
          confidenceAvg: number;
          detectedExerciseName: string | null;
          detectedProfileId: string | null;
          classificationConfidence: number | null;
          subjectLockConfidence: number | null;
          analysisSummary: {
            reps_detected: number;
            form_feedback: string[];
            average_confidence: number;
            dominant_joint_angles: { hip_knee_ankle: number };
            terminal_state: string;
            eligibility_state: string;
            integrity_state: string;
          };
          learnedProfile: {
            canonicalName: string;
            exerciseId: string | null;
            landmarkSignature: Record<string, unknown>;
            angleSignature: Record<string, unknown>;
            orientationSignature: Record<string, unknown>;
            movementPattern: Record<string, unknown>;
            visibilityPattern: Record<string, unknown>;
            dominantJoint: string | null;
            tolerance: number | null;
            repThresholds: Record<string, unknown> | null;
            repRules: Record<string, unknown> | null;
          } | null;
        },
      ]
    >;
    const finalizeInput = finalizeCalls[0][0];
    expect(finalizeInput.poseSessionId).toBe('pose-1');
    expect(finalizeInput.repCountAi).toBe(12);
    expect(finalizeInput.confidenceAvg).toBe(0.91);
    expect(finalizeInput.detectedExerciseName).toBe('squat');
    expect(finalizeInput.detectedProfileId).toBeNull();
    expect(finalizeInput.classificationConfidence).toBe(0.94);
    expect(finalizeInput.subjectLockConfidence).toBe(0.88);
    expect(finalizeInput.analysisSummary.reps_detected).toBe(12);
    expect(finalizeInput.analysisSummary.form_feedback).toEqual([
      'Keep your chest up.',
    ]);
    expect(finalizeInput.analysisSummary.average_confidence).toBe(0.91);
    expect(finalizeInput.analysisSummary.dominant_joint_angles).toEqual({
      hip_knee_ankle: 92.4,
    });
    expect(finalizeInput.analysisSummary.terminal_state).toBe('flagged');
    expect(finalizeInput.analysisSummary.eligibility_state).toBe(
      'review_required',
    );
    expect(finalizeInput.analysisSummary.integrity_state).toBe('suspicious');
    expect(finalizeInput.learnedProfile).toEqual({
      canonicalName: 'squat',
      exerciseId: null,
      landmarkSignature: { left_shoulder: [0.1, 0.2] },
      angleSignature: { hip_knee_ankle: 92.4 },
      orientationSignature: {},
      movementPattern: {},
      visibilityPattern: {},
      dominantJoint: null,
      tolerance: null,
      repThresholds: null,
      repRules: { rep_start_angle: 88 },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'pose-1',
        rep_count_ai: 12,
        confidence_avg: '0.91',
        detected_exercise_name: 'squat',
        detected_profile_id: 'profile-learned-1',
        classification_confidence: '0.94',
      }),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fitness.pose-session.finalized',
      expect.objectContaining({
        sourceType: 'pose_session_finalized',
        sourceId: 'pose-1',
        sourceRevision: 1,
        idempotencyKey: 'pose_session_finalized:pose-1:1',
        terminalState: 'flagged',
        eligibilityState: 'review_required',
        integrityState: 'suspicious',
      }),
    );
    expect(repo.getNextPoseSourceRevision).toHaveBeenCalledWith('pose-1');
  });

  it('returns the already-persisted summary when manual finalize is repeated', async () => {
    repo.findPoseSessionByIdOrThrow.mockResolvedValue(
      makePoseSessionDetail({
        rep_count_ai: 12,
        confidence_avg: new Prisma.Decimal('0.910'),
        detected_exercise_name: 'squat',
        detected_profile_id: 'profile-1',
        classification_confidence: new Prisma.Decimal('0.940'),
        subject_lock_confidence: new Prisma.Decimal('0.880'),
        analysis_summary: {
          reps_detected: 12,
          form_feedback: ['Keep your chest up.'],
        },
        ended_at: new Date('2026-03-27T08:05:00.000Z'),
        updated_at: new Date('2026-03-27T08:05:00.000Z'),
      }),
    );

    const finalizePayload: FinalizePoseSessionDTO = {
      ended_reason: 'manual_stop',
      final_rep_count: 0,
      form_feedback: [],
      raw_angle_data: [],
    };

    const result = await service.finalizePoseSessionById(
      'user-1',
      'pose-1',
      finalizePayload,
    );

    expect(aiClient.finalizePoseSession).not.toHaveBeenCalled();
    expect(repo.finalizePoseSession).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'pose-1',
        ended_at: '2026-03-27T08:05:00.000Z',
        detected_profile_id: 'profile-1',
      }),
    );
  });

  it('bumps pose source revision when finalized output is replayed', async () => {
    repo.getNextPoseSourceRevision.mockResolvedValue(2);
    repo.findPoseSessionByIdOrThrow.mockResolvedValue(makePoseSessionDetail());
    aiClient.finalizePoseSession.mockResolvedValue({
      detected_exercise_name: 'squat',
      matched_profile_id: null,
      classification_confidence: 0.94,
      subject_lock_confidence: 0.88,
      analysis_summary: {
        reps_detected: 12,
        form_feedback: ['Keep your chest up.'],
        average_confidence: 0.91,
      },
      learned_profile: null,
    });
    repo.finalizePoseSession.mockResolvedValue(
      makePoseSessionDetail({
        rep_count_ai: 12,
        confidence_avg: new Prisma.Decimal('0.910'),
        detected_exercise_name: 'squat',
        detected_profile_id: 'profile-1',
        classification_confidence: new Prisma.Decimal('0.940'),
        subject_lock_confidence: new Prisma.Decimal('0.880'),
        analysis_summary: {
          reps_detected: 12,
          form_feedback: ['Keep your chest up.'],
          average_confidence: 0.91,
        },
        ended_at: new Date('2026-03-27T08:05:00.000Z'),
        updated_at: new Date('2026-03-27T08:05:00.000Z'),
      }),
    );

    await service.finalizePoseSession(
      {
        poseSessionId: 'pose-1',
        userId: 'user-1',
        exerciseHint: 'Barbell Back Squat',
        repCountAi: 10,
        confidenceSum: 2.73,
        confidenceSamples: 3,
        acceptedFps: 15,
        subjectLockMode: 'single_subject',
      },
      'client_disconnect',
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'fitness.pose-session.finalized',
      expect.objectContaining({
        sourceRevision: 2,
        idempotencyKey: 'pose_session_finalized:pose-1:2',
      }),
    );
  });

  it('loads an owned pose-session summary and forbids cross-user access', async () => {
    repo.findPoseSessionByIdOrThrow
      .mockResolvedValueOnce(
        makePoseSessionDetail({
          rep_count_ai: 6,
          confidence_avg: new Prisma.Decimal('0.900'),
          detected_exercise_name: 'squat',
          classification_confidence: new Prisma.Decimal('0.944'),
          ended_at: new Date('2026-03-27T08:03:00.000Z'),
          updated_at: new Date('2026-03-27T08:03:00.000Z'),
        }),
      )
      .mockResolvedValueOnce(
        makePoseSessionDetail({
          user_id: 'user-2',
        }),
      );

    await expect(
      service.getPoseSessionById('user-1', 'pose-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'pose-1',
        confidence_avg: '0.9',
        detected_exercise_name: 'squat',
        classification_confidence: '0.944',
      }),
    );

    await expect(
      service.getPoseSessionById('user-1', 'pose-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lists pose profiles through repository pagination', async () => {
    repo.listPoseProfiles.mockResolvedValue({
      data: [
        {
          id: 'profile-1',
          exercise_id: 'exercise-1',
          canonical_name: 'squat',
          profile_kind: PoseProfileKind.seed,
          landmark_signature: { left_shoulder: [0.1, 0.2] },
          angle_signature: { hip_knee_ankle: 92.4 },
          rep_rules: { rep_start_angle: 88 },
          sample_count: 14,
          confidence_threshold: new Prisma.Decimal('0.850'),
          is_active: true,
          created_at: new Date('2026-03-27T08:00:00.000Z'),
          updated_at: new Date('2026-03-27T08:05:00.000Z'),
          exercise: { id: 'exercise-1', name: 'Barbell Back Squat' },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, total_pages: 1 },
    });

    const result = await service.listPoseProfiles({
      page: 1,
      limit: 20,
      canonical_name: 'squat',
    });

    expect(repo.listPoseProfiles).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      canonical_name: 'squat',
    });
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'profile-1',
        exercise_name: 'Barbell Back Squat',
        confidence_threshold: '0.85',
      }),
    );
  });
});
