// Updated AdminController with staff management
// File: src/admin/admin.controller.ts

import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard/roles.guard';
import { Roles } from 'src/auth/roles.decorator/roles.decorator';
import {
  CreateAdminDto,
  CreateStaffDto,
  UpgradeToCoachDto,
  CreateVenueDto,
  UpdateVenueDto,
} from './dto/admin.dto';
import { BookingService } from 'src/booking-venue/booking/booking.service';
import { ReviewDeletionRequestDto } from 'src/user/dto/deletion-request.dto';
import { ApiGoneResponse, ApiOperation } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin')
export class AdminController {
  constructor(
    private adminService: AdminService,
    private bookingService: BookingService,
  ) {}

  @Post('create-admin')
  async createAdmin(@Body() dto: CreateAdminDto) {
    return this.adminService.createAdmin(dto);
  }

  @Post('create-staff')
  async createStaff(@Body() dto: CreateStaffDto) {
    return this.adminService.createStaff(dto);
  }

  @Post('upgrade-to-coach')
  async upgradeToCoach(@Body() dto: UpgradeToCoachDto) {
    return this.adminService.upgradeUserToCoach(dto);
  }

  @Patch('staff/:id/upgrade-to-admin')
  async upgradeStaffToAdmin(@Param('id') staffId: string) {
    return this.adminService.upgradeStaffToAdmin(staffId);
  }

  @Patch('admin/:id/downgrade-to-staff')
  async downgradeAdminToStaff(@Param('id') adminId: string) {
    return this.adminService.downgradeAdminToStaff(adminId);
  }

  @Delete('users/:id')
  async softDeleteUser(@Param('id') userId: string) {
    return this.adminService.softDeleteUser(userId);
  }

  @Get('users')
  async getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Get('staff')
  async getAllStaff() {
    return this.adminService.getAllStaff();
  }

  @Get('coaches')
  async getAllCoaches() {
    return this.adminService.getAllCoaches();
  }

  @Get('deletion-requests')
  @Roles('ADMIN', 'STAFF')
  async getAllDeletionRequests(@Body() body?: { status?: string }) {
    return this.adminService.getAllDeletionRequests(body?.status);
  }

  @Patch('deletion-requests/:id/approve')
  @Roles('ADMIN', 'STAFF')
  async approveDeletionRequest(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ReviewDeletionRequestDto,
  ) {
    return this.adminService.approveDeletionRequest(
      id,
      req.user.id,
      dto.reviewNotes,
    );
  }

  @Patch('deletion-requests/:id/reject')
  @Roles('ADMIN', 'STAFF')
  async rejectDeletionRequest(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ReviewDeletionRequestDto,
  ) {
    return this.adminService.rejectDeletionRequest(
      id,
      req.user.id,
      dto.reviewNotes,
    );
  }
  // ===== VENUE MANAGEMENT =====

  /**
   * Create a new venue
   */
  @Post('venues')
  async createVenue(@Body() dto: CreateVenueDto) {
    return this.adminService.createVenue(dto);
  }

  /**
   * Update a venue
   */
  @Patch('venues/:id')
  async updateVenue(@Param('id') id: string, @Body() dto: UpdateVenueDto) {
    return this.adminService.updateVenue(parseInt(id), dto);
  }

  /**
   * Delete a venue
   */
  @Delete('venues/:id')
  async deleteVenue(@Param('id') id: string) {
    return this.adminService.deleteVenue(parseInt(id));
  }

  // ===== BOOKING MANAGEMENT =====

  /**
   * Get pending bookings (requiring approval)
   */
  @Get('bookings/pending')
  async getPendingBookings() {
    return this.adminService.getPendingBookings();
  }

  /**
   * Get all bookings
   */
  @Get('bookings')
  async getAllBookings() {
    return this.bookingService.getAllBookings();
  }

  @Patch('bookings/:id/confirm')
  @ApiOperation({
    summary: 'Legacy compatibility route; pending booking confirmation is retired.',
  })
  @ApiGoneResponse({
    description:
      'Venue bookings are confirmed by full payment or atomic staff cash registration.',
  })
  confirmBooking(@Param('id') id: string) {
    return this.adminService.confirmBooking(id);
  }

  @Patch('bookings/:id/reject')
  @ApiOperation({
    summary: 'Legacy compatibility route; pending booking rejection is retired.',
  })
  @ApiGoneResponse({
    description:
      'Pending commercial booking rejection is no longer an active workflow.',
  })
  rejectBooking(
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.adminService.rejectBooking(id, reason);
  }

  // ===== SYSTEM STATS (Admin Dashboard) =====

  /**
   * Get system-wide statistics
   */
  // @Get('dashboard/stats')
  // async getSystemStats() {
  //     return this.adminService.getSystemStatistics();
  // }
}
