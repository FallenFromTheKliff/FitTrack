import type {
  ExerciseRigRecord,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  PoseSequenceFrameRecord,
} from "@fittrack/types";
import {
  angleAtPoint,
  getPoseMovementContractAngle,
  getPoseMovementContractSideAngles,
} from "./pose";
import type { PoseCoordinateDimensions } from "./pose";

const SPATIAL_DIMENSIONS = { width: 1, height: 1, depthScale: 1 };
type Side = "left" | "right";

/** Upper-arm position relative to the shoulder line; no hip or camera-up axis. */
export function getPoseUpperArmAngles(
  keypoints: PoseKeypointRecord[] | null | undefined,
  minConfidence = 0.6,
  dimensions?: PoseCoordinateDimensions,
) {
  const angle = (side: Side) => {
    const offset = side === "left" ? 0 : 1;
    const indexes = [12 - offset, 11 + offset, 13 + offset];
    const points = indexes.map((index) => keypoints?.[index]);
    if (
      points.some(
        (point) =>
          !point ||
          point.visibility < minConfidence ||
          ![point.x, point.y, point.z].every(Number.isFinite),
      )
    )
      return null;
    return angleAtPoint(points[0]!, points[1]!, points[2]!, dimensions);
  };
  return { left: angle("left"), right: angle("right") };
}

/** Only explicitly moving upper arms contribute a second reference measure. */
export function getRigUpperArmReference(
  contract: PoseMovementContractRecord,
  rig?: ExerciseRigRecord | null,
) {
  if (
    !rig ||
    contract.dominantJoint !== "elbow" ||
    !contract.oscillatingJoints?.includes("shoulder") ||
    !contract.repThresholds?.up ||
    !contract.repThresholds?.down
  )
    return null;
  const start = rig.keyframes.find((frame) => frame.kind === "start");
  const target = rig.keyframes.find((frame) => frame.kind === "peak");
  if (!start || !target) return null;
  const from = getPoseUpperArmAngles(start.keypoints, 0, SPATIAL_DIMENSIONS);
  const to = getPoseUpperArmAngles(target.keypoints, 0, SPATIAL_DIMENSIONS);
  const travel = (side: Side) =>
    from[side] == null || to[side] == null
      ? 0
      : Math.abs(to[side]! - from[side]!);
  const referenceSide: Side =
    travel("right") > travel("left") ? "right" : "left";
  if (travel(referenceSide) < 5) return null;
  const required = (side: Side) => {
    const selected =
      contract.requiredSides === "either" ||
      contract.requiredSides === "alternating" ||
      contract.repModel === "alternating"
        ? referenceSide
        : side;
    const startAngle = from[selected],
      targetAngle = to[selected];
    if (startAngle == null || targetAngle == null) return null;
    // Reuse the authored endpoint tolerances, capped so a stationary upper
    // arm cannot satisfy both ends of a shorter movement reference.
    const maxTolerance = Math.abs(targetAngle - startAngle) * 0.4;
    return {
      start: startAngle,
      target: targetAngle,
      startTolerance: Math.min(
        contract.repThresholds.up.tolerance,
        maxTolerance,
      ),
      targetTolerance: Math.min(
        contract.repThresholds.down.tolerance,
        maxTolerance,
      ),
    };
  };
  return { left: required("left"), right: required("right") };
}

export function getRigUpperArmPhaseMatch(
  contract: PoseMovementContractRecord,
  rig: ExerciseRigRecord | null | undefined,
  keypoints: PoseKeypointRecord[] | null | undefined,
  dimensions?: PoseCoordinateDimensions,
) {
  const reference = getRigUpperArmReference(contract, rig);
  if (!reference) return null;
  const angles = getPoseUpperArmAngles(
    keypoints,
    contract.trackingRequirements?.minConfidence ?? 0.6,
    dimensions,
  );
  const matches = (side: Side, phase: "start" | "target") => {
    const rule = reference[side],
      angle = angles[side];
    if (!rule || angle == null) return false;
    return phase === "start"
      ? rule.target > rule.start
        ? angle <= rule.start + rule.startTolerance
        : angle >= rule.start - rule.startTolerance
      : rule.target > rule.start
        ? angle >= rule.target - rule.targetTolerance
        : angle <= rule.target + rule.targetTolerance;
  };
  return {
    reference,
    angles,
    start: { left: matches("left", "start"), right: matches("right", "start") },
    target: {
      left: matches("left", "target"),
      right: matches("right", "target"),
    },
  };
}

/** Detector coordinates stay untouched for drawing and visibility checks. */
export function getPoseFrameGeometry(
  frame: Pick<PoseSequenceFrameRecord, "keypoints" | "spatialKeypoints">,
  dimensions?: PoseCoordinateDimensions,
) {
  const spatial = frame.spatialKeypoints;
  const usable =
    spatial?.length === 33 &&
    spatial.every((point) =>
      [point.x, point.y, point.z, point.visibility].every(Number.isFinite),
    );
  // Missing depth retains the established 2D path. Malformed supplied depth
  // invalidates this frame instead of silently switching counting geometry.
  if (spatial !== undefined)
    return { keypoints: usable ? spatial : [], dimensions: SPATIAL_DIMENSIONS };
  return { keypoints: frame.keypoints, dimensions };
}

export function getPoseFrameContractAngle(
  contract: PoseMovementContractRecord,
  frame: Pick<PoseSequenceFrameRecord, "keypoints" | "spatialKeypoints">,
  dimensions?: PoseCoordinateDimensions,
) {
  const geometry = getPoseFrameGeometry(frame, dimensions);
  return getPoseMovementContractAngle(
    contract,
    geometry.keypoints,
    geometry.dimensions,
  );
}

/** The saved phase geometry owns the target; tolerance still comes from its input field. */
export function getRigMovementContract(
  contract: PoseMovementContractRecord,
  rig?: ExerciseRigRecord | null,
): PoseMovementContractRecord {
  if (!rig) return contract; // Older API callers that only supply an angle contract.
  let referenceContract = contract;
  if (
    contract.requiredSides === "alternating" ||
    contract.requiredSides === "either"
  ) {
    const start = rig.keyframes.find((frame) => frame.kind === "start");
    const peak = rig.keyframes.find((frame) => frame.kind === "peak");
    if (start && peak) {
      const a = getPoseMovementContractSideAngles(contract, start.keypoints);
      const b = getPoseMovementContractSideAngles(contract, peak.keypoints);
      const travel = (side: "left" | "right") =>
        a[side] == null || b[side] == null ? -1 : Math.abs(b[side]! - a[side]!);
      referenceContract = {
        ...contract,
        requiredSides: travel("right") > travel("left") ? "right" : "left",
      };
    }
  }
  const phaseAngle = (kind: "start" | "peak") => {
    const frame = rig.keyframes.find((frame) => frame.kind === kind);
    const angle = frame
      ? getPoseMovementContractAngle(referenceContract, frame.keypoints)
      : null;
    // Trigonometry can produce 154.99999999999997 for an authored 155-degree
    // endpoint. Preserve the validator's exact separation requirement.
    return angle == null ? null : Math.round(angle * 1000) / 1000;
  };
  const start = phaseAngle("start"),
    target = phaseAngle("peak");
  return {
    ...contract,
    ...(getRigUpperArmReference(contract, rig) && contract.trackingRequirements
      ? {
          trackingRequirements: {
            ...contract.trackingRequirements,
            requiredLandmarks: [
              ...new Set([
                ...contract.trackingRequirements.requiredLandmarks,
                "left_shoulder",
                "right_shoulder",
              ]),
            ],
          },
        }
      : {}),
    repThresholds: {
      up: { ...contract.repThresholds.up, angle: start ?? Number.NaN },
      down: { ...contract.repThresholds.down, angle: target ?? Number.NaN },
    },
  };
}

/** Include reference edits in continuity checks, not only the old scalar thresholds. */
export function getRigFingerprint(rig?: ExerciseRigRecord | null) {
  return rig
    ? JSON.stringify(
        rig.keyframes.map((frame) => [
          frame.kind,
          frame.keypoints.map((point) => [
            point.x,
            point.y,
            point.z,
            point.visibility,
          ]),
        ]),
      )
    : "";
}
