import assert from "node:assert/strict";
import test from "node:test";

import type { PoseMovementContractRecord } from "@fittrack/types";
import {
  getPoseRepAcceptancePolicy,
  validatePoseRepAcceptancePolicy,
} from "./pose-rep-policy.ts";
import {
  buildFallbackPoseMovementContract,
  validatePoseMovementContract,
} from "./pose.ts";

function customContract(
  overrides: Partial<PoseMovementContractRecord>,
): PoseMovementContractRecord {
  const base = buildFallbackPoseMovementContract("bench_press");
  if (!base) throw new Error("bench fallback missing");
  return {
    ...base,
    ...overrides,
    repThresholds: {
      ...base.repThresholds,
      ...(overrides.repThresholds ?? {}),
    },
  };
}

test("shared policy accepts a separated 22-degree movement and rejects overlap", () => {
  const valid = customContract({
    repThresholds: {
      down: { angle: 133, tolerance: 6 },
      up: { angle: 155, tolerance: 6 },
    },
  });
  const validPolicy = getPoseRepAcceptancePolicy(valid);
  assert.equal(validPolicy.valid, true);
  assert.equal(validPolicy.minTravel, 10);

  const overlap = customContract({
    repThresholds: {
      down: { angle: 133, tolerance: 12 },
      up: { angle: 155, tolerance: 12 },
    },
  });
  assert.ok(validatePoseRepAcceptancePolicy(overlap).includes("phase_acceptance_bands_overlap"));
});

test("policy rejects ignored phase orders and inconsistent side modes", () => {
  const unsupportedPhase = customContract({
    phaseOrder: ["setup", "middle", "finish"],
  });
  assert.ok(validatePoseRepAcceptancePolicy(unsupportedPhase).includes("phase_order_unsupported"));

  const invalidAlternating = customContract({
    repModel: "alternating",
    requiredSides: "both",
  });
  assert.ok(
    validatePoseRepAcceptancePolicy(invalidAlternating).includes(
      "alternating_requires_alternating_sides",
    ),
  );
});

test("fallback contracts hydrate family metadata before validation", () => {
  const fallback = buildFallbackPoseMovementContract("Push-Up");
  assert.ok(fallback);
  assert.equal(fallback.contractVersion, "pose_movement_contract_v2");
  assert.equal(fallback.bodyOrientation, "horizontal");
  assert.deepEqual(
    fallback.trackingRequirements?.requiredLandmarks,
    ["shoulders", "elbows", "wrists", "hips", "ankles"],
  );
  assert.equal(validatePoseMovementContract(fallback).valid, true);
});

test("policy accepts explicit static exit semantics and rejects fractional static reps", () => {
  const staticContract = customContract({
    repModel: "static_hold",
    phaseOrder: ["setup", "hold", "exit"],
    holdDurationSeconds: 5,
    partialRepPolicy: "strict_full_rep",
  });
  assert.equal(getPoseRepAcceptancePolicy(staticContract).valid, true);
  const fractional = {
    ...staticContract,
    partialRepPolicy: "count_half_reps" as const,
  };
  assert.ok(
    validatePoseRepAcceptancePolicy(fractional).includes(
      "static_hold_does_not_support_count_half_reps",
    ),
  );
});

test("count timing is independent of range and preserves omitted legacy timing", () => {
  const contract = customContract({ partialRepPolicy: "strict_full_rep" });
  assert.equal(getPoseRepAcceptancePolicy(contract).countAt, "return");
  assert.equal(getPoseRepAcceptancePolicy({ ...contract, partialRepPolicy: "count_half_reps" }).countAt, "peak");
  for (const countAt of ["peak", "return"] as const) {
    const policy = getPoseRepAcceptancePolicy({ ...contract, countAt });
    const legacyPolicy = getPoseRepAcceptancePolicy({ ...contract, partialRepPolicy: "count_half_reps", countAt });
    assert.equal(policy.countAt, countAt);
    assert.equal(legacyPolicy.countAt, countAt);
    assert.deepEqual(policy.startBand, legacyPolicy.startBand);
    assert.deepEqual(policy.targetBand, legacyPolicy.targetBand);
    assert.equal(policy.minTravel, getPoseRepAcceptancePolicy(contract).minTravel);
  }
});

test("unsupported count timing fails the shared write validator", () => {
  const invalid = customContract({ countAt: "initial" as never });
  assert.ok(validatePoseMovementContract(invalid).errors.includes("count_at_unsupported"));
});
