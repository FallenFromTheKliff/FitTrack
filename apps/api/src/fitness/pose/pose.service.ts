import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import type { Socket } from 'socket.io';

import type { JwtPayload } from '../../auth/types/jwt-payload.type';
import {
  AiPythonClientService,
  type AiEquipmentDetectResponse,
} from '../../ai/ai-python-client.service';
import { PaginatedResult } from '../../common/base-repository/base-repository';
import type {
  ProgressionProducerRuntime,
  ProgressionSourceEligibilityState,
  ProgressionSourceIntegrityState,
  ProgressionSourceTerminalState,
} from '../progression-source.types';
import { progressionSourceEventType } from '../progression-source.types';
import { ExerciseService } from '../exercise/exercise.service';
import {
  AnalyzePoseSequenceDTO,
  DetectPoseEquipmentDTO,
  FinalizePoseSessionDTO,
  PoseEquipmentContext,
  PoseEquipmentDetectionResponseDTO,
  PoseEquipmentSource,
  PoseFrameAnalysisResponseDTO,
  poseEquipmentContexts,
  poseEquipmentSources,
  PoseProgressionDisposition,
  poseProgressionDispositions,
  PoseProfileFilterDTO,
  PoseProfileResponseDTO,
  PoseRepModel,
  PoseRequiredSides,
  PoseSessionBootstrapResponseDTO,
  PoseSessionEndReason,
  PoseSessionQualityState,
  poseSessionQualityStates,
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
  toPoseProfileResponse,
  toPoseSessionResponse,
  toOptionalJsonObject,
  toPrismaJsonObject,
} from './pose.mappers';
import {
  POSE_SESSION_FINALIZED_EVENT,
  type PoseSessionFinalizedEvent,
} from './events/pose-session-finalized.event';
import {
  PoseBootstrapProfileRecord,
  PoseRepository,
  PoseSessionDetailRecord,
} from './pose.repository';
import type {
  PoseConnectionState,
  PoseFrameProcessingResult,
} from './pose.types';
import {
  buildFallbackPoseMovementContract,
  isValidPoseMovementContract,
  normalizePoseMovementContract,
} from '../../../../../packages/utils/pose';

const poseContractConfidenceThreshold = 0.8;
const defaultPoseTolerance = 12;
const posePresetMatchThreshold = 0.58;
const providerEquipmentConfidenceThreshold = 0.35;
const localAiEquipmentProviders = new Set([
  'ai',
  'ai_microservice',
  'local_ai',
  'local_yolo',
]);

type PoseContractJoint = 'elbow' | 'shoulder' | 'hip' | 'knee' | 'ankle';
type PoseAnalyzeSignalsValue = NonNullable<AnalyzePoseSequenceDTO['signals']>;

type PoseMovementContractValue = NonNullable<
  PoseFrameAnalysisResponseDTO['movement_contract']
>;

type PoseMovementContractIdentityValue = NonNullable<
  PoseFrameAnalysisResponseDTO['movement_contract_identity']
>;

type AuthoritativeMovementContractResolution = {
  identity: PoseMovementContractIdentityValue;
  movementContract: PoseMovementContractValue;
};

type PoseEquipmentResolution = {
  equipmentDetections: PoseEquipmentDetectionResponseDTO['equipment_detections'];
  equipmentConfidence: number | null;
  equipmentConflicts: string[];
  equipmentContext: PoseEquipmentContext | null;
  equipmentSource: PoseEquipmentSource | null;
};

type ProviderEquipmentPrediction = {
  confidence: number | null;
  height: number | null;
  label: string | null;
  width: number | null;
  x: number | null;
  y: number | null;
};

type PoseSessionQualityAssessment = {
  integrityReasonCodes: string[];
  progressionDisposition: PoseProgressionDisposition;
  reliableFrameRatio: number | null;
  reviewRecommended: boolean;
  sessionQualityReasons: string[];
  sessionQualityState: PoseSessionQualityState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function toOptionalBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function toOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clampUnit(value: number): number {
  return Number(Math.min(1, Math.max(0, value)).toFixed(4));
}

function normalizeProviderBoxDimension(
  value: number | null,
  axisSize: number | null,
): number | null {
  if (value === null) {
    return null;
  }
  if (!axisSize && value > 1) {
    return null;
  }
  return axisSize && value > 1 ? value / axisSize : value;
}

function normalizeUnitBoxValue(value: unknown): number | null {
  const numberValue = toOptionalNumber(value);
  return numberValue === null ? null : clampUnit(numberValue);
}

function hasFrameBase64(value: AnalyzePoseSequenceDTO['frame_b64']): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function toPoseProcessingMode(
  value: unknown,
): PoseFrameAnalysisResponseDTO['processing_mode'] {
  return value === 'legacy_frame' ? 'legacy_frame' : 'sequence';
}

function toPoseRepCountDelta(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function toBoundedConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(1, Number(value.toFixed(6))));
}

function toPoseEquipmentContext(value: unknown): PoseEquipmentContext | null {
  return typeof value === 'string' &&
    (poseEquipmentContexts as readonly string[]).includes(value)
    ? (value as PoseEquipmentContext)
    : null;
}

function toPoseEquipmentSource(value: unknown): PoseEquipmentSource | null {
  return typeof value === 'string' &&
    (poseEquipmentSources as readonly string[]).includes(value)
    ? (value as PoseEquipmentSource)
    : null;
}

function toPoseSessionQualityState(
  value: unknown,
): PoseSessionQualityState | null {
  return typeof value === 'string' &&
    (poseSessionQualityStates as readonly string[]).includes(value)
    ? (value as PoseSessionQualityState)
    : null;
}

function toPoseProgressionDisposition(
  value: unknown,
): PoseProgressionDisposition | null {
  return typeof value === 'string' &&
    (poseProgressionDispositions as readonly string[]).includes(value)
    ? (value as PoseProgressionDisposition)
    : null;
}

function toRoundedPoseMetric(value: number | null): number | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(4))
    : null;
}

function normalizeEquipmentLabel(value: string | null | undefined): string {
  return typeof value === 'string'
    ? value.toLowerCase().replace(/[_-]+/g, ' ')
    : '';
}

function inferPoseEquipmentContext(
  labels: Array<string | null | undefined>,
): PoseEquipmentContext | null {
  const joined = labels
    .map(normalizeEquipmentLabel)
    .filter((label) => label.length > 0)
    .join(' ');
  if (!joined) {
    return null;
  }

  const matches = new Set<PoseEquipmentContext>();
  if (
    /\b(push up|pull up|plank|burpee|mountain climber|jumping jack|bodyweight)\b/.test(
      joined,
    )
  ) {
    matches.add('bodyweight');
  }
  if (/\b(dip|tricep dip|bench dip|assisted dip)\b/.test(joined)) {
    matches.add('bodyweight');
  }
  if (/\b(dumbbell|db)\b/.test(joined)) {
    matches.add('dumbbell');
  }
  if (/\b(bicep curl|curl)\b/.test(joined)) {
    matches.add('dumbbell');
  }
  if (
    /\b(barbell|deadlift|back squat|front squat|bench press|overhead press)\b/.test(
      joined,
    )
  ) {
    matches.add('barbell');
  }
  if (/\bcable\b/.test(joined)) {
    matches.add('cable');
  }
  if (/\b(machine|leg press|smith|lat pulldown)\b/.test(joined)) {
    matches.add('machine');
  }
  if (/\bkettlebell\b/.test(joined)) {
    matches.add('kettlebell');
  }
  if (/\b(band|resistance band)\b/.test(joined)) {
    matches.add('band');
  }
  if (/\bbench\b/.test(joined)) {
    matches.add('bench');
  }

  if (matches.size === 0) {
    return null;
  }

  return matches.size > 1 ? 'mixed' : (Array.from(matches)[0] ?? null);
}

function inferProviderEquipmentContext(
  labels: Array<string | null | undefined>,
): PoseEquipmentContext | null {
  const joined = labels
    .map(normalizeEquipmentLabel)
    .filter((label) => label.length > 0)
    .join(' ');
  if (!joined) {
    return null;
  }

  const matches = new Set<PoseEquipmentContext>();
  if (
    /\b(dumbbell|dumbbells|dumbell|dumbells|db|free weight|free weights|hand weight|hand weights|adjustable weight|adjustable weights|weight|weights)\b/.test(
      joined,
    )
  ) {
    matches.add('dumbbell');
  }
  if (/\b(barbell|olympic bar|ez bar)\b/.test(joined)) {
    matches.add('barbell');
  }
  if (/\bcable\b/.test(joined)) {
    matches.add('cable');
  }
  if (/\b(machine|smith|lat pulldown)\b/.test(joined)) {
    matches.add('machine');
  }
  if (/\bkettlebell\b/.test(joined)) {
    matches.add('kettlebell');
  }
  if (/\b(resistance band|band)\b/.test(joined)) {
    matches.add('band');
  }
  if (/\bbench\b/.test(joined)) {
    matches.add('bench');
  }

  if (matches.size === 0) {
    return null;
  }

  return matches.size > 1 ? 'mixed' : (Array.from(matches)[0] ?? null);
}

function resolvePoseEquipment(input: {
  declaredConfidence?: number | null;
  declaredContext?: PoseEquipmentContext | null;
  declaredSource?: PoseEquipmentSource | null;
  equipmentDetections?: PoseEquipmentDetectionResponseDTO['equipment_detections'];
  existingConflicts?: string[];
  labels: Array<string | null | undefined>;
}): PoseEquipmentResolution {
  const inferredContext = inferPoseEquipmentContext(input.labels);
  const declaredContext = input.declaredContext ?? null;
  const equipmentContext = declaredContext ?? inferredContext;
  const conflicts = new Set(input.existingConflicts ?? []);

  if (
    declaredContext &&
    inferredContext &&
    declaredContext !== inferredContext &&
    inferredContext !== 'mixed'
  ) {
    conflicts.add('declared_inferred_equipment_mismatch');
  }

  const equipmentSource =
    input.declaredSource ??
    (declaredContext && inferredContext && declaredContext !== inferredContext
      ? 'resolved_hybrid'
      : declaredContext
        ? 'member'
        : inferredContext
          ? 'catalog'
          : null);

  const fallbackConfidence =
    declaredContext && inferredContext && declaredContext === inferredContext
      ? 0.95
      : declaredContext
        ? 0.82
        : inferredContext
          ? 0.64
          : null;

  return {
    equipmentDetections: input.equipmentDetections ?? [],
    equipmentConfidence:
      toBoundedConfidence(input.declaredConfidence) ?? fallbackConfidence,
    equipmentConflicts: Array.from(conflicts),
    equipmentContext,
    equipmentSource,
  };
}

function assessPoseSessionQuality(input: {
  averageConfidence: number | null;
  classificationConfidence: number | null;
  degradedReason: string | null;
  detectedExerciseName: string | null;
  equipmentConflicts: string[];
  fallbackUsed: boolean;
  finalRepCount?: number | null;
  frameCount: number | null;
  lowConfidenceLandmarks: string[];
  movementContract: PoseMovementContractValue | null;
  needsConfirmation: boolean;
  reliableFrameCount: number | null;
  subjectLockConfidence: number | null;
}): PoseSessionQualityAssessment {
  const reasons: string[] = [];
  const reliableFrameRatio =
    input.reliableFrameCount !== null &&
    input.frameCount !== null &&
    input.frameCount > 0
      ? input.reliableFrameCount / input.frameCount
      : null;

  if (input.needsConfirmation) {
    reasons.push('needs_confirmation');
  }
  if (input.fallbackUsed) {
    reasons.push('fallback_used');
  }
  if (input.degradedReason) {
    reasons.push('degraded_tracking');
  }
  if (
    input.classificationConfidence !== null &&
    input.classificationConfidence < poseContractConfidenceThreshold
  ) {
    reasons.push('low_classification_confidence');
  }
  if (input.averageConfidence !== null && input.averageConfidence < 0.65) {
    reasons.push('low_average_confidence');
  }
  if (reliableFrameRatio !== null && reliableFrameRatio < 0.7) {
    reasons.push(
      reliableFrameRatio < 0.4
        ? 'low_reliable_frame_ratio'
        : 'moderate_reliable_frame_ratio',
    );
  } else if (
    input.reliableFrameCount !== null &&
    input.reliableFrameCount > 0 &&
    input.reliableFrameCount < 8
  ) {
    reasons.push('low_reliable_frame_count');
  }
  if (
    input.subjectLockConfidence !== null &&
    input.subjectLockConfidence < 0.6
  ) {
    reasons.push('weak_subject_lock');
  }
  if (input.lowConfidenceLandmarks.length >= 8) {
    reasons.push('landmark_occlusion');
  }
  if (!input.movementContract) {
    reasons.push('missing_movement_contract');
  }
  if (!input.detectedExerciseName) {
    reasons.push('unknown_exercise');
  }
  if (input.equipmentConflicts.length > 0) {
    reasons.push('equipment_context_conflict');
  }
  if (input.finalRepCount !== undefined && (input.finalRepCount ?? 0) <= 0) {
    reasons.push('zero_rep_result');
  }

  const uniqueReasons = Array.from(new Set(reasons));
  const invalid =
    (reliableFrameRatio !== null && reliableFrameRatio < 0.25) ||
    (input.averageConfidence !== null && input.averageConfidence < 0.35) ||
    (input.subjectLockConfidence !== null &&
      input.subjectLockConfidence < 0.35) ||
    (input.finalRepCount !== undefined && (input.finalRepCount ?? 0) <= 0);
  const sessionQualityState: PoseSessionQualityState = invalid
    ? 'invalid'
    : uniqueReasons.length > 0
      ? 'degraded'
      : 'stable';
  const progressionDisposition: PoseProgressionDisposition =
    sessionQualityState === 'invalid'
      ? 'hold_for_review'
      : uniqueReasons.length > 0
        ? 'cautionary'
        : 'normal';

  return {
    integrityReasonCodes: uniqueReasons,
    progressionDisposition,
    reliableFrameRatio: toRoundedPoseMetric(reliableFrameRatio),
    reviewRecommended: uniqueReasons.length > 0,
    sessionQualityReasons: uniqueReasons,
    sessionQualityState,
  };
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

  const [start, end] = value as [unknown, unknown];
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
  if (normalized.includes('ankle')) {
    return 'ankle';
  }
  if (normalized.includes('knee')) {
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

type PoseSpatialRequirementsValue =
  PoseMovementContractValue['spatial_requirements'];

type PoseMovementContractDefaults = {
  degradedConditions: string[];
  noCountConditions: string[];
  phaseOrder: string[];
  primaryJoints: string[];
  repModel: PoseRepModel;
  requiredSides: PoseRequiredSides;
  secondaryJoints: string[];
  spatialRequirements: PoseSpatialRequirementsValue;
};

function getMovementContractDefaults(
  exerciseName: string,
): PoseMovementContractDefaults {
  const contract = buildFallbackPoseMovementContract(exerciseName);
  if (!contract) {
    return {
      degradedConditions: [],
      noCountConditions: [],
      phaseOrder: [],
      primaryJoints: [],
      repModel: 'unknown',
      requiredSides: 'either',
      secondaryJoints: [],
      spatialRequirements: {},
    };
  }
  const spatial = contract.spatialRequirements ?? {};
  return {
    degradedConditions: contract.degradedConditions ?? [],
    noCountConditions: contract.noCountConditions ?? [],
    phaseOrder: contract.phaseOrder ?? [],
    primaryJoints: contract.primaryJoints ?? [],
    repModel: contract.repModel ?? 'unknown',
    requiredSides: contract.requiredSides ?? 'either',
    secondaryJoints: contract.secondaryJoints ?? [],
    spatialRequirements: {
      body_line_tolerance: spatial.bodyLineTolerance,
      body_x_drift_max: spatial.bodyXDriftMax,
      body_y_travel_min: spatial.bodyYTravelMin,
      hip_y_travel_min: spatial.hipYTravelMin,
      left_right_symmetry_tolerance: spatial.leftRightSymmetryTolerance,
      phase_sync_tolerance_ms: spatial.phaseSyncToleranceMs,
      shoulder_hip_travel_min: spatial.shoulderHipTravelMin,
      shoulder_y_travel_min: spatial.shoulderYTravelMin,
      torso_slope_max_deg: spatial.torsoSlopeMaxDeg,
      torso_slope_min_deg: spatial.torsoSlopeMinDeg,
      wrist_anchor_drift_max: spatial.wristAnchorDriftMax,
    },
  };
}

function toRepModel(value: unknown, fallback: PoseRepModel): PoseRepModel {
  return value === 'bilateral' ||
    value === 'unilateral_left' ||
    value === 'unilateral_right' ||
    value === 'alternating' ||
    value === 'static_hold' ||
    value === 'unknown'
    ? value
    : fallback;
}

function toRequiredSides(
  value: unknown,
  fallback: PoseRequiredSides,
): PoseRequiredSides {
  return value === 'both' ||
    value === 'left' ||
    value === 'right' ||
    value === 'either' ||
    value === 'alternating'
    ? value
    : fallback;
}

function toContractStringArray(value: unknown, fallback: string[]): string[] {
  const entries = toStringArray(value).filter((entry) => entry.trim());
  return entries.length > 0 ? entries : fallback;
}

function getObjectValue(
  value: Record<string, unknown>,
  snakeKey: string,
  camelKey: string,
): unknown {
  return value[snakeKey] ?? value[camelKey];
}

function toSpatialRequirements(
  value: unknown,
  fallback: PoseSpatialRequirementsValue,
): PoseSpatialRequirementsValue {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    body_line_tolerance:
      toOptionalNumber(
        getObjectValue(value, 'body_line_tolerance', 'bodyLineTolerance'),
      ) ?? fallback?.body_line_tolerance,
    body_x_drift_max:
      toOptionalNumber(
        getObjectValue(value, 'body_x_drift_max', 'bodyXDriftMax'),
      ) ?? fallback?.body_x_drift_max,
    body_y_travel_min:
      toOptionalNumber(
        getObjectValue(value, 'body_y_travel_min', 'bodyYTravelMin'),
      ) ?? fallback?.body_y_travel_min,
    hip_y_travel_min:
      toOptionalNumber(
        getObjectValue(value, 'hip_y_travel_min', 'hipYTravelMin'),
      ) ?? fallback?.hip_y_travel_min,
    shoulder_y_travel_min:
      toOptionalNumber(
        getObjectValue(value, 'shoulder_y_travel_min', 'shoulderYTravelMin'),
      ) ?? fallback?.shoulder_y_travel_min,
    shoulder_hip_travel_min:
      toOptionalNumber(
        getObjectValue(
          value,
          'shoulder_hip_travel_min',
          'shoulderHipTravelMin',
        ),
      ) ?? fallback?.shoulder_hip_travel_min,
    wrist_anchor_drift_max:
      toOptionalNumber(
        getObjectValue(value, 'wrist_anchor_drift_max', 'wristAnchorDriftMax'),
      ) ?? fallback?.wrist_anchor_drift_max,
    torso_slope_min_deg:
      toOptionalNumber(
        getObjectValue(value, 'torso_slope_min_deg', 'torsoSlopeMinDeg'),
      ) ?? fallback?.torso_slope_min_deg,
    torso_slope_max_deg:
      toOptionalNumber(
        getObjectValue(value, 'torso_slope_max_deg', 'torsoSlopeMaxDeg'),
      ) ?? fallback?.torso_slope_max_deg,
    left_right_symmetry_tolerance:
      toOptionalNumber(
        getObjectValue(
          value,
          'left_right_symmetry_tolerance',
          'leftRightSymmetryTolerance',
        ),
      ) ?? fallback?.left_right_symmetry_tolerance,
    phase_sync_tolerance_ms:
      toOptionalNumber(
        getObjectValue(
          value,
          'phase_sync_tolerance_ms',
          'phaseSyncToleranceMs',
        ),
      ) ?? fallback?.phase_sync_tolerance_ms,
  };
}

function enrichMovementContract(
  contract: PoseMovementContractValue,
  source?: Record<string, unknown> | null,
): PoseMovementContractValue {
  const defaults = getMovementContractDefaults(contract.exercise);
  const canonicalContract = buildFallbackPoseMovementContract(
    contract.exercise,
  );
  const spatialSource = isRecord(source?.spatial_requirements)
    ? source.spatial_requirements
    : isRecord(source?.spatialRequirements)
      ? source.spatialRequirements
      : contract.spatial_requirements;

  return {
    ...contract,
    degraded_conditions: toContractStringArray(
      source?.degraded_conditions ?? source?.degradedConditions,
      contract.degraded_conditions ?? defaults.degradedConditions,
    ),
    no_count_conditions: toContractStringArray(
      source?.no_count_conditions ?? source?.noCountConditions,
      contract.no_count_conditions ?? defaults.noCountConditions,
    ),
    phase_order: toContractStringArray(
      source?.phase_order ?? source?.phaseOrder,
      contract.phase_order ?? defaults.phaseOrder,
    ),
    primary_joints: toContractStringArray(
      source?.primary_joints ?? source?.primaryJoints,
      contract.primary_joints ?? defaults.primaryJoints,
    ),
    rep_model: toRepModel(
      source?.rep_model ?? source?.repModel ?? contract.rep_model,
      contract.rep_model ?? defaults.repModel,
    ),
    required_sides: toRequiredSides(
      source?.required_sides ??
        source?.requiredSides ??
        contract.required_sides,
      contract.required_sides ?? defaults.requiredSides,
    ),
    secondary_joints: toContractStringArray(
      source?.secondary_joints ?? source?.secondaryJoints,
      contract.secondary_joints ?? defaults.secondaryJoints,
    ),
    body_orientation: (source?.body_orientation ??
      source?.bodyOrientation ??
      contract.body_orientation ??
      canonicalContract?.bodyOrientation) as
      | PoseMovementContractValue['body_orientation']
      | undefined,
    contract_version: (source?.contract_version ??
      source?.contractVersion ??
      contract.contract_version ??
      canonicalContract?.contractVersion) as string | undefined,
    partial_rep_policy: (source?.partial_rep_policy ??
      source?.partialRepPolicy ??
      contract.partial_rep_policy ??
      canonicalContract?.partialRepPolicy) as
      | PoseMovementContractValue['partial_rep_policy']
      | undefined,
    hold_duration_seconds:
      toOptionalNumber(
        source?.hold_duration_seconds ??
          source?.holdDurationSeconds ??
          contract.hold_duration_seconds,
      ) ??
      canonicalContract?.holdDurationSeconds ??
      null,
    spatial_requirements: toSpatialRequirements(
      spatialSource,
      contract.spatial_requirements ?? defaults.spatialRequirements,
    ),
    tracking_requirements: {
      min_confidence:
        toOptionalNumber(
          source?.tracking_requirements &&
            isRecord(source.tracking_requirements)
            ? source.tracking_requirements.min_confidence
            : source?.trackingRequirements &&
                isRecord(source.trackingRequirements)
              ? source.trackingRequirements.minConfidence
              : contract.tracking_requirements?.min_confidence,
        ) ??
        canonicalContract?.trackingRequirements?.minConfidence ??
        0.6,
      min_reliable_frame_landmarks:
        toOptionalNumber(
          source?.tracking_requirements &&
            isRecord(source.tracking_requirements)
            ? source.tracking_requirements.min_reliable_frame_landmarks
            : source?.trackingRequirements &&
                isRecord(source.trackingRequirements)
              ? source.trackingRequirements.minReliableFrameLandmarks
              : contract.tracking_requirements?.min_reliable_frame_landmarks,
        ) ??
        canonicalContract?.trackingRequirements?.minReliableFrameLandmarks ??
        12,
      required_landmarks: toContractStringArray(
        source?.tracking_requirements && isRecord(source.tracking_requirements)
          ? source.tracking_requirements.required_landmarks
          : source?.trackingRequirements &&
              isRecord(source.trackingRequirements)
            ? source.trackingRequirements.requiredLandmarks
            : contract.tracking_requirements?.required_landmarks,
        canonicalContract?.trackingRequirements?.requiredLandmarks ?? [],
      ),
      required_sides:
        source?.tracking_requirements &&
        isRecord(source.tracking_requirements) &&
        source.tracking_requirements.required_sides
          ? toRequiredSides(
              source.tracking_requirements.required_sides,
              defaults.requiredSides,
            )
          : (canonicalContract?.trackingRequirements?.requiredSides ??
            contract.required_sides ??
            defaults.requiredSides),
    },
  };
}

function buildMovementContractFromProfile(
  profile: Pick<
    PoseBootstrapProfileRecord,
    | 'angle_signature'
    | 'canonical_name'
    | 'dominant_joint'
    | 'movement_pattern'
    | 'orientation_signature'
    | 'rep_rules'
    | 'rep_thresholds'
    | 'tolerance'
    | 'visibility_pattern'
  >,
): PoseMovementContractValue | null {
  const tolerance = toDecimalNumber(profile.tolerance) ?? defaultPoseTolerance;
  const configuredJoint = toPoseJointName(profile.dominant_joint);
  const movementPattern = toOptionalJsonObject(profile.movement_pattern) ?? {};
  const repThresholdsObject = toOptionalJsonObject(profile.rep_thresholds);
  const angleSignature = toOptionalJsonObject(profile.angle_signature) ?? {};
  const repRules = toOptionalJsonObject(profile.rep_rules);
  const visibilityPattern =
    toOptionalJsonObject(profile.visibility_pattern) ?? {};
  const orientationSignature =
    toOptionalJsonObject(profile.orientation_signature) ?? {};
  const contractSource = {
    ...movementPattern,
    ...(repRules ?? {}),
  };
  const fallbackContract = buildFallbackPoseMovementContract(
    profile.canonical_name,
  );

  // A profile can be active in storage while still being an incomplete
  // editor draft.  Require the persisted contract fields before applying the
  // compatibility normalizer; otherwise defaults could accidentally turn a
  // malformed profile into an auto-rep profile.
  const trackingRequirements = isRecord(repRules?.tracking_requirements)
    ? repRules.tracking_requirements
    : null;
  const hasExplicitContract =
    fallbackContract !== null &&
    configuredJoint === fallbackContract.dominantJoint &&
    explicitRepThresholdsAreComplete(repThresholdsObject) &&
    Array.isArray(
      movementPattern.oscillating_landmarks ??
        movementPattern.oscillating_joints,
    ) &&
    isRecord(repRules) &&
    Array.isArray(visibilityPattern.required_landmarks) &&
    visibilityPattern.required_landmarks.length > 0 &&
    typeof orientationSignature.body_orientation === 'string';

  if (!hasExplicitContract) {
    return null;
  }
  const hasCanonicalRules =
    typeof repRules.secondary_check !== 'string' ||
    (typeof repRules.rep_model === 'string' &&
      typeof repRules.required_sides === 'string' &&
      typeof repRules.contract_version === 'string' &&
      typeof repRules.body_orientation === 'string' &&
      Array.isArray(repRules.primary_joints) &&
      Array.isArray(repRules.phase_order) &&
      isRecord(trackingRequirements) &&
      typeof trackingRequirements.min_confidence === 'number' &&
      typeof trackingRequirements.min_reliable_frame_landmarks === 'number' &&
      Array.isArray(trackingRequirements.required_landmarks));
  if (!hasCanonicalRules) {
    return null;
  }
  if (
    typeof repRules.rep_model === 'string' &&
    repRules.rep_model !== fallbackContract?.repModel
  ) {
    return null;
  }
  if (
    typeof repRules.required_sides === 'string' &&
    repRules.required_sides !== fallbackContract?.requiredSides
  ) {
    return null;
  }
  if (
    typeof repRules.contract_version === 'string' &&
    repRules.contract_version !== fallbackContract?.contractVersion
  ) {
    return null;
  }
  if (
    typeof repRules.body_orientation === 'string' &&
    repRules.body_orientation !== fallbackContract?.bodyOrientation
  ) {
    return null;
  }
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

  const enriched = enrichMovementContract(
    {
      exercise: profile.canonical_name,
      dominant_joint: dominantJoint,
      rep_thresholds: {
        down,
        up,
      },
      secondary_check:
        repRules !== null
          ? toSecondaryCheck(repRules)
          : toSecondaryCheck(movementPattern),
      oscillating_joints: toOscillatingJoints(
        movementPattern.oscillating_landmarks ??
          movementPattern.oscillating_joints ??
          repRules?.oscillating_joints,
      ),
    },
    contractSource,
  );

  return typeof repRules.secondary_check === 'string'
    ? isValidPoseMovementContract(toSharedMovementContract(enriched))
      ? enriched
      : null
    : enriched;
}

function explicitRepThresholdsAreComplete(
  value: Record<string, unknown> | null,
) {
  return (
    value !== null &&
    toThreshold(value.down, defaultPoseTolerance) !== null &&
    toThreshold(value.up, defaultPoseTolerance) !== null
  );
}

function toSharedMovementContract(value: PoseMovementContractValue) {
  const spatial = value.spatial_requirements;
  const tracking = value.tracking_requirements;
  return {
    exercise: value.exercise,
    dominantJoint: value.dominant_joint,
    secondaryCheck: value.secondary_check,
    oscillatingJoints: value.oscillating_joints,
    repThresholds: value.rep_thresholds,
    repModel: value.rep_model,
    requiredSides: value.required_sides,
    primaryJoints: value.primary_joints,
    phaseOrder: value.phase_order,
    bodyOrientation: value.body_orientation,
    contractVersion: value.contract_version,
    holdDurationSeconds: value.hold_duration_seconds,
    spatialRequirements: spatial
      ? {
          bodyLineTolerance: spatial.body_line_tolerance,
          bodyXDriftMax: spatial.body_x_drift_max,
          bodyYTravelMin: spatial.body_y_travel_min,
          hipYTravelMin: spatial.hip_y_travel_min,
          leftRightSymmetryTolerance: spatial.left_right_symmetry_tolerance,
          phaseSyncToleranceMs: spatial.phase_sync_tolerance_ms,
          shoulderHipTravelMin: spatial.shoulder_hip_travel_min,
          shoulderYTravelMin: spatial.shoulder_y_travel_min,
          torsoSlopeMaxDeg: spatial.torso_slope_max_deg,
          torsoSlopeMinDeg: spatial.torso_slope_min_deg,
          wristAnchorDriftMax: spatial.wrist_anchor_drift_max,
        }
      : null,
    trackingRequirements: tracking
      ? {
          minConfidence: tracking.min_confidence,
          minReliableFrameLandmarks: tracking.min_reliable_frame_landmarks,
          requiredLandmarks: tracking.required_landmarks,
          requiredSides: tracking.required_sides,
        }
      : undefined,
  };
}

function filterUsableBootstrapProfiles(
  profiles: PoseBootstrapProfileRecord[],
): PoseBootstrapProfileRecord[] {
  return profiles.filter((profile) =>
    buildMovementContractFromProfile(profile),
  );
}

function buildMovementContractFromShared(
  value: unknown,
): PoseMovementContractValue | null {
  const contract = normalizePoseMovementContract(value);
  if (!contract || !isValidPoseMovementContract(contract)) return null;
  return enrichMovementContract({
    exercise: contract.exercise,
    dominant_joint: contract.dominantJoint,
    rep_thresholds: contract.repThresholds,
    secondary_check: contract.secondaryCheck,
    oscillating_joints: contract.oscillatingJoints,
    rep_model: contract.repModel,
    required_sides: contract.requiredSides,
    primary_joints: contract.primaryJoints,
    secondary_joints: contract.secondaryJoints,
    phase_order: contract.phaseOrder,
    spatial_requirements: contract.spatialRequirements
      ? {
          body_line_tolerance: contract.spatialRequirements.bodyLineTolerance,
          body_x_drift_max: contract.spatialRequirements.bodyXDriftMax,
          body_y_travel_min: contract.spatialRequirements.bodyYTravelMin,
          hip_y_travel_min: contract.spatialRequirements.hipYTravelMin,
          left_right_symmetry_tolerance:
            contract.spatialRequirements.leftRightSymmetryTolerance,
          phase_sync_tolerance_ms:
            contract.spatialRequirements.phaseSyncToleranceMs,
          shoulder_hip_travel_min:
            contract.spatialRequirements.shoulderHipTravelMin,
          shoulder_y_travel_min:
            contract.spatialRequirements.shoulderYTravelMin,
          torso_slope_max_deg: contract.spatialRequirements.torsoSlopeMaxDeg,
          torso_slope_min_deg: contract.spatialRequirements.torsoSlopeMinDeg,
          wrist_anchor_drift_max:
            contract.spatialRequirements.wristAnchorDriftMax,
        }
      : undefined,
    no_count_conditions: contract.noCountConditions,
    degraded_conditions: contract.degradedConditions,
    body_orientation: contract.bodyOrientation,
    contract_version: contract.contractVersion,
    partial_rep_policy: contract.partialRepPolicy,
    hold_duration_seconds: contract.holdDurationSeconds,
    tracking_requirements: contract.trackingRequirements
      ? {
          min_confidence: contract.trackingRequirements.minConfidence,
          min_reliable_frame_landmarks:
            contract.trackingRequirements.minReliableFrameLandmarks,
          required_landmarks: contract.trackingRequirements.requiredLandmarks,
          required_sides: contract.trackingRequirements.requiredSides,
        }
      : undefined,
  });
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

function toRepRulesJson(
  value: PoseMovementContractValue,
): Record<string, unknown> {
  return {
    body_orientation: value.body_orientation ?? null,
    contract_version: value.contract_version ?? null,
    degraded_conditions: value.degraded_conditions ?? [],
    no_count_conditions: value.no_count_conditions ?? [],
    phase_order: value.phase_order ?? [],
    partial_rep_policy: value.partial_rep_policy ?? null,
    hold_duration_seconds: value.hold_duration_seconds ?? null,
    primary_joints: value.primary_joints ?? [],
    rep_model: value.rep_model ?? 'unknown',
    required_sides: value.required_sides ?? null,
    secondary_check: value.secondary_check,
    secondary_joints: value.secondary_joints ?? [],
    oscillating_joints: value.oscillating_joints,
    spatial_requirements: value.spatial_requirements ?? null,
    tracking_requirements: value.tracking_requirements ?? null,
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

function scoreBootstrapProfile(
  profile: PoseBootstrapProfileRecord,
  canonicalHint: string | null,
  rawExerciseHint: string | null,
  signals: PoseAnalyzeSignalsValue,
): number {
  let score = 0;
  const normalizedProfileName = profile.canonical_name.trim().toLowerCase();
  const profileCanonical = toCanonicalPoseExerciseHint(profile.canonical_name);
  const normalizedRawHint =
    normalizePoseExerciseHint(rawExerciseHint)?.toLowerCase() ?? null;
  const movementContract = buildMovementContractFromProfile(profile);
  const movementPattern = toOptionalJsonObject(profile.movement_pattern) ?? {};
  const visibilityPattern =
    toOptionalJsonObject(profile.visibility_pattern) ?? {};
  const orientationSignature =
    toOptionalJsonObject(profile.orientation_signature) ?? {};
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

  const liveTorsoSlopeDeg = toOptionalNumber(
    signals.orientation.torso_slope_deg,
  );
  const hasHardUprightPushUpConflict =
    liveOrientation === 'upright' &&
    profileCanonical === 'push_up' &&
    (liveTorsoSlopeDeg ?? 90) > 86;

  if (hasHardUprightPushUpConflict) {
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
  const normalizedRawHint =
    normalizePoseExerciseHint(rawExerciseHint)?.toLowerCase() ?? null;

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
    private readonly eventEmitter: EventEmitter2,
    private readonly exerciseService: ExerciseService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private async resolveAuthoritativeMovementContractResolution(
    exerciseId: string | null | undefined,
    label: string | null | undefined,
  ): Promise<AuthoritativeMovementContractResolution | null> {
    const exercise = await this.exerciseService.resolveExerciseContract({
      exerciseId,
      label,
    });
    if (!exercise || exercise.tracking_mode === 'manual') return null;
    const movementProfile = exercise.movement_profile;
    const sharedContract = movementProfile?.movementContract;
    const movementContract = buildMovementContractFromShared(sharedContract);
    const identity = exercise.movement_contract_identity;
    if (
      !movementContract ||
      typeof identity.exerciseId !== 'string' ||
      typeof identity.familyKey !== 'string' ||
      typeof identity.revision !== 'number' ||
      !Number.isInteger(identity.revision) ||
      identity.revision < 1 ||
      typeof identity.source !== 'string' ||
      typeof identity.trackingMode !== 'string'
    ) {
      return null;
    }
    return {
      identity: {
        exerciseId: identity.exerciseId,
        familyKey: identity.familyKey,
        revision: identity.revision,
        source: identity.source,
        trackingMode: identity.trackingMode,
      },
      movementContract,
    };
  }

  private toProviderEquipmentPredictions(
    payload: unknown,
  ): ProviderEquipmentPrediction[] {
    if (!isRecord(payload) || !Array.isArray(payload.predictions)) {
      return [];
    }

    const image = isRecord(payload.image) ? payload.image : null;
    const imageWidth = image ? toOptionalNumber(image.width) : null;
    const imageHeight = image ? toOptionalNumber(image.height) : null;

    return payload.predictions
      .map((prediction): ProviderEquipmentPrediction => {
        if (!isRecord(prediction)) {
          return {
            confidence: null,
            height: null,
            label: null,
            width: null,
            x: null,
            y: null,
          };
        }

        const centerX = normalizeProviderBoxDimension(
          toOptionalNumber(prediction.x),
          imageWidth,
        );
        const centerY = normalizeProviderBoxDimension(
          toOptionalNumber(prediction.y),
          imageHeight,
        );
        const width = normalizeProviderBoxDimension(
          toOptionalNumber(prediction.width),
          imageWidth,
        );
        const height = normalizeProviderBoxDimension(
          toOptionalNumber(prediction.height),
          imageHeight,
        );

        return {
          confidence: toBoundedConfidence(prediction.confidence),
          height: height === null ? null : clampUnit(height),
          label:
            toNullableString(prediction.class) ??
            toNullableString(prediction.label) ??
            toNullableString(prediction.name),
          width: width === null ? null : clampUnit(width),
          x:
            centerX === null || width === null
              ? null
              : clampUnit(centerX - width / 2),
          y:
            centerY === null || height === null
              ? null
              : clampUnit(centerY - height / 2),
        };
      })
      .filter(
        (prediction) =>
          prediction.label !== null || prediction.confidence !== null,
      );
  }

  private isEquipmentDetectionProviderEnabled(): boolean {
    const provider = this.getEquipmentDetectionProvider();
    const apiKey = this.config.get<string>(
      'equipmentDetection.roboflowApiKey',
      '',
    );
    const modelId = this.config.get<string>(
      'equipmentDetection.roboflowModelId',
      '',
    );

    if (localAiEquipmentProviders.has(provider)) {
      return Boolean(this.config.get<string>('ai.apiBaseUrl', ''));
    }

    return provider === 'roboflow' && Boolean(apiKey) && Boolean(modelId);
  }

  private getEquipmentDetectionProvider(): string {
    return this.config
      .get<string>('equipmentDetection.provider', '')
      .trim()
      .toLowerCase();
  }

  async detectPoseEquipment(
    dto: DetectPoseEquipmentDTO,
  ): Promise<PoseEquipmentDetectionResponseDTO> {
    const frameBase64 = dto.frame_b64?.trim();
    if (!frameBase64) {
      throw new BadRequestException({
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Invalid Equipment Frame',
        status: 400,
        detail: 'frame_b64 is required.',
      });
    }

    const providerEnabled = this.isEquipmentDetectionProviderEnabled();
    const equipment = await this.detectEquipmentFromFrame(frameBase64, dto);

    return {
      equipment_detections: equipment?.equipmentDetections ?? [],
      equipment_confidence: equipment?.equipmentConfidence ?? null,
      equipment_conflicts:
        equipment?.equipmentConflicts ??
        (providerEnabled ? [] : ['equipment_provider_unavailable']),
      equipment_context: equipment?.equipmentContext ?? null,
      equipment_source: equipment?.equipmentSource ?? null,
      provider_enabled: providerEnabled,
    };
  }

  private async detectLocalAiEquipmentFromFrame(
    frameBase64: string,
    dto?: Pick<DetectPoseEquipmentDTO, 'camera_facing_mode' | 'exercise_hint'>,
  ): Promise<PoseEquipmentResolution | null> {
    try {
      const response = await this.aiClient.detectEquipment({
        cameraFacingMode: dto?.camera_facing_mode ?? null,
        exerciseHint: dto?.exercise_hint ?? null,
        frameBase64,
      });
      return this.toLocalAiEquipmentResolution(response);
    } catch {
      return null;
    }
  }

  private toLocalAiEquipmentResolution(
    response: AiEquipmentDetectResponse,
  ): PoseEquipmentResolution | null {
    const equipmentDetections = response.equipment_detections
      .map((detection) => ({
        confidence: toBoundedConfidence(detection.confidence),
        height: normalizeUnitBoxValue(detection.height),
        label: toNullableString(detection.label),
        width: normalizeUnitBoxValue(detection.width),
        x: normalizeUnitBoxValue(detection.x),
        y: normalizeUnitBoxValue(detection.y),
      }))
      .filter(
        (detection) =>
          detection.label !== null || detection.confidence !== null,
      );
    const labels = equipmentDetections
      .map((detection) => detection.label)
      .filter((label): label is string => label !== null);
    const equipmentContext =
      toPoseEquipmentContext(response.equipment_context) ??
      inferProviderEquipmentContext(labels);
    const conflicts = Array.isArray(response.equipment_conflicts)
      ? response.equipment_conflicts
      : [];

    if (!equipmentContext) {
      if (equipmentDetections.length === 0 && conflicts.length === 0) {
        return null;
      }

      return {
        equipmentDetections,
        equipmentConfidence: toBoundedConfidence(response.equipment_confidence),
        equipmentConflicts: conflicts,
        equipmentContext: null,
        equipmentSource: null,
      };
    }

    return resolvePoseEquipment({
      declaredConfidence: toBoundedConfidence(response.equipment_confidence),
      declaredContext: equipmentContext,
      declaredSource: 'provider_api',
      equipmentDetections,
      existingConflicts: conflicts,
      labels,
    });
  }

  private async detectEquipmentFromFrame(
    frameBase64: string,
    dto?: Pick<DetectPoseEquipmentDTO, 'camera_facing_mode' | 'exercise_hint'>,
  ): Promise<PoseEquipmentResolution | null> {
    const provider = this.getEquipmentDetectionProvider();
    if (localAiEquipmentProviders.has(provider)) {
      return this.detectLocalAiEquipmentFromFrame(frameBase64, dto);
    }

    if (provider !== 'roboflow') {
      return null;
    }

    const apiKey = this.config.get<string>(
      'equipmentDetection.roboflowApiKey',
      '',
    );
    const modelId = this.config.get<string>(
      'equipmentDetection.roboflowModelId',
      '',
    );
    if (!apiKey || !modelId) {
      return null;
    }

    const apiBaseUrl = this.config
      .get<string>(
        'equipmentDetection.roboflowApiBaseUrl',
        'https://serverless.roboflow.com',
      )
      .replace(/\/+$/, '');
    const endpoint = `${apiBaseUrl}/${modelId.replace(/^\/+/, '')}?api_key=${encodeURIComponent(
      apiKey,
    )}`;
    const requestTimeoutMs = Math.max(
      1000,
      this.config.get<number>('equipmentDetection.requestTimeoutMs', 5000),
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: frameBase64,
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const predictions = this.toProviderEquipmentPredictions(
        (await response.json()) as unknown,
      );
      const confidentPredictions = predictions.filter(
        (prediction) =>
          (prediction.confidence ?? 0) >= providerEquipmentConfidenceThreshold,
      );
      const labels = confidentPredictions
        .map((prediction) => prediction.label)
        .filter((label): label is string => label !== null);
      const equipmentContext = inferProviderEquipmentContext(labels);
      if (!equipmentContext) {
        return null;
      }

      const bestConfidence = confidentPredictions.reduce<number | null>(
        (best, prediction) =>
          prediction.confidence === null
            ? best
            : Math.max(best ?? 0, prediction.confidence),
        null,
      );
      const equipmentDetections = confidentPredictions.map((prediction) => ({
        confidence: prediction.confidence,
        height: prediction.height,
        label: prediction.label,
        width: prediction.width,
        x: prediction.x,
        y: prediction.y,
      }));

      return resolvePoseEquipment({
        declaredConfidence: bestConfidence,
        declaredContext: equipmentContext,
        declaredSource: 'provider_api',
        equipmentDetections,
        labels,
      });
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

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
    const candidateProfiles = filterUsableBootstrapProfiles(
      await this.repo.listBootstrapPoseProfiles({
        exerciseHint: null,
        canonicalHint: null,
      }),
    );
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
    const session = await this.repo.findPoseSessionByIdOrThrow(
      state.poseSessionId,
    );
    this.assertPoseSessionOwner(session, state.userId);

    return this.finalizeOpenPoseSession(session, state, endedReason);
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
    const presetCandidates = filterUsableBootstrapProfiles(
      await this.repo.listBootstrapPoseProfiles({
        exerciseHint: null,
        canonicalHint: null,
      }),
    );
    const frameBase64 = hasFrameBase64(dto.frame_b64)
      ? (dto.frame_b64?.trim() ?? null)
      : null;

    if (frameBase64) {
      const analysis = await this.aiClient.analyzePoseFrame({
        poseSessionId: session.id,
        frameBase64,
      });
      const processingMode = toPoseProcessingMode(analysis.processing_mode);
      const repEvent = analysis.rep_event ?? false;
      const repCountDelta = toPoseRepCountDelta(analysis.rep_count_delta);
      const phase = toNullableString(analysis.phase);
      let matchedProfileId =
        analysis.matched_profile_id ?? session.detected_profile_id ?? null;
      const detectedExerciseName =
        analysis.exercise_class ??
        session.detected_exercise_name ??
        requestedExerciseHint ??
        null;
      const matchedProfileCandidate =
        presetCandidates.find((profile) => profile.id === matchedProfileId) ??
        (detectedExerciseName
          ? (presetCandidates.find(
              (profile) =>
                toCanonicalPoseExerciseHint(profile.canonical_name) ===
                toCanonicalPoseExerciseHint(detectedExerciseName),
            ) ?? null)
          : null);
      if (matchedProfileId && !matchedProfileCandidate) {
        matchedProfileId = null;
      }
      const movementContractResolution = matchedProfileCandidate
        ? await this.resolveAuthoritativeMovementContractResolution(
            null,
            detectedExerciseName ?? matchedProfileCandidate.canonical_name,
          )
        : null;
      const movementContract =
        movementContractResolution?.movementContract ?? null;
      const needsConfirmation =
        analysis.needs_confirmation === true || movementContract === null;
      const subjectLocked =
        dto.subject_locked ?? analysis.subject_locked ?? null;
      const subjectLockConfidence =
        dto.subject_lock_confidence ?? analysis.subject_lock_confidence ?? null;

      if (!matchedProfileId && matchedProfileCandidate) {
        matchedProfileId = matchedProfileCandidate.id;
      }

      const candidateExercises =
        analysis.candidate_exercises && analysis.candidate_exercises.length > 0
          ? analysis.candidate_exercises
          : detectedExerciseName
            ? [detectedExerciseName]
            : [];
      const formFeedback =
        analysis.form_feedback && analysis.form_feedback.length > 0
          ? analysis.form_feedback
          : [
              'Native snapshot analysis is active.',
              'Automatic rep counting still depends on the upcoming native landmark runtime.',
            ];
      const providerEquipment =
        await this.detectEquipmentFromFrame(frameBase64);
      const equipment = resolvePoseEquipment({
        declaredConfidence:
          providerEquipment?.equipmentConfidence ?? dto.equipment_confidence,
        declaredContext:
          providerEquipment?.equipmentContext ?? dto.equipment_context ?? null,
        declaredSource:
          providerEquipment?.equipmentSource ?? dto.equipment_source ?? null,
        existingConflicts: [
          ...(dto.equipment_conflicts ?? []),
          ...(providerEquipment?.equipmentConflicts ?? []),
        ],
        labels: [
          detectedExerciseName,
          requestedExerciseHint,
          movementContract?.exercise,
        ],
      });
      const quality = assessPoseSessionQuality({
        averageConfidence: analysis.confidence,
        classificationConfidence: analysis.confidence,
        degradedReason: null,
        detectedExerciseName,
        equipmentConflicts: equipment.equipmentConflicts,
        fallbackUsed: false,
        frameCount: null,
        lowConfidenceLandmarks: [],
        movementContract,
        needsConfirmation,
        reliableFrameCount: null,
        subjectLockConfidence,
      });
      const persisted = await this.repo.updatePoseSessionAnalysis({
        poseSessionId: session.id,
        detectedExerciseName,
        detectedProfileId: matchedProfileId,
        classificationConfidence: analysis.confidence,
        subjectLockConfidence,
        analysisSummary: toPrismaJsonObject({
          camera_facing_mode: dto.camera_facing_mode ?? null,
          candidate_exercises: candidateExercises,
          classification_source: analysis.classification_source ?? 'classifier',
          form_feedback: formFeedback,
          frame_transport: 'frame_b64',
          movement_contract: movementContract,
          movement_contract_identity:
            movementContractResolution?.identity ?? null,
          needs_confirmation: needsConfirmation,
          phase,
          processing_mode: processingMode,
          producer_runtime: 'native_mobile',
          equipment_context: equipment.equipmentContext,
          equipment_source: equipment.equipmentSource,
          equipment_confidence: equipment.equipmentConfidence,
          equipment_conflicts: equipment.equipmentConflicts,
          session_quality_state: quality.sessionQualityState,
          session_quality_reasons: quality.sessionQualityReasons,
          reliable_frame_ratio: quality.reliableFrameRatio,
          progression_disposition: quality.progressionDisposition,
          integrity_reason_codes: quality.integrityReasonCodes,
          review_recommended: quality.reviewRecommended,
          rep_count_delta: repCountDelta,
          rep_event: repEvent,
          subject_locked: subjectLocked,
        }),
      });

      return {
        pose_session_id: session.id,
        confidence: analysis.confidence,
        exercise_class: detectedExerciseName,
        matched_profile_id:
          matchedProfileId ?? persisted.detected_profile_id ?? null,
        subject_locked: subjectLocked,
        subject_lock_confidence: subjectLockConfidence,
        classification_source: analysis.classification_source ?? 'classifier',
        needs_confirmation: needsConfirmation,
        processing_mode: processingMode,
        rep_event: repEvent,
        rep_count_delta: repCountDelta,
        phase,
        keypoints: analysis.keypoints ?? null,
        candidate_exercises: candidateExercises,
        form_feedback: formFeedback,
        movement_contract: movementContract,
        movement_contract_identity:
          movementContractResolution?.identity ?? null,
        session_quality_state: quality.sessionQualityState,
        session_quality_reasons: quality.sessionQualityReasons,
        reliable_frame_ratio: quality.reliableFrameRatio,
        progression_disposition: quality.progressionDisposition,
        integrity_reason_codes: quality.integrityReasonCodes,
        review_recommended: quality.reviewRecommended,
        equipment_context: equipment.equipmentContext,
        equipment_source: equipment.equipmentSource,
        equipment_confidence: equipment.equipmentConfidence,
        equipment_conflicts: equipment.equipmentConflicts,
      };
    }

    if (!dto.landmark_schema || !dto.frames || !dto.signals) {
      throw new BadRequestException({
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Invalid Pose Analyze Payload',
        status: 400,
        detail:
          'frame_b64 is required for native frame analysis, or landmark_schema plus frames and signals are required for sequence analysis.',
      });
    }

    const presetProfile = selectMatchingBootstrapProfile(
      presetCandidates,
      canonicalHint,
      requestedExerciseHint,
      dto.signals,
    );
    const presetContractResolution = presetProfile
      ? await this.resolveAuthoritativeMovementContractResolution(
          null,
          presetProfile.canonical_name,
        )
      : null;

    if (presetProfile && presetContractResolution) {
      const presetMovementContract = presetContractResolution.movementContract;
      const subjectLocked = dto.subject_locked ?? true;
      const subjectLockConfidence = dto.subject_lock_confidence ?? null;
      const equipment = resolvePoseEquipment({
        declaredConfidence: dto.equipment_confidence,
        declaredContext: dto.equipment_context ?? null,
        declaredSource: dto.equipment_source ?? null,
        existingConflicts: dto.equipment_conflicts,
        labels: [
          presetProfile.canonical_name,
          requestedExerciseHint,
          presetMovementContract.exercise,
        ],
      });
      const quality = assessPoseSessionQuality({
        averageConfidence: 1,
        classificationConfidence: 1,
        degradedReason: null,
        detectedExerciseName: presetProfile.canonical_name,
        equipmentConflicts: equipment.equipmentConflicts,
        fallbackUsed: false,
        frameCount: dto.frames.length,
        lowConfidenceLandmarks: dto.signals.visibility.low_confidence_landmarks,
        movementContract: presetMovementContract,
        needsConfirmation: false,
        reliableFrameCount: dto.signals.visibility.reliable_frame_count,
        subjectLockConfidence,
      });
      const persisted = await this.repo.updatePoseSessionAnalysis({
        poseSessionId: session.id,
        detectedExerciseName:
          session.detected_exercise_name ?? presetProfile.canonical_name,
        detectedProfileId: presetProfile.id,
        classificationConfidence: 1,
        subjectLockConfidence,
        analysisSummary: toPrismaJsonObject({
          camera_facing_mode: dto.camera_facing_mode ?? null,
          candidate_exercises: [presetProfile.canonical_name],
          classification_source: 'preset',
          form_feedback: [],
          landmark_schema: dto.landmark_schema,
          movement_contract: presetMovementContract,
          movement_contract_identity: presetContractResolution.identity,
          needs_confirmation: false,
          producer_runtime: 'web',
          equipment_context: equipment.equipmentContext,
          equipment_source: equipment.equipmentSource,
          equipment_confidence: equipment.equipmentConfidence,
          equipment_conflicts: equipment.equipmentConflicts,
          frame_count: dto.frames.length,
          low_confidence_landmarks:
            dto.signals.visibility.low_confidence_landmarks,
          reliable_frame_count: dto.signals.visibility.reliable_frame_count,
          reliable_frame_ratio: quality.reliableFrameRatio,
          session_quality_state: quality.sessionQualityState,
          session_quality_reasons: quality.sessionQualityReasons,
          progression_disposition: quality.progressionDisposition,
          integrity_reason_codes: quality.integrityReasonCodes,
          review_recommended: quality.reviewRecommended,
          subject_locked: subjectLocked,
        }),
      });

      return {
        pose_session_id: session.id,
        confidence: 1,
        exercise_class: presetProfile.canonical_name,
        matched_profile_id: persisted.detected_profile_id ?? presetProfile.id,
        subject_locked: subjectLocked,
        subject_lock_confidence: subjectLockConfidence,
        classification_source: 'preset',
        needs_confirmation: false,
        processing_mode: 'sequence',
        rep_event: false,
        rep_count_delta: 0,
        phase: null,
        candidate_exercises: [presetProfile.canonical_name],
        form_feedback: [],
        movement_contract: presetMovementContract,
        movement_contract_identity: presetContractResolution.identity,
        session_quality_state: quality.sessionQualityState,
        session_quality_reasons: quality.sessionQualityReasons,
        reliable_frame_ratio: quality.reliableFrameRatio,
        progression_disposition: quality.progressionDisposition,
        integrity_reason_codes: quality.integrityReasonCodes,
        review_recommended: quality.reviewRecommended,
        equipment_context: equipment.equipmentContext,
        equipment_source: equipment.equipmentSource,
        equipment_confidence: equipment.equipmentConfidence,
        equipment_conflicts: equipment.equipmentConflicts,
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
          left_elbow: entry.left_elbow ?? null,
          right_elbow: entry.right_elbow ?? null,
          left_shoulder: entry.left_shoulder ?? null,
          right_shoulder: entry.right_shoulder ?? null,
          left_hip: entry.left_hip ?? null,
          right_hip: entry.right_hip ?? null,
          left_knee: entry.left_knee ?? null,
          right_knee: entry.right_knee ?? null,
          ankle: entry.ankle ?? null,
          left_ankle: entry.left_ankle ?? null,
          right_ankle: entry.right_ankle ?? null,
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
          left_arm_visibility:
            dto.signals.visibility.left_arm_visibility ?? null,
          right_arm_visibility:
            dto.signals.visibility.right_arm_visibility ?? null,
        },
        hip: {
          average_y: dto.signals.hip.average_y,
          range_y: dto.signals.hip.range_y,
          range_x: dto.signals.hip.range_x ?? null,
          stable: dto.signals.hip.stable,
        },
        temporal: {
          amplitudes: dto.signals.temporal.amplitudes,
          oscillating_joints: dto.signals.temporal.oscillating_joints,
          phase_sync_ms: dto.signals.temporal.phase_sync_ms ?? null,
        },
      },
    });
    const processingMode = toPoseProcessingMode(analysis.processing_mode);
    const repEvent = analysis.rep_event ?? false;
    const repCountDelta = toPoseRepCountDelta(analysis.rep_count_delta);
    const phase = toNullableString(analysis.phase);
    const subjectLocked = dto.subject_locked ?? analysis.subject_locked ?? null;
    const subjectLockConfidence =
      dto.subject_lock_confidence ?? analysis.subject_lock_confidence ?? null;

    let matchedProfileId =
      analysis.matched_profile_id ?? session.detected_profile_id ?? null;
    let detectedExerciseName =
      analysis.exercise_class ?? session.detected_exercise_name ?? null;
    let needsConfirmation = analysis.needs_confirmation ?? false;
    const matchedProfileCandidate =
      presetCandidates.find((profile) => profile.id === matchedProfileId) ??
      (detectedExerciseName
        ? (presetCandidates.find(
            (profile) =>
              toCanonicalPoseExerciseHint(profile.canonical_name) ===
              toCanonicalPoseExerciseHint(detectedExerciseName),
          ) ?? null)
        : null);
    if (matchedProfileId && !matchedProfileCandidate) {
      matchedProfileId = null;
    }
    let movementContractResolution = matchedProfileCandidate
      ? await this.resolveAuthoritativeMovementContractResolution(
          null,
          detectedExerciseName ?? matchedProfileCandidate.canonical_name,
        )
      : null;
    let movementContract = movementContractResolution?.movementContract ?? null;

    if (
      !detectedExerciseName &&
      analysis.confidence >= poseContractConfidenceThreshold
    ) {
      detectedExerciseName =
        matchedProfileCandidate?.canonical_name ??
        analysis.candidate_exercises?.[0] ??
        null;
    }

    if (detectedExerciseName && !movementContractResolution) {
      movementContractResolution = matchedProfileCandidate
        ? await this.resolveAuthoritativeMovementContractResolution(
            null,
            matchedProfileCandidate.canonical_name,
          )
        : null;
      movementContract = movementContractResolution?.movementContract ?? null;
    }
    needsConfirmation = needsConfirmation || movementContract === null;

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
          : movementContract
            ? toPrismaJsonObject(toRepRulesJson(movementContract))
            : null,
        confidenceThreshold: analysis.confidence,
      });

      matchedProfileId = learnedProfile.id;
      detectedExerciseName = learnedProfile.canonical_name;
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
          toOptionalJsonObject(matchedProfileCandidate.landmark_signature) ??
            {},
        ),
        angleSignature: toPrismaJsonObject(
          toOptionalJsonObject(matchedProfileCandidate.angle_signature) ?? {},
        ),
        orientationSignature: toPrismaJsonObject(
          toOptionalJsonObject(matchedProfileCandidate.orientation_signature) ??
            {},
        ),
        movementPattern: toPrismaJsonObject(
          toOptionalJsonObject(matchedProfileCandidate.movement_pattern) ?? {},
        ),
        visibilityPattern: toPrismaJsonObject(
          toOptionalJsonObject(matchedProfileCandidate.visibility_pattern) ??
            {},
        ),
        dominantJoint:
          movementContract.dominant_joint ??
          matchedProfileCandidate.dominant_joint,
        tolerance: movementContract.rep_thresholds.down.tolerance,
        repThresholds: toPrismaJsonObject(
          toRepThresholdsJson(movementContract.rep_thresholds),
        ),
        repRules: toOptionalJsonObject(matchedProfileCandidate.rep_rules)
          ? toPrismaJsonObject(
              toOptionalJsonObject(matchedProfileCandidate.rep_rules) ?? {},
            )
          : toPrismaJsonObject(toRepRulesJson(movementContract)),
        confidenceThreshold: analysis.confidence,
      });

      matchedProfileId = backfilledProfile.id;
      detectedExerciseName = backfilledProfile.canonical_name;
    }

    const equipment = resolvePoseEquipment({
      declaredConfidence: dto.equipment_confidence,
      declaredContext: dto.equipment_context ?? null,
      declaredSource: dto.equipment_source ?? null,
      existingConflicts: dto.equipment_conflicts,
      labels: [
        detectedExerciseName,
        requestedExerciseHint,
        movementContract?.exercise,
        analysis.candidate_exercises?.[0],
      ],
    });
    const quality = assessPoseSessionQuality({
      averageConfidence: analysis.confidence,
      classificationConfidence: analysis.confidence,
      degradedReason: null,
      detectedExerciseName,
      equipmentConflicts: equipment.equipmentConflicts,
      fallbackUsed: false,
      frameCount: dto.frames.length,
      lowConfidenceLandmarks: dto.signals.visibility.low_confidence_landmarks,
      movementContract,
      needsConfirmation,
      reliableFrameCount: dto.signals.visibility.reliable_frame_count,
      subjectLockConfidence,
    });

    const persisted = await this.repo.updatePoseSessionAnalysis({
      poseSessionId: session.id,
      detectedExerciseName,
      detectedProfileId: matchedProfileId,
      classificationConfidence: analysis.confidence,
      subjectLockConfidence,
      analysisSummary: toPrismaJsonObject({
        camera_facing_mode: dto.camera_facing_mode ?? null,
        candidate_exercises: analysis.candidate_exercises ?? [],
        classification_source: analysis.classification_source ?? 'classifier',
        form_feedback: analysis.form_feedback ?? [],
        landmark_schema: dto.landmark_schema,
        movement_contract: movementContract,
        movement_contract_identity:
          movementContractResolution?.identity ?? null,
        needs_confirmation: needsConfirmation,
        phase,
        processing_mode: processingMode,
        producer_runtime: 'web',
        equipment_context: equipment.equipmentContext,
        equipment_source: equipment.equipmentSource,
        equipment_confidence: equipment.equipmentConfidence,
        equipment_conflicts: equipment.equipmentConflicts,
        frame_count: dto.frames.length,
        low_confidence_landmarks:
          dto.signals.visibility.low_confidence_landmarks,
        reliable_frame_count: dto.signals.visibility.reliable_frame_count,
        reliable_frame_ratio: quality.reliableFrameRatio,
        session_quality_state: quality.sessionQualityState,
        session_quality_reasons: quality.sessionQualityReasons,
        progression_disposition: quality.progressionDisposition,
        integrity_reason_codes: quality.integrityReasonCodes,
        review_recommended: quality.reviewRecommended,
        rep_count_delta: repCountDelta,
        rep_event: repEvent,
        subject_locked: subjectLocked,
      }),
    });

    return {
      pose_session_id: session.id,
      confidence: analysis.confidence,
      exercise_class: detectedExerciseName,
      matched_profile_id:
        matchedProfileId ?? persisted.detected_profile_id ?? null,
      subject_locked: subjectLocked,
      subject_lock_confidence: subjectLockConfidence,
      classification_source: analysis.classification_source ?? 'classifier',
      needs_confirmation: needsConfirmation,
      processing_mode: processingMode,
      rep_event: repEvent,
      rep_count_delta: repCountDelta,
      phase,
      candidate_exercises: analysis.candidate_exercises ?? [],
      form_feedback: analysis.form_feedback ?? [],
      movement_contract: movementContract,
      movement_contract_identity: movementContractResolution?.identity ?? null,
      session_quality_state: quality.sessionQualityState,
      session_quality_reasons: quality.sessionQualityReasons,
      reliable_frame_ratio: quality.reliableFrameRatio,
      progression_disposition: quality.progressionDisposition,
      integrity_reason_codes: quality.integrityReasonCodes,
      review_recommended: quality.reviewRecommended,
      equipment_context: equipment.equipmentContext,
      equipment_source: equipment.equipmentSource,
      equipment_confidence: equipment.equipmentConfidence,
      equipment_conflicts: equipment.equipmentConflicts,
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

    const existingSummary =
      toOptionalJsonObject(session.analysis_summary) ?? {};
    const finalizedSummary = this.buildFinalizedAnalysisSummary({
      existingSummary,
      averageConfidence:
        dto.average_confidence ??
        toDecimalNumber(session.confidence_avg) ??
        toDecimalNumber(session.classification_confidence),
      detectedExerciseName:
        dto.detected_exercise_name ?? session.detected_exercise_name ?? null,
      endedReason: dto.ended_reason ?? 'manual_stop',
      equipmentConfidence: dto.equipment_confidence ?? null,
      equipmentConflicts: dto.equipment_conflicts ?? [],
      equipmentContext: dto.equipment_context ?? null,
      equipmentSource: dto.equipment_source ?? null,
      finalRepCount: dto.final_rep_count,
      formFeedback: dto.form_feedback ?? [],
      movementContract: dto.movement_contract ?? null,
      rawAngleData: dto.raw_angle_data ?? [],
      classificationConfidence: toDecimalNumber(
        session.classification_confidence,
      ),
      subjectLockConfidence: toDecimalNumber(session.subject_lock_confidence),
      exerciseHint: session.exercise_hint ?? null,
      producerRuntime: this.resolveProducerRuntime(existingSummary),
      weightInputKg: dto.weight_input_kg ?? null,
    });
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
      analysisSummary: toPrismaJsonObject(finalizedSummary),
    });
    const sourceRevision = await this.repo.getNextPoseSourceRevision(
      persisted.id,
    );

    const response = toPoseSessionResponse(persisted);
    this.emitPoseSessionFinalized(
      this.toPoseSessionFinalizedEvent(
        persisted,
        finalizedSummary,
        dto.ended_reason ?? 'manual_stop',
        sourceRevision,
        undefined,
      ),
    );

    return response;
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
    endedReason: PoseSessionEndReason = 'client_disconnect',
  ): Promise<PoseSessionResponseDTO> {
    if (session.ended_at) {
      return toPoseSessionResponse(session);
    }

    const finalized = await this.aiClient.finalizePoseSession({
      poseSessionId: session.id,
    });
    const existingSummary =
      toOptionalJsonObject(session.analysis_summary) ?? {};
    const finalizedSummary = this.buildFinalizedAnalysisSummary({
      existingSummary,
      averageConfidence:
        finalized.analysis_summary.average_confidence ??
        toDecimalNumber(session.confidence_avg) ??
        this.toPoseConfidenceAverage(state),
      detectedExerciseName:
        finalized.detected_exercise_name ?? session.detected_exercise_name,
      endedReason,
      finalRepCount: finalized.analysis_summary.reps_detected,
      formFeedback: finalized.analysis_summary.form_feedback ?? [],
      movementContract: this.toMovementContractFromSummary(existingSummary),
      rawAngleData: [],
      classificationConfidence: finalized.classification_confidence,
      subjectLockConfidence: finalized.subject_lock_confidence,
      exerciseHint: session.exercise_hint ?? null,
      producerRuntime: this.resolveProducerRuntime(existingSummary),
      dominantJointAngles: finalized.analysis_summary.dominant_joint_angles,
    });
    const persisted = await this.repo.finalizePoseSession({
      poseSessionId: session.id,
      endedAt: new Date(),
      repCountAi: finalized.analysis_summary.reps_detected,
      confidenceAvg:
        finalized.analysis_summary.average_confidence ??
        this.toPoseConfidenceAverage(state),
      detectedExerciseName:
        finalized.detected_exercise_name ?? session.detected_exercise_name,
      detectedProfileId: finalized.matched_profile_id,
      classificationConfidence: finalized.classification_confidence,
      subjectLockConfidence: finalized.subject_lock_confidence,
      analysisSummary: toPrismaJsonObject(finalizedSummary),
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
    });
    const sourceRevision = await this.repo.getNextPoseSourceRevision(
      persisted.id,
    );
    const response = toPoseSessionResponse(persisted);
    this.emitPoseSessionFinalized(
      this.toPoseSessionFinalizedEvent(
        persisted,
        finalizedSummary,
        endedReason,
        sourceRevision,
        state,
      ),
    );

    return response;
  }

  private buildFinalizedAnalysisSummary(input: {
    averageConfidence: number | null;
    classificationConfidence: number | null;
    detectedExerciseName: string | null;
    dominantJointAngles?: Record<string, number>;
    endedReason: PoseSessionEndReason;
    equipmentConfidence?: number | null;
    equipmentConflicts?: string[];
    equipmentContext?: PoseEquipmentContext | null;
    equipmentSource?: PoseEquipmentSource | null;
    exerciseHint: string | null;
    existingSummary: Record<string, unknown>;
    finalRepCount: number;
    formFeedback: string[];
    movementContract: PoseMovementContractValue | null;
    producerRuntime: ProgressionProducerRuntime;
    rawAngleData: FinalizePoseSessionDTO['raw_angle_data'];
    subjectLockConfidence: number | null;
    weightInputKg?: number | null;
  }): Record<string, unknown> {
    const existingMovementContract = this.toMovementContractFromSummary(
      input.existingSummary,
    );
    const fallbackUsed = input.existingSummary.fallback_used === true;
    const degradedReason = toNullableString(
      input.existingSummary.degraded_reason,
    );
    const needsConfirmation = input.existingSummary.needs_confirmation === true;
    const reliableFrameCount = toOptionalNumber(
      input.existingSummary.reliable_frame_count,
    );
    const frameCount = toOptionalNumber(input.existingSummary.frame_count);
    const manualEntryPresent =
      input.rawAngleData.length > 0 || input.endedReason === 'manual_stop';
    const equipment = resolvePoseEquipment({
      declaredConfidence:
        input.equipmentConfidence ??
        toOptionalNumber(input.existingSummary.equipment_confidence),
      declaredContext:
        input.equipmentContext ??
        toPoseEquipmentContext(input.existingSummary.equipment_context),
      declaredSource:
        input.equipmentSource ??
        toPoseEquipmentSource(input.existingSummary.equipment_source),
      existingConflicts: [
        ...toStringArray(input.existingSummary.equipment_conflicts),
        ...(input.equipmentConflicts ?? []),
      ],
      labels: [
        input.detectedExerciseName,
        input.exerciseHint,
        input.movementContract?.exercise,
        existingMovementContract?.exercise,
      ],
    });
    const activeMovementContract =
      input.movementContract ?? existingMovementContract;
    const quality = assessPoseSessionQuality({
      averageConfidence: input.averageConfidence,
      classificationConfidence: input.classificationConfidence,
      degradedReason,
      detectedExerciseName: input.detectedExerciseName,
      equipmentConflicts: equipment.equipmentConflicts,
      fallbackUsed,
      finalRepCount: input.finalRepCount,
      frameCount,
      lowConfidenceLandmarks: toStringArray(
        input.existingSummary.low_confidence_landmarks,
      ),
      movementContract: activeMovementContract,
      needsConfirmation,
      reliableFrameCount,
      subjectLockConfidence: input.subjectLockConfidence,
    });
    const assessment = this.assessPoseTerminalState({
      averageConfidence: input.averageConfidence,
      classificationConfidence: input.classificationConfidence,
      degradedReason,
      detectedExerciseName: input.detectedExerciseName,
      equipmentConflicts: equipment.equipmentConflicts,
      fallbackUsed,
      finalRepCount: input.finalRepCount,
      integrityReasonCodes: quality.integrityReasonCodes,
      movementContract: activeMovementContract,
      needsConfirmation,
      progressionDisposition: quality.progressionDisposition,
      reliableFrameCount,
      sessionQualityReasons: quality.sessionQualityReasons,
      sessionQualityState: quality.sessionQualityState,
      subjectLockConfidence: input.subjectLockConfidence,
    });
    return {
      ...input.existingSummary,
      average_confidence: input.averageConfidence,
      classification_confidence: input.classificationConfidence,
      detected_exercise_name: input.detectedExerciseName,
      dominant_joint_angles:
        input.dominantJointAngles ??
        (isRecord(input.existingSummary.dominant_joint_angles)
          ? input.existingSummary.dominant_joint_angles
          : {}),
      eligibility_state: assessment.eligibilityState,
      ended_reason: input.endedReason,
      equipment_context: equipment.equipmentContext,
      equipment_source: equipment.equipmentSource,
      equipment_confidence: equipment.equipmentConfidence,
      equipment_conflicts: equipment.equipmentConflicts,
      exercise_hint: input.exerciseHint,
      fallback_used: fallbackUsed,
      final_rep_count: input.finalRepCount,
      form_feedback: input.formFeedback,
      integrity_markers: assessment.integrityMarkers,
      integrity_reason_codes: quality.integrityReasonCodes,
      integrity_state: assessment.integrityState,
      manual_entry_present: manualEntryPresent,
      movement_contract: activeMovementContract,
      producer_runtime: input.producerRuntime,
      progression_disposition: quality.progressionDisposition,
      raw_angle_data: input.rawAngleData,
      raw_angle_data_reference: 'embedded',
      reliable_frame_ratio: quality.reliableFrameRatio,
      reps_detected: input.finalRepCount,
      review_required_markers: assessment.reviewRequiredMarkers,
      review_recommended: quality.reviewRecommended,
      session_quality_state: quality.sessionQualityState,
      session_quality_reasons: quality.sessionQualityReasons,
      subject_lock_confidence: input.subjectLockConfidence,
      terminal_state: assessment.terminalState,
      weight_input_kg:
        input.weightInputKg ??
        toOptionalNumber(input.existingSummary.weight_input_kg),
    };
  }

  private assessPoseTerminalState(input: {
    averageConfidence: number | null;
    classificationConfidence: number | null;
    degradedReason: string | null;
    detectedExerciseName: string | null;
    equipmentConflicts: string[];
    fallbackUsed: boolean;
    finalRepCount: number;
    integrityReasonCodes: string[];
    movementContract: PoseMovementContractValue | null;
    needsConfirmation: boolean;
    progressionDisposition: PoseProgressionDisposition;
    reliableFrameCount: number | null;
    sessionQualityReasons: string[];
    sessionQualityState: PoseSessionQualityState;
    subjectLockConfidence: number | null;
  }): {
    eligibilityState: ProgressionSourceEligibilityState;
    integrityMarkers: string[];
    integrityState: ProgressionSourceIntegrityState;
    reviewRequiredMarkers: string[];
    terminalState: ProgressionSourceTerminalState;
  } {
    const reviewRequiredMarkers: string[] = [];

    if (input.needsConfirmation) {
      reviewRequiredMarkers.push('needs_confirmation');
    }
    if (input.fallbackUsed) {
      reviewRequiredMarkers.push('fallback_used');
    }
    if (input.degradedReason) {
      reviewRequiredMarkers.push('degraded_tracking');
    }
    if (
      input.classificationConfidence !== null &&
      input.classificationConfidence < poseContractConfidenceThreshold
    ) {
      reviewRequiredMarkers.push('low_classification_confidence');
    }
    if (input.averageConfidence !== null && input.averageConfidence < 0.65) {
      reviewRequiredMarkers.push('low_average_confidence');
    }
    if (
      input.reliableFrameCount !== null &&
      input.reliableFrameCount > 0 &&
      input.reliableFrameCount < 8
    ) {
      reviewRequiredMarkers.push('low_reliable_frame_count');
    }
    if (
      input.subjectLockConfidence !== null &&
      input.subjectLockConfidence < 0.6
    ) {
      reviewRequiredMarkers.push('weak_subject_lock');
    }
    if (!input.movementContract) {
      reviewRequiredMarkers.push('missing_movement_contract');
    }
    if (!input.detectedExerciseName) {
      reviewRequiredMarkers.push('unknown_exercise');
    }
    if (input.equipmentConflicts.length > 0) {
      reviewRequiredMarkers.push('equipment_context_conflict');
    }
    if (input.sessionQualityState !== 'stable') {
      reviewRequiredMarkers.push(
        `session_quality_${input.sessionQualityState}`,
      );
    }
    if (input.progressionDisposition !== 'normal') {
      reviewRequiredMarkers.push(
        `progression_disposition_${input.progressionDisposition}`,
      );
    }

    reviewRequiredMarkers.push(...input.sessionQualityReasons);
    reviewRequiredMarkers.push(...input.integrityReasonCodes);

    if (input.finalRepCount <= 0) {
      reviewRequiredMarkers.push('zero_rep_result');
    }

    const integrityMarkers = Array.from(new Set(reviewRequiredMarkers));

    if (input.finalRepCount <= 0) {
      return {
        terminalState: 'rejected',
        eligibilityState: 'blocked',
        integrityState: integrityMarkers.length > 0 ? 'suspicious' : 'clean',
        integrityMarkers,
        reviewRequiredMarkers,
      };
    }

    if (reviewRequiredMarkers.length > 0) {
      return {
        terminalState: 'flagged',
        eligibilityState: 'review_required',
        integrityState: 'suspicious',
        integrityMarkers,
        reviewRequiredMarkers,
      };
    }

    return {
      terminalState: 'accepted',
      eligibilityState: 'eligible',
      integrityState: 'clean',
      integrityMarkers,
      reviewRequiredMarkers,
    };
  }

  private resolveProducerRuntime(
    summary: Record<string, unknown>,
  ): ProgressionProducerRuntime {
    const runtime = toNullableString(summary.producer_runtime);

    if (
      runtime === 'web' ||
      runtime === 'ios_native' ||
      runtime === 'android_native' ||
      runtime === 'backend'
    ) {
      return runtime;
    }

    return 'web';
  }

  private toMovementContractFromSummary(
    summary: Record<string, unknown>,
  ): PoseMovementContractValue | null {
    const movementContract = summary.movement_contract;
    return isRecord(movementContract)
      ? (movementContract as unknown as PoseMovementContractValue)
      : null;
  }

  private toPoseSessionFinalizedEvent(
    session: PoseSessionDetailRecord,
    analysisSummary: Record<string, unknown>,
    endedReason: PoseSessionEndReason,
    sourceRevision: number,
    state?: PoseConnectionState,
  ): PoseSessionFinalizedEvent {
    const producerRuntime = this.resolveProducerRuntime(analysisSummary);
    const movementContract =
      this.toMovementContractFromSummary(analysisSummary);
    const finalRepCount =
      toOptionalNumber(analysisSummary.final_rep_count) ?? session.rep_count_ai;
    const formFeedback = toStringArray(analysisSummary.form_feedback);
    const rawAngleData = Array.isArray(analysisSummary.raw_angle_data)
      ? analysisSummary.raw_angle_data
      : [];
    const reviewRequiredMarkers = toStringArray(
      analysisSummary.review_required_markers,
    );
    const integrityMarkers = toStringArray(analysisSummary.integrity_markers);
    const cameraFacingMode = toNullableString(
      analysisSummary.camera_facing_mode,
    );
    const landmarkSchema = toNullableString(analysisSummary.landmark_schema);
    const endedAt = session.ended_at?.toISOString() ?? new Date().toISOString();
    const updatedAt = session.updated_at.toISOString();
    const terminalState = toNullableString(analysisSummary.terminal_state);
    const eligibilityState = toNullableString(
      analysisSummary.eligibility_state,
    );
    const integrityState = toNullableString(analysisSummary.integrity_state);
    const sessionQualityState =
      toPoseSessionQualityState(analysisSummary.session_quality_state) ??
      'stable';
    const progressionDisposition =
      toPoseProgressionDisposition(analysisSummary.progression_disposition) ??
      'normal';
    const equipmentContext = toPoseEquipmentContext(
      analysisSummary.equipment_context,
    );
    const equipmentSource = toPoseEquipmentSource(
      analysisSummary.equipment_source,
    );
    const equipmentConflicts = toStringArray(
      analysisSummary.equipment_conflicts,
    );
    const integrityReasonCodes = toStringArray(
      analysisSummary.integrity_reason_codes,
    );

    return {
      eventType: progressionSourceEventType,
      eventVersion: 1,
      sourceType: 'pose_session_finalized',
      sourceId: session.id,
      sourceRevision,
      idempotencyKey: `pose_session_finalized:${session.id}:${sourceRevision}`,
      userId: session.user_id,
      occurredAt: endedAt,
      recordedAt: updatedAt,
      startedAt: session.started_at.toISOString(),
      endedAt,
      terminalState:
        terminalState === 'accepted' ||
        terminalState === 'flagged' ||
        terminalState === 'rejected' ||
        terminalState === 'invalidated'
          ? terminalState
          : 'accepted',
      eligibilityState:
        eligibilityState === 'eligible' ||
        eligibilityState === 'blocked' ||
        eligibilityState === 'review_required'
          ? eligibilityState
          : 'eligible',
      integrityState:
        integrityState === 'clean' ||
        integrityState === 'suspicious' ||
        integrityState === 'corrected' ||
        integrityState === 'voided'
          ? integrityState
          : 'clean',
      producerSystem: 'pose-service',
      producerRuntime,
      producerContext: {
        appSurface: 'pose',
        producerVersion: 'batch7-v1',
        runtimeContext: {
          connectionMode: state ? 'socket' : 'manual_finalize',
          endedReason,
          subjectLockMode: state?.subjectLockMode ?? 'single_subject',
        },
      },
      correlation: {
        sessionId: session.exercise_log?.session_id ?? null,
        poseSessionId: session.id,
        poseSessionIds: [session.id],
        planId: null,
        exerciseLogIds: session.exercise_log_id
          ? [session.exercise_log_id]
          : [],
        linkedSourceIds: session.exercise_log?.session_id
          ? [`workout_session_completed:${session.exercise_log.session_id}`]
          : [],
      },
      detectionSummary: {
        exerciseHint: session.exercise_hint ?? null,
        detectedExerciseName: session.detected_exercise_name ?? null,
        candidateExercises: toStringArray(analysisSummary.candidate_exercises),
        classificationSource:
          toNullableString(analysisSummary.classification_source) ===
            'preset' ||
          toNullableString(analysisSummary.classification_source) ===
            'user_confirmed'
            ? (toNullableString(analysisSummary.classification_source) as
                | 'preset'
                | 'user_confirmed')
            : 'classifier',
        classificationConfidence:
          toOptionalNumber(analysisSummary.classification_confidence) ??
          toDecimalNumber(session.classification_confidence),
        averageConfidence:
          toOptionalNumber(analysisSummary.average_confidence) ??
          toDecimalNumber(session.confidence_avg),
        matchedProfileId: session.detected_profile_id ?? null,
        movementContractSnapshot: movementContract,
        equipmentContext,
        equipmentSource,
        equipmentConfidence: toOptionalNumber(
          analysisSummary.equipment_confidence,
        ),
        equipmentConflicts,
      },
      repEvidenceSummary: {
        finalRepCount,
        dominantJoint:
          movementContract?.dominant_joint ??
          toNullableString(analysisSummary.dominant_joint),
        oscillatingJoints: movementContract?.oscillating_joints ?? [],
        rawAngleDataCount: rawAngleData.length,
        rawAngleDataReference: 'embedded',
        formFeedback,
      },
      qualitySummary: {
        cameraFacingMode:
          cameraFacingMode === 'user' || cameraFacingMode === 'environment'
            ? cameraFacingMode
            : null,
        landmarkSchema:
          landmarkSchema === 'mediapipe_pose_v1' ? landmarkSchema : null,
        subjectLocked: toOptionalBoolean(analysisSummary.subject_locked),
        subjectLockConfidence:
          toOptionalNumber(analysisSummary.subject_lock_confidence) ??
          toDecimalNumber(session.subject_lock_confidence),
        reliableFrameCount: toOptionalNumber(
          analysisSummary.reliable_frame_count,
        ),
        reliableFrameRatio: toOptionalNumber(
          analysisSummary.reliable_frame_ratio,
        ),
        sessionQualityState,
        sessionQualityReasons: toStringArray(
          analysisSummary.session_quality_reasons,
        ),
        fallbackUsed: analysisSummary.fallback_used === true,
        degradedReason: toNullableString(analysisSummary.degraded_reason),
        integrityMarkers,
      },
      policyInputs: {
        weightInputKg: toOptionalNumber(analysisSummary.weight_input_kg),
        manualEntryPresent: analysisSummary.manual_entry_present === true,
        reviewRequiredMarkers,
        integrityReasonCodes,
        progressionDisposition,
        reviewRecommended: analysisSummary.review_recommended === true,
      },
    };
  }

  private emitPoseSessionFinalized(event: PoseSessionFinalizedEvent): void {
    this.eventEmitter.emit(POSE_SESSION_FINALIZED_EVENT, event);
  }

  private toPoseConfidenceAverage(
    state: PoseConnectionState | undefined,
  ): number | null {
    if (!state || state.confidenceSamples === 0) {
      return null;
    }

    return state.confidenceSum / state.confidenceSamples;
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
