import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const sql = readFileSync(
  resolve(
    __dirname,
    '..',
    'migrations',
    '20260825120000_exercise_movement_family_contract',
    'migration.sql',
  ),
  'utf8',
);

void test('movement-contract migration is additive, idempotent, and preserves historical rows', () => {
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\s+exercise_catalog\b/i);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "exercise_movement_families"/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS "exercise_aliases"/);
  assert.match(sql, /ADD COLUMN IF NOT EXISTS "movement_family_id"/);
  assert.match(sql, /ON CONFLICT \(key\) DO NOTHING/);
  assert.match(sql, /ON CONFLICT \(normalized_label\) DO NOTHING/);
  assert.match(sql, /references_preserved', true/);
  assert.match(sql, /SET is_active = false, tracking_mode = 'manual'/);
  assert.match(sql, /WHERE c\.id <> a\.exercise_id AND c\.is_active = true/);
  assert.match(sql, /ON CONFLICT DO NOTHING/);
});

void test('migration owns exactly the eight reviewed families with deterministic UUIDs', () => {
  const familyRows = [...sql.matchAll(/'81000000-0000-4000-8000-00000000000[1-8]'::uuid/g)];
  assert.equal(familyRows.length, 8);
  for (const family of [
    'squat', 'bench_press', 'bicep_curl', 'dip',
    'plank', 'pull_up', 'push_up', 'shoulder_press',
  ]) {
    assert.match(sql, new RegExp(`'${family}'`));
  }
  assert.doesNotMatch(sql, /\('squat', '(?:bulgarian|pistol|lunge)/i);
  assert.match(sql, /md5\('fittrack-exercise-alias:' \|\| normalized_label\)/);
});
