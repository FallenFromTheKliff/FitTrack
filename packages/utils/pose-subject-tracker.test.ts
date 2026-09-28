import assert from "node:assert/strict";
import test from "node:test";

import type { PoseKeypointRecord } from "@fittrack/types";

import {
  advancePoseSubjectTracker,
  createPoseSubjectTrackerState,
  type PoseSubjectCandidate,
} from "./pose-subject-tracker.ts";

function makePose(offsetX = 0, offsetY = 0): PoseKeypointRecord[] {
  return Array.from({ length: 33 }, (_, index) => ({
    visibility: 0.9,
    x: 0.28 + (index % 5) * 0.035 + offsetX,
    y: 0.18 + Math.floor(index / 5) * 0.045 + offsetY,
    z: 0,
  }));
}

function candidate(keypoints: PoseKeypointRecord[]): PoseSubjectCandidate {
  return { confidence: 0.9, keypoints };
}

function advance(
  state: ReturnType<typeof createPoseSubjectTrackerState>,
  candidates: PoseSubjectCandidate[],
  timestamp: number,
) {
  return advancePoseSubjectTracker(state, {
    candidates,
    capturedAtMs: timestamp,
    generation: 4,
    mode: "on",
    nowMs: timestamp,
    streamId: 7,
  });
}

test("automatic tracking waits for stability and follows reordered candidates", () => {
  const target = candidate(makePose());
  let state = createPoseSubjectTrackerState("on", 4, 7);
  let transition = advance(state, [target], 0);
  assert.equal(transition.status, "searching");
  state = transition.nextState;
  transition = advance(state, [candidate(makePose(0.005))], 220);
  assert.equal(transition.status, "searching");
  state = transition.nextState;
  transition = advance(state, [candidate(makePose(0.01))], 480);
  assert.equal(transition.status, "tracking");
  assert.equal(transition.canCount, true);

  state = transition.nextState;
  const reordered = advance(
    state,
    [candidate(makePose(0.55)), candidate(makePose(0.015))],
    620,
  );
  assert.equal(reordered.status, "tracking");
  assert.equal(reordered.canCount, true);
  assert.ok((reordered.candidate?.keypoints[0]?.x ?? 0) < 0.5);
});

test("tracking pauses through loss, requires fresh reacquisition, and never switches after long loss", () => {
  const target = candidate(makePose());
  let state = createPoseSubjectTrackerState("on", 4, 7);
  for (const timestamp of [0, 220, 480]) {
    state = advance(state, [target], timestamp).nextState;
  }

  const shortLoss = advance(state, [], 700);
  assert.equal(shortLoss.status, "paused");
  state = shortLoss.nextState;
  const firstMatch = advance(state, [candidate(makePose(0.01))], 820);
  assert.equal(firstMatch.status, "paused");
  state = firstMatch.nextState;
  const secondMatch = advance(state, [candidate(makePose(0.015))], 940);
  assert.equal(secondMatch.status, "tracking");

  state = advance(secondMatch.nextState, [], 1_200).nextState;
  const longLoss = advance(state, [], 6_400);
  assert.equal(longLoss.status, "lost");
  const postLossCandidate = advance(
    longLoss.nextState,
    [candidate(makePose(0.5))],
    6_520,
  );
  assert.equal(postLossCandidate.status, "lost");
  assert.equal(postLossCandidate.canCount, false);
});

test("ambiguous, stale, and Off observations never advance the selected track", () => {
  const target = candidate(makePose());
  let state = createPoseSubjectTrackerState("on", 4, 7);
  for (const timestamp of [0, 220, 480]) {
    state = advance(state, [target], timestamp).nextState;
  }

  const ambiguous = advance(
    state,
    [candidate(makePose(0.01)), candidate(makePose(0.012))],
    600,
  );
  assert.equal(ambiguous.status, "paused");
  assert.equal(ambiguous.canCount, false);

  const stale = advance(ambiguous.nextState, [target], 600);
  assert.equal(stale.candidateFresh, false);
  assert.equal(stale.resetRepCycle, false);
  assert.equal(stale.status, "paused");

  const off = advancePoseSubjectTracker(createPoseSubjectTrackerState("off"), {
    candidates: [target],
    capturedAtMs: 100,
    mode: "off",
    nowMs: 100,
    streamId: 1,
  });
  assert.equal(off.canCount, true);
  const offAmbiguous = advancePoseSubjectTracker(off.nextState, {
    candidates: [target, candidate(makePose(0.5))],
    capturedAtMs: 220,
    mode: "off",
    nowMs: 220,
    streamId: 1,
  });
  assert.equal(offAmbiguous.canCount, false);
  assert.equal(offAmbiguous.reason, "ambiguous");
});

test("association off accepts cropped exercise joints and still resets unfinished motion on loss", () => {
  const cropped = candidate(makePose().map((point, index) => ({
    ...point, visibility: [11, 12, 13, 15].includes(index) ? .95 : .05,
  })));
  const tick = (state: ReturnType<typeof createPoseSubjectTrackerState>, candidates: PoseSubjectCandidate[], time: number) =>
    advancePoseSubjectTracker(state, {mode: "off", candidates, capturedAtMs: time, nowMs: time});
  const tracked = tick(createPoseSubjectTrackerState("off"), [cropped], 100);
  assert.equal(tracked.canCount, true);
  assert.equal(tracked.nextState.selected, null, "Counting off does not require an identity torso signature");
  const duplicate = tick(tracked.nextState, [cropped], 100);
  assert.equal(duplicate.candidateFresh, false);
  const lost = tick(tracked.nextState, [], 250);
  assert.equal(lost.canCount, false);
  assert.equal(lost.resetRepCycle, true);
  const resumed = tick(lost.nextState, [cropped], 400);
  assert.equal(resumed.canCount, true);
  const ambiguous = tick(resumed.nextState, [cropped, cropped], 550);
  assert.equal(ambiguous.canCount, false);
  assert.equal(ambiguous.resetRepCycle, true);
  const empty = candidate(makePose().map(point => ({...point, visibility: .05})));
  assert.equal(tick(resumed.nextState, [empty], 550).canCount, false);
  const associationOn = advance(createPoseSubjectTrackerState("on", 4, 7), [cropped], 100);
  assert.equal(associationOn.canCount, false, "Identity association retains its torso requirement");
});
