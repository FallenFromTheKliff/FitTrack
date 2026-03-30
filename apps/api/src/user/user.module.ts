import { forwardRef, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { MembershipModule } from '../membership/membership.module';
import { UserController, AttendanceController } from './user.controller';
import { UserService, AttendanceService } from './user.service';
import { UserRepository } from './user.repository';

@Module({
  imports: [
    EventEmitterModule,
    AuthModule,
    forwardRef(() => MembershipModule),
    FilesModule,
  ],
  controllers: [UserController, AttendanceController],
  providers: [UserService, AttendanceService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
