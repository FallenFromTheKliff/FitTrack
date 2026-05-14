import { HttpException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { OtpChannel, OtpPurpose } from '@prisma/client';

import { AuthRepository } from '../auth.repository';
import { QUEUE_MAIL } from '../../queue/queue.constants';
import { AuthOtpService } from './auth-otp.service';
import { OTP_HASH_ROUNDS } from './otp.constants';

describe('AuthOtpService', () => {
  let service: AuthOtpService;

  const repo = {
    findLatestOtp: jest.fn(),
    createOtp: jest.fn(),
    updateOtp: jest.fn(),
  };

  const mailQueue = {
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthOtpService,
        { provide: AuthRepository, useValue: repo },
        { provide: getQueueToken(QUEUE_MAIL), useValue: mailQueue },
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
      response: expect.objectContaining({
        type: 'OTP_DELIVERY_QUEUE_UNAVAILABLE',
        status: 503,
      }),
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
});
