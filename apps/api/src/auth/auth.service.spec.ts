import {
  ConflictException,
  ForbiddenException,
  GoneException,
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
    assertOtpValid: jest.fn(),
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

  it('rejects login for archived accounts', async () => {
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
        detail:
          'This account has been archived and can no longer access FitTrack.',
      },
    });

    await expect(
      service.login(
        { email: 'member@example.com', password: 'Password1!' },
        'device',
        '127.0.0.1',
      ),
    ).rejects.toThrow(GoneException);
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

  it('keeps resendOtp enumeration-safe when the user does not exist', async () => {
    repo.findUserById.mockResolvedValue(null);

    await expect(
      service.resendOtp({ user_id: 'missing-user-id' }),
    ).resolves.toBeUndefined();

    expect(otpService.issueOtp).not.toHaveBeenCalled();
  });

  it('creates staff accounts as active and verified without OTP', async () => {
    repo.findIdentity.mockResolvedValue(null);
    repo.createUserWithProfile.mockResolvedValue({ id: 'staff-1' });
    repo.markEmailIdentityVerified.mockResolvedValue({ count: 1 });

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
        status: UserStatus.active,
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
    expect(repo.markEmailIdentityVerified).toHaveBeenCalledWith('staff-1');
    expect(otpService.issueOtp).not.toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      USER_REGISTERED_EVENT,
      expect.objectContaining({
        userId: 'staff-1',
        role: UserRole.staff,
        source: 'admin_create',
      }),
    );
  });

  it('creates member accounts as pending and issues registration OTP', async () => {
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
    expect(otpService.issueOtp).toHaveBeenCalledWith(
      'member-1',
      'registration',
      'email',
      'member@example.com',
    );
    expect(eventEmitter.emit).not.toHaveBeenCalledWith(
      USER_REGISTERED_EVENT,
      expect.anything(),
    );
  });
});
