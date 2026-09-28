import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { normalizePoseMovementContract } from "@fittrack/utils/pose";
import { getRepGateProgress, getRepGateState, getRepGateGeometry, getRepGateBlockedCopy } from "../../apps/mobile/lib/workout/repGateFeedback.ts";

const fixtures = JSON.parse(readFileSync(new URL("./pose-camera-fixtures.json", import.meta.url), "utf8"));
const contract = normalizePoseMovementContract(fixtures.families.bench_press.contract)!;
contract.repThresholds = { down: { angle: 123, tolerance: 15 }, up: { angle: 155, tolerance: 12 } };

test("the rail does not announce an accepted target until the counter accepts it", () => {
  const input = { currentAngle: 110, currentPhase: "primed", hasLiveKeypoints: true,
    lowConfidence: false, progress: 1, repPathUnblocked: true };
  assert.equal(getRepGateState(input), "waiting");
  assert.equal(getRepGateState({ ...input, currentPhase: "down" }), "moving");
  assert.equal(getRepGateState({ ...input, currentPhase: "up" }), "target");
  assert.equal(getRepGateState({ ...input, currentPhase: "up", repPathUnblocked: false }), "unreliable");
  assert.equal(getRepGateState({ ...input, currentPhase: "up", lowConfidence: true }), "unreliable");
});

test("progress uses the same tolerance endpoints as the counter and clamps overshoot", () => {
  assert.equal(getRepGateProgress(143, contract), 0);
  assert.equal(getRepGateProgress(138, contract), 1);
  assert.equal(getRepGateProgress(140.5, contract), .5);
  assert.equal(getRepGateProgress(180, contract), 0);
  assert.equal(getRepGateProgress(30, contract), 1);
  const increasing = { ...contract, repThresholds: { down: { angle: 155, tolerance: 12 }, up: { angle: 123, tolerance: 15 } } };
  assert.equal(getRepGateProgress(138, increasing), 0);
  assert.equal(getRepGateProgress(143, increasing), 1);
});

test("the reported live blockers have actionable existing-badge copy even when the angle reaches the dot", () => {
  assert.deepEqual(getRepGateBlockedCopy("Waiting for clean body line over tolerance evidence before counting.", []),
    { label: "Check body alignment", support: "Match saved posture" });
  assert.deepEqual(getRepGateBlockedCopy("Waiting for clean side symmetry over tolerance evidence before counting.", []),
    { label: "Move both arms", support: "Keep them aligned" });
  assert.deepEqual(getRepGateBlockedCopy("Tracking unreliable", ["left_hip","right_hip"]),
    { label: "Show hips", support: "Required for tracking" });
  assert.deepEqual(getRepGateBlockedCopy(null, ["right_wrist"]),
    { label: "Show wrists", support: "Keep arms in frame" });
  assert.equal(getRepGateBlockedCopy(null, []),null);
});

test("the orb and fill remain between the measured gate centers at any viewport height", () => {
  for (const [target, start] of [[12.5, 162.5], [12.5, 362.5], [12.5, 12.5]]) {
    for (const progress of [-.2, 0, .25, 1, 1.5]) {
      const rail = getRepGateGeometry(start!, target!, progress);
      assert.ok(rail.center >= target! && rail.center <= start!);
      assert.equal(rail.center + rail.fillHeight, start);
      assert.equal(rail.top + rail.height, start);
    }
  }
  assert.deepEqual(getRepGateGeometry(212.5, 12.5, 1), { top: 12.5, height: 200, center: 12.5, fillHeight: 200 });
});
