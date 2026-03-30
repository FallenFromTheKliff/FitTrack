import { Process, Processor, OnQueueFailed } from '@nestjs/bull';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationChannel } from '@prisma/client';
import { type Job } from 'bull';

import { MailService } from '../../mail/mail.service';
import {
  NOTIFICATION_DELIVERY_FAILED_EVENT,
  NOTIFICATION_DELIVERY_SENT_EVENT,
} from '../../notifications/notification-delivery.events';
import type { NotificationQueueMetadata } from '../../notifications/notification-dispatch.types';
import { QUEUE_MAIL } from '../queue.constants';

export interface SendOtpJobData {
  to: string;
  otp: string;
  purpose: string;
}

export interface SendGenericMailJobData {
  to: string;
  subject: string;
  html: string;
  notification?: NotificationQueueMetadata;
}

@Injectable()
@Processor(QUEUE_MAIL)
export class MailProcessor {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    private readonly mailService: MailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Process('send-otp')
  async handleSendOtp(job: Job<SendOtpJobData>): Promise<void> {
    const { to, otp, purpose } = job.data;
    this.logger.log(`Processing send-otp job ${job.id} → ${to}`);
    await this.mailService.sendOtpEmail(to, otp, purpose);
  }

  @Process('send-generic')
  async handleSendGeneric(job: Job<SendGenericMailJobData>): Promise<void> {
    const { to, subject, html, notification } = job.data;
    this.logger.log(
      `Processing send-generic job ${job.id} → ${to} | "${subject}"`,
    );
    await this.mailService.send({ to, subject, html });

    if (notification) {
      this.eventEmitter.emit(NOTIFICATION_DELIVERY_SENT_EVENT, {
        notificationId: notification.notification_id,
        channel: NotificationChannel.email,
      });
    }
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error): void {
    this.logger.error(
      `Job ${job.id} (${job.name}) failed after ${job.attemptsMade} attempts`,
      error.message,
    );

    if (!this.isTerminalFailure(job)) {
      return;
    }

    const notification = (job.data as SendGenericMailJobData | undefined)
      ?.notification;

    if (!notification || job.name !== 'send-generic') {
      return;
    }

    this.eventEmitter.emit(NOTIFICATION_DELIVERY_FAILED_EVENT, {
      notificationId: notification.notification_id,
      channel: NotificationChannel.email,
      error: error.message,
    });
  }

  private isTerminalFailure(job: Job): boolean {
    return job.attemptsMade >= (job.opts.attempts ?? 1);
  }
}
