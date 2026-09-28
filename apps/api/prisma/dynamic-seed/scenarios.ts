import { UserRole, UserStatus } from '@prisma/client';
import { SeedRandom } from './random';
import type {
  CoachLifecycle,
  CoachQuality,
  CoachWorkload,
  CoachingProfile,
  BookingProfile,
  MemberEngagement,
  MembershipLifecycle,
  PaymentProfile,
  SeedAccount,
  SeedScenario,
  ScenarioDimensionCounts,
} from './types';

/**
 * Weighted scenario quotas are assigned as deterministic quotas, not as
 * independent coin flips. This keeps a 150-member seed close to the written
 * distribution while still allowing pinned QA accounts to retain their exact
 * fixtures.
 */
export const SCENARIO_DIMENSION_WEIGHTS = {
  memberEngagement: {
    gym_rat: 10,
    frequent: 20,
    regular: 30,
    casual: 20,
    lazy: 15,
    zero_use: 5,
  },
  membershipLifecycle: {
    active: 55,
    trial_or_new: 10,
    expired: 15,
    frozen: 8,
    none_or_pending: 7,
    cancelled_former: 5,
  },
  bookingProfile: {
    none: 30,
    occasional: 40,
    regular: 20,
    heavy: 10,
  },
  coachingProfile: {
    none: 60,
    one_time: 15,
    recurring_active: 10,
    recurring_former: 12,
    checkout_failed: 3,
  },
  paymentProfile: {
    reliable: 85,
    failed_then_successful: 10,
    abandoned_or_failed: 5,
  },
  coachLifecycle: {
    active: 70,
    paused: 20,
    former: 10,
  },
  coachQuality: {
    excellent: 15,
    good: 50,
    average: 25,
    poor: 10,
  },
  // Coach workload is intentionally documented as high 30%, medium 50%,
  // low 20%; the assignment is quota-based and seed-shuffled.
  coachWorkload: {
    high: 30,
    medium: 50,
    low: 20,
  },
} as const;

type DimensionName = keyof typeof SCENARIO_DIMENSION_WEIGHTS;
type DimensionWeights = Record<string, number>;

const DIMENSION_NAMES = Object.keys(
  SCENARIO_DIMENSION_WEIGHTS,
) as DimensionName[];

function scenarioValue(
  account: SeedAccount,
  dimension: DimensionName,
): string | undefined {
  const nested = account.scenario;
  switch (dimension) {
    case 'memberEngagement':
      return (
        account.memberEngagement ??
        account.engagement ??
        nested?.memberEngagement ??
        nested?.engagement
      );
    case 'membershipLifecycle':
      return (
        account.membershipLifecycle ??
        account.membership ??
        nested?.membershipLifecycle ??
        nested?.membership
      );
    case 'bookingProfile':
      return (
        account.bookingBehavior ??
        account.bookingProfile ??
        account.booking ??
        nested?.bookingBehavior ??
        nested?.bookingProfile ??
        nested?.booking
      );
    case 'coachingProfile':
      return (
        account.coachingProfile ??
        account.coaching ??
        nested?.coachingProfile ??
        nested?.coaching
      );
    case 'paymentProfile':
      return (
        account.paymentProfile ??
        account.payment ??
        nested?.paymentProfile ??
        nested?.payment
      );
    case 'coachLifecycle':
      return account.coachLifecycle ?? nested?.coachLifecycle;
    case 'coachQuality':
      return account.coachQuality ?? nested?.coachQuality;
    case 'coachWorkload':
      return account.coachWorkload ?? nested?.coachWorkload;
  }
}

function weightedQuotas(total: number, weights: DimensionWeights) {
  const labels = Object.keys(weights);
  const weightTotal = labels.reduce((sum, label) => sum + weights[label], 0);
  const rows = labels.map((label, index) => {
    const exact = weightTotal > 0 ? (total * weights[label]) / weightTotal : 0;
    return {
      index,
      label,
      floor: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });
  let remaining = Math.max(
    0,
    total - rows.reduce((sum, row) => sum + row.floor, 0),
  );
  rows.sort(
    (left, right) =>
      right.remainder - left.remainder || left.index - right.index,
  );
  for (
    let index = 0;
    index < rows.length && remaining > 0;
    index += 1, remaining -= 1
  ) {
    rows[index].floor += 1;
  }
  return Object.fromEntries(rows.map((row) => [row.label, row.floor]));
}

function deterministicOrder(
  keys: readonly string[],
  seed: number,
  label: string,
) {
  const rng = new SeedRandom(seed ^ hashString(label));
  const ordered = [...keys];
  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.int(0, index);
    [ordered[index], ordered[swapIndex]] = [ordered[swapIndex], ordered[index]];
  }
  return ordered;
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function setDimension(
  account: SeedAccount,
  dimension: DimensionName,
  value: string,
): SeedAccount {
  const scenario: SeedScenario = { ...(account.scenario ?? {}) };
  const next = { ...account };
  switch (dimension) {
    case 'memberEngagement':
      next.memberEngagement = value as MemberEngagement;
      next.engagement = value as MemberEngagement;
      scenario.memberEngagement = value as MemberEngagement;
      scenario.engagement = value as MemberEngagement;
      break;
    case 'membershipLifecycle':
      next.membershipLifecycle = value as MembershipLifecycle;
      next.membership = value as MembershipLifecycle;
      scenario.membershipLifecycle = value as MembershipLifecycle;
      scenario.membership = value as MembershipLifecycle;
      break;
    case 'bookingProfile':
      next.bookingProfile = value as BookingProfile;
      next.bookingBehavior = value as BookingProfile;
      next.booking = value as BookingProfile;
      scenario.bookingProfile = value as BookingProfile;
      scenario.bookingBehavior = value as BookingProfile;
      scenario.booking = value as BookingProfile;
      break;
    case 'coachingProfile':
      next.coachingProfile = value as CoachingProfile;
      next.coaching = value as CoachingProfile;
      scenario.coachingProfile = value as CoachingProfile;
      scenario.coaching = value as CoachingProfile;
      break;
    case 'paymentProfile':
      next.paymentProfile = value as PaymentProfile;
      next.payment = value as PaymentProfile;
      scenario.paymentProfile = value as PaymentProfile;
      scenario.payment = value as PaymentProfile;
      break;
    case 'coachLifecycle':
      next.coachLifecycle = value as CoachLifecycle;
      scenario.coachLifecycle = value as CoachLifecycle;
      break;
    case 'coachQuality':
      next.coachQuality = value as CoachQuality;
      scenario.coachQuality = value as CoachQuality;
      break;
    case 'coachWorkload':
      next.coachWorkload = value as CoachWorkload;
      scenario.coachWorkload = value as CoachWorkload;
      break;
  }
  next.scenario = scenario;
  return next;
}

function assignDimension(
  accounts: SeedAccount[],
  dimension: DimensionName,
  weights: DimensionWeights,
  seed: number,
  eligible: (account: SeedAccount) => boolean,
) {
  const eligibleAccounts = accounts.filter(eligible);
  const pinned = eligibleAccounts.filter(
    (account) => account.pinned || account.isDemo,
  );
  const generated = eligibleAccounts.filter(
    (account) => !account.pinned && !account.isDemo,
  );
  const targets = weightedQuotas(eligibleAccounts.length, weights);
  const pinnedCounts = Object.fromEntries(
    Object.keys(weights).map((label) => [
      label,
      pinned.filter((account) => scenarioValue(account, dimension) === label)
        .length,
    ]),
  );
  const residual = Object.fromEntries(
    Object.keys(weights).map((label) => [
      label,
      Math.max(0, (targets[label] ?? 0) - (pinnedCounts[label] ?? 0)),
    ]),
  );
  const available = generated.length;
  const trimOrder = Object.keys(weights).sort(
    (left, right) =>
      (residual[right] ?? 0) - (residual[left] ?? 0) ||
      left.localeCompare(right),
  );
  while (
    Object.values(residual).reduce((sum, value) => sum + value, 0) > available
  ) {
    const label = trimOrder.find((candidate) => (residual[candidate] ?? 0) > 0);
    if (!label) break;
    residual[label] -= 1;
  }
  const fillOrder = Object.keys(weights).sort(
    (left, right) =>
      (weights[right] ?? 0) - (weights[left] ?? 0) || left.localeCompare(right),
  );
  let residualSlots =
    available - Object.values(residual).reduce((sum, value) => sum + value, 0);
  let fillIndex = 0;
  while (residualSlots > 0 && fillOrder.length > 0) {
    residual[fillOrder[fillIndex % fillOrder.length]] += 1;
    fillIndex += 1;
    residualSlots -= 1;
  }

  const labels = Object.entries(residual).flatMap(([label, count]) =>
    Array.from({ length: count }, () => label),
  );
  const orderedLabels = deterministicOrder(labels, seed, dimension);
  const orderedAccounts = deterministicOrder(
    generated.map((account) => account.key),
    seed,
    `${dimension}:accounts`,
  );
  const accountByKey = new Map(
    accounts.map((account) => [account.key, account]),
  );
  for (let index = 0; index < orderedAccounts.length; index += 1) {
    const account = accountByKey.get(orderedAccounts[index]);
    if (account) {
      accountByKey.set(
        account.key,
        setDimension(account, dimension, orderedLabels[index]),
      );
    }
  }
  return accounts.map((account) => accountByKey.get(account.key) ?? account);
}

function eligibleMember(account: SeedAccount) {
  return account.role === UserRole.member;
}

function eligibleCoach(account: SeedAccount) {
  return account.role === UserRole.coach;
}

function deriveMemberPersona(
  account: SeedAccount,
): SeedAccount['memberPersona'] {
  if (account.pinned || account.isDemo) {
    return account.memberPersona;
  }
  if (account.emailVerified === false) {
    return 'unverified';
  }
  if (account.status === UserStatus.suspended) {
    return 'suspended';
  }
  switch (account.membershipLifecycle) {
    case 'trial_or_new':
      return 'trial';
    case 'expired':
      return 'expired';
    case 'frozen':
      return 'frozen';
    case 'none_or_pending':
      return 'pending';
    case 'cancelled_former':
      return 'expired';
    case 'active':
    default:
      return account.coachingProfile === 'recurring_active'
        ? 'premium'
        : 'active';
  }
}

function normalizeOne(account: SeedAccount) {
  const next = { ...account };
  const isMember = account.role === UserRole.member;
  if (isMember) {
    // Former recurring coaching is a terminated product state. Generated
    // members assigned this behavior must not remain on an active membership
    // window that could make the downstream plan bookable.
    if (
      next.coachingProfile === 'recurring_former' &&
      !['expired', 'frozen', 'cancelled_former'].includes(
        next.membershipLifecycle ?? '',
      ) &&
      !next.pinned &&
      !next.isDemo
    ) {
      next.membershipLifecycle = 'cancelled_former';
      next.membership = 'cancelled_former';
    }
    const persona = deriveMemberPersona(next);
    const unverified = persona === 'unverified' || next.emailVerified === false;
    const suspended =
      persona === 'suspended' || next.membershipLifecycle === 'frozen';
    const historical =
      ['expired', 'archived'].includes(persona ?? '') ||
      next.membershipLifecycle === 'cancelled_former';
    const noMembership =
      persona === 'pending' ||
      persona === 'unverified' ||
      next.membershipLifecycle === 'none_or_pending';
    const eligibleForRecurring =
      next.membershipLifecycle === 'active' &&
      next.status !== UserStatus.suspended &&
      next.status !== UserStatus.pending &&
      next.emailVerified !== false;

    next.memberPersona = persona;
    if (unverified || noMembership) {
      next.hasCompletedHistory = false;
      next.hasFutureBookings = false;
      next.hasCurrentAccess = false;
      next.currentAccess = false;
    }
    if (historical || suspended) {
      next.hasCurrentAccess = false;
      next.currentAccess = false;
      next.hasFutureBookings = false;
      if (persona === 'archived') {
        next.bookingProfile = 'none';
        next.booking = 'none';
      }
      if (next.coachingProfile === 'recurring_active') {
        next.coachingProfile = 'recurring_former';
        next.coaching = 'recurring_former';
      }
    }
    if (next.coachingProfile === 'recurring_active' && !eligibleForRecurring) {
      next.coachingProfile = 'none';
      next.coaching = 'none';
    }
    if (next.coachingProfile === 'recurring_former') {
      next.hasCurrentAccess = false;
      next.currentAccess = false;
      next.hasFutureBookings = false;
    }
    if (next.coachingProfile === 'checkout_failed') {
      next.hasFutureBookings = false;
    }
    if (next.membershipLifecycle === 'active' && !unverified && !suspended) {
      next.hasCurrentAccess = true;
      next.currentAccess = true;
    }
    if (next.membershipLifecycle === 'trial_or_new' && !unverified) {
      next.hasCurrentAccess = true;
      next.currentAccess = true;
    }
    next.hasCompletedHistory =
      next.hasCompletedHistory ??
      (!unverified && !noMembership && next.memberEngagement !== 'zero_use');
    next.hasFutureBookings =
      next.hasFutureBookings ??
      (Boolean(next.hasCurrentAccess) && next.bookingProfile !== 'none');
    if (persona === 'archived') {
      next.hasFutureBookings = false;
      next.hasCurrentAccess = false;
      next.currentAccess = false;
    }
    if (persona === 'unverified') {
      next.emailVerified = false;
      next.status = UserStatus.pending;
    } else if (persona === 'suspended') {
      next.status = UserStatus.suspended;
    } else if (persona === 'pending') {
      next.status = UserStatus.pending;
    } else if (
      !next.status ||
      next.status === UserStatus.pending ||
      next.status === UserStatus.suspended
    ) {
      next.status = UserStatus.active;
    }
  }
  if (account.role === UserRole.coach) {
    if (next.coachLifecycle === 'former') {
      next.canAcceptFutureBookings = false;
      next.futureBookingAcceptance = false;
    } else {
      next.canAcceptFutureBookings = next.coachLifecycle !== 'paused';
      next.futureBookingAcceptance = next.coachLifecycle !== 'paused';
    }
  }

  const scenario: SeedScenario = {
    ...(next.scenario ?? {}),
    memberEngagement: next.memberEngagement,
    engagement: next.engagement,
    membershipLifecycle: next.membershipLifecycle,
    membership: next.membership,
    bookingProfile: next.bookingProfile,
    bookingBehavior: next.bookingBehavior ?? next.bookingProfile,
    booking: next.booking,
    coachingProfile: next.coachingProfile,
    coaching: next.coaching,
    paymentProfile: next.paymentProfile,
    payment: next.payment,
    coachLifecycle: next.coachLifecycle,
    coachQuality: next.coachQuality,
    coachWorkload: next.coachWorkload,
    hasCompletedHistory: next.hasCompletedHistory,
    hasFutureBookings: next.hasFutureBookings,
    hasCurrentAccess: next.hasCurrentAccess,
    currentAccess: next.currentAccess,
    canAcceptFutureBookings: next.canAcceptFutureBookings,
    futureBookingAcceptance: next.futureBookingAcceptance,
  };
  next.scenario = scenario;
  return next;
}

/** Assigns every generated account a stable scenario after identities exist. */
export function assignScenarioDimensions(
  accounts: readonly SeedAccount[],
  seed: number,
) {
  let assigned = accounts.map((account) => ({ ...account }));
  for (const dimension of DIMENSION_NAMES) {
    const weights = SCENARIO_DIMENSION_WEIGHTS[dimension] as DimensionWeights;
    const isCoachDimension = [
      'coachLifecycle',
      'coachQuality',
      'coachWorkload',
    ].includes(dimension);
    assigned = assignDimension(
      assigned,
      dimension,
      weights,
      seed,
      isCoachDimension ? eligibleCoach : eligibleMember,
    );
  }

  // Repair only the constrained coaching dimension after quota assignment so
  // recurring_active never lands on a non-active member. The swap preserves
  // the quota count while moving the label to an eligible deterministic peer.
  const invalidRecurring = assigned.filter(
    (account) =>
      account.role === UserRole.member &&
      !account.pinned &&
      !account.isDemo &&
      account.coachingProfile === 'recurring_active' &&
      account.membershipLifecycle !== 'active',
  );
  const eligibleRecurringTargets = assigned
    .filter(
      (account) =>
        account.role === UserRole.member &&
        !account.pinned &&
        !account.isDemo &&
        account.membershipLifecycle === 'active' &&
        account.status === UserStatus.active &&
        account.emailVerified !== false &&
        account.coachingProfile !== 'recurring_active',
    )
    .sort(
      (left, right) =>
        hashString(`${seed}:${left.key}`) - hashString(`${seed}:${right.key}`),
    );
  for (let index = 0; index < invalidRecurring.length; index += 1) {
    const invalid = invalidRecurring[index];
    const target = eligibleRecurringTargets[index];
    if (!target) break;
    assigned = assigned.map((account) =>
      account.key === invalid.key
        ? setDimension(account, 'coachingProfile', 'none')
        : account.key === target.key
          ? setDimension(account, 'coachingProfile', 'recurring_active')
          : account,
    );
  }

  // Payment outcomes are not independent of membership lifecycle. A terminal
  // abandoned/failed checkout cannot leave a paid membership behind, while a
  // failed-then-successful member must have an eligible lifecycle for the
  // subsequent full checkout/product to exist. Keep this repair in the shared
  // scenario engine so every seed domain observes the same legal combination.
  const abandonedWithMembership = assigned.filter(
    (account) =>
      account.role === UserRole.member &&
      !account.pinned &&
      !account.isDemo &&
      account.paymentProfile === 'abandoned_or_failed' &&
      account.membershipLifecycle !== 'none_or_pending',
  );
  for (const account of abandonedWithMembership) {
    assigned = assigned.map((candidate) =>
      candidate.key === account.key
        ? setDimension(candidate, 'membershipLifecycle', 'none_or_pending')
        : candidate,
    );
  }

  const failedWithoutMembership = assigned.filter(
    (account) =>
      account.role === UserRole.member &&
      !account.pinned &&
      !account.isDemo &&
      account.paymentProfile === 'failed_then_successful' &&
      account.membershipLifecycle === 'none_or_pending' &&
      account.emailVerified !== false &&
      account.status !== UserStatus.pending &&
      account.status !== UserStatus.suspended,
  );
  for (const account of failedWithoutMembership) {
    assigned = assigned.map((candidate) =>
      candidate.key === account.key
        ? setDimension(candidate, 'membershipLifecycle', 'active')
        : candidate,
    );
  }

  // A former coaching product is historical by definition. Keep lifecycle
  // quotas intact by moving the deterministic former label to a generated
  // expired/frozen/cancelled-former peer instead of mutating the lifecycle
  // dimension after quotas have been assigned.
  const invalidFormer = assigned.filter(
    (account) =>
      account.role === UserRole.member &&
      !account.pinned &&
      !account.isDemo &&
      account.coachingProfile === 'recurring_former' &&
      !['expired', 'frozen', 'cancelled_former'].includes(
        account.membershipLifecycle ?? '',
      ),
  );
  const formerTargets = assigned
    .filter(
      (account) =>
        account.role === UserRole.member &&
        !account.pinned &&
        !account.isDemo &&
        ['expired', 'frozen', 'cancelled_former'].includes(
          account.membershipLifecycle ?? '',
        ) &&
        account.coachingProfile !== 'recurring_former',
    )
    .sort(
      (left, right) =>
        hashString(`${seed}:${left.key}:former`) -
        hashString(`${seed}:${right.key}:former`),
    );
  for (let index = 0; index < invalidFormer.length; index += 1) {
    const invalid = invalidFormer[index];
    const target = formerTargets[index];
    if (!target) break;
    const targetProfile = target.coachingProfile ?? 'none';
    assigned = assigned.map((account) =>
      account.key === invalid.key
        ? setDimension(account, 'coachingProfile', targetProfile)
        : account.key === target.key
          ? setDimension(account, 'coachingProfile', 'recurring_former')
          : account,
    );
  }

  // Preserve marginal quality/workload quotas while guaranteeing the
  // combinations the coaching UI needs to exercise: an excellent low-load
  // coach and an active poor coach must both be reachable in the default seed.
  const generatedCoaches = assigned.filter(
    (account) =>
      account.role === UserRole.coach && !account.pinned && !account.isDemo,
  );
  const excellentLowTarget = generatedCoaches.find(
    (account) =>
      account.coachWorkload === 'low' && account.coachQuality !== 'excellent',
  );
  const excellentSource = generatedCoaches.find(
    (account) =>
      account.coachQuality === 'excellent' && account.coachWorkload !== 'low',
  );
  if (excellentLowTarget && excellentSource) {
    const targetQuality = excellentLowTarget.coachQuality ?? 'good';
    const sourceQuality = excellentSource.coachQuality ?? 'excellent';
    assigned = assigned.map((account) =>
      account.key === excellentLowTarget.key
        ? setDimension(account, 'coachQuality', sourceQuality)
        : account.key === excellentSource.key
          ? setDimension(account, 'coachQuality', targetQuality)
          : account,
    );
  }

  return assigned.map((account) => normalizeOne(account));
}

export function normalizeSeedAccountScenario(
  account: SeedAccount,
  allAccounts: readonly SeedAccount[] = [account],
) {
  void allAccounts;
  return normalizeOne(account);
}

export function validateScenarioCompatibility(account: SeedAccount): string[] {
  const issues: string[] = [];
  const persona = account.memberPersona;
  if (
    account.role === UserRole.member &&
    account.paymentProfile === 'abandoned_or_failed' &&
    account.membershipLifecycle !== 'none_or_pending'
  ) {
    issues.push(
      'abandoned/failed payment cannot retain a membership lifecycle',
    );
  }
  if (
    account.role === UserRole.member &&
    account.paymentProfile === 'failed_then_successful' &&
    account.membershipLifecycle === 'none_or_pending' &&
    account.emailVerified !== false &&
    account.status !== UserStatus.pending &&
    account.status !== UserStatus.suspended
  ) {
    issues.push(
      'failed-then-successful payment requires an eligible membership lifecycle',
    );
  }
  if (
    account.role === UserRole.member &&
    (persona === 'unverified' || account.emailVerified === false) &&
    account.hasCompletedHistory !== false
  ) {
    issues.push('unverified account has completed history');
  }
  if (
    account.role === UserRole.member &&
    persona === 'archived' &&
    (account.hasFutureBookings === true ||
      (account.bookingProfile ?? account.bookingBehavior) !== 'none')
  ) {
    issues.push('archived account has future bookings');
  }
  if (
    account.role === UserRole.member &&
    (persona === 'suspended' || account.membershipLifecycle === 'frozen') &&
    (account.hasCurrentAccess === true || account.currentAccess === true)
  ) {
    issues.push('suspended account has current access');
  }
  if (
    account.role === UserRole.member &&
    account.coachingProfile === 'recurring_active' &&
    (account.membershipLifecycle !== 'active' ||
      account.status !== UserStatus.active ||
      account.emailVerified === false)
  ) {
    issues.push('recurring coaching requires an eligible active member');
  }
  if (
    account.role === UserRole.coach &&
    account.coachLifecycle === 'former' &&
    (account.canAcceptFutureBookings === true ||
      account.futureBookingAcceptance === true)
  ) {
    issues.push('former coach accepts future bookings');
  }
  return issues;
}

export function validateSeedScenarioCompatibility(
  accounts: readonly SeedAccount[],
) {
  return accounts.flatMap((account) =>
    validateScenarioCompatibility(account).map((detail) => ({
      accountKey: account.key,
      detail,
    })),
  );
}

export function assertScenarioCompatibility(accounts: readonly SeedAccount[]) {
  const issues = validateSeedScenarioCompatibility(accounts);
  if (issues.length > 0) {
    throw new Error(
      `[dynamic-seed][scenario] invalid combinations: ${issues
        .map((issue) => `${issue.accountKey}: ${issue.detail}`)
        .join('; ')}`,
    );
  }
}

export function scenarioDimensionCounts(
  accounts: readonly SeedAccount[],
): ScenarioDimensionCounts {
  const counts: ScenarioDimensionCounts = {};
  for (const dimension of DIMENSION_NAMES) {
    counts[dimension] = {};
    for (const account of accounts) {
      const value = scenarioValue(account, dimension);
      if (value) {
        counts[dimension][value] = (counts[dimension][value] ?? 0) + 1;
      }
    }
  }
  return counts;
}

export function getScenarioDimension(
  account: SeedAccount,
  dimension: DimensionName,
) {
  return scenarioValue(account, dimension);
}
