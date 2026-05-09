import {
  AccountDeletionRequestStatus,
  ActivityLevel,
  AmenityType,
  AppointmentStatus,
  AuthProvider,
  BookingStatus,
  ChatContext,
  ChatRole,
  CreatorState,
  EquipmentStatus,
  ExerciseCategory,
  ExerciseReviewSubmissionStatus,
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
  MilestoneProgressStatus,
  ModerationActionType,
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
  RelationshipStatus,
  SalePaymentMethod,
  SaleStatus,
  SeasonStatus,
  SessionStatus,
  SubscriptionStatus,
  UserRole,
  UserStatus,
  NotificationChannel,
  NotificationStatus,
  NotificationType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';

import { localEnvFilePath } from '../env-path';
import { bootstrapDefaults } from './defaults';
import {
  MANUAL_TEST_PATHS,
  TEST_ACCOUNTS,
  type TestAccount,
  type TestDataSeedMode,
  seedId,
} from './test-data/constants';
import {
  toManifestCredentials,
  writeTestDataManifest,
} from './test-data/manifest';
import { EXERCISE_REVIEW_SUBMISSION_SEEDS } from './test-data/exercise-review-submission-seeds';

const PASSWORD_HASH_ROUNDS = 12;

const TEST_MANUAL_PATHS = [
  ...MANUAL_TEST_PATHS,
  {
    area: 'web-schedule',
    credentialKey: 'staff',
    route: '/schedule',
    expected:
      'Review seeded coach profiles, availability, appointments, and venue bookings from Gym Operations.',
  },
] as const;

const LEGACY_COACH_SEED_ACCOUNTS = [
  {
    email: 'seed.coach.mia@fittrack.com',
    key: 'coach-mia',
  },
  {
    email: 'seed.coach.noah@fittrack.com',
    key: 'coach-noah',
  },
] as const;

const BASELINE_TEST_ACCOUNT_KEYS = new Set(
  TEST_ACCOUNTS.map((account) => account.key),
);
const BASELINE_TEST_ACCOUNTS = TEST_ACCOUNTS.filter((account) =>
  BASELINE_TEST_ACCOUNT_KEYS.has(account.key),
);
const BASELINE_TEST_MANUAL_PATHS = TEST_MANUAL_PATHS.filter((path) =>
  BASELINE_TEST_ACCOUNT_KEYS.has(path.credentialKey),
);

type EnsuredAccount = {
  account: TestAccount;
  userId: string;
};

type MembershipPlanSeed = {
  description: string;
  durationDays: number;
  features: Prisma.InputJsonValue;
  id: string;
  includesCoaching: boolean;
  name: string;
  price: Prisma.Decimal;
  sortOrder: number;
};

const MEMBERSHIP_PLAN_SEEDS: readonly MembershipPlanSeed[] = [
  {
    id: seedId('membership-plan:starter-monthly'),
    name: 'Starter Monthly',
    description:
      'General gym access with member-card-based attendance and standard amenities.',
    durationDays: 30,
    features: {
      perks: ['gym_access', 'attendance_tracking'],
    },
    includesCoaching: false,
    price: new Prisma.Decimal('799'),
    sortOrder: 1,
  },
  {
    id: seedId('membership-plan:strength-monthly'),
    name: 'Strength Monthly',
    description:
      'Higher-tier gym access for regular lifters who want more usage and tracking.',
    durationDays: 30,
    features: {
      perks: ['gym_access', 'attendance_tracking', 'priority_slots'],
    },
    includesCoaching: false,
    price: new Prisma.Decimal('1199'),
    sortOrder: 2,
  },
  {
    id: seedId('membership-plan:coaching-plus'),
    name: 'Coaching Plus',
    description:
      'Premium tier that keeps coaching-compatible plan access available for testing.',
    durationDays: 30,
    features: {
      perks: ['gym_access', 'attendance_tracking', 'coach_addon'],
    },
    includesCoaching: true,
    price: new Prisma.Decimal('1699'),
    sortOrder: 3,
  },
] as const;

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function resolveSeedMode(argv: readonly string[]): TestDataSeedMode {
  const explicitFlag = argv.find((arg) => arg.startsWith('--mode='));
  if (explicitFlag) {
    const value = explicitFlag.slice('--mode='.length);
    return value === 'reset' ? 'reset' : 'additive';
  }

  const modeIndex = argv.indexOf('--mode');
  if (modeIndex >= 0 && argv[modeIndex + 1] === 'reset') {
    return 'reset';
  }

  return 'additive';
}

function fixedTime(value: string): Date {
  return new Date(`1970-01-01T${value}.000Z`);
}

function upcomingAt(dayOffset: number, hour: number, minute = 0) {
  const target = new Date();
  target.setDate(target.getDate() + dayOffset);
  target.setHours(hour, minute, 0, 0);
  return target;
}

function analyticsAt(args: {
  dayOfMonth?: number;
  daysAgo?: number;
  hour?: number;
  minute?: number;
  monthsAgo?: number;
}) {
  const target = new Date();

  if (args.dayOfMonth !== undefined) {
    target.setUTCDate(args.dayOfMonth);
  }

  if (args.monthsAgo) {
    target.setUTCMonth(target.getUTCMonth() - args.monthsAgo);
  }

  if (args.daysAgo) {
    target.setUTCDate(target.getUTCDate() - args.daysAgo);
  }

  target.setUTCHours(args.hour ?? 9, args.minute ?? 0, 0, 0);
  return target;
}

function nutritionDate(daysAgo = 0) {
  const target = new Date();
  target.setUTCDate(target.getUTCDate() - daysAgo);
  target.setUTCHours(0, 0, 0, 0);
  return target;
}

function planByName(name: MembershipPlanSeed['name']) {
  const plan = MEMBERSHIP_PLAN_SEEDS.find(
    (candidate) => candidate.name === name,
  );
  if (!plan) {
    throw new Error(`Unknown membership plan seed: ${name}`);
  }
  return plan;
}

async function ensureTestAccount(
  account: TestAccount,
): Promise<EnsuredAccount> {
  const existingIdentity = await prisma.authIdentity.findFirst({
    where: {
      provider: AuthProvider.email,
      identifier: account.email,
    },
    select: {
      id: true,
      user_id: true,
    },
  });

  const userId = existingIdentity?.user_id ?? seedId(`user:${account.key}`);
  const verifiedAt = new Date();
  const credentialHash = await bcrypt.hash(
    account.password,
    PASSWORD_HASH_ROUNDS,
  );

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      role: account.role,
      status: UserStatus.active,
      deletedAt: null,
      email_verified_at: verifiedAt,
      qr_code_token: randomUUID(),
    },
    create: {
      id: userId,
      role: account.role,
      status: UserStatus.active,
      email_verified_at: verifiedAt,
      qr_code_token: randomUUID(),
    },
  });

  if (existingIdentity) {
    await prisma.authIdentity.update({
      where: { id: existingIdentity.id },
      data: {
        credential_hash: credentialHash,
        verified_at: verifiedAt,
        is_primary: true,
      },
    });
  } else {
    await prisma.authIdentity.create({
      data: {
        id: seedId(`auth-identity:${account.key}`),
        user_id: userId,
        provider: AuthProvider.email,
        identifier: account.email,
        credential_hash: credentialHash,
        verified_at: verifiedAt,
        is_primary: true,
      },
    });
  }

  await prisma.userProfile.upsert({
    where: { user_id: userId },
    update: {
      first_name: account.firstName,
      last_name: account.lastName,
      phone: account.phone,
    },
    create: {
      id: seedId(`user-profile:${account.key}`),
      user_id: userId,
      first_name: account.firstName,
      last_name: account.lastName,
      phone: account.phone,
    },
  });

  await prisma.notificationPreference.upsert({
    where: { user_id: userId },
    update: {},
    create: {
      id: seedId(`notification-pref:${account.key}`),
      user_id: userId,
    },
  });

  return { account, userId };
}

async function ensureMembershipPlans() {
  for (const plan of MEMBERSHIP_PLAN_SEEDS) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        description: plan.description,
        duration_days: plan.durationDays,
        features: plan.features,
        includes_coaching: plan.includesCoaching,
        is_active: true,
        price: plan.price,
        sort_order: plan.sortOrder,
      },
      create: {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        duration_days: plan.durationDays,
        features: plan.features,
        includes_coaching: plan.includesCoaching,
        is_active: true,
        price: plan.price,
        sort_order: plan.sortOrder,
      },
    });
  }
}

async function cleanupDeprecatedCoachSeeds() {
  const seededCoachUserIds = LEGACY_COACH_SEED_ACCOUNTS.map((account) =>
    seedId(`user:${account.key}`),
  );
  const coachEmails = LEGACY_COACH_SEED_ACCOUNTS.map(
    (account) => account.email,
  );

  const legacyAuthIdentities = await prisma.authIdentity.findMany({
    where: {
      provider: AuthProvider.email,
      identifier: {
        in: coachEmails,
      },
    },
    select: {
      user_id: true,
    },
  });

  const coachUserIds = Array.from(
    new Set([
      ...seededCoachUserIds,
      ...legacyAuthIdentities.map((row) => row.user_id),
    ]),
  );

  if (!coachUserIds.length) {
    return;
  }

  const coachProfiles = await prisma.coachProfile.findMany({
    where: {
      user_id: {
        in: coachUserIds,
      },
    },
    select: {
      id: true,
    },
  });

  const coachProfileIds = coachProfiles.map((profile) => profile.id);

  if (coachProfileIds.length) {
    await prisma.coachReview.deleteMany({
      where: {
        coach_id: {
          in: coachProfileIds,
        },
      },
    });

    await prisma.coachAppointment.deleteMany({
      where: {
        coach_id: {
          in: coachProfileIds,
        },
      },
    });

    await prisma.coachAvailabilitySlot.deleteMany({
      where: {
        coach_id: {
          in: coachProfileIds,
        },
      },
    });

    await prisma.coachClientRelationship.deleteMany({
      where: {
        coach_id: {
          in: coachProfileIds,
        },
      },
    });

    await prisma.amenityBooking.deleteMany({
      where: {
        coach_id: {
          in: coachProfileIds,
        },
      },
    });

    await prisma.coachProfile.deleteMany({
      where: {
        id: {
          in: coachProfileIds,
        },
      },
    });
  }

  await prisma.trainingPlan.updateMany({
    where: {
      coach_id: {
        in: coachUserIds,
      },
    },
    data: {
      coach_id: null,
    },
  });

  await prisma.authIdentity.deleteMany({
    where: {
      OR: [
        {
          user_id: {
            in: coachUserIds,
          },
        },
        {
          identifier: {
            in: coachEmails,
          },
        },
      ],
    },
  });

  try {
    await prisma.user.deleteMany({
      where: {
        id: {
          in: coachUserIds,
        },
      },
    });
  } catch {
    await prisma.user.updateMany({
      where: {
        id: {
          in: coachUserIds,
        },
      },
      data: {
        deletedAt: new Date(),
        qr_code_token: null,
        status: UserStatus.suspended,
      },
    });
  }
}

async function cleanupGymOperationsData() {
  await prisma.payment.deleteMany({
    where: {
      payable_type: {
        in: [PayableType.booking, PayableType.coaching],
      },
    },
  });
  await prisma.coachReview.deleteMany({});
  await prisma.coachAppointment.deleteMany({});
  await prisma.recurringCoachingPlan.deleteMany({});
  await prisma.coachClientRelationship.deleteMany({});
  await prisma.coachAvailabilitySlot.deleteMany({});
  await prisma.amenityBooking.deleteMany({});
  await prisma.coachProfile.deleteMany({});
}

async function cleanupPreviousSeedAnalyticsData() {
  await prisma.saleTransactionItem.deleteMany({});
  await prisma.saleTransaction.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.attendanceLog.deleteMany({});
  await prisma.accountDeletionRequest.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.membershipCard.deleteMany({});

  const allSeedEmails = TEST_ACCOUNTS.map((account) => account.email);
  const staleSeedEmails = TEST_ACCOUNTS.filter(
    (account) => !BASELINE_TEST_ACCOUNT_KEYS.has(account.key),
  ).map((account) => account.email);

  const identityRows = await prisma.authIdentity.findMany({
    where: {
      provider: AuthProvider.email,
      identifier: { in: allSeedEmails },
    },
    select: { identifier: true, user_id: true },
  });

  const allSeedUserIds = Array.from(
    new Set([
      ...TEST_ACCOUNTS.map((account) => seedId(`user:${account.key}`)),
      ...identityRows.map((row) => row.user_id),
    ]),
  );
  const staleSeedUserIds = Array.from(
    new Set([
      ...TEST_ACCOUNTS.filter(
        (account) => !BASELINE_TEST_ACCOUNT_KEYS.has(account.key),
      ).map((account) => seedId(`user:${account.key}`)),
      ...identityRows
        .filter((row) => staleSeedEmails.includes(row.identifier))
        .map((row) => row.user_id),
    ]),
  );

  const seedPayments = await prisma.payment.findMany({
    where: {
      OR: [
        { user_id: { in: allSeedUserIds } },
        { provider_ref: { startsWith: 'seed-' } },
        { gateway_event_id: { startsWith: 'event-' } },
        { idempotency_key: { startsWith: 'idempotency-' } },
      ],
    },
    select: { id: true },
  });
  const seedPaymentIds = seedPayments.map((payment) => payment.id);
  const seedSales = await prisma.saleTransaction.findMany({
    where: {
      OR: [
        { customer_user_id: { in: allSeedUserIds } },
        ...(seedPaymentIds.length
          ? [{ payment_id: { in: seedPaymentIds } }]
          : []),
      ],
    },
    select: { id: true },
  });
  const seedSaleIds = seedSales.map((sale) => sale.id);

  if (seedSaleIds.length) {
    await prisma.saleTransactionItem.deleteMany({
      where: { transaction_id: { in: seedSaleIds } },
    });
    await prisma.saleTransaction.deleteMany({
      where: { id: { in: seedSaleIds } },
    });
  }

  await prisma.payment.deleteMany({
    where: {
      OR: [
        { user_id: { in: allSeedUserIds } },
        { provider_ref: { startsWith: 'seed-' } },
        { gateway_event_id: { startsWith: 'event-' } },
        { idempotency_key: { startsWith: 'idempotency-' } },
      ],
    },
  });
  await prisma.attendanceLog.deleteMany({
    where: {
      OR: [
        { user_id: { in: allSeedUserIds } },
        { scanned_by: { in: allSeedUserIds } },
      ],
    },
  });
  await prisma.coachReview.deleteMany({
    where: { reviewer_id: { in: allSeedUserIds } },
  });
  await prisma.recurringCoachingPlan.deleteMany({
    where: { member_id: { in: allSeedUserIds } },
  });
  await prisma.coachAppointment.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.amenityBooking.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.accountDeletionRequest.deleteMany({
    where: { userId: { in: allSeedUserIds } },
  });
  await prisma.subscription.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.membershipCard.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.poseSession.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.exerciseLog.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.workoutSession.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.trainingPlan.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.muscleMasteryProgress.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.nutritionLog.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.macroTarget.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.tdeeProfile.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });
  await prisma.progressMetric.deleteMany({
    where: { user_id: { in: allSeedUserIds } },
  });

  if (staleSeedUserIds.length) {
    await prisma.authIdentity.deleteMany({
      where: {
        OR: [
          { user_id: { in: staleSeedUserIds } },
          { identifier: { in: staleSeedEmails } },
        ],
      },
    });
    await prisma.notificationPreference.deleteMany({
      where: { user_id: { in: staleSeedUserIds } },
    });
    await prisma.userProfile.deleteMany({
      where: { user_id: { in: staleSeedUserIds } },
    });

    try {
      await prisma.user.deleteMany({
        where: { id: { in: staleSeedUserIds } },
      });
    } catch {
      await prisma.user.updateMany({
        where: { id: { in: staleSeedUserIds } },
        data: {
          deletedAt: new Date(),
          qr_code_token: null,
          status: UserStatus.suspended,
        },
      });
    }
  }
}

async function cleanupUsersOutsideBaseline(
  ensuredAccounts: readonly EnsuredAccount[],
) {
  const baselineUserIds = ensuredAccounts.map(({ userId }) => userId);
  const nonBaselineUsers = await prisma.user.findMany({
    where: {
      id: {
        notIn: baselineUserIds,
      },
    },
    select: { id: true },
  });
  const nonBaselineUserIds = nonBaselineUsers.map((user) => user.id);

  if (!nonBaselineUserIds.length) {
    return;
  }

  await prisma.businessInsightRun.deleteMany({});
  await prisma.gymChatInteractionLog.deleteMany({});
  await prisma.gymChatMessage.deleteMany({});
  await prisma.gymChatSession.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.aiInteractionLog.deleteMany({});
  await prisma.aiChatMessage.deleteMany({});
  await prisma.aiChatSession.deleteMany({});
  await prisma.equipmentWriteOff.deleteMany({});
  await prisma.saleTransactionItem.deleteMany({});
  await prisma.saleTransaction.deleteMany({});
  await prisma.nutritionLog.deleteMany({});
  await prisma.macroTarget.deleteMany({});
  await prisma.tdeeProfile.deleteMany({});
  await prisma.moderationActionRecord.deleteMany({});
  await prisma.integrityEvent.deleteMany({});
  await prisma.integrityCase.deleteMany({});
  await prisma.integrityProfile.deleteMany({});
  await prisma.rankingProfile.deleteMany({});
  await prisma.userMilestoneProgress.deleteMany({});
  await prisma.seasonalStanding.deleteMany({});
  await prisma.progressionGrantLedger.deleteMany({});
  await prisma.progressionSourceEvent.deleteMany({});
  await prisma.userProgressionProfile.deleteMany({});
  await prisma.muscleMasteryProgress.deleteMany({});
  await prisma.exerciseReviewSubmission.deleteMany({});
  await prisma.poseSession.deleteMany({});
  await prisma.exerciseLog.deleteMany({});
  await prisma.workoutSession.deleteMany({});
  await prisma.planExercise.deleteMany({});
  await prisma.trainingScheduleDay.deleteMany({});
  await prisma.trainingPlan.deleteMany({});
  await prisma.coachReview.deleteMany({});
  await prisma.recurringCoachingBillingCycle.deleteMany({});
  await prisma.coachAppointment.deleteMany({});
  await prisma.recurringCoachingPlan.deleteMany({});
  await prisma.coachClientRelationship.deleteMany({});
  await prisma.coachAvailabilitySlot.deleteMany({});
  await prisma.amenityBooking.deleteMany({});
  await prisma.coachProfile.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.membershipCard.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.attendanceLog.deleteMany({});
  await prisma.progressMetric.deleteMany({});
  await prisma.accountDeletionRequest.deleteMany({});
  await prisma.otpVerification.deleteMany({
    where: { user_id: { in: nonBaselineUserIds } },
  });
  await prisma.refreshToken.deleteMany({
    where: { user_id: { in: nonBaselineUserIds } },
  });
  await prisma.authIdentity.deleteMany({
    where: { user_id: { in: nonBaselineUserIds } },
  });
  await prisma.notificationPreference.deleteMany({
    where: { user_id: { in: nonBaselineUserIds } },
  });
  await prisma.userProfile.deleteMany({
    where: { user_id: { in: nonBaselineUserIds } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: nonBaselineUserIds } },
  });
}

async function ensureCoachProfiles(ensuredAccounts: readonly EnsuredAccount[]) {
  await ensureReservableAmenities();
  const coachProfiles: Record<string, string> = {};

  const coachSeeds = [
    {
      accountKey: 'staff',
      contactEmail: 'coach.profile.alpha@fittrack.local',
      contactPhone: '+639170000101',
      displayName: 'Coach Profile Alpha',
      averageRating: new Prisma.Decimal('4.90'),
      bio: 'Standalone coach profile used to review bookings, readiness, and weekly availability from the staff console.',
      certification: 'NASM-CPT',
      hourlyRate: new Prisma.Decimal('850'),
      isAvailableForBooking: true,
      ratingCount: 18,
      specialization: 'Mobility, strength fundamentals, onboarding sessions',
    },
    {
      accountKey: 'coach',
      contactEmail: 'seed.coach@fittrack.com',
      contactPhone: '+639110000003',
      displayName: 'Coach Mia',
      averageRating: new Prisma.Decimal('4.88'),
      bio: 'Seeded coach-role profile used to verify that coach login and Gym Operations coach records share the same account role.',
      certification: 'NASM-CPT',
      hourlyRate: new Prisma.Decimal('875'),
      isAvailableForBooking: true,
      ratingCount: 14,
      specialization: 'Strength onboarding, form checks, member progression',
    },
    {
      accountKey: 'member-nomembership',
      contactEmail: 'coach.profile.bravo@fittrack.local',
      contactPhone: '+639170000102',
      displayName: 'Coach Profile Bravo',
      averageRating: new Prisma.Decimal('4.72'),
      bio: 'Standalone coach profile used for gym-operations staffing checks and venue-linked sessions.',
      certification: 'ACE-CPT',
      hourlyRate: new Prisma.Decimal('900'),
      isAvailableForBooking: true,
      ratingCount: 11,
      specialization: 'Conditioning, boxing, athletic movement',
    },
    {
      accountKey: 'member-expired',
      contactEmail: 'coach.profile.charlie@fittrack.local',
      contactPhone: '+639170000103',
      displayName: 'Coach Profile Charlie',
      averageRating: new Prisma.Decimal('4.81'),
      bio: 'Standalone coach profile for recovery and lower-intensity mobility blocks that still need booking visibility checks.',
      certification: 'Yoga Alliance',
      hourlyRate: new Prisma.Decimal('780'),
      isAvailableForBooking: true,
      ratingCount: 9,
      specialization: 'Yoga flow, recovery sessions, breathing work',
    },
  ] as const;

  for (const seed of coachSeeds) {
    const ensured = ensuredAccounts.find(
      ({ account }) => account.key === seed.accountKey,
    );

    if (!ensured) {
      continue;
    }

    const profile = await prisma.coachProfile.upsert({
      where: { user_id: ensured.userId },
      update: {
        specialization: seed.specialization,
        bio: seed.bio,
        certification: seed.certification,
        contact_email: seed.contactEmail,
        contact_phone: seed.contactPhone,
        display_name: seed.displayName,
        hourly_rate: seed.hourlyRate,
        gym_commission_pct: new Prisma.Decimal('20'),
        average_rating: seed.averageRating,
        rating_count: seed.ratingCount,
        is_available_for_booking: seed.isAvailableForBooking,
      },
      create: {
        id: seedId(`coach-profile:${seed.accountKey}`),
        user_id: ensured.userId,
        specialization: seed.specialization,
        bio: seed.bio,
        certification: seed.certification,
        contact_email: seed.contactEmail,
        contact_phone: seed.contactPhone,
        display_name: seed.displayName,
        hourly_rate: seed.hourlyRate,
        gym_commission_pct: new Prisma.Decimal('20'),
        average_rating: seed.averageRating,
        rating_count: seed.ratingCount,
        is_available_for_booking: seed.isAvailableForBooking,
      },
      select: { id: true },
    });

    coachProfiles[seed.accountKey] = profile.id;
  }

  const coachProfileIds = Object.values(coachProfiles);
  if (coachProfileIds.length) {
    await prisma.coachAvailabilitySlot.deleteMany({
      where: { coach_id: { in: coachProfileIds } },
    });
  }

  const availabilitySeeds = [
    {
      id: seedId('coach-slot:staff:monday'),
      coachId: coachProfiles['staff'],
      dayOfWeek: 1,
      startTime: '08:00:00',
      endTime: '12:00:00',
    },
    {
      id: seedId('coach-slot:staff:wednesday'),
      coachId: coachProfiles['staff'],
      dayOfWeek: 3,
      startTime: '14:00:00',
      endTime: '18:00:00',
    },
    {
      id: seedId('coach-slot:staff:friday'),
      coachId: coachProfiles['staff'],
      dayOfWeek: 5,
      startTime: '07:00:00',
      endTime: '11:00:00',
    },
    {
      id: seedId('coach-slot:coach:monday'),
      coachId: coachProfiles['coach'],
      dayOfWeek: 1,
      startTime: '13:00:00',
      endTime: '17:00:00',
    },
    {
      id: seedId('coach-slot:coach:thursday'),
      coachId: coachProfiles['coach'],
      dayOfWeek: 4,
      startTime: '08:00:00',
      endTime: '12:00:00',
    },
    {
      id: seedId('coach-slot:member-nomembership:tuesday'),
      coachId: coachProfiles['member-nomembership'],
      dayOfWeek: 2,
      startTime: '10:00:00',
      endTime: '14:00:00',
    },
    {
      id: seedId('coach-slot:member-nomembership:thursday'),
      coachId: coachProfiles['member-nomembership'],
      dayOfWeek: 4,
      startTime: '16:00:00',
      endTime: '20:00:00',
    },
    {
      id: seedId('coach-slot:member-expired:saturday'),
      coachId: coachProfiles['member-expired'],
      dayOfWeek: 6,
      startTime: '09:00:00',
      endTime: '13:00:00',
    },
  ].filter(
    (
      slot,
    ): slot is {
      id: string;
      coachId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    } => Boolean(slot.coachId),
  );

  if (availabilitySeeds.length) {
    await prisma.coachAvailabilitySlot.createMany({
      data: availabilitySeeds.map((slot) => ({
        id: slot.id,
        coach_id: slot.coachId,
        day_of_week: slot.dayOfWeek,
        start_time: fixedTime(slot.startTime),
        end_time: fixedTime(slot.endTime),
        is_active: true,
      })),
    });
  }

  const memberActiveId =
    ensuredAccounts.find(({ account }) => account.key === 'member-active')
      ?.userId ?? null;
  const memberPremiumId =
    ensuredAccounts.find(({ account }) => account.key === 'member-premium')
      ?.userId ?? null;
  const memberPendingId =
    ensuredAccounts.find(({ account }) => account.key === 'member-pending')
      ?.userId ?? null;

  const appointmentSeeds: Array<{
    id: string;
    userId: string;
    coachId: string;
    status: AppointmentStatus;
    scheduledAt: Date;
    durationMinutes: number;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    gymRevenue: Prisma.Decimal;
    coachEarnings: Prisma.Decimal;
    downpaymentPaidAt?: Date;
    balancePaidAt?: Date;
    completedAt?: Date;
    memberNotes?: string;
    sessionNotes?: string;
  }> = [];

  if (memberActiveId && coachProfiles['staff']) {
    appointmentSeeds.push({
      id: seedId('coach-appointment:member-active:staff:confirmed'),
      userId: memberActiveId,
      coachId: coachProfiles['staff'],
      status: AppointmentStatus.confirmed,
      scheduledAt: upcomingAt(0, 7),
      durationMinutes: 60,
      totalAmount: new Prisma.Decimal('850'),
      downpaymentAmount: new Prisma.Decimal('300'),
      balanceAmount: new Prisma.Decimal('550'),
      gymRevenue: new Prisma.Decimal('170'),
      coachEarnings: new Prisma.Decimal('680'),
      downpaymentPaidAt: upcomingAt(-1, 12),
      memberNotes: 'Floor-first strength session and movement audit.',
    });
  }

  if (memberPremiumId && coachProfiles['member-nomembership']) {
    appointmentSeeds.push({
      id: seedId(
        'coach-appointment:member-premium:member-nomembership:pending-coach',
      ),
      userId: memberPremiumId,
      coachId: coachProfiles['member-nomembership'],
      status: AppointmentStatus.pending_coach,
      scheduledAt: upcomingAt(1, 9),
      durationMinutes: 60,
      totalAmount: new Prisma.Decimal('900'),
      downpaymentAmount: new Prisma.Decimal('300'),
      balanceAmount: new Prisma.Decimal('600'),
      gymRevenue: new Prisma.Decimal('180'),
      coachEarnings: new Prisma.Decimal('720'),
      memberNotes: 'Bag-work refinement and conditioning check.',
    });
  }

  if (memberPendingId && coachProfiles['member-expired']) {
    appointmentSeeds.push({
      id: seedId(
        'coach-appointment:member-pending:member-expired:pending-payment',
      ),
      userId: memberPendingId,
      coachId: coachProfiles['member-expired'],
      status: AppointmentStatus.pending_payment,
      scheduledAt: upcomingAt(2, 11),
      durationMinutes: 45,
      totalAmount: new Prisma.Decimal('780'),
      downpaymentAmount: new Prisma.Decimal('280'),
      balanceAmount: new Prisma.Decimal('500'),
      gymRevenue: new Prisma.Decimal('156'),
      coachEarnings: new Prisma.Decimal('624'),
      memberNotes: 'Recovery block waiting on payment confirmation.',
    });
  }

  if (memberActiveId && coachProfiles['member-expired']) {
    appointmentSeeds.push({
      id: seedId('coach-appointment:member-active:member-expired:completed'),
      userId: memberActiveId,
      coachId: coachProfiles['member-expired'],
      status: AppointmentStatus.completed,
      scheduledAt: upcomingAt(-2, 8),
      durationMinutes: 50,
      totalAmount: new Prisma.Decimal('780'),
      downpaymentAmount: new Prisma.Decimal('780'),
      balanceAmount: new Prisma.Decimal('0'),
      gymRevenue: new Prisma.Decimal('156'),
      coachEarnings: new Prisma.Decimal('624'),
      downpaymentPaidAt: upcomingAt(-3, 10),
      balancePaidAt: upcomingAt(-3, 10),
      completedAt: upcomingAt(-2, 9),
      memberNotes: 'Mobility reset before the next strength block.',
      sessionNotes: 'Good breathing control and hip mobility gains.',
    });
  }

  for (const appointment of appointmentSeeds) {
    await prisma.coachAppointment.upsert({
      where: { id: appointment.id },
      update: {
        user_id: appointment.userId,
        coach_id: appointment.coachId,
        status: appointment.status,
        scheduled_at: appointment.scheduledAt,
        duration_minutes: appointment.durationMinutes,
        total_amount: appointment.totalAmount,
        downpayment_amount: appointment.downpaymentAmount,
        balance_amount: appointment.balanceAmount,
        gym_revenue: appointment.gymRevenue,
        coach_earnings: appointment.coachEarnings,
        downpayment_paid_at: appointment.downpaymentPaidAt ?? null,
        balance_paid_at: appointment.balancePaidAt ?? null,
        completed_at: appointment.completedAt ?? null,
        member_notes: appointment.memberNotes ?? null,
        session_notes: appointment.sessionNotes ?? null,
      },
      create: {
        id: appointment.id,
        user_id: appointment.userId,
        coach_id: appointment.coachId,
        status: appointment.status,
        scheduled_at: appointment.scheduledAt,
        duration_minutes: appointment.durationMinutes,
        total_amount: appointment.totalAmount,
        downpayment_amount: appointment.downpaymentAmount,
        balance_amount: appointment.balanceAmount,
        gym_revenue: appointment.gymRevenue,
        coach_earnings: appointment.coachEarnings,
        downpayment_paid_at: appointment.downpaymentPaidAt ?? null,
        balance_paid_at: appointment.balancePaidAt ?? null,
        completed_at: appointment.completedAt ?? null,
        member_notes: appointment.memberNotes ?? null,
        session_notes: appointment.sessionNotes ?? null,
      },
    });
  }

  if (memberActiveId && coachProfiles['member-expired']) {
    await prisma.coachReview.upsert({
      where: {
        appointment_id: seedId(
          'coach-appointment:member-active:member-expired:completed',
        ),
      },
      update: {
        rating: 5,
        comment: 'Calm cues and a solid recovery-focused session.',
      },
      create: {
        id: seedId('coach-review:member-active:member-expired:completed'),
        coach_id: coachProfiles['member-expired'],
        reviewer_id: memberActiveId,
        appointment_id: seedId(
          'coach-appointment:member-active:member-expired:completed',
        ),
        rating: 5,
        comment: 'Calm cues and a solid recovery-focused session.',
      },
    });
  }

  return coachProfiles;
}

async function ensureReservableAmenities() {
  const amenitySeeds = [
    {
      key: 'venue-booking:basketball-court',
      name: 'Basketball Court',
      type: AmenityType.basketball_court,
      capacity: 10,
      hourlyRate: new Prisma.Decimal('1500'),
      floorId: 'court-a',
    },
    {
      key: 'venue-booking:boxing-ring',
      name: 'Boxing Ring',
      type: AmenityType.boxing_ring,
      capacity: 4,
      hourlyRate: new Prisma.Decimal('1200'),
      floorId: 'ring-a',
    },
    {
      key: 'venue-booking:yoga-room',
      name: 'Yoga Room',
      type: AmenityType.other,
      capacity: 18,
      hourlyRate: new Prisma.Decimal('900'),
      floorId: 'studio-y',
    },
  ] as const;

  for (const amenity of amenitySeeds) {
    const existing = await prisma.amenity.findFirst({
      where: { name: amenity.name },
      select: { id: true },
    });
    const amenityId = existing?.id ?? seedId(`amenity:${amenity.key}`);

    await prisma.amenity.upsert({
      where: { id: amenityId },
      update: {
        capacity: amenity.capacity,
        floor_id: amenity.floorId,
        hourly_rate: amenity.hourlyRate,
        is_active: true,
        is_reservable: true,
        name: amenity.name,
        type: amenity.type,
      },
      create: {
        id: amenityId,
        capacity: amenity.capacity,
        floor_id: amenity.floorId,
        hourly_rate: amenity.hourlyRate,
        is_active: true,
        is_reservable: true,
        name: amenity.name,
        type: amenity.type,
      },
    });
  }
}

async function ensureGymOperationsVenueBookings(
  ensuredAccounts: readonly EnsuredAccount[],
  coachProfiles: Record<string, string>,
) {
  const memberActiveId =
    ensuredAccounts.find(({ account }) => account.key === 'member-active')
      ?.userId ?? null;
  const memberPremiumId =
    ensuredAccounts.find(({ account }) => account.key === 'member-premium')
      ?.userId ?? null;
  const memberPendingId =
    ensuredAccounts.find(({ account }) => account.key === 'member-pending')
      ?.userId ?? null;

  const amenitySeeds = [
    {
      key: 'venue-booking:basketball-court',
      name: 'Basketball Court',
      type: AmenityType.basketball_court,
      capacity: 10,
      hourlyRate: new Prisma.Decimal('1500'),
      floorId: 'court-a',
    },
    {
      key: 'venue-booking:boxing-ring',
      name: 'Boxing Ring',
      type: AmenityType.boxing_ring,
      capacity: 4,
      hourlyRate: new Prisma.Decimal('1200'),
      floorId: 'ring-a',
    },
    {
      key: 'venue-booking:yoga-room',
      name: 'Yoga Room',
      type: AmenityType.other,
      capacity: 18,
      hourlyRate: new Prisma.Decimal('900'),
      floorId: 'studio-y',
    },
  ] as const;

  const amenityIds = new Map<string, string>();

  for (const amenity of amenitySeeds) {
    const existing = await prisma.amenity.findFirst({
      where: { name: amenity.name },
      select: { id: true },
    });
    const amenityId = existing?.id ?? seedId(`amenity:${amenity.key}`);

    await prisma.amenity.upsert({
      where: { id: amenityId },
      update: {
        name: amenity.name,
        type: amenity.type,
        capacity: amenity.capacity,
        hourly_rate: amenity.hourlyRate,
        is_active: true,
        is_reservable: true,
        floor_id: amenity.floorId,
      },
      create: {
        id: amenityId,
        name: amenity.name,
        type: amenity.type,
        capacity: amenity.capacity,
        hourly_rate: amenity.hourlyRate,
        is_active: true,
        is_reservable: true,
        floor_id: amenity.floorId,
      },
    });

    amenityIds.set(amenity.key, amenityId);
  }

  const bookingSeeds: Array<{
    id: string;
    userId: string;
    amenityId: string;
    coachId: string | null;
    status: BookingStatus;
    startsAt: Date;
    endsAt: Date;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    downpaymentPaidAt?: Date;
    balancePaidAt?: Date;
    completedAt?: Date;
    cancelledAt?: Date;
    notes?: string;
  }> = [];

  if (memberActiveId && amenityIds.get('venue-booking:basketball-court')) {
    bookingSeeds.push({
      id: seedId('amenity-booking:member-active:basketball'),
      userId: memberActiveId,
      amenityId: amenityIds.get('venue-booking:basketball-court')!,
      coachId: coachProfiles['staff'] ?? null,
      status: BookingStatus.pending,
      startsAt: upcomingAt(0, 7),
      endsAt: upcomingAt(0, 9),
      totalAmount: new Prisma.Decimal('3000'),
      downpaymentAmount: new Prisma.Decimal('1200'),
      balanceAmount: new Prisma.Decimal('1800'),
      notes: 'Half-court booking for strength circuit and shooting work.',
    });
  }

  if (memberPremiumId && amenityIds.get('venue-booking:boxing-ring')) {
    bookingSeeds.push({
      id: seedId('amenity-booking:member-premium:boxing-ring'),
      userId: memberPremiumId,
      amenityId: amenityIds.get('venue-booking:boxing-ring')!,
      coachId: coachProfiles['member-nomembership'] ?? null,
      status: BookingStatus.confirmed,
      startsAt: upcomingAt(1, 10),
      endsAt: upcomingAt(1, 11),
      totalAmount: new Prisma.Decimal('1200'),
      downpaymentAmount: new Prisma.Decimal('600'),
      balanceAmount: new Prisma.Decimal('600'),
      downpaymentPaidAt: upcomingAt(-1, 13),
      notes: 'Boxing ring reserved for mitts and conditioning block.',
    });
  }

  if (memberActiveId && amenityIds.get('venue-booking:yoga-room')) {
    bookingSeeds.push({
      id: seedId('amenity-booking:member-active:yoga-room'),
      userId: memberActiveId,
      amenityId: amenityIds.get('venue-booking:yoga-room')!,
      coachId: coachProfiles['member-expired'] ?? null,
      status: BookingStatus.completed,
      startsAt: upcomingAt(-1, 6),
      endsAt: upcomingAt(-1, 7),
      totalAmount: new Prisma.Decimal('900'),
      downpaymentAmount: new Prisma.Decimal('900'),
      balanceAmount: new Prisma.Decimal('0'),
      downpaymentPaidAt: upcomingAt(-2, 15),
      balancePaidAt: upcomingAt(-2, 15),
      completedAt: upcomingAt(-1, 7),
      notes: 'Recovery yoga block completed successfully.',
    });
  }

  if (memberPendingId && amenityIds.get('venue-booking:basketball-court')) {
    bookingSeeds.push({
      id: seedId('amenity-booking:member-pending:basketball'),
      userId: memberPendingId,
      amenityId: amenityIds.get('venue-booking:basketball-court')!,
      coachId: null,
      status: BookingStatus.cancelled,
      startsAt: upcomingAt(2, 12),
      endsAt: upcomingAt(2, 13),
      totalAmount: new Prisma.Decimal('1500'),
      downpaymentAmount: new Prisma.Decimal('0'),
      balanceAmount: new Prisma.Decimal('1500'),
      cancelledAt: upcomingAt(1, 16),
      notes: 'Cancelled venue request left in the queue for ops review.',
    });
  }

  for (const booking of bookingSeeds) {
    await prisma.amenityBooking.upsert({
      where: { id: booking.id },
      update: {
        user_id: booking.userId,
        amenity_id: booking.amenityId,
        coach_id: booking.coachId,
        status: booking.status,
        starts_at: booking.startsAt,
        ends_at: booking.endsAt,
        total_amount: booking.totalAmount,
        downpayment_amount: booking.downpaymentAmount,
        balance_amount: booking.balanceAmount,
        downpayment_paid_at: booking.downpaymentPaidAt ?? null,
        balance_paid_at: booking.balancePaidAt ?? null,
        completed_at: booking.completedAt ?? null,
        cancelled_at: booking.cancelledAt ?? null,
        notes: booking.notes ?? null,
      },
      create: {
        id: booking.id,
        user_id: booking.userId,
        amenity_id: booking.amenityId,
        coach_id: booking.coachId,
        status: booking.status,
        starts_at: booking.startsAt,
        ends_at: booking.endsAt,
        total_amount: booking.totalAmount,
        downpayment_amount: booking.downpaymentAmount,
        balance_amount: booking.balanceAmount,
        downpayment_paid_at: booking.downpaymentPaidAt ?? null,
        balance_paid_at: booking.balancePaidAt ?? null,
        completed_at: booking.completedAt ?? null,
        cancelled_at: booking.cancelledAt ?? null,
        notes: booking.notes ?? null,
      },
    });
  }
}

async function ensureMemberStates(ensuredAccounts: readonly EnsuredAccount[]) {
  const adminUserId =
    ensuredAccounts.find(({ account }) => account.key === 'admin')?.userId ??
    null;

  const membershipAccounts = ensuredAccounts.filter(
    ({ account }) => account.role === UserRole.member,
  );

  await prisma.subscription.deleteMany({
    where: {
      user_id: {
        in: membershipAccounts.map(({ userId }) => userId),
      },
    },
  });

  for (const { account, userId } of membershipAccounts) {
    await prisma.accountDeletionRequest.deleteMany({
      where: { userId: userId },
    });

    const now = new Date();

    if (account.key === 'member-active') {
      await prisma.membershipCard.upsert({
        where: { user_id: userId },
        update: {
          status: MembershipCardStatus.active,
          source: MembershipCardSource.admin_grant,
          price: new Prisma.Decimal('400'),
          purchased_at: now,
          verified_at: now,
          verified_by: adminUserId,
          activated_at: now,
          revoked_at: null,
          revoked_by: null,
          revoke_reason: null,
        },
        create: {
          id: seedId('membership-card:member-active'),
          user_id: userId,
          status: MembershipCardStatus.active,
          source: MembershipCardSource.admin_grant,
          price: new Prisma.Decimal('400'),
          purchased_at: now,
          verified_at: now,
          verified_by: adminUserId,
          activated_at: now,
        },
      });

      await prisma.subscription.create({
        data: {
          id: seedId('subscription:member-active'),
          user_id: userId,
          plan_id: planByName('Starter Monthly').id,
          status: SubscriptionStatus.active,
          starts_at: now,
          expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      continue;
    }

    if (account.key === 'member-premium') {
      await prisma.membershipCard.upsert({
        where: { user_id: userId },
        update: {
          status: MembershipCardStatus.active,
          source: MembershipCardSource.admin_grant,
          price: new Prisma.Decimal('400'),
          purchased_at: now,
          verified_at: now,
          verified_by: adminUserId,
          activated_at: now,
          revoked_at: null,
          revoked_by: null,
          revoke_reason: null,
        },
        create: {
          id: seedId('membership-card:member-premium'),
          user_id: userId,
          status: MembershipCardStatus.active,
          source: MembershipCardSource.admin_grant,
          price: new Prisma.Decimal('400'),
          purchased_at: now,
          verified_at: now,
          verified_by: adminUserId,
          activated_at: now,
        },
      });

      await prisma.subscription.create({
        data: {
          id: seedId('subscription:member-premium'),
          user_id: userId,
          plan_id: planByName('Coaching Plus').id,
          status: SubscriptionStatus.active,
          starts_at: now,
          expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      continue;
    }

    if (account.key === 'member-frozen') {
      await prisma.membershipCard.upsert({
        where: { user_id: userId },
        update: {
          status: MembershipCardStatus.active,
          source: MembershipCardSource.admin_grant,
          price: new Prisma.Decimal('400'),
          purchased_at: now,
          verified_at: now,
          verified_by: adminUserId,
          activated_at: now,
          revoked_at: null,
          revoked_by: null,
          revoke_reason: null,
        },
        create: {
          id: seedId('membership-card:member-frozen'),
          user_id: userId,
          status: MembershipCardStatus.active,
          source: MembershipCardSource.admin_grant,
          price: new Prisma.Decimal('400'),
          purchased_at: now,
          verified_at: now,
          verified_by: adminUserId,
          activated_at: now,
        },
      });

      await prisma.subscription.create({
        data: {
          id: seedId('subscription:member-frozen'),
          user_id: userId,
          plan_id: planByName('Strength Monthly').id,
          status: SubscriptionStatus.active,
          starts_at: now,
          expires_at: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      await prisma.accountDeletionRequest.create({
        data: {
          id: seedId('deletion-request:member-frozen'),
          userId: userId,
          reason:
            'Member requested a freeze review while deciding on next billing cycle.',
          status: AccountDeletionRequestStatus.pending,
        },
      });
      continue;
    }

    if (account.key === 'member-pending') {
      await prisma.membershipCard.upsert({
        where: { user_id: userId },
        update: {
          status: MembershipCardStatus.pending_verification,
          source: MembershipCardSource.cash,
          price: new Prisma.Decimal('400'),
          purchased_at: now,
          verified_at: null,
          verified_by: null,
          activated_at: null,
          revoked_at: null,
          revoked_by: null,
          revoke_reason: null,
        },
        create: {
          id: seedId('membership-card:member-pending'),
          user_id: userId,
          status: MembershipCardStatus.pending_verification,
          source: MembershipCardSource.cash,
          price: new Prisma.Decimal('400'),
          purchased_at: now,
        },
      });
      continue;
    }

    if (account.key === 'member-expired') {
      await prisma.membershipCard.upsert({
        where: { user_id: userId },
        update: {
          status: MembershipCardStatus.revoked,
          source: MembershipCardSource.admin_repair,
          price: new Prisma.Decimal('400'),
          purchased_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          verified_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          verified_by: adminUserId,
          activated_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          revoked_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          revoked_by: adminUserId,
          revoke_reason:
            'Membership card expired after the prior billing cycle ended.',
        },
        create: {
          id: seedId('membership-card:member-expired'),
          user_id: userId,
          status: MembershipCardStatus.revoked,
          source: MembershipCardSource.admin_repair,
          price: new Prisma.Decimal('400'),
          purchased_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          verified_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          verified_by: adminUserId,
          activated_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          revoked_at: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
          revoked_by: adminUserId,
          revoke_reason:
            'Membership card expired after the prior billing cycle ended.',
        },
      });

      await prisma.subscription.create({
        data: {
          id: seedId('subscription:member-expired'),
          user_id: userId,
          plan_id: planByName('Starter Monthly').id,
          status: SubscriptionStatus.expired,
          starts_at: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
          expires_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          cancelled_at: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          cancellation_reason:
            'Seeded expired state for member-card and subscription coverage.',
        },
      });
      continue;
    }

    await prisma.membershipCard.deleteMany({
      where: { user_id: userId },
    });
  }
}

async function ensureNutritionFixtures(
  ensuredAccounts: readonly EnsuredAccount[],
) {
  const memberAccounts = ensuredAccounts.filter(
    ({ account }) => account.role === UserRole.member,
  );
  const memberUserIds = memberAccounts.map(({ userId }) => userId);

  if (!memberUserIds.length) {
    return;
  }

  await prisma.nutritionLog.deleteMany({
    where: { user_id: { in: memberUserIds } },
  });
  await prisma.macroTarget.deleteMany({
    where: { user_id: { in: memberUserIds } },
  });
  await prisma.tdeeProfile.deleteMany({
    where: { user_id: { in: memberUserIds } },
  });
  await prisma.progressMetric.deleteMany({
    where: { user_id: { in: memberUserIds } },
  });

  const nutritionProfiles = {
    'member-active': {
      age: 27,
      activityLevel: ActivityLevel.moderate,
      bmrCalories: '1396.00',
      bodyFatPct: '22.40',
      carbsG: '255.00',
      chestCm: '90.00',
      dateOfBirth: '1998-07-14',
      fatG: '68.00',
      fitnessGoal: FitnessGoal.maintenance,
      gender: Gender.female,
      heightCm: '164.00',
      muscleMassKg: '39.80',
      proteinG: '132.00',
      targetCalories: '2160.00',
      tdeeCalories: '2160.00',
      waistCm: '72.00',
      weightKg: '62.00',
    },
    'member-premium': {
      age: 24,
      activityLevel: ActivityLevel.active,
      bmrCalories: '1748.00',
      bodyFatPct: '17.80',
      carbsG: '390.00',
      chestCm: '100.00',
      dateOfBirth: '2001-04-22',
      fatG: '90.00',
      fitnessGoal: FitnessGoal.bulking,
      gender: Gender.male,
      heightCm: '175.00',
      muscleMassKg: '55.20',
      proteinG: '175.00',
      targetCalories: '3075.00',
      tdeeCalories: '3015.00',
      waistCm: '80.00',
      weightKg: '74.00',
    },
    'member-frozen': {
      age: 31,
      activityLevel: ActivityLevel.light,
      bmrCalories: '1415.00',
      bodyFatPct: '25.10',
      carbsG: '185.00',
      chestCm: '93.00',
      dateOfBirth: '1994-02-03',
      fatG: '55.00',
      fitnessGoal: FitnessGoal.cutting,
      gender: Gender.female,
      heightCm: '166.00',
      muscleMassKg: '41.30',
      proteinG: '145.00',
      targetCalories: '1815.00',
      tdeeCalories: '1945.00',
      waistCm: '76.00',
      weightKg: '67.00',
    },
    'member-pending': {
      age: 22,
      activityLevel: ActivityLevel.moderate,
      bmrCalories: '1662.00',
      bodyFatPct: '19.50',
      carbsG: '280.00',
      chestCm: '96.00',
      dateOfBirth: '2003-09-01',
      fatG: '70.00',
      fitnessGoal: FitnessGoal.maintenance,
      gender: Gender.other,
      heightCm: '171.00',
      muscleMassKg: '49.20',
      proteinG: '150.00',
      targetCalories: '2350.00',
      tdeeCalories: '2350.00',
      waistCm: '79.00',
      weightKg: '70.00',
    },
    'member-nomembership': {
      age: 29,
      activityLevel: ActivityLevel.sedentary,
      bmrCalories: '1325.00',
      bodyFatPct: '28.00',
      carbsG: '190.00',
      chestCm: '88.00',
      dateOfBirth: '1996-11-19',
      fatG: '58.00',
      fitnessGoal: FitnessGoal.maintenance,
      gender: Gender.female,
      heightCm: '158.00',
      muscleMassKg: '35.60',
      proteinG: '110.00',
      targetCalories: '1720.00',
      tdeeCalories: '1720.00',
      waistCm: '74.00',
      weightKg: '58.00',
    },
    'member-expired': {
      age: 35,
      activityLevel: ActivityLevel.light,
      bmrCalories: '1548.00',
      bodyFatPct: '24.20',
      carbsG: '215.00',
      chestCm: '94.00',
      dateOfBirth: '1990-05-28',
      fatG: '62.00',
      fitnessGoal: FitnessGoal.cutting,
      gender: Gender.female,
      heightCm: '168.00',
      muscleMassKg: '42.90',
      proteinG: '140.00',
      targetCalories: '1980.00',
      tdeeCalories: '2110.00',
      waistCm: '78.00',
      weightKg: '68.00',
    },
  } satisfies Record<
    string,
    {
      activityLevel: ActivityLevel;
      age: number;
      bmrCalories: string;
      bodyFatPct: string;
      carbsG: string;
      chestCm: string;
      dateOfBirth: string;
      fatG: string;
      fitnessGoal: FitnessGoal;
      gender: Gender;
      heightCm: string;
      muscleMassKg: string;
      proteinG: string;
      targetCalories: string;
      tdeeCalories: string;
      waistCm: string;
      weightKg: string;
    }
  >;

  for (const { account, userId } of memberAccounts) {
    const profile = nutritionProfiles[account.key];

    if (!profile) {
      continue;
    }

    await prisma.userProfile.update({
      where: { user_id: userId },
      data: {
        activity_level: profile.activityLevel,
        date_of_birth: new Date(`${profile.dateOfBirth}T00:00:00.000Z`),
        fitness_goal: profile.fitnessGoal,
        gender: profile.gender,
        height_cm: new Prisma.Decimal(profile.heightCm),
        weight_kg: new Prisma.Decimal(profile.weightKg),
      },
    });

    const tdeeProfileId = seedId(`nutrition:tdee:${account.key}:active`);
    const macroTargetId = seedId(`nutrition:macro:${account.key}:active`);
    const calculatedAt = analyticsAt({ daysAgo: 1, hour: 6, minute: 30 });

    await prisma.tdeeProfile.create({
      data: {
        id: tdeeProfileId,
        user_id: userId,
        weight_kg: new Prisma.Decimal(profile.weightKg),
        height_cm: new Prisma.Decimal(profile.heightCm),
        age: profile.age,
        gender: profile.gender,
        activity_level: profile.activityLevel,
        fitness_goal: profile.fitnessGoal,
        bmr_calories: new Prisma.Decimal(profile.bmrCalories),
        tdee_calories: new Prisma.Decimal(profile.tdeeCalories),
        is_active: true,
        calculated_at: calculatedAt,
      },
    });

    await prisma.macroTarget.create({
      data: {
        id: macroTargetId,
        user_id: userId,
        tdee_profile_id: tdeeProfileId,
        target_calories: new Prisma.Decimal(profile.targetCalories),
        protein_g: new Prisma.Decimal(profile.proteinG),
        carbs_g: new Prisma.Decimal(profile.carbsG),
        fat_g: new Prisma.Decimal(profile.fatG),
        is_active: true,
      },
    });

    await prisma.progressMetric.createMany({
      data: [
        {
          id: seedId(`nutrition:progress:${account.key}:baseline`),
          user_id: userId,
          weight_kg: new Prisma.Decimal(profile.weightKg),
          height_cm: new Prisma.Decimal(profile.heightCm),
          body_fat_pct: new Prisma.Decimal(profile.bodyFatPct),
          muscle_mass_kg: new Prisma.Decimal(profile.muscleMassKg),
          waist_cm: new Prisma.Decimal(profile.waistCm),
          chest_cm: new Prisma.Decimal(profile.chestCm),
          notes: 'Baseline nutrition profile seeded for role and dashboard testing.',
          recorded_at: analyticsAt({ daysAgo: 14, hour: 8 }),
        },
        {
          id: seedId(`nutrition:progress:${account.key}:current`),
          user_id: userId,
          weight_kg: new Prisma.Decimal(profile.weightKg),
          height_cm: new Prisma.Decimal(profile.heightCm),
          body_fat_pct: new Prisma.Decimal(profile.bodyFatPct),
          muscle_mass_kg: new Prisma.Decimal(profile.muscleMassKg),
          waist_cm: new Prisma.Decimal(profile.waistCm),
          chest_cm: new Prisma.Decimal(profile.chestCm),
          notes: 'Current nutrition checkpoint aligned with the active macro target.',
          recorded_at: analyticsAt({ daysAgo: 1, hour: 8 }),
        },
      ],
    });

    const dailyModifier =
      account.key === 'member-premium'
        ? 1.18
        : account.key === 'member-frozen' || account.key === 'member-expired'
          ? 0.82
          : 1;
    const calories = Number(profile.targetCalories);
    const protein = Number(profile.proteinG);
    const carbs = Number(profile.carbsG);
    const fat = Number(profile.fatG);

    await prisma.nutritionLog.createMany({
      data: [
        {
          id: seedId(`nutrition:log:${account.key}:today-breakfast`),
          user_id: userId,
          macro_target_id: macroTargetId,
          log_date: nutritionDate(0),
          meal_name: 'Breakfast',
          food_item: 'Greek yogurt, banana, and oats',
          calories: new Prisma.Decimal(
            Math.round(calories * 0.23 * dailyModifier).toString(),
          ),
          protein_g: new Prisma.Decimal(
            Math.round(protein * 0.24 * dailyModifier).toString(),
          ),
          carbs_g: new Prisma.Decimal(
            Math.round(carbs * 0.26 * dailyModifier).toString(),
          ),
          fat_g: new Prisma.Decimal(
            Math.round(fat * 0.16 * dailyModifier).toString(),
          ),
          quantity: new Prisma.Decimal('1'),
          unit: NutritionUnit.serving,
        },
        {
          id: seedId(`nutrition:log:${account.key}:today-lunch`),
          user_id: userId,
          macro_target_id: macroTargetId,
          log_date: nutritionDate(0),
          meal_name: 'Lunch',
          food_item: 'Chicken rice bowl with vegetables',
          calories: new Prisma.Decimal(
            Math.round(calories * 0.31 * dailyModifier).toString(),
          ),
          protein_g: new Prisma.Decimal(
            Math.round(protein * 0.36 * dailyModifier).toString(),
          ),
          carbs_g: new Prisma.Decimal(
            Math.round(carbs * 0.30 * dailyModifier).toString(),
          ),
          fat_g: new Prisma.Decimal(
            Math.round(fat * 0.28 * dailyModifier).toString(),
          ),
          quantity: new Prisma.Decimal('1'),
          unit: NutritionUnit.serving,
        },
        {
          id: seedId(`nutrition:log:${account.key}:yesterday-summary`),
          user_id: userId,
          macro_target_id: macroTargetId,
          log_date: nutritionDate(1),
          meal_name: 'Daily summary',
          food_item: 'Seeded full-day meal coverage',
          calories: new Prisma.Decimal(
            Math.round(calories * 0.92 * dailyModifier).toString(),
          ),
          protein_g: new Prisma.Decimal(
            Math.round(protein * 0.96 * dailyModifier).toString(),
          ),
          carbs_g: new Prisma.Decimal(
            Math.round(carbs * 0.88 * dailyModifier).toString(),
          ),
          fat_g: new Prisma.Decimal(
            Math.round(fat * 0.90 * dailyModifier).toString(),
          ),
          quantity: new Prisma.Decimal('1'),
          unit: NutritionUnit.serving,
        },
        {
          id: seedId(`nutrition:log:${account.key}:week-history`),
          user_id: userId,
          macro_target_id: macroTargetId,
          log_date: nutritionDate(6),
          meal_name: 'Post-workout meal',
          food_item: 'Tuna sandwich and fruit',
          calories: new Prisma.Decimal(
            Math.round(calories * 0.42 * dailyModifier).toString(),
          ),
          protein_g: new Prisma.Decimal(
            Math.round(protein * 0.46 * dailyModifier).toString(),
          ),
          carbs_g: new Prisma.Decimal(
            Math.round(carbs * 0.38 * dailyModifier).toString(),
          ),
          fat_g: new Prisma.Decimal(
            Math.round(fat * 0.32 * dailyModifier).toString(),
          ),
          quantity: new Prisma.Decimal('1'),
          unit: NutritionUnit.serving,
        },
      ],
    });
  }
}

async function ensureAnalyticsFixtures(
  ensuredAccounts: readonly EnsuredAccount[],
  coachProfiles: Record<string, string>,
) {
  const adminUserId =
    ensuredAccounts.find(({ account }) => account.key === 'admin')?.userId ??
    null;
  const staffUserId =
    ensuredAccounts.find(({ account }) => account.key === 'staff')?.userId ??
    adminUserId;
  const memberActiveId =
    ensuredAccounts.find(({ account }) => account.key === 'member-active')
      ?.userId ?? null;
  const memberPremiumId =
    ensuredAccounts.find(({ account }) => account.key === 'member-premium')
      ?.userId ?? null;
  const memberFrozenId =
    ensuredAccounts.find(({ account }) => account.key === 'member-frozen')
      ?.userId ?? null;
  const memberExpiredId =
    ensuredAccounts.find(({ account }) => account.key === 'member-expired')
      ?.userId ?? null;
  const memberPendingId =
    ensuredAccounts.find(({ account }) => account.key === 'member-pending')
      ?.userId ?? null;

  const amenityRows = await prisma.amenity.findMany({
    where: {
      name: {
        in: ['Basketball Court', 'Boxing Ring', 'Yoga Room'],
      },
    },
    select: {
      id: true,
      name: true,
    },
  });
  const amenityIds = new Map(amenityRows.map((row) => [row.name, row.id]));

  const retailProducts = [
    {
      id: seedId('analytics-retail:whey-isolate'),
      name: 'FitTrack Whey Isolate',
      category: 'supplements',
      description:
        'Fast-moving protein tub frequently highlighted in the front counter lineup.',
      cost: new Prisma.Decimal('1199'),
      price: new Prisma.Decimal('1899'),
      stockQuantity: 4,
      reorderThreshold: 10,
      imageUrl: 'https://fittrack.dev/assets/whey-isolate.jpg',
      createdAt: analyticsAt({ monthsAgo: 5, dayOfMonth: 4, hour: 10 }),
    },
    {
      id: seedId('analytics-retail:creatine'),
      name: 'Creatine Monohydrate',
      category: 'supplements',
      description:
        'Daily creatine SKU used to keep supplement revenue visible in analytics.',
      cost: new Prisma.Decimal('499'),
      price: new Prisma.Decimal('799'),
      stockQuantity: 7,
      reorderThreshold: 8,
      imageUrl: 'https://fittrack.dev/assets/creatine.jpg',
      createdAt: analyticsAt({ monthsAgo: 4, dayOfMonth: 7, hour: 11 }),
    },
    {
      id: seedId('analytics-retail:energy-drink'),
      name: 'FitTrack Energy Drink',
      category: 'beverages',
      description: 'Single-serve cold beverage with steady repeat purchases.',
      cost: new Prisma.Decimal('68'),
      price: new Prisma.Decimal('120'),
      stockQuantity: 22,
      reorderThreshold: 12,
      imageUrl: 'https://fittrack.dev/assets/energy-drink.jpg',
      createdAt: analyticsAt({ monthsAgo: 3, dayOfMonth: 10, hour: 14 }),
    },
    {
      id: seedId('analytics-retail:lifting-straps'),
      name: 'Lifting Straps',
      category: 'accessories',
      description:
        'Accessory item for strength members and personal training clients.',
      cost: new Prisma.Decimal('210'),
      price: new Prisma.Decimal('450'),
      stockQuantity: 14,
      reorderThreshold: 6,
      imageUrl: 'https://fittrack.dev/assets/lifting-straps.jpg',
      createdAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 8, hour: 15 }),
    },
    {
      id: seedId('analytics-retail:recovery-balm'),
      name: 'Recovery Balm',
      category: 'recovery',
      description:
        'Recovery shelf item that intentionally sits at low stock for alert coverage.',
      cost: new Prisma.Decimal('180'),
      price: new Prisma.Decimal('349'),
      stockQuantity: 2,
      reorderThreshold: 6,
      imageUrl: 'https://fittrack.dev/assets/recovery-balm.jpg',
      createdAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 6, hour: 16 }),
    },
    {
      id: seedId('analytics-retail:shaker-bottle'),
      name: 'FitTrack Shaker Bottle',
      category: 'merchandise',
      description:
        'Branded shaker bottle used to keep merchandise visible in sales.',
      cost: new Prisma.Decimal('135'),
      price: new Prisma.Decimal('299'),
      stockQuantity: 18,
      reorderThreshold: 8,
      imageUrl: 'https://fittrack.dev/assets/shaker-bottle.jpg',
      createdAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 14, hour: 13 }),
    },
  ] as const;

  for (const product of retailProducts) {
    await prisma.retailProduct.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        category: product.category,
        description: product.description,
        cost: product.cost,
        price: product.price,
        stock_quantity: product.stockQuantity,
        reorder_threshold: product.reorderThreshold,
        image_url: product.imageUrl,
        is_active: true,
        created_at: product.createdAt,
      },
      create: {
        id: product.id,
        name: product.name,
        category: product.category,
        description: product.description,
        cost: product.cost,
        price: product.price,
        stock_quantity: product.stockQuantity,
        reorder_threshold: product.reorderThreshold,
        image_url: product.imageUrl,
        is_active: true,
        created_at: product.createdAt,
      },
    });
  }

  const equipmentItems = [
    {
      id: seedId('analytics-equipment:adjustable-bench'),
      name: 'Adjustable Bench',
      description:
        'One bench is currently pulled from the floor for upholstery replacement.',
      imageUrl: 'https://fittrack.dev/assets/adjustable-bench.jpg',
      quantityTotal: 6,
      quantityCurrent: 5,
      unit: 'benches',
      createdAt: analyticsAt({ monthsAgo: 6, dayOfMonth: 3, hour: 8 }),
    },
    {
      id: seedId('analytics-equipment:spin-bike'),
      name: 'Spin Bike',
      description:
        'Cardio bike fleet with a few units waiting on drivetrain servicing.',
      imageUrl: 'https://fittrack.dev/assets/spin-bike.jpg',
      quantityTotal: 10,
      quantityCurrent: 7,
      unit: 'bikes',
      createdAt: analyticsAt({ monthsAgo: 5, dayOfMonth: 11, hour: 8 }),
    },
    {
      id: seedId('analytics-equipment:hex-dumbbell-set'),
      name: 'Hex Dumbbell Set',
      description:
        'Strength floor dumbbells with two pairs temporarily unavailable.',
      imageUrl: 'https://fittrack.dev/assets/hex-dumbbell-set.jpg',
      quantityTotal: 20,
      quantityCurrent: 18,
      unit: 'pairs',
      createdAt: analyticsAt({ monthsAgo: 4, dayOfMonth: 9, hour: 8 }),
    },
    {
      id: seedId('analytics-equipment:concept-rower'),
      name: 'Concept Rower',
      description:
        'Cardio rowers currently fully available and used as a healthy control.',
      imageUrl: 'https://fittrack.dev/assets/concept-rower.jpg',
      quantityTotal: 4,
      quantityCurrent: 4,
      unit: 'machines',
      createdAt: analyticsAt({ monthsAgo: 4, dayOfMonth: 21, hour: 8 }),
    },
  ] as const;

  for (const equipment of equipmentItems) {
    await prisma.gymEquipmentItem.upsert({
      where: { id: equipment.id },
      update: {
        name: equipment.name,
        description: equipment.description,
        image_url: equipment.imageUrl,
        quantity_total: equipment.quantityTotal,
        quantity_current: equipment.quantityCurrent,
        unit: equipment.unit,
        is_active: true,
        created_at: equipment.createdAt,
      },
      create: {
        id: equipment.id,
        name: equipment.name,
        description: equipment.description,
        image_url: equipment.imageUrl,
        quantity_total: equipment.quantityTotal,
        quantity_current: equipment.quantityCurrent,
        unit: equipment.unit,
        is_active: true,
        created_at: equipment.createdAt,
      },
    });
  }

  const attendanceSeeds = [
    {
      id: seedId('analytics-attendance:member-active:today-0610'),
      userId: memberActiveId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ daysAgo: 0, hour: 6, minute: 10 }),
      durationMinutes: 92,
    },
    {
      id: seedId('analytics-attendance:member-premium:today-0935'),
      userId: memberPremiumId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ daysAgo: 0, hour: 9, minute: 35 }),
      durationMinutes: 78,
    },
    {
      id: seedId('analytics-attendance:member-frozen:today-1805'),
      userId: memberFrozenId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ daysAgo: 0, hour: 18, minute: 5 }),
      durationMinutes: 64,
    },
    {
      id: seedId('analytics-attendance:member-active:yesterday-0715'),
      userId: memberActiveId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ daysAgo: 1, hour: 7, minute: 15 }),
      durationMinutes: 88,
    },
    {
      id: seedId('analytics-attendance:member-premium:two-days-1010'),
      userId: memberPremiumId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ daysAgo: 2, hour: 10, minute: 10 }),
      durationMinutes: 82,
    },
    {
      id: seedId('analytics-attendance:member-active:three-days-1740'),
      userId: memberActiveId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ daysAgo: 3, hour: 17, minute: 40 }),
      durationMinutes: 70,
    },
    {
      id: seedId('analytics-attendance:member-frozen:five-days-0645'),
      userId: memberFrozenId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ daysAgo: 5, hour: 6, minute: 45 }),
      durationMinutes: 76,
    },
    {
      id: seedId('analytics-attendance:member-active:seven-days-1130'),
      userId: memberActiveId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ daysAgo: 7, hour: 11, minute: 30 }),
      durationMinutes: 84,
    },
    {
      id: seedId('analytics-attendance:member-premium:ten-days-0820'),
      userId: memberPremiumId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ daysAgo: 10, hour: 8, minute: 20 }),
      durationMinutes: 72,
    },
    {
      id: seedId('analytics-attendance:member-active:month-1'),
      userId: memberActiveId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({
        monthsAgo: 1,
        dayOfMonth: 8,
        hour: 7,
        minute: 25,
      }),
      durationMinutes: 83,
    },
    {
      id: seedId('analytics-attendance:member-premium:month-2'),
      userId: memberPremiumId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({
        monthsAgo: 2,
        dayOfMonth: 12,
        hour: 18,
        minute: 10,
      }),
      durationMinutes: 67,
    },
    {
      id: seedId('analytics-attendance:member-frozen:month-3'),
      userId: memberFrozenId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({
        monthsAgo: 3,
        dayOfMonth: 5,
        hour: 6,
        minute: 55,
      }),
      durationMinutes: 74,
    },
    {
      id: seedId('analytics-attendance:member-active:month-4'),
      userId: memberActiveId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({
        monthsAgo: 4,
        dayOfMonth: 16,
        hour: 12,
        minute: 5,
      }),
      durationMinutes: 58,
    },
    {
      id: seedId('analytics-attendance:member-premium:month-5'),
      userId: memberPremiumId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({
        monthsAgo: 5,
        dayOfMonth: 23,
        hour: 19,
        minute: 0,
      }),
      durationMinutes: 69,
    },
  ].filter(
    (
      entry,
    ): entry is {
      id: string;
      userId: string;
      scannedBy: string | null;
      checkInAt: Date;
      durationMinutes: number;
    } => Boolean(entry.userId),
  );

  for (const entry of attendanceSeeds) {
    const checkOutAt = new Date(
      entry.checkInAt.getTime() + entry.durationMinutes * 60 * 1000,
    );

    await prisma.attendanceLog.upsert({
      where: { id: entry.id },
      update: {
        user_id: entry.userId,
        scanned_by: entry.scannedBy,
        check_in_at: entry.checkInAt,
        check_out_at: checkOutAt,
        created_at: entry.checkInAt,
      },
      create: {
        id: entry.id,
        user_id: entry.userId,
        scanned_by: entry.scannedBy,
        check_in_at: entry.checkInAt,
        check_out_at: checkOutAt,
        created_at: entry.checkInAt,
      },
    });
  }

  // Disabled fixture source retained for reference only; validBookingSeeds stays empty.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const bookingSeeds: Array<{
    id: string;
    userId: string | null;
    amenityId: string | null;
    coachId: string | null;
    status: BookingStatus;
    startsAt: Date;
    endsAt: Date;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    downpaymentPaidAt: Date | null;
    balancePaidAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
    notes: string;
  }> = [
    {
      id: seedId('analytics-booking:member-active:basketball-completed'),
      userId: memberActiveId,
      amenityId: amenityIds.get('Basketball Court') ?? null,
      coachId: coachProfiles['staff'] ?? null,
      status: BookingStatus.completed,
      startsAt: analyticsAt({ dayOfMonth: 8, hour: 7, minute: 0 }),
      endsAt: analyticsAt({ dayOfMonth: 8, hour: 9, minute: 0 }),
      totalAmount: new Prisma.Decimal('3000'),
      downpaymentAmount: new Prisma.Decimal('1500'),
      balanceAmount: new Prisma.Decimal('1500'),
      downpaymentPaidAt: analyticsAt({ dayOfMonth: 6, hour: 11 }),
      balancePaidAt: analyticsAt({ dayOfMonth: 8, hour: 6, minute: 45 }),
      completedAt: analyticsAt({ dayOfMonth: 8, hour: 9, minute: 5 }),
      cancelledAt: null,
      createdAt: analyticsAt({ dayOfMonth: 4, hour: 10 }),
      notes: 'Team conditioning run seeded for current-month booking revenue.',
    },
    {
      id: seedId('analytics-booking:member-premium:boxing-last-month'),
      userId: memberPremiumId,
      amenityId: amenityIds.get('Boxing Ring') ?? null,
      coachId: coachProfiles['member-nomembership'] ?? null,
      status: BookingStatus.completed,
      startsAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 10, hour: 18 }),
      endsAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 10, hour: 19 }),
      totalAmount: new Prisma.Decimal('1200'),
      downpaymentAmount: new Prisma.Decimal('600'),
      balanceAmount: new Prisma.Decimal('600'),
      downpaymentPaidAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 8, hour: 16 }),
      balancePaidAt: analyticsAt({
        monthsAgo: 1,
        dayOfMonth: 10,
        hour: 17,
        minute: 45,
      }),
      completedAt: analyticsAt({
        monthsAgo: 1,
        dayOfMonth: 10,
        hour: 19,
        minute: 5,
      }),
      cancelledAt: null,
      createdAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 5, hour: 12 }),
      notes: 'Completed boxing-ring session used for prior-month comparisons.',
    },
    {
      id: seedId('analytics-booking:member-active:yoga-two-months'),
      userId: memberActiveId,
      amenityId: amenityIds.get('Yoga Room') ?? null,
      coachId: coachProfiles['member-expired'] ?? null,
      status: BookingStatus.completed,
      startsAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 14, hour: 6 }),
      endsAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 14, hour: 7 }),
      totalAmount: new Prisma.Decimal('900'),
      downpaymentAmount: new Prisma.Decimal('900'),
      balanceAmount: new Prisma.Decimal('0'),
      downpaymentPaidAt: analyticsAt({
        monthsAgo: 2,
        dayOfMonth: 13,
        hour: 15,
      }),
      balancePaidAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 13, hour: 15 }),
      completedAt: analyticsAt({
        monthsAgo: 2,
        dayOfMonth: 14,
        hour: 7,
        minute: 5,
      }),
      cancelledAt: null,
      createdAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 11, hour: 10 }),
      notes:
        'Prior-month yoga booking used for attendance and revenue correlation.',
    },
    {
      id: seedId('analytics-booking:member-pending:basketball-cancelled'),
      userId: memberPendingId,
      amenityId: amenityIds.get('Basketball Court') ?? null,
      coachId: null,
      status: BookingStatus.cancelled,
      startsAt: analyticsAt({ daysAgo: 2, hour: 15 }),
      endsAt: analyticsAt({ daysAgo: 2, hour: 16 }),
      totalAmount: new Prisma.Decimal('1500'),
      downpaymentAmount: new Prisma.Decimal('0'),
      balanceAmount: new Prisma.Decimal('1500'),
      downpaymentPaidAt: null,
      balancePaidAt: null,
      completedAt: null,
      cancelledAt: analyticsAt({ daysAgo: 1, hour: 12 }),
      createdAt: analyticsAt({ daysAgo: 4, hour: 9 }),
      notes: 'Cancelled booking kept for recent-activity coverage.',
    },
  ];

  const validBookingSeeds: Array<{
    id: string;
    userId: string;
    amenityId: string;
    coachId: string | null;
    status: BookingStatus;
    startsAt: Date;
    endsAt: Date;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    downpaymentPaidAt: Date | null;
    balancePaidAt: Date | null;
    completedAt: Date | null;
    cancelledAt: Date | null;
    createdAt: Date;
    notes: string;
  }> = [];

  for (const booking of validBookingSeeds) {
    await prisma.amenityBooking.upsert({
      where: { id: booking.id },
      update: {
        user_id: booking.userId,
        amenity_id: booking.amenityId,
        ...(booking.coachId ? { coach_id: booking.coachId } : {}),
        status: booking.status,
        starts_at: booking.startsAt,
        ends_at: booking.endsAt,
        total_amount: booking.totalAmount,
        downpayment_amount: booking.downpaymentAmount,
        balance_amount: booking.balanceAmount,
        downpayment_paid_at: booking.downpaymentPaidAt,
        balance_paid_at: booking.balancePaidAt,
        completed_at: booking.completedAt,
        cancelled_at: booking.cancelledAt,
        notes: booking.notes,
        created_at: booking.createdAt,
      },
      create: {
        id: booking.id,
        user_id: booking.userId,
        amenity_id: booking.amenityId,
        ...(booking.coachId ? { coach_id: booking.coachId } : {}),
        status: booking.status,
        starts_at: booking.startsAt,
        ends_at: booking.endsAt,
        total_amount: booking.totalAmount,
        downpayment_amount: booking.downpaymentAmount,
        balance_amount: booking.balanceAmount,
        downpayment_paid_at: booking.downpaymentPaidAt,
        balance_paid_at: booking.balancePaidAt,
        completed_at: booking.completedAt,
        cancelled_at: booking.cancelledAt,
        notes: booking.notes,
        created_at: booking.createdAt,
      },
    });
  }

  // Disabled fixture source retained for reference only; validAppointmentSeeds stays empty.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const appointmentSeeds: Array<{
    id: string;
    userId: string | null;
    coachId: string | null;
    status: AppointmentStatus;
    scheduledAt: Date;
    durationMinutes: number;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    gymRevenue: Prisma.Decimal;
    coachEarnings: Prisma.Decimal;
    downpaymentPaidAt: Date | null;
    balancePaidAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    memberNotes: string | null;
    sessionNotes: string | null;
  }> = [
    {
      id: seedId('analytics-appointment:member-active:staff-completed'),
      userId: memberActiveId,
      coachId: coachProfiles['staff'] ?? null,
      status: AppointmentStatus.completed,
      scheduledAt: analyticsAt({ dayOfMonth: 9, hour: 8 }),
      durationMinutes: 60,
      totalAmount: new Prisma.Decimal('850'),
      downpaymentAmount: new Prisma.Decimal('300'),
      balanceAmount: new Prisma.Decimal('550'),
      gymRevenue: new Prisma.Decimal('170'),
      coachEarnings: new Prisma.Decimal('680'),
      downpaymentPaidAt: analyticsAt({ dayOfMonth: 7, hour: 14 }),
      balancePaidAt: analyticsAt({ dayOfMonth: 9, hour: 7, minute: 45 }),
      completedAt: analyticsAt({ dayOfMonth: 9, hour: 9, minute: 10 }),
      createdAt: analyticsAt({ dayOfMonth: 5, hour: 11 }),
      memberNotes: 'Strength check-in and movement review.',
      sessionNotes: 'Stable squat depth and improved pacing.',
    },
    {
      id: seedId('analytics-appointment:member-premium:boxing-last-month'),
      userId: memberPremiumId,
      coachId: coachProfiles['member-nomembership'] ?? null,
      status: AppointmentStatus.completed,
      scheduledAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 18, hour: 17 }),
      durationMinutes: 60,
      totalAmount: new Prisma.Decimal('900'),
      downpaymentAmount: new Prisma.Decimal('300'),
      balanceAmount: new Prisma.Decimal('600'),
      gymRevenue: new Prisma.Decimal('180'),
      coachEarnings: new Prisma.Decimal('720'),
      downpaymentPaidAt: analyticsAt({
        monthsAgo: 1,
        dayOfMonth: 14,
        hour: 15,
      }),
      balancePaidAt: analyticsAt({
        monthsAgo: 1,
        dayOfMonth: 18,
        hour: 16,
        minute: 40,
      }),
      completedAt: analyticsAt({
        monthsAgo: 1,
        dayOfMonth: 18,
        hour: 18,
        minute: 10,
      }),
      createdAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 12, hour: 10 }),
      memberNotes: 'Padwork and conditioning session.',
      sessionNotes: 'Strong tempo and clean finishing rounds.',
    },
    {
      id: seedId('analytics-appointment:member-active:recovery-two-months'),
      userId: memberActiveId,
      coachId: coachProfiles['member-expired'] ?? null,
      status: AppointmentStatus.completed,
      scheduledAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 22, hour: 7 }),
      durationMinutes: 50,
      totalAmount: new Prisma.Decimal('780'),
      downpaymentAmount: new Prisma.Decimal('280'),
      balanceAmount: new Prisma.Decimal('500'),
      gymRevenue: new Prisma.Decimal('156'),
      coachEarnings: new Prisma.Decimal('624'),
      downpaymentPaidAt: analyticsAt({
        monthsAgo: 2,
        dayOfMonth: 19,
        hour: 13,
      }),
      balancePaidAt: analyticsAt({
        monthsAgo: 2,
        dayOfMonth: 22,
        hour: 6,
        minute: 45,
      }),
      completedAt: analyticsAt({
        monthsAgo: 2,
        dayOfMonth: 22,
        hour: 7,
        minute: 55,
      }),
      createdAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 16, hour: 9 }),
      memberNotes: 'Mobility and breathing reset.',
      sessionNotes: 'Better thoracic rotation and calmer tempo.',
    },
    {
      id: seedId('analytics-appointment:member-pending:future-payment'),
      userId: memberPendingId,
      coachId: coachProfiles['staff'] ?? null,
      status: AppointmentStatus.pending_payment,
      scheduledAt: upcomingAt(3, 9),
      durationMinutes: 60,
      totalAmount: new Prisma.Decimal('850'),
      downpaymentAmount: new Prisma.Decimal('300'),
      balanceAmount: new Prisma.Decimal('550'),
      gymRevenue: new Prisma.Decimal('170'),
      coachEarnings: new Prisma.Decimal('680'),
      downpaymentPaidAt: null,
      balancePaidAt: null,
      completedAt: null,
      createdAt: analyticsAt({ daysAgo: 3, hour: 13 }),
      memberNotes: 'Awaiting payment before confirmation.',
      sessionNotes: null,
    },
  ];

  const validAppointmentSeeds: Array<{
    id: string;
    userId: string;
    coachId: string;
    status: AppointmentStatus;
    scheduledAt: Date;
    durationMinutes: number;
    totalAmount: Prisma.Decimal;
    downpaymentAmount: Prisma.Decimal;
    balanceAmount: Prisma.Decimal;
    gymRevenue: Prisma.Decimal;
    coachEarnings: Prisma.Decimal;
    downpaymentPaidAt: Date | null;
    balancePaidAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    memberNotes: string | null;
    sessionNotes: string | null;
  }> = [];

  for (const appointment of validAppointmentSeeds) {
    await prisma.coachAppointment.upsert({
      where: { id: appointment.id },
      update: {
        user_id: appointment.userId,
        coach_id: appointment.coachId,
        status: appointment.status,
        scheduled_at: appointment.scheduledAt,
        duration_minutes: appointment.durationMinutes,
        total_amount: appointment.totalAmount,
        downpayment_amount: appointment.downpaymentAmount,
        balance_amount: appointment.balanceAmount,
        gym_revenue: appointment.gymRevenue,
        coach_earnings: appointment.coachEarnings,
        downpayment_paid_at: appointment.downpaymentPaidAt,
        balance_paid_at: appointment.balancePaidAt,
        completed_at: appointment.completedAt,
        no_show_at: null,
        cancelled_at: null,
        member_notes: appointment.memberNotes,
        session_notes: appointment.sessionNotes,
        created_at: appointment.createdAt,
      },
      create: {
        id: appointment.id,
        user_id: appointment.userId,
        coach_id: appointment.coachId,
        status: appointment.status,
        scheduled_at: appointment.scheduledAt,
        duration_minutes: appointment.durationMinutes,
        total_amount: appointment.totalAmount,
        downpayment_amount: appointment.downpaymentAmount,
        balance_amount: appointment.balanceAmount,
        gym_revenue: appointment.gymRevenue,
        coach_earnings: appointment.coachEarnings,
        downpayment_paid_at: appointment.downpaymentPaidAt,
        balance_paid_at: appointment.balancePaidAt,
        completed_at: appointment.completedAt,
        member_notes: appointment.memberNotes,
        session_notes: appointment.sessionNotes,
        created_at: appointment.createdAt,
      },
    });
  }

  const saleSeeds: Array<{
    id: string;
    customerName: string | null;
    customerUserId: string | null;
    processedBy: string | null;
    status: SaleStatus;
    paymentMethod: SalePaymentMethod;
    createdAt: Date;
    items: Array<{
      id: string;
      productId: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      subtotal: Prisma.Decimal;
    }>;
  }> = [
    {
      id: seedId('analytics-sale:starter-stack'),
      customerName: 'Walk-in customer',
      customerUserId: null,
      processedBy: staffUserId,
      status: SaleStatus.completed,
      paymentMethod: SalePaymentMethod.cash,
      createdAt: analyticsAt({ dayOfMonth: 10, hour: 19, minute: 10 }),
      items: [
        {
          id: seedId('analytics-sale-item:starter-stack:whey'),
          productId: seedId('analytics-retail:whey-isolate'),
          quantity: 1,
          unitPrice: new Prisma.Decimal('1899'),
          subtotal: new Prisma.Decimal('1899'),
        },
        {
          id: seedId('analytics-sale-item:starter-stack:shaker'),
          productId: seedId('analytics-retail:shaker-bottle'),
          quantity: 1,
          unitPrice: new Prisma.Decimal('299'),
          subtotal: new Prisma.Decimal('299'),
        },
      ],
    },
    {
      id: seedId('analytics-sale:premium-recovery'),
      customerName: null,
      customerUserId: memberPremiumId,
      processedBy: adminUserId ?? staffUserId,
      status: SaleStatus.completed,
      paymentMethod: SalePaymentMethod.paymongo,
      createdAt: analyticsAt({
        monthsAgo: 1,
        dayOfMonth: 12,
        hour: 12,
        minute: 35,
      }),
      items: [
        {
          id: seedId('analytics-sale-item:premium-recovery:creatine'),
          productId: seedId('analytics-retail:creatine'),
          quantity: 1,
          unitPrice: new Prisma.Decimal('799'),
          subtotal: new Prisma.Decimal('799'),
        },
        {
          id: seedId('analytics-sale-item:premium-recovery:balm'),
          productId: seedId('analytics-retail:recovery-balm'),
          quantity: 2,
          unitPrice: new Prisma.Decimal('349'),
          subtotal: new Prisma.Decimal('698'),
        },
      ],
    },
    {
      id: seedId('analytics-sale:member-active-hydration'),
      customerName: null,
      customerUserId: memberActiveId,
      processedBy: staffUserId,
      status: SaleStatus.completed,
      paymentMethod: SalePaymentMethod.cash,
      createdAt: analyticsAt({
        monthsAgo: 2,
        dayOfMonth: 20,
        hour: 18,
        minute: 5,
      }),
      items: [
        {
          id: seedId('analytics-sale-item:member-active-hydration:drink'),
          productId: seedId('analytics-retail:energy-drink'),
          quantity: 6,
          unitPrice: new Prisma.Decimal('120'),
          subtotal: new Prisma.Decimal('720'),
        },
        {
          id: seedId('analytics-sale-item:member-active-hydration:straps'),
          productId: seedId('analytics-retail:lifting-straps'),
          quantity: 1,
          unitPrice: new Prisma.Decimal('450'),
          subtotal: new Prisma.Decimal('450'),
        },
      ],
    },
    {
      id: seedId('analytics-sale:starter-kit-quarter'),
      customerName: 'Corporate client',
      customerUserId: null,
      processedBy: adminUserId ?? staffUserId,
      status: SaleStatus.completed,
      paymentMethod: SalePaymentMethod.paymongo,
      createdAt: analyticsAt({
        monthsAgo: 4,
        dayOfMonth: 15,
        hour: 11,
        minute: 20,
      }),
      items: [
        {
          id: seedId('analytics-sale-item:starter-kit-quarter:whey'),
          productId: seedId('analytics-retail:whey-isolate'),
          quantity: 2,
          unitPrice: new Prisma.Decimal('1899'),
          subtotal: new Prisma.Decimal('3798'),
        },
        {
          id: seedId('analytics-sale-item:starter-kit-quarter:creatine'),
          productId: seedId('analytics-retail:creatine'),
          quantity: 2,
          unitPrice: new Prisma.Decimal('799'),
          subtotal: new Prisma.Decimal('1598'),
        },
      ],
    },
  ];

  const validSaleSeeds = saleSeeds.filter(
    (
      entry,
    ): entry is {
      id: string;
      customerName: string | null;
      customerUserId: string | null;
      processedBy: string;
      status: SaleStatus;
      paymentMethod: SalePaymentMethod;
      createdAt: Date;
      items: Array<{
        id: string;
        productId: string;
        quantity: number;
        unitPrice: Prisma.Decimal;
        subtotal: Prisma.Decimal;
      }>;
    } => Boolean(entry.processedBy),
  );

  for (const sale of validSaleSeeds) {
    const totalAmount = sale.items.reduce(
      (sum, item) => sum.plus(item.subtotal),
      new Prisma.Decimal(0),
    );
    const paymentId = seedId(`analytics-payment:product:${sale.id}`);

    await prisma.saleTransaction.upsert({
      where: { id: sale.id },
      update: {
        ...(sale.customerName ? { customer_name: sale.customerName } : {}),
        ...(sale.customerUserId
          ? { customer_user_id: sale.customerUserId }
          : {}),
        total_amount: totalAmount,
        payment_method: sale.paymentMethod,
        payment_id: paymentId,
        processed_by: sale.processedBy,
        status: sale.status,
        created_at: sale.createdAt,
      },
      create: {
        id: sale.id,
        ...(sale.customerName ? { customer_name: sale.customerName } : {}),
        ...(sale.customerUserId
          ? { customer_user_id: sale.customerUserId }
          : {}),
        total_amount: totalAmount,
        payment_method: sale.paymentMethod,
        payment_id: paymentId,
        processed_by: sale.processedBy,
        status: sale.status,
        created_at: sale.createdAt,
      },
    });

    for (const item of sale.items) {
      await prisma.saleTransactionItem.upsert({
        where: { id: item.id },
        update: {
          transaction_id: sale.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
          created_at: sale.createdAt,
        },
        create: {
          id: item.id,
          transaction_id: sale.id,
          product_id: item.productId,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          subtotal: item.subtotal,
          created_at: sale.createdAt,
        },
      });
    }
  }

  const paymentSeeds: Array<{
    id: string;
    userId: string | null;
    payableType: PayableType;
    payableId: string;
    paymentStage: PaymentStage;
    amount: Prisma.Decimal;
    provider: PaymentProvider;
    status: PaymentStatus;
    createdAt: Date;
  }> = [
    {
      id: seedId('analytics-payment:membership:active-current'),
      userId: memberActiveId,
      payableType: PayableType.subscription,
      payableId: seedId('subscription:member-active'),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('799'),
      provider: PaymentProvider.cash,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({ dayOfMonth: 3, hour: 9, minute: 15 }),
    },
    {
      id: seedId('analytics-payment:membership:premium-current'),
      userId: memberPremiumId,
      payableType: PayableType.subscription,
      payableId: seedId('subscription:member-premium'),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('1699'),
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({ dayOfMonth: 6, hour: 10, minute: 0 }),
    },
    {
      id: seedId('analytics-payment:membership:frozen-current'),
      userId: memberFrozenId,
      payableType: PayableType.subscription,
      payableId: seedId('subscription:member-frozen'),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('1199'),
      provider: PaymentProvider.cash,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({ dayOfMonth: 7, hour: 8, minute: 40 }),
    },
    {
      id: seedId('analytics-payment:membership:expired-prior'),
      userId: memberExpiredId,
      payableType: PayableType.subscription,
      payableId: seedId('subscription:member-expired'),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('799'),
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({
        monthsAgo: 2,
        dayOfMonth: 4,
        hour: 11,
        minute: 10,
      }),
    },
    {
      id: seedId('analytics-payment:booking:active-current'),
      userId: memberActiveId,
      payableType: PayableType.booking,
      payableId: seedId('analytics-booking:member-active:basketball-completed'),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('3000'),
      provider: PaymentProvider.cash,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({ dayOfMonth: 8, hour: 6, minute: 50 }),
    },
    {
      id: seedId('analytics-payment:booking:premium-prior'),
      userId: memberPremiumId,
      payableType: PayableType.booking,
      payableId: seedId('analytics-booking:member-premium:boxing-last-month'),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('1200'),
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({
        monthsAgo: 1,
        dayOfMonth: 10,
        hour: 17,
        minute: 50,
      }),
    },
    {
      id: seedId('analytics-payment:booking:yoga-prior'),
      userId: memberActiveId,
      payableType: PayableType.booking,
      payableId: seedId('analytics-booking:member-active:yoga-two-months'),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('900'),
      provider: PaymentProvider.cash,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({
        monthsAgo: 2,
        dayOfMonth: 14,
        hour: 6,
        minute: 30,
      }),
    },
    {
      id: seedId('analytics-payment:coaching:active-current'),
      userId: memberActiveId,
      payableType: PayableType.coaching,
      payableId: seedId('analytics-appointment:member-active:staff-completed'),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('850'),
      provider: PaymentProvider.cash,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({ dayOfMonth: 9, hour: 7, minute: 35 }),
    },
    {
      id: seedId('analytics-payment:coaching:premium-prior'),
      userId: memberPremiumId,
      payableType: PayableType.coaching,
      payableId: seedId(
        'analytics-appointment:member-premium:boxing-last-month',
      ),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('900'),
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({
        monthsAgo: 1,
        dayOfMonth: 18,
        hour: 16,
        minute: 35,
      }),
    },
    {
      id: seedId('analytics-payment:coaching:recovery-prior'),
      userId: memberActiveId,
      payableType: PayableType.coaching,
      payableId: seedId(
        'analytics-appointment:member-active:recovery-two-months',
      ),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('780'),
      provider: PaymentProvider.cash,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({
        monthsAgo: 2,
        dayOfMonth: 22,
        hour: 6,
        minute: 25,
      }),
    },
    ...validSaleSeeds.map((sale) => ({
      id: seedId(`analytics-payment:product:${sale.id}`),
      userId: sale.customerUserId ?? memberActiveId,
      payableType: PayableType.product,
      payableId: sale.id,
      paymentStage: PaymentStage.full,
      amount: sale.items.reduce(
        (sum, item) => sum.plus(item.subtotal),
        new Prisma.Decimal(0),
      ),
      provider:
        sale.paymentMethod === SalePaymentMethod.paymongo
          ? PaymentProvider.paymongo
          : PaymentProvider.cash,
      status: PaymentStatus.completed,
      createdAt: sale.createdAt,
    })),
  ];

  const validPaymentSeeds = paymentSeeds.filter(
    (
      entry,
    ): entry is {
      id: string;
      userId: string;
      payableType: PayableType;
      payableId: string;
      paymentStage: PaymentStage;
      amount: Prisma.Decimal;
      provider: PaymentProvider;
      status: PaymentStatus;
      createdAt: Date;
    } =>
      Boolean(entry.userId) &&
      entry.payableType !== PayableType.booking &&
      entry.payableType !== PayableType.coaching,
  );

  for (const payment of validPaymentSeeds) {
    await prisma.payment.upsert({
      where: { id: payment.id },
      update: {
        user_id: payment.userId,
        payable_type: payment.payableType,
        payable_id: payment.payableId,
        payment_stage: payment.paymentStage,
        amount: payment.amount,
        currency: 'PHP',
        provider: payment.provider,
        provider_ref: `seed-${payment.id}`,
        gateway_event_id: `event-${payment.id}`,
        idempotency_key: `idempotency-${payment.id}`,
        status: payment.status,
        ...(adminUserId
          ? {
              verified_by: adminUserId,
              verified_at: payment.createdAt,
            }
          : {}),
        created_at: payment.createdAt,
      },
      create: {
        id: payment.id,
        user_id: payment.userId,
        payable_type: payment.payableType,
        payable_id: payment.payableId,
        payment_stage: payment.paymentStage,
        amount: payment.amount,
        currency: 'PHP',
        provider: payment.provider,
        provider_ref: `seed-${payment.id}`,
        gateway_event_id: `event-${payment.id}`,
        idempotency_key: `idempotency-${payment.id}`,
        status: payment.status,
        ...(adminUserId
          ? {
              verified_by: adminUserId,
              verified_at: payment.createdAt,
            }
          : {}),
        created_at: payment.createdAt,
      },
    });
  }
}

async function ensureMasteryProgress(
  ensuredAccounts: readonly EnsuredAccount[],
) {
  const targetUserIds = ensuredAccounts
    .filter(({ account }) =>
      ['member-active', 'member-premium'].includes(account.key),
    )
    .map(({ userId }) => userId);

  await prisma.muscleMasteryProgress.deleteMany({
    where: {
      user_id: { in: targetUserIds },
    },
  });

  const memberActiveId =
    ensuredAccounts.find(({ account }) => account.key === 'member-active')
      ?.userId ?? null;
  const memberPremiumId =
    ensuredAccounts.find(({ account }) => account.key === 'member-premium')
      ?.userId ?? null;

  if (memberActiveId) {
    await prisma.muscleMasteryProgress.createMany({
      data: [
        {
          id: seedId('mastery:member-active:legs'),
          user_id: memberActiveId,
          muscle_group: 'Legs',
          total_volume_kg: new Prisma.Decimal('12400'),
          xp_points: 1480,
          rank: MasteryRank.silver,
          last_ranked_at: new Date(),
        },
        {
          id: seedId('mastery:member-active:chest'),
          user_id: memberActiveId,
          muscle_group: 'Chest',
          total_volume_kg: new Prisma.Decimal('8600'),
          xp_points: 920,
          rank: MasteryRank.bronze,
          last_ranked_at: new Date(),
        },
      ],
    });
  }

  if (memberPremiumId) {
    await prisma.muscleMasteryProgress.createMany({
      data: [
        {
          id: seedId('mastery:member-premium:back'),
          user_id: memberPremiumId,
          muscle_group: 'Back',
          total_volume_kg: new Prisma.Decimal('18250'),
          xp_points: 2210,
          rank: MasteryRank.gold,
          last_ranked_at: new Date(),
        },
        {
          id: seedId('mastery:member-premium:shoulders'),
          user_id: memberPremiumId,
          muscle_group: 'Shoulders',
          total_volume_kg: new Prisma.Decimal('11140'),
          xp_points: 1310,
          rank: MasteryRank.silver,
          last_ranked_at: new Date(),
        },
      ],
    });
  }
}

async function ensureWorkoutFixtures(
  ensuredAccounts: readonly EnsuredAccount[],
) {
  const memberActiveId =
    ensuredAccounts.find(({ account }) => account.key === 'member-active')
      ?.userId ?? null;

  if (!memberActiveId) {
    return;
  }

  const exerciseSeeds = [
    {
      key: 'squat',
      name: 'Barbell Back Squat',
      muscleGroup: 'Legs',
      category: ExerciseCategory.strength,
      description:
        'Primary lower-body compound lift for the seeded workout happy path.',
      instructions:
        'Brace the core, keep the chest tall, and drive through the mid-foot on every rep.',
      videoUrl: 'https://fittrack.dev/exercises/barbell-back-squat',
      imageUrl: 'https://fittrack.dev/exercises/barbell-back-squat.jpg',
    },
    {
      key: 'bench',
      name: 'Dumbbell Bench Press',
      muscleGroup: 'Chest',
      category: ExerciseCategory.strength,
      description:
        'Press variation used to keep the seeded catalog broad enough for manual selection.',
      instructions:
        'Lower with control, keep forearms stacked, and press until the dumbbells meet above the chest.',
      videoUrl: 'https://fittrack.dev/exercises/dumbbell-bench-press',
      imageUrl: 'https://fittrack.dev/exercises/dumbbell-bench-press.jpg',
    },
    {
      key: 'push',
      name: 'Push-Up',
      muscleGroup: 'Chest',
      category: ExerciseCategory.strength,
      description:
        'Bodyweight horizontal press seeded so live pose tracking can select and log push-up sessions explicitly.',
      instructions:
        'Keep a straight body line, lower with the elbows bending back, and press without letting the hips sag.',
      videoUrl: 'https://fittrack.dev/exercises/push-up',
      imageUrl: 'https://fittrack.dev/exercises/push-up.jpg',
    },
    {
      key: 'dip',
      name: 'Dip',
      muscleGroup: 'Chest',
      category: ExerciseCategory.strength,
      description:
        'Bodyweight vertical press seeded so bilateral arm-motion tuning can be verified with dip-specific thresholds.',
      instructions:
        'Lower until the elbows bend deeply, keep both arms moving together, and press to a tall lockout without shrugging.',
      videoUrl: 'https://fittrack.dev/exercises/dip',
      imageUrl: 'https://fittrack.dev/exercises/dip.jpg',
    },
    {
      key: 'pull',
      name: 'Pull-Up',
      muscleGroup: 'Back',
      category: ExerciseCategory.strength,
      description:
        'Bodyweight vertical pull seeded so pull-up pose tracking and back mastery can be tested end to end.',
      instructions:
        'Start from a controlled hang, pull until the elbows flex and the chest rises, then lower without swinging.',
      videoUrl: 'https://fittrack.dev/exercises/pull-up',
      imageUrl: 'https://fittrack.dev/exercises/pull-up.jpg',
    },
    {
      key: 'curl',
      name: 'Dumbbell Bicep Curl',
      muscleGroup: 'Arms',
      category: ExerciseCategory.strength,
      description:
        'Dumbbell curl seeded so pose tracking can test equipment-aware elbow flexion.',
      instructions:
        'Stand tall, hold a dumbbell in each hand, curl without swinging the hips, and lower under control.',
      videoUrl: 'https://fittrack.dev/exercises/dumbbell-bicep-curl',
      imageUrl: 'https://fittrack.dev/exercises/dumbbell-bicep-curl.jpg',
    },
    {
      key: 'row',
      name: 'Seated Cable Row',
      muscleGroup: 'Back',
      category: ExerciseCategory.strength,
      description:
        'Upper-back pull seeded so the workout picker is not a single-exercise stub.',
      instructions:
        'Stay tall, pull the handle to the lower ribs, and squeeze the shoulder blades together.',
      videoUrl: 'https://fittrack.dev/exercises/seated-cable-row',
      imageUrl: 'https://fittrack.dev/exercises/seated-cable-row.jpg',
    },
    {
      key: 'rope',
      name: 'Jump Rope',
      muscleGroup: 'Cardio',
      category: ExerciseCategory.cardio,
      description:
        'Light conditioning option so the shared catalog includes more than pure strength work.',
      instructions:
        'Stay light on the feet, keep the elbows in, and rotate from the wrists.',
      videoUrl: 'https://fittrack.dev/exercises/jump-rope',
      imageUrl: 'https://fittrack.dev/exercises/jump-rope.jpg',
    },
  ] as const;

  const poseProfileSeeds = [
    {
      canonicalName: 'barbell back squat',
      exerciseKey: 'squat',
      landmarkSignature: {
        anchors: ['hips', 'knees', 'ankles'],
        stance: 'shoulder_width',
      } as Prisma.InputJsonValue,
      angleSignature: {
        bottom: { hip: [65, 95], knee: [60, 90] },
        top: { hip: [155, 180], knee: [155, 180] },
      } as Prisma.InputJsonValue,
      repRules: {
        ascent: 'hips_and_shoulders_rise_together',
        depth: 'hip_below_knee',
      } as Prisma.InputJsonValue,
      orientationSignature: {
        body_orientation: 'upright',
        nose_to_hip_vector: { x: 0.01, y: 0.84 },
        torso_slope_range: [76, 96],
      } as Prisma.InputJsonValue,
      movementPattern: {
        oscillating_landmarks: [
          'left_hip',
          'right_hip',
          'left_knee',
          'right_knee',
        ],
        stable_landmarks: ['left_ankle', 'right_ankle'],
        tracked_joint: 'hip_knee_ankle',
      } as Prisma.InputJsonValue,
      visibilityPattern: {
        min_visibility: 0.5,
        required_landmarks: [
          'left_shoulder',
          'right_shoulder',
          'left_ankle',
          'right_ankle',
        ],
      } as Prisma.InputJsonValue,
    },
    {
      canonicalName: 'dumbbell bench press',
      exerciseKey: 'bench',
      landmarkSignature: {
        anchors: ['shoulders', 'elbows', 'wrists'],
        setup: 'supine_press',
      } as Prisma.InputJsonValue,
      angleSignature: {
        bottom: { elbow: [65, 95] },
        top: { elbow: [155, 180] },
      } as Prisma.InputJsonValue,
      repRules: {
        lockout: 'arms_extended_over_chest',
        descent: 'upper_arm_below_torso_line',
      } as Prisma.InputJsonValue,
      orientationSignature: {
        body_orientation: 'supine',
        nose_to_hip_vector: { x: 0.0, y: 0.18 },
        torso_slope_range: [0, 16],
      } as Prisma.InputJsonValue,
      movementPattern: {
        oscillating_landmarks: [
          'left_wrist',
          'right_wrist',
          'left_elbow',
          'right_elbow',
        ],
        stable_landmarks: [
          'left_hip',
          'right_hip',
          'left_shoulder',
          'right_shoulder',
        ],
        tracked_joint: 'shoulder_elbow_wrist',
      } as Prisma.InputJsonValue,
      visibilityPattern: {
        min_visibility: 0.45,
        required_landmarks: [
          'left_shoulder',
          'right_shoulder',
          'left_elbow',
          'right_elbow',
        ],
      } as Prisma.InputJsonValue,
    },
    {
      canonicalName: 'push_up',
      exerciseKey: 'push',
      landmarkSignature: {
        anchors: ['shoulders', 'elbows', 'wrists', 'hips', 'ankles'],
        setup: 'prone_press',
      } as Prisma.InputJsonValue,
      angleSignature: {
        bottom: { elbow: [95, 155] },
        top: { elbow: [142, 178] },
      } as Prisma.InputJsonValue,
      repRules: {
        body_line: 'shoulders_hips_ankles_stacked',
        depth: 'chest_between_hands',
        partials_allowed: true,
        no_count_conditions: [
          'bilateral_arm_motion_unconfirmed',
          'push_up_body_not_horizontal',
          'left_right_phase_desync',
        ],
      } as Prisma.InputJsonValue,
      orientationSignature: {
        body_orientation: 'prone_horizontal',
        nose_to_hip_vector: { x: 0.02, y: 0.16 },
        torso_slope_range: [0, 88],
      } as Prisma.InputJsonValue,
      movementPattern: {
        oscillating_landmarks: [
          'left_wrist',
          'right_wrist',
          'left_elbow',
          'right_elbow',
        ],
        stable_landmarks: [
          'left_hip',
          'right_hip',
          'left_ankle',
          'right_ankle',
        ],
        tracked_joint: 'elbow_wrist',
      } as Prisma.InputJsonValue,
      visibilityPattern: {
        min_visibility: 0.4,
        required_landmarks: [
          'left_shoulder',
          'right_shoulder',
          'left_hip',
          'right_hip',
        ],
      } as Prisma.InputJsonValue,
    },
    {
      canonicalName: 'dip',
      exerciseKey: 'dip',
      landmarkSignature: {
        anchors: ['shoulders', 'elbows', 'wrists', 'hips'],
        setup: 'upright_vertical_press',
      } as Prisma.InputJsonValue,
      angleSignature: {
        bottom: { elbow: [72, 104] },
        top: { elbow: [144, 172] },
      } as Prisma.InputJsonValue,
      repRules: {
        bilateral_control: 'both_elbows_extend_together',
        no_count_conditions: [
          'bilateral_arm_motion_unconfirmed',
          'body_y_travel_below_min',
          'left_right_phase_desync',
        ],
      } as Prisma.InputJsonValue,
      orientationSignature: {
        body_orientation: 'upright_vertical',
        nose_to_hip_vector: { x: 0.01, y: 0.82 },
        torso_slope_range: [60, 108],
      } as Prisma.InputJsonValue,
      movementPattern: {
        oscillating_landmarks: [
          'left_wrist',
          'right_wrist',
          'left_elbow',
          'right_elbow',
        ],
        stable_landmarks: [
          'left_hip',
          'right_hip',
          'left_shoulder',
          'right_shoulder',
        ],
        tracked_joint: 'shoulder_elbow_wrist',
      } as Prisma.InputJsonValue,
      visibilityPattern: {
        min_visibility: 0.42,
        required_landmarks: [
          'left_shoulder',
          'right_shoulder',
          'left_elbow',
          'right_elbow',
        ],
      } as Prisma.InputJsonValue,
    },
    {
      canonicalName: 'pull_up',
      exerciseKey: 'pull',
      landmarkSignature: {
        anchors: ['shoulders', 'elbows', 'wrists', 'hips'],
        setup: 'upright_vertical_pull',
      } as Prisma.InputJsonValue,
      angleSignature: {
        bottom: { elbow: [128, 178] },
        top: { elbow: [70, 135] },
      } as Prisma.InputJsonValue,
      repRules: {
        partials_allowed: true,
        vertical_pull: 'elbows_flex_as_chest_rises',
        no_count_conditions: [
          'insufficient_elbow_rom',
          'body_swing_over_tolerance',
        ],
      } as Prisma.InputJsonValue,
      orientationSignature: {
        body_orientation: 'upright_vertical',
        nose_to_hip_vector: { x: 0.01, y: 0.82 },
        torso_slope_range: [58, 108],
      } as Prisma.InputJsonValue,
      movementPattern: {
        oscillating_landmarks: [
          'left_wrist',
          'right_wrist',
          'left_elbow',
          'right_elbow',
          'left_shoulder',
          'right_shoulder',
        ],
        stable_landmarks: ['left_hip', 'right_hip'],
        tracked_joint: 'shoulder_elbow_wrist',
      } as Prisma.InputJsonValue,
      visibilityPattern: {
        min_visibility: 0.38,
        required_landmarks: [
          'left_shoulder',
          'right_shoulder',
          'left_elbow',
          'right_elbow',
          'left_wrist',
          'right_wrist',
        ],
      } as Prisma.InputJsonValue,
    },
    {
      canonicalName: 'bicep_curl',
      exerciseKey: 'curl',
      landmarkSignature: {
        anchors: ['shoulders', 'elbows', 'wrists', 'hips'],
        setup: 'standing_weighted_curl',
      } as Prisma.InputJsonValue,
      angleSignature: {
        bottom: { elbow: [112, 176] },
        top: { elbow: [70, 128] },
      } as Prisma.InputJsonValue,
      repRules: {
        equipment_required: 'dumbbell_or_weight_in_hand',
        no_count_conditions: ['equipment_required', 'hip_swing_over_tolerance'],
        partials_allowed: true,
      } as Prisma.InputJsonValue,
      orientationSignature: {
        body_orientation: 'upright',
        nose_to_hip_vector: { x: 0.01, y: 0.86 },
        torso_slope_range: [64, 102],
      } as Prisma.InputJsonValue,
      movementPattern: {
        oscillating_landmarks: [
          'left_wrist',
          'right_wrist',
          'left_elbow',
          'right_elbow',
        ],
        stable_landmarks: [
          'left_hip',
          'right_hip',
          'left_shoulder',
          'right_shoulder',
        ],
        tracked_joint: 'shoulder_elbow_wrist',
      } as Prisma.InputJsonValue,
      visibilityPattern: {
        min_visibility: 0.42,
        required_landmarks: [
          'left_shoulder',
          'right_shoulder',
          'left_elbow',
          'right_elbow',
          'left_wrist',
          'right_wrist',
        ],
      } as Prisma.InputJsonValue,
    },
  ] as const;

  const lowerDayId = randomUUID();
  const upperDayId = randomUUID();
  const squatPlanExerciseId = randomUUID();
  const rowPlanExerciseId = randomUUID();
  const benchPlanExerciseId = randomUUID();
  const curlPlanExerciseId = randomUUID();
  const ropePlanExerciseId = randomUUID();

  const squatSessionId = randomUUID();
  const squatLogId = randomUUID();
  const squatPoseSessionId = randomUUID();

  const benchSessionId = randomUUID();
  const benchLogId = randomUUID();
  const benchPoseSessionId = randomUUID();

  const now = new Date();
  const squatStartedAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const squatCompletedAt = new Date(squatStartedAt.getTime() + 42 * 60 * 1000);
  const squatPoseStartedAt = new Date(
    squatStartedAt.getTime() + 11 * 60 * 1000,
  );
  const squatPoseEndedAt = new Date(squatPoseStartedAt.getTime() + 95 * 1000);

  const benchStartedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const benchCompletedAt = new Date(benchStartedAt.getTime() + 36 * 60 * 1000);
  const benchPoseStartedAt = new Date(benchStartedAt.getTime() + 9 * 60 * 1000);
  const benchPoseEndedAt = new Date(benchPoseStartedAt.getTime() + 80 * 1000);

  await prisma.poseSession.deleteMany({
    where: {
      user_id: memberActiveId,
    },
  });
  await prisma.exerciseLog.deleteMany({
    where: {
      user_id: memberActiveId,
    },
  });
  await prisma.workoutSession.deleteMany({
    where: {
      user_id: memberActiveId,
    },
  });
  await prisma.trainingPlan.deleteMany({
    where: {
      user_id: memberActiveId,
    },
  });

  await prisma.poseExerciseProfile.deleteMany({
    where: {
      canonical_name: {
        in: poseProfileSeeds.map((profile) => profile.canonicalName),
      },
    },
  });
  const existingSeedExerciseIds = (
    await prisma.exerciseCatalog.findMany({
      where: {
        name: {
          in: exerciseSeeds.map((exercise) => exercise.name),
        },
      },
      select: {
        id: true,
      },
    })
  ).map(({ id }) => id);

  if (existingSeedExerciseIds.length) {
    await prisma.exerciseLog.deleteMany({
      where: {
        exercise_id: {
          in: existingSeedExerciseIds,
        },
      },
    });

    await prisma.planExercise.deleteMany({
      where: {
        exercise_id: {
          in: existingSeedExerciseIds,
        },
      },
    });
  }

  await prisma.exerciseCatalog.deleteMany({
    where: {
      name: {
        in: exerciseSeeds.map((exercise) => exercise.name),
      },
    },
  });

  const exerciseIds = new Map<string, string>();
  for (const exercise of exerciseSeeds) {
    const created = await prisma.exerciseCatalog.create({
      data: {
        id: randomUUID(),
        category: exercise.category,
        description: exercise.description,
        image_url: exercise.imageUrl,
        instructions: exercise.instructions,
        is_active: true,
        muscle_group: exercise.muscleGroup,
        name: exercise.name,
        video_url: exercise.videoUrl,
      },
      select: { id: true },
    });
    exerciseIds.set(exercise.key, created.id);
  }

  const poseProfileIds = new Map<string, string>();
  for (const profile of poseProfileSeeds) {
    const created = await prisma.poseExerciseProfile.create({
      data: {
        id: randomUUID(),
        angle_signature: profile.angleSignature,
        canonical_name: profile.canonicalName,
        confidence_threshold: new Prisma.Decimal('0.750'),
        exercise_id: exerciseIds.get(profile.exerciseKey) ?? null,
        is_active: true,
        landmark_signature: profile.landmarkSignature,
        movement_pattern: profile.movementPattern,
        orientation_signature: profile.orientationSignature,
        profile_kind: PoseProfileKind.seed,
        rep_rules: profile.repRules,
        sample_count: 3,
        visibility_pattern: profile.visibilityPattern,
      },
      select: { id: true },
    });
    poseProfileIds.set(profile.exerciseKey, created.id);
  }

  const createdPlan = await prisma.trainingPlan.create({
    data: {
      id: randomUUID(),
      user_id: memberActiveId,
      source: PlanSource.self_created,
      title: 'Strength Foundations Split',
      goal: FitnessGoal.bulking,
      duration_weeks: 4,
      days_per_week: 3,
      is_active: true,
      is_template: false,
      ai_generation_prompt: {
        source: 'seed-test-data',
        note: 'Queue 3 workout seed for active member verification.',
      } as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  const planId = createdPlan.id;

  await prisma.trainingScheduleDay.createMany({
    data: [
      {
        id: lowerDayId,
        plan_id: planId,
        week_number: 1,
        day_of_week: 1,
        focus_label: 'Lower Body Power',
        notes:
          'Seeded lower-body day so the mobile workout page can load a real first exercise.',
      },
      {
        id: upperDayId,
        plan_id: planId,
        week_number: 1,
        day_of_week: 3,
        focus_label: 'Upper Push + Finish',
        notes:
          'Secondary seeded day used for history and shared exercise picker coverage.',
      },
    ],
  });

  await prisma.planExercise.createMany({
    data: [
      {
        id: squatPlanExerciseId,
        schedule_day_id: lowerDayId,
        exercise_id: exerciseIds.get('squat')!,
        sets: 4,
        reps: 8,
        rest_seconds: 120,
        weight_kg_target: new Prisma.Decimal('55'),
        notes: 'Use this as the primary live-tracking reference exercise.',
        order_index: 0,
      },
      {
        id: rowPlanExerciseId,
        schedule_day_id: lowerDayId,
        exercise_id: exerciseIds.get('row')!,
        sets: 3,
        reps: 12,
        rest_seconds: 90,
        notes:
          'Accessory pull to make the first schedule day feel like a real plan.',
        order_index: 1,
      },
      {
        id: benchPlanExerciseId,
        schedule_day_id: upperDayId,
        exercise_id: exerciseIds.get('bench')!,
        sets: 4,
        reps: 10,
        rest_seconds: 90,
        weight_kg_target: new Prisma.Decimal('22.5'),
        notes:
          'Upper-body push day reference used by the seeded history entry.',
        order_index: 0,
      },
      {
        id: curlPlanExerciseId,
        schedule_day_id: upperDayId,
        exercise_id: exerciseIds.get('curl')!,
        sets: 3,
        reps: 12,
        rest_seconds: 75,
        weight_kg_target: new Prisma.Decimal('8'),
        notes:
          'Equipment-aware curl test exercise for live pose and object-context gating.',
        order_index: 1,
      },
      {
        id: ropePlanExerciseId,
        schedule_day_id: upperDayId,
        exercise_id: exerciseIds.get('rope')!,
        sets: 2,
        duration_seconds: 60,
        rest_seconds: 45,
        notes: 'Short finisher to keep the plan from looking single-purpose.',
        order_index: 2,
      },
    ],
  });

  await prisma.workoutSession.createMany({
    data: [
      {
        id: squatSessionId,
        user_id: memberActiveId,
        plan_id: planId,
        status: SessionStatus.completed,
        started_at: squatStartedAt,
        completed_at: squatCompletedAt,
        duration_seconds: 42 * 60,
        total_volume_kg: new Prisma.Decimal('1320'),
        last_activity_at: squatCompletedAt,
      },
      {
        id: benchSessionId,
        user_id: memberActiveId,
        plan_id: planId,
        status: SessionStatus.completed,
        started_at: benchStartedAt,
        completed_at: benchCompletedAt,
        duration_seconds: 36 * 60,
        total_volume_kg: new Prisma.Decimal('900'),
        last_activity_at: benchCompletedAt,
      },
    ],
  });

  await prisma.exerciseLog.createMany({
    data: [
      {
        id: squatLogId,
        session_id: squatSessionId,
        user_id: memberActiveId,
        plan_exercise_id: squatPlanExerciseId,
        exercise_id: exerciseIds.get('squat')!,
        set_number: 1,
        reps_target: 8,
        reps_completed: 8,
        reps_ai_counted: 8,
        weight_kg: new Prisma.Decimal('55'),
        duration_seconds: 70,
      },
      {
        id: benchLogId,
        session_id: benchSessionId,
        user_id: memberActiveId,
        plan_exercise_id: benchPlanExerciseId,
        exercise_id: exerciseIds.get('bench')!,
        set_number: 1,
        reps_target: 10,
        reps_completed: 10,
        reps_ai_counted: 10,
        weight_kg: new Prisma.Decimal('22.5'),
        duration_seconds: 60,
      },
    ],
  });

  await prisma.poseSession.createMany({
    data: [
      {
        id: squatPoseSessionId,
        user_id: memberActiveId,
        exercise_log_id: squatLogId,
        exercise_hint: 'Barbell Back Squat',
        rep_count_ai: 8,
        confidence_avg: new Prisma.Decimal('0.924'),
        detected_exercise_name: 'Barbell Back Squat',
        detected_profile_id: poseProfileIds.get('squat')!,
        classification_confidence: new Prisma.Decimal('0.962'),
        subject_lock_confidence: new Prisma.Decimal('0.951'),
        analysis_summary: {
          form_feedback: ['Stable torso', 'Consistent squat depth'],
          stage_sequence: ['descent', 'ascent'],
        } as Prisma.InputJsonValue,
        started_at: squatPoseStartedAt,
        ended_at: squatPoseEndedAt,
      },
      {
        id: benchPoseSessionId,
        user_id: memberActiveId,
        exercise_log_id: benchLogId,
        exercise_hint: 'Dumbbell Bench Press',
        rep_count_ai: 10,
        confidence_avg: new Prisma.Decimal('0.911'),
        detected_exercise_name: 'Dumbbell Bench Press',
        detected_profile_id: poseProfileIds.get('bench')!,
        classification_confidence: new Prisma.Decimal('0.944'),
        subject_lock_confidence: new Prisma.Decimal('0.938'),
        analysis_summary: {
          form_feedback: ['Strong lockout', 'Controlled lowering phase'],
          stage_sequence: ['eccentric', 'concentric'],
        } as Prisma.InputJsonValue,
        started_at: benchPoseStartedAt,
        ended_at: benchPoseEndedAt,
      },
    ],
  });
}

async function ensureFeatureCoverageFixtures(
  ensuredAccounts: readonly EnsuredAccount[],
  coachProfiles: Record<string, string>,
) {
  const userIdByKey = (key: string) =>
    ensuredAccounts.find(({ account }) => account.key === key)?.userId ?? null;

  const adminUserId = userIdByKey('admin');
  const staffUserId = userIdByKey('staff');
  const memberActiveId = userIdByKey('member-active');
  const memberPremiumId = userIdByKey('member-premium');
  const memberFrozenId = userIdByKey('member-frozen');
  const memberPendingId = userIdByKey('member-pending');
  const memberNoMembershipId = userIdByKey('member-nomembership');
  const memberExpiredId = userIdByKey('member-expired');
  const memberUserIds = [
    memberActiveId,
    memberPremiumId,
    memberFrozenId,
    memberPendingId,
    memberNoMembershipId,
    memberExpiredId,
  ].filter((userId): userId is string => Boolean(userId));
  const baselineUserIds = ensuredAccounts.map(({ userId }) => userId);
  const staffCoachId = coachProfiles['staff'] ?? null;
  const conditioningCoachId = coachProfiles['member-nomembership'] ?? null;

  if (!adminUserId || !staffUserId || !memberActiveId || !memberPremiumId) {
    return;
  }

  await prisma.gymChatInteractionLog.deleteMany({});
  await prisma.gymChatMessage.deleteMany({});
  await prisma.gymChatSession.deleteMany({});
  await prisma.aiInteractionLog.deleteMany({});
  await prisma.aiChatMessage.deleteMany({});
  await prisma.aiChatSession.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.businessInsightRun.deleteMany({});
  await prisma.equipmentWriteOff.deleteMany({});
  await prisma.gymEquipment.deleteMany({});
  await prisma.gymFaqEntry.deleteMany({});
  await prisma.gymPromotion.deleteMany({});
  await prisma.gymSpecialSchedule.deleteMany({});
  await prisma.gymOperatingHour.deleteMany({});
  await prisma.facilityFloorPlanMedia.deleteMany({});
  await prisma.moderationActionRecord.deleteMany({});
  await prisma.integrityEvent.deleteMany({});
  await prisma.integrityCase.deleteMany({});
  await prisma.integrityProfile.deleteMany({});
  await prisma.rankingProfile.deleteMany({});
  await prisma.userMilestoneProgress.deleteMany({});
  await prisma.seasonalStanding.deleteMany({});
  await prisma.progressionGrantLedger.deleteMany({});
  await prisma.progressionSourceEvent.deleteMany({});
  await prisma.userProgressionProfile.deleteMany({});
  await prisma.exerciseReviewSubmission.deleteMany({});
  await prisma.recurringCoachingBillingCycle.deleteMany({});
  await prisma.recurringCoachingPlan.deleteMany({});
  await prisma.coachClientRelationship.deleteMany({});

  const [activeSeason, milestones, activeWorkout, activePose, curlExercise] =
    await Promise.all([
      prisma.seasonDefinition.findFirst({
        where: { status: SeasonStatus.active },
        select: { id: true },
      }),
      prisma.milestoneDefinition.findMany({
        select: {
          id: true,
          key: true,
        },
      }),
      prisma.workoutSession.findFirst({
        where: { user_id: memberActiveId },
        orderBy: { completed_at: 'desc' },
        select: { id: true },
      }),
      prisma.poseSession.findFirst({
        where: { user_id: memberActiveId },
        orderBy: { created_at: 'desc' },
        select: { id: true },
      }),
      prisma.exerciseCatalog.findFirst({
        where: { name: 'Dumbbell Bicep Curl' },
        select: { id: true },
      }),
    ]);

  const milestoneIds = new Map(
    milestones.map((milestone) => [milestone.key, milestone.id]),
  );
  const activeSeasonId = activeSeason?.id ?? null;

  for (const [key, state] of [
    ['member-active', CreatorState.candidate],
    ['member-premium', CreatorState.approved],
    ['member-pending', CreatorState.pending_review],
    ['member-frozen', CreatorState.suspended],
    ['member-expired', CreatorState.none],
    ['member-nomembership', CreatorState.none],
  ] as const) {
    const userId = userIdByKey(key);
    if (!userId) {
      continue;
    }

    await prisma.creatorProfile.upsert({
      where: { user_id: userId },
      update: {
        admin_notes:
          state === CreatorState.approved
            ? 'Seeded creator-approved member for mobile exercise draft flows.'
            : 'Seeded creator governance state for Exercise Lab coverage.',
        last_state_changed_at: analyticsAt({ daysAgo: 1, hour: 10 }),
        state,
      },
      create: {
        id: seedId(`creator-profile:${key}`),
        admin_notes:
          state === CreatorState.approved
            ? 'Seeded creator-approved member for mobile exercise draft flows.'
            : 'Seeded creator governance state for Exercise Lab coverage.',
        last_state_changed_at: analyticsAt({ daysAgo: 1, hour: 10 }),
        state,
        user_id: userId,
      },
    });
  }

  if (staffCoachId) {
    await prisma.coachClientRelationship.createMany({
      data: [
        {
          id: seedId('coach-client:staff:member-premium'),
          coach_id: staffCoachId,
          member_id: memberPremiumId,
          notes:
            'Premium member paired with staff coach for recurring coaching and analytics demos.',
          started_at: analyticsAt({ daysAgo: 18, hour: 8 }),
          status: RelationshipStatus.active,
        },
        ...(memberPendingId
          ? [
              {
                id: seedId('coach-client:staff:member-pending'),
                coach_id: staffCoachId,
                member_id: memberPendingId,
                notes:
                  'Pending member relationship used for approval-state filtering.',
                started_at: null,
                status: RelationshipStatus.pending,
              },
            ]
          : []),
      ],
    });

    const recurringPlanId = seedId('recurring-plan:member-premium:staff');
    await prisma.recurringCoachingPlan.create({
      data: {
        id: recurringPlanId,
        coach_id: staffCoachId,
        completed_sessions: 3,
        created_by: staffUserId,
        duration_minutes: 60,
        end_date: nutritionDate(-60),
        frequency: RecurringCoachingFrequency.weekly,
        member_id: memberPremiumId,
        preferred_days: [1, 3],
        preferred_time: fixedTime('08:30:00'),
        start_date: nutritionDate(21),
        status: RecurringCoachingPlanStatus.active,
        total_sessions: 12,
      },
    });

    await prisma.recurringCoachingBillingCycle.createMany({
      data: [
        {
          id: seedId('recurring-cycle:member-premium:paid'),
          amount: new Prisma.Decimal('1700'),
          cycle_end_date: nutritionDate(1),
          cycle_start_date: nutritionDate(30),
          due_date: nutritionDate(28),
          grace_period_ends_at: analyticsAt({ daysAgo: 23, hour: 23 }),
          paid_at: analyticsAt({ daysAgo: 27, hour: 12 }),
          recurring_plan_id: recurringPlanId,
          status: RecurringCoachingBillingCycleStatus.paid,
        },
        {
          id: seedId('recurring-cycle:member-premium:due'),
          amount: new Prisma.Decimal('1700'),
          cycle_end_date: nutritionDate(-29),
          cycle_start_date: nutritionDate(0),
          due_date: nutritionDate(-2),
          grace_period_ends_at: analyticsAt({ daysAgo: -5, hour: 23 }),
          recurring_plan_id: recurringPlanId,
          status: RecurringCoachingBillingCycleStatus.due,
        },
      ],
    });
  }

  await prisma.exerciseReviewSubmission.createMany({
    data: EXERCISE_REVIEW_SUBMISSION_SEEDS.map((seed) => {
      const userId = userIdByKey(seed.creatorKey);
      if (!userId) {
        throw new Error(
          `Missing creator account for exercise review seed ${seed.key}.`,
        );
      }

      return {
        id: seedId(`exercise-review:${seed.key}`),
        category: seed.category,
        created_at: analyticsAt({ daysAgo: seed.daysAgo, hour: seed.hour }),
        description: seed.description,
        evidence_bars: seed.evidenceBars as Prisma.InputJsonValue,
        hand_shape_profile: {
          exerciseRequirement:
            seed.category === ExerciseCategory.strength ? 'grip_optional' : 'none',
          targetLockGesture: 'rock_sign',
        } as Prisma.InputJsonValue,
        instructions: seed.instructions,
        match_hint: seed.matchHint ?? null,
        movement_profile: {
          movementType:
            seed.category === ExerciseCategory.balance ? 'static_hold' : 'dynamic_rep',
          rigSource: 'seeded_creator_capture',
          thresholds: { downAngle: 145, tolerance: 18, upAngle: 92 },
        } as Prisma.InputJsonValue,
        muscle_group: seed.muscleGroup,
        muscle_targets: seed.muscleTargets as Prisma.InputJsonValue,
        origin_label: seed.originLabel,
        pose_session_id:
          seed.key === 'member-active:rotational-press'
            ? activePose?.id ?? null
            : null,
        proposed_name: seed.proposedName,
        published_exercise_id:
          seed.status === ExerciseReviewSubmissionStatus.published
            ? curlExercise?.id ?? null
            : null,
        queue_tag: seed.queueTag,
        reviewed_at:
          seed.status === ExerciseReviewSubmissionStatus.pending
            ? null
            : analyticsAt({ daysAgo: seed.reviewedDaysAgo ?? 1, hour: seed.hour }),
        review_notes: seed.reviewNotes ?? null,
        source_label: seed.sourceLabel,
        status: seed.status,
        summary: seed.summary,
        title: seed.title,
        trigger_label: seed.triggerLabel,
        user_id: userId,
      };
    }),
  });

  await prisma.userProgressionProfile.createMany({
    data: [
      {
        id: seedId('progression-profile:member-active'),
        active_season_id: activeSeasonId,
        current_season_points: 186,
        current_streak: 5,
        last_progressed_at: analyticsAt({ daysAgo: 1, hour: 20 }),
        longest_streak: 9,
        total_xp: 4260,
        user_id: memberActiveId,
      },
      {
        id: seedId('progression-profile:member-premium'),
        active_season_id: activeSeasonId,
        current_season_points: 312,
        current_streak: 12,
        last_progressed_at: analyticsAt({ daysAgo: 0, hour: 19 }),
        longest_streak: 15,
        total_xp: 7810,
        user_id: memberPremiumId,
      },
      ...(memberFrozenId
        ? [
            {
              id: seedId('progression-profile:member-frozen'),
              active_season_id: activeSeasonId,
              current_season_points: 42,
              current_streak: 0,
              last_progressed_at: analyticsAt({ daysAgo: 10, hour: 18 }),
              longest_streak: 4,
              total_xp: 1290,
              user_id: memberFrozenId,
            },
          ]
        : []),
      ...(memberPendingId
        ? [
            {
              id: seedId('progression-profile:member-pending'),
              active_season_id: activeSeasonId,
              current_season_points: 16,
              current_streak: 1,
              last_progressed_at: analyticsAt({ daysAgo: 3, hour: 17 }),
              longest_streak: 1,
              total_xp: 320,
              user_id: memberPendingId,
            },
          ]
        : []),
      ...(memberExpiredId
        ? [
            {
              id: seedId('progression-profile:member-expired'),
              active_season_id: activeSeasonId,
              current_season_points: 0,
              current_streak: 0,
              last_progressed_at: analyticsAt({ daysAgo: 31, hour: 16 }),
              longest_streak: 7,
              total_xp: 2140,
              user_id: memberExpiredId,
            },
          ]
        : []),
    ],
  });

  await prisma.rankingProfile.createMany({
    data: ensuredAccounts.map(({ account, userId }) => ({
      id: seedId(`ranking-profile:${account.key}`),
      admin_note:
        account.key === 'member-frozen'
          ? 'Frozen account hidden while termination request is pending.'
          : null,
      display_alias:
        account.key === 'member-premium'
          ? 'Iron Luca'
          : account.key === 'member-active'
            ? 'Ava Strong'
            : null,
      governance_status:
        account.key === 'member-frozen'
          ? RankingGovernanceStatus.hidden_by_user
          : account.key === 'member-expired'
            ? RankingGovernanceStatus.hidden_by_admin
            : RankingGovernanceStatus.normal,
      user_id: userId,
      visibility:
        account.key === 'member-expired'
          ? RankingVisibility.private
          : account.key === 'member-pending'
            ? RankingVisibility.anonymous
            : RankingVisibility.public,
    })),
  });

  await prisma.integrityProfile.createMany({
    data: ensuredAccounts.map(({ account, userId }) => ({
      id: seedId(`integrity-profile:${account.key}`),
      last_flagged_at:
        account.key === 'member-frozen'
          ? analyticsAt({ daysAgo: 1, hour: 21 })
          : null,
      last_resolved_at:
        account.key === 'member-expired'
          ? analyticsAt({ daysAgo: 33, hour: 10 })
          : null,
      open_case_count: account.key === 'member-frozen' ? 1 : 0,
      risk_level:
        account.key === 'member-frozen'
          ? IntegrityRiskLevel.medium
          : account.key === 'member-expired'
            ? IntegrityRiskLevel.high
            : IntegrityRiskLevel.low,
      user_id: userId,
    })),
  });

  if (activeSeasonId) {
    await prisma.seasonalStanding.createMany({
      data: [
        {
          id: seedId('standing:active-season:member-premium'),
          is_disqualified: false,
          is_hidden: false,
          last_earned_at: analyticsAt({ daysAgo: 0, hour: 19 }),
          rank_position: 1,
          season_id: activeSeasonId,
          season_points: 312,
          user_id: memberPremiumId,
        },
        {
          id: seedId('standing:active-season:member-active'),
          is_disqualified: false,
          is_hidden: false,
          last_earned_at: analyticsAt({ daysAgo: 1, hour: 20 }),
          rank_position: 2,
          season_id: activeSeasonId,
          season_points: 186,
          user_id: memberActiveId,
        },
        ...(memberPendingId
          ? [
              {
                id: seedId('standing:active-season:member-pending'),
                is_disqualified: false,
                is_hidden: false,
                last_earned_at: analyticsAt({ daysAgo: 3, hour: 17 }),
                rank_position: 3,
                season_id: activeSeasonId,
                season_points: 16,
                user_id: memberPendingId,
              },
            ]
          : []),
        ...(memberFrozenId
          ? [
              {
                id: seedId('standing:active-season:member-frozen'),
                is_disqualified: false,
                is_hidden: true,
                last_earned_at: analyticsAt({ daysAgo: 10, hour: 18 }),
                rank_position: null,
                season_id: activeSeasonId,
                season_points: 42,
                user_id: memberFrozenId,
              },
            ]
          : []),
      ],
    });
  }

  const milestoneProgressRows = [
    {
      key: 'first-workout-complete',
      userId: memberActiveId,
      status: MilestoneProgressStatus.claimed,
      progress: 1,
    },
    {
      key: 'first-workout-complete',
      userId: memberPremiumId,
      status: MilestoneProgressStatus.claimed,
      progress: 1,
    },
    {
      key: 'season-100-points',
      userId: memberPremiumId,
      status: MilestoneProgressStatus.unlocked,
      progress: 312,
    },
    {
      key: 'multi-muscle-foundation',
      userId: memberActiveId,
      status: MilestoneProgressStatus.in_progress,
      progress: 2,
    },
  ];
  await prisma.userMilestoneProgress.createMany({
    data: milestoneProgressRows
      .map((row) => {
        const milestoneId = milestoneIds.get(row.key);
        if (!milestoneId) {
          return null;
        }

        const unlockedAt =
          row.status === MilestoneProgressStatus.in_progress
            ? null
            : analyticsAt({ daysAgo: 1, hour: 20 });

        return {
          id: seedId(`milestone-progress:${row.userId}:${row.key}`),
          claimed_at:
            row.status === MilestoneProgressStatus.claimed
              ? analyticsAt({ daysAgo: 1, hour: 21 })
              : null,
          milestone_definition_id: milestoneId,
          progress_payload: {
            source: 'seed-test-data',
            value: row.progress,
          } as Prisma.InputJsonValue,
          progress_value: row.progress,
          status: row.status,
          unlocked_at: unlockedAt,
          user_id: row.userId,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row)),
  });

  const workoutSourceEventId = seedId('progression-source:member-active:workout');
  const poseSourceEventId = seedId('progression-source:member-active:pose');
  const flaggedSourceEventId = seedId('progression-source:member-frozen:flagged');
  const workoutSourceId =
    activeWorkout?.id ?? seedId('source-id:member-active:workout');

  await prisma.progressionSourceEvent.createMany({
    data: [
      {
        id: workoutSourceEventId,
        processed_at: analyticsAt({ daysAgo: 1, hour: 20 }),
        source_context: {
          integrity: 'VERIFIED',
          reps: 18,
          source: 'seed workout session',
        } as Prisma.InputJsonValue,
        source_id: workoutSourceId,
        source_status: ProgressionSourceStatus.applied,
        source_type: ProgressionSourceType.workout_session_completed,
        user_id: memberActiveId,
      },
      {
        id: poseSourceEventId,
        processed_at: analyticsAt({ daysAgo: 1, hour: 20 }),
        source_context: {
          classificationConfidence: 0.92,
          poseSessionId: activePose?.id ?? null,
        } as Prisma.InputJsonValue,
        source_id: activePose?.id ?? seedId('source-id:member-active:pose'),
        source_status: ProgressionSourceStatus.applied,
        source_type: ProgressionSourceType.pose_session_finalized,
        user_id: memberActiveId,
      },
      ...(memberFrozenId
        ? [
            {
              id: flaggedSourceEventId,
              processed_at: analyticsAt({ daysAgo: 1, hour: 21 }),
              source_context: {
                reason_codes: ['one_arm_motion', 'body_line_break'],
                exercise: 'Push-Up',
              } as Prisma.InputJsonValue,
              source_id: seedId('source-id:member-frozen:flagged-pushup'),
              source_status: ProgressionSourceStatus.reduced,
              source_type: ProgressionSourceType.pose_session_flagged,
              user_id: memberFrozenId,
            },
          ]
        : []),
    ],
  });

  const penaltyGrantId = seedId('progression-grant:member-frozen:penalty');
  await prisma.progressionGrantLedger.createMany({
    data: [
      {
        id: seedId('progression-grant:member-active:xp'),
        amount: 96,
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.xp,
        metadata: {
          integrityMultiplier: 1.2,
          muscleShares: [
            { muscle: 'chest', xp: 48 },
            { muscle: 'triceps', xp: 29 },
            { muscle: 'front_delts', xp: 19 },
          ],
        } as Prisma.InputJsonValue,
        muscle_group: 'Chest',
        reason: 'Verified workout session XP',
        season_id: activeSeasonId,
        source_event_id: workoutSourceEventId,
        user_id: memberActiveId,
      },
      {
        id: seedId('progression-grant:member-active:season-points'),
        amount: 24,
        grant_status: ProgressionGrantStatus.applied,
        grant_type: ProgressionGrantType.season_points,
        metadata: {
          seasonRule: 'verified-rep-block',
        } as Prisma.InputJsonValue,
        reason: 'Verified season points from workout',
        season_id: activeSeasonId,
        source_event_id: workoutSourceEventId,
        user_id: memberActiveId,
      },
      ...(memberFrozenId
        ? [
            {
              id: penaltyGrantId,
              amount: -20,
              grant_status: ProgressionGrantStatus.applied,
              grant_type: ProgressionGrantType.penalty,
              metadata: {
                reason_codes: ['push_up_body_not_horizontal'],
              } as Prisma.InputJsonValue,
              reason: 'Reduced reward for flagged pose evidence',
              season_id: activeSeasonId,
              source_event_id: flaggedSourceEventId,
              user_id: memberFrozenId,
            },
          ]
        : []),
    ],
  });

  let integrityCaseId: string | null = null;
  if (memberFrozenId) {
    integrityCaseId = seedId('integrity-case:member-frozen:pushup');
    await prisma.integrityCase.create({
      data: {
        id: integrityCaseId,
        opened_at: analyticsAt({ daysAgo: 1, hour: 21 }),
        status: IntegrityCaseStatus.under_review,
        summary:
          'Push-up evidence showed one-arm motion and insufficient body travel.',
        user_id: memberFrozenId,
      },
    });

    await prisma.integrityEvent.create({
      data: {
        id: seedId('integrity-event:member-frozen:pushup'),
        details: {
          bodyLineTolerance: 45,
          elbowSymmetryDelta: 60,
          reason: 'Seeded event for admin integrity queue coverage.',
        } as Prisma.InputJsonValue,
        event_type: 'pose_session_flagged',
        integrity_case_id: integrityCaseId,
        is_resolved: false,
        reason_code: 'bilateral_motion_failed',
        risk_level: IntegrityRiskLevel.medium,
        source_event_id: flaggedSourceEventId,
        user_id: memberFrozenId,
      },
    });

    await prisma.moderationActionRecord.create({
      data: {
        id: seedId('moderation-action:member-frozen:void-grant'),
        action_type: ModerationActionType.void_progression_grant,
        actor_user_id: adminUserId,
        after_state: {
          rewardVisibility: 'reduced',
        } as Prisma.InputJsonValue,
        before_state: {
          rewardVisibility: 'normal',
        } as Prisma.InputJsonValue,
        integrity_case_id: integrityCaseId,
        progression_grant_id: penaltyGrantId,
        rationale:
          'Seeded moderation action for testing progression audit and integrity queues.',
        season_id: activeSeasonId,
        source_event_id: flaggedSourceEventId,
        target_user_id: memberFrozenId,
      },
    });
  }

  await prisma.notification.createMany({
    data: [
      {
        id: seedId('notification:member-active:rank-up'),
        body: 'Your verified workout pushed you into the top three this season.',
        channel: NotificationChannel.in_app,
        data: { rank: 2, seasonId: activeSeasonId } as Prisma.InputJsonValue,
        read_at: null,
        sent_at: analyticsAt({ daysAgo: 1, hour: 20 }),
        status: NotificationStatus.sent,
        title: 'Season rank updated',
        type: NotificationType.rank_up,
        user_id: memberActiveId,
      },
      {
        id: seedId('notification:member-premium:booking'),
        body: 'Your next recurring coaching block is queued for this week.',
        channel: NotificationChannel.in_app,
        data: {
          recurringPlanId: seedId('recurring-plan:member-premium:staff'),
        } as Prisma.InputJsonValue,
        read_at: analyticsAt({ daysAgo: 0, hour: 9 }),
        sent_at: analyticsAt({ daysAgo: 0, hour: 8 }),
        status: NotificationStatus.read,
        title: 'Coaching plan ready',
        type: NotificationType.booking_confirmed,
        user_id: memberPremiumId,
      },
      ...(memberExpiredId
        ? [
            {
              id: seedId('notification:member-expired:expired'),
              body: 'Your membership has expired. Renew to restore member-only workout features.',
              channel: NotificationChannel.in_app,
              data: { route: '/profile' } as Prisma.InputJsonValue,
              error: null,
              read_at: null,
              sent_at: analyticsAt({ daysAgo: 2, hour: 8 }),
              status: NotificationStatus.sent,
              title: 'Membership expired',
              type: NotificationType.subscription_expired,
              user_id: memberExpiredId,
            },
          ]
        : []),
      {
        id: seedId('notification:staff:low-stock'),
        body: 'Hex dumbbell set quantity was adjusted after inventory review.',
        channel: NotificationChannel.in_app,
        data: {
          equipmentId: seedId('analytics-equipment:hex-dumbbell-set'),
        } as Prisma.InputJsonValue,
        read_at: null,
        sent_at: analyticsAt({ daysAgo: 0, hour: 11 }),
        status: NotificationStatus.sent,
        title: 'Inventory adjustment logged',
        type: NotificationType.equipment_write_off,
        user_id: staffUserId,
      },
    ],
  });

  const aiSessionId = seedId('ai-chat-session:member-active:nutrition');
  await prisma.aiChatSession.create({
    data: {
      id: aiSessionId,
      context_type: ChatContext.nutrition,
      is_active: true,
      last_activity_at: analyticsAt({ daysAgo: 0, hour: 9 }),
      title: 'Protein target check-in',
      user_id: memberActiveId,
    },
  });
  await prisma.aiChatMessage.createMany({
    data: [
      {
        id: seedId('ai-message:member-active:user'),
        content: 'Can I hit my protein target with chicken and rice today?',
        role: ChatRole.user,
        session_id: aiSessionId,
      },
      {
        id: seedId('ai-message:member-active:assistant'),
        action_triggered: 'nutrition_summary',
        content:
          'Yes. Your remaining target is roughly 52g protein, so one chicken-rice meal plus yogurt would close the gap.',
        role: ChatRole.assistant,
        session_id: aiSessionId,
      },
    ],
  });
  await prisma.aiInteractionLog.create({
    data: {
      id: seedId('ai-interaction:member-active:nutrition'),
      action_result: {
        suggestedMeal: 'chicken rice bowl',
        targetClosed: true,
      } as Prisma.InputJsonValue,
      action_triggered: 'nutrition_summary',
      interaction_type: InteractionType.chat,
      latency_ms: 820,
      model_used: 'seed-local-contract',
      request_payload: {
        context: 'nutrition',
        prompt: 'Can I hit protein target today?',
      } as Prisma.InputJsonValue,
      response_payload: {
        confidence: 0.84,
        answer: 'Protein gap can be closed with one meal.',
      } as Prisma.InputJsonValue,
      session_id: aiSessionId,
      token_count: 310,
      user_id: memberActiveId,
    },
  });

  const gymChatSessionId = seedId('gym-chat-session:member-premium:hours');
  await prisma.gymChatSession.create({
    data: {
      id: gymChatSessionId,
      is_active: true,
      last_activity_at: analyticsAt({ daysAgo: 0, hour: 10 }),
      title: 'Gym hours and promos',
      user_id: memberPremiumId,
    },
  });
  await prisma.gymChatMessage.createMany({
    data: [
      {
        id: seedId('gym-chat-message:member-premium:user'),
        content: 'What time does the gym close and are there promos?',
        role: GymChatRole.user,
        session_id: gymChatSessionId,
      },
      {
        id: seedId('gym-chat-message:member-premium:assistant'),
        content:
          'Weekday closing is 10 PM. The seeded student starter promo is active this month.',
        grounded_sources: {
          sources: ['gym_operating_hours', 'gym_promotions'],
        } as Prisma.InputJsonValue,
        role: GymChatRole.assistant,
        session_id: gymChatSessionId,
      },
    ],
  });
  await prisma.gymChatInteractionLog.create({
    data: {
      id: seedId('gym-chat-interaction:member-premium:hours'),
      grounding_payload: {
        tables: ['gym_operating_hours', 'gym_promotions', 'gym_faq_entries'],
      } as Prisma.InputJsonValue,
      latency_ms: 540,
      model_used: 'seed-grounded-chat',
      request_payload: {
        query: 'hours and promos',
      } as Prisma.InputJsonValue,
      response_payload: {
        answer: 'Weekday closing is 10 PM and starter promo is active.',
      } as Prisma.InputJsonValue,
      session_id: gymChatSessionId,
      token_count: 180,
      user_id: memberPremiumId,
    },
  });

  await prisma.gymOperatingHour.createMany({
    data: [
      ['Sunday', 0, '08:00:00', '18:00:00', false],
      ['Monday', 1, '06:00:00', '22:00:00', false],
      ['Tuesday', 2, '06:00:00', '22:00:00', false],
      ['Wednesday', 3, '06:00:00', '22:00:00', false],
      ['Thursday', 4, '06:00:00', '22:00:00', false],
      ['Friday', 5, '06:00:00', '22:00:00', false],
      ['Saturday', 6, '07:00:00', '20:00:00', false],
    ].map(([label, day, opensAt, closesAt, isClosed]) => ({
      id: seedId(`gym-hour:${day}`),
      closes_at: fixedTime(closesAt as string),
      day_of_week: day as number,
      is_active: true,
      is_closed: isClosed as boolean,
      label: label as string,
      opens_at: fixedTime(opensAt as string),
    })),
  });

  await prisma.gymSpecialSchedule.create({
    data: {
      id: seedId('gym-special-schedule:founders-day'),
      closes_at: fixedTime('17:00:00'),
      ends_on: nutritionDate(-14),
      is_active: true,
      is_closed: false,
      opens_at: fixedTime('09:00:00'),
      pricing_note: 'Member guest passes are half price during the event.',
      reason: 'Founder Day shortened hours',
      starts_on: nutritionDate(-14),
    },
  });

  await prisma.gymPromotion.create({
    data: {
      id: seedId('gym-promotion:student-starter'),
      description:
        'Starter package for students with discounted first-month access and free onboarding.',
      ends_at: analyticsAt({ daysAgo: -21, hour: 23 }),
      is_active: true,
      pricing_note: 'Save PHP 250 on Starter Monthly.',
      promo_code: 'STUDENTSTART',
      starts_at: analyticsAt({ daysAgo: 6, hour: 0 }),
      title: 'Student Starter Promo',
    },
  });

  await prisma.gymFaqEntry.createMany({
    data: [
      {
        id: seedId('gym-faq:hours'),
        answer:
          'Weekdays run 6 AM to 10 PM, Saturday runs 7 AM to 8 PM, and Sunday runs 8 AM to 6 PM.',
        category: GymFaqCategory.hours,
        keywords: ['hours', 'schedule', 'closing'] as Prisma.InputJsonValue,
        question: 'What are the gym hours?',
        sort_order: 1,
      },
      {
        id: seedId('gym-faq:membership-card'),
        answer:
          'Members need an active membership card or active subscription to access member-only gym features.',
        category: GymFaqCategory.membership,
        keywords: ['membership', 'card', 'access'] as Prisma.InputJsonValue,
        question: 'Do I need a membership card?',
        sort_order: 2,
      },
      {
        id: seedId('gym-faq:coaching'),
        answer:
          'Coaching can be booked per session or through a recurring plan once a coach accepts the relationship.',
        category: GymFaqCategory.coaching,
        keywords: ['coach', 'booking', 'recurring'] as Prisma.InputJsonValue,
        question: 'How does coaching work?',
        sort_order: 3,
      },
      {
        id: seedId('gym-faq:training'),
        answer:
          'Workout tracking uses pose evidence, rep rules, spatial rules, and admin-reviewed exercise definitions.',
        category: GymFaqCategory.training,
        keywords: ['workout', 'pose', 'exercise'] as Prisma.InputJsonValue,
        question: 'How are workouts tracked?',
        sort_order: 4,
      },
      {
        id: seedId('gym-faq:nutrition'),
        answer:
          'Nutrition targets use your active TDEE profile and macro target, then compare logged meals against your goal.',
        category: GymFaqCategory.nutrition,
        keywords: ['nutrition', 'macro', 'tdee'] as Prisma.InputJsonValue,
        question: 'How are macro targets calculated?',
        sort_order: 5,
      },
    ],
  });

  await prisma.facilityFloorPlanMedia.createMany({
    data: [
      {
        floor_id: 'floor-1',
        image_url: 'https://fittrack.dev/floor-plans/floor-1.png',
      },
      {
        floor_id: 'floor-2',
        image_url: 'https://fittrack.dev/floor-plans/floor-2.png',
      },
      {
        floor_id: 'floor-3',
        image_url: 'https://fittrack.dev/floor-plans/floor-3.png',
      },
    ],
  });

  await prisma.gymEquipment.createMany({
    data: [
      {
        id: seedId('gym-equipment:bench-a'),
        floor_id: 'floor-1',
        grid_column: 4,
        grid_row: 3,
        icon_key: 'bench',
        name: 'Adjustable Bench A',
        position_x: new Prisma.Decimal('34.25'),
        position_y: new Prisma.Decimal('28.50'),
        status: EquipmentStatus.available,
        type: 'bench',
      },
      {
        id: seedId('gym-equipment:dumbbell-rack'),
        floor_id: 'floor-1',
        grid_column: 5,
        grid_row: 4,
        icon_key: 'dumbbell',
        name: 'Dumbbell Rack',
        position_x: new Prisma.Decimal('45.00'),
        position_y: new Prisma.Decimal('38.75'),
        status: EquipmentStatus.occupied,
        type: 'free_weights',
      },
      {
        id: seedId('gym-equipment:cable-station'),
        floor_id: 'floor-1',
        grid_column: 8,
        grid_row: 2,
        icon_key: 'cable',
        name: 'Cable Station',
        position_x: new Prisma.Decimal('70.50'),
        position_y: new Prisma.Decimal('22.25'),
        status: EquipmentStatus.available,
        type: 'cable_machine',
      },
      {
        id: seedId('gym-equipment:rower-a'),
        floor_id: 'floor-2',
        grid_column: 3,
        grid_row: 6,
        icon_key: 'rower',
        name: 'Concept Rower A',
        position_x: new Prisma.Decimal('24.00'),
        position_y: new Prisma.Decimal('62.00'),
        status: EquipmentStatus.maintenance,
        type: 'cardio',
      },
    ],
  });

  await prisma.equipmentWriteOff.create({
    data: {
      id: seedId('equipment-writeoff:hex-dumbbell-set'),
      equipment_id: seedId('analytics-equipment:hex-dumbbell-set'),
      performed_by: staffUserId,
      quantity_before: 20,
      quantity_lost: 2,
      quantity_set_to: 18,
      reason: 'Two adjustable collars were damaged during audit and removed from available inventory.',
    },
  });

  await prisma.auditLog.createMany({
    data: [
      {
        id: seedId('audit:member-premium:creator-approved'),
        action: 'CREATOR_PROFILE_APPROVED',
        after: { state: 'approved' } as Prisma.InputJsonValue,
        before: { state: 'pending_review' } as Prisma.InputJsonValue,
        entity: 'CreatorProfile',
        entity_id: seedId('creator-profile:member-premium'),
        ip_address: '127.0.0.1',
        user_id: adminUserId,
      },
      {
        id: seedId('audit:equipment:writeoff'),
        action: 'EQUIPMENT_WRITE_OFF_CREATED',
        after: { quantity_current: 18 } as Prisma.InputJsonValue,
        before: { quantity_current: 20 } as Prisma.InputJsonValue,
        entity: 'GymEquipmentItem',
        entity_id: seedId('analytics-equipment:hex-dumbbell-set'),
        ip_address: '127.0.0.1',
        user_id: staffUserId,
      },
      {
        id: seedId('audit:exercise-review:hammer-curl'),
        action: 'EXERCISE_REVIEW_QUEUED',
        after: { status: 'pending' } as Prisma.InputJsonValue,
        entity: 'ExerciseReviewSubmission',
        entity_id: seedId('exercise-review:member-premium:hammer-curl'),
        ip_address: '127.0.0.1',
        user_id: memberPremiumId,
      },
    ],
  });

  await prisma.businessInsightRun.createMany({
    data: [
      {
        id: seedId('business-insight:overview:weekly'),
        end_date: nutritionDate(0),
        focus: InsightFocus.overview,
        insight_payload: {
          headline: 'Premium members and verified workout sessions are driving engagement.',
          risks: ['Frozen account integrity cases need closure'],
          opportunities: ['Promote recurring coaching to active members'],
        } as Prisma.InputJsonValue,
        latency_ms: 940,
        model_used: 'seed-business-analyst',
        period: InsightPeriod.weekly,
        request_payload: {
          source: 'seed dashboard',
          include: ['revenue', 'attendance', 'gamification'],
        } as Prisma.InputJsonValue,
        requested_by: adminUserId,
        start_date: nutritionDate(7),
        token_count: 640,
      },
      {
        id: seedId('business-insight:inventory:monthly'),
        end_date: nutritionDate(0),
        focus: InsightFocus.inventory,
        insight_payload: {
          headline: 'Dumbbell stock needs review after write-off.',
          risks: ['Free-weight shortages during peak hours'],
          opportunities: ['Move cable station maintenance earlier'],
        } as Prisma.InputJsonValue,
        latency_ms: 710,
        model_used: 'seed-business-analyst',
        period: InsightPeriod.monthly,
        request_payload: {
          source: 'seed inventory view',
          include: ['equipment', 'write_offs'],
        } as Prisma.InputJsonValue,
        requested_by: staffUserId,
        start_date: nutritionDate(30),
        token_count: 420,
      },
    ],
  });

  if (conditioningCoachId && memberNoMembershipId) {
    await prisma.coachClientRelationship.create({
      data: {
        id: seedId('coach-client:conditioning:member-nomembership'),
        coach_id: conditioningCoachId,
        member_id: memberNoMembershipId,
        notes:
          'Terminated seed relationship to cover relationship history states.',
        ended_at: analyticsAt({ daysAgo: 12, hour: 15 }),
        started_at: analyticsAt({ daysAgo: 60, hour: 15 }),
        status: RelationshipStatus.terminated,
      },
    });
  }

  if (curlExercise?.id) {
    await prisma.exerciseCatalog.update({
      where: { id: curlExercise.id },
      data: {
        muscle_targets: [
          { key: 'biceps', role: 'primary', effortPercent: 70 },
          { key: 'forearms', role: 'secondary', effortPercent: 20 },
          { key: 'front_delts', role: 'stabilizer', effortPercent: 10 },
        ] as Prisma.InputJsonValue,
      },
    });
  }

  await prisma.user.updateMany({
    where: { id: { in: baselineUserIds } },
    data: { status: UserStatus.active },
  });
}

async function buildCounts() {
  const [
    users,
    identities,
    profiles,
    notificationPreferences,
    coachProfiles,
    coachAvailabilitySlots,
    coachAppointments,
    coachReviews,
    amenityBookings,
    membershipPlans,
    subscriptions,
    membershipCards,
    deletionRequests,
    exerciseCatalog,
    trainingPlans,
    workoutSessions,
    exerciseLogs,
    poseProfiles,
    poseSessions,
    muscleMastery,
    tdeeProfiles,
    macroTargets,
    nutritionLogs,
    progressMetrics,
    amenities,
    aiChatSessions,
    aiInteractionLogs,
    auditLogs,
    businessInsightRuns,
    coachClientRelationships,
    equipmentWriteOffs,
    exerciseReviewSubmissions,
    facilityFloorPlans,
    gymChatSessions,
    gymEquipment,
    gymFaqEntries,
    gymOperatingHours,
    gymPromotions,
    gymSpecialSchedules,
    integrityCases,
    integrityEvents,
    integrityProfiles,
    moderationActions,
    notifications,
    progressionEvents,
    progressionGrants,
    progressionProfiles,
    rankingProfiles,
    recurringBillingCycles,
    recurringPlans,
    seasonalStandings,
    userMilestoneProgress,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.authIdentity.count(),
    prisma.userProfile.count(),
    prisma.notificationPreference.count(),
    prisma.coachProfile.count(),
    prisma.coachAvailabilitySlot.count(),
    prisma.coachAppointment.count(),
    prisma.coachReview.count(),
    prisma.amenityBooking.count(),
    prisma.membershipPlan.count(),
    prisma.subscription.count(),
    prisma.membershipCard.count(),
    prisma.accountDeletionRequest.count(),
    prisma.exerciseCatalog.count(),
    prisma.trainingPlan.count(),
    prisma.workoutSession.count(),
    prisma.exerciseLog.count(),
    prisma.poseExerciseProfile.count(),
    prisma.poseSession.count(),
    prisma.muscleMasteryProgress.count(),
    prisma.tdeeProfile.count(),
    prisma.macroTarget.count(),
    prisma.nutritionLog.count(),
    prisma.progressMetric.count(),
    prisma.amenity.count(),
    prisma.aiChatSession.count(),
    prisma.aiInteractionLog.count(),
    prisma.auditLog.count(),
    prisma.businessInsightRun.count(),
    prisma.coachClientRelationship.count(),
    prisma.equipmentWriteOff.count(),
    prisma.exerciseReviewSubmission.count(),
    prisma.facilityFloorPlanMedia.count(),
    prisma.gymChatSession.count(),
    prisma.gymEquipment.count(),
    prisma.gymFaqEntry.count(),
    prisma.gymOperatingHour.count(),
    prisma.gymPromotion.count(),
    prisma.gymSpecialSchedule.count(),
    prisma.integrityCase.count(),
    prisma.integrityEvent.count(),
    prisma.integrityProfile.count(),
    prisma.moderationActionRecord.count(),
    prisma.notification.count(),
    prisma.progressionSourceEvent.count(),
    prisma.progressionGrantLedger.count(),
    prisma.userProgressionProfile.count(),
    prisma.rankingProfile.count(),
    prisma.recurringCoachingBillingCycle.count(),
    prisma.recurringCoachingPlan.count(),
    prisma.seasonalStanding.count(),
    prisma.userMilestoneProgress.count(),
  ]);

  return {
    auth: {
      identities,
      notificationPreferences,
      profiles,
      users,
    },
    coaching: {
      appointments: coachAppointments,
      availabilitySlots: coachAvailabilitySlots,
      clientRelationships: coachClientRelationships,
      coachProfiles,
      recurringBillingCycles,
      recurringPlans,
      reviews: coachReviews,
    },
    communications: {
      aiChatSessions,
      aiInteractionLogs,
      gymChatSessions,
      notifications,
    },
    facilities: {
      amenities,
      bookings: amenityBookings,
      equipment: gymEquipment,
      faqEntries: gymFaqEntries,
      floorPlans: facilityFloorPlans,
      operatingHours: gymOperatingHours,
      promotions: gymPromotions,
      specialSchedules: gymSpecialSchedules,
    },
    fitness: {
      exerciseCatalog,
      exerciseLogs,
      exerciseReviewSubmissions,
      muscleMastery,
      poseProfiles,
      poseSessions,
      trainingPlans,
      workoutSessions,
    },
    gamification: {
      integrityCases,
      integrityEvents,
      integrityProfiles,
      moderationActions,
      progressionEvents,
      progressionGrants,
      progressionProfiles,
      rankingProfiles,
      seasonalStandings,
      userMilestoneProgress,
    },
    operations: {
      auditLogs,
      businessInsightRuns,
      equipmentWriteOffs,
    },
    membership: {
      deletionRequests,
      membershipCards,
      membershipPlans,
      subscriptions,
    },
    nutrition: {
      macroTargets,
      nutritionLogs,
      progressMetrics,
      tdeeProfiles,
    },
  };
}

async function main() {
  const mode = resolveSeedMode(process.argv);

  const bootstrapSummary = await bootstrapDefaults(prisma);
  await ensureMembershipPlans();
  await cleanupDeprecatedCoachSeeds();
  await cleanupGymOperationsData();
  await cleanupPreviousSeedAnalyticsData();

  const ensuredAccounts: EnsuredAccount[] = [];
  for (const account of BASELINE_TEST_ACCOUNTS) {
    ensuredAccounts.push(await ensureTestAccount(account));
  }

  await cleanupUsersOutsideBaseline(ensuredAccounts);
  await ensureMemberStates(ensuredAccounts);
  await ensureNutritionFixtures(ensuredAccounts);
  const coachProfiles = await ensureCoachProfiles(ensuredAccounts);
  await ensureGymOperationsVenueBookings(ensuredAccounts, coachProfiles);
  await ensureAnalyticsFixtures(ensuredAccounts, coachProfiles);
  await ensureMasteryProgress(ensuredAccounts);
  await ensureWorkoutFixtures(ensuredAccounts);
  await ensureFeatureCoverageFixtures(ensuredAccounts, coachProfiles);

  const counts = await buildCounts();
  const notableIds = {
    activeMemberUserId:
      ensuredAccounts.find(({ account }) => account.key === 'member-active')
        ?.userId ?? '',
    premiumMemberUserId:
      ensuredAccounts.find(({ account }) => account.key === 'member-premium')
        ?.userId ?? '',
    pendingMemberUserId:
      ensuredAccounts.find(({ account }) => account.key === 'member-pending')
        ?.userId ?? '',
    frozenMemberUserId:
      ensuredAccounts.find(({ account }) => account.key === 'member-frozen')
        ?.userId ?? '',
    memberActiveCardId: seedId('membership-card:member-active'),
    memberPremiumCardId: seedId('membership-card:member-premium'),
  };

  const manifest = await writeTestDataManifest({
    counts,
    credentials: toManifestCredentials(BASELINE_TEST_ACCOUNTS),
    mode,
    notableIds,
    runAt: new Date().toISOString(),
    suggestedManualTestPaths: [...BASELINE_TEST_MANUAL_PATHS],
  });

  console.log(`[test-data] mode=${mode}`);
  console.log(
    `[test-data] bootstrap defaults ensured for ${bootstrapSummary.adminEmail} and ${bootstrapSummary.demoMemberEmail}`,
  );
  console.log(
    `[test-data] coaching fixtures ensured=${counts.coaching.coachProfiles} profiles, ${counts.coaching.appointments} appointments, masteryRows=${counts.fitness.muscleMastery}`,
  );
  console.log(
    `[test-data] workout fixtures ensured: exercises=${counts.fitness.exerciseCatalog}, plans=${counts.fitness.trainingPlans}, sessions=${counts.fitness.workoutSessions}, logs=${counts.fitness.exerciseLogs}, poseSessions=${counts.fitness.poseSessions}`,
  );
  console.log(`[test-data] manifest written to ${manifest.manifestPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
