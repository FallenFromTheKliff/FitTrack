import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSeedAccounts } from './accounts';
import { parseDynamicSeedConfig } from './config';
import { manifestPopulationFields, restoreManifestPopulation } from './manifest';
import { validatePreservedTesterSource } from './preserved-testers';

const source = validatePreservedTesterSource({
  schemaVersion: 1,
  exportedAt: '2026-09-14T00:00:00.000Z',
  source: {
    projectId: '64fae619-12a9-4cff-b1b9-4f08c43b4c42',
    environmentId: '4c6d42ef-4173-4a41-893a-960062edb92e',
    serviceId: '0eb12c22-cf77-4091-85c3-6f12fa1183c5',
  },
  users: [{
    email: 'manifest-fixture@gmail.com',
    role: 'member',
    profile: {
      first_name: 'Manifest', last_name: 'Fixture', phone: null,
      date_of_birth: null, gender: null, weight_kg: null, height_cm: null,
      activity_level: null, fitness_goal: null, avatar_url: null,
    },
  }],
});

const config = () => parseDynamicSeedConfig([
  'node', 'seed', '--anchor-date=2026-09-14T09:00:00.000Z',
]);

void test('manifest stores counts only and replays tester identities with extras', () => {
  const original = config();
  original.preservedTesterProfiles = source.users;
  original.extraUsers = 5;
  const accounts = buildSeedAccounts(original);
  const population = { users: original.users, ...manifestPopulationFields(original) };
  assert.deepEqual(population, { users: 18, extraUsers: 5, preservedTesterUsers: 1 });
  assert.doesNotMatch(JSON.stringify(population), /email|profile|gmail|Fixture/);
  const replay = config();
  restoreManifestPopulation(replay, population, source);
  assert.deepEqual(buildSeedAccounts(replay), accounts);
});

void test('legacy and new synthetic manifests ignore available personal profiles', () => {
  for (const population of [{ users: 180 }, { users: 180, preservedTesterUsers: 0, extraUsers: 0 }]) {
    const replay = config();
    replay.preservedTesterProfiles = source.users;
    restoreManifestPopulation(replay, population, source);
    assert.equal(replay.preservedTesterProfiles, undefined);
    assert.equal(replay.extraUsers, 0);
    assert.deepEqual(buildSeedAccounts(replay), buildSeedAccounts(config()));
  }
});

void test('report rejects missing, mismatched, or malformed population metadata', () => {
  assert.throws(() => restoreManifestPopulation(config(), { users: 13, preservedTesterUsers: 1 }, null), /source count/);
  assert.throws(() => restoreManifestPopulation(config(), { users: 14, preservedTesterUsers: 2 }, source), /source count/);
  assert.throws(() => restoreManifestPopulation(config(), { users: 14, preservedTesterUsers: 1 }, source), /total does not match/);
  assert.throws(() => restoreManifestPopulation(config(), { users: 13, preservedTesterUsers: -1 }, source), /invalid manifest/);
  assert.throws(() => restoreManifestPopulation(config(), { users: 13, preservedTesterUsers: 1, extraUsers: 0.5 }, source), /invalid manifest/);
});
