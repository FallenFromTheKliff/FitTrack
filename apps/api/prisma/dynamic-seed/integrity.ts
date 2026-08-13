import {
  AppointmentStatus,
  AuthProvider,
  BookingStatus,
  CommerceCheckoutHoldStatus,
  MembershipCardStatus,
  PaymentStage,
  PaymentStatus,
  PayableType,
  PlanSource,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingFrequency,
  RecurringCoachingPlanStatus,
  RecurringCoachingScheduleItemStatus,
  RelationshipStatus,
  SubscriptionStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { DYNAMIC_SEED_PASSWORDS, userIdFor } from './accounts';
import { seedId } from './ids';
import { buildModelCounts, MODEL_COVERAGE } from './manifest';
import type {
  DynamicSeedIntegritySummary,
  DynamicSeedIntegrityViolation,
} from './manifest';
import type { DynamicSeedContext } from './types';
import {
  COHORT_COUNTS,
  HARD_CAPS,
  MEMBER_VOLUME_BANDS,
  activityDateFor,
  cohortForMember,
  memberAccessWindow,
  volumeBandForMember,
  type VolumeDomain,
} from './volumes';
import { expectedOpeningStock } from './domains/nutrition-inventory';

type IntegrityViolation = DynamicSeedIntegrityViolation;

export class SeedIntegrityError extends Error {
  constructor(readonly outcome: DynamicSeedIntegritySummary) {
    const details = outcome.violations
      .slice(0, 40)
      .map((violation) => `[${violation.category}] ${violation.detail}`)
      .join('\n');
    super(
      `[dynamic-seed][integrity] FAILED ${outcome.violations.length} violation(s)\n${details}`,
    );
    this.name = 'SeedIntegrityError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

const PROHIBITED_PRODUCT_PAYMENT_STATUSES = new Set([
  'awaiting_verification',
  'balance_pending',
  'pending',
  'pending_downpayment',
  'pending_full_payment',
  'pending_payment',
]);

type ProductPaymentStateRow = {
  id: string;
  paymentStage?: string | null;
  status: string | null;
};

export function isProhibitedProductPaymentState(
  status: string | null | undefined,
  paymentStage?: string | null,
) {
  return (
    (status != null && PROHIBITED_PRODUCT_PAYMENT_STATUSES.has(status)) ||
    paymentStage === 'balance' ||
    paymentStage === 'downpayment'
  );
}

export function assertNoProhibitedProductPaymentStates(
  rows: readonly ProductPaymentStateRow[],
) {
  const prohibited = rows.filter((row) =>
    isProhibitedProductPaymentState(row.status, row.paymentStage),
  );
  if (prohibited.length > 0) {
    throw new Error(
      `[dynamic-seed][integrity] prohibited product payment state(s): ${prohibited
        .map((row) => row.id)
        .join(', ')}`,
    );
  }
}

export function assertNoNonFullProductPayments(
  rows: readonly ProductPaymentStateRow[],
) {
  const invalid = rows.filter(
    (row) => row.status !== PaymentStatus.completed || row.paymentStage !== PaymentStage.full,
  );
  if (invalid.length > 0) {
    throw new Error(
      `[dynamic-seed][integrity] non-full product payment(s): ${invalid
        .map((row) => row.id)
        .join(', ')}`,
    );
  }
}

const ACTIVE_APPOINTMENT_STATUSES = new Set<AppointmentStatus>([
  AppointmentStatus.confirmed,
]);

const ACTIVE_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.confirmed,
]);

const EXPECTED_SUBSCRIPTION_STATUS = {
  active: SubscriptionStatus.active,
  premium: SubscriptionStatus.active,
  frozen: SubscriptionStatus.suspended,
  pending: null,
  trial: SubscriptionStatus.active,
  expired: SubscriptionStatus.expired,
  unverified: null,
  archived: SubscriptionStatus.expired,
  suspended: SubscriptionStatus.suspended,
} as const;

export const SEED_SCENARIO_MATRIX: Record<string, string> = {
  active: 'member-active: active membership and one-time upcoming coaching',
  premium: 'member-premium: premium membership and completed workout history',
  frozen: 'member-frozen: suspended membership with retained history',
  pending: 'member-pending: pending payment without active access',
  expired: 'member-expired: expired membership with no upcoming coaching',
  unverified: 'member-unverified: pending account with unverified email',
  archived: 'member-archived: soft-deleted account and expired membership',
  suspended: 'member-suspended: suspended account with revoked card',
  has_upcoming: 'member-active: at least one future active appointment',
  no_upcoming: 'member-expired: no future active appointment',
  completed_history:
    'terminal appointments and completed workouts before anchor',
  cancelled_history:
    'cancelled/no-show appointments and bookings before anchor',
  paid_history: 'verified completed payments with downstream records',
  pending_payment: 'terminalized checkout attempt with no pending product',
  monthly_eligible:
    'member-active: eligible for a new Ridge monthly checkout without an existing hold',
  ridge_monthly_future:
    'member-premium: future confirmed paid monthly Ridge session',
  ridge_feedback:
    'member-premium: completed paid Ridge session with member feedback',
  ridge_one_time:
    'member-active: exactly one full-paid future non-recurring Ridge appointment',
  ridge_one_time_assignment:
    'member-active: one-week coach-owned assignment attached to the one-time appointment',
  checkout_abandoned:
    'checkout-abandoned member: one terminal failed PayMongo subscription attempt with no product',
  no_held_checkout: 'seed contains zero held checkout attempts',
  zero_pending_products: 'seed contains zero pending product states',
};

function money(value: unknown) {
  return Number(value);
}

function sameMoney(left: unknown, right: unknown) {
  return Math.abs(money(left) - money(right)) < 0.005;
}

export function overlaps(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) {
  return leftStart < rightEnd && rightStart < leftEnd;
}

export function hasKeyedIntervalOverlap<T extends { key: string; start: Date; end: Date }>(
  rows: readonly T[],
) {
  const byKey = new Map<string, T[]>();
  for (const row of rows) {
    const keyRows = byKey.get(row.key) ?? [];
    keyRows.push(row);
    byKey.set(row.key, keyRows);
  }
  for (const keyRows of byKey.values()) {
    const sorted = [...keyRows].sort(
      (left, right) => left.start.getTime() - right.start.getTime(),
    );
    for (let index = 1; index < sorted.length; index += 1) {
      if (overlaps(sorted[index - 1].start, sorted[index - 1].end, sorted[index].start, sorted[index].end)) {
        return true;
      }
    }
  }
  return false;
}

type CheckoutHoldProductReferenceSource = {
  appointment_id: string | null;
  booking_id: string | null;
  membership_plan_id: string | null;
  membership_card_id: string | null;
  recurring_plan_id: string | null;
  subscription_id: string | null;
};

type CheckoutHoldEvidence = {
  status: CommerceCheckoutHoldStatus;
  expiresAt: Date;
  failureReason: string | null;
  productReferences: readonly (string | null)[];
};

function checkoutHoldProductReferences(
  hold: CheckoutHoldProductReferenceSource,
) {
  return [
    hold.appointment_id,
    hold.booking_id,
    hold.membership_plan_id,
    hold.subscription_id,
    hold.membership_card_id,
    hold.recurring_plan_id,
  ];
}

export function hasTerminalCheckoutHoldProductReference(
  hold: CheckoutHoldProductReferenceSource & {
    id: string;
    status: CommerceCheckoutHoldStatus;
  },
) {
  return (
    (hold.status === CommerceCheckoutHoldStatus.failed ||
      hold.status === CommerceCheckoutHoldStatus.expired) &&
    checkoutHoldProductReferences(hold).some((reference) => reference !== null)
  );
}

export function assertNoTerminalCheckoutHoldProductReferences(
  holds: readonly (CheckoutHoldProductReferenceSource & {
    id: string;
    status: CommerceCheckoutHoldStatus;
  })[],
) {
  const invalid = holds.filter(hasTerminalCheckoutHoldProductReference);
  if (invalid.length > 0) {
    throw new Error(
      `[dynamic-seed][integrity] terminal checkout hold(s) reference product records: ${invalid
        .map((hold) => hold.id)
        .join(', ')}`,
    );
  }
}

export function isLegalCheckoutHoldEvidence(
  hold: CheckoutHoldEvidence,
  anchor: Date,
) {
  if (hold.status === CommerceCheckoutHoldStatus.held) {
    return (
      hold.expiresAt > anchor &&
      hold.productReferences.every((reference) => reference === null)
    );
  }
  if (
    hold.status !== CommerceCheckoutHoldStatus.failed &&
    hold.status !== CommerceCheckoutHoldStatus.expired
  ) {
    return false;
  }
  return (
    hold.expiresAt <= anchor &&
    hold.productReferences.every((reference) => reference === null) &&
    Boolean(hold.failureReason?.trim())
  );
}

function timeMinutes(value: Date) {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

export async function runSeedIntegrityAudit(
  ctx: DynamicSeedContext,
): Promise<DynamicSeedIntegritySummary> {
  const ids = ctx.state.accounts.map((account) => ctx.state.userIds[account.key]);
  const [
    counts,
    users,
    emailIdentities,
    subscriptions,
    cards,
    payments,
    holds,
    amenities,
    bookings,
    coachProfiles,
    availabilitySlots,
    relationships,
    plans,
    trainingPlans,
    scheduleDays,
    appointments,
    scheduleItems,
    assignments,
    workoutSessions,
    exerciseLogs,
    billingCycles,
    sales,
    saleItems,
    evidence,
    attendance,
    nutritionLogs,
    tdeeProfiles,
    macroTargets,
    progressionSources,
    progressionGrants,
    progressionProfiles,
    seasons,
    seasonalStandings,
    seasonalMuscleStandings,
    muscleMastery,
    muscleDefinitions,
    milestoneProgress,
    milestoneDefinitions,
    aiSessions,
    aiMessages,
    aiInteractions,
    notifications,
    gymChatSessions,
    gymChatMessages,
    gymChatInteractions,
    retailProducts,
    equipmentWriteOffs,
    coachReviews,
  ] = await Promise.all([
    buildModelCounts(ctx.prisma),
    ctx.prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        deletedAt: true,
        email_verified_at: true,
        profile: { select: { id: true } },
        role: true,
        status: true,
      },
    }),
    ctx.prisma.authIdentity.findMany({
      where: { user_id: { in: ids }, provider: AuthProvider.email },
      select: { credential_hash: true, identifier: true, user_id: true },
    }),
    ctx.prisma.subscription.findMany({
      where: { user_id: { in: ids } },
      select: {
        id: true,
        expires_at: true,
        payment_id: true,
        starts_at: true,
        status: true,
        user_id: true,
        plan: { select: { price: true } },
      },
    }),
    ctx.prisma.membershipCard.findMany({
      where: { user_id: { in: ids } },
      select: {
        id: true,
        activated_at: true,
        price: true,
        revoked_at: true,
        status: true,
        user_id: true,
        verified_at: true,
        verified_by: true,
      },
    }),
    ctx.prisma.payment.findMany({
      select: {
        amount: true,
        created_at: true,
        gateway_event_id: true,
        id: true,
        idempotency_key: true,
        payable_id: true,
        payable_type: true,
        payment_stage: true,
        provider: true,
        provider_ref: true,
        rejection_reason: true,
        status: true,
        user_id: true,
        verified_at: true,
        verified_by: true,
      },
    }),
    ctx.prisma.commerceCheckoutHold.findMany({
      select: {
        amenity_id: true,
        amount: true,
        appointment_id: true,
        booking_id: true,
        consumed_at: true,
        created_at: true,
        end_date: true,
        ends_at: true,
        expires_at: true,
        failure_reason: true,
        id: true,
        kind: true,
        membership_card_id: true,
        membership_plan_id: true,
        payment_id: true,
        recurring_plan_id: true,
        released_at: true,
        scheduled_at: true,
        start_date: true,
        status: true,
        subscription_id: true,
        user_id: true,
      },
    }),
    ctx.prisma.amenity.findMany({
      select: { capacity: true, id: true },
    }),
    ctx.prisma.amenityBooking.findMany({
      select: {
        amenity_id: true,
        balance_amount: true,
        balance_paid_at: true,
        cancelled_at: true,
        completed_at: true,
        downpayment_amount: true,
        downpayment_paid_at: true,
        ends_at: true,
        id: true,
        starts_at: true,
        status: true,
        total_amount: true,
        user_id: true,
        created_at: true,
      },
    }),
    ctx.prisma.coachProfile.findMany({
      select: { id: true, user_id: true },
    }),
    ctx.prisma.coachAvailabilitySlot.findMany({
      select: {
        coach_id: true,
        day_of_week: true,
        end_time: true,
        is_active: true,
        start_time: true,
      },
    }),
    ctx.prisma.coachClientRelationship.findMany({
      select: {
        coach_id: true,
        ended_at: true,
        id: true,
        member_id: true,
        started_at: true,
        status: true,
      },
    }),
    ctx.prisma.recurringCoachingPlan.findMany({
      select: {
        coach_id: true,
        completed_sessions: true,
        created_by: true,
        end_date: true,
        frequency: true,
        id: true,
        member_id: true,
        quoted_amount: true,
        start_date: true,
        status: true,
        total_sessions: true,
        training_plan_id: true,
      },
    }),
    ctx.prisma.trainingPlan.findMany({
      select: {
        coach_id: true,
        duration_weeks: true,
        id: true,
        is_active: true,
        is_template: true,
        source: true,
        user_id: true,
      },
    }),
    ctx.prisma.trainingScheduleDay.findMany({
      select: {
        exercises: { select: { id: true } },
        id: true,
        plan_id: true,
        week_number: true,
      },
    }),
    ctx.prisma.coachAppointment.findMany({
      select: {
        coach_id: true,
        completed_at: true,
        cancelled_at: true,
        balance_amount: true,
        balance_paid_at: true,
        downpayment_amount: true,
        downpayment_paid_at: true,
        duration_minutes: true,
        id: true,
        no_show_at: true,
        recurring_plan_id: true,
        recurring_schedule_item_id: true,
        scheduled_at: true,
        status: true,
        total_amount: true,
        user_id: true,
        created_at: true,
      },
    }),
    ctx.prisma.recurringCoachingScheduleItem.findMany({
      select: {
        amount: true,
        id: true,
        recurring_plan_id: true,
        scheduled_at: true,
        sequence_index: true,
        status: true,
        training_schedule_day_id: true,
      },
    }),
    ctx.prisma.coachWorkoutAssignment.findMany({
      select: {
        appointment_id: true,
        completed_at: true,
        id: true,
        held_at: true,
        sequence_index: true,
        source: true,
        state: true,
        training_plan_id: true,
        training_schedule_day_id: true,
        workout_session_id: true,
      },
    }),
    ctx.prisma.workoutSession.findMany({
      select: {
        completed_at: true,
        created_at: true,
        id: true,
        last_activity_at: true,
        plan_id: true,
        started_at: true,
        status: true,
        total_volume_kg: true,
        user_id: true,
      },
    }),
    ctx.prisma.exerciseLog.findMany({
      select: { created_at: true, exercise_id: true, session_id: true, user_id: true },
    }),
    ctx.prisma.recurringCoachingBillingCycle.findMany({
      select: {
        amount: true,
        cycle_end_date: true,
        cycle_start_date: true,
        paid_at: true,
        payment_id: true,
        recurring_plan_id: true,
        status: true,
      },
    }),
    ctx.prisma.saleTransaction.findMany({
      select: {
        customer_user_id: true,
        id: true,
        payment_id: true,
        status: true,
        total_amount: true,
      },
    }),
    ctx.prisma.saleTransactionItem.findMany({
      select: { product_id: true, quantity: true, subtotal: true, transaction_id: true },
    }),
    ctx.prisma.milestoneEvidenceSubmission.findMany({
      select: {
        milestone_progress_id: true,
        reviewed_at: true,
        reviewed_by_user_id: true,
        status: true,
        user_id: true,
      },
    }),
    ctx.prisma.attendanceLog.findMany({
      where: { user_id: { in: ids } },
      select: { check_in_at: true, check_out_at: true, id: true, user_id: true },
    }),
    ctx.prisma.nutritionLog.findMany({
      where: { user_id: { in: ids } },
      select: { created_at: true, log_date: true, macro_target_id: true, user_id: true },
    }),
    ctx.prisma.tdeeProfile.findMany({
      where: { user_id: { in: ids } },
      select: { calculated_at: true, id: true, is_active: true, user_id: true },
    }),
    ctx.prisma.macroTarget.findMany({
      where: { user_id: { in: ids } },
      select: { created_at: true, id: true, is_active: true, tdee_profile_id: true, user_id: true },
    }),
    ctx.prisma.progressionSourceEvent.findMany({
      where: { user_id: { in: ids } },
      select: { created_at: true, id: true, processed_at: true, source_id: true, source_status: true, source_type: true, user_id: true },
    }),
    ctx.prisma.progressionGrantLedger.findMany({
      where: { user_id: { in: ids } },
      select: { amount: true, created_at: true, grant_status: true, grant_type: true, id: true, muscle_group: true, season_id: true, source_event_id: true, user_id: true },
    }),
    ctx.prisma.userProgressionProfile.findMany({
      where: { user_id: { in: ids } },
      select: { active_season_id: true, current_season_points: true, last_progressed_at: true, total_xp: true, user_id: true },
    }),
    ctx.prisma.seasonDefinition.findMany({
      where: { id: { in: [seedId('season:dynamic-main'), seedId('season:dynamic-previous'), seedId('season:dynamic-upcoming')] } },
      select: { ends_at: true, id: true, starts_at: true, status: true },
    }),
    ctx.prisma.seasonalStanding.findMany({
      where: { user_id: { in: ids } },
      select: { season_id: true, season_points: true, user_id: true },
    }),
    ctx.prisma.seasonalMuscleStanding.findMany({
      where: { user_id: { in: ids } },
      select: { muscle_group: true, muscle_points: true, season_id: true, user_id: true },
    }),
    ctx.prisma.muscleMasteryProgress.findMany({
      where: { user_id: { in: ids } },
      select: { muscle_group: true, total_volume_kg: true, user_id: true, xp_points: true },
    }),
    ctx.prisma.muscleDefinition.findMany({
      where: { is_active: true },
      select: { key: true },
    }),
    ctx.prisma.userMilestoneProgress.findMany({
      where: { user_id: { in: ids } },
      select: { claimed_at: true, milestone_definition_id: true, progress_value: true, reward_granted_at: true, status: true, unlocked_at: true, user_id: true },
    }),
    ctx.prisma.milestoneDefinition.findMany({
      where: { id: { in: [
        seedId('milestone-definition:first-workout'),
        seedId('milestone-definition:consistency'),
        seedId('milestone-definition:progression'),
      ] } },
      select: { condition_payload: true, evidence_requirement: true, id: true },
    }),
    ctx.prisma.aiChatSession.findMany({
      where: { user_id: { in: ids } },
      select: { created_at: true, id: true, is_active: true, last_activity_at: true, user_id: true },
    }),
    ctx.prisma.aiChatMessage.findMany({
      where: { session: { user_id: { in: ids } } },
      select: { created_at: true, id: true, role: true, session_id: true },
    }),
    ctx.prisma.aiInteractionLog.findMany({
      where: { user_id: { in: ids } },
      select: { created_at: true, id: true, session_id: true, user_id: true },
    }),
    ctx.prisma.notification.findMany({
      where: { user_id: { in: ids } },
      select: { created_at: true, id: true, read_at: true, sent_at: true, status: true, type: true, user_id: true },
    }),
    ctx.prisma.gymChatSession.findMany({
      where: { user_id: { in: ids } },
      select: { created_at: true, id: true, is_active: true, last_activity_at: true, user_id: true },
    }),
    ctx.prisma.gymChatMessage.findMany({
      where: { session: { user_id: { in: ids } } },
      select: { created_at: true, id: true, role: true, session_id: true },
    }),
    ctx.prisma.gymChatInteractionLog.findMany({
      where: { user_id: { in: ids } },
      select: { created_at: true, id: true, session_id: true, user_id: true },
    }),
    ctx.prisma.retailProduct.findMany({
      select: { id: true, name: true, stock_quantity: true },
    }),
    ctx.prisma.equipmentWriteOff.findMany({
      select: { equipment_id: true, quantity_before: true, quantity_lost: true, quantity_set_to: true },
    }),
    ctx.prisma.coachReview.findMany({
      where: { reviewer_id: { in: ids } },
      select: { appointment_id: true, coach_id: true, created_at: true, reviewer_id: true },
    }),
  ]);

  const violations: IntegrityViolation[] = [];
  const categoryCounts: Record<string, number> = {};
  let checks = 0;
  const check = (condition: boolean, category: string, detail: string) => {
    checks += 1;
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    if (!condition) {
      violations.push({ category, detail });
    }
  };
  const recordAssertionFailure = (category: string, error: unknown) => {
    checks += 1;
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    violations.push({
      category,
      detail: error instanceof Error ? error.message : String(error),
    });
  };
  check(
    holds.every((hold) => hold.status !== CommerceCheckoutHoldStatus.held),
    'checkout-hold',
    'seed contains a held checkout attempt',
  );
  check(
    payments
      .filter((payment) => payment.payable_type !== PayableType.commerce_checkout_hold)
      .every(
        (payment) =>
          payment.status === PaymentStatus.completed &&
          payment.payment_stage === PaymentStage.full,
      ),
    'payment',
    'seed contains a pending or partial product payment',
  );
  check(
    scheduleItems.every(
      (item) =>
        item.status !== RecurringCoachingScheduleItemStatus.pending_payment,
    ),
    'dependents',
    'seed contains a pending recurring coaching schedule item',
  );
  const pendingMemberId = ctx.state.userIds['member-pending'];
  const pendingMemberHolds = holds.filter(
    (hold) => hold.user_id === pendingMemberId,
  );
  check(
    pendingMemberHolds.length === 1 &&
      pendingMemberHolds.every(
        (hold) =>
          hold.status === CommerceCheckoutHoldStatus.failed ||
          hold.status === CommerceCheckoutHoldStatus.expired,
      ),
    'scenario',
    'member-pending was not terminalized into exactly one failed checkout attempt',
  );
  try {
    assertNoProhibitedProductPaymentStates([
      ...bookings.map((booking) => ({
        id: `booking:${booking.id}`,
        status: booking.status,
      })),
      ...appointments.map((appointment) => ({
        id: `appointment:${appointment.id}`,
        status: appointment.status,
      })),
      ...scheduleItems.map((item) => ({
        id: `schedule-item:${item.id}`,
        status: item.status,
      })),
      ...payments
        .filter((payment) => payment.payable_type !== PayableType.commerce_checkout_hold)
        .map((payment) => ({
          id: `payment:${payment.id}`,
          paymentStage: payment.payment_stage,
          status: payment.status,
        })),
    ]);
  } catch (error) {
    recordAssertionFailure('payment', error);
  }
  try {
    assertNoNonFullProductPayments(
      payments
        .filter((payment) => payment.payable_type !== PayableType.commerce_checkout_hold)
        .map((payment) => ({
          id: `payment:${payment.id}`,
          paymentStage: payment.payment_stage,
          status: payment.status,
        })),
    );
  } catch (error) {
    recordAssertionFailure('payment', error);
  }
  try {
    assertNoTerminalCheckoutHoldProductReferences(holds);
  } catch (error) {
    recordAssertionFailure('checkout-hold', error);
  }
  const anchor = ctx.config.anchorDate;
  const userById = new Map(users.map((user) => [user.id, user]));
  const identityByUser = new Map(
    emailIdentities.map((identity) => [identity.user_id, identity]),
  );
  const subscriptionsByUser = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions) {
    const rows = subscriptionsByUser.get(subscription.user_id) ?? [];
    rows.push(subscription);
    subscriptionsByUser.set(subscription.user_id, rows);
  }
  const cardByUser = new Map(cards.map((card) => [card.user_id, card]));
  const holdsByUser = new Map<string, typeof holds>();
  for (const hold of holds) {
    const rows = holdsByUser.get(hold.user_id) ?? [];
    rows.push(hold);
    holdsByUser.set(hold.user_id, rows);
  }
  const paymentByPayable = new Map<string, typeof payments>();
  for (const payment of payments) {
    const key = `${payment.payable_type}:${payment.payable_id}`;
    const rows = paymentByPayable.get(key) ?? [];
    rows.push(payment);
    paymentByPayable.set(key, rows);
    check(
      payment.created_at <= anchor,
      'payment',
      `payment ${payment.id} was created after the canonical seed anchor`,
    );
    check(
      Boolean(userById.get(payment.user_id)),
      'foreign-keys',
      `payment ${payment.id} references a missing user`,
    );
    check(
      (payment.provider === 'paymongo') === Boolean(payment.provider_ref),
      'payment',
      `payment ${payment.id} has inconsistent provider reference metadata`,
    );
    check(
      Boolean(payment.idempotency_key),
      'payment',
      `payment ${payment.id} is missing its idempotency key`,
    );
    if (payment.status === PaymentStatus.completed) {
      check(
        payment.verified_at !== null &&
          payment.verified_by !== null &&
          payment.verified_at >= payment.created_at &&
          payment.verified_at <= anchor,
        'payment',
        `completed payment ${payment.id} is missing a valid verification trail`,
      );
    }
    if (payment.status === PaymentStatus.awaiting_verification) {
      check(
        payment.verified_at === null && payment.verified_by === null,
        'payment',
        `awaiting payment ${payment.id} has verifier metadata`,
      );
    }
    if (payment.status === PaymentStatus.failed) {
      check(
        Boolean(payment.rejection_reason),
        'payment',
        `failed payment ${payment.id} has no rejection reason`,
      );
      check(
        payment.verified_at === null && payment.verified_by === null,
        'payment',
        `failed payment ${payment.id} has verifier metadata`,
      );
    }
    if (payment.payable_type !== PayableType.commerce_checkout_hold) {
      check(
        payment.status === PaymentStatus.completed &&
          payment.payment_stage === PaymentStage.full,
        'payment',
        `product payment ${payment.id} is not settled as one full completed payment`,
      );
    }
  }

  for (const account of ctx.state.accounts) {
    const userId = ctx.state.userIds[account.key];
    const user = userById.get(userId);
    const identity = identityByUser.get(userId);
    const subscription = subscriptionsByUser
      .get(userId)
      ?.find(
        (candidate) =>
          candidate.id === seedId(`subscription:${account.key}:current`),
    );
    const card = cardByUser.get(userId);
    check(Boolean(user), 'accounts', `${account.key} is missing`);
    if (!user) {
      continue;
    }
    check(
      user.role === account.role,
      'accounts',
      `${account.key} has the wrong role`,
    );
    check(
      Boolean(user.profile),
      'accounts',
      `${account.key} is missing a profile`,
    );
    check(
      Boolean(identity?.credential_hash) &&
        (await bcrypt.compare(
          DYNAMIC_SEED_PASSWORDS[account.role],
          identity?.credential_hash ?? '',
        )),
      'accounts',
      `${account.key} does not have the documented bcrypt credential`,
    );
    if (account.memberPersona) {
      const requiresPaidMembership =
        account.memberPersona !== 'pending' &&
        account.memberPersona !== 'unverified';
      if (requiresPaidMembership) {
        check(
          Boolean(card),
          'membership',
          `${account.key} is missing a membership card`,
        );
        check(
          Boolean(subscription),
          'membership',
          `${account.key} is missing a current subscription`,
        );
        check(
          subscription?.status ===
            EXPECTED_SUBSCRIPTION_STATUS[account.memberPersona],
          'membership',
          `${account.key} has a contradictory subscription status`,
        );
      } else {
        check(
          !card && !subscription,
          'membership',
          `${account.key} has a product despite lacking a paid membership`,
        );
        check(
          (holdsByUser.get(userId) ?? []).some(
            (hold) =>
              isLegalCheckoutHoldEvidence(
                {
                  status: hold.status,
                  expiresAt: hold.expires_at,
                  failureReason: hold.failure_reason,
                  productReferences: checkoutHoldProductReferences(hold),
                },
                anchor,
              ),
          ),
          'checkout-hold',
          `${account.key} has no checkout hold explaining the failed membership attempt`,
        );
      }
    }
    if (account.key === 'member-active') {
      check(
        user.status === 'active' && user.email_verified_at !== null,
        'scenario',
        'member-active is not active and verified for monthly checkout eligibility',
      );
      check(
        plans.every((plan) => plan.member_id !== userId),
        'scenario',
        'member-active is already enrolled in a recurring Ridge coaching plan',
      );
      check(
        relationships.every(
          (relationship) =>
            relationship.member_id !== userId ||
            relationship.status !== RelationshipStatus.active,
        ),
        'scenario',
        'member-active has a live Ridge coaching relationship',
      );
      check(
        !(holdsByUser.get(userId) ?? []).some(
          (hold) => hold.status === CommerceCheckoutHoldStatus.held,
        ),
        'scenario',
        'member-active has a live checkout hold that blocks monthly eligibility',
      );
    }
    if (account.key === 'member-checkout-abandoned') {
      const abandonedHolds = holdsByUser.get(userId) ?? [];
      const abandonedProductPayments = payments.filter(
        (payment) =>
          payment.user_id === userId &&
          payment.payable_type !== PayableType.commerce_checkout_hold,
      );
      const abandonedHold = abandonedHolds[0];
      const abandonedHoldPayment = abandonedHold?.payment_id
        ? payments.find((payment) => payment.id === abandonedHold.payment_id)
        : undefined;
      check(
        user.status === 'active' && user.email_verified_at !== null,
        'scenario',
        'checkout-abandoned member is not active and verified',
      );
      check(
        account.memberPersona === undefined,
        'scenario',
        'checkout-abandoned member unexpectedly has a member persona',
      );
      check(
        !card && !subscription,
        'scenario',
        'checkout-abandoned member has a membership product',
      );
      check(
        abandonedProductPayments.length === 0,
        'scenario',
        'checkout-abandoned member has a product payment',
      );
      check(
        abandonedHolds.length === 1 &&
          (abandonedHold?.status === CommerceCheckoutHoldStatus.failed ||
            abandonedHold?.status === CommerceCheckoutHoldStatus.expired) &&
          Boolean(abandonedHold.failure_reason) &&
          checkoutHoldProductReferences(abandonedHold).every(
            (reference) => reference === null,
          ),
        'scenario',
        'checkout-abandoned member does not have exactly one terminal hold with no product references',
      );
      check(
        abandonedHoldPayment?.provider === 'paymongo' &&
          abandonedHoldPayment.status === PaymentStatus.failed &&
          abandonedHoldPayment.payment_stage === PaymentStage.full,
        'scenario',
        'checkout-abandoned hold is not backed by a failed full PayMongo payment',
      );
    }
    if (account.memberPersona === 'archived') {
      check(
        user.deletedAt !== null && user.deletedAt < anchor,
        'accounts',
        `${account.key} is not archived before the canonical anchor`,
      );
    }
    if (account.memberPersona === 'unverified') {
      check(
        user.status === 'pending' && user.email_verified_at === null,
        'accounts',
        `${account.key} is not pending/unverified`,
      );
    }
    if (account.memberPersona === 'suspended') {
      check(
        user.status === 'suspended' &&
          card?.status === MembershipCardStatus.revoked,
        'accounts',
        `${account.key} is not suspended with a revoked card`,
      );
    }
  }

  const roleCounts = new Map<string, number>();
  for (const account of ctx.state.accounts) {
    roleCounts.set(account.role, (roleCounts.get(account.role) ?? 0) + 1);
  }
  check(
    ctx.state.accounts.length === ctx.config.users,
    'accounts',
    `seeded ${ctx.state.accounts.length} users instead of target ${ctx.config.users}`,
  );
  if (ctx.config.users === 100) {
    for (const [role, target] of Object.entries({
      admin: 3,
      staff: 8,
      coach: 16,
      member: 73,
    })) {
      check(
        (roleCounts.get(role) ?? 0) === target,
        'accounts',
        `role ${role} count is ${roleCounts.get(role) ?? 0}, expected ${target}`,
      );
    }
  }

  for (const subscription of subscriptions) {
    check(
      subscription.starts_at !== null && subscription.starts_at <= anchor,
      'dates',
      `subscription ${subscription.id} starts after the seed anchor`,
    );
    check(
      subscription.status === SubscriptionStatus.active ||
        subscription.status === SubscriptionStatus.suspended ||
        subscription.status === SubscriptionStatus.expired,
      'membership',
      `subscription ${subscription.id} uses a forbidden product status`,
    );
    if (subscription.status === SubscriptionStatus.active) {
      check(
        subscription.starts_at !== null &&
          subscription.expires_at !== null &&
          subscription.expires_at > anchor,
        'dates',
        `accessible subscription ${subscription.id} is outside its enrollment window`,
      );
    }
    if (subscription.status === SubscriptionStatus.expired) {
      check(
        subscription.expires_at !== null && subscription.expires_at < anchor,
        'dates',
        `expired subscription ${subscription.id} has not expired`,
      );
    }
    const subscriptionPayment = paymentByPayable.get(
      `${PayableType.subscription}:${subscription.id}`,
    )?.[0];
    check(
      Boolean(subscriptionPayment),
      'payment',
      `subscription ${subscription.id} has no payment record`,
    );
    if (subscriptionPayment) {
      check(
        subscriptionPayment.status === PaymentStatus.completed &&
          subscriptionPayment.payment_stage === PaymentStage.full &&
          sameMoney(subscriptionPayment.amount, subscription.plan.price),
        'payment',
        `subscription ${subscription.id} is not backed by a full plan payment`,
      );
    }
  }

  for (const card of cards) {
    if (card.status === MembershipCardStatus.active) {
      check(
        card.verified_at !== null &&
          card.verified_by !== null &&
          card.activated_at !== null,
        'membership',
        `active card ${card.id} is missing verification/activation`,
      );
    }
    if (card.status === MembershipCardStatus.revoked) {
      check(
        card.revoked_at !== null &&
          card.verified_at !== null &&
          card.activated_at !== null &&
          card.revoked_at >= card.activated_at &&
          card.revoked_at <= anchor,
        'membership',
        `revoked card ${card.id} has contradictory lifecycle fields`,
      );
    }
    const cardPayment = paymentByPayable.get(
      `${PayableType.membership_card}:${card.id}`,
    )?.[0];
    check(
      Boolean(cardPayment),
      'payment',
      `membership card ${card.id} has no payment record`,
    );
    if (cardPayment) {
      check(
        cardPayment.status === PaymentStatus.completed &&
          cardPayment.payment_stage === PaymentStage.full &&
          sameMoney(cardPayment.amount, card.price),
        'payment',
        `membership card ${card.id} is not backed by a full card payment`,
      );
    }
  }

  const amenityCapacity = new Map(
    amenities.map((amenity) => [amenity.id, amenity.capacity]),
  );
  for (const booking of bookings) {
    check(
      booking.starts_at < booking.ends_at &&
        booking.starts_at.toISOString().slice(0, 10) ===
          booking.ends_at.toISOString().slice(0, 10),
      'dates',
      `booking ${booking.id} has an invalid time window`,
    );
    check(
      money(booking.total_amount) > 0 &&
        money(booking.downpayment_amount) === 0 &&
        money(booking.balance_amount) === 0,
      'derived-fields',
      `booking ${booking.id} does not expose a positive full-payment total`,
    );
    check(
      money(booking.downpayment_amount) === 0 &&
        money(booking.balance_amount) === 0 &&
        booking.downpayment_paid_at === null &&
        booking.balance_paid_at !== null,
      'payment',
      `booking ${booking.id} exposes a partial-payment state`,
    );
    check(
      booking.created_at <= booking.starts_at,
      'dates',
      `booking ${booking.id} was created after its scheduled start`,
    );
    if (ACTIVE_BOOKING_STATUSES.has(booking.status)) {
      check(
        booking.starts_at >= anchor,
        'dates',
        `active booking ${booking.id} is in the past`,
      );
      check(
        booking.cancelled_at === null && booking.completed_at === null,
        'status',
        `active booking ${booking.id} has terminal timestamps`,
      );
    } else {
      check(
        booking.starts_at < anchor,
        'dates',
        `terminal booking ${booking.id} is not historical`,
      );
    }
    if (booking.status === BookingStatus.completed) {
      check(
        booking.completed_at !== null &&
          booking.completed_at >= booking.ends_at,
        'status',
        `completed booking ${booking.id} lacks completion evidence`,
      );
    }
    if (booking.status === BookingStatus.cancelled) {
      check(
        booking.cancelled_at !== null,
        'status',
        `cancelled booking ${booking.id} lacks cancellation evidence`,
      );
    }
    if (booking.status === BookingStatus.no_show) {
      check(
        booking.completed_at === null && booking.cancelled_at === null,
        'status',
        `no-show booking ${booking.id} has a contradictory terminal timestamp`,
      );
    }
    const bookingPayment = paymentByPayable.get(`booking:${booking.id}`)?.[0];
    check(
      Boolean(bookingPayment),
      'payment',
      `booking ${booking.id} has no payment record`,
    );
    if (bookingPayment) {
      check(
        bookingPayment.status === PaymentStatus.completed &&
          bookingPayment.payment_stage === PaymentStage.full &&
          sameMoney(bookingPayment.amount, booking.total_amount),
        'payment',
        `booking payment ${bookingPayment.id} is not a full completed payment`,
      );
    }
  }

  const activeBookings = bookings.filter((booking) =>
    ACTIVE_BOOKING_STATUSES.has(booking.status),
  );
  const bookingIntervals = activeBookings.map((booking) => ({
    key: booking.amenity_id,
    start: booking.starts_at,
    end: booking.ends_at,
  }));
  check(
    !hasKeyedIntervalOverlap(bookingIntervals),
    'overlap',
    'active venue bookings overlap on the same amenity',
  );
  for (const [amenityId, capacity] of amenityCapacity) {
    const rows = activeBookings
      .filter((booking) => booking.amenity_id === amenityId)
      .sort((left, right) => left.starts_at.getTime() - right.starts_at.getTime());
    for (let index = 0; index < rows.length; index += 1) {
      let concurrent = 1;
      for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        if (rows[cursor].ends_at > rows[index].starts_at) {
          concurrent += 1;
        } else {
          break;
        }
      }
      check(
        concurrent <= capacity,
        'overlap',
        `amenity ${amenityId} exceeds capacity during an active booking window`,
      );
    }
  }

  const coachUserByProfile = new Map(
    coachProfiles.map((profile) => [profile.id, profile.user_id]),
  );
  const availabilityByCoach = new Map<string, typeof availabilitySlots>();
  for (const slot of availabilitySlots) {
    const rows = availabilityByCoach.get(slot.coach_id) ?? [];
    rows.push(slot);
    availabilityByCoach.set(slot.coach_id, rows);
  }
  const planById = new Map(plans.map((plan) => [plan.id, plan]));
  const trainingPlanById = new Map(
    trainingPlans.map((plan) => [plan.id, plan]),
  );
  const scheduleItemById = new Map(
    scheduleItems.map((scheduleItem) => [scheduleItem.id, scheduleItem]),
  );
  const scheduleDaysByPlan = new Map<string, typeof scheduleDays>();
  for (const day of scheduleDays) {
    const rows = scheduleDaysByPlan.get(day.plan_id) ?? [];
    rows.push(day);
    scheduleDaysByPlan.set(day.plan_id, rows);
  }
  const relationshipByKey = new Map(
    relationships.map((relationship) => [
      `${relationship.coach_id}:${relationship.member_id}`,
      relationship,
    ]),
  );
  const appointmentsByPlan = new Map<string, typeof appointments>();
  for (const appointment of appointments) {
    const end = new Date(
      appointment.scheduled_at.getTime() +
        appointment.duration_minutes * 60_000,
    );
    check(
      appointment.created_at <= appointment.scheduled_at,
      'dates',
      `appointment ${appointment.id} was created after its scheduled start`,
    );
    check(
      money(appointment.downpayment_amount) === 0 &&
        money(appointment.balance_amount) === 0 &&
        appointment.downpayment_paid_at === null &&
        appointment.balance_paid_at !== null,
      'payment',
      `appointment ${appointment.id} exposes a partial-payment state`,
    );
    if (ACTIVE_APPOINTMENT_STATUSES.has(appointment.status)) {
      check(
        appointment.scheduled_at >= anchor,
        'dates',
        `active appointment ${appointment.id} is in the past`,
      );
      check(
        appointment.completed_at === null &&
          appointment.cancelled_at === null &&
          appointment.no_show_at === null,
        'status',
        `active appointment ${appointment.id} has terminal timestamps`,
      );
    } else {
      check(
        appointment.scheduled_at < anchor,
        'dates',
        `terminal appointment ${appointment.id} is not historical`,
      );
    }
    if (appointment.status === AppointmentStatus.completed) {
      check(
        appointment.completed_at !== null && appointment.completed_at >= end,
        'status',
        `completed appointment ${appointment.id} lacks completion evidence`,
      );
    }
    if (appointment.status === AppointmentStatus.cancelled) {
      check(
        appointment.cancelled_at !== null,
        'status',
        `cancelled appointment ${appointment.id} lacks cancellation evidence`,
      );
    }
    if (appointment.status === AppointmentStatus.no_show) {
      check(
        appointment.no_show_at !== null &&
          appointment.no_show_at >= appointment.scheduled_at,
        'status',
        `no-show appointment ${appointment.id} lacks no-show evidence`,
      );
    }
    const availability = availabilityByCoach.get(appointment.coach_id) ?? [];
    const startMinutes = timeMinutes(appointment.scheduled_at);
    const endMinutes = startMinutes + appointment.duration_minutes;
    check(
      availability.some(
        (slot) =>
          slot.is_active &&
          slot.day_of_week === appointment.scheduled_at.getUTCDay() &&
          timeMinutes(slot.start_time) <= startMinutes &&
          timeMinutes(slot.end_time) >= endMinutes,
      ),
      'availability',
      `appointment ${appointment.id} falls outside coach availability`,
    );
    if (appointment.recurring_plan_id) {
      const rows = appointmentsByPlan.get(appointment.recurring_plan_id) ?? [];
      rows.push(appointment);
      appointmentsByPlan.set(appointment.recurring_plan_id, rows);
      const plan = planById.get(appointment.recurring_plan_id);
      check(
        Boolean(plan),
        'foreign-keys',
        `appointment ${appointment.id} has no recurring plan`,
      );
      if (plan) {
        const relationship = relationshipByKey.get(
          `${appointment.coach_id}:${appointment.user_id}`,
        );
        check(
          Boolean(relationship),
          'domain',
          `appointment ${appointment.id} has no coach/client relationship`,
        );
        if (relationship) {
          check(
            appointment.scheduled_at >= anchor
              ? relationship.status === RelationshipStatus.active
              : relationship.status === RelationshipStatus.active ||
                relationship.status === RelationshipStatus.terminated,
            'domain',
            `appointment ${appointment.id} uses a relationship with an invalid lifecycle state`,
          );
        }
        check(
          plan.member_id === appointment.user_id &&
            plan.coach_id === appointment.coach_id,
          'domain',
          `appointment ${appointment.id} disagrees with its recurring plan owner`,
        );
        check(
          appointment.scheduled_at >= plan.start_date &&
            appointment.scheduled_at <=
              new Date(plan.end_date.getTime() + 86_399_999),
          'dates',
          `appointment ${appointment.id} falls outside enrollment dates`,
        );
      }
      const item = appointment.recurring_schedule_item_id
        ? scheduleItemById.get(appointment.recurring_schedule_item_id)
        : undefined;
      check(
        Boolean(item),
        'dependents',
        `appointment ${appointment.id} has no schedule item`,
      );
      if (item) {
        check(
          item.recurring_plan_id === appointment.recurring_plan_id &&
            item.scheduled_at.getTime() ===
              appointment.scheduled_at.getTime() &&
            sameMoney(item.amount, appointment.total_amount),
          'derived-fields',
          `schedule item ${item.id} disagrees with appointment ${appointment.id}`,
        );
      }
      const coachingPayment = paymentByPayable.get(`coaching:${appointment.id}`)?.[0];
      check(
        Boolean(coachingPayment),
        'payment',
        `appointment ${appointment.id} has no payment`,
      );
      if (coachingPayment) {
        check(
          coachingPayment.status === PaymentStatus.completed &&
            coachingPayment.payment_stage === PaymentStage.full &&
            sameMoney(coachingPayment.amount, appointment.total_amount),
          'payment',
          `appointment ${appointment.id} is not backed by a full completed payment`,
        );
      }
    } else {
      check(
        appointment.recurring_schedule_item_id === null,
        'domain',
        `one-time appointment ${appointment.id} has a recurring schedule item`,
      );
      const coachingPayment = paymentByPayable.get(`coaching:${appointment.id}`)?.[0];
      check(
        Boolean(coachingPayment) &&
          coachingPayment?.status === PaymentStatus.completed &&
          coachingPayment.payment_stage === PaymentStage.full &&
          sameMoney(coachingPayment.amount, appointment.total_amount),
        'payment',
        `one-time appointment ${appointment.id} is not fully paid`,
      );
    }
  }

  const activeAppointments = appointments.filter((appointment) =>
    ACTIVE_APPOINTMENT_STATUSES.has(appointment.status),
  );
  check(
    !hasKeyedIntervalOverlap(
      activeAppointments.map((appointment) => ({
        key: appointment.coach_id,
        start: appointment.scheduled_at,
        end: new Date(
          appointment.scheduled_at.getTime() + appointment.duration_minutes * 60_000,
        ),
      })),
    ),
    'overlap',
    'active coaching appointments overlap on the same coach',
  );
  check(
    !hasKeyedIntervalOverlap([
      ...activeAppointments.map((appointment) => ({
        key: appointment.user_id,
        start: appointment.scheduled_at,
        end: new Date(
          appointment.scheduled_at.getTime() + appointment.duration_minutes * 60_000,
        ),
      })),
      ...activeBookings.map((booking) => ({
        key: booking.user_id,
        start: booking.starts_at,
        end: booking.ends_at,
      })),
    ]),
    'overlap',
    'active member appointments and venue bookings overlap',
  );

  for (const hold of holds) {
    check(
      hold.created_at <= anchor && hold.expires_at >= hold.created_at,
      'checkout-hold',
      `checkout hold ${hold.id} has an invalid creation/expiry timeline`,
    );
    const active = hold.status === CommerceCheckoutHoldStatus.held;
    const terminalFailure =
      hold.status === CommerceCheckoutHoldStatus.failed ||
      hold.status === CommerceCheckoutHoldStatus.expired;
    const productReferences = checkoutHoldProductReferences(hold);
    check(
      isLegalCheckoutHoldEvidence(
        {
          status: hold.status,
          expiresAt: hold.expires_at,
          failureReason: hold.failure_reason,
          productReferences,
        },
        anchor,
      ),
      'checkout-hold',
      `checkout hold ${hold.id} is not a legal active or failed attempt`,
    );
    check(
      active ? hold.expires_at > anchor : terminalFailure ? hold.expires_at <= anchor : true,
      'checkout-hold',
      `checkout hold ${hold.id} has an invalid terminal/active expiry state`,
    );
    if (terminalFailure) {
      check(
        productReferences.every((reference) => reference === null),
        'checkout-hold',
        `terminal checkout hold ${hold.id} created a product reference`,
      );
      check(
        Boolean(hold.failure_reason),
        'checkout-hold',
        `terminal checkout hold ${hold.id} lacks a failure reason`,
      );
    } else {
      check(
        hold.consumed_at === null && hold.released_at === null &&
          hold.failure_reason === null,
        'checkout-hold',
        `active checkout hold ${hold.id} has terminal metadata`,
      );
      if (hold.scheduled_at && hold.ends_at) {
        check(
          hold.scheduled_at < hold.ends_at,
          'dates',
          `active checkout hold ${hold.id} has an invalid schedule`,
        );
      }
      if (hold.amenity_id && hold.scheduled_at && hold.ends_at) {
        check(
          !activeBookings.some(
            (booking) =>
              booking.amenity_id === hold.amenity_id &&
              overlaps(
                booking.starts_at,
                booking.ends_at,
                hold.scheduled_at!,
                hold.ends_at!,
              ),
          ),
          'checkout-hold',
          `active checkout hold ${hold.id} does not block amenity availability`,
        );
      }
      if (hold.scheduled_at && hold.ends_at) {
        check(
          !activeAppointments.some((appointment) => {
            const appointmentEnd = new Date(
              appointment.scheduled_at.getTime() +
                appointment.duration_minutes * 60_000,
            );
            return (
              appointment.user_id === hold.user_id &&
              overlaps(
                appointment.scheduled_at,
                appointmentEnd,
                hold.scheduled_at!,
                hold.ends_at!,
              )
            );
          }),
          'checkout-hold',
          `active checkout hold ${hold.id} does not block member availability`,
        );
      }
    }
    const holdPayment = hold.payment_id
      ? payments.find((payment) => payment.id === hold.payment_id)
      : undefined;
    check(
      Boolean(holdPayment) &&
        holdPayment?.payable_type === PayableType.commerce_checkout_hold &&
        holdPayment.payable_id === hold.id &&
        holdPayment.payment_stage === PaymentStage.full &&
        (active
          ? holdPayment.status === PaymentStatus.pending ||
            holdPayment.status === PaymentStatus.processing
          : holdPayment.status === PaymentStatus.failed),
      'checkout-hold',
      `checkout hold ${hold.id} has an invalid payment state`,
    );
  }

  for (const plan of plans) {
    const rows = appointmentsByPlan.get(plan.id) ?? [];
    const completedCount = rows.filter(
      (appointment) => appointment.status === AppointmentStatus.completed,
    ).length;
    check(
      plan.training_plan_id !== null,
      'dependents',
      `recurring plan ${plan.id} has no authored training plan`,
    );
    check(
      plan.start_date <= plan.end_date &&
        (plan.status === RecurringCoachingPlanStatus.active ||
          plan.status === RecurringCoachingPlanStatus.completed),
      'domain',
      `recurring plan ${plan.id} has an invalid status or date window`,
    );
    if (plan.status === RecurringCoachingPlanStatus.active) {
      check(
        plan.end_date > anchor,
        'dates',
        `active recurring plan ${plan.id} ends before the seed anchor`,
      );
    }
    if (plan.status === RecurringCoachingPlanStatus.completed) {
      check(
        plan.end_date < anchor,
        'dates',
        `completed recurring plan ${plan.id} extends into the future`,
      );
    }
    const relationship = relationshipByKey.get(
      `${plan.coach_id}:${plan.member_id}`,
    );
    check(
      Boolean(relationship) &&
        (relationship?.status === RelationshipStatus.active ||
          relationship?.status === RelationshipStatus.terminated),
      'domain',
      `recurring plan ${plan.id} has no valid paid coach/client relationship`,
    );
    check(
      plan.total_sessions === rows.length &&
        plan.completed_sessions === completedCount,
      'derived-fields',
      `recurring plan ${plan.id} totals are not derived from appointments`,
    );
    if (plan.training_plan_id) {
      const trainingPlan = trainingPlanById.get(plan.training_plan_id);
      check(
        Boolean(trainingPlan),
        'foreign-keys',
        `recurring plan ${plan.id} points to a missing plan`,
      );
      if (trainingPlan) {
        check(
          trainingPlan.source === PlanSource.coach_assigned &&
            trainingPlan.user_id === plan.member_id &&
            trainingPlan.coach_id === coachUserByProfile.get(plan.coach_id),
          'domain',
          `recurring plan ${plan.id} points to a mismatched authored plan`,
        );
        check(
          (scheduleDaysByPlan.get(trainingPlan.id) ?? []).length > 0,
          'dependents',
          `authored plan ${trainingPlan.id} has no exercise-bearing schedule day`,
        );
      }
    }
    const items = scheduleItems.filter(
      (item) => item.recurring_plan_id === plan.id,
    );
    check(
      items.length === rows.length,
      'dependents',
      `recurring plan ${plan.id} schedule count disagrees with appointments`,
    );
    for (const item of items) {
      const appointment = rows.find(
        (candidate) => candidate.recurring_schedule_item_id === item.id,
      );
      check(
        item.status !== RecurringCoachingScheduleItemStatus.pending_payment &&
          Boolean(appointment),
        'dependents',
        `schedule item ${item.id} is pending or detached from an appointment`,
      );
      if (appointment) {
        check(
          sameMoney(item.amount, appointment.total_amount) &&
            item.scheduled_at.getTime() === appointment.scheduled_at.getTime() &&
            item.status ===
              (appointment.status === AppointmentStatus.cancelled
                ? RecurringCoachingScheduleItemStatus.cancelled
                : RecurringCoachingScheduleItemStatus.activated),
          'derived-fields',
          `schedule item ${item.id} disagrees with appointment lifecycle`,
        );
      }
    }
    for (const cycle of billingCycles.filter(
      (candidate) => candidate.recurring_plan_id === plan.id,
    )) {
      check(
        cycle.cycle_start_date <= cycle.cycle_end_date,
        'dates',
        `billing cycle ${cycle.recurring_plan_id} has reversed dates`,
      );
      if (cycle.status === RecurringCoachingBillingCycleStatus.paid) {
        check(
          cycle.paid_at !== null &&
            cycle.payment_id !== null &&
            cycle.paid_at <= anchor &&
            cycle.amount.equals(plan.quoted_amount),
          'payment',
          `paid billing cycle ${cycle.recurring_plan_id} lacks payment evidence`,
        );
      }
      check(
        cycle.status === RecurringCoachingBillingCycleStatus.paid,
        'payment',
        `billing cycle ${cycle.recurring_plan_id} is not fully settled`,
      );
      const cyclePayment = cycle.payment_id
        ? payments.find((payment) => payment.id === cycle.payment_id)
        : undefined;
      check(
        Boolean(cyclePayment) &&
          cyclePayment?.status === PaymentStatus.completed &&
          cyclePayment.payment_stage === PaymentStage.full &&
          sameMoney(cyclePayment.amount, cycle.amount),
        'payment',
        `billing cycle ${cycle.recurring_plan_id} has no matching full payment`,
      );
    }
    check(
      billingCycles.filter((candidate) => candidate.recurring_plan_id === plan.id)
        .length >= 1,
      'dependents',
      `recurring plan ${plan.id} has no paid enrollment cycle`,
    );
  }

  for (const appointment of appointments) {
    const assignment = assignments.find(
      (candidate) => candidate.appointment_id === appointment.id,
    );
    if (!appointment.recurring_plan_id) {
      continue;
    }
    check(
      Boolean(assignment),
      'dependents',
      `appointment ${appointment.id} has no workout assignment`,
    );
    if (assignment) {
      check(
        Boolean(trainingPlanById.get(assignment.training_plan_id)) &&
          Boolean(
            scheduleDays.find(
              (day) => day.id === assignment.training_schedule_day_id,
            ),
          ),
        'foreign-keys',
        `assignment ${assignment.id} points outside the authored plan`,
      );
      if (assignment.state === 'completed') {
        check(
          assignment.workout_session_id !== null &&
            assignment.completed_at !== null,
          'dependents',
          `completed assignment ${assignment.id} lacks a completed workout`,
        );
      }
      check(
        assignment.state === 'assigned' ||
          assignment.state === 'completed' ||
          assignment.state === 'skipped',
        'domain',
        `assignment ${assignment.id} uses a forbidden state`,
      );
    } else {
      check(
        appointment.status === AppointmentStatus.cancelled ||
          appointment.status === AppointmentStatus.no_show ||
          appointment.status === AppointmentStatus.completed,
        'dependents',
        `non-terminal appointment ${appointment.id} has no assignment`,
      );
    }
  }

  const authoredRecurringPlanIds = new Set(
    plans
      .map((plan) => plan.training_plan_id)
      .filter((planId): planId is string => planId !== null),
  );
  for (const trainingPlan of trainingPlans) {
    if (trainingPlan.source === PlanSource.coach_assigned) {
      const isOneTimeQaPlan =
        trainingPlan.id === seedId('training-plan:member-active') &&
        assignments.some((assignment) => {
          const appointment = appointments.find(
            (candidate) => candidate.id === assignment.appointment_id,
          );
          return (
            appointment?.user_id === userIdFor('member-active') &&
            assignment.training_plan_id === trainingPlan.id &&
            assignment.state === 'assigned'
          );
        });
      check(
        authoredRecurringPlanIds.has(trainingPlan.id) || isOneTimeQaPlan,
        'domain',
        `coach-assigned plan ${trainingPlan.id} has no paid recurring coaching contract`,
      );
      check(
        trainingPlan.coach_id !== null,
        'domain',
        `coach-assigned plan ${trainingPlan.id} has no coach owner`,
      );
    }
    if (trainingPlan.source !== PlanSource.coach_assigned) {
      check(
        trainingPlan.coach_id === null,
        'domain',
        `personal plan ${trainingPlan.id} is coupled to a coach`,
      );
    }
  }

  const sessionById = new Map(
    workoutSessions.map((session) => [session.id, session]),
  );
  for (const session of workoutSessions) {
    if (session.status === 'completed') {
      check(
        session.completed_at !== null &&
          session.started_at < session.completed_at &&
          session.completed_at <= anchor,
        'dates',
        `completed workout ${session.id} has an invalid lifecycle`,
      );
    }
  }
  for (const log of exerciseLogs) {
    const session = sessionById.get(log.session_id);
    check(
      Boolean(session) && session?.user_id === log.user_id,
      'foreign-keys',
      `exercise log ${log.session_id} has no matching workout owner`,
    );
    if (session) {
      check(
        log.created_at >= session.started_at && log.created_at <= anchor,
        'dates',
        `exercise log ${log.session_id} falls outside its workout timeline`,
      );
    }
  }

  const itemsBySale = new Map<string, typeof saleItems>();
  for (const item of saleItems) {
    const rows = itemsBySale.get(item.transaction_id) ?? [];
    rows.push(item);
    itemsBySale.set(item.transaction_id, rows);
  }
  for (const sale of sales) {
    const total = (itemsBySale.get(sale.id) ?? []).reduce(
      (sum, item) => sum + money(item.subtotal),
      0,
    );
    check(
      sameMoney(sale.total_amount, total),
      'derived-fields',
      `sale ${sale.id} total disagrees with line items`,
    );
    const salePayment = paymentByPayable.get(`product:${sale.id}`)?.[0];
    check(Boolean(salePayment), 'payment', `sale ${sale.id} has no payment`);
    if (salePayment) {
      check(
        sale.status === 'completed' &&
          salePayment.status === PaymentStatus.completed &&
          salePayment.payment_stage === PaymentStage.full &&
          sameMoney(salePayment.amount, sale.total_amount),
        'payment',
        `sale ${sale.id} is not backed by a full completed payment`,
      );
    }
  }

  for (const item of evidence) {
    check(
      item.status === 'pending'
        ? item.reviewed_at === null && item.reviewed_by_user_id === null
        : item.reviewed_at !== null && item.reviewed_by_user_id !== null,
      'dependents',
      `milestone evidence ${item.milestone_progress_id ?? 'without progress'} has an invalid review state`,
    );
  }

  const activeMemberId = userIdFor('member-active');
  const premiumMemberId = userIdFor('member-premium');
  const expiredMemberId = userIdFor('member-expired');
  const ridgeCoachProfileId = seedId('coach-profile:coach');
  const activeMemberAppointments = appointments.filter(
    (appointment) => appointment.user_id === activeMemberId,
  );
  const activeOneTimeAppointment = activeMemberAppointments.find(
    (appointment) => appointment.recurring_plan_id === null,
  );
  const activeOneTimeAssignment = activeOneTimeAppointment
    ? assignments.find(
        (assignment) => assignment.appointment_id === activeOneTimeAppointment.id,
      )
    : undefined;
  const activeAssignmentPlan = activeOneTimeAssignment
    ? trainingPlanById.get(activeOneTimeAssignment.training_plan_id)
    : undefined;
  const activeAssignmentDay = activeOneTimeAssignment
    ? scheduleDays.find(
        (day) => day.id === activeOneTimeAssignment.training_schedule_day_id,
      )
    : undefined;
  const premiumRecurringPlan = plans.find(
    (plan) =>
      plan.id === seedId('recurring-plan:member-premium') &&
      plan.member_id === premiumMemberId,
  );
  const premiumTrainingPlan = premiumRecurringPlan?.training_plan_id
    ? trainingPlanById.get(premiumRecurringPlan.training_plan_id)
    : undefined;
  const premiumScheduleDays = premiumTrainingPlan
    ? scheduleDays.filter(
        (day) => day.plan_id === premiumTrainingPlan.id && day.exercises.length > 0,
      )
    : [];
  const premiumFutureSessions = appointments.filter(
    (appointment) =>
      appointment.user_id === premiumMemberId &&
      appointment.recurring_plan_id === premiumRecurringPlan?.id &&
      appointment.status === AppointmentStatus.confirmed &&
      appointment.scheduled_at >= anchor,
  );
  const premiumFeedbackSession = appointments.find(
    (appointment) =>
      appointment.user_id === premiumMemberId &&
      appointment.status === AppointmentStatus.completed &&
      coachReviews.some(
        (review) =>
          review.appointment_id === appointment.id &&
          review.coach_id === ridgeCoachProfileId &&
          review.reviewer_id === premiumMemberId,
      ),
  );
  const checkoutAbandonedMemberId = userIdFor('member-checkout-abandoned');
  const checkoutAbandonedHolds = holds.filter(
    (hold) => hold.user_id === checkoutAbandonedMemberId,
  );
  const checkoutAbandonedProductPayments = payments.filter(
    (payment) =>
      payment.user_id === checkoutAbandonedMemberId &&
      payment.payable_type !== PayableType.commerce_checkout_hold,
  );
  check(
    activeMemberAppointments.length === 1 &&
      activeOneTimeAppointment?.status === AppointmentStatus.confirmed &&
      activeOneTimeAppointment.scheduled_at >= anchor &&
      activeOneTimeAppointment.coach_id === ridgeCoachProfileId &&
      activeOneTimeAppointment.recurring_plan_id === null,
    'scenario',
    'member-active does not have exactly one future non-recurring Ridge appointment',
  );
  check(
    Boolean(activeOneTimeAppointment) &&
      Boolean(
        paymentByPayable.get(`coaching:${activeOneTimeAppointment?.id}`)?.some(
          (payment) =>
            payment.status === PaymentStatus.completed &&
            payment.payment_stage === PaymentStage.full &&
            sameMoney(payment.amount, activeOneTimeAppointment?.total_amount),
        ),
      ),
    'scenario',
    'member-active one-time Ridge appointment is not fully paid',
  );
  check(
    Boolean(activeOneTimeAssignment) &&
      activeOneTimeAssignment?.state === 'assigned' &&
      activeOneTimeAssignment.source === 'coach_override' &&
      activeOneTimeAssignment.sequence_index === 0 &&
      activeOneTimeAssignment.held_at === null &&
      activeAssignmentPlan?.source === PlanSource.coach_assigned &&
      activeAssignmentPlan.coach_id === userIdFor('coach') &&
      activeAssignmentPlan.user_id === activeMemberId &&
      activeAssignmentPlan.duration_weeks === 1 &&
      activeAssignmentDay?.week_number === 1,
    'scenario',
    'member-active one-time Ridge appointment does not have its limited one-week coach assignment',
  );
  check(
    Boolean(premiumRecurringPlan) &&
      premiumRecurringPlan?.status === RecurringCoachingPlanStatus.active &&
      premiumRecurringPlan.frequency === RecurringCoachingFrequency.monthly &&
      premiumRecurringPlan.coach_id === ridgeCoachProfileId &&
      premiumRecurringPlan.member_id === premiumMemberId &&
      relationships.some(
        (relationship) =>
          relationship.coach_id === ridgeCoachProfileId &&
          relationship.member_id === premiumMemberId &&
          relationship.status === RelationshipStatus.active,
      ),
    'scenario',
    'member-premium is missing an active monthly Ridge coaching contract',
  );
  check(
    Boolean(premiumRecurringPlan) &&
      billingCycles.some(
        (cycle) =>
          cycle.recurring_plan_id === premiumRecurringPlan?.id &&
          cycle.status === RecurringCoachingBillingCycleStatus.paid &&
          cycle.payment_id !== null,
      ),
    'scenario',
    'member-premium is missing a paid Ridge billing cycle',
  );
  check(
    premiumFutureSessions.length > 0 &&
      premiumFutureSessions.every((appointment) =>
        paymentByPayable
          .get(`coaching:${appointment.id}`)
          ?.some(
            (payment) =>
              payment.status === PaymentStatus.completed &&
              payment.payment_stage === PaymentStage.full &&
              sameMoney(payment.amount, appointment.total_amount),
          ),
      ),
    'scenario',
    'member-premium is missing a future confirmed paid Ridge session',
  );
  check(
    premiumTrainingPlan?.source === PlanSource.coach_assigned &&
      premiumTrainingPlan.coach_id === userIdFor('coach') &&
      premiumTrainingPlan.duration_weeks === 8 &&
      [1, 2, 3, 4, 5, 6, 7, 8].every((weekNumber) =>
        premiumScheduleDays.some((day) => day.week_number === weekNumber),
      ),
    'scenario',
    'member-premium Ridge program is not an authored eight-week plan with populated recurrence weeks',
  );
  check(
    Boolean(premiumFeedbackSession),
    'scenario',
    'member-premium is missing a completed Ridge feedback session',
  );
  check(
    Boolean(userById.get(ctx.state.userIds[ctx.state.adminKeys[0]])) &&
      Boolean(userById.get(ctx.state.userIds[ctx.state.staffKeys[0]])) &&
      premiumFutureSessions.some((appointment) =>
        paymentByPayable.get(`coaching:${appointment.id}`)?.some(
          (payment) => payment.status === PaymentStatus.completed,
        ),
      ),
    'scenario',
    'admin/staff seeded accounts cannot see a selected paid Ridge session',
  );
  check(
    activeMemberAppointments.some(
      (appointment) =>
        ACTIVE_APPOINTMENT_STATUSES.has(appointment.status) &&
        appointment.scheduled_at >= anchor,
    ),
    'scenario',
    'has-upcoming fixture is missing for member-active',
  );
  check(
    !appointments.some(
      (appointment) =>
        appointment.user_id === expiredMemberId &&
        ACTIVE_APPOINTMENT_STATUSES.has(appointment.status) &&
        appointment.scheduled_at >= anchor,
    ),
    'scenario',
    'no-upcoming fixture is missing for member-expired',
  );
  check(
    checkoutAbandonedHolds.length === 1 &&
      (checkoutAbandonedHolds[0]?.status === CommerceCheckoutHoldStatus.failed ||
        checkoutAbandonedHolds[0]?.status === CommerceCheckoutHoldStatus.expired) &&
      Boolean(checkoutAbandonedHolds[0]?.failure_reason) &&
      checkoutHoldProductReferences(checkoutAbandonedHolds[0]!).every(
        (reference) => reference === null,
      ) &&
      checkoutAbandonedProductPayments.length === 0,
    'scenario',
    'checkout-abandoned member does not have the exact terminal no-product scenario',
  );

  const usageCounts = new Map<string, Record<string, number>>();
  const incrementUsage = (domain: VolumeDomain, userId: string) => {
    const countsForUser = usageCounts.get(userId) ?? {};
    countsForUser[domain] = (countsForUser[domain] ?? 0) + 1;
    usageCounts.set(userId, countsForUser);
  };
  for (const row of workoutSessions) incrementUsage('workouts', row.user_id);
  for (const row of exerciseLogs) incrementUsage('exerciseLogs', row.user_id);
  for (const row of nutritionLogs) incrementUsage('nutrition', row.user_id);
  for (const row of attendance) incrementUsage('attendance', row.user_id);
  for (const row of bookings) incrementUsage('bookings', row.user_id);
  for (const row of notifications) incrementUsage('notifications', row.user_id);
  for (const row of appointments) incrementUsage('appointments', row.user_id);
  for (const row of progressionSources) incrementUsage('progressionSources', row.user_id);
  for (const row of progressionGrants) incrementUsage('grants', row.user_id);
  for (const row of sales) {
    if (row.customer_user_id) incrementUsage('sales', row.customer_user_id);
  }
  const aiSessionOwner = new Map(aiSessions.map((session) => [session.id, session.user_id]));
  const gymSessionOwner = new Map(gymChatSessions.map((session) => [session.id, session.user_id]));
  for (const row of aiMessages) {
    const userId = aiSessionOwner.get(row.session_id);
    if (userId) incrementUsage('chats', userId);
  }
  for (const row of gymChatMessages) {
    const userId = gymSessionOwner.get(row.session_id);
    if (userId) incrementUsage('chats', userId);
  }
  for (const account of ctx.state.accounts.filter((candidate) => candidate.role === 'member')) {
    const userId = ctx.state.userIds[account.key];
    const actualForUser = usageCounts.get(userId) ?? {};
    for (const domain of Object.keys(HARD_CAPS) as VolumeDomain[]) {
      check(
        (actualForUser[domain] ?? 0) <= HARD_CAPS[domain],
        'caps',
        `${account.key} exceeds ${domain} hard cap ${HARD_CAPS[domain]}`,
      );
    }
  }

  for (const [model, status] of Object.entries(MODEL_COVERAGE)) {
    check(
      status !== 'seeded' || (counts[model] ?? 0) > 0,
      'model-coverage',
      `model ${model} is classified as seeded but has no rows`,
    );
  }

  const volumeDomains: VolumeDomain[] = [
    'workouts',
    'exerciseLogs',
    'nutrition',
    'attendance',
    'bookings',
    'notifications',
    'chats',
    'appointments',
    'progressionSources',
    'grants',
    'sales',
  ];
  const actuals: Record<string, number> = {
    workouts: workoutSessions.length,
    exerciseLogs: exerciseLogs.length,
    nutrition: nutritionLogs.length,
    attendance: attendance.length,
    bookings: bookings.length,
    notifications: notifications.length,
    chats: gymChatMessages.length + aiMessages.length,
    appointments: appointments.length,
    progressionSources: progressionSources.length,
    grants: progressionGrants.length,
    sales: sales.length,
  };
  const caps: Record<string, number> = { ...HARD_CAPS };
  const cohortKeys: Array<keyof typeof COHORT_COUNTS> = [
    'power',
    'frequent',
    'regular',
    'light_trial',
    'historical_only',
    'pending_unverified_suspended',
  ];
  const targets: Record<string, number> = {};
  for (const cohort of cohortKeys) {
    targets[`cohort:${cohort}`] = COHORT_COUNTS[cohort];
  }
  for (const domain of volumeDomains) {
    targets[domain] = ctx.state.memberKeys.reduce(
      (total, memberKey) => total + volumeBandForMember(ctx, memberKey)[domain],
      0,
    );
  }
  const buildCohort = (cohort: keyof typeof COHORT_COUNTS) => ({
    actual: ctx.state.memberKeys.filter(
      (memberKey) => cohortForMember(ctx, memberKey) === cohort,
    ).length,
    target: COHORT_COUNTS[cohort],
    actuals: volumeDomains.reduce<Record<string, number>>(
      (cohortActuals, domain) => {
        cohortActuals[domain] = ctx.state.memberKeys
          .filter((memberKey) => cohortForMember(ctx, memberKey) === cohort)
          .reduce(
            (total, memberKey) =>
              total +
              (usageCounts.get(ctx.state.userIds[memberKey])?.[domain] ?? 0),
            0,
          );
        return cohortActuals;
      },
      {},
    ),
    caps: { ...caps },
  });
  const cohorts: DynamicSeedIntegritySummary['cohorts'] = {
    power: buildCohort('power'),
    frequent: buildCohort('frequent'),
    regular: buildCohort('regular'),
    light_trial: buildCohort('light_trial'),
    historical_only: buildCohort('historical_only'),
    pending_unverified_suspended: buildCohort('pending_unverified_suspended'),
  };

  const outcome: DynamicSeedIntegritySummary = {
    actuals,
    caps,
    checks,
    cohorts,
    scenarioMatrix: SEED_SCENARIO_MATRIX,
    status: violations.length > 0 ? 'failed' : 'passed',
    summary: categoryCounts,
    targets,
    violations,
  };
  if (violations.length > 0) {
    throw new SeedIntegrityError(outcome);
  }
  return outcome;
}
