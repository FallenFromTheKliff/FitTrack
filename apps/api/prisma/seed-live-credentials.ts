import {
  AccountDeletionRequestStatus,
  AuthProvider,
  MembershipCardSource,
  MembershipCardStatus,
  Prisma,
  PrismaClient,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import { config } from 'dotenv';

import { localEnvFilePath } from '../env-path';
import {
  TEST_ACCOUNTS,
  type TestAccount,
  seedId,
} from './test-data/constants';

const PASSWORD_HASH_ROUNDS = 12;

const LIVE_ACCOUNT_KEYS = new Set([
  'admin',
  'staff',
  'coach',
  'coach-casey',
  'coach-bravo',
  'coach-ivy',
  'member-active',
  'member-premium',
  'member-frozen',
  'member-pending',
  'member-expired',
]);

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

const LIVE_ACCOUNTS = TEST_ACCOUNTS.filter((account) =>
  LIVE_ACCOUNT_KEYS.has(account.key),
);

const MEMBERSHIP_PLAN_SEEDS: readonly MembershipPlanSeed[] = [
  {
    id: seedId('membership-plan:one-day-pass'),
    name: '1-Day Pass',
    description:
      'One gym visit with attendance check-in; consumed after the first successful entry. Coaching services are purchased separately.',
    durationDays: 1,
    features: { perks: ['gym_access', 'attendance_tracking'] },
    includesCoaching: false,
    price: new Prisma.Decimal('150'),
    sortOrder: 0,
  },
  {
    id: seedId('membership-plan:strength-monthly'),
    name: 'Weekly Membership',
    description:
      'Seven consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
    durationDays: 7,
    features: { perks: ['gym_access', 'attendance_tracking'] },
    includesCoaching: false,
    price: new Prisma.Decimal('499'),
    sortOrder: 1,
  },
  {
    id: seedId('membership-plan:starter-monthly'),
    name: 'Monthly Membership',
    description:
      'Thirty consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
    durationDays: 30,
    features: { perks: ['gym_access', 'attendance_tracking'] },
    includesCoaching: false,
    price: new Prisma.Decimal('1499'),
    sortOrder: 2,
  },
  {
    id: seedId('membership-plan:coaching-plus'),
    name: '3-Month Membership',
    description:
      'Ninety consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
    durationDays: 90,
    features: { perks: ['gym_access', 'attendance_tracking'] },
    includesCoaching: false,
    price: new Prisma.Decimal('3499'),
    sortOrder: 3,
  },
  {
    id: '2f5db3bd-1b9f-4b3f-8ba6-d9ff44af3004',
    name: '1-Year Membership',
    description:
      'Three hundred sixty-five consecutive days of gym access with attendance tracking. Coaching services are purchased separately.',
    durationDays: 365,
    features: { perks: ['gym_access', 'attendance_tracking'] },
    includesCoaching: false,
    price: new Prisma.Decimal('11999'),
    sortOrder: 4,
  },
];

config(localEnvFilePath ? { path: localEnvFilePath } : undefined);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required to seed live credentials.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function liveQrToken(accountKey: string) {
  return createHash('sha256')
    .update(`fittrack-live-seed:${accountKey}`)
    .digest('hex');
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

async function ensureMembershipPlans() {
  for (const plan of MEMBERSHIP_PLAN_SEEDS) {
    await prisma.membershipPlan.upsert({
      where: { id: plan.id },
      update: {
        name: plan.name,
        description: plan.description,
        currency: 'PHP',
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
        currency: 'PHP',
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

async function ensureLiveAccount(
  account: TestAccount,
): Promise<EnsuredAccount> {
  const matchingIdentities = await prisma.authIdentity.findMany({
    where: {
      provider: AuthProvider.email,
      identifier: account.email,
    },
    orderBy: { created_at: 'asc' },
    select: {
      id: true,
      user_id: true,
    },
  });
  const existingIdentity = matchingIdentities[0] ?? null;
  const duplicateIdentityIds = matchingIdentities
    .slice(1)
    .map((identity) => identity.id);
  const userId = existingIdentity?.user_id ?? seedId(`user:${account.key}`);
  const memberQrToken =
    account.role === UserRole.member ? liveQrToken(account.key) : null;
  const now = new Date();
  const credentialHash = await bcrypt.hash(
    account.password,
    PASSWORD_HASH_ROUNDS,
  );

  if (memberQrToken) {
    await prisma.user.updateMany({
      where: {
        id: { not: userId },
        qr_code_token: memberQrToken,
      },
      data: {
        qr_code_token: null,
        qr_code_rotated_at: null,
      },
    });
  }

  await prisma.user.upsert({
    where: { id: userId },
    update: {
      role: account.role,
      status: UserStatus.active,
      deletedAt: null,
      email_verified_at: now,
      phone_verified_at: now,
      qr_code_token: memberQrToken,
      qr_code_rotated_at: memberQrToken ? now : null,
      has_accepted_privacy: true,
      privacy_accepted_at: now,
    },
    create: {
      id: userId,
      role: account.role,
      status: UserStatus.active,
      email_verified_at: now,
      phone_verified_at: now,
      qr_code_token: memberQrToken,
      qr_code_rotated_at: memberQrToken ? now : null,
      has_accepted_privacy: true,
      privacy_accepted_at: now,
    },
  });

  if (duplicateIdentityIds.length) {
    await prisma.authIdentity.deleteMany({
      where: {
        id: { in: duplicateIdentityIds },
        provider: AuthProvider.email,
        identifier: account.email,
      },
    });
  }

  if (existingIdentity) {
    await prisma.authIdentity.update({
      where: { id: existingIdentity.id },
      data: {
        credential_hash: credentialHash,
        verified_at: now,
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
        verified_at: now,
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

async function createSubscription(args: {
  expiresAt: Date | null;
  planName: MembershipPlanSeed['name'];
  startsAt: Date | null;
  status: SubscriptionStatus;
  userId: string;
  id: string;
}) {
  const plan = planByName(args.planName);
  await prisma.subscription.create({
    data: {
      id: args.id,
      user_id: args.userId,
      plan_id: planByName(args.planName).id,
      plan_name_snapshot: plan.name,
      plan_description_snapshot: plan.description,
      plan_price_snapshot: plan.price,
      plan_currency_snapshot: 'PHP',
      duration_days_snapshot: plan.durationDays,
      status: args.status,
      starts_at: args.startsAt,
      expires_at: args.expiresAt,
      cancelled_at:
        args.status === SubscriptionStatus.expired ? args.expiresAt : null,
      cancellation_reason:
        args.status === SubscriptionStatus.expired
          ? 'Seeded expired state for production smoke testing.'
          : null,
    },
  });
}

async function ensureMembershipCard(args: {
  accountKey: string;
  adminUserId: string | null;
  activatedAt: Date | null;
  purchasedAt: Date;
  revokedAt?: Date | null;
  revokeReason?: string | null;
  source: MembershipCardSource;
  status: MembershipCardStatus;
  userId: string;
  verifiedAt: Date | null;
}) {
  await prisma.membershipCard.upsert({
    where: { user_id: args.userId },
    update: {
      status: args.status,
      source: args.source,
      price: new Prisma.Decimal('400'),
      purchased_at: args.purchasedAt,
      verified_at: args.verifiedAt,
      verified_by: args.verifiedAt ? args.adminUserId : null,
      activated_at: args.activatedAt,
      revoked_at: args.revokedAt ?? null,
      revoked_by: args.revokedAt ? args.adminUserId : null,
      revoke_reason: args.revokeReason ?? null,
    },
    create: {
      id: seedId(`membership-card:${args.accountKey}`),
      user_id: args.userId,
      status: args.status,
      source: args.source,
      price: new Prisma.Decimal('400'),
      purchased_at: args.purchasedAt,
      verified_at: args.verifiedAt,
      verified_by: args.verifiedAt ? args.adminUserId : null,
      activated_at: args.activatedAt,
      revoked_at: args.revokedAt ?? null,
      revoked_by: args.revokedAt ? args.adminUserId : null,
      revoke_reason: args.revokeReason ?? null,
    },
  });
}

async function ensureMemberStates(ensuredAccounts: readonly EnsuredAccount[]) {
  const adminUserId =
    ensuredAccounts.find(({ account }) => account.key === 'admin')?.userId ??
    null;
  const memberAccounts = ensuredAccounts.filter(
    ({ account }) => account.role === UserRole.member,
  );
  const memberUserIds = memberAccounts.map(({ userId }) => userId);
  const subscriptionSeedIds = [
    'subscription:member-active',
    'subscription:member-premium',
    'subscription:member-frozen',
    'subscription:member-expired',
  ].map(seedId);
  const cardSeedIds = [
    'membership-card:member-active',
    'membership-card:member-premium',
    'membership-card:member-frozen',
    'membership-card:member-pending',
    'membership-card:member-expired',
  ].map(seedId);

  await prisma.subscription.deleteMany({
    where: {
      OR: [
        { user_id: { in: memberUserIds } },
        { id: { in: subscriptionSeedIds } },
      ],
    },
  });
  await prisma.membershipCard.deleteMany({
    where: {
      id: { in: cardSeedIds },
      user_id: { notIn: memberUserIds },
    },
  });
  await prisma.accountDeletionRequest.deleteMany({
    where: {
      OR: [
        { userId: { in: memberUserIds } },
        { id: seedId('deletion-request:member-frozen') },
      ],
    },
  });

  for (const { account, userId } of memberAccounts) {
    const now = new Date();
    const past60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const past30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const past5Days = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const future30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (account.key === 'member-active') {
      await ensureMembershipCard({
        accountKey: account.key,
        adminUserId,
        activatedAt: now,
        purchasedAt: now,
        source: MembershipCardSource.admin_grant,
        status: MembershipCardStatus.active,
        userId,
        verifiedAt: now,
      });
      await createSubscription({
        id: seedId('subscription:member-active'),
        userId,
        planName: 'Monthly Membership',
        status: SubscriptionStatus.active,
        startsAt: now,
        expiresAt: future30Days,
      });
      continue;
    }

    if (account.key === 'member-premium') {
      await ensureMembershipCard({
        accountKey: account.key,
        adminUserId,
        activatedAt: now,
        purchasedAt: now,
        source: MembershipCardSource.admin_grant,
        status: MembershipCardStatus.active,
        userId,
        verifiedAt: now,
      });
      await createSubscription({
        id: seedId('subscription:member-premium'),
        userId,
        planName: '3-Month Membership',
        status: SubscriptionStatus.active,
        startsAt: now,
        expiresAt: future30Days,
      });
      continue;
    }

    if (account.key === 'member-frozen') {
      await ensureMembershipCard({
        accountKey: account.key,
        adminUserId,
        activatedAt: now,
        purchasedAt: now,
        source: MembershipCardSource.admin_grant,
        status: MembershipCardStatus.active,
        userId,
        verifiedAt: now,
      });
      await createSubscription({
        id: seedId('subscription:member-frozen'),
        userId,
        planName: 'Weekly Membership',
        status: SubscriptionStatus.active,
        startsAt: now,
        expiresAt: future30Days,
      });
      await prisma.accountDeletionRequest.create({
        data: {
          id: seedId('deletion-request:member-frozen'),
          userId,
          reason:
            'Member requested a freeze review while deciding on next billing cycle.',
          status: AccountDeletionRequestStatus.pending,
        },
      });
      continue;
    }

    if (account.key === 'member-pending') {
      await ensureMembershipCard({
        accountKey: account.key,
        adminUserId,
        activatedAt: null,
        purchasedAt: now,
        source: MembershipCardSource.cash,
        status: MembershipCardStatus.pending_verification,
        userId,
        verifiedAt: null,
      });
      continue;
    }

    if (account.key === 'member-expired') {
      await ensureMembershipCard({
        accountKey: account.key,
        adminUserId,
        activatedAt: past60Days,
        purchasedAt: past60Days,
        revokedAt: past5Days,
        revokeReason:
          'Membership card expired after the prior billing cycle ended.',
        source: MembershipCardSource.admin_repair,
        status: MembershipCardStatus.revoked,
        userId,
        verifiedAt: past60Days,
      });
      await createSubscription({
        id: seedId('subscription:member-expired'),
        userId,
        planName: 'Monthly Membership',
        status: SubscriptionStatus.expired,
        startsAt: past60Days,
        expiresAt: past30Days,
      });
    }
  }
}

async function ensureCoachProfiles(ensuredAccounts: readonly EnsuredAccount[]) {
  const coachAccounts = ensuredAccounts.filter(
    ({ account }) => account.role === UserRole.coach,
  );

  for (const { account, userId } of coachAccounts) {
    const now = new Date();
    await prisma.coachProfile.upsert({
      where: { user_id: userId },
      update: {
        display_name: `${account.firstName} ${account.lastName}`,
        contact_email: account.email,
        contact_phone: account.phone,
        specialization:
          account.key === 'coach-casey'
            ? 'Strength floor operations and programming'
            : 'Conditioning, mobility, and guided training',
        bio: 'Seeded coach profile for production smoke testing.',
        certification: account.key === 'coach-casey' ? 'NASM-CPT' : 'ACE-CPT',
        hourly_rate: new Prisma.Decimal(
          account.key === 'coach-casey' ? '700' : '900',
        ),
        gym_commission_pct: new Prisma.Decimal('20'),
        average_rating: new Prisma.Decimal('4.80'),
        rating_count: 8,
        is_available_for_booking: true,
        updated_at: now,
      },
      create: {
        id: seedId(`coach-profile:${account.key}`),
        user_id: userId,
        display_name: `${account.firstName} ${account.lastName}`,
        contact_email: account.email,
        contact_phone: account.phone,
        specialization:
          account.key === 'coach-casey'
            ? 'Strength floor operations and programming'
            : 'Conditioning, mobility, and guided training',
        bio: 'Seeded coach profile for production smoke testing.',
        certification: account.key === 'coach-casey' ? 'NASM-CPT' : 'ACE-CPT',
        hourly_rate: new Prisma.Decimal(
          account.key === 'coach-casey' ? '700' : '900',
        ),
        gym_commission_pct: new Prisma.Decimal('20'),
        average_rating: new Prisma.Decimal('4.80'),
        rating_count: 8,
        is_available_for_booking: true,
        created_at: now,
        updated_at: now,
      },
    });
  }
}

async function main() {
  await ensureMembershipPlans();

  const ensuredAccounts: EnsuredAccount[] = [];
  for (const account of LIVE_ACCOUNTS) {
    ensuredAccounts.push(await ensureLiveAccount(account));
  }

  await ensureMemberStates(ensuredAccounts);
  await ensureCoachProfiles(ensuredAccounts);

  console.log(
    `Seeded ${ensuredAccounts.length} live credential account(s): ${ensuredAccounts
      .map(({ account }) => account.email)
      .join(', ')}`,
  );
}

void main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
