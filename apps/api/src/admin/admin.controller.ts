// Updated AdminController with staff management
// File: src/admin/admin.controller.ts

import { Controller, Post, Body, Get, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard/roles.guard';
import { Roles } from 'src/auth/roles.decorator/roles.decorator';
import {
    CreateAdminDto,
    CreateStaffDto,
    UpgradeToCoachDto,
    CreateVenueDto,
    UpdateVenueDto
} from './dto/admin.dto';
import { BookingService } from 'src/booking-venue/booking/booking.service';
import { ReviewDeletionRequestDto } from 'src/user/dto/deletion-request.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')  // Only ADMIN can access these endpoints
@Controller('admin')
export class AdminController {
    constructor(private adminService: AdminService, private bookingService: BookingService) { }

    // ===== USER MANAGEMENT =====

    /**
     * Create a new admin user
     */
    @Post('create-admin')
    async createAdmin(@Body() dto: CreateAdminDto) {
        return this.adminService.createAdmin(dto);
    }

    /**
     * Create a new staff user (sub-admin)
     */
    @Post('create-staff')
    async createStaff(@Body() dto: CreateStaffDto) {
        return this.adminService.createStaff(dto);
    }

    /**
     * Upgrade a regular user to coach
     */
    @Post('upgrade-to-coach')
    async upgradeToCoach(@Body() dto: UpgradeToCoachDto) {
        return this.adminService.upgradeUserToCoach(dto);
    }

    /**
     * Upgrade staff to admin (rare operation)
     */
    @Patch('staff/:id/upgrade-to-admin')
    async upgradeStaffToAdmin(@Param('id') staffId: string) {
        return this.adminService.upgradeStaffToAdmin(staffId);
    }

    /**
     * Downgrade admin to staff (rare operation)
     */
    @Patch('admin/:id/downgrade-to-staff')
    async downgradeAdminToStaff(@Param('id') adminId: string) {
        return this.adminService.downgradeAdminToStaff(adminId);
    }

    /**
     * Soft delete a user (mark as deleted)
     */
    @Delete('users/:id')
    async softDeleteUser(@Param('id') userId: string) {
        return this.adminService.softDeleteUser(userId);
    }

    /**
     * Get all users
     */
    @Get('users')
    async getAllUsers() {
        return this.adminService.getAllUsers();
    }

    /**
     * Get all staff users
     */
    @Get('staff')
    async getAllStaff() {
        return this.adminService.getAllStaff();
    }

    /**
     * Get all coaches
     */
    @Get('coaches')
    async getAllCoaches() {
        return this.adminService.getAllCoaches();
    }

    // ===== DELETION MANAGEMENT =====
    @Get('deletion-requests')
    async getAllDeletionRequests(@Body() body?: { status?: string }) {
        return this.adminService.getAllDeletionRequests(body?.status);
    }

    @Patch('deletion-requests/:id/approve')
    async approveDeletionRequest(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: ReviewDeletionRequestDto
    ) {
        return this.adminService.approveDeletionRequest(id, req.user.id, dto.reviewNotes);
    }

    @Patch('deletion-requests/:id/reject')
    async rejectDeletionRequest(
        @Request() req,
        @Param('id') id: string,
        @Body() dto: ReviewDeletionRequestDto
    ) {
        return this.adminService.rejectDeletionRequest(id, req.user.id, dto.reviewNotes);
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

    /**
     * Confirm a booking
     */
    @Patch('bookings/:id/confirm')
    async confirmBooking(@Param('id') id: string) {
        return this.adminService.confirmBooking(id);
    }

    /**
     * Reject a booking
     */
    @Patch('bookings/:id/reject')
    async rejectBooking(@Param('id') id: string, @Body('reason') reason?: string) {
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