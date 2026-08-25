import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ExerciseTrackingMode, PoseProfileKind } from '@prisma/client';
import {
  getLegacySeedPoseProfileRetirementWhere,
  hasCalibratedLegacyMovementContract,
  filterPresentSeedHistoryMembers,
  LEGACY_POSE_PROFILE_EXERCISE_KEYS,
  POSE_PROFILE_EXERCISE_KEYS,
  shouldLinkMovementFamilyMember,
  shouldRestoreMovementFamilyDefaults,
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
  assert.deepEqual(LEGACY_POSE_PROFILE_EXERCISE_KEYS, []);
  assert.equal(
    POSE_PROFILE_EXERCISE_KEYS.some((key) => key === ('bench' as string)),
    false,
  );
});

void test('additive movement-family seed preserves calibrated revisions and existing ownership', () => {
  assert.equal(shouldRestoreMovementFamilyDefaults('additive', 2), false);
  assert.equal(shouldRestoreMovementFamilyDefaults('additive', 9), false);
  assert.equal(shouldRestoreMovementFamilyDefaults('additive', 1), false);
  assert.equal(shouldRestoreMovementFamilyDefaults('additive', null), false);
  assert.equal(shouldRestoreMovementFamilyDefaults('reset', 9), true);
  assert.equal(
    shouldLinkMovementFamilyMember('additive', 'admin-family'),
    false,
  );
  assert.equal(shouldLinkMovementFamilyMember('additive', null), true);
  assert.equal(
    shouldLinkMovementFamilyMember(
      'additive',
      null,
      ExerciseTrackingMode.manual,
      {
        movementContract: {
          dominantJoint: 'elbow',
          repThresholds: { down: { angle: 145 }, up: { angle: 95 } },
        },
      },
    ),
    false,
  );
  assert.equal(
    hasCalibratedLegacyMovementContract({
      dominantJoint: 'knee',
      repThresholds: { down: { angle: 100 }, up: { angle: 155 } },
    }),
    true,
  );
  assert.equal(shouldLinkMovementFamilyMember('reset', 'admin-family'), true);
});

void test('gamification reconciliation excludes state users removed during reset', () => {
  assert.deepEqual(
    filterPresentSeedHistoryMembers(
      ['active', 'removed', 'missing-id'],
      {
        active: 'user-active',
        removed: 'user-removed',
      },
      new Set(['user-active']),
    ),
    [{ memberKey: 'active', userId: 'user-active' }],
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
  const reviewedKeys = new Set([
    'squat',
    'barbell-bench',
    'biceps-curl',
    'dip',
    'plank',
    'pull-up',
    'push-up',
    'shoulder-press',
  ]);
  assert.deepEqual(new Set(CANONICAL_POSE_EXERCISE_KEYS), reviewedKeys);
  assert.deepEqual(
    new Set(CANONICAL_POSE_CAPABILITIES.map(({ exerciseKey }) => exerciseKey)),
    reviewedKeys,
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
  assert.equal(getPoseAutoRepCapabilityForLabel('Cable Fly'), null);
  assert.equal(getPoseAutoRepCapabilityForLabel('Dumbbell Bench Press'), null);
  assert.equal(
    getPoseAutoRepCapabilityForLabel('Barbell Bench Press')?.exerciseKey,
    'barbell-bench',
  );
  assert.equal(getPoseAutoRepCapabilityForLabel('Treadmill Run'), null);
  assert.equal(getPoseAutoRepCapabilityForLabel('Mobility Flow'), null);
  assert.equal(buildFallbackPoseMovementContract('run'), null);
  assert.equal(buildFallbackPoseMovementContract('mobility-flow'), null);
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
      holdDurationSeconds: 3601,
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
    ['0', '0', '450', '900', '650'],
  );
});
