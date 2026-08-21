import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PoseProfileKind } from '@prisma/client';
import {
  getLegacySeedPoseProfileRetirementWhere,
  LEGACY_POSE_PROFILE_EXERCISE_KEYS,
  POSE_PROFILE_EXERCISE_KEYS,
} from './domains/fitness-gamification';
import { seedId } from './ids';
import {
  CANONICAL_EXERCISE_CATALOG,
  CANONICAL_AMENITIES,
  CANONICAL_MUSCLE_DEFINITIONS,
  CANONICAL_POSE_CAPABILITIES,
  CANONICAL_POSE_EXERCISE_KEYS,
} from '../../../../packages/utils/fitness-catalog';
import {
  buildFallbackPoseMovementContract,
  getPoseAutoRepCapabilityForLabel,
  isValidPoseMovementContract,
} from '../../../../packages/utils/pose';

void test('pose seed retires only known deterministic legacy profiles', () => {
  const retirementWhere = getLegacySeedPoseProfileRetirementWhere();

  assert.deepEqual(
    retirementWhere.id.in,
    LEGACY_POSE_PROFILE_EXERCISE_KEYS.map((key) =>
      seedId(`pose-profile:${key}`),
    ),
  );
  assert.equal(retirementWhere.profile_kind, PoseProfileKind.seed);
  assert.ok(POSE_PROFILE_EXERCISE_KEYS.includes('barbell-bench'));
  assert.ok(
    !([...POSE_PROFILE_EXERCISE_KEYS] as readonly string[]).includes('bench'),
  );
});

void test('canonical pose registry has one explicit compatible contract per exercise', () => {
  assert.deepEqual(
    [...POSE_PROFILE_EXERCISE_KEYS],
    [
      'squat',
      'barbell-bench',
      'biceps-curl',
      'dip',
      'plank',
      'pull-up',
      'push-up',
      'shoulder-press',
    ],
  );
  assert.deepEqual(
    [...POSE_PROFILE_EXERCISE_KEYS],
    [...CANONICAL_POSE_EXERCISE_KEYS],
  );
  assert.equal(
    new Set(
      CANONICAL_EXERCISE_CATALOG.map((exercise) =>
        seedId(`exercise:${exercise.key}`),
      ),
    ).size,
    CANONICAL_EXERCISE_CATALOG.length,
  );

  for (const capability of CANONICAL_POSE_CAPABILITIES) {
    const catalogExercise = CANONICAL_EXERCISE_CATALOG.find(
      (exercise) => exercise.key === capability.exerciseKey,
    );
    const contract = buildFallbackPoseMovementContract(
      capability.contractExercise,
    );
    assert.ok(
      catalogExercise,
      `catalog exercise missing for ${capability.exerciseKey}`,
    );
    assert.ok(contract, `contract missing for ${capability.contractExercise}`);
    assert.equal(contract?.dominantJoint, capability.dominantJoint);
    assert.equal(contract?.repModel, capability.repModel);
    assert.equal(contract?.requiredSides, capability.requiredSides);
    assert.equal(contract?.bodyOrientation, capability.requiredBodyOrientation);
    assert.equal(isValidPoseMovementContract(contract), true);
    assert.ok(contract?.trackingRequirements?.requiredLandmarks.length);
    assert.ok(contract?.repThresholds.down.tolerance > 0);
    assert.ok(contract?.repThresholds.up.tolerance > 0);
  }
});

void test('unsupported and malformed pose contracts remain manual-only', () => {
  assert.equal(buildFallbackPoseMovementContract('cable fly'), null);
  assert.equal(getPoseAutoRepCapabilityForLabel('Dumbbell Bench Press'), null);
  assert.equal(
    getPoseAutoRepCapabilityForLabel('Barbell Bench Press')?.exerciseKey,
    'barbell-bench',
  );
  const fallback = buildFallbackPoseMovementContract('plank');
  assert.ok(fallback);
  assert.equal(
    isValidPoseMovementContract({
      ...fallback,
      dominantJoint: 'knee',
    }),
    false,
  );
  assert.equal(
    isValidPoseMovementContract({
      ...fallback,
      holdDurationSeconds: 600,
    }),
    false,
  );
  assert.equal(
    isValidPoseMovementContract({
      ...fallback,
      holdDurationSeconds: 45,
    }),
    true,
  );
});

void test('fixed catalog references are unique and use production muscle keys', () => {
  assert.equal(
    new Set(CANONICAL_MUSCLE_DEFINITIONS.map((muscle) => muscle.key)).size,
    CANONICAL_MUSCLE_DEFINITIONS.length,
  );
  assert.ok(
    CANONICAL_MUSCLE_DEFINITIONS.every(
      (muscle) => muscle.key === muscle.key.trim() && !/\s/.test(muscle.key),
    ),
  );
  assert.equal(
    new Set(CANONICAL_AMENITIES.map((amenity) => amenity.key)).size,
    CANONICAL_AMENITIES.length,
  );
  assert.deepEqual(
    CANONICAL_AMENITIES.map((amenity) => amenity.hourlyRate),
    ['450', '900', '650'],
  );
});
