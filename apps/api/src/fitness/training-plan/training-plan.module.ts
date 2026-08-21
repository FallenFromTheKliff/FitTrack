import { Module } from '@nestjs/common';

import { CoachingModule } from '../../coaching/coaching.module';
import { TrainingPlanController } from './training-plan.controller';
import { TrainingPlanRepository } from './training-plan.repository';
import { TrainingPlanService } from './training-plan.service';

@Module({
  imports: [CoachingModule],
  controllers: [TrainingPlanController],
  providers: [TrainingPlanService, TrainingPlanRepository],
  exports: [TrainingPlanService],
})
export class TrainingPlanModule {}
