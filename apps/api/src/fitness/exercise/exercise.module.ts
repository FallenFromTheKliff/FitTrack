import { Module } from '@nestjs/common';

import { ExerciseController } from './exercise.controller';
import { ExerciseRepository } from './exercise.repository';
import { ExerciseService } from './exercise.service';

@Module({
  controllers: [ExerciseController],
  providers: [ExerciseService, ExerciseRepository],
  exports: [ExerciseService],
})
export class ExerciseModule {}
