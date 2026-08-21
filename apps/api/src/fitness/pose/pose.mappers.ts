import { Prisma } from '@prisma/client';

import { poseStarterCatalog } from './pose.constants';
import { toCanonicalPoseExerciseLabel } from '../../../../../packages/utils/pose';
import type {
  PoseProfileResponseDTO,
  PoseSessionResponseDTO,
} from './dto/pose.dto';
import type {
  PoseBootstrapProfileRecord,
  PoseProfileRecord,
  PoseSessionDetailRecord,
} from './pose.repository';
import type {
  JsonObject,
  PoseConnectionState,
  PoseFinalizePersistenceInput,
  PoseFinalizeResult,
} from './pose.types';

export function normalizePoseExerciseHint(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function toCanonicalPoseExerciseHint(
  exerciseHint: string | null,
): string | null {
  const canonical = toCanonicalPoseExerciseLabel(exerciseHint);
  if (!canonical) {
    return null;
  }

  if (
    poseStarterCatalog.includes(
      canonical as (typeof poseStarterCatalog)[number],
    )
  ) {
    return canonical;
  }

  return null;
}

export function toPoseBootstrapProfile(profile: PoseBootstrapProfileRecord): {
  id: string;
  canonical_name: string;
  profile_kind: 'seed' | 'learned';
  landmark_signature: Record<string, unknown>;
  angle_signature: Record<string, unknown>;
  orientation_signature: Record<string, unknown>;
  movement_pattern: Record<string, unknown>;
  visibility_pattern: Record<string, unknown>;
  rep_rules?: Record<string, unknown> | null;
} {
  return {
    id: profile.id,
    canonical_name: profile.canonical_name,
    profile_kind: profile.profile_kind,
    landmark_signature: toRequiredJsonObject(profile.landmark_signature),
    angle_signature: toRequiredJsonObject(profile.angle_signature),
    orientation_signature: toRequiredJsonObject(profile.orientation_signature),
    movement_pattern: toRequiredJsonObject(profile.movement_pattern),
    visibility_pattern: toRequiredJsonObject(profile.visibility_pattern),
    rep_rules: toOptionalJsonObject(profile.rep_rules),
  };
}

export function toPoseSessionResponse(
  session: PoseSessionDetailRecord,
): PoseSessionResponseDTO {
  return {
    id: session.id,
    user_id: session.user_id,
    exercise_log_id: session.exercise_log_id ?? null,
    exercise_hint: session.exercise_hint ?? null,
    rep_count_ai: session.rep_count_ai,
    confidence_avg: toDecimalString(session.confidence_avg),
    detected_exercise_name: session.detected_exercise_name ?? null,
    detected_profile_id: session.detected_profile_id ?? null,
    classification_confidence: toDecimalString(
      session.classification_confidence,
    ),
    subject_lock_confidence: toDecimalString(session.subject_lock_confidence),
    analysis_summary: toOptionalJsonObject(session.analysis_summary),
    started_at: session.started_at.toISOString(),
    ended_at: session.ended_at?.toISOString() ?? null,
    created_at: session.created_at.toISOString(),
    updated_at: session.updated_at.toISOString(),
  };
}

export function toPoseProfileResponse(
  profile: PoseProfileRecord,
): PoseProfileResponseDTO {
  return {
    id: profile.id,
    exercise_id: profile.exercise_id ?? null,
    exercise_name: profile.exercise?.name ?? null,
    canonical_name: profile.canonical_name,
    profile_kind: profile.profile_kind,
    landmark_signature: toRequiredJsonObject(profile.landmark_signature),
    angle_signature: toRequiredJsonObject(profile.angle_signature),
    orientation_signature: toRequiredJsonObject(profile.orientation_signature),
    movement_pattern: toRequiredJsonObject(profile.movement_pattern),
    visibility_pattern: toRequiredJsonObject(profile.visibility_pattern),
    dominant_joint: toPoseJointName(profile.dominant_joint),
    tolerance: toDecimalString(profile.tolerance),
    rep_thresholds: toOptionalJsonObject(profile.rep_thresholds),
    rep_rules: toOptionalJsonObject(profile.rep_rules),
    sample_count: profile.sample_count,
    confidence_threshold: toDecimalString(profile.confidence_threshold),
    is_active: profile.is_active,
    created_at: profile.created_at.toISOString(),
    updated_at: profile.updated_at.toISOString(),
  };
}

export function toPoseFinalizePersistenceInput(
  poseSessionId: string,
  finalized: PoseFinalizeResult,
  state?: PoseConnectionState,
): PoseFinalizePersistenceInput {
  return {
    poseSessionId,
    endedAt: new Date(),
    repCountAi: finalized.analysis_summary.reps_detected,
    confidenceAvg:
      finalized.analysis_summary.average_confidence ??
      toPoseConfidenceAverage(state),
    detectedExerciseName: finalized.detected_exercise_name,
    detectedProfileId: finalized.matched_profile_id,
    classificationConfidence: finalized.classification_confidence,
    subjectLockConfidence: finalized.subject_lock_confidence,
    analysisSummary: toPrismaJsonObject(finalized.analysis_summary),
    learnedProfile: finalized.learned_profile
      ? {
          canonicalName: finalized.learned_profile.canonical_name,
          exerciseId: null,
          landmarkSignature: toPrismaJsonObject(
            finalized.learned_profile.landmark_signature,
          ),
          angleSignature: toPrismaJsonObject(
            finalized.learned_profile.angle_signature,
          ),
          orientationSignature: toPrismaJsonObject(
            finalized.learned_profile.orientation_signature,
          ),
          movementPattern: toPrismaJsonObject(
            finalized.learned_profile.movement_pattern,
          ),
          visibilityPattern: toPrismaJsonObject(
            finalized.learned_profile.visibility_pattern,
          ),
          dominantJoint: finalized.learned_profile.dominant_joint ?? null,
          tolerance: finalized.learned_profile.tolerance ?? null,
          repThresholds: finalized.learned_profile.rep_thresholds
            ? toPrismaJsonObject(finalized.learned_profile.rep_thresholds)
            : null,
          repRules: finalized.learned_profile.rep_rules
            ? toPrismaJsonObject(finalized.learned_profile.rep_rules)
            : null,
        }
      : null,
  };
}

export function toPoseConfidenceAverage(
  state: PoseConnectionState | undefined,
): number | null {
  if (!state || state.confidenceSamples === 0) {
    return null;
  }

  return state.confidenceSum / state.confidenceSamples;
}

export function toRequiredJsonObject(value: Prisma.JsonValue): JsonObject {
  return toOptionalJsonObject(value) ?? {};
}

export function toPrismaJsonObject(value: JsonObject): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

export function toOptionalJsonObject(
  value: Prisma.JsonValue | null | undefined,
): JsonObject | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  return value as JsonObject;
}

function toDecimalString(
  value: { toString(): string } | null | undefined,
): string | null {
  return value?.toString() ?? null;
}

export function toDecimalNumber(
  value: { toString(): string } | null | undefined,
): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : null;
}

export function toPoseJointName(
  value: string | null | undefined,
): 'elbow' | 'shoulder' | 'hip' | 'knee' | null {
  if (
    value === 'elbow' ||
    value === 'shoulder' ||
    value === 'hip' ||
    value === 'knee'
  ) {
    return value;
  }

  return null;
}
