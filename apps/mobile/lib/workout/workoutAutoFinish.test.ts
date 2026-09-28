import {
  AUTO_FINISH_WARNING_MS,
  POST_TARGET_IDLE_GRACE_MS,
  getWorkoutAutoFinishEvaluation,
} from "./workoutAutoFinish";
import {
  getWorkoutCameraRestLabel,
  shouldAutoResumeWorkoutCamera,
  type WorkoutCameraTarget,
} from "../../components/workout/workout-camera-target";

function assertEqual(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function assertDeepEqual(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function test(name: string, callback: () => void) {
  try {
    callback();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${name}: ${detail}`);
  }
}

const assert = { deepEqual: assertDeepEqual, equal: assertEqual };

const baseInput = {
  isRecording: true,
  isRuntimeTracking: true,
  isTrackingReliable: true,
  lastActivityAtMs: 0,
  nowMs: 0,
  repCount: 12,
  targetReps: 12,
};

test("does not auto-finish a below-target set after a long idle", () => {
  const result = getWorkoutAutoFinishEvaluation({
    ...baseInput,
    nowMs: POST_TARGET_IDLE_GRACE_MS + AUTO_FINISH_WARNING_MS + 1,
    repCount: 8,
  });

  assert.equal(result.status, "ineligible");
  assert.equal(result.warningSeconds, null);
});

test("keeps target-reached sets quiet during the ten-second grace period", () => {
  const result = getWorkoutAutoFinishEvaluation({
    ...baseInput,
    nowMs: POST_TARGET_IDLE_GRACE_MS - 1,
  });

  assert.equal(result.status, "grace");
  assert.equal(result.warningSeconds, null);
});

test("shows a five-second warning, then completes at fifteen seconds", () => {
  const warning = getWorkoutAutoFinishEvaluation({
    ...baseInput,
    nowMs: POST_TARGET_IDLE_GRACE_MS,
  });
  const finalWarning = getWorkoutAutoFinishEvaluation({
    ...baseInput,
    nowMs: POST_TARGET_IDLE_GRACE_MS + AUTO_FINISH_WARNING_MS - 1,
  });
  const complete = getWorkoutAutoFinishEvaluation({
    ...baseInput,
    nowMs: POST_TARGET_IDLE_GRACE_MS + AUTO_FINISH_WARNING_MS,
  });

  assert.deepEqual(
    { status: warning.status, warningSeconds: warning.warningSeconds },
    { status: "warning", warningSeconds: 5 },
  );
  assert.equal(finalWarning.warningSeconds, 1);
  assert.equal(complete.status, "complete");
});

test("preserves actual reps above the target while remaining eligible", () => {
  const result = getWorkoutAutoFinishEvaluation({
    ...baseInput,
    nowMs: POST_TARGET_IDLE_GRACE_MS,
    repCount: 15,
  });

  assert.equal(result.status, "warning");
  assert.equal(result.warningSeconds, 5);
});

test("pauses completion for unreliable, paused, switching, or blocked tracking", () => {
  for (const gate of [
    { isTrackingReliable: false },
    { isRecording: false },
    { isRuntimeTracking: false },
    { isCameraSwitching: true },
    { isConfirmationBlocking: true },
    { isRepInProgress: true },
    { isStaticHold: true },
  ]) {
    const result = getWorkoutAutoFinishEvaluation({
      ...baseInput,
      ...gate,
      nowMs: POST_TARGET_IDLE_GRACE_MS + AUTO_FINISH_WARNING_MS + 1,
    });
    assert.equal(result.status, "ineligible");
    assert.equal(result.warningSeconds, null);
  }
});

function makeTarget(exerciseId: string): WorkoutCameraTarget {
  return {
    completeWorkoutAfterSet: false,
    exerciseId,
    exerciseName: exerciseId,
    nextTarget: null,
    planExerciseId: `${exerciseId}-plan`,
    planId: "plan-1",
    planTitle: "Plan",
    restSeconds: 60,
    sessionId: "session-1",
    setNumber: 1,
    targetDurationSeconds: null,
    targetReps: 12,
    targetWeightKg: null,
    totalSets: 2,
  };
}

test("uses the existing rest clock for REST and GET READY labels", () => {
  assert.equal(getWorkoutCameraRestLabel(60), "REST 60s");
  assert.equal(getWorkoutCameraRestLabel(6), "REST 6s");
  assert.equal(getWorkoutCameraRestLabel(5), "GET READY 5s");
  assert.equal(getWorkoutCameraRestLabel(1), "GET READY 1s");
  assert.equal(getWorkoutCameraRestLabel(0), "REST COMPLETE");
});

test("only the same exercise is eligible for automatic next-set start", () => {
  const current = makeTarget("push-up");

  assert.equal(
    shouldAutoResumeWorkoutCamera(current, makeTarget("push-up")),
    true,
  );
  assert.equal(
    shouldAutoResumeWorkoutCamera(current, makeTarget("shoulder-press")),
    false,
  );
  assert.equal(shouldAutoResumeWorkoutCamera(current, null), false);
});
