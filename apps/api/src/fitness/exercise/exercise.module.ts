import { Module } from '@nestjs/common';

import { UserModule } from '../../user/user.module';
import { ExerciseController } from './exercise.controller';
import { ExerciseRepository } from './exercise.repository';
import { ExerciseService } from './exercise.service';

@Module({
  imports: [UserModule],
  controllers: [ExerciseController],
  providers: [ExerciseService, ExerciseRepository],
  exports: [ExerciseService],
})
export class ExerciseModule {}
