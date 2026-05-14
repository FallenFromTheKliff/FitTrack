import { getQueueToken } from '@nestjs/bull';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';

import { NotificationsService } from '../../notifications/notifications.service';
import { BookingRepository } from './booking.repository';
import {
  BOOKING_LIFECYCLE_QUEUE,
  BOOKING_NO_SHOW_JOB,
  BOOKING_REMINDER_JOB,
} from './booking.constants';
import { BookingLifecycleService } from './booking-lifecycle.service';
import {
  BOOKING_CANCELLED_EVENT,
  BookingCancelledEvent,
} from './events/booking-cancelled.event';
import {
  BOOKING_CONFIRMED_EVENT,
  BookingConfirmedEvent,
} from './events/booking-confirmed.event';

function flushAsyncEvents(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(() => resolve());
  });
}

describe('Booking lifecycle integration', () => {
  let moduleRef: TestingModule;
  let eventEmitter: EventEmitter2;

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

  beforeEach(async () => {
    jest.clearAllMocks();

    moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot({ wildcard: false, delimiter: '.' }),
      ],
      providers: [
        BookingLifecycleService,
        { provide: BookingRepository, useValue: repo },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: getQueueToken(BOOKING_LIFECYCLE_QUEUE),
          useValue: lifecycleQueue,
        },
      ],
    }).compile();

    await moduleRef.init();
    eventEmitter = moduleRef.get(EventEmitter2);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await moduleRef.close();
  });

  it('reacts to booking.confirmed by scheduling lifecycle jobs and dispatching booking_confirmed', async () => {
    repo.findBookingNotificationContextByIdOrThrow.mockResolvedValue(
      createBookingNotificationContext(),
    );

    eventEmitter.emit(BOOKING_CONFIRMED_EVENT, createBookingConfirmedEvent());
    await flushAsyncEvents();

    expect(lifecycleQueue.add).toHaveBeenCalledWith(
      BOOKING_NO_SHOW_JOB,
      { bookingId: 'booking-1' },
      expect.objectContaining({
        jobId: `${BOOKING_NO_SHOW_JOB}:booking-1`,
        removeOnComplete: true,
      }),
    );
    expect(lifecycleQueue.add).toHaveBeenCalledWith(
      BOOKING_REMINDER_JOB,
      { bookingId: 'booking-1' },
      expect.objectContaining({
        jobId: `${BOOKING_REMINDER_JOB}:booking-1`,
        removeOnComplete: true,
      }),
    );
    expect(notificationsService.dispatch).toHaveBeenCalledWith(
      'user-1',
      NotificationType.booking_confirmed,
      expect.objectContaining({
        title: 'Booking confirmed',
      }),
    );
  });

  it('reacts to booking.cancelled by dispatching booking_cancelled', async () => {
    repo.findBookingNotificationContextByIdOrThrow.mockResolvedValue(
      createBookingNotificationContext(),
    );

    eventEmitter.emit(BOOKING_CANCELLED_EVENT, createBookingCancelledEvent());
    await flushAsyncEvents();

    expect(notificationsService.dispatch).toHaveBeenCalledWith(
      'user-1',
      NotificationType.booking_cancelled,
      expect.objectContaining({
        title: 'Booking cancelled',
      }),
    );
  });
});

function createBookingNotificationContext() {
  return {
    id: 'booking-1',
    status: 'confirmed',
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
        venue_booking_reminder_email: true,
      },
      profile: {
        first_name: 'Jamie',
        last_name: 'Rivera',
        phone: '+639171234567',
      },
    },
  };
}

function createBookingConfirmedEvent(
  overrides: Partial<BookingConfirmedEvent> = {},
): BookingConfirmedEvent {
  return {
    bookingId: 'booking-1',
    userId: 'member-1',
    amenityId: 'amenity-1',
    startsAt: '2099-03-24T10:00:00.000Z',
    endsAt: '2099-03-24T11:00:00.000Z',
    ...overrides,
  };
}

function createBookingCancelledEvent(
  overrides: Partial<BookingCancelledEvent> = {},
): BookingCancelledEvent {
  return {
    bookingId: 'booking-1',
    userId: 'member-1',
    amenityId: 'amenity-1',
    cancelledAt: '2026-03-24T00:00:00.000Z',
    ...overrides,
  };
}
