import { Module } from '@nestjs/common';

import { MembershipModule } from '../../membership/membership.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { UserModule } from '../../user/user.module';
import { GamificationController } from './gamification.controller';
import { GamificationLifecycleService } from './gamification-lifecycle.service';
import { GamificationRepository } from './gamification.repository';
import { GamificationService } from './gamification.service';

@Module({
  imports: [UserModule, NotificationsModule, MembershipModule],
  controllers: [GamificationController],
  providers: [
    GamificationService,
    GamificationLifecycleService,
    GamificationRepository,
  ],
  exports: [GamificationService],
})
export class GamificationModule {}
