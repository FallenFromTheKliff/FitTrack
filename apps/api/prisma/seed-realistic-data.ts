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
import {
  TEST_DATA_EMAIL_DOMAIN,
  seedId,
} from './test-data/constants';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const PASSWORD_HASH_ROUNDS = 12;
const REALISTIC_PASSWORD = 'Realistic!2026';

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

type RealisticAccount = {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: UserRole;
  status?: UserStatus;
  deletedAt?: Date | null;
};

const ACCOUNTS: readonly RealisticAccount[] = [
  {
    key: 'admin',
    email: `real.admin@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Mara',
    lastName: 'Santos',
    phone: '+639170010001',
    role: UserRole.admin,
  },
  {
    key: 'staff',
    email: `real.staff@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Nico',
    lastName: 'Reyes',
    phone: '+639170010002',
    role: UserRole.staff,
  },
  {
    key: 'member-active',
    email: `real.member.active@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Kara',
    lastName: 'Lim',
    phone: '+639170010003',
    role: UserRole.member,
  },
  {
    key: 'member-premium',
    email: `real.member.premium@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Dino',
    lastName: 'Cruz',
    phone: '+639170010004',
    role: UserRole.member,
  },
  {
    key: 'member-pending',
    email: `real.member.pending@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Ella',
    lastName: 'Tan',
    phone: '+639170010005',
    role: UserRole.member,
    status: UserStatus.pending,
  },
  {
    key: 'member-archived',
    email: `real.member.archived@${TEST_DATA_EMAIL_DOMAIN}`,
    firstName: 'Joel',
    lastName: 'Bautista',
    phone: '+639170010006',
    role: UserRole.member,
    deletedAt: nowPlusDays(-15, 18),
  },
];

const accountId = Object.fromEntries(
  ACCOUNTS.map((account) => [account.key, id(`user:${account.key}`)]),
) as Record<(typeof ACCOUNTS)[number]['key'], string>;

async function ensureAccount(account: RealisticAccount) {
  const userId = accountId[account.key];
  const verifiedAt = nowPlusDays(-35, 8);
  const credentialHash = await bcrypt.hash(
    REALISTIC_PASSWORD,
    PASSWORD_HASH_ROUNDS,
  );

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      role: account.role,
      status: account.status ?? UserStatus.active,
      deletedAt: account.deletedAt ?? null,
      email_verified_at: verifiedAt,
      phone_verified_at: verifiedAt,
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
        verified_at: verifiedAt,
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
        verified_at: verifiedAt,
      },
    });
  }

  await prisma.userProfile.upsert({
    where: { user_id: userId },
    update: {
      first_name: account.firstName,
      last_name: account.lastName,
      phone: account.phone,
      date_of_birth:
        account.role === UserRole.member ? dateOnly(-365 * 27) : null,
      gender: account.role === UserRole.member ? Gender.other : null,
      weight_kg: account.role === UserRole.member ? money(68) : null,
      height_cm: account.role === UserRole.member ? money(170) : null,
      activity_level:
        account.role === UserRole.member ? ActivityLevel.active : null,
      fitness_goal:
        account.role === UserRole.member ? FitnessGoal.maintenance : null,
      avatar_url: `https://cdn.fittrack.local/avatars/${account.key}.png`,
    },
    create: {
      id: id(`profile:${account.key}`),
      user_id: userId,
      first_name: account.firstName,
      last_name: account.lastName,
      phone: account.phone,
      date_of_birth:
        account.role === UserRole.member ? dateOnly(-365 * 27) : null,
      gender: account.role === UserRole.member ? Gender.other : null,
      weight_kg: account.role === UserRole.member ? money(68) : null,
      height_cm: account.role === UserRole.member ? money(170) : null,
      activity_level:
        account.role === UserRole.member ? ActivityLevel.active : null,
      fitness_goal:
        account.role === UserRole.member ? FitnessGoal.maintenance : null,
      avatar_url: `https://cdn.fittrack.local/avatars/${account.key}.png`,
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
      attempts: account.status === UserStatus.pending ? 1 : 0,
      consumed_at: account.status === UserStatus.pending ? null : verifiedAt,
    },
    create: {
      id: id(`otp:${account.key}:login`),
      user_id: userId,
      channel: 'email',
      purpose: 'login_2fa',
      code_hash: tokenHash(`otp:${account.key}:123456`),
      expires_at: nowPlusDays(1),
      attempts: account.status === UserStatus.pending ? 1 : 0,
      consumed_at: account.status === UserStatus.pending ? null : verifiedAt,
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
      id: id('membership-plan:starter'),
      name: 'Starter Monthly',
      description: 'General access with attendance tracking.',
      price: money(799),
      duration_days: 30,
      features: json({ access: ['floor', 'locker'], coaching: false }),
      sort_order: 1,
      includes_coaching: false,
    },
    {
      id: id('membership-plan:performance'),
      name: 'Performance Monthly',
      description: 'Gym access, priority booking, and body-composition tracking.',
      price: money(1299),
      duration_days: 30,
      features: json({ access: ['floor', 'locker', 'priority_booking'] }),
      sort_order: 2,
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
    screenshot_url: 'https://cdn.fittrack.local/payments/subscription-active.jpg',
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
      image_url: 'https://cdn.fittrack.local/facilities/floor-1.png',
    },
    {
      floor_id: 'floor-2',
      image_url: 'https://cdn.fittrack.local/facilities/floor-2.png',
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
      image_url: 'https://cdn.fittrack.local/facilities/basketball-court.jpg',
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
      image_url: 'https://cdn.fittrack.local/facilities/boxing-ring.jpg',
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
      image_url: 'https://cdn.fittrack.local/facilities/studio.jpg',
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

  const coaches = [
    {
      id: id('coach:marco'),
      display_name: 'Marco Valdez',
      contact_email: 'coach.marco@fittrack.local',
      contact_phone: '+639170020001',
      specialization: 'Strength / hypertrophy',
      bio: 'Progressive strength coach focused on safe barbell progression.',
      certification: 'NASM-CPT, StrongFirst L1',
      hourly_rate: money(500),
      gym_commission_pct: money(0),
      average_rating: money(4.8),
      rating_count: 18,
      is_available_for_booking: true,
    },
    {
      id: id('coach:lia'),
      display_name: 'Lia Bautista',
      contact_email: 'coach.lia@fittrack.local',
      contact_phone: '+639170020002',
      specialization: 'Mobility / conditioning',
      bio: 'Mobility and conditioning coach for returning lifters.',
      certification: 'ACE-CPT, Mobility Specialist',
      hourly_rate: money(420),
      gym_commission_pct: money(0),
      average_rating: money(4.6),
      rating_count: 11,
      is_available_for_booking: true,
    },
  ];

  for (const coach of coaches) {
    await prisma.coachProfile.upsert({
      where: { id: coach.id },
      update: coach,
      create: coach,
    });
  }

  const availability = [
    ['coach:marco', 1, '08:00:00', '12:00:00'],
    ['coach:marco', 3, '14:00:00', '18:00:00'],
    ['coach:marco', 6, '09:00:00', '13:00:00'],
    ['coach:lia', 2, '10:00:00', '14:00:00'],
    ['coach:lia', 4, '15:00:00', '19:00:00'],
  ] as const;

  for (const [coachKey, day, starts, ends] of availability) {
    await prisma.coachAvailabilitySlot.upsert({
      where: { id: id(`availability:${coachKey}:${day}:${starts}`) },
      update: {
        coach_id: id(coachKey),
        day_of_week: day,
        start_time: fixedTime(starts),
        end_time: fixedTime(ends),
        is_active: true,
      },
      create: {
        id: id(`availability:${coachKey}:${day}:${starts}`),
        coach_id: id(coachKey),
        day_of_week: day,
        start_time: fixedTime(starts),
        end_time: fixedTime(ends),
        is_active: true,
      },
    });
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
    screenshot_url: 'https://cdn.fittrack.local/payments/recurring-cycle.jpg',
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
      video_url: 'https://cdn.fittrack.local/exercises/back-squat.mp4',
      image_url: 'https://cdn.fittrack.local/exercises/back-squat.jpg',
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
      ai_generation_prompt: json({ focus: 'strength base', level: 'intermediate' }),
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
      ai_generation_prompt: json({ focus: 'strength base', level: 'intermediate' }),
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
      landmark_signature: json({ hips: 'descend', knees: 'flex', ankles: 'stable' }),
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
      landmark_signature: json({ hips: 'descend', knees: 'flex', ankles: 'stable' }),
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
      analysis_summary: json({ verdict: 'accepted', notes: ['consistent depth'] }),
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
      analysis_summary: json({ verdict: 'accepted', notes: ['consistent depth'] }),
      started_at: nowPlusDays(-2, 18),
      ended_at: nowPlusDays(-2, 18, 12),
    },
  });

  await prisma.exerciseReviewSubmission.upsert({
    where: { id: id('exercise-review:pushup-variant') },
    update: {
      status: ExerciseReviewSubmissionStatus.pending,
      title: 'Incline Push-Up Review',
      proposed_name: 'Incline Push-Up',
      summary: 'Member submitted an incline push-up variant for review.',
      category: ExerciseCategory.strength,
      muscle_group: 'chest',
      muscle_targets: json(['chest', 'triceps']),
      movement_profile: json({ pattern: 'horizontal_push', incline: true }),
      hand_shape_profile: json({ grip: 'bench_edge' }),
      evidence_bars: json([{ label: 'Similarity', value: 0.72 }]),
    },
    create: {
      id: id('exercise-review:pushup-variant'),
      user_id: accountId['member-active'],
      pose_session_id: null,
      published_exercise_id: id('exercise:pushup'),
      status: ExerciseReviewSubmissionStatus.pending,
      title: 'Incline Push-Up Review',
      proposed_name: 'Incline Push-Up',
      summary: 'Member submitted an incline push-up variant for review.',
      category: ExerciseCategory.strength,
      muscle_group: 'chest',
      muscle_targets: json(['chest', 'triceps']),
      movement_profile: json({ pattern: 'horizontal_push', incline: true }),
      hand_shape_profile: json({ grip: 'bench_edge' }),
      evidence_bars: json([{ label: 'Similarity', value: 0.72 }]),
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
      condition_payload: json({ sourceType: 'workout_session_completed', count: 1 }),
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
      condition_payload: json({ sourceType: 'workout_session_completed', count: 1 }),
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
      source_context: json({ workoutSessionId: id('workout-session:completed') }),
      processed_at: nowPlusDays(-2, 19),
    },
    create: {
      id: id('progression-source:workout-completed'),
      user_id: accountId['member-active'],
      source_type: ProgressionSourceType.workout_session_completed,
      source_id: id('workout-session:completed'),
      source_status: ProgressionSourceStatus.applied,
      source_context: json({ workoutSessionId: id('workout-session:completed') }),
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

  await prisma.creatorProfile.upsert({
    where: { user_id: accountId['member-active'] },
    update: {
      state: CreatorState.candidate,
      last_state_changed_at: nowPlusDays(-4),
      admin_notes: 'Strong exercise submissions, awaiting second review.',
    },
    create: {
      id: id('creator-profile:active'),
      user_id: accountId['member-active'],
      state: CreatorState.candidate,
      last_state_changed_at: nowPlusDays(-4),
      admin_notes: 'Strong exercise submissions, awaiting second review.',
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
      image_url: 'https://cdn.fittrack.local/inventory/whey-sachet.jpg',
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
      image_url: 'https://cdn.fittrack.local/inventory/electrolyte-water.jpg',
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
      image_url: 'https://cdn.fittrack.local/equipment/adjustable-bench.jpg',
      quantity_total: 4,
      quantity_current: 3,
      unit: 'benches',
      is_active: true,
    },
    create: {
      id: id('equipment-item:adjustable-bench'),
      name: 'Adjustable Bench',
      description: 'Commercial adjustable bench for free-weight area.',
      image_url: 'https://cdn.fittrack.local/equipment/adjustable-bench.jpg',
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
    [ChatRole.assistant, 'Yes, if bar speed stays stable and depth remains consistent.'],
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
      response_payload: json({ answer: 'Progress if technique stays consistent.' }),
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
      response_payload: json({ answer: 'Progress if technique stays consistent.' }),
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

  await prisma.gymPromotion.upsert({
    where: { id: id('promotion:summer') },
    update: {
      title: 'Summer Starter Pack',
      description: 'One-time member-card discount with first monthly plan.',
      promo_code: 'SUMMERFIT',
      starts_at: nowPlusDays(-7),
      ends_at: nowPlusDays(21),
      pricing_note: 'Save PHP 100 on first month.',
      is_active: true,
    },
    create: {
      id: id('promotion:summer'),
      title: 'Summer Starter Pack',
      description: 'One-time member-card discount with first monthly plan.',
      promo_code: 'SUMMERFIT',
      starts_at: nowPlusDays(-7),
      ends_at: nowPlusDays(21),
      pricing_note: 'Save PHP 100 on first month.',
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
    exerciseReviewSubmissions: await prisma.exerciseReviewSubmission.count(),
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
    creatorProfiles: await prisma.creatorProfile.count(),
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
    gymPromotions: await prisma.gymPromotion.count(),
    gymFaqEntries: await prisma.gymFaqEntry.count(),
    businessInsightRuns: await prisma.businessInsightRun.count(),
    accountDeletionRequests: await prisma.accountDeletionRequest.count(),
  };
}

async function main() {
  const bootstrapSummary = await bootstrapDefaults(prisma);

  await ensureAccounts();
  await ensureMembershipsAndPayments();
  await ensureFacilitiesAndCoaching();
  await ensureFitnessAndTraining();
  await ensureGamification();
  await ensureNutrition();
  await ensureInventoryAndSales();
  await ensureAiNotificationsAndGymContent();
  await ensureAttendanceAuditAndAnalytics();

  const counts = await buildCounts();
  console.log('[realistic-seed] complete');
  console.log(
    `[realistic-seed] defaults ensured for ${bootstrapSummary.adminEmail}; realistic password for real.* accounts: ${REALISTIC_PASSWORD}`,
  );
  console.log(JSON.stringify(counts, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
