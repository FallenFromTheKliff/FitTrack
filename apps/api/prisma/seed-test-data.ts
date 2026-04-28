import {
  AccountDeletionRequestStatus,
  AmenityType,
  AppointmentStatus,
  AuthProvider,
  BookingStatus,
  ExerciseCategory,
  FitnessGoal,
  MasteryRank,
  MembershipCardSource,
  MembershipCardStatus,
  PayableType,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  PlanSource,
  PoseProfileKind,
  Prisma,
  PrismaClient,
  SalePaymentMethod,
  SaleStatus,
  SessionStatus,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { config } from 'dotenv';

import { localEnvFilePath } from '../env-path';
import { bootstrapDefaults } from './defaults';
import {
  TEST_ACCOUNTS,
  type TestAccount,
  type TestDataSeedMode,
  seedId,
} from './test-data/constants';
import {
  toManifestCredentials,
  writeTestDataManifest,
} from './test-data/manifest';

const PASSWORD_HASH_ROUNDS = 12;

const TEST_MANUAL_PATHS = [
  {
    area: 'web-members',
    credentialKey: 'admin',
    route: '/members',
    expected:
      'Review the seeded member-card roster and membership lifecycle states from the admin or staff side.',
  },
  {
    area: 'web-schedule',
    credentialKey: 'staff',
    route: '/schedule',
    expected:
      'Review Gym Operations with seeded coach schedule, appointment control, and venue booking data from the staff side.',
  },
  {
    area: 'mobile-mastery',
    credentialKey: 'member-active',
    route: '/(tabs)/mastery',
    expected:
      'Verify the standalone Muscle Mastery surface shows seeded progress and leaderboard data for an active member-card account.',
  },
  {
    area: 'mobile-mastery-locked',
    credentialKey: 'member-pending',
    route: '/(tabs)/mastery',
    expected:
      'Verify the lock state appears for a member account without an active membership card.',
  },
  {
    area: 'mobile-profile-frozen',
    credentialKey: 'member-frozen',
    route: '/(tabs)/profile',
    expected:
      'Confirm the frozen-account restrictions appear alongside the pending account deletion request.',
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

async function ensureCoachProfiles(ensuredAccounts: readonly EnsuredAccount[]) {
  const coachProfiles: Record<string, string> = {};

  const coachSeeds = [
    {
      accountKey: 'staff',
      averageRating: new Prisma.Decimal('4.90'),
      bio: 'Floor-first coaching profile used to review bookings, readiness, and weekly availability from the staff console.',
      certification: 'NASM-CPT',
      hourlyRate: new Prisma.Decimal('850'),
      isAvailableForBooking: true,
      ratingCount: 18,
      specialization: 'Mobility, strength fundamentals, onboarding sessions',
    },
    {
      accountKey: 'member-nomembership',
      averageRating: new Prisma.Decimal('4.72'),
      bio: 'Conditioning and boxing-focused coach profile used for gym-operations staffing checks and venue-linked sessions.',
      certification: 'ACE-CPT',
      hourlyRate: new Prisma.Decimal('900'),
      isAvailableForBooking: true,
      ratingCount: 11,
      specialization: 'Conditioning, boxing, athletic movement',
    },
    {
      accountKey: 'member-expired',
      averageRating: new Prisma.Decimal('4.81'),
      bio: 'Recovery-led coaching profile for yoga and lower-intensity mobility blocks that still need booking visibility checks.',
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
      key: 'gym-ops:basketball-court',
      name: 'Basketball Court',
      type: AmenityType.basketball_court,
      capacity: 10,
      hourlyRate: new Prisma.Decimal('1500'),
      floorId: 'court-a',
    },
    {
      key: 'gym-ops:boxing-ring',
      name: 'Boxing Ring',
      type: AmenityType.boxing_ring,
      capacity: 4,
      hourlyRate: new Prisma.Decimal('1200'),
      floorId: 'ring-a',
    },
    {
      key: 'gym-ops:yoga-room',
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

  if (memberActiveId && amenityIds.get('gym-ops:basketball-court')) {
    bookingSeeds.push({
      id: seedId('amenity-booking:member-active:basketball'),
      userId: memberActiveId,
      amenityId: amenityIds.get('gym-ops:basketball-court')!,
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

  if (memberPremiumId && amenityIds.get('gym-ops:boxing-ring')) {
    bookingSeeds.push({
      id: seedId('amenity-booking:member-premium:boxing-ring'),
      userId: memberPremiumId,
      amenityId: amenityIds.get('gym-ops:boxing-ring')!,
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

  if (memberActiveId && amenityIds.get('gym-ops:yoga-room')) {
    bookingSeeds.push({
      id: seedId('amenity-booking:member-active:yoga-room'),
      userId: memberActiveId,
      amenityId: amenityIds.get('gym-ops:yoga-room')!,
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

  if (memberPendingId && amenityIds.get('gym-ops:basketball-court')) {
    bookingSeeds.push({
      id: seedId('amenity-booking:member-pending:basketball'),
      userId: memberPendingId,
      amenityId: amenityIds.get('gym-ops:basketball-court')!,
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

async function ensureAnalyticsFixtures(
  ensuredAccounts: readonly EnsuredAccount[],
  coachProfiles: Record<string, string>,
) {
  const adminUserId =
    ensuredAccounts.find(({ account }) => account.key === 'admin')?.userId ?? null;
  const staffUserId =
    ensuredAccounts.find(({ account }) => account.key === 'staff')?.userId ??
    adminUserId;
  const memberActiveId =
    ensuredAccounts.find(({ account }) => account.key === 'member-active')?.userId ?? null;
  const memberPremiumId =
    ensuredAccounts.find(({ account }) => account.key === 'member-premium')?.userId ?? null;
  const memberFrozenId =
    ensuredAccounts.find(({ account }) => account.key === 'member-frozen')?.userId ?? null;
  const memberExpiredId =
    ensuredAccounts.find(({ account }) => account.key === 'member-expired')?.userId ?? null;
  const memberPendingId =
    ensuredAccounts.find(({ account }) => account.key === 'member-pending')?.userId ?? null;

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
      description: 'Fast-moving protein tub frequently highlighted in the front counter lineup.',
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
      description: 'Daily creatine SKU used to keep supplement revenue visible in analytics.',
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
      description: 'Accessory item for strength members and personal training clients.',
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
      description: 'Recovery shelf item that intentionally sits at low stock for alert coverage.',
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
      description: 'Branded shaker bottle used to keep merchandise visible in sales.',
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
      description: 'One bench is currently pulled from the floor for upholstery replacement.',
      imageUrl: 'https://fittrack.dev/assets/adjustable-bench.jpg',
      quantityTotal: 6,
      quantityCurrent: 5,
      unit: 'benches',
      createdAt: analyticsAt({ monthsAgo: 6, dayOfMonth: 3, hour: 8 }),
    },
    {
      id: seedId('analytics-equipment:spin-bike'),
      name: 'Spin Bike',
      description: 'Cardio bike fleet with a few units waiting on drivetrain servicing.',
      imageUrl: 'https://fittrack.dev/assets/spin-bike.jpg',
      quantityTotal: 10,
      quantityCurrent: 7,
      unit: 'bikes',
      createdAt: analyticsAt({ monthsAgo: 5, dayOfMonth: 11, hour: 8 }),
    },
    {
      id: seedId('analytics-equipment:hex-dumbbell-set'),
      name: 'Hex Dumbbell Set',
      description: 'Strength floor dumbbells with two pairs temporarily unavailable.',
      imageUrl: 'https://fittrack.dev/assets/hex-dumbbell-set.jpg',
      quantityTotal: 20,
      quantityCurrent: 18,
      unit: 'pairs',
      createdAt: analyticsAt({ monthsAgo: 4, dayOfMonth: 9, hour: 8 }),
    },
    {
      id: seedId('analytics-equipment:concept-rower'),
      name: 'Concept Rower',
      description: 'Cardio rowers currently fully available and used as a healthy control.',
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
      checkInAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 8, hour: 7, minute: 25 }),
      durationMinutes: 83,
    },
    {
      id: seedId('analytics-attendance:member-premium:month-2'),
      userId: memberPremiumId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 12, hour: 18, minute: 10 }),
      durationMinutes: 67,
    },
    {
      id: seedId('analytics-attendance:member-frozen:month-3'),
      userId: memberFrozenId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ monthsAgo: 3, dayOfMonth: 5, hour: 6, minute: 55 }),
      durationMinutes: 74,
    },
    {
      id: seedId('analytics-attendance:member-active:month-4'),
      userId: memberActiveId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ monthsAgo: 4, dayOfMonth: 16, hour: 12, minute: 5 }),
      durationMinutes: 58,
    },
    {
      id: seedId('analytics-attendance:member-premium:month-5'),
      userId: memberPremiumId,
      scannedBy: staffUserId,
      checkInAt: analyticsAt({ monthsAgo: 5, dayOfMonth: 23, hour: 19, minute: 0 }),
      durationMinutes: 69,
    },
  ].filter(
    (entry): entry is {
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
      balancePaidAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 10, hour: 17, minute: 45 }),
      completedAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 10, hour: 19, minute: 5 }),
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
      downpaymentPaidAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 13, hour: 15 }),
      balancePaidAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 13, hour: 15 }),
      completedAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 14, hour: 7, minute: 5 }),
      cancelledAt: null,
      createdAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 11, hour: 10 }),
      notes: 'Prior-month yoga booking used for attendance and revenue correlation.',
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

  const validBookingSeeds = bookingSeeds.filter(
    (entry): entry is {
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
    } => Boolean(entry.userId && entry.amenityId),
  );

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
      downpaymentPaidAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 14, hour: 15 }),
      balancePaidAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 18, hour: 16, minute: 40 }),
      completedAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 18, hour: 18, minute: 10 }),
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
      downpaymentPaidAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 19, hour: 13 }),
      balancePaidAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 22, hour: 6, minute: 45 }),
      completedAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 22, hour: 7, minute: 55 }),
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

  const validAppointmentSeeds = appointmentSeeds.filter(
    (entry): entry is {
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
    } => Boolean(entry.userId && entry.coachId),
  );

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
      createdAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 12, hour: 12, minute: 35 }),
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
      createdAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 20, hour: 18, minute: 5 }),
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
      createdAt: analyticsAt({ monthsAgo: 4, dayOfMonth: 15, hour: 11, minute: 20 }),
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
    (entry): entry is {
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
        ...(sale.customerUserId ? { customer_user_id: sale.customerUserId } : {}),
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
        ...(sale.customerUserId ? { customer_user_id: sale.customerUserId } : {}),
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
      createdAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 4, hour: 11, minute: 10 }),
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
      createdAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 10, hour: 17, minute: 50 }),
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
      createdAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 14, hour: 6, minute: 30 }),
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
      payableId: seedId('analytics-appointment:member-premium:boxing-last-month'),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('900'),
      provider: PaymentProvider.paymongo,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({ monthsAgo: 1, dayOfMonth: 18, hour: 16, minute: 35 }),
    },
    {
      id: seedId('analytics-payment:coaching:recovery-prior'),
      userId: memberActiveId,
      payableType: PayableType.coaching,
      payableId: seedId('analytics-appointment:member-active:recovery-two-months'),
      paymentStage: PaymentStage.full,
      amount: new Prisma.Decimal('780'),
      provider: PaymentProvider.cash,
      status: PaymentStatus.completed,
      createdAt: analyticsAt({ monthsAgo: 2, dayOfMonth: 22, hour: 6, minute: 25 }),
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
    (entry): entry is {
      id: string;
      userId: string;
      payableType: PayableType;
      payableId: string;
      paymentStage: PaymentStage;
      amount: Prisma.Decimal;
      provider: PaymentProvider;
      status: PaymentStatus;
      createdAt: Date;
    } => Boolean(entry.userId),
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
        bottom: { elbow: [105, 145] },
        top: { elbow: [158, 178] },
      } as Prisma.InputJsonValue,
      repRules: {
        body_line: 'shoulders_hips_ankles_stacked',
        depth: 'chest_between_hands',
        no_count_conditions: [
          'bilateral_arm_motion_unconfirmed',
          'push_up_body_not_horizontal',
          'left_right_phase_desync',
        ],
      } as Prisma.InputJsonValue,
      orientationSignature: {
        body_orientation: 'prone_horizontal',
        nose_to_hip_vector: { x: 0.02, y: 0.16 },
        torso_slope_range: [0, 78],
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

async function buildCounts() {
  const [
    users,
    identities,
    profiles,
    notifications,
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
    amenities,
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
    prisma.amenity.count(),
  ]);

  return {
    auth: {
      identities,
      notificationPreferences: notifications,
      profiles,
      users,
    },
    coaching: {
      appointments: coachAppointments,
      availabilitySlots: coachAvailabilitySlots,
      coachProfiles,
      reviews: coachReviews,
    },
    facilities: {
      amenities,
      bookings: amenityBookings,
    },
    fitness: {
      exerciseCatalog,
      exerciseLogs,
      muscleMastery,
      poseProfiles,
      poseSessions,
      trainingPlans,
      workoutSessions,
    },
    membership: {
      deletionRequests,
      membershipCards,
      membershipPlans,
      subscriptions,
    },
  };
}

async function main() {
  const mode = resolveSeedMode(process.argv);

  const bootstrapSummary = await bootstrapDefaults(prisma);
  await ensureMembershipPlans();
  await cleanupDeprecatedCoachSeeds();

  const ensuredAccounts: EnsuredAccount[] = [];
  for (const account of TEST_ACCOUNTS) {
    ensuredAccounts.push(await ensureTestAccount(account));
  }

  const coachProfiles = await ensureCoachProfiles(ensuredAccounts);
  await ensureGymOperationsVenueBookings(ensuredAccounts, coachProfiles);
  await ensureMemberStates(ensuredAccounts);
  await ensureMasteryProgress(ensuredAccounts);
  await ensureWorkoutFixtures(ensuredAccounts);
  await ensureAnalyticsFixtures(ensuredAccounts, coachProfiles);

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
    credentials: toManifestCredentials(TEST_ACCOUNTS),
    mode,
    notableIds,
    runAt: new Date().toISOString(),
    suggestedManualTestPaths: [...TEST_MANUAL_PATHS],
  });

  console.log(`[test-data] mode=${mode}`);
  console.log(
    `[test-data] bootstrap defaults ensured for ${bootstrapSummary.adminEmail} and ${bootstrapSummary.demoMemberEmail}`,
  );
  console.log(
    `[test-data] coaching fixtures remaining=${counts.coaching.coachProfiles} profiles, ${counts.coaching.appointments} appointments, masteryRows=${counts.fitness.muscleMastery}`,
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
