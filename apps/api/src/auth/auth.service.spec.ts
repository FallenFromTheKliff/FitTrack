import {
  ConflictException,
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AuthProvider, UserRole, UserStatus } from '@prisma/client';

import { USER_REGISTERED_EVENT } from './events/user-registered.event';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthOtpService } from './otp/auth-otp.service';

describe('AuthService', () => {
  let service: AuthService;

  const repo = {
    findIdentity: jest.fn(),
    createUserWithProfile: jest.fn(),
    updateUser: jest.fn(),
    markEmailIdentityVerified: jest.fn(),
    findUserWithProfile: jest.fn(),
    findUserWithProfileOrThrow: jest.fn(),
    createRefreshToken: jest.fn(),
    findRefreshTokenByHash: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeAllUserRefreshTokens: jest.fn(),
    updateCredentialHash: jest.fn(),
    upsertPhoneIdentity: jest.fn(),
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
  };

  const otpService = {
    issueOtp: jest.fn(),
    consumeOtp: jest.fn(),
  };

  const redis = {
    setex: jest.fn(),
  };

  beforeEach(async () => {
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
    repo.updateUser.mockResolvedValue({ id: 'user-1' });
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

  it('rejects sendPhoneOtp when the required phone number is missing', async () => {
    repo.findUserWithProfileOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      profile: {
        first_name: 'Fit',
        last_name: 'Track',
        phone: null,
        avatar_url: null,
      },
    });

    await expect(service.sendPhoneOtp('user-1')).rejects.toThrow(HttpException);
    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('verifies phone and links the phone identity', async () => {
    repo.findUserWithProfileOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      profile: {
        first_name: 'Fit',
        last_name: 'Track',
        phone: '+639171234567',
        avatar_url: null,
      },
    });
    otpService.consumeOtp.mockResolvedValue(undefined);
    repo.updateUser.mockResolvedValue({});
    repo.upsertPhoneIdentity.mockResolvedValue({});

    await service.verifyPhone('user-1', { code: '123456' });

    expect(otpService.consumeOtp).toHaveBeenCalledWith(
      'user-1',
      '123456',
      'phone_verify',
    );
    const updateUserCalls = repo.updateUser.mock.calls as Array<
      [string, { phone_verified_at?: Date | null }]
    >;
    const [, updateUserData] = updateUserCalls[0] ?? [];

    expect(repo.updateUser).toHaveBeenCalledWith('user-1', updateUserData);
    expect(updateUserData?.phone_verified_at).toBeInstanceOf(Date);
    expect(repo.upsertPhoneIdentity).toHaveBeenCalledWith(
      'user-1',
      '+639171234567',
    );
  });

  it('does not consume phone OTP when the required phone number is missing', async () => {
    repo.findUserWithProfileOrThrow.mockResolvedValue({
      id: 'user-1',
      role: UserRole.member,
      status: UserStatus.active,
      profile: {
        first_name: 'Fit',
        last_name: 'Track',
        phone: null,
        avatar_url: null,
      },
    });

    await expect(
      service.verifyPhone('user-1', { code: '123456' }),
    ).rejects.toThrow(HttpException);
    expect(otpService.consumeOtp).not.toHaveBeenCalled();
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

  it('keeps phone login request enumeration-safe when no phone identity exists', async () => {
    repo.findIdentity.mockResolvedValue(null);

    await expect(
      service.phoneLoginRequest({ phone: '+639171234567' }),
    ).resolves.toBeUndefined();

    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('keeps forgot password enumeration-safe when no email identity exists', async () => {
    repo.findIdentity.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ email: 'missing@example.com' }),
    ).resolves.toBeUndefined();

    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('keeps resendOtp enumeration-safe when the user does not exist', async () => {
    repo.findUserById.mockResolvedValue(null);

    await expect(
      service.resendOtp({ user_id: 'missing-user-id' }),
    ).resolves.toBeUndefined();

    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('creates coach accounts atomically through createUserWithProfile flags', async () => {
    repo.findIdentity.mockResolvedValue(null);
    repo.createUserWithProfile.mockResolvedValue({ id: 'coach-1' });
    repo.markEmailIdentityVerified.mockResolvedValue({ count: 1 });

    const result = await service.adminCreateUser(
      {
        email: 'coach@example.com',
        password: 'Password1',
        first_name: 'Coach',
        last_name: 'One',
        role: 'coach',
        phone: '+639171234567',
      },
      'admin-1',
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
        status: UserStatus.active,
        createCoachProfile: true,
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
    expect(createUserArgs.emailVerifiedAt).toBeInstanceOf(Date);
    expect(createUserArgs.qrCodeToken).toMatch(/^[a-f0-9]{64}$/);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      USER_REGISTERED_EVENT,
      expect.objectContaining({
        userId: 'coach-1',
        role: UserRole.coach,
        source: 'admin_create',
      }),
    );
  });
});
