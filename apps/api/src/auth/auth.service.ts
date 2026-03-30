import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  HttpException,
  HttpStatus,
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
  InternalTokenPairResponse,
  JwtPayload,
} from './types/jwt-payload.type';
import { AuditAction, AuditEvent } from '../audit/audit.service';
import {
  RegisterDTO,
  VerifyEmailDTO,
  LoginDTO,
  PhoneLoginRequestDTO,
  PhoneLoginVerifyDTO,
  ForgotPasswordDTO,
  ResetPasswordDTO,
  VerifyPhoneDTO,
  AdminCreateUserDTO,
  ResendOtpDTO,
} from './dto/auth.dto';
import { AuthOtpService } from './otp/auth-otp.service';
import {
  USER_REGISTERED_EVENT,
  type UserRegisteredEvent,
} from './events/user-registered.event';

const PASSWORD_HASH_ROUNDS = 12;
const REFRESH_TTL_DAYS = 7;
const JTI_BLACKLIST_TTL = 900;

type NullableAuthenticatedUser = Awaited<
  ReturnType<AuthRepository['findUserWithProfile']>
>;

type AuthenticatedUser = Awaited<
  ReturnType<AuthRepository['findUserWithProfileOrThrow']>
>;

@Injectable()
export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly jwt: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly otpService: AuthOtpService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async register(dto: RegisterDTO): Promise<{ user_id: string }> {
    const existing = await this.repo.findIdentity(
      AuthProvider.email,
      dto.email,
    );
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
      email: dto.email,
      credentialHash,
      firstName: dto.first_name,
      lastName: dto.last_name,
      phone: dto.phone,
    });

    await this.otpService.issueOtp(
      user.id,
      OtpPurpose.registration,
      OtpChannel.email,
      dto.email,
    );

    return { user_id: user.id };
  }

  async verifyEmail(dto: VerifyEmailDTO): Promise<InternalTokenPairResponse> {
    await this.otpService.consumeOtp(
      dto.user_id,
      dto.code,
      OtpPurpose.registration,
    );

    const qrToken = this.generateQrToken();

    const user = await this.repo.updateUser(dto.user_id, {
      status: UserStatus.active,
      email_verified_at: new Date(),
      qr_code_token: qrToken,
    });

    await this.repo.markEmailIdentityVerified(dto.user_id);
    this.emitUserRegistered({
      userId: user.id,
      role: UserRole.member,
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
  ): Promise<InternalTokenPairResponse> {
    const identity = await this.repo.findIdentity(
      AuthProvider.email,
      dto.email,
    );
    if (!identity || !identity.credential_hash) {
      throw new UnauthorizedException({
        type: 'INVALID_CREDENTIALS',
        title: 'Invalid Credentials',
        status: 401,
        detail: 'Email or password is incorrect.',
      });
    }

    const user = this.requireActiveAuthUser(
      await this.repo.findUserWithProfile(identity.user_id),
    );

    const passwordMatch = await bcrypt.compare(
      dto.password,
      identity.credential_hash,
    );
    if (!passwordMatch) {
      throw new UnauthorizedException({
        type: 'INVALID_CREDENTIALS',
        title: 'Invalid Credentials',
        status: 401,
        detail: 'Email or password is incorrect.',
      });
    }

    return this.issueTokenPair(user, deviceInfo, ip);
  }

  async phoneLoginRequest(dto: PhoneLoginRequestDTO): Promise<void> {
    const identity = await this.repo.findIdentity(
      AuthProvider.phone,
      dto.phone,
    );
    if (!identity || !identity.verified_at) return;

    const user = await this.repo.findUserById(identity.user_id);
    if (!user || user.status !== UserStatus.active) return;

    await this.otpService.issueOtp(
      user.id,
      OtpPurpose.login_2fa,
      OtpChannel.sms,
      dto.phone,
    );
  }

  async phoneLoginVerify(
    dto: PhoneLoginVerifyDTO,
    deviceInfo: string,
    ip: string,
  ): Promise<InternalTokenPairResponse> {
    const identity = await this.repo.findIdentity(
      AuthProvider.phone,
      dto.phone,
    );

    if (!identity || !identity.verified_at) {
      throw new UnauthorizedException({
        type: 'INVALID_CREDENTIALS',
        title: 'Invalid Credentials',
        status: 401,
        detail: 'Phone number not registered or not verified.',
      });
    }

    const user = this.requireActiveAuthUser(
      await this.repo.findUserWithProfile(identity.user_id),
    );

    await this.otpService.consumeOtp(
      identity.user_id,
      dto.code,
      OtpPurpose.login_2fa,
    );

    return this.issueTokenPair(user, deviceInfo, ip);
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
    const identity = await this.repo.findIdentity(
      AuthProvider.email,
      dto.email,
    );
    if (!identity) return;

    await this.otpService.issueOtp(
      identity.user_id,
      OtpPurpose.password_reset,
      OtpChannel.email,
      dto.email,
    );
  }

  async resetPassword(dto: ResetPasswordDTO): Promise<void> {
    const identity = await this.repo.findIdentity(
      AuthProvider.email,
      dto.email,
    );
    if (!identity) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'Not Found',
        status: 404,
        detail: 'No account found with this email.',
      });
    }

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

  async sendPhoneOtp(userId: string): Promise<void> {
    const user = await this.repo.findUserWithProfileOrThrow(userId);
    const phone = this.requirePhoneNumber(user);

    await this.otpService.issueOtp(
      userId,
      OtpPurpose.phone_verify,
      OtpChannel.sms,
      phone,
    );
  }

  async verifyPhone(userId: string, dto: VerifyPhoneDTO): Promise<void> {
    const user = await this.repo.findUserWithProfileOrThrow(userId);
    const phone = this.requirePhoneNumber(user);

    await this.otpService.consumeOtp(userId, dto.code, OtpPurpose.phone_verify);

    await this.repo.updateUser(userId, { phone_verified_at: new Date() });
    await this.repo.upsertPhoneIdentity(userId, phone);

    this.emitAudit({
      userId,
      action: AuditAction.PHONE_VERIFIED,
      entity: 'User',
      entityId: userId,
      after: { phone },
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

  async adminCreateUser(
    dto: AdminCreateUserDTO,
    actorId: string,
    ip: string,
  ): Promise<{ user_id: string; email: string; role: string }> {
    const existing = await this.repo.findIdentity(
      AuthProvider.email,
      dto.email,
    );
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
      status: UserStatus.active,
      email: dto.email,
      credentialHash,
      firstName: dto.first_name,
      lastName: dto.last_name,
      phone: dto.phone,
      emailVerifiedAt: new Date(),
      qrCodeToken: this.generateQrToken(),
      createCoachProfile: dto.role === 'coach',
    });

    await this.repo.markEmailIdentityVerified(user.id);

    this.emitAudit({
      userId: actorId,
      action: AuditAction.USER_CREATED,
      entity: 'User',
      entityId: user.id,
      after: { email: dto.email, role: dto.role, createdBy: actorId },
      ipAddress: ip,
    });
    this.emitUserRegistered({
      userId: user.id,
      role: dto.role as UserRole,
      source: 'admin_create',
      registeredAt: new Date().toISOString(),
    });

    return { user_id: user.id, email: dto.email, role: dto.role };
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

    return {
      access_token: accessToken,
      _refresh_token: rawRefreshToken,
      user: {
        id: user.id,
        role: user.role,
        status: user.status,
        email_verified_at: user.email_verified_at?.toISOString() ?? null,
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
        detail: 'Account not found.',
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

  private requirePhoneNumber(user: AuthenticatedUser): string {
    if (!user.profile.phone) {
      throw new HttpException(
        {
          type: 'BUSINESS_RULE_VIOLATION',
          title: 'No Phone Number',
          status: 422,
          detail: 'Add a phone number to your profile before verifying.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return user.profile.phone;
  }

  private emitAudit(event: AuditEvent): void {
    this.eventEmitter.emit('audit.log', event);
  }

  private emitUserRegistered(event: UserRegisteredEvent): void {
    this.eventEmitter.emit(USER_REGISTERED_EVENT, event);
  }

  private generateQrToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
