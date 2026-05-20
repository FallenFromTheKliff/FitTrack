import {
  Post,
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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators';
import { JwtAuthGuard, RolesGuard } from '../common/guards';
import { BookingService } from '../bookings/booking/booking.service';
import { AppointmentService } from '../coaching/appointment/appointment.service';
import {
  CancelAppointmentDTO,
  CompleteAppointmentDTO,
  RespondAppointmentDTO,
  SetAvailabilityDTO,
  StaffAppointmentFilterDTO,
} from '../coaching/appointment/dto/appointment.dto';
import {
  CreateStandaloneCoachDTO,
  UpdateCoachProfileDTO,
} from '../coaching/coach/dto/coach.dto';
import { CoachService } from '../coaching/coach/coach.service';
import { DateRangeDTO } from '../user/dto/user-dto';
import {
  CreateStaffCoachBookingDTO,
  CreateStaffVenueBookingDTO,
} from './dto/staff-schedule.dto';
import { StaffService } from './staff.service';

@ApiTags('Staff')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.staff, UserRole.admin)
@Controller('staff')
export class StaffController {
  constructor(
    private readonly staffService: StaffService,
    private readonly bookingService: BookingService,
    private readonly appointmentService: AppointmentService,
    private readonly coachService: CoachService,
  ) {}

  @Get('dashboard/stats')
  @ApiOperation({
    summary: 'Get live amenity-booking metrics for the staff dashboard.',
  })
  getDashboardStats() {
    return this.staffService.getDashboardStats();
  }

  @Get('users')
  @ApiOperation({
    summary: 'List user directory records for staff-facing member pages.',
  })
  getAllUsers() {
    return this.staffService.getAllUsers();
  }

  @Get('coaches')
  @ApiOperation({
    summary: 'List coach directory records for staff-facing member pages.',
  })
  getAllCoaches() {
    return this.staffService.getAllCoaches();
  }

  @Post('coaches')
  @ApiOperation({
    summary:
      'Deprecated. Coach profiles are created through coach account creation.',
  })
  createCoach(@Body() dto: CreateStandaloneCoachDTO) {
    return this.coachService.createStandaloneCoach(dto);
  }

  @Get('appointments')
  @ApiOperation({
    summary: 'List coach appointments for staff-owned coaching management.',
  })
  getAllAppointments(@Query() dto: StaffAppointmentFilterDTO) {
    return this.appointmentService.getStaffAppointments(dto);
  }

  @Patch('coaches/:id/availability')
  @ApiOperation({
    summary: 'Replace a coach weekly availability as staff or admin.',
  })
  async replaceCoachAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAvailabilityDTO,
  ) {
    await this.appointmentService.setAvailabilityForCoach(id, dto);
    return null;
  }

  @Patch('coaches/:id')
  @ApiOperation({
    summary:
      'Update coach profile details from the staff coaching management surface.',
  })
  updateCoachProfile(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCoachProfileDTO,
  ) {
    if (user.role === UserRole.admin) {
      return this.coachService.adminUpdateCoach(user.sub, id, dto);
    }

    return this.coachService.updateManagedProfile(id, dto);
  }

  @Get('bookings')
  @ApiOperation({
    summary: 'List live amenity bookings for the staff schedule surface.',
  })
  getAllBookings(@Query() dto: DateRangeDTO) {
    return this.bookingService.getAllBookings(dto);
  }

  @Post('bookings')
  @ApiOperation({
    summary: 'Create a manual venue booking from Gym Operations.',
  })
  createManualBooking(
    @Body() dto: CreateStaffVenueBookingDTO,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bookingService.createStaffManualBooking(
      dto.member_id,
      dto,
      user.sub,
    );
  }

  @Patch('bookings/:id/confirm')
  @ApiOperation({
    summary: 'Confirm a pending booking from the staff schedule surface.',
  })
  confirmBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.bookingService.confirmPendingBooking(id, user.sub);
  }

  @Patch('bookings/:id/reject')
  @ApiOperation({
    summary: 'Reject a pending booking from the staff schedule surface.',
  })
  rejectBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reason') reason?: string,
  ) {
    return this.bookingService.rejectPendingBooking(id, user.sub, reason);
  }

  @Patch('bookings/:id/complete')
  @ApiOperation({
    summary: 'Mark a confirmed venue booking complete from the staff schedule surface.',
  })
  async completeBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.bookingService.completeConfirmedBooking(id, user.sub);
    return null;
  }

  @Patch('bookings/:id/cancel')
  @ApiOperation({
    summary: 'Cancel a venue booking from the staff schedule surface.',
  })
  async cancelBooking(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body('reason') reason?: string,
  ) {
    await this.bookingService.cancelBookingAsStaff(id, user.sub, reason);
    return null;
  }

  @Patch('bookings/:id/no-show')
  @ApiOperation({
    summary: 'Mark a confirmed venue booking as no-show from the staff schedule surface.',
  })
  async markBookingNoShow(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.bookingService.markBookingNoShowAsStaff(id, user.sub);
    return null;
  }

  @Post('appointments')
  @ApiOperation({
    summary: 'Create a confirmed manual coach booking from Gym Operations.',
  })
  createManualAppointment(
    @Body() dto: CreateStaffCoachBookingDTO,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.appointmentService.createStaffManualAppointment(
      dto.member_id,
      dto,
      user.sub,
    );
  }

  @Patch('appointments/:id/respond')
  @ApiOperation({
    summary:
      'Accept or reject a pending coaching appointment as staff or admin.',
  })
  respondToAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RespondAppointmentDTO,
  ) {
    return this.appointmentService.respondToAppointmentAsStaff(
      user.sub,
      id,
      dto,
    );
  }

  @Patch('appointments/:id/complete')
  @ApiOperation({
    summary: 'Mark a coaching appointment complete as staff or admin.',
  })
  completeAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CompleteAppointmentDTO,
  ) {
    return this.appointmentService.completeAppointmentAsStaff(
      user.sub,
      id,
      dto,
    );
  }

  @Patch('appointments/:id/coach-payout')
  @ApiOperation({
    summary: 'Mark a completed coaching appointment payout as paid.',
  })
  markCoachPayoutPaid(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.appointmentService.markCoachPayoutPaid(user.sub, id);
  }

  @Patch('appointments/:id/cancel')
  @ApiOperation({
    summary: 'Cancel a coaching appointment as staff or admin.',
  })
  async cancelAppointment(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CancelAppointmentDTO,
  ) {
    await this.appointmentService.cancelAppointment(
      user.sub,
      user.role,
      id,
      dto,
    );
    return {
      message: 'Appointment cancelled. Paid downpayments are non-refundable.',
    };
  }
}
