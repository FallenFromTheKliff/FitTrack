import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationChannel } from '@prisma/client';
import { type Job } from 'bull';
import twilio from 'twilio';

import {
  NOTIFICATION_DELIVERY_FAILED_EVENT,
  NOTIFICATION_DELIVERY_SENT_EVENT,
} from '../../notifications/notification-delivery.events';
import type { NotificationQueueMetadata } from '../../notifications/notification-dispatch.types';
import { QUEUE_SMS } from '../queue.constants';

export interface SendSmsOtpJobData {
  to: string; // E.164 phone number e.g. +639171234567
  otp: string;
  purpose: string; // for log context only
}

export interface SendGenericSmsJobData {
  to: string;
  body: string;
  notification?: NotificationQueueMetadata;
}

@Injectable()
@Processor(QUEUE_SMS)
export class SmsProcessor {
  private readonly logger = new Logger(SmsProcessor.name);
  private readonly client: twilio.Twilio;
  private readonly fromNumber: string;

  constructor(
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    this.client = twilio(
      this.config.get<string>('twilio.accountSid'),
      this.config.get<string>('twilio.authToken'),
    );
    this.fromNumber = this.config.get<string>('twilio.phoneNumber')!;
  }

  @Process('send-otp')
  async handleSendOtp(job: Job<SendSmsOtpJobData>): Promise<void> {
    const { to, otp, purpose } = job.data;
    this.logger.log(
      `Processing send-otp SMS job ${job.id} → ${to} [${purpose}]`,
    );

    await this.client.messages.create({
      from: this.fromNumber,
      to,
      body: this.buildOtpMessage(otp, purpose),
    });

    this.logger.log(`SMS OTP sent → ${to}`);
  }

  @Process('send-generic')
  async handleSendGeneric(job: Job<SendGenericSmsJobData>): Promise<void> {
    const { to, body, notification } = job.data;
    this.logger.log(`Processing send-generic SMS job ${job.id} → ${to}`);

    await this.client.messages.create({
      from: this.fromNumber,
      to,
      body,
    });

    this.logger.log(`Generic SMS sent → ${to}`);

    if (notification) {
      this.eventEmitter.emit(NOTIFICATION_DELIVERY_SENT_EVENT, {
        notificationId: notification.notification_id,
        channel: NotificationChannel.sms,
      });
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `SMS job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempt(s): ${error.message}`,
    );

    if (!this.isTerminalFailure(job)) {
      return;
    }

    const notification = (job.data as SendGenericSmsJobData | undefined)
      ?.notification;

    if (!notification || job.name !== 'send-generic') {
      return;
    }

    this.eventEmitter.emit(NOTIFICATION_DELIVERY_FAILED_EVENT, {
      notificationId: notification.notification_id,
      channel: NotificationChannel.sms,
      error: error.message,
    });
  }

  // ─── Templates ───────────────────────────────────────────────────────────────

  private buildOtpMessage(otp: string, purpose: string): string {
    const map: Record<string, string> = {
      login_2fa: `Your FitTrack login code is ${otp}. Expires in 10 minutes. Do not share this code.`,
      phone_verify: `Your FitTrack phone verification code is ${otp}. Expires in 10 minutes.`,
      password_reset: `Your FitTrack password reset code is ${otp}. Expires in 10 minutes.`,
    };
    return (
      map[purpose] ?? `Your FitTrack code is ${otp}. Expires in 10 minutes.`
    );
  }

  private isTerminalFailure(job: Job): boolean {
    return job.attemptsMade >= (job.opts.attempts ?? 1);
  }
}
