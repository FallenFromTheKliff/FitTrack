import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PoseProfileKind } from '@prisma/client';
import {
  getLegacySeedPoseProfileRetirementWhere,
  LEGACY_POSE_PROFILE_EXERCISE_KEYS,
  POSE_PROFILE_EXERCISE_KEYS,
} from './domains/fitness-gamification';
import { seedId } from './ids';

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
