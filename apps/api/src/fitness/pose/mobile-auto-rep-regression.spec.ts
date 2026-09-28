import { createCoverCropTransform } from '../../../../../packages/utils/camera-transform';
import {
  buildFallbackPoseMovementContract,
  computePoseSignals,
} from '../../../../../packages/utils/pose';
import { createPoseSignalCache } from '../../../../../packages/utils/pose-signal-cache';
import {
  applyGeneratedRigDominantAngle,
  createGeneratedExerciseRigFromMovementContract,
} from '../../../../../packages/utils/exercise-editor';
import {
  createPoseRepEngineState,
  stepPoseRepEngine,
  stepPoseStaticHold,
} from '../../../../../apps/mobile/lib/workout/poseRepEngine';

const REP_EXERCISE_CASES = [
  {
    exercise: 'squat',
    realisticAngles: [155, 155, 90, 90, 155, 155],
    partialAngles: [155, 155, 125, 125, 145, 155],
  },
  {
    exercise: 'bench_press',
    realisticAngles: [155, 155, 90, 90, 155, 155],
    partialAngles: [155, 155, 125, 125, 145, 155],
  },
  {
    exercise: 'bicep_curl',
    realisticAngles: [155, 155, 90, 90, 155, 155],
    partialAngles: [155, 155, 125, 125, 145, 155],
  },
  {
    exercise: 'dip',
    realisticAngles: [155, 155, 90, 90, 155, 155],
    partialAngles: [155, 155, 125, 125, 145, 155],
  },
  {
    exercise: 'pull_up',
    realisticAngles: [155, 155, 90, 90, 155, 155],
    partialAngles: [155, 155, 125, 125, 145, 155],
  },
  {
    exercise: 'push_up',
    realisticAngles: [155, 155, 90, 90, 155, 155],
    partialAngles: [155, 155, 125, 125, 145, 155],
  },
  {
    exercise: 'shoulder_press',
    realisticAngles: [155, 155, 90, 90, 155, 155],
    partialAngles: [155, 155, 125, 125, 145, 155],
  },
  {
    exercise: 'seated_cable_row',
    realisticAngles: [155, 155, 90, 90, 155, 155],
    partialAngles: [155, 155, 125, 125, 145, 155],
  },
] as const;

function buildRepAngleSequence(
  contract: NonNullable<ReturnType<typeof buildFallbackPoseMovementContract>>,
) {
  if (!REP_EXERCISE_CASES.some(({ exercise }) => exercise === contract.exercise)) {
    throw new Error(`Missing realistic angle case for ${contract.exercise}`);
  }
  return [
    contract.repThresholds.up.angle,
    contract.repThresholds.up.angle,
    contract.repThresholds.down.angle,
    contract.repThresholds.down.angle,
    contract.repThresholds.up.angle,
    contract.repThresholds.up.angle,
  ];
}

function buildSmallOscillationSequence(
  contract: NonNullable<ReturnType<typeof buildFallbackPoseMovementContract>>,
) {
  if (!REP_EXERCISE_CASES.some(({ exercise }) => exercise === contract.exercise)) {
    throw new Error(`Missing partial angle case for ${contract.exercise}`);
  }
  const start = contract.repThresholds.up.angle;
  const target = contract.repThresholds.down.angle;
  const midpoint = (start + target) / 2;
  return [start, start, midpoint, midpoint, (midpoint + start) / 2, start];
}

type RepContract = NonNullable<
  ReturnType<typeof buildFallbackPoseMovementContract>
>;

function makeMovementEvidence(
  contract: RepContract,
  angle: number,
  capturedAtMs: number,
  options: {
    exerciseDeclared?: boolean;
    orientation?: string;
    visibility?: number;
  } = {},
) {
  const rig = createGeneratedExerciseRigFromMovementContract({
    exerciseLabel: contract.exercise,
    movementContract: contract,
  });
  const base = rig.keyframes[0]?.keypoints;
  if (!base) throw new Error(`Missing generated rig for ${contract.exercise}`);
  const keypoints = applyGeneratedRigDominantAngle(
    base,
    contract.dominantJoint,
    angle,
  );
  if (contract.exercise === 'squat') {
    const legLength = 0.38;
    const halfLeg = legLength / 2;
    const cosine = Math.cos((angle * Math.PI) / 180);
    const offset =
      halfLeg *
      Math.sqrt(
        Math.max(0, (1 + cosine) / Math.max(1e-3, 1 - cosine)),
      );
    (['left', 'right'] as const).forEach((side) => {
      const sideOffset = side === 'right' ? 1 : 0;
      const sideDirection = side === 'left' ? -1 : 1;
      const baseX = side === 'left' ? 0.38 : 0.62;
      const setPoint = (index: number, x: number, y: number) => {
        keypoints[index] = { ...keypoints[index], x, y };
      };
      // A squat can bend at the knee while the shoulder/hip/ankle body line
      // remains aligned; isolated knee rotation creates an impossible trace.
      setPoint(11 + sideOffset, baseX, 0.2);
      setPoint(23 + sideOffset, baseX, 0.52);
      setPoint(25 + sideOffset, baseX + sideDirection * offset, 0.52 + halfLeg);
      setPoint(27 + sideOffset, baseX, 0.52 + legLength);
    });
  }
  const evidenceKeypoints = keypoints.map((point) => ({
    ...point,

    visibility: options.visibility ?? point.visibility,
  }));
  // The editor drawing is upright. Simulated camera posture is independent;
  // use the requested posture even when it matches the saved contract.
  const orientation = options.orientation ?? contract.bodyOrientation;
  if (orientation && orientation !== 'any') {
    const shoulder = evidenceKeypoints[11], hip = evidenceKeypoints[23];
    const current = Math.atan2(hip.y-shoulder.y,hip.x-shoulder.x);
    const desired = orientation === 'upright' ? Math.PI/2
      : orientation === 'inclined' ? Math.PI/4 : 0;
    const rotation = desired-current;
    for (const p of evidenceKeypoints) {
      const x=p.x-.5, y=p.y-.5;
      p.x=.5+x*Math.cos(rotation)-y*Math.sin(rotation);
      p.y=.5+x*Math.sin(rotation)+y*Math.cos(rotation);
    }
  }
  // Body travel is camera Y movement, applied after orienting the subject.
  if (Math.abs(angle - contract.repThresholds.down.angle) < 0.001) {
    for (const point of evidenceKeypoints) point.y += 0.04;
  }
  const signals = computePoseSignals([
    { capturedAtMs, keypoints: evidenceKeypoints },
  ]);
  return {
    coordinateDimensions: { width: 1, height: 1 },
    exerciseDeclared: options.exerciseDeclared,
    keypoints: evidenceKeypoints,
    signals,
  };
}

function runRepSequenceAtInterval(
  contract: RepContract,
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
        makeMovementEvidence(
          contract,
          angle,
          startTimeMs + index * frameIntervalMs,
        ),
      ).nextState,
    initialState,
  );
}

function runRepSequence(
  contract: RepContract,
  angles: number[],
) {
  return runRepSequenceAtInterval(contract, angles, 100);
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
  const plank = buildFallbackPoseMovementContract('plank');
  if (!plank) throw new Error('plank fallback contract missing');
  return makeMovementEvidence(plank, 170, 0, {
    orientation: 'horizontal',
    visibility,
  });
}

describe('planned exercise orientation regression', () => {
  it('requires the configured orientation even when the exercise is declared', () => {
    const bench = buildFallbackPoseMovementContract('bench_press');
    if (!bench) throw new Error('bench press fallback contract missing');
    const configured = { ...bench, bodyOrientation: 'horizontal' as const };
    const angles = buildRepAngleSequence(configured);

    const unplanned = angles.reduce(
      (state, angle, index) =>
        stepPoseRepEngine(
          state,
          configured,
          angle,
          index * 100,
          makeMovementEvidence(bench, angle, index * 100, {
            exerciseDeclared: true,
            orientation: 'upright',
          }),
        ).nextState,
      createPoseRepEngineState(),
    );
    const planned = runRepSequence(configured, angles);

    expect(unplanned.repCount).toBe(0);
    expect(unplanned.phase).toBe('primed');
    expect(planned.repCount).toBe(1);
  });
});

describe('mobile auto-rep regression primitives', () => {
  it('awards a squat only after stable start, target, and return endpoints', () => {
    const squat = buildFallbackPoseMovementContract('squat');
    if (!squat) throw new Error('squat fallback contract missing');

    const state = runRepSequence(squat, buildRepAngleSequence(squat));

    expect(state.repCount).toBe(1);
    expect(state.lastRepCompletedAtMs).toBe(500);
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
    'accepts two complete $exercise cycles without a family cooldown',
    ({ exercise }) => {
      const contract = buildFallbackPoseMovementContract(exercise);
      if (!contract) throw new Error(`${exercise} fallback contract missing`);

      const cycle = buildRepAngleSequence(contract);
      const state = runRepSequenceAtInterval(
        contract,
        [...cycle, ...cycle],
        100,
      );

      expect(state.repCount).toBe(2);
    },
  );

  it('keeps strict, half-rep, and review-only modes explicit', () => {
    const squat = buildFallbackPoseMovementContract('squat');
    if (!squat) throw new Error('squat fallback contract missing');
    const start = squat.repThresholds.up.angle;
    const target = squat.repThresholds.down.angle;
    const midpoint = (start + target) / 2;
    const completeCycle = [start, start, midpoint, target, target, start, start];

    expect(runRepSequence(squat, buildRepAngleSequence(squat)).repCount).toBe(1);
    expect(
      runRepSequence(
        { ...squat, partialRepPolicy: 'review_only' },
        completeCycle,
      ).repCount,
    ).toBe(0);

    const half = runRepSequenceAtInterval(
      { ...squat, partialRepPolicy: 'count_half_reps' },
      [
        start,
        start,
        midpoint,
        target,
        target,
        target,
        target,
        start,
        start,
        start,
        start,
        midpoint,
        target,
        target,
      ],
      100,
    );
    expect(half.repCount).toBe(2);
  });

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
