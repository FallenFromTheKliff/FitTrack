import assert from "node:assert/strict";
import test from "node:test";
import type { ExerciseMovementContractIdentityRecord } from "@fittrack/types";
import { createFitnessApi } from "./fitness";

const baseResponse = {
  confidence: 0.92,
  exercise_class: "squat",
  pose_session_id: "pose-session-1",
};

async function mapResponse(
  movementContractIdentity?: ExerciseMovementContractIdentityRecord | null,
) {
  const response = {
    ...baseResponse,
    ...(movementContractIdentity !== undefined
      ? { movement_contract_identity: movementContractIdentity }
      : {}),
  };
  const transport = {
    post: async () => ({ data: response }),
  };

  return createFitnessApi(transport as never).analyzePoseSession(
    "pose-session-1",
    { frameBase64: "frame-data" },
  );
}

test("maps the authoritative movement contract identity from pose analysis", async () => {
  const identity: ExerciseMovementContractIdentityRecord = {
    exerciseId: "exercise-squat-1",
    familyKey: "squat",
    revision: 7,
    source: "exercise_override",
    trackingMode: "override",
  };

  const result = await mapResponse(identity);

  assert.deepEqual(result.movementContractIdentity, identity);
});

test("normalizes null and absent movement contract identities to null", async () => {
  const explicitNull = await mapResponse(null);
  const absent = await mapResponse();

  assert.equal(explicitNull.movementContractIdentity, null);
  assert.equal(absent.movementContractIdentity, null);
});
