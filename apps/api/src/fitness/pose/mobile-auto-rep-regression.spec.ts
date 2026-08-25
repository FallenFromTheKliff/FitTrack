import { createCoverCropTransform } from '../../../../../packages/utils/camera-transform';
import { buildFallbackPoseMovementContract } from '../../../../../packages/utils/pose';
import { createPoseSignalCache } from '../../../../../packages/utils/pose-signal-cache';
import {
  createPoseRepEngineState,
  stepPoseRepEngine,
  stepPoseStaticHold,
} from '../../../../../apps/mobile/lib/workout/poseRepEngine';

const REP_EXERCISE_CASES = [
  {
    exercise: 'squat',
    realisticAngles: [115, 115, 155, 155, 150],
    partialAngles: [125, 125, 145, 145, 140],
  },
  {
    exercise: 'bench_press',
    realisticAngles: [105, 105, 155, 155, 150],
    partialAngles: [120, 120, 145, 145, 140],
  },
  {
    exercise: 'bicep_curl',
    realisticAngles: [145, 145, 95, 95],
    partialAngles: [130, 130, 105, 105, 115],
  },
  {
    exercise: 'dip',
    realisticAngles: [118, 118, 150, 150],
    partialAngles: [128, 128, 145, 145, 135],
  },
  {
    exercise: 'pull_up',
    realisticAngles: [145, 145, 100, 100],
    partialAngles: [130, 130, 110, 110, 120],
  },
  {
    exercise: 'push_up',
    // 130 degrees is a moderate, camera-visible elbow bend—not a deep
    // elbows-to-ribs position. The 30-degree travel still requires a real
    // controlled movement before the rep can count.
    realisticAngles: [130, 130, 160, 160],
    partialAngles: [135, 135, 155, 155, 150],
  },
  {
    exercise: 'shoulder_press',
    realisticAngles: [110, 110, 150, 150, 145],
    partialAngles: [120, 120, 145, 145, 140],
  },
] as const;

function buildRepAngleSequence(
  contract: NonNullable<ReturnType<typeof buildFallbackPoseMovementContract>>,
) {
  const testCase = REP_EXERCISE_CASES.find(
    ({ exercise }) => exercise === contract.exercise,
  );
  if (!testCase)
    throw new Error(`Missing realistic angle case for ${contract.exercise}`);
  return [...testCase.realisticAngles];
}

function buildSmallOscillationSequence(
  contract: NonNullable<ReturnType<typeof buildFallbackPoseMovementContract>>,
) {
  const testCase = REP_EXERCISE_CASES.find(
    ({ exercise }) => exercise === contract.exercise,
  );
  if (!testCase)
    throw new Error(`Missing partial angle case for ${contract.exercise}`);
  return [...testCase.partialAngles];
}

function runRepSequenceAtInterval(
  contract: NonNullable<ReturnType<typeof buildFallbackPoseMovementContract>>,
  angles: number[],
  frameIntervalMs: number,
  initialState = createPoseRepEngineState(),
  startTimeMs = 0,
) {
  return angles.reduce(
    (state, angle, index) =>
      stepPoseRepEngine(
        state,
        contract,
        angle,
        startTimeMs + index * frameIntervalMs,
      ).nextState,
    initialState,
  );
}

function runRepSequence(
  contract: NonNullable<ReturnType<typeof buildFallbackPoseMovementContract>>,
  angles: number[],
) {
  return angles.reduce(
    (state, angle, index) =>
      stepPoseRepEngine(state, contract, angle, index * 1000).nextState,
    createPoseRepEngineState(),
  );
}

function makeFrame(capturedAtMs: number, visibility: number) {
  return {
    capturedAtMs,
    keypoints: Array.from({ length: 33 }, (_, index) => ({
      visibility: index === 15 ? visibility : 1,
      x: 0.2 + (index % 5) * 0.05,
      y: 0.2 + Math.floor(index / 5) * 0.04,
      z: 0,
    })),
  };
}

function makeHoldEvidence(visibility = 1) {
  return {
    keypoints: makeFrame(0, visibility).keypoints,
    lowConfidenceLandmarks: visibility < 0.6 ? ['left_hip'] : [],
    signals: {
      angles: [],
      hip: { averageY: 0.5, rangeX: 0, rangeY: 0, stable: true },
      orientation: {
        bodyOrientation: 'horizontal',
        torsoSlopeDeg: 45,
        vector: { x: 1, y: 0 },
      },
      shoulder: { averageY: 0.5, rangeX: 0, rangeY: 0 },
      temporal: { amplitudes: {}, oscillatingJoints: [], phaseSyncMs: 0 },
      visibility: {
        averageVisibility: visibility,
        feetVisibility: visibility,
        leftArmVisibility: visibility,
        lowConfidenceLandmarks: visibility < 0.6 ? ['left_hip'] : [],
        reliableFrameCount: visibility >= 0.6 ? 1 : 0,
        rightArmVisibility: visibility,
        wristVisibility: visibility,
      },
      wrist: { leftRangeX: 0, maxRangeX: 0, rightRangeX: 0 },
    },
  };
}

describe('mobile auto-rep regression primitives', () => {
  it('awards a squat immediately after the stable top gate is reached', () => {
    const squat = buildFallbackPoseMovementContract('squat');
    if (!squat) throw new Error('squat fallback contract missing');

    const state = runRepSequence(squat, [115, 115, 155, 155]);

    expect(state.repCount).toBe(1);
    expect(state.lastRepCompletedAtMs).toBe(3000);
  });

  it.each(REP_EXERCISE_CASES)(
    'counts one controlled $exercise rep with a human-realistic angle sequence',
    ({ exercise }) => {
      const contract = buildFallbackPoseMovementContract(exercise);
      if (!contract) throw new Error(`${exercise} fallback contract missing`);

      const state = runRepSequence(contract, buildRepAngleSequence(contract));

      expect(state.repCount).toBe(1);
    },
  );

  it.each(REP_EXERCISE_CASES)(
    'rejects a partial or noisy $exercise angle sequence',
    ({ exercise }) => {
      const contract = buildFallbackPoseMovementContract(exercise);
      if (!contract) throw new Error(`${exercise} fallback contract missing`);

      const state = runRepSequence(
        contract,
        buildSmallOscillationSequence(contract),
      );

      expect(state.repCount).toBe(0);
    },
  );

  it.each(REP_EXERCISE_CASES)(
    'does not double-count a held $exercise peak boundary',
    ({ exercise }) => {
      const contract = buildFallbackPoseMovementContract(exercise);
      if (!contract) throw new Error(`${exercise} fallback contract missing`);

      const realisticAngles = buildRepAngleSequence(contract);
      const boundary = realisticAngles[realisticAngles.length - 1];
      const state = runRepSequence(contract, [
        ...realisticAngles,
        boundary,
        boundary,
        boundary,
      ]);

      expect(state.repCount).toBe(1);
    },
  );

  it.each(REP_EXERCISE_CASES)(
    'enforces native-time cooldown for $exercise without threshold-derived fixtures',
    ({ exercise }) => {
      const contract = buildFallbackPoseMovementContract(exercise);
      if (!contract) throw new Error(`${exercise} fallback contract missing`);

      const cycle = buildRepAngleSequence(contract);
      const fastState = runRepSequenceAtInterval(
        contract,
        [...cycle, ...cycle],
        100,
      );

      expect(fastState.repCount).toBe(1);

      const recoveredState = runRepSequenceAtInterval(
        contract,
        cycle,
        100,
        fastState,
        (cycle.length * 2 - 1) * 100 + 1000,
      );

      expect(recoveredState.repCount).toBe(2);
    },
  );

  it('keeps plank as a static hold instead of a repetition movement', () => {
    const plank = buildFallbackPoseMovementContract('plank');
    if (!plank) throw new Error('plank fallback contract missing');

    expect(plank.repModel).toBe('static_hold');
    expect(plank.holdDurationSeconds).toBe(30);
  });

  it('keeps instant visibility independent from the buffered temporal cache', () => {
    const cache = createPoseSignalCache(1000);
    const goodFrame = makeFrame(0, 1);
    const degradedFrame = makeFrame(100, 0);
    const buffered = cache.getBuffered([goodFrame], 0);
    if (!buffered) throw new Error('buffered signal snapshot missing');

    const instant = cache.getInstant(degradedFrame);
    const stillBuffered = cache.getBuffered([degradedFrame], 100);

    expect(instant.visibility.averageVisibility).toBeLessThan(
      buffered.visibility.averageVisibility,
    );
    expect(stillBuffered).toBe(buffered);
  });

  it('does not refresh temporal signals from a singleton after reset', () => {
    const cache = createPoseSignalCache(0, 3);
    const goodFrames = [makeFrame(0, 1), makeFrame(33, 1), makeFrame(66, 1)];
    const initial = cache.getBuffered(goodFrames, 0);
    expect(initial).not.toBeNull();

    cache.reset();
    expect(cache.getBuffered([makeFrame(100, 0)], 100)).toBeNull();
    expect(cache.getBuffered(goodFrames, 200)).not.toBeNull();
  });

  it('uses one cover-crop and mirror transform for points and boxes', () => {
    const transform = createCoverCropTransform({
      frameHeight: 100,
      frameWidth: 100,
      mirrorX: true,
      viewportHeight: 100,
      viewportWidth: 200,
    });
    const point = transform.point({ x: 0.25, y: 0.5 });
    const box = transform.rect({ height: 0.2, width: 0.2, x: 0.2, y: 0.4 });

    expect(point.x).toBeCloseTo(0.75);
    expect(point.y).toBeCloseTo(0.5);
    expect(box.x).toBeCloseTo(0.6);
    expect(box.width).toBeCloseTo(0.2);
    expect(box.height).toBeCloseTo(0.4);
  });

  it('accumulates only valid static-hold time and resets after a sustained form break', () => {
    const plank = buildFallbackPoseMovementContract('plank');
    if (!plank) throw new Error('plank fallback contract missing');
    const contract = { ...plank, holdDurationSeconds: 1 };
    const evidence = makeHoldEvidence();
    const first = stepPoseStaticHold(
      createPoseRepEngineState(),
      contract,
      170,
      0,
      evidence,
    );
    const second = stepPoseStaticHold(
      first.nextState,
      contract,
      170,
      500,
      evidence,
    );
    const completed = stepPoseStaticHold(
      second.nextState,
      contract,
      170,
      1000,
      evidence,
    );

    expect(second.holdSeconds).toBeCloseTo(0.5);
    expect(completed.holdCompleted).toBe(true);
    expect(completed.nextState.repCount).toBe(0);

    const invalid = stepPoseStaticHold(
      completed.nextState,
      contract,
      170,
      1100,
      makeHoldEvidence(0.2),
    );
    const reset = stepPoseStaticHold(
      invalid.nextState,
      contract,
      170,
      2400,
      makeHoldEvidence(0.2),
    );
    expect(reset.holdSeconds).toBe(0);
    expect(reset.holdValid).toBe(false);
  });
});
