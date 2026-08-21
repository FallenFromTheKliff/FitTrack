import type {
  BookingProfile,
  DynamicSeedConfig,
  DynamicSeedContext,
  MemberCohort,
  MemberEngagement,
  SeedAccount,
} from './types';
import { UserRole } from '@prisma/client';
import { daysFrom } from './time';

export type VolumeDomain =
  | 'workouts'
  | 'exerciseLogs'
  | 'nutrition'
  | 'attendance'
  | 'bookings'
  | 'notifications'
  | 'chats'
  | 'appointments'
  | 'progressionSources'
  | 'grants'
  | 'sales';

export type MemberVolumeBand = Record<VolumeDomain, number>;

export const COHORT_WEIGHTS: Record<MemberCohort, number> = {
  power: 10,
  frequent: 20,
  regular: 30,
  light_trial: 20,
  historical_only: 15,
  pending_unverified_suspended: 5,
};

export const COHORT_ORDER: readonly MemberCohort[] = [
  'power',
  'frequent',
  'regular',
  'light_trial',
  'historical_only',
  'pending_unverified_suspended',
];

export const MEMBER_VOLUME_BANDS: Record<MemberCohort, MemberVolumeBand> = {
  power: {
    workouts: 70,
    exerciseLogs: 175,
    nutrition: 170,
    attendance: 54,
    bookings: 30,
    notifications: 80,
    chats: 180,
    appointments: 30,
    progressionSources: 60,
    grants: 120,
    sales: 30,
  },
  frequent: {
    workouts: 45,
    exerciseLogs: 135,
    nutrition: 96,
    attendance: 30,
    bookings: 16,
    notifications: 45,
    chats: 90,
    appointments: 16,
    progressionSources: 45,
    grants: 90,
    sales: 18,
  },
  regular: {
    workouts: 24,
    exerciseLogs: 72,
    nutrition: 48,
    attendance: 14,
    bookings: 6,
    notifications: 18,
    chats: 36,
    appointments: 10,
    progressionSources: 24,
    grants: 48,
    sales: 8,
  },
  light_trial: {
    workouts: 8,
    exerciseLogs: 16,
    nutrition: 12,
    attendance: 4,
    bookings: 2,
    notifications: 8,
    chats: 12,
    appointments: 4,
    progressionSources: 8,
    grants: 16,
    sales: 3,
  },
  historical_only: {
    workouts: 18,
    exerciseLogs: 54,
    nutrition: 30,
    attendance: 10,
    bookings: 4,
    notifications: 12,
    chats: 28,
    appointments: 6,
    progressionSources: 18,
    grants: 36,
    sales: 6,
  },
  pending_unverified_suspended: {
    workouts: 0,
    exerciseLogs: 0,
    nutrition: 0,
    attendance: 0,
    bookings: 0,
    notifications: 3,
    chats: 4,
    appointments: 0,
    progressionSources: 0,
    grants: 0,
    sales: 0,
  },
};

export const HARD_CAPS: Record<VolumeDomain, number> = {
  workouts: 100,
  exerciseLogs: 200,
  nutrition: 200,
  attendance: 200,
  bookings: 100,
  notifications: 200,
  chats: 180,
  appointments: 100,
  progressionSources: 60,
  grants: 120,
  sales: 200,
};

const DENSITY_MULTIPLIERS = {
  low: 0.64,
  normal: 1,
  high: 1.32,
} as const;

const BOOKING_PROFILE_BASE_COUNTS: Record<BookingProfile, number> = {
  none: 0,
  occasional: 3,
  regular: 8,
  heavy: 16,
};

const COHORT_FILL: Record<MemberCohort, number> = {
  power: 0.68,
  frequent: 0.64,
  regular: 0.59,
  light_trial: 0.52,
  historical_only: 0.56,
  pending_unverified_suspended: 0.7,
};

const ENGAGEMENT_HISTORY_MULTIPLIERS: Record<MemberEngagement, number> = {
  gym_rat: 1,
  frequent: 0.8,
  regular: 0.6,
  casual: 0.75,
  lazy: 0.2,
  zero_use: 0,
};

const PINNED_COHORTS: Record<string, MemberCohort> = {
  'member-premium': 'power',
  'member-active': 'frequent',
  'member-frozen': 'historical_only',
  'member-pending': 'pending_unverified_suspended',
  'member-expired': 'historical_only',
  'member-unverified': 'pending_unverified_suspended',
  'member-archived': 'historical_only',
  'member-suspended': 'pending_unverified_suspended',
  'member-checkout-abandoned': 'pending_unverified_suspended',
};

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableFraction(value: string) {
  return stableHash(value) / 0x100000000;
}

function stableOffset(
  config: DynamicSeedConfig,
  memberKey: string,
  modulo: number,
) {
  return modulo > 0 ? stableHash(`${config.seed}:${memberKey}`) % modulo : 0;
}

export function buildMemberCohortMap(
  memberKeys: readonly string[],
  scenarioSource?:
    | readonly SeedAccount[]
    | Readonly<Record<string, SeedAccount>>,
): Record<string, MemberCohort> {
  const result: Record<string, MemberCohort> = {};
  const sourceByKey = (
    Array.isArray(scenarioSource)
      ? Object.fromEntries(
          (scenarioSource as readonly SeedAccount[]).map((account) => [
            account.key,
            account,
          ]),
        )
      : (scenarioSource ?? {})
  ) as Readonly<Record<string, SeedAccount>>;
  const remaining = memberKeys.filter((key) => {
    const pinned = PINNED_COHORTS[key];
    if (pinned) {
      result[key] = pinned;
      return false;
    }
    return true;
  });

  const cohortForScenario = (
    account: SeedAccount,
  ): MemberCohort | undefined => {
    switch (account.memberEngagement ?? account.scenario?.memberEngagement) {
      case 'gym_rat':
        return 'power';
      case 'frequent':
        return 'frequent';
      case 'regular':
        return 'regular';
      case 'casual':
        return 'light_trial';
      case 'lazy':
        return 'historical_only';
      case 'zero_use':
        return ['active', 'trial_or_new'].includes(
          account.membershipLifecycle ??
            account.scenario?.membershipLifecycle ??
            '',
        )
          ? 'light_trial'
          : 'pending_unverified_suspended';
      default:
        return undefined;
    }
  };

  const unassigned: string[] = [];
  for (const key of remaining) {
    const scenarioCohort = sourceByKey[key]
      ? cohortForScenario(sourceByKey[key])
      : undefined;
    if (scenarioCohort) {
      result[key] = scenarioCohort;
    } else {
      unassigned.push(key);
    }
  }

  const totalWeight = COHORT_ORDER.reduce(
    (sum, cohort) => sum + COHORT_WEIGHTS[cohort],
    0,
  );
  const rows = COHORT_ORDER.map((cohort, index) => {
    const exact =
      totalWeight > 0
        ? (unassigned.length * COHORT_WEIGHTS[cohort]) / totalWeight
        : 0;
    return {
      cohort,
      floor: Math.floor(exact),
      index,
      remainder: exact - Math.floor(exact),
    };
  });
  let remainder =
    unassigned.length - rows.reduce((sum, row) => sum + row.floor, 0);
  rows.sort(
    (left, right) =>
      right.remainder - left.remainder || left.index - right.index,
  );
  for (let index = 0; index < rows.length && remainder > 0; index += 1) {
    rows[index].floor += 1;
    remainder -= 1;
  }
  const orderedKeys = [...unassigned].sort(
    (left, right) =>
      stableHash(left) - stableHash(right) || left.localeCompare(right),
  );
  let offset = 0;
  for (const row of rows) {
    for (let index = 0; index < row.floor; index += 1) {
      const key = orderedKeys[offset];
      if (key) {
        result[key] = row.cohort;
        offset += 1;
      }
    }
  }

  return result;
}

export function cohortForMember(
  ctx: Pick<DynamicSeedContext, 'state'>,
  memberKey: string,
): MemberCohort {
  return ctx.state.memberCohorts[memberKey] ?? 'regular';
}

/**
 * Monthly coaching is a paid product cohort. Trial and restricted members can
 * still have ordinary gym history or a one-time appointment, but they never
 * receive a recurring coaching product, relationship, or client program.
 */
export function isMonthlyCoachingMember(
  ctx: Pick<DynamicSeedContext, 'config' | 'state'>,
  memberKey: string,
) {
  const account = ctx.state.accounts.find(
    (candidate) => candidate.key === memberKey,
  );
  return (
    account?.coachingProfile === 'recurring_active' &&
    account.membershipLifecycle === 'active' &&
    account.hasCurrentAccess === true &&
    account.status !== 'suspended' &&
    account.emailVerified !== false
  );
}

/** Historical recurring coaching is an explicit product scenario. */
export function isFormerCoachingMember(
  ctx: Pick<DynamicSeedContext, 'state'>,
  memberKey: string,
) {
  const account = ctx.state.accounts.find(
    (candidate) => candidate.key === memberKey,
  );
  return (
    account?.coachingProfile === 'recurring_former' &&
    account.hasCompletedHistory === true &&
    account.hasCurrentAccess !== true &&
    account.lifecycle?.historicalOnly === true
  );
}

/** Any member with a recurring coaching product, current or historical. */
export function isRecurringCoachingMember(
  ctx: Pick<DynamicSeedContext, 'config' | 'state'>,
  memberKey: string,
) {
  return (
    isMonthlyCoachingMember(ctx, memberKey) ||
    isFormerCoachingMember(ctx, memberKey)
  );
}

export function volumeBandForMember(
  ctx: Pick<DynamicSeedContext, 'state'>,
  memberKey: string,
) {
  return MEMBER_VOLUME_BANDS[cohortForMember(ctx, memberKey)];
}

export function memberVolumeCount(
  ctx: DynamicSeedContext,
  memberKey: string,
  domain: VolumeDomain,
  density: 'low' | 'normal' | 'high' = 'normal',
) {
  const account = ctx.state.accounts.find(
    (candidate) => candidate.key === memberKey,
  );
  const cohort = cohortForMember(ctx, memberKey);
  const cap = Math.min(MEMBER_VOLUME_BANDS[cohort][domain], HARD_CAPS[domain]);
  if (cap === 0) {
    return 0;
  }

  if (domain === 'workouts' || domain === 'exerciseLogs') {
    const engagement =
      account?.memberEngagement ??
      account?.scenario?.memberEngagement ??
      ('regular' as MemberEngagement);
    const window = memberAccessWindow(ctx, memberKey);
    const noHistory =
      !account ||
      account.role !== UserRole.member ||
      engagement === 'zero_use' ||
      account.emailVerified === false ||
      account.hasCompletedHistory === false ||
      account.memberPersona === 'pending' ||
      account.memberPersona === 'unverified' ||
      !window.activityStart ||
      !window.activityEnd;
    if (noHistory) {
      return 0;
    }
  }

  const historyScale =
    domain === 'workouts' || domain === 'exerciseLogs'
      ? ctx.config.exerciseHistory === 0
        ? 0
        : Math.min(1.5, Math.max(0.2, ctx.config.exerciseHistory / 50))
      : 1;
  const engagementScale =
    domain === 'workouts' || domain === 'exerciseLogs'
      ? ENGAGEMENT_HISTORY_MULTIPLIERS[
          account?.memberEngagement ??
            account?.scenario?.memberEngagement ??
            ('regular' as MemberEngagement)
        ]
      : 1;
  const jitter =
    stableFraction(`${ctx.config.seed}:${memberKey}:${domain}`) * 0.16 - 0.08;
  const densityScale = DENSITY_MULTIPLIERS[density];
  const estimate = Math.floor(
    cap *
      Math.max(0, COHORT_FILL[cohort] + jitter) *
      densityScale *
      historyScale *
      engagementScale,
  );
  return estimate > 0 ? Math.max(1, Math.min(cap, estimate)) : 0;
}

/**
 * Venue bookings are a scenario-shaped domain. Keep this separate from the
 * engagement/cohort volume bands so a high-workout member with
 * `bookingBehavior: none` does not accidentally receive reservations.
 */
export function bookingBehaviorFor(
  account: SeedAccount | undefined,
): BookingProfile {
  return (
    account?.bookingBehavior ??
    account?.bookingProfile ??
    account?.booking ??
    account?.scenario?.bookingBehavior ??
    account?.scenario?.bookingProfile ??
    account?.scenario?.booking ??
    'none'
  );
}

export function bookingVolumeCount(
  ctx: DynamicSeedContext,
  memberKey: string,
  density: 'low' | 'normal' | 'high' = 'normal',
) {
  const account = ctx.state.accounts.find(
    (candidate) => candidate.key === memberKey,
  );
  if (!account || account.role !== UserRole.member) {
    return 0;
  }

  const profile = bookingBehaviorFor(account);
  const base = BOOKING_PROFILE_BASE_COUNTS[profile] ?? 0;
  if (base === 0 || account.hasCompletedHistory === false) {
    return 0;
  }

  const window = memberAccessWindow(ctx, memberKey);
  const activityStart = window.activityStart;
  const activityEnd = window.activityEnd ?? ctx.config.anchorDate;
  if (!activityStart || activityEnd <= activityStart) {
    return 0;
  }

  const tenureDays = Math.max(
    1,
    (activityEnd.getTime() - activityStart.getTime()) / (24 * 60 * 60 * 1_000),
  );
  const tenureScale = Math.min(1, Math.max(0.35, tenureDays / 120));
  const densityScale = DENSITY_MULTIPLIERS[density];
  const stableJitter =
    stableFraction(`${ctx.config.seed}:${memberKey}:booking-behavior`) * 0.16 -
    0.08;
  const count = Math.floor(
    base * tenureScale * densityScale * (1 + stableJitter),
  );

  return Math.max(1, Math.min(HARD_CAPS.bookings, count));
}

export type MemberAccessWindow = {
  startsAt: Date | null;
  expiresAt: Date | null;
  activityStart: Date | null;
  activityEnd: Date | null;
  hasAccess: boolean;
  historicalOnly: boolean;
};

export function memberAccessWindow(
  ctx: Pick<DynamicSeedContext, 'config' | 'state'>,
  memberKey: string,
): MemberAccessWindow {
  const account = ctx.state.accounts.find(
    (candidate) => candidate.key === memberKey,
  );
  if (account?.lifecycle) {
    const lifecycle = account.lifecycle;
    return {
      startsAt: lifecycle.accessStart,
      expiresAt: lifecycle.accessEnd,
      activityStart: lifecycle.activityStart,
      activityEnd: lifecycle.activityEnd,
      hasAccess:
        account.hasCurrentAccess === true &&
        account.status !== 'suspended' &&
        account.memberPersona !== 'pending' &&
        account.memberPersona !== 'unverified' &&
        lifecycle.accessStart !== null,
      historicalOnly: lifecycle.historicalOnly,
    };
  }
  const cohort = cohortForMember(ctx, memberKey);
  const offset = stableOffset(ctx.config, memberKey, 28);
  const lifecycle = account?.membershipLifecycle;
  const currentAccess = account?.hasCurrentAccess;
  const historical =
    lifecycle === 'expired' ||
    lifecycle === 'cancelled_former' ||
    (lifecycle === 'frozen' && account?.hasCompletedHistory === true) ||
    (cohort === 'historical_only' && account?.hasCompletedHistory !== false);
  const restricted =
    cohort === 'pending_unverified_suspended' ||
    (account !== undefined &&
      currentAccess === false &&
      !historical &&
      account.hasCompletedHistory !== true);

  if (restricted) {
    return {
      startsAt: null,
      expiresAt: null,
      activityStart: null,
      activityEnd: null,
      hasAccess: false,
      historicalOnly: false,
    };
  }

  if (historical) {
    const startsAt = daysFrom(ctx.config.anchorDate, -260 - offset, 9);
    const archiveCutoff =
      memberKey === 'member-archived'
        ? daysFrom(ctx.config.anchorDate, -46, 23, 59)
        : daysFrom(ctx.config.anchorDate, -8 - (offset % 20), 23, 59);
    return {
      startsAt,
      expiresAt: archiveCutoff,
      activityStart: startsAt,
      activityEnd: archiveCutoff,
      hasAccess: false,
      historicalOnly: true,
    };
  }

  const trial = lifecycle === 'trial_or_new' || cohort === 'light_trial';
  const startsAt = daysFrom(
    ctx.config.anchorDate,
    trial ? -35 - (offset % 12) : -190 - (offset % 38),
    9,
  );
  const expiresAt = daysFrom(
    ctx.config.anchorDate,
    trial ? 18 + (offset % 16) : 34 + (offset % 48),
    23,
    59,
  );
  return {
    startsAt,
    expiresAt,
    activityStart: startsAt,
    activityEnd: daysFrom(ctx.config.anchorDate, -1, 20),
    hasAccess: currentAccess !== false,
    historicalOnly: false,
  };
}

export function activityDateFor(
  ctx: Pick<DynamicSeedContext, 'config' | 'state'>,
  memberKey: string,
  index: number,
  total: number,
  hour = 9,
  minute = 0,
) {
  const window = memberAccessWindow(ctx, memberKey);
  if (!window.activityStart || !window.activityEnd || total <= 0) {
    return null;
  }
  const fraction = (index + 1) / (total + 1);
  const timestamp =
    window.activityStart.getTime() +
    (window.activityEnd.getTime() - window.activityStart.getTime()) * fraction;
  const target = new Date(timestamp);
  target.setUTCHours(hour, minute, 0, 0);
  return new Date(
    Math.min(
      window.activityEnd.getTime(),
      Math.max(window.activityStart.getTime(), target.getTime()),
    ),
  );
}

export function futureDateFor(
  ctx: Pick<DynamicSeedContext, 'config' | 'state'>,
  memberKey: string,
  index: number,
  hour = 9,
) {
  const window = memberAccessWindow(ctx, memberKey);
  if (!window.hasAccess || !window.expiresAt) {
    return null;
  }
  const start = daysFrom(ctx.config.anchorDate, 2 + index * 2, hour);
  if (start >= window.expiresAt) {
    return null;
  }
  return start;
}

export function endOfAccessWindow(
  ctx: Pick<DynamicSeedContext, 'config' | 'state'>,
  memberKey: string,
) {
  return memberAccessWindow(ctx, memberKey).expiresAt;
}

export type SeedInterval<T = unknown> = {
  key: string;
  start: Date;
  end: Date;
  value: T;
};

/**
 * Keyed interval allocation keeps each resource's accepted intervals sorted
 * and only compares the insertion neighbours. It is O(n log n) per key and
 * avoids the quadratic all-pairs overlap checks that made high-volume seeds
 * slow and nondeterministic.
 */
export class KeyedIntervalAllocator {
  private readonly intervals = new Map<
    string,
    Array<{ start: number; end: number }>
  >();

  tryAllocate(key: string, start: Date, end: Date) {
    return this.tryAllocateMany([key], start, end);
  }

  tryAllocateMany(keys: readonly string[], start: Date, end: Date) {
    const startMs = start.getTime();
    const endMs = end.getTime();
    if (
      !Number.isFinite(startMs) ||
      !Number.isFinite(endMs) ||
      endMs <= startMs
    ) {
      return false;
    }

    const uniqueKeys = [...new Set(keys)];
    if (uniqueKeys.length === 0) {
      return false;
    }

    const insertionIndexes = new Map<string, number>();
    for (const key of uniqueKeys) {
      const rows = this.intervals.get(key) ?? [];
      let low = 0;
      let high = rows.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        if (rows[middle].start < startMs) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }

      const previous = rows[low - 1];
      const next = rows[low];
      if (
        (previous && previous.end > startMs) ||
        (next && endMs > next.start)
      ) {
        return false;
      }
      insertionIndexes.set(key, low);
    }

    for (const key of uniqueKeys) {
      const rows = this.intervals.get(key) ?? [];
      rows.splice(insertionIndexes.get(key)!, 0, {
        start: startMs,
        end: endMs,
      });
      this.intervals.set(key, rows);
    }
    return true;
  }
}

export function dateForSeedIndex(
  config: Pick<DynamicSeedConfig, 'anchorDate'>,
  startOffset: number,
  index: number,
  hour = 9,
  minute = 0,
) {
  return daysFrom(config.anchorDate, startOffset + index, hour, minute);
}
