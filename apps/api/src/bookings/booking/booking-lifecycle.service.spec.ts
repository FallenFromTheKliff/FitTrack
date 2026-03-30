import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { NotificationsService } from '../../notifications/notifications.service';
import { BookingRepository } from './booking.repository';
import {
  BOOKING_COMPLETION_JOB,
  BOOKING_LIFECYCLE_QUEUE,
  BOOKING_LIFECYCLE_TIMEZONE,
  BOOKING_NO_SHOW_JOB,
  BOOKING_PENDING_CLEANUP_JOB,
} from './booking.constants';
import { BookingLifecycleService } from './booking-lifecycle.service';
import { BOOKING_CANCELLED_EVENT } from './events/booking-cancelled.event';

describe('BookingLifecycleService', () => {
  let service: BookingLifecycleService;

  const repo = {
    findBookingNotificationContextByIdOrThrow: jest.fn(),
    findStalePendingBookings: jest.fn(),
    cancelPendingBookingIfStale: jest.fn(),
    completePastFreeBookings: jest.fn(),
    markBookingNoShowIfEligible: jest.fn(),
  };

  const notificationsService = {
    dispatch: jest.fn(),
  };

  const lifecycleQueue = {
    add: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingLifecycleService,
        { provide: BookingRepository, useValue: repo },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: getQueueToken(BOOKING_LIFECYCLE_QUEUE),
          useValue: lifecycleQueue,
        },
      ],
    }).compile();

    service = module.get<BookingLifecycleService>(BookingLifecycleService);
    jest.clearAllMocks();
  });

  it('registers repeatable cleanup and completion jobs on module init', async () => {
    await service.onModuleInit();

    expect(lifecycleQueue.add).toHaveBeenNthCalledWith(
      1,
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
    expect(lifecycleQueue.add).toHaveBeenNthCalledWith(
      2,
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
  });

  it('queues a no-show check and dispatches booking_confirmed when a booking is confirmed', async () => {
    repo.findBookingNotificationContextByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      starts_at: new Date('2099-03-24T10:00:00.000Z'),
      ends_at: new Date('2099-03-24T11:00:00.000Z'),
      amenity: { name: 'Main Court' },
      user: {
        id: 'user-1',
        auth_identities: [
          { identifier: 'member@example.com', provider: 'email' },
        ],
        notification_prefs: {
          booking_confirmed_email: true,
          booking_confirmed_sms: true,
        },
        profile: {
          first_name: 'Jamie',
          last_name: 'Rivera',
          phone: '+639171234567',
        },
      },
    });

    await service.handleBookingConfirmed({
      bookingId: 'booking-1',
      userId: 'member-1',
      amenityId: 'amenity-1',
      startsAt: '2099-03-24T10:00:00.000Z',
      endsAt: '2099-03-24T11:00:00.000Z',
    });

    expect(lifecycleQueue.add).toHaveBeenCalledWith(
      BOOKING_NO_SHOW_JOB,
      { bookingId: 'booking-1' },
      expect.objectContaining({
        jobId: `${BOOKING_NO_SHOW_JOB}:booking-1`,
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

    expect(confirmedDispatchArgs?.[0]).toBe('user-1');
    expect(confirmedDispatchArgs?.[1]).toBe(NotificationType.booking_confirmed);
    expect(confirmedDispatchArgs?.[2].title).toBe('Booking confirmed');
    expect(confirmedDispatchArgs?.[2].email?.subject).toBe(
      'Booking confirmed for Main Court',
    );
    expect(confirmedDispatchArgs?.[2].sms?.body).toContain(
      'Main Court booking is confirmed',
    );
  });

  it('dispatches booking_cancelled when a booking is cancelled', async () => {
    repo.findBookingNotificationContextByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      starts_at: new Date('2099-03-24T10:00:00.000Z'),
      ends_at: new Date('2099-03-24T11:00:00.000Z'),
      amenity: { name: 'Main Court' },
      user: {
        id: 'user-1',
        auth_identities: [
          { identifier: 'member@example.com', provider: 'email' },
        ],
        notification_prefs: {
          booking_cancelled_email: true,
        },
        profile: {
          first_name: 'Jamie',
          last_name: 'Rivera',
        },
      },
    });

    await service.handleBookingCancelled({
      bookingId: 'booking-1',
      userId: 'member-1',
      amenityId: 'amenity-1',
      cancelledAt: new Date().toISOString(),
    });

    const cancelledDispatchArgs = notificationsService.dispatch.mock
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

    expect(cancelledDispatchArgs?.[0]).toBe('user-1');
    expect(cancelledDispatchArgs?.[1]).toBe(NotificationType.booking_cancelled);
    expect(cancelledDispatchArgs?.[2].title).toBe('Booking cancelled');
    expect(cancelledDispatchArgs?.[2].email?.subject).toBe(
      'Booking cancelled for Main Court',
    );
  });

  it('cancels stale pending bookings and emits booking.cancelled for successful updates', async () => {
    repo.findStalePendingBookings.mockResolvedValue([
      {
        id: 'booking-1',
        user_id: 'member-1',
        amenity_id: 'amenity-1',
      },
    ]);
    repo.cancelPendingBookingIfStale.mockResolvedValue(true);

    await service.runPendingCleanupCron();

    expect(repo.cancelPendingBookingIfStale).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Date),
      expect.any(Date),
    );
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      BOOKING_CANCELLED_EVENT,
      expect.objectContaining({
        bookingId: 'booking-1',
        userId: 'member-1',
        amenityId: 'amenity-1',
      }),
    );
  });

  it('marks confirmed bookings as no_show only after the grace window and dispatches booking_no_show', async () => {
    repo.markBookingNoShowIfEligible.mockResolvedValue(true);
    repo.findBookingNotificationContextByIdOrThrow.mockResolvedValue({
      id: 'booking-1',
      starts_at: new Date('2099-03-24T10:00:00.000Z'),
      ends_at: new Date('2099-03-24T11:00:00.000Z'),
      amenity: { name: 'Main Court' },
      user: {
        id: 'user-1',
        auth_identities: [
          { identifier: 'member@example.com', provider: 'email' },
        ],
        notification_prefs: {
          booking_no_show_email: true,
        },
        profile: {
          first_name: 'Jamie',
          last_name: 'Rivera',
        },
      },
    });

    await service.runNoShowCheck('booking-1');

    expect(repo.markBookingNoShowIfEligible).toHaveBeenCalledWith(
      'booking-1',
      expect.any(Date),
    );
    const noShowDispatchArgs = notificationsService.dispatch.mock.calls[0] as
      | [
          string,
          NotificationType,
          {
            title: string;
            email?: { subject: string };
          },
        ]
      | undefined;

    expect(noShowDispatchArgs?.[0]).toBe('user-1');
    expect(noShowDispatchArgs?.[1]).toBe(NotificationType.booking_no_show);
    expect(noShowDispatchArgs?.[2].title).toBe('Booking marked as no-show');
    expect(noShowDispatchArgs?.[2].email?.subject).toBe(
      'Booking marked as no-show for Main Court',
    );
  });

  it('completes past free bookings during the hourly completion cron', async () => {
    repo.completePastFreeBookings.mockResolvedValue(1);

    await service.runCompletionCron();

    expect(repo.completePastFreeBookings).toHaveBeenCalledWith(
      expect.any(Date),
    );
  });
});
