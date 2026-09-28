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

test("pose count timing round-trips through response and finalization conversions", async () => {
  for (const countAt of ["peak", "return"] as const) {
    let finalized: any;
    const api = createFitnessApi({
      post: async (url: string, body: unknown) => {
        if (url.endsWith("/finalize")) {
          finalized = body;
          return { data: { id: "pose-session-1", rep_count_ai: 1 } };
        }
        return { data: { ...baseResponse, movement_contract: {
          exercise: "squat", dominant_joint: "knee", oscillating_joints: ["knee"],
          secondary_check: "", count_at: countAt, partial_rep_policy: "strict_full_rep",
          rep_thresholds: { up: { angle: 160, tolerance: 10 }, down: { angle: 90, tolerance: 10 } },
        } } };
      },
    } as never);
    const response = await api.analyzePoseSession("pose-session-1", { frameBase64: "synthetic" });
    assert.equal(response.movementContract?.countAt, countAt);
    await api.finalizePoseSession("pose-session-1", {
      movementContract: response.movementContract, finalRepCount: 1, formFeedback: [], rawAngleData: [],
    });
    assert.equal(finalized.movement_contract.count_at, countAt);
    assert.equal(finalized.movement_contract.partial_rep_policy, "strict_full_rep");
  }
});
