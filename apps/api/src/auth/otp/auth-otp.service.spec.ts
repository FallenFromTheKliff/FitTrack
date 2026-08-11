import { HttpException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { OtpChannel, OtpPurpose } from '@prisma/client';

import { AuthRepository } from '../auth.repository';
import { QUEUE_MAIL } from '../../queue/queue.constants';
import { AuthOtpService } from './auth-otp.service';
import {
  OTP_HASH_ROUNDS,
  REGISTRATION_CHALLENGE_LOCK_SECONDS,
  REGISTRATION_CHALLENGE_TTL_SECONDS,
} from './otp.constants';

describe('AuthOtpService', () => {
  let service: AuthOtpService;

  type RedisSetexCall = [key: string, ttl: number, value: string];

  const repo = {
    findLatestOtp: jest.fn(),
    createOtp: jest.fn(),
    updateOtp: jest.fn(),
  };

  const mailQueue = {
    add: jest.fn(),
  };

  let redisValues = new Map<string, string>();
  let redisTtls = new Map<string, number>();
  const redis = {
    del: jest.fn(),
    eval: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    ttl: jest.fn(),
  };

  beforeEach(async () => {
    redisValues = new Map();
    redisTtls = new Map();

    redis.get.mockImplementation((key: string) =>
      Promise.resolve(redisValues.get(key) ?? null),
    );
    redis.ttl.mockImplementation((key: string) =>
      Promise.resolve(redisValues.has(key) ? (redisTtls.get(key) ?? -1) : -2),
    );
    redis.setex.mockImplementation(
      (key: string, ttl: number, value: string) => {
        redisValues.set(key, value);
        redisTtls.set(key, ttl);
        return Promise.resolve('OK');
      },
    );
    redis.set.mockImplementation(
      (key: string, value: string, ...args: Array<string | number>) => {
        if (args.includes('NX') && redisValues.has(key)) {
          return Promise.resolve(null);
        }
        redisValues.set(key, value);
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
    redis.eval.mockImplementation(
      (_script: string, _keyCount: number, key: string, token: string) => {
        if (redisValues.get(key) !== token) {
          return Promise.resolve(0);
        }
        redisValues.delete(key);
        redisTtls.delete(key);
        return Promise.resolve(1);
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthOtpService,
        { provide: AuthRepository, useValue: repo },
        { provide: getQueueToken(QUEUE_MAIL), useValue: mailQueue },
        { provide: 'default_IORedisModuleConnectionToken', useValue: redis },
      ],
    }).compile();

    service = module.get<AuthOtpService>(AuthOtpService);
    jest.clearAllMocks();
    mailQueue.add.mockResolvedValue(undefined);
  });

  it('issues an email OTP and enqueues the mail job', async () => {
    repo.findLatestOtp.mockResolvedValue(null);
    repo.createOtp.mockResolvedValue({ id: 'otp-1' });

    await service.issueOtp(
      'user-1',
      OtpPurpose.registration,
      OtpChannel.email,
      'member@example.com',
    );

    expect(repo.createOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: OtpChannel.email,
        purpose: OtpPurpose.registration,
      }),
    );
    expect(mailQueue.add).toHaveBeenCalledWith(
      'send-otp',
      expect.objectContaining({
        to: 'member@example.com',
        purpose: OtpPurpose.registration,
      }),
      expect.any(Object),
    );
  });

  it('surfaces OTP email queue failures with an explicit service error', async () => {
    repo.findLatestOtp.mockResolvedValue(null);
    repo.createOtp.mockResolvedValue({ id: 'otp-1' });
    mailQueue.add.mockRejectedValue(new Error('Redis unavailable'));

    await expect(
      service.issueOtp(
        'user-1',
        OtpPurpose.registration,
        OtpChannel.email,
        'member@example.com',
      ),
    ).rejects.toMatchObject({
      response: {
        type: 'OTP_DELIVERY_QUEUE_UNAVAILABLE',
        status: 503,
      },
      status: 503,
    });
  });

  it('rejects SMS OTP issuance because the feature has been removed', async () => {
    await expect(
      service.issueOtp(
        'user-1',
        OtpPurpose.phone_verify,
        OtpChannel.sms,
        '+639171234567',
      ),
    ).rejects.toThrow(HttpException);

    expect(repo.findLatestOtp).not.toHaveBeenCalled();
    expect(repo.createOtp).not.toHaveBeenCalled();
    expect(mailQueue.add).not.toHaveBeenCalled();
  });

  it('rejects OTP issuance when the latest OTP is locked', async () => {
    repo.findLatestOtp.mockResolvedValue({
      locked_until: new Date(Date.now() + 60_000),
    });

    await expect(
      service.issueOtp(
        'user-1',
        OtpPurpose.registration,
        OtpChannel.email,
        'member@example.com',
      ),
    ).rejects.toThrow(HttpException);

    expect(repo.createOtp).not.toHaveBeenCalled();
    expect(mailQueue.add).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when consuming a missing OTP', async () => {
    repo.findLatestOtp.mockResolvedValue(null);

    await expect(
      service.consumeOtp('user-1', '123456', OtpPurpose.registration),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects expired OTPs', async () => {
    repo.findLatestOtp.mockResolvedValue({
      id: 'otp-1',
      attempts: 0,
      code_hash: 'ignored',
      expires_at: new Date(Date.now() - 60_000),
      locked_until: null,
      consumed_at: null,
    });

    await expect(
      service.consumeOtp('user-1', '123456', OtpPurpose.registration),
    ).rejects.toThrow(HttpException);

    expect(repo.updateOtp).not.toHaveBeenCalled();
  });

  it('rejects already consumed OTPs', async () => {
    repo.findLatestOtp.mockResolvedValue({
      id: 'otp-1',
      attempts: 0,
      code_hash: 'ignored',
      expires_at: new Date(Date.now() + 60_000),
      locked_until: null,
      consumed_at: new Date(),
    });

    await expect(
      service.consumeOtp('user-1', '123456', OtpPurpose.registration),
    ).rejects.toThrow(HttpException);

    expect(repo.updateOtp).not.toHaveBeenCalled();
  });

  it('increments invalid OTP attempts without locking before the final attempt', async () => {
    repo.findLatestOtp.mockResolvedValue({
      id: 'otp-1',
      attempts: 1,
      code_hash: '$2b$12$invalidhashfortest12345678901234567890123456789012345',
      expires_at: new Date(Date.now() + 60_000),
      locked_until: null,
      consumed_at: null,
    });
    repo.updateOtp.mockResolvedValue({});

    await expect(
      service.consumeOtp('user-1', '111111', OtpPurpose.phone_verify),
    ).rejects.toThrow(HttpException);

    const updateOtpCalls = repo.updateOtp.mock.calls as Array<
      [string, { attempts?: number; locked_until?: Date | null }]
    >;
    const [, updateOtpData] = updateOtpCalls[0] ?? [];
    expect(repo.updateOtp).toHaveBeenCalledWith('otp-1', updateOtpData);
    expect(updateOtpData).toMatchObject({ attempts: 2 });
    expect(updateOtpData?.locked_until).toBeUndefined();
  });

  it('locks OTP after the third invalid attempt', async () => {
    repo.findLatestOtp.mockResolvedValue({
      id: 'otp-1',
      attempts: 2,
      code_hash: '$2b$12$invalidhashfortest12345678901234567890123456789012345',
      expires_at: new Date(Date.now() + 60_000),
      locked_until: null,
      consumed_at: null,
    });
    repo.updateOtp.mockResolvedValue({});

    await expect(
      service.consumeOtp('user-1', '111111', OtpPurpose.phone_verify),
    ).rejects.toThrow(HttpException);

    const updateOtpCalls = repo.updateOtp.mock.calls as Array<
      [string, { attempts?: number; locked_until?: Date | null }]
    >;
    const [, updateOtpData] = updateOtpCalls[0] ?? [];
    expect(repo.updateOtp).toHaveBeenCalledWith('otp-1', updateOtpData);
    expect(updateOtpData).toMatchObject({ attempts: 3 });
    expect(updateOtpData?.locked_until).toBeInstanceOf(Date);
  });

  it('validates a correct OTP without consuming it when using assertOtpValid', async () => {
    const codeHash = await bcrypt.hash('123456', OTP_HASH_ROUNDS);
    repo.findLatestOtp.mockResolvedValue({
      id: 'otp-1',
      attempts: 0,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 60_000),
      locked_until: null,
      consumed_at: null,
    });

    await expect(
      service.assertOtpValid('user-1', '123456', OtpPurpose.password_reset),
    ).resolves.toMatchObject({ id: 'otp-1' });

    expect(repo.updateOtp).not.toHaveBeenCalled();
  });

  it('marks OTP as consumed when the code is valid', async () => {
    const codeHash = await bcrypt.hash('123456', OTP_HASH_ROUNDS);
    repo.findLatestOtp.mockResolvedValue({
      id: 'otp-1',
      attempts: 0,
      code_hash: codeHash,
      expires_at: new Date(Date.now() + 60_000),
      locked_until: null,
      consumed_at: null,
    });
    repo.updateOtp.mockResolvedValue({});

    await expect(
      service.consumeOtp('user-1', '123456', OtpPurpose.registration),
    ).resolves.toBeUndefined();

    const updateOtpCalls = repo.updateOtp.mock.calls as Array<
      [string, { consumed_at?: Date | null }]
    >;
    const [, updateOtpData] = updateOtpCalls[0] ?? [];

    expect(repo.updateOtp).toHaveBeenCalledWith('otp-1', updateOtpData);
    expect(updateOtpData?.consumed_at).toBeInstanceOf(Date);
  });

  it('stores a registration challenge without password or raw OTP material', async () => {
    await service.startRegistrationChallenge('challenge-1', {
      acceptedPrivacyAt: new Date().toISOString(),
      credentialHash: 'bcrypt-password-hash',
      email: 'member@example.com',
      firstName: 'Fit',
      lastName: 'Track',
      phone: '+639171234567',
    });

    const challengeCall = (redis.setex.mock.calls as RedisSetexCall[]).find(
      ([key]) => key === 'auth:registration:challenge:challenge-1',
    );
    expect(challengeCall).toBeDefined();
    const stored = JSON.parse(String(challengeCall?.[2])) as Record<
      string,
      unknown
    >;

    expect(challengeCall?.[1]).toBe(REGISTRATION_CHALLENGE_TTL_SECONDS);
    expect(stored.credentialHash).toBe('bcrypt-password-hash');
    expect(stored).not.toHaveProperty('password');
    expect(stored.otpHash).toEqual(expect.any(String));
    expect(stored).not.toHaveProperty('otp');
    expect(mailQueue.add).toHaveBeenCalledWith(
      'send-otp',
      expect.objectContaining({
        purpose: OtpPurpose.registration,
        to: 'member@example.com',
      }),
      expect.any(Object),
    );
  });

  it('keeps the challenge available when the mail provider fails', async () => {
    mailQueue.add.mockRejectedValue(new Error('mail provider unavailable'));

    await expect(
      service.startRegistrationChallenge('challenge-provider-failure', {
        acceptedPrivacyAt: new Date().toISOString(),
        credentialHash: 'bcrypt-password-hash',
        email: 'member@example.com',
        firstName: 'Fit',
        lastName: 'Track',
      }),
    ).rejects.toMatchObject({
      response: {
        type: 'OTP_DELIVERY_QUEUE_UNAVAILABLE',
        status: 503,
      },
    });

    expect(
      redisValues.has('auth:registration:challenge:challenge-provider-failure'),
    ).toBe(true);
  });

  it('returns a safe expired response for malformed or expired challenges', async () => {
    redisValues.set('auth:registration:challenge:malformed', '{not-json');

    await expect(
      service.completeRegistrationChallenge('malformed', '123456', () =>
        Promise.resolve('should-not-complete'),
      ),
    ).rejects.toMatchObject({
      response: {
        type: 'REGISTRATION_CHALLENGE_EXPIRED',
        status: 422,
      },
    });

    redisValues.set(
      'auth:registration:challenge:expired',
      JSON.stringify({
        acceptedPrivacyAt: new Date().toISOString(),
        credentialHash: 'bcrypt-password-hash',
        email: 'member@example.com',
        firstName: 'Fit',
        lastName: 'Track',
        otpHash: await bcrypt.hash('123456', 4),
        otpExpiresAt: new Date(Date.now() - 1_000).toISOString(),
        attempts: 0,
      }),
    );

    await expect(
      service.completeRegistrationChallenge('expired', '123456', () =>
        Promise.resolve('should-not-complete'),
      ),
    ).rejects.toMatchObject({
      response: {
        type: 'REGISTRATION_CHALLENGE_EXPIRED',
        status: 422,
      },
    });
  });

  it('locks the normalized registration identity after five wrong codes and blocks resend', async () => {
    const challengeId = 'challenge-lock';
    redisValues.set(
      `auth:registration:challenge:${challengeId}`,
      JSON.stringify({
        acceptedPrivacyAt: new Date().toISOString(),
        credentialHash: 'bcrypt-password-hash',
        email: 'member@example.com',
        firstName: 'Fit',
        lastName: 'Track',
        phone: '+639171234567',
        otpHash: await bcrypt.hash('123456', 4),
        otpExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        attempts: 0,
      }),
    );

    for (let attempt = 1; attempt < 5; attempt += 1) {
      await expect(
        service.completeRegistrationChallenge(challengeId, '000000', () =>
          Promise.resolve('should-not-complete'),
        ),
      ).rejects.toMatchObject({
        response: {
          type: 'REGISTRATION_OTP_INVALID',
          status: 422,
        },
      });
    }

    await expect(
      service.completeRegistrationChallenge(challengeId, '000000', () =>
        Promise.resolve('should-not-complete'),
      ),
    ).rejects.toMatchObject({
      response: {
        type: 'REGISTRATION_OTP_LOCKED',
        status: 423,
        retry_after_seconds: REGISTRATION_CHALLENGE_LOCK_SECONDS,
      },
    });

    await expect(
      service.resendRegistrationChallenge(challengeId),
    ).rejects.toMatchObject({
      response: {
        type: 'REGISTRATION_OTP_LOCKED',
        status: 423,
      },
    });

    await expect(
      service.startRegistrationChallenge('challenge-bypass', {
        acceptedPrivacyAt: new Date().toISOString(),
        credentialHash: 'bcrypt-password-hash',
        email: 'member@example.com',
        firstName: 'Fit',
        lastName: 'Track',
        phone: '+639171234567',
      }),
    ).rejects.toMatchObject({
      response: {
        type: 'REGISTRATION_OTP_LOCKED',
        status: 423,
      },
    });
  });

  it('carries failed attempts into a replacement challenge', async () => {
    const payload = {
      acceptedPrivacyAt: new Date().toISOString(),
      credentialHash: 'bcrypt-password-hash',
      email: 'member@example.com',
      firstName: 'Fit',
      lastName: 'Track',
      phone: '+639171234567',
    };

    await service.startRegistrationChallenge('challenge-first', payload);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(
        service.completeRegistrationChallenge('challenge-first', '000000', () =>
          Promise.resolve('should-not-complete'),
        ),
      ).rejects.toMatchObject({
        response: {
          type: 'REGISTRATION_OTP_INVALID',
          status: 422,
        },
      });
    }

    await service.startRegistrationChallenge('challenge-replacement', payload);

    const replacement = JSON.parse(
      String(
        redisValues.get('auth:registration:challenge:challenge-replacement'),
      ),
    ) as { attempts: number };

    expect(replacement.attempts).toBe(4);

    await expect(
      service.completeRegistrationChallenge(
        'challenge-replacement',
        '000000',
        () => Promise.resolve('should-not-complete'),
      ),
    ).rejects.toMatchObject({
      response: {
        type: 'REGISTRATION_OTP_LOCKED',
        status: 423,
      },
    });
  });

  it('consumes a valid challenge once and makes replay safe', async () => {
    const challengeId = 'challenge-replay';
    redisValues.set(
      `auth:registration:challenge:${challengeId}`,
      JSON.stringify({
        acceptedPrivacyAt: new Date().toISOString(),
        credentialHash: 'bcrypt-password-hash',
        email: 'member@example.com',
        firstName: 'Fit',
        lastName: 'Track',
        otpHash: await bcrypt.hash('123456', 4),
        otpExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        attempts: 0,
      }),
    );

    const complete = jest.fn().mockResolvedValue('user-1');

    await expect(
      service.completeRegistrationChallenge(challengeId, '123456', complete),
    ).resolves.toBe('user-1');
    await expect(
      service.completeRegistrationChallenge(challengeId, '123456', complete),
    ).rejects.toMatchObject({
      response: {
        type: 'REGISTRATION_CHALLENGE_COMPLETED',
        status: 422,
      },
    });

    expect(complete).toHaveBeenCalledTimes(1);
    expect(redisValues.get(`auth:registration:completed:${challengeId}`)).toBe(
      '1',
    );
    expect(redisValues.has(`auth:registration:challenge:${challengeId}`)).toBe(
      false,
    );
  });
});
