import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";
import type { PoseKeypointRecord, PoseMovementContractRecord } from "@fittrack/types";
import {
  createDefaultExerciseMuscleTargets,
  createExerciseMovementProfile,
  createGeneratedExerciseRigFromMovementContract,
  getExerciseBodyCheckScope,
  getSpatialRequirementsForPreset,
  normalizeExerciseMovementProfile,
  setExerciseBodyCheckScope,
  setExerciseBodyOrientation,
  validateExerciseEditorContract,
} from "./exercise-editor.ts";
import { CANONICAL_POSE_CAPABILITIES } from "./fitness-catalog.ts";
import {
  buildFallbackPoseMovementContract,
  computePoseSignals,
  getPoseMovementContractAngle,
  getPoseMovementFrameAssessment,
  getPoseMovementPostureReason,
  getPoseTorsoSlopeRange,
  getPoseTorsoSlopeAngles,
  getPoseMovementRequiredLandmarks,
  normalizePoseMovementContract,
  validatePoseMovementContract,
} from "./pose.ts";
import { createPoseRepEngineState, getPoseRepProgressText, stepPoseRepEngine, stepPoseStaticHold } from "./pose-rep-engine.ts";

const dimensions = { width: 1, height: 1 };
const cameraFixture = JSON.parse(readFileSync(new URL("./pose-camera-fixtures.json", import.meta.url), "utf8"));
const cameraPoints = (tuples: number[][]): PoseKeypointRecord[] =>
  tuples.map(([x,y,z,visibility]) => ({x:x!,y:y!,z:z!,visibility:visibility!}));
function bench() {
  const contract = structuredClone(buildFallbackPoseMovementContract("bench_press"))!;
  // The user's short-range draft, with its overlap corrected. Keep every other safeguard.
  contract.repThresholds = { up: { angle: 155, tolerance: 12 }, down: { angle: 123, tolerance: 15 } };
  return contract;
}
function profile(contract: PoseMovementContractRecord) {
  return createExerciseMovementProfile({ movementContract: contract,
    rig: createGeneratedExerciseRigFromMovementContract({ movementContract: contract }) });
}
function validate(contract: PoseMovementContractRecord, movementProfile = profile(contract)) {
  return validateExerciseEditorContract({ movementProfile, muscleGroup: "chest",
    muscleTargets: createDefaultExerciseMuscleTargets("chest", "Bench press") });
}
function interpolate(a: PoseKeypointRecord[], b: PoseKeypointRecord[], t: number) {
  return a.map((p,i) => ({ ...p, x:p.x+(b[i]!.x-p.x)*t, y:p.y+(b[i]!.y-p.y)*t }));
}
function referenceFrames(contract: PoseMovementContractRecord) {
  // Camera motion is independent of the editor's upright drawing.
  const fixture = cameraFixture.families[contract.exercise];
  const start = cameraPoints(fixture.start);
  const peak = cameraPoints(contract.exercise === "bench_press"
    ? contract.repThresholds.down.angle === 123
      ? cameraFixture.benchRanges.short
      : cameraFixture.benchRanges.full
    : fixture.peak);
  return [start, start,
    ...[.25,.5,.75,1,1].map(t => interpolate(start,peak,t)),
    ...[.25,.5,.75,1,1].map(t => interpolate(peak,start,t))];
}
function run(contract: PoseMovementContractRecord, frames: PoseKeypointRecord[][], interval = 100) {
  let state = createPoseRepEngineState();
  const history: { keypoints: PoseKeypointRecord[]; capturedAtMs: number }[] = [];
  const trace: { count: number; reason: string | null; phase: string }[] = [];
  for (const [index,keypoints] of frames.entries()) {
    const capturedAtMs = 100 + index*interval;
    history.push({ capturedAtMs, keypoints });
    const result = stepPoseRepEngine(state, contract, getPoseMovementContractAngle(contract,keypoints,dimensions),capturedAtMs,
      { keypoints, keypointFrames:history.map(f=>f.keypoints), signals:computePoseSignals(history,dimensions), coordinateDimensions:dimensions });
    state = result.nextState;
    trace.push({count:state.repCount,reason:result.noCountReason,phase:state.phase});
  }
  return { state, trace, reasons: trace.map(t=>t.reason).filter(Boolean) };
}

test("the builder exposes the enforced torso bounds and an explicit saved edit controls the counter", () => {
  const contract = bench();
  contract.bodyOrientation = "horizontal";
  contract.spatialRequirements = { ...contract.spatialRequirements, bodyLineScope: "torso", bodyLineTolerance: 40,
    torsoSlopeMinDeg: undefined, torsoSlopeMaxDeg: undefined };
  assert.deepEqual(getPoseTorsoSlopeRange(contract), { min: 0, max: 40, source: "body_line" });
  // Endpoint frames can share objects; transform each sample once without
  // mutating the shared source and rotating repeated samples back again.
  const upright = referenceFrames(contract).map(frame => frame.map(p => ({...p,x:p.y,y:p.x})));
  const blocked = run(contract,upright);
  assert.equal(blocked.state.repCount,0);
  assert.ok(blocked.reasons.includes("body_line_over_tolerance"));
  // Changing the posture fields is a definition edit. Limb targets stay identical.
  const edited = normalizePoseMovementContract(JSON.parse(JSON.stringify({ ...contract,
    spatialRequirements: { ...contract.spatialRequirements, torsoSlopeMinDeg: 0, torsoSlopeMaxDeg: 90 },
  })))!;
  assert.deepEqual(edited.repThresholds,contract.repThresholds);
  assert.deepEqual(getPoseTorsoSlopeRange(edited), { min: 0, max: 90, source: "explicit" });
  const accepted = run(edited,upright);
  assert.equal(accepted.state.repCount,1,JSON.stringify(accepted.trace));
  const missingHips = structuredClone(upright);
  for (const frame of missingHips) frame[23]!.visibility = frame[24]!.visibility = .1;
  assert.equal(run(edited,missingHips).state.repCount,0,"Posture edits cannot fabricate missing required joints");
});

test("posture diagnostics and bounds use the camera image aspect ratio and preserve orientation boundaries", () => {
  const contract = bench();
  const points = cameraPoints(cameraFixture.benchRanges.start);
  for (const offset of [0,1]) {
    points[11+offset] = {x:.2,y:.2,z:0,visibility:1};
    points[23+offset] = {x:.4,y:.6,z:0,visibility:1};
  }
  const angles = getPoseTorsoSlopeAngles(contract,points,{width:2,height:1});
  assert.ok(Math.abs(angles.left!-45)<1e-6);
  assert.ok(Math.abs(angles.right!-45)<1e-6);
  const upright = {...contract,bodyOrientation:"upright" as const,spatialRequirements:null};
  assert.deepEqual(getPoseTorsoSlopeRange(upright),{min:55,max:90,minExclusive:true,source:"orientation"});
  const any = {...contract,bodyOrientation:"any" as const,spatialRequirements:null};
  assert.deepEqual(getPoseTorsoSlopeRange(any),{min:0,max:90,source:"unrestricted"});
});

for (const {contractExercise: key} of CANONICAL_POSE_CAPABILITIES) {
  test(`builder reference uses the runtime rules: ${key}`, () => {
    const contract = buildFallbackPoseMovementContract(key)!;
    assert.ok(contract);
    const result = validate(contract);
    assert.equal(result.valid,true,result.errors.join("\n"));
    if (contract.repModel === "static_hold") {
      const keypoints = cameraPoints(cameraFixture.families[key].peak);
      let state = createPoseRepEngineState();
      let completed = false;
      for (let timestamp = 100; timestamp <= (contract.holdDurationSeconds!+1)*1000; timestamp += 100) {
        const step = stepPoseStaticHold(state,contract,getPoseMovementContractAngle(contract,keypoints),timestamp,
          {keypoints, signals:computePoseSignals([{keypoints,capturedAtMs:timestamp}],dimensions),coordinateDimensions:dimensions});
        state = step.nextState;
        completed ||= step.holdCompleted;
        assert.equal(step.noCountReason,null);
      }
      assert.equal(completed,true);
    } else {
      const runResult = run(contract,referenceFrames(contract));
      assert.equal(runResult.state.repCount,1,JSON.stringify(runResult.trace));
    }
  });
}

test("short-range builder definition counts with every configured safeguard intact", () => {
  const contract = bench();
  const built = profile(contract);
  assert.equal(validate(contract,built).valid,true);
  assert.deepEqual(built.movementContract!.repThresholds,contract.repThresholds);
  assert.equal(built.movementContract!.spatialRequirements!.bodyLineScope,"torso");
  assert.equal(run(contract,referenceFrames(contract)).state.repCount,1);
  const incorrect = structuredClone(built);
  for (const frame of incorrect.rig!.keyframes) for (const p of frame.keypoints) [p.x,p.y] = [p.y,p.x];
  assert.equal(validate(contract,incorrect).valid,true,"Limb-reference rotation must not become a camera-posture constraint");
  assert.equal(validate(contract,profile(contract)).valid,true,"Reset preserves angle targets independently of camera posture");
});

test("bench torso alignment allows bent legs and cropped ankles; explicit full-body alignment requires ankles", () => {
  const contract = bench();
  const frames = structuredClone(referenceFrames(contract));
  for (const frame of frames) for (const offset of [0,1]) {
    frame[27+offset] = {...frame[23+offset]!, y:frame[23+offset]!.y+.3,visibility:.1};
  }
  assert.equal(run(contract,frames).state.repCount,1);
  const fullBody = {...contract,spatialRequirements:{...contract.spatialRequirements,bodyLineScope:"full_body" as const}};
  assert.ok(getPoseMovementRequiredLandmarks(fullBody).includes("ankles"));
  assert.equal(getPoseMovementFrameAssessment(fullBody,frames[0]!).isReliable,false);
  assert.equal(run(fullBody,frames).state.repCount,0);
  const pushUp = buildFallbackPoseMovementContract("push_up")!;
  assert.equal(pushUp.spatialRequirements!.bodyLineScope,"full_body");
  assert.equal(getPoseMovementFrameAssessment(pushUp,frames[0]!).isReliable,false);
  const folded = structuredClone(referenceFrames(pushUp));
  for (const frame of folded) for (const offset of [0,1]) {
    const shoulder = frame[11+offset]!, hip = frame[23+offset]!;
    frame[27+offset] = {...hip,x:hip.x-(hip.x-shoulder.x),y:hip.y-(hip.y-shoulder.y)};
  }
  const foldedResult = run(pushUp,folded);
  assert.equal(foldedResult.state.repCount,0);
  assert.ok(foldedResult.reasons.includes("body_line_over_tolerance"));
});

test("short-range half policy requires target stability and a return before another count", () => {
  const contract = {...bench(),partialRepPolicy:"count_half_reps" as const};
  const cycle = referenceFrames(contract);
  assert.equal(run(contract,cycle.slice(0,7)).state.repCount,1);
  const held = [...cycle.slice(0,7),...Array.from({length:8},()=>cycle[6]!)];
  assert.equal(run(contract,held).state.repCount,1);
  assert.equal(run(contract,[...cycle,...cycle]).state.repCount,2);
  assert.equal(run(bench(),cycle.slice(0,7)).state.repCount,0,"Full policy requires return");
});

for (const exercise of ["bicep_curl", "squat", "bench_press"] as const) {
  for (const countAt of ["peak", "return"] as const) {
    test(`${exercise} counts at ${countAt} once, keeping its full configured range`, () => {
      const contract = { ...buildFallbackPoseMovementContract(exercise)!, countAt };
      const cycle = referenceFrames(contract);
      const atTarget = cycle.slice(0, 7);
      assert.equal(run(contract, cycle.slice(0, 2)).state.repCount, 0, "Start only arms");
      assert.equal(run(contract, atTarget).state.repCount, countAt === "peak" ? 1 : 0);
      assert.equal(run(contract, [...atTarget, ...Array(8).fill(cycle[6])]).state.repCount,
        countAt === "peak" ? 1 : 0, "Holding the target cannot repeat counts");
      assert.equal(run(contract, cycle).state.repCount, 1);
      assert.equal(run(contract, [...cycle, ...cycle]).state.repCount, 2, "Return re-arms");
      const partial = interpolate(cycle[0]!, cycle[6]!, .3);
      const shortCycle = [cycle[0]!, cycle[0]!, ...Array(6).fill(partial), cycle[0]!, cycle[0]!];
      assert.equal(run(contract, shortCycle).state.repCount, 0, "Incomplete range cannot count");
      assert.equal(run({ ...contract, partialRepPolicy: "review_only" }, cycle).state.repCount, 0);
      const saved = normalizePoseMovementContract(JSON.parse(JSON.stringify(profile(contract).movementContract)))!;
      assert.equal(saved.countAt, countAt);
      assert.deepEqual(saved.repThresholds, contract.repThresholds);
      assert.equal(run(saved, cycle).state.repCount, 1);
    });
  }
}

test("count timing changes invalidate unfinished movement and give actionable field errors", () => {
  const contract = { ...bench(), countAt: "return" as const };
  const cycle = referenceFrames(contract);
  const atTarget = run(contract, cycle.slice(0, 7));
  const changed = { ...contract, countAt: "peak" as const };
  const result = stepPoseRepEngine(atTarget.state, changed,
    getPoseMovementContractAngle(changed, cycle[6]!, dimensions), 800,
    { keypoints: cycle[6]!, coordinateDimensions: dimensions });
  assert.equal(result.nextState.repCount, 0, "A changed setting cannot finish the previous cycle");
  const invalid = { ...contract, countAt: "initial" as never };
  assert.ok(validate(invalid).issues.some(issue => issue.path.endsWith("countAt") && issue.suggestion?.includes("Counting rules")));
});

test("movement-joints framing survives saved-profile normalization and counts cropped curls", () => {
  const original = { ...buildFallbackPoseMovementContract("bicep_curl")!, countAt: "peak" as const };
  const originalCopy = structuredClone(original);
  const edited = setExerciseBodyCheckScope(original, "movement_joints");
  const saved = normalizeExerciseMovementProfile(JSON.parse(JSON.stringify(profile(edited))))!.movementContract!;
  assert.deepEqual(original, originalCopy, "Changing a draft must not mutate its original definition");
  assert.equal(getExerciseBodyCheckScope(saved), "movement_joints");
  assert.equal(saved.bodyOrientation, "any");
  assert.deepEqual(saved.repThresholds, original.repThresholds);
  assert.equal(saved.countAt, original.countAt);
  assert.equal(saved.requiredSides, original.requiredSides);
  assert.equal(saved.trackingRequirements!.minConfidence, original.trackingRequirements!.minConfidence);
  assert.equal(saved.spatialRequirements!.phaseSyncToleranceMs, original.spatialRequirements!.phaseSyncToleranceMs);
  assert.equal(saved.spatialRequirements!.leftRightSymmetryTolerance, original.spatialRequirements!.leftRightSymmetryTolerance);
  assert.deepEqual(new Set(getPoseMovementRequiredLandmarks(saved)), new Set(["shoulders", "elbows", "wrists"]));
  const frames = referenceFrames(saved).map(points => points.map((point,index) => ({
    ...point, visibility: [11,12,13,14,15,16].includes(index) ? .95 : .05,
  })));
  assert.equal(getPoseMovementFrameAssessment(saved, frames[0]).reliableLandmarkCount, 6);
  assert.equal(run(saved, frames.slice(0,7)).state.repCount, 1, "Counts the configured goal with hips and legs out of view");
  assert.equal(run(saved, [...frames.slice(0,7), ...Array(6).fill(frames[6])]).state.repCount, 1, "Holding cannot add reps");
  const partial = interpolate(frames[0]!, frames[6]!, .3);
  assert.equal(run(saved, [frames[0]!,frames[0]!,...Array(6).fill(partial),frames[0]!,frames[0]!]).state.repCount, 0);
  const missingWrist = frames.map(points => points.map((point,index) => ({ ...point, visibility: index === 16 ? .05 : point.visibility })));
  assert.equal(getPoseMovementFrameAssessment(saved, missingWrist[0]).isReliable, false);
  assert.equal(run(saved, missingWrist).state.repCount, 0, "A required working joint cannot be skipped");
});

test("movement-joints framing keeps hips, knees and ankles mandatory for squats", () => {
  const contract = setExerciseBodyCheckScope(buildFallbackPoseMovementContract("squat")!, "movement_joints");
  assert.deepEqual(new Set(getPoseMovementRequiredLandmarks(contract)), new Set(["hips", "knees", "ankles"]));
  const frames = referenceFrames(contract).map(points => points.map((point,index) => ({
    ...point, visibility: [23,24,25,26,27,28].includes(index) ? .95 : .05,
  })));
  assert.equal(run(contract, frames).state.repCount, 1);
  for (const missingIndex of [23,25,27]) {
    const cropped = frames.map(points => points.map((point,index) => ({ ...point, visibility: index === missingIndex ? .05 : point.visibility })));
    assert.equal(getPoseMovementFrameAssessment(contract, cropped[0]).isReliable, false);
    assert.equal(run(contract, cropped).state.repCount, 0);
  }
});

test("explicit legacy hip requirements are not mislabeled as movement joints only", () => {
  const movementOnly = setExerciseBodyCheckScope(buildFallbackPoseMovementContract("bicep_curl")!, "movement_joints");
  const legacy = {
    ...movementOnly,
    trackingRequirements: {
      ...movementOnly.trackingRequirements!,
      requiredLandmarks: ["shoulders", "elbows", "wrists", "hips"],
    },
  };
  assert.equal(getExerciseBodyCheckScope(legacy), "torso");
  const corrected = setExerciseBodyCheckScope(legacy, "movement_joints");
  assert.equal(getExerciseBodyCheckScope(corrected), "movement_joints");
  assert.deepEqual(getPoseMovementRequiredLandmarks(corrected), ["shoulders", "elbows", "wrists"]);
});

test("upper-body and full-body checks restore their required points after movement-only framing", () => {
  const movementOnly = setExerciseBodyCheckScope(buildFallbackPoseMovementContract("bicep_curl")!, "movement_joints");
  const upper = setExerciseBodyCheckScope(movementOnly, "torso");
  const whole = setExerciseBodyCheckScope(upper, "full_body");
  assert.equal(getExerciseBodyCheckScope(upper), "torso");
  assert.equal(getExerciseBodyCheckScope(whole), "full_body");
  const cropped = cameraPoints(cameraFixture.families.bicep_curl.start);
  cropped[27]!.visibility = cropped[28]!.visibility = .05;
  assert.equal(getPoseMovementFrameAssessment(upper, cropped).isReliable, true);
  assert.equal(getPoseMovementFrameAssessment(whole, cropped).isReliable, false);
  cropped[23]!.visibility = cropped[24]!.visibility = .05;
  assert.equal(getPoseMovementFrameAssessment(upper, cropped).isReliable, false);
  assert.equal(getPoseMovementFrameAssessment(movementOnly, cropped).isReliable, true);
  const upright = setExerciseBodyOrientation(movementOnly, "upright");
  assert.equal(getExerciseBodyCheckScope(upright), "torso");
  assert.equal(getPoseMovementFrameAssessment(upright, cropped).isReliable, false);
  assert.deepEqual(setExerciseBodyCheckScope(whole, "movement_joints"), movementOnly);
});

test("waiting and rejected attempts report the exact missing endpoint and recover", () => {
  const contract = bench();
  const cycle = referenceFrames(contract);
  // 140° leaves the >=143° start band without reaching the <=138° target.
  const short = cameraPoints(cameraFixture.benchRanges.half);
  const partial = [cycle[0]!,cycle[1]!,short,short,cycle[0]!,cycle[0]!];
  const rejected = run(contract,partial);
  assert.equal(rejected.state.repCount,0);
  assert.ok(rejected.reasons.includes("rep_target_not_reached"),JSON.stringify(rejected.trace));
  assert.equal(run(contract,[...partial,...cycle]).state.repCount,1);
  const oneTarget = [cycle[0]!,cycle[1]!,short,cycle[6]!,short,cycle[0]!,cycle[0]!];
  assert.ok(run(contract,oneTarget).reasons.includes("rep_target_not_held"));
  const neverStart = Array.from({length:10},()=>short);
  assert.equal(run(contract,neverStart).state.repCount,0);
  const message = getPoseRepProgressText(createPoseRepEngineState(),contract,short);
  assert.match(message,/Start ≥ 143°/);
  assert.match(message,/left.*right.*both sides/);
});

test("noise, wrong posture, missing primary joints, and mismatched arms never count", () => {
  const contract = bench();
  const cycle = referenceFrames(contract);
  const jitter = Array.from({length:30},(_,i)=>interpolate(cycle[0]!,cycle[6]!,i%2*.05));
  assert.equal(run(contract,jitter).state.repCount,0);
  for (const failure of ["upright","missing_wrist","one_arm"] as const) {
    const frames = structuredClone(cycle);
    for (const frame of frames) {
      if (failure === "upright") for (const p of frame) [p.x,p.y] = [p.y,p.x];
      if (failure === "missing_wrist") frame[15]!.visibility = .1;
      if (failure === "one_arm") for (const i of [12,14,16]) frame[i] = {...cycle[0]![i]!};
    }
    const result = run(contract,frames);
    assert.equal(result.state.repCount,0,failure);
  }
});

test("alignment scope round-trips and a dishonest posture signal cannot bypass landmark geometry", () => {
  const contract = bench();
  const normalized = normalizePoseMovementContract(JSON.parse(JSON.stringify(contract)))!;
  assert.deepEqual(normalized.spatialRequirements,contract.spatialRequirements);
  const invalid = {...contract,spatialRequirements:{...contract.spatialRequirements,bodyLineScope:"unknown"}};
  assert.ok(validatePoseMovementContract(invalid as PoseMovementContractRecord).errors.includes("body_line_scope_invalid"));
  const keypoints = structuredClone(referenceFrames(contract)[0]!);
  for (const p of keypoints) [p.x,p.y] = [p.y,p.x];
  assert.equal(getPoseMovementPostureReason(contract,keypoints),"body_line_over_tolerance");
});

test("the actual editor presets produce countable references without contradictory posture limits", () => {
  for (const [exercise,preset] of [
    ["squat","squat_hinge"], ["push_up","ground_press"], ["dip","ground_press"],
    ["pull_up","vertical_pull"], ["bench_press","none"], ["bicep_curl","none"],
  ] as const) {
    const base = buildFallbackPoseMovementContract(exercise)!;
    const contract = {...base,spatialRequirements:getSpatialRequirementsForPreset(preset,base)};
    assert.equal(validate(contract).valid,true,`${exercise}: ${validate(contract).errors.join("\n")}`);
    const result = run(contract,referenceFrames(contract));
    assert.equal(result.state.repCount,1,`${exercise}: ${JSON.stringify(result.trace)}`);
  }
  const pull = buildFallbackPoseMovementContract("pull_up")!;
  const invalid = {...pull,spatialRequirements:{...pull.spatialRequirements,torsoSlopeMinDeg:60,torsoSlopeMaxDeg:35}};
  assert.ok(validatePoseMovementContract(invalid).errors.includes("torso_slope_conflicts_with_orientation"));
  assert.ok(validate(invalid).issues.some(issue=>issue.path.endsWith("torsoSlopeMaxDeg") && issue.suggestion?.includes("minimum")));
  assert.equal(run(invalid,referenceFrames(pull)).state.repCount,0);
});
