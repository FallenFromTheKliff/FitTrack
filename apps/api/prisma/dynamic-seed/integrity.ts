import {
  AppointmentStatus,
  AuthProvider,
  CommerceCheckoutHoldKind,
  BookingStatus,
  CommerceCheckoutHoldStatus,
  EquipmentStatus,
  MembershipCardStatus,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  PayableType,
  PlanSource,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingFrequency,
  RecurringCoachingPlanStatus,
  RecurringCoachingScheduleItemStatus,
  RelationshipStatus,
  SessionStatus,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import {
  calculateRoleTargets,
  DYNAMIC_SEED_PASSWORDS,
  userIdFor,
} from './accounts';
import { seedId } from './ids';
import { buildModelCounts, MODEL_COVERAGE } from './manifest';
import type {
  DynamicSeedIntegritySummary,
  DynamicSeedIntegrityViolation,
} from './manifest';
import type { DynamicSeedContext } from './types';
import { validateSeedScenarioCompatibility } from './scenarios';
import {
  shouldSeedMemberQr,
  validateSeedAccountContext,
} from './lifecycles-profiles';
import {
  COHORT_ORDER,
  HARD_CAPS,
  cohortForMember,
  memberAccessWindow,
  volumeBandForMember,
  type VolumeDomain,
} from './volumes';
import {
  CANONICAL_EXERCISE_CATALOG,
  CANONICAL_POSE_CAPABILITIES,
} from '../../../../packages/utils/fitness-catalog';
import { isValidPoseMovementContract } from '../../../../packages/utils/pose';

type IntegrityViolation = DynamicSeedIntegrityViolation;
const DAY_MS = 24 * 60 * 60 * 1_000;

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
    (row) =>
      row.status !== PaymentStatus.completed ||
      row.paymentStage !== PaymentStage.full,
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

// This is intentionally the production capacity set. Lifecycle truth below
// still requires future seed rows to be confirmed, not merely pending.
const ACTIVE_CAPACITY_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.pending,
  BookingStatus.confirmed,
  BookingStatus.balance_pending,
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
const LIVE_SUBSCRIPTION_STATUSES = new Set<SubscriptionStatus>([
  SubscriptionStatus.active,
  SubscriptionStatus.past_due,
  SubscriptionStatus.pending_payment,
]);

export const SEED_SCENARIO_MATRIX: Record<string, string> = {
  active: 'member-active: active membership and one-time upcoming coaching',
  premium: 'member-premium: premium membership and completed workout history',
  frozen: 'member-frozen: suspended membership with retained history',
  pending: 'member-pending: pending payment without active access',
  expired: 'member-expired: expired membership with no upcoming coaching',
  unverified: 'member-unverified: pending account with unverified email',
  archived: 'member-archived: soft-deleted account and expired membership',
  suspended:
    'member-suspended: suspended account with terminal coaching checkout',
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
    'checkout-abandoned member: one terminal failed PayMongo coaching checkout attempt with no product',
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

export function hasKeyedIntervalOverlap<
  T extends { key: string; start: Date; end: Date },
>(rows: readonly T[]) {
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
      if (
        overlaps(
          sorted[index - 1].start,
          sorted[index - 1].end,
          sorted[index].start,
          sorted[index].end,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

export type VenueCapacityInterval = {
  amenityId: string;
  capacity: number;
  start: Date;
  end: Date;
  source?: 'booking' | 'hold';
};

/**
 * Mirrors the booking service's aggregate occupancy check. A venue booking and
 * a live checkout hold are both occupancy, but neither is a duplicate of the
 * other; all overlapping rows count toward the amenity capacity.
 */
export function hasVenueCapacityOverflow(
  rows: readonly VenueCapacityInterval[],
) {
  const byAmenity = new Map<string, VenueCapacityInterval[]>();
  for (const row of rows) {
    const amenityRows = byAmenity.get(row.amenityId) ?? [];
    amenityRows.push(row);
    byAmenity.set(row.amenityId, amenityRows);
  }
  for (const amenityRows of byAmenity.values()) {
    for (const row of amenityRows) {
      const concurrent = amenityRows.filter((candidate) =>
        overlaps(candidate.start, candidate.end, row.start, row.end),
      ).length;
      if (concurrent > row.capacity) return true;
    }
  }
  return false;
}

export type VenueBookingLineageInput = {
  booking: {
    id: string;
    amenity_id: string;
    starts_at: Date;
    ends_at: Date;
    total_amount: unknown;
    downpayment_amount: unknown;
    balance_amount: unknown;
    downpayment_paid_at: Date | null;
    balance_paid_at: Date | null;
  };
  holds: readonly {
    id: string;
    kind: string;
    status: string;
    booking_id: string | null;
    amenity_id: string | null;
    scheduled_at: Date | null;
    ends_at: Date | null;
    amount: unknown;
    created_at: Date;
    expires_at: Date;
    consumed_at: Date | null;
    released_at: Date | null;
    failure_reason: string | null;
    payment_id: string | null;
  }[];
  payments: readonly {
    id: string;
    amount: unknown;
    status: string;
    payment_stage: string;
    provider: string;
    payable_type: string;
    payable_id: string;
  }[];
};

/**
 * Shared venue commerce assertion used by the full seed audit and focused
 * in-memory regressions. Free/manual bookings have no payment lineage; paid
 * venue bookings must use the stronger consumed-hold lineage.
 */
export function assertVenueBookingLineage({
  booking,
  holds,
  payments,
}: VenueBookingLineageInput) {
  const isFree = money(booking.total_amount) === 0;
  const distinctHoldIds = new Set(holds.map((hold) => hold.id));
  const distinctPaymentIds = new Set(payments.map((payment) => payment.id));
  if (distinctHoldIds.size > 1 || distinctPaymentIds.size > 1) {
    throw new Error(
      `booking ${booking.id} has duplicate paid commerce hold/payment lineage`,
    );
  }
  if (
    money(booking.downpayment_amount) !== 0 ||
    money(booking.balance_amount) !== 0 ||
    booking.downpayment_paid_at === null ||
    (isFree
      ? booking.balance_paid_at !== null
      : booking.balance_paid_at === null)
  ) {
    throw new Error(`booking ${booking.id} has invalid payment timestamps`);
  }
  if (isFree) {
    if (holds.length > 0 || payments.length > 0) {
      throw new Error(`free booking ${booking.id} has payment lineage`);
    }
    return;
  }
  const payment = payments[0];
  if (
    !payment ||
    payment.status !== PaymentStatus.completed ||
    payment.payment_stage !== PaymentStage.full ||
    !sameMoney(payment.amount, booking.total_amount)
  ) {
    throw new Error(`booking ${booking.id} has no exact full payment`);
  }
  const hold = holds[0];
  if (!hold) {
    throw new Error(
      `paid venue booking ${booking.id} has no consumed venue hold`,
    );
  }
  if (
    hold.kind !== CommerceCheckoutHoldKind.venue ||
    hold.status !== CommerceCheckoutHoldStatus.consumed ||
    hold.booking_id !== booking.id ||
    hold.amenity_id !== booking.amenity_id ||
    hold.scheduled_at?.getTime() !== booking.starts_at.getTime() ||
    hold.ends_at?.getTime() !== booking.ends_at.getTime() ||
    !sameMoney(hold.amount, booking.total_amount) ||
    hold.consumed_at === null ||
    hold.created_at > hold.consumed_at ||
    hold.consumed_at > hold.expires_at ||
    hold.released_at !== null ||
    hold.failure_reason !== null
  ) {
    throw new Error(`venue booking ${booking.id} has an invalid consumed hold`);
  }
  if (
    hold.payment_id !== payment.id ||
    payment.payable_type !== PayableType.commerce_checkout_hold ||
    payment.payable_id !== hold.id ||
    payment.provider !== PaymentProvider.paymongo
  ) {
    throw new Error(
      `venue booking ${booking.id} has invalid hold/payment provenance`,
    );
  }
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
      hold.status === CommerceCheckoutHoldStatus.expired ||
      hold.status === CommerceCheckoutHoldStatus.released) &&
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
  if (hold.status === CommerceCheckoutHoldStatus.consumed) {
    return (
      hold.expiresAt <= anchor &&
      hold.productReferences.some((reference) => reference !== null) &&
      hold.failureReason === null
    );
  }
  if (
    hold.status !== CommerceCheckoutHoldStatus.failed &&
    hold.status !== CommerceCheckoutHoldStatus.expired &&
    hold.status !== CommerceCheckoutHoldStatus.released
  ) {
    return false;
  }
  return (
    hold.expiresAt <= anchor &&
    hold.productReferences.every((reference) => reference === null) &&
    Boolean(hold.failureReason?.trim())
  );
}

export type MembershipCommerceLineageInput = {
  anchor: Date;
  cards: readonly {
    id: string;
    price: unknown;
    purchased_at: Date;
    user_id: string;
  }[];
  holds: readonly {
    appointment_id: string | null;
    amount: unknown;
    booking_id: string | null;
    consumed_at: Date | null;
    created_at: Date;
    currency?: string | null;
    expires_at: Date;
    failure_reason: string | null;
    id: string;
    kind: string;
    membership_card_id: string | null;
    membership_plan_id: string | null;
    payment_id: string | null;
    recurring_plan_id: string | null;
    released_at: Date | null;
    status: string;
    subscription_id: string | null;
    user_id: string;
  }[];
  payments: readonly {
    amount: unknown;
    created_at: Date;
    currency?: string | null;
    gateway_event_id?: string | null;
    gateway_metadata?: unknown;
    id: string;
    payable_id: string;
    payable_type: string;
    payment_stage: string;
    provider: string;
    provider_ref: string | null;
    status: string;
    user_id: string;
    verified_at: Date | null;
  }[];
  membershipPlans?: readonly { id: string; price: unknown }[];
  subscriptions: readonly {
    expires_at: Date | null;
    id: string;
    payment_id: string | null;
    plan_id: string;
    plan: { price: unknown };
    starts_at: Date | null;
    user_id: string;
  }[];
};

function commerceMetadataHasHold(metadata: unknown, holdId: string) {
  const record = jsonRecord(metadata);
  return (
    record.hold_id === holdId || record.coaching_checkout_hold_id === holdId
  );
}

/**
 * Audits the production commerce lineage independently of the broad dynamic
 * seed audit. This is also used by the in-memory seed regression so missing
 * holds or product/payable mismatches fail without a database reset.
 */
export function assertMembershipCommerceLineage(
  input: MembershipCommerceLineageInput,
) {
  const errors: string[] = [];
  const fail = (detail: string) => errors.push(detail);
  const paymentsById = new Map(
    input.payments.map((payment) => [payment.id, payment]),
  );
  const membershipPlanPrices = new Map(
    (input.membershipPlans ?? []).map((plan) => [plan.id, plan.price]),
  );
  const linkedPaymentIds = new Set<string>();
  const linkedHoldIds = new Set<string>();

  const assertSuccessfulPayment = (
    hold: MembershipCommerceLineageInput['holds'][number],
    productId: string,
    productAt: Date,
    expectedAmount: unknown,
  ) => {
    if (hold.status !== CommerceCheckoutHoldStatus.consumed) {
      fail(
        `consumed product ${productId} has hold ${hold.id} in ${hold.status}`,
      );
    }
    if (hold.consumed_at === null || hold.released_at !== null) {
      fail(
        `consumed hold ${hold.id} has an invalid consumed/released lifecycle`,
      );
    }
    if (
      hold.consumed_at &&
      hold.consumed_at.getTime() !== productAt.getTime()
    ) {
      fail(
        `hold ${hold.id} consumption does not match product time ${productId}`,
      );
    }
    if (!hold.payment_id) {
      fail(`consumed hold ${hold.id} has no linked payment`);
      return;
    }
    if (linkedHoldIds.has(hold.id))
      fail(`hold ${hold.id} is reused by products`);
    linkedHoldIds.add(hold.id);
    const payment = paymentsById.get(hold.payment_id);
    if (!payment) {
      fail(`hold ${hold.id} references missing payment ${hold.payment_id}`);
      return;
    }
    if (linkedPaymentIds.has(payment.id))
      fail(`payment ${payment.id} is reused by products`);
    linkedPaymentIds.add(payment.id);
    if (
      payment.payable_type !== PayableType.commerce_checkout_hold ||
      payment.payable_id !== hold.id
    ) {
      fail(`payment ${payment.id} does not point back to hold ${hold.id}`);
    }
    if (
      payment.status !== PaymentStatus.completed ||
      payment.payment_stage !== PaymentStage.full ||
      payment.provider !== PaymentProvider.paymongo ||
      !payment.provider_ref ||
      payment.gateway_event_id === null ||
      !commerceMetadataHasHold(payment.gateway_metadata, hold.id)
    ) {
      fail(
        `payment ${payment.id} is not a completed PayMongo commerce payment`,
      );
    }
    if (payment.currency !== undefined && payment.currency !== 'PHP') {
      fail(`payment ${payment.id} has a non-PHP currency`);
    }
    if (
      !sameMoney(payment.amount, expectedAmount) ||
      !sameMoney(hold.amount, expectedAmount)
    ) {
      fail(`hold/payment amount does not match product ${productId}`);
    }
    if (hold.currency !== undefined && hold.currency !== 'PHP') {
      fail(`hold ${hold.id} has a non-PHP currency`);
    }
    if (
      hold.created_at > payment.created_at ||
      payment.created_at > productAt ||
      payment.verified_at === null ||
      payment.verified_at < payment.created_at ||
      payment.verified_at > productAt ||
      hold.expires_at <= productAt
    ) {
      fail(`commerce dates are not ordered for product ${productId}`);
    }
  };

  for (const card of input.cards) {
    const matches = input.holds.filter(
      (hold) =>
        hold.kind === CommerceCheckoutHoldKind.membership_card &&
        hold.membership_card_id === card.id,
    );
    if (matches.length !== 1) {
      fail(`card ${card.id} must have exactly one consumed card hold`);
      continue;
    }
    const hold = matches[0];
    if (hold.user_id !== card.user_id || hold.membership_plan_id !== null) {
      fail(`card hold ${hold.id} has invalid owner or plan intent`);
    }
    assertSuccessfulPayment(hold, card.id, card.purchased_at, card.price);
  }

  for (const subscription of input.subscriptions) {
    const matches = input.holds.filter(
      (hold) =>
        hold.kind === CommerceCheckoutHoldKind.subscription &&
        hold.subscription_id === subscription.id,
    );
    if (matches.length !== 1) {
      fail(
        `subscription ${subscription.id} must have exactly one consumed subscription hold`,
      );
      continue;
    }
    const hold = matches[0];
    if (
      hold.user_id !== subscription.user_id ||
      hold.membership_plan_id !== subscription.plan_id ||
      subscription.starts_at === null ||
      subscription.expires_at === null
    ) {
      fail(
        `subscription hold ${hold.id} has invalid owner/plan/window linkage`,
      );
    }
    if (subscription.payment_id !== hold.payment_id) {
      fail(
        `subscription ${subscription.id} payment_id does not equal hold payment`,
      );
    }
    assertSuccessfulPayment(
      hold,
      subscription.id,
      subscription.starts_at ?? input.anchor,
      subscription.plan.price,
    );
  }

  for (const payment of input.payments) {
    if (
      payment.payable_type === PayableType.membership_card ||
      payment.payable_type === PayableType.subscription
    ) {
      fail(`legacy direct product payment ${payment.id} remains in the seed`);
    }
  }

  for (const hold of input.holds) {
    const terminal =
      hold.status === CommerceCheckoutHoldStatus.failed ||
      hold.status === CommerceCheckoutHoldStatus.expired ||
      hold.status === CommerceCheckoutHoldStatus.released;
    if (!terminal) continue;
    if (
      hold.subscription_id !== null ||
      hold.membership_card_id !== null ||
      hold.appointment_id !== null ||
      hold.booking_id !== null ||
      hold.recurring_plan_id !== null
    ) {
      fail(`terminal hold ${hold.id} references a created product`);
    }
    if (
      hold.expires_at > input.anchor ||
      hold.consumed_at !== null ||
      hold.released_at === null ||
      !hold.failure_reason?.trim()
    ) {
      fail(`terminal hold ${hold.id} has invalid terminal evidence`);
    }
    if (
      hold.kind === CommerceCheckoutHoldKind.subscription &&
      hold.membership_plan_id !== null
    ) {
      const planPrice = membershipPlanPrices.get(hold.membership_plan_id);
      if (planPrice === undefined || !sameMoney(hold.amount, planPrice)) {
        fail(
          `terminal subscription hold ${hold.id} amount does not match its plan`,
        );
      }
    }
    if (!hold.payment_id) {
      fail(`terminal hold ${hold.id} has no failed payment`);
      continue;
    }
    const payment = paymentsById.get(hold.payment_id);
    if (!payment) {
      fail(
        `terminal hold ${hold.id} references missing payment ${hold.payment_id}`,
      );
      continue;
    }
    if (
      payment.payable_type !== PayableType.commerce_checkout_hold ||
      payment.payable_id !== hold.id ||
      payment.status !== PaymentStatus.failed ||
      payment.payment_stage !== PaymentStage.full ||
      payment.provider !== PaymentProvider.paymongo ||
      !payment.provider_ref ||
      (hold.currency !== undefined && hold.currency !== 'PHP') ||
      (payment.currency !== undefined && payment.currency !== 'PHP') ||
      !sameMoney(payment.amount, hold.amount) ||
      payment.created_at < hold.created_at ||
      payment.created_at > hold.expires_at
    ) {
      fail(
        `terminal hold ${hold.id} is not backed by an exact failed PayMongo payment`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `[dynamic-seed][integrity] membership commerce lineage failed:\n${errors.join('\n')}`,
    );
  }
}

export type CoachingCommerceLineageInput = {
  anchor: Date;
  appointments: readonly {
    id: string;
    recurring_plan_id: string | null;
    scheduled_at: Date;
    status: string;
    total_amount: unknown;
    user_id: string;
  }[];
  billingCycles: readonly {
    amount: unknown;
    cycle_end_date: Date;
    cycle_start_date: Date;
    id: string;
    paid_at: Date | null;
    payment_id: string | null;
    recurring_plan_id: string;
    status: string;
  }[];
  holds: readonly {
    amount: unknown;
    appointment_id: string | null;
    consumed_at: Date | null;
    created_at: Date;
    expires_at: Date;
    failure_reason: string | null;
    id: string;
    kind: string;
    payment_id: string | null;
    recurring_plan_id: string | null;
    released_at: Date | null;
    status: string;
    user_id: string;
  }[];
  payments: readonly {
    amount: unknown;
    created_at: Date;
    gateway_event_id?: string | null;
    gateway_metadata?: unknown;
    id: string;
    payable_id: string;
    payable_type: string;
    payment_stage: string;
    provider: string;
    provider_ref: string | null;
    status: string;
    user_id: string;
    verified_at: Date | null;
  }[];
  plans: readonly {
    id: string;
    member_id: string;
    quoted_amount: unknown;
  }[];
};

/**
 * Coaching uses the same checkout-hold commerce boundary as memberships and
 * venue bookings. One-time products consume one hold per appointment; a
 * recurring enrollment consumes one monthly hold for the first paid cycle and
 * later cycles point directly to their recurring billing-cycle payable.
 */
export function assertCoachingCommerceLineage(
  input: CoachingCommerceLineageInput,
) {
  const errors: string[] = [];
  const paymentsById = new Map(
    input.payments.map((payment) => [payment.id, payment]),
  );
  const holdsByAppointment = new Map(
    input.holds
      .filter((hold) => hold.appointment_id !== null)
      .map((hold) => [hold.appointment_id!, hold]),
  );
  const holdsByPlan = new Map(
    input.holds
      .filter(
        (hold) =>
          hold.kind === CommerceCheckoutHoldKind.monthly &&
          hold.recurring_plan_id !== null,
      )
      .map((hold) => [hold.recurring_plan_id!, hold]),
  );
  const fullSuccessfulPayment = (
    hold: CoachingCommerceLineageInput['holds'][number],
    expectedAmount: unknown,
  ) => {
    const payment = hold.payment_id
      ? paymentsById.get(hold.payment_id)
      : undefined;
    if (
      hold.status !== CommerceCheckoutHoldStatus.consumed ||
      hold.consumed_at === null ||
      hold.released_at !== null ||
      !payment ||
      payment.payable_type !== PayableType.commerce_checkout_hold ||
      payment.payable_id !== hold.id ||
      payment.status !== PaymentStatus.completed ||
      payment.payment_stage !== PaymentStage.full ||
      payment.provider !== PaymentProvider.paymongo ||
      !payment.provider_ref ||
      !commerceMetadataHasHold(payment.gateway_metadata, hold.id) ||
      !sameMoney(payment.amount, expectedAmount) ||
      !sameMoney(hold.amount, expectedAmount) ||
      payment.created_at > hold.consumed_at ||
      payment.verified_at === null ||
      payment.verified_at > hold.consumed_at ||
      hold.expires_at <= hold.consumed_at
    ) {
      errors.push(
        `coaching hold ${hold.id} has invalid successful payment lineage`,
      );
    }
    return payment;
  };

  for (const appointment of input.appointments) {
    if (appointment.recurring_plan_id !== null) continue;
    const hold = holdsByAppointment.get(appointment.id);
    if (
      !hold ||
      hold.kind !== CommerceCheckoutHoldKind.one_time ||
      hold.user_id !== appointment.user_id
    ) {
      errors.push(
        `one-time appointment ${appointment.id} has no one-time checkout hold`,
      );
      continue;
    }
    fullSuccessfulPayment(hold, appointment.total_amount);
  }

  for (const plan of input.plans) {
    const hold = holdsByPlan.get(plan.id);
    if (
      !hold ||
      hold.user_id !== plan.member_id ||
      hold.status !== CommerceCheckoutHoldStatus.consumed ||
      !sameMoney(hold.amount, plan.quoted_amount)
    ) {
      errors.push(
        `recurring plan ${plan.id} has no matching monthly checkout hold`,
      );
      continue;
    }
    const cycles = input.billingCycles
      .filter((cycle) => cycle.recurring_plan_id === plan.id)
      .sort(
        (left, right) =>
          left.cycle_start_date.getTime() - right.cycle_start_date.getTime(),
      );
    if (cycles.length === 0) {
      errors.push(`recurring plan ${plan.id} has no billing cycles`);
      continue;
    }
    for (const [index, cycle] of cycles.entries()) {
      const payment = cycle.payment_id
        ? paymentsById.get(cycle.payment_id)
        : undefined;
      const firstLineage =
        index === 0
          ? payment?.payable_type === PayableType.commerce_checkout_hold &&
            payment.payable_id === hold.id &&
            payment.id === hold.payment_id
          : payment?.payable_type === PayableType.recurring_coaching &&
            payment.payable_id === cycle.id;
      if (
        cycle.status !== RecurringCoachingBillingCycleStatus.paid ||
        cycle.paid_at === null ||
        !payment ||
        payment.status !== PaymentStatus.completed ||
        payment.payment_stage !== PaymentStage.full ||
        !sameMoney(payment.amount, cycle.amount) ||
        !sameMoney(cycle.amount, plan.quoted_amount) ||
        !firstLineage
      ) {
        errors.push(
          `billing cycle ${cycle.id} has invalid recurring payment lineage`,
        );
      }
    }
  }

  for (const hold of input.holds) {
    if (
      hold.kind !== CommerceCheckoutHoldKind.one_time &&
      hold.kind !== CommerceCheckoutHoldKind.monthly
    ) {
      continue;
    }
    const terminal =
      hold.status === CommerceCheckoutHoldStatus.failed ||
      hold.status === CommerceCheckoutHoldStatus.expired ||
      hold.status === CommerceCheckoutHoldStatus.released;
    if (
      !terminal ||
      hold.appointment_id !== null ||
      hold.recurring_plan_id !== null
    ) {
      continue;
    }
    const payment = hold.payment_id
      ? paymentsById.get(hold.payment_id)
      : undefined;
    if (
      !hold.failure_reason ||
      hold.released_at === null ||
      hold.consumed_at !== null ||
      !payment ||
      payment.status !== PaymentStatus.failed ||
      payment.payable_type !== PayableType.commerce_checkout_hold ||
      payment.payable_id !== hold.id ||
      payment.payment_stage !== PaymentStage.full ||
      payment.provider !== PaymentProvider.paymongo ||
      !payment.provider_ref ||
      !sameMoney(payment.amount, hold.amount)
    ) {
      errors.push(
        `terminal coaching hold ${hold.id} has invalid failure evidence`,
      );
    }
  }
  if (errors.length > 0) {
    throw new Error(
      `[dynamic-seed][integrity] coaching commerce lineage failed:\n${errors.join('\n')}`,
    );
  }
}

function jsonRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function jsonStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];
}

function toSeedProfileMovementContract(profile: {
  angle_signature: unknown;
  canonical_name: string;
  dominant_joint: string | null;
  movement_pattern: unknown;
  orientation_signature: unknown;
  rep_rules: unknown;
  rep_thresholds: unknown;
  visibility_pattern: unknown;
}) {
  const movement = jsonRecord(profile.movement_pattern);
  const orientation = jsonRecord(profile.orientation_signature);
  const rules = jsonRecord(profile.rep_rules);
  const tracking = jsonRecord(rules.tracking_requirements);
  const spatial = jsonRecord(rules.spatial_requirements);
  const thresholds = jsonRecord(profile.rep_thresholds);
  const field = (
    record: Record<string, unknown>,
    snake: string,
    camel: string,
  ) => record[snake] ?? record[camel];
  return {
    exercise: profile.canonical_name,
    dominantJoint: profile.dominant_joint,
    secondaryCheck: rules.secondary_check,
    oscillatingJoints: jsonStringArray(
      movement.oscillating_landmarks ??
        movement.oscillating_joints ??
        rules.oscillating_joints,
    ),
    phaseOrder: jsonStringArray(rules.phase_order ?? movement.phase_order),
    primaryJoints: jsonStringArray(
      rules.primary_joints ?? movement.tracked_joint,
    ),
    repModel: rules.rep_model,
    requiredSides: rules.required_sides,
    bodyOrientation: rules.body_orientation ?? orientation.body_orientation,
    contractVersion:
      rules.contract_version ??
      orientation.contract_version ??
      jsonRecord(profile.angle_signature).contract_version,
    holdDurationSeconds: rules.hold_duration_seconds,
    repThresholds: {
      down: thresholds.down,
      up: thresholds.up,
    },
    spatialRequirements: {
      bodyLineTolerance: field(
        spatial,
        'body_line_tolerance',
        'bodyLineTolerance',
      ),
      bodyXDriftMax: field(spatial, 'body_x_drift_max', 'bodyXDriftMax'),
      bodyYTravelMin: field(spatial, 'body_y_travel_min', 'bodyYTravelMin'),
      hipYTravelMin: field(spatial, 'hip_y_travel_min', 'hipYTravelMin'),
      leftRightSymmetryTolerance: field(
        spatial,
        'left_right_symmetry_tolerance',
        'leftRightSymmetryTolerance',
      ),
      phaseSyncToleranceMs: field(
        spatial,
        'phase_sync_tolerance_ms',
        'phaseSyncToleranceMs',
      ),
      shoulderHipTravelMin: field(
        spatial,
        'shoulder_hip_travel_min',
        'shoulderHipTravelMin',
      ),
      shoulderYTravelMin: field(
        spatial,
        'shoulder_y_travel_min',
        'shoulderYTravelMin',
      ),
      torsoSlopeMaxDeg: field(
        spatial,
        'torso_slope_max_deg',
        'torsoSlopeMaxDeg',
      ),
      torsoSlopeMinDeg: field(
        spatial,
        'torso_slope_min_deg',
        'torsoSlopeMinDeg',
      ),
      wristAnchorDriftMax: field(
        spatial,
        'wrist_anchor_drift_max',
        'wristAnchorDriftMax',
      ),
    },
    trackingRequirements: {
      minConfidence: field(tracking, 'min_confidence', 'minConfidence'),
      minReliableFrameLandmarks: field(
        tracking,
        'min_reliable_frame_landmarks',
        'minReliableFrameLandmarks',
      ),
      requiredLandmarks: jsonStringArray(
        field(tracking, 'required_landmarks', 'requiredLandmarks'),
      ),
      requiredSides: field(tracking, 'required_sides', 'requiredSides'),
    },
  };
}

function isDynamicSeedSummary(value: unknown) {
  return jsonRecord(value).source === 'dynamic-seed';
}

function timeMinutes(value: Date) {
  return value.getUTCHours() * 60 + value.getUTCMinutes();
}

const GYM_TIMEZONE_OFFSET_MINUTES = 8 * 60;

function gymTimeMinutes(value: Date) {
  const wall = new Date(value.getTime() + GYM_TIMEZONE_OFFSET_MINUTES * 60_000);
  return wall.getUTCHours() * 60 + wall.getUTCMinutes();
}

function gymDayOfWeek(value: Date) {
  const wall = new Date(value.getTime() + GYM_TIMEZONE_OFFSET_MINUTES * 60_000);
  return wall.getUTCDay();
}

export async function runSeedIntegrityAudit(
  ctx: DynamicSeedContext,
): Promise<DynamicSeedIntegritySummary> {
  const ids = ctx.state.accounts.map(
    (account) => ctx.state.userIds[account.key],
  );
  const accountByUserId = new Map(
    ctx.state.accounts.map((account) => [
      ctx.state.userIds[account.key],
      account,
    ]),
  );
  const [
    counts,
    users,
    emailIdentities,
    subscriptions,
    cards,
    payments,
    holds,
    amenities,
    operatingHours,
    specialSchedules,
    bookings,
    bookingAudits,
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
    exerciseCatalog,
    poseProfiles,
    poseSessions,
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
        created_at: true,
        id: true,
        deletedAt: true,
        email_verified_at: true,
        has_accepted_privacy: true,
        phone_verified_at: true,
        privacy_accepted_at: true,
        qr_code_expires_at: true,
        qr_code_rotated_at: true,
        qr_code_token: true,
        profile: {
          select: {
            activity_level: true,
            created_at: true,
            date_of_birth: true,
            fitness_goal: true,
            gender: true,
            height_cm: true,
            id: true,
            weight_kg: true,
          },
        },
        role: true,
        status: true,
      },
    }),
    ctx.prisma.authIdentity.findMany({
      where: { user_id: { in: ids }, provider: AuthProvider.email },
      select: {
        created_at: true,
        credential_hash: true,
        identifier: true,
        user_id: true,
        verified_at: true,
      },
    }),
    ctx.prisma.subscription.findMany({
      where: { user_id: { in: ids } },
      select: {
        id: true,
        expires_at: true,
        plan_id: true,
        payment_id: true,
        starts_at: true,
        status: true,
        user_id: true,
        plan: { select: { duration_days: true, price: true } },
      },
    }),
    ctx.prisma.membershipCard.findMany({
      where: { user_id: { in: ids } },
      select: {
        id: true,
        activated_at: true,
        price: true,
        purchased_at: true,
        revoked_at: true,
        revoked_by: true,
        revoke_reason: true,
        source: true,
        status: true,
        user_id: true,
        verified_at: true,
        verified_by: true,
      },
    }),
    ctx.prisma.payment.findMany({
      select: {
        amount: true,
        currency: true,
        created_at: true,
        gateway_event_id: true,
        gateway_metadata: true,
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
        currency: true,
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
      select: {
        capacity: true,
        hourly_rate: true,
        id: true,
        is_active: true,
        is_mapped: true,
        is_reservable: true,
        minimum_hours: true,
        requires_subscription: true,
        status: true,
      },
    }),
    ctx.prisma.gymOperatingHour.findMany({
      select: {
        closes_at: true,
        day_of_week: true,
        is_active: true,
        is_closed: true,
        opens_at: true,
      },
    }),
    ctx.prisma.gymSpecialSchedule.findMany({
      select: {
        closes_at: true,
        ends_on: true,
        is_active: true,
        is_closed: true,
        opens_at: true,
        starts_on: true,
      },
    }),
    ctx.prisma.amenityBooking.findMany({
      select: {
        amenity_id: true,
        balance_amount: true,
        balance_paid_at: true,
        cancelled_at: true,
        cancellation_reason: true,
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
    ctx.prisma.auditLog.findMany({
      where: { entity: 'AmenityBooking' },
      select: {
        action: true,
        after: true,
        entity_id: true,
      },
    }),
    ctx.prisma.coachProfile.findMany({
      select: {
        average_rating: true,
        id: true,
        is_available_for_booking: true,
        monthly_offer_active: true,
        rating_count: true,
        user_id: true,
      },
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
        days_per_week: true,
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
        day_of_week: true,
        exercises: {
          select: {
            duration_seconds: true,
            exercise_id: true,
            id: true,
            reps: true,
            sets: true,
            weight_kg_target: true,
          },
        },
        focus_label: true,
        id: true,
        is_rest_day: true,
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
      select: {
        created_at: true,
        duration_seconds: true,
        plan_exercise_id: true,
        exercise_id: true,
        id: true,
        reps_ai_counted: true,
        reps_completed: true,
        reps_target: true,
        set_number: true,
        weight_kg: true,
        session_id: true,
        user_id: true,
      },
    }),
    ctx.prisma.exerciseCatalog.findMany({
      select: {
        category: true,
        id: true,
        is_active: true,
        muscle_group: true,
        muscle_targets: true,
        name: true,
      },
    }),
    ctx.prisma.poseExerciseProfile.findMany({
      select: {
        angle_signature: true,
        canonical_name: true,
        confidence_threshold: true,
        dominant_joint: true,
        exercise_id: true,
        id: true,
        is_active: true,
        movement_pattern: true,
        orientation_signature: true,
        profile_kind: true,
        rep_rules: true,
        rep_thresholds: true,
        tolerance: true,
        visibility_pattern: true,
      },
    }),
    ctx.prisma.poseSession.findMany({
      where: { user_id: { in: ids } },
      select: {
        analysis_summary: true,
        detected_exercise_name: true,
        detected_profile_id: true,
        exercise_log_id: true,
        id: true,
        rep_count_ai: true,
        user_id: true,
      },
    }),
    ctx.prisma.recurringCoachingBillingCycle.findMany({
      select: {
        amount: true,
        cycle_end_date: true,
        cycle_start_date: true,
        id: true,
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
      select: {
        product_id: true,
        quantity: true,
        subtotal: true,
        transaction_id: true,
      },
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
      select: {
        check_in_at: true,
        check_out_at: true,
        id: true,
        user_id: true,
      },
    }),
    ctx.prisma.nutritionLog.findMany({
      where: { user_id: { in: ids } },
      select: {
        created_at: true,
        log_date: true,
        macro_target_id: true,
        user_id: true,
      },
    }),
    ctx.prisma.tdeeProfile.findMany({
      where: { user_id: { in: ids } },
      select: { calculated_at: true, id: true, is_active: true, user_id: true },
    }),
    ctx.prisma.macroTarget.findMany({
      where: { user_id: { in: ids } },
      select: {
        created_at: true,
        id: true,
        is_active: true,
        tdee_profile_id: true,
        user_id: true,
      },
    }),
    ctx.prisma.progressionSourceEvent.findMany({
      where: { user_id: { in: ids } },
      select: {
        created_at: true,
        id: true,
        processed_at: true,
        source_id: true,
        source_status: true,
        source_type: true,
        user_id: true,
      },
    }),
    ctx.prisma.progressionGrantLedger.findMany({
      where: { user_id: { in: ids } },
      select: {
        amount: true,
        created_at: true,
        grant_status: true,
        grant_type: true,
        id: true,
        muscle_group: true,
        season_id: true,
        source_event_id: true,
        user_id: true,
      },
    }),
    ctx.prisma.userProgressionProfile.findMany({
      where: { user_id: { in: ids } },
      select: {
        active_season_id: true,
        current_season_points: true,
        last_progressed_at: true,
        total_xp: true,
        user_id: true,
      },
    }),
    ctx.prisma.seasonDefinition.findMany({
      where: {
        id: {
          in: [
            seedId('season:dynamic-main'),
            seedId('season:dynamic-previous'),
            seedId('season:dynamic-upcoming'),
          ],
        },
      },
      select: { ends_at: true, id: true, starts_at: true, status: true },
    }),
    ctx.prisma.seasonalStanding.findMany({
      where: { user_id: { in: ids } },
      select: { season_id: true, season_points: true, user_id: true },
    }),
    ctx.prisma.seasonalMuscleStanding.findMany({
      where: { user_id: { in: ids } },
      select: {
        muscle_group: true,
        muscle_points: true,
        season_id: true,
        user_id: true,
      },
    }),
    ctx.prisma.muscleMasteryProgress.findMany({
      where: { user_id: { in: ids } },
      select: {
        muscle_group: true,
        total_volume_kg: true,
        user_id: true,
        xp_points: true,
      },
    }),
    ctx.prisma.muscleDefinition.findMany({
      where: { is_active: true },
      select: { key: true },
    }),
    ctx.prisma.userMilestoneProgress.findMany({
      where: { user_id: { in: ids } },
      select: {
        claimed_at: true,
        milestone_definition_id: true,
        progress_value: true,
        reward_granted_at: true,
        status: true,
        unlocked_at: true,
        user_id: true,
      },
    }),
    ctx.prisma.milestoneDefinition.findMany({
      where: {
        id: {
          in: [
            seedId('milestone-definition:first-workout'),
            seedId('milestone-definition:consistency'),
            seedId('milestone-definition:progression'),
          ],
        },
      },
      select: { condition_payload: true, evidence_requirement: true, id: true },
    }),
    ctx.prisma.aiChatSession.findMany({
      where: { user_id: { in: ids } },
      select: {
        created_at: true,
        id: true,
        is_active: true,
        last_activity_at: true,
        user_id: true,
      },
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
      select: {
        created_at: true,
        id: true,
        read_at: true,
        sent_at: true,
        status: true,
        type: true,
        user_id: true,
      },
    }),
    ctx.prisma.gymChatSession.findMany({
      where: { user_id: { in: ids } },
      select: {
        created_at: true,
        id: true,
        is_active: true,
        last_activity_at: true,
        user_id: true,
      },
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
      select: {
        equipment_id: true,
        quantity_before: true,
        quantity_lost: true,
        quantity_set_to: true,
      },
    }),
    ctx.prisma.coachReview.findMany({
      where: { reviewer_id: { in: ids } },
      select: {
        appointment_id: true,
        coach_id: true,
        created_at: true,
        rating: true,
        reviewer_id: true,
      },
    }),
  ]);

  void [
    tdeeProfiles,
    macroTargets,
    progressionProfiles,
    seasons,
    seasonalStandings,
    seasonalMuscleStandings,
    muscleMastery,
    muscleDefinitions,
    milestoneProgress,
    milestoneDefinitions,
    aiInteractions,
    gymChatInteractions,
    retailProducts,
    equipmentWriteOffs,
  ];

  const membershipPlans = await ctx.prisma.membershipPlan.findMany({
    select: { id: true, price: true },
  });

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
      .filter(
        (payment) =>
          payment.payable_type !== PayableType.commerce_checkout_hold,
      )
      .every(
        (payment) =>
          payment.status === PaymentStatus.completed &&
          payment.payment_stage === PaymentStage.full,
      ),
    'payment',
    'seed contains a pending or partial product payment',
  );
  check(
    payments.every(
      (payment) =>
        payment.status !== PaymentStatus.pending &&
        payment.status !== PaymentStatus.processing,
    ),
    'payment',
    'seed contains a stale pending or processing payment attempt',
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
        .filter(
          (payment) =>
            payment.payable_type !== PayableType.commerce_checkout_hold,
        )
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
        .filter(
          (payment) =>
            payment.payable_type !== PayableType.commerce_checkout_hold,
        )
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
          payment.verified_at >= payment.created_at &&
          payment.verified_at <= anchor &&
          (payment.provider === PaymentProvider.paymongo ||
            payment.verified_by !== null),
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
  const holdByAppointmentId = new Map(
    holds
      .filter((hold) => hold.appointment_id !== null)
      .map((hold) => [hold.appointment_id!, hold]),
  );
  const monthlyHoldByPlanId = new Map(
    holds
      .filter(
        (hold) =>
          hold.kind === CommerceCheckoutHoldKind.monthly &&
          hold.recurring_plan_id !== null,
      )
      .map((hold) => [hold.recurring_plan_id!, hold]),
  );

  try {
    assertMembershipCommerceLineage({
      anchor,
      cards,
      holds,
      membershipPlans,
      payments,
      subscriptions,
    });
  } catch (error) {
    recordAssertionFailure('payment', error);
  }
  try {
    assertCoachingCommerceLineage({
      anchor,
      appointments: appointments.map((appointment) => ({
        id: appointment.id,
        recurring_plan_id: appointment.recurring_plan_id,
        scheduled_at: appointment.scheduled_at,
        status: appointment.status,
        total_amount: appointment.total_amount,
        user_id: appointment.user_id,
      })),
      billingCycles,
      holds: holds.map((hold) => ({
        amount: hold.amount,
        appointment_id: hold.appointment_id,
        consumed_at: hold.consumed_at,
        created_at: hold.created_at,
        expires_at: hold.expires_at,
        failure_reason: hold.failure_reason,
        id: hold.id,
        kind: hold.kind,
        payment_id: hold.payment_id,
        recurring_plan_id: hold.recurring_plan_id,
        released_at: hold.released_at,
        status: hold.status,
        user_id: hold.user_id,
      })),
      payments: payments.map((payment) => ({
        amount: payment.amount,
        created_at: payment.created_at,
        gateway_event_id: payment.gateway_event_id,
        gateway_metadata: payment.gateway_metadata,
        id: payment.id,
        payable_id: payment.payable_id,
        payable_type: payment.payable_type,
        payment_stage: payment.payment_stage,
        provider: payment.provider,
        provider_ref: payment.provider_ref,
        status: payment.status,
        user_id: payment.user_id,
        verified_at: payment.verified_at,
      })),
      plans: plans.map((plan) => ({
        id: plan.id,
        member_id: plan.member_id,
        quoted_amount: plan.quoted_amount,
      })),
    });
  } catch (error) {
    recordAssertionFailure('payment', error);
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
    for (const issue of validateSeedAccountContext(account)) {
      check(false, 'lifecycle-profile', `${account.key}: ${issue}`);
    }
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
    const lifecycle = account.lifecycle;
    if (lifecycle) {
      check(
        user.created_at.getTime() === lifecycle.registeredAt.getTime(),
        'lifecycle-profile',
        `${account.key} user creation date disagrees with lifecycle registration`,
      );
      check(
        (user.email_verified_at?.getTime() ?? null) ===
          (lifecycle.verifiedAt?.getTime() ?? null),
        'lifecycle-profile',
        `${account.key} verification date disagrees with lifecycle`,
      );
      check(
        (user.deletedAt?.getTime() ?? null) ===
          (lifecycle.deletedAt?.getTime() ?? null),
        'lifecycle-profile',
        `${account.key} deletion date disagrees with lifecycle`,
      );
      const qrExpected = shouldSeedMemberQr(
        account,
        user.status,
        user.email_verified_at,
        user.deletedAt,
      );
      check(
        Boolean(user.qr_code_token) === qrExpected &&
          Boolean(user.qr_code_rotated_at) === qrExpected &&
          Boolean(user.qr_code_expires_at) === qrExpected,
        'qr',
        `${account.key} has a QR state inconsistent with account eligibility`,
      );
      if (qrExpected) {
        check(
          user.qr_code_rotated_at !== null &&
            user.qr_code_rotated_at >= lifecycle.registeredAt &&
            user.qr_code_rotated_at <= anchor &&
            user.qr_code_expires_at !== null &&
            user.qr_code_expires_at > anchor,
          'qr',
          `${account.key} has an invalid QR rotation/expiry window`,
        );
      }
      if (user.profile) {
        const profile = user.profile;
        check(
          profile.created_at >= lifecycle.registeredAt &&
            profile.date_of_birth?.getTime() ===
              (account.dateOfBirth?.getTime() ?? null) &&
            profile.gender === account.gender &&
            profile.activity_level === account.activityLevel &&
            profile.fitness_goal === account.fitnessGoal &&
            Number(profile.height_cm) === account.heightCm &&
            Number(profile.weight_kg) === account.weightKg,
          'lifecycle-profile',
          `${account.key} persisted profile disagrees with canonical profile context`,
        );
      }
      check(
        identity?.created_at.getTime() === lifecycle.registeredAt.getTime() &&
          (identity.verified_at?.getTime() ?? null) ===
            (lifecycle.verifiedAt?.getTime() ?? null),
        'lifecycle-profile',
        `${account.key} auth identity dates disagree with lifecycle`,
      );
    }
    check(
      Boolean(identity?.credential_hash) &&
        (await bcrypt.compare(
          DYNAMIC_SEED_PASSWORDS[account.role],
          identity?.credential_hash ?? '',
        )),
      'accounts',
      `${account.key} does not have the documented bcrypt credential`,
    );
    const accountSubscriptions = subscriptionsByUser.get(userId) ?? [];
    const liveSubscriptions = accountSubscriptions.filter((candidate) =>
      LIVE_SUBSCRIPTION_STATUSES.has(candidate.status),
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
        if (['active', 'premium', 'trial'].includes(account.memberPersona)) {
          check(
            liveSubscriptions.length === 1 &&
              liveSubscriptions[0]?.status === SubscriptionStatus.active,
            'membership',
            `${account.key} must have exactly one current active subscription`,
          );
        } else {
          check(
            liveSubscriptions.length === 0,
            'membership',
            `${account.key} has a live subscription despite a terminal lifecycle`,
          );
        }
        const expectedCardStatus = ['active', 'premium', 'trial'].includes(
          account.memberPersona,
        )
          ? MembershipCardStatus.active
          : MembershipCardStatus.revoked;
        check(
          card?.status === expectedCardStatus,
          'membership',
          `${account.key} has a card status inconsistent with its lifecycle`,
        );
      } else {
        check(
          !card && !subscription,
          'membership',
          `${account.key} has a product despite lacking a paid membership`,
        );
        check(
          liveSubscriptions.length === 0,
          'membership',
          `${account.key} has a live subscription despite lacking a paid membership`,
        );
        check(
          (holdsByUser.get(userId) ?? []).some((hold) =>
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
      if (account.paymentProfile === 'failed_then_successful') {
        const failedMembershipHolds = (holdsByUser.get(userId) ?? []).filter(
          (hold) =>
            (hold.status === CommerceCheckoutHoldStatus.failed ||
              hold.status === CommerceCheckoutHoldStatus.expired) &&
            hold.failure_reason !== null,
        );
        check(
          failedMembershipHolds.length === 1,
          'payment',
          `${account.key} does not have exactly one terminal failed checkout before its successful product`,
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
  const roleTargets = calculateRoleTargets(ctx.config.users);
  for (const [role, target] of Object.entries(roleTargets)) {
    check(
      (roleCounts.get(role) ?? 0) === target,
      'accounts',
      `role ${role} count is ${roleCounts.get(role) ?? 0}, expected ${target}`,
    );
  }

  for (const issue of validateSeedScenarioCompatibility(ctx.state.accounts)) {
    check(
      false,
      'scenario-compatibility',
      `${issue.accountKey}: ${issue.detail}`,
    );
  }

  for (const subscription of subscriptions) {
    const owner = accountByUserId.get(subscription.user_id);
    check(
      subscription.starts_at !== null && subscription.starts_at <= anchor,
      'dates',
      `subscription ${subscription.id} starts after the seed anchor`,
    );
    check(
      subscription.starts_at !== null &&
        subscription.expires_at !== null &&
        subscription.starts_at < subscription.expires_at,
      'dates',
      `subscription ${subscription.id} has a reversed or empty enrollment window`,
    );
    check(
      owner?.lifecycle?.registeredAt !== undefined &&
        subscription.starts_at !== null &&
        subscription.starts_at >= owner.lifecycle.registeredAt,
      'dates',
      `subscription ${subscription.id} starts before its member joined`,
    );
    check(
      subscription.starts_at !== null &&
        subscription.expires_at !== null &&
        subscription.expires_at.getTime() - subscription.starts_at.getTime() ===
          subscription.plan.duration_days * DAY_MS,
      'membership',
      `subscription ${subscription.id} does not match its plan duration`,
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
    if (subscription.status === SubscriptionStatus.suspended) {
      check(
        subscription.expires_at !== null && subscription.expires_at <= anchor,
        'dates',
        `suspended subscription ${subscription.id} exposes future access`,
      );
    }
  }

  check(
    !hasKeyedIntervalOverlap(
      subscriptions.map((subscription) => ({
        key: subscription.user_id,
        start: subscription.starts_at!,
        end: subscription.expires_at!,
      })),
    ),
    'membership',
    'subscription cycles overlap for at least one member',
  );

  for (const card of cards) {
    const owner = accountByUserId.get(card.user_id);
    check(
      sameMoney(card.price, 400),
      'membership',
      `membership card ${card.id} does not match the canonical card price`,
    );
    if (card.status === MembershipCardStatus.active) {
      check(
        card.verified_at !== null &&
          (card.verified_by !== null || card.source === 'paymongo') &&
          card.activated_at !== null &&
          card.revoked_at === null &&
          card.purchased_at <= card.verified_at &&
          card.verified_at <= card.activated_at &&
          card.purchased_at <= card.activated_at,
        'membership',
        `active card ${card.id} is missing verification/activation`,
      );
    }
    if (card.status === MembershipCardStatus.revoked) {
      check(
        card.revoked_at !== null &&
          card.verified_at !== null &&
          card.activated_at !== null &&
          card.purchased_at <= card.verified_at &&
          card.verified_at <= card.activated_at &&
          card.purchased_at <= card.activated_at &&
          card.revoked_at >= card.activated_at &&
          card.revoked_at <= anchor,
        'membership',
        `revoked card ${card.id} has contradictory lifecycle fields`,
      );
    }
    check(
      owner?.lifecycle?.registeredAt !== undefined &&
        card.purchased_at >= owner.lifecycle.registeredAt,
      'dates',
      `membership card ${card.id} was purchased before its member joined`,
    );
  }

  const amenityById = new Map(
    amenities.map((amenity) => [amenity.id, amenity]),
  );
  const amenityCapacity = new Map(
    amenities.map((amenity) => [amenity.id, amenity.capacity]),
  );
  const holdsByBookingId = new Map<string, typeof holds>();
  for (const hold of holds) {
    if (hold.booking_id === null) continue;
    const rows = holdsByBookingId.get(hold.booking_id) ?? [];
    rows.push(hold);
    holdsByBookingId.set(hold.booking_id, rows);
  }
  const paymentById = new Map(payments.map((payment) => [payment.id, payment]));
  const bookingAuditIds = new Set(
    bookingAudits.map((audit) => audit.entity_id),
  );
  const operatingHourByDay = new Map(
    operatingHours.map((hour) => [hour.day_of_week, hour]),
  );
  const dateKey = (value: Date) => value.toISOString().slice(0, 10);
  const timeMinutesFor = (value: Date) => timeMinutes(value);
  const bookingWithinGymHours = (startsAt: Date, endsAt: Date) => {
    if (dateKey(startsAt) !== dateKey(endsAt)) return false;
    const special = specialSchedules.find(
      (candidate) =>
        candidate.is_active &&
        dateKey(candidate.starts_on) <= dateKey(startsAt) &&
        dateKey(candidate.ends_on) >= dateKey(startsAt),
    );
    if (special?.is_closed) return false;
    const regular = operatingHourByDay.get(startsAt.getUTCDay());
    const defaultOpen = startsAt.getUTCDay() === 0 ? 8 * 60 : 6 * 60;
    const defaultClose = startsAt.getUTCDay() === 0 ? 18 * 60 : 22 * 60;
    const opens = special?.opens_at
      ? timeMinutesFor(special.opens_at)
      : regular?.opens_at
        ? timeMinutesFor(regular.opens_at)
        : defaultOpen;
    const closes = special?.closes_at
      ? timeMinutesFor(special.closes_at)
      : regular?.closes_at
        ? timeMinutesFor(regular.closes_at)
        : defaultClose;
    if (regular?.is_closed) return false;
    return (
      timeMinutesFor(startsAt) >= opens && timeMinutesFor(endsAt) <= closes
    );
  };
  const coachWithinGymHours = (startsAt: Date, endsAt: Date) => {
    const localStart = new Date(
      startsAt.getTime() + GYM_TIMEZONE_OFFSET_MINUTES * 60_000,
    );
    const localEnd = new Date(
      endsAt.getTime() + GYM_TIMEZONE_OFFSET_MINUTES * 60_000,
    );
    const localDateKey = localStart.toISOString().slice(0, 10);
    if (localDateKey !== localEnd.toISOString().slice(0, 10)) return false;
    const special = specialSchedules.find(
      (candidate) =>
        candidate.is_active &&
        dateKey(candidate.starts_on) <= localDateKey &&
        dateKey(candidate.ends_on) >= localDateKey,
    );
    if (special?.is_closed) return false;
    const regular = operatingHourByDay.get(localStart.getUTCDay());
    const defaultOpen = localStart.getUTCDay() === 0 ? 8 * 60 : 6 * 60;
    const defaultClose = localStart.getUTCDay() === 0 ? 18 * 60 : 22 * 60;
    const opens = special?.opens_at
      ? timeMinutesFor(special.opens_at)
      : regular?.opens_at
        ? timeMinutesFor(regular.opens_at)
        : defaultOpen;
    const closes = special?.closes_at
      ? timeMinutesFor(special.closes_at)
      : regular?.closes_at
        ? timeMinutesFor(regular.closes_at)
        : defaultClose;
    if (regular?.is_closed) return false;
    return (
      gymTimeMinutes(startsAt) >= opens && gymTimeMinutes(endsAt) <= closes
    );
  };
  for (const booking of bookings) {
    check(
      booking.starts_at < booking.ends_at &&
        booking.starts_at.toISOString().slice(0, 10) ===
          booking.ends_at.toISOString().slice(0, 10),
      'dates',
      `booking ${booking.id} has an invalid time window`,
    );
    const bookingTotal = money(booking.total_amount);
    const isFreeBooking = bookingTotal === 0;
    check(
      bookingTotal >= 0 &&
        money(booking.downpayment_amount) === 0 &&
        money(booking.balance_amount) === 0,
      'derived-fields',
      `booking ${booking.id} does not expose a non-negative settled total`,
    );
    check(
      money(booking.downpayment_amount) === 0 &&
        money(booking.balance_amount) === 0 &&
        booking.downpayment_paid_at !== null &&
        (isFreeBooking
          ? booking.balance_paid_at === null
          : booking.balance_paid_at !== null),
      'payment',
      `booking ${booking.id} exposes an invalid free/paid payment timestamp state`,
    );
    check(
      booking.created_at <= booking.starts_at,
      'dates',
      `booking ${booking.id} was created after its scheduled start`,
    );
    const amenity = amenityById.get(booking.amenity_id);
    check(
      Boolean(amenity),
      'foreign-keys',
      `booking ${booking.id} references an unknown amenity`,
    );
    if (amenity) {
      const durationHours =
        (booking.ends_at.getTime() - booking.starts_at.getTime()) /
        (60 * 60 * 1_000);
      check(
        durationHours >= Math.max(1, amenity.minimum_hours ?? 1) &&
          Number.isInteger(durationHours),
        'derived-fields',
        `booking ${booking.id} is shorter than the amenity minimum or not hourly`,
      );
      check(
        bookingWithinGymHours(booking.starts_at, booking.ends_at),
        'availability',
        `booking ${booking.id} falls outside gym operating hours`,
      );
      if (ACTIVE_CAPACITY_BOOKING_STATUSES.has(booking.status)) {
        check(
          amenity.is_active !== false &&
            amenity.is_mapped !== false &&
            amenity.is_reservable === true &&
            (amenity.status === null ||
              amenity.status === EquipmentStatus.available),
          'maintenance',
          `active booking ${booking.id} conflicts with the amenity reservability state`,
        );
      }
    }
    if (ACTIVE_CAPACITY_BOOKING_STATUSES.has(booking.status)) {
      check(
        booking.status === BookingStatus.confirmed,
        'status',
        `future booking ${booking.id} is not confirmed`,
      );
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
      const owner = accountByUserId.get(booking.user_id);
      check(
        owner?.role === UserRole.member &&
          owner.emailVerified !== false &&
          owner.status === UserStatus.active &&
          owner.hasCurrentAccess === true &&
          owner.lifecycle?.accessStart !== null &&
          (owner.lifecycle?.accessEnd === null ||
            owner.lifecycle?.accessEnd === undefined ||
            booking.ends_at <= owner.lifecycle.accessEnd),
        'eligibility',
        `future booking ${booking.id} belongs to an ineligible member`,
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
      check(
        bookingAuditIds.has(booking.id),
        'audit',
        `completed booking ${booking.id} lacks completion audit evidence`,
      );
    }
    if (booking.status === BookingStatus.cancelled) {
      check(
        booking.cancelled_at !== null &&
          booking.cancellation_reason !== null &&
          booking.cancellation_reason.trim().length > 0,
        'status',
        `cancelled booking ${booking.id} lacks cancellation evidence or reason`,
      );
      check(
        bookingAuditIds.has(booking.id),
        'audit',
        `cancelled booking ${booking.id} lacks cancellation audit evidence`,
      );
    }
    if (booking.status === BookingStatus.no_show) {
      check(
        booking.completed_at === null && booking.cancelled_at === null,
        'status',
        `no-show booking ${booking.id} has a contradictory terminal timestamp`,
      );
      check(
        bookingAuditIds.has(booking.id),
        'audit',
        `no-show booking ${booking.id} lacks no-show audit evidence`,
      );
    }
    const bookingHolds = holdsByBookingId.get(booking.id) ?? [];
    const holdPayments = bookingHolds.flatMap((hold) => {
      const linked = hold.payment_id
        ? paymentById.get(hold.payment_id)
        : undefined;
      const payable =
        paymentByPayable.get(
          `${PayableType.commerce_checkout_hold}:${hold.id}`,
        ) ?? [];
      return linked ? [linked, ...payable] : payable;
    });
    const directPayments =
      paymentByPayable.get(`${PayableType.booking}:${booking.id}`) ?? [];
    const lineagePayments = [...holdPayments, ...directPayments];
    const distinctHoldIds = new Set(bookingHolds.map((hold) => hold.id));
    const distinctPaymentIds = new Set(
      lineagePayments.map((payment) => payment.id),
    );
    check(
      distinctHoldIds.size <= 1 && distinctPaymentIds.size <= 1,
      'payment',
      `booking ${booking.id} has duplicate paid commerce hold/payment lineage`,
    );
    const bookingHold = bookingHolds[0];
    const holdPayment = bookingHold?.payment_id
      ? paymentById.get(bookingHold.payment_id)
      : undefined;
    const bookingPayment = lineagePayments[0];
    check(
      isFreeBooking
        ? bookingHolds.length === 0 && lineagePayments.length === 0
        : Boolean(bookingPayment) && bookingHolds.length === 1,
      'payment',
      isFreeBooking
        ? `free booking ${booking.id} must not have payment or hold lineage`
        : `paid booking ${booking.id} must have one consumed venue hold and payment`,
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
    if (bookingHold) {
      check(
        bookingHold.kind === CommerceCheckoutHoldKind.venue &&
          bookingHold.status === CommerceCheckoutHoldStatus.consumed &&
          bookingHold.booking_id === booking.id &&
          bookingHold.amenity_id === booking.amenity_id &&
          bookingHold.scheduled_at?.getTime() === booking.starts_at.getTime() &&
          bookingHold.ends_at?.getTime() === booking.ends_at.getTime() &&
          sameMoney(bookingHold.amount, booking.total_amount),
        'payment',
        `venue booking ${booking.id} is not linked to an exact consumed venue hold`,
      );
      check(
        bookingHold.consumed_at !== null &&
          bookingHold.created_at <= bookingHold.consumed_at &&
          bookingHold.consumed_at <= bookingHold.expires_at &&
          bookingHold.released_at === null &&
          bookingHold.failure_reason === null,
        'payment',
        `venue booking ${booking.id} consumes an expired or terminal hold`,
      );
      check(
        Boolean(holdPayment) &&
          holdPayment?.payable_type === PayableType.commerce_checkout_hold &&
          holdPayment.payable_id === bookingHold.id &&
          holdPayment.provider === PaymentProvider.paymongo &&
          bookingHold.payment_id === holdPayment.id &&
          bookingHold.consumed_at !== null &&
          holdPayment.created_at <= bookingHold.consumed_at &&
          holdPayment.verified_at !== null &&
          holdPayment.verified_at <= bookingHold.consumed_at,
        'payment',
        `venue booking ${booking.id} has invalid hold/payment provenance`,
      );
    }
    try {
      assertVenueBookingLineage({
        booking: {
          id: booking.id,
          amenity_id: booking.amenity_id,
          starts_at: booking.starts_at,
          ends_at: booking.ends_at,
          total_amount: booking.total_amount,
          downpayment_amount: booking.downpayment_amount,
          balance_amount: booking.balance_amount,
          downpayment_paid_at: booking.downpayment_paid_at,
          balance_paid_at: booking.balance_paid_at,
        },
        holds: bookingHolds,
        payments: lineagePayments,
      });
    } catch (error) {
      check(
        false,
        'payment',
        error instanceof Error
          ? error.message
          : `booking ${booking.id} failed venue lineage assertion`,
      );
    }
  }

  const activeBookings = bookings.filter((booking) =>
    ACTIVE_CAPACITY_BOOKING_STATUSES.has(booking.status),
  );
  check(
    !hasKeyedIntervalOverlap(
      bookings.map((booking) => ({
        key: booking.user_id,
        start: booking.starts_at,
        end: booking.ends_at,
      })),
    ),
    'overlap',
    'venue bookings overlap for the same member across terminal history',
  );
  const bookingIntervals = activeBookings.map((booking) => ({
    key: booking.user_id,
    start: booking.starts_at,
    end: booking.ends_at,
  }));
  check(
    !hasKeyedIntervalOverlap(bookingIntervals),
    'overlap',
    'active venue bookings overlap for the same member',
  );
  const liveVenueHolds = holds.filter(
    (hold) =>
      hold.amenity_id !== null &&
      hold.scheduled_at !== null &&
      hold.ends_at !== null &&
      hold.status === CommerceCheckoutHoldStatus.held &&
      hold.expires_at > new Date(),
  );
  const venueOccupancy: VenueCapacityInterval[] = [
    ...activeBookings.map((booking) => ({
      amenityId: booking.amenity_id,
      capacity: amenityCapacity.get(booking.amenity_id) ?? 0,
      start: booking.starts_at,
      end: booking.ends_at,
    })),
    ...liveVenueHolds.map((hold) => ({
      amenityId: hold.amenity_id!,
      capacity: amenityCapacity.get(hold.amenity_id!) ?? 0,
      start: hold.scheduled_at!,
      end: hold.ends_at!,
    })),
  ];
  check(
    !hasVenueCapacityOverflow(venueOccupancy),
    'overlap',
    'venue booking and live-hold occupancy exceeds amenity capacity',
  );

  const coachUserByProfile = new Map(
    coachProfiles.map((profile) => [profile.id, profile.user_id]),
  );
  const availabilityByCoach = new Map<string, typeof availabilitySlots>();
  for (const slot of availabilitySlots) {
    const rows = availabilityByCoach.get(slot.coach_id) ?? [];
    rows.push(slot);
    availabilityByCoach.set(slot.coach_id, rows);
  }
  const coachAccounts = ctx.state.accounts.filter(
    (account) => account.role === UserRole.coach,
  );
  for (const dimension of [
    ['coachLifecycle', 'active', 70],
    ['coachLifecycle', 'paused', 20],
    ['coachLifecycle', 'former', 10],
    ['coachQuality', 'excellent', 15],
    ['coachQuality', 'good', 50],
    ['coachQuality', 'average', 25],
    ['coachQuality', 'poor', 10],
    ['coachWorkload', 'high', 30],
    ['coachWorkload', 'medium', 50],
    ['coachWorkload', 'low', 20],
  ] as const) {
    const [name, value, weight] = dimension;
    const actual = coachAccounts.filter(
      (account) => account[name] === value,
    ).length;
    const expected = coachAccounts.length * (weight / 100);
    check(
      Math.abs(actual - expected) <=
        Math.max(2, ctx.state.memberKeys.length * 0.04),
      'scenario',
      `coach ${name} distribution is outside its deterministic quota`,
    );
  }
  const reviewsByCoach = new Map<string, typeof coachReviews>();
  for (const review of coachReviews) {
    const rows = reviewsByCoach.get(review.coach_id) ?? [];
    rows.push(review);
    reviewsByCoach.set(review.coach_id, rows);
  }
  for (const profile of coachProfiles) {
    const account = coachAccounts.find(
      (candidate) => ctx.state.userIds[candidate.key] === profile.user_id,
    );
    const active = account?.coachLifecycle === 'active';
    const slots = availabilityByCoach.get(profile.id) ?? [];
    check(
      profile.is_available_for_booking === active &&
        profile.monthly_offer_active === active,
      'lifecycle',
      `coach profile ${profile.id} disagrees with coach lifecycle bookability`,
    );
    check(
      active
        ? slots.some((slot) => slot.is_active)
        : slots.every((slot) => !slot.is_active),
      'availability',
      `coach ${profile.id} has availability inconsistent with lifecycle`,
    );
    const reviews = reviewsByCoach.get(profile.id) ?? [];
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    check(
      profile.rating_count === reviews.length &&
        (reviews.length === 0
          ? profile.average_rating === null
          : sameMoney(
              profile.average_rating,
              (totalRating / reviews.length).toFixed(2),
            )),
      'reviews',
      `coach profile ${profile.id} rating aggregate disagrees with reviews`,
    );
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
  const coachProfileById = new Map(
    coachProfiles.map((profile) => [profile.id, profile]),
  );
  const recurringPlanByTrainingPlanId = new Map(
    plans
      .filter((plan) => plan.training_plan_id !== null)
      .map((plan) => [plan.training_plan_id as string, plan]),
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
    const coachAccount = coachAccounts.find(
      (account) =>
        ctx.state.userIds[account.key] ===
        coachUserByProfile.get(appointment.coach_id),
    );
    const memberAccount = accountByUserId.get(appointment.user_id);
    if (appointment.scheduled_at >= anchor) {
      check(
        coachAccount?.coachLifecycle === 'active' &&
          memberAccount?.hasCurrentAccess === true &&
          memberAccount.status === UserStatus.active,
        'lifecycle',
        `future appointment ${appointment.id} uses an ineligible coach or member`,
      );
    }
    const availability = availabilityByCoach.get(appointment.coach_id) ?? [];
    const startMinutes = gymTimeMinutes(appointment.scheduled_at);
    const endMinutes = startMinutes + appointment.duration_minutes;
    const historicalInactiveCoach =
      appointment.scheduled_at < anchor &&
      coachAccount?.coachLifecycle !== 'active';
    check(
      historicalInactiveCoach ||
        availability.some(
          (slot) =>
            slot.is_active &&
            slot.day_of_week === gymDayOfWeek(appointment.scheduled_at) &&
            timeMinutes(slot.start_time) <= startMinutes &&
            timeMinutes(slot.end_time) >= endMinutes,
        ),
      'availability',
      `appointment ${appointment.id} falls outside coach availability`,
    );
    check(
      coachWithinGymHours(appointment.scheduled_at, end),
      'availability',
      `appointment ${appointment.id} falls outside gym operating hours`,
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
      const coveringCycle = billingCycles.find(
        (cycle) =>
          cycle.recurring_plan_id === appointment.recurring_plan_id &&
          cycle.cycle_start_date <= appointment.scheduled_at &&
          cycle.cycle_end_date.getTime() + DAY_MS >
            appointment.scheduled_at.getTime(),
      );
      const cyclePayment = coveringCycle?.payment_id
        ? payments.find((payment) => payment.id === coveringCycle.payment_id)
        : undefined;
      check(
        Boolean(coveringCycle && cyclePayment),
        'payment',
        `appointment ${appointment.id} has no paid billing cycle`,
      );
      if (coveringCycle && cyclePayment) {
        check(
          cyclePayment.status === PaymentStatus.completed &&
            cyclePayment.payment_stage === PaymentStage.full &&
            sameMoney(cyclePayment.amount, coveringCycle.amount) &&
            (cyclePayment.payable_type === PayableType.recurring_coaching ||
              (cyclePayment.payable_type ===
                PayableType.commerce_checkout_hold &&
                monthlyHoldByPlanId.get(appointment.recurring_plan_id)
                  ?.payment_id === cyclePayment.id)),
          'payment',
          `appointment ${appointment.id} is not backed by a settled recurring billing cycle`,
        );
      }
    } else {
      check(
        appointment.recurring_schedule_item_id === null,
        'domain',
        `one-time appointment ${appointment.id} has a recurring schedule item`,
      );
      const checkoutHold = holdByAppointmentId.get(appointment.id);
      const coachingPayment = checkoutHold?.payment_id
        ? payments.find((payment) => payment.id === checkoutHold.payment_id)
        : undefined;
      check(
        checkoutHold?.kind === CommerceCheckoutHoldKind.one_time &&
          checkoutHold.status === CommerceCheckoutHoldStatus.consumed &&
          coachingPayment?.payable_type ===
            PayableType.commerce_checkout_hold &&
          coachingPayment.payable_id === checkoutHold.id &&
          coachingPayment?.status === PaymentStatus.completed &&
          coachingPayment.provider === PaymentProvider.paymongo &&
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
          appointment.scheduled_at.getTime() +
            appointment.duration_minutes * 60_000,
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
          appointment.scheduled_at.getTime() +
            appointment.duration_minutes * 60_000,
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
      hold.status === CommerceCheckoutHoldStatus.expired ||
      hold.status === CommerceCheckoutHoldStatus.released;
    const consumed = hold.status === CommerceCheckoutHoldStatus.consumed;
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
      active
        ? hold.expires_at > anchor
        : terminalFailure
          ? hold.expires_at <= anchor
          : consumed
            ? hold.expires_at <= anchor
            : false,
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
      check(
        hold.released_at !== null &&
          hold.released_at >= hold.created_at &&
          hold.released_at <= anchor,
        'checkout-hold',
        `terminal checkout hold ${hold.id} is missing a release timestamp`,
      );
    } else if (consumed) {
      check(
        hold.consumed_at !== null &&
          hold.consumed_at >= hold.created_at &&
          hold.consumed_at <= anchor &&
          hold.released_at === null &&
          hold.failure_reason === null &&
          productReferences.some((reference) => reference !== null),
        'checkout-hold',
        `consumed checkout hold ${hold.id} has invalid product lifecycle metadata`,
      );
    } else {
      check(
        hold.consumed_at === null &&
          hold.released_at === null &&
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
          : consumed
            ? holdPayment.status === PaymentStatus.completed &&
              holdPayment.provider === 'paymongo' &&
              Boolean(holdPayment.provider_ref) &&
              holdPayment.verified_at !== null &&
              holdPayment.created_at <= hold.consumed_at! &&
              holdPayment.verified_at <= hold.consumed_at! &&
              sameMoney(holdPayment.amount, hold.amount)
            : holdPayment.status === PaymentStatus.failed &&
              holdPayment.provider === 'paymongo' &&
              Boolean(holdPayment.provider_ref) &&
              sameMoney(holdPayment.amount, hold.amount) &&
              holdPayment.created_at <= hold.expires_at),
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
            item.scheduled_at.getTime() ===
              appointment.scheduled_at.getTime() &&
            item.status ===
              (appointment.status === AppointmentStatus.cancelled ||
              appointment.status === AppointmentStatus.no_show
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
      const planCycles = billingCycles
        .filter((candidate) => candidate.recurring_plan_id === plan.id)
        .sort(
          (left, right) =>
            left.cycle_start_date.getTime() - right.cycle_start_date.getTime(),
        );
      const firstCycle = planCycles[0];
      const expectedFirstPayment = monthlyHoldByPlanId.get(plan.id)?.payment_id;
      const firstCycleLineage =
        cycle.id === firstCycle?.id
          ? cyclePayment?.payable_type === PayableType.commerce_checkout_hold &&
            cyclePayment.payable_id === monthlyHoldByPlanId.get(plan.id)?.id &&
            cyclePayment.id === expectedFirstPayment
          : cyclePayment?.payable_type === PayableType.recurring_coaching &&
            cyclePayment.payable_id === cycle.id;
      check(
        Boolean(cyclePayment) &&
          cyclePayment?.status === PaymentStatus.completed &&
          cyclePayment.payment_stage === PaymentStage.full &&
          sameMoney(cyclePayment.amount, cycle.amount) &&
          firstCycleLineage,
        'payment',
        `billing cycle ${cycle.recurring_plan_id} has no matching full payment`,
      );
    }
    check(
      billingCycles.filter(
        (candidate) => candidate.recurring_plan_id === plan.id,
      ).length >= 1,
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
      const assignedPlan = trainingPlanById.get(assignment.training_plan_id);
      const appointmentCoach = coachProfileById.get(appointment.coach_id);
      check(
        Boolean(assignedPlan) &&
          Boolean(appointmentCoach) &&
          assignedPlan?.coach_id === appointmentCoach?.user_id,
        'coach-ownership',
        `assignment ${assignment.id} does not agree with the appointment coach owner`,
      );
      const recurringPlan = recurringPlanByTrainingPlanId.get(
        assignment.training_plan_id,
      );
      if (recurringPlan && appointment.recurring_plan_id) {
        check(
          recurringPlan.id === appointment.recurring_plan_id &&
            recurringPlan.member_id === appointment.user_id &&
            recurringPlan.coach_id === appointment.coach_id,
          'coach-ownership',
          `assignment ${assignment.id} disagrees with its recurring coaching contract`,
        );
      }
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
      if (appointment.status === AppointmentStatus.completed) {
        check(
          assignment.state === 'completed' &&
            assignment.workout_session_id !== null,
          'dependents',
          `completed appointment ${appointment.id} lacks a completed workout assignment`,
        );
        check(
          Boolean(
            assignment.workout_session_id &&
            workoutSessions.some(
              (session) =>
                session.id === assignment.workout_session_id &&
                session.status === SessionStatus.completed,
            ),
          ),
          'dependents',
          `completed appointment ${appointment.id} lacks a linked completed workout session`,
        );
      }
      if (
        appointment.status === AppointmentStatus.cancelled ||
        appointment.status === AppointmentStatus.no_show
      ) {
        check(
          assignment.state === 'skipped',
          'derived-fields',
          `terminal appointment ${appointment.id} has a non-skipped assignment`,
        );
        check(
          assignment.workout_session_id === null &&
            assignment.completed_at === null,
          'derived-fields',
          `terminal appointment ${appointment.id} has fake workout completion`,
        );
        const scheduleItem = scheduleItems.find(
          (candidate) =>
            candidate.id === appointment.recurring_schedule_item_id,
        );
        check(
          scheduleItem?.status ===
            RecurringCoachingScheduleItemStatus.cancelled,
          'derived-fields',
          `terminal appointment ${appointment.id} has an activated schedule item`,
        );
      }
      if (
        appointment.status === AppointmentStatus.confirmed &&
        appointment.scheduled_at >= anchor
      ) {
        check(
          assignment.state === 'assigned' &&
            assignment.workout_session_id === null &&
            assignment.completed_at === null,
          'derived-fields',
          `future appointment ${appointment.id} is not an unstarted assignment`,
        );
      }
      check(
        assignment.state === 'assigned' ||
          assignment.state === 'completed' ||
          assignment.state === 'skipped',
        'domain',
        `assignment ${assignment.id} uses a forbidden state`,
      );
      if (assignment.state === 'completed') {
        check(
          appointment.status === AppointmentStatus.completed &&
            assignment.workout_session_id !== null,
          'derived-fields',
          `assignment ${assignment.id} is completed without a completed appointment`,
        );
      }
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
      const recurringPlan = recurringPlanByTrainingPlanId.get(trainingPlan.id);
      if (recurringPlan && trainingPlan.coach_id) {
        const coachProfile = coachProfileById.get(recurringPlan.coach_id);
        const relationship = coachProfile
          ? relationshipByKey.get(
              `${recurringPlan.coach_id}:${recurringPlan.member_id}`,
            )
          : undefined;
        check(
          coachProfile?.user_id === trainingPlan.coach_id,
          'coach-ownership',
          `coach plan ${trainingPlan.id} does not belong to its recurring coach profile`,
        );
        check(
          trainingPlan.is_active
            ? recurringPlan.status === RecurringCoachingPlanStatus.active &&
                relationship?.status === RelationshipStatus.active
            : recurringPlan.status !== RecurringCoachingPlanStatus.active ||
                relationship?.status !== RelationshipStatus.active,
          'coach-ownership',
          `coach plan ${trainingPlan.id} has an invalid active state for its member relationship`,
        );
      }
    }
    if (trainingPlan.source !== PlanSource.coach_assigned) {
      check(
        trainingPlan.coach_id === null,
        'domain',
        `personal plan ${trainingPlan.id} is coupled to a coach`,
      );
    }
  }

  const exerciseById = new Map(
    exerciseCatalog.map((exercise) => [exercise.id, exercise]),
  );
  const planExerciseById = new Map<
    string,
    (typeof scheduleDays)[number]['exercises'][number]
  >();
  for (const day of scheduleDays) {
    for (const exercise of day.exercises) {
      planExerciseById.set(exercise.id, exercise);
    }
  }
  const bodyweightOrDurationExerciseIds = new Set(
    ['dip', 'mobility-flow', 'plank', 'pull-up', 'push-up', 'run'].map((key) =>
      seedId(`exercise:${key}`),
    ),
  );
  const logsBySession = new Map<string, typeof exerciseLogs>();
  for (const log of exerciseLogs) {
    const rows = logsBySession.get(log.session_id) ?? [];
    rows.push(log);
    logsBySession.set(log.session_id, rows);
  }

  for (const plan of trainingPlans) {
    const planDays = scheduleDaysByPlan.get(plan.id) ?? [];
    const daysByWeek = new Map<number, typeof planDays>();
    for (const day of planDays) {
      const rows = daysByWeek.get(day.week_number) ?? [];
      rows.push(day);
      daysByWeek.set(day.week_number, rows);
    }
    for (
      let weekNumber = 1;
      weekNumber <= plan.duration_weeks;
      weekNumber += 1
    ) {
      const weekDays = daysByWeek.get(weekNumber) ?? [];
      check(
        weekDays.length === 7,
        'training-plan',
        `training plan ${plan.id} is missing a complete week ${weekNumber}`,
      );
      const seenDayOfWeek = new Set<number>();
      let workoutDayCount = 0;
      for (const day of weekDays) {
        if (seenDayOfWeek.has(day.day_of_week)) {
          check(
            false,
            'training-plan',
            `training plan ${plan.id} repeats week ${weekNumber} day ${day.day_of_week}`,
          );
        }
        seenDayOfWeek.add(day.day_of_week);
        const hasExercises = day.exercises.length > 0;
        if (day.is_rest_day === true) {
          check(
            !hasExercises,
            'training-plan',
            `rest schedule day ${day.id} contains exercises`,
          );
        } else {
          check(
            hasExercises,
            'training-plan',
            `workout schedule day ${day.id} has no exercises`,
          );
          if (hasExercises) workoutDayCount += 1;
        }
        for (const exercise of day.exercises) {
          check(
            exerciseById.has(exercise.exercise_id),
            'training-plan',
            `plan exercise ${exercise.id} references a missing exercise`,
          );
          if (bodyweightOrDurationExerciseIds.has(exercise.exercise_id)) {
            check(
              exercise.weight_kg_target === null,
              'training-plan',
              `bodyweight/duration plan exercise ${exercise.id} has an external weight`,
            );
          }
          check(
            exercise.sets >= 1 && exercise.sets <= 6,
            'training-plan',
            `plan exercise ${exercise.id} has an unreasonable set count`,
          );
          if (exercise.reps !== null) {
            check(
              exercise.reps >= 1 && exercise.reps <= 30,
              'training-plan',
              `plan exercise ${exercise.id} has reps outside the seeded range`,
            );
          }
          if (exercise.duration_seconds !== null) {
            check(
              exercise.duration_seconds >= 15 &&
                exercise.duration_seconds <= 3_600,
              'training-plan',
              `plan exercise ${exercise.id} has duration outside the seeded range`,
            );
          }
        }
      }
      check(
        workoutDayCount === plan.days_per_week,
        'training-plan',
        `training plan ${plan.id} days_per_week ${plan.days_per_week} disagrees with week ${weekNumber} exercise-bearing days ${workoutDayCount}`,
      );
    }
  }

  const sessionById = new Map(
    workoutSessions.map((session) => [session.id, session]),
  );
  for (const session of workoutSessions) {
    if (session.status === 'completed') {
      const sessionLogs = logsBySession.get(session.id) ?? [];
      check(
        session.completed_at !== null &&
          session.started_at < session.completed_at &&
          session.completed_at <= anchor,
        'dates',
        `completed workout ${session.id} has an invalid lifecycle`,
      );
      check(
        sessionLogs.length > 0,
        'workout-session',
        `completed workout ${session.id} has no exercise logs`,
      );
      if (session.plan_id) {
        const planDays = scheduleDaysByPlan.get(session.plan_id) ?? [];
        const sessionPlanExerciseIds = new Set(
          sessionLogs
            .map((log) => log.plan_exercise_id)
            .filter((id): id is string => id !== null),
        );
        const completeDay = planDays.find((day) => {
          const dayExerciseIds = new Set(
            day.exercises.map((exercise) => exercise.id),
          );
          return (
            dayExerciseIds.size === sessionPlanExerciseIds.size &&
            [...dayExerciseIds].every((id) => sessionPlanExerciseIds.has(id))
          );
        });
        check(
          Boolean(completeDay),
          'workout-session',
          `completed workout ${session.id} does not contain a complete authored workout day`,
        );
        for (const planExerciseId of sessionPlanExerciseIds) {
          const expected = planExerciseById.get(planExerciseId)?.sets ?? 0;
          const actual = sessionLogs.filter(
            (log) => log.plan_exercise_id === planExerciseId,
          );
          check(
            expected > 0 && actual.length === expected,
            'workout-session',
            `completed workout ${session.id} has a partial set budget for plan exercise ${planExerciseId}`,
          );
          const setNumbers = new Set(actual.map((log) => log.set_number));
          check(
            setNumbers.size === actual.length,
            'workout-session',
            `completed workout ${session.id} repeats an exercise set number`,
          );
        }
      }
      const owner = accountByUserId.get(session.user_id);
      if (owner) {
        const window = memberAccessWindow(ctx, owner.key);
        check(
          Boolean(window.activityStart && window.activityEnd) &&
            session.started_at >=
              (window.activityStart ?? session.started_at) &&
            session.completed_at !== null &&
            session.completed_at <=
              (window.activityEnd ?? session.completed_at),
          'lifecycle',
          `completed workout ${session.id} (${owner.key}) falls outside the member activity window: started ${session.started_at.toISOString()}, completed ${session.completed_at?.toISOString() ?? 'null'}, activity ${window.activityStart?.toISOString() ?? 'null'}..${window.activityEnd?.toISOString() ?? 'null'}`,
        );
      }
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
      if (session.status === SessionStatus.completed && session.completed_at) {
        check(
          log.created_at <= session.completed_at,
          'dates',
          `exercise log ${log.id} is recorded after its completed workout`,
        );
      }
    }
    if (bodyweightOrDurationExerciseIds.has(log.exercise_id)) {
      check(
        log.weight_kg === null,
        'exercise-log',
        `bodyweight/duration exercise log ${log.id} has an external weight`,
      );
    }
    if (log.reps_completed !== null) {
      check(
        log.reps_completed >= 1 && log.reps_completed <= 30,
        'exercise-log',
        `exercise log ${log.id} has reps outside the bounded seeded range`,
      );
    }
    if (log.duration_seconds !== null) {
      check(
        log.duration_seconds >= 1 && log.duration_seconds <= 3_600,
        'exercise-log',
        `exercise log ${log.id} has duration outside the bounded seeded range`,
      );
    }
  }
  for (const exercise of CANONICAL_EXERCISE_CATALOG) {
    const exerciseId = seedId(`exercise:${exercise.key}`);
    const persisted = exerciseById.get(exerciseId);
    check(
      Boolean(persisted),
      'exercise-catalog',
      `canonical exercise ${exercise.key} is missing`,
    );
    if (!persisted) continue;
    check(
      persisted.is_active &&
        persisted.name === exercise.name &&
        persisted.muscle_group === exercise.muscleGroup &&
        !/\s/.test(persisted.muscle_group),
      'exercise-catalog',
      `canonical exercise ${exercise.key} is inactive or has a non-canonical muscle key`,
    );
  }

  const poseProfileById = new Map(
    poseProfiles.map((profile) => [profile.id, profile]),
  );
  const canonicalPoseProfileIds = new Set<string>();
  for (const capability of CANONICAL_POSE_CAPABILITIES) {
    const profileId = seedId(`pose-profile:${capability.exerciseKey}`);
    canonicalPoseProfileIds.add(profileId);
    const profile = poseProfileById.get(profileId);
    const exerciseId = seedId(`exercise:${capability.exerciseKey}`);
    check(
      Boolean(profile),
      'pose-profile',
      `canonical pose profile ${capability.exerciseKey} is missing`,
    );
    if (!profile) continue;
    check(
      profile.is_active &&
        profile.profile_kind === 'seed' &&
        profile.exercise_id === exerciseId &&
        profile.canonical_name === capability.poseExercise,
      'pose-profile',
      `canonical pose profile ${capability.exerciseKey} has an invalid exercise reference or active state`,
    );
    check(
      isValidPoseMovementContract(toSeedProfileMovementContract(profile)),
      'pose-profile',
      `canonical pose profile ${capability.exerciseKey} does not match its shared movement contract`,
    );
  }

  for (const legacyKey of ['bench', 'deadlift', 'row'] as const) {
    const profile = poseProfileById.get(seedId(`pose-profile:${legacyKey}`));
    if (!profile) continue;
    check(
      !profile.is_active,
      'pose-profile',
      `legacy pose profile ${legacyKey} remains active`,
    );
  }

  const activeCanonicalProfiles = poseProfiles.filter(
    (profile) =>
      canonicalPoseProfileIds.has(profile.id) &&
      profile.is_active &&
      profile.profile_kind === 'seed',
  );
  check(
    activeCanonicalProfiles.length === CANONICAL_POSE_CAPABILITIES.length,
    'pose-profile',
    'canonical pose profile registry has duplicate or missing active seed ownership',
  );

  const poseSessionByExerciseLog = new Map(
    poseSessions
      .filter((session) => session.exercise_log_id !== null)
      .map((session) => [session.exercise_log_id as string, session]),
  );
  const logById = new Map(exerciseLogs.map((log) => [log.id, log]));
  for (const session of poseSessions.filter((candidate) =>
    isDynamicSeedSummary(candidate.analysis_summary),
  )) {
    const profile = session.detected_profile_id
      ? poseProfileById.get(session.detected_profile_id)
      : undefined;
    const log = session.exercise_log_id
      ? logById.get(session.exercise_log_id)
      : undefined;
    check(
      Boolean(profile?.is_active) &&
        canonicalPoseProfileIds.has(profile?.id ?? ''),
      'pose-session',
      `seed pose session ${session.id} does not reference an active canonical profile`,
    );
    check(
      Boolean(log),
      'pose-session',
      `seed pose session ${session.id} does not reference an exercise log`,
    );
    const capability = CANONICAL_POSE_CAPABILITIES.find(
      (candidate) => candidate.poseExercise === profile?.canonical_name,
    );
    if (capability?.repModel === 'static_hold') {
      const summary = jsonRecord(session.analysis_summary);
      check(
        session.rep_count_ai === 0 &&
          typeof summary.holdSeconds === 'number' &&
          summary.holdSeconds >= 20 &&
          summary.holdSeconds <= 60,
        'pose-session',
        `static pose session ${session.id} uses rep semantics or duration outside 20-60 seconds`,
      );
      check(
        log?.reps_ai_counted === null,
        'pose-session',
        `static pose session ${session.id} marked a manual log as AI counted`,
      );
    } else {
      check(
        session.rep_count_ai > 0 &&
          log?.reps_ai_counted === session.rep_count_ai,
        'pose-session',
        `dynamic pose session ${session.id} does not carry a matching AI-counted log`,
      );
    }
    const summaryKeys = Object.keys(jsonRecord(session.analysis_summary));
    check(
      !summaryKeys.some((key) =>
        [
          'landmarks',
          'raw_landmarks',
          'calibration',
          'raw_keypoints',
          'frames',
          'signals',
        ].includes(key),
      ),
      'pose-session',
      `seed pose session ${session.id} contains raw pose telemetry`,
    );
  }

  for (const log of exerciseLogs.filter(
    (candidate) => candidate.reps_ai_counted !== null,
  )) {
    const poseSession = poseSessionByExerciseLog.get(log.id);
    const profile = poseSession?.detected_profile_id
      ? poseProfileById.get(poseSession.detected_profile_id)
      : undefined;
    const capability = CANONICAL_POSE_CAPABILITIES.find(
      (candidate) => candidate.poseExercise === profile?.canonical_name,
    );
    check(
      Boolean(poseSession) &&
        Boolean(profile?.is_active) &&
        capability?.repModel !== 'static_hold' &&
        poseSession?.rep_count_ai === log.reps_ai_counted,
      'exercise-log',
      `exercise log ${log.id} has an AI count without a matching dynamic pose session`,
    );
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
        (assignment) =>
          assignment.appointment_id === activeOneTimeAppointment.id,
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
        (day) =>
          day.plan_id === premiumTrainingPlan.id && day.exercises.length > 0,
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
  const activeOneTimeHold = activeOneTimeAppointment
    ? holds.find((hold) => hold.appointment_id === activeOneTimeAppointment.id)
    : undefined;
  const activeOneTimePayment = activeOneTimeHold?.payment_id
    ? payments.find((payment) => payment.id === activeOneTimeHold.payment_id)
    : undefined;
  const paidRecurringCycleFor = (
    appointment: (typeof appointments)[number],
  ) => {
    const cycle = billingCycles.find(
      (candidate) =>
        candidate.recurring_plan_id === appointment.recurring_plan_id &&
        candidate.cycle_start_date <= appointment.scheduled_at &&
        candidate.cycle_end_date.getTime() + DAY_MS >
          appointment.scheduled_at.getTime(),
    );
    const payment = cycle?.payment_id
      ? payments.find((candidate) => candidate.id === cycle.payment_id)
      : undefined;
    return Boolean(
      cycle &&
      payment?.status === PaymentStatus.completed &&
      payment.payment_stage === PaymentStage.full,
    );
  };
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
      activeOneTimeHold?.kind === CommerceCheckoutHoldKind.one_time &&
      activeOneTimeHold.status === CommerceCheckoutHoldStatus.consumed &&
      activeOneTimePayment?.status === PaymentStatus.completed &&
      activeOneTimePayment.payment_stage === PaymentStage.full &&
      activeOneTimePayment.payable_type ===
        PayableType.commerce_checkout_hold &&
      activeOneTimePayment.payable_id === activeOneTimeHold.id &&
      sameMoney(
        activeOneTimePayment.amount,
        activeOneTimeAppointment?.total_amount,
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
        paidRecurringCycleFor(appointment),
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
        paidRecurringCycleFor(appointment),
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
      (checkoutAbandonedHolds[0]?.status ===
        CommerceCheckoutHoldStatus.failed ||
        checkoutAbandonedHolds[0]?.status ===
          CommerceCheckoutHoldStatus.expired) &&
      Boolean(checkoutAbandonedHolds[0]?.failure_reason) &&
      checkoutHoldProductReferences(checkoutAbandonedHolds[0]).every(
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
  for (const row of progressionSources)
    incrementUsage('progressionSources', row.user_id);
  for (const row of progressionGrants) incrementUsage('grants', row.user_id);
  for (const row of sales) {
    if (row.customer_user_id) incrementUsage('sales', row.customer_user_id);
  }
  const aiSessionOwner = new Map(
    aiSessions.map((session) => [session.id, session.user_id]),
  );
  const gymSessionOwner = new Map(
    gymChatSessions.map((session) => [session.id, session.user_id]),
  );
  for (const row of aiMessages) {
    const userId = aiSessionOwner.get(row.session_id);
    if (userId) incrementUsage('chats', userId);
  }
  for (const row of gymChatMessages) {
    const userId = gymSessionOwner.get(row.session_id);
    if (userId) incrementUsage('chats', userId);
  }
  for (const account of ctx.state.accounts.filter(
    (candidate) => candidate.role === 'member',
  )) {
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
  const cohortKeys = COHORT_ORDER;
  const targets: Record<string, number> = {};
  for (const cohort of cohortKeys) {
    targets[`cohort:${cohort}`] = ctx.state.memberKeys.filter(
      (memberKey) => cohortForMember(ctx, memberKey) === cohort,
    ).length;
  }
  for (const domain of volumeDomains) {
    targets[domain] = ctx.state.memberKeys.reduce(
      (total, memberKey) => total + volumeBandForMember(ctx, memberKey)[domain],
      0,
    );
  }
  const buildCohort = (cohort: (typeof COHORT_ORDER)[number]) => ({
    actual: ctx.state.memberKeys.filter(
      (memberKey) => cohortForMember(ctx, memberKey) === cohort,
    ).length,
    target: ctx.state.memberKeys.filter(
      (memberKey) => cohortForMember(ctx, memberKey) === cohort,
    ).length,
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
    roleCounts: Object.fromEntries(roleCounts),
    scenarioCounts: ctx.state.scenarioCounts,
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
