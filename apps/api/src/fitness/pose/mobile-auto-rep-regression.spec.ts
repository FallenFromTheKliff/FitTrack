import { createCoverCropTransform } from '../../../../../packages/utils/camera-transform';
import { buildFallbackPoseMovementContract } from '../../../../../packages/utils/pose';
import { createPoseSignalCache } from '../../../../../packages/utils/pose-signal-cache';
import {
  createPoseRepEngineState,
  stepPoseRepEngine,
  stepPoseStaticHold,
} from '../../../../../apps/mobile/lib/workout/poseRepEngine';

const REP_EXERCISE_CASES = [
  { exercise: 'squat', minTravel: 35 },
  { exercise: 'bench_press', minTravel: 35 },
  { exercise: 'bicep_curl', minTravel: 40 },
  { exercise: 'dip', minTravel: 30 },
  { exercise: 'pull_up', minTravel: 35 },
  { exercise: 'push_up', minTravel: 30 },
  { exercise: 'shoulder_press', minTravel: 30 },
] as const;

function buildRepAngleSequence(
  contract: NonNullable<ReturnType<typeof buildFallbackPoseMovementContract>>,
  minTravel: number,
) {
  const increasing =
    contract.repThresholds.up.angle >= contract.repThresholds.down.angle;
  const startLimit = increasing
    ? contract.repThresholds.down.angle + contract.repThresholds.down.tolerance
    : contract.repThresholds.down.angle - contract.repThresholds.down.tolerance;
  const peakLimit = increasing
    ? contract.repThresholds.up.angle - contract.repThresholds.up.tolerance
    : contract.repThresholds.up.angle + contract.repThresholds.up.tolerance;
  const start = increasing ? startLimit - 2 : startLimit + 2;
  const peak = increasing
    ? Math.max(peakLimit + 2, start + minTravel + 2)
    : Math.min(peakLimit - 2, start - minTravel - 2);
  // The extra reversal is needed by movements that count after the peak
  // rather than immediately on peak arrival.
  const reversal = increasing ? peak - 5 : peak + 5;
  return [start, start, peak, peak, reversal];
}

function buildSmallOscillationSequence(
  contract: NonNullable<ReturnType<typeof buildFallbackPoseMovementContract>>,
  minTravel: number,
) {
  const increasing =
    contract.repThresholds.up.angle >= contract.repThresholds.down.angle;
  const startLimit = increasing
    ? contract.repThresholds.down.angle + contract.repThresholds.down.tolerance
    : contract.repThresholds.down.angle - contract.repThresholds.down.tolerance;
  const start = increasing ? startLimit - 2 : startLimit + 2;
  const smallTravel = Math.max(5, minTravel - 5);
  const oscillation = increasing ? start + smallTravel : start - smallTravel;
  return [start, start, oscillation, oscillation, start];
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
  it.each(REP_EXERCISE_CASES)(
    'counts one meaningful $exercise rep with the tuned angle band',
    ({ exercise, minTravel }) => {
      const contract = buildFallbackPoseMovementContract(exercise);
      if (!contract) throw new Error(`${exercise} fallback contract missing`);

      const state = runRepSequence(
        contract,
        buildRepAngleSequence(contract, minTravel),
      );

      expect(state.repCount).toBe(1);
    },
  );

  it.each(REP_EXERCISE_CASES)(
    'rejects a small $exercise angle oscillation as jitter',
    ({ exercise, minTravel }) => {
      const contract = buildFallbackPoseMovementContract(exercise);
      if (!contract) throw new Error(`${exercise} fallback contract missing`);

      const state = runRepSequence(
        contract,
        buildSmallOscillationSequence(contract, minTravel),
      );

      expect(state.repCount).toBe(0);
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
