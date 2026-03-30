import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { MembershipModule } from '../membership/membership.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';
import { AppointmentController } from './appointment/appointment.controller';
import { AppointmentLifecycleProcessor } from './appointment/appointment-lifecycle.processor';
import { AppointmentLifecycleService } from './appointment/appointment-lifecycle.service';
import { COACHING_LIFECYCLE_QUEUE } from './appointment/appointment.constants';
import { AppointmentRepository } from './appointment/appointment.repository';
import { AppointmentService } from './appointment/appointment.service';
import { CoachController } from './coach/coach.controller';
import { CoachRepository } from './coach/coach.repository';
import { CoachService } from './coach/coach.service';
import { RelationshipController } from './relationship/relationship.controller';
import { RelationshipLifecycleService } from './relationship/relationship-lifecycle.service';
import { RelationshipRepository } from './relationship/relationship.repository';
import { RelationshipService } from './relationship/relationship.service';

@Module({
  imports: [
    MembershipModule,
    EventEmitterModule,
    NotificationsModule,
    QueueModule,
    BullModule.registerQueue({ name: COACHING_LIFECYCLE_QUEUE }),
  ],
  controllers: [CoachController, AppointmentController, RelationshipController],
  providers: [
    CoachService,
    CoachRepository,
    AppointmentService,
    AppointmentRepository,
    AppointmentLifecycleService,
    AppointmentLifecycleProcessor,
    RelationshipService,
    RelationshipRepository,
    RelationshipLifecycleService,
  ],
  exports: [CoachService, AppointmentService, RelationshipService],
})
export class CoachingModule {}
