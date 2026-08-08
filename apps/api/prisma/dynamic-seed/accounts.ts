import {
  ActivityLevel,
  FitnessGoal,
  Gender,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { seedId } from './ids';
import { SeedRandom, slugify } from './random';
import { yearsAgo } from './time';
import type {
  DynamicSeedConfig,
  MemberPersona,
  SeedAccount,
  SeedCredential,
  SeedState,
} from './types';

export const DYNAMIC_SEED_PASSWORD = 'SeedMember!2026';

const DEFAULT_PASSWORDS = {
  admin: DYNAMIC_SEED_PASSWORD,
  coach: DYNAMIC_SEED_PASSWORD,
  member: DYNAMIC_SEED_PASSWORD,
  staff: DYNAMIC_SEED_PASSWORD,
} as const;

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
    role: UserRole.coach,
  },
  {
    email: 'seed.member.active@fittrack.com',
    firstName: 'Ava',
    isDemo: true,
    key: 'member-active',
    label: 'Member Active',
    lastName: 'Rivera',
    memberPersona: 'active',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000005',
    role: UserRole.member,
  },
  {
    email: 'seed.member.premium@fittrack.com',
    firstName: 'Luca',
    isDemo: true,
    key: 'member-premium',
    label: 'Member Premium',
    lastName: 'Dela Cruz',
    memberPersona: 'premium',
    password: DEFAULT_PASSWORDS.member,
    phone: '+639110000006',
    role: UserRole.member,
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

function roleTargets(totalUsers: number) {
  const admin = Math.max(3, Math.round(totalUsers * 0.03));
  const staff = Math.max(8, Math.round(totalUsers * 0.08));
  const coach = Math.max(16, Math.round(totalUsers * 0.16));
  const member = Math.max(0, totalUsers - admin - staff - coach);
  return { admin, coach, member, staff };
}

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
  const targets = roleTargets(config.users);
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
      dateOfBirth: yearsAgo(config.anchorDate, 34 + index),
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
      activityLevel: ActivityLevel.moderate,
      dateOfBirth: yearsAgo(config.anchorDate, 23 + (index % 12)),
      gender: index % 2 === 0 ? Gender.female : Gender.male,
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
      activityLevel:
        index % 3 === 0 ? ActivityLevel.very_active : ActivityLevel.active,
      dateOfBirth: yearsAgo(config.anchorDate, 27 + (index % 14)),
      fitnessGoal: FitnessGoal.sport_specific,
      gender: index % 2 === 0 ? Gender.male : Gender.female,
      heightCm: 163 + (index % 22),
      isDemo: false,
      key: `coach-team-${index + 1}`,
      label: `Coach Team ${index + 1}`,
      password: DEFAULT_PASSWORDS.coach,
      role: UserRole.coach,
      weightKg: 61 + (index % 24),
    }),
  );

  const memberPersonas: MemberPersona[] = [
    'premium',
    'active',
    'active',
    'active',
    'trial',
    'pending',
    'expired',
    'frozen',
  ];

  addRoleAccounts(
    UserRole.member,
    Math.max(0, targets.member - demoByRole.member),
    (identity, index) => {
      const persona = memberPersonas[index % memberPersonas.length];
      return {
        ...identity,
        activityLevel:
          persona === 'premium' || persona === 'active'
            ? ActivityLevel.active
            : ActivityLevel.light,
        dateOfBirth: yearsAgo(config.anchorDate, 20 + (index % 26)),
        fitnessGoal:
          index % 3 === 0
            ? FitnessGoal.bulking
            : index % 3 === 1
              ? FitnessGoal.cutting
              : FitnessGoal.maintenance,
        gender: index % 2 === 0 ? Gender.female : Gender.male,
        heightCm: 150 + (index % 36),
        isDemo: false,
        key: `member-community-${String(index + 1).padStart(3, '0')}`,
        label: `Community Member ${index + 1}`,
        memberPersona: persona,
        password: DEFAULT_PASSWORDS.member,
        role: UserRole.member,
        status:
          persona === 'pending' || persona === 'unverified'
            ? UserStatus.pending
            : UserStatus.active,
        weightKg: 51 + (index % 38),
      };
    },
  );

  return accounts;
}

export function buildSeedAccounts(config: DynamicSeedConfig) {
  return [...DEMO_ACCOUNTS, ...buildGeneratedAccounts(config)].slice(
    0,
    config.users,
  );
}

export function populateAccountState(
  state: SeedState,
  accounts: SeedAccount[],
) {
  state.accounts = accounts;
  state.demoCredentials = accounts
    .filter((account) => account.isDemo)
    .map(toSeedCredential);
  state.userIds = Object.fromEntries(
    accounts.map((account) => [account.key, userIdFor(account.key)]),
  );
  state.adminKeys = accounts
    .filter((account) => account.role === UserRole.admin)
    .map((account) => account.key);
  state.staffKeys = accounts
    .filter((account) => account.role === UserRole.staff)
    .map((account) => account.key);
  state.coachAccountKeys = accounts
    .filter((account) => account.role === UserRole.coach)
    .map((account) => account.key);
  state.memberKeys = accounts
    .filter((account) => account.role === UserRole.member)
    .map((account) => account.key);
  state.activeMemberKeys = accounts
    .filter(
      (account) =>
        account.role === UserRole.member &&
        !['archived', 'suspended', 'unverified'].includes(
          account.memberPersona ?? 'active',
        ),
    )
    .map((account) => account.key);
  state.premiumMemberKeys = accounts
    .filter(
      (account) =>
        account.role === UserRole.member &&
        (account.memberPersona === 'premium' ||
          account.memberPersona === 'active' ||
          account.memberPersona === 'trial'),
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
