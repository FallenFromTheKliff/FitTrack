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
  PlanSource,
  PoseProfileKind,
  Prisma,
  PrismaClient,
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
