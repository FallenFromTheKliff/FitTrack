import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildModelCoverageSummary,
  invalidateDynamicSeedManifest,
  MODEL_COVERAGE,
  MODEL_DELEGATES,
  readCurrentDynamicSeedManifest,
} from './manifest';
import {
  assertNoNonFullProductPayments,
  assertNoProhibitedProductPaymentStates,
  assertNoTerminalCheckoutHoldProductReferences,
  assertCoachingCommerceLineage,
  assertMembershipCommerceLineage,
  hasKeyedIntervalOverlap,
  isLegalCheckoutHoldEvidence,
  nutritionCalendarDay,
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

void test('manifest coverage reports model and row totals by category', () => {
  const counts = Object.fromEntries(
    MODEL_DELEGATES.map((delegate, index) => [delegate, index + 1]),
  );
  const coverage = buildModelCoverageSummary(counts);
  const categoryModelCount = [
    coverage.seeded,
    coverage.derived,
    coverage.intentionallyEmpty,
    coverage.externalOnly,
  ].reduce((total, category) => total + category.modelCount, 0);
  const categoryRowCount = [
    coverage.seeded,
    coverage.derived,
    coverage.intentionallyEmpty,
    coverage.externalOnly,
  ].reduce((total, category) => total + category.rowCount, 0);

  assert.equal(categoryModelCount, MODEL_DELEGATES.length);
  assert.equal(coverage.totalModelCount, MODEL_DELEGATES.length);
  assert.equal(categoryRowCount, coverage.totalRowCount);
  assert.equal(
    coverage.totalRowCount,
    MODEL_DELEGATES.reduce((total, delegate) => total + counts[delegate], 0),
  );
  assert.ok(coverage.derived.modelCount > 0);
  assert.deepEqual(coverage.intentionallyEmpty.models, []);
  assert.deepEqual(coverage.externalOnly.models, []);
});

void test('nutrition date checks honor the persisted calendar-day precision', () => {
  const persistedLogDate = new Date('2026-03-13T00:00:00.000Z');
  const targetCalculatedAt = new Date('2026-03-13T08:00:00.000Z');
  const activityStart = new Date('2026-03-13T20:00:00.000Z');
  const activityEnd = new Date('2026-03-14T10:00:00.000Z');

  assert.ok(
    nutritionCalendarDay(targetCalculatedAt) <=
      nutritionCalendarDay(persistedLogDate),
  );
  assert.ok(
    nutritionCalendarDay(persistedLogDate) >=
      nutritionCalendarDay(activityStart),
  );
  assert.ok(
    nutritionCalendarDay(persistedLogDate) <= nutritionCalendarDay(activityEnd),
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

void test('consumed checkout holds retain their TTL and must be consumed strictly before expiry', () => {
  const anchor = new Date('2026-09-13T09:00:00.000Z');
  const evidence = {
    status: 'consumed' as const,
    createdAt: new Date('2026-09-13T08:30:00.000Z'),
    consumedAt: anchor,
    expiresAt: new Date('2026-09-13T09:15:00.000Z'),
    failureReason: null,
    productReferences: ['subscription-fixture', null],
  };
  assert.equal(isLegalCheckoutHoldEvidence(evidence, anchor), true);
  const laterAnchor = new Date('2026-09-13T10:00:00.000Z');
  assert.equal(isLegalCheckoutHoldEvidence(evidence, laterAnchor), true);
  for (const consumedAt of [
    new Date('2026-09-13T09:15:00.000Z'),
    new Date('2026-09-13T09:16:00.000Z'),
    new Date('2026-09-13T08:29:00.000Z'),
    null,
  ]) {
    assert.equal(isLegalCheckoutHoldEvidence({ ...evidence, consumedAt }, laterAnchor), false);
  }
  assert.equal(isLegalCheckoutHoldEvidence({ ...evidence,
    consumedAt: new Date('2026-09-13T09:01:00.000Z'),
  }, anchor), false);
  assert.equal(isLegalCheckoutHoldEvidence({ ...evidence, productReferences: [null] }, anchor), false);
  assert.equal(isLegalCheckoutHoldEvidence({ ...evidence, failureReason: 'Rejected' }, anchor), false);
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
    allocator.tryAllocateMany(['amenity:two', 'member:one'], start, end),
    false,
  );
  assert.equal(allocator.tryAllocate('amenity:two', start, end), true);
});

void test('membership interval integrity permits adjacent 30-day cycles and rejects overlaps', () => {
  const anchor = new Date('2026-08-21T09:00:00.000Z');
  const firstEnd = daysFrom(anchor, -14);
  const currentEnd = daysFrom(anchor, 16);
  assert.equal(
    hasKeyedIntervalOverlap([
      { key: 'member:premium', start: daysFrom(anchor, -44), end: firstEnd },
      { key: 'member:premium', start: firstEnd, end: currentEnd },
    ]),
    false,
  );
  assert.equal(
    hasKeyedIntervalOverlap([
      { key: 'member:premium', start: daysFrom(anchor, -44), end: firstEnd },
      {
        key: 'member:premium',
        start: daysFrom(anchor, -15),
        end: currentEnd,
      },
    ]),
    true,
  );
});

void test('membership commerce lineage requires consumed holds and exact plan linkage', () => {
  const anchor = new Date('2026-08-21T09:00:00.000Z');
  const startsAt = new Date('2026-08-01T09:00:00.000Z');
  const holdCreatedAt = new Date('2026-08-01T08:30:00.000Z');
  const paymentCreatedAt = new Date('2026-08-01T08:50:00.000Z');
  const paymentId = 'payment-subscription';
  const holdId = 'hold-subscription';
  const valid = {
    anchor,
    cards: [],
    holds: [
      {
        amount: 1999,
        appointment_id: null,
        booking_id: null,
        consumed_at: startsAt,
        created_at: holdCreatedAt,
        currency: 'PHP',
        expires_at: new Date('2026-08-01T09:15:00.000Z'),
        failure_reason: null,
        id: holdId,
        kind: 'subscription',
        membership_card_id: null,
        membership_plan_id: 'plan-premium',
        payment_id: paymentId,
        recurring_plan_id: null,
        released_at: null,
        status: 'consumed',
        subscription_id: 'subscription-1',
        user_id: 'user-1',
      },
    ],
    payments: [
      {
        amount: 1999,
        created_at: paymentCreatedAt,
        currency: 'PHP',
        gateway_event_id: 'event-subscription',
        gateway_metadata: { hold_id: holdId },
        id: paymentId,
        payable_id: holdId,
        payable_type: 'commerce_checkout_hold',
        payment_stage: 'full',
        provider: 'paymongo',
        provider_ref: 'checkout-subscription',
        status: 'completed',
        user_id: 'user-1',
        verified_at: startsAt,
      },
    ],
    subscriptions: [
      {
        expires_at: new Date('2026-08-31T09:00:00.000Z'),
        id: 'subscription-1',
        payment_id: paymentId,
        plan_id: 'plan-premium',
        plan: { price: 1999 },
        starts_at: startsAt,
        user_id: 'user-1',
      },
    ],
  };
  assert.doesNotThrow(() => assertMembershipCommerceLineage(valid));
  const wrongPlan = {
    ...valid,
    holds: valid.holds.map((hold) => ({
      ...hold,
      membership_plan_id: 'plan-starter',
    })),
  };
  assert.throws(
    () => assertMembershipCommerceLineage(wrongPlan),
    /membership commerce lineage failed/,
  );
});

void test('coaching commerce lineage requires one-time holds and recurring cycle payables', () => {
  const anchor = new Date('2026-08-21T09:00:00.000Z');
  const oneTimeAppointment = {
    id: 'appointment-one-time',
    recurring_plan_id: null,
    scheduled_at: new Date('2026-08-22T02:00:00.000Z'),
    status: 'confirmed',
    total_amount: 450,
    user_id: 'member-one',
  };
  const oneTimeHold = {
    amount: 450,
    appointment_id: oneTimeAppointment.id,
    consumed_at: new Date('2026-08-20T09:00:00.000Z'),
    created_at: new Date('2026-08-20T08:30:00.000Z'),
    expires_at: new Date('2026-08-20T09:15:00.000Z'),
    failure_reason: null,
    id: 'hold-one-time',
    kind: 'one_time',
    payment_id: 'payment-one-time',
    recurring_plan_id: null,
    released_at: null,
    status: 'consumed',
    user_id: 'member-one',
  };
  const monthlyHold = {
    amount: 1800,
    appointment_id: null,
    consumed_at: new Date('2026-08-01T09:00:00.000Z'),
    created_at: new Date('2026-08-01T08:30:00.000Z'),
    expires_at: new Date('2026-08-01T09:15:00.000Z'),
    failure_reason: null,
    id: 'hold-monthly',
    kind: 'monthly',
    payment_id: 'payment-monthly',
    recurring_plan_id: 'plan-recurring',
    released_at: null,
    status: 'consumed',
    user_id: 'member-recurring',
  };
  const failedHold = {
    amount: 1800,
    appointment_id: null,
    consumed_at: null,
    created_at: new Date('2026-08-10T08:30:00.000Z'),
    expires_at: new Date('2026-08-10T09:15:00.000Z'),
    failure_reason: 'PayMongo authorization failed.',
    id: 'hold-failed',
    kind: 'monthly',
    payment_id: 'payment-failed',
    recurring_plan_id: null,
    released_at: new Date('2026-08-10T09:15:00.000Z'),
    status: 'failed',
    user_id: 'member-failed',
  };
  const valid = {
    anchor,
    appointments: [oneTimeAppointment],
    billingCycles: [
      {
        amount: 1800,
        cycle_end_date: new Date('2026-08-30T00:00:00.000Z'),
        cycle_start_date: new Date('2026-08-01T00:00:00.000Z'),
        id: 'cycle-first',
        paid_at: new Date('2026-08-01T09:00:00.000Z'),
        payment_id: 'payment-monthly',
        recurring_plan_id: 'plan-recurring',
        status: 'paid',
      },
      {
        amount: 1800,
        cycle_end_date: new Date('2026-09-29T00:00:00.000Z'),
        cycle_start_date: new Date('2026-08-31T00:00:00.000Z'),
        id: 'cycle-second',
        paid_at: new Date('2026-08-31T09:00:00.000Z'),
        payment_id: 'payment-cycle-second',
        recurring_plan_id: 'plan-recurring',
        status: 'paid',
      },
    ],
    holds: [oneTimeHold, monthlyHold, failedHold],
    payments: [
      {
        amount: 450,
        created_at: new Date('2026-08-20T08:50:00.000Z'),
        gateway_event_id: 'event-one-time',
        gateway_metadata: { hold_id: oneTimeHold.id },
        id: 'payment-one-time',
        payable_id: oneTimeHold.id,
        payable_type: 'commerce_checkout_hold',
        payment_stage: 'full',
        provider: 'paymongo',
        provider_ref: 'paymongo-one-time',
        status: 'completed',
        user_id: 'member-one',
        verified_at: oneTimeHold.consumed_at,
      },
      {
        amount: 1800,
        created_at: new Date('2026-08-01T08:50:00.000Z'),
        gateway_event_id: 'event-monthly',
        gateway_metadata: { hold_id: monthlyHold.id },
        id: 'payment-monthly',
        payable_id: monthlyHold.id,
        payable_type: 'commerce_checkout_hold',
        payment_stage: 'full',
        provider: 'paymongo',
        provider_ref: 'paymongo-monthly',
        status: 'completed',
        user_id: 'member-recurring',
        verified_at: monthlyHold.consumed_at,
      },
      {
        amount: 1800,
        created_at: new Date('2026-08-31T08:50:00.000Z'),
        gateway_event_id: 'event-cycle-second',
        gateway_metadata: { cycle_id: 'cycle-second' },
        id: 'payment-cycle-second',
        payable_id: 'cycle-second',
        payable_type: 'recurring_coaching',
        payment_stage: 'full',
        provider: 'paymongo',
        provider_ref: 'paymongo-cycle-second',
        status: 'completed',
        user_id: 'member-recurring',
        verified_at: new Date('2026-08-31T09:00:00.000Z'),
      },
      {
        amount: 1800,
        created_at: new Date('2026-08-10T08:50:00.000Z'),
        gateway_event_id: 'event-failed',
        gateway_metadata: { hold_id: failedHold.id },
        id: 'payment-failed',
        payable_id: failedHold.id,
        payable_type: 'commerce_checkout_hold',
        payment_stage: 'full',
        provider: 'paymongo',
        provider_ref: 'paymongo-failed',
        status: 'failed',
        user_id: 'member-failed',
        verified_at: null,
      },
    ],
    plans: [
      {
        id: 'plan-recurring',
        member_id: 'member-recurring',
        quoted_amount: 1800,
      },
    ],
  };
  assert.doesNotThrow(() => assertCoachingCommerceLineage(valid));
  assert.throws(
    () =>
      assertCoachingCommerceLineage({
        ...valid,
        appointments: [{ ...oneTimeAppointment, id: 'appointment-bad' }],
      }),
    /coaching commerce lineage failed/,
  );
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
