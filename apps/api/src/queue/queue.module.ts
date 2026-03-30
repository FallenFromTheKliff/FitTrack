import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { MailModule } from '../mail/mail.module';
import { MailProcessor } from './processors/mail.processor';
import { SmsProcessor } from './processors/sms.processor';
import { QUEUE_MAIL, QUEUE_SMS } from './queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_MAIL }, { name: QUEUE_SMS }),
    MailModule,
    EventEmitterModule,
  ],
  providers: [MailProcessor, SmsProcessor],
  exports: [BullModule],
})
export class QueueModule {}
