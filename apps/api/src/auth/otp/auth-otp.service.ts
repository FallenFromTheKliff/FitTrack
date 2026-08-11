import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as bcrypt from 'bcrypt';
import { OtpChannel, OtpPurpose } from '@prisma/client';
import Redis from 'ioredis';
import * as crypto from 'crypto';

import { AuthRepository } from '../auth.repository';
import { QUEUE_MAIL } from '../../queue/queue.constants';
import {
  OTP_EXPIRY_MINUTES,
  OTP_HASH_ROUNDS,
  OTP_LOCK_MINUTES,
  OTP_MAX_ATTEMPTS,
  REGISTRATION_CHALLENGE_COMPLETED_TTL_SECONDS,
  REGISTRATION_CHALLENGE_LOCK_SECONDS,
  REGISTRATION_CHALLENGE_MAX_ATTEMPTS,
  REGISTRATION_CHALLENGE_PROCESSING_SECONDS,
  REGISTRATION_CHALLENGE_TTL_SECONDS,
} from './otp.constants';

export interface RegistrationChallengePayload {
  acceptedPrivacyAt: string;
  credentialHash: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

interface StoredRegistrationChallenge extends RegistrationChallengePayload {
  attempts: number;
  lockedUntil?: string;
  otpExpiresAt: string;
  otpHash: string;
}

interface ChallengeOtpState {
  codeHash: string;
  expiresAt: Date;
}

@Injectable()
export class AuthOtpService {
  private readonly logger = new Logger(AuthOtpService.name);

  constructor(
    private readonly repo: AuthRepository,
    @InjectQueue(QUEUE_MAIL) private readonly mailQueue: Queue,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  async startRegistrationChallenge(
    challengeId: string,
    payload: RegistrationChallengePayload,
  ): Promise<void> {
    await this.assertRegistrationIdentityNotLocked(
      payload.email,
      payload.phone,
    );
    const previousAttempts = await this.getActiveRegistrationAttempts(
      payload.email,
      payload.phone,
    );

    await this.issueRegistrationChallengeOtp(
      payload.email,
      async ({ codeHash, expiresAt }) => {
        await this.persistRegistrationChallenge(
          challengeId,
          {
            ...payload,
            attempts: previousAttempts,
            otpHash: codeHash,
            otpExpiresAt: expiresAt.toISOString(),
          },
          REGISTRATION_CHALLENGE_TTL_SECONDS,
        );
      },
    );

    await this.activateRegistrationChallenge(
      challengeId,
      payload.email,
      payload.phone,
    );
  }

  async hasRegistrationChallenge(challengeId: string): Promise<boolean> {
    const raw = await this.readRegistrationChallenge(challengeId);
    if (raw !== null) {
      return true;
    }

    return (await this.readRegistrationChallengeMarker(challengeId)) === '1';
  }

  async resendRegistrationChallenge(challengeId: string): Promise<boolean> {
    if ((await this.readRegistrationChallengeMarker(challengeId)) === '1') {
      return true;
    }

    const raw = await this.readRegistrationChallenge(challengeId);
    if (raw === null) {
      return false;
    }

    const parsed = this.parseRegistrationChallenge(raw);
    if (!parsed) {
      await this.bestEffortDeleteRegistrationChallenge(challengeId);
      return true;
    }

    const lockToken = await this.acquireRegistrationChallengeLock(challengeId);
    if (!lockToken) {
      this.throwRegistrationChallengeBusy();
    }

    try {
      const current = await this.getRegistrationChallengeOrNull(challengeId);
      if (!current) {
        return true;
      }

      if (await this.isReplacedRegistrationChallenge(challengeId, current)) {
        return true;
      }

      const retryAfter = await this.getRegistrationLockSeconds(current);
      if (retryAfter !== null) {
        this.throwRegistrationChallengeLocked(retryAfter);
      }

      await this.issueRegistrationChallengeOtp(
        current.email,
        async ({ codeHash, expiresAt }) => {
          await this.persistRegistrationChallenge(
            challengeId,
            {
              ...current,
              lockedUntil: undefined,
              otpHash: codeHash,
              otpExpiresAt: expiresAt.toISOString(),
            },
            REGISTRATION_CHALLENGE_TTL_SECONDS,
          );
        },
      );

      return true;
    } finally {
      await this.releaseRegistrationChallengeLock(challengeId, lockToken);
    }
  }

  async completeRegistrationChallenge<T>(
    challengeId: string,
    rawCode: string,
    complete: (payload: RegistrationChallengePayload) => Promise<T>,
  ): Promise<T> {
    if ((await this.readRegistrationChallengeMarker(challengeId)) === '1') {
      this.throwRegistrationChallengeCompleted();
    }

    if ((await this.readRegistrationChallenge(challengeId)) === null) {
      this.throwRegistrationChallengeExpired();
    }

    const lockToken = await this.acquireRegistrationChallengeLock(challengeId);
    if (!lockToken) {
      this.throwRegistrationChallengeBusy();
    }

    try {
      const challenge = await this.getRegistrationChallengeOrNull(challengeId);
      if (!challenge) {
        this.throwRegistrationChallengeExpired();
      }

      if (await this.isReplacedRegistrationChallenge(challengeId, challenge)) {
        this.throwRegistrationChallengeExpired();
      }

      const retryAfter = await this.getRegistrationLockSeconds(challenge);
      if (retryAfter !== null) {
        this.throwRegistrationChallengeLocked(retryAfter);
      }

      if (new Date(challenge.otpExpiresAt).getTime() <= Date.now()) {
        await this.bestEffortDeleteRegistrationChallenge(challengeId);
        this.throwRegistrationChallengeExpired();
      }

      let validCode = false;
      try {
        validCode = await bcrypt.compare(rawCode, challenge.otpHash);
      } catch {
        await this.bestEffortDeleteRegistrationChallenge(challengeId);
        this.throwRegistrationChallengeExpired();
      }

      if (!validCode) {
        await this.recordRegistrationChallengeFailure(challengeId, challenge);
      }

      const result = await complete(challenge);
      await this.consumeRegistrationChallenge(challengeId, challenge);
      return result;
    } finally {
      await this.releaseRegistrationChallengeLock(challengeId, lockToken);
    }
  }

  async discardRegistrationChallenge(challengeId: string): Promise<void> {
    try {
      await this.markRegistrationChallengeCompleted(challengeId);
      const challenge = await this.getRegistrationChallengeOrNull(challengeId);
      await this.deleteRegistrationChallenge(challengeId);
      if (challenge) {
        await this.clearActiveRegistrationChallenge(challengeId, challenge);
      }
    } catch (error) {
      this.logger.error(
        'Failed to discard a registration challenge after a commit conflict.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async issueOtp(
    userId: string,
    purpose: OtpPurpose,
    channel: OtpChannel,
    destination: string,
  ): Promise<void> {
    if (channel !== OtpChannel.email) {
      throw new HttpException(
        {
          type: 'FEATURE_REMOVED',
          title: 'SMS OTP Removed',
          status: HttpStatus.GONE,
          detail:
            'SMS OTP delivery has been removed. Use email-based OTP flows instead.',
        },
        HttpStatus.GONE,
      );
    }

    const latest = await this.repo.findLatestOtp(userId, purpose);

    if (latest?.locked_until && latest.locked_until > new Date()) {
      const mins = Math.ceil(
        (latest.locked_until.getTime() - Date.now()) / 60000,
      );
      throw new HttpException(
        {
          type: 'OTP_LOCKED',
          title: 'Too Many Attempts',
          status: HttpStatus.LOCKED,
          detail: `OTP locked. Try again in ${mins} minute(s).`,
        },
        HttpStatus.LOCKED,
      );
    }

    const otp = this.generateOtp();
    const codeHash = await this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.repo.createOtp({
      user: { connect: { id: userId } },
      channel,
      purpose,
      code_hash: codeHash,
      expires_at: expiresAt,
    });

    await this.enqueueOtp(channel, destination, otp, purpose);
  }

  async consumeOtp(
    userId: string,
    rawCode: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const otp = await this.assertOtpValid(userId, rawCode, purpose);

    await this.repo.updateOtp(otp.id, { consumed_at: new Date() });
  }

  async assertOtpValid(userId: string, rawCode: string, purpose: OtpPurpose) {
    const otp = await this.findAndValidateOtp(userId, rawCode, purpose);

    return otp;
  }

  private async findAndValidateOtp(
    userId: string,
    rawCode: string,
    purpose: OtpPurpose,
  ) {
    const otp = await this.repo.findLatestOtp(userId, purpose);

    if (!otp) {
      throw new NotFoundException({
        type: 'NOT_FOUND',
        title: 'OTP Not Found',
        status: 404,
        detail: 'No OTP found. Please request a new code.',
      });
    }

    if (otp.locked_until && otp.locked_until > new Date()) {
      const mins = Math.ceil((otp.locked_until.getTime() - Date.now()) / 60000);
      throw new HttpException(
        {
          type: 'OTP_LOCKED',
          title: 'Too Many Attempts',
          status: HttpStatus.LOCKED,
          detail: `Account locked. Try again in ${mins} minute(s).`,
        },
        HttpStatus.LOCKED,
      );
    }

    if (otp.consumed_at) {
      throw new HttpException(
        {
          type: 'OTP_ALREADY_USED',
          title: 'OTP Already Used',
          status: 422,
          detail: 'This code has already been used. Request a new one.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (otp.expires_at < new Date()) {
      throw new HttpException(
        {
          type: 'OTP_EXPIRED',
          title: 'OTP Expired',
          status: 422,
          detail: 'This code has expired. Please request a new one.',
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const isCodeValid = await bcrypt.compare(rawCode, otp.code_hash);
    if (!isCodeValid) {
      const newAttempts = otp.attempts + 1;
      const shouldLock = newAttempts >= OTP_MAX_ATTEMPTS;

      await this.repo.updateOtp(otp.id, {
        attempts: newAttempts,
        locked_until: shouldLock
          ? new Date(Date.now() + OTP_LOCK_MINUTES * 60 * 1000)
          : undefined,
      });

      const remaining = OTP_MAX_ATTEMPTS - newAttempts;
      throw new HttpException(
        {
          type: 'INVALID_OTP',
          title: 'Invalid Code',
          status: 422,
          detail: shouldLock
            ? `Too many attempts. Locked for ${OTP_LOCK_MINUTES} minutes.`
            : `Invalid code. ${remaining} attempt(s) remaining.`,
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return otp;
  }

  private async issueRegistrationChallengeOtp(
    destination: string,
    persist: (state: ChallengeOtpState) => Promise<void>,
  ): Promise<void> {
    const otp = this.generateOtp();
    const codeHash = await this.hashOtp(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await persist({ codeHash, expiresAt });
    await this.enqueueOtp(
      OtpChannel.email,
      destination,
      otp,
      OtpPurpose.registration,
    );
  }

  private async recordRegistrationChallengeFailure(
    challengeId: string,
    challenge: StoredRegistrationChallenge,
  ): Promise<never> {
    const attempts = challenge.attempts + 1;
    const shouldLock = attempts >= REGISTRATION_CHALLENGE_MAX_ATTEMPTS;
    const lockedUntil = shouldLock
      ? new Date(
          Date.now() + REGISTRATION_CHALLENGE_LOCK_SECONDS * 1000,
        ).toISOString()
      : undefined;
    const nextChallenge: StoredRegistrationChallenge = {
      ...challenge,
      attempts,
      lockedUntil,
    };

    const otpTtlSeconds = Math.max(
      1,
      Math.ceil(
        (new Date(challenge.otpExpiresAt).getTime() - Date.now()) / 1000,
      ),
    );
    const ttlSeconds = shouldLock
      ? REGISTRATION_CHALLENGE_LOCK_SECONDS
      : otpTtlSeconds;

    await this.persistRegistrationChallenge(
      challengeId,
      nextChallenge,
      ttlSeconds,
    );

    if (shouldLock) {
      await this.lockRegistrationIdentity(
        challengeId,
        challenge.email,
        challenge.phone,
      );
      this.throwRegistrationChallengeLocked(
        REGISTRATION_CHALLENGE_LOCK_SECONDS,
      );
    }

    throw new HttpException(
      {
        type: 'REGISTRATION_OTP_INVALID',
        title: 'Invalid Verification Code',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'The verification code is invalid.',
        remaining_attempts: REGISTRATION_CHALLENGE_MAX_ATTEMPTS - attempts,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private async persistRegistrationChallenge(
    challengeId: string,
    challenge: StoredRegistrationChallenge,
    ttlSeconds: number,
  ): Promise<void> {
    await this.withRegistrationRedis(() =>
      this.redis.setex(
        this.registrationChallengeKey(challengeId),
        ttlSeconds,
        JSON.stringify(challenge),
      ),
    );
  }

  private async activateRegistrationChallenge(
    challengeId: string,
    email: string,
    phone?: string,
  ): Promise<void> {
    const activeKeys = this.registrationIdentityValues(email, phone).map(
      (value) => this.registrationActiveKey(value),
    );
    const previousChallengeIds = new Set<string>();

    for (const key of activeKeys) {
      const previousId = await this.readRegistrationKey(key);
      if (previousId && previousId !== challengeId) {
        previousChallengeIds.add(previousId);
      }
    }

    for (const previousId of previousChallengeIds) {
      await this.deleteRegistrationChallenge(previousId);
    }

    for (const key of activeKeys) {
      await this.withRegistrationRedis(() =>
        this.redis.setex(key, REGISTRATION_CHALLENGE_TTL_SECONDS, challengeId),
      );
    }
  }

  private async getRegistrationChallengeOrNull(
    challengeId: string,
  ): Promise<StoredRegistrationChallenge | null> {
    const raw = await this.readRegistrationChallenge(challengeId);
    if (raw === null) {
      return null;
    }

    const parsed = this.parseRegistrationChallenge(raw);
    if (!parsed) {
      await this.bestEffortDeleteRegistrationChallenge(challengeId);
      return null;
    }

    return parsed;
  }

  private parseRegistrationChallenge(
    raw: string,
  ): StoredRegistrationChallenge | null {
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }

    if (typeof value !== 'object' || value === null) {
      return null;
    }

    const record = value as Record<string, unknown>;
    const phone = record.phone;
    const lockedUntil = record.lockedUntil;
    const attempts = record.attempts;
    const dates = [record.acceptedPrivacyAt, record.otpExpiresAt];

    if (
      typeof record.acceptedPrivacyAt !== 'string' ||
      typeof record.credentialHash !== 'string' ||
      typeof record.email !== 'string' ||
      typeof record.firstName !== 'string' ||
      typeof record.lastName !== 'string' ||
      typeof record.otpHash !== 'string' ||
      typeof record.otpExpiresAt !== 'string' ||
      !Number.isInteger(attempts) ||
      (phone !== undefined && typeof phone !== 'string') ||
      (lockedUntil !== undefined && typeof lockedUntil !== 'string') ||
      dates.some((date) => Number.isNaN(new Date(String(date)).getTime()))
    ) {
      return null;
    }

    if (
      lockedUntil !== undefined &&
      Number.isNaN(new Date(lockedUntil).getTime())
    ) {
      return null;
    }

    return {
      acceptedPrivacyAt: record.acceptedPrivacyAt,
      credentialHash: record.credentialHash,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      ...(phone !== undefined ? { phone } : {}),
      attempts: attempts as number,
      ...(lockedUntil !== undefined ? { lockedUntil } : {}),
      otpExpiresAt: record.otpExpiresAt,
      otpHash: record.otpHash,
    };
  }

  private async getRegistrationLockSeconds(
    challenge: StoredRegistrationChallenge,
  ): Promise<number | null> {
    if (challenge.lockedUntil) {
      const seconds = Math.ceil(
        (new Date(challenge.lockedUntil).getTime() - Date.now()) / 1000,
      );
      if (seconds > 0) {
        return seconds;
      }
    }

    return this.getRegistrationIdentityLockSeconds(
      challenge.email,
      challenge.phone,
    );
  }

  private async getActiveRegistrationAttempts(
    email: string,
    phone?: string,
  ): Promise<number> {
    let attempts = 0;

    for (const value of this.registrationIdentityValues(email, phone)) {
      const activeId = await this.readRegistrationKey(
        this.registrationActiveKey(value),
      );
      if (!activeId) {
        continue;
      }

      const raw = await this.readRegistrationChallenge(activeId);
      const challenge = raw ? this.parseRegistrationChallenge(raw) : null;
      if (!challenge) {
        continue;
      }

      if (challenge.lockedUntil) {
        const seconds = Math.ceil(
          (new Date(challenge.lockedUntil).getTime() - Date.now()) / 1000,
        );
        if (seconds > 0) {
          this.throwRegistrationChallengeLocked(seconds);
        }
      }

      attempts = Math.max(attempts, challenge.attempts);
    }

    return attempts;
  }

  private async assertRegistrationIdentityNotLocked(
    email: string,
    phone?: string,
  ): Promise<void> {
    const retryAfter = await this.getRegistrationIdentityLockSeconds(
      email,
      phone,
    );
    if (retryAfter !== null) {
      this.throwRegistrationChallengeLocked(retryAfter);
    }
  }

  private async getRegistrationIdentityLockSeconds(
    email: string,
    phone?: string,
  ): Promise<number | null> {
    for (const value of this.registrationIdentityValues(email, phone)) {
      const locked = await this.readRegistrationKey(
        this.registrationLockKey(value),
      );
      if (!locked) {
        continue;
      }

      const ttl = await this.withRegistrationRedis(() =>
        this.redis.ttl(this.registrationLockKey(value)),
      );
      return ttl > 0 ? ttl : REGISTRATION_CHALLENGE_LOCK_SECONDS;
    }

    return null;
  }

  private async lockRegistrationIdentity(
    challengeId: string,
    email: string,
    phone?: string,
  ): Promise<void> {
    for (const value of this.registrationIdentityValues(email, phone)) {
      await this.withRegistrationRedis(() =>
        this.redis.setex(
          this.registrationLockKey(value),
          REGISTRATION_CHALLENGE_LOCK_SECONDS,
          challengeId,
        ),
      );
      await this.withRegistrationRedis(() =>
        this.redis.setex(
          this.registrationActiveKey(value),
          REGISTRATION_CHALLENGE_LOCK_SECONDS,
          challengeId,
        ),
      );
    }
  }

  private async isReplacedRegistrationChallenge(
    challengeId: string,
    challenge: StoredRegistrationChallenge,
  ): Promise<boolean> {
    for (const value of this.registrationIdentityValues(
      challenge.email,
      challenge.phone,
    )) {
      const activeId = await this.readRegistrationKey(
        this.registrationActiveKey(value),
      );
      if (activeId && activeId !== challengeId) {
        return true;
      }
    }

    return false;
  }

  private async consumeRegistrationChallenge(
    challengeId: string,
    challenge: StoredRegistrationChallenge,
  ): Promise<void> {
    await this.markRegistrationChallengeCompleted(challengeId);
    await this.deleteRegistrationChallenge(challengeId);
    await this.clearActiveRegistrationChallenge(challengeId, challenge);
  }

  private async markRegistrationChallengeCompleted(
    challengeId: string,
  ): Promise<void> {
    await this.withRegistrationRedis(() =>
      this.redis.setex(
        this.registrationCompletedKey(challengeId),
        REGISTRATION_CHALLENGE_COMPLETED_TTL_SECONDS,
        '1',
      ),
    );
  }

  private async clearActiveRegistrationChallenge(
    challengeId: string,
    challenge: RegistrationChallengePayload,
  ): Promise<void> {
    for (const value of this.registrationIdentityValues(
      challenge.email,
      challenge.phone,
    )) {
      const activeKey = this.registrationActiveKey(value);
      const activeId = await this.readRegistrationKey(activeKey);
      if (activeId === challengeId) {
        await this.withRegistrationRedis(() => this.redis.del(activeKey));
      }
    }
  }

  private async bestEffortDeleteRegistrationChallenge(
    challengeId: string,
  ): Promise<void> {
    try {
      const raw = await this.readRegistrationChallenge(challengeId);
      const challenge = raw ? this.parseRegistrationChallenge(raw) : null;
      await this.deleteRegistrationChallenge(challengeId);
      if (challenge) {
        await this.clearActiveRegistrationChallenge(challengeId, challenge);
      }
    } catch (error) {
      this.logger.error(
        'Failed to remove an invalid registration challenge.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async acquireRegistrationChallengeLock(
    challengeId: string,
  ): Promise<string | null> {
    const token = crypto.randomUUID();
    const result = await this.withRegistrationRedis(() =>
      this.redis.set(
        this.registrationProcessingKey(challengeId),
        token,
        'EX',
        REGISTRATION_CHALLENGE_PROCESSING_SECONDS,
        'NX',
      ),
    );
    return result === 'OK' ? token : null;
  }

  private async releaseRegistrationChallengeLock(
    challengeId: string,
    token: string,
  ): Promise<void> {
    try {
      await this.withRegistrationRedis(() =>
        this.redis.eval(
          "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
          1,
          this.registrationProcessingKey(challengeId),
          token,
        ),
      );
    } catch (error) {
      this.logger.error(
        'Failed to release a registration challenge lock.',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async readRegistrationChallenge(
    challengeId: string,
  ): Promise<string | null> {
    return this.readRegistrationKey(this.registrationChallengeKey(challengeId));
  }

  private async readRegistrationChallengeMarker(
    challengeId: string,
  ): Promise<string | null> {
    return this.readRegistrationKey(this.registrationCompletedKey(challengeId));
  }

  private async readRegistrationKey(key: string): Promise<string | null> {
    return this.withRegistrationRedis(() => this.redis.get(key));
  }

  private async deleteRegistrationChallenge(
    challengeId: string,
  ): Promise<void> {
    await this.withRegistrationRedis(() =>
      this.redis.del(this.registrationChallengeKey(challengeId)),
    );
  }

  private registrationIdentityValues(email: string, phone?: string): string[] {
    return [
      ...new Set([email, phone].filter((value): value is string => !!value)),
    ];
  }

  private registrationIdentityHash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  private registrationChallengeKey(challengeId: string): string {
    return `auth:registration:challenge:${challengeId}`;
  }

  private registrationCompletedKey(challengeId: string): string {
    return `auth:registration:completed:${challengeId}`;
  }

  private registrationProcessingKey(challengeId: string): string {
    return `auth:registration:processing:${challengeId}`;
  }

  private registrationActiveKey(identity: string): string {
    return `auth:registration:active:${this.registrationIdentityHash(identity)}`;
  }

  private registrationLockKey(identity: string): string {
    return `auth:registration:lock:${this.registrationIdentityHash(identity)}`;
  }

  private async activateRegistrationChallengeStorage<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        'Registration challenge storage is unavailable.',
        error instanceof Error ? error.stack : undefined,
      );
      throw new HttpException(
        {
          type: 'REGISTRATION_CHALLENGE_STORAGE_UNAVAILABLE',
          title: 'Registration Temporarily Unavailable',
          status: HttpStatus.SERVICE_UNAVAILABLE,
          detail:
            'Registration verification is temporarily unavailable. Please try again shortly.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private withRegistrationRedis<T>(operation: () => Promise<T>): Promise<T> {
    return this.activateRegistrationChallengeStorage(operation);
  }

  private throwRegistrationChallengeBusy(): never {
    throw new HttpException(
      {
        type: 'REGISTRATION_CHALLENGE_IN_PROGRESS',
        title: 'Verification In Progress',
        status: HttpStatus.CONFLICT,
        detail: 'The verification request is already being processed.',
      },
      HttpStatus.CONFLICT,
    );
  }

  private throwRegistrationChallengeCompleted(): never {
    throw new HttpException(
      {
        type: 'REGISTRATION_CHALLENGE_COMPLETED',
        title: 'Registration Challenge Completed',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail: 'This registration challenge is no longer available.',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private throwRegistrationChallengeExpired(): never {
    throw new HttpException(
      {
        type: 'REGISTRATION_CHALLENGE_EXPIRED',
        title: 'Registration Challenge Unavailable',
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        detail:
          'This registration challenge has expired or is no longer available.',
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }

  private throwRegistrationChallengeLocked(secondsRemaining: number): never {
    const retryAfterSeconds = Math.max(1, secondsRemaining);
    throw new HttpException(
      {
        type: 'REGISTRATION_OTP_LOCKED',
        title: 'Registration Verification Locked',
        status: HttpStatus.LOCKED,
        detail:
          'Registration verification is temporarily unavailable. Please try again later.',
        retry_after_seconds: retryAfterSeconds,
        locked_until: new Date(
          Date.now() + retryAfterSeconds * 1000,
        ).toISOString(),
      },
      HttpStatus.LOCKED,
    );
  }

  private async enqueueOtp(
    channel: OtpChannel,
    destination: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    try {
      await this.mailQueue.add(
        'send-otp',
        { to: destination, otp, purpose },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch {
      this.logger.error('Failed to enqueue email OTP delivery job.');

      throw new HttpException(
        {
          type: 'OTP_DELIVERY_QUEUE_UNAVAILABLE',
          title: 'OTP Delivery Unavailable',
          status: HttpStatus.SERVICE_UNAVAILABLE,
          detail:
            'Could not queue the OTP email for delivery. Please try again shortly.',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, OTP_HASH_ROUNDS);
  }
}
