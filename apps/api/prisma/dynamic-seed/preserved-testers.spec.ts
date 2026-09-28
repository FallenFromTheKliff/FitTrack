import assert from 'node:assert/strict';
import { join } from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import bcrypt from 'bcrypt';
import {
  DYNAMIC_SEED_PASSWORD,
  DEMO_ACCOUNTS,
  buildSeedAccounts,
  accountRoleTargets,
  syntheticIdentityCapacity,
} from './accounts';
import {
  loadPreservedTesterSource,
  loadPreservedTesterConfig,
  validatePreservedTesterSource,
} from './preserved-testers';
import { userIdFor } from './accounts';
import type { DynamicSeedConfig } from './types';
import { deriveSeedPhysicalBaseline, validateSeedAccountContext } from './lifecycles-profiles';
import { parseDynamicSeedConfig } from './config';

const sourceFixture = {
  schemaVersion: 1,
  exportedAt: '2026-09-14T00:00:00.000Z',
  source: {
    projectId: 'local-fittrack',
    environmentId: 'local-development',
    serviceId: 'local-api',
  },
  users: [
    {
      email: 'fixture-admin@gmail.com',
      role: 'admin',
      profile: {
        first_name: 'Fixture',
        last_name: 'Admin',
        phone: null,
        date_of_birth: null,
        gender: null,
        weight_kg: null,
        height_cm: null,
        activity_level: null,
        fitness_goal: null,
        avatar_url: null,
      },
    },
    {
      email: 'fixture-staff@me.com',
      role: 'staff',
      profile: {
        first_name: 'Fixture',
        last_name: 'Staff',
        phone: '+639180000001',
        date_of_birth: '1990-01-02',
        gender: 'female',
        weight_kg: '62.5',
        height_cm: 168,
        activity_level: 'active',
        fitness_goal: 'maintenance',
        avatar_url: 'https://example.invalid/fixture-staff.png',
      },
    },
    {
      email: 'fixture-coach@icloud.com',
      role: 'coach',
      profile: {
        first_name: 'Fixture',
        last_name: 'Coach',
        phone: '+639180000002',
        date_of_birth: '1988-03-04T00:00:00.000Z',
        gender: 'male',
        weight_kg: 80,
        height_cm: 180,
        activity_level: 'very_active',
        fitness_goal: 'sport_specific',
        avatar_url: null,
      },
    },
    {
      email: 'fixture-member@googlemail.com',
      role: 'member',
      profile: {
        first_name: 'Fixture',
        last_name: 'Member',
        phone: '+639180000003',
        date_of_birth: '1995-05-06T00:00:00.000Z',
        gender: 'other',
        weight_kg: null,
        height_cm: null,
        activity_level: 'moderate',
        fitness_goal: 'cutting',
        avatar_url: null,
      },
    },
    {
      email: 'fixture-member-two@mac.com',
      role: 'member',
      profile: {
        first_name: 'Fixture',
        last_name: 'Outlier',
        phone: '+639180000004',
        date_of_birth: '1994-07-08T00:00:00.000Z',
        gender: 'female',
        weight_kg: 90,
        height_cm: 250,
        activity_level: 'light',
        fitness_goal: 'bulking',
        avatar_url: null,
      },
    },
  ],
};

function makeConfig(): DynamicSeedConfig {
  return {
    anchorDate: new Date('2026-09-14T00:00:00.000Z'),
    bookingDensity: 'normal',
    coachActiveRate: 0.7,
    coachFormerRate: 0.1,
    coachPausedRate: 0.2,
    exerciseHistory: 50,
    historyEndDate: new Date('2026-09-13T00:00:00.000Z'),
    historyMonths: 12,
    historyStartDate: new Date('2025-09-14T00:00:00.000Z'),
    mode: 'reset',
    pendingPaymentRate: 0.1,
    seed: 20260914,
    sessionDensity: 'normal',
    scope: 'all',
    splitPresetsPerMember: 3,
    target: 'local',
    users: 180,
    workoutDensity: 'normal',
  };
}

function cloneFixture() {
  return JSON.parse(JSON.stringify(sourceFixture)) as typeof sourceFixture;
}

const source = validatePreservedTesterSource(sourceFixture);
assert.equal(source.users.length, 5);
assert.equal(source.users[0].profile.phone, null);
assert.equal(source.users[1].profile.weight_kg, 62.5);

const malformed = cloneFixture();
(malformed.users[0].profile as Record<string, unknown>).unexpected = true;
assert.throws(() => validatePreservedTesterSource(malformed), /unknown or missing/);

const duplicate = cloneFixture();
duplicate.users.push({ ...duplicate.users[0] });
assert.throws(() => validatePreservedTesterSource(duplicate), /duplicate email/);

const badTarget = cloneFixture();
badTarget.source.projectId = '00000000-0000-0000-0000-000000000000';
assert.throws(() => validatePreservedTesterSource(badTarget), /target identifiers/);
const badNumber = cloneFixture();
(badNumber.users[0].profile as Record<string, unknown>).weight_kg = [70];
assert.throws(() => validatePreservedTesterSource(badNumber), /positive finite number/);
const badDate = cloneFixture();
(badDate.users[0].profile as Record<string, unknown>).date_of_birth = '2023-02-29';
assert.throws(() => validatePreservedTesterSource(badDate), /calendar date/);
const longName = cloneFixture();
(longName.users[0].profile as Record<string, unknown>).first_name = 'x'.repeat(101);
assert.throws(() => validatePreservedTesterSource(longName), /maximum length/);
assert.throws(
  () => validatePreservedTesterSource({ ...cloneFixture(), users: [] }),
  /non-empty array/,
);

const missingPath = join(process.env.TEMP ?? process.cwd(), 'fittrack-preserved-testers-missing.json');
assert.equal(loadPreservedTesterSource({}, missingPath), null);
assert.throws(
  () => loadPreservedTesterSource({ FITTRACK_PRESERVED_TESTERS_PATH: missingPath }, missingPath),
  /FITTRACK_PRESERVED_TESTERS_PATH is missing/,
);

const config = makeConfig();
config.preservedTesterProfiles = source.users;
const firstAccounts = buildSeedAccounts(config);
const secondConfig = makeConfig();
secondConfig.preservedTesterProfiles = source.users;
const secondAccounts = buildSeedAccounts(secondConfig);
assert.equal(config.users, DEMO_ACCOUNTS.length + source.users.length);
assert.equal(firstAccounts.length, config.users);
assert.equal(secondAccounts.length, secondConfig.users);

for (const fixture of source.users) {
  const account = firstAccounts.find((candidate) => candidate.email === fixture.email);
  const repeated = secondAccounts.find((candidate) => candidate.email === fixture.email);
  assert.ok(account);
  assert.ok(repeated);
  assert.equal(account!.role, fixture.role);
  assert.equal(account!.password, DYNAMIC_SEED_PASSWORD);
  assert.equal(account!.key, repeated!.key);
  assert.equal(userIdFor(account!.key), userIdFor(repeated!.key));
  assert.equal(account!.firstName, fixture.profile.first_name);
  assert.equal(account!.lastName, fixture.profile.last_name);
}

const coach = firstAccounts.find((account) => account.email === 'fixture-coach@icloud.com')!;
assert.equal(coach.physicalBaseline?.heightCm, 180);
assert.equal(coach.physicalBaseline?.weightKg, 80);
const outlier = firstAccounts.find((account) => account.email === 'fixture-member-two@mac.com')!;
assert.ok((outlier.physicalBaseline?.heightCm ?? 0) >= 150);
assert.ok((outlier.physicalBaseline?.heightCm ?? 0) <= 190);
assert.notEqual(outlier.physicalBaseline?.heightCm, 250);
const nonTester = buildSeedAccounts(makeConfig()).find((account) => !account.isDemo)!;
assert.equal(
  deriveSeedPhysicalBaseline(
    { ...nonTester, heightCm: 250, isPreservedTester: false },
    makeConfig(),
  ).heightCm,
  190,
);
assert.throws(
  () => buildSeedAccounts({ ...makeConfig(), users: syntheticIdentityCapacity() + 1 }),
  /synthetic identity capacity/,
);
assert.equal(DEMO_ACCOUNTS.find((account) => account.key === 'member-unverified')?.status, 'pending');
assert.ok(DEMO_ACCOUNTS.some((account) => account.key === 'member-archived' && account.deletedAt));

const populationSource = validatePreservedTesterSource({
  ...sourceFixture,
  users: Object.entries({ admin: 1, staff: 4, coach: 5, member: 153 }).flatMap(([role, count]) =>
    Array.from({ length: count }, (_, index) => ({
      ...sourceFixture.users[0],
      email: `population-${role}-${index}@gmail.com`,
      role,
    })),
  ),
});
const originalDemos = JSON.stringify(DEMO_ACCOUNTS);
const testerIds = new Map<string, string>();
for (const extraUsers of [0, 5, 10]) {
  const populationConfig = { ...makeConfig(), preservedTesterProfiles: populationSource.users, extraUsers };
  const accounts = buildSeedAccounts(populationConfig);
  assert.equal(accounts.length, 175 + extraUsers);
  assert.equal(accounts.filter((account) => account.isDemo).length, 12);
  assert.equal(accounts.filter((account) => account.isPreservedTester).length, 163);
  assert.equal(accounts.filter((account) => !account.isDemo && !account.isPreservedTester).length, extraUsers);
  assert.equal(new Set(accounts.map((account) => account.email.toLowerCase())).size, accounts.length);
  assert.equal(new Set(accounts.map((account) => account.key)).size, accounts.length);
  const roles = Object.fromEntries(['admin', 'staff', 'coach', 'member'].map((role) =>
    [role, accounts.filter((account) => account.role === role).length],
  ));
  assert.deepEqual(roles, accountRoleTargets(populationConfig));
  if (extraUsers === 0) assert.deepEqual(roles, { admin: 2, staff: 5, coach: 6, member: 162 });
  for (const account of accounts) {
    assert.deepEqual(validateSeedAccountContext(account), []);
    if (account.isPreservedTester) {
      assert.equal(account.password, DYNAMIC_SEED_PASSWORD);
      const id = userIdFor(account.key);
      assert.equal(testerIds.get(account.email) ?? id, id);
      testerIds.set(account.email, id);
    }
    if (account.isDemo) {
      assert.equal(account.password, DEMO_ACCOUNTS.find((demo) => demo.key === account.key)!.password);
    }
  }
}
assert.equal(JSON.stringify(DEMO_ACCOUNTS), originalDemos);
assert.equal(buildSeedAccounts(makeConfig()).length, 180);
assert.throws(() => buildSeedAccounts({ ...makeConfig(), preservedTesterProfiles: source.users, extraUsers: syntheticIdentityCapacity() }), /synthetic identity capacity/);

for (const value of ['-1', '1.5', 'abc', '', 'NaN', 'Infinity', '9007199254740992']) {
  assert.throws(() => parseDynamicSeedConfig(['node', 'seed', `--extra-users=${value}`]), /non-negative integer/);
}
assert.throws(() => parseDynamicSeedConfig(['node', 'seed', '--extra-users']), /non-negative integer/);
assert.throws(() => parseDynamicSeedConfig(['node', 'seed', '--real-user-data=maybe']), /true or false/);
assert.equal(parseDynamicSeedConfig(['node', 'seed', '--real-user-data']).realUserData, true);
assert.equal(parseDynamicSeedConfig(['node', 'seed', '--real-user-data=false']).realUserData, false);
assert.equal(parseDynamicSeedConfig(['node', 'seed', '--extra-users=5']).extraUsers, 5);
assert.equal(parseDynamicSeedConfig(['node', 'seed', '--mode=additive']).mode, 'additive');
assert.equal(parseDynamicSeedConfig(['node', 'seed', '--users=500']).usersExplicitlyConfigured, true);

assert.throws(() => loadPreservedTesterConfig({ ...makeConfig(), realUserData: true }, {}, missingPath), /--real-user-data requires/);
assert.throws(() => loadPreservedTesterConfig({ ...makeConfig(), extraUsers: 1 }, {}, missingPath), /--extra-users requires/);
const syntheticConfig = makeConfig();
assert.equal(loadPreservedTesterConfig(syntheticConfig, {}, missingPath), null);
assert.equal(syntheticConfig.users, 180);
const fixtureDirectory = mkdtempSync(join(tmpdir(), 'fittrack-population-'));
try {
  const fixturePath = join(fixtureDirectory, 'fixture.json');
  writeFileSync(fixturePath, JSON.stringify(sourceFixture));
  for (const scope of ['all', 'body-nutrition', 'coaching-payments'] as const) {
    const consumerConfig = { ...makeConfig(), scope, extraUsers: 5, realUserData: true };
    loadPreservedTesterConfig(consumerConfig, {}, fixturePath);
    assert.equal(consumerConfig.users, 22);
    assert.equal(buildSeedAccounts(consumerConfig).length, 22);
  }
} finally {
  rmSync(fixtureDirectory, { recursive: true, force: true });
}

const hash = bcrypt.hashSync(DYNAMIC_SEED_PASSWORD, 12);
assert.equal(bcrypt.compareSync(DYNAMIC_SEED_PASSWORD, hash), true);
console.log('preserved-testers.spec passed');
