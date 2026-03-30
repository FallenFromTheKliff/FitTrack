import { NotificationChannel } from '@prisma/client';
import type { Job } from 'bull';

import {
  NOTIFICATION_DELIVERY_FAILED_EVENT,
  NOTIFICATION_DELIVERY_SENT_EVENT,
} from '../../notifications/notification-delivery.events';
import { SmsProcessor, type SendGenericSmsJobData } from './sms.processor';

const createMessage = jest.fn();

describe('SmsProcessor', () => {
  const eventEmitter = {
    emit: jest.fn(),
  };

  let processor: SmsProcessor;

  beforeEach(() => {
    processor = Object.create(SmsProcessor.prototype) as SmsProcessor;
    (processor as unknown as Record<string, unknown>).client = {
      messages: {
        create: createMessage,
      },
    };
    (processor as unknown as Record<string, unknown>).fromNumber =
      '+15555555555';
    (processor as unknown as Record<string, unknown>).eventEmitter =
      eventEmitter;
    (processor as unknown as Record<string, unknown>).logger = {
      log: jest.fn(),
      error: jest.fn(),
    };
    jest.clearAllMocks();
  });

  it('emits a delivery sent event for generic notification-backed sms jobs', async () => {
    await processor.handleSendGeneric({
      id: 'job-1',
      data: {
        to: '+639171234567',
        body: 'FitTrack reminder',
        notification: {
          notification_id: 'notif-sms',
        },
      },
    } as unknown as Job<SendGenericSmsJobData>);

    expect(createMessage).toHaveBeenCalledWith({
      from: '+15555555555',
      to: '+639171234567',
      body: 'FitTrack reminder',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      NOTIFICATION_DELIVERY_SENT_EVENT,
      {
        notificationId: 'notif-sms',
        channel: NotificationChannel.sms,
      },
    );
  });

  it('emits a delivery failed event only after terminal generic sms failures', () => {
    processor.onFailed(
      {
        id: 'job-1',
        name: 'send-generic',
        attemptsMade: 2,
        opts: { attempts: 2 },
        data: {
          notification: {
            notification_id: 'notif-sms',
          },
        },
      } as Job,
      new Error('Twilio timeout'),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      NOTIFICATION_DELIVERY_FAILED_EVENT,
      {
        notificationId: 'notif-sms',
        channel: NotificationChannel.sms,
        error: 'Twilio timeout',
      },
    );
  });
});
