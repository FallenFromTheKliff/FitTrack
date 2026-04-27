import type {
  PoseEquipmentContext,
  PoseEquipmentSource,
  PoseMovementContractRecord,
  PoseRepAngleDataRecord,
  PoseSequenceSignalsRecord,
} from "@fittrack/types";
import { buildRepAngleData, toCanonicalPoseExerciseLabel } from "@fittrack/utils";

export type PoseRepPhase = "primed" | "down" | "up";

export type PoseRepEngineState = {
  currentHighAngle: number | null;
  currentLowAngle: number | null;
  downStreak: number;
  lastRepCompletedAtMs: number | null;
  phase: PoseRepPhase;
  peakContractionPending: boolean;
  rawAngleData: PoseRepAngleDataRecord[];
  repCount: number;
  upStreak: number;
};

export type PoseRepEngineEvidence = {
  equipmentContext?: PoseEquipmentContext | null;
  equipmentSource?: PoseEquipmentSource | null;
  lowConfidenceLandmarks?: string[];
  signals?: PoseSequenceSignalsRecord | null;
};

const REQUIRED_STREAK = 2;
const MIN_REP_TRAVEL = 18;
const BICEP_CURL_MIN_REP_TRAVEL = 10;
const BICEP_CURL_MIN_REP_INTERVAL_MS = 700;
const BICEP_CURL_PEAK_REVERSAL_DELTA = 3;
const BICEP_CURL_PEAK_LIMIT = 128;
const BICEP_CURL_START_LIMIT = 132;
const DIP_BOTTOM_LIMIT = 100;
const DIP_MIN_REP_INTERVAL_MS = 900;
const DIP_MIN_REP_TRAVEL = 12;
const DIP_PEAK_LIMIT = 142;
const DEFAULT_MIN_REP_INTERVAL_MS = 850;
const PUSH_UP_BOTTOM_LIMIT = 145;
const PUSH_UP_MIN_REP_INTERVAL_MS = 1200;
const PUSH_UP_MIN_REP_TRAVEL = 12;
const PUSH_UP_MIN_SECONDARY_ARM_VISIBILITY = 0.12;
const PUSH_UP_MIN_SECONDARY_ELBOW_AMPLITUDE = 2.5;
const PUSH_UP_MIN_SECONDARY_ELBOW_RATIO = 0.2;
const PUSH_UP_PEAK_REVERSAL_DELTA = 3;
const PUSH_UP_PEAK_LIMIT = 158;
const PUSH_UP_STRONG_SIDE_ELBOW_AMPLITUDE = 8;
const PUSH_UP_MAX_HIP_X_DRIFT = 0.22;
const PUSH_UP_MAX_TORSO_SLOPE_DEG = 74;
const PUSH_UP_PHASE_SYNC_TOLERANCE_MS = 750;
const WEIGHTED_CURL_EQUIPMENT_CONTEXTS = new Set<PoseEquipmentContext>([
  "dumbbell",
  "barbell",
  "cable",
  "machine",
  "kettlebell",
  "band",
  "mixed",
]);

function getRepEngineThresholds(contract: PoseMovementContractRecord) {
  const canonicalExercise = toCanonicalPoseExerciseLabel(contract.exercise);

  if (canonicalExercise === "push_up") {
    return {
      minRepTravel: PUSH_UP_MIN_REP_TRAVEL,
      requiredStreak: 1,
    };
  }

  if (canonicalExercise === "bicep_curl") {
    return {
      minRepTravel: BICEP_CURL_MIN_REP_TRAVEL,
      requiredStreak: REQUIRED_STREAK,
    };
  }

  if (canonicalExercise === "dip") {
    return {
      minRepTravel: DIP_MIN_REP_TRAVEL,
      requiredStreak: 1,
    };
  }

  return {
    minRepTravel: MIN_REP_TRAVEL,
    requiredStreak: REQUIRED_STREAK,
  };
}

function getRepAngleLimits(contract: PoseMovementContractRecord) {
  const startLimit =
    contract.repThresholds.down.angle + contract.repThresholds.down.tolerance;
  const peakLimit =
    contract.repThresholds.up.angle - contract.repThresholds.up.tolerance;
  const canonicalExercise = toCanonicalPoseExerciseLabel(contract.exercise);

  if (canonicalExercise === "push_up") {
    return {
      peakLimit: Math.max(peakLimit, PUSH_UP_PEAK_LIMIT),
      progressDirection: "increase" as const,
      startLimit: Math.min(startLimit, PUSH_UP_BOTTOM_LIMIT),
    };
  }

  if (canonicalExercise === "bicep_curl") {
    return {
      peakLimit: Math.min(
        contract.repThresholds.up.angle + contract.repThresholds.up.tolerance,
        BICEP_CURL_PEAK_LIMIT,
      ),
      progressDirection: "decrease" as const,
      startLimit: Math.max(
        contract.repThresholds.down.angle - contract.repThresholds.down.tolerance,
        BICEP_CURL_START_LIMIT,
      ),
    };
  }

  if (canonicalExercise === "dip") {
    return {
      peakLimit: Math.max(peakLimit, DIP_PEAK_LIMIT),
      progressDirection: "increase" as const,
      startLimit: Math.max(startLimit, DIP_BOTTOM_LIMIT),
    };
  }

  return { peakLimit, progressDirection: "increase" as const, startLimit };
}

function getPeakContractionReversalDelta(
  contract: PoseMovementContractRecord,
) {
  const canonicalExercise = toCanonicalPoseExerciseLabel(contract.exercise);

  if (canonicalExercise === "push_up") {
    return PUSH_UP_PEAK_REVERSAL_DELTA;
  }

  if (canonicalExercise === "bicep_curl") {
    return BICEP_CURL_PEAK_REVERSAL_DELTA;
  }

  if (canonicalExercise === "dip") {
    return PUSH_UP_PEAK_REVERSAL_DELTA;
  }

  return 3;
}

function getMinimumRepIntervalMs(contract: PoseMovementContractRecord) {
  const canonicalExercise = toCanonicalPoseExerciseLabel(contract.exercise);

  if (canonicalExercise === "push_up") return PUSH_UP_MIN_REP_INTERVAL_MS;
  if (canonicalExercise === "bicep_curl") return BICEP_CURL_MIN_REP_INTERVAL_MS;
  if (canonicalExercise === "dip") return DIP_MIN_REP_INTERVAL_MS;
  return DEFAULT_MIN_REP_INTERVAL_MS;
}

function hasRepCooldownElapsed(
  state: PoseRepEngineState,
  contract: PoseMovementContractRecord,
  timestamp: number,
) {
  if (state.lastRepCompletedAtMs === null) return true;
  return timestamp - state.lastRepCompletedAtMs >= getMinimumRepIntervalMs(contract);
}

function resetCycleAfterRejectedRep(
  state: PoseRepEngineState,
  currentAngle: number,
) {
  return {
    ...state,
    currentHighAngle: currentAngle,
    currentLowAngle: currentAngle,
    downStreak: 0,
    phase: "primed" as const,
    peakContractionPending: false,
    upStreak: 0,
  };
}

function countsRepOnPeakArrival(contract: PoseMovementContractRecord) {
  const canonicalExercise = toCanonicalPoseExerciseLabel(contract.exercise);
  return (
    canonicalExercise === "push_up" ||
    canonicalExercise === "bicep_curl" ||
    canonicalExercise === "dip"
  );
}

function getPoseRepNoCountReason(
  contract: PoseMovementContractRecord,
  evidence?: PoseRepEngineEvidence,
) {
  if (!evidence?.signals) return null;

  const canonicalExercise = toCanonicalPoseExerciseLabel(contract.exercise);
  const lowConfidenceLandmarks = new Set(evidence.lowConfidenceLandmarks ?? []);
  if (
    canonicalExercise !== "push_up" &&
    contract.requiredSides === "both" &&
    contract.primaryJoints?.some((joint) => lowConfidenceLandmarks.has(joint))
  ) {
    return "one_arm_only";
  }

  if (canonicalExercise === "push_up" || canonicalExercise === "dip") {
    const leftArmVisibility = evidence.signals.visibility.leftArmVisibility ?? 0;
    const rightArmVisibility = evidence.signals.visibility.rightArmVisibility ?? 0;
    const leftElbowAmplitude = evidence.signals.temporal.amplitudes.left_elbow ?? 0;
    const rightElbowAmplitude = evidence.signals.temporal.amplitudes.right_elbow ?? 0;
    const weakestArmVisibility = Math.min(leftArmVisibility, rightArmVisibility);
    const weakestElbowAmplitude = Math.min(leftElbowAmplitude, rightElbowAmplitude);
    const strongestElbowAmplitude = Math.max(leftElbowAmplitude, rightElbowAmplitude);
    const weakestArmRatio =
      strongestElbowAmplitude > 0
        ? weakestElbowAmplitude / strongestElbowAmplitude
        : 0;
    if (
      weakestArmVisibility < PUSH_UP_MIN_SECONDARY_ARM_VISIBILITY &&
      weakestElbowAmplitude < PUSH_UP_MIN_SECONDARY_ELBOW_AMPLITUDE
    ) {
      return "bilateral_arm_motion_unconfirmed";
    }
    if (
      strongestElbowAmplitude >= PUSH_UP_STRONG_SIDE_ELBOW_AMPLITUDE &&
      (weakestElbowAmplitude < PUSH_UP_MIN_SECONDARY_ELBOW_AMPLITUDE ||
        weakestArmRatio < PUSH_UP_MIN_SECONDARY_ELBOW_RATIO)
    ) {
      return "bilateral_arm_motion_unconfirmed";
    }

    if (canonicalExercise === "push_up") {
      const orientation = evidence.signals.orientation;
      if (orientation.torsoSlopeDeg > PUSH_UP_MAX_TORSO_SLOPE_DEG) {
        return "push_up_body_not_horizontal";
      }
    }
  }

  if (
    canonicalExercise === "bicep_curl" &&
    !WEIGHTED_CURL_EQUIPMENT_CONTEXTS.has(evidence.equipmentContext ?? "unknown")
  ) {
    return "equipment_required";
  }

  const spatial = contract.spatialRequirements;
  if (
    canonicalExercise !== "push_up" &&
    typeof spatial?.bodyYTravelMin === "number" &&
    evidence.signals.hip.rangeY < spatial.bodyYTravelMin
  ) {
    return "body_y_travel_below_min";
  }
  if (
    typeof spatial?.bodyXDriftMax === "number" &&
    typeof evidence.signals.hip.rangeX === "number" &&
    evidence.signals.hip.rangeX >
      (canonicalExercise === "push_up"
        ? Math.max(spatial.bodyXDriftMax, PUSH_UP_MAX_HIP_X_DRIFT)
        : spatial.bodyXDriftMax)
  ) {
    return "body_x_drift_over_max";
  }
  if (
    typeof spatial?.phaseSyncToleranceMs === "number" &&
    typeof evidence.signals.temporal.phaseSyncMs === "number" &&
    evidence.signals.temporal.phaseSyncMs >
      (canonicalExercise === "push_up"
        ? Math.max(spatial.phaseSyncToleranceMs, PUSH_UP_PHASE_SYNC_TOLERANCE_MS)
        : spatial.phaseSyncToleranceMs)
  ) {
    return "left_right_phase_desync";
  }

  return null;
}

export function createPoseRepEngineState(): PoseRepEngineState {
  return {
    currentHighAngle: null,
    currentLowAngle: null,
    downStreak: 0,
    lastRepCompletedAtMs: null,
    phase: "primed",
    peakContractionPending: false,
    rawAngleData: [],
    repCount: 0,
    upStreak: 0,
  };
}

export function stepPoseRepEngine(
  state: PoseRepEngineState,
  contract: PoseMovementContractRecord,
  currentAngle: number | null,
  timestamp: number,
  evidence?: PoseRepEngineEvidence,
): {
  nextState: PoseRepEngineState;
  repCompleted: boolean;
  noCountReason: string | null;
} {
  if (currentAngle === null || !Number.isFinite(currentAngle)) {
    return {
      nextState: state,
      noCountReason: "unavailable_primary_angle",
      repCompleted: false,
    };
  }

  const noCountReason = getPoseRepNoCountReason(contract, evidence);
  if (noCountReason) {
    return {
      nextState: {
        ...state,
        downStreak: 0,
        peakContractionPending: false,
        upStreak: 0,
      },
      noCountReason,
      repCompleted: false,
    };
  }

  const { peakLimit, progressDirection, startLimit } = getRepAngleLimits(contract);
  const { minRepTravel, requiredStreak } = getRepEngineThresholds(contract);
  const peakContractionReversalDelta =
    getPeakContractionReversalDelta(contract);
  const nextState: PoseRepEngineState = {
    ...state,
    currentHighAngle:
      state.currentHighAngle === null
        ? currentAngle
        : Math.max(state.currentHighAngle, currentAngle),
    currentLowAngle:
      state.currentLowAngle === null
        ? currentAngle
        : Math.min(state.currentLowAngle, currentAngle),
  };

  const isAtStart =
    progressDirection === "increase"
      ? currentAngle <= startLimit
      : currentAngle >= startLimit;
  const isAtPeak =
    progressDirection === "increase"
      ? currentAngle >= peakLimit
      : currentAngle <= peakLimit;

  if (isAtStart) {
    nextState.downStreak += 1;
  } else {
    nextState.downStreak = 0;
  }

  if (nextState.phase !== "down" && nextState.downStreak >= requiredStreak) {
    nextState.phase = "down";
    nextState.peakContractionPending = false;
    nextState.upStreak = 0;
    nextState.currentLowAngle = currentAngle;
    nextState.currentHighAngle = currentAngle;
    return {
      nextState,
      noCountReason: null,
      repCompleted: false,
    };
  }

  if (nextState.phase === "down") {
    if (isAtPeak) {
      nextState.upStreak += 1;
    } else if (isAtStart) {
      nextState.upStreak = 0;
    }

    const travel =
      (nextState.currentHighAngle ?? currentAngle) -
      (nextState.currentLowAngle ?? currentAngle);
    if (
      nextState.upStreak >= requiredStreak &&
      travel >= minRepTravel &&
      !nextState.peakContractionPending
    ) {
      if (countsRepOnPeakArrival(contract)) {
        if (!hasRepCooldownElapsed(nextState, contract, timestamp)) {
          return {
            nextState: resetCycleAfterRejectedRep(nextState, currentAngle),
            noCountReason: "rep_cooldown_active",
            repCompleted: false,
          };
        }

        const repNumber = nextState.repCount + 1;
        const repLowAngle = nextState.currentLowAngle ?? currentAngle;
        const repHighAngle = nextState.currentHighAngle ?? currentAngle;
        nextState.repCount = repNumber;
        nextState.lastRepCompletedAtMs = timestamp;
        nextState.phase = "primed";
        nextState.downStreak = 0;
        nextState.peakContractionPending = false;
        nextState.upStreak = 0;
        nextState.rawAngleData = [
          ...nextState.rawAngleData,
          buildRepAngleData(
            repNumber,
            contract.dominantJoint,
            repLowAngle,
            repHighAngle,
            timestamp,
          ),
        ];
        nextState.currentLowAngle = currentAngle;
        nextState.currentHighAngle = currentAngle;
        return {
          nextState,
          noCountReason: null,
          repCompleted: true,
        };
      }

      nextState.phase = "up";
      nextState.peakContractionPending = true;
      return {
        nextState,
        noCountReason: null,
        repCompleted: false,
      };
    }
  }

  if (nextState.phase === "up") {
    const peakAngle =
      progressDirection === "increase"
        ? (nextState.currentHighAngle ?? currentAngle)
        : (nextState.currentLowAngle ?? currentAngle);
    const peakReversalDetected =
      progressDirection === "increase"
        ? currentAngle <= peakAngle - peakContractionReversalDelta
        : currentAngle >= peakAngle + peakContractionReversalDelta;

    if (nextState.peakContractionPending && peakReversalDetected) {
      if (!hasRepCooldownElapsed(nextState, contract, timestamp)) {
        return {
          nextState: resetCycleAfterRejectedRep(nextState, currentAngle),
          noCountReason: "rep_cooldown_active",
          repCompleted: false,
        };
      }

      const repNumber = nextState.repCount + 1;
      const repLowAngle = nextState.currentLowAngle ?? currentAngle;
      const repHighAngle = nextState.currentHighAngle ?? currentAngle;
      nextState.repCount = repNumber;
      nextState.lastRepCompletedAtMs = timestamp;
      nextState.phase = "primed";
      nextState.downStreak = 0;
      nextState.peakContractionPending = false;
      nextState.upStreak = 0;
      nextState.rawAngleData = [
        ...nextState.rawAngleData,
        buildRepAngleData(
          repNumber,
          contract.dominantJoint,
          repLowAngle,
          repHighAngle,
          timestamp,
        ),
      ];
      nextState.currentLowAngle = currentAngle;
      nextState.currentHighAngle = currentAngle;
      return {
        nextState,
        noCountReason: null,
        repCompleted: true,
      };
    }

    if (
      !nextState.peakContractionPending &&
      (progressDirection === "increase"
        ? currentAngle < peakLimit
        : currentAngle > peakLimit)
    ) {
      nextState.phase = "primed";
    }
  }

  return {
    nextState,
    noCountReason: null,
    repCompleted: false,
  };
}
