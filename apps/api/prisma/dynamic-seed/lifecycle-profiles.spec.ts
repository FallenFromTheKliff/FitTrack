import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UserRole, UserStatus } from '@prisma/client';
import { buildSeedAccounts } from './accounts';
import { parseDynamicSeedConfig } from './config';
import {
  physicalSnapshotAtWeight,
  progressionWeightAt,
  deriveSeedAccountContext,
  shouldSeedMemberQr,
  shouldSeedRefreshToken,
  validateSeedAccountContext,
} from './lifecycles-profiles';

function seedConfig(seed = 20260523) {
  return parseDynamicSeedConfig([
    'node',
    'seed-dynamic.ts',
    '--users=180',
    `--seed=${seed}`,
    '--anchor-date=2026-08-21T09:00:00.000Z',
    '--from=2025-08-21T09:00:00.000Z',
    '--to=2026-08-21T09:00:00.000Z',
  ]);
}

void test('all seeded roles receive deterministic lifecycle and physical context', () => {
  const config = seedConfig();
  const first = buildSeedAccounts(config);
  const second = buildSeedAccounts(config);

  assert.deepEqual(first, second);
  assert.deepEqual(
    new Set(first.map((account) => account.role)),
    new Set(['admin', 'staff', 'coach', 'member']),
  );
  for (const account of first) {
    assert.deepEqual(validateSeedAccountContext(account), []);
    const baseline = account.physicalBaseline!;
    const bmi =
      (baseline.weightKg * 10_000) / (baseline.heightCm * baseline.heightCm);
    assert.ok(baseline.heightCm >= 150 && baseline.heightCm <= 190);
    assert.ok(bmi >= 18.5 && bmi <= 30);
    assert.ok(Math.abs(bmi - baseline.bmi) <= 0.2);
    assert.ok(account.dateOfBirth);
    assert.ok(account.dateOfBirth.getUTCFullYear() <= 2005);
  }
});

void test('fixed QA lifecycle states keep their intended history and access windows', () => {
  const accounts = buildSeedAccounts(seedConfig());
  const byKey = new Map(accounts.map((account) => [account.key, account]));
  const noActivity = [
    'member-checkout-abandoned',
    'member-pending',
    'member-unverified',
    'member-suspended',
  ];
  for (const key of noActivity) {
    const lifecycle = byKey.get(key)!.lifecycle!;
    assert.equal(lifecycle.activityStart, null, key);
    assert.equal(lifecycle.activityEnd, null, key);
    assert.equal(lifecycle.accessStart, null, key);
    assert.equal(lifecycle.accessEnd, null, key);
  }
  for (const key of ['member-frozen', 'member-expired', 'member-archived']) {
    const lifecycle = byKey.get(key)!.lifecycle!;
    assert.ok(lifecycle.historicalOnly, key);
    assert.ok(lifecycle.activityStart);
    assert.ok(lifecycle.activityEnd);
    assert.ok(lifecycle.activityEnd < seedConfig().anchorDate);
  }
  for (const key of ['member-active', 'member-premium']) {
    const lifecycle = byKey.get(key)!.lifecycle!;
    assert.equal(lifecycle.historicalOnly, false, key);
    assert.ok(lifecycle.activityStart);
    assert.ok(lifecycle.accessEnd! > seedConfig().anchorDate);
  }
});

void test('QR eligibility follows account truth, including checkout-abandoned without a card', () => {
  const accounts = buildSeedAccounts(seedConfig());
  const byKey = new Map(accounts.map((account) => [account.key, account]));
  const qr = (key: string, status: UserStatus = UserStatus.active) => {
    const account = byKey.get(key)!;
    return shouldSeedMemberQr(
      account,
      status,
      account.lifecycle!.verifiedAt,
      account.lifecycle!.deletedAt,
    );
  };

  assert.equal(qr('member-checkout-abandoned'), true);
  assert.equal(qr('member-active'), true);
  assert.equal(qr('member-premium'), true);
  assert.equal(qr('member-expired'), true);
  assert.equal(qr('member-frozen'), true);
  assert.equal(qr('member-pending'), false);
  assert.equal(qr('member-unverified'), false);
  assert.equal(qr('member-archived'), false);
  assert.equal(qr('member-suspended', UserStatus.suspended), false);
  assert.equal(shouldSeedRefreshToken(byKey.get('member-active')!), true);
  assert.equal(shouldSeedRefreshToken(byKey.get('member-premium')!), true);
  assert.equal(shouldSeedRefreshToken(byKey.get('member-frozen')!), false);
  assert.equal(shouldSeedRefreshToken(byKey.get('member-expired')!), false);
  assert.equal(
    shouldSeedRefreshToken(byKey.get('member-checkout-abandoned')!),
    true,
  );
  assert.equal(shouldSeedRefreshToken(byKey.get('member-pending')!), false);
  assert.equal(shouldSeedRefreshToken(byKey.get('member-unverified')!), false);
  assert.equal(shouldSeedRefreshToken(byKey.get('member-suspended')!), false);
});

void test('progress snapshots are coherent with the profile weight and goal trend', () => {
  const accounts = buildSeedAccounts(seedConfig());
  for (const account of accounts.filter(
    (candidate) => candidate.lifecycle?.activityStart !== null,
  )) {
    const baseline = account.physicalBaseline!;
    const latest = physicalSnapshotAtWeight(baseline, baseline.weightKg);
    assert.equal(latest.weightKg, account.weightKg);
    assert.equal(latest.heightCm, account.heightCm);
    if (baseline.trend === 'cutting') {
      assert.ok(baseline.baselineWeightKg >= baseline.weightKg);
    } else if (baseline.trend === 'bulking') {
      assert.ok(baseline.baselineWeightKg <= baseline.weightKg);
    } else {
      assert.ok(Math.abs(baseline.baselineWeightKg - baseline.weightKg) <= 1);
    }
  }
  assert.equal(
    buildSeedAccounts(seedConfig(7)).filter((account) => !account.isDemo)
      .length,
    168,
  );
});

void test('recent active and trial members keep ordered activity inside their access window', () => {
  const config = seedConfig();
  config.anchorDate = new Date('2026-09-14T09:00:00.000Z');
  config.historyEndDate = new Date('2026-09-13T09:00:00.000Z');
  config.historyStartDate = new Date('2026-09-12T09:00:00.000Z');
  for (const memberPersona of ['active', 'trial'] as const) {
    const account = deriveSeedAccountContext({
      key: `recent-${memberPersona}`,
      label: 'Recent Fixture',
      firstName: 'Recent',
      lastName: 'Fixture',
      email: `recent-${memberPersona}@fittrack.com`,
      password: 'fixture-only',
      phone: '+639180000001',
      isDemo: false,
      role: UserRole.member,
      status: UserStatus.active,
      emailVerified: true,
      hasCurrentAccess: true,
      memberPersona,
      memberEngagement: 'zero_use',
      membershipLifecycle: memberPersona === 'trial' ? 'trial_or_new' : 'active',
    }, config);
    const lifecycle = account.lifecycle!;
    assert.equal(lifecycle.activityStart!.getTime(), config.historyEndDate.getTime());
    assert.equal(lifecycle.activityEnd!.getTime(), lifecycle.activityStart!.getTime());
    assert.ok(lifecycle.activityEnd! < config.anchorDate);
    assert.ok(lifecycle.activityStart! >= lifecycle.accessStart!);
    assert.ok(lifecycle.activityEnd! <= lifecycle.accessEnd!);
    assert.deepEqual(validateSeedAccountContext(account), []);
  }
});

void test('light preserved profiles keep bounded progress without a synthetic weight floor', () => {
  const config = seedConfig();
  const template = buildSeedAccounts(config).find((account) => account.key === 'member-active')!;
  for (const [heightCm, weightKg, fitnessGoal] of [
    [150, 42, 'maintenance'],
    [162, 49, 'bulking'],
    [160, 47.4, 'maintenance'],
  ] as const) {
    const account = deriveSeedAccountContext({
      ...template,
      isDemo: false,
      isPreservedTester: true,
      heightCm,
      weightKg,
      fitnessGoal,
    }, config);
    const baseline = account.physicalBaseline!;
    assert.equal(baseline.weightKg, weightKg);
    const weights = Array.from({ length: 12 }, (_, index) =>
      progressionWeightAt(baseline, account, index, 12),
    );
    for (const weight of weights) {
      const snapshot = physicalSnapshotAtWeight(baseline, weight);
      const bmi = weight * 10_000 / heightCm ** 2;
      assert.ok(bmi >= 18.5 && bmi <= 35);
      assert.equal(snapshot.weightKg, weight);
    }
    assert.equal(weights.at(-1), weightKg);
    if (fitnessGoal === 'maintenance') {
      assert.ok(Math.abs(weights[0] - weightKg) <= 2.5);
    }
  }
});
