import { NotificationChannel } from '@prisma/client';
import type { Job } from 'bull';

import {
  NOTIFICATION_DELIVERY_FAILED_EVENT,
  NOTIFICATION_DELIVERY_SENT_EVENT,
} from '../../notifications/notification-delivery.events';
import { MailProcessor, type SendGenericMailJobData } from './mail.processor';

describe('MailProcessor', () => {
  const mailService = {
    send: jest.fn(),
    sendOtpEmail: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  let processor: MailProcessor;

  beforeEach(() => {
    processor = new MailProcessor(mailService as never, eventEmitter as never);
    jest.clearAllMocks();
  });

  it('emits a delivery sent event for generic notification-backed email jobs', async () => {
    await processor.handleSendGeneric({
      id: 'job-1',
      data: {
        to: 'fit@example.com',
        subject: 'System notice',
        html: '<p>Hello</p>',
        notification: {
          notification_id: 'notif-email',
        },
      },
    } as unknown as Job<SendGenericMailJobData>);

    expect(mailService.send).toHaveBeenCalledWith({
      to: 'fit@example.com',
      subject: 'System notice',
      html: '<p>Hello</p>',
    });
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      NOTIFICATION_DELIVERY_SENT_EVENT,
      {
        notificationId: 'notif-email',
        channel: NotificationChannel.email,
      },
    );
  });

  it('emits a delivery failed event only after terminal generic email failures', () => {
    processor.onFailed(
      {
        id: 'job-1',
        name: 'send-generic',
        attemptsMade: 3,
        opts: { attempts: 3 },
        data: {
          notification: {
            notification_id: 'notif-email',
          },
        },
      } as Job,
      new Error('SMTP timeout'),
    );

    expect(eventEmitter.emit).toHaveBeenCalledWith(
      NOTIFICATION_DELIVERY_FAILED_EVENT,
      {
        notificationId: 'notif-email',
        channel: NotificationChannel.email,
        error: 'SMTP timeout',
      },
    );
  });
});
