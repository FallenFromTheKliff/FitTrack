import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';

import { MembershipModule } from '../../membership/membership.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { QueueModule } from '../../queue/queue.module';
import { UserModule } from '../../user/user.module';
import { GamificationAdminController } from './gamification-admin.controller';
import { GamificationController } from './gamification.controller';
import { GamificationLifecycleService } from './gamification-lifecycle.service';
import { GamificationRepository } from './gamification.repository';
import { GamificationSeasonLifecycleProcessor } from './gamification-season-lifecycle.processor';
import { GamificationSeasonLifecycleService } from './gamification-season-lifecycle.service';
import { GAMIFICATION_SEASON_LIFECYCLE_QUEUE } from './gamification-season.constants';
import { GamificationService } from './gamification.service';

@Module({
  imports: [
    UserModule,
    NotificationsModule,
    MembershipModule,
    QueueModule,
    BullModule.registerQueue({ name: GAMIFICATION_SEASON_LIFECYCLE_QUEUE }),
  ],
  controllers: [GamificationController, GamificationAdminController],
  providers: [
    GamificationService,
    GamificationLifecycleService,
    GamificationRepository,
    GamificationSeasonLifecycleService,
    GamificationSeasonLifecycleProcessor,
  ],
  exports: [GamificationService],
})
export class GamificationModule {}
