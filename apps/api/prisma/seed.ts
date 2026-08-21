import {
  ActivityLevel,
  AuthProvider,
  CoachScheduleType,
  FitnessGoal,
  Gender,
  MembershipCardSource,
  MembershipCardStatus,
  PaymentProvider,
  PaymentStage,
  PaymentStatus,
  PayableType,
  PrismaClient,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';

import { localEnvFilePath } from '../env-path';

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type SeedAccount = {
  activityLevel?: ActivityLevel;
  deletedAt?: Date | null;
  email: string;
  emailVerified: boolean;
  firstName: string;
  fitnessGoal?: FitnessGoal;
  gender?: Gender;
  lastName: string;
  membershipCard?: {
    revokeReason?: string;
    status: MembershipCardStatus;
  };
  password: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
};

const now = new Date();
const archivedAt = new Date(now);
archivedAt.setDate(archivedAt.getDate() - 10);

const MEMBERSHIP_PLAN_IDS = {
  performanceMonthly: '2f5db3bd-1b9f-4b3f-8ba6-d9ff44af3001',
  starterMonthly: '2f5db3bd-1b9f-4b3f-8ba6-d9ff44af3000',
} as const;

const MEMBERSHIP_PAYMENT_IDS = {
  caseyActiveSubscription: '5918190f-e2bf-4914-bf4e-28c6eb0c5000',
  rileyPendingCard: '5918190f-e2bf-4914-bf4e-28c6eb0c5001',
} as const;

const MEMBERSHIP_PROMOTION_ID = '6e1a0dc6-9368-43ce-a6c7-d9711bbf6000';
const CASEY_SUBSCRIPTION_ID = '7e40ac5e-7307-414c-af31-a70c2d4b7000';
const MEMBERSHIP_CATALOG_SETTINGS_ID =
  '94f956b6-98ad-447b-b22a-aa111d7c4000';

const accounts: SeedAccount[] = [
  {
    activityLevel: ActivityLevel.active,
    email: 'admin@fittrack.com',
    emailVerified: true,
    firstName: 'Alex',
    fitnessGoal: FitnessGoal.maintenance,
    gender: Gender.male,
    lastName: 'Rivera',
    password: 'FitTrack@Admin1',
    phone: '+639171110001',
    role: UserRole.admin,
    status: UserStatus.active,
  },
  {
    activityLevel: ActivityLevel.light,
    email: 'staff@fittrack.com',
    emailVerified: true,
    firstName: 'Jamie',
    fitnessGoal: FitnessGoal.maintenance,
    gender: Gender.other,
    lastName: 'Santos',
    password: 'FitTrack@Staff1',
    phone: '+639171110002',
    role: UserRole.staff,
    status: UserStatus.active,
  },
  {
    activityLevel: ActivityLevel.very_active,
    email: 'coach@fittrack.com',
    emailVerified: true,
    firstName: 'Morgan',
    fitnessGoal: FitnessGoal.sport_specific,
    gender: Gender.female,
    lastName: 'Cruz',
    password: 'FitTrack@Coach1',
    phone: '+639171110003',
    role: UserRole.coach,
    status: UserStatus.active,
  },
  {
    activityLevel: ActivityLevel.active,
    email: 'member.active@fittrack.com',
    emailVerified: true,
    firstName: 'Casey',
    fitnessGoal: FitnessGoal.maintenance,
    gender: Gender.other,
    lastName: 'Reyes',
    membershipCard: { status: MembershipCardStatus.active },
    password: 'FitTrack@Member1',
    phone: '+639171110004',
    role: UserRole.member,
    status: UserStatus.active,
  },
  {
    activityLevel: ActivityLevel.light,
    email: 'nonmember.verified@fittrack.com',
    emailVerified: true,
    firstName: 'Dana',
    fitnessGoal: FitnessGoal.cutting,
    gender: Gender.female,
    lastName: 'Lim',
    password: 'FitTrack@Member2',
    phone: '+639171110005',
    role: UserRole.member,
    status: UserStatus.active,
  },
  {
    activityLevel: ActivityLevel.sedentary,
    email: 'member.pending@fittrack.com',
    emailVerified: false,
    firstName: 'Riley',
    fitnessGoal: FitnessGoal.maintenance,
    gender: Gender.male,
    lastName: 'Tan',
    membershipCard: { status: MembershipCardStatus.pending_verification },
    password: 'FitTrack@Member3',
    phone: '+639171110006',
    role: UserRole.member,
    status: UserStatus.pending,
  },
  {
    activityLevel: ActivityLevel.light,
    deletedAt: archivedAt,
    email: 'member.archived@fittrack.com',
    emailVerified: true,
    firstName: 'Jordan',
    fitnessGoal: FitnessGoal.bulking,
    gender: Gender.other,
    lastName: 'Dela Cruz',
    membershipCard: {
      revokeReason: 'Archived local seed account.',
      status: MembershipCardStatus.revoked,
    },
    password: 'FitTrack@Member4',
    phone: '+639171110007',
    role: UserRole.member,
    status: UserStatus.active,
  },
];

async function findUserIdByEmail(email: string) {
  const identity = await prisma.authIdentity.findFirst({
    where: { provider: AuthProvider.email, identifier: email },
    select: { user_id: true },
  });
  return identity?.user_id ?? null;
}

async function seedAccount(account: SeedAccount) {
  const credentialHash = await bcrypt.hash(account.password, 12);
  const verifiedAt = account.emailVerified ? now : null;
  const existingUserId = await findUserIdByEmail(account.email);

  const user = existingUserId
    ? await prisma.user.update({
        where: { id: existingUserId },
        data: {
          deletedAt: account.deletedAt ?? null,
          email_verified_at: verifiedAt,
          has_accepted_privacy: true,
          phone_verified_at: null,
          privacy_accepted_at: now,
          role: account.role,
          status: account.status,
        },
      })
    : await prisma.user.create({
        data: {
          deletedAt: account.deletedAt ?? null,
          email_verified_at: verifiedAt,
          has_accepted_privacy: true,
          phone_verified_at: null,
          privacy_accepted_at: now,
          role: account.role,
          status: account.status,
        },
      });

  await prisma.authIdentity.upsert({
    create: {
      credential_hash: credentialHash,
      identifier: account.email,
      is_primary: true,
      provider: AuthProvider.email,
      user_id: user.id,
      verified_at: verifiedAt,
    },
    update: {
      credential_hash: credentialHash,
      is_primary: true,
      verified_at: verifiedAt,
    },
    where: {
      user_id_provider_identifier: {
        identifier: account.email,
        provider: AuthProvider.email,
        user_id: user.id,
      },
    },
  });

  await prisma.userProfile.upsert({
    create: {
      activity_level: account.activityLevel ?? null,
      date_of_birth: new Date('1995-06-15T00:00:00.000Z'),
      first_name: account.firstName,
      fitness_goal: account.fitnessGoal ?? null,
      gender: account.gender ?? null,
      height_cm: 168,
      last_name: account.lastName,
      phone: account.phone,
      user_id: user.id,
      weight_kg: 68,
    },
    update: {
      activity_level: account.activityLevel ?? null,
      first_name: account.firstName,
      fitness_goal: account.fitnessGoal ?? null,
      gender: account.gender ?? null,
      last_name: account.lastName,
      phone: account.phone,
    },
    where: { user_id: user.id },
  });

  await prisma.notificationPreference.upsert({
    create: { user_id: user.id },
    update: {},
    where: { user_id: user.id },
  });

  if (account.membershipCard) {
    const revokedAt =
      account.membershipCard.status === MembershipCardStatus.revoked
        ? (account.deletedAt ?? now)
        : null;
    await prisma.membershipCard.upsert({
      create: {
        activated_at:
          account.membershipCard.status === MembershipCardStatus.active
            ? now
            : null,
        price: 400,
        purchased_at: now,
        revoke_reason: account.membershipCard.revokeReason ?? null,
        revoked_at: revokedAt,
        source: MembershipCardSource.admin_grant,
        status: account.membershipCard.status,
        user_id: user.id,
        verified_at:
          account.membershipCard.status === MembershipCardStatus.active
            ? now
            : null,
      },
      update: {
        activated_at:
          account.membershipCard.status === MembershipCardStatus.active
            ? now
            : null,
        revoke_reason: account.membershipCard.revokeReason ?? null,
        revoked_at: revokedAt,
        status: account.membershipCard.status,
        verified_at:
          account.membershipCard.status === MembershipCardStatus.active
            ? now
            : null,
      },
      where: { user_id: user.id },
    });
  } else {
    await prisma.membershipCard.deleteMany({ where: { user_id: user.id } });
  }

  if (account.role === UserRole.coach) {
    await prisma.coachProfile.upsert({
      create: {
        bio: 'Strength and conditioning coach focused on safe progression and sustainable strength habits.',
        certification: 'Certified Strength and Conditioning Specialist',
        contact_email: account.email,
        contact_phone: account.phone,
        display_name: `${account.firstName} ${account.lastName}`,
        gym_commission_pct: 20,
        hourly_rate: 1200,
        is_available_for_booking: true,
        schedule_type: CoachScheduleType.full_time,
        specialization: 'Strength and Conditioning',
        user_id: user.id,
      },
      update: {
        contact_email: account.email,
        contact_phone: account.phone,
        display_name: `${account.firstName} ${account.lastName}`,
        hourly_rate: 1200,
        is_available_for_booking: true,
        schedule_type: CoachScheduleType.full_time,
        specialization: 'Strength and Conditioning',
      },
      where: { user_id: user.id },
    });
  }

  return user;
}

async function seedMembershipCatalog(userIds: {
  caseyId: string;
  rileyId: string;
  staffId: string;
}) {
  await prisma.membershipCatalogSettings.upsert({
    where: { id: MEMBERSHIP_CATALOG_SETTINGS_ID },
    update: {
      membership_card_price: 400,
    },
    create: {
      id: MEMBERSHIP_CATALOG_SETTINGS_ID,
      membership_card_price: 400,
    },
  });

  const starterPlan = {
    id: MEMBERSHIP_PLAN_IDS.starterMonthly,
    name: 'Starter Monthly',
    description: 'General gym access with member app visibility and attendance tracking.',
    duration_days: 30,
    features: {
      access: ['gym-floor', 'attendance-qr', 'member-app'],
      coaching: false,
    },
    includes_coaching: false,
    is_active: true,
    price: 799,
    sort_order: 1,
  } as const;

  const performancePlan = {
    id: MEMBERSHIP_PLAN_IDS.performanceMonthly,
    name: 'Performance Monthly',
    description:
      'Gym access, priority booking support, and progress tracking for regular members.',
    duration_days: 30,
    features: {
      access: ['gym-floor', 'attendance-qr', 'member-app', 'priority-booking'],
      coaching: false,
    },
    includes_coaching: false,
    is_active: true,
    price: 1299,
    sort_order: 2,
  } as const;

  for (const plan of [starterPlan, performancePlan]) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: plan,
      create: plan,
    });
  }

  await prisma.gymPromotion.upsert({
    where: { id: MEMBERSHIP_PROMOTION_ID },
    update: {
      description:
        'Starter Monthly signups this month include a waived onboarding orientation fee.',
      ends_at: new Date('2026-06-15T15:59:59.000Z'),
      is_active: true,
      pricing_note: 'Orientation fee waived for new signups.',
      promo_code: 'STARTSMART',
      starts_at: new Date('2026-05-01T00:00:00.000Z'),
      title: 'Starter Smart May Promo',
    },
    create: {
      id: MEMBERSHIP_PROMOTION_ID,
      description:
        'Starter Monthly signups this month include a waived onboarding orientation fee.',
      ends_at: new Date('2026-06-15T15:59:59.000Z'),
      is_active: true,
      pricing_note: 'Orientation fee waived for new signups.',
      promo_code: 'STARTSMART',
      starts_at: new Date('2026-05-01T00:00:00.000Z'),
      title: 'Starter Smart May Promo',
    },
  });

  await prisma.payment.upsert({
    where: { id: MEMBERSHIP_PAYMENT_IDS.caseyActiveSubscription },
    update: {
        amount: 1299,
        payable_id: CASEY_SUBSCRIPTION_ID,
        payable_type: PayableType.subscription,
        payment_stage: PaymentStage.full,
        provider: PaymentProvider.cash,
      provider_ref: 'local-membership-casey-active',
      status: PaymentStatus.completed,
      user_id: userIds.caseyId,
      verified_at: new Date('2026-05-12T09:15:00.000Z'),
      verified_by: userIds.staffId,
    },
    create: {
      amount: 1299,
      id: MEMBERSHIP_PAYMENT_IDS.caseyActiveSubscription,
      idempotency_key: 'local-membership-casey-active-seed',
      payable_id: CASEY_SUBSCRIPTION_ID,
      payable_type: PayableType.subscription,
      payment_stage: PaymentStage.full,
      provider: PaymentProvider.cash,
      provider_ref: 'local-membership-casey-active',
      status: PaymentStatus.completed,
      user_id: userIds.caseyId,
      verified_at: new Date('2026-05-12T09:15:00.000Z'),
      verified_by: userIds.staffId,
    },
  });

  const existingCaseySubscription = await prisma.subscription.findFirst({
    where: { user_id: userIds.caseyId },
    orderBy: { created_at: 'desc' },
    select: { id: true },
  });

  if (existingCaseySubscription && existingCaseySubscription.id !== CASEY_SUBSCRIPTION_ID) {
    await prisma.subscription.update({
      where: { id: existingCaseySubscription.id },
      data: {
        payment_id: MEMBERSHIP_PAYMENT_IDS.caseyActiveSubscription,
        plan_id: MEMBERSHIP_PLAN_IDS.performanceMonthly,
        starts_at: new Date('2026-05-12T09:15:00.000Z'),
        expires_at: new Date('2026-06-11T23:59:59.000Z'),
        status: SubscriptionStatus.active,
      },
    });
  } else {
    await prisma.subscription.upsert({
      where: { id: CASEY_SUBSCRIPTION_ID },
      update: {
        payment_id: MEMBERSHIP_PAYMENT_IDS.caseyActiveSubscription,
        plan_id: MEMBERSHIP_PLAN_IDS.performanceMonthly,
        starts_at: new Date('2026-05-12T09:15:00.000Z'),
        expires_at: new Date('2026-06-11T23:59:59.000Z'),
        status: SubscriptionStatus.active,
        user_id: userIds.caseyId,
      },
      create: {
        id: CASEY_SUBSCRIPTION_ID,
        payment_id: MEMBERSHIP_PAYMENT_IDS.caseyActiveSubscription,
        plan_id: MEMBERSHIP_PLAN_IDS.performanceMonthly,
        starts_at: new Date('2026-05-12T09:15:00.000Z'),
        expires_at: new Date('2026-06-11T23:59:59.000Z'),
        status: SubscriptionStatus.active,
        user_id: userIds.caseyId,
      },
    });
  }

  const rileyMembershipCard = await prisma.membershipCard.findUniqueOrThrow({
    where: { user_id: userIds.rileyId },
    select: { id: true },
  });

  await prisma.payment.upsert({
    where: { id: MEMBERSHIP_PAYMENT_IDS.rileyPendingCard },
    update: {
      amount: 400,
      payable_id: rileyMembershipCard.id,
      payable_type: PayableType.membership_card,
      payment_stage: PaymentStage.full,
      provider: PaymentProvider.cash,
      provider_ref: 'local-membership-riley-pending-card',
      rejection_reason: null,
      screenshot_url: 'https://example.local/riley-membership-card-proof.jpg',
      status: PaymentStatus.awaiting_verification,
      user_id: userIds.rileyId,
      verified_at: null,
      verified_by: null,
    },
    create: {
      amount: 400,
      id: MEMBERSHIP_PAYMENT_IDS.rileyPendingCard,
      idempotency_key: 'local-membership-riley-pending-card-seed',
      payable_id: rileyMembershipCard.id,
      payable_type: PayableType.membership_card,
      payment_stage: PaymentStage.full,
      provider: PaymentProvider.cash,
      provider_ref: 'local-membership-riley-pending-card',
      screenshot_url: 'https://example.local/riley-membership-card-proof.jpg',
      status: PaymentStatus.awaiting_verification,
      user_id: userIds.rileyId,
    },
  });
}

async function main() {
  const userIds = new Map<string, string>();

  for (const account of accounts) {
    const user = await seedAccount(account);
    userIds.set(account.email, user.id);
  }

  await seedMembershipCatalog({
    caseyId: userIds.get('member.active@fittrack.com')!,
    rileyId: userIds.get('member.pending@fittrack.com')!,
    staffId: userIds.get('staff@fittrack.com')!,
  });

  const totalUsers = await prisma.user.count();
  console.log(`Seeded ${totalUsers} FitTrack local accounts.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
