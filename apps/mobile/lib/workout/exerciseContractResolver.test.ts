import type {
  ExerciseMovementContractIdentityRecord,
  ExerciseMovementProfileRecord,
} from "@fittrack/types";
import {
  hasMovementContractIdentityChanged,
  movementContractIdentityKey,
} from "./exerciseContractResolver";

type TestRegistrar = (name: string, callback: () => void) => unknown;
const jestTest = (globalThis as { test?: TestRegistrar }).test;

function test(name: string, callback: () => void) {
  if (jestTest) {
    jestTest(name, callback);
    return;
  }
  callback();
}

const identity: ExerciseMovementContractIdentityRecord = {
  exerciseId: "exercise-squat",
  familyKey: "squat",
  revision: 3,
  source: "family",
  trackingMode: "inherit",
};

function profile(overrides: Record<string, unknown> = {}) {
  return {
    movementContract: {
      exercise: "squat",
      repModel: "bilateral",
      repThresholds: {
        down: { angle: 100, tolerance: 10 },
        up: { angle: 160, tolerance: 10 },
      },
      ...overrides,
    },
    rig: null,
    schemaVersion: "exercise_movement_profile_v1",
    warnings: [],
  } as unknown as ExerciseMovementProfileRecord;
}

test("keeps the legacy identity key stable when no profile is supplied", () => {
  if (
    movementContractIdentityKey(identity) !== "exercise-squat:squat:3"
  ) {
    throw new Error("legacy identity key changed");
  }
});

test("includes effective movement profile changes in the detailed key", () => {
  const first = movementContractIdentityKey(identity, profile());
  const changed = movementContractIdentityKey(
    identity,
    profile({
      repThresholds: {
        down: { angle: 95, tolerance: 10 },
        up: { angle: 160, tolerance: 10 },
      },
    }),
  );
  if (!first || !changed || first === changed) {
    throw new Error("effective profile change did not invalidate the key");
  }
});

test("serializes equivalent profile objects independently of property order", () => {
  const first = movementContractIdentityKey(identity, profile());
  const reordered = {
    warnings: [],
    schemaVersion: "exercise_movement_profile_v1",
    rig: null,
    movementContract: {
      repThresholds: {
        up: { tolerance: 10, angle: 160 },
        down: { tolerance: 10, angle: 100 },
      },
      repModel: "bilateral",
      exercise: "squat",
    },
  } as unknown as ExerciseMovementProfileRecord;
  const second = movementContractIdentityKey(identity, reordered);
  if (!first || first !== second) {
    throw new Error("equivalent profiles produced different keys");
  }
});

test("reports profile-aware identity changes without changing the base API", () => {
  const current = movementContractIdentityKey(identity, profile());
  if (hasMovementContractIdentityChanged(current, identity, profile())) {
    throw new Error("unchanged profile was reported as changed");
  }
  if (
    !hasMovementContractIdentityChanged(
      current,
      identity,
      profile({ repModel: "unilateral" }),
    )
  ) {
    throw new Error("changed profile was not reported");
  }
});
