import type { PoseMovementContractRecord } from "@fittrack/types";
import { getPoseRepAcceptancePolicy } from "@fittrack/utils/pose-rep-policy";

export type DynamicGateState = "waiting" | "armed" | "moving" | "target" | "returning" | "unreliable";

/** Short copy for the existing status badge, using the actual blocked rule. */
export function getRepGateBlockedCopy(statusText: string | null | undefined, missing: string[]) {
  const status = statusText?.toLowerCase().replace(/[_-]/g, " ") ?? "";
  if (status.includes("body line") || status.includes("body orientation") || status.includes("torso slope")) {
    return { label: "Check body alignment", support: "Match saved posture" };
  }
  if (status.includes("side symmetry") || status.includes("phase desync")) {
    return { label: "Move both arms", support: "Keep them aligned" };
  }
  if (missing.some(name => name.endsWith("hip"))) return { label: "Show hips", support: "Required for tracking" };
  if (missing.some(name => name.endsWith("wrist"))) return { label: "Show wrists", support: "Keep arms in frame" };
  if (missing.some(name => name.endsWith("elbow"))) return { label: "Show elbows", support: "Keep arms in frame" };
  return null;
}

export function getRepGateProgress(angle: number | null, contract: PoseMovementContractRecord | null) {
  if (angle === null || !Number.isFinite(angle) || !contract) return .5;
  const policy = getPoseRepAcceptancePolicy(contract);
  if (!policy.valid) return .5;
  const start = policy.direction === "decrease" ? policy.startBand.min : policy.startBand.max;
  const target = policy.direction === "decrease" ? policy.targetBand.max : policy.targetBand.min;
  const span = target - start;
  if (Math.abs(span) < .001) return .5;
  return Math.max(0, Math.min(1, (angle - start) / span));
}

export function getRepGateState(input: {
  currentAngle: number | null; currentPhase: string; hasLiveKeypoints: boolean;
  lowConfidence: boolean; progress: number; repPathUnblocked: boolean;
}): DynamicGateState {
  if (input.lowConfidence || !input.repPathUnblocked) return "unreliable";
  if (!input.hasLiveKeypoints || input.currentAngle === null) return "waiting";
  // A measured angle alone is not an accepted endpoint. Use engine phase.
  if (input.currentPhase === "down") return input.progress <= .2 ? "armed" : "moving";
  if (input.currentPhase === "up") return input.progress >= .9 ? "target" : "returning";
  return "waiting";
}

export function getRepGateGeometry(startCenter: number, targetCenter: number, progress: number) {
  const top = Math.min(startCenter, targetCenter);
  const bottom = Math.max(startCenter, targetCenter);
  const bounded = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
  const center = bottom - bounded * (bottom - top);
  return { top, height: bottom - top, center, fillHeight: bottom - center };
}
