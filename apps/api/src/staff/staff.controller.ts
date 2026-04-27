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
import { UpdateCoachProfileDTO } from '../coaching/coach/dto/coach.dto';
import { CoachService } from '../coaching/coach/coach.service';
import { DateRangeDTO } from '../user/dto/user-dto';
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCoachProfileDTO,
  ) {
    return this.coachService.updateManagedProfile(id, dto);
  }

  @Get('bookings')
  @ApiOperation({
    summary: 'List live amenity bookings for the staff schedule surface.',
  })
  getAllBookings(@Query() dto: DateRangeDTO) {
    return this.bookingService.getAllBookings(dto);
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
