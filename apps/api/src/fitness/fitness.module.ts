import { Module } from '@nestjs/common';

import { ExerciseModule } from './exercise/exercise.module';
import { GamificationModule } from './gamification/gamification.module';
import { PoseModule } from './pose/pose.module';
import { WorkoutSessionModule } from './session/session.module';
import { TrainingPlanModule } from './training-plan/training-plan.module';

@Module({
  imports: [
    ExerciseModule,
    GamificationModule,
    TrainingPlanModule,
    WorkoutSessionModule,
    PoseModule,
  ],
  exports: [
    ExerciseModule,
    GamificationModule,
    TrainingPlanModule,
    WorkoutSessionModule,
    PoseModule,
  ],
})
export class FitnessModule {}
