import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';

import {
  CANONICAL_AMENITIES,
  CANONICAL_MUSCLE_DEFINITIONS,
  CANONICAL_POSE_CAPABILITIES,
  getCanonicalPoseCapabilityByLabel,
  resolveCanonicalReferenceId,
} from '../../../../packages/utils/fitness-catalog';
import { seedId } from './ids';
import { shouldSeedCanonicalOperatingHour } from './domains/ai-gym-analytics';

void test('canonical references converge on stable IDs without overwriting name collisions', () => {
  assert.deepEqual(
    CANONICAL_AMENITIES.map((amenity) => seedId(`amenity:${amenity.key}`)),
    CANONICAL_AMENITIES.map((amenity) => seedId(`amenity:${amenity.key}`)),
  );
  assert.deepEqual(
    CANONICAL_MUSCLE_DEFINITIONS.map((muscle) =>
      seedId(`muscle-definition:${muscle.key}`),
    ),
    CANONICAL_MUSCLE_DEFINITIONS.map((muscle) =>
      seedId(`muscle-definition:${muscle.key}`),
    ),
  );
  const desiredId = seedId('amenity:boxing-ring');
  assert.equal(resolveCanonicalReferenceId(desiredId), desiredId);
  assert.equal(
    resolveCanonicalReferenceId(
      desiredId,
      { id: desiredId },
      { id: 'name-row' },
    ),
    desiredId,
  );
  assert.equal(
    resolveCanonicalReferenceId(desiredId, null, { id: 'admin-row' }),
    'admin-row',
  );
});

void test('additive operating hours preserve existing rows while reset may restore defaults', () => {
  assert.equal(shouldSeedCanonicalOperatingHour('additive', true), false);
  assert.equal(shouldSeedCanonicalOperatingHour('additive', false), true);
  assert.equal(shouldSeedCanonicalOperatingHour('reset', true), true);
});

void test('pose aliases are exact and reject unsupported containing labels', () => {
  const supportedLabels = [
    'Barbell Back Squat',
    'Barbell Bench Press',
    'Dumbbell Biceps Curl',
    'Parallel Bar Dip',
    'Forearm Plank',
    'Pull Up',
    'Push-Up',
    'Seated Dumbbell Shoulder Press',
  ];
  assert.equal(supportedLabels.length, CANONICAL_POSE_CAPABILITIES.length);
  for (const label of supportedLabels) {
    assert.ok(getCanonicalPoseCapabilityByLabel(label));
  }
  for (const label of [
    'side plank',
    'bench dip',
    'dumbbell bench press',
    'incline dumbbell press',
    'not-a-push-up-variant',
    'my squat rehabilitation drill',
  ]) {
    assert.equal(getCanonicalPoseCapabilityByLabel(label), null, label);
  }
});

void test('alternate seed commands use canonical fixtures and bound additive cleanup', () => {
  const prismaRoot = resolve(__dirname, '..');
  const testSeed = readFileSync(
    resolve(prismaRoot, 'seed-test-data.ts'),
    'utf8',
  );
  const defenseSeed = readFileSync(
    resolve(prismaRoot, 'seed-defense-demo-data.ts'),
    'utf8',
  );
  assert.match(testSeed, /CANONICAL_EXERCISE_CATALOG/);
  assert.match(testSeed, /ensureWorkoutFixtures\(ensuredAccounts, mode\)/);
  assert.match(testSeed, /if \(mode === 'reset'\)/);
  assert.match(testSeed, /reps_ai_counted: null/);
  assert.match(defenseSeed, /CANONICAL_EXERCISE_CATALOG/);
  assert.match(defenseSeed, /getCanonicalPoseCapability/);
  assert.match(defenseSeed, /reps_ai_counted:\s*capability && !isStaticHold/);
  assert.doesNotMatch(defenseSeed, /slugify\(exercise\.name\)/);
});
