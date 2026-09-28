export const POST_TARGET_IDLE_GRACE_MS = 10_000;
export const AUTO_FINISH_WARNING_MS = 5_000;

export type WorkoutAutoFinishStatus =
  | "ineligible"
  | "grace"
  | "warning"
  | "complete";

export type WorkoutAutoFinishEvaluation = {
  elapsedMs: number | null;
  status: WorkoutAutoFinishStatus;
  warningSeconds: number | null;
};

export type WorkoutAutoFinishInput = {
  lastActivityAtMs: number | null;
  nowMs: number;
  repCount: number;
  targetReps: number;
  isCameraSwitching?: boolean;
  isConfirmationBlocking?: boolean;
  isRepInProgress?: boolean;
  isRecording?: boolean;
  isRuntimeTracking?: boolean;
  isStaticHold?: boolean;
  isTrackingReliable?: boolean;
};

/**
 * Evaluates the post-target idle window without owning any timers or UI state.
 * Callers can pause or reset the window by withholding a safe activity
 * timestamp, or by passing one of the runtime safety gates as false.
 */
export function getWorkoutAutoFinishEvaluation({
  isCameraSwitching = false,
  isConfirmationBlocking = false,
  isRepInProgress = false,
  isRecording = true,
  isRuntimeTracking = true,
  isStaticHold = false,
  isTrackingReliable = true,
  lastActivityAtMs,
  nowMs,
  repCount,
  targetReps,
}: WorkoutAutoFinishInput): WorkoutAutoFinishEvaluation {
  const isEligible =
    !isStaticHold &&
    Number.isFinite(targetReps) &&
    targetReps > 0 &&
    Number.isFinite(repCount) &&
    repCount >= targetReps &&
    Number.isFinite(lastActivityAtMs) &&
    isTrackingReliable &&
    isRecording &&
    isRuntimeTracking &&
    !isRepInProgress &&
    !isCameraSwitching &&
    !isConfirmationBlocking;

  if (!isEligible || lastActivityAtMs === null) {
    return { elapsedMs: null, status: "ineligible", warningSeconds: null };
  }

  const elapsedMs = Math.max(0, nowMs - lastActivityAtMs);
  const warningStartMs = POST_TARGET_IDLE_GRACE_MS;
  const warningEndMs = warningStartMs + AUTO_FINISH_WARNING_MS;
  if (elapsedMs < warningStartMs) {
    return { elapsedMs, status: "grace", warningSeconds: null };
  }
  if (elapsedMs < warningEndMs) {
    return {
      elapsedMs,
      status: "warning",
      warningSeconds: Math.max(
        1,
        Math.ceil((warningEndMs - elapsedMs) / 1000),
      ),
    };
  }

  return { elapsedMs, status: "complete", warningSeconds: null };
}
