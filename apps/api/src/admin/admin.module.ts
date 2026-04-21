import { Module } from '@nestjs/common';

import { BookingsModule } from '../bookings/bookings.module';
import { AdminBookingsController } from './admin-bookings.controller';
import { AdminDeletionRequestsController } from './admin-deletion-requests.controller';
import { AdminDeletionRequestsService } from './admin-deletion-requests.service';
import { AdminRoleManagementController } from './admin-role-management.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from 'prisma/prisma.service';

@Module({
  imports: [BookingsModule],
  controllers: [
    AdminBookingsController,
    AdminDeletionRequestsController,
    AdminRoleManagementController,
    AdminUsersController,
  ],
  providers: [AdminDeletionRequestsService, AdminUsersService, PrismaService],
  exports: [AdminDeletionRequestsService],
})
export class AdminModule {}
