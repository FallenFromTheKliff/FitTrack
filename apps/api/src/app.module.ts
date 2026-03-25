import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { localEnvFilePath } from '../env-path';

import { UserModule } from './user/user.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminController } from './admin/admin.controller';

import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { VenueModule } from './booking-venue/venue/venue.module';
import { BookingModule } from './booking-venue/booking/booking.module';
import { CoachModule } from './coach-appointment/coach/coach.module';
import { AppointmentModule } from './coach-appointment/appointment/appointment.module';
import { AdminService } from './admin/admin.service';
import { StaffModule } from './staff/staff.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: localEnvFilePath,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 seconds
        limit: 1000, // requests per minute
      },
    ]),

    PrismaModule,
    UserModule,
    AuthModule,
    VenueModule,
    BookingModule,
    CoachModule,
    AppointmentModule,
    StaffModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AdminService,
  ],
  controllers: [AdminController],
})
export class AppModule {}
