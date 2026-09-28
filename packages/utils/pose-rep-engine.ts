import type {
  ExerciseHandShapeProfileRecord,
  ExerciseRigRecord,
  PoseEquipmentContext,
  PoseEquipmentSource,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  PoseRepAngleDataRecord,
  PoseSequenceSignalsRecord,
} from "@fittrack/types";

import {
  buildRepAngleData,
  getPoseMovementContractSideAngles,
  getPoseMovementFrameAssessment,
  getPoseMovementPostureReason,
  normalizePoseMovementContract,
  validatePoseMovementContract,
} from "./pose";
import type { PoseCoordinateDimensions } from "./pose";
import { getPoseFrameGeometry, getRigFingerprint, getRigMovementContract, getRigUpperArmPhaseMatch } from "./pose-rig";
import {
  POSE_REP_ENDPOINT_STREAK,
  POSE_REP_NOISE_FLOOR_DEGREES,
  getPoseRepAcceptancePolicy,
  getPoseRepContractFingerprint,
  type PoseRepAcceptancePolicy,
} from "./pose-rep-policy";

export type PoseRepPhase = "primed" | "down" | "up" | "hold";
type PoseSide = "left" | "right";

type PoseSideEndpoint = {
  start: { streak: number; startedAtMs: number | null };
  target: { streak: number; startedAtMs: number | null };
  return: { streak: number; startedAtMs: number | null };
};

type PoseSideEndpointState = {
  left: PoseSideEndpoint;
  right: PoseSideEndpoint;
};

type PoseCycleSideRange = {
  hipXMin: number | null;
  hipXMax: number | null;
  hipYMin: number | null;
  hipYMax: number | null;
  shoulderYMin: number | null;
  shoulderYMax: number | null;
  wristXMin: number | null;
  wristXMax: number | null;
};

type PoseCycleSideRanges = {
  left: PoseCycleSideRange;
  right: PoseCycleSideRange;
};

type PoseCycleSideAngleRange = {
  min: number | null;
  max: number | null;
};

type PoseCycleSideAngleRanges = {
  left: PoseCycleSideAngleRange;
  right: PoseCycleSideAngleRange;
};

type PoseSideStartSnapshot = {
  angle: number;
  capturedAtMs: number;
  keypoints: PoseKeypointRecord[] | null;
};

type PoseSideStartSnapshots = {
  left: PoseSideStartSnapshot | null;
  right: PoseSideStartSnapshot | null;
};

export type PoseRepEngineState = {
  currentHighAngle: number | null;
  currentLowAngle: number | null;
  downStreak: number;
  holdCompleted: boolean;
  holdInvalidSinceMs: number | null;
  holdLastValidAtMs: number | null;
  holdStartedAtMs: number | null;
  holdValidMs: number;
  lastRepCompletedAtMs: number | null;
  lastProcessedAtMs?: number | null;
  phase: PoseRepPhase;
  peakContractionPending: boolean;
  rawAngleData: PoseRepAngleDataRecord[];
  repCount: number;
  upStreak: number;

  /** Internal cycle evidence. Optional keeps persisted/older state compatible. */
  cycleStartedAtMs?: number | null;
  cycleBodyScale?: number | null;
  cycleStartEndpointAtMs?: number | null;
  cycleTargetEndpointAtMs?: number | null;
  cycleReturnEndpointAtMs?: number | null;
  cycleMinHipY?: number | null;
  cycleMaxHipY?: number | null;
  cycleMinShoulderY?: number | null;
  cycleMaxShoulderY?: number | null;
  cycleMinHipX?: number | null;
  cycleMaxHipX?: number | null;
  cycleMinWristX?: number | null;
  cycleMaxWristX?: number | null;
  cycleHalfCounted?: boolean;
  cycleDepartedStart?: boolean;
  cycleTargetObserved?: boolean;
  selectedSide?: PoseSide | null;
  alternatingExpectedSide?: PoseSide | null;
  alternatingCycleSide?: PoseSide | null;
  /** Per-side endpoint evidence for bilateral and alternating contracts. */
  sideEndpointState?: PoseSideEndpointState | null;
  cycleSideRanges?: PoseCycleSideRanges | null;
  cycleSideAngleRanges?: PoseCycleSideAngleRanges | null;
  alternatingStartSnapshots?: PoseSideStartSnapshots | null;
  /** Prevents stale cycle evidence when a caller changes contract in place. */
  contractFingerprint?: string | null;
};

export type PoseRepEngineEvidence = {
  rig?: ExerciseRigRecord | null;
  spatialKeypoints?: PoseKeypointRecord[];
  /** Kept for adapter compatibility; it never bypasses contract gates. */
  exerciseDeclared?: boolean;
  coordinateDimensions?: PoseCoordinateDimensions;
  equipmentContext?: PoseEquipmentContext | null;
  equipmentSource?: PoseEquipmentSource | null;
  handShapeProfile?: ExerciseHandShapeProfileRecord | null;
  keypointFrames?: PoseKeypointRecord[][] | null;
  keypoints?: PoseKeypointRecord[] | null;
  lowConfidenceLandmarks?: string[];
  signals?: PoseSequenceSignalsRecord | null;
};

type RepStepResult = {
  nextState: PoseRepEngineState;
  repCompleted: boolean;
  noCountReason: string | null;
};

const INVALID_TIMESTAMP_REASON = "invalid_timestamp";
const FRAME_GAP_REASON = "frame_gap_exceeded";
const MINIMUM_TRAVEL_REASON = "rep_travel_below_contract";
const CYCLE_DURATION_REASON = "cycle_duration_below_minimum";
const SIDE_UNAVAILABLE_REASON = "required_side_unavailable";
const SIDE_SYMMETRY_REASON = "side_symmetry_over_tolerance";
const ALTERNATING_ORDER_REASON = "alternating_side_out_of_order";
const ALTERNATING_SIMULTANEOUS_REASON = "alternating_simultaneous_sides";
const MISSING_EVIDENCE_REASON = "missing_evidence";
const STATIC_HOLD_INVALID_RESET_MS = 1200;
const STATIC_HOLD_MAX_FRAME_DELTA_MS = 500;

function createSideEndpoint(): PoseSideEndpoint {
  return {
    start: { streak: 0, startedAtMs: null },
    target: { streak: 0, startedAtMs: null },
    return: { streak: 0, startedAtMs: null },
  };
}

function createSideEndpointState(): PoseSideEndpointState {
  return { left: createSideEndpoint(), right: createSideEndpoint() };
}

function createCycleSideRange(): PoseCycleSideRange {
  return {
    hipXMin: null,
    hipXMax: null,
    hipYMin: null,
    hipYMax: null,
    shoulderYMin: null,
    shoulderYMax: null,
    wristXMin: null,
    wristXMax: null,
  };
}

function createCycleSideRanges(): PoseCycleSideRanges {
  return { left: createCycleSideRange(), right: createCycleSideRange() };
}

function createCycleSideAngleRanges(): PoseCycleSideAngleRanges {
  return {
    left: { min: null, max: null },
    right: { min: null, max: null },
  };
}

function clonePoseKeypoints(
  keypoints: PoseKeypointRecord[] | null | undefined,
): PoseKeypointRecord[] | null {
  return keypoints?.map((point) => ({ ...point })) ?? null;
}

function captureStableStartSnapshots(
  previous: PoseSideStartSnapshots | null | undefined,
  sideEndpointState: PoseSideEndpointState,
  sideAngles: { left: number | null; right: number | null },
  keypoints: PoseKeypointRecord[] | null | undefined,
  timestamp: number,
  policy: PoseRepAcceptancePolicy,
  canCapture: (side: PoseSide) => boolean,
): PoseSideStartSnapshots {
  const next: PoseSideStartSnapshots = {
    left: previous?.left ?? null,
    right: previous?.right ?? null,
  };
  ( ["left", "right"] as const).forEach((side) => {
    const endpoint = sideEndpointState[side].start;
    const angle = sideAngles[side];
    if (!canCapture(side)) {
      next[side] = null;
      return;
    }
    if (
      endpoint.streak >= policy.endpointStreak &&
      typeof endpoint.startedAtMs === "number" &&
      timestamp - endpoint.startedAtMs >= policy.endpointSpanMs &&
      isFiniteAngle(angle) &&
      isAtStartEndpoint(angle, policy)
    ) {
      next[side] = {
        angle,
        capturedAtMs: timestamp,
        keypoints: clonePoseKeypoints(keypoints),
      };
    }
  });
  return next;
}

function resetCycle(
  state: PoseRepEngineState,
  options: {
    preserveLastProcessedAtMs?: number | null;
    selectedSide?: PoseSide | null;
    alternatingCycleSide?: PoseSide | null;
  } = {},
): PoseRepEngineState {
  return {
    ...state,
    currentHighAngle: null,
    currentLowAngle: null,
    downStreak: 0,
    phase: "primed",
    peakContractionPending: false,
    upStreak: 0,
    cycleStartedAtMs: null,
    cycleBodyScale: null,
    cycleStartEndpointAtMs: null,
    cycleTargetEndpointAtMs: null,
    cycleReturnEndpointAtMs: null,
    cycleMinHipY: null,
    cycleMaxHipY: null,
    cycleMinShoulderY: null,
    cycleMaxShoulderY: null,
    cycleMinHipX: null,
    cycleMaxHipX: null,
    cycleMinWristX: null,
    cycleMaxWristX: null,
    cycleHalfCounted: false,
    cycleDepartedStart: false,
    cycleTargetObserved: false,
    cycleSideRanges: null,
    cycleSideAngleRanges: null,
    selectedSide:
      options.selectedSide !== undefined ? options.selectedSide : null,
    alternatingCycleSide:
      options.alternatingCycleSide !== undefined
        ? options.alternatingCycleSide
        : null,
    sideEndpointState: null,
    alternatingStartSnapshots: null,
    lastProcessedAtMs:
      options.preserveLastProcessedAtMs === undefined
        ? state.lastProcessedAtMs
        : options.preserveLastProcessedAtMs,
  };
}

function resetPartialAtTimestamp(
  state: PoseRepEngineState,
  timestamp: number,
): PoseRepEngineState {
  return resetCycle(state, { preserveLastProcessedAtMs: timestamp });
}

function isFiniteTimestamp(timestamp: number): boolean {
  return Number.isFinite(timestamp);
}

function isFiniteAngle(angle: number | null): angle is number {
  return typeof angle === "number" && Number.isFinite(angle);
}

function isWithinBand(
  angle: number,
  band: { min: number; max: number },
): boolean {
  return angle >= band.min && angle <= band.max;
}

function isAtStartEndpoint(
  angle: number,
  policy: PoseRepAcceptancePolicy,
) {
  return policy.direction === "decrease"
    ? angle >= policy.startBand.min
    : angle <= policy.startBand.max;
}

function isAtTargetEndpoint(
  angle: number,
  policy: PoseRepAcceptancePolicy,
) {
  return policy.direction === "decrease"
    ? angle <= policy.targetBand.max
    : angle >= policy.targetBand.min;
}

function isDepartingStartEndpoint(
  angle: number,
  policy: PoseRepAcceptancePolicy,
) {
  return policy.direction === "decrease"
    ? angle < policy.startBand.min
    : angle > policy.startBand.max;
}

function updateSideEndpoint(
  side: PoseSideEndpoint,
  stage: "start" | "target" | "return",
  inEndpoint: boolean,
  timestamp: number,
  requiredStreak: number,
  requiredSpanMs: number,
): PoseSideEndpoint {
  const current = side[stage];
  const updated = updateStableEndpoint(
    current.streak,
    current.startedAtMs,
    inEndpoint,
    timestamp,
    requiredStreak,
    requiredSpanMs,
  );
  return { ...side, [stage]: updated };
}

function updateSideEndpoints(
  state: PoseSideEndpointState | null | undefined,
  sideAngles: { left: number | null; right: number | null } | null,
  stage: "start" | "target" | "return",
  policy: PoseRepAcceptancePolicy,
  timestamp: number,
  referenceMatches?: {left:boolean;right:boolean},
): PoseSideEndpointState {
  const previous = state ?? createSideEndpointState();
  const next = { ...previous };
  ( ["left", "right"] as const).forEach((side) => {
    const angle = sideAngles?.[side] ?? null;
    next[side] = updateSideEndpoint(
      previous[side],
      stage,
      isFiniteAngle(angle) && referenceMatches?.[side] !== false &&
        (stage === "target"
          ? isAtTargetEndpoint(angle, policy)
          : isAtStartEndpoint(angle, policy)),
      timestamp,
      policy.endpointStreak,
      policy.endpointSpanMs,
    );
  });
  return next;
}

function sideEndpointStable(
  side: PoseSideEndpointState,
  stage: "start" | "target" | "return",
) {
  const left = side.left[stage];
  const right = side.right[stage];
  return (
    left.streak >= POSE_REP_ENDPOINT_STREAK &&
    right.streak >= POSE_REP_ENDPOINT_STREAK &&
    typeof left.startedAtMs === "number" &&
    typeof right.startedAtMs === "number"
  );
}

function sidePhaseSyncReason(
  side: PoseSideEndpointState,
  stage: "target" | "return",
  toleranceMs: number | null | undefined,
) {
  if (typeof toleranceMs !== "number") return null;
  if (!sideEndpointStable(side, stage)) return null;
  const left = side.left[stage].startedAtMs as number;
  const right = side.right[stage].startedAtMs as number;
  return Math.abs(left - right) > toleranceMs
    ? "left_right_phase_desync"
    : null;
}

function updateStableEndpoint(
  streak: number,
  startedAtMs: number | null | undefined,
  isInBand: boolean,
  timestamp: number,
  requiredStreak: number,
  requiredSpanMs: number,
) {
  if (!isInBand) {
    return { streak: 0, startedAtMs: null, stable: false };
  }
  const nextStreak = streak + 1;
  const nextStartedAtMs =
    streak > 0 && typeof startedAtMs === "number"
      ? startedAtMs
      : timestamp;
  return {
    streak: nextStreak,
    startedAtMs: nextStartedAtMs,
    stable:
      nextStreak >= requiredStreak &&
      timestamp - nextStartedAtMs >= requiredSpanMs,
  };
}

function averageVisiblePoint(
  keypoints: PoseKeypointRecord[] | null | undefined,
  indexes: readonly number[],
  minVisibility = 0.5,
): { x: number; y: number } | null {
  const visible = indexes
    .map((index) => keypoints?.[index])
    .filter(
      (point): point is PoseKeypointRecord =>
        !!point &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(point.visibility) &&
        point.visibility >= minVisibility,
    );
  if (!visible.length) return null;
  return {
    x: visible.reduce((sum, point) => sum + point.x, 0) / visible.length,
    y: visible.reduce((sum, point) => sum + point.y, 0) / visible.length,
  };
}

function updateCyclePointRanges(
  state: PoseRepEngineState,
  keypoints: PoseKeypointRecord[] | null | undefined,
  contract?: PoseMovementContractRecord,
  dimensions?: PoseCoordinateDimensions,
  rig?: ExerciseRigRecord | null,
): PoseRepEngineState {
  if (!keypoints) return state;
  const minVisibility =
    contract?.trackingRequirements?.minConfidence ?? 0.5;
  const aspect = rig && dimensions && dimensions.height > 0 ? dimensions.width / dimensions.height : 1;
  const torsoLengths = ([0, 1] as const).map(offset => {
    const shoulder = keypoints![11 + offset], hip = keypoints![23 + offset];
    return shoulder && hip && shoulder.visibility >= minVisibility && hip.visibility >= minVisibility
      ? Math.hypot((shoulder.x - hip.x) * aspect, shoulder.y - hip.y) : 0;
  }).filter(length => length > 1e-4);
  const reference = rig?.keyframes.find(frame => frame.kind === "start")?.keypoints;
  const referenceLengths = reference ? ([0, 1] as const).map(offset =>
    Math.hypot(reference[11 + offset].x - reference[23 + offset].x,
      reference[11 + offset].y - reference[23 + offset].y)).filter(length => length > 1e-4) : [];
  // Spatial limits are in the rig's normalized coordinate space. Scale the
  // camera subject to that reference, so stepping farther away cannot alter a
  // rep's travel. Legacy angle-only callers retain their existing image units.
  const bodyScale = state.cycleBodyScale ?? (torsoLengths.length && referenceLengths.length
    ? (torsoLengths.reduce((sum, length) => sum + length, 0) / torsoLengths.length) /
      (referenceLengths.reduce((sum, length) => sum + length, 0) / referenceLengths.length) : 1);
  keypoints = keypoints.map(point => ({ ...point, x: point.x * aspect / bodyScale, y: point.y / bodyScale }));
  const hip = averageVisiblePoint(keypoints, [23, 24], minVisibility);
  const shoulder = averageVisiblePoint(keypoints, [11, 12], minVisibility);
  const updateRange = (
    value: number | null | undefined,
    minValue: number | null | undefined,
    maxValue: number | null | undefined,
  ) => ({
    min:
      minValue === null || minValue === undefined
        ? value ?? null
        : value == null
          ? minValue
          : Math.min(minValue, value),
    max:
      maxValue === null || maxValue === undefined
        ? value ?? null
        : value == null
          ? maxValue
          : Math.max(maxValue, value),
  });
  const hipY = updateRange(
    hip?.y ?? null,
    state.cycleMinHipY,
    state.cycleMaxHipY,
  );
  const hipX = updateRange(
    hip?.x ?? null,
    state.cycleMinHipX,
    state.cycleMaxHipX,
  );
  const shoulderY = updateRange(
    shoulder?.y ?? null,
    state.cycleMinShoulderY,
    state.cycleMaxShoulderY,
  );
  const previousSideRanges = state.cycleSideRanges ?? createCycleSideRanges();
  const nextSideRanges = { ...previousSideRanges };
  ( ["left", "right"] as const).forEach((side) => {
    const indexes = side === "left"
      ? { hip: 23, shoulder: 11, wrist: 15 }
      : { hip: 24, shoulder: 12, wrist: 16 };
    const sideHip = averageVisiblePoint(
      keypoints,
      [indexes.hip],
      minVisibility,
    );
    const sideShoulder = averageVisiblePoint(
      keypoints,
      [indexes.shoulder],
      minVisibility,
    );
    const sideWrist = averageVisiblePoint(
      keypoints,
      [indexes.wrist],
      minVisibility,
    );
    const prior = previousSideRanges[side];
    const hipX = updateRange(sideHip?.x, prior.hipXMin, prior.hipXMax);
    const hipY = updateRange(sideHip?.y, prior.hipYMin, prior.hipYMax);
    const shoulderY = updateRange(
      sideShoulder?.y,
      prior.shoulderYMin,
      prior.shoulderYMax,
    );
    const wristX = updateRange(
      sideWrist?.x,
      prior.wristXMin,
      prior.wristXMax,
    );
    nextSideRanges[side] = {
      hipXMin: hipX.min,
      hipXMax: hipX.max,
      hipYMin: hipY.min,
      hipYMax: hipY.max,
      shoulderYMin: shoulderY.min,
      shoulderYMax: shoulderY.max,
      wristXMin: wristX.min,
      wristXMax: wristX.max,
    };
  });
  const sideWristRanges = (["left", "right"] as const).map((side) =>
    range(
      nextSideRanges[side].wristXMin,
      nextSideRanges[side].wristXMax,
    ),
  ).filter((value): value is number => typeof value === "number");
  const wristDrift = sideWristRanges.length
    ? Math.max(...sideWristRanges)
    : null;
  return {
    ...state,
    cycleBodyScale: bodyScale,
    cycleMinHipY: hipY.min,
    cycleMaxHipY: hipY.max,
    cycleMinHipX: hipX.min,
    cycleMaxHipX: hipX.max,
    cycleMinShoulderY: shoulderY.min,
    cycleMaxShoulderY: shoulderY.max,
    // Preserve a non-cancelling aggregate for older consumers; the detailed
    // per-side values above are authoritative for current contract checks.
    cycleMinWristX: wristDrift === null ? null : 0,
    cycleMaxWristX: wristDrift,
    cycleSideRanges: nextSideRanges,
  };
}

function range(
  minValue: number | null | undefined,
  maxValue: number | null | undefined,
) {
  return typeof minValue === "number" && typeof maxValue === "number"
    ? Math.max(0, maxValue - minValue)
    : null;
}

function updateCycleSideAngleRanges(
  state: PoseRepEngineState,
  sideAngles: { left: number | null; right: number | null } | null,
): PoseRepEngineState {
  if (!sideAngles) return state;
  const previous = state.cycleSideAngleRanges ?? createCycleSideAngleRanges();
  const next = { ...previous };
  ( ["left", "right"] as const).forEach((side) => {
    const angle = sideAngles[side];
    if (!isFiniteAngle(angle)) return;
    const prior = previous[side];
    next[side] = {
      min: prior.min === null ? angle : Math.min(prior.min, angle),
      max: prior.max === null ? angle : Math.max(prior.max, angle),
    };
  });
  return { ...state, cycleSideAngleRanges: next };
}

function getCycleSpatialReason(
  contract: PoseMovementContractRecord,
  state: PoseRepEngineState,
  activeSide?: PoseSide | null,
): string | null {
  const spatial = contract.spatialRequirements;
  if (!spatial) return null;
  const sideRanges = state.cycleSideRanges;
  const selectedSide =
    contract.requiredSides === "both"
      ? null
      : activeSide ?? state.alternatingCycleSide ?? state.selectedSide ?? null;
  const sides = selectedSide ? [selectedSide] as const : (["left", "right"] as const);
  const sideRange = <K extends keyof PoseCycleSideRange>(
    minKey: K,
    maxKey: K,
  ) => {
    const values = sides
      .map((side) => {
        const sideRangeValue = sideRanges?.[side];
        return sideRangeValue
          ? range(sideRangeValue[minKey], sideRangeValue[maxKey])
          : null;
      })
      .filter((value): value is number => typeof value === "number");
    return values.length ? Math.max(...values) : null;
  };
  const hipY = sideRange("hipYMin", "hipYMax") ??
    range(state.cycleMinHipY, state.cycleMaxHipY);
  const shoulderY = sideRange("shoulderYMin", "shoulderYMax") ??
    range(state.cycleMinShoulderY, state.cycleMaxShoulderY);
  const hipX = sideRange("hipXMin", "hipXMax") ??
    range(state.cycleMinHipX, state.cycleMaxHipX);
  const wristX = sideRange("wristXMin", "wristXMax") ??
    range(state.cycleMinWristX, state.cycleMaxWristX);

  if (
    typeof spatial.bodyYTravelMin === "number" && spatial.bodyYTravelMin > 0 &&
    (hipY === null || shoulderY === null)
  ) {
    return "body_y_travel_evidence_unavailable";
  }
  if (
    typeof spatial.bodyYTravelMin === "number" && spatial.bodyYTravelMin > 0 &&
    Math.max(hipY ?? 0, shoulderY ?? 0) < spatial.bodyYTravelMin
  ) {
    return "body_y_travel_below_min";
  }
  if (
    typeof spatial.hipYTravelMin === "number" && spatial.hipYTravelMin > 0 &&
    (hipY === null || hipY < spatial.hipYTravelMin)
  ) {
    return "hip_y_travel_below_min";
  }
  if (
    typeof spatial.shoulderYTravelMin === "number" && spatial.shoulderYTravelMin > 0 &&
    (shoulderY === null || shoulderY < spatial.shoulderYTravelMin)
  ) {
    return "shoulder_y_travel_below_min";
  }
  if (
    typeof spatial.shoulderHipTravelMin === "number" && spatial.shoulderHipTravelMin > 0 &&
    (hipY === null ||
      shoulderY === null ||
      Math.min(hipY, shoulderY) < spatial.shoulderHipTravelMin)
  ) {
    return "shoulder_hip_travel_below_min";
  }
  if (
    typeof spatial.bodyXDriftMax === "number" &&
    (hipX === null || hipX > spatial.bodyXDriftMax)
  ) {
    return hipX === null
      ? "body_x_drift_evidence_unavailable"
      : "body_x_drift_over_max";
  }
  if (
    typeof spatial.wristAnchorDriftMax === "number" &&
    (wristX === null || wristX > spatial.wristAnchorDriftMax)
  ) {
    return wristX === null
      ? "wrist_anchor_evidence_unavailable"
      : "wrist_anchor_drift_over_max";
  }
  return null;
}

function getReliablePoint(
  keypoints: PoseKeypointRecord[] | null | undefined,
  index: number,
  minVisibility: number,
) {
  const point = keypoints?.[index];
  return point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    Number.isFinite(point.visibility) &&
    point.visibility >= minVisibility
    ? point
    : null;
}

type GripSide = "left" | "right";
const GRIP_INDEXES: Record<GripSide, { elbow: number; wrist: number; index: number; pinky: number; thumb: number }> = {
  left: { elbow: 13, wrist: 15, index: 19, pinky: 17, thumb: 21 },
  right: { elbow: 14, wrist: 16, index: 20, pinky: 18, thumb: 22 },
};

function gripPoint(
  keypoints: PoseKeypointRecord[] | null | undefined,
  index: number,
  minVisibility: number,
) {
  return getReliablePoint(keypoints, index, minVisibility);
}

function isOpenGrip(
  keypoints: PoseKeypointRecord[] | null | undefined,
  side: GripSide,
  minVisibility: number,
) {
  const indexes = GRIP_INDEXES[side];
  const elbow = gripPoint(keypoints, indexes.elbow, minVisibility);
  const wrist = gripPoint(keypoints, indexes.wrist, minVisibility);
  const index = gripPoint(keypoints, indexes.index, minVisibility);
  const pinky = gripPoint(keypoints, indexes.pinky, minVisibility);
  const thumb = gripPoint(keypoints, indexes.thumb, minVisibility);
  if (!elbow || !wrist) return false;
  const forearmLength = Math.max(
    Math.hypot(wrist.x - elbow.x, wrist.y - elbow.y),
    0.03,
  );
  const tips = [index, pinky, thumb].filter(
    (point): point is PoseKeypointRecord => !!point,
  );
  if (tips.length < 2) return false;
  const distances = tips.flatMap((first, firstIndex) =>
    tips.slice(firstIndex + 1).map((second) =>
      Math.hypot(first.x - second.x, first.y - second.y) / forearmLength,
    ),
  );
  const spread = Math.max(...distances, 0);
  const reaches = tips.map((point) =>
    Math.hypot(point.x - wrist.x, point.y - wrist.y) / forearmLength,
  );
  const averageReach = reaches.reduce((sum, value) => sum + value, 0) / reaches.length;
  return spread >= 0.24 || averageReach >= 0.38;
}

function isUsableGripFrame(
  keypoints: PoseKeypointRecord[] | null | undefined,
  side: GripSide,
  minVisibility: number,
) {
  const indexes = GRIP_INDEXES[side];
  return [indexes.elbow, indexes.wrist, indexes.index, indexes.pinky, indexes.thumb]
    .every((index) => !!gripPoint(keypoints, index, minVisibility));
}

function getGripReason(
  contract: PoseMovementContractRecord,
  evidence: PoseRepEngineEvidence | undefined,
  activeSide?: PoseSide | null,
) {
  const profile = evidence?.handShapeProfile?.grip;
  if (!profile?.required) return null;
  const frames = [
    ...(evidence?.keypointFrames ?? []),
    ...(evidence?.keypoints ? [evidence.keypoints] : []),
  ].slice(-Math.max(1, profile.recentFrameLimit));
  if (!frames.length) return "grip_evidence_unavailable";
  const requiredSides: GripSide[] =
    contract.requiredSides === "both"
      ? ["left", "right"]
      : activeSide
        ? [activeSide]
        : contract.requiredSides === "right"
          ? ["right"]
          : ["left"];
  for (const side of requiredSides) {
    const usable = frames.filter((frame) =>
      isUsableGripFrame(frame, side, profile.reliablePointMinVisibility),
    );
    if (usable.length < profile.minUsableFrames) {
      return "grip_evidence_unavailable";
    }
    const openFrames = usable.filter((frame) =>
      isOpenGrip(frame, side, profile.reliablePointMinVisibility),
    ).length;
    if (
      openFrames > profile.maxOpenFrames &&
      openFrames / usable.length > profile.maxOpenRatio
    ) {
      return "curl_grip_unconfirmed";
    }
  }
  return null;
}

function getPoseRepNoCountReason(
  contract: PoseMovementContractRecord,
  evidence: PoseRepEngineEvidence | undefined,
  activeSide?: PoseSide | null,
): string | null {
  if (!evidence || (!evidence.keypoints && !evidence.signals)) return MISSING_EVIDENCE_REASON;
  const signals = evidence.signals;
  const assessmentContract =
    activeSide &&
    contract.requiredSides !== "both" &&
    contract.requiredSides !== "left" &&
    contract.requiredSides !== "right"
      ? {
          ...contract,
          requiredSides: activeSide,
          trackingRequirements: contract.trackingRequirements
            ? {
                ...contract.trackingRequirements,
                requiredSides: activeSide,
              }
            : undefined,
        }
      : contract;
  const assessment = evidence.keypoints
    ? getPoseMovementFrameAssessment(
        assessmentContract,
        evidence.keypoints,
        evidence.coordinateDimensions,
      )
    : null;
  if (assessment && !assessment.isReliable) {
    return assessment.reason ?? "tracking_frame_unreliable";
  }
  if (!assessment) {
    const tracking = contract.trackingRequirements;
    if (
      !tracking || !signals ||
      signals.visibility.averageVisibility < tracking.minConfidence ||
      signals.visibility.reliableFrameCount < 1
    ) {
      return "tracking_frame_unreliable";
    }
  }
  // Limb endpoints come from the saved rig. Body posture and travel are the
  // separate, explicit Safeguards fields; the drawing adds no hidden gates.
  // Posture uses the same geometry as the limb angles. Visibility above still
  // comes from image landmarks, so depth cannot rescue a missing required joint.
  const geometry = evidence.keypoints ? getPoseFrameGeometry({
    keypoints: evidence.keypoints, spatialKeypoints: evidence.spatialKeypoints,
  }, evidence.coordinateDimensions) : null;
  const postureReason = getPoseMovementPostureReason(
    assessmentContract, geometry?.keypoints, geometry?.dimensions,
  );
  if (postureReason) return postureReason;
  return getGripReason(contract, evidence, activeSide);
}

/** Explain an unarmed/waiting cycle without treating it as a tracking failure. */
export function getPoseRepProgressText(
  state: PoseRepEngineState,
  contract: PoseMovementContractRecord,
  keypoints: PoseKeypointRecord[],
  dimensions?: PoseCoordinateDimensions,
): string {
  const policy = getPoseRepAcceptancePolicy(contract);
  if (!policy.valid) return "Fix the movement contract before testing.";
  const target = state.phase === "down";
  const stage = state.phase === "primed" ? "Start" : target ? "Target" : "Return";
  const lessThan = target ? policy.direction === "decrease" : policy.direction === "increase";
  const band = target ? policy.targetBand : policy.startBand;
  const threshold = lessThan ? band.max : band.min;
  const angles = getPoseMovementContractSideAngles(contract,keypoints,dimensions);
  const selected = state.alternatingCycleSide ?? state.selectedSide ??
    (contract.requiredSides === "left" || contract.requiredSides === "right" ? contract.requiredSides : null);
  const sides: PoseSide[] = selected && contract.requiredSides !== "both" ? [selected] : ["left", "right"];
  const measurements = sides.map((side) =>
    `${side} ${angles[side] === null ? "not visible" : `${Math.round(angles[side]!)}°`}`,
  ).join(", ");
  const requirement = contract.requiredSides === "either" && !selected ? "one side" : contract.requiredSides === "both" ? "both sides" : "the active side";
  return `${stage} ${lessThan ? "≤" : "≥"} ${Number(threshold.toFixed(1))}°. ${measurements}. Hold ${requirement} briefly.`;
}

function getSideAvailabilityReason(
  contract: PoseMovementContractRecord,
  sideAngles: { left: number | null; right: number | null } | null,
  selectedSide: PoseSide | null | undefined,
): string | null {
  if (!sideAngles) {
    return contract.requiredSides === "left" ||
      contract.requiredSides === "right" ||
      contract.requiredSides === "both" ||
      contract.requiredSides === "alternating"
      ? SIDE_UNAVAILABLE_REASON
      : null;
  }
  const requiredSides = contract.requiredSides ?? "either";
  if (requiredSides === "both") {
    if (!isFiniteAngle(sideAngles.left) || !isFiniteAngle(sideAngles.right)) {
      return SIDE_UNAVAILABLE_REASON;
    }
    const tolerance = contract.spatialRequirements?.leftRightSymmetryTolerance;
    if (
      typeof tolerance === "number" &&
      Math.abs(sideAngles.left - sideAngles.right) > tolerance
    ) {
      return SIDE_SYMMETRY_REASON;
    }
    return null;
  }
  if (requiredSides === "left" && !isFiniteAngle(sideAngles.left)) {
    return SIDE_UNAVAILABLE_REASON;
  }
  if (requiredSides === "right" && !isFiniteAngle(sideAngles.right)) {
    return SIDE_UNAVAILABLE_REASON;
  }
  if (
    requiredSides === "either" &&
    selectedSide &&
    !isFiniteAngle(sideAngles[selectedSide])
  ) {
    return "pinned_side_unavailable";
  }
  if (
    requiredSides === "alternating" &&
    selectedSide &&
    !isFiniteAngle(sideAngles[selectedSide])
  ) {
    return "pinned_side_unavailable";
  }
  return null;
}

function chooseAvailableSide(
  sideAngles: { left: number | null; right: number | null } | null,
  startBand: PoseRepAcceptancePolicy["startBand"],
  expectedSide: PoseSide | null | undefined,
) {
  if (!sideAngles) return null;
  if (expectedSide && isFiniteAngle(sideAngles[expectedSide])) {
    return expectedSide;
  }
  const candidates: PoseSide[] = [];
  if (isFiniteAngle(sideAngles.left)) candidates.push("left");
  if (isFiniteAngle(sideAngles.right)) candidates.push("right");
  const atStart = candidates.filter((side) =>
    isWithinBand(sideAngles[side] as number, startBand),
  );
  if (atStart.length === 1) return atStart[0];
  if (atStart.length > 1) {
    // Stable deterministic choice; both-side contracts are handled elsewhere.
    return atStart[0];
  }
  return candidates[0] ?? null;
}

function resolveRepAngle(
  contract: PoseMovementContractRecord,
  currentAngle: number | null,
  sideAngles: { left: number | null; right: number | null } | null,
  state: PoseRepEngineState,
  policy: PoseRepAcceptancePolicy,
) {
  const requiredSides = contract.requiredSides ?? "either";
  const repModel = contract.repModel ?? "unknown";
  let selectedSide = state.selectedSide ?? null;
  if (repModel === "alternating" || requiredSides === "alternating") {
    selectedSide =
      state.alternatingCycleSide ?? state.alternatingExpectedSide ?? null;
  } else if (
    requiredSides === "either" ||
    repModel === "unilateral_left" ||
    repModel === "unilateral_right"
  ) {
    selectedSide =
      requiredSides === "left" || repModel === "unilateral_left"
        ? "left"
        : requiredSides === "right" || repModel === "unilateral_right"
          ? "right"
          : selectedSide ??
            (repModel !== "static_hold" && state.phase === "primed"
              ? null
              : chooseAvailableSide(sideAngles, policy.startBand, null));
  }
  if (
    sideAngles &&
    repModel !== "static_hold" &&
    requiredSides !== "both" &&
    selectedSide &&
    isFiniteAngle(sideAngles[selectedSide])
  ) {
    return { angle: sideAngles[selectedSide], selectedSide };
  }
  if (
    sideAngles &&
    requiredSides === "both" &&
    isFiniteAngle(sideAngles.left) &&
    isFiniteAngle(sideAngles.right)
  ) {
    return {
      angle: (sideAngles.left + sideAngles.right) / 2,
      selectedSide: null,
    };
  }
  return { angle: currentAngle, selectedSide };
}

function alternatingTargetSides(
  sideAngles: { left: number | null; right: number | null } | null,
  policy: PoseRepAcceptancePolicy,
) {
  if (!sideAngles) return [] as PoseSide[];
  return (["left", "right"] as const).filter((side) =>
    isFiniteAngle(sideAngles[side]) &&
    isAtTargetEndpoint(sideAngles[side] as number, policy),
  );
}

function finishRep(
  state: PoseRepEngineState,
  contract: PoseMovementContractRecord,
  timestamp: number,
  increment: boolean,
): PoseRepEngineState {
  const repNumber = state.repCount + (increment ? 1 : 0);
  const nextState = {
    ...resetCycle(state, {
      preserveLastProcessedAtMs: timestamp,
      selectedSide: null,
      alternatingCycleSide: null,
    }),
    repCount: repNumber,
    lastRepCompletedAtMs: increment
      ? timestamp
      : state.lastRepCompletedAtMs,
    rawAngleData:
      increment && repNumber > state.repCount
        ? [
            ...state.rawAngleData,
            buildRepAngleData(
              repNumber,
              contract.dominantJoint,
              state.currentLowAngle ?? state.currentHighAngle ?? 0,
              state.currentHighAngle ?? state.currentLowAngle ?? 0,
              timestamp,
            ),
          ]
        : state.rawAngleData,
  };
  if (contract.repModel === "alternating" || contract.requiredSides === "alternating") {
    const completedSide = state.alternatingCycleSide;
    nextState.alternatingExpectedSide =
      completedSide === "left" ? "right" : completedSide === "right" ? "left" : null;
  }
  return nextState;
}

function finishPartialCycle(
  state: PoseRepEngineState,
  timestamp: number,
  reason: string,
) {
  return {
    nextState: resetPartialAtTimestamp(state, timestamp),
    repCompleted: false,
    noCountReason: reason,
  } satisfies RepStepResult;
}

function isStaticHoldAngleWithinContract(
  contract: PoseMovementContractRecord,
  angle: number,
) {
  const down = contract.repThresholds.down;
  const up = contract.repThresholds.up;
  const lowerBound = Math.min(
    down.angle - down.tolerance,
    up.angle - up.tolerance,
  );
  const upperBound = Math.max(
    down.angle + down.tolerance,
    up.angle + up.tolerance,
  );
  return angle >= lowerBound && angle <= upperBound;
}

export function createPoseRepEngineState(): PoseRepEngineState {
  return {
    currentHighAngle: null,
    currentLowAngle: null,
    downStreak: 0,
    holdCompleted: false,
    holdInvalidSinceMs: null,
    holdLastValidAtMs: null,
    holdStartedAtMs: null,
    holdValidMs: 0,
    lastRepCompletedAtMs: null,
    lastProcessedAtMs: null,
    phase: "primed",
    peakContractionPending: false,
    rawAngleData: [],
    repCount: 0,
    upStreak: 0,
    cycleStartedAtMs: null,
    cycleStartEndpointAtMs: null,
    cycleTargetEndpointAtMs: null,
    cycleReturnEndpointAtMs: null,
    cycleMinHipY: null,
    cycleMaxHipY: null,
    cycleMinShoulderY: null,
    cycleMaxShoulderY: null,
    cycleMinHipX: null,
    cycleMaxHipX: null,
    cycleMinWristX: null,
    cycleMaxWristX: null,
    cycleHalfCounted: false,
    cycleDepartedStart: false,
    cycleTargetObserved: false,
    selectedSide: null,
    alternatingExpectedSide: null,
    alternatingCycleSide: null,
    sideEndpointState: null,
    alternatingStartSnapshots: null,
    cycleSideRanges: null,
    cycleSideAngleRanges: null,
    contractFingerprint: null,
  };
}

/** Compatibility alias for adapters that use the packet's initial-state name. */
export const createInitialPoseRepEngineState = createPoseRepEngineState;

export function stepPoseStaticHold(
  state: PoseRepEngineState,
  contract: PoseMovementContractRecord,
  currentAngle: number | null,
  timestamp: number,
  evidence?: PoseRepEngineEvidence,
): {
  holdCompleted: boolean;
  holdSeconds: number;
  holdValid: boolean;
  nextState: PoseRepEngineState;
  noCountReason: string | null;
} {
  if (!isFiniteTimestamp(timestamp)) {
    return {
      holdCompleted: false,
      holdSeconds: state.holdValidMs / 1000,
      holdValid: false,
      nextState: state,
      noCountReason: INVALID_TIMESTAMP_REASON,
    };
  }
  const referenceContract = getRigMovementContract(contract, evidence?.rig);
  const validation = validatePoseMovementContract(referenceContract);
  const activeContract = validation.normalized ??
    normalizePoseMovementContract(referenceContract) ??
    referenceContract;
  const policy = getPoseRepAcceptancePolicy(activeContract);
  const contractFingerprint = getPoseRepContractFingerprint(activeContract) + getRigFingerprint(evidence?.rig) + (evidence?.spatialKeypoints ? "|spatial" : "|image");
  if (!validation.valid || !policy.valid || policy.repModel !== "static_hold") {
    const invalidState = {
      ...resetPartialAtTimestamp(state, timestamp),
      holdCompleted: false,
      holdInvalidSinceMs: timestamp,
      holdLastValidAtMs: null,
      holdStartedAtMs: null,
      holdValidMs: 0,
      contractFingerprint,
    };
    return {
      holdCompleted: false,
      holdSeconds: 0,
      holdValid: false,
      nextState: invalidState,
      noCountReason:
        !validation.valid || !policy.valid
          ? "invalid_contract"
          : "movement_contract_not_static_hold",
    };
  }
  if (
    state.lastProcessedAtMs !== null &&
    state.lastProcessedAtMs !== undefined &&
    timestamp <= state.lastProcessedAtMs &&
    state.contractFingerprint === contractFingerprint
  ) {
    return {
      holdCompleted: false,
      holdSeconds: state.holdValidMs / 1000,
      holdValid: false,
      nextState: state,
      noCountReason:
        timestamp === state.lastProcessedAtMs
          ? "duplicate_frame"
          : "backward_timestamp",
    };
  }
  if (state.contractFingerprint !== contractFingerprint) {
    state = {
      ...resetCycle(state, { preserveLastProcessedAtMs: null }),
      holdCompleted: false,
      holdInvalidSinceMs: null,
      holdLastValidAtMs: null,
      holdStartedAtMs: null,
      holdValidMs: 0,
      contractFingerprint,
    };
  }
  if (
    state.lastProcessedAtMs !== null &&
    state.lastProcessedAtMs !== undefined &&
    timestamp - state.lastProcessedAtMs > policy.maxFrameGapMs
  ) {
    const nextState = {
      ...resetPartialAtTimestamp(state, timestamp),
      holdCompleted: false,
      holdInvalidSinceMs: null,
      holdLastValidAtMs: null,
      holdStartedAtMs: null,
      holdValidMs: 0,
    };
    return {
      holdCompleted: false,
      holdSeconds: 0,
      holdValid: false,
      nextState,
      noCountReason: FRAME_GAP_REASON,
    };
  }
  const durationSeconds =
    typeof activeContract.holdDurationSeconds === "number" &&
    Number.isFinite(activeContract.holdDurationSeconds) &&
    activeContract.holdDurationSeconds > 0
      ? activeContract.holdDurationSeconds
      : 30;
  const geometry = evidence?.keypoints ? getPoseFrameGeometry({ keypoints: evidence.keypoints, spatialKeypoints: evidence.spatialKeypoints }, evidence.coordinateDimensions) : null;
  const sideAngles = geometry
    ? getPoseMovementContractSideAngles(
        activeContract,
        geometry.keypoints,
        geometry.dimensions,
      )
    : null;
  const resolved = resolveRepAngle(
    activeContract,
    currentAngle,
    sideAngles,
    state,
    policy,
  );
  const noCountReason =
    !isFiniteAngle(resolved.angle)
      ? "unavailable_primary_angle"
      : !isStaticHoldAngleWithinContract(activeContract, resolved.angle)
        ? "static_hold_angle_out_of_range"
        : getSideAvailabilityReason(
            activeContract,
            sideAngles,
            resolved.selectedSide,
          ) ??
          getPoseRepNoCountReason(activeContract, evidence, resolved.selectedSide);
  const previousValidAt = state.holdLastValidAtMs;
  if (noCountReason) {
    const invalidSince = state.holdInvalidSinceMs ?? timestamp;
    const shouldReset = timestamp - invalidSince >= STATIC_HOLD_INVALID_RESET_MS;
    const nextState = shouldReset
      ? {
          ...resetPartialAtTimestamp(state, timestamp),
          holdCompleted: false,
          holdInvalidSinceMs: timestamp,
          holdLastValidAtMs: null,
          holdStartedAtMs: null,
          holdValidMs: 0,
        }
      : {
          ...state,
          lastProcessedAtMs: timestamp,
          holdInvalidSinceMs: invalidSince,
          phase: "primed" as const,
        };
    return {
      holdCompleted: false,
      holdSeconds: nextState.holdValidMs / 1000,
      holdValid: false,
      nextState,
      noCountReason,
    };
  }
  const deltaMs =
    previousValidAt === null || state.holdInvalidSinceMs !== null
      ? 0
      : Math.min(
          STATIC_HOLD_MAX_FRAME_DELTA_MS,
          Math.max(0, timestamp - previousValidAt),
        );
  const holdValidMs = state.holdValidMs + deltaMs;
  const holdDurationMs = durationSeconds * 1000;
  const holdCompleted = holdValidMs >= holdDurationMs;
  const nextState: PoseRepEngineState = {
    ...state,
    ...updateCyclePointRanges(state, evidence?.keypoints, activeContract, evidence?.coordinateDimensions, evidence?.rig),
    lastProcessedAtMs: timestamp,
    holdCompleted,
    holdInvalidSinceMs: null,
    holdLastValidAtMs: timestamp,
    holdStartedAtMs: state.holdStartedAtMs ?? timestamp,
    holdValidMs,
    phase: "hold",
  };
  return {
    holdCompleted: holdCompleted && !state.holdCompleted,
    holdSeconds: holdValidMs / 1000,
    holdValid: true,
    nextState,
    noCountReason: null,
  };
}

export function stepPoseRepEngine(
  state: PoseRepEngineState,
  contract: PoseMovementContractRecord,
  currentAngle: number | null,
  timestamp: number,
  evidence?: PoseRepEngineEvidence,
): RepStepResult {
  if (!isFiniteTimestamp(timestamp)) {
    return {
      nextState: state,
      noCountReason: INVALID_TIMESTAMP_REASON,
      repCompleted: false,
    };
  }
  const referenceContract = getRigMovementContract(contract, evidence?.rig);
  const validation = validatePoseMovementContract(referenceContract);
  const activeContract = validation.normalized ??
    normalizePoseMovementContract(referenceContract) ??
    referenceContract;
  const policy = getPoseRepAcceptancePolicy(activeContract);
  const contractFingerprint = getPoseRepContractFingerprint(activeContract) + getRigFingerprint(evidence?.rig) + (evidence?.spatialKeypoints ? "|spatial" : "|image");
  if (!validation.valid || !policy.valid || policy.repModel === "static_hold") {
    const invalidState = {
      ...resetPartialAtTimestamp(state, timestamp),
      contractFingerprint,
    };
    return {
      nextState: invalidState,
      noCountReason:
        validation.valid && policy.repModel === "static_hold"
          ? "movement_contract_static_hold"
          : "invalid_contract",
      repCompleted: false,
    };
  }
  if (
    state.lastProcessedAtMs !== null &&
    state.lastProcessedAtMs !== undefined &&
    timestamp <= state.lastProcessedAtMs &&
    state.contractFingerprint === contractFingerprint
  ) {
    return {
      nextState: state,
      noCountReason:
        timestamp === state.lastProcessedAtMs
          ? "duplicate_frame"
          : "backward_timestamp",
      repCompleted: false,
    };
  }
  if (state.contractFingerprint !== contractFingerprint) {
    state = {
      ...resetCycle(state, { preserveLastProcessedAtMs: null }),
      contractFingerprint,
    };
  }
  if (
    state.lastProcessedAtMs !== null &&
    state.lastProcessedAtMs !== undefined &&
    timestamp - state.lastProcessedAtMs > policy.maxFrameGapMs
  ) {
    return finishPartialCycle(state, timestamp, FRAME_GAP_REASON);
  }

  const geometry = evidence?.keypoints ? getPoseFrameGeometry({ keypoints: evidence.keypoints, spatialKeypoints: evidence.spatialKeypoints }, evidence.coordinateDimensions) : null;
  const referenceMatch = getRigUpperArmPhaseMatch(
    activeContract, evidence?.rig, geometry?.keypoints, geometry?.dimensions,
  );
  const matchesReference = (stage: "start" | "target", side: PoseSide | null) => {
    if (!referenceMatch) return true;
    // Fixed-side contracts do not populate the either/alternating selection.
    const requiredSide = side ?? (
      activeContract.requiredSides === "left" || activeContract.requiredSides === "right"
        ? activeContract.requiredSides : null
    );
    return requiredSide ? referenceMatch[stage][requiredSide]
      : referenceMatch[stage].left && referenceMatch[stage].right;
  };
  const sideAngles = geometry
    ? getPoseMovementContractSideAngles(
        activeContract,
        geometry.keypoints,
        geometry.dimensions,
      )
    : null;
  const resolved = resolveRepAngle(
    activeContract,
    currentAngle,
    sideAngles,
    state,
    policy,
  );
  if (!isFiniteAngle(resolved.angle)) {
    return {
      nextState: resetPartialAtTimestamp(state, timestamp),
      noCountReason: "unavailable_primary_angle",
      repCompleted: false,
    };
  }
  let nextState: PoseRepEngineState = {
    ...state,
    lastProcessedAtMs: timestamp,
    currentHighAngle:
      state.currentHighAngle === null
        ? resolved.angle
        : Math.max(state.currentHighAngle, resolved.angle),
    currentLowAngle:
      state.currentLowAngle === null
        ? resolved.angle
        : Math.min(state.currentLowAngle, resolved.angle),
    selectedSide:
      state.selectedSide ??
      (resolved.selectedSide && activeContract.requiredSides !== "both"
        ? resolved.selectedSide
        : null),
    alternatingCycleSide: state.alternatingCycleSide ?? null,
  };
  const sideReason = getSideAvailabilityReason(
    activeContract,
    sideAngles,
    state.alternatingCycleSide ?? state.selectedSide ?? resolved.selectedSide,
  );
  if (sideReason) {
    return finishPartialCycle(
      { ...state, lastProcessedAtMs: timestamp },
      timestamp,
      sideReason,
    );
  }
  const isAlternating =
    activeContract.repModel === "alternating" ||
    activeContract.requiredSides === "alternating";
  const isEither =
    activeContract.requiredSides === "either" &&
    activeContract.repModel !== "unilateral_left" &&
    activeContract.repModel !== "unilateral_right";
  const selectsFirstMovingSide = isAlternating || isEither;
  if (selectsFirstMovingSide && sideAngles) {
    const targets = alternatingTargetSides(sideAngles, policy).filter(side => matchesReference("target",side));
    if (isAlternating && targets.length > 1) {
      return finishPartialCycle(
        nextState,
        timestamp,
        ALTERNATING_SIMULTANEOUS_REASON,
      );
    }
    if (
      isAlternating &&
      nextState.alternatingExpectedSide &&
      targets.length === 1 &&
      targets[0] !== nextState.alternatingExpectedSide &&
      nextState.phase === "primed"
    ) {
      return finishPartialCycle(nextState, timestamp, ALTERNATING_ORDER_REASON);
    }
    if (
      isAlternating &&
      nextState.alternatingCycleSide &&
      targets.length === 1 &&
      targets[0] !== nextState.alternatingCycleSide
    ) {
      return finishPartialCycle(nextState, timestamp, ALTERNATING_ORDER_REASON);
    }
    if (nextState.phase === "primed") {
      const previousEndpointState = nextState.sideEndpointState;
      const previousStableSides = (["left", "right"] as const).filter((side) => {
        const endpoint = previousEndpointState?.[side].start;
        return (
          !!endpoint &&
          !!nextState.alternatingStartSnapshots?.[side] &&
          endpoint.streak >= policy.endpointStreak &&
          typeof endpoint.startedAtMs === "number" &&
          timestamp - endpoint.startedAtMs >= policy.endpointSpanMs
        );
      });
      const endpointState = updateSideEndpoints(
        nextState.sideEndpointState,
        sideAngles,
        "start",
        policy,
        timestamp,
        referenceMatch?.start,
      );
      const stableSides = (["left", "right"] as const).filter((side) => {
        const endpoint = endpointState[side].start;
        return (
          endpoint.streak >= policy.endpointStreak &&
          typeof endpoint.startedAtMs === "number" &&
          timestamp - endpoint.startedAtMs >= policy.endpointSpanMs
        );
      });
      const startSnapshots = captureStableStartSnapshots(
        nextState.alternatingStartSnapshots,
        endpointState,
        sideAngles,
        evidence?.keypoints,
        timestamp,
        policy,
        (side) => getPoseRepNoCountReason(activeContract, evidence, side) === null,
      );
      const departedStableSides = previousStableSides.filter((side) => {
        const angle = sideAngles[side];
        return isFiniteAngle(angle) && isDepartingStartEndpoint(angle, policy);
      });
      if (isAlternating && departedStableSides.length > 1) {
        return finishPartialCycle(
          { ...nextState, sideEndpointState: endpointState },
          timestamp,
          ALTERNATING_SIMULTANEOUS_REASON,
        );
      }
      if (
        isAlternating &&
        nextState.alternatingExpectedSide &&
        departedStableSides.length === 1 &&
        departedStableSides[0] !== nextState.alternatingExpectedSide
      ) {
        return finishPartialCycle(
          { ...nextState, sideEndpointState: endpointState },
          timestamp,
          ALTERNATING_ORDER_REASON,
        );
      }
      let candidate = isAlternating
        ? nextState.alternatingCycleSide ?? null
        : nextState.selectedSide ?? null;
      const departedSide =
        departedStableSides.length === 1
          ? departedStableSides[0]
          : isEither && candidate && departedStableSides.includes(candidate)
            ? candidate
            : isEither
              ? departedStableSides[0] ?? null
            : null;
      if (departedSide) {
        candidate = departedSide;
      }
      const expectedSideUnavailable =
        isAlternating &&
        !!nextState.alternatingExpectedSide &&
        !stableSides.includes(nextState.alternatingExpectedSide) &&
        departedSide !== nextState.alternatingExpectedSide;
      if (!candidate && isAlternating && nextState.alternatingExpectedSide) {
        candidate = stableSides.includes(nextState.alternatingExpectedSide)
          ? nextState.alternatingExpectedSide
          : null;
      }
      if (
        isAlternating &&
        !candidate &&
        !expectedSideUnavailable &&
        targets.length === 1 &&
        previousStableSides.includes(targets[0])
      ) {
        candidate = targets[0];
      }
      if (!candidate && !expectedSideUnavailable && stableSides.length === 1) {
        candidate = stableSides[0];
      }
      if (
        !candidate &&
        !expectedSideUnavailable &&
        stableSides.length === 2
      ) {
        const leavingStart = (["left", "right"] as const).filter((side) => {
          const angle = sideAngles[side];
          return isFiniteAngle(angle) && isDepartingStartEndpoint(angle, policy);
        });
        if (isAlternating && leavingStart.length > 1) {
          return finishPartialCycle(
            { ...nextState, sideEndpointState: endpointState },
            timestamp,
            ALTERNATING_SIMULTANEOUS_REASON,
          );
        }
        candidate = leavingStart[0] ?? null;
      }
      if (
        isAlternating &&
        targets.length === 1 &&
        (!candidate || targets[0] !== candidate) &&
        !previousStableSides.includes(targets[0])
      ) {
        return finishPartialCycle(
          { ...nextState, sideEndpointState: endpointState },
          timestamp,
          ALTERNATING_ORDER_REASON,
        );
      }
      nextState = {
        ...nextState,
        sideEndpointState: endpointState,
        alternatingStartSnapshots: startSnapshots,
        ...(candidate
          ? {
              selectedSide: candidate,
              ...(isAlternating ? { alternatingCycleSide: candidate } : {}),
              ...(
              previousStableSides.includes(candidate) &&
              typeof previousEndpointState?.[candidate]?.start.startedAtMs ===
                "number"
                ? {
                    downStreak: policy.endpointStreak,
                    cycleStartEndpointAtMs:
                      previousEndpointState[candidate]!.start.startedAtMs,
                  }
                : {}),
            }
          : {}),
      };
    }
  }
  const activeSide =
    nextState.alternatingCycleSide ??
    nextState.selectedSide ??
    resolved.selectedSide ??
    null;
  const evidenceReason =
    selectsFirstMovingSide && !activeSide
      ? null
      : getPoseRepNoCountReason(activeContract, evidence, activeSide);
  if (evidenceReason) {
    return finishPartialCycle(nextState, timestamp, evidenceReason);
  }
  nextState = updateCyclePointRanges(
    nextState,
    evidence?.keypoints,
    activeContract,
    evidence?.coordinateDimensions,
    evidence?.rig,
  );
  nextState = updateCycleSideAngleRanges(nextState, sideAngles);

  const cycleAngle =
    activeSide && sideAngles && isFiniteAngle(sideAngles[activeSide])
      ? sideAngles[activeSide]
      : resolved.angle;
  const alternatingDepartureSnapshot =
    selectsFirstMovingSide &&
    nextState.phase === "primed" &&
    activeSide &&
    isFiniteAngle(cycleAngle) &&
    isDepartingStartEndpoint(cycleAngle, policy)
      ? nextState.alternatingStartSnapshots?.[activeSide] ?? null
      : null;
  if (alternatingDepartureSnapshot && activeSide) {
    nextState = {
      ...nextState,
      currentHighAngle: alternatingDepartureSnapshot.angle,
      currentLowAngle: alternatingDepartureSnapshot.angle,
      cycleMinHipY: null,
      cycleMaxHipY: null,
      cycleMinShoulderY: null,
      cycleMaxShoulderY: null,
      cycleMinHipX: null,
      cycleMaxHipX: null,
      cycleMinWristX: null,
      cycleMaxWristX: null,
      cycleSideRanges: null,
      cycleSideAngleRanges: null,
    };
    if (alternatingDepartureSnapshot.keypoints) {
      nextState = updateCyclePointRanges(
        nextState,
        alternatingDepartureSnapshot.keypoints,
        activeContract,
        evidence?.coordinateDimensions,
        evidence?.rig,
      );
    }
    const snapshotAngles = { left: null, right: null } as {
      left: number | null;
      right: number | null;
    };
    snapshotAngles[activeSide] = alternatingDepartureSnapshot.angle;
    nextState = updateCycleSideAngleRanges(nextState, snapshotAngles);
    nextState = updateCyclePointRanges(
      nextState,
      evidence?.keypoints,
      activeContract,
      evidence?.coordinateDimensions,
      evidence?.rig,
    );
    nextState = updateCycleSideAngleRanges(nextState, sideAngles);
  }
  nextState = {
    ...nextState,
    currentHighAngle:
      nextState.currentHighAngle === null
        ? cycleAngle
        : Math.max(nextState.currentHighAngle, cycleAngle),
    currentLowAngle:
      nextState.currentLowAngle === null
        ? cycleAngle
        : Math.min(nextState.currentLowAngle, cycleAngle),
  };

  if (nextState.phase === "primed") {
    if (selectsFirstMovingSide && !activeSide) {
      return { nextState, repCompleted: false, noCountReason: null };
    }
    if (activeContract.requiredSides === "both" && sideAngles) {
      const sideEndpointState = updateSideEndpoints(
        nextState.sideEndpointState,
        sideAngles,
        "start",
        policy,
        timestamp,
        referenceMatch?.start,
      );
      const leftStart = sideEndpointState.left.start;
      const rightStart = sideEndpointState.right.start;
      const startsStable =
        leftStart.streak >= policy.endpointStreak &&
        rightStart.streak >= policy.endpointStreak &&
        typeof leftStart.startedAtMs === "number" &&
        typeof rightStart.startedAtMs === "number" &&
        timestamp - leftStart.startedAtMs >= policy.endpointSpanMs &&
        timestamp - rightStart.startedAtMs >= policy.endpointSpanMs;
      if (!startsStable) {
        return {
          nextState: { ...nextState, sideEndpointState },
          repCompleted: false,
          noCountReason: null,
        };
      }
      // Setup may settle one arm before the other. Both still have to be
      // visible and stable together before arming. Synchronization applies
      // to the target and return of the movement, not getting into position.
      const cycleStartedAtMs = Math.max(
        leftStart.startedAtMs as number,
        rightStart.startedAtMs as number,
      );
      nextState = {
        ...nextState,
        sideEndpointState,
        phase: "down",
        upStreak: 0,
        cycleStartedAtMs,
        cycleStartEndpointAtMs: cycleStartedAtMs,
        cycleTargetEndpointAtMs: null,
        cycleReturnEndpointAtMs: null,
        cycleHalfCounted: false,
        cycleDepartedStart: false,
        cycleTargetObserved: false,
        peakContractionPending: false,
        currentHighAngle: cycleAngle,
        currentLowAngle: cycleAngle,
        cycleMinHipY: null,
        cycleMaxHipY: null,
        cycleMinShoulderY: null,
        cycleMaxShoulderY: null,
        cycleMinHipX: null,
        cycleMaxHipX: null,
        cycleMinWristX: null,
        cycleMaxWristX: null,
        cycleSideRanges: null,
        cycleSideAngleRanges: null,
      };
      nextState = updateCyclePointRanges(
        nextState,
        evidence?.keypoints,
        activeContract,
        evidence?.coordinateDimensions,
        evidence?.rig,
      );
      nextState = updateCycleSideAngleRanges(nextState, sideAngles);
      return { nextState, repCompleted: false, noCountReason: null };
    }
    const alternatingMovedFromStableStart =
      selectsFirstMovingSide &&
      (isAlternating
        ? !!nextState.alternatingCycleSide
        : !!nextState.selectedSide) &&
      !isAtStartEndpoint(cycleAngle, policy) &&
      nextState.downStreak >= policy.endpointStreak &&
      typeof nextState.cycleStartEndpointAtMs === "number";
    const processTargetOnDeparture =
      alternatingMovedFromStableStart &&
      isAtTargetEndpoint(cycleAngle, policy);
    const start = alternatingMovedFromStableStart
      ? {
          streak: nextState.downStreak,
          startedAtMs: nextState.cycleStartEndpointAtMs,
          stable: true,
        }
      : updateStableEndpoint(
          nextState.downStreak,
          nextState.cycleStartEndpointAtMs,
          isAtStartEndpoint(cycleAngle, policy) && matchesReference("start",activeSide),
          timestamp,
          policy.endpointStreak,
          policy.endpointSpanMs,
        );
    nextState = {
      ...nextState,
      downStreak: start.streak,
      cycleStartEndpointAtMs: start.startedAtMs,
    };
    if (start.stable) {
      nextState = {
        ...nextState,
        phase: "down",
        upStreak: 0,
        cycleStartedAtMs: start.startedAtMs,
        cycleTargetEndpointAtMs: null,
        cycleReturnEndpointAtMs: null,
        cycleHalfCounted: false,
        cycleDepartedStart: false,
        cycleTargetObserved: false,
        peakContractionPending: false,
        currentHighAngle: alternatingMovedFromStableStart
          ? nextState.currentHighAngle
          : cycleAngle,
        currentLowAngle: alternatingMovedFromStableStart
          ? nextState.currentLowAngle
          : cycleAngle,
        cycleMinHipY: alternatingMovedFromStableStart
          ? nextState.cycleMinHipY
          : null,
        cycleMaxHipY: alternatingMovedFromStableStart
          ? nextState.cycleMaxHipY
          : null,
        cycleMinShoulderY: alternatingMovedFromStableStart
          ? nextState.cycleMinShoulderY
          : null,
        cycleMaxShoulderY: alternatingMovedFromStableStart
          ? nextState.cycleMaxShoulderY
          : null,
        cycleMinHipX: alternatingMovedFromStableStart
          ? nextState.cycleMinHipX
          : null,
        cycleMaxHipX: alternatingMovedFromStableStart
          ? nextState.cycleMaxHipX
          : null,
        cycleMinWristX: alternatingMovedFromStableStart
          ? nextState.cycleMinWristX
          : null,
        cycleMaxWristX: alternatingMovedFromStableStart
          ? nextState.cycleMaxWristX
          : null,
        cycleSideRanges: alternatingMovedFromStableStart
          ? nextState.cycleSideRanges
          : null,
        cycleSideAngleRanges: alternatingMovedFromStableStart
          ? nextState.cycleSideAngleRanges
          : null,
      };
      nextState = updateCyclePointRanges(
        nextState,
        evidence?.keypoints,
        activeContract,
        evidence?.coordinateDimensions,
        evidence?.rig,
      );
      nextState = updateCycleSideAngleRanges(nextState, sideAngles);
    }
    if (!processTargetOnDeparture) {
      return { nextState, repCompleted: false, noCountReason: null };
    }
  }

  if (nextState.phase === "down") {
    const endpointAngles = activeContract.requiredSides === "both" && sideAngles
      ? [sideAngles.left, sideAngles.right]
      : [cycleAngle];
    const allAtStart = endpointAngles.every((angle) => isFiniteAngle(angle) && isAtStartEndpoint(angle,policy)) &&
      matchesReference("start",activeContract.requiredSides === "both" ? null : activeSide);
    const allAtTarget = endpointAngles.every((angle) => isFiniteAngle(angle) && isAtTargetEndpoint(angle,policy)) &&
      matchesReference("target",activeContract.requiredSides === "both" ? null : activeSide);
    nextState = {
      ...nextState,
      cycleDepartedStart: nextState.cycleDepartedStart || (!allAtStart &&
        Math.abs((nextState.currentHighAngle ?? cycleAngle)-(nextState.currentLowAngle ?? cycleAngle)) >= POSE_REP_NOISE_FLOOR_DEGREES),
      cycleTargetObserved: nextState.cycleTargetObserved || allAtTarget,
    };
    let targetStable = false;
    let targetStartedAtMs: number | null = null;
    if (activeContract.requiredSides === "both" && sideAngles) {
      const sideEndpointState = updateSideEndpoints(
        nextState.sideEndpointState,
        sideAngles,
        "target",
        policy,
        timestamp,
        referenceMatch?.target,
      );
      nextState = { ...nextState, sideEndpointState };
      const leftTarget = sideEndpointState.left.target;
      const rightTarget = sideEndpointState.right.target;
      targetStable =
        leftTarget.streak >= policy.endpointStreak &&
        rightTarget.streak >= policy.endpointStreak &&
        typeof leftTarget.startedAtMs === "number" &&
        typeof rightTarget.startedAtMs === "number" &&
        timestamp - leftTarget.startedAtMs >= policy.endpointSpanMs &&
        timestamp - rightTarget.startedAtMs >= policy.endpointSpanMs;
      if (targetStable) {
        const syncReason = sidePhaseSyncReason(
          sideEndpointState,
          "target",
          activeContract.spatialRequirements?.phaseSyncToleranceMs,
        );
        if (syncReason) {
          return finishPartialCycle(nextState, timestamp, syncReason);
        }
        targetStartedAtMs = Math.max(
          leftTarget.startedAtMs as number,
          rightTarget.startedAtMs as number,
        );
      }
      nextState = {
        ...nextState,
        upStreak: targetStable ? policy.endpointStreak : 0,
        cycleTargetEndpointAtMs: targetStartedAtMs,
        peakContractionPending: targetStable,
      };
    } else {
      const target = updateStableEndpoint(
        nextState.upStreak,
        nextState.cycleTargetEndpointAtMs,
        isAtTargetEndpoint(cycleAngle, policy) && matchesReference("target",activeSide),
        timestamp,
        policy.endpointStreak,
        policy.endpointSpanMs,
      );
      targetStable = target.stable;
      targetStartedAtMs = target.startedAtMs;
      nextState = {
        ...nextState,
        upStreak: target.streak,
        cycleTargetEndpointAtMs: target.startedAtMs,
        peakContractionPending: target.stable,
      };
    }
    if (!targetStable && nextState.cycleDepartedStart) {
      const returnedEarly = updateStableEndpoint(
        nextState.downStreak, nextState.cycleReturnEndpointAtMs, allAtStart,
        timestamp, policy.endpointStreak, policy.endpointSpanMs,
      );
      nextState = {...nextState,downStreak:returnedEarly.streak,cycleReturnEndpointAtMs:returnedEarly.startedAtMs};
      if (returnedEarly.stable) {
        return finishPartialCycle(nextState,timestamp,
          nextState.cycleTargetObserved ? "rep_target_not_held" : "rep_target_not_reached");
      }
    }
    if (targetStable) {
      const angleTravel =
        Math.max(
          Math.abs(
            (nextState.currentHighAngle ?? cycleAngle) -
              (nextState.currentLowAngle ?? cycleAngle),
          ),
          Math.abs(
            cycleAngle -
            (nextState.currentHighAngle ?? nextState.currentLowAngle ?? cycleAngle),
          ),
        );
      const requiredTravelSides: PoseSide[] =
        activeContract.requiredSides === "both"
          ? ["left", "right"]
          : activeSide
            ? [activeSide]
            : [];
      const sideTravelTooShort = requiredTravelSides.some((side) => {
        const range = nextState.cycleSideAngleRanges?.[side];
        return (
          !!range &&
          typeof range.min === "number" &&
          typeof range.max === "number" &&
          range.max - range.min < policy.minTravel
        );
      });
      if (angleTravel < policy.minTravel || sideTravelTooShort) {
        return finishPartialCycle(
          nextState,
          timestamp,
          MINIMUM_TRAVEL_REASON,
        );
      }
      if (
        policy.countAt === "peak" &&
        policy.partialRepPolicy !== "review_only" &&
        (typeof nextState.cycleStartedAtMs !== "number" ||
          timestamp - nextState.cycleStartedAtMs < policy.minCycleMs)
      ) {
        return finishPartialCycle(
          nextState,
          timestamp,
          CYCLE_DURATION_REASON,
        );
      }
      const spatialReason = getCycleSpatialReason(
        activeContract,
        nextState,
        activeSide,
      );
      if (spatialReason) {
        return finishPartialCycle(nextState, timestamp, spatialReason);
      }
      if (policy.countAt === "peak" && policy.partialRepPolicy !== "review_only") {
        if (!nextState.cycleHalfCounted) {
          const halfState = {
            ...nextState,
            repCount: nextState.repCount + 1,
            lastRepCompletedAtMs: timestamp,
            cycleHalfCounted: true,
            phase: "up" as const,
            upStreak: 0,
          };
          const repNumber = halfState.repCount;
          return {
            nextState: {
              ...halfState,
              rawAngleData: [
                ...halfState.rawAngleData,
                buildRepAngleData(
                  repNumber,
                  activeContract.dominantJoint,
                  halfState.currentLowAngle ?? resolved.angle,
                  halfState.currentHighAngle ?? resolved.angle,
                  timestamp,
                ),
              ],
            },
            repCompleted: true,
            noCountReason: null,
          };
        }
      } else {
        nextState = {
          ...nextState,
          phase: "up",
          upStreak: 0,
        };
      }
    }
    return { nextState, repCompleted: false, noCountReason: null };
  }

  let returnStable = false;
  let returnStartedAtMs: number | null = null;
  if (activeContract.requiredSides === "both" && sideAngles) {
    const sideEndpointState = updateSideEndpoints(
      nextState.sideEndpointState,
      sideAngles,
      "return",
      policy,
      timestamp,
      referenceMatch?.start,
    );
    nextState = { ...nextState, sideEndpointState };
    const leftReturn = sideEndpointState.left.return;
    const rightReturn = sideEndpointState.right.return;
    returnStable =
      leftReturn.streak >= policy.endpointStreak &&
      rightReturn.streak >= policy.endpointStreak &&
      typeof leftReturn.startedAtMs === "number" &&
      typeof rightReturn.startedAtMs === "number" &&
      timestamp - leftReturn.startedAtMs >= policy.endpointSpanMs &&
      timestamp - rightReturn.startedAtMs >= policy.endpointSpanMs;
    if (returnStable) {
      const syncReason = sidePhaseSyncReason(
        sideEndpointState,
        "return",
        activeContract.spatialRequirements?.phaseSyncToleranceMs,
      );
      if (syncReason) {
        return finishPartialCycle(nextState, timestamp, syncReason);
      }
      returnStartedAtMs = Math.max(
        leftReturn.startedAtMs as number,
        rightReturn.startedAtMs as number,
      );
    }
    nextState = {
      ...nextState,
      upStreak: returnStable ? policy.endpointStreak : 0,
      cycleReturnEndpointAtMs: returnStartedAtMs,
    };
  } else {
    const returnEndpoint = updateStableEndpoint(
      nextState.upStreak,
      nextState.cycleReturnEndpointAtMs,
      isAtStartEndpoint(cycleAngle, policy) && matchesReference("start",activeSide),
      timestamp,
      policy.endpointStreak,
      policy.endpointSpanMs,
    );
    returnStable = returnEndpoint.stable;
    returnStartedAtMs = returnEndpoint.startedAtMs;
    nextState = {
      ...nextState,
      upStreak: returnEndpoint.streak,
      cycleReturnEndpointAtMs: returnEndpoint.startedAtMs,
    };
  }
  if (!returnStable) {
    return { nextState, repCompleted: false, noCountReason: null };
  }
  const cycleDuration =
    typeof nextState.cycleStartedAtMs === "number"
      ? timestamp - nextState.cycleStartedAtMs
      : 0;
  if (cycleDuration < policy.minCycleMs) {
    return finishPartialCycle(nextState, timestamp, CYCLE_DURATION_REASON);
  }
  const spatialReason = getCycleSpatialReason(
    activeContract,
    nextState,
    activeSide,
  );
  if (spatialReason) {
    return finishPartialCycle(nextState, timestamp, spatialReason);
  }
  const shouldIncrement = policy.countAt === "return" &&
    policy.partialRepPolicy !== "review_only";
  const repCompleted = shouldIncrement;
  let finishedState = finishRep(
    nextState,
    activeContract,
    timestamp,
    shouldIncrement,
  );
  // A validated return is also the next start. Dropping this evidence forced
  // another setup pause and missed the next rep when movement resumed at once.
  // Alternating contracts must still establish the other side independently.
  if (!isAlternating) {
    finishedState = {
      ...finishedState,
      phase: isEither ? "primed" : "down",
      selectedSide: isEither ? null : activeSide,
      downStreak: policy.endpointStreak,
      cycleStartedAtMs: returnStartedAtMs,
      cycleStartEndpointAtMs: returnStartedAtMs,
      currentHighAngle: cycleAngle,
      currentLowAngle: cycleAngle,
    };
    finishedState = updateCyclePointRanges(
      finishedState, evidence?.keypoints, activeContract,
      evidence?.coordinateDimensions, evidence?.rig,
    );
    finishedState = updateCycleSideAngleRanges(finishedState, sideAngles);
    if (isEither && activeSide && sideAngles) {
      const endpoints = createSideEndpointState();
      endpoints[activeSide].start = {
        streak: policy.endpointStreak, startedAtMs: returnStartedAtMs,
      };
      finishedState.sideEndpointState = endpoints;
      finishedState.alternatingStartSnapshots = captureStableStartSnapshots(
        null, endpoints, sideAngles, evidence?.keypoints, timestamp, policy,
        (side) => side === activeSide,
      );
    }
  }
  return {
    nextState: finishedState,
    repCompleted,
    noCountReason: null,
  };
}
