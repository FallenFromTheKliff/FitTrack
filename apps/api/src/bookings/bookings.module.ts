import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { MembershipModule } from '../membership/membership.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueueModule } from '../queue/queue.module';

import { AmenityController } from './amenity/amenity.controller';
import { AmenityRepository } from './amenity/amenity.repository';
import { AmenityService } from './amenity/amenity.service';
import { BookingController } from './booking/booking.controller';
import { BookingLifecycleProcessor } from './booking/booking-lifecycle.processor';
import { BookingLifecycleService } from './booking/booking-lifecycle.service';
import { BOOKING_LIFECYCLE_QUEUE } from './booking/booking.constants';
import { BookingRepository } from './booking/booking.repository';
import { BookingService } from './booking/booking.service';

@Module({
  imports: [
    MembershipModule,
    EventEmitterModule,
    NotificationsModule,
    QueueModule,
    BullModule.registerQueue({ name: BOOKING_LIFECYCLE_QUEUE }),
  ],
  controllers: [BookingController, AmenityController],
  providers: [
    AmenityService,
    AmenityRepository,
    BookingService,
    BookingRepository,
    BookingLifecycleService,
    BookingLifecycleProcessor,
  ],
  exports: [AmenityService, BookingService],
})
export class BookingsModule {}
