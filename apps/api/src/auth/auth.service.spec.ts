import {
  ConflictException,
  ForbiddenException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthProvider, UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

import { USER_REGISTERED_EVENT } from './events/user-registered.event';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthOtpService } from './otp/auth-otp.service';
import { ACCOUNT_ACTIVITY_EVENT } from '../user/events/account-activity.event';

describe('AuthService', () => {
  let service: AuthService;

  const repo = {
    findIdentity: jest.fn(),
    createCoachProfile: jest.fn(),
    createUserWithProfile: jest.fn(),
    updateUser: jest.fn(),
    markEmailIdentityVerified: jest.fn(),
    findUserWithProfile: jest.fn(),
    findUserWithProfileOrThrow: jest.fn(),
    findUserByIdOrThrow: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshTokenByHash: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllUserRefreshTokens: jest.fn(),
    updateCredentialHash: jest.fn(),
    findUserById: jest.fn(),
    findAllIdentitiesForUser: jest.fn(),
    createIdentity: jest.fn(),
    backfillAvatar: jest.fn(),
    createUserFromGoogle: jest.fn(),
  };

  const jwt = {
    sign: jest.fn().mockReturnValue('access-token'),
  };

  const eventEmitter = {
    emit: jest.fn(),
    emitAsync: jest.fn().mockResolvedValue([]),
  };

  const otpService = {
    assertOtpValid: jest.fn(),
    issueOtp: jest.fn(),
    consumeOtp: jest.fn(),
  };

  const redis = {
    del: jest.fn(),
    expire: jest.fn(),
    get: jest.fn(),
    incr: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    ttl: jest.fn(),
  };

  beforeEach(async () => {
    const redisValues = new Map<string, string>();
    const redisTtls = new Map<string, number>();

    redis.get.mockImplementation((key: string) =>
      Promise.resolve(
        redisValues.has(key) ? (redisValues.get(key) ?? null) : null,
      ),
    );
    redis.ttl.mockImplementation((key: string) =>
      Promise.resolve(redisValues.has(key) ? (redisTtls.get(key) ?? -1) : -2),
    );
    redis.incr.mockImplementation((key: string) => {
      const next = Number(redisValues.get(key) ?? '0') + 1;
      redisValues.set(key, String(next));
      return Promise.resolve(next);
    });
    redis.expire.mockImplementation((key: string, ttl: number) => {
      if (!redisValues.has(key)) {
        return Promise.resolve(0);
      }
      redisTtls.set(key, ttl);
      return Promise.resolve(1);
    });
    redis.setex.mockImplementation(
      (key: string, ttl: number, value: string) => {
        redisValues.set(key, value);
        redisTtls.set(key, ttl);
        return Promise.resolve('OK');
      },
    );
    redis.del.mockImplementation((...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (redisValues.delete(key)) {
          deleted += 1;
        }
        redisTtls.delete(key);
      }
      return Promise.resolve(deleted);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: repo },
        { provide: JwtService, useValue: jwt },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: AuthOtpService, useValue: otpService },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  it('registers a pending member and delegates OTP issuance', async () => {
    repo.findIdentity.mockResolvedValue(null);
    repo.createUserWithProfile.mockResolvedValue({ id: 'user-1' });
    otpService.issueOtp.mockResolvedValue(undefined);

    const result = await service.register({
      email: 'member@example.com',
      password: 'Password1',
      first_name: 'Fit',
      last_name: 'Track',
      phone: '+639171234567',
    });

    expect(result).toEqual({ user_id: 'user-1' });
    expect(repo.createUserWithProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.member,
        status: UserStatus.pending,
        email: 'member@example.com',
      }),
    );
    expect(otpService.issueOtp).toHaveBeenCalledWith(
      'user-1',
      'registration',
      'email',
      'member@example.com',
    );
  });

  it('throws ConflictException when registering an existing email', async () => {
    repo.findIdentity.mockResolvedValue({ id: 'identity-1' });

    await expect(
      service.register({
        email: 'member@example.com',
        password: 'Password1',
        first_name: 'Fit',
        last_name: 'Track',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('emits a user-registered event when email verification activates the account', async () => {
    otpService.consumeOtp.mockResolvedValue(undefined);
    repo.findUserByIdOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
    });
    repo.updateUser.mockResolvedValue({ id: 'user-1', role: UserRole.member });
    repo.markEmailIdentityVerified.mockResolvedValue({ count: 1 });
    repo.findUserWithProfileOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      email_verified_at: new Date('2026-03-28T08:00:00.000Z'),
      profile: { first_name: 'Fit', last_name: 'Track', avatar_url: null },
    });

    await service.verifyEmail({ user_id: 'user-1', code: '123456' });

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      USER_REGISTERED_EVENT,
      expect.objectContaining({
        userId: 'user-1',
        role: UserRole.member,
        source: 'email_verification',
      }),
    );
  });

  it('rejects login with missing identity as unauthorized', async () => {
    repo.findIdentity.mockResolvedValue(null);

    await expect(
      service.login(
        { email: 'member@example.com', password: 'Password1' },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toThrow(UnauthorizedException);

    expect(redis.incr).toHaveBeenCalledWith(
      'auth:login_attempts:member@example.com',
    );
  });

  it('masks unexpected persistence errors during login', async () => {
    repo.findIdentity.mockRejectedValue(
      new Error('Invalid `prisma.user.findUnique()` invocation'),
    );

    await expect(
      service.login(
        { email: 'member@example.com', password: 'Password1' },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: {
        detail: 'Invalid credentials.',
      },
    });

    expect(redis.incr).toHaveBeenCalledWith(
      'auth:login_attempts:member@example.com',
    );
  });

  it('masks missing auth profile state during login', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      profile: null,
    });

    await expect(
      service.login(
        { email: 'member@example.com', password: 'Password1!' },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: {
        detail: 'Invalid credentials.',
      },
    });
  });

  it('locks login after the fifth invalid credential attempt', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('CorrectPassword1!', 4),
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      profile: { first_name: 'Fit', last_name: 'Track', avatar_url: null },
    });

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(
        service.login(
          { email: 'member@example.com', password: 'WrongPassword1!' },
          'device',
          '127.0.0.1',
        ),
      ).rejects.toThrow(UnauthorizedException);
    }

    await expect(
      service.login(
        { email: 'member@example.com', password: 'WrongPassword1!' },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: {
        status: HttpStatus.LOCKED,
        detail: 'Too many failed login attempts. Try again in 30 minute(s).',
      },
    });

    expect(redis.setex).toHaveBeenCalledWith(
      'auth:login_lock:member@example.com',
      1800,
      '1',
    );
    expect(redis.del).toHaveBeenCalledWith(
      'auth:login_attempts:member@example.com',
    );
  });

  it('rejects login while the account cooldown is still active', async () => {
    redis.get.mockResolvedValueOnce('1');
    redis.ttl.mockResolvedValueOnce(1200);

    await expect(
      service.login(
        { email: 'member@example.com', password: 'Password1!' },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: {
        status: HttpStatus.LOCKED,
        detail: 'Too many failed login attempts. Try again in 20 minute(s).',
      },
    });

    expect(repo.findIdentity).not.toHaveBeenCalled();
  });

  it('clears any stored login cooldown after a successful login', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      email_verified_at: new Date('2026-03-28T08:00:00.000Z'),
      profile: { first_name: 'Fit', last_name: 'Track', avatar_url: null },
    });
    repo.createRefreshToken.mockResolvedValue({
      id: 'refresh-1',
      token_hash: 'refresh-hash',
      expires_at: new Date(Date.now() + 86_400_000),
      revoked_at: null,
      user_id: 'user-1',
    });

    const result = await service.login(
      { email: 'member@example.com', password: 'Password1!' },
      'device',
      '127.0.0.1',
    );

    if ('otpRequired' in result) {
      throw new Error('Expected a token login response.');
    }
    expect(result.access_token).toBe('access-token');
    expect(result.user.id).toBe('user-1');

    expect(redis.del).toHaveBeenCalledWith(
      'auth:login_attempts:member@example.com',
    );
    expect(redis.del).toHaveBeenCalledWith(
      'auth:login_lock:member@example.com',
    );
  });

  it('sends a verification OTP and returns otpRequired for unverified login accounts', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'staff-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'staff-1',
      role: UserRole.staff,
      status: UserStatus.pending,
      email_verified_at: null,
      profile: { first_name: 'Staff', last_name: 'One', avatar_url: null },
    });
    otpService.issueOtp.mockResolvedValue(undefined);

    await expect(
      service.login(
        {
          email: 'Staff@Example.com',
          password: 'Password1!',
          portal: 'team',
        },
        'device',
        '127.0.0.1',
      ),
    ).resolves.toEqual({
      otpRequired: true,
      user_id: 'staff-1',
      email: 'staff@example.com',
      role: UserRole.staff,
    });

    expect(otpService.issueOtp).toHaveBeenCalledWith(
      'staff-1',
      'registration',
      'email',
      'staff@example.com',
    );
    expect(repo.createRefreshToken).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith(
      'auth:login_attempts:staff@example.com',
    );
    expect(redis.del).toHaveBeenCalledWith('auth:login_lock:staff@example.com');
  });

  it('rejects team-portal login attempts for member accounts with invalid-credential semantics', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      email_verified_at: new Date('2026-03-28T08:00:00.000Z'),
      profile: { first_name: 'Fit', last_name: 'Track', avatar_url: null },
    });

    await expect(
      service.login(
        {
          email: 'member@example.com',
          password: 'Password1!',
          portal: 'team',
        },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: {
        detail: 'Invalid credentials.',
      },
    });
  });

  it('rejects member-portal login attempts for team accounts with invalid-credential semantics', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'user-1',
      role: UserRole.staff,
      status: UserStatus.active,
      email_verified_at: new Date('2026-03-28T08:00:00.000Z'),
      profile: { first_name: 'Fit', last_name: 'Track', avatar_url: null },
    });

    await expect(
      service.login(
        {
          email: 'staff@example.com',
          password: 'Password1!',
          portal: 'member',
        },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: {
        detail: 'Invalid credentials.',
      },
    });
  });

  it('does not reveal suspended account state when the password is wrong', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.suspended,
      email_verified_at: new Date('2026-03-28T08:00:00.000Z'),
      profile: { first_name: 'Fit', last_name: 'Track', avatar_url: null },
    });

    await expect(
      service.login(
        { email: 'member@example.com', password: 'WrongPassword1!' },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: {
        detail: 'Invalid credentials.',
      },
    });
  });

  it('preserves invalid-credential semantics for archived accounts', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      deletedAt: new Date('2026-04-13T00:00:00.000Z'),
      profile: { first_name: 'Fit', last_name: 'Track', avatar_url: null },
    });

    await expect(
      service.login(
        { email: 'member@example.com', password: 'Password1!' },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({
      response: {
        detail: 'Invalid credentials.',
      },
    });

    await expect(
      service.login(
        { email: 'member@example.com', password: 'Password1!' },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('preserves forbidden semantics for suspended Google accounts', async () => {
    repo.findIdentity
      .mockResolvedValueOnce({
        id: 'google-identity-1',
        user_id: 'user-1',
        provider: AuthProvider.google,
      })
      .mockResolvedValueOnce(null);
    repo.findUserWithProfile.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.suspended,
      profile: { first_name: 'Fit', last_name: 'Track', avatar_url: null },
    });

    await expect(
      service.googleLogin(
        {
          google_id: 'google-1',
          email: 'member@example.com',
          first_name: 'Fit',
          last_name: 'Track',
          avatar_url: null,
        },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('emits a user-registered event when Google creates a brand-new account', async () => {
    repo.findIdentity.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    repo.createUserFromGoogle.mockResolvedValue({ id: 'user-2' });
    repo.findUserWithProfileOrThrow.mockResolvedValue({
      id: 'user-2',
      role: UserRole.member,
      status: UserStatus.active,
      email_verified_at: new Date('2026-03-28T08:00:00.000Z'),
      profile: { first_name: 'Fit', last_name: 'Track', avatar_url: null },
    });

    await service.googleLogin(
      {
        google_id: 'google-2',
        email: 'new@example.com',
        first_name: 'Fit',
        last_name: 'Track',
        avatar_url: null,
      },
      'device',
      '127.0.0.1',
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      USER_REGISTERED_EVENT,
      expect.objectContaining({
        userId: 'user-2',
        role: UserRole.member,
        source: 'google_login',
      }),
    );
  });

  it('revokes all sessions when a refresh token reuse is detected', async () => {
    repo.findRefreshTokenByHash.mockResolvedValue({
      id: 'refresh-1',
      user_id: 'user-1',
      revoked_at: new Date(),
      expires_at: new Date(Date.now() + 60_000),
    });

    await expect(service.refresh('raw-refresh-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(repo.revokeAllUserRefreshTokens).toHaveBeenCalledWith('user-1');
  });

  it('keeps forgot password enumeration-safe when no email identity exists', async () => {
    repo.findIdentity.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ email: 'missing@example.com' }),
    ).resolves.toBeUndefined();

    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('rejects member password resets from the team portal without issuing an OTP', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'member-1',
      provider: AuthProvider.email,
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'member-1',
      role: UserRole.member,
      status: UserStatus.active,
    });

    await expect(
      service.forgotPassword({
        email: 'member@example.com',
        portal: 'team',
      }),
    ).rejects.toMatchObject({
      response: {
        detail: 'Invalid credentials.',
      },
    });

    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('rejects team password resets from the member portal without issuing an OTP', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'staff-1',
      provider: AuthProvider.email,
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'staff-1',
      role: UserRole.staff,
      status: UserStatus.active,
    });

    await expect(
      service.forgotPassword({
        email: 'staff@example.com',
        portal: 'member',
      }),
    ).rejects.toMatchObject({
      response: {
        detail: 'Invalid credentials.',
      },
    });

    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('verifies the current password for authenticated email accounts', async () => {
    repo.findAllIdentitiesForUser.mockResolvedValue([
      {
        id: 'identity-1',
        user_id: 'user-1',
        provider: AuthProvider.email,
        credential_hash: await bcrypt.hash('Password1!', 4),
      },
    ]);

    await expect(
      service.verifyCurrentPassword('user-1', {
        current_password: 'Password1!',
      }),
    ).resolves.toBe(true);
  });

  it('verifies a password reset OTP without consuming it', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    otpService.assertOtpValid.mockResolvedValue(undefined);

    await expect(
      service.verifyResetOtp({
        email: 'member@example.com',
        code: '123456',
      }),
    ).resolves.toBe(true);

    expect(otpService.assertOtpValid).toHaveBeenCalledWith(
      'user-1',
      '123456',
      'password_reset',
    );
    expect(otpService.consumeOtp).not.toHaveBeenCalled();
  });

  it('rejects wrong-portal reset OTP checks before validating the OTP', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
    });

    await expect(
      service.verifyResetOtp({
        email: 'member@example.com',
        code: '123456',
        portal: 'team',
      }),
    ).rejects.toMatchObject({
      response: {
        detail: 'Invalid credentials.',
      },
    });

    expect(otpService.assertOtpValid).not.toHaveBeenCalled();
  });

  it('changes the password and revokes active refresh tokens', async () => {
    repo.findAllIdentitiesForUser.mockResolvedValue([
      {
        id: 'identity-1',
        user_id: 'user-1',
        provider: AuthProvider.email,
        credential_hash: await bcrypt.hash('Password1!', 4),
      },
    ]);
    repo.updateCredentialHash.mockResolvedValue({ count: 1 });
    repo.revokeAllUserRefreshTokens.mockResolvedValue({ count: 2 });

    await expect(
      service.changePassword('user-1', {
        current_password: 'Password1!',
        new_password: 'Password2!',
      }),
    ).resolves.toBeUndefined();

    expect(repo.updateCredentialHash).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
    );
    expect(repo.revokeAllUserRefreshTokens).toHaveBeenCalledWith('user-1');
  });

  it('rejects password changes that reuse the current password', async () => {
    repo.findAllIdentitiesForUser.mockResolvedValue([
      {
        id: 'identity-1',
        user_id: 'user-1',
        provider: AuthProvider.email,
        credential_hash: await bcrypt.hash('Password1!', 4),
      },
    ]);

    await expect(
      service.changePassword('user-1', {
        current_password: 'Password1!',
        new_password: 'Password1!',
      }),
    ).rejects.toMatchObject({
      response: {
        detail: 'Cannot change password to current password.',
      },
    });

    expect(repo.updateCredentialHash).not.toHaveBeenCalled();
  });

  it('rejects password resets that reuse the current password without consuming the OTP', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    otpService.assertOtpValid.mockResolvedValue(undefined);

    await expect(
      service.resetPassword({
        email: 'member@example.com',
        code: '123456',
        new_password: 'Password1!',
      }),
    ).rejects.toMatchObject({
      response: {
        detail: 'Cannot change password to current password.',
      },
    });

    expect(otpService.assertOtpValid).toHaveBeenCalledWith(
      'user-1',
      '123456',
      'password_reset',
    );
    expect(otpService.consumeOtp).not.toHaveBeenCalled();
    expect(repo.updateCredentialHash).not.toHaveBeenCalled();
  });

  it('resets the password, consumes the OTP, and revokes active refresh tokens', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'user-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    otpService.assertOtpValid.mockResolvedValue(undefined);
    otpService.consumeOtp.mockResolvedValue(undefined);
    repo.updateCredentialHash.mockResolvedValue({ count: 1 });
    repo.revokeAllUserRefreshTokens.mockResolvedValue({ count: 2 });

    await expect(
      service.resetPassword({
        email: 'member@example.com',
        code: '123456',
        new_password: 'Password2!',
      }),
    ).resolves.toBeUndefined();

    expect(otpService.assertOtpValid).toHaveBeenCalledWith(
      'user-1',
      '123456',
      'password_reset',
    );
    expect(otpService.consumeOtp).toHaveBeenCalledWith(
      'user-1',
      '123456',
      'password_reset',
    );
    expect(repo.updateCredentialHash).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
    );
    expect(repo.revokeAllUserRefreshTokens).toHaveBeenCalledWith('user-1');
  });

  it('rejects wrong-portal password resets before consuming the OTP', async () => {
    repo.findIdentity.mockResolvedValue({
      id: 'identity-1',
      user_id: 'staff-1',
      provider: AuthProvider.email,
      credential_hash: await bcrypt.hash('Password1!', 4),
    });
    repo.findUserWithProfile.mockResolvedValue({
      id: 'staff-1',
      role: UserRole.staff,
      status: UserStatus.active,
    });

    await expect(
      service.resetPassword({
        email: 'staff@example.com',
        code: '123456',
        new_password: 'Password2!',
        portal: 'member',
      }),
    ).rejects.toMatchObject({
      response: {
        detail: 'Invalid credentials.',
      },
    });

    expect(otpService.assertOtpValid).not.toHaveBeenCalled();
    expect(otpService.consumeOtp).not.toHaveBeenCalled();
    expect(repo.updateCredentialHash).not.toHaveBeenCalled();
  });

  it('keeps resendOtp enumeration-safe when the user does not exist', async () => {
    repo.findUserById.mockResolvedValue(null);

    await expect(
      service.resendOtp({ user_id: 'missing-user-id' }),
    ).resolves.toBeUndefined();

    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('creates admin accounts as pending without issuing registration OTP', async () => {
    repo.findIdentity.mockResolvedValue(null);
    repo.createUserWithProfile.mockResolvedValue({ id: 'admin-2' });

    const result = await service.adminCreateUser(
      {
        email: 'admin2@example.com',
        password: 'Password1!',
        first_name: 'Admin',
        last_name: 'Two',
        role: 'admin',
      },
      'admin-1',
      UserRole.admin,
      '127.0.0.1',
    );

    expect(result).toEqual({
      user_id: 'admin-2',
      email: 'admin2@example.com',
      role: 'admin',
    });
    expect(repo.createUserWithProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.admin,
        status: UserStatus.pending,
      }),
    );
    const createUserCalls = repo.createUserWithProfile.mock.calls as Array<
      [
        {
          emailVerifiedAt?: Date;
          qrCodeToken?: string;
        },
      ]
    >;
    const createUserArgs = createUserCalls[0]?.[0] as {
      emailVerifiedAt?: Date;
      qrCodeToken?: string;
    };
    expect(createUserArgs.emailVerifiedAt).toBeUndefined();
    expect(createUserArgs.qrCodeToken).toBeUndefined();
    expect(repo.markEmailIdentityVerified).not.toHaveBeenCalled();
    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('creates staff accounts as pending without issuing registration OTP', async () => {
    repo.findIdentity.mockResolvedValue(null);
    repo.createUserWithProfile.mockResolvedValue({ id: 'staff-1' });

    const result = await service.adminCreateUser(
      {
        email: 'staff@example.com',
        password: 'Password1!',
        first_name: 'Staff',
        last_name: 'One',
        role: 'staff',
        phone: '+639171234567',
      },
      'admin-1',
      UserRole.admin,
      '127.0.0.1',
    );

    expect(result).toEqual({
      user_id: 'staff-1',
      email: 'staff@example.com',
      role: 'staff',
    });
    expect(repo.createUserWithProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.staff,
        status: UserStatus.pending,
      }),
    );
    const createUserCalls = repo.createUserWithProfile.mock.calls as Array<
      [
        {
          emailVerifiedAt?: Date;
          qrCodeToken?: string;
        },
      ]
    >;
    const createUserArgs = createUserCalls[0]?.[0] as {
      emailVerifiedAt?: Date;
      qrCodeToken?: string;
    };
    expect(createUserArgs.emailVerifiedAt).toBeUndefined();
    expect(createUserArgs.qrCodeToken).toBeUndefined();
    expect(repo.markEmailIdentityVerified).not.toHaveBeenCalled();
    expect(otpService.issueOtp).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      USER_REGISTERED_EVENT,
      expect.anything(),
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      ACCOUNT_ACTIVITY_EVENT,
      expect.objectContaining({
        action: 'account_created',
        targetEmail: 'staff@example.com',
        targetName: 'Staff One',
        targetRole: 'staff',
        targetUserId: 'staff-1',
      }),
    );
  });

  it('creates member accounts as pending without issuing registration OTP', async () => {
    repo.findIdentity.mockResolvedValue(null);
    repo.createUserWithProfile.mockResolvedValue({ id: 'member-1' });

    const result = await service.adminCreateUser(
      {
        email: 'member@example.com',
        password: 'Password1!',
        first_name: 'Member',
        last_name: 'One',
        role: 'member',
      },
      'admin-1',
      UserRole.admin,
      '127.0.0.1',
    );

    expect(result).toEqual({
      user_id: 'member-1',
      email: 'member@example.com',
      role: 'member',
    });
    expect(repo.createUserWithProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.member,
        status: UserStatus.pending,
      }),
    );
    const createUserCalls = repo.createUserWithProfile.mock.calls as Array<
      [
        {
          emailVerifiedAt?: Date;
          qrCodeToken?: string;
        },
      ]
    >;
    const createUserArgs = createUserCalls[0]?.[0] as {
      emailVerifiedAt?: Date;
      qrCodeToken?: string;
    };
    expect(createUserArgs.emailVerifiedAt).toBeUndefined();
    expect(createUserArgs.qrCodeToken).toBeUndefined();
    expect(repo.markEmailIdentityVerified).not.toHaveBeenCalled();
    expect(otpService.issueOtp).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      USER_REGISTERED_EVENT,
      expect.anything(),
    );
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      ACCOUNT_ACTIVITY_EVENT,
      expect.objectContaining({
        action: 'account_created',
        targetEmail: 'member@example.com',
        targetName: 'Member One',
        targetRole: 'member',
        targetUserId: 'member-1',
      }),
    );
  });

  it('creates coach accounts with a coach profile without issuing registration OTP', async () => {
    repo.findIdentity.mockResolvedValue(null);
    repo.createUserWithProfile.mockResolvedValue({ id: 'coach-1' });
    repo.createCoachProfile.mockResolvedValue({ id: 'coach-profile-1' });

    const result = await service.adminCreateUser(
      {
        email: 'coach@example.com',
        password: 'Password1!',
        first_name: 'Coach',
        last_name: 'One',
        role: 'coach',
      },
      'admin-1',
      UserRole.admin,
      '127.0.0.1',
    );

    expect(result).toEqual({
      user_id: 'coach-1',
      email: 'coach@example.com',
      role: 'coach',
    });
    expect(repo.createUserWithProfile).toHaveBeenCalledWith(
      expect.objectContaining({
        role: UserRole.coach,
        status: UserStatus.pending,
      }),
    );
    expect(repo.createCoachProfile).toHaveBeenCalledWith('coach-1', {
      displayName: 'Coach One',
    });
    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('rejects staff attempts to create admin accounts', async () => {
    await expect(
      service.adminCreateUser(
        {
          email: 'admin@example.com',
          password: 'Password1!',
          first_name: 'Admin',
          last_name: 'Blocked',
          role: 'admin',
        },
        'staff-1',
        UserRole.staff,
        '127.0.0.1',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(repo.findIdentity).not.toHaveBeenCalled();
    expect(repo.createUserWithProfile).not.toHaveBeenCalled();
  });
});
