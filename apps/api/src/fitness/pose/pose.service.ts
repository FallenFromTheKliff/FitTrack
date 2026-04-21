import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import type { Socket } from 'socket.io';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import { AiPythonClientService } from '../../ai/ai-python-client.service';
import { PaginatedResult } from '../../common/base-repository/base-repository';
import {
  AnalyzePoseSequenceDTO,
  FinalizePoseSessionDTO,
  PoseFrameAnalysisResponseDTO,
  PoseProfileFilterDTO,
  PoseProfileResponseDTO,
  PoseSessionBootstrapResponseDTO,
  PoseSessionEndReason,
  PoseSessionResponseDTO,
  StartPoseSessionDTO,
} from './dto/pose.dto';
import {
  assertActivePoseUser,
  createUnauthorizedPoseSocketException,
  extractSocketToken,
} from './pose.auth';
import { poseStarterCatalog } from './pose.constants';
import {
  normalizePoseExerciseHint,
  toCanonicalPoseExerciseHint,
  toDecimalNumber,
  toPoseBootstrapProfile,
  toPoseJointName,
  toPoseFinalizePersistenceInput,
  toPoseProfileResponse,
  toPoseSessionResponse,
  toOptionalJsonObject,
  toPrismaJsonObject,
} from './pose.mappers';
import {
  PoseBootstrapProfileRecord,
  PoseProfileRecord,
  PoseRepository,
  PoseSessionDetailRecord,
} from './pose.repository';
import type {
  PoseConnectionState,
  PoseFrameProcessingResult,
} from './pose.types';

const poseContractConfidenceThreshold = 0.8;
const defaultPoseTolerance = 12;
const posePresetMatchThreshold = 0.58;

type PoseContractJoint = 'elbow' | 'shoulder' | 'hip' | 'knee';
type PoseAnalyzeSignalsValue = AnalyzePoseSequenceDTO['signals'];

type PoseMovementContractValue = NonNullable<
  PoseFrameAnalysisResponseDTO['movement_contract']
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toThreshold(
  value: unknown,
  fallbackTolerance: number,
): { angle: number; tolerance: number } | null {
  if (!isRecord(value) || typeof value.angle !== 'number') {
    return null;
  }

  return {
    angle: value.angle,
    tolerance:
      typeof value.tolerance === 'number' ? value.tolerance : fallbackTolerance,
  };
}

function toAngleFromRange(
  value: unknown,
  fallbackTolerance: number,
): { angle: number; tolerance: number } | null {
  if (!Array.isArray(value) || value.length !== 2) {
    return null;
  }

  const [start, end] = value;
  if (typeof start !== 'number' || typeof end !== 'number') {
    return null;
  }

  return {
    angle: Number(((start + end) / 2).toFixed(3)),
    tolerance: Number(
      Math.max(fallbackTolerance, Math.abs(end - start) / 2).toFixed(3),
    ),
  };
}

function normalizeJointLabel(value: unknown): PoseContractJoint | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('elbow') || normalized.includes('wrist')) {
    return 'elbow';
  }
  if (normalized.includes('shoulder')) {
    return 'shoulder';
  }
  if (normalized.includes('hip')) {
    return 'hip';
  }
  if (normalized.includes('knee') || normalized.includes('ankle')) {
    return 'knee';
  }
  return null;
}

function toOscillatingJoints(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((entry) => normalizeJointLabel(entry))
        .filter((entry): entry is PoseContractJoint => entry !== null),
    ),
  );
}

function toSecondaryCheck(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }

  if (isRecord(value)) {
    const [firstKey] = Object.keys(value);
    if (firstKey) {
      return firstKey;
    }
  }

  return 'range_of_motion';
}

function buildMovementContractFromProfile(
  profile: Pick<
    PoseBootstrapProfileRecord,
    | 'angle_signature'
    | 'canonical_name'
    | 'dominant_joint'
    | 'movement_pattern'
    | 'rep_rules'
    | 'rep_thresholds'
    | 'tolerance'
  >,
): PoseMovementContractValue | null {
  const tolerance = toDecimalNumber(profile.tolerance) ?? defaultPoseTolerance;
  const configuredJoint = toPoseJointName(profile.dominant_joint);
  const movementPattern = toOptionalJsonObject(profile.movement_pattern) ?? {};
  const repThresholdsObject = toOptionalJsonObject(profile.rep_thresholds);
  const angleSignature = toOptionalJsonObject(profile.angle_signature) ?? {};
  const repRules = toOptionalJsonObject(profile.rep_rules);
  const dominantJoint =
    configuredJoint ??
    normalizeJointLabel(movementPattern.tracked_joint) ??
    normalizeJointLabel(Object.keys(angleSignature).join(' ')) ??
    'knee';

  const explicitDown = toThreshold(repThresholdsObject?.down, tolerance);
  const explicitUp = toThreshold(repThresholdsObject?.up, tolerance);
  const angleBottom = isRecord(angleSignature.bottom)
    ? angleSignature.bottom
    : null;
  const angleTop = isRecord(angleSignature.top) ? angleSignature.top : null;
  const derivedDown =
    toAngleFromRange(angleBottom?.[dominantJoint], tolerance) ??
    toAngleFromRange(angleBottom?.hip, tolerance) ??
    toAngleFromRange(angleBottom?.knee, tolerance) ??
    toAngleFromRange(angleBottom?.elbow, tolerance) ??
    toAngleFromRange(angleBottom?.shoulder, tolerance);
  const derivedUp =
    toAngleFromRange(angleTop?.[dominantJoint], tolerance) ??
    toAngleFromRange(angleTop?.hip, tolerance) ??
    toAngleFromRange(angleTop?.knee, tolerance) ??
    toAngleFromRange(angleTop?.elbow, tolerance) ??
    toAngleFromRange(angleTop?.shoulder, tolerance);
  const down = explicitDown ?? derivedDown;
  const up = explicitUp ?? derivedUp;

  if (!down || !up) {
    return null;
  }

  return {
    exercise: profile.canonical_name,
    dominant_joint: dominantJoint,
    rep_thresholds: {
      down,
      up,
    },
    secondary_check:
      toSecondaryCheck(repRules) || toSecondaryCheck(movementPattern),
    oscillating_joints: toOscillatingJoints(
      movementPattern.oscillating_landmarks,
    ),
  };
}

function buildMovementContractFromAnalysis(
  value: Awaited<
    ReturnType<AiPythonClientService['analyzePoseSequence']>
  >['movement_contract'],
): PoseMovementContractValue | null {
  if (!value) {
    return null;
  }

  return {
    exercise: value.exercise,
    dominant_joint: value.dominant_joint,
    rep_thresholds: value.rep_thresholds,
    secondary_check: value.secondary_check,
    oscillating_joints: value.oscillating_joints,
  };
}

function toRepThresholdsJson(
  value: PoseMovementContractValue['rep_thresholds'],
): Record<string, { angle: number; tolerance: number }> {
  return {
    down: {
      angle: value.down.angle,
      tolerance: value.down.tolerance,
    },
    up: {
      angle: value.up.angle,
      tolerance: value.up.tolerance,
    },
  };
}

function normalizeOrientationBucket(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (normalized.includes('supine')) {
    return 'supine';
  }
  if (normalized.includes('prone') && normalized.includes('horizontal')) {
    return 'prone_horizontal';
  }
  if (normalized.includes('prone')) {
    return 'prone';
  }
  if (normalized.includes('horizontal')) {
    return 'horizontal';
  }
  if (normalized.includes('upright') || normalized.includes('standing')) {
    return 'upright';
  }
  if (normalized.includes('inclined')) {
    return 'inclined';
  }
  return normalized;
}

function normalizeSignalJointLabel(value: unknown): PoseContractJoint | null {
  if (typeof value !== 'string') {
    return null;
  }

  return normalizeJointLabel(value.replaceAll('_', ' '));
}

function normalizeLandmarkLabel(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

function getPoseJointAmplitude(
  signals: PoseAnalyzeSignalsValue,
  joint: PoseContractJoint,
): number {
  const value = signals.temporal.amplitudes[joint];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function getPoseJointRange(
  signals: PoseAnalyzeSignalsValue,
  joint: PoseContractJoint,
): number {
  const values = signals.angles
    .map((entry) => entry[joint])
    .filter((value): value is number => typeof value === 'number');
  if (values.length < 2) {
    return 0;
  }
  return Math.max(...values) - Math.min(...values);
}

function getAveragePoseJointAngle(
  signals: PoseAnalyzeSignalsValue,
  joint: PoseContractJoint,
): number {
  const values = signals.angles
    .map((entry) => entry[joint])
    .filter((value): value is number => typeof value === 'number');
  if (!values.length) {
    return 120;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildGeneratedMovementContract(
  exerciseName: string,
  signals: PoseAnalyzeSignalsValue,
): PoseMovementContractValue {
  const canonicalExercise =
    toCanonicalPoseExerciseHint(exerciseName) ?? exerciseName;
  const defaults = {
    bench_press: {
      dominantJoint: 'elbow' as const,
      downAngle: 78,
      upAngle: 166,
      tolerance: 12,
      secondaryCheck: 'bar_path',
      oscillatingJoints: ['elbow', 'shoulder'],
    },
    bicep_curl: {
      dominantJoint: 'elbow' as const,
      downAngle: 58,
      upAngle: 154,
      tolerance: 10,
      secondaryCheck: 'hip_stability',
      oscillatingJoints: ['elbow'],
    },
    plank: {
      dominantJoint: 'hip' as const,
      downAngle: 165,
      upAngle: 178,
      tolerance: 8,
      secondaryCheck: 'core_alignment',
      oscillatingJoints: ['hip', 'shoulder'],
    },
    push_up: {
      dominantJoint: 'elbow' as const,
      downAngle: 84,
      upAngle: 166,
      tolerance: 14,
      secondaryCheck: 'body_line',
      oscillatingJoints: ['elbow', 'shoulder'],
    },
    shoulder_press: {
      dominantJoint: 'shoulder' as const,
      downAngle: 72,
      upAngle: 164,
      tolerance: 12,
      secondaryCheck: 'lockout_control',
      oscillatingJoints: ['shoulder', 'elbow'],
    },
    squat: {
      dominantJoint: 'knee' as const,
      downAngle: 92,
      upAngle: 168,
      tolerance: 12,
      secondaryCheck: 'hip_depth',
      oscillatingJoints: ['hip', 'knee'],
    },
  } as const;
  const exerciseDefaults =
    defaults[canonicalExercise as keyof typeof defaults] ?? defaults.squat;
  const dominantJoint = exerciseDefaults.dominantJoint;
  const dominantRange = getPoseJointRange(signals, dominantJoint);
  const dominantAverage = getAveragePoseJointAngle(signals, dominantJoint);
  const hasReliableRange = dominantRange >= 18;
  const tolerance = Number(
    Math.max(exerciseDefaults.tolerance, dominantRange / 3).toFixed(3),
  );
  const observedDown = Number(
    Math.max(35, dominantAverage - dominantRange / 2).toFixed(3),
  );
  const observedUp = Number(
    Math.min(178, dominantAverage + dominantRange / 2 + 10).toFixed(3),
  );
  const downAngle = Number(
    (
      hasReliableRange
        ? (exerciseDefaults.downAngle + observedDown) / 2
        : exerciseDefaults.downAngle
    ).toFixed(3),
  );
  const upAngle = Number(
    (
      hasReliableRange
        ? (exerciseDefaults.upAngle + observedUp) / 2
        : exerciseDefaults.upAngle
    ).toFixed(3),
  );

  return {
    exercise: canonicalExercise,
    dominant_joint: dominantJoint,
    rep_thresholds: {
      down: {
        angle: downAngle,
        tolerance,
      },
      up: {
        angle: upAngle,
        tolerance,
      },
    },
    secondary_check: exerciseDefaults.secondaryCheck,
    oscillating_joints: Array.from(
      new Set([
        ...exerciseDefaults.oscillatingJoints,
        ...toOscillatingJoints(signals.temporal.oscillating_joints),
      ]),
    ),
  };
}

function scoreBootstrapProfile(
  profile: PoseBootstrapProfileRecord,
  canonicalHint: string | null,
  rawExerciseHint: string | null,
  signals: PoseAnalyzeSignalsValue,
): number {
  let score = 0;
  const normalizedProfileName = profile.canonical_name.trim().toLowerCase();
  const profileCanonical = toCanonicalPoseExerciseHint(profile.canonical_name);
  const normalizedRawHint = normalizePoseExerciseHint(rawExerciseHint)?.toLowerCase() ?? null;
  const movementContract = buildMovementContractFromProfile(profile);
  const movementPattern = toOptionalJsonObject(profile.movement_pattern) ?? {};
  const visibilityPattern = toOptionalJsonObject(profile.visibility_pattern) ?? {};
  const orientationSignature = toOptionalJsonObject(profile.orientation_signature) ?? {};
  const liveOrientation = normalizeOrientationBucket(
    signals.orientation.body_orientation,
  );
  const profileOrientation = normalizeOrientationBucket(
    orientationSignature.body_orientation,
  );
  const dominantJoint =
    movementContract?.dominant_joint ??
    normalizeSignalJointLabel(profile.dominant_joint) ??
    normalizeSignalJointLabel(movementPattern.tracked_joint);
  const oscillatingJoints = new Set(
    signals.temporal.oscillating_joints
      .map((joint) => normalizeSignalJointLabel(joint))
      .filter((joint): joint is PoseContractJoint => joint !== null),
  );
  const requiredLandmarks = Array.isArray(visibilityPattern.required_landmarks)
    ? visibilityPattern.required_landmarks
        .map(normalizeLandmarkLabel)
        .filter((landmark): landmark is string => landmark !== null)
    : [];
  const lowConfidenceLandmarks = new Set(
    signals.visibility.low_confidence_landmarks
      .map(normalizeLandmarkLabel)
      .filter((landmark): landmark is string => landmark !== null),
  );
  const hasHardHorizontalConflict =
    (liveOrientation === 'horizontal' ||
      liveOrientation === 'prone' ||
      liveOrientation === 'prone_horizontal') &&
    (normalizedProfileName.includes('squat') ||
      normalizedProfileName.includes('lunge') ||
      profileOrientation === 'upright');

  if (hasHardHorizontalConflict) {
    return 0;
  }

  if (canonicalHint !== null && profileCanonical === canonicalHint) {
    score += 0.16;
  } else if (
    normalizedRawHint !== null &&
    (normalizedProfileName === normalizedRawHint ||
      normalizedProfileName.includes(normalizedRawHint) ||
      normalizedRawHint.includes(normalizedProfileName))
  ) {
    score += 0.08;
  }

  if (liveOrientation && profileOrientation) {
    if (
      liveOrientation === profileOrientation ||
      (liveOrientation === 'horizontal' &&
        (profileOrientation === 'prone_horizontal' ||
          profileOrientation === 'prone')) ||
      (liveOrientation === 'upright' && profileOrientation === 'inclined')
    ) {
      score += 0.32;
    } else if (
      liveOrientation === 'horizontal' &&
      profileOrientation === 'supine'
    ) {
      score += 0.14;
    } else if (
      liveOrientation === 'inclined' &&
      profileOrientation === 'upright'
    ) {
      score += 0.16;
    }
  }

  if (requiredLandmarks.length > 0) {
    const visibleMatches = requiredLandmarks.filter(
      (landmark) => !lowConfidenceLandmarks.has(landmark),
    ).length;
    score += (visibleMatches / requiredLandmarks.length) * 0.18;
  }

  if (dominantJoint) {
    if (oscillatingJoints.has(dominantJoint)) {
      score += 0.12;
    }

    const amplitude = getPoseJointAmplitude(signals, dominantJoint);
    if (amplitude >= 18) {
      score += 0.1;
    } else if (amplitude >= 10) {
      score += 0.05;
    }

    if (movementContract) {
      const expectedRange = Math.abs(
        movementContract.rep_thresholds.up.angle -
          movementContract.rep_thresholds.down.angle,
      );
      const observedRange = getPoseJointRange(signals, dominantJoint);
      if (observedRange >= Math.max(18, expectedRange * 0.45)) {
        score += 0.12;
      } else if (observedRange >= Math.max(10, expectedRange * 0.25)) {
        score += 0.06;
      }
    }
  }

  if (
    dominantJoint &&
    normalizeSignalJointLabel(movementPattern.tracked_joint) === dominantJoint
  ) {
    score += 0.05;
  }

  if (liveOrientation === 'horizontal') {
    if (
      normalizedProfileName.includes('push') ||
      normalizedProfileName.includes('plank')
    ) {
      score += 0.08;
    }
    if (
      normalizedProfileName.includes('bench') &&
      signals.visibility.feet_visibility < 0.35
    ) {
      score += 0.08;
    }
    if (
      normalizedProfileName.includes('bench') &&
      signals.visibility.feet_visibility >= 0.45
    ) {
      score -= 0.06;
    }
    if (
      normalizedProfileName.includes('push') &&
      signals.visibility.feet_visibility >= 0.35
    ) {
      score += 0.06;
    }
    if (normalizedProfileName.includes('push') && !signals.hip.stable) {
      score += 0.04;
    }
  }

  if (
    liveOrientation !== 'upright' &&
    normalizedProfileName.includes('squat')
  ) {
    score -= 0.2;
  }

  return Number(Math.max(0, score).toFixed(3));
}

function profileMatchesExerciseHint(
  profile: PoseBootstrapProfileRecord,
  canonicalHint: string | null,
  rawExerciseHint: string | null,
): boolean {
  const normalizedProfileName = profile.canonical_name.trim().toLowerCase();
  const profileCanonical = toCanonicalPoseExerciseHint(profile.canonical_name);
  const normalizedRawHint = normalizePoseExerciseHint(rawExerciseHint)?.toLowerCase() ?? null;

  return (
    (canonicalHint !== null && profileCanonical === canonicalHint) ||
    (normalizedRawHint !== null &&
      (normalizedProfileName === normalizedRawHint ||
        normalizedProfileName.includes(normalizedRawHint) ||
        normalizedRawHint.includes(normalizedProfileName)))
  );
}

function selectMatchingBootstrapProfile(
  profiles: PoseBootstrapProfileRecord[],
  canonicalHint: string | null,
  rawExerciseHint: string | null,
  signals: PoseAnalyzeSignalsValue,
): PoseBootstrapProfileRecord | null {
  const rankedProfiles = profiles
    .map((profile) => ({
      profile,
      score: scoreBootstrapProfile(
        profile,
        canonicalHint,
        rawExerciseHint,
        signals,
      ),
    }))
    .sort((left, right) => right.score - left.score);

  const bestMatch = rankedProfiles[0];
  if (!bestMatch) {
    return null;
  }

  const isHintCompatible = profileMatchesExerciseHint(
    bestMatch.profile,
    canonicalHint,
    rawExerciseHint,
  );
  const minimumScore =
    (canonicalHint !== null || rawExerciseHint !== null) && !isHintCompatible
      ? 0.78
      : posePresetMatchThreshold;

  return bestMatch.score >= minimumScore ? bestMatch.profile : null;
}

@Injectable()
export class PoseService {
  constructor(
    private readonly repo: PoseRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly aiClient: AiPythonClientService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async authenticateSocket(client: Socket): Promise<JwtPayload> {
    const token = extractSocketToken(client);
    const secret = this.config.get<string>('jwt.secret', '');

    if (!token || !secret) {
      throw createUnauthorizedPoseSocketException();
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret,
      });
    } catch {
      throw createUnauthorizedPoseSocketException();
    }

    const blacklisted = await this.redis.get(`token_blacklist:${payload.jti}`);
    if (blacklisted) {
      throw new UnauthorizedException({
        type: 'TOKEN_REVOKED',
        title: 'Token Revoked',
        status: 401,
        detail: 'This token has been revoked. Please log in again.',
      });
    }

    assertActivePoseUser(payload);
    return payload;
  }

  async startPoseSession(
    userId: string,
    exerciseHint: string | null,
  ): Promise<PoseConnectionState> {
    const started = await this.repo.createPoseSession({
      userId,
      exerciseHint,
      startedAt: new Date(),
    });
    const candidateProfiles = await this.repo.listBootstrapPoseProfiles({
      exerciseHint: null,
      canonicalHint: null,
    });
    try {
      const bootstrap = await this.aiClient.bootstrapPoseSession({
        poseSessionId: started.id,
        exerciseHint: null,
        starterCatalog: [...poseStarterCatalog],
        candidateProfiles: candidateProfiles.map(toPoseBootstrapProfile),
      });

      return {
        poseSessionId: started.id,
        userId: started.user_id,
        exerciseHint: started.exercise_hint ?? null,
        repCountAi: started.rep_count_ai,
        confidenceSum: 0,
        confidenceSamples: 0,
        acceptedFps: bootstrap.accepted_fps,
        subjectLockMode: bootstrap.subject_lock_mode,
      };
    } catch (error) {
      await Promise.resolve(this.repo.deletePoseSessionById(started.id)).catch(
        () => undefined,
      );
      throw error;
    }
  }

  async startPoseSessionForUser(
    userId: string,
    dto: StartPoseSessionDTO,
  ): Promise<PoseSessionBootstrapResponseDTO> {
    const started = await this.startPoseSession(
      userId,
      this.normalizeExerciseHint(dto.exercise_hint),
    );

    return {
      pose_session_id: started.poseSessionId,
      accepted_fps: started.acceptedFps,
    };
  }

  async analyzeFrame(
    state: PoseConnectionState,
    frameBase64: string,
  ): Promise<PoseFrameProcessingResult> {
    if (typeof frameBase64 !== 'string' || frameBase64.trim().length === 0) {
      throw new BadRequestException({
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Invalid Pose Frame',
        status: 400,
        detail: 'frame_b64 is required.',
      });
    }

    const analysis = await this.aiClient.analyzePoseFrame({
      poseSessionId: state.poseSessionId,
      frameBase64: frameBase64.trim(),
    });

    return {
      analysis,
      nextState: {
        ...state,
        confidenceSum: state.confidenceSum + analysis.confidence,
        confidenceSamples: state.confidenceSamples + 1,
      },
    };
  }

  async finalizePoseSession(
    state: PoseConnectionState,
    endedReason: PoseSessionEndReason = 'client_disconnect',
  ): Promise<PoseSessionResponseDTO> {
    void endedReason;

    const session = await this.repo.findPoseSessionByIdOrThrow(
      state.poseSessionId,
    );
    this.assertPoseSessionOwner(session, state.userId);

    return this.finalizeOpenPoseSession(session, state);
  }

  async getPoseSessionById(
    userId: string,
    poseSessionId: string,
  ): Promise<PoseSessionResponseDTO> {
    const session = await this.repo.findPoseSessionByIdOrThrow(poseSessionId);
    this.assertPoseSessionOwner(session, userId);
    return toPoseSessionResponse(session);
  }

  async analyzePoseSessionById(
    userId: string,
    poseSessionId: string,
    dto: AnalyzePoseSequenceDTO,
  ): Promise<PoseFrameAnalysisResponseDTO> {
    const session = await this.repo.findPoseSessionByIdOrThrow(poseSessionId);
    this.assertPoseSessionOwner(session, userId);
    const requestedExerciseHint =
      dto.exercise_hint ?? session.exercise_hint ?? null;
    const canonicalHint = toCanonicalPoseExerciseHint(requestedExerciseHint);
    const presetCandidates = await this.repo.listBootstrapPoseProfiles({
      exerciseHint: null,
      canonicalHint: null,
    });
    const presetProfile = selectMatchingBootstrapProfile(
      presetCandidates,
      canonicalHint,
      requestedExerciseHint,
      dto.signals,
    );
    const presetMovementContract = presetProfile
      ? buildMovementContractFromProfile(presetProfile)
      : null;

    if (presetProfile && presetMovementContract) {
      const persisted = await this.repo.updatePoseSessionAnalysis({
        poseSessionId: session.id,
        detectedExerciseName:
          session.detected_exercise_name ?? presetProfile.canonical_name,
        detectedProfileId: presetProfile.id,
        classificationConfidence: 1,
        subjectLockConfidence: null,
        analysisSummary: toPrismaJsonObject({
          camera_facing_mode: dto.camera_facing_mode ?? null,
          candidate_exercises: [presetProfile.canonical_name],
          classification_source: 'preset',
          form_feedback: [],
          landmark_schema: dto.landmark_schema,
          movement_contract: presetMovementContract,
          needs_confirmation: false,
        }),
      });

      return {
        pose_session_id: session.id,
        confidence: 1,
        exercise_class: presetProfile.canonical_name,
        matched_profile_id: persisted.detected_profile_id ?? presetProfile.id,
        subject_locked: true,
        subject_lock_confidence: null,
        classification_source: 'preset',
        needs_confirmation: false,
        candidate_exercises: [presetProfile.canonical_name],
        form_feedback: [],
        movement_contract: presetMovementContract,
      };
    }

    const analysis = await this.aiClient.analyzePoseSequence({
      poseSessionId: session.id,
      landmarkSchema: dto.landmark_schema,
      cameraFacingMode: dto.camera_facing_mode,
      exerciseHint: presetProfile ? presetProfile.canonical_name : null,
      frames: dto.frames.map((frame) => ({
        captured_at_ms: frame.captured_at_ms,
        keypoints: frame.keypoints.map((keypoint) => ({
          x: keypoint.x,
          y: keypoint.y,
          z: keypoint.z,
          visibility: keypoint.visibility,
        })),
      })),
      signals: {
        angles: dto.signals.angles.map((entry) => ({
          captured_at_ms: entry.captured_at_ms,
          elbow: entry.elbow ?? null,
          shoulder: entry.shoulder ?? null,
          hip: entry.hip ?? null,
          knee: entry.knee ?? null,
        })),
        orientation: {
          body_orientation: dto.signals.orientation.body_orientation,
          torso_slope_deg: dto.signals.orientation.torso_slope_deg,
          vector: {
            x: dto.signals.orientation.vector.x,
            y: dto.signals.orientation.vector.y,
          },
        },
        visibility: {
          average_visibility: dto.signals.visibility.average_visibility,
          feet_visibility: dto.signals.visibility.feet_visibility,
          low_confidence_landmarks:
            dto.signals.visibility.low_confidence_landmarks,
          reliable_frame_count: dto.signals.visibility.reliable_frame_count,
          wrist_visibility: dto.signals.visibility.wrist_visibility,
        },
        hip: {
          average_y: dto.signals.hip.average_y,
          range_y: dto.signals.hip.range_y,
          stable: dto.signals.hip.stable,
        },
        temporal: {
          amplitudes: dto.signals.temporal.amplitudes,
          oscillating_joints: dto.signals.temporal.oscillating_joints,
        },
      },
    });

    let matchedProfileId =
      analysis.matched_profile_id ?? session.detected_profile_id ?? null;
    let detectedExerciseName =
      analysis.exercise_class ?? session.detected_exercise_name ?? null;
    let movementContract = buildMovementContractFromAnalysis(
      analysis.movement_contract,
    );
    let needsConfirmation = analysis.needs_confirmation ?? false;
    const matchedProfileCandidate =
      presetCandidates.find((profile) => profile.id === matchedProfileId) ??
      (detectedExerciseName
        ? presetCandidates.find(
            (profile) =>
              toCanonicalPoseExerciseHint(profile.canonical_name) ===
              toCanonicalPoseExerciseHint(detectedExerciseName),
          ) ?? null
        : null);

    if (
      !detectedExerciseName &&
      analysis.confidence >= poseContractConfidenceThreshold
    ) {
      detectedExerciseName =
        matchedProfileCandidate?.canonical_name ??
        analysis.candidate_exercises?.[0] ??
        null;
    }

    if (detectedExerciseName) {
      movementContract =
        movementContract ??
        (matchedProfileCandidate
          ? buildMovementContractFromProfile(matchedProfileCandidate)
          : null) ??
        buildGeneratedMovementContract(detectedExerciseName, dto.signals);
    }

    if (
      needsConfirmation &&
      analysis.confidence >= poseContractConfidenceThreshold &&
      detectedExerciseName &&
      movementContract
    ) {
      needsConfirmation = false;
    }

    if (
      !needsConfirmation &&
      analysis.confidence >= poseContractConfidenceThreshold &&
      analysis.learned_profile
    ) {
      const learnedProfile = await this.repo.upsertLearnedPoseProfile({
        canonicalName: analysis.learned_profile.canonical_name,
        exerciseId: null,
        landmarkSignature: toPrismaJsonObject(
          analysis.learned_profile.landmark_signature,
        ),
        angleSignature: toPrismaJsonObject(
          analysis.learned_profile.angle_signature,
        ),
        orientationSignature: toPrismaJsonObject(
          analysis.learned_profile.orientation_signature,
        ),
        movementPattern: toPrismaJsonObject(
          analysis.learned_profile.movement_pattern,
        ),
        visibilityPattern: toPrismaJsonObject(
          analysis.learned_profile.visibility_pattern,
        ),
        dominantJoint:
          analysis.learned_profile.dominant_joint ??
          movementContract?.dominant_joint ??
          null,
        tolerance:
          analysis.learned_profile.tolerance ??
          movementContract?.rep_thresholds.down.tolerance ??
          null,
        repThresholds: analysis.learned_profile.rep_thresholds
          ? toPrismaJsonObject(analysis.learned_profile.rep_thresholds)
          : movementContract
            ? toPrismaJsonObject(
                toRepThresholdsJson(movementContract.rep_thresholds),
              )
            : null,
        repRules: analysis.learned_profile.rep_rules
          ? toPrismaJsonObject(analysis.learned_profile.rep_rules)
          : null,
        confidenceThreshold: analysis.confidence,
      });

      matchedProfileId = learnedProfile.id;
      detectedExerciseName = learnedProfile.canonical_name;
      movementContract =
        movementContract ?? buildMovementContractFromProfile(learnedProfile);
    }

    if (
      !needsConfirmation &&
      analysis.confidence >= poseContractConfidenceThreshold &&
      movementContract &&
      !analysis.learned_profile &&
      matchedProfileCandidate &&
      !buildMovementContractFromProfile(matchedProfileCandidate)
    ) {
      const backfilledProfile = await this.repo.upsertLearnedPoseProfile({
        canonicalName: matchedProfileCandidate.canonical_name,
        exerciseId: null,
        landmarkSignature: toPrismaJsonObject(
          toOptionalJsonObject(matchedProfileCandidate.landmark_signature) ?? {},
        ),
        angleSignature: toPrismaJsonObject(
          toOptionalJsonObject(matchedProfileCandidate.angle_signature) ?? {},
        ),
        orientationSignature: toPrismaJsonObject(
          toOptionalJsonObject(
            matchedProfileCandidate.orientation_signature,
          ) ?? {},
        ),
        movementPattern: toPrismaJsonObject(
          toOptionalJsonObject(matchedProfileCandidate.movement_pattern) ?? {},
        ),
        visibilityPattern: toPrismaJsonObject(
          toOptionalJsonObject(matchedProfileCandidate.visibility_pattern) ?? {},
        ),
        dominantJoint:
          movementContract.dominant_joint ?? matchedProfileCandidate.dominant_joint,
        tolerance: movementContract.rep_thresholds.down.tolerance,
        repThresholds: toPrismaJsonObject(
          toRepThresholdsJson(movementContract.rep_thresholds),
        ),
        repRules: toOptionalJsonObject(matchedProfileCandidate.rep_rules)
          ? toPrismaJsonObject(
              toOptionalJsonObject(matchedProfileCandidate.rep_rules) ?? {},
            )
          : null,
        confidenceThreshold: analysis.confidence,
      });

      matchedProfileId = backfilledProfile.id;
      detectedExerciseName = backfilledProfile.canonical_name;
    }

    const persisted = await this.repo.updatePoseSessionAnalysis({
      poseSessionId: session.id,
      detectedExerciseName,
      detectedProfileId: matchedProfileId,
      classificationConfidence: analysis.confidence,
      subjectLockConfidence: analysis.subject_lock_confidence ?? null,
      analysisSummary: toPrismaJsonObject({
        camera_facing_mode: dto.camera_facing_mode ?? null,
        candidate_exercises: analysis.candidate_exercises ?? [],
        classification_source: analysis.classification_source ?? 'classifier',
        form_feedback: analysis.form_feedback ?? [],
        landmark_schema: dto.landmark_schema,
        movement_contract: movementContract,
        needs_confirmation: needsConfirmation,
      }),
    });

    return {
      pose_session_id: session.id,
      confidence: analysis.confidence,
      exercise_class: detectedExerciseName,
      matched_profile_id:
        matchedProfileId ?? persisted.detected_profile_id ?? null,
      subject_locked: analysis.subject_locked ?? null,
      subject_lock_confidence: analysis.subject_lock_confidence ?? null,
      classification_source: analysis.classification_source ?? 'classifier',
      needs_confirmation: needsConfirmation,
      candidate_exercises: analysis.candidate_exercises ?? [],
      form_feedback: analysis.form_feedback ?? [],
      movement_contract: movementContract,
    };
  }

  async finalizePoseSessionById(
    userId: string,
    poseSessionId: string,
    dto: FinalizePoseSessionDTO,
  ): Promise<PoseSessionResponseDTO> {
    const session = await this.repo.findPoseSessionByIdOrThrow(poseSessionId);
    this.assertPoseSessionOwner(session, userId);
    if (session.ended_at) {
      return toPoseSessionResponse(session);
    }

    const existingSummary = toOptionalJsonObject(session.analysis_summary) ?? {};
    const persisted = await this.repo.finalizePoseSession({
      poseSessionId: session.id,
      endedAt: new Date(),
      repCountAi: dto.final_rep_count,
      confidenceAvg:
        dto.average_confidence ??
        toDecimalNumber(session.confidence_avg) ??
        toDecimalNumber(session.classification_confidence),
      detectedExerciseName:
        dto.detected_exercise_name ?? session.detected_exercise_name ?? null,
      detectedProfileId: session.detected_profile_id ?? null,
      classificationConfidence: toDecimalNumber(
        session.classification_confidence,
      ),
      subjectLockConfidence: toDecimalNumber(session.subject_lock_confidence),
      analysisSummary: toPrismaJsonObject({
        ...existingSummary,
        average_confidence:
          dto.average_confidence ??
          existingSummary.average_confidence ??
          toDecimalNumber(session.confidence_avg) ??
          null,
        detected_exercise_name:
          dto.detected_exercise_name ?? session.detected_exercise_name ?? null,
        ended_reason: dto.ended_reason,
        final_rep_count: dto.final_rep_count,
        form_feedback: dto.form_feedback ?? [],
        movement_contract: dto.movement_contract ?? null,
        raw_angle_data: dto.raw_angle_data ?? [],
      }),
    });

    return toPoseSessionResponse(persisted);
  }

  async listPoseProfiles(
    dto: PoseProfileFilterDTO,
  ): Promise<PaginatedResult<PoseProfileResponseDTO>> {
    const result = await this.repo.listPoseProfiles(dto);

    return {
      data: result.data.map(toPoseProfileResponse),
      meta: result.meta,
    };
  }

  normalizeExerciseHint(value: unknown): string | null {
    return normalizePoseExerciseHint(value);
  }

  private async finalizeOpenPoseSession(
    session: PoseSessionDetailRecord,
    state?: PoseConnectionState,
  ): Promise<PoseSessionResponseDTO> {
    if (session.ended_at) {
      return toPoseSessionResponse(session);
    }

    const finalized = await this.aiClient.finalizePoseSession({
      poseSessionId: session.id,
    });
    const persisted = await this.repo.finalizePoseSession(
      toPoseFinalizePersistenceInput(session.id, finalized, state),
    );

    return toPoseSessionResponse(persisted);
  }

  private assertPoseSessionOwner(
    session: Pick<PoseSessionDetailRecord, 'user_id'>,
    userId: string,
  ): void {
    if (session.user_id !== userId) {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Pose Session Forbidden',
        status: 403,
        detail: 'You can only access your own pose sessions.',
      });
    }
  }
}
