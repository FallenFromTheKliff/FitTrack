import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { PoseProfileKind, Prisma, UserStatus } from '@prisma/client';
import type Redis from 'ioredis';
import type { Socket } from 'socket.io';

import { AiPythonClientService } from '../../ai/ai-python-client.service';
import { PoseRepository } from './pose.repository';
import { PoseService } from './pose.service';

describe('PoseService', () => {
  let service: PoseService;

  const repo = {
    createPoseSession: jest.fn(),
    listBootstrapPoseProfiles: jest.fn(),
    finalizePoseSession: jest.fn(),
    findPoseSessionByIdOrThrow: jest.fn(),
    listPoseProfiles: jest.fn(),
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
    finalizePoseSession: jest.fn(),
  };

  const redis = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PoseService,
        { provide: PoseRepository, useValue: repo },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: config },
        { provide: AiPythonClientService, useValue: aiClient },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get<PoseService>(PoseService);
    jest.clearAllMocks();
  });

  function makePoseSessionDetail(
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return {
      id: 'pose-1',
      user_id: 'user-1',
      exercise_log_id: null,
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
      } as Socket),
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
      } as Socket),
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
      } as Socket),
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
      exerciseHint: 'Barbell Back Squat',
      canonicalHint: 'squat',
    });
    expect(aiClient.bootstrapPoseSession).toHaveBeenCalledWith({
      poseSessionId: 'pose-1',
      exerciseHint: 'Barbell Back Squat',
      starterCatalog: [
        'push_up',
        'squat',
        'bicep_curl',
        'shoulder_press',
        'plank',
      ],
      candidateProfiles: [
        {
          id: 'profile-1',
          canonical_name: 'squat',
          profile_kind: PoseProfileKind.seed,
          landmark_signature: { left_shoulder: [0.1, 0.2] },
          angle_signature: { hip_knee_ankle: 92.4 },
          rep_rules: { rep_start_angle: 88 },
        },
      ],
    });
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
    expect(result.nextState.repCountAi).toBe(3);
    expect(result.nextState.confidenceSum).toBe(0.91);
    expect(result.nextState.confidenceSamples).toBe(1);
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
    expect(repo.finalizePoseSession).toHaveBeenCalledWith(
      expect.objectContaining({
        poseSessionId: 'pose-1',
        repCountAi: 12,
        confidenceAvg: 0.91,
        detectedExerciseName: 'squat',
        detectedProfileId: null,
        classificationConfidence: 0.94,
        subjectLockConfidence: 0.88,
        analysisSummary: {
          reps_detected: 12,
          form_feedback: ['Keep your chest up.'],
          average_confidence: 0.91,
          dominant_joint_angles: { hip_knee_ankle: 92.4 },
        },
        learnedProfile: {
          canonicalName: 'squat',
          exerciseId: null,
          landmarkSignature: { left_shoulder: [0.1, 0.2] },
          angleSignature: { hip_knee_ankle: 92.4 },
          repRules: { rep_start_angle: 88 },
        },
      }),
    );
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

    const result = await service.finalizePoseSessionById('user-1', 'pose-1', {
      ended_reason: 'manual_stop',
    });

    expect(aiClient.finalizePoseSession).not.toHaveBeenCalled();
    expect(repo.finalizePoseSession).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({
        id: 'pose-1',
        ended_at: '2026-03-27T08:05:00.000Z',
        detected_profile_id: 'profile-1',
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
