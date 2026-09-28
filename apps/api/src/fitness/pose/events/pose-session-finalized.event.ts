import type {
  ProgressionProducerRuntime,
  ProgressionSourceCorrelation,
  ProgressionSourceEligibilityState,
  ProgressionSourceEventType,
  ProgressionSourceIntegrityState,
  ProgressionSourceProducerContext,
  ProgressionSourceTerminalState,
} from '../../progression-source.types';
import { progressionSourceEventType } from '../../progression-source.types';
import type {
  PoseCameraFacingMode,
  PoseClassificationSource,
  PoseEquipmentContext,
  PoseEquipmentSource,
  PoseLandmarkSchema,
  PoseMovementContractDTO,
  PoseProgressionDisposition,
  PoseSessionQualityState,
} from '../dto/pose.dto';

export const POSE_SESSION_FINALIZED_EVENT = 'fitness.pose-session.finalized';

export interface PoseSessionFinalizedEvent {
  correlation: ProgressionSourceCorrelation;
  detectionSummary: {
    averageConfidence: number | null;
    candidateExercises: string[];
    classificationConfidence: number | null;
    classificationSource: PoseClassificationSource;
    detectedExerciseName: string | null;
    exerciseHint: string | null;
    matchedProfileId: string | null;
    movementContractSnapshot: PoseMovementContractDTO | null;
    equipmentContext: PoseEquipmentContext | null;
    equipmentSource: PoseEquipmentSource | null;
    equipmentConfidence: number | null;
    equipmentConflicts: string[];
  };
  eligibilityState: ProgressionSourceEligibilityState;
  endedAt: string;
  eventType: ProgressionSourceEventType;
  eventVersion: number;
  idempotencyKey: string;
  integrityState: ProgressionSourceIntegrityState;
  occurredAt: string;
  policyInputs: {
    manualEntryPresent: boolean;
    reviewRequiredMarkers: string[];
    weightInputKg: number | null;
    integrityReasonCodes: string[];
    progressionDisposition: PoseProgressionDisposition;
    reviewRecommended: boolean;
  };
  producerContext: ProgressionSourceProducerContext;
  producerRuntime: ProgressionProducerRuntime;
  producerSystem: string;
  qualitySummary: {
    cameraFacingMode: PoseCameraFacingMode | null;
    degradedReason: string | null;
    fallbackUsed: boolean;
    integrityMarkers: string[];
    landmarkSchema: PoseLandmarkSchema | null;
    reliableFrameCount: number | null;
    reliableFrameRatio: number | null;
    sessionQualityReasons: string[];
    sessionQualityState: PoseSessionQualityState;
    subjectLockConfidence: number | null;
    subjectLocked: boolean | null;
  };
  recordedAt: string;
  repEvidenceSummary: {
    dominantJoint: string | null;
    finalRepCount: number;
    formFeedback: string[];
    oscillatingJoints: string[];
    rawAngleDataCount: number;
    rawAngleDataReference: 'embedded';
  };
  sourceId: string;
  sourceRevision: number;
  sourceType: 'pose_session_finalized';
  startedAt: string;
  terminalState: ProgressionSourceTerminalState;
  userId: string;
}

export const poseProgressionSourceEventType = progressionSourceEventType;
