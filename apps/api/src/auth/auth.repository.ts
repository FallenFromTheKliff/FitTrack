import { Injectable, NotFoundException } from '@nestjs/common';
import {
  User,
  UserProfile,
  AuthIdentity,
  RefreshToken,
  OtpVerification,
  OtpPurpose,
  AuthProvider,
  UserRole,
  UserStatus,
  CoachProfile,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BaseRepository } from '../common/base-repository/base-repository';

type UserWithProfile = Prisma.UserGetPayload<{
  include: { profile: true; membership_card: true };
}>;
type UserWithRequiredProfile = UserWithProfile & { profile: UserProfile };
type AuthPortalSummaryRow = {
  active_members: bigint | number | null;
  sessions_today: bigint | number | null;
  total_revenue: Prisma.Decimal | null;
};

@Injectable()
export class AuthRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  // ── User ─────────────────────────────────────────────────────────────────────

  findUserById(id: string): Promise<User | null> {
    return this.findById<User>(this.prisma.user, id);
  }

  findUserByIdOrThrow(id: string): Promise<User> {
    return this.findByIdOrThrow<User>(this.prisma.user, id, 'User');
  }

  findUserWithProfile(id: string): Promise<UserWithProfile | null> {
    return this.findById<UserWithProfile>(this.prisma.user, id, {
      profile: true,
      membership_card: true,
    });
  }

  async findUserWithProfileOrThrow(
    id: string,
  ): Promise<UserWithRequiredProfile> {
    const user = await this.findByIdOrThrow<UserWithProfile>(
      this.prisma.user,
      id,
      'User',
      {
        profile: true,
        membership_card: true,
      },
    );

    return this.requireUserProfile(user, id);
  }

  updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.updateById<User>(this.prisma.user, id, data);
  }

  // ── AuthIdentity ──────────────────────────────────────────────────────────────

  /**
   * Find any identity by provider + identifier.
   * Covers email, phone, and google in one method.
   */
  findIdentity(
    provider: AuthProvider,
    identifier: string,
  ): Promise<AuthIdentity | null> {
    return this.findOne<AuthIdentity>(this.prisma.authIdentity, {
      provider,
      identifier,
    });
  }

  findAllIdentitiesForUser(userId: string): Promise<AuthIdentity[]> {
    return this.findAllByUserId<AuthIdentity>(this.prisma.authIdentity, userId);
  }

  hasIdentity(userId: string, provider: AuthProvider): Promise<boolean> {
    return this.exists(this.prisma.authIdentity, { user_id: userId, provider });
  }

  createIdentity(data: Prisma.AuthIdentityCreateInput): Promise<AuthIdentity> {
    return this.create<AuthIdentity>(this.prisma.authIdentity, data);
  }

  updateIdentity(
    id: string,
    data: Prisma.AuthIdentityUpdateInput,
  ): Promise<AuthIdentity> {
    return this.updateById<AuthIdentity>(this.prisma.authIdentity, id, data);
  }

  updateCredentialHash(
    userId: string,
    credentialHash: string,
  ): Promise<{ count: number }> {
    return this.updateMany(
      this.prisma.authIdentity,
      { user_id: userId, provider: AuthProvider.email },
      { credential_hash: credentialHash },
    );
  }

  /**
   * Mark the email AuthIdentity as verified.
   * Called after OTP verification and after admin account creation.
   */
  markEmailIdentityVerified(userId: string): Promise<{ count: number }> {
    return this.updateMany(
      this.prisma.authIdentity,
      { user_id: userId, provider: AuthProvider.email },
      { verified_at: new Date() },
    );
  }

  /**
   * Upsert phone AuthIdentity — creates if not exists, updates verified_at if it does.
   * Called after phone OTP is successfully consumed.
   */
  upsertPhoneIdentity(userId: string, phone: string): Promise<AuthIdentity> {
    return this.upsert<AuthIdentity>(
      this.prisma.authIdentity,
      {
        user_id_provider_identifier: {
          user_id: userId,
          provider: AuthProvider.phone,
          identifier: phone,
        },
      },
      { verified_at: new Date() },
      {
        user_id: userId,
        provider: AuthProvider.phone,
        identifier: phone,
        verified_at: new Date(),
        is_primary: false,
      },
    );
  }

  /**
   * Backfill avatar on UserProfile if it is currently null.
   * Called when linking Google to an existing email account.
   */
  backfillAvatar(
    userId: string,
    avatarUrl: string,
  ): Promise<{ count: number }> {
    return this.updateMany(
      this.prisma.userProfile,
      { user_id: userId, avatar_url: null },
      { avatar_url: avatarUrl },
    );
  }

  /**
   * Create a CoachProfile for a newly created coach account.
   * Called by adminCreateUser() when role = coach.
   */
  createCoachProfile(
    userId: string,
    data: { displayName?: string | null } = {},
  ): Promise<CoachProfile> {
    return this.create<CoachProfile>(this.prisma.coachProfile, {
      display_name: data.displayName?.trim() || null,
      user_id: userId,
    });
  }

  async getPortalSummary(
    referenceDate: Date,
    todayStartUtc: Date,
    tomorrowStartUtc: Date,
  ): Promise<AuthPortalSummaryRow> {
    const rows = await this.queryRaw<AuthPortalSummaryRow[]>`
      WITH active_members AS (
        SELECT COUNT(DISTINCT users.id) AS active_members
        FROM users
        JOIN membership_cards ON membership_cards.user_id = users.id
        LEFT JOIN account_deletion_requests pending_requests
          ON pending_requests.user_id = users.id
         AND pending_requests.status = 'pending'
        WHERE users.role = 'member'
          AND users."deletedAt" IS NULL
          AND pending_requests.id IS NULL
          AND membership_cards.status = 'active'
          AND COALESCE(
            membership_cards.activated_at,
            membership_cards.verified_at,
            membership_cards.purchased_at
          ) <= ${referenceDate}
          AND (
            membership_cards.revoked_at IS NULL
            OR membership_cards.revoked_at > ${referenceDate}
          )
      ),
      sessions_today AS (
        SELECT COUNT(*) AS sessions_today
        FROM attendance_logs
        JOIN users ON users.id = attendance_logs.user_id
        LEFT JOIN account_deletion_requests pending_requests
          ON pending_requests.user_id = users.id
         AND pending_requests.status = 'pending'
        WHERE check_in_at >= ${todayStartUtc}
          AND check_in_at < ${tomorrowStartUtc}
          AND users.role = 'member'
          AND users."deletedAt" IS NULL
          AND pending_requests.id IS NULL
      ),
      payment_revenue AS (
        SELECT
          COALESCE(SUM(CASE WHEN payable_type IN ('subscription', 'membership_card') THEN amount ELSE 0 END), 0)
          + COALESCE(SUM(CASE WHEN payable_type = 'booking' THEN amount ELSE 0 END), 0) AS payment_revenue
        FROM payments
        WHERE status = 'completed'
          AND COALESCE(verified_at, created_at) <= ${referenceDate}
      ),
      product_revenue AS (
        SELECT COALESCE(SUM(total_amount), 0) AS product_revenue
        FROM sale_transactions
        WHERE status = 'completed'
          AND created_at <= ${referenceDate}
      ),
      coaching_revenue AS (
        SELECT COALESCE(SUM(payments.amount), 0) AS coaching_gym_revenue
        FROM payments
        LEFT JOIN coach_appointments
          ON payments.payable_type = 'coaching'
         AND coach_appointments.id = payments.payable_id
        LEFT JOIN recurring_coaching_billing_cycles
          ON payments.payable_type = 'recurring_coaching'
         AND recurring_coaching_billing_cycles.id = payments.payable_id
        LEFT JOIN recurring_coaching_plans
          ON recurring_coaching_plans.id = recurring_coaching_billing_cycles.recurring_plan_id
        JOIN coach_profiles
          ON coach_profiles.id = COALESCE(coach_appointments.coach_id, recurring_coaching_plans.coach_id)
        WHERE payments.status = 'completed'
          AND payments.payable_type IN ('coaching', 'recurring_coaching')
          AND COALESCE(payments.verified_at, payments.created_at) <= ${referenceDate}
      )
      SELECT
        active_members.active_members,
        sessions_today.sessions_today,
        (
          payment_revenue.payment_revenue
          + product_revenue.product_revenue
          + coaching_revenue.coaching_gym_revenue
        ) AS total_revenue
      FROM active_members, sessions_today, payment_revenue, product_revenue, coaching_revenue
    `;

    return (
      rows[0] ?? {
        active_members: 0,
        sessions_today: 0,
        total_revenue: new Prisma.Decimal(0),
      }
    );
  }

  // ── RefreshToken ──────────────────────────────────────────────────────────────

  createRefreshToken(
    data: Prisma.RefreshTokenCreateInput,
  ): Promise<RefreshToken> {
    return this.create<RefreshToken>(this.prisma.refreshToken, data);
  }

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.findUniqueWhere<RefreshToken>(this.prisma.refreshToken, {
      token_hash: tokenHash,
    });
  }

  revokeRefreshToken(id: string): Promise<RefreshToken> {
    return this.updateById<RefreshToken>(this.prisma.refreshToken, id, {
      revoked_at: new Date(),
    });
  }

  revokeAllUserRefreshTokens(userId: string): Promise<{ count: number }> {
    return this.updateMany(
      this.prisma.refreshToken,
      { user_id: userId, revoked_at: null },
      { revoked_at: new Date() },
    );
  }

  // ── OtpVerification ───────────────────────────────────────────────────────────

  findLatestOtp(
    userId: string,
    purpose: OtpPurpose,
  ): Promise<OtpVerification | null> {
    return this.findOne<OtpVerification>(
      this.prisma.otpVerification,
      { user_id: userId, purpose },
      undefined,
      { created_at: 'desc' },
    );
  }

  createOtp(data: Prisma.OtpVerificationCreateInput): Promise<OtpVerification> {
    return this.create<OtpVerification>(this.prisma.otpVerification, data);
  }

  updateOtp(
    id: string,
    data: Prisma.OtpVerificationUpdateInput,
  ): Promise<OtpVerification> {
    return this.updateById<OtpVerification>(
      this.prisma.otpVerification,
      id,
      data,
    );
  }

  // ── Transactional Account Creation ───────────────────────────────────────────

  /**
   * Atomically creates User + AuthIdentity(email) + UserProfile + NotificationPreference.
   * Used by self-registration (pending) and admin-create (active).
   */
  createUserWithProfile(data: {
    acceptedPrivacyAt?: Date;
    role: UserRole;
    status: UserStatus;
    email: string;
    credentialHash: string;
    firstName: string;
    lastName: string;
    phone?: string;
    emailVerifiedAt?: Date;
    qrCodeToken?: string;
    createCoachProfile?: boolean;
  }): Promise<User> {
    return this.transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: data.role,
          status: data.status,
          email_verified_at: data.emailVerifiedAt,
          has_accepted_privacy: Boolean(data.acceptedPrivacyAt),
          privacy_accepted_at: data.acceptedPrivacyAt,
          qr_code_token: data.qrCodeToken,
        },
      });

      await tx.authIdentity.create({
        data: {
          user_id: user.id,
          provider: AuthProvider.email,
          identifier: data.email,
          credential_hash: data.credentialHash,
          is_primary: true,
        },
      });

      await tx.userProfile.create({
        data: {
          user_id: user.id,
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone ?? null,
        },
      });

      await tx.notificationPreference.create({
        data: { user_id: user.id },
      });

      if (data.createCoachProfile) {
        await tx.coachProfile.create({
          data: { user_id: user.id },
        });
      }

      return user;
    });
  }

  /**
   * Atomically creates a brand-new account from a Google profile.
   * Email is pre-verified — Google already confirmed it.
   */
  createUserFromGoogle(data: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    qrToken: string;
  }): Promise<User> {
    return this.transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          role: UserRole.member,
          status: UserStatus.active,
          email_verified_at: new Date(),
          qr_code_token: data.qrToken,
        },
      });

      await tx.authIdentity.create({
        data: {
          user_id: user.id,
          provider: AuthProvider.google,
          identifier: data.email,
          provider_user_id: data.googleId,
          verified_at: new Date(),
          is_primary: true,
        },
      });

      await tx.userProfile.create({
        data: {
          user_id: user.id,
          first_name: data.firstName,
          last_name: data.lastName,
          avatar_url: data.avatarUrl,
        },
      });

      await tx.notificationPreference.create({
        data: { user_id: user.id },
      });

      return user;
    });
  }

  private requireUserProfile(
    user: UserWithProfile,
    userId: string,
  ): UserWithRequiredProfile {
    if (!user.profile) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'UserProfile Not Found',
        status: 404,
        detail: `UserProfile for user "${userId}" does not exist.`,
      });
    }

    return user as UserWithRequiredProfile;
  }
}
