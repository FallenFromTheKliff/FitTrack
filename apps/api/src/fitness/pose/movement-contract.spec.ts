import type {
  ExerciseMovementProfileRecord,
  FitnessExerciseRecord,
  PoseKeypointRecord,
} from '../../../../../packages/types/fitness';
import {
  buildFallbackPoseMovementContract,
  createGeneratedExerciseRigFromMovementContract,
  getPoseMovementContractAngle,
  normalizeExerciseAlias,
  resolveEffectiveMovementProfile,
  resolveExerciseAlias,
  validatePoseMovementCalibration,
  validatePoseMovementFamilyCompatibility,
} from '../../../../../packages/utils';
import {
  movementContractIdentityKey,
  resolveWorkoutExerciseContract,
} from '../../../../../apps/mobile/lib/workout/exerciseContractResolver';

function movementProfile(label: string): ExerciseMovementProfileRecord {
  const movementContract = buildFallbackPoseMovementContract(label);
  if (!movementContract) throw new Error(`Missing test contract: ${label}`);
  return {
    movementContract,
    rig: null,
    schemaVersion: 'exercise_movement_profile_v1',
    warnings: [],
  };
}

function exerciseFixture(
  id: string,
  name: string,
  profile: ExerciseMovementProfileRecord | null,
  mode: FitnessExerciseRecord['trackingMode'] = 'inherit',
): FitnessExerciseRecord {
  return {
    aliases: [],
    category: 'strength',
    createdAt: '2026-08-25T00:00:00.000Z',
    description: null,
    handShapeProfile: null,
    id,
    imageUrl: null,
    instructions: null,
    isActive: true,
    movementContractIdentity: {
      exerciseId: id,
      familyKey: mode === 'manual' ? null : 'push_up',
      revision: mode === 'manual' ? null : 4,
      source:
        mode === 'override'
          ? 'exercise_override'
          : mode === 'inherit'
            ? 'family'
            : 'manual',
      trackingMode: mode,
    },
    movementFamily:
      mode === 'manual'
        ? null
        : {
            canonicalExerciseId: 'canonical-push-up',
            contractRevision: 4,
            displayName: 'Push Up',
            id: 'family-push-up',
            inheritingExerciseIds: [id],
            key: 'push_up',
          },
    movementProfile: profile,
    movementProfileOverride: null,
    muscleGroup: 'chest',
    muscleTargets: [],
    name,
    trackingMode: mode,
    updatedAt: '2026-08-25T00:00:00.000Z',
    videoUrl: null,
  };
}

describe('movement-family contract', () => {
  it.each([['bicep_curl', 'elbow'] as const, ['squat', 'knee'] as const])(
    'generates a connected full-body %s rig with exact dominant angles',
    (exerciseLabel, expectedJoint) => {
      const contract = buildFallbackPoseMovementContract(exerciseLabel);
      if (!contract) throw new Error(exerciseLabel + ' contract missing');
      expect(contract.dominantJoint).toBe(expectedJoint);
      const rig = createGeneratedExerciseRigFromMovementContract({
        exerciseLabel,
        movementContract: contract,
      });
      const connectedCore = [
        [0, 11],
        [0, 12],
        [11, 12],
        [11, 13],
        [13, 15],
        [12, 14],
        [14, 16],
        [11, 23],
        [12, 24],
        [23, 24],
        [23, 25],
        [25, 27],
        [24, 26],
        [26, 28],
        [27, 31],
        [28, 32],
      ] as const;

      expect(rig.keyframes).toHaveLength(3);
      rig.keyframes.forEach((frame) => {
        expect(frame.keypoints).toHaveLength(33);
        expect(frame.keypoints.every((point) => point.visibility >= 0.8)).toBe(
          true,
        );
        connectedCore.forEach(([from, to]) => {
          const start = frame.keypoints[from];
          const end = frame.keypoints[to];
          expect(start).toBeDefined();
          expect(end).toBeDefined();
          expect(Math.hypot(start.x - end.x, start.y - end.y)).toBeGreaterThan(
            0.01,
          );
          expect(Math.hypot(start.x - end.x, start.y - end.y)).toBeLessThan(
            0.45,
          );
        });
        expect(
          getPoseMovementContractAngle(contract, frame.keypoints),
        ).toBeCloseTo(frame.angle ?? 0, 0);
      });
    },
  );

  it('resolves manual as null, inherit from the family, and override as a deep merge', () => {
    const base = movementProfile('squat');
    const manual = resolveEffectiveMovementProfile({
      exerciseId: 'manual',
      familyBaseProfile: base,
      familyKey: 'squat',
      familyRevision: 2,
      legacyProfile: movementProfile('push_up'),
      override: null,
      trackingMode: 'manual',
    });
    expect(manual.profile).toBeNull();
    expect(manual.identity.source).toBe('manual');

    const inherited = resolveEffectiveMovementProfile({
      exerciseId: 'inherit',
      familyBaseProfile: base,
      familyKey: 'squat',
      familyRevision: 2,
      override: null,
      trackingMode: 'inherit',
    });
    expect(inherited.profile).toBe(base);
    expect(inherited.identity).toMatchObject({ revision: 2, source: 'family' });

    const overridden = resolveEffectiveMovementProfile({
      exerciseId: 'override',
      familyBaseProfile: base,
      familyKey: 'squat',
      familyRevision: 2,
      override: {
        movementContract: {
          repThresholds: { down: { angle: 101 } },
        },
      } as never,
      trackingMode: 'override',
    });
    expect(overridden.profile?.movementContract.repThresholds.down.angle).toBe(
      101,
    );
    expect(overridden.profile?.movementContract.repThresholds.up.angle).toBe(
      base.movementContract.repThresholds.up.angle,
    );
    expect(overridden.identity.source).toBe('exercise_override');
  });

  it('updates inheritors with a family revision while preserving child overrides and manual history', () => {
    const original = movementProfile('squat');
    const edited = {
      ...original,
      movementContract: {
        ...original.movementContract,
        repThresholds: {
          ...original.movementContract.repThresholds,
          up: { angle: 165, tolerance: 8 },
        },
      },
    };
    const inherited = resolveEffectiveMovementProfile({
      exerciseId: 'front-squat',
      familyBaseProfile: edited,
      familyKey: 'squat',
      familyRevision: 5,
      override: null,
      trackingMode: 'inherit',
    });
    const overridden = resolveEffectiveMovementProfile({
      exerciseId: 'goblet-squat',
      familyBaseProfile: edited,
      familyKey: 'squat',
      familyRevision: 5,
      override: {
        movementContract: { repThresholds: { down: { angle: 99 } } },
      } as never,
      trackingMode: 'override',
    });
    const historicalManual = resolveEffectiveMovementProfile({
      exerciseId: 'historical',
      familyBaseProfile: edited,
      familyKey: 'squat',
      familyRevision: 5,
      legacyProfile: original,
      override: null,
      trackingMode: 'manual',
    });
    expect(inherited.profile?.movementContract.repThresholds.up.angle).toBe(
      165,
    );
    expect(overridden.profile?.movementContract.repThresholds.up.angle).toBe(
      165,
    );
    expect(overridden.profile?.movementContract.repThresholds.down.angle).toBe(
      99,
    );
    expect(historicalManual.profile).toBeNull();
  });

  it('normalizes Push Up spellings exactly and resolves independently of list order', () => {
    expect(
      ['Push Up', 'Push-Up', 'push_up'].map(normalizeExerciseAlias),
    ).toEqual(['push up', 'push up', 'push up']);
    const push = {
      id: 'push',
      name: 'Push Up',
      aliases: ['Push-Up', 'push_up'],
    };
    const pull = { id: 'pull', name: 'Pull Up', aliases: ['Pull-Up'] };
    expect(resolveExerciseAlias([push, pull], 'push_up')?.id).toBe('push');
    expect(resolveExerciseAlias([pull, push], 'Push-Up')?.id).toBe('push');
    expect(resolveExerciseAlias([push, pull], 'push up drill')).toBeNull();
    expect(() =>
      resolveExerciseAlias(
        [push, { ...pull, aliases: ['Push-Up'] }],
        'push-up',
      ),
    ).toThrow('Ambiguous exercise alias');
  });

  it('uses server exercise identity beyond the first page and keeps ID/alias identity identical', () => {
    const profile = movementProfile('push_up');
    const exercises = Array.from({ length: 60 }, (_, index) =>
      exerciseFixture(`exercise-${index}`, `Manual ${index}`, null, 'manual'),
    );
    const target = exerciseFixture('server-target', 'Push Up', profile);
    target.aliases = [
      {
        id: 'alias',
        kind: 'spelling',
        label: 'Push-Up',
        normalizedLabel: 'push up',
      },
    ];
    exercises.push(target);
    const byId = resolveWorkoutExerciseContract({
      exercises,
      exerciseId: 'server-target',
    });
    const byAlias = resolveWorkoutExerciseContract({
      exercises: [...exercises].reverse(),
      label: 'push_up',
    });
    expect(byId?.exercise.id).toBe('server-target');
    expect(byAlias?.exercise.id).toBe('server-target');
    expect(movementContractIdentityKey(byId?.identity)).toBe(
      movementContractIdentityKey(byAlias?.identity),
    );
  });

  it('accepts calibrated threshold changes but rejects malformed family topology and ranges', () => {
    const squat = buildFallbackPoseMovementContract('squat');
    if (!squat) throw new Error('squat contract missing');
    const custom = {
      ...squat,
      repThresholds: {
        down: { angle: 104, tolerance: 9 },
        up: { angle: 163, tolerance: 7 },
      },
      trackingRequirements: {
        ...squat.trackingRequirements,
        minConfidence: 0.71,
      },
    };
    expect(validatePoseMovementFamilyCompatibility(custom).valid).toBe(true);
    expect(validatePoseMovementCalibration(custom).valid).toBe(true);
    expect(
      validatePoseMovementFamilyCompatibility({
        ...custom,
        dominantJoint: 'elbow',
      }).valid,
    ).toBe(false);
    expect(
      validatePoseMovementCalibration({
        ...custom,
        repThresholds: {
          ...custom.repThresholds,
          down: { angle: -1, tolerance: 9 },
        },
      }).valid,
    ).toBe(false);
  });

  it('uses the reliable squat knee when the far side is occluded and enforces optional symmetry', () => {
    const squat = buildFallbackPoseMovementContract('squat');
    if (!squat) throw new Error('squat contract missing');
    const points: PoseKeypointRecord[] = Array.from({ length: 33 }, () => ({
      visibility: 1,
      x: 0,
      y: 0,
      z: 0,
    }));
    points[23] = { visibility: 1, x: 0, y: 0, z: 0 };
    points[25] = { visibility: 1, x: 0, y: 1, z: 0 };
    points[27] = { visibility: 1, x: 1, y: 1, z: 0 };
    for (const index of [24, 26, 28]) points[index].visibility = 0.05;
    expect(getPoseMovementContractAngle(squat, points)).toBeCloseTo(90);

    points[24] = { visibility: 1, x: 0, y: 0, z: 0 };
    points[26] = { visibility: 1, x: 0, y: 1, z: 0 };
    points[28] = { visibility: 1, x: 0, y: 2, z: 0 };
    expect(getPoseMovementContractAngle(squat, points)).toBeNull();
  });
});
