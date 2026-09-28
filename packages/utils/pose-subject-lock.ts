import type {
  ExerciseHandShapeProfileRecord,
  ExerciseSubjectLockGestureProfileRecord,
  PoseKeypointRecord,
  PoseSequenceFrameRecord,
} from "@fittrack/types";
import {
  DEFAULT_EXERCISE_SUBJECT_LOCK_GESTURE_PROFILE,
  normalizeExerciseHandShapeProfile,
  normalizeExerciseSubjectLockGestureProfile,
} from "./exercise-editor";

export const SUBJECT_LOCK_FRESHNESS_MS = 350;
export const SUBJECT_LOCK_LOSS_GRACE_MS = 1000;
export const SUBJECT_LOCK_VISIBILITY_THRESHOLD = 0.4;
export const SUBJECT_LOCK_RIG_VISIBILITY_THRESHOLD = 0.24;
export const SUBJECT_LOCK_MIN_VISIBLE_RIG_POINTS = 5;
export const SUBJECT_LOCK_FINGERPRINT_DISTANCE_LIMIT = 0.42;
export const SUBJECT_LOCK_FINGERPRINT_BLEND = 0.16;
const SUBJECT_LOCK_SCALE_RATIO_MIN = 0.55;
const SUBJECT_LOCK_SCALE_RATIO_MAX = 1.8;

const SUBJECT_LOCK_CORE_LANDMARK_INDEXES = [11, 12, 23, 24] as const;
const SUBJECT_LOCK_RIG_LANDMARK_INDEXES = [
  0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28,
] as const;
const NATIVE_POSE_HOLD_LAST_GOOD_MS = 420;
const NATIVE_POSE_CORE_TELEPORT_DISTANCE = 0.14;
const NATIVE_POSE_SEGMENT_SHIFT_DISTANCE = 0.12;
const NATIVE_POSE_MIN_STABILIZER_VISIBILITY = 0.14;
const NATIVE_POSE_SEGMENTS = [
  [11, 12],
  [23, 24],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
] as const;

export type SubjectLockSource = "none" | "gesture" | "manual";

export type SubjectPoseFingerprint = {
  capturedAtMs: number;
  vector: number[];
};

type SubjectPoseContinuity = {
  capturedAtMs: number;
  corePoints: Array<{ x: number; y: number } | null>;
  bodyScale: number;
};

export type SubjectLockState = {
  continuity: SubjectPoseContinuity | null;
  fingerprint: SubjectPoseFingerprint | null;
  gestureProgress: number;
  gestureStartMs: number | null;
  lastAcceptedAtMs: number | null;
  lastFrameAtMs: number | null;
  locked: boolean;
  lostSinceMs: number | null;
  profileKey: string;
  requiresGestureRelease: boolean;
  source: SubjectLockSource;
};

export type SubjectLockStatus =
  | "off"
  | "holding"
  | "locked"
  | "interrupted"
  | "lost";

export type SubjectLockTransition = {
  bodyVisible: boolean;
  canCount: boolean;
  candidateFresh: boolean;
  gestureActive: boolean;
  nextState: SubjectLockState;
  released: boolean;
  resetRepCycle: boolean;
  status: SubjectLockStatus;
};

export type SubjectLockProfileInput =
  | ExerciseHandShapeProfileRecord
  | ExerciseSubjectLockGestureProfileRecord
  | null
  | undefined;

export type SubjectLockObservationStamp = {
  capturedAtMs: number;
  generation: number;
  streamId: number;
};

export function isCurrentSubjectLockObservation(
  observation: SubjectLockObservationStamp | null | undefined,
  current: Pick<SubjectLockObservationStamp, "generation" | "streamId">,
  frameCapturedAtMs?: number | null,
) {
  return (
    !!observation &&
    Number.isFinite(observation.capturedAtMs) &&
    Number.isInteger(observation.generation) &&
    Number.isInteger(observation.streamId) &&
    observation.generation === current.generation &&
    observation.streamId === current.streamId &&
    (frameCapturedAtMs == null ||
      frameCapturedAtMs === observation.capturedAtMs)
  );
}

function getGestureProfile(
  profile: SubjectLockProfileInput,
): ExerciseSubjectLockGestureProfileRecord {
  if (!profile) return DEFAULT_EXERCISE_SUBJECT_LOCK_GESTURE_PROFILE;
  if (typeof profile !== "object") {
    return DEFAULT_EXERCISE_SUBJECT_LOCK_GESTURE_PROFILE;
  }

  const record = profile as unknown as Record<string, unknown>;
  const isHandShapeProfile =
    "grip" in record ||
    "subjectLockGesture" in record ||
    "subject_lock_gesture" in record ||
    "handPosePreview" in record ||
    "hand_pose_preview" in record ||
    "warnings" in record ||
    record.schemaVersion === "exercise_hand_shape_v1";

  return isHandShapeProfile
    ? normalizeExerciseHandShapeProfile(record).subjectLockGesture
    : normalizeExerciseSubjectLockGestureProfile(record);
}

function getGestureProfileKey(profile: SubjectLockProfileInput) {
  const resolved = getGestureProfile(profile);
  return [
    resolved.enabled,
    resolved.gesture,
    resolved.handAboveShoulderOffset,
    resolved.handRaisedFromElbowOffset,
    resolved.holdMs,
    resolved.hornThumbLeadOffset,
    resolved.maxHornLiftDelta,
    resolved.minFingerDistance,
    resolved.minFingerLift,
    resolved.minFingerSpreadX,
    resolved.minThumbOffset,
    resolved.minThumbSeparation,
  ].join("|");
}

function getPointDistance(
  a: PoseKeypointRecord | undefined,
  b: PoseKeypointRecord | undefined,
) {
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function isVisiblePoint(point: PoseKeypointRecord | undefined) {
  return (
    Number.isFinite(point?.x) &&
    Number.isFinite(point?.y) &&
    (point?.visibility ?? 0) >= SUBJECT_LOCK_VISIBILITY_THRESHOLD
  );
}

function isRigPointVisible(point: PoseKeypointRecord | undefined) {
  return (
    Number.isFinite(point?.x) &&
    Number.isFinite(point?.y) &&
    (point?.visibility ?? 0) >= SUBJECT_LOCK_RIG_VISIBILITY_THRESHOLD
  );
}

function averageVisibilityForIndexes(
  keypoints: PoseKeypointRecord[],
  indexes: readonly number[],
) {
  const values = indexes
    .map((index) => keypoints[index]?.visibility ?? 0)
    .filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function isSubjectLockBodyRigVisible(
  keypoints: PoseKeypointRecord[] | null | undefined,
) {
  if (!keypoints || keypoints.length < 33) return false;

  const hasMalformedVisibleRigPoint = SUBJECT_LOCK_RIG_LANDMARK_INDEXES.some(
    (index) => {
      const point = keypoints[index];
      return (
        (point?.visibility ?? 0) >= SUBJECT_LOCK_RIG_VISIBILITY_THRESHOLD &&
        (!Number.isFinite(point?.x) || !Number.isFinite(point?.y))
      );
    },
  );
  if (hasMalformedVisibleRigPoint) return false;

  const visibleCorePoints = SUBJECT_LOCK_CORE_LANDMARK_INDEXES.filter((index) =>
    isRigPointVisible(keypoints[index]),
  ).length;
  const coreAverageVisibility = averageVisibilityForIndexes(
    keypoints,
    SUBJECT_LOCK_CORE_LANDMARK_INDEXES,
  );
  const visibleRigPoints = SUBJECT_LOCK_RIG_LANDMARK_INDEXES.filter((index) =>
    isRigPointVisible(keypoints[index]),
  ).length;
  const leftArmVisibility = averageVisibilityForIndexes(
    keypoints,
    [11, 13, 15],
  );
  const rightArmVisibility = averageVisibilityForIndexes(
    keypoints,
    [12, 14, 16],
  );
  const armChainVisible =
    Math.max(leftArmVisibility, rightArmVisibility) >=
    SUBJECT_LOCK_RIG_VISIBILITY_THRESHOLD;

  return (
    visibleCorePoints >= 3 &&
    coreAverageVisibility >= SUBJECT_LOCK_RIG_VISIBILITY_THRESHOLD &&
    armChainVisible &&
    visibleRigPoints >= SUBJECT_LOCK_MIN_VISIBLE_RIG_POINTS
  );
}

export function isRockSignSubjectLockGestureWithProfile(
  keypoints: PoseKeypointRecord[],
  profileInput: SubjectLockProfileInput,
) {
  const profile = getGestureProfile(profileInput);
  if (!profile.enabled) return false;
  const hands = [
    { elbow: 13, index: 19, pinky: 17, shoulder: 11, thumb: 21, wrist: 15 },
    { elbow: 14, index: 20, pinky: 18, shoulder: 12, thumb: 22, wrist: 16 },
  ] as const;

  return hands.some((hand) => {
    const elbow = keypoints[hand.elbow];
    const wrist = keypoints[hand.wrist];
    const index = keypoints[hand.index];
    const pinky = keypoints[hand.pinky];
    const thumb = keypoints[hand.thumb];
    const shoulder = keypoints[hand.shoulder];
    if (
      !isVisiblePoint(elbow) ||
      !isVisiblePoint(wrist) ||
      !isVisiblePoint(index) ||
      !isVisiblePoint(pinky) ||
      !isVisiblePoint(thumb) ||
      !isVisiblePoint(shoulder)
    ) {
      return false;
    }

    const handAboveShoulder =
      wrist.y <= shoulder.y + profile.handAboveShoulderOffset;
    const handRaisedFromElbow =
      wrist.y <= elbow.y + profile.handRaisedFromElbowOffset;
    const indexLift = wrist.y - index.y;
    const pinkyLift = wrist.y - pinky.y;
    const indexExtended = indexLift >= profile.minFingerLift;
    const pinkyExtended = pinkyLift >= profile.minFingerLift;
    const fingerSpread =
      Math.abs(index.x - pinky.x) >= profile.minFingerSpreadX &&
      getPointDistance(index, pinky) >= profile.minFingerDistance;
    const thumbOffset =
      getPointDistance(thumb, wrist) >= profile.minThumbOffset;
    const thumbSeparated =
      getPointDistance(thumb, index) >= profile.minThumbSeparation &&
      getPointDistance(thumb, pinky) >= profile.minThumbSeparation;
    const hornBalance =
      Math.abs(indexLift - pinkyLift) <= profile.maxHornLiftDelta;
    const hornsLeadThumb =
      index.y <= thumb.y + profile.hornThumbLeadOffset &&
      pinky.y <= thumb.y + profile.hornThumbLeadOffset;

    return (
      handAboveShoulder &&
      handRaisedFromElbow &&
      indexExtended &&
      pinkyExtended &&
      fingerSpread &&
      thumbOffset &&
      thumbSeparated &&
      hornBalance &&
      hornsLeadThumb
    );
  });
}

export function buildSubjectPoseFingerprint(
  keypoints: PoseKeypointRecord[] | null | undefined,
  capturedAtMs: number,
): SubjectPoseFingerprint | null {
  if (!keypoints || !isSubjectLockBodyRigVisible(keypoints)) return null;
  const fingerprintIndexes = [
    11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28,
  ];
  const shoulderCenter = {
    x:
      (Number.isFinite(keypoints[11]?.x) ? keypoints[11]?.x ?? 0 : 0) +
      (Number.isFinite(keypoints[12]?.x) ? keypoints[12]?.x ?? 0 : 0),
    y:
      (Number.isFinite(keypoints[11]?.y) ? keypoints[11]?.y ?? 0 : 0) +
      (Number.isFinite(keypoints[12]?.y) ? keypoints[12]?.y ?? 0 : 0),
  };
  const hipCenter = {
    x:
      (Number.isFinite(keypoints[23]?.x) ? keypoints[23]?.x ?? 0 : 0) +
      (Number.isFinite(keypoints[24]?.x) ? keypoints[24]?.x ?? 0 : 0),
    y:
      (Number.isFinite(keypoints[23]?.y) ? keypoints[23]?.y ?? 0 : 0) +
      (Number.isFinite(keypoints[24]?.y) ? keypoints[24]?.y ?? 0 : 0),
  };
  shoulderCenter.x /= 2;
  shoulderCenter.y /= 2;
  hipCenter.x /= 2;
  hipCenter.y /= 2;
  const scale = Math.max(
    Math.hypot(shoulderCenter.x - hipCenter.x, shoulderCenter.y - hipCenter.y),
    0.08,
  );
  return {
    capturedAtMs,
    vector: fingerprintIndexes.flatMap((index) => {
      const point = keypoints[index];
      if (!point || !isRigPointVisible(point)) {
        return [0, 0];
      }
      return [
        (point.x - hipCenter.x) / scale,
        (point.y - hipCenter.y) / scale,
      ];
    }),
  };
}

export function subjectFingerprintDistance(
  first: SubjectPoseFingerprint,
  second: SubjectPoseFingerprint,
) {
  const length = Math.min(first.vector.length, second.vector.length);
  if (!length) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += Math.abs(first.vector[index] - second.vector[index]);
  }
  return sum / length;
}

function buildSubjectPoseContinuity(
  keypoints: PoseKeypointRecord[] | null | undefined,
  capturedAtMs: number,
): SubjectPoseContinuity | null {
  if (!isSubjectLockBodyRigVisible(keypoints)) return null;
  const shoulderCenter = {
    x: ((keypoints?.[11]?.x ?? 0) + (keypoints?.[12]?.x ?? 0)) / 2,
    y: ((keypoints?.[11]?.y ?? 0) + (keypoints?.[12]?.y ?? 0)) / 2,
  };
  const hipCenter = {
    x: ((keypoints?.[23]?.x ?? 0) + (keypoints?.[24]?.x ?? 0)) / 2,
    y: ((keypoints?.[23]?.y ?? 0) + (keypoints?.[24]?.y ?? 0)) / 2,
  };
  return {
    capturedAtMs,
    corePoints: SUBJECT_LOCK_CORE_LANDMARK_INDEXES.map((index) => {
      const point = keypoints?.[index];
      return point && isRigPointVisible(point)
        ? { x: point.x, y: point.y }
        : null;
    }),
    bodyScale: Math.max(
      Math.hypot(shoulderCenter.x - hipCenter.x, shoulderCenter.y - hipCenter.y),
      0.08,
    ),
  };
}

function hasRawSubjectContinuity(
  previous: SubjectPoseContinuity | null,
  current: SubjectPoseContinuity | null,
) {
  if (!previous || !current) return true;
  const jumps = previous.corePoints
    .map((point, index) => {
      const nextPoint = current.corePoints[index];
      return point && nextPoint
        ? Math.hypot(nextPoint.x - point.x, nextPoint.y - point.y)
        : null;
    })
    .filter((value): value is number => value !== null);
  if (
    jumps.length > 0 &&
    jumps.reduce((sum, value) => sum + value, 0) / jumps.length >=
      NATIVE_POSE_CORE_TELEPORT_DISTANCE
  ) {
    return false;
  }
  const scaleRatio = current.bodyScale / Math.max(previous.bodyScale, 0.08);
  return (
    scaleRatio >= SUBJECT_LOCK_SCALE_RATIO_MIN &&
    scaleRatio <= SUBJECT_LOCK_SCALE_RATIO_MAX
  );
}

export function createSubjectLockState(profile?: SubjectLockProfileInput): SubjectLockState {
  return {
    continuity: null,
    fingerprint: null,
    gestureProgress: 0,
    gestureStartMs: null,
    lastAcceptedAtMs: null,
    lastFrameAtMs: null,
    locked: false,
    lostSinceMs: null,
    profileKey: getGestureProfileKey(profile),
    requiresGestureRelease: false,
    source: "none",
  };
}

function withUnlockedState(
  state: SubjectLockState,
  profile: SubjectLockProfileInput,
  requiresGestureRelease = false,
): SubjectLockState {
  return {
    ...state,
    continuity: null,
    fingerprint: null,
    gestureProgress: 0,
    gestureStartMs: null,
    lastAcceptedAtMs: null,
    locked: false,
    lostSinceMs: null,
    profileKey: getGestureProfileKey(profile),
    requiresGestureRelease,
    source: "none",
  };
}

function getCandidateFreshness(
  capturedAtMs: number,
  nowMs: number,
  lastFrameAtMs: number | null,
) {
  return (
    Number.isFinite(capturedAtMs) &&
    Number.isFinite(nowMs) &&
    capturedAtMs <= nowMs + 50 &&
    nowMs - capturedAtMs <= SUBJECT_LOCK_FRESHNESS_MS &&
    (lastFrameAtMs === null || capturedAtMs > lastFrameAtMs)
  );
}

export function isFreshSubjectLockCandidate(
  keypoints: PoseKeypointRecord[] | null | undefined,
  capturedAtMs: number | null | undefined,
  nowMs = Date.now(),
) {
  return (
    typeof capturedAtMs === "number" &&
    getCandidateFreshness(capturedAtMs, nowMs, null) &&
    isSubjectLockBodyRigVisible(keypoints)
  );
}

function makeTransition(
  state: SubjectLockState,
  input: {
    bodyVisible: boolean;
    canCount?: boolean;
    candidateFresh: boolean;
    gestureActive: boolean;
    released?: boolean;
    resetRepCycle?: boolean;
    status: SubjectLockStatus;
  },
): SubjectLockTransition {
  return {
    bodyVisible: input.bodyVisible,
    canCount: input.canCount ?? false,
    candidateFresh: input.candidateFresh,
    gestureActive: input.gestureActive,
    nextState: state,
    released: input.released ?? false,
    resetRepCycle: input.resetRepCycle ?? false,
    status: input.status,
  };
}

export function advanceSubjectLockFrame(
  state: SubjectLockState,
  input: {
    capturedAtMs: number;
    keypoints: PoseKeypointRecord[] | null | undefined;
    nowMs?: number;
    profile?: SubjectLockProfileInput;
  },
): SubjectLockTransition {
  const nowMs = input.nowMs ?? Date.now();
  const profile = getGestureProfile(input.profile);
  const profileKey = getGestureProfileKey(profile);
  const bodyVisible = isSubjectLockBodyRigVisible(input.keypoints);
  const gestureActive =
    bodyVisible &&
    profile.enabled &&
    isRockSignSubjectLockGestureWithProfile(input.keypoints ?? [], profile);
  const candidateFresh = getCandidateFreshness(
    input.capturedAtMs,
    nowMs,
    state.lastFrameAtMs,
  );
  const monotonicFrame =
    Number.isFinite(input.capturedAtMs) &&
    (state.lastFrameAtMs === null || input.capturedAtMs > state.lastFrameAtMs);
  const frameGapMs =
    state.lastFrameAtMs === null
      ? 0
      : monotonicFrame
        ? input.capturedAtMs - state.lastFrameAtMs
        : Number.POSITIVE_INFINITY;
  const profileChanged = state.profileKey !== profileKey;
  const rawContinuity = bodyVisible
    ? buildSubjectPoseContinuity(input.keypoints, input.capturedAtMs)
    : null;
  const continuityBreak = !hasRawSubjectContinuity(
    state.continuity,
    rawContinuity,
  );
  let nextState: SubjectLockState = {
    ...state,
    lastFrameAtMs: monotonicFrame ? input.capturedAtMs : state.lastFrameAtMs,
    profileKey,
  };
  if (profileChanged) {
    const restartedState = withUnlockedState(nextState, profile);
    return makeTransition(restartedState, {
      bodyVisible,
      candidateFresh,
      gestureActive,
      released: state.locked,
      resetRepCycle: state.locked,
      status: state.locked ? "lost" : "off",
    });
  }

  if (!monotonicFrame) {
    const hadActiveCycle =
      nextState.locked ||
      nextState.gestureStartMs !== null ||
      nextState.gestureProgress > 0;
    nextState.gestureProgress = 0;
    nextState.gestureStartMs = null;
    if (!nextState.locked) nextState.continuity = null;
    if (nextState.locked && nextState.lostSinceMs === null) {
      nextState.lostSinceMs = nextState.lastAcceptedAtMs ?? nowMs;
    }
    if (
      nextState.locked &&
      nowMs - (nextState.lastAcceptedAtMs ?? nextState.lostSinceMs ?? nowMs) >=
        SUBJECT_LOCK_LOSS_GRACE_MS
    ) {
      const releasedState = withUnlockedState(nextState, profile, false);
      return makeTransition(releasedState, {
        bodyVisible,
        candidateFresh: false,
        gestureActive: false,
        released: true,
        resetRepCycle: true,
        status: "lost",
      });
    }
    return makeTransition(nextState, {
      bodyVisible: false,
      candidateFresh: false,
      gestureActive: false,
      resetRepCycle: hadActiveCycle,
      status: nextState.locked || hadActiveCycle ? "interrupted" : "off",
    });
  }

  const continuityGap = frameGapMs > SUBJECT_LOCK_FRESHNESS_MS;
  if (
    nextState.locked &&
    continuityBreak &&
    bodyVisible &&
    rawContinuity
  ) {
    const releasedState = withUnlockedState(
      nextState,
      profile,
      gestureActive,
    );
    return makeTransition(releasedState, {
      bodyVisible,
      candidateFresh,
      gestureActive,
      released: true,
      resetRepCycle: true,
      status: "lost",
    });
  }
  if (!bodyVisible || continuityGap || !candidateFresh || continuityBreak) {
    const hadActiveCycle =
      nextState.locked ||
      nextState.gestureStartMs !== null ||
      nextState.gestureProgress > 0;
    nextState.gestureProgress = 0;
    nextState.gestureStartMs = null;
    if (!nextState.locked) nextState.continuity = null;
    if (!nextState.locked) {
      return makeTransition(nextState, {
        bodyVisible,
        candidateFresh,
        gestureActive,
        resetRepCycle: hadActiveCycle,
        status:
          nextState.requiresGestureRelease || hadActiveCycle
            ? "interrupted"
            : "off",
      });
    }

    if (nextState.lostSinceMs === null) {
      nextState.lostSinceMs =
        nextState.lastAcceptedAtMs ?? input.capturedAtMs;
    }
    const lastAcceptedAtMs =
      nextState.lastAcceptedAtMs ?? nextState.lostSinceMs;
    const lostDurationMs = Math.max(
      0,
      nowMs - lastAcceptedAtMs,
      input.capturedAtMs - lastAcceptedAtMs,
    );
    if (lostDurationMs >= SUBJECT_LOCK_LOSS_GRACE_MS) {
      const releasedState = withUnlockedState(
        nextState,
        profile,
        gestureActive,
      );
      return makeTransition(releasedState, {
        bodyVisible,
        candidateFresh,
        gestureActive,
        released: true,
        resetRepCycle: true,
        status: "lost",
      });
    }
    return makeTransition(nextState, {
      bodyVisible,
      candidateFresh,
      gestureActive,
      resetRepCycle: true,
      status: "interrupted",
    });
  }

  if (nextState.locked) {
    const fingerprint = buildSubjectPoseFingerprint(
      input.keypoints,
      input.capturedAtMs,
    );
    const distance =
      fingerprint && nextState.fingerprint
        ? subjectFingerprintDistance(nextState.fingerprint, fingerprint)
        : Number.POSITIVE_INFINITY;
    if (!fingerprint || distance > SUBJECT_LOCK_FINGERPRINT_DISTANCE_LIMIT) {
      if (nextState.lostSinceMs === null) {
        nextState.lostSinceMs =
          nextState.lastAcceptedAtMs ?? input.capturedAtMs;
      }
      const lastAcceptedAtMs =
        nextState.lastAcceptedAtMs ?? nextState.lostSinceMs;
      const lostDurationMs = Math.max(
        0,
        nowMs - lastAcceptedAtMs,
        input.capturedAtMs - lastAcceptedAtMs,
      );
      if (lostDurationMs >= SUBJECT_LOCK_LOSS_GRACE_MS) {
        const releasedState = withUnlockedState(
          nextState,
          profile,
          gestureActive,
        );
        return makeTransition(releasedState, {
          bodyVisible,
          candidateFresh,
          gestureActive,
          released: true,
          resetRepCycle: true,
          status: "lost",
        });
      }
      return makeTransition(nextState, {
        bodyVisible,
        candidateFresh,
        gestureActive,
        resetRepCycle: true,
        status: "interrupted",
      });
    }

    nextState.lostSinceMs = null;
    nextState.lastAcceptedAtMs = input.capturedAtMs;
    nextState.continuity = rawContinuity;
    nextState.fingerprint = {
      capturedAtMs: input.capturedAtMs,
      vector: nextState.fingerprint
        ? nextState.fingerprint.vector.map(
            (value, index) =>
              value +
              (fingerprint.vector[index] - value) *
                SUBJECT_LOCK_FINGERPRINT_BLEND,
          )
        : fingerprint.vector,
    };
    return makeTransition(nextState, {
      bodyVisible,
      canCount: true,
      candidateFresh,
      gestureActive,
      status: "locked",
    });
  }

  if (nextState.requiresGestureRelease) {
    if (!gestureActive) {
      nextState.requiresGestureRelease = false;
    }
    return makeTransition(nextState, {
      bodyVisible,
      candidateFresh,
      gestureActive,
      status: nextState.requiresGestureRelease ? "interrupted" : "off",
    });
  }

  if (!profile.enabled || !gestureActive) {
    nextState.gestureProgress = 0;
    nextState.gestureStartMs = null;
    return makeTransition(nextState, {
      bodyVisible,
      candidateFresh,
      gestureActive,
      status: "off",
    });
  }

  const gestureStartMs = nextState.gestureStartMs ?? input.capturedAtMs;
  nextState.continuity = rawContinuity;
  const heldMs = Math.max(0, input.capturedAtMs - gestureStartMs);
  const gestureProgress = Math.min(1, heldMs / Math.max(1, profile.holdMs));
  nextState.gestureStartMs = gestureStartMs;
  nextState.gestureProgress = gestureProgress;
  if (heldMs < profile.holdMs) {
    return makeTransition(nextState, {
      bodyVisible,
      candidateFresh,
      gestureActive,
      status: "holding",
    });
  }

  const fingerprint = buildSubjectPoseFingerprint(
    input.keypoints,
    input.capturedAtMs,
  );
  if (!fingerprint) {
    return makeTransition(nextState, {
      bodyVisible,
      candidateFresh,
      gestureActive,
      status: "interrupted",
    });
  }
  nextState = {
    ...nextState,
    fingerprint,
    gestureProgress: 0,
    gestureStartMs: null,
    lastAcceptedAtMs: input.capturedAtMs,
    locked: true,
    lostSinceMs: null,
    source: "gesture",
  };
  return makeTransition(nextState, {
    bodyVisible,
    canCount: true,
    candidateFresh,
    gestureActive,
    status: "locked",
  });
}

export function manuallyLockSubject(
  state: SubjectLockState,
  input: {
    capturedAtMs: number | null | undefined;
    keypoints: PoseKeypointRecord[] | null | undefined;
    nowMs?: number;
    profile?: SubjectLockProfileInput;
  },
): SubjectLockTransition {
  const nowMs = input.nowMs ?? Date.now();
  const profile = getGestureProfile(input.profile);
  const capturedAtMs = input.capturedAtMs ?? Number.NaN;
  const bodyVisible = isSubjectLockBodyRigVisible(input.keypoints);
  const candidateFresh = isFreshSubjectLockCandidate(
    input.keypoints,
    input.capturedAtMs,
    nowMs,
  );
  const gestureActive =
    bodyVisible &&
    profile.enabled &&
    isRockSignSubjectLockGestureWithProfile(input.keypoints ?? [], profile);
  if (!candidateFresh) {
    return makeTransition(state, {
      bodyVisible,
      candidateFresh,
      gestureActive,
      status: state.locked ? "interrupted" : "off",
    });
  }
  const fingerprint = buildSubjectPoseFingerprint(
    input.keypoints,
    capturedAtMs,
  );
  if (!fingerprint) {
    return makeTransition(state, {
      bodyVisible,
      candidateFresh,
      gestureActive,
      status: "off",
    });
  }
  const nextState: SubjectLockState = {
    ...state,
    continuity: buildSubjectPoseContinuity(input.keypoints, capturedAtMs),
    fingerprint,
    gestureProgress: 0,
    gestureStartMs: null,
    lastAcceptedAtMs: capturedAtMs,
    lastFrameAtMs: capturedAtMs,
    locked: true,
    lostSinceMs: null,
    profileKey: getGestureProfileKey(profile),
    requiresGestureRelease: false,
    source: "manual",
  };
  return makeTransition(nextState, {
    bodyVisible,
    canCount: true,
    candidateFresh,
    gestureActive,
    status: "locked",
  });
}

export function manuallyUnlockSubject(
  state: SubjectLockState,
  input: {
    capturedAtMs?: number | null;
    keypoints?: PoseKeypointRecord[] | null;
    nowMs?: number;
    profile?: SubjectLockProfileInput;
  } = {},
): SubjectLockTransition {
  const nowMs = input.nowMs ?? Date.now();
  const profile = getGestureProfile(input.profile);
  const bodyVisible = isSubjectLockBodyRigVisible(input.keypoints);
  const candidateFresh =
    typeof input.capturedAtMs === "number" &&
    getCandidateFreshness(input.capturedAtMs, nowMs, null);
  const gestureActive =
    bodyVisible &&
    profile.enabled &&
    isRockSignSubjectLockGestureWithProfile(input.keypoints ?? [], profile);
  const releaseProven = candidateFresh && bodyVisible && !gestureActive;
  const nextState = withUnlockedState(state, profile, gestureActive);
  nextState.requiresGestureRelease = profile.enabled && !releaseProven;
  if (typeof input.capturedAtMs === "number") {
    nextState.lastFrameAtMs = input.capturedAtMs;
  }
  return makeTransition(nextState, {
    bodyVisible,
    candidateFresh: candidateFresh && bodyVisible,
    gestureActive,
    released: true,
    resetRepCycle: state.locked,
    status: gestureActive ? "interrupted" : "off",
  });
}

export function invalidateSubjectLockState(
  _state: SubjectLockState,
  profile?: SubjectLockProfileInput,
) {
  return createSubjectLockState(profile);
}

function toPointVisibility(point: PoseKeypointRecord | undefined) {
  return point?.visibility ?? 0;
}

function clonePoseKeypoint(point: PoseKeypointRecord): PoseKeypointRecord {
  return {
    visibility: point.visibility,
    x: point.x,
    y: point.y,
    z: point.z,
  };
}

function blendPoseKeypoint(
  previous: PoseKeypointRecord,
  current: PoseKeypointRecord,
): PoseKeypointRecord {
  const previousVisibility = toPointVisibility(previous);
  const currentVisibility = toPointVisibility(current);
  if (
    currentVisibility < NATIVE_POSE_MIN_STABILIZER_VISIBILITY &&
    previousVisibility >= NATIVE_POSE_MIN_STABILIZER_VISIBILITY
  ) {
    return {
      ...clonePoseKeypoint(previous),
      visibility: Math.max(0, previousVisibility * 0.82),
    };
  }
  if (previousVisibility < NATIVE_POSE_MIN_STABILIZER_VISIBILITY) {
    return clonePoseKeypoint(current);
  }
  const alpha =
    currentVisibility >= 0.7
      ? 0.44
      : currentVisibility >= 0.4
        ? 0.32
        : 0.2;
  const visibilityAlpha = Math.max(alpha, 0.5);
  return {
    visibility:
      previousVisibility +
      (currentVisibility - previousVisibility) * visibilityAlpha,
    x: previous.x + (current.x - previous.x) * alpha,
    y: previous.y + (current.y - previous.y) * alpha,
    z: (previous.z ?? 0) + ((current.z ?? 0) - (previous.z ?? 0)) * alpha,
  };
}

function averageTrackedJump(
  previous: PoseKeypointRecord[],
  current: PoseKeypointRecord[],
  indexes: readonly number[],
) {
  const jumps = indexes
    .map((index) => {
      const previousPoint = previous[index];
      const currentPoint = current[index];
      if (
        !previousPoint ||
        !currentPoint ||
        toPointVisibility(previousPoint) <
          NATIVE_POSE_MIN_STABILIZER_VISIBILITY ||
        toPointVisibility(currentPoint) < NATIVE_POSE_MIN_STABILIZER_VISIBILITY
      ) {
        return null;
      }
      return getPointDistance(previousPoint, currentPoint);
    })
    .filter((value): value is number => typeof value === "number");
  if (!jumps.length) return 0;
  return jumps.reduce((sum, value) => sum + value, 0) / jumps.length;
}

function averageSegmentShift(
  previous: PoseKeypointRecord[],
  current: PoseKeypointRecord[],
) {
  const shifts = NATIVE_POSE_SEGMENTS.map(([startIndex, endIndex]) => {
    const previousStart = previous[startIndex];
    const previousEnd = previous[endIndex];
    const currentStart = current[startIndex];
    const currentEnd = current[endIndex];
    if (
      !previousStart ||
      !previousEnd ||
      !currentStart ||
      !currentEnd ||
      Math.min(
        toPointVisibility(previousStart),
        toPointVisibility(previousEnd),
        toPointVisibility(currentStart),
        toPointVisibility(currentEnd),
      ) < NATIVE_POSE_MIN_STABILIZER_VISIBILITY
    ) {
      return null;
    }
    return Math.abs(
      getPointDistance(previousStart, previousEnd) -
        getPointDistance(currentStart, currentEnd),
    );
  }).filter((value): value is number => typeof value === "number");
  if (!shifts.length) return 0;
  return shifts.reduce((sum, value) => sum + value, 0) / shifts.length;
}

export function stabilizeNativePoseFrame(
  frame: PoseSequenceFrameRecord,
  previousStableFrame: PoseSequenceFrameRecord | null,
) {
  if (!previousStableFrame) {
    return {
      frame: {
        ...frame,
        keypoints: frame.keypoints.map(clonePoseKeypoint),
      },
      held: false,
    };
  }

  const elapsedMs = frame.capturedAtMs - previousStableFrame.capturedAtMs;
  const coreJump = averageTrackedJump(
    previousStableFrame.keypoints,
    frame.keypoints,
    SUBJECT_LOCK_CORE_LANDMARK_INDEXES,
  );
  const segmentShift = averageSegmentShift(
    previousStableFrame.keypoints,
    frame.keypoints,
  );
  const shouldHoldLastGoodFrame =
    elapsedMs >= 0 &&
    elapsedMs <= NATIVE_POSE_HOLD_LAST_GOOD_MS &&
    (coreJump >= NATIVE_POSE_CORE_TELEPORT_DISTANCE ||
      segmentShift >= NATIVE_POSE_SEGMENT_SHIFT_DISTANCE);

  if (shouldHoldLastGoodFrame) {
    // Preserve the original timestamp. Replayed points are visual-only and
    // must not become a fresh observation that renews subject continuity.
    return {
      frame: {
        ...previousStableFrame,
        keypoints: previousStableFrame.keypoints.map(clonePoseKeypoint),
      },
      held: true,
    };
  }

  return {
    frame: {
      ...frame,
      keypoints: frame.keypoints.map((point, index) =>
        blendPoseKeypoint(previousStableFrame.keypoints[index] ?? point, point),
      ),
    },
    held: false,
  };
}
