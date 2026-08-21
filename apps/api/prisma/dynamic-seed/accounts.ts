import { FitnessGoal, UserRole, UserStatus } from '@prisma/client';
import { seedId } from './ids';
import { SeedRandom, slugify } from './random';
import {
  assignScenarioDimensions,
  normalizeSeedAccountScenario,
  scenarioDimensionCounts,
} from './scenarios';
import { deriveSeedAccountContexts } from './lifecycles-profiles';
import { buildMemberCohortMap } from './volumes';
import type {
  DynamicSeedConfig,
  SeedAccount,
  SeedCredential,
  SeedState,
} from './types';

export type SeedRoleTargets = {
  admin: number;
  coach: number;
  member: number;
  staff: number;
};

export const DYNAMIC_SEED_PASSWORD = 'SeedMember!2026';

export const DYNAMIC_SEED_PASSWORDS = {
  admin: 'SeedAdmin!2026',
  coach: 'SeedCoach!2026',
  member: DYNAMIC_SEED_PASSWORD,
  staff: 'SeedStaff!2026',
} as const;

const DEFAULT_PASSWORDS = DYNAMIC_SEED_PASSWORDS;

export const DEMO_ACCOUNTS: readonly SeedAccount[] = [
  {
    email: 'seed.admin@fittrack.com',
    firstName: 'Sera',
    isDemo: true,
    key: 'admin',
    label: 'Seed Admin',
    lastName: 'Admin',
    password: DEFAULT_PASSWORDS.admin,
    phone: '+639110000001',
    fixedScenario: 'seed_admin',
    pinned: true,
    role: UserRole.admin,
  },
  {
    email: 'seed.staff@fittrack.com',
    firstName: 'Casey',
    isDemo: true,
    key: 'staff',
    label: 'Seed Staff',
    lastName: 'Floor',
    password: DEFAULT_PASSWORDS.staff,
    phone: '+639110000002',
    fixedScenario: 'seed_staff',
    pinned: true,
    role: UserRole.staff,
  },
  {
    email: 'seed.coach@fittrack.com',
    firstName: 'Ridge',
    fitnessGoal: FitnessGoal.sport_specific,
    isDemo: true,
    key: 'coach',
    label: 'Seed Coach',
    lastName: 'Coach',
    password: DEFAULT_PASSWORDS.coach,
    phone: '+639110000003',
    coachLifecycle: 'active',
    coachQuality: 'excellent',
    coachWorkload: 'high',
    canAcceptFutureBookings: true,
    futureBookingAcceptance: true,
    fixedScenario: 'seed_coach',
    pinned: true,
    role: UserRole.coach,
  },
  {
    email: 'seed.member.active@fittrack.com',
    emailVerified: true,
    firstName: 'Ava',
    isDemo: true,
    key: 'member-active',
    label: 'Member Active',
    lastName: 'Rivera',
    memberPersona: 'active',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000005',
    memberEngagement: 'frequent',
    membershipLifecycle: 'active',
    bookingProfile: 'regular',
    coachingProfile: 'one_time',
    paymentProfile: 'reliable',
    hasCompletedHistory: true,
    hasCurrentAccess: true,
    currentAccess: true,
    hasFutureBookings: true,
    fixedScenario: 'active_member',
    pinned: true,
    role: UserRole.member,
    status: UserStatus.active,
  },
  {
    email: 'seed.member.premium@fittrack.com',
    emailVerified: true,
    firstName: 'Luca',
    isDemo: true,
    key: 'member-premium',
    label: 'Member Premium',
    lastName: 'Dela Cruz',
    memberPersona: 'premium',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000006',
    memberEngagement: 'gym_rat',
    membershipLifecycle: 'active',
    bookingProfile: 'heavy',
    coachingProfile: 'recurring_active',
    paymentProfile: 'reliable',
    hasCompletedHistory: true,
    hasCurrentAccess: true,
    currentAccess: true,
    hasFutureBookings: true,
    fixedScenario: 'premium_member',
    pinned: true,
    role: UserRole.member,
    status: UserStatus.active,
  },
  {
    email: 'seed.member.checkout.abandoned@fittrack.com',
    emailVerified: true,
    firstName: 'Nia',
    isDemo: true,
    key: 'member-checkout-abandoned',
    label: 'Member Checkout Abandoned',
    lastName: 'Santos',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000017',
    memberEngagement: 'zero_use',
    membershipLifecycle: 'none_or_pending',
    bookingProfile: 'none',
    coachingProfile: 'checkout_failed',
    paymentProfile: 'abandoned_or_failed',
    hasCompletedHistory: false,
    hasCurrentAccess: false,
    currentAccess: false,
    hasFutureBookings: false,
    fixedScenario: 'checkout_abandoned_member',
    pinned: true,
    role: UserRole.member,
    status: UserStatus.active,
  },
  {
    email: 'seed.member.frozen@fittrack.com',
    firstName: 'Rina',
    isDemo: true,
    key: 'member-frozen',
    label: 'Member Frozen',
    lastName: 'Torres',
    memberPersona: 'frozen',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000007',
    memberEngagement: 'regular',
    membershipLifecycle: 'frozen',
    bookingProfile: 'occasional',
    coachingProfile: 'recurring_former',
    paymentProfile: 'failed_then_successful',
    hasCompletedHistory: true,
    hasCurrentAccess: false,
    currentAccess: false,
    hasFutureBookings: false,
    fixedScenario: 'frozen_member',
    pinned: true,
    role: UserRole.member,
  },
  {
    email: 'seed.member.pending@fittrack.com',
    firstName: 'Jules',
    isDemo: true,
    key: 'member-pending',
    label: 'Member Pending Payment',
    lastName: 'Garcia',
    memberPersona: 'pending',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000008',
    memberEngagement: 'zero_use',
    membershipLifecycle: 'none_or_pending',
    bookingProfile: 'none',
    coachingProfile: 'none',
    paymentProfile: 'abandoned_or_failed',
    hasCompletedHistory: false,
    hasCurrentAccess: false,
    currentAccess: false,
    hasFutureBookings: false,
    fixedScenario: 'pending_member',
    pinned: true,
    role: UserRole.member,
  },
  {
    email: 'seed.member.expired@fittrack.com',
    firstName: 'Ivy',
    isDemo: true,
    key: 'member-expired',
    label: 'Member Expired',
    lastName: 'Navarro',
    memberPersona: 'expired',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000009',
    memberEngagement: 'regular',
    membershipLifecycle: 'expired',
    bookingProfile: 'occasional',
    coachingProfile: 'recurring_former',
    paymentProfile: 'reliable',
    hasCompletedHistory: true,
    hasCurrentAccess: false,
    currentAccess: false,
    hasFutureBookings: false,
    fixedScenario: 'expired_member',
    pinned: true,
    role: UserRole.member,
  },
  {
    email: 'seed.member.unverified@fittrack.com',
    emailVerified: false,
    firstName: 'Mika',
    isDemo: true,
    key: 'member-unverified',
    label: 'Member Unverified',
    lastName: 'Unverified',
    memberPersona: 'unverified',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000011',
    memberEngagement: 'zero_use',
    membershipLifecycle: 'none_or_pending',
    bookingProfile: 'none',
    coachingProfile: 'none',
    paymentProfile: 'abandoned_or_failed',
    hasCompletedHistory: false,
    hasCurrentAccess: false,
    currentAccess: false,
    hasFutureBookings: false,
    fixedScenario: 'unverified_member',
    pinned: true,
    role: UserRole.member,
    status: UserStatus.pending,
  },
  {
    deletedAt: new Date('2026-05-01T09:00:00.000Z'),
    email: 'seed.member.archived@fittrack.com',
    firstName: 'Tala',
    isDemo: true,
    key: 'member-archived',
    label: 'Member Archived',
    lastName: 'Archived',
    memberPersona: 'archived',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000012',
    memberEngagement: 'lazy',
    membershipLifecycle: 'cancelled_former',
    bookingProfile: 'none',
    coachingProfile: 'recurring_former',
    paymentProfile: 'reliable',
    hasCompletedHistory: true,
    hasCurrentAccess: false,
    currentAccess: false,
    hasFutureBookings: false,
    fixedScenario: 'archived_member',
    pinned: true,
    role: UserRole.member,
  },
  {
    email: 'seed.member.suspended@fittrack.com',
    firstName: 'Kian',
    isDemo: true,
    key: 'member-suspended',
    label: 'Member Suspended',
    lastName: 'Suspended',
    memberPersona: 'suspended',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000016',
    memberEngagement: 'zero_use',
    membershipLifecycle: 'frozen',
    bookingProfile: 'none',
    coachingProfile: 'checkout_failed',
    paymentProfile: 'failed_then_successful',
    hasCompletedHistory: false,
    hasCurrentAccess: false,
    currentAccess: false,
    hasFutureBookings: false,
    fixedScenario: 'suspended_member',
    pinned: true,
    role: UserRole.member,
    status: UserStatus.suspended,
  },
];

const FIRST_NAMES = [
  'Juan Carlos',
  'Maria Clara',
  'Jose Miguel',
  'Ana Patricia',
  'Mark Angelo',
  'Mary Grace',
  'Paolo',
  'Camille',
  'Rafael',
  'Angelica',
  'Miguel',
  'Katrina',
  'Christian',
  'Mikaela',
  'Joshua',
  'Andrea',
  'Gabriel',
  'Fatima',
  'Daniel',
  'Nicole',
  'Jerome',
  'Laarni',
  'Carlo',
  'Jessa',
  'Arnel',
  'Rica',
  'Jomar',
  'Trisha',
  'Renato',
  'Alyssa',
  'Patrick',
  'Mariel',
  'Enzo',
  'Bea',
  'Marco',
  'Bianca',
  'Louie',
  'Isabela',
  'Nathan',
  'Sofia',
  'Daryl',
  'Patricia',
] as const;

const LAST_NAMES = [
  'Dela Cruz',
  'Santos',
  'Reyes',
  'Garcia',
  'Mendoza',
  'Ramos',
  'Torres',
  'Flores',
  'Gonzales',
  'Bautista',
  'Villanueva',
  'Aquino',
  'Castillo',
  'Cruz',
  'Lim',
  'Tan',
  'Navarro',
  'Mercado',
  'Domingo',
  'Valdez',
  'Rivera',
  'Morales',
  'Salazar',
  'Aguilar',
  'Rosario',
  'Soriano',
  'Pascual',
  'Manalo',
  'Ocampo',
  'Abad',
  'Buenaventura',
  'Lorenzo',
] as const;

const ROLE_RATES: Record<keyof SeedRoleTargets, number> = {
  admin: 0.015,
  staff: 0.05,
  coach: 0.1,
  member: 0,
};

const FIXED_ROLE_COUNTS: SeedRoleTargets = {
  admin: DEMO_ACCOUNTS.filter((account) => account.role === UserRole.admin)
    .length,
  coach: DEMO_ACCOUNTS.filter((account) => account.role === UserRole.coach)
    .length,
  member: DEMO_ACCOUNTS.filter((account) => account.role === UserRole.member)
    .length,
  staff: DEMO_ACCOUNTS.filter((account) => account.role === UserRole.staff)
    .length,
};

/**
 * Calculate role targets for the full account total. Role floors preserve the
 * fixed QA population; the rest follows the documented 1.5%/5%/10% split.
 */
export function calculateRoleTargets(totalUsers: number): SeedRoleTargets {
  const total = Math.max(DEMO_ACCOUNTS.length, Math.floor(totalUsers));
  const targets: SeedRoleTargets = {
    admin: Math.max(
      FIXED_ROLE_COUNTS.admin,
      Math.round(total * ROLE_RATES.admin),
    ),
    coach: Math.max(
      FIXED_ROLE_COUNTS.coach,
      Math.round(total * ROLE_RATES.coach),
    ),
    member: FIXED_ROLE_COUNTS.member,
    staff: Math.max(
      FIXED_ROLE_COUNTS.staff,
      Math.round(total * ROLE_RATES.staff),
    ),
  };
  const nonMembers = targets.admin + targets.staff + targets.coach;
  if (nonMembers + FIXED_ROLE_COUNTS.member > total) {
    const reducible = (['coach', 'staff', 'admin'] as const).filter(
      (role) => targets[role] > FIXED_ROLE_COUNTS[role],
    );
    let overflow = nonMembers + FIXED_ROLE_COUNTS.member - total;
    for (const role of reducible) {
      const reduction = Math.min(
        overflow,
        targets[role] - FIXED_ROLE_COUNTS[role],
      );
      targets[role] -= reduction;
      overflow -= reduction;
      if (overflow === 0) break;
    }
  }
  targets.member = Math.max(
    FIXED_ROLE_COUNTS.member,
    total - targets.admin - targets.staff - targets.coach,
  );
  return targets;
}

// Keep the concise historical name available to nearby seed tooling.
export const roleTargets = calculateRoleTargets;

function uniqueIdentityFactory(rng: SeedRandom) {
  const usedEmails = new Set(DEMO_ACCOUNTS.map((account) => account.email));
  const usedNames = new Set(
    DEMO_ACCOUNTS.map((account) =>
      `${account.firstName}|${account.lastName}`.toLowerCase(),
    ),
  );
  let nameIndex = 0;
  let phoneIndex = 9000100;

  const namePool: Array<{ firstName: string; lastName: string }> = [];
  for (const firstName of FIRST_NAMES) {
    for (const lastName of LAST_NAMES) {
      const key = `${firstName}|${lastName}`.toLowerCase();
      if (!usedNames.has(key)) {
        namePool.push({ firstName, lastName });
      }
    }
  }

  // Shuffle the available identity pool with the seed. Fixed QA identities
  // are excluded above, so changing the seed only changes generated users.
  for (let index = namePool.length - 1; index > 0; index -= 1) {
    const swapIndex = rng.int(0, index);
    [namePool[index], namePool[swapIndex]] = [
      namePool[swapIndex],
      namePool[index],
    ];
  }

  return (role: UserRole) => {
    const identity = namePool[nameIndex];
    if (!identity) {
      throw new Error('Dynamic seed account pool exhausted.');
    }
    nameIndex += 1;

    let email = `${slugify(identity.firstName)}.${slugify(identity.lastName)}@fittrack.com`;
    if (usedEmails.has(email)) {
      email = `${slugify(identity.firstName)}.${slugify(identity.lastName)}.${role}.${rng.int(10, 99)}@fittrack.com`;
    }
    usedEmails.add(email);

    const phone = `+63918${String(phoneIndex).padStart(7, '0')}`;
    phoneIndex += 1;

    return { ...identity, email, phone };
  };
}

function buildGeneratedAccounts(config: DynamicSeedConfig) {
  const rng = new SeedRandom(config.seed + 17);
  const nextIdentity = uniqueIdentityFactory(rng);
  const targets = calculateRoleTargets(config.users);
  const demoByRole = {
    admin: DEMO_ACCOUNTS.filter((account) => account.role === UserRole.admin)
      .length,
    coach: DEMO_ACCOUNTS.filter((account) => account.role === UserRole.coach)
      .length,
    member: DEMO_ACCOUNTS.filter((account) => account.role === UserRole.member)
      .length,
    staff: DEMO_ACCOUNTS.filter((account) => account.role === UserRole.staff)
      .length,
  };
  const accounts: SeedAccount[] = [];

  const addRoleAccounts = (
    role: UserRole,
    count: number,
    build: (
      identity: ReturnType<ReturnType<typeof uniqueIdentityFactory>>,
      index: number,
    ) => SeedAccount,
  ) => {
    for (let index = 0; index < count; index += 1) {
      accounts.push(build(nextIdentity(role), index));
    }
  };

  addRoleAccounts(
    UserRole.admin,
    Math.max(0, targets.admin - demoByRole.admin),
    (identity, index) => ({
      ...identity,
      firstName: identity.firstName,
      isDemo: false,
      key: `admin-ops-${index + 1}`,
      label: `Admin Ops ${index + 1}`,
      lastName: identity.lastName,
      password: DEFAULT_PASSWORDS.admin,
      phone: identity.phone,
      role: UserRole.admin,
    }),
  );

  addRoleAccounts(
    UserRole.staff,
    Math.max(0, targets.staff - demoByRole.staff),
    (identity, index) => ({
      ...identity,
      isDemo: false,
      key: `staff-ops-${index + 1}`,
      label: `Staff Ops ${index + 1}`,
      password: DEFAULT_PASSWORDS.staff,
      role: UserRole.staff,
    }),
  );

  addRoleAccounts(
    UserRole.coach,
    Math.max(0, targets.coach - demoByRole.coach),
    (identity, index) => ({
      ...identity,
      isDemo: false,
      key: `coach-team-${index + 1}`,
      label: `Coach Team ${index + 1}`,
      password: DEFAULT_PASSWORDS.coach,
      role: UserRole.coach,
    }),
  );

  addRoleAccounts(
    UserRole.member,
    Math.max(0, targets.member - demoByRole.member),
    (identity, index) => {
      return {
        ...identity,
        isDemo: false,
        key: `member-community-${String(index + 1).padStart(3, '0')}`,
        label: `Community Member ${index + 1}`,
        password: DEFAULT_PASSWORDS.member,
        role: UserRole.member,
        status: UserStatus.active,
      };
    },
  );

  return accounts;
}

export function buildSeedAccounts(config: DynamicSeedConfig) {
  const targetUsers = Math.max(DEMO_ACCOUNTS.length, config.users);
  const generated = buildGeneratedAccounts({ ...config, users: targetUsers });
  // Fixed QA accounts are always retained; generated accounts fill the target.
  const accounts = [...DEMO_ACCOUNTS, ...generated];
  if (accounts.length !== targetUsers) {
    throw new Error(
      `Dynamic seed account target mismatch: generated ${accounts.length}, expected ${targetUsers}.`,
    );
  }
  return deriveSeedAccountContexts(
    assignScenarioDimensions(accounts, config.seed),
    config,
  );
}

export function populateAccountState(
  state: SeedState,
  accounts: SeedAccount[],
) {
  const normalizedAccounts = accounts.map((account) =>
    normalizeSeedAccountScenario(account, accounts),
  );
  state.accounts = normalizedAccounts;
  state.roleCounts = Object.fromEntries(
    Object.values(UserRole).map((role) => [
      role,
      normalizedAccounts.filter((account) => account.role === role).length,
    ]),
  );
  state.scenarioCounts = scenarioDimensionCounts(normalizedAccounts);
  state.memberCohorts = buildMemberCohortMap(
    normalizedAccounts
      .filter((account) => account.role === UserRole.member)
      .map((account) => account.key),
    normalizedAccounts,
  );
  state.demoCredentials = normalizedAccounts
    .filter((account) => account.isDemo)
    .map(toSeedCredential);
  state.userIds = Object.fromEntries(
    normalizedAccounts.map((account) => [account.key, userIdFor(account.key)]),
  );
  state.adminKeys = normalizedAccounts
    .filter((account) => account.role === UserRole.admin)
    .map((account) => account.key);
  state.staffKeys = normalizedAccounts
    .filter((account) => account.role === UserRole.staff)
    .map((account) => account.key);
  state.coachAccountKeys = normalizedAccounts
    .filter((account) => account.role === UserRole.coach)
    .map((account) => account.key);
  state.memberKeys = normalizedAccounts
    .filter((account) => account.role === UserRole.member)
    .map((account) => account.key);
  state.activeMemberKeys = normalizedAccounts
    .filter(
      (account) =>
        account.role === UserRole.member && account.hasCurrentAccess === true,
    )
    .map((account) => account.key);
  state.historicalMemberKeys = normalizedAccounts
    .filter(
      (account) =>
        account.role === UserRole.member &&
        account.hasCurrentAccess !== true &&
        account.hasCompletedHistory === true,
    )
    .map((account) => account.key);
  state.restrictedMemberKeys = normalizedAccounts
    .filter(
      (account) =>
        account.role === UserRole.member &&
        !state.activeMemberKeys.includes(account.key) &&
        !state.historicalMemberKeys.includes(account.key),
    )
    .map((account) => account.key);
  state.premiumMemberKeys = normalizedAccounts
    .filter(
      (account) =>
        account.role === UserRole.member &&
        (account.memberPersona === 'premium' ||
          account.coachingProfile === 'recurring_active'),
    )
    .map((account) => account.key);
}

export function userIdFor(accountKey: string) {
  return seedId(`user:${accountKey}`);
}

export function toSeedCredential(account: SeedAccount): SeedCredential {
  return {
    email: account.email,
    label: account.label,
    password: account.password,
    role: account.role,
  };
}
