import { forwardRef, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AiModule } from '../ai/ai.module';
import { UserModule } from '../user/user.module';
import { NutritionController } from './nutrition.controller';
import { NutritionRepository } from './nutrition.repository';
import { NutritionService } from './nutrition.service';

@Module({
  imports: [EventEmitterModule, UserModule, forwardRef(() => AiModule)],
  controllers: [NutritionController],
  providers: [NutritionService, NutritionRepository],
  exports: [NutritionService],
})
export class NutritionModule {}
