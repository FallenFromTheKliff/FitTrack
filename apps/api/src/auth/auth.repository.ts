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

type UserWithProfile = Prisma.UserGetPayload<{ include: { profile: true } }>;
type UserWithRequiredProfile = UserWithProfile & { profile: UserProfile };

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
   * Create an empty CoachProfile for a newly created coach account.
   * Called by adminCreateUser() when role = coach.
   */
  createCoachProfile(userId: string): Promise<CoachProfile> {
    return this.create<CoachProfile>(this.prisma.coachProfile, {
      user_id: userId,
    });
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
