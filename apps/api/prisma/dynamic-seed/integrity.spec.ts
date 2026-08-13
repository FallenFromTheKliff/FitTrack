import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  invalidateDynamicSeedManifest,
  MODEL_COVERAGE,
  MODEL_DELEGATES,
  readCurrentDynamicSeedManifest,
} from './manifest';
import {
  assertNoNonFullProductPayments,
  assertNoProhibitedProductPaymentStates,
  assertNoTerminalCheckoutHoldProductReferences,
  isLegalCheckoutHoldEvidence,
  SEED_SCENARIO_MATRIX,
} from './integrity';
import { dateInsideRange, daysFrom, yearsAgo } from './time';
import { KeyedIntervalAllocator } from './volumes';

void test('integrity coverage classifies every manifest delegate', () => {
  assert.deepEqual(
    Object.keys(MODEL_COVERAGE).sort(),
    [...MODEL_DELEGATES].sort(),
  );
  assert.ok(
    Object.values(MODEL_COVERAGE).every((status) =>
      ['seeded', 'intentionally-empty', 'derived', 'external-only'].includes(
        status,
      ),
    ),
  );
});

void test('scenario matrix includes every required account and schedule state', () => {
  for (const key of [
    'active',
    'premium',
    'frozen',
    'pending',
    'expired',
    'unverified',
    'archived',
    'suspended',
    'has_upcoming',
    'no_upcoming',
    'completed_history',
    'cancelled_history',
    'paid_history',
    'pending_payment',
    'monthly_eligible',
    'ridge_monthly_future',
    'ridge_feedback',
    'ridge_one_time',
    'ridge_one_time_assignment',
    'checkout_abandoned',
    'no_held_checkout',
    'zero_pending_products',
  ]) {
    assert.ok(SEED_SCENARIO_MATRIX[key]);
  }
});

void test('seed date helpers remain canonical UTC calculations', () => {
  const anchor = new Date('2026-08-12T09:00:00.000Z');
  assert.equal(
    daysFrom(anchor, 1, 15).toISOString(),
    '2026-08-13T15:00:00.000Z',
  );
  assert.equal(yearsAgo(anchor, 2).toISOString(), '2024-08-12T00:00:00.000Z');
  assert.equal(
    dateInsideRange(anchor, daysFrom(anchor, 10), 0.5, 12).toISOString(),
    '2026-08-17T12:00:00.000Z',
  );
});

void test('held, expired, and failed no-product holds explain membership attempts', () => {
  const anchor = new Date('2026-08-12T09:00:00.000Z');
  const productReferences = [null, null, null, null, null, null];

  assert.equal(
    isLegalCheckoutHoldEvidence(
      {
        status: 'held',
        expiresAt: daysFrom(anchor, 1),
        failureReason: null,
        productReferences,
      },
      anchor,
    ),
    true,
  );
  assert.equal(
    isLegalCheckoutHoldEvidence(
      {
        status: 'held',
        expiresAt: daysFrom(anchor, 1),
        failureReason: null,
        productReferences: ['product-id', null, null, null, null, null],
      },
      anchor,
    ),
    false,
  );
  assert.equal(
    isLegalCheckoutHoldEvidence(
      {
        status: 'expired',
        expiresAt: daysFrom(anchor, -1),
        failureReason: 'Checkout expired before product confirmation.',
        productReferences,
      },
      anchor,
    ),
    true,
  );
  assert.equal(
    isLegalCheckoutHoldEvidence(
      {
        status: 'failed',
        expiresAt: daysFrom(anchor, -1),
        failureReason: null,
        productReferences,
      },
      anchor,
    ),
    false,
  );
  assert.equal(
    isLegalCheckoutHoldEvidence(
      {
        status: 'failed',
        expiresAt: daysFrom(anchor, -1),
        failureReason: 'PayMongo authorization failed; no product was created.',
        productReferences,
      },
      anchor,
    ),
    true,
  );
  assert.equal(
    isLegalCheckoutHoldEvidence(
      {
        status: 'failed',
        expiresAt: daysFrom(anchor, -1),
        failureReason: 'PayMongo authorization failed.',
        productReferences: ['product-id', null, null, null, null, null],
      },
      anchor,
    ),
    false,
  );
  assert.equal(
    isLegalCheckoutHoldEvidence(
      {
        status: 'expired',
        expiresAt: daysFrom(anchor, -1),
        failureReason: '   ',
        productReferences,
      },
      anchor,
    ),
    false,
  );
});

void test('full-payment product invariants reject prohibited records and terminal hold references', () => {
  assert.doesNotThrow(() =>
    assertNoProhibitedProductPaymentStates([
      { id: 'appointment:confirmed', status: 'confirmed' },
      { id: 'payment:full', paymentStage: 'full', status: 'completed' },
    ]),
  );
  assert.throws(
    () =>
      assertNoProhibitedProductPaymentStates([
        { id: 'appointment:pending', status: 'pending_payment' },
      ]),
    /prohibited product payment state/,
  );
  assert.throws(
    () =>
      assertNoNonFullProductPayments([
        { id: 'payment:partial', paymentStage: 'balance', status: 'completed' },
      ]),
    /non-full product payment/,
  );
  assert.throws(
    () =>
      assertNoTerminalCheckoutHoldProductReferences([
        {
          appointment_id: 'appointment:legacy',
          booking_id: null,
          expires_at: new Date('2026-08-11T00:00:00.000Z'),
          failure_reason: 'expired',
          id: 'hold:legacy',
          membership_card_id: null,
          recurring_plan_id: null,
          status: 'expired',
          subscription_id: null,
          membership_plan_id: null,
        },
      ] as never),
    /terminal checkout hold/,
  );
});

void test('keyed interval allocator atomically reserves amenity and member keys', () => {
  const allocator = new KeyedIntervalAllocator();
  const start = new Date('2026-08-12T10:00:00.000Z');
  const end = new Date('2026-08-12T12:00:00.000Z');

  assert.equal(
    allocator.tryAllocateMany(['amenity:one', 'member:one'], start, end),
    true,
  );
  assert.equal(
    allocator.tryAllocateMany(
      ['amenity:two', 'member:one'],
      start,
      end,
    ),
    false,
  );
  assert.equal(allocator.tryAllocate('amenity:two', start, end), true);
});

void test('manifest invalidation removes stale pass while failed report state stays current', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fittrack-dynamic-seed-'));
  const manifestPath = join(directory, 'manifest.json');
  try {
    await writeFile(
      manifestPath,
      JSON.stringify({ integrity: { status: 'passed' } }),
      'utf8',
    );
    await invalidateDynamicSeedManifest(manifestPath);
    await assert.rejects(
      () => readCurrentDynamicSeedManifest(manifestPath),
      /no successful current manifest/,
    );

    await writeFile(
      manifestPath,
      JSON.stringify({
        config: {},
        counts: { user: 100 },
        credentials: [],
        integrity: {
          actuals: {},
          caps: {},
          checks: 2,
          cohorts: {},
          scenarioMatrix: {},
          status: 'failed',
          summary: { 'checkout-hold': 1 },
          targets: {},
          violations: [
            {
              category: 'checkout-hold',
              detail: 'current failed audit detail',
            },
          ],
        },
        modelCoverage: {},
        manifestPath,
        notableIds: {},
        runAt: '2026-08-12T09:00:00.000Z',
      }),
      'utf8',
    );
    const current = await readCurrentDynamicSeedManifest(manifestPath);
    assert.equal(current.integrity.status, 'failed');
    assert.equal(
      current.integrity.violations[0]?.detail,
      'current failed audit detail',
    );
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
