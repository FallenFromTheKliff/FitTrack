import type { PoseKeypointRecord } from "@fittrack/types";

export const POSE_SUBJECT_TRACKER_FRESHNESS_MS = 350;
export const POSE_SUBJECT_TRACKER_STABLE_MS = 400;
export const POSE_SUBJECT_TRACKER_LOSS_GRACE_MS = 5_000;
export const POSE_SUBJECT_TRACKER_MAX_CANDIDATES = 3;

export type PoseSubjectTrackingMode = "off" | "on";

export type PoseSubjectCandidate = {
  confidence?: number;
  keypoints: PoseKeypointRecord[];
  spatialKeypoints?: PoseKeypointRecord[];
};

export type PoseSubjectTrackerStatus =
  | "searching"
  | "tracking"
  | "paused"
  | "lost";

type PoseSubjectSignature = {
  anchors: Array<{ x: number; y: number } | null>;
  center: { x: number; y: number };
  scale: number;
};

export type PoseSubjectTrackerState = {
  generation: number;
  lastAcceptedAtMs: number | null;
  lastFrameAtMs: number | null;
  missingSinceMs: number | null;
  mode: PoseSubjectTrackingMode;
  reacquireObservations: number;
  selected: PoseSubjectSignature | null;
  stableSinceMs: number | null;
  stableSignature: PoseSubjectSignature | null;
  stableObservations: number;
  status: PoseSubjectTrackerStatus;
  streamId: number;
  velocity: { x: number; y: number };
};

export type PoseSubjectTrackerResult = {
  candidate: PoseSubjectCandidate | null;
  candidateFresh: boolean;
  canCount: boolean;
  nextState: PoseSubjectTrackerState;
  reason:
    | "ambiguous"
    | "duplicate"
    | "fresh_match_required"
    | "long_loss"
    | "no_body"
    | "stable_window"
    | null;
  resetRepCycle: boolean;
  status: PoseSubjectTrackerStatus;
};

const TRACK_ANCHOR_INDEXES = [11, 12, 23, 24, 13, 14, 15, 16, 25, 26] as const;

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function averageVisibility(keypoints: PoseKeypointRecord[]) {
  const values = keypoints
    .filter((point) => finite(point.visibility))
    .map((point) => clamp(point.visibility, 0, 1));
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

function describeCandidate(
  candidate: PoseSubjectCandidate,
): PoseSubjectSignature | null {
  if (candidate.keypoints.length !== 33) return null;
  const visible = (index: number) => {
    const point = candidate.keypoints[index];
    return point && point.visibility >= 0.24 && finite(point.x) && finite(point.y);
  };
  const average = (indexes: number[]) => {
    const points = indexes.filter(visible).map(index => candidate.keypoints[index]);
    return points.length ? {
      x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
      y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    } : null;
  };
  const shoulderCenter = average([11, 12]), hipCenter = average([23, 24]);
  // Association needs a body signature. Exercise-specific joint eligibility is
  // evaluated once by the movement contract, including one-sided references.
  if (!shoulderCenter || !hipCenter || TRACK_ANCHOR_INDEXES.filter(visible).length < 4) return null;
  const center = { x: (shoulderCenter.x + hipCenter.x) / 2, y: (shoulderCenter.y + hipCenter.y) / 2 };
  const scale = Math.max(
    Math.hypot(shoulderCenter.x - hipCenter.x, shoulderCenter.y - hipCenter.y),
    0.08,
  );

  return {
    anchors: TRACK_ANCHOR_INDEXES.map((index) => {
      const point = candidate.keypoints[index];
      if (!point || point.visibility < 0.24 || !finite(point.x) || !finite(point.y)) {
        return null;
      }
      return {
        x: (point.x - center.x) / scale,
        y: (point.y - center.y) / scale,
      };
    }),
    center,
    scale,
  };
}

function normalizedCandidate(candidate: PoseSubjectCandidate) {
  const signature = describeCandidate(candidate);
  if (!signature) return null;
  return {
    candidate,
    confidence:
      finite(candidate.confidence) && candidate.confidence >= 0
        ? clamp(candidate.confidence, 0, 1)
        : averageVisibility(candidate.keypoints),
    signature,
  };
}

function candidateDistance(
  first: PoseSubjectSignature,
  second: PoseSubjectSignature,
  predictedCenter = first.center,
) {
  const centerDistance =
    Math.hypot(second.center.x - predictedCenter.x, second.center.y - predictedCenter.y) /
    Math.max(first.scale, second.scale, 0.08);
  const scaleRatio = second.scale / Math.max(first.scale, 0.08);
  if (scaleRatio < 0.5 || scaleRatio > 2) return Number.POSITIVE_INFINITY;

  const anchorDistances = first.anchors
    .map((anchor, index) => {
      const next = second.anchors[index];
      return anchor && next ? Math.hypot(anchor.x - next.x, anchor.y - next.y) : null;
    })
    .filter((value): value is number => value !== null);
  const anchorDistance = anchorDistances.length
    ? anchorDistances.reduce((total, value) => total + value, 0) / anchorDistances.length
    : 1;
  return centerDistance * 0.55 + Math.abs(Math.log(scaleRatio)) * 0.2 + anchorDistance * 0.25;
}

function cloneState(state: PoseSubjectTrackerState): PoseSubjectTrackerState {
  return {
    ...state,
    selected: state.selected
      ? {
          ...state.selected,
          anchors: state.selected.anchors.map((anchor) =>
            anchor ? { ...anchor } : null,
          ),
          center: { ...state.selected.center },
        }
      : null,
    stableSignature: state.stableSignature
      ? {
          ...state.stableSignature,
          anchors: state.stableSignature.anchors.map((anchor) =>
            anchor ? { ...anchor } : null,
          ),
          center: { ...state.stableSignature.center },
        }
      : null,
    velocity: { ...state.velocity },
  };
}

export function createPoseSubjectTrackerState(
  mode: PoseSubjectTrackingMode = "off",
  generation = 0,
  streamId = 0,
): PoseSubjectTrackerState {
  return {
    generation,
    lastAcceptedAtMs: null,
    lastFrameAtMs: null,
    missingSinceMs: null,
    mode,
    reacquireObservations: 0,
    selected: null,
    stableSinceMs: null,
    stableSignature: null,
    stableObservations: 0,
    status: "searching",
    streamId,
    velocity: { x: 0, y: 0 },
  };
}

export function resetPoseSubjectTrackerState(
  state: PoseSubjectTrackerState | null | undefined,
  mode: PoseSubjectTrackingMode = state?.mode ?? "off",
  generation = state?.generation ?? 0,
  streamId = state?.streamId ?? 0,
) {
  return createPoseSubjectTrackerState(mode, generation, streamId);
}

function result(
  state: PoseSubjectTrackerState,
  input: {
    candidate?: PoseSubjectCandidate | null;
    candidateFresh: boolean;
    canCount?: boolean;
    reason?: PoseSubjectTrackerResult["reason"];
    resetRepCycle?: boolean;
    status: PoseSubjectTrackerStatus;
  },
): PoseSubjectTrackerResult {
  return {
    candidate: input.candidate ?? null,
    candidateFresh: input.candidateFresh,
    canCount: input.canCount ?? false,
    nextState: state,
    reason: input.reason ?? null,
    resetRepCycle: input.resetRepCycle ?? false,
    status: input.status,
  };
}

export function advancePoseSubjectTracker(
  previousState: PoseSubjectTrackerState,
  input: {
    candidates: readonly PoseSubjectCandidate[] | null | undefined;
    capturedAtMs: number;
    generation?: number;
    mode: PoseSubjectTrackingMode;
    nowMs?: number;
    streamId?: number;
  },
): PoseSubjectTrackerResult {
  const nowMs = input.nowMs ?? Date.now();
  const generation = input.generation ?? previousState.generation;
  const streamId = input.streamId ?? previousState.streamId;
  const state =
    previousState.mode !== input.mode ||
    previousState.generation !== generation ||
    previousState.streamId !== streamId
      ? createPoseSubjectTrackerState(input.mode, generation, streamId)
      : cloneState(previousState);

  const candidateFresh =
    finite(input.capturedAtMs) &&
    finite(nowMs) &&
    input.capturedAtMs <= nowMs + 50 &&
    nowMs - input.capturedAtMs <= POSE_SUBJECT_TRACKER_FRESHNESS_MS &&
    (state.lastFrameAtMs === null || input.capturedAtMs > state.lastFrameAtMs);

  if (!candidateFresh) {
    return result(state, {
      candidateFresh: false,
      reason: state.lastFrameAtMs === input.capturedAtMs ? "duplicate" : "no_body",
      resetRepCycle: false,
      status: state.status,
    });
  }

  state.lastFrameAtMs = input.capturedAtMs;
  const observedCandidates = (input.candidates ?? [])
    .slice(0, POSE_SUBJECT_TRACKER_MAX_CANDIDATES)
    .filter(candidate => candidate.keypoints.length === 33 && candidate.keypoints.some(
      point => point.visibility >= .24 && finite(point.x) && finite(point.y),
    ));

  if (state.mode === "off") {
    state.stableSinceMs = null;
    state.stableSignature = null;
    state.stableObservations = 0;
    state.missingSinceMs = null;
    state.reacquireObservations = 0;
    // With association off, the exercise decides which joints must be visible.
    // A torso signature is only needed for matching identities across people.
    if (observedCandidates.length !== 1) {
      state.selected = null;
      state.status = observedCandidates.length > 1 ? "paused" : "searching";
      return result(state, {
        candidateFresh: true,
        reason: observedCandidates.length > 1 ? "ambiguous" : "no_body",
        resetRepCycle: previousState.status === "tracking",
        status: state.status,
      });
    }
    state.selected = describeCandidate(observedCandidates[0]);
    state.lastAcceptedAtMs = input.capturedAtMs;
    state.status = "tracking";
    return result(state, {
      candidate: observedCandidates[0],
      candidateFresh: true,
      canCount: true,
      status: "tracking",
    });
  }

  const candidates = observedCandidates.map(normalizedCandidate)
    .filter((value): value is NonNullable<ReturnType<typeof normalizedCandidate>> => value !== null);

  if (state.selected) {
    if (state.missingSinceMs !== null) {
      if (
        nowMs - state.missingSinceMs > POSE_SUBJECT_TRACKER_LOSS_GRACE_MS ||
        state.lastAcceptedAtMs === null ||
        input.capturedAtMs - state.lastAcceptedAtMs > POSE_SUBJECT_TRACKER_LOSS_GRACE_MS
      ) {
        state.status = "lost";
        return result(state, {
          candidateFresh: true,
          reason: "long_loss",
          resetRepCycle: true,
          status: "lost",
        });
      }
    }

    const predictedCenter = {
      x:
        state.selected.center.x +
        state.velocity.x * Math.max(0, input.capturedAtMs - (state.lastAcceptedAtMs ?? input.capturedAtMs)),
      y:
        state.selected.center.y +
        state.velocity.y * Math.max(0, input.capturedAtMs - (state.lastAcceptedAtMs ?? input.capturedAtMs)),
    };
    const matches = candidates
      .map((entry) => ({ entry, score: candidateDistance(state.selected!, entry.signature, predictedCenter) }))
      .filter(({ score }) => Number.isFinite(score) && score <= 1.05)
      .sort((first, second) => first.score - second.score);

    if (matches.length === 0) {
      state.missingSinceMs ??= input.capturedAtMs;
      state.reacquireObservations = 0;
      state.status = "paused";
      return result(state, {
        candidateFresh: true,
        reason:
          nowMs - state.missingSinceMs > POSE_SUBJECT_TRACKER_LOSS_GRACE_MS
            ? "long_loss"
            : "fresh_match_required",
        resetRepCycle: true,
        status: state.status,
      });
    }

    const best = matches[0];
    const second = matches[1];
    if (second && second.score - best.score < 0.12) {
      state.status = "paused";
      state.reacquireObservations = 0;
      return result(state, {
        candidateFresh: true,
        reason: "ambiguous",
        resetRepCycle: true,
        status: "paused",
      });
    }

    const previousAcceptedAtMs = state.lastAcceptedAtMs;
    const elapsedMs = Math.max(1, input.capturedAtMs - (previousAcceptedAtMs ?? input.capturedAtMs));
    state.velocity = {
      x: clamp((best.entry.signature.center.x - state.selected.center.x) / elapsedMs, -0.002, 0.002),
      y: clamp((best.entry.signature.center.y - state.selected.center.y) / elapsedMs, -0.002, 0.002),
    };
    state.selected = best.entry.signature;
    state.lastAcceptedAtMs = input.capturedAtMs;
    if (state.missingSinceMs !== null) {
      state.reacquireObservations += 1;
      state.missingSinceMs = null;
      if (state.reacquireObservations < 2) {
        state.status = "paused";
        return result(state, {
          candidate: best.entry.candidate,
          candidateFresh: true,
          reason: "fresh_match_required",
          resetRepCycle: true,
          status: "paused",
        });
      }
      state.reacquireObservations = 0;
    }
    state.status = "tracking";
    return result(state, {
      candidate: best.entry.candidate,
      candidateFresh: true,
      canCount: true,
      status: "tracking",
    });
  }

  if (candidates.length !== 1) {
    state.stableSinceMs = null;
    state.stableSignature = null;
    state.stableObservations = 0;
    state.status = candidates.length > 1 ? "paused" : "searching";
    return result(state, {
      candidateFresh: true,
      reason: candidates.length > 1 ? "ambiguous" : "no_body",
      status: state.status,
    });
  }

  const candidate = candidates[0];
  const isSameStableCandidate =
    state.stableSignature &&
    candidateDistance(state.stableSignature, candidate.signature) <= 0.35;
  if (!isSameStableCandidate) {
    state.stableSignature = candidate.signature;
    state.stableSinceMs = input.capturedAtMs;
    state.stableObservations = 1;
  } else {
    state.stableObservations += 1;
  }
  const stableDuration = input.capturedAtMs - (state.stableSinceMs ?? input.capturedAtMs);
  if (stableDuration < POSE_SUBJECT_TRACKER_STABLE_MS || state.stableObservations < 3) {
    state.status = "searching";
    return result(state, {
      candidate: candidate.candidate,
      candidateFresh: true,
      reason: "stable_window",
      resetRepCycle: false,
      status: "searching",
    });
  }

  state.selected = candidate.signature;
  state.stableSignature = null;
  state.stableSinceMs = null;
  state.stableObservations = 0;
  state.lastAcceptedAtMs = input.capturedAtMs;
  state.status = "tracking";
  return result(state, {
    candidate: candidate.candidate,
    candidateFresh: true,
    canCount: true,
    status: "tracking",
  });
}
