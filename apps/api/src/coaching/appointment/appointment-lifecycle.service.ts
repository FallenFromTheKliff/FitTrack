import { InjectQueue } from '@nestjs/bull';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppointmentStatus, NotificationType } from '@prisma/client';
import { OnEvent } from '@nestjs/event-emitter';
import type { Queue } from 'bull';

import { NotificationsService } from '../../notifications/notifications.service';
import {
  APPOINTMENT_CANCELLED_EVENT,
  type AppointmentCancelledEvent,
} from './events/appointment-cancelled.event';
import {
  APPOINTMENT_COMPLETED_EVENT,
  type AppointmentCompletedEvent,
} from './events/appointment-completed.event';
import {
  APPOINTMENT_CONFIRMED_EVENT,
  type AppointmentConfirmedEvent,
} from './events/appointment-confirmed.event';
import { AppointmentRepository } from './appointment.repository';
import {
  COACHING_COMPLETION_JOB,
  COACHING_LIFECYCLE_QUEUE,
  COACHING_LIFECYCLE_TIMEZONE,
  COACHING_NO_SHOW_GRACE_MINUTES,
  COACHING_NO_SHOW_JOB,
  COACHING_REMINDER_JOB,
  COACHING_REMINDER_OFFSET_HOURS,
  COACHING_RECURRING_BILLING_OVERDUE_JOB,
} from './appointment.constants';
import { RecurringCoachingPlanService } from '../recurring-plan/recurring-coaching-plan.service';

type AppointmentNotificationTarget = Awaited<
  ReturnType<
    AppointmentRepository['findAppointmentNotificationContextByIdOrThrow']
  >
>;

type AppointmentNotificationUser =
  | AppointmentNotificationTarget['user']
  | AppointmentNotificationTarget['coach']['user'];

@Injectable()
export class AppointmentLifecycleService implements OnModuleInit {
  constructor(
    private readonly repo: AppointmentRepository,
    private readonly notificationsService: NotificationsService,
    private readonly recurringCoachingPlanService: RecurringCoachingPlanService,
    @InjectQueue(COACHING_LIFECYCLE_QUEUE)
    private readonly lifecycleQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureLifecycleJobs();
  }

  @OnEvent(APPOINTMENT_CONFIRMED_EVENT, { async: true })
  async handleAppointmentConfirmed(
    event: AppointmentConfirmedEvent,
  ): Promise<void> {
    await this.queueNoShowCheck(
      event.appointmentId,
      new Date(event.scheduledAt),
      event.durationMinutes,
    );
    await this.queueAppointmentReminder(
      event.appointmentId,
      new Date(event.scheduledAt),
    );

    const appointment =
      await this.repo.findAppointmentNotificationContextByIdOrThrow(
        event.appointmentId,
      );

    await this.notificationsService.dispatch(
      appointment.user.id,
      NotificationType.appointment_confirmed,
      {
        title: 'Coaching appointment confirmed',
        body: this.buildAppointmentConfirmedBody(appointment),
        data: this.buildAppointmentNotificationData(appointment),
        email: {
          subject: 'Coaching appointment confirmed',
          html: this.buildAppointmentConfirmedHtml(appointment),
        },
        sms: {
          body: this.buildAppointmentConfirmedSms(appointment),
        },
      },
    );

    if (appointment.coach.user) {
      await this.notificationsService.dispatch(
        appointment.coach.user.id,
        NotificationType.appointment_confirmed,
        {
          title: 'Coaching appointment booked',
          body: `${this.getDisplayName(appointment.user)} is booked for ${this.buildAppointmentWindowLabel(appointment)}.`,
          data: {
            ...this.buildAppointmentNotificationData(appointment),
            notification_kind: 'coach_appointment_booked',
          },
        },
      );
    }
  }

  async runAppointmentReminder(appointmentId: string): Promise<void> {
    const appointment =
      await this.repo.findAppointmentNotificationContextByIdOrThrow(
        appointmentId,
      );
    const scheduledAt = new Date(appointment.scheduled_at);

    if (
      appointment.status !== AppointmentStatus.confirmed ||
      scheduledAt.getTime() <= Date.now()
    ) {
      return;
    }

    await this.notificationsService.dispatch(
      appointment.user.id,
      NotificationType.appointment_reminder,
      {
        title: 'Coaching appointment reminder',
        body: this.buildAppointmentReminderBody(appointment),
        data: {
          ...this.buildAppointmentNotificationData(appointment),
          reminder_offset_hours: COACHING_REMINDER_OFFSET_HOURS,
        },
        email: {
          subject: 'Reminder: coaching appointment tomorrow',
          html: this.buildAppointmentReminderHtml(appointment),
        },
        sms: {
          body: this.buildAppointmentReminderSms(appointment),
        },
      },
    );

    if (appointment.coach.user) {
      await this.notificationsService.dispatch(
        appointment.coach.user.id,
        NotificationType.appointment_reminder,
        {
          title: 'Upcoming coaching session',
          body: `${this.getDisplayName(appointment.user)} is scheduled for ${this.buildAppointmentWindowLabel(appointment)}.`,
          data: {
            ...this.buildAppointmentNotificationData(appointment),
            notification_kind: 'coach_appointment_reminder',
            reminder_offset_hours: COACHING_REMINDER_OFFSET_HOURS,
          },
        },
      );
    }
  }

  @OnEvent(APPOINTMENT_CANCELLED_EVENT, { async: true })
  async handleAppointmentCancelled(
    event: AppointmentCancelledEvent,
  ): Promise<void> {
    const appointment =
      await this.repo.findAppointmentNotificationContextByIdOrThrow(
        event.appointmentId,
      );

    const notificationJobs: Array<Promise<void>> = [
      this.notifyUserOfCancellation(
        appointment.user.id,
        this.buildAppointmentCancelledHtml(appointment, 'member'),
        this.buildAppointmentCancelledBody(appointment, 'member'),
      ),
    ];

    if (appointment.coach.user) {
      notificationJobs.push(
        this.notifyUserOfCancellation(
          appointment.coach.user.id,
          this.buildAppointmentCancelledHtml(appointment, 'coach'),
          this.buildAppointmentCancelledBody(appointment, 'coach'),
        ),
      );
    }

    await Promise.all(notificationJobs);
  }

  @OnEvent(APPOINTMENT_COMPLETED_EVENT, { async: true })
  async handleAppointmentCompleted(
    event: AppointmentCompletedEvent,
  ): Promise<void> {
    const appointment =
      await this.repo.findAppointmentNotificationContextByIdOrThrow(
        event.appointmentId,
      );

    await this.notificationsService.dispatch(
      appointment.user.id,
      NotificationType.appointment_completed,
      {
        title: 'Coaching appointment completed',
        body: this.buildAppointmentCompletedBody(appointment),
        data: this.buildAppointmentNotificationData(appointment),
        email: {
          subject: 'Coaching appointment completed',
          html: this.buildAppointmentCompletedHtml(appointment),
        },
      },
    );

    if (appointment.coach.user) {
      await this.notificationsService.dispatch(
        appointment.coach.user.id,
        NotificationType.appointment_completed,
        {
          title: 'Session marked complete',
          body: `${this.getDisplayName(appointment.user)}'s coaching appointment is now completed.`,
          data: {
            ...this.buildAppointmentNotificationData(appointment),
            notification_kind: 'coach_appointment_completed',
          },
        },
      );
    }
  }

  async runNoShowCheck(appointmentId: string): Promise<void> {
    const noShowAt = new Date();
    const eligibleScheduledAt = this.subtractMinutes(
      noShowAt,
      COACHING_NO_SHOW_GRACE_MINUTES,
    );

    const didMarkNoShow = await this.repo.markAppointmentNoShowIfEligible(
      appointmentId,
      eligibleScheduledAt,
      noShowAt,
    );

    if (didMarkNoShow) {
      await this.notifyAppointmentNoShow(appointmentId);
    }
  }

  async runCompletionCron(): Promise<void> {
    const completedAt = new Date();
    await this.runNoShowCleanupCron(completedAt);

    const candidates =
      await this.repo.findFreeAppointmentsAwaitingCompletion(completedAt);

    for (const appointment of candidates) {
      const appointmentEndsAt = new Date(
        appointment.scheduled_at.getTime() +
          appointment.duration_minutes * 60 * 1000,
      );

      if (appointmentEndsAt > completedAt) {
        continue;
      }

      const didComplete = await this.repo.completeFreeAppointmentIfEligible(
        appointment.id,
        completedAt,
      );

      if (didComplete) {
        await this.handleAppointmentCompleted({
          appointmentId: appointment.id,
          userId: appointment.user_id,
          coachId: appointment.coach_id,
          completedAt: completedAt.toISOString(),
        });
      }
    }
  }

  async runRecurringBillingOverdueCron(): Promise<void> {
    await this.recurringCoachingPlanService.runBillingOverdueCron();
  }

  private async runNoShowCleanupCron(now: Date): Promise<void> {
    const eligibleScheduledAt = this.subtractMinutes(
      now,
      COACHING_NO_SHOW_GRACE_MINUTES,
    );
    const candidates =
      await this.repo.findConfirmedAppointmentsPotentiallyNoShow(
        eligibleScheduledAt,
      );

    for (const appointment of candidates) {
      const appointmentEndsAt = new Date(
        appointment.scheduled_at.getTime() +
          appointment.duration_minutes * 60 * 1000,
      );

      if (appointmentEndsAt > eligibleScheduledAt) {
        continue;
      }

      const didMarkNoShow = await this.repo.markAppointmentNoShowIfEligible(
        appointment.id,
        eligibleScheduledAt,
        now,
      );

      if (didMarkNoShow) {
        await this.notifyAppointmentNoShow(appointment.id);
      }
    }
  }

  private async ensureLifecycleJobs(): Promise<void> {
    await this.lifecycleQueue.add(
      COACHING_COMPLETION_JOB,
      {},
      {
        jobId: COACHING_COMPLETION_JOB,
        removeOnComplete: true,
        repeat: {
          cron: '0 * * * *',
          tz: COACHING_LIFECYCLE_TIMEZONE,
        },
      },
    );

    await this.lifecycleQueue.add(
      COACHING_RECURRING_BILLING_OVERDUE_JOB,
      {},
      {
        jobId: COACHING_RECURRING_BILLING_OVERDUE_JOB,
        removeOnComplete: true,
        repeat: {
          cron: '15 * * * *',
          tz: COACHING_LIFECYCLE_TIMEZONE,
        },
      },
    );
  }

  private async queueAppointmentReminder(
    appointmentId: string,
    scheduledAt: Date,
  ): Promise<void> {
    const delay = Math.max(
      0,
      scheduledAt.getTime() -
        COACHING_REMINDER_OFFSET_HOURS * 60 * 60 * 1000 -
        Date.now(),
    );

    await this.lifecycleQueue.add(
      COACHING_REMINDER_JOB,
      { appointmentId },
      {
        delay,
        jobId: `${COACHING_REMINDER_JOB}:${appointmentId}`,
        removeOnComplete: true,
      },
    );

  }

  private async queueNoShowCheck(
    appointmentId: string,
    scheduledAt: Date,
    durationMinutes: number,
  ): Promise<void> {
    const delay = Math.max(
      0,
      scheduledAt.getTime() +
        durationMinutes * 60 * 1000 +
        COACHING_NO_SHOW_GRACE_MINUTES * 60 * 1000 -
        Date.now(),
    );

    await this.lifecycleQueue.add(
      COACHING_NO_SHOW_JOB,
      { appointmentId },
      {
        delay,
        jobId: `${COACHING_NO_SHOW_JOB}:${appointmentId}`,
        removeOnComplete: true,
      },
    );
  }

  private async notifyUserOfCancellation(
    userId: string,
    html: string,
    body: string,
  ): Promise<void> {
    await this.notificationsService.dispatch(
      userId,
      NotificationType.appointment_cancelled,
      {
        title: 'Coaching appointment cancelled',
        body,
        email: {
          subject: 'Coaching appointment cancelled',
          html,
        },
      },
    );
  }

  private buildAppointmentConfirmedHtml(
    appointment: AppointmentNotificationTarget,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Coaching appointment confirmed</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(appointment.user)}, your session with
          <strong>${this.getDisplayName(appointment.coach.user)}</strong> is confirmed.
        </p>
        <p style="color:#555">${this.buildAppointmentWindowLabel(appointment)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private async notifyAppointmentNoShow(appointmentId: string): Promise<void> {
    const appointment =
      await this.repo.findAppointmentNotificationContextByIdOrThrow(
        appointmentId,
      );

    await this.notificationsService.dispatch(
      appointment.user.id,
      NotificationType.system,
      {
        title: 'Coaching appointment marked as no-show',
        body: this.buildAppointmentNoShowBody(appointment),
        data: {
          ...this.buildAppointmentNotificationData(appointment),
          status: AppointmentStatus.no_show,
          notification_kind: 'appointment_no_show',
        },
        email: {
          subject: 'You missed your coaching appointment',
          html: this.buildAppointmentNoShowHtml(appointment),
        },
      },
    );

    if (appointment.coach.user) {
      await this.notificationsService.dispatch(
        appointment.coach.user.id,
        NotificationType.system,
        {
          title: 'Client missed coaching appointment',
          body: `${this.getDisplayName(appointment.user)} missed ${this.buildAppointmentWindowLabel(appointment)}.`,
          data: {
            ...this.buildAppointmentNotificationData(appointment),
            status: AppointmentStatus.no_show,
            notification_kind: 'coach_appointment_no_show',
          },
        },
      );
    }
  }

  private buildAppointmentReminderHtml(
    appointment: AppointmentNotificationTarget,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Coaching appointment reminder</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(appointment.user)}, your session with
          <strong>${this.getDisplayName(appointment.coach.user)}</strong> starts in about 24 hours.
        </p>
        <p style="color:#555">${this.buildAppointmentWindowLabel(appointment)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildAppointmentCancelledHtml(
    appointment: AppointmentNotificationTarget,
    audience: 'member' | 'coach',
  ): string {
    const counterpart =
      audience === 'member'
        ? this.getDisplayName(appointment.coach.user)
        : this.getDisplayName(appointment.user);

    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Coaching appointment cancelled</h2>
        <p style="color:#555">
          Hi ${
            audience === 'member'
              ? this.getDisplayName(appointment.user)
              : this.getDisplayName(appointment.coach.user)
          }, your coaching appointment with <strong>${counterpart}</strong> was cancelled.
        </p>
        <p style="color:#555">${this.buildAppointmentWindowLabel(appointment)}</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildAppointmentCompletedHtml(
    appointment: AppointmentNotificationTarget,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Coaching appointment completed</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(appointment.user)}, your coaching appointment with
          <strong>${this.getDisplayName(appointment.coach.user)}</strong> is marked complete.
        </p>
        <p style="color:#555">You can now leave a review for this session.</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildAppointmentConfirmedBody(
    appointment: AppointmentNotificationTarget,
  ): string {
    return `Your coaching appointment with ${this.getDisplayName(appointment.coach.user)} is confirmed. ${this.buildAppointmentWindowLabel(appointment)}`;
  }

  private buildAppointmentNoShowHtml(
    appointment: AppointmentNotificationTarget,
  ): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Coaching appointment marked as no-show</h2>
        <p style="color:#555">
          Hi ${this.getDisplayName(appointment.user)}, your coaching appointment with
          <strong>${this.getDisplayName(appointment.coach.user)}</strong> was marked as missed.
        </p>
        <p style="color:#555">${this.buildAppointmentWindowLabel(appointment)}</p>
        <p style="color:#555">Open FitTrack Bookings if you need to schedule a new session.</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private buildAppointmentReminderBody(
    appointment: AppointmentNotificationTarget,
  ): string {
    return `Reminder: your coaching appointment with ${this.getDisplayName(appointment.coach.user)} starts in about 24 hours. ${this.buildAppointmentWindowLabel(appointment)}`;
  }

  private buildAppointmentCancelledBody(
    appointment: AppointmentNotificationTarget,
    audience: 'member' | 'coach',
  ): string {
    const counterpart =
      audience === 'member'
        ? this.getDisplayName(appointment.coach.user)
        : this.getDisplayName(appointment.user);

    return `Your coaching appointment with ${counterpart} was cancelled. ${this.buildAppointmentWindowLabel(appointment)}`;
  }

  private buildAppointmentCompletedBody(
    appointment: AppointmentNotificationTarget,
  ): string {
    return `Your coaching appointment with ${this.getDisplayName(appointment.coach.user)} is marked complete. You can now leave a review for this session.`;
  }

  private buildAppointmentConfirmedSms(
    appointment: AppointmentNotificationTarget,
  ): string {
    return `FitTrack: your coaching appointment with ${this.getDisplayName(appointment.coach.user)} is confirmed. ${this.buildAppointmentWindowLabel(appointment)}`;
  }

  private buildAppointmentNoShowBody(
    appointment: AppointmentNotificationTarget,
  ): string {
    return `You missed your coaching appointment with ${this.getDisplayName(appointment.coach.user)}. ${this.buildAppointmentWindowLabel(appointment)} Open FitTrack Bookings if you need to schedule another session.`;
  }

  private buildAppointmentReminderSms(
    appointment: AppointmentNotificationTarget,
  ): string {
    return `FitTrack reminder: your coaching appointment with ${this.getDisplayName(appointment.coach.user)} starts in about 24 hours. ${this.buildAppointmentWindowLabel(appointment)}`;
  }

  private buildAppointmentWindowLabel(
    appointment: AppointmentNotificationTarget,
  ): string {
    const startsAt = new Date(appointment.scheduled_at);
    const endsAt = new Date(
      startsAt.getTime() + appointment.duration_minutes * 60 * 1000,
    );

    return `${this.formatDateTime(startsAt)} to ${this.formatDateTime(endsAt)}.`;
  }

  private buildAppointmentNotificationData(
    appointment: AppointmentNotificationTarget,
  ) {
    return {
      appointment_id: appointment.id,
      scheduled_at: new Date(appointment.scheduled_at).toISOString(),
      duration_minutes: appointment.duration_minutes,
      coach_name: this.getCoachDisplayName(appointment.coach),
    };
  }

  private getCoachDisplayName(
    coach: AppointmentNotificationTarget['coach'],
  ): string {
    return coach.display_name?.trim() || 'Coach profile';
  }

  private getDisplayName(user: AppointmentNotificationUser | null): string {
    const firstName = user?.profile?.first_name ?? 'member';
    const lastName = user?.profile?.last_name ?? '';
    return `${firstName} ${lastName}`.trim();
  }

  private formatDateTime(value: Date): string {
    return new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'long',
      timeStyle: 'short',
      timeZone: COACHING_LIFECYCLE_TIMEZONE,
    }).format(value);
  }

  private subtractMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() - minutes * 60 * 1000);
  }
}
