import {
  DEFAULT_EXERCISE_SUBJECT_LOCK_GESTURE_PROFILE,
} from "@fittrack/utils";
import {
  SUBJECT_LOCK_FRESHNESS_MS,
  SUBJECT_LOCK_LOSS_GRACE_MS,
  advanceSubjectLockFrame,
  createSubjectLockState,
  invalidateSubjectLockState,
  isFreshSubjectLockCandidate,
  isCurrentSubjectLockObservation,
  isRockSignSubjectLockGestureWithProfile,
  manuallyLockSubject,
  manuallyUnlockSubject,
  stabilizeNativePoseFrame,
} from "./subjectLock";
import type { SubjectLockObservationStamp } from "./subjectLock";

type PoseKeypointRecord = {
  visibility: number;
  x: number;
  y: number;
  z: number;
};

type PoseSequenceFrameRecord = {
  capturedAtMs: number;
  keypoints: PoseKeypointRecord[];
};

type ExerciseSubjectLockGestureProfileRecord = {
  enabled: boolean;
  gesture: "rock_sign";
  handAboveShoulderOffset: number;
  handRaisedFromElbowOffset: number;
  holdMs: number;
  hornThumbLeadOffset: number;
  maxHornLiftDelta: number;
  minFingerDistance: number;
  minFingerLift: number;
  minFingerSpreadX: number;
  minThumbOffset: number;
  minThumbSeparation: number;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function assertClose(actual: number, expected: number, epsilon = 1e-9) {
  if (Math.abs(actual - expected) > epsilon) {
    throw new Error(`expected ${String(expected)}, got ${String(actual)}`);
  }
}

function observationStamp(
  capturedAtMs: number,
  generation: number,
  streamId: number,
): SubjectLockObservationStamp {
  return { capturedAtMs, generation, streamId };
}

type TestRegistrar = (name: string, callback: () => void) => unknown;
const jestTest = (globalThis as { test?: TestRegistrar }).test;

function test(name: string, callback: () => void) {
  if (jestTest) {
    jestTest(name, callback);
    return;
  }
  try {
    callback();
    passed += 1;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${detail}`);
  }
}

let passed = 0;
const failures: string[] = [];

type ProfileOverrides = Partial<ExerciseSubjectLockGestureProfileRecord>;
type RuntimeSubjectLockProfile = Parameters<
  typeof advanceSubjectLockFrame
>[1]["profile"];

function asRuntimeSubjectLockProfile(
  value: unknown,
): RuntimeSubjectLockProfile {
  return value as RuntimeSubjectLockProfile;
}

function makeProfile(
  overrides: ProfileOverrides = {},
): ExerciseSubjectLockGestureProfileRecord {
  return {
    ...DEFAULT_EXERCISE_SUBJECT_LOCK_GESTURE_PROFILE,
    ...overrides,
  };
}

function clonePose(keypoints: PoseKeypointRecord[]) {
  return keypoints.map((point) => ({ ...point }));
}

function makePose(options: { rock?: boolean; visibility?: number } = {}) {
  const visibility = options.visibility ?? 0.9;
  const pose = Array.from({ length: 33 }, (_, index) => ({
    visibility,
    x: 0.5 + (index % 3) * 0.01,
    y: 0.5 + Math.floor(index / 3) * 0.01,
    z: 0,
  }));

  const set = (index: number, x: number, y: number) => {
    pose[index] = { ...pose[index], x, y };
  };

  set(0, 0.5, 0.15);
  set(11, 0.42, 0.4);
  set(12, 0.58, 0.4);
  set(13, 0.37, 0.52);
  set(14, 0.63, 0.52);
  set(15, 0.32, options.rock ? 0.27 : 0.58);
  set(16, 0.68, 0.58);
  set(23, 0.45, 0.8);
  set(24, 0.55, 0.8);
  set(25, 0.44, 1.1);
  set(26, 0.56, 1.1);
  set(27, 0.43, 1.4);
  set(28, 0.57, 1.4);

  if (options.rock) {
    set(17, 0.2, 0.17);
    set(19, 0.34, 0.15);
    set(21, 0.27, 0.32);
  } else {
    set(17, 0.2, 0.6);
    set(19, 0.34, 0.64);
    set(21, 0.27, 0.58);
  }
  set(18, 0.7, 0.64);
  set(20, 0.74, 0.64);
  set(22, 0.67, 0.58);

  return pose;
}

function hidePose(keypoints: PoseKeypointRecord[]) {
  return keypoints.map((point) => ({ ...point, visibility: 0 }));
}

function transformPose(
  keypoints: PoseKeypointRecord[],
  scale: number,
  translateX: number,
  translateY: number,
) {
  const hipCenter = {
    x: (keypoints[23].x + keypoints[24].x) / 2,
    y: (keypoints[23].y + keypoints[24].y) / 2,
  };
  return keypoints.map((point) => ({
    ...point,
    x: hipCenter.x + (point.x - hipCenter.x) * scale + translateX,
    y: hipCenter.y + (point.y - hipCenter.y) * scale + translateY,
  }));
}

function makeDifferentBody(keypoints: PoseKeypointRecord[]) {
  const other = clonePose(keypoints);
  const set = (index: number, x: number, y: number) => {
    other[index] = { ...other[index], x, y };
  };

  // Keep the same visible rig while changing its normalized proportions.
  set(13, 0.1, 0.9);
  set(14, 0.9, 0.9);
  set(15, 0.05, 1.1);
  set(16, 0.95, 1.1);
  set(25, 0.25, 1.0);
  set(26, 0.75, 1.0);
  set(27, 0.05, 1.25);
  set(28, 0.95, 1.25);
  return other;
}

function makeDifferentRockBody(keypoints: PoseKeypointRecord[]) {
  const other = makeDifferentBody(keypoints);
  const set = (index: number, x: number, y: number) => {
    other[index] = { ...other[index], x, y };
  };

  // Keep the left hand as a valid rock sign while changing the body shape.
  set(15, 0.05, 0.1);
  set(17, 0, 0);
  set(19, 0.15, 0.02);
  set(21, 0.08, 0.17);
  return other;
}

function advance(
  state: ReturnType<typeof createSubjectLockState>,
  capturedAtMs: number,
  keypoints: PoseKeypointRecord[] | null,
  profile: ExerciseSubjectLockGestureProfileRecord = makeProfile(),
  nowMs = capturedAtMs,
) {
  return advanceSubjectLockFrame(state, {
    capturedAtMs,
    keypoints,
    nowMs,
    profile,
  });
}

function advanceWithRuntimeProfile(
  state: ReturnType<typeof createSubjectLockState>,
  capturedAtMs: number,
  keypoints: PoseKeypointRecord[] | null,
  profile: RuntimeSubjectLockProfile,
  nowMs = capturedAtMs,
) {
  return advanceSubjectLockFrame(state, {
    capturedAtMs,
    keypoints,
    nowMs,
    profile,
  });
}

function advanceContinuously(
  state: ReturnType<typeof createSubjectLockState>,
  fromMs: number,
  toMs: number,
  keypoints: PoseKeypointRecord[] | null,
  profile: ExerciseSubjectLockGestureProfileRecord = makeProfile(),
  stepMs = 250,
) {
  assert(toMs > fromMs, "continuous advance requires an increasing target time");
  let nextState = state;
  for (
    let capturedAtMs = fromMs + stepMs;
    capturedAtMs < toMs;
    capturedAtMs += stepMs
  ) {
    nextState = advance(nextState, capturedAtMs, keypoints, profile).nextState;
  }
  return advance(nextState, toMs, keypoints, profile);
}

function frame(
  capturedAtMs: number,
  keypoints: PoseKeypointRecord[],
): PoseSequenceFrameRecord {
  return { capturedAtMs, keypoints };
}

const defaultProfile = makeProfile();
const rockPose = makePose({ rock: true });
const neutralPose = makePose({ rock: false });

test("recognizes a valid rock sign and rejects a neutral hand", () => {
  assertEqual(
    isRockSignSubjectLockGestureWithProfile(rockPose, defaultProfile),
    true,
  );
  assertEqual(
    isRockSignSubjectLockGestureWithProfile(neutralPose, defaultProfile),
    false,
  );
});

test("manual lock requires a fresh visible candidate and works when gesture is disabled", () => {
  assertEqual(isFreshSubjectLockCandidate(neutralPose, 1_000, 1_000), true);
  assertEqual(
    isFreshSubjectLockCandidate(neutralPose, 1_000, 1_000 + SUBJECT_LOCK_FRESHNESS_MS + 1),
    false,
  );
  assertEqual(isFreshSubjectLockCandidate(hidePose(neutralPose), 1_000, 1_000), false);

  const fresh = manuallyLockSubject(createSubjectLockState(), {
    capturedAtMs: 1_000,
    keypoints: neutralPose,
    nowMs: 1_000,
  });
  assertEqual(fresh.status, "locked");
  assertEqual(fresh.nextState.locked, true);
  assertEqual(fresh.nextState.source, "manual");
  assertEqual(fresh.canCount, true);

  const stale = manuallyLockSubject(createSubjectLockState(), {
    capturedAtMs: 1_000,
    keypoints: neutralPose,
    nowMs: 1_000 + SUBJECT_LOCK_FRESHNESS_MS + 1,
  });
  assertEqual(stale.status, "off");
  assertEqual(stale.candidateFresh, false);
  assertEqual(stale.nextState.locked, false);

  const invisible = manuallyLockSubject(createSubjectLockState(), {
    capturedAtMs: 1_000,
    keypoints: hidePose(neutralPose),
    nowMs: 1_000,
  });
  assertEqual(invisible.status, "off");
  assertEqual(invisible.candidateFresh, false);
  assertEqual(invisible.nextState.locked, false);

  const disabledProfile = makeProfile({ enabled: false });
  const disabledManual = manuallyLockSubject(
    createSubjectLockState(disabledProfile),
    {
      capturedAtMs: 1_000,
      keypoints: neutralPose,
      nowMs: 1_000,
      profile: disabledProfile,
    },
  );
  assertEqual(disabledManual.status, "locked");
  assertEqual(disabledManual.nextState.source, "manual");
});

test("normalizes absent, legacy, and partial hand-shape profiles before locking", () => {
  const profiles: Array<{
    name: string;
    value: RuntimeSubjectLockProfile;
  }> = [
    { name: "undefined profile", value: undefined },
    { name: "null profile", value: null },
    {
      name: "legacy grip-only profile",
      value: asRuntimeSubjectLockProfile({ grip: "neutral" }),
    },
    {
      name: "undefined camel gesture profile",
      value: asRuntimeSubjectLockProfile({
        grip: "neutral",
        subjectLockGesture: undefined,
      }),
    },
    {
      name: "null snake gesture profile",
      value: asRuntimeSubjectLockProfile({
        grip: "neutral",
        subject_lock_gesture: null,
      }),
    },
    {
      name: "partial nested gesture profile",
      value: asRuntimeSubjectLockProfile({
        grip: "neutral",
        subjectLockGesture: { holdMs: 1_000 },
      }),
    },
  ];

  for (const entry of profiles) {
    const transition = advanceWithRuntimeProfile(
      createSubjectLockState(entry.value),
      0,
      rockPose,
      entry.value,
    );
    assertEqual(transition.status, "holding", `${entry.name} gesture status`);
    assertEqual(
      transition.nextState.locked,
      false,
      `${entry.name} should not lock before its hold threshold`,
    );

    const manual = manuallyLockSubject(createSubjectLockState(entry.value), {
      capturedAtMs: 1_000,
      keypoints: neutralPose,
      nowMs: 1_000,
      profile: entry.value,
    });
    assertEqual(manual.status, "locked", `${entry.name} manual status`);
    assertEqual(manual.canCount, true, `${entry.name} manual count gate`);
  }

  const legacyProfile = asRuntimeSubjectLockProfile({ grip: "neutral" });
  const stale = manuallyLockSubject(createSubjectLockState(legacyProfile), {
    capturedAtMs: 1_000,
    keypoints: neutralPose,
    nowMs: 1_000 + SUBJECT_LOCK_FRESHNESS_MS + 1,
    profile: legacyProfile,
  });
  assertEqual(stale.status, "off", "legacy stale candidate status");
  assertEqual(stale.candidateFresh, false, "legacy stale candidate gate");

  const directCustom = asRuntimeSubjectLockProfile({
    enabled: true,
    holdMs: 1_000,
  });
  const customStart = advanceWithRuntimeProfile(
    createSubjectLockState(directCustom),
    0,
    rockPose,
    directCustom,
  );
  let customTransition = customStart;
  for (const capturedAtMs of [250, 500, 750]) {
    customTransition = advanceWithRuntimeProfile(
      customTransition.nextState,
      capturedAtMs,
      rockPose,
      directCustom,
    );
    assertEqual(
      customTransition.nextState.locked,
      false,
      `direct custom remains unlocked at ${capturedAtMs}ms`,
    );
  }
  const customLocked = advanceWithRuntimeProfile(
    customTransition.nextState,
    1_000,
    rockPose,
    directCustom,
  );
  assertEqual(customLocked.status, "locked", "direct custom hold threshold");

  const disabledNested = asRuntimeSubjectLockProfile({
    grip: "neutral",
    subject_lock_gesture: { enabled: false },
  });
  const disabledGesture = advanceWithRuntimeProfile(
    createSubjectLockState(disabledNested),
    0,
    rockPose,
    disabledNested,
  );
  assertEqual(disabledGesture.status, "off", "nested disabled gesture status");
  assertEqual(disabledGesture.gestureActive, false, "nested disabled gesture gate");
  const disabledManual = manuallyLockSubject(createSubjectLockState(disabledNested), {
    capturedAtMs: 1_000,
    keypoints: neutralPose,
    nowMs: 1_000,
    profile: disabledNested,
  });
  assertEqual(disabledManual.status, "locked", "nested disabled manual status");
  assertEqual(disabledManual.canCount, true, "nested disabled manual count gate");
});

test("honors the default, saved, and overridden hold thresholds", () => {
  for (const holdMs of [3_000, 1_000, 5_000]) {
    const profile = makeProfile({ holdMs });
    const seeded = createSubjectLockState(profile);
    const first = advance(seeded, 0, rockPose, profile);
    assertEqual(
      first.status,
      "holding",
      `hold ${holdMs} first`,
    );
    assertEqual(first.nextState.locked, false);

    const almost = advanceContinuously(
      first.nextState,
      0,
      holdMs - 1,
      rockPose,
      profile,
    );
    assertEqual(almost.status, "holding", `hold ${holdMs} almost`);
    assertEqual(almost.nextState.locked, false);
    assertEqual(almost.nextState.gestureProgress < 1, true);

    const locked = advanceContinuously(
      almost.nextState,
      holdMs - 1,
      holdMs,
      rockPose,
      profile,
    );
    assertEqual(locked.status, "locked", `hold ${holdMs} lock`);
    assertEqual(locked.nextState.locked, true);
    assertEqual(locked.nextState.source, "gesture");
    assertEqual(locked.canCount, true);
  }

  const override = makeProfile({ holdMs: 500 });
  const start = advance(createSubjectLockState(override), 0, rockPose, override);
  const halfway = advanceContinuously(
    start.nextState,
    0,
    250,
    rockPose,
    override,
  );
  assertClose(halfway.nextState.gestureProgress, 0.5);
  assertEqual(
    advanceContinuously(halfway.nextState, 250, 500, rockPose, override).status,
    "locked",
  );
});

test("disabled gesture never acquires a gesture lock", () => {
  const profile = makeProfile({ enabled: false, holdMs: 1 });
  const first = advance(createSubjectLockState(profile), 0, rockPose, profile);
  const later = advance(first.nextState, 5_000, rockPose, profile);
  assertEqual(first.gestureActive, false);
  assertEqual(first.status, "off");
  assertEqual(later.status, "off");
  assertEqual(later.nextState.locked, false);
  assertEqual(later.canCount, false);
});

test("changing the gesture profile restarts the hold from zero", () => {
  const initial = advance(
    createSubjectLockState(defaultProfile),
    0,
    rockPose,
    defaultProfile,
  );
  const held = advanceContinuously(
    initial.nextState,
    0,
    2_000,
    rockPose,
    defaultProfile,
  );
  assertEqual(held.status, "holding");
  assertEqual(held.nextState.gestureProgress > 0, true);

  const changedProfile = makeProfile({ holdMs: 1_000 });
  const changed = advance(
    held.nextState,
    2_100,
    rockPose,
    changedProfile,
  );
  assertEqual(changed.status, "off");
  assertEqual(changed.nextState.locked, false);
  assertEqual(changed.nextState.gestureProgress, 0);
  assertEqual(changed.nextState.gestureStartMs, null);

  const restarted = advance(changed.nextState, 2_200, rockPose, changedProfile);
  const almost = advanceContinuously(
    restarted.nextState,
    2_200,
    3_199,
    rockPose,
    changedProfile,
  );
  assertEqual(almost.status, "holding");
  assertEqual(almost.nextState.locked, false);
  assertEqual(
    advanceContinuously(
      almost.nextState,
      3_199,
      3_200,
      rockPose,
      changedProfile,
    ).status,
    "locked",
  );
});

test("gesture breaks, null frames, stale samples, nonmonotonic frames, and long gaps reset the hold", () => {
  const cases: Array<{
    name: string;
    capturedAtMs: number;
    keypoints: PoseKeypointRecord[] | null;
    nowMs?: number;
  }> = [
    { name: "gesture break", capturedAtMs: 100, keypoints: neutralPose },
    { name: "null frame", capturedAtMs: 100, keypoints: null },
    {
      name: "stale sample",
      capturedAtMs: 100,
      keypoints: rockPose,
      nowMs: 100 + SUBJECT_LOCK_FRESHNESS_MS + 1,
    },
  ];

  for (const entry of cases) {
    const first = advance(createSubjectLockState(defaultProfile), 0, rockPose);
    const broken = advance(
      first.nextState,
      entry.capturedAtMs,
      entry.keypoints,
      defaultProfile,
      entry.nowMs,
    );
    assertEqual(
      broken.status,
      entry.name === "gesture break" ? "off" : "interrupted",
      `${entry.name} status`,
    );
    assertEqual(
      broken.resetRepCycle,
      entry.name !== "gesture break",
      `${entry.name} reset cycle`,
    );
    assertEqual(broken.nextState.gestureProgress, 0, `${entry.name} progress`);
    assertEqual(broken.nextState.gestureStartMs, null, `${entry.name} start`);

    const resumed = advance(broken.nextState, entry.capturedAtMs + 1, rockPose);
    assertEqual(resumed.status, "holding", `${entry.name} resumes holding`);
    assertEqual(resumed.nextState.gestureProgress, 0, `${entry.name} fresh start`);
    const beforeLock = advanceContinuously(
      resumed.nextState,
      entry.capturedAtMs + 1,
      entry.capturedAtMs + 1 + 2_999,
      rockPose,
    );
    assertEqual(
      beforeLock.status,
      "holding",
      `${entry.name} cannot transfer old hold`,
    );
  }

  const first = advance(createSubjectLockState(defaultProfile), 1_000, rockPose);
  const nonmonotonic = advance(first.nextState, 900, rockPose);
  assertEqual(nonmonotonic.status, "interrupted");
  assertEqual(nonmonotonic.resetRepCycle, true);
  assertEqual(nonmonotonic.nextState.gestureProgress, 0);
  assertEqual(nonmonotonic.nextState.gestureStartMs, null);
  const resumed = advance(nonmonotonic.nextState, 1_100, rockPose);
  assertEqual(resumed.status, "holding");
  assertEqual(resumed.nextState.gestureStartMs, 1_100);

  const gapStart = advance(createSubjectLockState(defaultProfile), 0, rockPose);
  const gap = advance(gapStart.nextState, SUBJECT_LOCK_FRESHNESS_MS + 1, rockPose);
  assertEqual(gap.status, "interrupted");
  assertEqual(gap.resetRepCycle, true);
  assertEqual(gap.nextState.gestureProgress, 0);
  assertEqual(gap.nextState.gestureStartMs, null);

  const scaleJump = transformPose(rockPose, 2, 0.4, -0.25);
  assertEqual(isRockSignSubjectLockGestureWithProfile(scaleJump, defaultProfile), true);
  const jumpStart = advance(createSubjectLockState(defaultProfile), 0, rockPose);
  const heldBeforeJump = advanceContinuously(
    jumpStart.nextState,
    0,
    1_000,
    rockPose,
  );
  const jump = advance(heldBeforeJump.nextState, 1_100, scaleJump);
  assertEqual(jump.status, "interrupted");
  assertEqual(jump.resetRepCycle, true);
  assertEqual(jump.nextState.gestureProgress, 0);
  assertEqual(jump.nextState.gestureStartMs, null);
  const afterJump = advance(jump.nextState, 1_101, rockPose);
  assertEqual(afterJump.status, "holding");
  assertEqual(
    advanceContinuously(afterJump.nextState, 1_101, 4_000, rockPose).status,
    "holding",
  );
  assertEqual(
    advanceContinuously(afterJump.nextState, 1_101, 4_101, rockPose).status,
    "locked",
  );
});

test("unlock resets the rep cycle, latches gesture relock until release, and permits manual bypass", () => {
  const locked = manuallyLockSubject(createSubjectLockState(), {
    capturedAtMs: 0,
    keypoints: rockPose,
    nowMs: 0,
  });
  assertEqual(locked.status, "locked");

  const unlocked = manuallyUnlockSubject(locked.nextState, {
    capturedAtMs: 100,
    keypoints: rockPose,
    nowMs: 100,
  });
  assertEqual(unlocked.released, true);
  assertEqual(unlocked.resetRepCycle, true);
  assertEqual(unlocked.nextState.locked, false);
  assertEqual(unlocked.nextState.source, "none");
  assertEqual(unlocked.nextState.requiresGestureRelease, true);

  const blocked = advance(unlocked.nextState, 200, rockPose);
  assertEqual(blocked.status, "interrupted");
  assertEqual(blocked.nextState.locked, false);
  assertEqual(blocked.nextState.requiresGestureRelease, true);

  const released = advance(blocked.nextState, 300, neutralPose);
  assertEqual(released.status, "off");
  assertEqual(released.nextState.requiresGestureRelease, false);

  const rearmed = advance(released.nextState, 400, rockPose);
  assertEqual(rearmed.status, "holding");
  assertEqual(rearmed.nextState.locked, false);

  const manualBypass = manuallyLockSubject(blocked.nextState, {
    capturedAtMs: 250,
    keypoints: rockPose,
    nowMs: 250,
  });
  assertEqual(manualBypass.status, "locked");
  assertEqual(manualBypass.nextState.source, "manual");
});

test("manual unlock preserves the relock latch without a fresh candidate", () => {
  const locked = manuallyLockSubject(createSubjectLockState(), {
    capturedAtMs: 0,
    keypoints: rockPose,
    nowMs: 0,
  });
  const staleNowMs = SUBJECT_LOCK_FRESHNESS_MS + 1_001;

  const missing = manuallyUnlockSubject(locked.nextState, {
    nowMs: 100,
  });
  assertEqual(missing.released, true);
  assertEqual(missing.resetRepCycle, true);
  assertEqual(missing.nextState.requiresGestureRelease, true);

  const staleNeutral = manuallyUnlockSubject(locked.nextState, {
    capturedAtMs: 1_000,
    keypoints: neutralPose,
    nowMs: staleNowMs,
  });
  assertEqual(staleNeutral.candidateFresh, false);
  assertEqual(staleNeutral.nextState.requiresGestureRelease, true);

  const staleRock = manuallyUnlockSubject(locked.nextState, {
    capturedAtMs: 1_000,
    keypoints: rockPose,
    nowMs: staleNowMs,
  });
  assertEqual(staleRock.candidateFresh, false);
  assertEqual(staleRock.nextState.requiresGestureRelease, true);

  const freshNeutral = manuallyUnlockSubject(missing.nextState, {
    capturedAtMs: 200,
    keypoints: neutralPose,
    nowMs: 200,
  });
  assertEqual(freshNeutral.candidateFresh, true);
  assertEqual(freshNeutral.status, "off");
  assertEqual(freshNeutral.nextState.requiresGestureRelease, false);

  const subsequentNeutral = advance(freshNeutral.nextState, 300, neutralPose);
  assertEqual(subsequentNeutral.status, "off");
  assertEqual(subsequentNeutral.nextState.requiresGestureRelease, false);

  const manualBypass = manuallyLockSubject(staleNeutral.nextState, {
    capturedAtMs: 1_100,
    keypoints: rockPose,
    nowMs: 1_100,
  });
  assertEqual(manualBypass.status, "locked");
  assertEqual(manualBypass.canCount, true);
  assertEqual(manualBypass.nextState.source, "manual");
});

test("a locked invalid body pauses counting and resets the partial rep cycle immediately", () => {
  const locked = manuallyLockSubject(createSubjectLockState(), {
    capturedAtMs: 0,
    keypoints: rockPose,
    nowMs: 0,
  });

  for (const uncertainFrame of [null, hidePose(rockPose)]) {
    const uncertain = advance(locked.nextState, 100, uncertainFrame);
    assertEqual(uncertain.status, "interrupted");
    assertEqual(uncertain.canCount, false);
    assertEqual(uncertain.resetRepCycle, true);
    assertEqual(uncertain.nextState.locked, true);

    const recovered = advance(uncertain.nextState, 200, rockPose);
    assertEqual(recovered.status, "locked");
    assertEqual(recovered.canCount, true);
    assertEqual(recovered.nextState.locked, true);
  }

  const invalid = advance(locked.nextState, 100, makeDifferentBody(rockPose));
  assertEqual(invalid.status, "interrupted");
  assertEqual(invalid.canCount, false);
  assertEqual(invalid.resetRepCycle, true);
  assertEqual(invalid.nextState.locked, true);

  const recovered = advance(invalid.nextState, 200, rockPose);
  assertEqual(recovered.status, "locked");
  assertEqual(recovered.canCount, true);
  assertEqual(recovered.nextState.locked, true);
  assertEqual(recovered.nextState.lostSinceMs, null);
});

test("a locked body translated by +0.2 x with identical normalized shape releases immediately", () => {
  const locked = manuallyLockSubject(createSubjectLockState(), {
    capturedAtMs: 0,
    keypoints: rockPose,
    nowMs: 0,
  });
  const translated = transformPose(rockPose, 1, 0.2, 0);
  assertEqual(
    isRockSignSubjectLockGestureWithProfile(translated, defaultProfile),
    true,
  );

  const transition = advance(locked.nextState, 100, translated);
  assertEqual(transition.status, "lost");
  assertEqual(transition.released, true);
  assertEqual(transition.canCount, false);
  assertEqual(transition.resetRepCycle, true);
  assertEqual(transition.nextState.locked, false);
});

test("invalid frames cannot extend grace beyond the last accepted frame", () => {
  const locked = manuallyLockSubject(createSubjectLockState(), {
    capturedAtMs: 0,
    keypoints: rockPose,
    nowMs: 0,
  });
  const differentRockBody = makeDifferentRockBody(rockPose);
  assertEqual(
    isRockSignSubjectLockGestureWithProfile(differentRockBody, defaultProfile),
    true,
  );
  const firstInvalid = advance(locked.nextState, 100, differentRockBody);
  const secondInvalid = advance(firstInvalid.nextState, 900, differentRockBody);
  assertEqual(secondInvalid.nextState.lostSinceMs, 0);
  assertEqual(secondInvalid.status, "interrupted");
  assertEqual(secondInvalid.canCount, false);

  const expired = advance(
    secondInvalid.nextState,
    SUBJECT_LOCK_LOSS_GRACE_MS + 1,
    differentRockBody,
  );
  assertEqual(expired.status, "lost");
  assertEqual(expired.released, true);
  assertEqual(expired.resetRepCycle, true);
  assertEqual(expired.nextState.locked, false);
  assertEqual(expired.nextState.requiresGestureRelease, true);

  const visibleRelease = advance(expired.nextState, 1_100, neutralPose);
  assertEqual(visibleRelease.status, "off");
  assertEqual(visibleRelease.nextState.requiresGestureRelease, false);

  const deliberateStart = advance(visibleRelease.nextState, 1_200, rockPose);
  assertEqual(deliberateStart.status, "holding");
  assertEqual(deliberateStart.nextState.locked, false);
  assertEqual(
    advanceContinuously(deliberateStart.nextState, 1_200, 4_199, rockPose).status,
    "holding",
  );
  assertEqual(
    advanceContinuously(deliberateStart.nextState, 1_200, 4_200, rockPose).status,
    "locked",
  );
});

test("fingerprint accepts translation and scale of the same body but rejects a different normalized body", () => {
  const locked = manuallyLockSubject(createSubjectLockState(), {
    capturedAtMs: 0,
    keypoints: rockPose,
    nowMs: 0,
  });
  const translatedAndScaled = transformPose(rockPose, 1.3, 0.04, -0.03);
  const sameBody = advance(locked.nextState, 100, translatedAndScaled);
  assertEqual(sameBody.status, "locked");
  assertEqual(sameBody.canCount, true);
  assertEqual(sameBody.nextState.locked, true);

  const otherBody = advance(sameBody.nextState, 200, makeDifferentBody(rockPose));
  assertEqual(otherBody.status, "interrupted");
  assertEqual(otherBody.canCount, false);
  assertEqual(otherBody.nextState.locked, true);
});

test("native pose stabilization cannot renew a held timestamp forever under repeated translated scale jumps", () => {
  const original = frame(0, rockPose);
  let stable = stabilizeNativePoseFrame(original, null);
  let heldCount = 0;
  let timestampAtOneSecond = 0;

  for (let capturedAtMs = 50; capturedAtMs <= 5_000; capturedAtMs += 50) {
    const displaced = transformPose(rockPose, 0.2, 0.8, 0.3);
    const result = stabilizeNativePoseFrame(
      frame(capturedAtMs, displaced),
      stable.frame,
    );
    if (result.held) heldCount += 1;
    stable = result;
    if (capturedAtMs === 1_000) {
      timestampAtOneSecond = stable.frame.capturedAtMs;
    }
  }

  assertEqual(heldCount > 0, true);
  assertEqual(timestampAtOneSecond > 0, true);
  assertEqual(stable.frame.capturedAtMs > timestampAtOneSecond, true);
  assertEqual(stable.frame.capturedAtMs <= 5_000, true);
});

test("native pose stabilization smooths ordinary small motion", () => {
  const original = frame(0, rockPose);
  const previous = stabilizeNativePoseFrame(original, null);
  const moved = rockPose.map((point) => ({
    ...point,
    x: point.x + 0.03,
    y: point.y - 0.02,
  }));
  const result = stabilizeNativePoseFrame(frame(50, moved), previous.frame);
  assertEqual(result.held, false);
  assert(result.frame.keypoints[11].x > rockPose[11].x, "small motion should move forward");
  assert(result.frame.keypoints[11].x < moved[11].x, "small motion should be smoothed");
  assertEqual(result.frame.capturedAtMs, 50);
});

test("native observation guard rejects stale stream and generation events, including null payloads", () => {
  const current = { generation: 12, streamId: 4 };

  const oldStreamValid = observationStamp(1_000, 12, 3);
  assertEqual(
    isCurrentSubjectLockObservation(oldStreamValid, current, 1_000),
    false,
  );
  const oldStreamNull = observationStamp(1_050, 12, 3);
  assertEqual(
    isCurrentSubjectLockObservation(oldStreamNull, current, null),
    false,
  );

  const restarted = { generation: 13, streamId: 4 };
  const oldGenerationValid = observationStamp(1_100, 12, 4);
  assertEqual(
    isCurrentSubjectLockObservation(oldGenerationValid, restarted, 1_100),
    false,
  );
  const oldGenerationNull = observationStamp(1_150, 12, 4);
  assertEqual(
    isCurrentSubjectLockObservation(oldGenerationNull, restarted, null),
    false,
  );

  const currentValid = observationStamp(1_200, 13, 4);
  assertEqual(
    isCurrentSubjectLockObservation(currentValid, restarted, 1_200),
    true,
  );
  const currentNull = observationStamp(1_250, 13, 4);
  assertEqual(
    isCurrentSubjectLockObservation(currentNull, restarted, null),
    true,
  );
  assertEqual(
    isCurrentSubjectLockObservation(currentValid, restarted, 1_201),
    false,
  );
  assertEqual(
    isCurrentSubjectLockObservation(null, restarted, null),
    false,
  );
});

test("invalidation clears lock, hold progress, fingerprint, and source", () => {
  const holding = advance(createSubjectLockState(defaultProfile), 0, rockPose);
  assertEqual(holding.status, "holding", "invalidation holding setup");
  const invalidated = invalidateSubjectLockState(holding.nextState, defaultProfile);
  assertEqual(invalidated.locked, false);
  assertEqual(invalidated.gestureProgress, 0);
  assertEqual(invalidated.gestureStartMs, null);
  assertEqual(invalidated.fingerprint, null);
  assertEqual(invalidated.lastAcceptedAtMs, null);
  assertEqual(invalidated.lostSinceMs, null);
  assertEqual(invalidated.requiresGestureRelease, false);
  assertEqual(invalidated.source, "none");
});

if (!jestTest) {
  if (failures.length) {
    throw new Error(
      `${failures.length} subject-lock regression(s) failed:\n${failures.join("\n")}`,
    );
  }

  console.log(`subjectLock.test.ts: ${passed} regression tests passed`);
}
