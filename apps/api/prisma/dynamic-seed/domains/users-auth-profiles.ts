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

function defaultGender(account: SeedAccount, index: number) {
  return account.gender ?? (index % 2 === 0 ? Gender.female : Gender.male);
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
  return daysFrom(ctx.config.anchorDate, -80 + ctx.rng.int(0, 40), 10);
}

async function seedAccount(
  ctx: DynamicSeedContext,
  account: SeedAccount,
  index: number,
) {
  const verifiedAt =
    account.emailVerified === false
      ? null
      : daysFrom(ctx.config.anchorDate, -60 + (index % 30), 9);
  const acceptedAt = privacyAcceptedAt(ctx, account);
  const userId = userIdFor(account.key);
  const credentialHash = await credentialHashFor(account.password);
  const status =
    account.status ??
    (account.emailVerified === false ? UserStatus.pending : UserStatus.active);
  const deletedAt =
    account.memberPersona === 'archived'
      ? daysFrom(ctx.config.anchorDate, -45, 9)
      : (account.deletedAt ?? null);

  await ctx.prisma.user.upsert({
    where: { id: userId },
    update: {
      deletedAt,
      email_verified_at: verifiedAt,
      has_accepted_privacy: Boolean(acceptedAt),
      phone_verified_at: verifiedAt,
      privacy_accepted_at: acceptedAt,
      qr_code_expires_at:
        status === UserStatus.active
          ? daysFrom(ctx.config.anchorDate, 365, 23, 59)
          : null,
      qr_code_rotated_at:
        status === UserStatus.active
          ? daysFrom(ctx.config.anchorDate, -7 - (index % 20), 8)
          : null,
      qr_code_token:
        status === UserStatus.active
          ? `dynqr_${hashValue(userId).slice(0, 32)}`
          : null,
      role: account.role,
      status,
    },
    create: {
      id: userId,
      deletedAt,
      email_verified_at: verifiedAt,
      has_accepted_privacy: Boolean(acceptedAt),
      phone_verified_at: verifiedAt,
      privacy_accepted_at: acceptedAt,
      qr_code_expires_at:
        status === UserStatus.active
          ? daysFrom(ctx.config.anchorDate, 365, 23, 59)
          : null,
      qr_code_rotated_at:
        status === UserStatus.active
          ? daysFrom(ctx.config.anchorDate, -7 - (index % 20), 8)
          : null,
      qr_code_token:
        status === UserStatus.active
          ? `dynqr_${hashValue(userId).slice(0, 32)}`
          : null,
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
      credential_hash: credentialHash,
      is_primary: true,
      verified_at: verifiedAt,
    },
    create: {
      credential_hash: credentialHash,
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
      is_primary: false,
      verified_at: verifiedAt,
    },
    create: {
      identifier: account.phone,
      is_primary: false,
      provider: AuthProvider.phone,
      user_id: userId,
      verified_at: verifiedAt,
    },
  });

  const heightCm = account.heightCm ?? 154 + (index % 31);
  const weightKg = account.weightKg ?? 55 + (index % 34);

  await ctx.prisma.userProfile.upsert({
    where: { user_id: userId },
    update: {
      activity_level: defaultActivityLevel(account),
      avatar_url: null,
      date_of_birth: defaultDateOfBirth(ctx, account),
      first_name: account.firstName,
      fitness_goal: defaultFitnessGoal(account),
      gender: defaultGender(account, index),
      height_cm: new Prisma.Decimal(heightCm),
      last_name: account.lastName,
      phone: account.phone,
      weight_kg: new Prisma.Decimal(weightKg),
    },
    create: {
      id: seedId(`profile:${account.key}`),
      activity_level: defaultActivityLevel(account),
      avatar_url: null,
      date_of_birth: defaultDateOfBirth(ctx, account),
      first_name: account.firstName,
      fitness_goal: defaultFitnessGoal(account),
      gender: defaultGender(account, index),
      height_cm: new Prisma.Decimal(heightCm),
      last_name: account.lastName,
      phone: account.phone,
      user_id: userId,
      weight_kg: new Prisma.Decimal(weightKg),
    },
  });

  await ctx.prisma.notificationPreference.upsert({
    where: { user_id: userId },
    update: {},
    create: {
      id: seedId(`notification-preference:${account.key}`),
      appointment_confirmed_sms: account.role === UserRole.coach,
      booking_confirmed_sms: account.memberPersona === 'premium',
      coach_appointment_reminder_sms: account.memberPersona === 'premium',
      payment_confirmed_email: true,
      rank_up_email: account.role === UserRole.member,
      subscription_expiring_sms: account.memberPersona === 'premium',
      user_id: userId,
    },
  });
}

async function seedSecondaryUserData(ctx: DynamicSeedContext) {
  const staffId = ctx.state.userIds[ctx.state.staffKeys[0]];
  const activityMemberKeys = [
    ...ctx.state.activeMemberKeys,
    ...ctx.state.historicalMemberKeys,
  ];
  const feedbackRows = ctx.state.accounts
    .filter(
      (account) =>
        account.role !== UserRole.member ||
        !ctx.state.restrictedMemberKeys.includes(account.key),
    )
    .slice(0, 48)
    .map((account, index) => ({
      id: seedId(`app-feedback:${account.key}:${index}`),
      category:
        index % 3 === 0 ? 'mobile' : index % 3 === 1 ? 'booking' : 'general',
      created_at: daysFrom(ctx.config.anchorDate, -18 + (index % 12), 16),
      message:
        index % 2 === 0
          ? 'Booking filters and payment states look realistic.'
          : 'Profile and notification flows are ready for demo.',
      user_id: ctx.state.userIds[account.key],
    }));

  const metricRows = activityMemberKeys.flatMap((memberKey, memberIndex) =>
    [0, 1, 2].flatMap((metricIndex) => {
      const recordedAt = activityDateFor(
        ctx,
        memberKey,
        metricIndex,
        3,
        7,
      );
      return recordedAt
        ? [
            {
              id: seedId(`progress-metric:${memberKey}:${metricIndex}`),
              body_fat_pct: new Prisma.Decimal(
                18 + ((memberIndex + metricIndex) % 10),
              ),
              chest_cm: new Prisma.Decimal(
                82 + ((memberIndex + metricIndex) % 18),
              ),
              height_cm: new Prisma.Decimal(156 + (memberIndex % 24)),
              muscle_mass_kg: new Prisma.Decimal(
                28 + ((memberIndex + metricIndex) % 14),
              ),
              notes:
                metricIndex === 2
                  ? 'Trend check after seeded training block.'
                  : 'Baseline measurement for demo analytics.',
              recorded_at: recordedAt,
              user_id: ctx.state.userIds[memberKey],
              waist_cm: new Prisma.Decimal(
                70 + ((memberIndex + metricIndex) % 16),
              ),
              weight_kg: new Prisma.Decimal(
                55 + ((memberIndex + metricIndex) % 32),
              ),
            },
          ]
        : [];
    }),
  );

  const attendanceRows = activityMemberKeys.flatMap((memberKey, memberIndex) => {
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
  });

  const deletionRequests = ctx.state.accounts
    .filter((account) =>
      ['archived', 'suspended', 'expired'].includes(
        account.memberPersona ?? '',
      ),
    )
    .map((account, index) => ({
      id: seedId(`deletion-request:${account.key}`),
      createdAt: daysFrom(ctx.config.anchorDate, -12 + index, 9),
      reason:
        account.memberPersona === 'archived'
          ? 'Archived account reviewed for account lifecycle coverage.'
          : 'Edge-state account kept open for account review filters.',
      reviewNotes:
        account.memberPersona === 'archived'
          ? 'Approved as part of seeded QA history.'
          : 'Kept open for admin review demo.',
      reviewedAt:
        account.memberPersona === 'archived'
          ? daysFrom(ctx.config.anchorDate, -9 + index, 11)
          : null,
      reviewedBy:
        account.memberPersona === 'archived'
          ? ctx.state.userIds[ctx.state.adminKeys[0]]
          : null,
      status:
        account.memberPersona === 'archived'
          ? AccountDeletionRequestStatus.approved
          : AccountDeletionRequestStatus.pending,
      userId: ctx.state.userIds[account.key],
    }));

  const refreshTokens = ctx.state.accounts
    .filter((account) => account.isDemo)
    .map((account, index) => ({
      id: seedId(`refresh-token:${account.key}`),
      created_at: daysFrom(ctx.config.anchorDate, -1, 8 + index),
      device_info:
        index % 2 === 0 ? 'Chrome on Windows QA laptop' : 'Expo Go QA device',
      expires_at: daysFrom(ctx.config.anchorDate, 30, 8 + index),
      ip_address: `127.0.0.${index + 10}`,
      token_hash: hashValue(`refresh:${account.key}`),
      user_id: ctx.state.userIds[account.key],
    }));

  const otpRows = ctx.state.accounts
    .filter(
      (account) =>
        account.emailVerified === false || account.memberPersona === 'pending',
    )
    .map((account, index) => ({
      id: seedId(`otp:${account.key}`),
      attempts: index % 2,
      channel: OtpChannel.email,
      code_hash: hashValue(`000${index + 111}`),
      consumed_at:
        account.emailVerified === false
          ? null
          : daysFrom(ctx.config.anchorDate, -1),
      expires_at: daysFrom(ctx.config.anchorDate, 1, 12),
      purpose:
        account.emailVerified === false
          ? OtpPurpose.registration
          : OtpPurpose.password_reset,
      user_id: ctx.state.userIds[account.key],
    }));

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

  for (const [index, account] of accounts.entries()) {
    await seedAccount(ctx, account, index);
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
