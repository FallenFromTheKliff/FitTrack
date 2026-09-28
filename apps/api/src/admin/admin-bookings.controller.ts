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
import {
  ApiBearerAuth,
  ApiGoneResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
    summary: 'Legacy compatibility route; pending booking confirmation is retired.',
  })
  @ApiGoneResponse({
    description:
      'Venue bookings are confirmed by full payment or atomic staff cash registration.',
  })
  confirmBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bookingService.confirmPendingBooking(id, user.sub);
  }

  @Patch(':id/reject')
  @ApiOperation({
    summary: 'Legacy compatibility route; pending booking rejection is retired.',
  })
  @ApiGoneResponse({
    description:
      'Pending commercial booking rejection is no longer an active workflow.',
  })
  rejectBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reason') reason?: string,
  ) {
    return this.bookingService.rejectPendingBooking(id, user.sub, reason);
  }

  @Patch(':id/complete')
  @ApiOperation({
    summary: 'Mark a confirmed venue booking complete from the admin schedule surface.',
  })
  async completeBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.bookingService.completeConfirmedBooking(id, user.sub);
    return null;
  }

  @Patch(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a venue booking from the admin schedule surface.',
  })
  async cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reason') reason?: string,
  ) {
    await this.bookingService.cancelBookingAsStaff(id, user.sub, reason);
    return null;
  }

  @Patch(':id/no-show')
  @ApiOperation({
    summary: 'Mark a confirmed venue booking as no-show from the admin schedule surface.',
  })
  async markNoShow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.bookingService.markBookingNoShowAsStaff(id, user.sub);
    return null;
  }
}
