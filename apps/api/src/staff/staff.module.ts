import { Module } from '@nestjs/common';

import { BookingsModule } from '../bookings/bookings.module';
import { CoachingModule } from '../coaching/coaching.module';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

@Module({
  imports: [BookingsModule, CoachingModule],
  controllers: [StaffController],
  providers: [StaffService],
  exports: [StaffService],
})
export class StaffModule {}
