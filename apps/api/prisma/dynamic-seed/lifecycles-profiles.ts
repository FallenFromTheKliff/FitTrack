import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { daysFrom } from './time';
import type {
  DynamicSeedConfig,
  PhysicalTrend,
  SeedAccount,
  SeedLifecycle,
  SeedPhysicalBaseline,
} from './types';

const DAY_MS = 24 * 60 * 60 * 1_000;

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableInt(seed: number, key: string, min: number, max: number) {
  if (max <= min) {
    return min;
  }
  return min + (hashString(`${seed}:${key}`) % (max - min + 1));
}

function round(value: number, precision = 1) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function clampDate(value: Date, start: Date, end: Date) {
  const timestamp = clamp(value.getTime(), start.getTime(), end.getTime());
  return new Date(timestamp);
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function dateDaysAgo(
  config: DynamicSeedConfig,
  account: SeedAccount,
  minDays: number,
  maxDays: number,
  suffix: string,
) {
  const end = new Date(
    Math.min(config.anchorDate.getTime(), config.historyEndDate.getTime()),
  );
  const start = new Date(config.historyStartDate);
  const daysAgo = stableInt(
    config.seed,
    `${account.key}:${suffix}`,
    minDays,
    maxDays,
  );
  return clampDate(daysFrom(end, -daysAgo, 9), start, end);
}

function dateAfter(value: Date, days: number, end: Date) {
  return new Date(Math.min(addDays(value, days).getTime(), end.getTime()));
}

function currentWindowEnd(config: DynamicSeedConfig) {
  return new Date(
    Math.min(config.anchorDate.getTime(), config.historyEndDate.getTime()),
  );
}

function isHistoricalAccount(account: SeedAccount) {
  return (
    account.hasCompletedHistory === true &&
    (account.memberPersona === 'expired' ||
      account.memberPersona === 'frozen' ||
      account.memberPersona === 'archived' ||
      account.membershipLifecycle === 'expired' ||
      account.membershipLifecycle === 'frozen' ||
      account.membershipLifecycle === 'cancelled_former')
  );
}

function isCheckoutAbandoned(account: SeedAccount) {
  return (
    account.key === 'member-checkout-abandoned' ||
    account.fixedScenario === 'checkout_abandoned_member'
  );
}

function isUnverified(account: SeedAccount) {
  return (
    account.emailVerified === false || account.memberPersona === 'unverified'
  );
}

function isRestricted(account: SeedAccount) {
  return (
    isUnverified(account) ||
    account.memberPersona === 'pending' ||
    account.memberPersona === 'suspended' ||
    account.status === UserStatus.suspended ||
    isCheckoutAbandoned(account) ||
    account.hasCurrentAccess === false
  );
}

function engagementAgeRange(account: SeedAccount): [number, number] {
  switch (account.memberEngagement) {
    case 'gym_rat':
      return [245, 350];
    case 'frequent':
      return [120, 300];
    case 'regular':
      return [90, 260];
    case 'casual':
      return [20, 110];
    case 'lazy':
      return [150, 330];
    case 'zero_use':
      return [4, 35];
    default:
      return [120, 280];
  }
}

/**
 * Derive one account lifecycle from the canonical scenario and configured
 * history window. This is pure and stable for a given seed, account key, and
 * config window, so later domains can share the same dates.
 */
export function deriveSeedLifecycle(
  account: SeedAccount,
  config: DynamicSeedConfig,
): SeedLifecycle {
  const start = new Date(config.historyStartDate);
  const end = currentWindowEnd(config);
  const historical = isHistoricalAccount(account);
  const archived = account.memberPersona === 'archived';
  const checkoutAbandoned = isCheckoutAbandoned(account);
  const unverified = isUnverified(account);
  const restricted = isRestricted(account);
  const trial =
    account.memberPersona === 'trial' ||
    account.membershipLifecycle === 'trial_or_new';
  const currentAccess =
    account.hasCurrentAccess === true &&
    !historical &&
    !restricted &&
    !archived;

  let registeredAt: Date;
  if (historical || archived) {
    registeredAt = dateDaysAgo(config, account, 245, 350, 'registered:history');
  } else if (checkoutAbandoned) {
    registeredAt = dateDaysAgo(config, account, 4, 18, 'registered:checkout');
  } else if (unverified) {
    registeredAt = dateDaysAgo(config, account, 1, 18, 'registered:unverified');
  } else if (account.memberPersona === 'suspended') {
    registeredAt = dateDaysAgo(
      config,
      account,
      120,
      260,
      'registered:suspended',
    );
  } else if (trial) {
    registeredAt = dateDaysAgo(config, account, 7, 50, 'registered:trial');
  } else if (account.role === UserRole.member) {
    const [minDays, maxDays] = engagementAgeRange(account);
    registeredAt = dateDaysAgo(
      config,
      account,
      minDays,
      maxDays,
      'registered:member',
    );
  } else {
    registeredAt = dateDaysAgo(config, account, 120, 300, 'registered:staff');
  }
  registeredAt = clampDate(registeredAt, start, end);

  const verifiedAt = unverified
    ? null
    : dateAfter(
        registeredAt,
        stableInt(config.seed, `${account.key}:verified`, 1, 5),
        end,
      );

  let accessStart: Date | null = null;
  let accessEnd: Date | null = null;
  let activityStart: Date | null = null;
  let activityEnd: Date | null = null;
  const verificationDays = verifiedAt
    ? Math.max(
        0,
        Math.ceil((verifiedAt.getTime() - registeredAt.getTime()) / DAY_MS),
      )
    : 0;

  if (historical || archived) {
    accessStart = dateAfter(
      registeredAt,
      Math.max(
        verificationDays + 1,
        stableInt(config.seed, `${account.key}:access-start`, 7, 21),
      ),
      end,
    );
    const preferredEnd = archived
      ? (account.deletedAt ?? daysFrom(end, -45, 18, 0))
      : daysFrom(
          end,
          -stableInt(config.seed, `${account.key}:access-end`, 18, 90),
          18,
          0,
        );
    accessEnd = clampDate(preferredEnd, accessStart, end);
    activityStart = new Date(accessStart.getTime());
    activityEnd = new Date(accessEnd.getTime());
  } else if (currentAccess) {
    accessStart = dateAfter(
      registeredAt,
      Math.max(
        verificationDays + 1,
        stableInt(config.seed, `${account.key}:access-start`, 3, 14),
      ),
      end,
    );
    accessEnd = addDays(
      end,
      trial
        ? stableInt(config.seed, `${account.key}:access-end`, 14, 30)
        : stableInt(config.seed, `${account.key}:access-end`, 30, 60),
    );
    activityStart = new Date(accessStart.getTime());
    activityEnd = new Date(
      Math.min(addDays(end, -1).getTime(), accessEnd.getTime()),
    );
  }

  let deletedAt: Date | null = null;
  if (archived) {
    const candidate = account.deletedAt
      ? new Date(account.deletedAt)
      : daysFrom(end, -45, 9);
    deletedAt = clampDate(candidate, start, end);
    if (deletedAt.getTime() <= registeredAt.getTime()) {
      deletedAt = clampDate(daysFrom(end, -1, 9), start, end);
    }
    if (activityEnd && activityEnd.getTime() >= deletedAt.getTime()) {
      activityEnd = new Date(deletedAt.getTime() - 60 * 60 * 1_000);
      accessEnd = activityEnd;
    }
  }

  const deletionRequestedAt =
    archived || account.memberPersona === 'expired'
      ? clampDate(
          daysFrom(
            deletedAt ?? end,
            -stableInt(config.seed, `${account.key}:deletion-request`, 4, 16),
            10,
          ),
          registeredAt,
          deletedAt ?? end,
        )
      : null;
  const deletionReviewedAt =
    archived && deletionRequestedAt
      ? clampDate(
          daysFrom(deletedAt ?? end, -2, 11),
          deletionRequestedAt,
          deletedAt ?? end,
        )
      : null;

  return {
    registeredAt,
    verifiedAt,
    accessStart,
    accessEnd,
    activityStart,
    activityEnd,
    deletedAt,
    deletionRequestedAt,
    deletionReviewedAt,
    historicalOnly: historical || archived,
  };
}

function ageFromDate(anchor: Date, dateOfBirth: Date) {
  let age = anchor.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayNotReached =
    anchor.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (anchor.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      anchor.getUTCDate() < dateOfBirth.getUTCDate());
  if (birthdayNotReached) {
    age -= 1;
  }
  return age;
}

function deriveGender(account: SeedAccount, seed: number) {
  if (account.gender !== undefined) {
    return account.gender;
  }
  const value = stableInt(seed, `${account.key}:gender`, 0, 9);
  return value < 4 ? Gender.female : value < 8 ? Gender.male : Gender.other;
}

function deriveActivityLevel(account: SeedAccount): ActivityLevel {
  if (account.activityLevel !== undefined) {
    return account.activityLevel ?? ActivityLevel.moderate;
  }
  if (account.role === UserRole.coach) {
    return account.coachLifecycle === 'former'
      ? ActivityLevel.moderate
      : account.coachLifecycle === 'paused'
        ? ActivityLevel.active
        : ActivityLevel.very_active;
  }
  if (account.role !== UserRole.member) {
    return ActivityLevel.moderate;
  }
  switch (account.memberEngagement) {
    case 'gym_rat':
      return ActivityLevel.very_active;
    case 'frequent':
      return ActivityLevel.active;
    case 'regular':
      return ActivityLevel.moderate;
    case 'casual':
    case 'lazy':
    case 'zero_use':
      return ActivityLevel.light;
    default:
      return ActivityLevel.moderate;
  }
}

function deriveFitnessGoal(account: SeedAccount, seed: number) {
  if (account.fitnessGoal !== undefined) {
    return account.fitnessGoal;
  }
  if (account.role === UserRole.coach) {
    return FitnessGoal.sport_specific;
  }
  if (account.role !== UserRole.member) {
    return FitnessGoal.maintenance;
  }
  const value = stableInt(seed, `${account.key}:goal`, 0, 2);
  return value === 0
    ? FitnessGoal.cutting
    : value === 1
      ? FitnessGoal.bulking
      : FitnessGoal.maintenance;
}

function deriveDateOfBirth(
  account: SeedAccount,
  config: DynamicSeedConfig,
  seed: number,
) {
  if (account.dateOfBirth !== undefined) {
    return account.dateOfBirth;
  }
  const age = stableInt(
    seed,
    `${account.key}:age`,
    account.role === UserRole.member ? 21 : 25,
    account.role === UserRole.member ? 55 : 58,
  );
  const birth = new Date(config.anchorDate);
  birth.setUTCFullYear(birth.getUTCFullYear() - age);
  birth.setUTCMonth(
    stableInt(seed, `${account.key}:birth-month`, 0, 11),
    stableInt(seed, `${account.key}:birth-day`, 1, 26),
  );
  birth.setUTCHours(0, 0, 0, 0);
  return birth;
}

function trendForGoal(goal: FitnessGoal | null | undefined): PhysicalTrend {
  if (goal === FitnessGoal.cutting) {
    return 'cutting';
  }
  if (goal === FitnessGoal.bulking) {
    return 'bulking';
  }
  return 'maintenance';
}

/** Derive one correlated, conservative adult physical baseline. */
export function deriveSeedPhysicalBaseline(
  account: SeedAccount,
  config: DynamicSeedConfig,
): SeedPhysicalBaseline {
  const seed = config.seed;
  const heightCm =
    account.heightCm !== undefined
      ? round(clamp(account.heightCm ?? 170, 150, 190), 1)
      : stableInt(seed, `${account.key}:height`, 156, 188);
  const gender = deriveGender(account, seed);
  const activityLevel = deriveActivityLevel(account);
  const activityOffset =
    activityLevel === ActivityLevel.very_active
      ? 0.8
      : activityLevel === ActivityLevel.active
        ? 0.4
        : activityLevel === ActivityLevel.light
          ? -0.1
          : 0;
  const bmi = round(
    clamp(
      20.2 + stableInt(seed, `${account.key}:bmi`, 0, 69) / 10 + activityOffset,
      18.5,
      29.8,
    ),
    1,
  );
  const weightKg = round((bmi * heightCm * heightCm) / 10_000, 1);
  const goal = deriveFitnessGoal(account, seed);
  const trend = trendForGoal(goal);
  const delta = round(
    1.2 + stableInt(seed, `${account.key}:trend`, 0, 22) / 10,
    1,
  );
  const baselineWeightKg = round(
    clamp(
      trend === 'cutting'
        ? weightKg + delta
        : trend === 'bulking'
          ? weightKg - delta
          : weightKg +
            stableInt(seed, `${account.key}:maintenance`, -8, 8) / 10,
      45,
      140,
    ),
    1,
  );
  const bodyFatPct = round(
    clamp(
      13.5 +
        (bmi - 21) * 0.9 +
        (ageFromDate(
          config.anchorDate,
          deriveDateOfBirth(account, config, seed) ?? config.anchorDate,
        ) -
          30) *
          0.08 -
        activityOffset * 1.4,
      10,
      31,
    ),
    1,
  );
  const muscleMassKg = round(
    clamp(
      weightKg *
        (0.42 +
          (activityLevel === ActivityLevel.very_active
            ? 0.06
            : activityLevel === ActivityLevel.active
              ? 0.04
              : 0.02)),
      24,
      78,
    ),
    1,
  );
  const waistCm = round(clamp(heightCm * 0.39 + (bmi - 20) * 1.7, 65, 108), 1);
  const chestCm = round(clamp(heightCm * 0.47 + (bmi - 22) * 0.8, 78, 116), 1);
  void gender;
  return {
    heightCm,
    weightKg,
    bmi,
    baselineWeightKg,
    bodyFatPct,
    muscleMassKg,
    waistCm,
    chestCm,
    trend,
  };
}

export type SeedPhysicalSnapshot = Omit<
  SeedPhysicalBaseline,
  'baselineWeightKg' | 'trend'
>;

/** Keep progress rows on the same height/composition curve as the profile. */
export function physicalSnapshotAtWeight(
  baseline: SeedPhysicalBaseline,
  weightKg: number,
): SeedPhysicalSnapshot {
  const weight = round(clamp(weightKg, 40, 150), 1);
  const bmi = round(
    (weight * 10_000) / (baseline.heightCm * baseline.heightCm),
    1,
  );
  const weightDelta = weight - baseline.weightKg;
  return {
    heightCm: baseline.heightCm,
    weightKg: weight,
    bmi,
    bodyFatPct: round(
      clamp(baseline.bodyFatPct + weightDelta * 0.35, 8, 35),
      1,
    ),
    muscleMassKg: round(
      clamp(baseline.muscleMassKg + weightDelta * 0.25, 20, 85),
      1,
    ),
    waistCm: round(clamp(baseline.waistCm + weightDelta * 0.45, 60, 120), 1),
    chestCm: round(clamp(baseline.chestCm + weightDelta * 0.2, 75, 125), 1),
  };
}

export function deriveSeedAccountContext(
  account: SeedAccount,
  config: DynamicSeedConfig,
): SeedAccount {
  const next = { ...account };
  // Pinned QA identities remain byte-for-byte stable across seed changes;
  // generated accounts are still seed-sensitive.
  const derivationConfig = account.pinned
    ? { ...config, seed: 0x5eed2026 }
    : config;
  const goal = deriveFitnessGoal(account, derivationConfig.seed);
  const baseline = deriveSeedPhysicalBaseline(
    { ...account, fitnessGoal: goal },
    derivationConfig,
  );
  next.gender = deriveGender(account, derivationConfig.seed);
  next.activityLevel = deriveActivityLevel(account);
  next.fitnessGoal = goal;
  next.dateOfBirth = deriveDateOfBirth(
    account,
    derivationConfig,
    derivationConfig.seed,
  );
  next.heightCm = baseline.heightCm;
  next.weightKg = baseline.weightKg;
  next.lifecycle = deriveSeedLifecycle(next, derivationConfig);
  next.physicalBaseline = baseline;
  return next;
}

export function deriveSeedAccountContexts(
  accounts: readonly SeedAccount[],
  config: DynamicSeedConfig,
) {
  return accounts.map((account) => deriveSeedAccountContext(account, config));
}

export function shouldSeedMemberQr(
  account: SeedAccount,
  status: UserStatus,
  verifiedAt: Date | null,
  deletedAt: Date | null,
) {
  return (
    account.role === UserRole.member &&
    status === UserStatus.active &&
    verifiedAt !== null &&
    deletedAt === null &&
    account.emailVerified !== false &&
    !['pending', 'unverified', 'suspended', 'archived'].includes(
      account.memberPersona ?? '',
    )
  );
}

export function shouldSeedRefreshToken(account: SeedAccount) {
  return (
    account.lifecycle?.historicalOnly === false &&
    account.status === UserStatus.active &&
    account.emailVerified !== false &&
    !['archived', 'suspended', 'pending', 'unverified'].includes(
      account.memberPersona ?? '',
    )
  );
}

export function validateSeedAccountContext(account: SeedAccount) {
  const issues: string[] = [];
  const lifecycle = account.lifecycle;
  const baseline = account.physicalBaseline;
  if (!lifecycle) {
    issues.push('missing lifecycle context');
  } else {
    const ordered = [
      lifecycle.registeredAt,
      lifecycle.verifiedAt,
      lifecycle.accessStart,
      lifecycle.activityStart,
      lifecycle.activityEnd,
      lifecycle.accessEnd,
      lifecycle.deletedAt,
    ].filter((value): value is Date => value !== null);
    if (
      ordered.some((value, index) => index > 0 && value < ordered[index - 1])
    ) {
      issues.push('lifecycle dates are not ordered');
    }
    if (account.memberPersona === 'archived' && lifecycle.deletedAt === null) {
      issues.push('archived account is missing deletion date');
    }
    if (
      lifecycle.deletionRequestedAt !== null &&
      lifecycle.deletionRequestedAt < lifecycle.registeredAt
    ) {
      issues.push('deletion request predates registration');
    }
    if (
      lifecycle.deletionReviewedAt !== null &&
      (lifecycle.deletionRequestedAt === null ||
        lifecycle.deletionReviewedAt < lifecycle.deletionRequestedAt ||
        (lifecycle.deletedAt !== null &&
          lifecycle.deletionReviewedAt > lifecycle.deletedAt))
    ) {
      issues.push('deletion review is outside request/deletion order');
    }
    if (
      (account.memberPersona === 'unverified' ||
        account.status === UserStatus.pending) &&
      lifecycle.activityStart !== null
    ) {
      issues.push('unverified/pending account has activity window');
    }
    if (
      (account.memberPersona === 'suspended' ||
        account.status === UserStatus.suspended) &&
      (account.hasCurrentAccess === true || lifecycle.activityEnd !== null)
    ) {
      issues.push('suspended account has current activity');
    }
  }
  if (!baseline) {
    issues.push('missing physical baseline');
  } else {
    const bmi =
      (baseline.weightKg * 10_000) / (baseline.heightCm * baseline.heightCm);
    if (baseline.heightCm < 150 || baseline.heightCm > 190) {
      issues.push('height outside conservative adult range');
    }
    if (bmi < 18.5 || bmi > 30) {
      issues.push('bmi outside conservative adult range');
    }
    if (Math.abs(bmi - baseline.bmi) > 0.2) {
      issues.push('baseline bmi disagrees with height and weight');
    }
  }
  return issues;
}
