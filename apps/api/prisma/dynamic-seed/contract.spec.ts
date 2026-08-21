import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  calculateRoleTargets,
  buildSeedAccounts,
  DEMO_ACCOUNTS,
  DYNAMIC_SEED_PASSWORD,
  DYNAMIC_SEED_PASSWORDS,
} from './accounts';
import {
  BRODIGY_QUESTION_POOL,
  buildBrodigyHistoryKeys,
  pickBrodigyQuestion,
} from './brodigy';
import { parseDynamicSeedConfig } from './config';
import { SeedRandom } from './random';
import {
  SCENARIO_DIMENSION_WEIGHTS,
  normalizeSeedAccountScenario,
  validateScenarioCompatibility,
  validateSeedScenarioCompatibility,
} from './scenarios';
import {
  bookingBehaviorFor,
  bookingVolumeCount,
  buildMemberCohortMap,
  memberVolumeCount,
} from './volumes';

void test('dynamic seed preserves local and railway CLI options', () => {
  const local = parseDynamicSeedConfig([
    'node',
    'seed-dynamic.ts',
    '--target=local',
    '--mode=reset',
    '--users=100',
    '--exercise-history=100',
  ]);
  const railway = parseDynamicSeedConfig([
    'node',
    'seed-dynamic.ts',
    '--target=railway',
    '--mode=reset',
    '--users=100',
    '--exercise-history=100',
    '--allow-remote-reset',
    '--confirm=RESET_REMOTE_DYNAMIC_SEED',
  ]);

  assert.equal(local.target, 'local');
  assert.equal(local.mode, 'reset');
  assert.equal(local.users, 100);
  assert.equal(local.exerciseHistory, 100);
  assert.equal(railway.target, 'railway');
  assert.equal(railway.mode, 'reset');
  assert.equal(railway.users, 100);
  assert.equal(railway.exerciseHistory, 100);
  assert.equal(railway.allowRemoteReset, true);
  assert.equal(railway.confirmRemoteReset, 'RESET_REMOTE_DYNAMIC_SEED');
});

void test('realistic seed accounts use role-scoped credentials and stable keys', () => {
  const config = parseDynamicSeedConfig([
    'node',
    'seed-dynamic.ts',
    '--users=40',
  ]);
  const accounts = buildSeedAccounts(config);
  const accountKeys = accounts.map((account) => account.key);

  assert.equal(accounts.length, 40);
  assert.ok(
    accounts.every(
      (account) =>
        account.password ===
        DYNAMIC_SEED_PASSWORDS[
          account.role as keyof typeof DYNAMIC_SEED_PASSWORDS
        ],
    ),
  );
  assert.equal(
    DEMO_ACCOUNTS.find((account) => account.key === 'admin')?.password,
    DYNAMIC_SEED_PASSWORDS.admin,
  );
  assert.equal(
    DEMO_ACCOUNTS.find((account) => account.key === 'staff')?.password,
    DYNAMIC_SEED_PASSWORDS.staff,
  );
  assert.equal(
    DEMO_ACCOUNTS.find((account) => account.key === 'coach')?.password,
    DYNAMIC_SEED_PASSWORDS.coach,
  );
  assert.equal(
    DEMO_ACCOUNTS.find((account) => account.key === 'member-active')?.password,
    DYNAMIC_SEED_PASSWORD,
  );
  assert.equal(new Set(accountKeys).size, accountKeys.length);
  assert.deepEqual(
    accountKeys.slice(0, DEMO_ACCOUNTS.length),
    DEMO_ACCOUNTS.map((account) => account.key),
  );
  assert.deepEqual(
    new Set(
      buildBrodigyHistoryKeys(accountKeys, ['member-active', 'member-premium']),
    ),
    new Set(accountKeys),
  );
});

void test('default generated population keeps identity fields unique', () => {
  const accounts = buildSeedAccounts(
    parseDynamicSeedConfig(['node', 'seed-dynamic.ts']),
  );
  assert.equal(accounts.length, 180);

  const normalizedNames = accounts.map(
    (account) =>
      `${account.firstName.trim().toLocaleLowerCase()}|${account.lastName
        .trim()
        .toLocaleLowerCase()}`,
  );
  assert.equal(new Set(accounts.map((account) => account.email)).size, 180);
  assert.equal(new Set(normalizedNames).size, 180);
  assert.equal(new Set(accounts.map((account) => account.phone)).size, 180);
  assert.equal(new Set(accounts.map((account) => account.key)).size, 180);
});

void test('default and minimum seed targets preserve every fixed account', () => {
  assert.equal(parseDynamicSeedConfig(['node', 'seed-dynamic.ts']).users, 180);
  const minimum = buildSeedAccounts(
    parseDynamicSeedConfig(['node', 'seed-dynamic.ts', '--users=1']),
  );
  assert.equal(minimum.length, DEMO_ACCOUNTS.length);
  assert.deepEqual(
    minimum.map((account) => account.key),
    DEMO_ACCOUNTS.map((account) => account.key),
  );
});

void test('role targets use deterministic proportional scaling with fixed floors', () => {
  const expected = new Map([
    [40, { admin: 1, staff: 2, coach: 4, member: 33 }],
    [100, { admin: 2, staff: 5, coach: 10, member: 83 }],
    [150, { admin: 2, staff: 8, coach: 15, member: 125 }],
    [180, { admin: 3, staff: 9, coach: 18, member: 150 }],
    [200, { admin: 3, staff: 10, coach: 20, member: 167 }],
    [250, { admin: 4, staff: 13, coach: 25, member: 208 }],
  ]);
  for (const [total, targets] of expected) {
    assert.deepEqual(calculateRoleTargets(total), targets);
  }
});

void test('generated identities and scenarios are deterministic but seed-sensitive', () => {
  const config = (seed: number) =>
    parseDynamicSeedConfig([
      'node',
      'seed-dynamic.ts',
      '--users=150',
      `--seed=${seed}`,
    ]);
  const first = buildSeedAccounts(config(2026));
  const second = buildSeedAccounts(config(2026));
  const different = buildSeedAccounts(config(2027));
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.filter((account) => account.isDemo),
    different.filter((account) => account.isDemo),
  );
  assert.notDeepEqual(
    first.filter((account) => !account.isDemo),
    different.filter((account) => !account.isDemo),
  );
});

void test('fixed QA accounts carry explicit pinned scenarios', () => {
  const accounts = buildSeedAccounts(
    parseDynamicSeedConfig(['node', 'seed-dynamic.ts', '--users=180']),
  );
  const fixed = new Map(
    accounts
      .filter((account) => account.pinned)
      .map((account) => [account.key, account]),
  );
  for (const key of [
    'admin',
    'staff',
    'coach',
    'member-active',
    'member-premium',
    'member-checkout-abandoned',
    'member-frozen',
    'member-pending',
    'member-expired',
    'member-unverified',
    'member-archived',
    'member-suspended',
  ]) {
    assert.equal(fixed.get(key)?.pinned, true);
    assert.ok(fixed.get(key)?.fixedScenario);
  }
  assert.equal(
    fixed.get('member-premium')?.coachingProfile,
    'recurring_active',
  );
  assert.equal(
    fixed.get('member-checkout-abandoned')?.memberPersona,
    undefined,
  );
  assert.equal(fixed.get('member-archived')?.hasFutureBookings, false);
});

void test('scenario quotas are sane and invalid combinations are centralized', () => {
  const accounts = buildSeedAccounts(
    parseDynamicSeedConfig(['node', 'seed-dynamic.ts', '--users=180']),
  );
  const members = accounts.filter((account) => account.role === 'member');
  assert.equal(members.length, 150);
  for (const [dimension, weights] of Object.entries(
    SCENARIO_DIMENSION_WEIGHTS,
  )) {
    const total = Object.values(weights).reduce(
      (sum, weight) => sum + weight,
      0,
    );
    const population = [
      'coachLifecycle',
      'coachQuality',
      'coachWorkload',
    ].includes(dimension)
      ? accounts.filter((account) => account.role === 'coach')
      : members;
    for (const [value, weight] of Object.entries(weights)) {
      const actual = population.filter((account) => {
        const scenario = account.scenario as Record<string, string> | undefined;
        return (
          account[dimension as keyof typeof account] === value ||
          scenario?.[dimension] === value
        );
      }).length;
      const expected = population.length * (weight / total);
      assert.ok(
        Math.abs(actual - expected) <= Math.max(3, members.length * 0.04),
      );
    }
  }
  assert.deepEqual(validateSeedScenarioCompatibility(accounts), []);
  assert.deepEqual(
    validateScenarioCompatibility({
      ...members[0],
      emailVerified: false,
      hasCompletedHistory: true,
      memberPersona: 'unverified',
    }),
    ['unverified account has completed history'],
  );
  const archived = {
    ...members[0],
    memberPersona: 'archived' as const,
    bookingProfile: 'occasional' as const,
    hasFutureBookings: true,
  };
  assert.deepEqual(validateScenarioCompatibility(archived), [
    'archived account has future bookings',
  ]);
  assert.equal(normalizeSeedAccountScenario(archived).bookingProfile, 'none');
  const suspended = {
    ...members[0],
    memberPersona: 'suspended' as const,
    hasCurrentAccess: true,
    currentAccess: true,
  };
  assert.deepEqual(validateScenarioCompatibility(suspended), [
    'suspended account has current access',
  ]);
  assert.equal(normalizeSeedAccountScenario(suspended).hasCurrentAccess, false);
  const recurringWithoutAccess = {
    ...members[0],
    membershipLifecycle: 'expired' as const,
    coachingProfile: 'recurring_active' as const,
  };
  assert.ok(
    validateScenarioCompatibility(recurringWithoutAccess).some((detail) =>
      detail.includes('recurring coaching'),
    ),
  );
  assert.notEqual(
    normalizeSeedAccountScenario(recurringWithoutAccess).coachingProfile,
    'recurring_active',
  );
  const formerCoach = {
    ...accounts.find((account) => account.role === 'coach')!,
    coachLifecycle: 'former' as const,
    canAcceptFutureBookings: true,
    futureBookingAcceptance: true,
  };
  assert.deepEqual(validateScenarioCompatibility(formerCoach), [
    'former coach accepts future bookings',
  ]);
  assert.equal(
    normalizeSeedAccountScenario(formerCoach).futureBookingAcceptance,
    false,
  );
});

void test('cohorts scale from scenarios instead of fixed overflow', () => {
  const accounts = buildSeedAccounts(
    parseDynamicSeedConfig(['node', 'seed-dynamic.ts', '--users=250']),
  );
  const members = accounts.filter((account) => account.role === 'member');
  const cohorts = buildMemberCohortMap(
    members.map((account) => account.key),
    accounts,
  );
  assert.equal(Object.keys(cohorts).length, members.length);
  assert.ok(new Set(Object.values(cohorts)).size >= 5);
  assert.ok(
    Object.values(cohorts).filter((cohort) => cohort === 'regular').length <
      members.length,
  );
});

void test('venue booking volume follows booking behavior and lifecycle, not engagement indexes', () => {
  const config = parseDynamicSeedConfig([
    'node',
    'seed-dynamic.ts',
    '--users=180',
    '--seed=20260523',
  ]);
  const accounts = buildSeedAccounts(config);
  const ctx = {
    config,
    state: { accounts },
  } as never;
  const countFor = (key: string) => bookingVolumeCount(ctx, key, 'normal');
  assert.equal(
    bookingBehaviorFor(
      accounts.find((account) => account.key === 'member-checkout-abandoned'),
    ),
    'none',
  );
  assert.equal(countFor('member-checkout-abandoned'), 0);
  assert.ok(countFor('member-premium') > countFor('member-active'));
  assert.ok(countFor('member-active') > countFor('member-frozen'));
  const premium = accounts.find((account) => account.key === 'member-premium')!;
  const engagementOnlyChange = {
    ...premium,
    memberEngagement: 'zero_use' as const,
    engagement: 'zero_use' as const,
  };
  const independentCtx = {
    config,
    state: {
      accounts: accounts.map((account) =>
        account.key === premium.key ? engagementOnlyChange : account,
      ),
    },
  } as never;
  assert.equal(
    bookingVolumeCount(independentCtx, 'member-premium', 'normal'),
    countFor('member-premium'),
  );
});

void test('exercise history volume follows engagement tiers and lifecycle gates', () => {
  const config = parseDynamicSeedConfig([
    'node',
    'seed-dynamic.ts',
    '--users=180',
    '--seed=20260523',
  ]);
  const accounts = buildSeedAccounts(config);
  const ctx = {
    config,
    state: {
      accounts,
      memberCohorts: buildMemberCohortMap(
        accounts
          .filter((account) => account.role === 'member')
          .map((account) => account.key),
        accounts,
      ),
    },
  } as never;
  const volumeFor = (key: string) =>
    memberVolumeCount(ctx, key, 'workouts', 'normal');

  assert.ok(volumeFor('member-premium') > volumeFor('member-active'));
  assert.ok(volumeFor('member-active') > volumeFor('member-expired'));
  assert.ok(volumeFor('member-expired') > volumeFor('member-archived'));
  assert.equal(volumeFor('member-checkout-abandoned'), 0);
  assert.equal(volumeFor('member-pending'), 0);
  assert.equal(volumeFor('member-unverified'), 0);
  assert.equal(volumeFor('member-suspended'), 0);
});

void test('Brodigy question selection is curated and deterministic', () => {
  assert.ok(BRODIGY_QUESTION_POOL.length >= 15);
  assert.deepEqual(
    new Set(BRODIGY_QUESTION_POOL.map((question) => question.category)),
    new Set(['trivia', 'fitness', 'gym', 'sertfit']),
  );

  const first = new SeedRandom(2026);
  const second = new SeedRandom(2026);
  const firstSelection = Array.from(
    { length: 40 },
    () => pickBrodigyQuestion(first).prompt,
  );
  const secondSelection = Array.from(
    { length: 40 },
    () => pickBrodigyQuestion(second).prompt,
  );

  assert.deepEqual(firstSelection, secondSelection);
  assert.ok(new Set(firstSelection).size > 1);
});
