import { forwardRef, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { QueueModule } from '../queue/queue.module';
import { UserModule } from '../user/user.module';
import { NotificationDomainEventsListener } from './notification-domain-events.listener';
import { NotificationsController } from './notifications.controller';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [EventEmitterModule, forwardRef(() => UserModule), QueueModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    NotificationDomainEventsListener,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
