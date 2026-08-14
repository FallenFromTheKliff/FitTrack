import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { BookingStatus, NotificationType } from '@prisma/client';
import type { Queue } from 'bull';

import { NotificationsService } from '../../notifications/notifications.service';
import { BookingRepository } from './booking.repository';
import {
  BOOKING_COMPLETION_JOB,
  BOOKING_LIFECYCLE_QUEUE,
  BOOKING_LIFECYCLE_TIMEZONE,
  BOOKING_NO_SHOW_GRACE_MINUTES,
  BOOKING_NO_SHOW_JOB,
  BOOKING_PENDING_CLEANUP_JOB,
  BOOKING_PENDING_CLEANUP_WINDOW_MINUTES,
  BOOKING_REMINDER_JOB,
  BOOKING_REMINDER_OFFSET_HOURS,
} from './booking.constants';
import {
  BOOKING_CANCELLED_EVENT,
  type BookingCancelledEvent,
} from './events/booking-cancelled.event';
import {
  BOOKING_CONFIRMED_EVENT,
  type BookingConfirmedEvent,
} from './events/booking-confirmed.event';
import {
  BOOKING_RESCHEDULED_EVENT,
  type BookingRescheduledEvent,
} from './events/booking-rescheduled.event';

type BookingNotificationTarget = Awaited<
  ReturnType<BookingRepository['findBookingNotificationContextByIdOrThrow']>
>;

@Injectable()
export class BookingLifecycleService implements OnModuleInit {
  constructor(
    private readonly repo: BookingRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationsService: NotificationsService,
    @InjectQueue(BOOKING_LIFECYCLE_QUEUE)
    private readonly lifecycleQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLifecycleJobs();
  }

  @OnEvent(BOOKING_CONFIRMED_EVENT, { async: true })
  async handleBookingConfirmed(event: BookingConfirmedEvent): Promise<void> {
    await this.queueNoShowCheck(event.bookingId, new Date(event.startsAt));
    await this.queueBookingReminder(event.bookingId, new Date(event.startsAt));

    const booking = await this.repo.findBookingNotificationContextByIdOrThrow(
      event.bookingId,
    );

    await this.notificationsService.dispatch(
      booking.user.id,
      NotificationType.booking_confirmed,
      {
        title: 'Booking confirmed',
        body: this.buildBookingConfirmedBody(booking),
        data: this.buildBookingNotificationData(booking),
        email: {
          subject: `Booking confirmed for ${booking.amenity.name}`,
          html: this.buildBookingConfirmedHtml(booking),
        },
        sms: {
          body: this.buildBookingConfirmedSms(booking),
        },
      },
    );
  }

  @OnEvent(BOOKING_CANCELLED_EVENT, { async: true })
  async handleBookingCancelled(event: BookingCancelledEvent): Promise<void> {
    const booking = await this.repo.findBookingNotificationContextByIdOrThrow(
      event.bookingId,
    );

    await this.notificationsService.dispatch(
      booking.user.id,
      NotificationType.booking_cancelled,
      {
        title: 'Booking cancelled',
        body: this.buildBookingCancelledBody(booking),
        data: this.buildBookingNotificationData(booking),
        email: {
          subject: `Booking cancelled for ${booking.amenity.name}`,
          html: this.buildBookingCancelledHtml(booking),
        },
      },
    );
  }

  @OnEvent(BOOKING_RESCHEDULED_EVENT, { async: true })
  async handleBookingRescheduled(
    event: BookingRescheduledEvent,
  ): Promise<void> {
    await this.replaceScheduledLifecycleJobs(
      event.bookingId,
      new Date(event.startsAt),
    );
    const booking = await this.repo.findBookingNotificationContextByIdOrThrow(
      event.bookingId,
    );
    await this.notificationsService.dispatch(
      booking.user.id,
      NotificationType.system,
      {
        title: 'Venue booking rescheduled',
        body: `Your booking is now at ${booking.amenity.name}. ${this.buildBookingWindowLabel(booking)}`,
        data: this.buildBookingNotificationData(booking),
        email: {
          subject: `Venue booking rescheduled to ${booking.amenity.name}`,
          html: `<p>Your FitTrack venue booking has been moved to <strong>${booking.amenity.name}</strong>.</p><p>${this.buildBookingWindowLabel(booking)}</p><p>Your recorded payment is unchanged.</p>`,
        },
      },
    );
  }

  async runBookingReminder(bookingId: string): Promise<void> {
    const booking =
      await this.repo.findBookingNotificationContextByIdOrThrow(bookingId);

    if (
      booking.status !== BookingStatus.confirmed ||
      booking.starts_at.getTime() <= Date.now()
    ) {
      return;
    }

    await this.notificationsService.dispatch(
      booking.user.id,
      NotificationType.booking_reminder,
      {
        title: 'Booking reminder',
        body: this.buildBookingReminderBody(booking),
        data: {
          ...this.buildBookingNotificationData(booking),
          reminder_offset_hours: BOOKING_REMINDER_OFFSET_HOURS,
        },
        email: {
          subject: `Reminder: ${booking.amenity.name} booking tomorrow`,
          html: this.buildBookingReminderHtml(booking),
        },
        sms: {
          body: this.buildBookingReminderSms(booking),
        },
      },
    );
  }

  async runNoShowCheck(bookingId: string): Promise<void> {
    const eligibleStartsAt = this.subtractMinutes(
      new Date(),
      BOOKING_NO_SHOW_GRACE_MINUTES,
    );

    const didMarkNoShow = await this.repo.markBookingNoShowIfEligible(
      bookingId,
      eligibleStartsAt,
    );

    if (!didMarkNoShow) {
      return;
    }

    const booking =
      await this.repo.findBookingNotificationContextByIdOrThrow(bookingId);

    await this.notificationsService.dispatch(
      booking.user.id,
      NotificationType.booking_no_show,
      {
        title: 'Booking marked as no-show',
        body: this.buildBookingNoShowBody(booking),
        data: this.buildBookingNotificationData(booking),
        email: {
          subject: `Booking marked as no-show for ${booking.amenity.name}`,
          html: this.buildBookingNoShowHtml(booking),
        },
      },
    );
  }

  async runPendingCleanupCron(): Promise<void> {
    const now = new Date();
    const cutoff = this.subtractMinutes(
      now,
      BOOKING_PENDING_CLEANUP_WINDOW_MINUTES,
    );
    const candidates = await this.repo.findStalePendingBookings(cutoff);

    for (const booking of candidates) {
      const cancelled = await this.repo.cancelPendingBookingIfStale(
        booking.id,
        cutoff,
        now,
      );

      if (cancelled) {
        this.eventEmitter.emit(BOOKING_CANCELLED_EVENT, {
          bookingId: booking.id,
          userId: booking.user_id,
          amenityId: booking.amenity_id,
          cancelledAt: now.toISOString(),
        } satisfies BookingCancelledEvent);
      }
    }
  }

  async runCompletionCron(): Promise<void> {
    await this.repo.completePastFreeBookings(new Date());
  }

  private async ensureLifecycleJobs(): Promise<void> {
    await this.lifecycleQueue.add(
      BOOKING_PENDING_CLEANUP_JOB,
      {},
      {
        jobId: BOOKING_PENDING_CLEANUP_JOB,
        removeOnComplete: true,
        repeat: {
          cron: '*/15 * * * *',
          tz: BOOKING_LIFECYCLE_TIMEZONE,
        },
      },
    );

    await this.lifecycleQueue.add(
      BOOKING_COMPLETION_JOB,
      {},
      {
        jobId: BOOKING_COMPLETION_JOB,
        removeOnComplete: true,
        repeat: {
          cron: '0 * * * *',
          tz: BOOKING_LIFECYCLE_TIMEZONE,
        },
      },
    );
  }

  private async queueBookingReminder(
    bookingId: string,
    startsAt: Date,
  ): Promise<void> {
    const delay = Math.max(
      0,
      startsAt.getTime() -
        BOOKING_REMINDER_OFFSET_HOURS * 60 * 60 * 1000 -
        Date.now(),
    );

    await this.lifecycleQueue.add(
      BOOKING_REMINDER_JOB,
      { bookingId },
      {
        delay,
        jobId: `${BOOKING_REMINDER_JOB}:${bookingId}`,
        removeOnComplete: true,
      },
    );
  }

  private async queueNoShowCheck(
    bookingId: string,
    startsAt: Date,
  ): Promise<void> {
    const delay = Math.max(
      0,
      startsAt.getTime() +
        BOOKING_NO_SHOW_GRACE_MINUTES * 60 * 1000 -
        Date.now(),
    );

    await this.lifecycleQueue.add(
      BOOKING_NO_SHOW_JOB,
      { bookingId },
      {
        delay,
        jobId: `${BOOKING_NO_SHOW_JOB}:${bookingId}`,
        removeOnComplete: true,
      },
    );
  }

  private async replaceScheduledLifecycleJobs(
    bookingId: string,
    startsAt: Date,
  ): Promise<void> {
    const existingJobs = await Promise.all([
      this.lifecycleQueue.getJob(`${BOOKING_REMINDER_JOB}:${bookingId}`),
      this.lifecycleQueue.getJob(`${BOOKING_NO_SHOW_JOB}:${bookingId}`),
    ]);
    await Promise.all(
      existingJobs
        .filter((job): job is NonNullable<typeof job> => Boolean(job))
        .map((job) => job.remove()),
    );
    await this.queueBookingReminder(bookingId, startsAt);
    await this.queueNoShowCheck(bookingId, startsAt);
  }

  private buildBookingConfirmedHtml(
    booking: BookingNotificationTarget,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Booking confirmed</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(booking)}, your booking for
          <strong>${booking.amenity.name}</strong> is confirmed.
        </p>
        <p style="color:#555">${this.buildBookingWindowLabel(booking)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildBookingCancelledHtml(
    booking: BookingNotificationTarget,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Booking cancelled</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(booking)}, your booking for
          <strong>${booking.amenity.name}</strong> has been cancelled.
        </p>
        <p style="color:#555">${this.buildBookingWindowLabel(booking)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildBookingReminderHtml(booking: BookingNotificationTarget): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Booking reminder</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(booking)}, your booking for
          <strong>${booking.amenity.name}</strong> starts in about 24 hours.
        </p>
        <p style="color:#555">${this.buildBookingWindowLabel(booking)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildBookingNoShowHtml(booking: BookingNotificationTarget): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Booking marked as no-show</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(booking)}, your booking for
          <strong>${booking.amenity.name}</strong> was marked as a no-show.
        </p>
        <p style="color:#555">${this.buildBookingWindowLabel(booking)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildBookingConfirmedSms(booking: BookingNotificationTarget): string {
    return `FitTrack: your ${booking.amenity.name} booking is confirmed. ${this.buildBookingWindowLabel(booking)}`;
  }

  private buildBookingReminderSms(booking: BookingNotificationTarget): string {
    return `FitTrack reminder: your ${booking.amenity.name} booking starts in about 24 hours. ${this.buildBookingWindowLabel(booking)}`;
  }

  private buildBookingConfirmedBody(
    booking: BookingNotificationTarget,
  ): string {
    return `Your ${booking.amenity.name} booking is confirmed. ${this.buildBookingWindowLabel(booking)}`;
  }

  private buildBookingReminderBody(booking: BookingNotificationTarget): string {
    return `Reminder: your ${booking.amenity.name} booking starts in about 24 hours. ${this.buildBookingWindowLabel(booking)}`;
  }

  private buildBookingCancelledBody(
    booking: BookingNotificationTarget,
  ): string {
    return `Your ${booking.amenity.name} booking was cancelled. ${this.buildBookingWindowLabel(booking)}`;
  }

  private buildBookingNoShowBody(booking: BookingNotificationTarget): string {
    return `Your ${booking.amenity.name} booking was marked as a no-show. ${this.buildBookingWindowLabel(booking)}`;
  }

  private buildBookingNotificationData(booking: BookingNotificationTarget) {
    return {
      booking_id: booking.id,
      amenity_name: booking.amenity.name,
      starts_at: booking.starts_at.toISOString(),
      ends_at: booking.ends_at.toISOString(),
    };
  }

  private buildBookingWindowLabel(booking: BookingNotificationTarget): string {
    return `${this.formatDateTime(booking.starts_at)} to ${this.formatDateTime(booking.ends_at)}.`;
  }

  private getDisplayName(booking: BookingNotificationTarget): string {
    const firstName = booking.user.profile?.first_name ?? 'member';
    const lastName = booking.user.profile?.last_name ?? '';
    return `${firstName} ${lastName}`.trim();
  }

  private formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: BOOKING_LIFECYCLE_TIMEZONE,
    }).format(value);
  }

  private subtractMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() - minutes * 60 * 1000);
  }
}
