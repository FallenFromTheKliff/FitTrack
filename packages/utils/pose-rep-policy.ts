import type {
  PoseMovementContractRecord,
  PosePartialRepPolicy,
  PoseRepCountAt,
  PoseRepModel,
  PoseRequiredSides,
} from "@fittrack/types";

/**
 * Shared temporal/threshold policy for editable movement contracts.
 *
 * The engine and validators intentionally consume this same derived shape so
 * a contract cannot be accepted by the editor and interpreted differently at
 * runtime.  The five degree gap is a generic noise floor, not a family rule.
 */
export const POSE_REP_NOISE_FLOOR_DEGREES = 5;
export const POSE_REP_ENDPOINT_STREAK = 2;
export const POSE_REP_ENDPOINT_SPAN_MS = 60;
export const POSE_REP_MIN_CYCLE_MS = 400;
export const POSE_REP_MAX_FRAME_GAP_MS = 500;

export type PoseRepProgressDirection = "increase" | "decrease";
export type PoseRepPhaseOrder = {
  start: string;
  target: string;
  return: string;
};

export type PoseRepAcceptancePolicy = {
  errors: string[];
  valid: boolean;
  direction: PoseRepProgressDirection;
  startBand: { min: number; max: number };
  targetBand: { min: number; max: number };
  minTravel: number;
  endpointStreak: number;
  endpointSpanMs: number;
  minCycleMs: number;
  maxFrameGapMs: number;
  repModel: PoseRepModel;
  requiredSides: PoseRequiredSides;
  partialRepPolicy: PosePartialRepPolicy;
  countAt: PoseRepCountAt;
  phaseOrder: PoseRepPhaseOrder | null;
};

const ALLOWED_MODELS: readonly PoseRepModel[] = [
  "bilateral",
  "unilateral_left",
  "unilateral_right",
  "alternating",
  "static_hold",
];
const ALLOWED_SIDES: readonly PoseRequiredSides[] = [
  "both",
  "left",
  "right",
  "either",
  "alternating",
];
const ALLOWED_PARTIAL_POLICIES: readonly PosePartialRepPolicy[] = [
  "strict_full_rep",
  "count_half_reps",
  "review_only",
];

const START_PHASES = new Set(["setup", "start", "initial", "ready"]);
const TARGET_PHASES = new Set([
  "down",
  "peak",
  "target",
  "contraction",
  "pull",
  "press",
  "curl",
  "hinge",
  "extend",
  "raise",
  "crunch",
  "hold",
]);
const RETURN_PHASES = new Set([
  "up",
  "return",
  "release",
  "stand",
  "lower",
  "end",
  "exit",
]);

function normalizedPhase(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function derivePhaseOrder(
  contract: PoseMovementContractRecord,
  errors: string[],
): PoseRepPhaseOrder | null {
  const phases = contract.phaseOrder;
  if (!Array.isArray(phases) || phases.length !== 3) {
    errors.push("phase_order_unsupported");
    return null;
  }
  const [start, target, returnPhase] = phases.map(normalizedPhase);
  if (
    !START_PHASES.has(start) ||
    !TARGET_PHASES.has(target) ||
    !RETURN_PHASES.has(returnPhase)
  ) {
    errors.push("phase_order_unsupported");
    return null;
  }
  return { start, target, return: returnPhase };
}

function validFinite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function deriveBand(
  angle: number,
  tolerance: number,
): { min: number; max: number } {
  return { min: angle - tolerance, max: angle + tolerance };
}

/**
 * Stable semantic identity for a normalized contract. The engine uses this
 * to invalidate an in-flight cycle when a caller reuses state for a changed
 * contract, without changing persisted contract data.
 */
export function getPoseRepContractFingerprint(
  contract: PoseMovementContractRecord,
): string {
  return JSON.stringify({
    exercise: contract.exercise,
    dominantJoint: contract.dominantJoint,
    shoulderReference: contract.dominantJoint === "shoulder" ? contract.shoulderReference ?? "torso" : undefined,
    primaryJoints: contract.primaryJoints,
    secondaryCheck: contract.secondaryCheck,
    secondaryJoints: contract.secondaryJoints,
    oscillatingJoints: contract.oscillatingJoints,
    noCountConditions: contract.noCountConditions,
    degradedConditions: contract.degradedConditions,
    repModel: contract.repModel,
    requiredSides: contract.requiredSides,
    partialRepPolicy: contract.partialRepPolicy,
    countAt: contract.countAt,
    phaseOrder: contract.phaseOrder,
    repThresholds: contract.repThresholds,
    bodyOrientation: contract.bodyOrientation,
    trackingRequirements: contract.trackingRequirements,
    spatialRequirements: contract.spatialRequirements,
    holdDurationSeconds: contract.holdDurationSeconds,
  }, (_key, value) => value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
    : value);
}

/** Return one policy for the exact values that runtime acceptance uses. */
export function getPoseRepAcceptancePolicy(
  contract: PoseMovementContractRecord,
): PoseRepAcceptancePolicy {
  const errors: string[] = [];
  const repModel = contract.repModel ?? "unknown";
  const requiredSides = contract.requiredSides ?? "either";
  const partialRepPolicy = contract.partialRepPolicy ?? "strict_full_rep";
  // Legacy half-rep records already counted at the target. Keep that timing
  // until edited; new definitions choose timing independently of the range.
  const countAt = contract.countAt ??
    (partialRepPolicy === "count_half_reps" ? "peak" : "return");
  const down = contract.repThresholds?.down;
  const up = contract.repThresholds?.up;
  const downAngle = down?.angle;
  const upAngle = up?.angle;
  const downTolerance = down?.tolerance;
  const upTolerance = up?.tolerance;

  if (!ALLOWED_MODELS.includes(repModel)) errors.push("rep_model_unsupported");
  if (!ALLOWED_SIDES.includes(requiredSides)) {
    errors.push("required_sides_unsupported");
  }
  if (!ALLOWED_PARTIAL_POLICIES.includes(partialRepPolicy)) {
    errors.push("partial_rep_policy_unsupported");
  }
  if (countAt !== "peak" && countAt !== "return") {
    errors.push("count_at_unsupported");
  }
  if (
    repModel === "unilateral_left" &&
    requiredSides !== "left" &&
    requiredSides !== "either"
  ) {
    errors.push("unilateral_left_requires_left_side");
  }
  if (
    repModel === "unilateral_right" &&
    requiredSides !== "right" &&
    requiredSides !== "either"
  ) {
    errors.push("unilateral_right_requires_right_side");
  }
  if (
    repModel === "alternating" &&
    requiredSides !== "alternating"
  ) {
    errors.push("alternating_requires_alternating_sides");
  }
  if (
    repModel === "bilateral" &&
    requiredSides === "alternating"
  ) {
    errors.push("bilateral_cannot_use_alternating_sides");
  }
  if (repModel === "static_hold" && partialRepPolicy === "count_half_reps") {
    errors.push("static_hold_does_not_support_count_half_reps");
  }
  if (!validFinite(downAngle) || !validFinite(upAngle)) {
    errors.push("rep_thresholds_missing");
  }
  if (
    !validFinite(downTolerance) ||
    !validFinite(upTolerance) ||
    (downTolerance as number) < 0 ||
    (upTolerance as number) < 0
  ) {
    errors.push("rep_tolerance_invalid");
  }
  if (
    (validFinite(downAngle) &&
      ((downAngle as number) < 0 || (downAngle as number) > 180)) ||
    (validFinite(upAngle) &&
      ((upAngle as number) < 0 || (upAngle as number) > 180))
  ) {
    errors.push("rep_angle_out_of_range");
  }

  const direction: PoseRepProgressDirection =
    validFinite(downAngle) && validFinite(upAngle) &&
    (downAngle as number) >= (upAngle as number)
      ? "increase"
      : "decrease";
  const startBand = deriveBand(
    validFinite(upAngle) ? (upAngle as number) : 0,
    validFinite(upTolerance) && (upTolerance as number) >= 0
      ? (upTolerance as number)
      : 0,
  );
  const targetBand = deriveBand(
    validFinite(downAngle) ? (downAngle as number) : 0,
    validFinite(downTolerance) && (downTolerance as number) >= 0
      ? (downTolerance as number)
      : 0,
  );
  if (
    repModel !== "static_hold" &&
    validFinite(downAngle) &&
    validFinite(upAngle)
  ) {
    const gap =
      direction === "increase"
        ? targetBand.min - startBand.max
        : startBand.min - targetBand.max;
    if (gap <= 0) errors.push("phase_acceptance_bands_overlap");
    else if (gap < POSE_REP_NOISE_FLOOR_DEGREES) {
      errors.push("phase_acceptance_bands_too_close");
    }
  }

  const phaseOrder = derivePhaseOrder(contract, errors);
  const acceptedBandSeparation =
    direction === "increase"
      ? targetBand.min - startBand.max
      : startBand.min - targetBand.max;
  return {
    errors: Array.from(new Set(errors)),
    valid: errors.length === 0,
    direction,
    startBand,
    targetBand,
    minTravel:
      validFinite(downAngle) && validFinite(upAngle)
        ? Math.max(POSE_REP_NOISE_FLOOR_DEGREES, acceptedBandSeparation)
        : Number.POSITIVE_INFINITY,
    endpointStreak: POSE_REP_ENDPOINT_STREAK,
    endpointSpanMs: POSE_REP_ENDPOINT_SPAN_MS,
    minCycleMs: POSE_REP_MIN_CYCLE_MS,
    maxFrameGapMs: POSE_REP_MAX_FRAME_GAP_MS,
    repModel,
    requiredSides,
    partialRepPolicy,
    countAt,
    phaseOrder,
  };
}

export function validatePoseRepAcceptancePolicy(
  contract: PoseMovementContractRecord,
) {
  return getPoseRepAcceptancePolicy(contract).errors;
}
