import assert from "node:assert/strict";
import test from "node:test";

import type {
  ExerciseHandShapeProfileRecord,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  PoseSequenceSignalsRecord,
} from "@fittrack/types";
import {
  createPoseRepEngineState,
  stepPoseRepEngine,
  stepPoseStaticHold,
  type PoseRepEngineEvidence,
} from "./pose-rep-engine.ts";
import {
  buildFallbackPoseMovementContract,
  getPoseMovementFrameAssessment,
} from "./pose.ts";

const PUSH_UP = buildFallbackPoseMovementContract("Push-Up") as PoseMovementContractRecord;

const SIDE_CHAINS: Record<string, [number, number, number]> = {
  ankle: [25, 27, 31],
  elbow: [11, 13, 15],
  hip: [11, 23, 25],
  knee: [23, 25, 27],
  shoulder: [13, 11, 23],
};

function makeKeypoints(
  contract: PoseMovementContractRecord,
  leftAngle: number,
  rightAngle = leftAngle,
  motion = 0,
  visibility = 0.9,
) {
  const keypoints: PoseKeypointRecord[] = Array.from(
    { length: 33 },
    (_, index) => ({
      visibility,
      x: 0.5,
      y: 0.5,
      z: 0,
    }),
  );
  const setPoint = (index: number, x: number, y: number) => {
    keypoints[index] = { visibility, x, y, z: 0 };
  };

  // Start from a mirrored, connected skeleton so body-line and travel checks
  // see the same subject that supplies the configured joint angle.
  setPoint(0, 0.5, 0.1);
  (['left', 'right'] as const).forEach((side) => {
    const sideOffset = side === 'right' ? 1 : 0;
    const baseX = side === 'left' ? 0.34 : 0.66;
    const handX = side === 'left' ? 0.27 : 0.73;
    setPoint(11 + sideOffset, baseX, 0.2);
    setPoint(13 + sideOffset, baseX, 0.36);
    setPoint(15 + sideOffset, handX, 0.52);
    setPoint(23 + sideOffset, baseX, 0.52);
    setPoint(25 + sideOffset, baseX, 0.72);
    setPoint(27 + sideOffset, baseX, 0.9);
    setPoint(31 + sideOffset, handX, 0.96);
    setPoint(17 + sideOffset, handX - (side === 'left' ? 0.02 : -0.02), 0.53);
    setPoint(19 + sideOffset, handX - (side === 'left' ? 0.015 : -0.015), 0.535);
    setPoint(21 + sideOffset, handX, 0.53);
  });

  const setSideChain = (side: 'left' | 'right', angle: number) => {
    const chain = SIDE_CHAINS[contract.dominantJoint];
    if (!chain) return;
    const sideOffset = side === 'right' ? 1 : 0;
    const baseX = side === 'left' ? 0.34 : 0.66;
    const sideDirection = side === 'left' ? -1 : 1;
    const radians = (angle * Math.PI) / 180;
    const [a, b, c] = chain.map((index) => index + sideOffset);

    if (contract.dominantJoint === 'elbow') {
      const elbowY = 0.36;
      const scale = 0.16;
      setPoint(a, baseX, 0.2);
      setPoint(b, baseX, elbowY);
      // The proximal arm points up; this construction preserves the requested
      // elbow angle on both mirrored chains exactly.
      setPoint(
        c,
        baseX + sideDirection * Math.sin(radians) * scale,
        elbowY - Math.cos(radians) * scale,
      );
      return;
    }

    if (contract.dominantJoint === 'knee') {
      const legLength = 0.38;
      const halfLeg = legLength / 2;
      const cosine = Math.cos(radians);
      const offset =
        halfLeg *
        Math.sqrt(
          Math.max(0, (1 + cosine) / Math.max(1e-3, 1 - cosine)),
        );
      // Keep shoulder, hip, and ankle collinear while the knee moves through
      // the requested angle, giving squat fixtures real anatomy and travel.
      setPoint(a, baseX, 0.52);
      setPoint(b, baseX + sideDirection * offset, 0.52 + halfLeg);
      setPoint(c, baseX, 0.52 + legLength);
      return;
    }

    if (contract.dominantJoint === 'hip') {
      const scale = 0.18;
      setPoint(a, baseX, 0.2);
      setPoint(b, baseX, 0.52);
      setPoint(
        c,
        baseX + sideDirection * Math.sin(radians) * scale,
        0.52 - Math.cos(radians) * scale,
      );
      return;
    }

    // Keep the helper useful for the remaining configured joints while the
    // specialized cases above provide the body-line contracts used here.
    const proximal = keypoints[a];
    const joint = keypoints[b];
    if (!proximal || !joint) return;
    const scale = 0.16;
    const proximalDirection = Math.atan2(
      proximal.y - joint.y,
      proximal.x - joint.x,
    );
    setPoint(
      c,
      joint.x + Math.cos(proximalDirection + sideDirection * radians) * scale,
      joint.y + Math.sin(proximalDirection + sideDirection * radians) * scale,
    );
  };

  setSideChain('left', leftAngle);
  setSideChain('right', rightAngle);

  // Orientation must come from the measured skeleton, not a hand-written signal label.
  const rotation = contract.bodyOrientation === "horizontal" || contract.bodyOrientation === "floor"
    ? -Math.PI/2 : contract.bodyOrientation === "inclined" ? -Math.PI/4 : 0;
  for (const p of keypoints) {
    const x = p.x-.5, y = p.y-.5;
    p.x = .5+x*Math.cos(rotation)-y*Math.sin(rotation);
    p.y = .5+x*Math.sin(rotation)+y*Math.cos(rotation);
  }

  // Translate the entire body in the current frame. This supplies actual
  // hip/shoulder travel for contracts such as squat and push-up rather than
  // faking motion by moving only the arm chain.
  for (const point of keypoints) point.y += motion;
  if (visibility < 0.5) {
    for (const point of keypoints) point.visibility = visibility;
  }
  return keypoints;
}

function makeSignals(
  contract: PoseMovementContractRecord,
  visibility = 0.9,
): PoseSequenceSignalsRecord {
  const bodyOrientation =
    contract.bodyOrientation === "floor"
      ? "horizontal"
      : contract.bodyOrientation ?? "upright";
  return {
    angles: [],
    hip: { averageY: 0.52, rangeX: 0, rangeY: 0, stable: true },
    orientation: {
      bodyOrientation,
      torsoSlopeDeg:
        bodyOrientation === "upright"
          ? 75
          : bodyOrientation === "horizontal"
            ? 20
            : 45,
      vector: { x: 0.3, y: 0.1 },
    },
    shoulder: { averageY: 0.4, rangeX: 0, rangeY: 0 },
    temporal: {
      amplitudes: {},
      oscillatingJoints: [],
      phaseSyncMs: 0,
    },
    visibility: {
      averageVisibility: visibility,
      feetVisibility: visibility,
      leftArmVisibility: visibility,
      lowConfidenceLandmarks: [],
      reliableFrameCount: visibility >= 0.6 ? 20 : 0,
      rightArmVisibility: visibility,
      wristVisibility: visibility,
    },
    wrist: { leftRangeX: 0, maxRangeX: 0, rightRangeX: 0 },
  };
}

function makeEvidence(
  contract: PoseMovementContractRecord,
  leftAngle: number,
  rightAngle = leftAngle,
  motion = 0,
  visibility = 0.9,
): PoseRepEngineEvidence {
  const keypoints = makeKeypoints(
    contract,
    leftAngle,
    rightAngle,
    motion,
    visibility,
  );
  return {
    coordinateDimensions: { width: 1, height: 1 },
    keypointFrames: [keypoints],
    keypoints,
    lowConfidenceLandmarks: [],
    signals: makeSignals(contract, visibility),
  };
}

function runAngles(
  contract: PoseMovementContractRecord,
  angles: number[],
  frameIntervalMs = 100,
  visibility = 0.9,
) {
  let state = createPoseRepEngineState();
  let lastResult: ReturnType<typeof stepPoseRepEngine> | null = null;
  angles.forEach((angle, index) => {
    const motion = Math.max(0, (155 - angle) / 65) * 0.05;
    const evidence = makeEvidence(
      contract,
      angle,
      angle,
      motion,
      visibility,
    );
    lastResult = stepPoseRepEngine(
      state,
      contract,
      angle,
      index * frameIntervalMs,
      evidence,
    );
    state = lastResult.nextState;
  });
  return { result: lastResult, state };
}

function cloneDynamic(
  contract: PoseMovementContractRecord,
  overrides: Partial<PoseMovementContractRecord>,
) {
  return {
    ...contract,
    ...overrides,
    repThresholds: {
      ...contract.repThresholds,
      ...(overrides.repThresholds ?? {}),
    },
    trackingRequirements: {
      ...contract.trackingRequirements,
      ...(overrides.trackingRequirements ?? {}),
    },
    spatialRequirements: {
      ...contract.spatialRequirements,
      ...(overrides.spatialRequirements ?? {}),
    },
  } as PoseMovementContractRecord;
}

function withoutBodyLine(contract: PoseMovementContractRecord) {
  return cloneDynamic(contract, {
    spatialRequirements: {
      ...contract.spatialRequirements,
      bodyLineTolerance: null,
    },
  });
}

function requiredGripProfile(): ExerciseHandShapeProfileRecord {
  return {
    grip: {
      maxOpenFrames: 0,
      maxOpenRatio: 0,
      minUsableFrames: 1,
      recentFrameLimit: 1,
      reliablePointMinVisibility: 0.5,
      required: true,
    },
    schemaVersion: "exercise_hand_shape_v1",
    subjectLockGesture: {
      enabled: false,
      gesture: "rock_sign",
      handAboveShoulderOffset: 0,
      handRaisedFromElbowOffset: 0,
      holdMs: 0,
      hornThumbLeadOffset: 0,
      maxHornLiftDelta: 0,
      minFingerDistance: 0,
      minFingerLift: 0,
      minFingerSpreadX: 0,
      minThumbOffset: 0,
      minThumbSeparation: 0,
    },
    warnings: [],
  };
}

function setGripShape(
  keypoints: PoseKeypointRecord[],
  side: "left" | "right",
  open: boolean,
) {
  const indexes = side === "left"
    ? { elbow: 13, wrist: 15, index: 19, pinky: 17, thumb: 21 }
    : { elbow: 14, wrist: 16, index: 20, pinky: 18, thumb: 22 };
  const x = side === "left" ? 0.34 : 0.66;
  keypoints[indexes.elbow] = { visibility: 0.9, x, y: 0.35, z: 0 };
  keypoints[indexes.wrist] = { visibility: 0.9, x, y: 0.45, z: 0 };
  const spread = open ? 0.08 : 0.002;
  const tipY = open ? 0.5 : 0.453;
  keypoints[indexes.index] = {
    visibility: 0.9,
    x: x - spread,
    y: tipY,
    z: 0,
  };
  keypoints[indexes.pinky] = {
    visibility: 0.9,
    x: x + spread,
    y: tipY,
    z: 0,
  };
  keypoints[indexes.thumb] = {
    visibility: 0.9,
    x: x + (open ? spread : 0.002),
    y: open ? 0.46 : 0.453,
    z: 0,
  };
}

test("counts a complete bilateral cycle only after stable return", () => {
  const { state } = runAngles(PUSH_UP, [155, 155, 100, 100, 155, 155]);
  assert.equal(state.repCount, 1);
  assert.equal(state.lastRepCompletedAtMs, 500);
});

test("accepts target overshoot and honors the configured incline limits", () => {
  const overshoot = runAngles(PUSH_UP, [155, 155, 82, 82, 155, 155]);
  assert.equal(overshoot.state.repCount, 1);

  const incline = runAngles(
    PUSH_UP,
    [155, 155, 100, 100, 155, 155],
    100,
  );
  const invalidEvidence = makeEvidence(PUSH_UP, 155);
  for (const p of invalidEvidence.keypoints!) {
    const x = p.x-.5, y = p.y-.5;
    p.x = .5+(x-y)/Math.sqrt(2);
    p.y = .5+(x+y)/Math.sqrt(2);
  }
  invalidEvidence.signals = {
    ...makeSignals(PUSH_UP),
    orientation: {
      ...makeSignals(PUSH_UP).orientation,
      bodyOrientation: "inclined",
    },
  };
  const blocked = stepPoseRepEngine(
    incline.state,
    PUSH_UP,
    155,
    700,
    invalidEvidence,
  );
  assert.equal(blocked.noCountReason, null, "The configured 0–92 degree range allows this incline");
  const restricted = {...PUSH_UP, spatialRequirements:{...PUSH_UP.spatialRequirements,torsoSlopeMaxDeg:20}};
  const strict = stepPoseRepEngine(createPoseRepEngineState(),restricted,155,100,invalidEvidence);
  assert.equal(strict.noCountReason,"torso_slope_above_max");
});

test("supports unilateral and bilateral/either side pinning", () => {
  const unilateral = cloneDynamic(PUSH_UP, {
    repModel: "unilateral_left",
    requiredSides: "left",
    trackingRequirements: {
      ...PUSH_UP.trackingRequirements,
      requiredSides: "left",
    },
  });
  assert.equal(
    runAngles(unilateral, [155, 155, 100, 100, 155, 155]).state.repCount,
    1,
  );

  const either = cloneDynamic(PUSH_UP, {
    requiredSides: "either",
    trackingRequirements: {
      ...PUSH_UP.trackingRequirements,
      requiredSides: "either",
      minReliableFrameLandmarks: 6,
    },
  });
  let state = createPoseRepEngineState();
  [155, 155, 100, 100, 155, 155].forEach((angle, index) => {
    const keypoints = makeKeypoints(either, angle, angle, Math.max(0, (155 - angle) / 65) * 0.05);
    for (const point of keypoints) {
      point.visibility = 0.05;
    }
    for (const indexToKeep of [11, 13, 15, 23, 25, 27]) {
      keypoints[indexToKeep].visibility = 0.9;
    }
    state = stepPoseRepEngine(
      state,
      either,
      angle,
      index * 100,
      { ...makeEvidence(either, angle), keypoints },
    ).nextState;
  });
  assert.equal(state.repCount, 1);
});

test("alternating counts one expected side at a time", () => {
  const alternating = cloneDynamic(PUSH_UP, {
    repModel: "alternating",
    requiredSides: "alternating",
    trackingRequirements: {
      ...PUSH_UP.trackingRequirements,
      requiredSides: "alternating",
    },
  });
  let state = createPoseRepEngineState();
  const sequence: Array<[number, number]> = [
    [155, 155],
    [155, 155],
    [100, 155],
    [100, 155],
    [155, 155],
    [155, 155],
    [155, 155],
    [155, 155],
    [155, 100],
    [155, 100],
    [155, 155],
    [155, 155],
  ];
  sequence.forEach(([left, right], index) => {
    const motion = Math.max(0, (155 - Math.min(left, right)) / 65) * 0.05;
    state = stepPoseRepEngine(
      state,
      alternating,
      left,
      index * 100,
      makeEvidence(alternating, left, right, motion),
    ).nextState;
  });
  assert.equal(state.repCount, 2);
});

test("count_half_reps emits integer counts and requires return before rearm", () => {
  const half = cloneDynamic(PUSH_UP, { partialRepPolicy: "count_half_reps" });
  let state = createPoseRepEngineState();
  [155, 155, 145, 130, 115, 100, 100].forEach((angle, index) => {
    state = stepPoseRepEngine(
      state,
      half,
      angle,
      index * 100,
      makeEvidence(
        half,
        angle,
        angle,
        Math.max(0, (155 - angle) / 65) * 0.05,
      ),
    ).nextState;
  });
  assert.equal(state.repCount, 1);
  [155, 155].forEach((angle, index) => {
    state = stepPoseRepEngine(
      state,
      half,
      angle,
      800 + index * 100,
      makeEvidence(
        half,
        angle,
        angle,
        Math.max(0, (155 - angle) / 65) * 0.05,
      ),
    ).nextState;
  });
  assert.equal(state.repCount, 1);
});

test("review_only completes movement without incrementing", () => {
  const review = cloneDynamic(PUSH_UP, { partialRepPolicy: "review_only" });
  assert.equal(
    runAngles(review, [155, 155, 100, 100, 155, 155]).state.repCount,
    0,
  );
});

test("current-cycle travel allows stationary arming but rejects a travel-free cycle", () => {
  const squat = buildFallbackPoseMovementContract("squat");
  if (!squat) throw new Error("squat fallback contract missing");
  const valid = runAngles(squat, [155, 155, 90, 90, 155, 155]);
  assert.equal(valid.state.repCount, 1);
  const next = [155, 155, 155, 155].reduce(
    (state, angle, index) =>
      stepPoseRepEngine(
        state,
        squat,
        angle,
        700 + index * 100,
        makeEvidence(squat, angle),
      ).nextState,
    valid.state,
  );
  assert.equal(next.repCount, 1);
});

test("static hold and contract-scoped frame assessment reject weak evidence", () => {
  const plank = buildFallbackPoseMovementContract("plank");
  if (!plank) throw new Error("plank fallback contract missing");
  const good = makeEvidence(plank, 170);
  assert.equal(getPoseMovementFrameAssessment(plank, good.keypoints).isReliable, true);
  const weak = makeKeypoints(plank, 170, 170, 0, 0.2);
  assert.equal(getPoseMovementFrameAssessment(plank, weak).isReliable, false);

  const contract = { ...plank, holdDurationSeconds: 1 };
  const first = stepPoseStaticHold(
    createPoseRepEngineState(),
    contract,
    170,
    0,
    good,
  );
  const second = stepPoseStaticHold(
    first.nextState,
    contract,
    170,
    500,
    good,
  );
  const completed = stepPoseStaticHold(
    second.nextState,
    contract,
    170,
    1000,
    good,
  );
  assert.equal(second.holdSeconds, 0.5);
  assert.equal(completed.holdCompleted, true);
  assert.equal(completed.nextState.repCount, 0);
});

test("duplicate, backward, and nonfinite timestamps never advance", () => {
  const first = stepPoseRepEngine(
    createPoseRepEngineState(),
    PUSH_UP,
    155,
    0,
    makeEvidence(PUSH_UP, 155),
  );
  const duplicate = stepPoseRepEngine(
    first.nextState,
    PUSH_UP,
    155,
    0,
    makeEvidence(PUSH_UP, 155),
  );
  assert.equal(duplicate.noCountReason, "duplicate_frame");
  const backward = stepPoseRepEngine(
    first.nextState,
    PUSH_UP,
    155,
    -1,
    makeEvidence(PUSH_UP, 155),
  );
  assert.equal(backward.noCountReason, "backward_timestamp");
  const invalid = stepPoseRepEngine(
    first.nextState,
    PUSH_UP,
    155,
    Number.NaN,
    makeEvidence(PUSH_UP, 155),
  );
  assert.equal(invalid.noCountReason, "invalid_timestamp");
});

test("configured body line rejects a bent shoulder hip ankle chain", () => {
  const evidence = makeEvidence(PUSH_UP, 155);
  const keypoints = evidence.keypoints as PoseKeypointRecord[];
  for (const offset of [0,1]) {
    // Preserve both valid elbow chains and the horizontal torso; only bend the legs.
    keypoints[27+offset] = {...keypoints[23+offset]!,y:keypoints[23+offset]!.y+.3};
  }
  const result = stepPoseRepEngine(
    createPoseRepEngineState(),
    PUSH_UP,
    155,
    0,
    evidence,
  );
  assert.equal(result.noCountReason, "body_line_over_tolerance");
  assert.equal(result.nextState.repCount, 0);
});

test("explicit grip profile rejects open palms and accepts clustered fingertips", () => {
  const contract = withoutBodyLine(PUSH_UP);
  const profile = requiredGripProfile();
  const openEvidence = makeEvidence(contract, 155);
  setGripShape(openEvidence.keypoints as PoseKeypointRecord[], "left", true);
  setGripShape(openEvidence.keypoints as PoseKeypointRecord[], "right", true);
  openEvidence.handShapeProfile = profile;
  const openResult = stepPoseRepEngine(
    createPoseRepEngineState(),
    contract,
    155,
    0,
    openEvidence,
  );
  assert.equal(openResult.noCountReason, "curl_grip_unconfirmed");

  const closedEvidence = makeEvidence(contract, 155);
  setGripShape(closedEvidence.keypoints as PoseKeypointRecord[], "left", false);
  setGripShape(closedEvidence.keypoints as PoseKeypointRecord[], "right", false);
  closedEvidence.handShapeProfile = profile;
  const closedResult = stepPoseRepEngine(
    createPoseRepEngineState(),
    contract,
    155,
    0,
    closedEvidence,
  );
  assert.equal(closedResult.noCountReason, null);
});

test("either-side assessment stays pinned when the selected side is lost", () => {
  const contract = withoutBodyLine(
    cloneDynamic(PUSH_UP, {
      requiredSides: "either",
      trackingRequirements: {
        ...PUSH_UP.trackingRequirements,
        requiredSides: "either",
      },
    }),
  );
  let first = stepPoseRepEngine(
    createPoseRepEngineState(),
    contract,
    155,
    0,
    makeEvidence(contract, 155, 155),
  );
  assert.equal(first.nextState.selectedSide, null, "An either-side cycle waits for stable setup and an active side");
  first = stepPoseRepEngine(first.nextState,contract,155,100,makeEvidence(contract,155,155));
  first = stepPoseRepEngine(first.nextState,contract,140,200,makeEvidence(contract,140,155));
  assert.equal(first.nextState.selectedSide, "left");
  const lost = makeEvidence(contract, 155, 155);
  for (const index of [11, 13, 15, 23, 27]) {
    (lost.keypoints as PoseKeypointRecord[])[index].visibility = 0.05;
  }
  const lostResult = stepPoseRepEngine(
    first.nextState,
    contract,
    155,
    300,
    lost,
  );
  assert.equal(lostResult.noCountReason, "pinned_side_unavailable");
  assert.equal(lostResult.nextState.repCount, 0);
});

test("bilateral target sync uses current-cycle side endpoints", () => {
  const contract = cloneDynamic(PUSH_UP, {
    spatialRequirements: {
      ...PUSH_UP.spatialRequirements,
      bodyLineTolerance: null,
      phaseSyncToleranceMs: 100,
    },
  });
  let state = createPoseRepEngineState();
  let result: ReturnType<typeof stepPoseRepEngine> | null = null;
  const sequence: Array<[number, number]> = [
    [155, 155],
    [155, 155],
    [100, 155],
    [100, 155],
    [100, 100],
    [100, 100],
  ];
  sequence.forEach(([left, right], index) => {
    const evidence = makeEvidence(contract, left, right);
    evidence.signals = {
      ...evidence.signals!,
      temporal: { ...evidence.signals!.temporal, phaseSyncMs: 0 },
    };
    result = stepPoseRepEngine(
      state,
      contract,
      left,
      index * 100,
      evidence,
    );
    state = result.nextState;
  });
  assert.equal(result?.noCountReason, "left_right_phase_desync");
  assert.equal(state.repCount, 0);
});

test("full contract validation rejects missing tracking and invalid static duration", () => {
  const missingTracking = {
    ...PUSH_UP,
    trackingRequirements: undefined,
  } as PoseMovementContractRecord;
  const missingResult = stepPoseRepEngine(
    createPoseRepEngineState(),
    missingTracking,
    155,
    0,
    makeEvidence(PUSH_UP, 155),
  );
  assert.equal(missingResult.noCountReason, "invalid_contract");
  assert.equal(missingResult.nextState.repCount, 0);

  const plank = buildFallbackPoseMovementContract("plank");
  if (!plank) throw new Error("plank fallback contract missing");
  const invalidDuration = { ...plank, holdDurationSeconds: 0 };
  const staticResult = stepPoseStaticHold(
    createPoseRepEngineState(),
    invalidDuration,
    170,
    0,
    makeEvidence(plank, 170),
  );
  assert.equal(staticResult.noCountReason, "invalid_contract");
  assert.equal(staticResult.holdValid, false);
  assert.equal(staticResult.holdSeconds, 0);
});
