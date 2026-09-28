import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { MailModule } from '../mail/mail.module';
import { MailProcessor } from './processors/mail.processor';
import { QUEUE_MAIL } from './queue.constants';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_MAIL }),
    MailModule,
    EventEmitterModule,
  ],
  providers: [MailProcessor],
  exports: [BullModule],
})
export class QueueModule {}
