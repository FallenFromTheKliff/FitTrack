import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { MembershipModule } from '../../membership/membership.module';
import { WorkoutSessionController } from './session.controller';
import { WorkoutSessionLifecycleProcessor } from './session-lifecycle.processor';
import { WorkoutSessionLifecycleService } from './session-lifecycle.service';
import { FITNESS_SESSION_LIFECYCLE_QUEUE } from './session.constants';
import { WorkoutSessionRepository } from './session.repository';
import { WorkoutSessionService } from './session.service';

@Module({
  imports: [
    EventEmitterModule,
    MembershipModule,
    BullModule.registerQueue({ name: FITNESS_SESSION_LIFECYCLE_QUEUE }),
  ],
  controllers: [WorkoutSessionController],
  providers: [
    WorkoutSessionService,
    WorkoutSessionRepository,
    WorkoutSessionLifecycleService,
    WorkoutSessionLifecycleProcessor,
  ],
  exports: [WorkoutSessionService],
})
export class WorkoutSessionModule {}
