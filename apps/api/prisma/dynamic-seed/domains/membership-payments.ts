import {
  MembershipCardSource,
  MembershipCardStatus,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  PayableType,
  Prisma,
  SubscriptionStatus,
} from '@prisma/client';
import { seedId, seedExternalId } from '../ids';
import { daysFrom } from '../time';
import type { DynamicSeedContext, MemberPersona, SeedAccount } from '../types';

const PLAN_SEEDS = [
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

function personaFor(account: SeedAccount): MemberPersona {
  return account.memberPersona ?? 'active';
}

function planKeyForPersona(persona: MemberPersona, index: number) {
  if (persona === 'premium') {
    return 'premium-coaching';
  }
  if (persona === 'trial') {
    return 'starter-monthly';
  }
  return index % 3 === 0 ? 'performance-monthly' : 'starter-monthly';
}

function subscriptionStatusForPersona(persona: MemberPersona) {
  switch (persona) {
    case 'pending':
    case 'unverified':
      return SubscriptionStatus.pending_payment;
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

function paymentStatusForPersona(persona: MemberPersona) {
  switch (persona) {
    case 'pending':
    case 'unverified':
      return PaymentStatus.awaiting_verification;
    case 'suspended':
      return PaymentStatus.failed;
    default:
      return PaymentStatus.completed;
  }
}

function cardStatusForPersona(persona: MemberPersona) {
  switch (persona) {
    case 'pending':
    case 'unverified':
      return MembershipCardStatus.pending_verification;
    case 'archived':
    case 'suspended':
      return MembershipCardStatus.revoked;
    default:
      return MembershipCardStatus.active;
  }
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
      membership_card_price: new Prisma.Decimal('400'),
    },
    create: {
      id: seedId('membership-catalog-settings:dynamic'),
      membership_card_price: new Prisma.Decimal('400'),
    },
  });
}

async function seedCards(ctx: DynamicSeedContext) {
  const adminId = ctx.state.userIds[ctx.state.adminKeys[0]];

  for (const [index, account] of ctx.state.accounts
    .filter((candidate) => candidate.role === 'member')
    .entries()) {
    const persona = personaFor(account);
    const status = cardStatusForPersona(persona);
    const userId = ctx.state.userIds[account.key];
    const cardId = seedId(`membership-card:${account.key}`);
    const purchasedAt = daysFrom(ctx.config.anchorDate, -65 + (index % 42), 10);

    await ctx.prisma.membershipCard.upsert({
      where: { user_id: userId },
      update: {
        activated_at:
          status === MembershipCardStatus.active
            ? daysFrom(purchasedAt, 0, 10, 30)
            : null,
        price: new Prisma.Decimal('400'),
        purchased_at: purchasedAt,
        revoked_at:
          status === MembershipCardStatus.revoked
            ? daysFrom(ctx.config.anchorDate, -8 - (index % 8), 13)
            : null,
        revoked_by: status === MembershipCardStatus.revoked ? adminId : null,
        revoke_reason:
          status === MembershipCardStatus.revoked
            ? 'Revoked card retained for account-state review.'
            : null,
        source:
          index % 4 === 0
            ? MembershipCardSource.paymongo
            : MembershipCardSource.cash,
        status,
        verified_at:
          status === MembershipCardStatus.active
            ? daysFrom(purchasedAt, 0, 11)
            : null,
        verified_by: status === MembershipCardStatus.active ? adminId : null,
      },
      create: {
        id: cardId,
        activated_at:
          status === MembershipCardStatus.active
            ? daysFrom(purchasedAt, 0, 10, 30)
            : null,
        price: new Prisma.Decimal('400'),
        purchased_at: purchasedAt,
        revoked_at:
          status === MembershipCardStatus.revoked
            ? daysFrom(ctx.config.anchorDate, -8 - (index % 8), 13)
            : null,
        revoked_by: status === MembershipCardStatus.revoked ? adminId : null,
        revoke_reason:
          status === MembershipCardStatus.revoked
            ? 'Revoked card retained for account-state review.'
            : null,
        source:
          index % 4 === 0
            ? MembershipCardSource.paymongo
            : MembershipCardSource.cash,
        status,
        user_id: userId,
        verified_at:
          status === MembershipCardStatus.active
            ? daysFrom(purchasedAt, 0, 11)
            : null,
        verified_by: status === MembershipCardStatus.active ? adminId : null,
      },
    });
  }
}

async function seedSubscriptionsAndPayments(ctx: DynamicSeedContext) {
  const paymentRows: Prisma.PaymentCreateManyInput[] = [];
  const members = ctx.state.accounts.filter(
    (account) => account.role === 'member',
  );
  const adminId = ctx.state.userIds[ctx.state.adminKeys[0]];

  for (const [index, account] of members.entries()) {
    const persona = personaFor(account);
    const subscriptionStatus = subscriptionStatusForPersona(persona);
    const planKey = planKeyForPersona(persona, index);
    const planId = ctx.state.membershipPlanIds[planKey];
    const userId = ctx.state.userIds[account.key];
    const subscriptionId = seedId(`subscription:${account.key}:current`);
    const paymentId = seedId(`payment:subscription:${account.key}:current`);
    const startsAt =
      subscriptionStatus === SubscriptionStatus.pending_payment
        ? null
        : daysFrom(
            ctx.config.anchorDate,
            persona === 'expired' ? -76 : -22 - (index % 16),
            9,
          );
    const expiresAt =
      subscriptionStatus === SubscriptionStatus.pending_payment
        ? null
        : persona === 'expired' || persona === 'archived'
          ? daysFrom(ctx.config.anchorDate, -6 - (index % 15), 23, 59)
          : daysFrom(ctx.config.anchorDate, 8 + (index % 45), 23, 59);
    const completed =
      paymentStatusForPersona(persona) === PaymentStatus.completed;

    await ctx.prisma.subscription.upsert({
      where: { id: subscriptionId },
      update: {
        cancellation_reason:
          subscriptionStatus === SubscriptionStatus.suspended
            ? 'Frozen or suspended membership retained for review.'
            : null,
        cancelled_at:
          subscriptionStatus === SubscriptionStatus.suspended
            ? daysFrom(ctx.config.anchorDate, -3 - (index % 5), 12)
            : null,
        expires_at: expiresAt,
        payment_id: paymentId,
        plan_id: planId,
        starts_at: startsAt,
        status: subscriptionStatus,
        warned_1d_at:
          persona === 'expired' ? daysFrom(ctx.config.anchorDate, -8, 8) : null,
        warned_3d_at:
          persona === 'expired'
            ? daysFrom(ctx.config.anchorDate, -10, 8)
            : null,
        warned_7d_at:
          persona === 'expired'
            ? daysFrom(ctx.config.anchorDate, -14, 8)
            : null,
      },
      create: {
        id: subscriptionId,
        cancellation_reason:
          subscriptionStatus === SubscriptionStatus.suspended
            ? 'Frozen or suspended membership retained for review.'
            : null,
        cancelled_at:
          subscriptionStatus === SubscriptionStatus.suspended
            ? daysFrom(ctx.config.anchorDate, -3 - (index % 5), 12)
            : null,
        expires_at: expiresAt,
        payment_id: paymentId,
        plan_id: planId,
        starts_at: startsAt,
        status: subscriptionStatus,
        user_id: userId,
        warned_1d_at:
          persona === 'expired' ? daysFrom(ctx.config.anchorDate, -8, 8) : null,
        warned_3d_at:
          persona === 'expired'
            ? daysFrom(ctx.config.anchorDate, -10, 8)
            : null,
        warned_7d_at:
          persona === 'expired'
            ? daysFrom(ctx.config.anchorDate, -14, 8)
            : null,
      },
    });

    const amount =
      planKey === 'premium-coaching'
        ? '1999'
        : planKey === 'performance-monthly'
          ? '1199'
          : '799';

    paymentRows.push({
      id: paymentId,
      amount: new Prisma.Decimal(amount),
      created_at: daysFrom(ctx.config.anchorDate, -22 - (index % 12), 12),
      gateway_event_id:
        index % 5 === 0
          ? seedExternalId(`gateway:subscription:${account.key}`)
          : null,
      gateway_metadata: {
        accountKey: account.key,
        demoState: persona,
        source: 'dynamic-seed',
      },
      idempotency_key: seedExternalId(
        `payment:subscription:${account.key}:current`,
      ),
      payable_id: subscriptionId,
      payable_type: PayableType.subscription,
      payment_stage: PaymentStage.full,
      provider:
        index % 3 === 0 ? PaymentProvider.paymongo : PaymentProvider.cash,
      provider_ref:
        index % 3 === 0
          ? seedExternalId(`paymongo:subscription:${account.key}`)
          : null,
      rejection_reason:
        paymentStatusForPersona(persona) === PaymentStatus.failed
          ? 'Failed payment retained for suspended member review.'
          : null,
      screenshot_url: null,
      status: paymentStatusForPersona(persona),
      user_id: userId,
      verified_at: completed
        ? daysFrom(ctx.config.anchorDate, -21 - (index % 10), 14)
        : null,
      verified_by: completed ? adminId : null,
    });

    if (persona === 'premium' || (persona === 'active' && index % 4 === 0)) {
      const previousSubscriptionId = seedId(
        `subscription:${account.key}:previous`,
      );
      const previousPaymentId = seedId(
        `payment:subscription:${account.key}:previous`,
      );
      await ctx.prisma.subscription.upsert({
        where: { id: previousSubscriptionId },
        update: {
          expires_at: daysFrom(ctx.config.anchorDate, -31, 23, 59),
          payment_id: previousPaymentId,
          plan_id: planId,
          starts_at: daysFrom(ctx.config.anchorDate, -61, 9),
          status: SubscriptionStatus.expired,
        },
        create: {
          id: previousSubscriptionId,
          expires_at: daysFrom(ctx.config.anchorDate, -31, 23, 59),
          payment_id: previousPaymentId,
          plan_id: planId,
          starts_at: daysFrom(ctx.config.anchorDate, -61, 9),
          status: SubscriptionStatus.expired,
          user_id: userId,
        },
      });
      paymentRows.push({
        id: previousPaymentId,
        amount: new Prisma.Decimal(amount),
        created_at: daysFrom(ctx.config.anchorDate, -61, 13),
        gateway_event_id: null,
        gateway_metadata: { accountKey: account.key, cycle: 'previous' },
        idempotency_key: seedExternalId(
          `payment:subscription:${account.key}:previous`,
        ),
        payable_id: previousSubscriptionId,
        payable_type: PayableType.subscription,
        payment_stage: PaymentStage.full,
        provider: PaymentProvider.cash,
        provider_ref: null,
        status: PaymentStatus.completed,
        user_id: userId,
        verified_at: daysFrom(ctx.config.anchorDate, -61, 14),
        verified_by: adminId,
      });
    }

    const cardPaymentId = seedId(`payment:membership-card:${account.key}`);
    paymentRows.push({
      id: cardPaymentId,
      amount: new Prisma.Decimal('400'),
      created_at: daysFrom(ctx.config.anchorDate, -64 + (index % 20), 11),
      gateway_event_id: null,
      gateway_metadata: { accountKey: account.key, payable: 'membership-card' },
      idempotency_key: seedExternalId(`payment:membership-card:${account.key}`),
      payable_id: seedId(`membership-card:${account.key}`),
      payable_type: PayableType.membership_card,
      payment_stage: PaymentStage.full,
      provider:
        index % 4 === 0 ? PaymentProvider.paymongo : PaymentProvider.cash,
      provider_ref:
        index % 4 === 0
          ? seedExternalId(`paymongo:membership-card:${account.key}`)
          : null,
      status:
        cardStatusForPersona(persona) ===
        MembershipCardStatus.pending_verification
          ? PaymentStatus.awaiting_verification
          : PaymentStatus.completed,
      user_id: userId,
      verified_at:
        cardStatusForPersona(persona) === MembershipCardStatus.active
          ? daysFrom(ctx.config.anchorDate, -63 + (index % 20), 12)
          : null,
      verified_by:
        cardStatusForPersona(persona) === MembershipCardStatus.active
          ? adminId
          : null,
    });
  }

  await ctx.prisma.payment.createMany({
    data: paymentRows,
    skipDuplicates: true,
  });
}

export async function seedMembershipPayments(ctx: DynamicSeedContext) {
  await seedPlans(ctx);
  await seedCards(ctx);
  await seedSubscriptionsAndPayments(ctx);

  ctx.notableIds.premiumPlanId =
    ctx.state.membershipPlanIds['premium-coaching'];
  ctx.notableIds.demoPremiumSubscriptionId = seedId(
    'subscription:member-premium:current',
  );
  ctx.notableIds.demoPendingPaymentId = seedId(
    'payment:subscription:member-pending:current',
  );

  return {
    counts: {
      plans: PLAN_SEEDS.length,
    },
  };
}
