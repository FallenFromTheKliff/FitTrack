import {
  CommerceCheckoutHoldKind,
  CommerceCheckoutHoldStatus,
  MembershipCardSource,
  MembershipCardStatus,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  PayableType,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { seedExternalId, seedId } from '../ids';
import { daysFrom } from '../time';
import type { DynamicSeedContext, MemberPersona, SeedAccount } from '../types';
import { memberAccessWindow } from '../volumes';

const DAY_MS = 24 * 60 * 60 * 1_000;
const MEMBERSHIP_CARD_PRICE = '400';
const CHECKOUT_HOLD_TTL_MINUTES = 15;

/**
 * The dynamic seed uses the production membership catalog shape: each paid
 * enrollment is one 30-day subscription cycle, not a multi-month product row.
 */
export const PLAN_SEEDS = [
  {
    key: 'starter-monthly',
    description:
      'General gym access with QR attendance, member card, and standard amenities.',
    durationDays: 30,
    features: {
      bookingPriority: 'standard',
      coachingCredits: 0,
      perks: ['gym_access', 'attendance_tracking'],
    },
    includesCoaching: false,
    name: 'Starter Monthly',
    price: '799',
    sortOrder: 1,
  },
  {
    key: 'performance-monthly',
    description:
      'Higher usage plan with priority amenities and progression-friendly analytics.',
    durationDays: 30,
    features: {
      bookingPriority: 'priority',
      coachingCredits: 1,
      perks: ['gym_access', 'priority_slots', 'progress_analytics'],
    },
    includesCoaching: false,
    name: 'Performance Monthly',
    price: '1199',
    sortOrder: 2,
  },
  {
    key: 'premium-coaching',
    description:
      'Premium membership with recurring coaching support and richer AI/nutrition surfaces.',
    durationDays: 30,
    features: {
      bookingPriority: 'premium',
      coachingCredits: 4,
      perks: ['gym_access', 'priority_slots', 'coach_addon', 'premium_ai'],
    },
    includesCoaching: true,
    name: 'Premium Coaching',
    price: '1999',
    sortOrder: 3,
  },
] as const;

type CycleSpec = {
  start: Date;
  end: Date;
  status: SubscriptionStatus;
};

type HoldModel = {
  upsert(input: {
    where: { id: string };
    update: Record<string, unknown>;
    create: Record<string, unknown>;
  }): Promise<unknown>;
  update(input: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<unknown>;
};

type PaymentModel = {
  upsert(input: {
    where: { id: string };
    update: Record<string, unknown>;
    create: Prisma.PaymentCreateManyInput;
  }): Promise<unknown>;
};

type CardProductSpec = {
  account: SeedAccount;
  activatedAt: Date;
  adminId: string;
  cardId: string;
  holdId: string;
  paymentId: string;
  purchasedAt: Date;
  revokedAt: Date | null;
  status: MembershipCardStatus;
  userId: string;
};

type SubscriptionProductSpec = {
  account: SeedAccount;
  cycle: CycleSpec;
  holdId: string;
  paymentId: string;
  planId: string;
  subscriptionId: string;
  userId: string;
};

type SuccessfulHoldUpdate = {
  consumedAt: Date;
  holdId: string;
  productId: string;
  productReference: 'membership_card_id' | 'subscription_id';
};

type MembershipSeedRows = {
  cardProducts: CardProductSpec[];
  failedHoldRows: Prisma.CommerceCheckoutHoldCreateManyInput[];
  paymentRows: Prisma.PaymentCreateManyInput[];
  subscriptionProducts: SubscriptionProductSpec[];
  successfulHoldRows: Prisma.CommerceCheckoutHoldCreateManyInput[];
  successfulHoldUpdates: SuccessfulHoldUpdate[];
};

function personaFor(account: SeedAccount): MemberPersona | undefined {
  return account.memberPersona;
}

function planKeyForPersona(persona: MemberPersona, index: number) {
  if (persona === 'premium') return 'premium-coaching';
  if (persona === 'trial') return 'starter-monthly';
  return index % 3 === 0 ? 'performance-monthly' : 'starter-monthly';
}

function subscriptionStatusForPersona(persona: MemberPersona) {
  switch (persona) {
    case 'pending':
    case 'unverified':
      return null;
    case 'expired':
    case 'archived':
      return SubscriptionStatus.expired;
    case 'frozen':
    case 'suspended':
      return SubscriptionStatus.suspended;
    default:
      return SubscriptionStatus.active;
  }
}

function cardStatusForPersona(persona: MemberPersona) {
  switch (persona) {
    case 'pending':
    case 'unverified':
      return null;
    case 'archived':
    case 'expired':
    case 'frozen':
    case 'suspended':
      return MembershipCardStatus.revoked;
    default:
      return MembershipCardStatus.active;
  }
}

function addDaysExact(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function addMinutes(value: Date, minutes: number) {
  return new Date(value.getTime() + minutes * 60 * 1_000);
}

function maxDate(left: Date, right: Date) {
  return left.getTime() >= right.getTime() ? new Date(left) : new Date(right);
}

function minDate(left: Date, right: Date) {
  return left.getTime() <= right.getTime() ? new Date(left) : new Date(right);
}

function dateAtOrAfter(value: Date, lowerBound: Date) {
  return value.getTime() >= lowerBound.getTime()
    ? new Date(value)
    : new Date(lowerBound);
}

function cycleCountBetween(start: Date, end: Date, durationDays: number) {
  return Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / DAY_MS / durationDays),
  );
}

function subscriptionWarningDates(cycle: CycleSpec) {
  if (cycle.status !== SubscriptionStatus.expired) {
    return {
      warned_1d_at: null,
      warned_3d_at: null,
      warned_7d_at: null,
    };
  }
  return {
    warned_1d_at: addDaysExact(cycle.end, -1),
    warned_3d_at: addDaysExact(cycle.end, -3),
    warned_7d_at: addDaysExact(cycle.end, -7),
  };
}

function cycleSpecsFor(
  account: SeedAccount,
  ctx: DynamicSeedContext,
  persona: MemberPersona,
  durationDays: number,
): CycleSpec[] {
  const window = memberAccessWindow(ctx, account.key);
  const lifecycle = account.lifecycle;
  const anchor = ctx.config.anchorDate;
  const registrationFloor = lifecycle
    ? addDaysExact(lifecycle.registeredAt, 1 / 24)
    : daysFrom(anchor, -365, 9);
  const status = subscriptionStatusForPersona(persona);
  if (!status) return [];

  if (persona === 'suspended') {
    const end = minDate(
      daysFrom(anchor, -1, 13),
      lifecycle?.deletedAt ?? daysFrom(anchor, -1, 13),
    );
    const start = dateAtOrAfter(
      addDaysExact(end, -durationDays),
      registrationFloor,
    );
    return [{ start, end: addDaysExact(start, durationDays), status }];
  }

  if (persona === 'expired' || persona === 'archived' || persona === 'frozen') {
    const accessStart =
      window.startsAt ??
      dateAtOrAfter(daysFrom(anchor, -durationDays - 1, 9), registrationFloor);
    const legalAccessStart = maxDate(accessStart, registrationFloor);
    const terminalEnd = minDate(
      window.expiresAt ?? daysFrom(anchor, -1, 18),
      daysFrom(anchor, -1, 18),
    );
    const availableCycles = cycleCountBetween(
      legalAccessStart,
      terminalEnd,
      durationDays,
    );
    const count = Math.max(1, Math.min(12, availableCycles));
    const firstStart = dateAtOrAfter(
      addDaysExact(terminalEnd, -count * durationDays),
      legalAccessStart,
    );
    const cycles: CycleSpec[] = [];
    for (let index = 0; index < count; index += 1) {
      const start = addDaysExact(firstStart, index * durationDays);
      const end = addDaysExact(start, durationDays);
      cycles.push({
        start,
        end,
        status:
          persona === 'frozen' && index === count - 1
            ? SubscriptionStatus.suspended
            : SubscriptionStatus.expired,
      });
    }
    return cycles;
  }

  const accessStart =
    window.startsAt ??
    dateAtOrAfter(daysFrom(anchor, -durationDays, 9), registrationFloor);
  const legalAccessStart = maxDate(accessStart, registrationFloor);
  const currentStart = maxDate(legalAccessStart, daysFrom(anchor, -14, 9));
  const historyAvailable = cycleCountBetween(
    legalAccessStart,
    currentStart,
    durationDays,
  );
  const requestedHistory =
    persona === 'premium'
      ? Math.min(
          12,
          historyAvailable < 3
            ? historyAvailable
            : Math.max(3, historyAvailable),
        )
      : persona === 'trial'
        ? 0
        : account.hasCompletedHistory === true
          ? Math.min(4, historyAvailable)
          : 0;
  const firstStart = addDaysExact(
    currentStart,
    -requestedHistory * durationDays,
  );
  const cycles: CycleSpec[] = [];
  for (let index = 0; index < requestedHistory; index += 1) {
    const start = addDaysExact(firstStart, index * durationDays);
    cycles.push({
      start,
      end: addDaysExact(start, durationDays),
      status: SubscriptionStatus.expired,
    });
  }
  cycles.push({
    start: currentStart,
    end: addDaysExact(currentStart, durationDays),
    status,
  });
  return cycles;
}

function commerceGatewayMetadata(
  accountKey: string,
  holdId: string,
  kind: CommerceCheckoutHoldKind,
  paymentId: string,
  scenario: string,
) {
  return {
    accountKey,
    checkout_url: `https://checkout.paymongo.test/${paymentId}`,
    checkout_transition:
      scenario === 'successful_full_checkout'
        ? 'pending_then_completed'
        : 'pending_then_failed',
    coaching_checkout_hold_id: holdId,
    hold_id: holdId,
    kind,
    payment_id: paymentId,
    provider: 'paymongo',
    scenario,
    source: 'dynamic-seed',
  };
}

function holdTimes(productAt: Date, registrationFloor: Date) {
  const createdAt = dateAtOrAfter(
    addMinutes(productAt, -30),
    registrationFloor,
  );
  const paymentCreatedAt = dateAtOrAfter(addMinutes(productAt, -10), createdAt);
  return {
    createdAt,
    expiresAt: addMinutes(productAt, CHECKOUT_HOLD_TTL_MINUTES),
    paymentCreatedAt,
  };
}

function registrationFloorFor(account: SeedAccount, anchor: Date) {
  return account.lifecycle
    ? addMinutes(account.lifecycle.registeredAt, 1)
    : daysFrom(anchor, -365);
}

async function seedPlans(ctx: DynamicSeedContext) {
  for (const plan of PLAN_SEEDS) {
    const planId = seedId(`membership-plan:${plan.key}`);
    ctx.state.membershipPlanIds[plan.key] = planId;
    await ctx.prisma.membershipPlan.upsert({
      where: { id: planId },
      update: {
        description: plan.description,
        duration_days: plan.durationDays,
        features: plan.features,
        includes_coaching: plan.includesCoaching,
        is_active: true,
        name: plan.name,
        price: new Prisma.Decimal(plan.price),
        sort_order: plan.sortOrder,
      },
      create: {
        id: planId,
        description: plan.description,
        duration_days: plan.durationDays,
        features: plan.features,
        includes_coaching: plan.includesCoaching,
        is_active: true,
        name: plan.name,
        price: new Prisma.Decimal(plan.price),
        sort_order: plan.sortOrder,
      },
    });
  }

  await ctx.prisma.membershipCatalogSettings.upsert({
    where: { id: seedId('membership-catalog-settings:dynamic') },
    update: {
      membership_card_price: new Prisma.Decimal(MEMBERSHIP_CARD_PRICE),
    },
    create: {
      id: seedId('membership-catalog-settings:dynamic'),
      membership_card_price: new Prisma.Decimal(MEMBERSHIP_CARD_PRICE),
    },
  });
}

function pushCommercePayment(
  rows: MembershipSeedRows,
  input: {
    accountKey: string;
    amount: string;
    createdAt: Date;
    holdId: string;
    kind: CommerceCheckoutHoldKind;
    paymentId: string;
    rejectionReason?: string | null;
    scenario: string;
    userId: string;
    verifiedAt: Date | null;
    status: PaymentStatus;
  },
) {
  rows.paymentRows.push({
    id: input.paymentId,
    amount: new Prisma.Decimal(input.amount),
    currency: 'PHP',
    created_at: input.createdAt,
    gateway_event_id: seedExternalId(`gateway:${input.paymentId}`),
    gateway_metadata: commerceGatewayMetadata(
      input.accountKey,
      input.holdId,
      input.kind,
      input.paymentId,
      input.scenario,
    ),
    idempotency_key: seedExternalId(`payment:${input.paymentId}`),
    payable_id: input.holdId,
    payable_type: PayableType.commerce_checkout_hold,
    payment_stage: PaymentStage.full,
    provider: PaymentProvider.paymongo,
    provider_ref: seedExternalId(`paymongo:${input.paymentId}`),
    rejection_reason: input.rejectionReason ?? null,
    screenshot_url: null,
    status: input.status,
    user_id: input.userId,
    verified_at: input.verifiedAt,
    verified_by: null,
  });
}

function pushSuccessfulHold(
  rows: MembershipSeedRows,
  input: {
    account: SeedAccount;
    amount: string;
    consumedAt: Date;
    holdId: string;
    kind: CommerceCheckoutHoldKind;
    membershipPlanId: string | null;
    paymentId: string;
    productId: string;
    productReference: 'membership_card_id' | 'subscription_id';
    userId: string;
  },
) {
  const registrationFloor = registrationFloorFor(
    input.account,
    input.consumedAt,
  );
  const times = holdTimes(input.consumedAt, registrationFloor);
  rows.successfulHoldRows.push({
    id: input.holdId,
    user_id: input.userId,
    coach_id: null,
    amenity_id: null,
    kind: input.kind,
    status: CommerceCheckoutHoldStatus.held,
    idempotency_key: seedExternalId(`commerce-hold:${input.holdId}`),
    payment_id: null,
    scheduled_at: null,
    ends_at: null,
    duration_minutes: null,
    amount: new Prisma.Decimal(input.amount),
    currency: 'PHP',
    session_count: null,
    start_date: null,
    end_date: null,
    preferred_days: [],
    preferred_time: null,
    member_notes: 'Seeded PayMongo commerce checkout completed in full.',
    expires_at: times.expiresAt,
    consumed_at: null,
    released_at: null,
    failure_reason: null,
    appointment_id: null,
    booking_id: null,
    subscription_id: null,
    membership_card_id: null,
    recurring_plan_id: null,
    membership_plan_id: input.membershipPlanId,
    created_at: times.createdAt,
  });
  rows.successfulHoldUpdates.push({
    consumedAt: input.consumedAt,
    holdId: input.holdId,
    productId: input.productId,
    productReference: input.productReference,
  });
  pushCommercePayment(rows, {
    accountKey: input.account.key,
    amount: input.amount,
    createdAt: times.paymentCreatedAt,
    holdId: input.holdId,
    kind: input.kind,
    paymentId: input.paymentId,
    scenario: 'successful_full_checkout',
    status: PaymentStatus.completed,
    userId: input.userId,
    verifiedAt: input.consumedAt,
  });
}

function pushFailedMembershipAttempt(
  rows: MembershipSeedRows,
  input: {
    account: SeedAccount;
    amount: string;
    expiresAt: Date;
    holdId: string;
    membershipPlanId: string;
    paymentId: string;
    userId: string;
  },
) {
  const failureReason =
    'PayMongo authorization failed; a later full membership checkout succeeded.';
  const registrationFloor = registrationFloorFor(
    input.account,
    input.expiresAt,
  );
  const createdAt = dateAtOrAfter(
    addDaysExact(input.expiresAt, -2),
    registrationFloor,
  );
  rows.failedHoldRows.push({
    id: input.holdId,
    user_id: input.userId,
    coach_id: null,
    amenity_id: null,
    kind: CommerceCheckoutHoldKind.subscription,
    status: CommerceCheckoutHoldStatus.failed,
    idempotency_key: seedExternalId(`commerce-hold:${input.holdId}`),
    payment_id: null,
    scheduled_at: null,
    ends_at: null,
    duration_minutes: null,
    amount: new Prisma.Decimal(input.amount),
    currency: 'PHP',
    session_count: null,
    start_date: null,
    end_date: null,
    preferred_days: [],
    preferred_time: null,
    member_notes:
      'Seeded terminal failed membership checkout before a successful payment.',
    expires_at: input.expiresAt,
    consumed_at: null,
    released_at: input.expiresAt,
    failure_reason: failureReason,
    appointment_id: null,
    booking_id: null,
    subscription_id: null,
    membership_card_id: null,
    recurring_plan_id: null,
    membership_plan_id: input.membershipPlanId,
    created_at: createdAt,
  });
  pushCommercePayment(rows, {
    accountKey: input.account.key,
    amount: input.amount,
    createdAt: addMinutes(createdAt, 1),
    holdId: input.holdId,
    kind: CommerceCheckoutHoldKind.subscription,
    paymentId: input.paymentId,
    rejectionReason: failureReason,
    scenario: 'failed_then_successful',
    status: PaymentStatus.failed,
    userId: input.userId,
    verifiedAt: null,
  });
}

function collectCards(ctx: DynamicSeedContext, rows: MembershipSeedRows) {
  const adminId = ctx.state.userIds[ctx.state.adminKeys[0]];
  for (const account of ctx.state.accounts.filter(
    (candidate) => candidate.role === 'member',
  )) {
    const persona = personaFor(account);
    if (!persona || account.paymentProfile === 'abandoned_or_failed') continue;
    const status = cardStatusForPersona(persona);
    if (status === null) continue;
    const userId = ctx.state.userIds[account.key];
    const cardId = seedId(`membership-card:${account.key}`);
    const window = memberAccessWindow(ctx, account.key);
    const lifecycle = account.lifecycle;
    const purchasedAt = minDate(
      window.startsAt ?? daysFrom(ctx.config.anchorDate, -31, 9),
      daysFrom(ctx.config.anchorDate, -1, 9),
    );
    const legalPurchasedAt = dateAtOrAfter(
      purchasedAt,
      lifecycle
        ? addMinutes(lifecycle.registeredAt, 1)
        : daysFrom(ctx.config.anchorDate, -365),
    );
    const activatedAt = new Date(legalPurchasedAt);
    const revokedAt =
      status === MembershipCardStatus.revoked
        ? maxDate(
            activatedAt,
            persona === 'suspended'
              ? daysFrom(ctx.config.anchorDate, -1, 13)
              : minDate(
                  window.expiresAt ?? daysFrom(ctx.config.anchorDate, -1, 18),
                  daysFrom(ctx.config.anchorDate, -1, 18),
                ),
          )
        : null;
    const holdId = seedId(`commerce-hold:membership-card:${account.key}`);
    // Reuse the prior deterministic payment ID so additive runs migrate the
    // old direct-card payable row into the production commerce lineage.
    const paymentId = seedId(`payment:membership-card:${account.key}`);
    pushSuccessfulHold(rows, {
      account,
      amount: MEMBERSHIP_CARD_PRICE,
      consumedAt: legalPurchasedAt,
      holdId,
      kind: CommerceCheckoutHoldKind.membership_card,
      membershipPlanId: null,
      paymentId,
      productId: cardId,
      productReference: 'membership_card_id',
      userId,
    });
    rows.cardProducts.push({
      account,
      activatedAt,
      adminId,
      cardId,
      holdId,
      paymentId,
      purchasedAt: legalPurchasedAt,
      revokedAt,
      status,
      userId,
    });
  }
}

function collectSubscriptions(
  ctx: DynamicSeedContext,
  rows: MembershipSeedRows,
) {
  const members = ctx.state.accounts.filter(
    (account) => account.role === 'member',
  );
  for (const [index, account] of members.entries()) {
    const persona = personaFor(account);
    if (!persona || account.paymentProfile === 'abandoned_or_failed') continue;
    const planKey = planKeyForPersona(persona, index);
    const plan = PLAN_SEEDS.find((candidate) => candidate.key === planKey);
    const planId = ctx.state.membershipPlanIds[planKey];
    if (!plan || !planId) continue;
    const cycles = cycleSpecsFor(account, ctx, persona, plan.durationDays);
    if (cycles.length === 0) continue;
    const userId = ctx.state.userIds[account.key];

    for (const [cycleIndex, cycle] of cycles.entries()) {
      const isCurrent = cycleIndex === cycles.length - 1;
      const suffix = isCurrent
        ? 'current'
        : cycleIndex === 0
          ? 'previous'
          : `history:${cycleIndex}`;
      const subscriptionId = seedId(`subscription:${account.key}:${suffix}`);
      const holdId = seedId(
        `commerce-hold:subscription:${account.key}:${suffix}`,
      );
      // Reuse the prior deterministic payment ID so additive runs migrate an
      // old direct-subscription payable row instead of leaving stale evidence.
      const paymentId = seedId(`payment:subscription:${account.key}:${suffix}`);
      pushSuccessfulHold(rows, {
        account,
        amount: plan.price,
        consumedAt: cycle.start,
        holdId,
        kind: CommerceCheckoutHoldKind.subscription,
        membershipPlanId: planId,
        paymentId,
        productId: subscriptionId,
        productReference: 'subscription_id',
        userId,
      });
      rows.subscriptionProducts.push({
        account,
        cycle,
        holdId,
        paymentId,
        planId,
        subscriptionId,
        userId,
      });
    }

    if (
      account.paymentProfile === 'failed_then_successful' &&
      persona !== 'suspended' &&
      account.key !== 'member-suspended'
    ) {
      const firstSuccessfulAt = cycles[0].start;
      const failedExpiresAt = minDate(
        addDaysExact(firstSuccessfulAt, -1),
        daysFrom(ctx.config.anchorDate, -1, 12),
      );
      const failedHoldId = seedId(
        `commerce-hold:membership-failed:${account.key}`,
      );
      const failedPaymentId = seedId(
        `payment:commerce-hold:membership-failed:${account.key}`,
      );
      pushFailedMembershipAttempt(rows, {
        account,
        amount: plan.price,
        expiresAt: failedExpiresAt,
        holdId: failedHoldId,
        membershipPlanId: planId,
        paymentId: failedPaymentId,
        userId,
      });
    }
  }
}

function paymentUpdate(row: Prisma.PaymentCreateManyInput) {
  const update = { ...row };
  delete update.id;
  return update;
}

async function persistPayments(
  ctx: DynamicSeedContext,
  rows: readonly Prisma.PaymentCreateManyInput[],
) {
  const paymentModel = ctx.prisma.payment as unknown as PaymentModel;
  for (const row of rows) {
    if (!row.id) {
      throw new Error('Seeded payment is missing its deterministic id');
    }
    await paymentModel.upsert({
      where: { id: row.id },
      update: paymentUpdate(row) as Record<string, unknown>,
      create: row,
    });
  }
}

function holdUpdate(row: Prisma.CommerceCheckoutHoldCreateManyInput) {
  const update = { ...row };
  delete update.id;
  return update;
}

async function persistInitialHolds(
  holdModel: HoldModel,
  rows: readonly Prisma.CommerceCheckoutHoldCreateManyInput[],
) {
  for (const row of rows) {
    if (!row.id) {
      throw new Error('Seeded commerce hold is missing its deterministic id');
    }
    await holdModel.upsert({
      where: { id: row.id },
      update: holdUpdate(row) as Record<string, unknown>,
      create: row as Record<string, unknown>,
    });
  }
}

async function linkHoldPayments(
  holdModel: HoldModel,
  rows: readonly Prisma.CommerceCheckoutHoldCreateManyInput[],
  payments: readonly Prisma.PaymentCreateManyInput[],
) {
  for (const row of rows) {
    if (!row.id) {
      throw new Error(
        `Seeded commerce hold ${row.id} is missing its payment id`,
      );
    }
    const paymentId = payments.find(
      (payment) => payment.payable_id === row.id,
    )?.id;
    if (!paymentId) {
      throw new Error(
        `Seeded commerce hold ${row.id} is missing its payment id`,
      );
    }
    await holdModel.update({
      where: { id: row.id },
      data: { payment_id: paymentId },
    });
  }
}

async function materializeCards(
  ctx: DynamicSeedContext,
  rows: readonly CardProductSpec[],
) {
  for (const card of rows) {
    await ctx.prisma.membershipCard.upsert({
      where: { user_id: card.userId },
      update: {
        activated_at: card.activatedAt,
        price: new Prisma.Decimal(MEMBERSHIP_CARD_PRICE),
        purchased_at: card.purchasedAt,
        revoked_at: card.revokedAt,
        revoked_by:
          card.status === MembershipCardStatus.revoked ? card.adminId : null,
        revoke_reason:
          card.status === MembershipCardStatus.revoked
            ? card.account.memberPersona === 'suspended'
              ? 'Membership card access revoked while the account is suspended.'
              : 'Historical membership card retained for account-state review.'
            : null,
        source: MembershipCardSource.paymongo,
        status: card.status,
        verified_at: card.activatedAt,
        verified_by: null,
      },
      create: {
        created_at: card.purchasedAt,
        id: card.cardId,
        activated_at: card.activatedAt,
        price: new Prisma.Decimal(MEMBERSHIP_CARD_PRICE),
        purchased_at: card.purchasedAt,
        revoked_at: card.revokedAt,
        revoked_by:
          card.status === MembershipCardStatus.revoked ? card.adminId : null,
        revoke_reason:
          card.status === MembershipCardStatus.revoked
            ? card.account.memberPersona === 'suspended'
              ? 'Membership card access revoked while the account is suspended.'
              : 'Historical membership card retained for account-state review.'
            : null,
        source: MembershipCardSource.paymongo,
        status: card.status,
        user_id: card.userId,
        verified_at: card.activatedAt,
        verified_by: null,
      },
    });
  }
}

async function materializeSubscriptions(
  ctx: DynamicSeedContext,
  rows: readonly SubscriptionProductSpec[],
) {
  for (const subscription of rows) {
    const warnings = subscriptionWarningDates(subscription.cycle);
    await ctx.prisma.subscription.upsert({
      where: { id: subscription.subscriptionId },
      update: {
        cancellation_reason: null,
        cancelled_at: null,
        expires_at: subscription.cycle.end,
        payment_id: subscription.paymentId,
        plan_id: subscription.planId,
        starts_at: subscription.cycle.start,
        status: subscription.cycle.status,
        ...warnings,
      },
      create: {
        created_at: subscription.cycle.start,
        id: subscription.subscriptionId,
        cancellation_reason: null,
        cancelled_at: null,
        expires_at: subscription.cycle.end,
        payment_id: subscription.paymentId,
        plan_id: subscription.planId,
        starts_at: subscription.cycle.start,
        status: subscription.cycle.status,
        user_id: subscription.userId,
        ...warnings,
      },
    });
  }
}

async function consumeHolds(
  holdModel: HoldModel,
  rows: readonly SuccessfulHoldUpdate[],
) {
  for (const row of rows) {
    await holdModel.update({
      where: { id: row.holdId },
      data: {
        [row.productReference]: row.productId,
        consumed_at: row.consumedAt,
        failure_reason: null,
        released_at: null,
        status: CommerceCheckoutHoldStatus.consumed,
      },
    });
  }
}

export async function seedMembershipPayments(ctx: DynamicSeedContext) {
  await seedPlans(ctx);
  const rows: MembershipSeedRows = {
    cardProducts: [],
    failedHoldRows: [],
    paymentRows: [],
    subscriptionProducts: [],
    successfulHoldRows: [],
    successfulHoldUpdates: [],
  };
  const holdModel = ctx.prisma.commerceCheckoutHold as unknown as HoldModel;

  // Holds are persisted before payments, matching createHoldWithPayment. The
  // same payment row is then settled and the product is materialized only
  // after its hold/payment lineage exists.
  collectCards(ctx, rows);
  collectSubscriptions(ctx, rows);
  await persistInitialHolds(holdModel, [
    ...rows.successfulHoldRows,
    ...rows.failedHoldRows,
  ]);
  await persistPayments(ctx, rows.paymentRows);
  await linkHoldPayments(
    holdModel,
    [...rows.successfulHoldRows, ...rows.failedHoldRows],
    rows.paymentRows,
  );
  await materializeCards(ctx, rows.cardProducts);
  await materializeSubscriptions(ctx, rows.subscriptionProducts);
  await consumeHolds(holdModel, rows.successfulHoldUpdates);

  ctx.notableIds.premiumPlanId =
    ctx.state.membershipPlanIds['premium-coaching'];
  ctx.notableIds.demoPremiumSubscriptionId = seedId(
    'subscription:member-premium:current',
  );
  ctx.notableIds.demoPendingPaymentId = seedId(
    'payment:commerce-hold:member-pending',
  );
  ctx.notableIds.qaMonthlyEligibleMemberId = ctx.state.userIds['member-active'];
  ctx.notableIds.qaCheckoutAbandonedMemberId =
    ctx.state.userIds['member-checkout-abandoned'];

  return {
    counts: {
      cards: rows.cardProducts.length,
      plans: PLAN_SEEDS.length,
      subscriptions: rows.subscriptionProducts.length,
      terminalPaymentAttempts: rows.failedHoldRows.length,
    },
  };
}
