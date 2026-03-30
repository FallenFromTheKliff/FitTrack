import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import * as bcrypt from 'bcrypt';
import { OtpChannel, OtpPurpose } from '@prisma/client';

import { AuthRepository } from '../auth.repository';
import { QUEUE_MAIL, QUEUE_SMS } from '../../queue/queue.constants';
import {
  OTP_EXPIRY_MINUTES,
  OTP_HASH_ROUNDS,
  OTP_LOCK_MINUTES,
  OTP_MAX_ATTEMPTS,
} from './otp.constants';

@Injectable()
export class AuthOtpService {
  private readonly logger = new Logger(AuthOtpService.name);

  constructor(
    private readonly repo: AuthRepository,
    @InjectQueue(QUEUE_MAIL) private readonly mailQueue: Queue,
    @InjectQueue(QUEUE_SMS) private readonly smsQueue: Queue,
  ) {}

  async issueOtp(
    userId: string,
    purpose: OtpPurpose,
    channel: OtpChannel,
    destination: string,
  ): Promise<void> {
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

    this.logger.debug(`DEV OTP for ${destination}: ${otp}`);

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

    await this.repo.updateOtp(otp.id, { consumed_at: new Date() });
  }

  private async enqueueOtp(
    channel: OtpChannel,
    destination: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const queue = channel === OtpChannel.email ? this.mailQueue : this.smsQueue;

    await queue.add(
      'send-otp',
      { to: destination, otp, purpose },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: true,
      },
    );
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private hashOtp(otp: string): Promise<string> {
    return bcrypt.hash(otp, OTP_HASH_ROUNDS);
  }
}
