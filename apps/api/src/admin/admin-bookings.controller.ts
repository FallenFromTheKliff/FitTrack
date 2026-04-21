import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { CurrentUser, Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { BookingService } from '../bookings/booking/booking.service';
import { DateRangeDTO } from '../user/dto/user-dto';

@ApiTags('Admin')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.admin)
@Controller('admin/bookings')
export class AdminBookingsController {
  constructor(private readonly bookingService: BookingService) {}

  @Get()
  @ApiOperation({
    summary: 'List live amenity bookings for admin schedule compatibility.',
  })
  getAllBookings(@Query() dto: DateRangeDTO) {
    return this.bookingService.getAllBookings(dto);
  }

  @Patch(':id/confirm')
  @ApiOperation({
    summary: 'Confirm a pending booking from the admin schedule surface.',
  })
  confirmBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bookingService.confirmPendingBooking(id, user.sub);
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Reject a pending booking from the admin schedule surface.',
  })
  rejectBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reason') reason?: string,
  ) {
    return this.bookingService.rejectPendingBooking(id, user.sub, reason);
  }
}
