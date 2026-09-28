import {
  AccountDeletionRequestStatus,
  ActivityLevel,
  AmenityType,
  AppointmentStatus,
  AuthProvider,
  BookingStatus,
  ChatContext,
  ChatRole,
  CoachScheduleType,
  EquipmentStatus,
  ExerciseCategory,
  FitnessGoal,
  Gender,
  GymChatRole,
  GymFaqCategory,
  InsightFocus,
  InsightPeriod,
  IntegrityCaseStatus,
  IntegrityRiskLevel,
  InteractionType,
  MasteryRank,
  MembershipCardSource,
  MembershipCardStatus,
  MilestoneCategory,
  MilestoneProgressStatus,
  MilestoneTriggerType,
  ModerationActionType,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
  NutritionUnit,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  PlanSource,
  PoseProfileKind,
  Prisma,
  PrismaClient,
  ProgressionGrantStatus,
  ProgressionGrantType,
  ProgressionSourceStatus,
  ProgressionSourceType,
  RankingGovernanceStatus,
  RankingVisibility,
  RecurringCoachingBillingCycleStatus,
  RecurringCoachingFrequency,
  RecurringCoachingPlanStatus,
  RecurringCoachingSessionState,
  RelationshipStatus,
  SalePaymentMethod,
  SaleSource,
  SaleStatus,
  SeasonStatus,
  SessionStatus,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { config } from 'dotenv';

import { localEnvFilePath } from '../env-path';
import { bootstrapDefaults } from './defaults';
import { TEST_DATA_EMAIL_DOMAIN, seedId } from './test-data/constants';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const LOCAL_RESET_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  '::1',
  'db',
  'fittrack-db',
  'fittrack-db-local',
]);
const LOCAL_RESET_DATABASES = new Set(['fittrack', 'fittrackdb']);

const PASSWORD_HASH_ROUNDS = 12;
const BULK_PASSWORDS = {
  admin: 'FitTrack@Leadership1',
  staff: 'FitTrack@StaffOps1',
  coach: 'FitTrack@CoachBench1',
  member: 'FitTrack@Community1',
} as const;

function id(key: string) {
  return seedId(`realistic:${key}`);
}

function money(value: number | string) {
  return new Prisma.Decimal(value);
}

function json(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function nowPlusDays(days: number, hour = 9, minute = 0) {
  const target = new Date();
  target.setDate(target.getDate() + days);
  target.setHours(hour, minute, 0, 0);
  return target;
}

function dateOnly(days: number) {
  const target = nowPlusDays(days, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target;
}

function fixedTime(value: string) {
  return new Date(`1970-01-01T${value}.000Z`);
}

function tokenHash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function yearsAgo(years: number) {
  return dateOnly(-(365 * years));
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function assertSafeResetDatabaseUrl() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required before resetting seed data.');
  }

  const url = new URL(connectionString);
  const host = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

  if (
    !LOCAL_RESET_HOSTS.has(host) ||
    !LOCAL_RESET_DATABASES.has(database.toLowerCase())
  ) {
    throw new Error(
      `[realistic-seed] Refusing to clean database "${database}" on host "${url.hostname}". Point DATABASE_URL at the local FitTrack database before running this seed.`,
    );
  }
}

function quotePgIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function resetDatabaseForCleanSlate() {
  assertSafeResetDatabaseUrl();

  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name <> '_prisma_migrations'
    ORDER BY table_name
  `;

  if (!tables.length) {
    return;
  }

  const tableList = tables
    .map(({ table_name }) => `"public".${quotePgIdentifier(table_name)}`)
    .join(', ');

  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
  );
}

type MemberTierSeed =
  | 'active_member'
  | 'verified_non_member'
  | 'pending_verification'
  | 'pending_membership'
  | 'revoked'
  | 'archived';

type RealisticAccount = {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  password: string;
  role: UserRole;
  status?: UserStatus;
  deletedAt?: Date | null;
  memberTier?: MemberTierSeed;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  weightKg?: number | null;
  heightCm?: number | null;
  activityLevel?: ActivityLevel | null;
  fitnessGoal?: FitnessGoal | null;
  hasAcceptedPrivacy?: boolean;
  coachSpecialization?: string | null;
  coachScheduleType?: CoachScheduleType;
  coachHourlyRate?: number | null;
  coachBio?: string | null;
  coachCertification?: string | null;
};

const FIRST_NAME_POOL = [
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
] as const;

const LAST_NAME_POOL = [
  'Dela Cruz',
  'Santos',
  'Reyes',
  'Garcia',
  'Mendoza',
  'Bautista',
  'Ramos',
  'Cruz',
  'Gonzales',
  'Torres',
  'Flores',
  'Villanueva',
  'Rivera',
  'Aquino',
  'Castillo',
  'Navarro',
  'Pascual',
  'Santiago',
  'Tolentino',
  'Mercado',
  'De Leon',
  'Salvador',
  'Manalo',
  'Dimaculangan',
  'Macalintal',
  'Del Rosario',
  'Lim',
  'Chua',
  'Uy',
  'Tan',
  'Abad',
  'Roxas',
] as const;

const CORE_ACCOUNTS: readonly RealisticAccount[] = [
  {
    key: 'admin',
    email: `admin@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Marisol',
    lastName: 'Aquino',
    phone: '+639170010001',
    password: 'FitTrack@Admin1',
    role: UserRole.admin,
    dateOfBirth: yearsAgo(38),
    gender: Gender.female,
    hasAcceptedPrivacy: true,
  },
  {
    key: 'staff',
    email: `staff@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Liza',
    lastName: 'Santos',
    phone: '+639170010002',
    password: 'FitTrack@Staff1',
    role: UserRole.staff,
    dateOfBirth: yearsAgo(31),
    gender: Gender.female,
    hasAcceptedPrivacy: true,
  },
  {
    key: 'coach',
    email: `coach@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Marco',
    lastName: 'Dela Cruz',
    phone: '+639170010003',
    password: 'FitTrack@Coach1',
    role: UserRole.coach,
    dateOfBirth: yearsAgo(34),
    gender: Gender.male,
    weightKg: 78,
    heightCm: 178,
    activityLevel: ActivityLevel.very_active,
    fitnessGoal: FitnessGoal.sport_specific,
    hasAcceptedPrivacy: true,
    coachSpecialization: 'Strength and Conditioning',
    coachScheduleType: CoachScheduleType.full_time,
    coachHourlyRate: 650,
    coachBio:
      'Head coach for strength and conditioning blocks, barbell technique, and athlete return-to-play progressions.',
    coachCertification: 'NSCA-CSCS',
  },
  {
    key: 'member-active',
    email: `member.active@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Carlo',
    lastName: 'Reyes',
    phone: '+639170010004',
    password: 'FitTrack@Member1',
    role: UserRole.member,
    memberTier: 'active_member',
    dateOfBirth: yearsAgo(27),
    gender: Gender.male,
    weightKg: 68,
    heightCm: 170,
    activityLevel: ActivityLevel.active,
    fitnessGoal: FitnessGoal.maintenance,
    hasAcceptedPrivacy: true,
  },
  {
    key: 'member-premium',
    email: `member.coaching@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Bianca',
    lastName: 'Villanueva',
    phone: '+639170010005',
    password: 'FitTrack@Member5',
    role: UserRole.member,
    memberTier: 'active_member',
    dateOfBirth: yearsAgo(29),
    gender: Gender.female,
    weightKg: 74,
    heightCm: 175,
    activityLevel: ActivityLevel.active,
    fitnessGoal: FitnessGoal.bulking,
    hasAcceptedPrivacy: true,
  },
  {
    key: 'member-verified-non-member',
    email: `nonmember.verified@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Danica',
    lastName: 'Lim',
    phone: '+639170010006',
    password: 'FitTrack@Member2',
    role: UserRole.member,
    memberTier: 'verified_non_member',
    dateOfBirth: yearsAgo(26),
    gender: Gender.female,
    weightKg: 61,
    heightCm: 163,
    activityLevel: ActivityLevel.light,
    fitnessGoal: FitnessGoal.maintenance,
    hasAcceptedPrivacy: true,
  },
  {
    key: 'member-pending',
    email: `member.pending@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Rafael',
    lastName: 'Tan',
    phone: '+639170010007',
    password: 'FitTrack@Member3',
    role: UserRole.member,
    status: UserStatus.pending,
    memberTier: 'pending_verification',
    dateOfBirth: yearsAgo(24),
    gender: Gender.male,
    weightKg: 58,
    heightCm: 161,
    activityLevel: ActivityLevel.sedentary,
    fitnessGoal: FitnessGoal.maintenance,
    hasAcceptedPrivacy: false,
  },
  {
    key: 'member-archived',
    email: `member.archived@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Nestor',
    lastName: 'Dela Cruz',
    phone: '+639170010008',
    password: 'FitTrack@Member4',
    role: UserRole.member,
    memberTier: 'archived',
    deletedAt: nowPlusDays(-15, 18),
    dateOfBirth: yearsAgo(35),
    gender: Gender.male,
    weightKg: 72,
    heightCm: 172,
    activityLevel: ActivityLevel.light,
    fitnessGoal: FitnessGoal.maintenance,
    hasAcceptedPrivacy: true,
  },
];

function buildBulkAccounts(): RealisticAccount[] {
  const namePool: Array<{ firstName: string; lastName: string }> = [];
  const reservedNames = new Set(
    CORE_ACCOUNTS.map((account) =>
      `${account.firstName}|${account.lastName}`.toLowerCase(),
    ),
  );
  const reservedEmails = new Set(
    CORE_ACCOUNTS.map((account) => account.email.toLowerCase()),
  );

  for (const firstName of FIRST_NAME_POOL) {
    for (const lastName of LAST_NAME_POOL) {
      const key = `${firstName}|${lastName}`.toLowerCase();
      if (!reservedNames.has(key)) {
        namePool.push({ firstName, lastName });
      }
    }
  }

  let nameIndex = 0;
  let phoneIndex = 9000001;

  const nextIdentity = (role: UserRole) => {
    const identity = namePool[nameIndex];
    if (!identity) {
      throw new Error('Bulk realistic account pool exhausted.');
    }
    nameIndex += 1;
    let email = `${slugify(identity.firstName)}.${slugify(identity.lastName)}@${TEST_DATA_EMAIL_DOMAIN}`;
    if (reservedEmails.has(email)) {
      email = `${slugify(identity.firstName)}.${slugify(identity.lastName)}.${role}@${TEST_DATA_EMAIL_DOMAIN}`;
    }
    reservedEmails.add(email);
    const phone = `+63918${String(phoneIndex).padStart(7, '0')}`;
    phoneIndex += 1;
    return { ...identity, email, phone };
  };

  const accounts: RealisticAccount[] = [];

  const pushRoleAccounts = (
    role: UserRole,
    count: number,
    buildAccount: (
      identity: ReturnType<typeof nextIdentity>,
      index: number,
    ) => RealisticAccount,
  ) => {
    for (let index = 0; index < count; index += 1) {
      accounts.push(buildAccount(nextIdentity(role), index));
    }
  };

  pushRoleAccounts(UserRole.staff, 7, (identity, index) => ({
    key: `staff-ops-${index + 1}`,
    password: BULK_PASSWORDS.staff,
    role: UserRole.staff,
    dateOfBirth: yearsAgo(24 + (index % 10)),
    gender: index % 2 === 0 ? Gender.female : Gender.male,
    hasAcceptedPrivacy: true,
    ...identity,
  }));

  pushRoleAccounts(UserRole.coach, 20, (identity, index) => ({
    key: `coach-team-${index + 1}`,
    password: BULK_PASSWORDS.coach,
    role: UserRole.coach,
    dateOfBirth: yearsAgo(28 + (index % 10)),
    weightKg: 67 + (index % 16),
    heightCm: 165 + (index % 15),
    activityLevel:
      index % 3 === 0 ? ActivityLevel.very_active : ActivityLevel.active,
    fitnessGoal: FitnessGoal.sport_specific,
    hasAcceptedPrivacy: true,
    gender: index % 2 === 0 ? Gender.male : Gender.female,
    coachSpecialization:
      index % 2 === 0 ? 'Strength and Conditioning' : 'Mobility and Recovery',
    coachScheduleType:
      index % 3 === 0
        ? CoachScheduleType.full_time
        : CoachScheduleType.part_time,
    coachHourlyRate: 420 + index * 15,
    coachBio:
      index % 2 === 0
        ? 'Supports strength blocks, member assessments, and performance coaching.'
        : 'Focuses on mobility, conditioning, and sustainable training return plans.',
    coachCertification:
      index % 2 === 0 ? 'NASM-CPT' : 'ACE-CPT, Functional Training Specialist',
    ...identity,
  }));

  const memberGroups: Array<{
    count: number;
    keyPrefix: string;
    memberTier: MemberTierSeed;
  }> = [
    {
      keyPrefix: 'member-active-bulk',
      memberTier: 'active_member',
      count: 280,
    },
    {
      keyPrefix: 'member-verified-non-member-bulk',
      memberTier: 'verified_non_member',
      count: 90,
    },
    {
      keyPrefix: 'member-pending-verification-bulk',
      memberTier: 'pending_verification',
      count: 45,
    },
    {
      keyPrefix: 'member-pending-membership-bulk',
      memberTier: 'pending_membership',
      count: 25,
    },
    { keyPrefix: 'member-revoked-bulk', memberTier: 'revoked', count: 20 },
    { keyPrefix: 'member-archived-bulk', memberTier: 'archived', count: 15 },
  ];

  for (const group of memberGroups) {
    for (let index = 0; index < group.count; index += 1) {
      const identity = nextIdentity(UserRole.member);
      const age = 20 + ((accounts.length + index) % 22);
      const isPending = group.memberTier === 'pending_verification';
      const isArchived = group.memberTier === 'archived';
      accounts.push({
        key: `${group.keyPrefix}-${String(index + 1).padStart(3, '0')}`,
        password: BULK_PASSWORDS.member,
        role: UserRole.member,
        memberTier: group.memberTier,
        status: isPending ? UserStatus.pending : UserStatus.active,
        deletedAt: isArchived ? nowPlusDays(-(7 + (index % 20)), 18) : null,
        dateOfBirth: yearsAgo(age),
        gender: index % 2 === 0 ? Gender.female : Gender.male,
        weightKg: 52 + ((index * 3) % 32),
        heightCm: 150 + ((index * 2) % 35),
        activityLevel:
          group.memberTier === 'active_member'
            ? index % 4 === 0
              ? ActivityLevel.very_active
              : ActivityLevel.active
            : group.memberTier === 'verified_non_member'
              ? ActivityLevel.light
              : ActivityLevel.sedentary,
        fitnessGoal:
          group.memberTier === 'active_member'
            ? index % 3 === 0
              ? FitnessGoal.bulking
              : index % 3 === 1
                ? FitnessGoal.cutting
                : FitnessGoal.maintenance
            : FitnessGoal.maintenance,
        hasAcceptedPrivacy: !isPending,
        ...identity,
      });
    }
  }

  return accounts;
}

const ACCOUNTS: readonly RealisticAccount[] = [
  ...CORE_ACCOUNTS,
  ...buildBulkAccounts(),
];

const accountId = Object.fromEntries(
  ACCOUNTS.map((account) => [account.key, id(`user:${account.key}`)]),
) as Record<string, string>;
const coachAccountKeys = ACCOUNTS.filter(
  (account) => account.role === UserRole.coach,
).map((account) => account.key);

const credentialHashCache = new Map<string, Promise<string>>();

function defaultActivityLevelForAccount(
  account: RealisticAccount,
): ActivityLevel | null {
  if (account.activityLevel !== undefined) {
    return account.activityLevel;
  }
  if (account.role === UserRole.coach) {
    return ActivityLevel.very_active;
  }
  if (account.role !== UserRole.member) {
    return null;
  }
  switch (account.memberTier) {
    case 'active_member':
      return ActivityLevel.active;
    case 'verified_non_member':
      return ActivityLevel.light;
    default:
      return ActivityLevel.sedentary;
  }
}

function defaultFitnessGoalForAccount(
  account: RealisticAccount,
): FitnessGoal | null {
  if (account.fitnessGoal !== undefined) {
    return account.fitnessGoal;
  }
  if (account.role === UserRole.coach) {
    return FitnessGoal.sport_specific;
  }
  if (account.role === UserRole.member) {
    return FitnessGoal.maintenance;
  }
  return null;
}

function defaultDateOfBirthForAccount(account: RealisticAccount) {
  if (account.dateOfBirth !== undefined) {
    return account.dateOfBirth;
  }
  if (account.role === UserRole.admin) {
    return yearsAgo(37);
  }
  if (account.role === UserRole.staff) {
    return yearsAgo(29);
  }
  if (account.role === UserRole.coach) {
    return yearsAgo(32);
  }
  return yearsAgo(27);
}

function defaultHeightForAccount(account: RealisticAccount) {
  if (account.heightCm !== undefined) {
    return account.heightCm;
  }
  if (account.role === UserRole.coach) {
    return 174;
  }
  if (account.role === UserRole.member) {
    return 168;
  }
  return null;
}

function defaultWeightForAccount(account: RealisticAccount) {
  if (account.weightKg !== undefined) {
    return account.weightKg;
  }
  if (account.role === UserRole.coach) {
    return 73;
  }
  if (account.role === UserRole.member) {
    return 66;
  }
  return null;
}

function memberAccountsByTier(tier: MemberTierSeed) {
  return ACCOUNTS.filter(
    (account) =>
      account.role === UserRole.member && account.memberTier === tier,
  );
}

function accountsByRole(role: UserRole) {
  return ACCOUNTS.filter((account) => account.role === role);
}

function coachProfileIdForAccount(accountKey: string) {
  if (accountKey === 'coach') {
    return id('coach:marco');
  }
  if (coachAccountKeys[1] && accountKey === coachAccountKeys[1]) {
    return id('coach:lia');
  }
  return id(`coach-profile:${accountKey}`);
}

async function credentialHashFor(password: string) {
  const cached = credentialHashCache.get(password);
  if (cached) {
    return cached;
  }
  const nextHash = bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  credentialHashCache.set(password, nextHash);
  return nextHash;
}

async function ensureAccount(account: RealisticAccount) {
  const userId = accountId[account.key];
  const isPendingVerification =
    account.status === UserStatus.pending ||
    account.memberTier === 'pending_verification';
  const verifiedAt = isPendingVerification ? null : nowPlusDays(-35, 8);
  const credentialHash = await credentialHashFor(account.password);
  const dateOfBirth = defaultDateOfBirthForAccount(account);
  const heightCm = defaultHeightForAccount(account);
  const weightKg = defaultWeightForAccount(account);
  const activityLevel = defaultActivityLevelForAccount(account);
  const fitnessGoal = defaultFitnessGoalForAccount(account);

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      role: account.role,
      status: account.status ?? UserStatus.active,
      deletedAt: account.deletedAt ?? null,
      email_verified_at: verifiedAt,
      phone_verified_at: verifiedAt,
      has_accepted_privacy:
        account.hasAcceptedPrivacy ?? !isPendingVerification,
      privacy_accepted_at:
        (account.hasAcceptedPrivacy ?? !isPendingVerification)
          ? nowPlusDays(-30, 7)
          : null,
      qr_code_token: `real-${account.key}-${randomUUID()}`.slice(0, 64),
      qr_code_rotated_at: nowPlusDays(-1, 6),
      qr_code_expires_at: nowPlusDays(1, 6),
    },
    create: {
      id: userId,
      role: account.role,
      status: account.status ?? UserStatus.active,
      deletedAt: account.deletedAt ?? null,
      email_verified_at: verifiedAt,
      phone_verified_at: verifiedAt,
      has_accepted_privacy:
        account.hasAcceptedPrivacy ?? !isPendingVerification,
      privacy_accepted_at:
        (account.hasAcceptedPrivacy ?? !isPendingVerification)
          ? nowPlusDays(-30, 7)
          : null,
      qr_code_token: `real-${account.key}-${randomUUID()}`.slice(0, 64),
      qr_code_rotated_at: nowPlusDays(-1, 6),
      qr_code_expires_at: nowPlusDays(1, 6),
    },
  });

  const existingIdentity = await prisma.authIdentity.findFirst({
    where: { provider: AuthProvider.email, identifier: account.email },
    select: { id: true },
  });

  if (existingIdentity) {
    await prisma.authIdentity.update({
      where: { id: existingIdentity.id },
      data: {
        user_id: userId,
        credential_hash: credentialHash,
        is_primary: true,
        verified_at: verifiedAt ?? null,
      },
    });
  } else {
    await prisma.authIdentity.create({
      data: {
        id: id(`auth:${account.key}:email`),
        user_id: userId,
        provider: AuthProvider.email,
        identifier: account.email,
        credential_hash: credentialHash,
        is_primary: true,
        verified_at: verifiedAt ?? null,
      },
    });
  }

  await prisma.userProfile.upsert({
    where: { user_id: userId },
    update: {
      first_name: account.firstName,
      last_name: account.lastName,
      phone: account.phone,
      date_of_birth: dateOfBirth,
      gender: account.gender ?? Gender.other,
      weight_kg: weightKg !== null ? money(weightKg) : null,
      height_cm: heightCm !== null ? money(heightCm) : null,
      activity_level: activityLevel,
      fitness_goal: fitnessGoal,
      avatar_url: null,
    },
    create: {
      id: id(`profile:${account.key}`),
      user_id: userId,
      first_name: account.firstName,
      last_name: account.lastName,
      phone: account.phone,
      date_of_birth: dateOfBirth,
      gender: account.gender ?? Gender.other,
      weight_kg: weightKg !== null ? money(weightKg) : null,
      height_cm: heightCm !== null ? money(heightCm) : null,
      activity_level: activityLevel,
      fitness_goal: fitnessGoal,
      avatar_url: null,
    },
  });

  await prisma.notificationPreference.upsert({
    where: { user_id: userId },
    update: {
      booking_confirmed_email: true,
      appointment_confirmed_email: true,
      payment_confirmed_email: true,
      system_email: true,
    },
    create: {
      id: id(`notification-prefs:${account.key}`),
      user_id: userId,
      booking_confirmed_email: true,
      appointment_confirmed_email: true,
      payment_confirmed_email: true,
      system_email: true,
    },
  });

  await prisma.refreshToken.upsert({
    where: { id: id(`refresh-token:${account.key}`) },
    update: {
      token_hash: tokenHash(`refresh:${account.key}`),
      device_info: 'FitTrack realistic seed browser session',
      ip_address: '127.0.0.1',
      expires_at: nowPlusDays(30),
      revoked_at: account.deletedAt ?? null,
    },
    create: {
      id: id(`refresh-token:${account.key}`),
      user_id: userId,
      token_hash: tokenHash(`refresh:${account.key}`),
      device_info: 'FitTrack realistic seed browser session',
      ip_address: '127.0.0.1',
      expires_at: nowPlusDays(30),
      revoked_at: account.deletedAt ?? null,
    },
  });

  await prisma.otpVerification.upsert({
    where: { id: id(`otp:${account.key}:login`) },
    update: {
      code_hash: tokenHash(`otp:${account.key}:123456`),
      expires_at: nowPlusDays(1),
      attempts: isPendingVerification ? 1 : 0,
      consumed_at: isPendingVerification ? null : verifiedAt,
    },
    create: {
      id: id(`otp:${account.key}:login`),
      user_id: userId,
      channel: 'email',
      purpose: 'login_2fa',
      code_hash: tokenHash(`otp:${account.key}:123456`),
      expires_at: nowPlusDays(1),
      attempts: isPendingVerification ? 1 : 0,
      consumed_at: isPendingVerification ? null : verifiedAt,
    },
  });
}

async function ensureAccounts() {
  for (const account of ACCOUNTS) {
    await ensureAccount(account);
  }

  await prisma.accountDeletionRequest.upsert({
    where: { id: id('account-deletion:member-archived') },
    update: {
      status: AccountDeletionRequestStatus.approved,
      reviewedBy: accountId.staff,
      reviewedAt: nowPlusDays(-15, 18),
      reviewNotes: 'Member requested account closure after moving branches.',
    },
    create: {
      id: id('account-deletion:member-archived'),
      userId: accountId['member-archived'],
      reason: 'Moved to another city.',
      status: AccountDeletionRequestStatus.approved,
      reviewedBy: accountId.staff,
      reviewedAt: nowPlusDays(-15, 18),
      reviewNotes: 'Member requested account closure after moving branches.',
    },
  });

  const archivedBulkMembers = memberAccountsByTier('archived').filter(
    (account) => account.key !== 'member-archived',
  );

  for (const [index, archivedAccount] of archivedBulkMembers.entries()) {
    await prisma.accountDeletionRequest.upsert({
      where: { id: id(`account-deletion:${archivedAccount.key}`) },
      update: {
        userId: accountId[archivedAccount.key],
        reason: 'Requested account closure after pausing gym attendance.',
        status:
          index % 3 === 0
            ? AccountDeletionRequestStatus.pending
            : AccountDeletionRequestStatus.approved,
        reviewedBy: index % 3 === 0 ? null : accountId.staff,
        reviewedAt: index % 3 === 0 ? null : nowPlusDays(-(9 + index), 17),
        reviewNotes:
          index % 3 === 0
            ? null
            : 'Archive request reviewed and approved by operations.',
      },
      create: {
        id: id(`account-deletion:${archivedAccount.key}`),
        userId: accountId[archivedAccount.key],
        reason: 'Requested account closure after pausing gym attendance.',
        status:
          index % 3 === 0
            ? AccountDeletionRequestStatus.pending
            : AccountDeletionRequestStatus.approved,
        reviewedBy: index % 3 === 0 ? null : accountId.staff,
        reviewedAt: index % 3 === 0 ? null : nowPlusDays(-(9 + index), 17),
        reviewNotes:
          index % 3 === 0
            ? null
            : 'Archive request reviewed and approved by operations.',
      },
    });
  }

  await prisma.progressMetric.upsert({
    where: { id: id('progress-metric:active:latest') },
    update: {
      weight_kg: money(67.5),
      height_cm: money(170),
      body_fat_pct: money(22.5),
      muscle_mass_kg: money(29.2),
      waist_cm: money(78),
      chest_cm: money(92),
      notes: 'Consistent training week; resting heart rate improved.',
      recorded_at: nowPlusDays(-2, 7),
    },
    create: {
      id: id('progress-metric:active:latest'),
      user_id: accountId['member-active'],
      weight_kg: money(67.5),
      height_cm: money(170),
      body_fat_pct: money(22.5),
      muscle_mass_kg: money(29.2),
      waist_cm: money(78),
      chest_cm: money(92),
      notes: 'Consistent training week; resting heart rate improved.',
      recorded_at: nowPlusDays(-2, 7),
    },
  });
}

async function ensureMembershipsAndPayments() {
  const plans = [
    {
      id: id('membership-plan:one-day'),
      name: '1-Day Pass',
      description:
        'One gym visit with attendance check-in; consumed after the first successful entry. Coaching services are purchased separately.',
      price: money(150),
      duration_days: 1,
      features: json({ access: ['floor', 'attendance'] }),
      sort_order: 0,
      includes_coaching: false,
    },
    {
      id: id('membership-plan:weekly'),
      name: 'Weekly Membership',
      description:
        'Seven consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
      price: money(499),
      duration_days: 7,
      features: json({ access: ['floor', 'attendance'] }),
      sort_order: 1,
      includes_coaching: false,
    },
    {
      id: id('membership-plan:monthly'),
      name: 'Monthly Membership',
      description:
        'Thirty consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
      price: money(1499),
      duration_days: 30,
      features: json({ access: ['floor', 'attendance'] }),
      sort_order: 2,
      includes_coaching: false,
    },
    {
      id: id('membership-plan:three-month'),
      name: '3-Month Membership',
      description:
        'Ninety consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
      price: money(3499),
      duration_days: 90,
      features: json({ access: ['floor', 'attendance'] }),
      sort_order: 3,
      includes_coaching: false,
    },
    {
      id: '2f5db3bd-1b9f-4b3f-8ba6-d9ff44af3004',
      name: '1-Year Membership',
      description:
        'Three hundred sixty-five consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
      price: money(11999),
      duration_days: 365,
      features: json({ access: ['floor', 'attendance'] }),
      sort_order: 4,
      includes_coaching: false,
    },
  ];

  for (const plan of plans) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  const membershipPaymentId = id('payment:membership-card:active');
  const subscriptionPaymentId = id('payment:subscription:active');
  const activeCardId = id('membership-card:active');
  const premiumCardId = id('membership-card:premium');

  await prisma.membershipCard.upsert({
    where: { user_id: accountId['member-active'] },
    update: {
      status: MembershipCardStatus.active,
      source: MembershipCardSource.paymongo,
      price: money(400),
      purchased_at: nowPlusDays(-28, 10),
      verified_at: nowPlusDays(-28, 10),
      verified_by: accountId.staff,
      activated_at: nowPlusDays(-28, 10),
      revoked_at: null,
      revoked_by: null,
      revoke_reason: null,
    },
    create: {
      id: activeCardId,
      user_id: accountId['member-active'],
      status: MembershipCardStatus.active,
      source: MembershipCardSource.paymongo,
      price: money(400),
      purchased_at: nowPlusDays(-28, 10),
      verified_at: nowPlusDays(-28, 10),
      verified_by: accountId.staff,
      activated_at: nowPlusDays(-28, 10),
    },
  });

  await prisma.membershipCard.upsert({
    where: { user_id: accountId['member-premium'] },
    update: {
      status: MembershipCardStatus.active,
      source: MembershipCardSource.cash,
      price: money(400),
      purchased_at: nowPlusDays(-12, 11),
      verified_at: nowPlusDays(-12, 11),
      verified_by: accountId.admin,
      activated_at: nowPlusDays(-12, 11),
      revoked_at: null,
      revoked_by: null,
      revoke_reason: null,
    },
    create: {
      id: premiumCardId,
      user_id: accountId['member-premium'],
      status: MembershipCardStatus.active,
      source: MembershipCardSource.cash,
      price: money(400),
      purchased_at: nowPlusDays(-12, 11),
      verified_at: nowPlusDays(-12, 11),
      verified_by: accountId.admin,
      activated_at: nowPlusDays(-12, 11),
    },
  });

  await ensurePayment({
    id: membershipPaymentId,
    user_id: accountId['member-active'],
    payable_type: PayableType.membership_card,
    payable_id: activeCardId,
    payment_stage: PaymentStage.full,
    amount: money(400),
    provider: PaymentProvider.paymongo,
    status: PaymentStatus.completed,
    provider_ref: 'realistic-paymongo-membership-card-active',
    verified_by: accountId.staff,
    verified_at: nowPlusDays(-28, 10),
    gateway_metadata: json({
      checkout: 'test_mode',
      source: 'mobile',
      description: 'Membership card one-time purchase',
    }),
  });

  await ensurePayment({
    id: subscriptionPaymentId,
    user_id: accountId['member-active'],
    payable_type: PayableType.subscription,
    payable_id: id('subscription:active'),
    payment_stage: PaymentStage.full,
    amount: money(799),
    provider: PaymentProvider.cash,
    status: PaymentStatus.completed,
    verified_by: accountId.staff,
    verified_at: nowPlusDays(-27, 9),
    screenshot_url:
      null,
    gateway_metadata: json({ source: 'front_desk_cash' }),
  });

  await prisma.subscription.upsert({
    where: { id: id('subscription:active') },
    update: {
      user_id: accountId['member-active'],
      plan_id: plans[0].id,
      payment_id: subscriptionPaymentId,
      status: SubscriptionStatus.active,
      starts_at: nowPlusDays(-27, 9),
      expires_at: nowPlusDays(3, 23),
    },
    create: {
      id: id('subscription:active'),
      user_id: accountId['member-active'],
      plan_id: plans[0].id,
      payment_id: subscriptionPaymentId,
      status: SubscriptionStatus.active,
      starts_at: nowPlusDays(-27, 9),
      expires_at: nowPlusDays(3, 23),
    },
  });

  await prisma.subscription.upsert({
    where: { id: id('subscription:premium') },
    update: {
      user_id: accountId['member-premium'],
      plan_id: plans[1].id,
      payment_id: null,
      status: SubscriptionStatus.past_due,
      starts_at: nowPlusDays(-41, 9),
      expires_at: nowPlusDays(-2, 23),
      warned_7d_at: nowPlusDays(-9, 9),
      warned_3d_at: nowPlusDays(-5, 9),
      warned_1d_at: nowPlusDays(-3, 9),
    },
    create: {
      id: id('subscription:premium'),
      user_id: accountId['member-premium'],
      plan_id: plans[1].id,
      status: SubscriptionStatus.past_due,
      starts_at: nowPlusDays(-41, 9),
      expires_at: nowPlusDays(-2, 23),
      warned_7d_at: nowPlusDays(-9, 9),
      warned_3d_at: nowPlusDays(-5, 9),
      warned_1d_at: nowPlusDays(-3, 9),
    },
  });
}

type PaymentSeed = Omit<
  Prisma.PaymentUncheckedCreateInput,
  'created_at' | 'updated_at' | 'currency' | 'idempotency_key'
> & {
  id: string;
  idempotency_key?: string;
};

async function ensurePayment(seed: PaymentSeed) {
  const data = {
    currency: 'PHP',
    idempotency_key: seed.idempotency_key ?? `realistic:${seed.id}`,
    ...seed,
  };

  await prisma.payment.upsert({
    where: { id: seed.id },
    update: data,
    create: data,
  });
}

async function ensureFacilitiesAndCoaching() {
  const floorMedia = [
    {
      floor_id: 'floor-1',
      image_url: null,
    },
    {
      floor_id: 'floor-2',
      image_url: null,
    },
  ];

  for (const media of floorMedia) {
    await prisma.facilityFloorPlanMedia.upsert({
      where: { floor_id: media.floor_id },
      update: media,
      create: media,
    });
  }

  const amenities = [
    {
      id: id('amenity:basketball'),
      name: 'Basketball Court',
      type: AmenityType.basketball_court,
      description: 'Full court for pickup games and agility drills.',
      capacity: 10,
      hourly_rate: money(150),
      minimum_hours: 1,
      icon_key: 'basketball',
      grid_column: 9,
      grid_row: 1,
      grid_width: 6,
      grid_height: 4,
      image_url: null,
      is_reservable: true,
      display_order: 1,
      floor_id: 'floor-1',
      requires_subscription: false,
      is_active: true,
    },
    {
      id: id('amenity:boxing'),
      name: 'Boxing Ring',
      type: AmenityType.boxing_ring,
      description: 'Ring for boxing conditioning and supervised sparring.',
      capacity: 4,
      hourly_rate: money(75),
      minimum_hours: 1,
      icon_key: 'boxing',
      grid_column: 2,
      grid_row: 3,
      grid_width: 5,
      grid_height: 4,
      image_url: null,
      is_reservable: true,
      display_order: 2,
      floor_id: 'floor-1',
      requires_subscription: false,
      is_active: true,
    },
    {
      id: id('amenity:studio'),
      name: 'Multi-Purpose Studio',
      type: AmenityType.other,
      description: 'Studio for stretching, yoga, mobility, and small groups.',
      capacity: 16,
      hourly_rate: money(120),
      minimum_hours: 1,
      icon_key: 'studio',
      grid_column: 5,
      grid_row: 2,
      grid_width: 8,
      grid_height: 5,
      image_url: null,
      is_reservable: true,
      display_order: 3,
      floor_id: 'floor-2',
      requires_subscription: true,
      is_active: true,
    },
  ];

  for (const amenity of amenities) {
    await prisma.amenity.upsert({
      where: { id: amenity.id },
      update: amenity,
      create: amenity,
    });
  }

  const namedCoach = ACCOUNTS.find((account) => account.key === 'coach');
  const backupCoach = ACCOUNTS.find(
    (account) => account.key === coachAccountKeys[1],
  );

  if (!namedCoach) {
    throw new Error('Named coach account is missing from the realistic seed.');
  }

  const coaches = [
    {
      id: coachProfileIdForAccount(namedCoach.key),
      user_id: accountId[namedCoach.key],
      display_name: `${namedCoach.firstName} ${namedCoach.lastName}`,
      contact_email: namedCoach.email,
      contact_phone: namedCoach.phone,
      specialization:
        namedCoach.coachSpecialization ?? 'Strength and Conditioning',
      bio:
        namedCoach.coachBio ??
        'Head coach for strength and conditioning and progressive performance blocks.',
      certification: namedCoach.coachCertification ?? 'NSCA-CSCS',
      hourly_rate: money(namedCoach.coachHourlyRate ?? 650),
      gym_commission_pct: money(20),
      schedule_type:
        namedCoach.coachScheduleType ?? CoachScheduleType.full_time,
      average_rating: money(4.9),
      rating_count: 24,
      is_available_for_booking: true,
    },
    ...(backupCoach
      ? [
          {
            id: coachProfileIdForAccount(backupCoach.key),
            user_id: accountId[backupCoach.key],
            display_name: `${backupCoach.firstName} ${backupCoach.lastName}`,
            contact_email: backupCoach.email,
            contact_phone: backupCoach.phone,
            specialization:
              backupCoach.coachSpecialization ?? 'Mobility and Recovery',
            bio:
              backupCoach.coachBio ??
              'Mobility and conditioning coach for returning members and active recovery blocks.',
            certification:
              backupCoach.coachCertification ??
              'ACE-CPT, Functional Mobility Specialist',
            hourly_rate: money(backupCoach.coachHourlyRate ?? 480),
            gym_commission_pct: money(20),
            schedule_type:
              backupCoach.coachScheduleType ?? CoachScheduleType.part_time,
            average_rating: money(4.7),
            rating_count: 16,
            is_available_for_booking: true,
          },
        ]
      : []),
  ];

  for (const coach of coaches) {
    await prisma.coachProfile.upsert({
      where: { id: coach.id },
      update: coach,
      create: coach,
    });
  }

  const additionalCoachAccounts = accountsByRole(UserRole.coach).slice(
    backupCoach ? 2 : 1,
  );

  for (const [index, coachAccount] of additionalCoachAccounts.entries()) {
    await prisma.coachProfile.upsert({
      where: { id: coachProfileIdForAccount(coachAccount.key) },
      update: {
        user_id: accountId[coachAccount.key],
        display_name: `${coachAccount.firstName} ${coachAccount.lastName}`,
        contact_email: coachAccount.email,
        contact_phone: coachAccount.phone,
        specialization:
          coachAccount.coachSpecialization ?? 'Strength and Conditioning',
        bio:
          coachAccount.coachBio ??
          'Supports strength, mobility, and structured member progression blocks.',
        certification: coachAccount.coachCertification ?? 'NASM-CPT',
        hourly_rate: money(coachAccount.coachHourlyRate ?? 450 + index * 10),
        gym_commission_pct: money(20),
        schedule_type:
          coachAccount.coachScheduleType ?? CoachScheduleType.part_time,
        average_rating: money(4.4 + (index % 4) * 0.1),
        rating_count: 6 + index,
        is_available_for_booking: true,
      },
      create: {
        id: coachProfileIdForAccount(coachAccount.key),
        user_id: accountId[coachAccount.key],
        display_name: `${coachAccount.firstName} ${coachAccount.lastName}`,
        contact_email: coachAccount.email,
        contact_phone: coachAccount.phone,
        specialization:
          coachAccount.coachSpecialization ?? 'Strength and Conditioning',
        bio:
          coachAccount.coachBio ??
          'Supports strength, mobility, and structured member progression blocks.',
        certification: coachAccount.coachCertification ?? 'NASM-CPT',
        hourly_rate: money(coachAccount.coachHourlyRate ?? 450 + index * 10),
        gym_commission_pct: money(20),
        schedule_type:
          coachAccount.coachScheduleType ?? CoachScheduleType.part_time,
        average_rating: money(4.4 + (index % 4) * 0.1),
        rating_count: 6 + index,
        is_available_for_booking: true,
      },
    });
  }

  const availability: Array<[string, number, string, string]> = [
    ['coach', 1, '08:00:00', '12:00:00'],
    ['coach', 3, '14:00:00', '18:00:00'],
    ['coach', 6, '09:00:00', '13:00:00'],
  ];

  if (backupCoach) {
    availability.push(
      [backupCoach.key, 2, '10:00:00', '14:00:00'],
      [backupCoach.key, 4, '15:00:00', '19:00:00'],
    );
  }

  for (const [coachKey, day, starts, ends] of availability) {
    await prisma.coachAvailabilitySlot.upsert({
      where: { id: id(`availability:${coachKey}:${day}:${starts}`) },
      update: {
        coach_id: coachProfileIdForAccount(coachKey),
        day_of_week: day,
        start_time: fixedTime(starts),
        end_time: fixedTime(ends),
        is_active: true,
      },
      create: {
        id: id(`availability:${coachKey}:${day}:${starts}`),
        coach_id: coachProfileIdForAccount(coachKey),
        day_of_week: day,
        start_time: fixedTime(starts),
        end_time: fixedTime(ends),
        is_active: true,
      },
    });
  }

  for (const [index, coachAccount] of additionalCoachAccounts.entries()) {
    const baseDay = (index % 5) + 1;
    const windows: Array<[number, string, string]> = [
      [baseDay, '07:00:00', '11:00:00'],
      [(baseDay + 2) % 7 || 7, '13:00:00', '17:00:00'],
    ];
    for (const [day, starts, ends] of windows) {
      await prisma.coachAvailabilitySlot.upsert({
        where: { id: id(`availability:${coachAccount.key}:${day}:${starts}`) },
        update: {
          coach_id: coachProfileIdForAccount(coachAccount.key),
          day_of_week: day,
          start_time: fixedTime(starts),
          end_time: fixedTime(ends),
          is_active: true,
        },
        create: {
          id: id(`availability:${coachAccount.key}:${day}:${starts}`),
          coach_id: coachProfileIdForAccount(coachAccount.key),
          day_of_week: day,
          start_time: fixedTime(starts),
          end_time: fixedTime(ends),
          is_active: true,
        },
      });
    }
  }

  const venueBookingId = id('amenity-booking:confirmed');
  const venuePendingId = id('amenity-booking:balance-pending');
  const coachAppointmentId = id('coach-appointment:confirmed');
  const coachCompletedId = id('coach-appointment:completed');

  await prisma.amenityBooking.upsert({
    where: { id: venueBookingId },
    update: {
      user_id: accountId['member-active'],
      amenity_id: id('amenity:basketball'),
      coach_id: id('coach:marco'),
      status: BookingStatus.confirmed,
      starts_at: nowPlusDays(2, 8),
      ends_at: nowPlusDays(2, 10),
      total_amount: money(1300),
      downpayment_amount: money(390),
      balance_amount: money(910),
      downpayment_paid_at: nowPlusDays(-1, 10),
      balance_paid_at: nowPlusDays(-1, 11),
      notes: 'Mobile member booking with coach add-on.',
    },
    create: {
      id: venueBookingId,
      user_id: accountId['member-active'],
      amenity_id: id('amenity:basketball'),
      coach_id: id('coach:marco'),
      status: BookingStatus.confirmed,
      starts_at: nowPlusDays(2, 8),
      ends_at: nowPlusDays(2, 10),
      total_amount: money(1300),
      downpayment_amount: money(390),
      balance_amount: money(910),
      downpayment_paid_at: nowPlusDays(-1, 10),
      balance_paid_at: nowPlusDays(-1, 11),
      notes: 'Mobile member booking with coach add-on.',
    },
  });

  await prisma.amenityBooking.upsert({
    where: { id: venuePendingId },
    update: {
      user_id: accountId['member-premium'],
      amenity_id: id('amenity:studio'),
      coach_id: null,
      status: BookingStatus.balance_pending,
      starts_at: nowPlusDays(4, 17),
      ends_at: nowPlusDays(4, 19),
      total_amount: money(240),
      downpayment_amount: money(72),
      balance_amount: money(168),
      downpayment_paid_at: nowPlusDays(-1, 14),
      balance_paid_at: null,
      notes: 'Cash downpayment received; balance still due.',
    },
    create: {
      id: venuePendingId,
      user_id: accountId['member-premium'],
      amenity_id: id('amenity:studio'),
      status: BookingStatus.balance_pending,
      starts_at: nowPlusDays(4, 17),
      ends_at: nowPlusDays(4, 19),
      total_amount: money(240),
      downpayment_amount: money(72),
      balance_amount: money(168),
      downpayment_paid_at: nowPlusDays(-1, 14),
      notes: 'Cash downpayment received; balance still due.',
    },
  });

  await ensurePayment({
    id: id('payment:venue:downpayment'),
    user_id: accountId['member-active'],
    payable_type: PayableType.booking,
    payable_id: venueBookingId,
    payment_stage: PaymentStage.downpayment,
    amount: money(390),
    provider: PaymentProvider.paymongo,
    status: PaymentStatus.completed,
    provider_ref: 'realistic-venue-downpayment',
    verified_by: accountId.staff,
    verified_at: nowPlusDays(-1, 10),
  });

  await ensurePayment({
    id: id('payment:venue:balance'),
    user_id: accountId['member-active'],
    payable_type: PayableType.booking,
    payable_id: venueBookingId,
    payment_stage: PaymentStage.balance,
    amount: money(910),
    provider: PaymentProvider.cash,
    status: PaymentStatus.completed,
    verified_by: accountId.staff,
    verified_at: nowPlusDays(-1, 11),
  });

  await prisma.coachAppointment.upsert({
    where: { id: coachAppointmentId },
    update: {
      user_id: accountId['member-active'],
      coach_id: id('coach:marco'),
      status: AppointmentStatus.confirmed,
      scheduled_at: nowPlusDays(3, 9),
      duration_minutes: 60,
      total_amount: money(500),
      downpayment_amount: money(150),
      balance_amount: money(350),
      gym_revenue: money(500),
      coach_earnings: money(0),
      downpayment_paid_at: nowPlusDays(-1, 15),
      balance_paid_at: nowPlusDays(-1, 15),
      member_notes: 'Wants squat technique review.',
    },
    create: {
      id: coachAppointmentId,
      user_id: accountId['member-active'],
      coach_id: id('coach:marco'),
      status: AppointmentStatus.confirmed,
      scheduled_at: nowPlusDays(3, 9),
      duration_minutes: 60,
      total_amount: money(500),
      downpayment_amount: money(150),
      balance_amount: money(350),
      gym_revenue: money(500),
      coach_earnings: money(0),
      downpayment_paid_at: nowPlusDays(-1, 15),
      balance_paid_at: nowPlusDays(-1, 15),
      member_notes: 'Wants squat technique review.',
    },
  });

  await prisma.coachAppointment.upsert({
    where: { id: coachCompletedId },
    update: {
      user_id: accountId['member-premium'],
      coach_id: id('coach:lia'),
      status: AppointmentStatus.completed,
      scheduled_at: nowPlusDays(-3, 10),
      duration_minutes: 60,
      total_amount: money(420),
      downpayment_amount: money(0),
      balance_amount: money(0),
      gym_revenue: money(420),
      coach_earnings: money(0),
      downpayment_paid_at: nowPlusDays(-4, 12),
      balance_paid_at: nowPlusDays(-4, 12),
      completed_at: nowPlusDays(-3, 11),
      session_notes: 'Completed mobility baseline and homework set.',
    },
    create: {
      id: coachCompletedId,
      user_id: accountId['member-premium'],
      coach_id: id('coach:lia'),
      status: AppointmentStatus.completed,
      scheduled_at: nowPlusDays(-3, 10),
      duration_minutes: 60,
      total_amount: money(420),
      downpayment_amount: money(0),
      balance_amount: money(0),
      gym_revenue: money(420),
      coach_earnings: money(0),
      downpayment_paid_at: nowPlusDays(-4, 12),
      balance_paid_at: nowPlusDays(-4, 12),
      completed_at: nowPlusDays(-3, 11),
      session_notes: 'Completed mobility baseline and homework set.',
    },
  });

  await ensurePayment({
    id: id('payment:coach:confirmed-full'),
    user_id: accountId['member-active'],
    payable_type: PayableType.coaching,
    payable_id: coachAppointmentId,
    payment_stage: PaymentStage.full,
    amount: money(500),
    provider: PaymentProvider.cash,
    status: PaymentStatus.completed,
    verified_by: accountId.admin,
    verified_at: nowPlusDays(-1, 15),
  });

  const recurringPlanId = id('recurring-plan:active');
  await prisma.recurringCoachingPlan.upsert({
    where: { id: recurringPlanId },
    update: {
      member_id: accountId['member-active'],
      coach_id: id('coach:marco'),
      created_by: accountId.staff,
      frequency: RecurringCoachingFrequency.weekly,
      preferred_days: [1],
      preferred_time: fixedTime('08:00:00'),
      start_date: dateOnly(1),
      end_date: dateOnly(29),
      duration_minutes: 60,
      status: RecurringCoachingPlanStatus.active,
      total_sessions: 4,
      completed_sessions: 1,
    },
    create: {
      id: recurringPlanId,
      member_id: accountId['member-active'],
      coach_id: id('coach:marco'),
      created_by: accountId.staff,
      frequency: RecurringCoachingFrequency.weekly,
      preferred_days: [1],
      preferred_time: fixedTime('08:00:00'),
      start_date: dateOnly(1),
      end_date: dateOnly(29),
      duration_minutes: 60,
      status: RecurringCoachingPlanStatus.active,
      total_sessions: 4,
      completed_sessions: 1,
    },
  });

  await prisma.recurringCoachingBillingCycle.upsert({
    where: { id: id('recurring-cycle:current') },
    update: {
      recurring_plan_id: recurringPlanId,
      cycle_start_date: dateOnly(1),
      cycle_end_date: dateOnly(29),
      due_date: dateOnly(1),
      grace_period_ends_at: nowPlusDays(8, 23),
      amount: money(2000),
      status: RecurringCoachingBillingCycleStatus.awaiting_verification,
      payment_id: id('payment:recurring:cycle'),
      paid_at: null,
    },
    create: {
      id: id('recurring-cycle:current'),
      recurring_plan_id: recurringPlanId,
      cycle_start_date: dateOnly(1),
      cycle_end_date: dateOnly(29),
      due_date: dateOnly(1),
      grace_period_ends_at: nowPlusDays(8, 23),
      amount: money(2000),
      status: RecurringCoachingBillingCycleStatus.awaiting_verification,
      payment_id: id('payment:recurring:cycle'),
    },
  });

  await ensurePayment({
    id: id('payment:recurring:cycle'),
    user_id: accountId['member-active'],
    payable_type: PayableType.recurring_coaching,
    payable_id: recurringPlanId,
    payment_stage: PaymentStage.downpayment,
    amount: money(500),
    provider: PaymentProvider.cash,
    status: PaymentStatus.awaiting_verification,
    screenshot_url: null,
  });

  for (let index = 0; index < 4; index += 1) {
    await prisma.coachAppointment.upsert({
      where: { id: id(`coach-appointment:recurring:${index}`) },
      update: {
        user_id: accountId['member-active'],
        coach_id: id('coach:marco'),
        recurring_plan_id: recurringPlanId,
        status:
          index === 0
            ? AppointmentStatus.completed
            : AppointmentStatus.pending_payment,
        recurring_state:
          index === 0
            ? RecurringCoachingSessionState.completed
            : RecurringCoachingSessionState.generated,
        scheduled_at: nowPlusDays(1 + index * 7, 8),
        duration_minutes: 60,
        total_amount: money(500),
        downpayment_amount: money(index === 0 ? 500 : 0),
        balance_amount: money(index === 0 ? 0 : 500),
        gym_revenue: money(index === 0 ? 500 : 0),
        coach_earnings: money(0),
        completed_at: index === 0 ? nowPlusDays(1, 9) : null,
      },
      create: {
        id: id(`coach-appointment:recurring:${index}`),
        user_id: accountId['member-active'],
        coach_id: id('coach:marco'),
        recurring_plan_id: recurringPlanId,
        status:
          index === 0
            ? AppointmentStatus.completed
            : AppointmentStatus.pending_payment,
        recurring_state:
          index === 0
            ? RecurringCoachingSessionState.completed
            : RecurringCoachingSessionState.generated,
        scheduled_at: nowPlusDays(1 + index * 7, 8),
        duration_minutes: 60,
        total_amount: money(500),
        downpayment_amount: money(index === 0 ? 500 : 0),
        balance_amount: money(index === 0 ? 0 : 500),
        gym_revenue: money(index === 0 ? 500 : 0),
        coach_earnings: money(0),
        completed_at: index === 0 ? nowPlusDays(1, 9) : null,
      },
    });
  }

  await prisma.coachReview.upsert({
    where: { appointment_id: coachCompletedId },
    update: {
      rating: 5,
      comment: 'Lia adjusted the plan clearly and made mobility drills easy.',
    },
    create: {
      id: id('coach-review:lia:completed'),
      coach_id: id('coach:lia'),
      reviewer_id: accountId['member-premium'],
      appointment_id: coachCompletedId,
      rating: 5,
      comment: 'Lia adjusted the plan clearly and made mobility drills easy.',
    },
  });

  await prisma.coachClientRelationship.upsert({
    where: { id: id('coach-client:marco:active') },
    update: {
      status: RelationshipStatus.active,
      started_at: nowPlusDays(-8, 9),
      ended_at: null,
      notes: 'Recurring strength block.',
    },
    create: {
      id: id('coach-client:marco:active'),
      coach_id: id('coach:marco'),
      member_id: accountId['member-active'],
      status: RelationshipStatus.active,
      started_at: nowPlusDays(-8, 9),
      notes: 'Recurring strength block.',
    },
  });
}

async function ensureFitnessAndTraining() {
  const exercises = [
    {
      id: id('exercise:squat'),
      name: 'Back Squat',
      muscle_group: 'quads',
      muscle_targets: json(['quads', 'glutes', 'core']),
      movement_profile: json({ pattern: 'squat', plane: 'sagittal' }),
      hand_shape_profile: json({ grip: 'barbell_back_rack' }),
      category: ExerciseCategory.strength,
      description: 'Barbell squat with controlled depth and bracing.',
      instructions: 'Brace, descend to depth, drive through mid-foot.',
      video_url: null,
      image_url: null,
      is_active: true,
    },
    {
      id: id('exercise:pushup'),
      name: 'Push-Up',
      muscle_group: 'chest',
      muscle_targets: json(['chest', 'triceps', 'front_delts']),
      movement_profile: json({ pattern: 'horizontal_push' }),
      hand_shape_profile: json({ grip: 'floor_neutral' }),
      category: ExerciseCategory.strength,
      description: 'Bodyweight horizontal press.',
      instructions: 'Keep plank tension and lower chest toward floor.',
      is_active: true,
    },
  ];

  for (const exercise of exercises) {
    await prisma.exerciseCatalog.upsert({
      where: { id: exercise.id },
      update: exercise,
      create: exercise,
    });
  }

  await prisma.trainingPlan.upsert({
    where: { id: id('training-plan:active') },
    update: {
      user_id: accountId['member-active'],
      coach_id: accountId.staff,
      source: PlanSource.coach_assigned,
      title: 'Four-Week Strength Base',
      goal: FitnessGoal.maintenance,
      duration_weeks: 4,
      days_per_week: 3,
      is_active: true,
      is_template: false,
      ai_generation_prompt: json({
        focus: 'strength base',
        level: 'intermediate',
      }),
    },
    create: {
      id: id('training-plan:active'),
      user_id: accountId['member-active'],
      coach_id: accountId.staff,
      source: PlanSource.coach_assigned,
      title: 'Four-Week Strength Base',
      goal: FitnessGoal.maintenance,
      duration_weeks: 4,
      days_per_week: 3,
      is_active: true,
      ai_generation_prompt: json({
        focus: 'strength base',
        level: 'intermediate',
      }),
    },
  });

  await prisma.trainingScheduleDay.upsert({
    where: { id: id('training-day:week1:day1') },
    update: {
      plan_id: id('training-plan:active'),
      week_number: 1,
      day_of_week: 1,
      focus_label: 'Lower strength',
      notes: 'Main squat day.',
    },
    create: {
      id: id('training-day:week1:day1'),
      plan_id: id('training-plan:active'),
      week_number: 1,
      day_of_week: 1,
      focus_label: 'Lower strength',
      notes: 'Main squat day.',
    },
  });

  await prisma.planExercise.upsert({
    where: { id: id('plan-exercise:squat') },
    update: {
      schedule_day_id: id('training-day:week1:day1'),
      exercise_id: id('exercise:squat'),
      sets: 4,
      reps: 6,
      rest_seconds: 120,
      weight_kg_target: money(60),
      order_index: 1,
      notes: 'Leave two reps in reserve.',
    },
    create: {
      id: id('plan-exercise:squat'),
      schedule_day_id: id('training-day:week1:day1'),
      exercise_id: id('exercise:squat'),
      sets: 4,
      reps: 6,
      rest_seconds: 120,
      weight_kg_target: money(60),
      order_index: 1,
      notes: 'Leave two reps in reserve.',
    },
  });

  await prisma.workoutSession.upsert({
    where: { id: id('workout-session:completed') },
    update: {
      user_id: accountId['member-active'],
      plan_id: id('training-plan:active'),
      status: SessionStatus.completed,
      started_at: nowPlusDays(-2, 18),
      completed_at: nowPlusDays(-2, 19),
      duration_seconds: 3600,
      total_volume_kg: money(1440),
      last_activity_at: nowPlusDays(-2, 19),
    },
    create: {
      id: id('workout-session:completed'),
      user_id: accountId['member-active'],
      plan_id: id('training-plan:active'),
      status: SessionStatus.completed,
      started_at: nowPlusDays(-2, 18),
      completed_at: nowPlusDays(-2, 19),
      duration_seconds: 3600,
      total_volume_kg: money(1440),
      last_activity_at: nowPlusDays(-2, 19),
    },
  });

  await prisma.exerciseLog.upsert({
    where: { id: id('exercise-log:squat:set1') },
    update: {
      session_id: id('workout-session:completed'),
      user_id: accountId['member-active'],
      plan_exercise_id: id('plan-exercise:squat'),
      exercise_id: id('exercise:squat'),
      set_number: 1,
      reps_target: 6,
      reps_completed: 6,
      reps_ai_counted: 6,
      weight_kg: money(60),
    },
    create: {
      id: id('exercise-log:squat:set1'),
      session_id: id('workout-session:completed'),
      user_id: accountId['member-active'],
      plan_exercise_id: id('plan-exercise:squat'),
      exercise_id: id('exercise:squat'),
      set_number: 1,
      reps_target: 6,
      reps_completed: 6,
      reps_ai_counted: 6,
      weight_kg: money(60),
    },
  });

  await prisma.poseExerciseProfile.upsert({
    where: { id: id('pose-profile:squat') },
    update: {
      exercise_id: id('exercise:squat'),
      canonical_name: 'Back Squat',
      profile_kind: PoseProfileKind.seed,
      landmark_signature: json({
        hips: 'descend',
        knees: 'flex',
        ankles: 'stable',
      }),
      angle_signature: json({ knee_min: 75, hip_min: 70 }),
      orientation_signature: json({ camera: 'front_or_3q' }),
      movement_pattern: json({ phases: ['eccentric', 'bottom', 'concentric'] }),
      visibility_pattern: json({ required: ['hip', 'knee', 'ankle'] }),
      dominant_joint: 'knee',
      tolerance: money(8),
      rep_thresholds: json({ bottomAngle: 85, lockoutAngle: 160 }),
      rep_rules: json({ minDepth: 'parallel', lockoutRequired: true }),
      sample_count: 40,
      confidence_threshold: money(0.76),
      is_active: true,
    },
    create: {
      id: id('pose-profile:squat'),
      exercise_id: id('exercise:squat'),
      canonical_name: 'Back Squat',
      profile_kind: PoseProfileKind.seed,
      landmark_signature: json({
        hips: 'descend',
        knees: 'flex',
        ankles: 'stable',
      }),
      angle_signature: json({ knee_min: 75, hip_min: 70 }),
      orientation_signature: json({ camera: 'front_or_3q' }),
      movement_pattern: json({ phases: ['eccentric', 'bottom', 'concentric'] }),
      visibility_pattern: json({ required: ['hip', 'knee', 'ankle'] }),
      dominant_joint: 'knee',
      tolerance: money(8),
      rep_thresholds: json({ bottomAngle: 85, lockoutAngle: 160 }),
      rep_rules: json({ minDepth: 'parallel', lockoutRequired: true }),
      sample_count: 40,
      confidence_threshold: money(0.76),
      is_active: true,
    },
  });

  await prisma.poseSession.upsert({
    where: { id: id('pose-session:squat') },
    update: {
      user_id: accountId['member-active'],
      exercise_log_id: id('exercise-log:squat:set1'),
      exercise_hint: 'Back Squat',
      rep_count_ai: 6,
      confidence_avg: money(0.91),
      detected_exercise_name: 'Back Squat',
      detected_profile_id: id('pose-profile:squat'),
      classification_confidence: money(0.94),
      subject_lock_confidence: money(0.88),
      analysis_summary: json({
        verdict: 'accepted',
        notes: ['consistent depth'],
      }),
      started_at: nowPlusDays(-2, 18),
      ended_at: nowPlusDays(-2, 18, 12),
    },
    create: {
      id: id('pose-session:squat'),
      user_id: accountId['member-active'],
      exercise_log_id: id('exercise-log:squat:set1'),
      exercise_hint: 'Back Squat',
      rep_count_ai: 6,
      confidence_avg: money(0.91),
      detected_exercise_name: 'Back Squat',
      detected_profile_id: id('pose-profile:squat'),
      classification_confidence: money(0.94),
      subject_lock_confidence: money(0.88),
      analysis_summary: json({
        verdict: 'accepted',
        notes: ['consistent depth'],
      }),
      started_at: nowPlusDays(-2, 18),
      ended_at: nowPlusDays(-2, 18, 12),
    },
  });

}

async function ensureGamification() {
  const seasonId = id('season:current');
  await prisma.seasonDefinition.upsert({
    where: { id: seasonId },
    update: {
      title: 'Summer Strength Sprint',
      description: 'Four-week seeded leaderboard season.',
      status: SeasonStatus.active,
      starts_at: nowPlusDays(-14),
      ends_at: nowPlusDays(16),
    },
    create: {
      id: seasonId,
      title: 'Summer Strength Sprint',
      description: 'Four-week seeded leaderboard season.',
      status: SeasonStatus.active,
      starts_at: nowPlusDays(-14),
      ends_at: nowPlusDays(16),
    },
  });

  await prisma.milestoneDefinition.upsert({
    where: { key: 'realistic_first_workout' },
    update: {
      title: 'First Workout Logged',
      description: 'Complete one workout session.',
      category: MilestoneCategory.training,
      trigger_type: MilestoneTriggerType.source_event,
      condition_payload: json({
        sourceType: 'workout_session_completed',
        count: 1,
      }),
      reward_payload: json({ xp: 100 }),
      is_active: true,
    },
    create: {
      id: id('milestone:first-workout'),
      key: 'realistic_first_workout',
      title: 'First Workout Logged',
      description: 'Complete one workout session.',
      category: MilestoneCategory.training,
      trigger_type: MilestoneTriggerType.source_event,
      condition_payload: json({
        sourceType: 'workout_session_completed',
        count: 1,
      }),
      reward_payload: json({ xp: 100 }),
      is_active: true,
    },
  });

  await prisma.progressionSourceEvent.upsert({
    where: {
      source_type_source_id: {
        source_type: ProgressionSourceType.workout_session_completed,
        source_id: id('workout-session:completed'),
      },
    },
    update: {
      user_id: accountId['member-active'],
      source_status: ProgressionSourceStatus.applied,
      source_context: json({
        workoutSessionId: id('workout-session:completed'),
      }),
      processed_at: nowPlusDays(-2, 19),
    },
    create: {
      id: id('progression-source:workout-completed'),
      user_id: accountId['member-active'],
      source_type: ProgressionSourceType.workout_session_completed,
      source_id: id('workout-session:completed'),
      source_status: ProgressionSourceStatus.applied,
      source_context: json({
        workoutSessionId: id('workout-session:completed'),
      }),
      processed_at: nowPlusDays(-2, 19),
    },
  });

  await prisma.progressionGrantLedger.upsert({
    where: { id: id('progression-grant:workout-xp') },
    update: {
      user_id: accountId['member-active'],
      source_event_id: id('progression-source:workout-completed'),
      season_id: seasonId,
      grant_type: ProgressionGrantType.xp,
      grant_status: ProgressionGrantStatus.applied,
      amount: 120,
      muscle_group: 'quads',
      reason: 'Completed seeded lower strength workout.',
      metadata: json({ workoutSessionId: id('workout-session:completed') }),
      voided_at: null,
    },
    create: {
      id: id('progression-grant:workout-xp'),
      user_id: accountId['member-active'],
      source_event_id: id('progression-source:workout-completed'),
      season_id: seasonId,
      grant_type: ProgressionGrantType.xp,
      grant_status: ProgressionGrantStatus.applied,
      amount: 120,
      muscle_group: 'quads',
      reason: 'Completed seeded lower strength workout.',
      metadata: json({ workoutSessionId: id('workout-session:completed') }),
    },
  });

  await prisma.userProgressionProfile.upsert({
    where: { user_id: accountId['member-active'] },
    update: {
      active_season_id: seasonId,
      total_xp: 1220,
      current_streak: 4,
      longest_streak: 9,
      current_season_points: 420,
      last_progressed_at: nowPlusDays(-2, 19),
    },
    create: {
      id: id('progression-profile:active-member'),
      user_id: accountId['member-active'],
      active_season_id: seasonId,
      total_xp: 1220,
      current_streak: 4,
      longest_streak: 9,
      current_season_points: 420,
      last_progressed_at: nowPlusDays(-2, 19),
    },
  });

  await prisma.seasonalStanding.upsert({
    where: {
      season_id_user_id: {
        season_id: seasonId,
        user_id: accountId['member-active'],
      },
    },
    update: {
      season_points: 420,
      rank_position: 2,
      is_hidden: false,
      is_disqualified: false,
      last_earned_at: nowPlusDays(-2, 19),
    },
    create: {
      id: id('seasonal-standing:active-member'),
      season_id: seasonId,
      user_id: accountId['member-active'],
      season_points: 420,
      rank_position: 2,
      last_earned_at: nowPlusDays(-2, 19),
    },
  });

  await prisma.userMilestoneProgress.upsert({
    where: {
      user_id_milestone_definition_id: {
        user_id: accountId['member-active'],
        milestone_definition_id: id('milestone:first-workout'),
      },
    },
    update: {
      status: MilestoneProgressStatus.claimed,
      progress_value: 1,
      unlocked_at: nowPlusDays(-2, 19),
      claimed_at: nowPlusDays(-2, 20),
    },
    create: {
      id: id('milestone-progress:active:first-workout'),
      user_id: accountId['member-active'],
      milestone_definition_id: id('milestone:first-workout'),
      status: MilestoneProgressStatus.claimed,
      progress_value: 1,
      unlocked_at: nowPlusDays(-2, 19),
      claimed_at: nowPlusDays(-2, 20),
    },
  });

  await prisma.muscleMasteryProgress.upsert({
    where: {
      user_id_muscle_group: {
        user_id: accountId['member-active'],
        muscle_group: 'quads',
      },
    },
    update: {
      total_volume_kg: money(1440),
      xp_points: 760,
      rank: MasteryRank.silver,
      last_ranked_at: nowPlusDays(-2, 20),
    },
    create: {
      id: id('muscle-mastery:active:quads'),
      user_id: accountId['member-active'],
      muscle_group: 'quads',
      total_volume_kg: money(1440),
      xp_points: 760,
      rank: MasteryRank.silver,
      last_ranked_at: nowPlusDays(-2, 20),
    },
  });

  await prisma.rankingProfile.upsert({
    where: { user_id: accountId['member-active'] },
    update: {
      visibility: RankingVisibility.public,
      governance_status: RankingGovernanceStatus.normal,
      display_alias: 'Kara L.',
      admin_note: null,
    },
    create: {
      id: id('ranking-profile:active'),
      user_id: accountId['member-active'],
      visibility: RankingVisibility.public,
      governance_status: RankingGovernanceStatus.normal,
      display_alias: 'Kara L.',
    },
  });

  await prisma.integrityProfile.upsert({
    where: { user_id: accountId['member-active'] },
    update: {
      risk_level: IntegrityRiskLevel.low,
      open_case_count: 0,
      last_flagged_at: null,
      last_resolved_at: nowPlusDays(-5),
    },
    create: {
      id: id('integrity-profile:active'),
      user_id: accountId['member-active'],
      risk_level: IntegrityRiskLevel.low,
      open_case_count: 0,
      last_resolved_at: nowPlusDays(-5),
    },
  });

  await prisma.integrityCase.upsert({
    where: { id: id('integrity-case:resolved') },
    update: {
      user_id: accountId['member-premium'],
      status: IntegrityCaseStatus.resolved_invalid,
      summary: 'False positive rep-count spike from duplicate sync.',
      opened_at: nowPlusDays(-7),
      resolved_at: nowPlusDays(-6),
    },
    create: {
      id: id('integrity-case:resolved'),
      user_id: accountId['member-premium'],
      status: IntegrityCaseStatus.resolved_invalid,
      summary: 'False positive rep-count spike from duplicate sync.',
      opened_at: nowPlusDays(-7),
      resolved_at: nowPlusDays(-6),
    },
  });

  await prisma.integrityEvent.upsert({
    where: { id: id('integrity-event:resolved') },
    update: {
      user_id: accountId['member-premium'],
      integrity_case_id: id('integrity-case:resolved'),
      event_type: 'duplicate_sync',
      reason_code: 'pose_session_replay',
      risk_level: IntegrityRiskLevel.medium,
      details: json({ duplicatePoseSessionIds: ['local-cache-replay'] }),
      is_resolved: true,
    },
    create: {
      id: id('integrity-event:resolved'),
      user_id: accountId['member-premium'],
      integrity_case_id: id('integrity-case:resolved'),
      event_type: 'duplicate_sync',
      reason_code: 'pose_session_replay',
      risk_level: IntegrityRiskLevel.medium,
      details: json({ duplicatePoseSessionIds: ['local-cache-replay'] }),
      is_resolved: true,
    },
  });

  await prisma.moderationActionRecord.upsert({
    where: { id: id('moderation-action:resolve-integrity') },
    update: {
      actor_user_id: accountId.admin,
      target_user_id: accountId['member-premium'],
      integrity_case_id: id('integrity-case:resolved'),
      action_type: ModerationActionType.resolve_integrity_case_invalid,
      rationale: 'Duplicate mobile sync confirmed; no member penalty.',
      before_state: json({ status: 'under_review' }),
      after_state: json({ status: 'resolved_invalid' }),
    },
    create: {
      id: id('moderation-action:resolve-integrity'),
      actor_user_id: accountId.admin,
      target_user_id: accountId['member-premium'],
      integrity_case_id: id('integrity-case:resolved'),
      action_type: ModerationActionType.resolve_integrity_case_invalid,
      rationale: 'Duplicate mobile sync confirmed; no member penalty.',
      before_state: json({ status: 'under_review' }),
      after_state: json({ status: 'resolved_invalid' }),
    },
  });
}

async function ensureNutrition() {
  await prisma.tdeeProfile.upsert({
    where: { id: id('tdee:active') },
    update: {
      user_id: accountId['member-active'],
      weight_kg: money(67.5),
      height_cm: money(170),
      age: 27,
      gender: Gender.other,
      activity_level: ActivityLevel.active,
      fitness_goal: FitnessGoal.maintenance,
      bmr_calories: money(1505),
      tdee_calories: money(2320),
      is_active: true,
      calculated_at: nowPlusDays(-5),
    },
    create: {
      id: id('tdee:active'),
      user_id: accountId['member-active'],
      weight_kg: money(67.5),
      height_cm: money(170),
      age: 27,
      gender: Gender.other,
      activity_level: ActivityLevel.active,
      fitness_goal: FitnessGoal.maintenance,
      bmr_calories: money(1505),
      tdee_calories: money(2320),
      is_active: true,
      calculated_at: nowPlusDays(-5),
    },
  });

  await prisma.macroTarget.upsert({
    where: { id: id('macro-target:active') },
    update: {
      user_id: accountId['member-active'],
      tdee_profile_id: id('tdee:active'),
      target_calories: money(2320),
      protein_g: money(145),
      carbs_g: money(265),
      fat_g: money(75),
      is_active: true,
    },
    create: {
      id: id('macro-target:active'),
      user_id: accountId['member-active'],
      tdee_profile_id: id('tdee:active'),
      target_calories: money(2320),
      protein_g: money(145),
      carbs_g: money(265),
      fat_g: money(75),
      is_active: true,
    },
  });

  const logs = [
    ['breakfast', 'Greek yogurt bowl', 430, 32, 48, 10, NutritionUnit.serving],
    ['lunch', 'Chicken rice meal', 720, 52, 88, 16, NutritionUnit.serving],
    ['snack', 'Banana', 105, 1, 27, 0, NutritionUnit.piece],
  ] as const;

  for (const [meal, food, calories, protein, carbs, fat, unit] of logs) {
    await prisma.nutritionLog.upsert({
      where: { id: id(`nutrition:${meal}`) },
      update: {
        user_id: accountId['member-active'],
        macro_target_id: id('macro-target:active'),
        log_date: dateOnly(0),
        meal_name: meal,
        food_item: food,
        calories: money(calories),
        protein_g: money(protein),
        carbs_g: money(carbs),
        fat_g: money(fat),
        quantity: money(1),
        unit,
      },
      create: {
        id: id(`nutrition:${meal}`),
        user_id: accountId['member-active'],
        macro_target_id: id('macro-target:active'),
        log_date: dateOnly(0),
        meal_name: meal,
        food_item: food,
        calories: money(calories),
        protein_g: money(protein),
        carbs_g: money(carbs),
        fat_g: money(fat),
        quantity: money(1),
        unit,
      },
    });
  }
}

async function ensureInventoryAndSales() {
  const products = [
    {
      id: id('product:whey'),
      name: 'Whey Protein Sachet',
      category: 'supplements',
      description: 'Single-serve whey protein sachet.',
      price: money(95),
      cost: money(52),
      stock_quantity: 44,
      reorder_threshold: 12,
      image_url: null,
      is_active: true,
    },
    {
      id: id('product:water'),
      name: 'Electrolyte Water',
      category: 'drinks',
      description: 'Cold electrolyte hydration bottle.',
      price: money(65),
      cost: money(31),
      stock_quantity: 8,
      reorder_threshold: 10,
      last_low_stock_alert_at: nowPlusDays(-1, 7),
      image_url: null,
      is_active: true,
    },
  ];

  for (const product of products) {
    await prisma.retailProduct.upsert({
      where: { id: product.id },
      update: product,
      create: product,
    });
  }

  await prisma.saleTransaction.upsert({
    where: { id: id('sale:manual:completed') },
    update: {
      customer_name: 'Kara Lim',
      customer_user_id: accountId['member-active'],
      notes: 'Post-workout purchase at front desk.',
      source: SaleSource.manual,
      total_amount: money(255),
      payment_method: SalePaymentMethod.cash,
      processed_by: accountId.staff,
      status: SaleStatus.completed,
      created_at: nowPlusDays(-1, 20),
    },
    create: {
      id: id('sale:manual:completed'),
      customer_name: 'Kara Lim',
      customer_user_id: accountId['member-active'],
      notes: 'Post-workout purchase at front desk.',
      source: SaleSource.manual,
      total_amount: money(255),
      payment_method: SalePaymentMethod.cash,
      processed_by: accountId.staff,
      status: SaleStatus.completed,
      created_at: nowPlusDays(-1, 20),
    },
  });

  await prisma.saleTransactionItem.upsert({
    where: { id: id('sale-item:whey') },
    update: {
      transaction_id: id('sale:manual:completed'),
      product_id: id('product:whey'),
      quantity: 2,
      unit_price: money(95),
      subtotal: money(190),
    },
    create: {
      id: id('sale-item:whey'),
      transaction_id: id('sale:manual:completed'),
      product_id: id('product:whey'),
      quantity: 2,
      unit_price: money(95),
      subtotal: money(190),
    },
  });

  await prisma.saleTransactionItem.upsert({
    where: { id: id('sale-item:water') },
    update: {
      transaction_id: id('sale:manual:completed'),
      product_id: id('product:water'),
      quantity: 1,
      unit_price: money(65),
      subtotal: money(65),
    },
    create: {
      id: id('sale-item:water'),
      transaction_id: id('sale:manual:completed'),
      product_id: id('product:water'),
      quantity: 1,
      unit_price: money(65),
      subtotal: money(65),
    },
  });

  await prisma.gymEquipmentItem.upsert({
    where: { id: id('equipment-item:adjustable-bench') },
    update: {
      name: 'Adjustable Bench',
      description: 'Commercial adjustable bench for free-weight area.',
      image_url: null,
      quantity_total: 4,
      quantity_current: 3,
      unit: 'benches',
      is_active: true,
    },
    create: {
      id: id('equipment-item:adjustable-bench'),
      name: 'Adjustable Bench',
      description: 'Commercial adjustable bench for free-weight area.',
      image_url: null,
      quantity_total: 4,
      quantity_current: 3,
      unit: 'benches',
      is_active: true,
    },
  });

  await prisma.equipmentWriteOff.upsert({
    where: { id: id('equipment-writeoff:bench') },
    update: {
      equipment_id: id('equipment-item:adjustable-bench'),
      quantity_before: 4,
      quantity_set_to: 3,
      quantity_lost: 1,
      reason: 'Seat pad torn; sent for replacement.',
      performed_by: accountId.staff,
    },
    create: {
      id: id('equipment-writeoff:bench'),
      equipment_id: id('equipment-item:adjustable-bench'),
      quantity_before: 4,
      quantity_set_to: 3,
      quantity_lost: 1,
      reason: 'Seat pad torn; sent for replacement.',
      performed_by: accountId.staff,
    },
  });

  await prisma.gymEquipment.upsert({
    where: { id: id('floor-equipment:bench-1') },
    update: {
      name: 'Adjustable Bench A',
      type: 'bench',
      floor_id: 'floor-1',
      grid_column: 5,
      grid_row: 6,
      position_x: money(38.5),
      position_y: money(62),
      status: EquipmentStatus.available,
      icon_key: 'bench',
      is_active: true,
    },
    create: {
      id: id('floor-equipment:bench-1'),
      name: 'Adjustable Bench A',
      type: 'bench',
      floor_id: 'floor-1',
      grid_column: 5,
      grid_row: 6,
      position_x: money(38.5),
      position_y: money(62),
      status: EquipmentStatus.available,
      icon_key: 'bench',
      is_active: true,
    },
  });
}

async function ensureAiNotificationsAndGymContent() {
  await prisma.aiChatSession.upsert({
    where: { id: id('ai-chat-session:active') },
    update: {
      user_id: accountId['member-active'],
      context_type: ChatContext.training_plan,
      title: 'Squat progression help',
      is_active: true,
      last_activity_at: nowPlusDays(-1, 21),
    },
    create: {
      id: id('ai-chat-session:active'),
      user_id: accountId['member-active'],
      context_type: ChatContext.training_plan,
      title: 'Squat progression help',
      is_active: true,
      last_activity_at: nowPlusDays(-1, 21),
    },
  });

  const aiMessages = [
    [ChatRole.user, 'Can I add weight next week?'],
    [
      ChatRole.assistant,
      'Yes, if bar speed stays stable and depth remains consistent.',
    ],
  ] as const;

  for (const [index, [role, content]] of aiMessages.entries()) {
    await prisma.aiChatMessage.upsert({
      where: { id: id(`ai-chat-message:${index}`) },
      update: {
        session_id: id('ai-chat-session:active'),
        role,
        content,
        action_triggered: role === ChatRole.assistant ? 'training_tip' : null,
      },
      create: {
        id: id(`ai-chat-message:${index}`),
        session_id: id('ai-chat-session:active'),
        role,
        content,
        action_triggered: role === ChatRole.assistant ? 'training_tip' : null,
      },
    });
  }

  await prisma.aiInteractionLog.upsert({
    where: { id: id('ai-interaction:training-tip') },
    update: {
      user_id: accountId['member-active'],
      session_id: id('ai-chat-session:active'),
      interaction_type: InteractionType.chat,
      request_payload: json({ message: 'Can I add weight next week?' }),
      response_payload: json({
        answer: 'Progress if technique stays consistent.',
      }),
      action_triggered: 'training_tip',
      action_result: json({ safeProgression: true }),
      latency_ms: 820,
      model_used: 'fittrack-local-chat',
      token_count: 184,
      error: null,
    },
    create: {
      id: id('ai-interaction:training-tip'),
      user_id: accountId['member-active'],
      session_id: id('ai-chat-session:active'),
      interaction_type: InteractionType.chat,
      request_payload: json({ message: 'Can I add weight next week?' }),
      response_payload: json({
        answer: 'Progress if technique stays consistent.',
      }),
      action_triggered: 'training_tip',
      action_result: json({ safeProgression: true }),
      latency_ms: 820,
      model_used: 'fittrack-local-chat',
      token_count: 184,
    },
  });

  await prisma.gymChatSession.upsert({
    where: { id: id('gym-chat-session:active') },
    update: {
      user_id: accountId['member-active'],
      title: 'Gym hours and rules',
      is_active: true,
      last_activity_at: nowPlusDays(-1, 12),
    },
    create: {
      id: id('gym-chat-session:active'),
      user_id: accountId['member-active'],
      title: 'Gym hours and rules',
      is_active: true,
      last_activity_at: nowPlusDays(-1, 12),
    },
  });

  await prisma.gymChatMessage.upsert({
    where: { id: id('gym-chat-message:hours') },
    update: {
      session_id: id('gym-chat-session:active'),
      role: GymChatRole.assistant,
      content: 'The gym is open 6:00 AM to 10:00 PM on weekdays.',
      grounded_sources: json([{ type: 'operating_hours', day: 'weekday' }]),
      out_of_scope: false,
    },
    create: {
      id: id('gym-chat-message:hours'),
      session_id: id('gym-chat-session:active'),
      role: GymChatRole.assistant,
      content: 'The gym is open 6:00 AM to 10:00 PM on weekdays.',
      grounded_sources: json([{ type: 'operating_hours', day: 'weekday' }]),
      out_of_scope: false,
    },
  });

  await prisma.gymChatInteractionLog.upsert({
    where: { id: id('gym-chat-interaction:hours') },
    update: {
      user_id: accountId['member-active'],
      session_id: id('gym-chat-session:active'),
      request_payload: json({ message: 'What time do you open?' }),
      grounding_payload: json({ matched: ['gym_operating_hours'] }),
      response_payload: json({ answer: 'Weekdays open at 6:00 AM.' }),
      latency_ms: 430,
      model_used: 'fittrack-grounded-chat',
      token_count: 96,
      out_of_scope: false,
      error: null,
    },
    create: {
      id: id('gym-chat-interaction:hours'),
      user_id: accountId['member-active'],
      session_id: id('gym-chat-session:active'),
      request_payload: json({ message: 'What time do you open?' }),
      grounding_payload: json({ matched: ['gym_operating_hours'] }),
      response_payload: json({ answer: 'Weekdays open at 6:00 AM.' }),
      latency_ms: 430,
      model_used: 'fittrack-grounded-chat',
      token_count: 96,
      out_of_scope: false,
    },
  });

  const notifications = [
    {
      id: id('notification:payment-confirmed'),
      user_id: accountId['member-active'],
      type: NotificationType.payment_confirmed,
      title: 'Payment approved',
      body: 'Your membership-card payment has been approved.',
      data: json({ paymentId: id('payment:membership-card:active') }),
      status: NotificationStatus.sent,
      sent_at: nowPlusDays(-28, 10),
      read_at: nowPlusDays(-27, 7),
    },
    {
      id: id('notification:low-stock'),
      user_id: accountId.admin,
      type: NotificationType.low_stock,
      title: 'Low stock: Electrolyte Water',
      body: 'Electrolyte Water is below reorder threshold.',
      data: json({ productId: id('product:water') }),
      status: NotificationStatus.pending,
      sent_at: null,
      read_at: null,
    },
  ];

  for (const notification of notifications) {
    await prisma.notification.upsert({
      where: { id: notification.id },
      update: {
        ...notification,
        channel: NotificationChannel.in_app,
      },
      create: {
        ...notification,
        channel: NotificationChannel.in_app,
      },
    });
  }

  for (let day = 0; day < 7; day += 1) {
    await prisma.gymOperatingHour.upsert({
      where: { day_of_week: day },
      update: {
        opens_at: day === 0 ? fixedTime('08:00:00') : fixedTime('06:00:00'),
        closes_at: day === 0 ? fixedTime('18:00:00') : fixedTime('22:00:00'),
        is_closed: false,
        label: day === 0 ? 'Sunday reduced hours' : 'Standard operating day',
        is_active: true,
      },
      create: {
        id: id(`operating-hour:${day}`),
        day_of_week: day,
        opens_at: day === 0 ? fixedTime('08:00:00') : fixedTime('06:00:00'),
        closes_at: day === 0 ? fixedTime('18:00:00') : fixedTime('22:00:00'),
        is_closed: false,
        label: day === 0 ? 'Sunday reduced hours' : 'Standard operating day',
        is_active: true,
      },
    });
  }

  await prisma.gymSpecialSchedule.upsert({
    where: { id: id('special-schedule:maintenance') },
    update: {
      starts_on: dateOnly(10),
      ends_on: dateOnly(10),
      opens_at: fixedTime('10:00:00'),
      closes_at: fixedTime('18:00:00'),
      is_closed: false,
      reason: 'Quarterly equipment maintenance.',
      pricing_note: 'No venue bookings before 10:00 AM.',
      is_active: true,
    },
    create: {
      id: id('special-schedule:maintenance'),
      starts_on: dateOnly(10),
      ends_on: dateOnly(10),
      opens_at: fixedTime('10:00:00'),
      closes_at: fixedTime('18:00:00'),
      is_closed: false,
      reason: 'Quarterly equipment maintenance.',
      pricing_note: 'No venue bookings before 10:00 AM.',
      is_active: true,
    },
  });

  await prisma.gymFaqEntry.upsert({
    where: { id: id('faq:bookings') },
    update: {
      category: GymFaqCategory.amenities,
      question: 'Can members reserve venues from mobile?',
      answer: 'Yes. Reservable venues appear in the mobile Bookings screen.',
      keywords: json(['booking', 'venue', 'mobile']),
      sort_order: 1,
      is_active: true,
    },
    create: {
      id: id('faq:bookings'),
      category: GymFaqCategory.amenities,
      question: 'Can members reserve venues from mobile?',
      answer: 'Yes. Reservable venues appear in the mobile Bookings screen.',
      keywords: json(['booking', 'venue', 'mobile']),
      sort_order: 1,
      is_active: true,
    },
  });
}

async function ensureAttendanceAuditAndAnalytics() {
  await prisma.attendanceLog.upsert({
    where: { id: id('attendance:active:today') },
    update: {
      user_id: accountId['member-active'],
      scanned_by: accountId.staff,
      check_in_at: nowPlusDays(0, 7, 45),
      check_out_at: nowPlusDays(0, 9, 30),
    },
    create: {
      id: id('attendance:active:today'),
      user_id: accountId['member-active'],
      scanned_by: accountId.staff,
      check_in_at: nowPlusDays(0, 7, 45),
      check_out_at: nowPlusDays(0, 9, 30),
    },
  });

  await prisma.auditLog.upsert({
    where: { id: id('audit:payment-approved') },
    update: {
      user_id: accountId.staff,
      action: 'PAYMENT_VERIFIED',
      entity: 'Payment',
      entity_id: id('payment:membership-card:active'),
      before: json({ status: 'awaiting_verification' }),
      after: json({ status: 'completed' }),
      ip_address: '127.0.0.1',
    },
    create: {
      id: id('audit:payment-approved'),
      user_id: accountId.staff,
      action: 'PAYMENT_VERIFIED',
      entity: 'Payment',
      entity_id: id('payment:membership-card:active'),
      before: json({ status: 'awaiting_verification' }),
      after: json({ status: 'completed' }),
      ip_address: '127.0.0.1',
    },
  });

  await prisma.businessInsightRun.upsert({
    where: { id: id('business-insight:overview') },
    update: {
      requested_by: accountId.admin,
      focus: InsightFocus.overview,
      period: InsightPeriod.monthly,
      start_date: dateOnly(-30),
      end_date: dateOnly(0),
      request_payload: json({
        sections: ['revenue', 'attendance', 'inventory', 'coaching'],
      }),
      insight_payload: json({
        summary:
          'Revenue is diversified across membership, bookings, coaching, and retail sales.',
        highlights: [
          'Membership, venue bookings, coaching, and retail all contributed revenue in the seeded window.',
          'Attendance, inventory, and payment records are present for cross-module analytics checks.',
        ],
        risks: [
          'Electrolyte water is below reorder threshold.',
          'The studio booking still has a pending balance.',
        ],
        opportunities: [
          'Bundle coaching and venue reservations during peak attendance hours.',
          'Use the low-stock lane to prioritize front-desk restocking.',
        ],
        anomaly_flags: [],
        grounded_metrics: {
          membership: 1199,
          venueBookings: 1300,
          coaching: 920,
          retail: 255,
          attendanceToday: 1,
        },
        recommended_actions: [
          'Restock electrolyte water.',
          'Follow up on the pending studio balance.',
        ],
      }),
      model_used: 'fittrack-business-insights',
      token_count: 510,
      latency_ms: 1120,
    },
    create: {
      id: id('business-insight:overview'),
      requested_by: accountId.admin,
      focus: InsightFocus.overview,
      period: InsightPeriod.monthly,
      start_date: dateOnly(-30),
      end_date: dateOnly(0),
      request_payload: json({
        sections: ['revenue', 'attendance', 'inventory', 'coaching'],
      }),
      insight_payload: json({
        summary:
          'Revenue is diversified across membership, bookings, coaching, and retail sales.',
        highlights: [
          'Membership, venue bookings, coaching, and retail all contributed revenue in the seeded window.',
          'Attendance, inventory, and payment records are present for cross-module analytics checks.',
        ],
        risks: [
          'Electrolyte water is below reorder threshold.',
          'The studio booking still has a pending balance.',
        ],
        opportunities: [
          'Bundle coaching and venue reservations during peak attendance hours.',
          'Use the low-stock lane to prioritize front-desk restocking.',
        ],
        anomaly_flags: [],
        grounded_metrics: {
          membership: 1199,
          venueBookings: 1300,
          coaching: 920,
          retail: 255,
          attendanceToday: 1,
        },
        recommended_actions: [
          'Restock electrolyte water.',
          'Follow up on the pending studio balance.',
        ],
      }),
      model_used: 'fittrack-business-insights',
      token_count: 510,
      latency_ms: 1120,
    },
  });
}

async function ensureBulkOperationalData() {
  const activeBulkMembers = memberAccountsByTier('active_member').filter(
    (account) => account.key.startsWith('member-active-bulk'),
  );
  const verifiedNonMembers = memberAccountsByTier('verified_non_member').filter(
    (account) => account.key.startsWith('member-verified-non-member-bulk'),
  );
  const pendingVerificationMembers = memberAccountsByTier(
    'pending_verification',
  ).filter((account) =>
    account.key.startsWith('member-pending-verification-bulk'),
  );
  const pendingMembershipMembers = memberAccountsByTier(
    'pending_membership',
  ).filter((account) =>
    account.key.startsWith('member-pending-membership-bulk'),
  );
  const revokedMembers = memberAccountsByTier('revoked').filter((account) =>
    account.key.startsWith('member-revoked-bulk'),
  );
  const archivedMembers = memberAccountsByTier('archived').filter((account) =>
    account.key.startsWith('member-archived-bulk'),
  );
  const coachIds = coachAccountKeys.map(coachProfileIdForAccount);
  const activeOperationalMembers = [
    ACCOUNTS.find((account) => account.key === 'member-active'),
    ACCOUNTS.find((account) => account.key === 'member-premium'),
    ...activeBulkMembers.slice(0, 118),
  ].filter((account): account is RealisticAccount => Boolean(account));
  const activeGamificationMembers = activeBulkMembers.slice(0, 60);

  for (const [index, account] of activeBulkMembers.entries()) {
    const purchasedAt = nowPlusDays(-(10 + (index % 32)), 9 + (index % 4));
    const cardId = id(`membership-card:${account.key}`);
    const subscriptionId = id(`subscription:${account.key}`);
    const membershipPaymentId = id(`payment:membership-card:${account.key}`);
    const subscriptionPaymentId = id(`payment:subscription:${account.key}`);
    const durationDays = index % 5 === 0 ? 90 : 30;
    const subscriptionPlanKey = durationDays === 90 ? 'three-month' : 'monthly';
    const subscriptionPlanName =
      durationDays === 90 ? '3-Month Membership' : 'Monthly Membership';
    const subscriptionPlanDescription =
      durationDays === 90
        ? 'Ninety consecutive days of gym access with attendance tracking. Coaching services are purchased separately.'
        : 'Thirty consecutive days of gym access with attendance tracking. Coaching services are purchased separately.';
    const subscriptionPlanPrice = durationDays === 90 ? 3499 : 1499;
    const startsAt = new Date(purchasedAt);
    const expiresAt = new Date(startsAt);
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    await prisma.membershipCard.upsert({
      where: { user_id: accountId[account.key] },
      update: {
        status: MembershipCardStatus.active,
        source:
          index % 3 === 0
            ? MembershipCardSource.cash
            : MembershipCardSource.paymongo,
        price: money(400),
        purchased_at: purchasedAt,
        verified_at: purchasedAt,
        verified_by: index % 2 === 0 ? accountId.staff : accountId.admin,
        activated_at: purchasedAt,
        revoked_at: null,
        revoked_by: null,
        revoke_reason: null,
      },
      create: {
        id: cardId,
        user_id: accountId[account.key],
        status: MembershipCardStatus.active,
        source:
          index % 3 === 0
            ? MembershipCardSource.cash
            : MembershipCardSource.paymongo,
        price: money(400),
        purchased_at: purchasedAt,
        verified_at: purchasedAt,
        verified_by: index % 2 === 0 ? accountId.staff : accountId.admin,
        activated_at: purchasedAt,
      },
    });

    await ensurePayment({
      id: membershipPaymentId,
      user_id: accountId[account.key],
      payable_type: PayableType.membership_card,
      payable_id: cardId,
      payment_stage: PaymentStage.full,
      amount: money(400),
      provider:
        index % 3 === 0 ? PaymentProvider.cash : PaymentProvider.paymongo,
      status: PaymentStatus.completed,
      provider_ref: `membership-card-${account.key}`,
      verified_by: index % 2 === 0 ? accountId.staff : accountId.admin,
      verified_at: purchasedAt,
      gateway_metadata:
        index % 3 === 0
          ? json({ source: 'front_desk_cash' })
          : json({ checkout: 'test_mode', source: 'member_portal' }),
    });

    await ensurePayment({
      id: subscriptionPaymentId,
      user_id: accountId[account.key],
      payable_type: PayableType.subscription,
      payable_id: subscriptionId,
      payment_stage: PaymentStage.full,
      amount: money(subscriptionPlanPrice),
      provider:
        index % 4 === 0 ? PaymentProvider.cash : PaymentProvider.paymongo,
      status: PaymentStatus.completed,
      provider_ref: `subscription-${account.key}`,
      verified_by: index % 2 === 0 ? accountId.staff : accountId.admin,
      verified_at: new Date(purchasedAt.getTime() + 60 * 60 * 1000),
      gateway_metadata:
        index % 4 === 0
          ? json({ source: 'front_desk_cash' })
          : json({ checkout: 'test_mode', source: 'web_memberships' }),
    });

    await prisma.subscription.upsert({
      where: { id: subscriptionId },
      update: {
        user_id: accountId[account.key],
        plan_id: id(`membership-plan:${subscriptionPlanKey}`),
        payment_id: subscriptionPaymentId,
        status: SubscriptionStatus.active,
        starts_at: startsAt,
        expires_at: expiresAt,
        plan_name_snapshot: subscriptionPlanName,
        plan_description_snapshot: subscriptionPlanDescription,
        plan_price_snapshot: money(subscriptionPlanPrice),
        plan_currency_snapshot: 'PHP',
        duration_days_snapshot: durationDays,
        warned_7d_at: null,
        warned_3d_at: null,
        warned_1d_at: null,
        cancelled_at: null,
      },
      create: {
        id: subscriptionId,
        user_id: accountId[account.key],
        plan_id: id(`membership-plan:${subscriptionPlanKey}`),
        payment_id: subscriptionPaymentId,
        status: SubscriptionStatus.active,
        starts_at: startsAt,
        expires_at: expiresAt,
        plan_name_snapshot: subscriptionPlanName,
        plan_description_snapshot: subscriptionPlanDescription,
        plan_price_snapshot: money(subscriptionPlanPrice),
        plan_currency_snapshot: 'PHP',
        duration_days_snapshot: durationDays,
      },
    });
  }

  for (const [index, account] of pendingMembershipMembers.entries()) {
    const purchasedAt = nowPlusDays(-(1 + (index % 5)), 11);
    const cardId = id(`membership-card:${account.key}`);
    await prisma.membershipCard.upsert({
      where: { user_id: accountId[account.key] },
      update: {
        status: MembershipCardStatus.pending_verification,
        source:
          index % 2 === 0
            ? MembershipCardSource.cash
            : MembershipCardSource.paymongo,
        price: money(400),
        purchased_at: purchasedAt,
        verified_at: null,
        verified_by: null,
        activated_at: null,
        revoked_at: null,
        revoked_by: null,
        revoke_reason: null,
      },
      create: {
        id: cardId,
        user_id: accountId[account.key],
        status: MembershipCardStatus.pending_verification,
        source:
          index % 2 === 0
            ? MembershipCardSource.cash
            : MembershipCardSource.paymongo,
        price: money(400),
        purchased_at: purchasedAt,
      },
    });

    await ensurePayment({
      id: id(`payment:membership-card:${account.key}`),
      user_id: accountId[account.key],
      payable_type: PayableType.membership_card,
      payable_id: cardId,
      payment_stage: PaymentStage.full,
      amount: money(400),
      provider:
        index % 2 === 0 ? PaymentProvider.cash : PaymentProvider.paymongo,
      status:
        index % 2 === 0
          ? PaymentStatus.awaiting_verification
          : PaymentStatus.processing,
      screenshot_url:
        index % 2 === 0
            ? null
          : null,
    });
  }

  for (const [index, account] of [
    ...revokedMembers,
    ...archivedMembers,
  ].entries()) {
    const purchasedAt = nowPlusDays(-(50 + (index % 18)), 10);
    const revokedAt = nowPlusDays(-(7 + (index % 15)), 18);
    const cardId = id(`membership-card:${account.key}`);
    const subscriptionId = id(`subscription:${account.key}`);

    await prisma.membershipCard.upsert({
      where: { user_id: accountId[account.key] },
      update: {
        status: MembershipCardStatus.revoked,
        source: MembershipCardSource.paymongo,
        price: money(400),
        purchased_at: purchasedAt,
        verified_at: purchasedAt,
        verified_by: accountId.staff,
        activated_at: purchasedAt,
        revoked_at: revokedAt,
        revoked_by: accountId.staff,
        revoke_reason:
          account.memberTier === 'archived'
            ? 'Account archived after membership pause request.'
            : 'Membership access revoked after repeated unpaid renewals.',
      },
      create: {
        id: cardId,
        user_id: accountId[account.key],
        status: MembershipCardStatus.revoked,
        source: MembershipCardSource.paymongo,
        price: money(400),
        purchased_at: purchasedAt,
        verified_at: purchasedAt,
        verified_by: accountId.staff,
        activated_at: purchasedAt,
        revoked_at: revokedAt,
        revoked_by: accountId.staff,
        revoke_reason:
          account.memberTier === 'archived'
            ? 'Account archived after membership pause request.'
            : 'Membership access revoked after repeated unpaid renewals.',
      },
    });

    await ensurePayment({
      id: id(`payment:membership-card:${account.key}`),
      user_id: accountId[account.key],
      payable_type: PayableType.membership_card,
      payable_id: cardId,
      payment_stage: PaymentStage.full,
      amount: money(400),
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.completed,
      provider_ref: `membership-card-${account.key}`,
      verified_by: accountId.staff,
      verified_at: purchasedAt,
      gateway_metadata: json({
        checkout: 'historical',
        source: 'member_portal',
      }),
    });

    await prisma.subscription.upsert({
      where: { id: subscriptionId },
      update: {
        user_id: accountId[account.key],
        plan_id: id('membership-plan:weekly'),
        payment_id: null,
        status: SubscriptionStatus.expired,
        starts_at: purchasedAt,
        expires_at: revokedAt,
        warned_7d_at: nowPlusDays(-(14 + (index % 8)), 9),
        warned_3d_at: nowPlusDays(-(10 + (index % 8)), 9),
        warned_1d_at: nowPlusDays(-(8 + (index % 8)), 9),
      },
      create: {
        id: subscriptionId,
        user_id: accountId[account.key],
        plan_id: id('membership-plan:weekly'),
        status: SubscriptionStatus.expired,
        starts_at: purchasedAt,
        expires_at: revokedAt,
        warned_7d_at: nowPlusDays(-(14 + (index % 8)), 9),
        warned_3d_at: nowPlusDays(-(10 + (index % 8)), 9),
        warned_1d_at: nowPlusDays(-(8 + (index % 8)), 9),
      },
    });
  }

  for (const [index, account] of activeOperationalMembers.entries()) {
    const coachId = coachIds[index % coachIds.length];
    const amenityId =
      index % 3 === 0
        ? id('amenity:basketball')
        : index % 3 === 1
          ? id('amenity:boxing')
          : id('amenity:studio');
    const bookingStatusCycle = [
      BookingStatus.confirmed,
      BookingStatus.completed,
      BookingStatus.cancelled,
      BookingStatus.balance_pending,
      BookingStatus.no_show,
    ];
    const bookingStatus = bookingStatusCycle[index % bookingStatusCycle.length];
    const startsAt =
      bookingStatus === BookingStatus.confirmed ||
      bookingStatus === BookingStatus.balance_pending
        ? nowPlusDays(1 + (index % 12), 7 + (index % 5))
        : nowPlusDays(-(2 + (index % 18)), 7 + (index % 5));
    const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
    const bookingId = id(`amenity-booking:${account.key}`);
    const totalAmount = 240 + (index % 4) * 130;
    const downpaymentAmount = Math.round(totalAmount * 0.3);
    const balanceAmount = totalAmount - downpaymentAmount;

    await prisma.amenityBooking.upsert({
      where: { id: bookingId },
      update: {
        user_id: accountId[account.key],
        amenity_id: amenityId,
        coach_id: index % 2 === 0 ? coachId : null,
        status: bookingStatus,
        starts_at: startsAt,
        ends_at: endsAt,
        total_amount: money(totalAmount),
        downpayment_amount: money(downpaymentAmount),
        balance_amount: money(balanceAmount),
        downpayment_paid_at: nowPlusDays(-1, 14),
        balance_paid_at:
          bookingStatus === BookingStatus.confirmed ||
          bookingStatus === BookingStatus.completed
            ? nowPlusDays(-1, 16)
            : null,
        cancelled_at:
          bookingStatus === BookingStatus.cancelled
            ? nowPlusDays(-(1 + (index % 12)), 18)
            : null,
        completed_at:
          bookingStatus === BookingStatus.completed
            ? nowPlusDays(-(1 + (index % 12)), 20)
            : null,
        notes:
          bookingStatus === BookingStatus.no_show
            ? 'Member did not arrive for the reserved slot.'
            : 'Bulk realistic booking seed for local QA.',
      },
      create: {
        id: bookingId,
        user_id: accountId[account.key],
        amenity_id: amenityId,
        coach_id: index % 2 === 0 ? coachId : null,
        status: bookingStatus,
        starts_at: startsAt,
        ends_at: endsAt,
        total_amount: money(totalAmount),
        downpayment_amount: money(downpaymentAmount),
        balance_amount: money(balanceAmount),
        downpayment_paid_at: nowPlusDays(-1, 14),
        balance_paid_at:
          bookingStatus === BookingStatus.confirmed ||
          bookingStatus === BookingStatus.completed
            ? nowPlusDays(-1, 16)
            : null,
        cancelled_at:
          bookingStatus === BookingStatus.cancelled
            ? nowPlusDays(-(1 + (index % 12)), 18)
            : null,
        completed_at:
          bookingStatus === BookingStatus.completed
            ? nowPlusDays(-(1 + (index % 12)), 20)
            : null,
        notes:
          bookingStatus === BookingStatus.no_show
            ? 'Member did not arrive for the reserved slot.'
            : 'Bulk realistic booking seed for local QA.',
      },
    });

    await ensurePayment({
      id: id(`payment:booking:downpayment:${account.key}`),
      user_id: accountId[account.key],
      payable_type: PayableType.booking,
      payable_id: bookingId,
      payment_stage: PaymentStage.downpayment,
      amount: money(downpaymentAmount),
      provider:
        index % 2 === 0 ? PaymentProvider.paymongo : PaymentProvider.cash,
      status:
        bookingStatus === BookingStatus.balance_pending
          ? PaymentStatus.completed
          : bookingStatus === BookingStatus.cancelled ||
              bookingStatus === BookingStatus.no_show ||
              bookingStatus === BookingStatus.completed ||
              bookingStatus === BookingStatus.confirmed
            ? PaymentStatus.completed
            : PaymentStatus.processing,
      provider_ref: `booking-downpayment-${account.key}`,
      verified_by: accountId.staff,
      verified_at: nowPlusDays(-1, 14),
    });

    if (
      bookingStatus === BookingStatus.confirmed ||
      bookingStatus === BookingStatus.completed
    ) {
      await ensurePayment({
        id: id(`payment:booking:balance:${account.key}`),
        user_id: accountId[account.key],
        payable_type: PayableType.booking,
        payable_id: bookingId,
        payment_stage: PaymentStage.balance,
        amount: money(balanceAmount),
        provider: PaymentProvider.cash,
        status: PaymentStatus.completed,
        verified_by: accountId.staff,
        verified_at: nowPlusDays(-1, 16),
      });
    }
  }

  for (const [index, account] of activeOperationalMembers
    .slice(0, 90)
    .entries()) {
    const coachId = coachIds[index % coachIds.length];
    const appointmentStatusCycle = [
      AppointmentStatus.confirmed,
      AppointmentStatus.completed,
      AppointmentStatus.pending_payment,
      AppointmentStatus.cancelled,
      AppointmentStatus.no_show,
    ];
    const status =
      appointmentStatusCycle[index % appointmentStatusCycle.length];
    const scheduledAt =
      status === AppointmentStatus.confirmed ||
      status === AppointmentStatus.pending_payment
        ? nowPlusDays(1 + (index % 10), 8 + (index % 5))
        : nowPlusDays(-(2 + (index % 16)), 8 + (index % 5));
    const appointmentId = id(`coach-appointment:${account.key}`);
    const totalAmount = 450 + (index % 5) * 80;

    await prisma.coachAppointment.upsert({
      where: { id: appointmentId },
      update: {
        user_id: accountId[account.key],
        coach_id: coachId,
        status,
        scheduled_at: scheduledAt,
        duration_minutes: index % 4 === 0 ? 90 : 60,
        total_amount: money(totalAmount),
        downpayment_amount: money(Math.round(totalAmount * 0.3)),
        balance_amount: money(totalAmount - Math.round(totalAmount * 0.3)),
        gym_revenue: money(Math.round(totalAmount * 0.2)),
        coach_earnings: money(totalAmount - Math.round(totalAmount * 0.2)),
        downpayment_paid_at:
          status === AppointmentStatus.pending_payment
            ? null
            : nowPlusDays(-1, 12),
        balance_paid_at:
          status === AppointmentStatus.confirmed ||
          status === AppointmentStatus.completed
            ? nowPlusDays(-1, 15)
            : null,
        member_notes: 'Bulk realistic coaching request for local QA.',
        session_notes:
          status === AppointmentStatus.completed
            ? 'Completed a coached progression session with movement corrections.'
            : null,
        coach_feedback:
          status === AppointmentStatus.completed
            ? 'Member responded well to the session cues and progression plan.'
            : null,
        assessment_report:
          status === AppointmentStatus.completed
            ? 'Baseline movement quality improved with reduced compensation on final sets.'
            : null,
        completed_at:
          status === AppointmentStatus.completed
            ? new Date(scheduledAt.getTime() + 75 * 60 * 1000)
            : null,
        cancelled_at:
          status === AppointmentStatus.cancelled
            ? nowPlusDays(-(1 + (index % 12)), 18)
            : null,
        no_show_at:
          status === AppointmentStatus.no_show
            ? new Date(scheduledAt.getTime() + 20 * 60 * 1000)
            : null,
        cancellation_reason:
          status === AppointmentStatus.cancelled
            ? 'Member requested a reschedule due to work conflict.'
            : null,
      },
      create: {
        id: appointmentId,
        user_id: accountId[account.key],
        coach_id: coachId,
        status,
        scheduled_at: scheduledAt,
        duration_minutes: index % 4 === 0 ? 90 : 60,
        total_amount: money(totalAmount),
        downpayment_amount: money(Math.round(totalAmount * 0.3)),
        balance_amount: money(totalAmount - Math.round(totalAmount * 0.3)),
        gym_revenue: money(Math.round(totalAmount * 0.2)),
        coach_earnings: money(totalAmount - Math.round(totalAmount * 0.2)),
        downpayment_paid_at:
          status === AppointmentStatus.pending_payment
            ? null
            : nowPlusDays(-1, 12),
        balance_paid_at:
          status === AppointmentStatus.confirmed ||
          status === AppointmentStatus.completed
            ? nowPlusDays(-1, 15)
            : null,
        member_notes: 'Bulk realistic coaching request for local QA.',
        session_notes:
          status === AppointmentStatus.completed
            ? 'Completed a coached progression session with movement corrections.'
            : null,
        coach_feedback:
          status === AppointmentStatus.completed
            ? 'Member responded well to the session cues and progression plan.'
            : null,
        assessment_report:
          status === AppointmentStatus.completed
            ? 'Baseline movement quality improved with reduced compensation on final sets.'
            : null,
        completed_at:
          status === AppointmentStatus.completed
            ? new Date(scheduledAt.getTime() + 75 * 60 * 1000)
            : null,
        cancelled_at:
          status === AppointmentStatus.cancelled
            ? nowPlusDays(-(1 + (index % 12)), 18)
            : null,
        no_show_at:
          status === AppointmentStatus.no_show
            ? new Date(scheduledAt.getTime() + 20 * 60 * 1000)
            : null,
        cancellation_reason:
          status === AppointmentStatus.cancelled
            ? 'Member requested a reschedule due to work conflict.'
            : null,
      },
    });

    if (status !== AppointmentStatus.cancelled) {
      await ensurePayment({
        id: id(`payment:appointment:${account.key}`),
        user_id: accountId[account.key],
        payable_type: PayableType.coaching,
        payable_id: appointmentId,
        payment_stage: PaymentStage.full,
        amount: money(totalAmount),
        provider:
          index % 2 === 0 ? PaymentProvider.cash : PaymentProvider.paymongo,
        status:
          status === AppointmentStatus.pending_payment
            ? PaymentStatus.processing
            : PaymentStatus.completed,
        provider_ref: `coaching-${account.key}`,
        verified_by:
          status === AppointmentStatus.pending_payment ? null : accountId.admin,
        verified_at:
          status === AppointmentStatus.pending_payment
            ? null
            : nowPlusDays(-1, 15),
      });
    }

    if (status === AppointmentStatus.completed && index % 4 === 0) {
      await prisma.coachReview.upsert({
        where: { appointment_id: appointmentId },
        update: {
          coach_id: coachId,
          reviewer_id: accountId[account.key],
          rating: 4 + (index % 2),
          comment:
            index % 2 === 0
              ? 'Clear coaching cues and strong follow-through after the session.'
              : 'Helpful feedback and good pacing throughout the appointment.',
        },
        create: {
          id: id(`coach-review:${account.key}`),
          coach_id: coachId,
          reviewer_id: accountId[account.key],
          appointment_id: appointmentId,
          rating: 4 + (index % 2),
          comment:
            index % 2 === 0
              ? 'Clear coaching cues and strong follow-through after the session.'
              : 'Helpful feedback and good pacing throughout the appointment.',
        },
      });
    }
  }

  for (const [index, account] of activeOperationalMembers
    .slice(0, 160)
    .entries()) {
    for (let dayOffset = 0; dayOffset < 3; dayOffset += 1) {
      const checkInAt = nowPlusDays(
        -(dayOffset * 6 + (index % 20)),
        6 + (index % 6),
      );
      const checkOutAt = new Date(
        checkInAt.getTime() + (75 + ((index + dayOffset) % 45)) * 60 * 1000,
      );
      await prisma.attendanceLog.upsert({
        where: { id: id(`attendance:${account.key}:${dayOffset}`) },
        update: {
          user_id: accountId[account.key],
          scanned_by: dayOffset % 2 === 0 ? accountId.staff : accountId.admin,
          check_in_at: checkInAt,
          check_out_at: checkOutAt,
        },
        create: {
          id: id(`attendance:${account.key}:${dayOffset}`),
          user_id: accountId[account.key],
          scanned_by: dayOffset % 2 === 0 ? accountId.staff : accountId.admin,
          check_in_at: checkInAt,
          check_out_at: checkOutAt,
        },
      });
    }
  }

  for (const [index, account] of activeOperationalMembers
    .slice(0, 80)
    .entries()) {
    for (let sessionIndex = 0; sessionIndex < 2; sessionIndex += 1) {
      const sessionId = id(`workout-session:${account.key}:${sessionIndex}`);
      const startedAt = nowPlusDays(
        -(2 + sessionIndex * 5 + (index % 16)),
        6 + ((index + sessionIndex) % 4),
      );
      const completedAt = new Date(startedAt.getTime() + 66 * 60 * 1000);
      const squatLogId = id(
        `exercise-log:${account.key}:${sessionIndex}:squat`,
      );
      const pushLogId = id(
        `exercise-log:${account.key}:${sessionIndex}:pushup`,
      );

      await prisma.workoutSession.upsert({
        where: { id: sessionId },
        update: {
          user_id: accountId[account.key],
          plan_id: null,
          status: SessionStatus.completed,
          started_at: startedAt,
          completed_at: completedAt,
          duration_seconds: 3960,
          total_volume_kg: money(1200 + index * 12 + sessionIndex * 90),
          last_activity_at: completedAt,
        },
        create: {
          id: sessionId,
          user_id: accountId[account.key],
          status: SessionStatus.completed,
          started_at: startedAt,
          completed_at: completedAt,
          duration_seconds: 3960,
          total_volume_kg: money(1200 + index * 12 + sessionIndex * 90),
          last_activity_at: completedAt,
        },
      });

      await prisma.exerciseLog.upsert({
        where: { id: squatLogId },
        update: {
          session_id: sessionId,
          user_id: accountId[account.key],
          exercise_id: id('exercise:squat'),
          set_number: 1,
          reps_target: 8,
          reps_completed: 8,
          reps_ai_counted: 8,
          weight_kg: money(45 + (index % 8) * 5),
          duration_seconds: 120,
        },
        create: {
          id: squatLogId,
          session_id: sessionId,
          user_id: accountId[account.key],
          exercise_id: id('exercise:squat'),
          set_number: 1,
          reps_target: 8,
          reps_completed: 8,
          reps_ai_counted: 8,
          weight_kg: money(45 + (index % 8) * 5),
          duration_seconds: 120,
        },
      });

      await prisma.exerciseLog.upsert({
        where: { id: pushLogId },
        update: {
          session_id: sessionId,
          user_id: accountId[account.key],
          exercise_id: id('exercise:pushup'),
          set_number: 2,
          reps_target: 12,
          reps_completed: 12,
          reps_ai_counted: 12,
          weight_kg: null,
          duration_seconds: 90,
        },
        create: {
          id: pushLogId,
          session_id: sessionId,
          user_id: accountId[account.key],
          exercise_id: id('exercise:pushup'),
          set_number: 2,
          reps_target: 12,
          reps_completed: 12,
          reps_ai_counted: 12,
          weight_kg: null,
          duration_seconds: 90,
        },
      });

      if (index < 18 && sessionIndex === 1) {
        const poseSessionId = id(`pose-session:${account.key}`);
        await prisma.poseSession.upsert({
          where: { id: poseSessionId },
          update: {
            user_id: accountId[account.key],
            exercise_log_id: pushLogId,
            exercise_hint: 'incline push-up',
            rep_count_ai: 12,
            confidence_avg: money(0.87),
            detected_exercise_name: 'Incline Push-Up',
            classification_confidence: money(0.84),
            subject_lock_confidence: money(0.91),
            analysis_summary: json({ provider: 'local-pose', reviewed: false }),
            started_at: startedAt,
            ended_at: completedAt,
          },
          create: {
            id: poseSessionId,
            user_id: accountId[account.key],
            exercise_log_id: pushLogId,
            exercise_hint: 'incline push-up',
            rep_count_ai: 12,
            confidence_avg: money(0.87),
            detected_exercise_name: 'Incline Push-Up',
            classification_confidence: money(0.84),
            subject_lock_confidence: money(0.91),
            analysis_summary: json({ provider: 'local-pose', reviewed: false }),
            started_at: startedAt,
            ended_at: completedAt,
          },
        });

      }
    }
  }

  for (const [index, account] of activeGamificationMembers.entries()) {
    const sessionId = id(`workout-session:${account.key}:1`);
    const sourceEventId = id(`progression-source:${account.key}`);
    const grantId = id(`progression-grant:${account.key}`);
    const milestoneDefinitionId = id('milestone:first-workout');
    const seasonId = id('season:current');
    const points = 240 + (60 - index) * 7;

    await prisma.progressionSourceEvent.upsert({
      where: {
        source_type_source_id: {
          source_type: ProgressionSourceType.workout_session_completed,
          source_id: sessionId,
        },
      },
      update: {
        user_id: accountId[account.key],
        source_status: ProgressionSourceStatus.applied,
        source_context: json({ workoutSessionId: sessionId }),
        processed_at: nowPlusDays(-(1 + (index % 10)), 19),
      },
      create: {
        id: sourceEventId,
        user_id: accountId[account.key],
        source_type: ProgressionSourceType.workout_session_completed,
        source_id: sessionId,
        source_status: ProgressionSourceStatus.applied,
        source_context: json({ workoutSessionId: sessionId }),
        processed_at: nowPlusDays(-(1 + (index % 10)), 19),
      },
    });

    await prisma.progressionGrantLedger.upsert({
      where: { id: grantId },
      update: {
        user_id: accountId[account.key],
        source_event_id: sourceEventId,
        season_id: seasonId,
        grant_type: ProgressionGrantType.xp,
        grant_status: ProgressionGrantStatus.applied,
        amount: 90 + (index % 6) * 15,
        muscle_group: index % 2 === 0 ? 'quads' : 'chest',
        reason: 'Bulk realistic progression grant from completed workout.',
        metadata: json({ source: 'seed-realistic-data' }),
      },
      create: {
        id: grantId,
        user_id: accountId[account.key],
        source_event_id: sourceEventId,
        season_id: seasonId,
        grant_type: ProgressionGrantType.xp,
        grant_status: ProgressionGrantStatus.applied,
        amount: 90 + (index % 6) * 15,
        muscle_group: index % 2 === 0 ? 'quads' : 'chest',
        reason: 'Bulk realistic progression grant from completed workout.',
        metadata: json({ source: 'seed-realistic-data' }),
      },
    });

    await prisma.userProgressionProfile.upsert({
      where: { user_id: accountId[account.key] },
      update: {
        active_season_id: seasonId,
        total_xp: 840 + points,
        current_streak: 2 + (index % 8),
        longest_streak: 5 + (index % 11),
        current_season_points: points,
        last_progressed_at: nowPlusDays(-(1 + (index % 10)), 19),
      },
      create: {
        id: id(`progression-profile:${account.key}`),
        user_id: accountId[account.key],
        active_season_id: seasonId,
        total_xp: 840 + points,
        current_streak: 2 + (index % 8),
        longest_streak: 5 + (index % 11),
        current_season_points: points,
        last_progressed_at: nowPlusDays(-(1 + (index % 10)), 19),
      },
    });

    await prisma.seasonalStanding.upsert({
      where: {
        season_id_user_id: {
          season_id: seasonId,
          user_id: accountId[account.key],
        },
      },
      update: {
        season_points: points,
        rank_position: index + 3,
        is_hidden: false,
        is_disqualified: false,
        last_earned_at: nowPlusDays(-(1 + (index % 10)), 19),
      },
      create: {
        id: id(`seasonal-standing:${account.key}`),
        season_id: seasonId,
        user_id: accountId[account.key],
        season_points: points,
        rank_position: index + 3,
        last_earned_at: nowPlusDays(-(1 + (index % 10)), 19),
      },
    });

    await prisma.userMilestoneProgress.upsert({
      where: {
        user_id_milestone_definition_id: {
          user_id: accountId[account.key],
          milestone_definition_id: milestoneDefinitionId,
        },
      },
      update: {
        status:
          index % 3 === 0
            ? MilestoneProgressStatus.claimed
            : MilestoneProgressStatus.unlocked,
        progress_value: 1,
        unlocked_at: nowPlusDays(-(1 + (index % 10)), 19),
        claimed_at:
          index % 3 === 0 ? nowPlusDays(-(1 + (index % 10)), 20) : null,
      },
      create: {
        id: id(`milestone-progress:${account.key}`),
        user_id: accountId[account.key],
        milestone_definition_id: milestoneDefinitionId,
        status:
          index % 3 === 0
            ? MilestoneProgressStatus.claimed
            : MilestoneProgressStatus.unlocked,
        progress_value: 1,
        unlocked_at: nowPlusDays(-(1 + (index % 10)), 19),
        claimed_at:
          index % 3 === 0 ? nowPlusDays(-(1 + (index % 10)), 20) : null,
      },
    });

    await prisma.muscleMasteryProgress.upsert({
      where: {
        user_id_muscle_group: {
          user_id: accountId[account.key],
          muscle_group: index % 2 === 0 ? 'quads' : 'chest',
        },
      },
      update: {
        total_volume_kg: money(900 + index * 45),
        xp_points: 320 + index * 18,
        rank:
          index > 40
            ? MasteryRank.bronze
            : index > 22
              ? MasteryRank.silver
              : MasteryRank.gold,
        last_ranked_at: nowPlusDays(-(1 + (index % 10)), 20),
      },
      create: {
        id: id(`muscle-mastery:${account.key}`),
        user_id: accountId[account.key],
        muscle_group: index % 2 === 0 ? 'quads' : 'chest',
        total_volume_kg: money(900 + index * 45),
        xp_points: 320 + index * 18,
        rank:
          index > 40
            ? MasteryRank.bronze
            : index > 22
              ? MasteryRank.silver
              : MasteryRank.gold,
        last_ranked_at: nowPlusDays(-(1 + (index % 10)), 20),
      },
    });

    await prisma.rankingProfile.upsert({
      where: { user_id: accountId[account.key] },
      update: {
        visibility:
          index % 5 === 0
            ? RankingVisibility.anonymous
            : RankingVisibility.public,
        governance_status: RankingGovernanceStatus.normal,
        display_alias: `${account.firstName} ${account.lastName.charAt(0)}.`,
        admin_note: null,
      },
      create: {
        id: id(`ranking-profile:${account.key}`),
        user_id: accountId[account.key],
        visibility:
          index % 5 === 0
            ? RankingVisibility.anonymous
            : RankingVisibility.public,
        governance_status: RankingGovernanceStatus.normal,
        display_alias: `${account.firstName} ${account.lastName.charAt(0)}.`,
      },
    });

    await prisma.integrityProfile.upsert({
      where: { user_id: accountId[account.key] },
      update: {
        risk_level:
          index % 12 === 0 ? IntegrityRiskLevel.medium : IntegrityRiskLevel.low,
        open_case_count: index % 12 === 0 ? 1 : 0,
        last_flagged_at:
          index % 12 === 0 ? nowPlusDays(-(2 + (index % 6)), 18) : null,
        last_resolved_at:
          index % 12 === 0 ? null : nowPlusDays(-(5 + (index % 8)), 18),
      },
      create: {
        id: id(`integrity-profile:${account.key}`),
        user_id: accountId[account.key],
        risk_level:
          index % 12 === 0 ? IntegrityRiskLevel.medium : IntegrityRiskLevel.low,
        open_case_count: index % 12 === 0 ? 1 : 0,
        last_flagged_at:
          index % 12 === 0 ? nowPlusDays(-(2 + (index % 6)), 18) : null,
        last_resolved_at:
          index % 12 === 0 ? null : nowPlusDays(-(5 + (index % 8)), 18),
      },
    });

  }

  for (const [index, account] of ACCOUNTS.slice(0, 140).entries()) {
    const notificationTypeCycle = [
      NotificationType.payment_confirmed,
      NotificationType.booking_confirmed,
      NotificationType.appointment_confirmed,
      NotificationType.appointment_reminder,
      NotificationType.system,
    ];
    const notificationType =
      notificationTypeCycle[index % notificationTypeCycle.length];
    const sentAt = nowPlusDays(-(index % 12), 9 + (index % 6));
    const status =
      index % 5 === 0 ? NotificationStatus.read : NotificationStatus.sent;

    await prisma.notification.upsert({
      where: { id: id(`notification:${account.key}`) },
      update: {
        user_id: accountId[account.key],
        type: notificationType,
        channel: NotificationChannel.in_app,
        title:
          notificationType === NotificationType.system
            ? 'FitTrack update'
            : notificationType === NotificationType.payment_confirmed
              ? 'Payment confirmed'
              : notificationType === NotificationType.booking_confirmed
                ? 'Booking confirmed'
                : notificationType === NotificationType.appointment_confirmed
                  ? 'Appointment confirmed'
                  : 'Appointment reminder',
        body:
          notificationType === NotificationType.system
            ? 'Your local QA dataset was refreshed with realistic FitTrack activity.'
            : notificationType === NotificationType.payment_confirmed
              ? 'Your latest FitTrack payment has been recorded in PHP.'
              : notificationType === NotificationType.booking_confirmed
                ? 'Your venue reservation is confirmed on the local stack.'
                : notificationType === NotificationType.appointment_confirmed
                  ? 'Your coaching appointment is confirmed on the local stack.'
                  : 'Reminder: your coaching appointment starts within the next day.',
        data: json({ source: 'seed-realistic-data', userKey: account.key }),
        status,
        sent_at: sentAt,
        read_at: status === NotificationStatus.read ? nowPlusDays(0, 8) : null,
        error: null,
      },
      create: {
        id: id(`notification:${account.key}`),
        user_id: accountId[account.key],
        type: notificationType,
        channel: NotificationChannel.in_app,
        title:
          notificationType === NotificationType.system
            ? 'FitTrack update'
            : notificationType === NotificationType.payment_confirmed
              ? 'Payment confirmed'
              : notificationType === NotificationType.booking_confirmed
                ? 'Booking confirmed'
                : notificationType === NotificationType.appointment_confirmed
                  ? 'Appointment confirmed'
                  : 'Appointment reminder',
        body:
          notificationType === NotificationType.system
            ? 'Your local QA dataset was refreshed with realistic FitTrack activity.'
            : notificationType === NotificationType.payment_confirmed
              ? 'Your latest FitTrack payment has been recorded in PHP.'
              : notificationType === NotificationType.booking_confirmed
                ? 'Your venue reservation is confirmed on the local stack.'
                : notificationType === NotificationType.appointment_confirmed
                  ? 'Your coaching appointment is confirmed on the local stack.'
                  : 'Reminder: your coaching appointment starts within the next day.',
        data: json({ source: 'seed-realistic-data', userKey: account.key }),
        status,
        sent_at: sentAt,
        read_at: status === NotificationStatus.read ? nowPlusDays(0, 8) : null,
      },
    });
  }

  for (const [index, account] of activeOperationalMembers
    .slice(0, 40)
    .entries()) {
    await prisma.progressMetric.upsert({
      where: { id: id(`progress-metric:${account.key}`) },
      update: {
        user_id: accountId[account.key],
        weight_kg: money(58 + (index % 18)),
        height_cm: money(158 + (index % 17)),
        body_fat_pct: money(16 + (index % 10)),
        muscle_mass_kg: money(24 + (index % 9)),
        waist_cm: money(72 + (index % 12)),
        chest_cm: money(88 + (index % 12)),
        notes:
          'Bulk realistic body-composition checkpoint for analytics and profile QA.',
        recorded_at: nowPlusDays(-(index % 10), 7),
      },
      create: {
        id: id(`progress-metric:${account.key}`),
        user_id: accountId[account.key],
        weight_kg: money(58 + (index % 18)),
        height_cm: money(158 + (index % 17)),
        body_fat_pct: money(16 + (index % 10)),
        muscle_mass_kg: money(24 + (index % 9)),
        waist_cm: money(72 + (index % 12)),
        chest_cm: money(88 + (index % 12)),
        notes:
          'Bulk realistic body-composition checkpoint for analytics and profile QA.',
        recorded_at: nowPlusDays(-(index % 10), 7),
      },
    });
  }

  for (const account of [
    ...verifiedNonMembers,
    ...pendingVerificationMembers,
  ].slice(0, 24)) {
    await prisma.notification.upsert({
      where: { id: id(`notification:onboarding:${account.key}`) },
      update: {
        user_id: accountId[account.key],
        type: NotificationType.system,
        channel: NotificationChannel.in_app,
        title: 'Account onboarding status',
        body:
          account.memberTier === 'verified_non_member'
            ? 'Your FitTrack account is verified as a non-member and ready for sign-in.'
            : 'Complete your verification flow to activate your FitTrack account.',
        data: json({ tier: account.memberTier }),
        status: NotificationStatus.sent,
        sent_at: nowPlusDays(-1, 8),
      },
      create: {
        id: id(`notification:onboarding:${account.key}`),
        user_id: accountId[account.key],
        type: NotificationType.system,
        channel: NotificationChannel.in_app,
        title: 'Account onboarding status',
        body:
          account.memberTier === 'verified_non_member'
            ? 'Your FitTrack account is verified as a non-member and ready for sign-in.'
            : 'Complete your verification flow to activate your FitTrack account.',
        data: json({ tier: account.memberTier }),
        status: NotificationStatus.sent,
        sent_at: nowPlusDays(-1, 8),
      },
    });
  }
}

async function buildRoleBreakdown() {
  const rows = await prisma.user.groupBy({
    by: ['role'],
    _count: { _all: true },
  });

  return rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.role] = row._count._all;
    return accumulator;
  }, {});
}

async function buildTierBreakdown() {
  const members = await prisma.user.findMany({
    where: { role: UserRole.member },
    select: {
      status: true,
      deletedAt: true,
      membership_card: {
        select: {
          status: true,
        },
      },
    },
  });

  const breakdown = {
    active_member: 0,
    pending_membership: 0,
    pending_verification: 0,
    revoked: 0,
    verified_non_member: 0,
    archived: 0,
  };

  for (const member of members) {
    if (member.deletedAt) {
      breakdown.archived += 1;
      continue;
    }

    if (member.status === UserStatus.pending) {
      breakdown.pending_verification += 1;
      continue;
    }

    if (member.membership_card?.status === MembershipCardStatus.active) {
      breakdown.active_member += 1;
      continue;
    }

    if (
      member.membership_card?.status ===
      MembershipCardStatus.pending_verification
    ) {
      breakdown.pending_membership += 1;
      continue;
    }

    if (member.membership_card?.status === MembershipCardStatus.revoked) {
      breakdown.revoked += 1;
      continue;
    }

    breakdown.verified_non_member += 1;
  }

  return breakdown;
}

async function buildCounts() {
  return {
    users: await prisma.user.count(),
    authIdentities: await prisma.authIdentity.count(),
    refreshTokens: await prisma.refreshToken.count(),
    otpVerifications: await prisma.otpVerification.count(),
    userProfiles: await prisma.userProfile.count(),
    progressMetrics: await prisma.progressMetric.count(),
    notificationPreferences: await prisma.notificationPreference.count(),
    attendanceLogs: await prisma.attendanceLog.count(),
    membershipPlans: await prisma.membershipPlan.count(),
    subscriptions: await prisma.subscription.count(),
    membershipCards: await prisma.membershipCard.count(),
    payments: await prisma.payment.count(),
    amenities: await prisma.amenity.count(),
    facilityFloorPlanMedia: await prisma.facilityFloorPlanMedia.count(),
    amenityBookings: await prisma.amenityBooking.count(),
    coachProfiles: await prisma.coachProfile.count(),
    coachAppointments: await prisma.coachAppointment.count(),
    recurringCoachingPlans: await prisma.recurringCoachingPlan.count(),
    recurringCoachingBillingCycles:
      await prisma.recurringCoachingBillingCycle.count(),
    coachReviews: await prisma.coachReview.count(),
    coachAvailabilitySlots: await prisma.coachAvailabilitySlot.count(),
    coachClientRelationships: await prisma.coachClientRelationship.count(),
    exerciseCatalog: await prisma.exerciseCatalog.count(),
    muscleDefinitions: await prisma.muscleDefinition.count(),
    trainingPlans: await prisma.trainingPlan.count(),
    trainingScheduleDays: await prisma.trainingScheduleDay.count(),
    planExercises: await prisma.planExercise.count(),
    workoutSessions: await prisma.workoutSession.count(),
    exerciseLogs: await prisma.exerciseLog.count(),
    poseExerciseProfiles: await prisma.poseExerciseProfile.count(),
    poseSessions: await prisma.poseSession.count(),
    muscleMasteryProgress: await prisma.muscleMasteryProgress.count(),
    progressionSourceEvents: await prisma.progressionSourceEvent.count(),
    progressionGrantLedger: await prisma.progressionGrantLedger.count(),
    userProgressionProfiles: await prisma.userProgressionProfile.count(),
    seasonDefinitions: await prisma.seasonDefinition.count(),
    seasonalStandings: await prisma.seasonalStanding.count(),
    milestoneDefinitions: await prisma.milestoneDefinition.count(),
    userMilestoneProgress: await prisma.userMilestoneProgress.count(),
    rankingProfiles: await prisma.rankingProfile.count(),
    integrityProfiles: await prisma.integrityProfile.count(),
    integrityCases: await prisma.integrityCase.count(),
    integrityEvents: await prisma.integrityEvent.count(),
    moderationActionRecords: await prisma.moderationActionRecord.count(),
    tdeeProfiles: await prisma.tdeeProfile.count(),
    macroTargets: await prisma.macroTarget.count(),
    nutritionLogs: await prisma.nutritionLog.count(),
    retailProducts: await prisma.retailProduct.count(),
    saleTransactions: await prisma.saleTransaction.count(),
    saleTransactionItems: await prisma.saleTransactionItem.count(),
    gymEquipmentItems: await prisma.gymEquipmentItem.count(),
    equipmentWriteOffs: await prisma.equipmentWriteOff.count(),
    aiChatSessions: await prisma.aiChatSession.count(),
    aiChatMessages: await prisma.aiChatMessage.count(),
    aiInteractionLogs: await prisma.aiInteractionLog.count(),
    notifications: await prisma.notification.count(),
    gymEquipment: await prisma.gymEquipment.count(),
    auditLogs: await prisma.auditLog.count(),
    gymChatSessions: await prisma.gymChatSession.count(),
    gymChatMessages: await prisma.gymChatMessage.count(),
    gymChatInteractionLogs: await prisma.gymChatInteractionLog.count(),
    gymOperatingHours: await prisma.gymOperatingHour.count(),
    gymSpecialSchedules: await prisma.gymSpecialSchedule.count(),
    gymFaqEntries: await prisma.gymFaqEntry.count(),
    businessInsightRuns: await prisma.businessInsightRun.count(),
    accountDeletionRequests: await prisma.accountDeletionRequest.count(),
    roleBreakdown: await buildRoleBreakdown(),
    tierBreakdown: await buildTierBreakdown(),
  };
}

async function main() {
  await resetDatabaseForCleanSlate();

  await ensureAccounts();
  await bootstrapDefaults(prisma, {
    includeUsers: false,
  });
  await ensureMembershipsAndPayments();
  await ensureFacilitiesAndCoaching();
  await ensureFitnessAndTraining();
  await ensureGamification();
  await ensureNutrition();
  await ensureInventoryAndSales();
  await ensureAiNotificationsAndGymContent();
  await ensureAttendanceAuditAndAnalytics();
  await ensureBulkOperationalData();

  const counts = await buildCounts();
  console.log('[realistic-seed] complete');
  console.log(
    `[realistic-seed] clean local slate rebuilt; defaults ensured without demo accounts; named credentials: admin@fittrack.com / FitTrack@Admin1, staff@fittrack.com / FitTrack@Staff1, coach@fittrack.com / FitTrack@Coach1, member.active@fittrack.com / FitTrack@Member1, nonmember.verified@fittrack.com / FitTrack@Member2, member.pending@fittrack.com / FitTrack@Member3, member.archived@fittrack.com / FitTrack@Member4`,
  );
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
