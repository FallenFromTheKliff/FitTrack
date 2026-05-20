import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { EventEmitter2 } from '@nestjs/event-emitter';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {
  OtpChannel,
  OtpPurpose,
  UserRole,
  UserStatus,
  AuthProvider,
} from '@prisma/client';

import { AuthRepository } from './auth.repository';
import { GoogleProfile } from './strategies/google.strategy';
import {
  InternalLoginResponse,
  InternalTokenPairResponse,
  JwtPayload,
} from './types/jwt-payload.type';
import { AuditAction, AuditEvent } from '../audit/audit.service';
import {
  RegisterDTO,
  VerifyEmailDTO,
  LoginDTO,
  ForgotPasswordDTO,
  VerifyCurrentPasswordDTO,
  VerifyResetOtpDTO,
  ResetPasswordDTO,
  ChangePasswordDTO,
  AdminCreateUserDTO,
  ResendOtpDTO,
} from './dto/auth.dto';
import { AuthOtpService } from './otp/auth-otp.service';
import {
  USER_REGISTERED_EVENT,
  type UserRegisteredEvent,
} from './events/user-registered.event';
import { ACCOUNT_ACTIVITY_EVENT } from '../user/events/account-activity.event';

const PASSWORD_HASH_ROUNDS = 12;
const REFRESH_TTL_DAYS = 7;
const JTI_BLACKLIST_TTL = 900;
const LOGIN_LOCK_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_TTL_SECONDS = 30 * 60;

type NullableAuthenticatedUser = Awaited<
  ReturnType<AuthRepository['findUserWithProfile']>
>;

type AuthenticatedUser = Awaited<
  ReturnType<AuthRepository['findUserWithProfileOrThrow']>
>;

type LoginPortal = NonNullable<LoginDTO['portal']>;

function buildAccountDisplayName(firstName?: string, lastName?: string) {
  return [firstName, lastName]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
    .trim();
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly otpService: AuthOtpService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDTO): Promise<{ user_id: string }> {
    const email = this.normalizeLoginEmail(dto.email);
    const existing = await this.repo.findIdentity(AuthProvider.email, email);
    if (existing) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Email Already Registered',
        status: 409,
        detail: 'An account with this email already exists.',
      });
    }

    const credentialHash = await bcrypt.hash(
      dto.password,
      PASSWORD_HASH_ROUNDS,
    );

    const user = await this.repo.createUserWithProfile({
      role: UserRole.member,
      status: UserStatus.pending,
      email,
      credentialHash,
      firstName: dto.first_name,
      lastName: dto.last_name,
      phone: dto.phone,
    });

    await this.otpService.issueOtp(
      user.id,
      OtpPurpose.registration,
      OtpChannel.email,
      email,
    );

    return { user_id: user.id };
  }

  async verifyEmail(dto: VerifyEmailDTO): Promise<InternalTokenPairResponse> {
    await this.otpService.consumeOtp(
      dto.user_id,
      dto.code,
      OtpPurpose.registration,
    );

    const pendingUser = await this.repo.findUserByIdOrThrow(dto.user_id);
    const user = await this.repo.updateUser(dto.user_id, {
      status: UserStatus.active,
      email_verified_at: new Date(),
      ...(pendingUser.role === UserRole.member
        ? { qr_code_token: this.generateQrToken() }
        : {}),
    });

    await this.repo.markEmailIdentityVerified(dto.user_id);
    this.emitUserRegistered({
      userId: user.id,
      role: user.role,
      source: 'email_verification',
      registeredAt: new Date().toISOString(),
    });

    return this.issueTokenPair(
      await this.repo.findUserWithProfileOrThrow(user.id),
    );
  }

  async login(
    dto: LoginDTO,
    deviceInfo: string,
    ip: string,
  ): Promise<InternalLoginResponse> {
    const normalizedEmail = this.normalizeLoginEmail(dto.email);

    try {
      await this.assertLoginNotLocked(normalizedEmail);

      const identity = await this.repo.findIdentity(
        AuthProvider.email,
        normalizedEmail,
      );
      if (!identity || !identity.credential_hash) {
        return this.throwInvalidCredentials(normalizedEmail);
      }

      const userRecord = await this.repo.findUserWithProfile(identity.user_id);

      const passwordMatch = await bcrypt.compare(
        dto.password,
        identity.credential_hash,
      );
      if (!passwordMatch) {
        return this.throwInvalidCredentials(normalizedEmail);
      }

      const user = this.requireActiveAuthUser(userRecord);
      if (!this.isLoginPortalAllowed(dto.portal, user.role)) {
        return this.throwInvalidCredentials(normalizedEmail);
      }

      await this.clearLoginLockState(normalizedEmail);
      if (this.requiresEmailVerification(user)) {
        await this.otpService.issueOtp(
          user.id,
          OtpPurpose.registration,
          OtpChannel.email,
          normalizedEmail,
        );

        return {
          otpRequired: true,
          user_id: user.id,
          email: normalizedEmail,
          role: user.role,
        };
      }

      return this.issueTokenPair(user, deviceInfo, ip);
    } catch (error) {
      return this.handleLoginFailure(normalizedEmail, error);
    }
  }

  async googleLogin(
    profile: GoogleProfile,
    deviceInfo: string,
    ip: string,
  ): Promise<InternalTokenPairResponse> {
    if (!profile.email) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'No Email from Google',
          status: 422,
          detail: 'Google account must have an email address.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const googleIdentity = await this.repo.findIdentity(
      AuthProvider.google,
      profile.email,
    );
    if (googleIdentity) {
      const user = this.requireActiveAuthUser(
        await this.repo.findUserWithProfile(googleIdentity.user_id),
      );
      return this.issueTokenPair(user, deviceInfo, ip);
    }

    const emailIdentity = await this.repo.findIdentity(
      AuthProvider.email,
      profile.email,
    );
    if (emailIdentity) {
      await this.repo.createIdentity({
        user: { connect: { id: emailIdentity.user_id } },
        provider: AuthProvider.google,
        identifier: profile.email,
        provider_user_id: profile.google_id,
        verified_at: new Date(),
        is_primary: false,
      });

      if (profile.avatar_url) {
        await this.repo.backfillAvatar(
          emailIdentity.user_id,
          profile.avatar_url,
        );
      }

      this.emitAudit({
        userId: emailIdentity.user_id,
        action: AuditAction.GOOGLE_LINKED,
        entity: 'User',
        entityId: emailIdentity.user_id,
        after: { provider: 'google', identifier: profile.email },
        ipAddress: ip,
      });

      const user = this.requireActiveAuthUser(
        await this.repo.findUserWithProfile(emailIdentity.user_id),
      );
      return this.issueTokenPair(user, deviceInfo, ip);
    }

    const newUser = await this.repo.createUserFromGoogle({
      googleId: profile.google_id,
      email: profile.email,
      firstName: profile.first_name,
      lastName: profile.last_name,
      avatarUrl: profile.avatar_url,
      qrToken: this.generateQrToken(),
    });

    this.emitAudit({
      userId: newUser.id,
      action: AuditAction.USER_CREATED,
      entity: 'User',
      entityId: newUser.id,
      after: {
        provider: 'google',
        email: profile.email,
        role: UserRole.member,
      },
      ipAddress: ip,
    });
    this.emitUserRegistered({
      userId: newUser.id,
      role: UserRole.member,
      source: 'google_login',
      registeredAt: new Date().toISOString(),
    });

    return this.issueTokenPair(
      await this.repo.findUserWithProfileOrThrow(newUser.id),
      deviceInfo,
      ip,
    );
  }

  async refresh(rawCookieToken: string): Promise<InternalTokenPairResponse> {
    const tokenHash = this.hashToken(rawCookieToken);
    const stored = await this.repo.findRefreshTokenByHash(tokenHash);

    if (!stored) {
      throw new UnauthorizedException({
        type: 'INVALID_REFRESH_TOKEN',
        title: 'Invalid Refresh Token',
        status: 401,
        detail: 'Refresh token not found.',
      });
    }

    if (stored.revoked_at !== null) {
      await this.repo.revokeAllUserRefreshTokens(stored.user_id);
      throw new UnauthorizedException({
        type: 'TOKEN_REUSE_DETECTED',
        title: 'Token Reuse Detected',
        status: 401,
        detail: 'Suspicious activity detected. All sessions have been revoked.',
      });
    }

    if (stored.expires_at < new Date()) {
      throw new UnauthorizedException({
        type: 'REFRESH_TOKEN_EXPIRED',
        title: 'Refresh Token Expired',
        status: 401,
        detail: 'Your session has expired. Please log in again.',
      });
    }

    await this.repo.revokeRefreshToken(stored.id);

    const user = this.requireActiveAuthUser(
      await this.repo.findUserWithProfile(stored.user_id),
    );

    return this.issueTokenPair(
      user,
      stored.device_info ?? undefined,
      stored.ip_address ?? undefined,
      stored.id,
    );
  }

  async logout(jti: string, rawCookieToken: string): Promise<void> {
    await this.redis.setex(`token_blacklist:${jti}`, JTI_BLACKLIST_TTL, '1');

    const tokenHash = this.hashToken(rawCookieToken);
    const stored = await this.repo.findRefreshTokenByHash(tokenHash);
    if (stored && !stored.revoked_at) {
      await this.repo.revokeRefreshToken(stored.id);
    }
  }

  async forgotPassword(dto: ForgotPasswordDTO): Promise<void> {
    const email = this.normalizeLoginEmail(dto.email);
    const identity = await this.repo.findIdentity(AuthProvider.email, email);
    if (!identity) return;

    await this.assertPasswordResetPortalAllowed(identity, dto.portal);

    await this.otpService.issueOtp(
      identity.user_id,
      OtpPurpose.password_reset,
      OtpChannel.email,
      email,
    );
  }

  async verifyCurrentPassword(
    userId: string,
    dto: VerifyCurrentPasswordDTO,
  ): Promise<boolean> {
    const identity = await this.requirePasswordIdentity(userId);
    const passwordMatch = await bcrypt.compare(
      dto.current_password,
      identity.credential_hash,
    );

    if (!passwordMatch) {
      throw new UnauthorizedException({
        type: 'INVALID_CURRENT_PASSWORD',
        title: 'Invalid Current Password',
        status: 401,
        detail: 'Current password is incorrect.',
      });
    }

    return true;
  }

  async verifyResetOtp(dto: VerifyResetOtpDTO): Promise<boolean> {
    const email = this.normalizeLoginEmail(dto.email);
    const identity = await this.repo.findIdentity(AuthProvider.email, email);
    if (!identity) {
      if (dto.portal) {
        this.throwInvalidPortalCredentials();
      }
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'Not Found',
        status: 404,
        detail: 'No account found with this email.',
      });
    }

    await this.assertPasswordResetPortalAllowed(identity, dto.portal);

    await this.otpService.assertOtpValid(
      identity.user_id,
      dto.code,
      OtpPurpose.password_reset,
    );

    return true;
  }

  async resetPassword(dto: ResetPasswordDTO): Promise<void> {
    const email = this.normalizeLoginEmail(dto.email);
    const identity = await this.repo.findIdentity(AuthProvider.email, email);
    if (!identity) {
      if (dto.portal) {
        this.throwInvalidPortalCredentials();
      }
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'Not Found',
        status: 404,
        detail: 'No account found with this email.',
      });
    }
    await this.assertPasswordResetPortalAllowed(identity, dto.portal);
    const credentialHash = identity.credential_hash;
    if (!credentialHash) {
      throw new UnauthorizedException({
        type: 'INVALID_CURRENT_PASSWORD',
        title: 'Invalid Current Password',
        status: 401,
        detail: 'Current password is incorrect.',
      });
    }

    await this.otpService.assertOtpValid(
      identity.user_id,
      dto.code,
      OtpPurpose.password_reset,
    );

    await this.assertPasswordDoesNotReuseCurrent(
      credentialHash,
      dto.new_password,
    );

    await this.otpService.consumeOtp(
      identity.user_id,
      dto.code,
      OtpPurpose.password_reset,
    );

    const newHash = await bcrypt.hash(dto.new_password, PASSWORD_HASH_ROUNDS);
    await this.repo.updateCredentialHash(identity.user_id, newHash);
    await this.repo.revokeAllUserRefreshTokens(identity.user_id);

    this.emitAudit({
      userId: identity.user_id,
      action: AuditAction.PASSWORD_RESET,
      entity: 'User',
      entityId: identity.user_id,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDTO): Promise<void> {
    const identity = await this.requirePasswordIdentity(userId);
    const currentPasswordMatch = await bcrypt.compare(
      dto.current_password,
      identity.credential_hash,
    );

    if (!currentPasswordMatch) {
      throw new UnauthorizedException({
        type: 'INVALID_CURRENT_PASSWORD',
        title: 'Invalid Current Password',
        status: 401,
        detail: 'Current password is incorrect.',
      });
    }

    const reusesCurrentPassword = await bcrypt.compare(
      dto.new_password,
      identity.credential_hash,
    );
    if (reusesCurrentPassword) {
      this.throwPasswordReuseError();
    }

    const newHash = await bcrypt.hash(dto.new_password, PASSWORD_HASH_ROUNDS);
    await this.repo.updateCredentialHash(userId, newHash);
    await this.repo.revokeAllUserRefreshTokens(userId);

    this.emitAudit({
      userId,
      action: AuditAction.PASSWORD_RESET,
      entity: 'User',
      entityId: userId,
    });
  }

  async resendOtp(dto: ResendOtpDTO): Promise<void> {
    const user = await this.repo.findUserById(dto.user_id);
    if (!user) return;
    if (user.status !== UserStatus.pending) return;

    const identities = await this.repo.findAllIdentitiesForUser(dto.user_id);
    const email = identities.find(
      (i) => i.provider === AuthProvider.email,
    )?.identifier;
    if (!email) return;

    await this.otpService.issueOtp(
      dto.user_id,
      OtpPurpose.registration,
      OtpChannel.email,
      email,
    );
  }

  async getPortalSummary(): Promise<{
    active_members: number;
    sessions_today: number;
    total_revenue: string;
  }> {
    const now = new Date();
    const todayStartUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const tomorrowStartUtc = new Date(todayStartUtc.getTime());
    tomorrowStartUtc.setUTCDate(tomorrowStartUtc.getUTCDate() + 1);

    const summary = await this.repo.getPortalSummary(
      now,
      todayStartUtc,
      tomorrowStartUtc,
    );

    return {
      active_members: Number(summary.active_members ?? 0),
      sessions_today: Number(summary.sessions_today ?? 0),
      total_revenue: (summary.total_revenue ?? 0).toString(),
    };
  }

  async adminCreateUser(
    dto: AdminCreateUserDTO,
    actorId: string,
    actorRole: UserRole,
    ip: string,
  ): Promise<{ user_id: string; email: string; role: string }> {
    const email = this.normalizeLoginEmail(dto.email);
    if (actorRole === UserRole.staff && dto.role === 'admin') {
      throw new ForbiddenException({
        type: 'FORBIDDEN',
        title: 'Role Not Allowed',
        status: 403,
        detail: 'Staff accounts can only create staff or member accounts.',
      });
    }

    const existing = await this.repo.findIdentity(AuthProvider.email, email);
    if (existing) {
      throw new ConflictException({
        type: 'CONFLICT',
        title: 'Email Already Registered',
        status: 409,
        detail: 'An account with this email already exists.',
      });
    }

    const credentialHash = await bcrypt.hash(
      dto.password,
      PASSWORD_HASH_ROUNDS,
    );

    const user = await this.repo.createUserWithProfile({
      role: dto.role as UserRole,
      status: UserStatus.pending,
      email,
      credentialHash,
      firstName: dto.first_name,
      lastName: dto.last_name,
      phone: dto.phone,
    });

    const accountDisplayName = buildAccountDisplayName(
      dto.first_name,
      dto.last_name,
    );

    if (dto.role === 'coach') {
      await this.repo.createCoachProfile(user.id, {
        displayName: accountDisplayName,
      });
    }

    this.emitAudit({
      userId: actorId,
      action: AuditAction.USER_CREATED,
      entity: 'User',
      entityId: user.id,
      after: { email, role: dto.role, createdBy: actorId },
      ipAddress: ip,
    });

    await this.eventEmitter.emitAsync(ACCOUNT_ACTIVITY_EVENT, {
      action: 'account_created',
      actorId,
      occurredAt: new Date().toISOString(),
      targetEmail: email,
      targetName: accountDisplayName,
      targetRole: dto.role,
      targetUserId: user.id,
    });

    return { user_id: user.id, email, role: dto.role };
  }

  async issueTokenPair(
    user: AuthenticatedUser,
    deviceInfo?: string,
    ip?: string,
    rotatedFromId?: string,
  ): Promise<InternalTokenPairResponse> {
    const jti = crypto.randomUUID();

    const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: user.id,
      role: user.role,
      status: user.status,
      jti,
    };

    const accessToken = this.jwt.sign(payload);

    const rawRefreshToken = crypto.randomUUID();
    const tokenHash = this.hashToken(rawRefreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TTL_DAYS);

    await this.repo.createRefreshToken({
      user: { connect: { id: user.id } },
      token_hash: tokenHash,
      device_info: deviceInfo ?? null,
      ip_address: ip ?? null,
      expires_at: expiresAt,
      parent: rotatedFromId ? { connect: { id: rotatedFromId } } : undefined,
    });

    const qrCodeReady =
      typeof user.qr_code_token === 'string' &&
      user.qr_code_token.trim() !== '';
    const attendanceQrReady =
      qrCodeReady && user.membership_card?.status === 'active';

    return {
      access_token: accessToken,
      _refresh_token: rawRefreshToken,
      user: {
        id: user.id,
        role: user.role,
        status: user.status,
        email_verified_at: user.email_verified_at?.toISOString() ?? null,
        phone_no: user.profile.phone ?? null,
        membership_card: user.membership_card ?? null,
        qr_code_token: user.qr_code_token ?? null,
        qrCodeReady,
        attendanceQrReady,
        has_accepted_privacy: user.has_accepted_privacy,
        privacy_accepted_at: user.privacy_accepted_at?.toISOString() ?? null,
        profile: {
          first_name: user.profile.first_name,
          last_name: user.profile.last_name,
          avatar_url: user.profile.avatar_url ?? null,
        },
      },
    };
  }

  private requireActiveAuthUser(
    user: NullableAuthenticatedUser,
  ): AuthenticatedUser {
    if (!user) {
      throw new UnauthorizedException({
        type: 'INVALID_CREDENTIALS',
        title: 'Invalid Credentials',
        status: 401,
        detail: 'Invalid credentials.',
      });
    }

    if (user.deletedAt) {
      throw new UnauthorizedException({
        type: 'INVALID_CREDENTIALS',
        title: 'Invalid Credentials',
        status: 401,
        detail: 'Invalid credentials.',
      });
    }

    if (!user.profile) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'UserProfile Not Found',
        status: 404,
        detail: `UserProfile for user "${user.id}" does not exist.`,
      });
    }

    if (
      user.status === UserStatus.suspended ||
      user.status === UserStatus.banned
    ) {
      throw new ForbiddenException({
        type: 'ACCOUNT_SUSPENDED',
        title: 'Account Suspended',
        status: 403,
        detail: `Your account is ${user.status}. Please contact support.`,
      });
    }

    return user as AuthenticatedUser;
  }

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter.emit('audit.log', event);
  }

  private emitUserRegistered(event: UserRegisteredEvent): void {
    this.eventEmitter.emit(USER_REGISTERED_EVENT, event);
  }

  private normalizeLoginEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private getLoginAttemptKey(email: string): string {
    return `auth:login_attempts:${email}`;
  }

  private getLoginLockKey(email: string): string {
    return `auth:login_lock:${email}`;
  }

  private getLoginLockDetail(secondsRemaining?: number): string {
    const minutes = Math.max(
      1,
      Math.ceil((secondsRemaining ?? LOGIN_LOCK_TTL_SECONDS) / 60),
    );
    return `Too many failed login attempts. Try again in ${minutes} minute(s).`;
  }

  private async assertLoginNotLocked(email: string): Promise<void> {
    const lockKey = this.getLoginLockKey(email);
    const locked = await this.redis.get(lockKey);
    if (!locked) {
      return;
    }

    const ttlSeconds = await this.redis.ttl(lockKey);
    throw new HttpException(
      {
        type: 'ACCOUNT_LOCKED',
        title: 'Account Locked',
        status: 423,
        detail: this.getLoginLockDetail(
          ttlSeconds > 0 ? ttlSeconds : undefined,
        ),
      },
      HttpStatus.LOCKED,
    );
  }

  private async recordFailedLoginAttempt(
    email: string,
  ): Promise<{ locked: boolean }> {
    const attemptKey = this.getLoginAttemptKey(email);
    const lockKey = this.getLoginLockKey(email);
    const attempts = await this.redis.incr(attemptKey);

    if (attempts === 1) {
      await this.redis.expire(attemptKey, LOGIN_LOCK_TTL_SECONDS);
    }

    if (attempts < LOGIN_LOCK_MAX_ATTEMPTS) {
      return { locked: false };
    }

    await this.redis.setex(lockKey, LOGIN_LOCK_TTL_SECONDS, '1');
    await this.redis.del(attemptKey);
    return { locked: true };
  }

  private async clearLoginLockState(email: string): Promise<void> {
    await this.redis.del(this.getLoginAttemptKey(email));
    await this.redis.del(this.getLoginLockKey(email));
  }

  private isLoginPortalAllowed(
    portal: LoginPortal | undefined,
    role: UserRole,
  ) {
    if (!portal) {
      return true;
    }

    if (portal === 'team') {
      return (
        role === UserRole.admin ||
        role === UserRole.staff ||
        role === UserRole.coach
      );
    }

    return role === UserRole.member;
  }

  private requiresEmailVerification(user: AuthenticatedUser): boolean {
    return user.status === UserStatus.pending || !user.email_verified_at;
  }

  private async assertPasswordResetPortalAllowed(
    identity: { user_id: string },
    portal: LoginPortal | undefined,
  ): Promise<void> {
    if (!portal) {
      return;
    }

    const user = await this.repo.findUserWithProfile(identity.user_id);
    if (!user || !this.isLoginPortalAllowed(portal, user.role)) {
      this.throwInvalidPortalCredentials();
    }
  }

  private throwInvalidPortalCredentials(): never {
    throw new UnauthorizedException({
      type: 'INVALID_CREDENTIALS',
      title: 'Invalid Credentials',
      status: 401,
      detail: 'Invalid credentials.',
    });
  }

  private async throwInvalidCredentials(email: string): Promise<never> {
    const { locked } = await this.recordFailedLoginAttempt(email);

    if (locked) {
      throw new HttpException(
        {
          type: 'ACCOUNT_LOCKED',
          title: 'Account Locked',
          status: 423,
          detail: this.getLoginLockDetail(LOGIN_LOCK_TTL_SECONDS),
        },
        HttpStatus.LOCKED,
      );
    }

    throw new UnauthorizedException({
      type: 'INVALID_CREDENTIALS',
      title: 'Invalid Credentials',
      status: 401,
      detail: 'Invalid credentials.',
    });
  }

  private async throwSafeInvalidCredentials(email: string): Promise<never> {
    try {
      return await this.throwInvalidCredentials(email);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'Login failed while updating the credential failure state.',
        error instanceof Error ? error.stack : String(error),
      );

      throw new UnauthorizedException({
        type: 'INVALID_CREDENTIALS',
        title: 'Invalid Credentials',
        status: 401,
        detail: 'Invalid credentials.',
      });
    }
  }

  private async handleLoginFailure(
    email: string,
    error: unknown,
  ): Promise<never> {
    if (error instanceof HttpException) {
      if (error instanceof NotFoundException) {
        return this.throwSafeInvalidCredentials(email);
      }

      throw error;
    }

    this.logger.error(
      'Login failed with an internal auth persistence error.',
      error instanceof Error ? error.stack : String(error),
    );

    return this.throwSafeInvalidCredentials(email);
  }

  private generateQrToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async requirePasswordIdentity(userId: string) {
    const identity = (await this.repo.findAllIdentitiesForUser(userId)).find(
      (item) => item.provider === AuthProvider.email && !!item.credential_hash,
    );
    const credentialHash = identity?.credential_hash;

    if (!identity || !credentialHash) {
      throw new UnauthorizedException({
        type: 'INVALID_CURRENT_PASSWORD',
        title: 'Invalid Current Password',
        status: 401,
        detail: 'Current password is incorrect.',
      });
    }

    return {
      ...identity,
      credential_hash: credentialHash,
    };
  }

  private async assertPasswordDoesNotReuseCurrent(
    credentialHash: string,
    nextPassword: string,
  ): Promise<void> {
    const reusesCurrentPassword = await bcrypt.compare(
      nextPassword,
      credentialHash,
    );

    if (reusesCurrentPassword) {
      this.throwPasswordReuseError();
    }
  }

  private throwPasswordReuseError(): never {
    throw new HttpException(
      {
        type: 'BUSINESS_RULE_VIOLATION',
        title: 'Password Reuse Not Allowed',
        status: 422,
        detail: 'Cannot change password to current password.',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
