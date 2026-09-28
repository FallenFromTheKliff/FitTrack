import { getQueueToken } from '@nestjs/bull';
import { NotificationType } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { NotificationsService } from '../../notifications/notifications.service';
import { RecurringCoachingPlanService } from '../recurring-plan/recurring-coaching-plan.service';
import { AppointmentRepository } from './appointment.repository';
import {
  COACHING_COMPLETION_JOB,
  COACHING_LIFECYCLE_QUEUE,
  COACHING_LIFECYCLE_TIMEZONE,
  COACHING_NO_SHOW_JOB,
  COACHING_REMINDER_JOB,
} from './appointment.constants';
import { AppointmentLifecycleService } from './appointment-lifecycle.service';

describe('AppointmentLifecycleService', () => {
  let service: AppointmentLifecycleService;

  const repo = {
    findAppointmentNotificationContextByIdOrThrow: jest.fn(),
    markAppointmentNoShowIfEligible: jest.fn(),
    findConfirmedAppointmentsPotentiallyNoShow: jest.fn(),
    findFreeAppointmentsAwaitingCompletion: jest.fn(),
    completeFreeAppointmentIfEligible: jest.fn(),
  };

  const notificationsService = {
    dispatch: jest.fn(),
  };

  const lifecycleQueue = {
    add: jest.fn(),
  };

  const recurringCoachingPlanService = {
    runBillingOverdueCron: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentLifecycleService,
        { provide: AppointmentRepository, useValue: repo },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: RecurringCoachingPlanService,
          useValue: recurringCoachingPlanService,
        },
        {
          provide: getQueueToken(COACHING_LIFECYCLE_QUEUE),
          useValue: lifecycleQueue,
        },
      ],
    }).compile();

    service = module.get<AppointmentLifecycleService>(
      AppointmentLifecycleService,
    );
    jest.clearAllMocks();
  });

  it('registers the repeatable completion cleanup job on module init', async () => {
    await service.onModuleInit();

    expect(lifecycleQueue.add).toHaveBeenCalledWith(
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
  });

  it('queues lifecycle checks and dispatches appointment_confirmed when an appointment is confirmed', async () => {
    repo.findAppointmentNotificationContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      status: 'confirmed',
      scheduled_at: '2099-03-24T10:00:00.000Z',
      duration_minutes: 60,
      user: {
        id: 'member-1',
        auth_identities: [
          { identifier: 'member@example.com', provider: 'email' },
        ],
        notification_prefs: {
          appointment_confirmed_email: true,
          appointment_confirmed_sms: true,
          coach_appointment_reminder_email: true,
        },
        profile: {
          first_name: 'Jamie',
          last_name: 'Rivera',
          phone: '+639171234567',
        },
      },
      coach: {
        user: {
          id: 'coach-user-1',
          auth_identities: [
            { identifier: 'coach@example.com', provider: 'email' },
          ],
          notification_prefs: {
            appointment_confirmed_email: true,
            appointment_confirmed_sms: true,
          },
          profile: {
            first_name: 'Maria',
            last_name: 'Santos',
            phone: '+639179999999',
          },
        },
      },
    });

    await service.handleAppointmentConfirmed({
      appointmentId: 'appt-1',
      userId: 'member-1',
      coachId: 'coach-1',
      scheduledAt: '2099-03-24T10:00:00.000Z',
      durationMinutes: 60,
    });

    expect(lifecycleQueue.add).toHaveBeenCalledWith(
      COACHING_NO_SHOW_JOB,
      { appointmentId: 'appt-1' },
      expect.objectContaining({
        jobId: `${COACHING_NO_SHOW_JOB}:appt-1`,
        removeOnComplete: true,
      }),
    );
    expect(lifecycleQueue.add).toHaveBeenCalledWith(
      COACHING_REMINDER_JOB,
      { appointmentId: 'appt-1' },
      expect.objectContaining({
        jobId: `${COACHING_REMINDER_JOB}:appt-1`,
        removeOnComplete: true,
      }),
    );
    const confirmedDispatchArgs = notificationsService.dispatch.mock
      .calls[0] as
      | [
          string,
          NotificationType,
          {
            title: string;
            email?: { subject: string };
            sms?: { body: string };
          },
        ]
      | undefined;

    expect(confirmedDispatchArgs?.[0]).toBe('member-1');
    expect(confirmedDispatchArgs?.[1]).toBe(
      NotificationType.appointment_confirmed,
    );
    expect(confirmedDispatchArgs?.[2].title).toBe(
      'Coaching appointment confirmed',
    );
    expect(confirmedDispatchArgs?.[2].email?.subject).toBe(
      'Coaching appointment confirmed',
    );
    expect(confirmedDispatchArgs?.[2].sms?.body).toContain(
      'coaching appointment with Maria Santos',
    );
  });

  it('dispatches appointment_reminder for a future confirmed appointment', async () => {
    repo.findAppointmentNotificationContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      status: 'confirmed',
      scheduled_at: '2099-03-24T10:00:00.000Z',
      duration_minutes: 60,
      user: {
        id: 'member-1',
        auth_identities: [
          { identifier: 'member@example.com', provider: 'email' },
        ],
        notification_prefs: {
          coach_appointment_reminder_email: true,
        },
        profile: {
          first_name: 'Jamie',
          last_name: 'Rivera',
        },
      },
      coach: {
        display_name: 'Maria Santos',
        user: {
          id: 'coach-user-1',
          auth_identities: [],
          notification_prefs: {},
          profile: {
            first_name: 'Maria',
            last_name: 'Santos',
          },
        },
      },
    });

    await service.runAppointmentReminder('appt-1');

    expect(notificationsService.dispatch).toHaveBeenCalledWith(
      'member-1',
      NotificationType.appointment_reminder,
      expect.objectContaining({
        title: 'Coaching appointment reminder',
      }),
    );
  });

  it('skips appointment_reminder for a cancelled appointment', async () => {
    repo.findAppointmentNotificationContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      status: 'cancelled',
      scheduled_at: '2099-03-24T10:00:00.000Z',
      duration_minutes: 60,
      user: {
        id: 'member-1',
        auth_identities: [],
        notification_prefs: {
          coach_appointment_reminder_email: true,
        },
        profile: {
          first_name: 'Jamie',
          last_name: 'Rivera',
        },
      },
      coach: {
        display_name: 'Maria Santos',
        user: null,
      },
    });

    await service.runAppointmentReminder('appt-1');

    expect(notificationsService.dispatch).not.toHaveBeenCalled();
  });

  it('marks confirmed appointments as no_show only after the grace window', async () => {
    repo.markAppointmentNoShowIfEligible.mockResolvedValue(true);
    repo.findAppointmentNotificationContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      scheduled_at: '2000-03-24T10:00:00.000Z',
      duration_minutes: 60,
      user: {
        id: 'member-1',
        auth_identities: [],
        notification_prefs: {},
        profile: {
          first_name: 'Jamie',
          last_name: 'Rivera',
        },
      },
      coach: {
        display_name: 'Maria Santos',
        user: {
          id: 'coach-user-1',
          auth_identities: [],
          notification_prefs: {},
          profile: {
            first_name: 'Maria',
            last_name: 'Santos',
          },
        },
      },
    });

    await service.runNoShowCheck('appt-1');

    expect(repo.markAppointmentNoShowIfEligible).toHaveBeenCalledWith(
      'appt-1',
      expect.any(Date),
      expect.any(Date),
    );
    expect(notificationsService.dispatch).toHaveBeenCalledWith(
      'member-1',
      NotificationType.system,
      expect.objectContaining({
        title: 'Coaching appointment marked as no-show',
      }),
    );
  });

  it('auto-completes past free appointments and dispatches appointment_completed to the member', async () => {
    repo.findConfirmedAppointmentsPotentiallyNoShow.mockResolvedValue([]);
    repo.findFreeAppointmentsAwaitingCompletion.mockResolvedValue([
      {
        id: 'appt-1',
        user_id: 'member-1',
        coach_id: 'coach-1',
        scheduled_at: new Date('2000-03-24T10:00:00.000Z'),
        duration_minutes: 60,
      },
    ]);
    repo.completeFreeAppointmentIfEligible.mockResolvedValue(true);
    repo.findAppointmentNotificationContextByIdOrThrow.mockResolvedValue({
      id: 'appt-1',
      scheduled_at: '2000-03-24T10:00:00.000Z',
      duration_minutes: 60,
      user: {
        id: 'member-1',
        auth_identities: [
          { identifier: 'member@example.com', provider: 'email' },
        ],
        notification_prefs: {
          appointment_completed_email: true,
        },
        profile: {
          first_name: 'Jamie',
          last_name: 'Rivera',
        },
      },
      coach: {
        user: {
          id: 'coach-user-1',
          auth_identities: [
            { identifier: 'coach@example.com', provider: 'email' },
          ],
          notification_prefs: {
            appointment_completed_email: true,
          },
          profile: {
            first_name: 'Maria',
            last_name: 'Santos',
          },
        },
      },
    });

    await service.runCompletionCron();

    expect(repo.completeFreeAppointmentIfEligible).toHaveBeenCalledWith(
      'appt-1',
      expect.any(Date),
    );
    const completedDispatchArgs = notificationsService.dispatch.mock
      .calls[0] as
      | [
          string,
          NotificationType,
          {
            title: string;
            email?: { subject: string };
          },
        ]
      | undefined;

    expect(completedDispatchArgs?.[0]).toBe('member-1');
    expect(completedDispatchArgs?.[1]).toBe(
      NotificationType.appointment_completed,
    );
    expect(completedDispatchArgs?.[2].title).toBe(
      'Coaching appointment completed',
    );
    expect(completedDispatchArgs?.[2].email?.subject).toBe(
      'Coaching appointment completed',
    );
  });
});
