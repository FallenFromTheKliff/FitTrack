import assert from "node:assert/strict";
import test from "node:test";
import type { FitnessExerciseRecord, TrainingPlanExerciseRecord, PlannedPoseTrackingSnapshot } from "@fittrack/types";
import { buildFallbackPoseMovementContract, createExerciseMovementProfile, createGeneratedExerciseRigFromMovementContract,
  getPoseMovementFrameAssessment, normalizePoseMovementContract, resolveExerciseTracking, validateExerciseTrackingConfiguration } from "@fittrack/utils";
import { applyPlannedTrackingSnapshotToTarget, buildWorkoutCameraTargetChain } from "../../apps/mobile/components/workout/workout-camera-target";
import { matchesPlannedTrackingSnapshot, refreshLatestWorkoutExercises, resolveWorkoutExerciseContract } from "../../apps/mobile/lib/workout/exerciseContractResolver";

function exercise(id = "exercise-101", family = "bench_press"): FitnessExerciseRecord {
  return { id, name: "Barbell Bench Presss renamed", isActive: true, trackingMode: "inherit", aliases: [],
    movementProfile: createExerciseMovementProfile({ movementContract: buildFallbackPoseMovementContract(family)! }),
    handShapeProfile: null, movementContractIdentity: { exerciseId: id, familyKey: family, revision: 3, source: "family", trackingMode: "inherit" },
  } as unknown as FitnessExerciseRecord;
}
function slot(record: FitnessExerciseRecord, overrides = {}): TrainingPlanExerciseRecord {
  return { id: "slot-" + record.id, exerciseId: record.id, exerciseName: "Old display name", sets: 2, reps: 9,
    restSeconds: 20, durationSeconds: null, ...overrides } as TrainingPlanExerciseRecord;
}
function chain(records: FitnessExerciseRecord[], slots: TrainingPlanExerciseRecord[]) {
  return buildWorkoutCameraTargetChain({ exerciseDefinitions: new Map(records.map(e => [e.id, e])),
    orderedExercises: slots, currentExercise: slots[0]!, currentSetNumber: 1, completedSetKeys: new Set(),
    planId: "plan", planTitle: "Plan", sessionId: "session" });
}

test("renamed exercise beyond page one remains camera capable without reference artwork", async () => {
  const record = exercise();
  let byIdCalls = 0;
  const fresh = await refreshLatestWorkoutExercises({ exerciseId: record.id, fallbackExercises: [],
    refetchCatalog: async () => { throw new Error("Catalog paging must not be used"); },
    refetchExercise: async () => { byIdCalls++; return record; } });
  assert.equal(byIdCalls, 1);
  assert.equal(resolveWorkoutExerciseContract({ exerciseId: record.id, exercises: fresh, label: "Old name" })?.exercise.id, record.id);
  assert.equal(resolveWorkoutExerciseContract({ exerciseId: "missing", exercises: fresh, label: record.name }), null);
  const target = chain(fresh, [slot(record)]);
  assert.equal(target?.exerciseId, record.id);
  assert.equal(target?.targetReps, 9);
  assert.equal(target?.nextTarget?.setNumber, 2);
});

test("manual, invalid, and failed fetch states cannot fall back to cached names", async () => {
  const record = exercise();
  assert.equal(resolveExerciseTracking({ ...record, trackingMode: "manual" }).status, "manual");
  assert.equal(resolveExerciseTracking({ ...record, movementProfile: null }).status, "unavailable");
  assert.equal(validateExerciseTrackingConfiguration({ movementProfile: null, expectedMovementExercise: "bench_press", requireRig: false }).valid, false);
  await assert.rejects(refreshLatestWorkoutExercises({ exerciseId: record.id, fallbackExercises: [record],
    refetchCatalog: async () => [record], refetchExercise: async () => { throw new Error("offline"); } }), /offline/);
  const manual = { ...exercise("manual"), trackingMode: "manual" as const };
  const target = chain([record, manual], [slot(record, { sets: 1 }), slot(manual)]);
  assert.equal(target?.nextTarget, null);
  assert.equal(target?.completeWorkoutAfterSet, false);
});

test("movement type selects the hold target even when the plan also has reps", () => {
  const hold = exercise("hold", "plank");
  const target = chain([hold], [slot(hold, { reps: 10, durationSeconds: 20 })]);
  assert.equal(target?.targetReps, 0);
  assert.equal(target?.targetDurationSeconds, 20);
});

test("bench requires its eight declared joints, not twelve unrelated landmarks", () => {
  const contract = normalizePoseMovementContract(exercise().movementProfile!.movementContract)!;
  assert.equal(contract.trackingRequirements?.minReliableFrameLandmarks, 8);
  const points = createGeneratedExerciseRigFromMovementContract({ movementContract: contract }).keyframes[0]!.keypoints
    .map((point, index) => ({ ...point, visibility: [11,12,13,14,15,16,23,24].includes(index) ? .99 : 0 }));
  assert.equal(getPoseMovementFrameAssessment(contract, points).isReliable, true);
  points[13]!.visibility = 0;
  assert.equal(getPoseMovementFrameAssessment(contract, points).isReliable, false);
});

test("snapshot binds exercise, workout, slot and set; another set cannot reuse it", () => {
  const record = exercise();
  const target = chain([record], [slot(record)])!;
  const snapshot = { exerciseId: record.id, workoutSessionId: target.sessionId, planExerciseId: target.planExerciseId,
    setNumber: 1, movementProfile: structuredClone(record.movementProfile), identity: record.movementContractIdentity,
    handShapeProfile: null, exerciseName: record.name } as PlannedPoseTrackingSnapshot;
  assert.equal(matchesPlannedTrackingSnapshot(snapshot, target), true);
  for (const change of [{ setNumber: 2 }, { exerciseId: "other" }, { sessionId: "other" }, { planExerciseId: "other" }]) {
    assert.equal(matchesPlannedTrackingSnapshot(snapshot, { ...target, ...change }), false);
  }
  record.movementProfile!.movementContract!.repThresholds.down.angle = 140;
  assert.notEqual(snapshot.movementProfile.movementContract!.repThresholds.down.angle, 140);
});

test("a changed movement type uses the frozen set's target and cannot replace another set", () => {
  const record = exercise();
  const target = chain([record], [slot(record)])!;
  const snapshot = { exerciseId: record.id, workoutSessionId: target.sessionId, planExerciseId: target.planExerciseId,
    setNumber: 1, movementProfile: exercise("hold", "plank").movementProfile!, identity: record.movementContractIdentity!,
    handShapeProfile: null, exerciseName: "Renamed hold", targetReps: 0, targetDurationSeconds: 22 } as PlannedPoseTrackingSnapshot;
  const hold = applyPlannedTrackingSnapshotToTarget(target, snapshot)!;
  assert.equal(hold.targetReps, 0);
  assert.equal(hold.targetDurationSeconds, 22);
  assert.equal(hold.exerciseName, "Renamed hold");
  assert.equal(applyPlannedTrackingSnapshotToTarget(target, { ...snapshot, setNumber: 2 }), target);
  const reps = applyPlannedTrackingSnapshotToTarget(hold, { ...snapshot, movementProfile: record.movementProfile!, targetReps: 12 });
  assert.equal(reps?.targetReps, 12);
  assert.equal(reps?.targetDurationSeconds, null);
});
