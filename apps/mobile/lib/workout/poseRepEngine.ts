import type {
  ExerciseHandShapeProfileRecord,
  ExerciseGripProfileRecord,
  PoseEquipmentContext,
  PoseEquipmentSource,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  PoseRepAngleDataRecord,
  PoseSequenceSignalsRecord,
} from "@fittrack/types";
import {
  buildRepAngleData,
  toCanonicalPoseExerciseLabel,
} from "@fittrack/utils";

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
  handShapeProfile?: ExerciseHandShapeProfileRecord | null;
  keypointFrames?: PoseKeypointRecord[][] | null;
  keypoints?: PoseKeypointRecord[] | null;
  lowConfidenceLandmarks?: string[];
  signals?: PoseSequenceSignalsRecord | null;
};

const REQUIRED_STREAK = 2;
const MIN_REP_TRAVEL = 18;
const BICEP_CURL_MIN_REP_TRAVEL = 24;
const BICEP_CURL_MIN_REP_INTERVAL_MS = 800;
const BICEP_CURL_PEAK_REVERSAL_DELTA = 2;
const BICEP_CURL_PEAK_LIMIT = 128;
const BICEP_CURL_START_LIMIT = 136;
const BICEP_CURL_MIN_TORSO_SLOPE_DEG = 48;
const BICEP_CURL_MAX_HIP_Y_TRAVEL = 0.08;
const BICEP_CURL_MIN_SECONDARY_ARM_VISIBILITY = 0.18;
const BICEP_CURL_MIN_BILATERAL_ELBOW_AMPLITUDE = 12;
const BICEP_CURL_STRONG_SIDE_ELBOW_AMPLITUDE = 20;
const BICEP_CURL_MIN_BILATERAL_ELBOW_RATIO = 0.42;
const BICEP_CURL_PHASE_SYNC_TOLERANCE_MS = 950;
const BICEP_CURL_GRIP_RECENT_FRAME_LIMIT = 8;
const BICEP_CURL_GRIP_MIN_USABLE_FRAMES = 2;
const BICEP_CURL_GRIP_MAX_OPEN_FRAMES = 1;
const BICEP_CURL_GRIP_MAX_OPEN_RATIO = 0.25;
const DIP_BOTTOM_LIMIT = 122;
const DIP_MIN_REP_INTERVAL_MS = 850;
const DIP_MIN_REP_TRAVEL = 18;
const DIP_PEAK_LIMIT = 148;
const DEFAULT_MIN_REP_INTERVAL_MS = 850;
const PUSH_UP_BOTTOM_LIMIT = 150;
const PUSH_UP_MIN_REP_INTERVAL_MS = 850;
const PUSH_UP_MIN_REP_TRAVEL = 10;
const PUSH_UP_MIN_SECONDARY_ARM_VISIBILITY = 0.1;
const PUSH_UP_MIN_SECONDARY_ELBOW_AMPLITUDE = 1.2;
const PUSH_UP_MIN_SECONDARY_ELBOW_RATIO = 0.1;
const PUSH_UP_PEAK_REVERSAL_DELTA = 2;
const PUSH_UP_PEAK_LIMIT = 152;
const PUSH_UP_STRONG_SIDE_ELBOW_AMPLITUDE = 5;
const PUSH_UP_MAX_HIP_X_DRIFT = 0.26;
const PUSH_UP_MAX_TORSO_SLOPE_DEG = 92;
const PUSH_UP_PHASE_SYNC_TOLERANCE_MS = 900;
const PULL_UP_MIN_REP_INTERVAL_MS = 900;
const PULL_UP_MIN_REP_TRAVEL = 8;
const PULL_UP_PEAK_LIMIT = 135;
const PULL_UP_PEAK_REVERSAL_DELTA = 2;
const PULL_UP_START_LIMIT = 138;
const WEIGHTED_CURL_EQUIPMENT_CONTEXTS = new Set<PoseEquipmentContext>([
  "dumbbell",
  "barbell",
  "cable",
  "machine",
  "kettlebell",
  "band",
  "mixed",
]);

const DEFAULT_REQUIRED_CURL_GRIP_PROFILE: ExerciseGripProfileRecord = {
  maxOpenFrames: BICEP_CURL_GRIP_MAX_OPEN_FRAMES,
  maxOpenRatio: BICEP_CURL_GRIP_MAX_OPEN_RATIO,
  minUsableFrames: BICEP_CURL_GRIP_MIN_USABLE_FRAMES,
  recentFrameLimit: BICEP_CURL_GRIP_RECENT_FRAME_LIMIT,
  reliablePointMinVisibility: 0.08,
  required: true,
};

type GripSide = "left" | "right";

type GripIndexes = {
  elbow: number;
  index: number;
  pinky: number;
  thumb: number;
  wrist: number;
};

const CURL_GRIP_INDEXES: Record<GripSide, GripIndexes> = {
  left: { elbow: 13, index: 19, pinky: 17, thumb: 21, wrist: 15 },
  right: { elbow: 14, index: 20, pinky: 18, thumb: 22, wrist: 16 },
};

function getPointDistance(
  first: PoseKeypointRecord,
  second: PoseKeypointRecord,
) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function isReliableGripPoint(
  point: PoseKeypointRecord | undefined,
  minVisibility = DEFAULT_REQUIRED_CURL_GRIP_PROFILE.reliablePointMinVisibility,
): point is PoseKeypointRecord {
  return !!point && point.visibility >= minVisibility;
}

function isOpenPalmCurlGripCandidate(
  keypoints: PoseKeypointRecord[] | null | undefined,
  side: GripSide,
  minVisibility = DEFAULT_REQUIRED_CURL_GRIP_PROFILE.reliablePointMinVisibility,
) {
  const indexes = CURL_GRIP_INDEXES[side];
  const elbow = keypoints?.[indexes.elbow];
  const wrist = keypoints?.[indexes.wrist];
  const index = keypoints?.[indexes.index];
  const pinky = keypoints?.[indexes.pinky];
  const thumb = keypoints?.[indexes.thumb];

  const isReliable = (point: PoseKeypointRecord | undefined) =>
    isReliableGripPoint(point, minVisibility);

  if (!isReliable(elbow) || !isReliable(wrist)) {
    return false;
  }

  const forearmLength = Math.max(getPointDistance(elbow, wrist), 0.03);
  const forearmUnit = {
    x: (wrist.x - elbow.x) / forearmLength,
    y: (wrist.y - elbow.y) / forearmLength,
  };
  const visibleFingerTips = [index, pinky, thumb].filter(isReliable);
  if (visibleFingerTips.length < 2) {
    return false;
  }

  const toTip = visibleFingerTips.map((point) => ({
    x: point.x - wrist.x,
    y: point.y - wrist.y,
  }));
  const fingerDistances = visibleFingerTips.flatMap((first, firstIndex) =>
    visibleFingerTips
      .slice(firstIndex + 1)
      .map((second) => getPointDistance(first, second) / forearmLength),
  );
  const fingerSpread = Math.max(...fingerDistances, 0);
  const fingerReaches = visibleFingerTips.map(
    (point) => getPointDistance(point, wrist) / forearmLength,
  );
  const thumbReach = isReliable(thumb)
    ? getPointDistance(thumb, wrist) / forearmLength
    : 0;
  const thumbToIndex =
    isReliable(thumb) && isReliable(index)
      ? getPointDistance(thumb, index) / forearmLength
      : 0;
  const thumbToPinky =
    isReliable(thumb) && isReliable(pinky)
      ? getPointDistance(thumb, pinky) / forearmLength
      : 0;
  const normalizedForwardReach = Math.max(
    ...toTip.map((vector) =>
      Math.max(0, vector.x * forearmUnit.x + vector.y * forearmUnit.y) /
      forearmLength,
    ),
  );
  const normalizedSideSpread = Math.max(
    ...toTip.map((vector) =>
      Math.abs(vector.x * forearmUnit.y - vector.y * forearmUnit.x) /
      forearmLength,
    ),
  );
  const fingertipCluster = fingerSpread;

  const averageFingerReach =
    fingerReaches.reduce((sum, reach) => sum + reach, 0) /
    Math.max(fingerReaches.length, 1);
  const thumbPinchDistance =
    thumbToIndex > 0 && thumbToPinky > 0
      ? Math.min(thumbToIndex, thumbToPinky)
      : Math.max(thumbToIndex, thumbToPinky);
  const widePalm = fingerSpread >= 0.24 || fingertipCluster >= 0.34;
  const fingersProjectedAway =
    normalizedForwardReach >= 0.32 || averageFingerReach >= 0.38;
  const thumbNotPinched =
    thumbReach > 0 && (thumbPinchDistance >= 0.2 || thumbReach >= 0.34);
  const sidewaysPalm = normalizedSideSpread >= 0.24 && fingerSpread >= 0.2;

  return (
    sidewaysPalm ||
    (widePalm && fingersProjectedAway) ||
    (widePalm && thumbNotPinched) ||
    (fingersProjectedAway && thumbNotPinched && fingerSpread >= 0.22)
  );
}

function isUsableCurlGripFrame(
  keypoints: PoseKeypointRecord[] | null | undefined,
  side: GripSide,
  minVisibility = DEFAULT_REQUIRED_CURL_GRIP_PROFILE.reliablePointMinVisibility,
) {
  const indexes = CURL_GRIP_INDEXES[side];
  return (
    isReliableGripPoint(keypoints?.[indexes.elbow], minVisibility) &&
    isReliableGripPoint(keypoints?.[indexes.wrist], minVisibility) &&
    isReliableGripPoint(keypoints?.[indexes.index], minVisibility) &&
    isReliableGripPoint(keypoints?.[indexes.pinky], minVisibility) &&
    isReliableGripPoint(keypoints?.[indexes.thumb], minVisibility)
  );
}

function hasBilateralCurlGrip(
  keypoints: PoseKeypointRecord[] | null | undefined,
  keypointFrames?: PoseKeypointRecord[][] | null,
  handShapeProfile?: ExerciseHandShapeProfileRecord | null,
) {
  const grip = handShapeProfile?.grip ?? DEFAULT_REQUIRED_CURL_GRIP_PROFILE;
  if (!grip.required) return true;

  const recentFrames = [
    ...(keypointFrames ?? []),
    ...(keypoints ? [keypoints] : []),
  ].slice(-grip.recentFrameLimit);

  if (!recentFrames.length) return true;

  return (["left", "right"] as const).every((side) => {
    const openPalmFrames = recentFrames.filter((frame) =>
      isOpenPalmCurlGripCandidate(frame, side, grip.reliablePointMinVisibility),
    ).length;
    if (
      openPalmFrames > grip.maxOpenFrames &&
      openPalmFrames / recentFrames.length > grip.maxOpenRatio
    ) {
      return false;
    }

    const usableFrames = recentFrames.filter((frame) =>
      isUsableCurlGripFrame(frame, side, grip.reliablePointMinVisibility),
    );
    if (usableFrames.length < grip.minUsableFrames) {
      // A real dumbbell often occludes finger tips. Do not punish missing hand
      // details; visible open palms are blocked before this fallback.
      return true;
    }

    const usableOpenPalmFrames = usableFrames.filter((frame) =>
      isOpenPalmCurlGripCandidate(frame, side, grip.reliablePointMinVisibility),
    ).length;
    return (
      usableOpenPalmFrames <= grip.maxOpenFrames &&
      usableOpenPalmFrames / usableFrames.length <= grip.maxOpenRatio
    );
  });
}

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
      requiredStreak: 1,
    };
  }

  if (canonicalExercise === "dip") {
    return {
      minRepTravel: DIP_MIN_REP_TRAVEL,
      requiredStreak: 1,
    };
  }

  if (canonicalExercise === "pull_up") {
    return {
      minRepTravel: PULL_UP_MIN_REP_TRAVEL,
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
    const contractStartLimit =
      contract.repThresholds.down.angle + contract.repThresholds.down.tolerance;
    const contractPeakLimit =
      contract.repThresholds.up.angle - contract.repThresholds.up.tolerance;
    if (contractPeakLimit > contractStartLimit) {
      return {
        peakLimit: contractPeakLimit,
        progressDirection: "increase" as const,
        startLimit: contractStartLimit,
      };
    }
    return {
      peakLimit: PUSH_UP_PEAK_LIMIT,
      progressDirection: "increase" as const,
      startLimit: PUSH_UP_BOTTOM_LIMIT,
    };
  }

  if (canonicalExercise === "bicep_curl") {
    return {
      peakLimit: BICEP_CURL_PEAK_LIMIT,
      progressDirection: "decrease" as const,
      startLimit: BICEP_CURL_START_LIMIT,
    };
  }

  if (canonicalExercise === "dip") {
    return {
      peakLimit: Math.max(peakLimit, DIP_PEAK_LIMIT),
      progressDirection: "increase" as const,
      startLimit: Math.max(startLimit, DIP_BOTTOM_LIMIT),
    };
  }

  if (canonicalExercise === "pull_up") {
    return {
      peakLimit: PULL_UP_PEAK_LIMIT,
      progressDirection: "decrease" as const,
      startLimit: PULL_UP_START_LIMIT,
    };
  }

  return { peakLimit, progressDirection: "increase" as const, startLimit };
}

function getPeakContractionReversalDelta(contract: PoseMovementContractRecord) {
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

  if (canonicalExercise === "pull_up") {
    return PULL_UP_PEAK_REVERSAL_DELTA;
  }

  return 3;
}

function getMinimumRepIntervalMs(contract: PoseMovementContractRecord) {
  const canonicalExercise = toCanonicalPoseExerciseLabel(contract.exercise);

  if (canonicalExercise === "push_up") return PUSH_UP_MIN_REP_INTERVAL_MS;
  if (canonicalExercise === "bicep_curl") return BICEP_CURL_MIN_REP_INTERVAL_MS;
  if (canonicalExercise === "dip") return DIP_MIN_REP_INTERVAL_MS;
  if (canonicalExercise === "pull_up") return PULL_UP_MIN_REP_INTERVAL_MS;
  return DEFAULT_MIN_REP_INTERVAL_MS;
}

function hasRepCooldownElapsed(
  state: PoseRepEngineState,
  contract: PoseMovementContractRecord,
  timestamp: number,
) {
  if (state.lastRepCompletedAtMs === null) return true;
  return (
    timestamp - state.lastRepCompletedAtMs >= getMinimumRepIntervalMs(contract)
  );
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
    canonicalExercise === "dip" ||
    canonicalExercise === "pull_up"
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
    const leftArmVisibility =
      evidence.signals.visibility.leftArmVisibility ?? 0;
    const rightArmVisibility =
      evidence.signals.visibility.rightArmVisibility ?? 0;
    const leftElbowAmplitude =
      evidence.signals.temporal.amplitudes.left_elbow ?? 0;
    const rightElbowAmplitude =
      evidence.signals.temporal.amplitudes.right_elbow ?? 0;
    const weakestArmVisibility = Math.min(
      leftArmVisibility,
      rightArmVisibility,
    );
    const weakestElbowAmplitude = Math.min(
      leftElbowAmplitude,
      rightElbowAmplitude,
    );
    const strongestElbowAmplitude = Math.max(
      leftElbowAmplitude,
      rightElbowAmplitude,
    );
    const weakestArmRatio =
      strongestElbowAmplitude > 0
        ? weakestElbowAmplitude / strongestElbowAmplitude
        : 0;
    const areBothArmsVisible =
      weakestArmVisibility >= PUSH_UP_MIN_SECONDARY_ARM_VISIBILITY;
    if (
      areBothArmsVisible &&
      weakestElbowAmplitude < PUSH_UP_MIN_SECONDARY_ELBOW_AMPLITUDE
    ) {
      return "bilateral_arm_motion_unconfirmed";
    }
    if (
      areBothArmsVisible &&
      strongestElbowAmplitude >= PUSH_UP_STRONG_SIDE_ELBOW_AMPLITUDE &&
      (weakestElbowAmplitude < PUSH_UP_MIN_SECONDARY_ELBOW_AMPLITUDE ||
        weakestArmRatio < PUSH_UP_MIN_SECONDARY_ELBOW_RATIO)
    ) {
      return "bilateral_arm_motion_unconfirmed";
    }

    if (canonicalExercise === "push_up") {
      const orientation = evidence.signals.orientation;
      const spatial = contract.spatialRequirements;
      const maxTorsoSlope =
        spatial?.torsoSlopeMaxDeg ?? PUSH_UP_MAX_TORSO_SLOPE_DEG;
      const minTorsoSlope = spatial?.torsoSlopeMinDeg ?? 0;
      if (
        orientation.torsoSlopeDeg > maxTorsoSlope ||
        orientation.torsoSlopeDeg < minTorsoSlope
      ) {
        return "push_up_body_not_horizontal";
      }
    }
  }

  if (
    canonicalExercise === "bicep_curl" &&
    !WEIGHTED_CURL_EQUIPMENT_CONTEXTS.has(
      evidence.equipmentContext ?? "unknown",
    )
  ) {
    return "equipment_required";
  }

  if (canonicalExercise === "bicep_curl") {
    const leftArmVisibility =
      evidence.signals.visibility.leftArmVisibility ?? 0;
    const rightArmVisibility =
      evidence.signals.visibility.rightArmVisibility ?? 0;
    const leftElbowAmplitude =
      evidence.signals.temporal.amplitudes.left_elbow ?? 0;
    const rightElbowAmplitude =
      evidence.signals.temporal.amplitudes.right_elbow ?? 0;
    const weakestArmVisibility = Math.min(
      leftArmVisibility,
      rightArmVisibility,
    );
    const weakestElbowAmplitude = Math.min(
      leftElbowAmplitude,
      rightElbowAmplitude,
    );
    const strongestElbowAmplitude = Math.max(
      leftElbowAmplitude,
      rightElbowAmplitude,
    );
    const weakestArmRatio =
      strongestElbowAmplitude > 0
        ? weakestElbowAmplitude / strongestElbowAmplitude
        : 0;

    if (weakestArmVisibility < BICEP_CURL_MIN_SECONDARY_ARM_VISIBILITY) {
      return "bilateral_arm_motion_unconfirmed";
    }
    if (
      strongestElbowAmplitude >= BICEP_CURL_STRONG_SIDE_ELBOW_AMPLITUDE &&
      (weakestElbowAmplitude < BICEP_CURL_MIN_BILATERAL_ELBOW_AMPLITUDE ||
        weakestArmRatio < BICEP_CURL_MIN_BILATERAL_ELBOW_RATIO)
    ) {
      return "bilateral_arm_motion_unconfirmed";
    }
    if (
      typeof evidence.signals.temporal.phaseSyncMs === "number" &&
      evidence.signals.temporal.phaseSyncMs >
        BICEP_CURL_PHASE_SYNC_TOLERANCE_MS
    ) {
      return "left_right_phase_desync";
    }
    if (
      !hasBilateralCurlGrip(
        evidence.keypoints,
        evidence.keypointFrames,
        evidence.handShapeProfile,
      )
    ) {
      return "curl_grip_unconfirmed";
    }
    if (
      evidence.signals.orientation.torsoSlopeDeg <
      BICEP_CURL_MIN_TORSO_SLOPE_DEG
    ) {
      return "curl_torso_not_upright";
    }
    if (evidence.signals.hip.rangeY > BICEP_CURL_MAX_HIP_Y_TRAVEL) {
      return "hip_swing_over_tolerance";
    }
  }

  const spatial = contract.spatialRequirements;
  if (
    typeof spatial?.bodyYTravelMin === "number" &&
    Math.max(
      evidence.signals.hip.rangeY,
      evidence.signals.shoulder?.rangeY ?? 0,
    ) < spatial.bodyYTravelMin
  ) {
    return "body_y_travel_below_min";
  }
  if (
    typeof spatial?.hipYTravelMin === "number" &&
    evidence.signals.hip.rangeY < spatial.hipYTravelMin
  ) {
    return "body_y_travel_below_min";
  }
  if (
    typeof spatial?.shoulderYTravelMin === "number" &&
    (evidence.signals.shoulder?.rangeY ?? 0) < spatial.shoulderYTravelMin
  ) {
    return "shoulder_y_travel_below_min";
  }
  if (typeof spatial?.shoulderHipTravelMin === "number") {
    const shoulderHipTravel = Math.min(
      evidence.signals.hip.rangeY,
      evidence.signals.shoulder?.rangeY ?? 0,
    );
    if (shoulderHipTravel < spatial.shoulderHipTravelMin) {
      return "shoulder_hip_travel_below_min";
    }
  }
  if (
    typeof spatial?.wristAnchorDriftMax === "number" &&
    (evidence.signals.wrist?.maxRangeX ?? 0) > spatial.wristAnchorDriftMax
  ) {
    return "wrist_anchor_drift_over_max";
  }
  if (
    typeof spatial?.bodyXDriftMax === "number" &&
    typeof evidence.signals.hip.rangeX === "number" &&
    evidence.signals.hip.rangeX >
      (canonicalExercise === "push_up"
        ? Math.min(spatial.bodyXDriftMax, PUSH_UP_MAX_HIP_X_DRIFT)
        : spatial.bodyXDriftMax)
  ) {
    return "body_x_drift_over_max";
  }
  if (
    typeof spatial?.phaseSyncToleranceMs === "number" &&
    typeof evidence.signals.temporal.phaseSyncMs === "number" &&
    evidence.signals.temporal.phaseSyncMs >
      (canonicalExercise === "push_up"
        ? Math.min(
            spatial.phaseSyncToleranceMs,
            PUSH_UP_PHASE_SYNC_TOLERANCE_MS,
          )
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

  const { peakLimit, progressDirection, startLimit } =
    getRepAngleLimits(contract);
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
