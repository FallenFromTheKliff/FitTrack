import { forwardRef, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AiModule } from '../ai/ai.module';
import { ActiveMemberAccountGuard } from '../common/guards/active-member-account.guard';
import { MembershipModule } from '../membership/membership.module';
import { UserModule } from '../user/user.module';
import { NutritionController } from './nutrition.controller';
import { NutritionRepository } from './nutrition.repository';
import { NutritionService } from './nutrition.service';

@Module({
  imports: [
    EventEmitterModule,
    UserModule,
    MembershipModule,
    forwardRef(() => AiModule),
  ],
  controllers: [NutritionController],
  providers: [NutritionService, NutritionRepository, ActiveMemberAccountGuard],
  exports: [NutritionService],
})
export class NutritionModule {}
