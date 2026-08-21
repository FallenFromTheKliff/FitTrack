import {
  AccountDeletionRequestStatus,
  ActivityLevel,
  AuthProvider,
  FitnessGoal,
  Gender,
  OtpChannel,
  OtpPurpose,
  Prisma,
  UserRole,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash } from 'node:crypto';
import {
  buildSeedAccounts,
  populateAccountState,
  userIdFor,
} from '../accounts';
import { seedId } from '../ids';
import { daysFrom, yearsAgo } from '../time';
import {
  physicalSnapshotAtWeight,
  progressionDateAt,
  progressionMetricCount,
  progressionWeightAt,
  shouldSeedMemberQr,
  shouldSeedRefreshToken,
} from '../lifecycles-profiles';
import type { DynamicSeedContext, SeedAccount } from '../types';
import { activityDateFor, memberVolumeCount } from '../volumes';

const PASSWORD_HASH_ROUNDS = 12;
const credentialHashCache = new Map<string, Promise<string>>();

function hashValue(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function credentialHashFor(password: string) {
  const cached = credentialHashCache.get(password);
  if (cached) {
    return cached;
  }

  const hashPromise = bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  credentialHashCache.set(password, hashPromise);
  return hashPromise;
}

function defaultGender(account: SeedAccount) {
  return account.gender ?? Gender.other;
}

function defaultActivityLevel(account: SeedAccount) {
  if (account.activityLevel !== undefined) {
    return account.activityLevel;
  }
  if (account.role === UserRole.coach) {
    return ActivityLevel.very_active;
  }
  if (account.role === UserRole.member) {
    return ActivityLevel.active;
  }
  return ActivityLevel.moderate;
}

function defaultFitnessGoal(account: SeedAccount) {
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

function defaultDateOfBirth(ctx: DynamicSeedContext, account: SeedAccount) {
  if (account.dateOfBirth !== undefined) {
    return account.dateOfBirth;
  }
  if (account.role === UserRole.admin) {
    return yearsAgo(ctx.config.anchorDate, 36);
  }
  if (account.role === UserRole.staff) {
    return yearsAgo(ctx.config.anchorDate, 28);
  }
  if (account.role === UserRole.coach) {
    return yearsAgo(ctx.config.anchorDate, 31);
  }
  return yearsAgo(ctx.config.anchorDate, 24 + ctx.rng.int(0, 18));
}

function privacyAcceptedAt(ctx: DynamicSeedContext, account: SeedAccount) {
  if (
    account.emailVerified === false ||
    account.status === UserStatus.pending
  ) {
    return null;
  }
  const registeredAt = account.lifecycle?.registeredAt;
  const verifiedAt = account.lifecycle?.verifiedAt;
  if (!registeredAt || !verifiedAt) {
    return null;
  }
  const candidate = new Date(
    registeredAt.getTime() +
      Math.min(
        3 * 24 * 60 * 60 * 1_000,
        Math.max(
          60 * 60 * 1_000,
          verifiedAt.getTime() - registeredAt.getTime(),
        ),
      ),
  );
  return candidate <= ctx.config.anchorDate ? candidate : null;
}

async function seedAccount(ctx: DynamicSeedContext, account: SeedAccount) {
  const lifecycle = account.lifecycle;
  if (!lifecycle) {
    throw new Error(`Missing lifecycle context for ${account.key}`);
  }
  const verifiedAt = lifecycle.verifiedAt;
  const acceptedAt = privacyAcceptedAt(ctx, account);
  const userId = userIdFor(account.key);
  const credentialHash = await credentialHashFor(account.password);
  const status =
    account.status ??
    (account.emailVerified === false ? UserStatus.pending : UserStatus.active);
  const deletedAt = lifecycle.deletedAt;
  const qrEligible = shouldSeedMemberQr(account, status, verifiedAt, deletedAt);
  const qrCodeExpiresAt = qrEligible
    ? daysFrom(ctx.config.anchorDate, 365, 23, 59)
    : null;
  const qrCodeRotatedAt = qrEligible
    ? new Date(
        Math.max(
          lifecycle.registeredAt.getTime(),
          daysFrom(
            ctx.config.anchorDate,
            -7 - (Number.parseInt(hashValue(userId).slice(0, 2), 16) % 20),
            8,
          ).getTime(),
        ),
      )
    : null;
  const qrCodeToken = qrEligible
    ? `dynqr_${hashValue(userId).slice(0, 32)}`
    : null;

  await ctx.prisma.user.upsert({
    where: { id: userId },
    update: {
      created_at: lifecycle.registeredAt,
      deletedAt,
      email_verified_at: verifiedAt,
      has_accepted_privacy: Boolean(acceptedAt),
      phone_verified_at: verifiedAt,
      privacy_accepted_at: acceptedAt,
      qr_code_expires_at: qrCodeExpiresAt,
      qr_code_rotated_at: qrCodeRotatedAt,
      qr_code_token: qrCodeToken,
      role: account.role,
      status,
    },
    create: {
      id: userId,
      created_at: lifecycle.registeredAt,
      deletedAt,
      email_verified_at: verifiedAt,
      has_accepted_privacy: Boolean(acceptedAt),
      phone_verified_at: verifiedAt,
      privacy_accepted_at: acceptedAt,
      qr_code_expires_at: qrCodeExpiresAt,
      qr_code_rotated_at: qrCodeRotatedAt,
      qr_code_token: qrCodeToken,
      role: account.role,
      status,
    },
  });

  await ctx.prisma.authIdentity.upsert({
    where: {
      user_id_provider_identifier: {
        identifier: account.email,
        provider: AuthProvider.email,
        user_id: userId,
      },
    },
    update: {
      created_at: lifecycle.registeredAt,
      credential_hash: credentialHash,
      is_primary: true,
      verified_at: verifiedAt,
    },
    create: {
      credential_hash: credentialHash,
      created_at: lifecycle.registeredAt,
      identifier: account.email,
      is_primary: true,
      provider: AuthProvider.email,
      user_id: userId,
      verified_at: verifiedAt,
    },
  });

  await ctx.prisma.authIdentity.upsert({
    where: {
      user_id_provider_identifier: {
        identifier: account.phone,
        provider: AuthProvider.phone,
        user_id: userId,
      },
    },
    update: {
      created_at: lifecycle.registeredAt,
      is_primary: false,
      verified_at: verifiedAt,
    },
    create: {
      created_at: lifecycle.registeredAt,
      identifier: account.phone,
      is_primary: false,
      provider: AuthProvider.phone,
      user_id: userId,
      verified_at: verifiedAt,
    },
  });

  const heightCm =
    account.heightCm ?? account.physicalBaseline?.heightCm ?? 170;
  const weightKg = account.weightKg ?? account.physicalBaseline?.weightKg ?? 70;
  const profileCreatedAt = new Date(
    lifecycle.registeredAt.getTime() + 60 * 60 * 1_000,
  );

  await ctx.prisma.userProfile.upsert({
    where: { user_id: userId },
    update: {
      activity_level: defaultActivityLevel(account),
      avatar_url: null,
      created_at: profileCreatedAt,
      date_of_birth: defaultDateOfBirth(ctx, account),
      first_name: account.firstName,
      fitness_goal: defaultFitnessGoal(account),
      gender: defaultGender(account),
      height_cm: new Prisma.Decimal(heightCm),
      last_name: account.lastName,
      phone: account.phone,
      weight_kg: new Prisma.Decimal(weightKg),
    },
    create: {
      id: seedId(`profile:${account.key}`),
      activity_level: defaultActivityLevel(account),
      avatar_url: null,
      created_at: profileCreatedAt,
      date_of_birth: defaultDateOfBirth(ctx, account),
      first_name: account.firstName,
      fitness_goal: defaultFitnessGoal(account),
      gender: defaultGender(account),
      height_cm: new Prisma.Decimal(heightCm),
      last_name: account.lastName,
      phone: account.phone,
      user_id: userId,
      weight_kg: new Prisma.Decimal(weightKg),
    },
  });

  await ctx.prisma.notificationPreference.upsert({
    where: { user_id: userId },
    update: { created_at: profileCreatedAt },
    create: {
      id: seedId(`notification-preference:${account.key}`),
      appointment_confirmed_sms: account.role === UserRole.coach,
      booking_confirmed_sms: account.memberPersona === 'premium',
      coach_appointment_reminder_sms: account.memberPersona === 'premium',
      payment_confirmed_email: true,
      rank_up_email: account.role === UserRole.member,
      subscription_expiring_sms: account.memberPersona === 'premium',
      created_at: profileCreatedAt,
      user_id: userId,
    },
  });
}

async function seedSecondaryUserData(ctx: DynamicSeedContext) {
  const staffId = ctx.state.userIds[ctx.state.staffKeys[0]];
  const activityMemberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ].filter((memberKey) => {
    const account = ctx.state.accounts.find(
      (candidate) => candidate.key === memberKey,
    );
    return account?.lifecycle?.activityStart && account.lifecycle.activityEnd;
  });
  const feedbackAccounts = ctx.state.accounts.filter((account) => {
    const lifecycle = account.lifecycle;
    if (
      !lifecycle ||
      account.emailVerified === false ||
      account.memberPersona === 'unverified' ||
      account.memberPersona === 'pending' ||
      account.memberPersona === 'suspended' ||
      (account.role === UserRole.member && lifecycle.activityStart === null)
    ) {
      return false;
    }
    return true;
  });
  const feedbackRows = ctx.state.accounts
    .filter((account) => feedbackAccounts.includes(account))
    .slice(0, 48)
    .map((account, index) => {
      const lifecycle = account.lifecycle!;
      const start = lifecycle.activityStart ?? lifecycle.registeredAt;
      const end = lifecycle.activityEnd ?? ctx.config.anchorDate;
      const span = Math.max(60 * 60 * 1_000, end.getTime() - start.getTime());
      const createdAt = new Date(
        start.getTime() +
          Math.min(span - 60 * 60 * 1_000, (index + 1) * 60 * 60 * 1_000),
      );
      return {
        id: seedId(`app-feedback:${account.key}:${index}`),
        category:
          index % 3 === 0 ? 'mobile' : index % 3 === 1 ? 'booking' : 'general',
        created_at: createdAt,
        message:
          index % 2 === 0
            ? 'Booking filters and payment states look realistic.'
            : 'Profile and notification flows are ready for demo.',
        user_id: ctx.state.userIds[account.key],
      };
    });

  const metricRows = activityMemberKeys.flatMap((memberKey) => {
    const account = ctx.state.accounts.find(
      (candidate) => candidate.key === memberKey,
    );
    const baseline = account?.physicalBaseline;
    if (!baseline) {
      return [];
    }
    const metricCount = progressionMetricCount(account);
    return Array.from({ length: metricCount }, (_, metricIndex) => {
      const recordedAt = progressionDateAt(
        ctx.config,
        account,
        metricIndex,
        metricCount,
        7,
      );
      if (!recordedAt) {
        return [];
      }
      const weight = progressionWeightAt(
        baseline,
        account,
        metricIndex,
        metricCount,
      );
      const snapshot = physicalSnapshotAtWeight(baseline, weight);
      return [
        {
          id: seedId(`progress-metric:${memberKey}:${metricIndex}`),
          body_fat_pct: new Prisma.Decimal(snapshot.bodyFatPct),
          chest_cm: new Prisma.Decimal(snapshot.chestCm),
          height_cm: new Prisma.Decimal(snapshot.heightCm),
          muscle_mass_kg: new Prisma.Decimal(snapshot.muscleMassKg),
          notes:
            metricIndex === 2
              ? 'Trend check after seeded training block.'
              : 'Baseline measurement for demo analytics.',
          recorded_at: recordedAt,
          user_id: ctx.state.userIds[memberKey],
          waist_cm: new Prisma.Decimal(snapshot.waistCm),
          weight_kg: new Prisma.Decimal(snapshot.weightKg),
        },
      ];
    }).flat();
  });

  const attendanceRows = activityMemberKeys.flatMap(
    (memberKey, memberIndex) => {
      const attendanceCount = memberVolumeCount(
        ctx,
        memberKey,
        'attendance',
        'normal',
      );
      return Array.from({ length: attendanceCount }, (_, scanIndex) => {
        const checkIn = activityDateFor(
          ctx,
          memberKey,
          scanIndex,
          attendanceCount,
          6 + ((memberIndex + scanIndex) % 13),
          scanIndex % 2 === 0 ? 15 : 45,
        );
        if (!checkIn) {
          return null;
        }
        return {
          id: seedId(`attendance:${memberKey}:${scanIndex}`),
          check_in_at: checkIn,
          check_out_at: daysFrom(checkIn, 0, checkIn.getUTCHours() + 1, 35),
          scanned_by: staffId,
          user_id: ctx.state.userIds[memberKey],
        };
      }).filter((row): row is NonNullable<typeof row> => row !== null);
    },
  );

  const deletionRequests = ctx.state.accounts
    .filter(
      (account) =>
        account.lifecycle?.deletionRequestedAt !== null &&
        account.lifecycle?.deletionRequestedAt !== undefined,
    )
    .map((account) => {
      const lifecycle = account.lifecycle!;
      return {
        id: seedId(`deletion-request:${account.key}`),
        createdAt: lifecycle.deletionRequestedAt!,
        reason:
          account.memberPersona === 'archived'
            ? 'Archived account reviewed for account lifecycle coverage.'
            : 'Edge-state account kept open for account review filters.',
        reviewNotes:
          account.memberPersona === 'archived'
            ? 'Approved as part of seeded QA history.'
            : 'Kept open for admin review demo.',
        reviewedAt: lifecycle.deletionReviewedAt,
        reviewedBy:
          account.memberPersona === 'archived'
            ? ctx.state.userIds[ctx.state.adminKeys[0]]
            : null,
        status:
          account.memberPersona === 'archived'
            ? AccountDeletionRequestStatus.approved
            : AccountDeletionRequestStatus.pending,
        userId: ctx.state.userIds[account.key],
      };
    });

  const refreshTokens = ctx.state.accounts
    .filter((account) => {
      const lifecycle = account.lifecycle;
      return account.isDemo && lifecycle && shouldSeedRefreshToken(account);
    })
    .map((account, index) => {
      const lifecycle = account.lifecycle!;
      const createdAt = new Date(
        Math.max(
          lifecycle.registeredAt.getTime() + 2 * 60 * 60 * 1_000,
          ctx.config.anchorDate.getTime() - 24 * 60 * 60 * 1_000,
        ),
      );
      return {
        id: seedId(`refresh-token:${account.key}`),
        created_at: createdAt,
        device_info:
          index % 2 === 0 ? 'Chrome on Windows QA laptop' : 'Expo Go QA device',
        expires_at: daysFrom(ctx.config.anchorDate, 30, 8 + index),
        ip_address: `127.0.0.${index + 10}`,
        token_hash: hashValue(`refresh:${account.key}`),
        user_id: ctx.state.userIds[account.key],
      };
    });

  const otpRows = ctx.state.accounts
    .filter(
      (account) =>
        account.emailVerified === false ||
        account.memberPersona === 'unverified',
    )
    .map((account, index) => {
      const createdAt = new Date(
        account.lifecycle!.registeredAt.getTime() + 60 * 60 * 1_000,
      );
      return {
        id: seedId(`otp:${account.key}`),
        attempts: index % 2,
        channel: OtpChannel.email,
        code_hash: hashValue(`000${index + 111}`),
        consumed_at: null,
        created_at: createdAt,
        expires_at: new Date(createdAt.getTime() + 10 * 60 * 1_000),
        purpose: OtpPurpose.registration,
        user_id: ctx.state.userIds[account.key],
      };
    });

  await ctx.prisma.appFeedback.createMany({
    data: feedbackRows,
    skipDuplicates: true,
  });
  await ctx.prisma.progressMetric.createMany({
    data: metricRows,
    skipDuplicates: true,
  });
  await ctx.prisma.attendanceLog.createMany({
    data: attendanceRows,
    skipDuplicates: true,
  });
  await ctx.prisma.accountDeletionRequest.createMany({
    data: deletionRequests,
    skipDuplicates: true,
  });
  await ctx.prisma.refreshToken.createMany({
    data: refreshTokens,
    skipDuplicates: true,
  });
  await ctx.prisma.otpVerification.createMany({
    data: otpRows,
    skipDuplicates: true,
  });
}

export async function seedUsersAuthProfiles(ctx: DynamicSeedContext) {
  const accounts = buildSeedAccounts(ctx.config);
  populateAccountState(ctx.state, accounts);

  for (const account of accounts) {
    await seedAccount(ctx, account);
  }

  await seedSecondaryUserData(ctx);

  ctx.notableIds.demoAdminUserId = ctx.state.userIds.admin;
  ctx.notableIds.demoStaffUserId = ctx.state.userIds.staff;
  ctx.notableIds.demoCoachUserId = ctx.state.userIds.coach;
  ctx.notableIds.demoPremiumMemberUserId = ctx.state.userIds['member-premium'];

  return {
    counts: {
      accounts: accounts.length,
      demoAccounts: accounts.filter((account) => account.isDemo).length,
    },
  };
}
