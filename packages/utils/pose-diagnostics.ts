import type { ExerciseRigRecord, PoseMovementContractRecord } from "@fittrack/types";
import { getPoseMovementContractSideAngles, getPoseMovementFrameAssessment, getPoseTorsoSlopeAngles, getPoseTorsoSlopeRange, getPoseBodyLineScope } from "./pose";
import { getPoseFrameGeometry, getRigMovementContract, getRigUpperArmPhaseMatch } from "./pose-rig";
import { getPoseRepAcceptancePolicy } from "./pose-rep-policy";
import { getPoseRepProgressText } from "./pose-rep-engine";
import type { PoseRepEngineEvidence, PoseRepEngineState } from "./pose-rep-engine";

type PoseDiagnosticInput = {
  reason: string | null;
  timestamp: number;
  state: PoseRepEngineState;
  previousState?: PoseRepEngineState;
  contract: PoseMovementContractRecord | null;
  rig?: ExerciseRigRecord | null;
  evidence?: PoseRepEngineEvidence;
  context?: Record<string, unknown>;
};

/** Console-only, bounded diagnostics. No video, uploads, or per-frame logging. */
export function createPoseDiagnostics(
  source: string,
  write: (prefix: string, json: string) => void = (prefix, json) => console.info(prefix, json),
) {
  let lastAt = -Infinity;
  let lastKey = "";
  let lastCount = 0;
  let lastFrameAt: number | null = null;
  const blocked: Record<string, number> = {};
  return (input: PoseDiagnosticInput) => {
    const { state, previousState, evidence, timestamp, reason } = input;
    const previousFrameAt = previousState?.lastProcessedAtMs ?? lastFrameAt;
    lastFrameAt = timestamp;
    if (reason) blocked[reason] = (blocked[reason] ?? 0) + 1;
    const key = `${reason}:${state.phase}:${state.repCount}`;
    const countChanged = state.repCount !== lastCount;
    // Camera timestamps can lag behind wall time or repeat during a stall.
    // Throttle by logging time so those frames cannot flood the console.
    const now = Date.now();
    const elapsed = now - lastAt;
    if (!countChanged && elapsed >= 0 && (elapsed < 250 || (key === lastKey && elapsed < 1000))) return;
    lastAt = now; lastKey = key; lastCount = state.repCount;
    // Compute diagnostic geometry only for emitted snapshots, not every frame.
    const contract = input.contract ? getRigMovementContract(input.contract, input.rig) : null;
    const policy = contract ? getPoseRepAcceptancePolicy(contract) : null;
    const geometry = evidence?.keypoints ? getPoseFrameGeometry({ keypoints: evidence.keypoints, spatialKeypoints: evidence.spatialKeypoints }, evidence.coordinateDimensions) : null;
    const angles = contract && geometry ? getPoseMovementContractSideAngles(contract, geometry.keypoints, geometry.dimensions) : null;
    const visibility = contract && evidence?.keypoints ? getPoseMovementFrameAssessment(contract, evidence.keypoints, evidence.coordinateDimensions) : null;
    const rounded = (value: number | null | undefined) => typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
    const snapshot = {
      ...input.context,
      event: countChanged ? "count_changed" : reason ? "blocked" : "frame",
      reason,
      blockedSinceLastLog: { ...blocked },
      at: timestamp,
      frameGapMs: previousFrameAt == null ? null : timestamp - previousFrameAt,
      phase: state.phase,
      reps: state.repCount,
      selectedSide: state.selectedSide,
      angles: angles ? { left: rounded(angles.left), right: rounded(angles.right) } : null,
      angleSpace: evidence?.spatialKeypoints ? "world-3d" : "image-2d",
      waitingFor: contract && geometry ? getPoseRepProgressText(state, contract, geometry.keypoints, geometry.dimensions) : null,
      endpoints: state.sideEndpointState,
      observedRange: { min: rounded(state.currentLowAngle), max: rounded(state.currentHighAngle) },
      visibility,
      exercise: contract?.exercise,
      configuredTargets: input.contract?.repThresholds,
      shoulderReference: contract?.dominantJoint === "shoulder" ? contract.shoulderReference ?? "torso" : undefined,
      effectiveTargets: contract?.repThresholds,
      referenceMotion: contract && geometry ? getRigUpperArmPhaseMatch(contract,input.rig,geometry.keypoints,geometry.dimensions) : null,
      requiredSides: contract?.requiredSides,
      partialRepPolicy: contract?.partialRepPolicy,
      rules: policy,
      safeguards: contract?.spatialRequirements,
      posture: contract ? {
        orientation: contract.bodyOrientation,
        scope: getPoseBodyLineScope(contract),
        torsoRange: getPoseTorsoSlopeRange(contract),
        angleSpace: evidence?.spatialKeypoints ? "world-3d" : "image-2d",
        torsoAngles: geometry ? getPoseTorsoSlopeAngles(contract, geometry.keypoints, geometry.dimensions) : null,
        imageTorsoAngles: evidence?.keypoints ? getPoseTorsoSlopeAngles(contract, evidence.keypoints, evidence.coordinateDimensions) : null,
      } : null,
    };
    for (const key of Object.keys(blocked)) delete blocked[key];
    // Serialize now: expanding a console entry later must not show mutated refs.
    write(`[FitTrack pose:${source}]`, JSON.stringify(snapshot));
  };
}
