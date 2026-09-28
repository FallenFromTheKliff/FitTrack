import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createPoseDiagnostics } from "./pose-diagnostics.ts";
import { createPoseRepEngineState } from "./pose-rep-engine.ts";
import { normalizePoseMovementContract } from "./pose.ts";

const fixtures = JSON.parse(readFileSync(new URL("./pose-camera-fixtures.json", import.meta.url), "utf8"));
const contract = normalizePoseMovementContract(fixtures.families.bench_press.contract)!;

test("diagnostics identify blocked sides and the saved acceptance rules without retaining camera frames", () => {
  const entries: Array<{ prefix: string; json: string }> = [];
  const report = createPoseDiagnostics("test", (prefix, json) => entries.push({ prefix, json }));
  const state = createPoseRepEngineState();
  const keypoints = fixtures.benchRanges.start.map(([x, y, z, visibility]: number[]) => ({ x, y, z, visibility }));
  report({ reason: "required_landmarks_unreliable", timestamp: 1000, state, contract,
    evidence: { keypoints, coordinateDimensions: { width: 1, height: 1 } },
    context: { exerciseId: "saved-exercise-id", setNumber: 2, recording: true } });
  state.repCount = 99;
  const saved = JSON.parse(entries[0]!.json);
  assert.equal(entries[0]!.prefix, "[FitTrack pose:test]");
  assert.equal(saved.reason, "required_landmarks_unreliable");
  assert.equal(saved.reps, 0, "Logging must capture the decision, not a mutable ref");
  assert.equal(saved.exerciseId, "saved-exercise-id");
  assert.ok(Number.isFinite(saved.angles.left));
  assert.ok(Number.isFinite(saved.angles.right));
  assert.deepEqual(saved.effectiveTargets, contract.repThresholds);
  assert.equal(saved.rules.valid, true);
  assert.ok(saved.visibility);
  assert.equal(saved.posture.orientation,contract.bodyOrientation);
  assert.ok(Number.isFinite(saved.posture.torsoAngles.left));
  assert.ok(Number.isFinite(saved.posture.torsoAngles.right));
  assert.ok(saved.posture.torsoRange.max <= 90);
  assert.equal("keypoints" in saved, false);
});

test("diagnostics throttle frames, retain intervening rejection reasons, and immediately report counts", context => {
  const entries: any[] = [];
  const report = createPoseDiagnostics("test", (_prefix, json) => entries.push(JSON.parse(json)));
  const state = createPoseRepEngineState();
  let now = 1000;
  context.mock.method(Date, "now", () => now);
  const send = (timestamp: number, reason: string | null = null) => {
    now = timestamp;
    report({ timestamp, reason, state, contract });
  };
  send(1000);
  send(1050, "torso_slope_below_min");
  send(1100, "torso_slope_below_min");
  send(1200);
  assert.equal(entries.length, 1);
  send(2000);
  assert.equal(entries.length, 2);
  assert.equal(entries[1].blockedSinceLastLog.torso_slope_below_min, 2);
  state.repCount = 1;
  send(2001);
  assert.equal(entries.length, 3);
  assert.equal(entries[2].event, "count_changed");
  assert.equal(entries[2].reps, 1);
  assert.deepEqual(entries[2].blockedSinceLastLog, {});
  report({ timestamp: 500, reason: "camera_frame_stalled", state, contract });
  assert.equal(entries.length, 3, "An older capture timestamp must not defeat the console throttle");
});

test("posture diagnostics show the applied 3D measurement separately from image projection", () => {
  const entries: any[] = [];
  const report = createPoseDiagnostics("test", (_prefix, json) => entries.push(JSON.parse(json)));
  const spatialKeypoints = fixtures.benchRanges.start.map(([x,y,z,visibility]: number[]) => ({x,y,z,visibility}));
  const keypoints = spatialKeypoints.map((p: { x:number; y:number }) => ({...p,x:p.y,y:p.x}));
  report({reason:null,timestamp:1000,state:createPoseRepEngineState(),contract,
    evidence:{keypoints,spatialKeypoints,coordinateDimensions:{width:1,height:1}}});
  const posture = entries[0].posture;
  assert.equal(posture.angleSpace,"world-3d");
  assert.deepEqual(posture.torsoAngles,{left:0,right:0});
  assert.deepEqual(posture.imageTorsoAngles,{left:90,right:90});
});
