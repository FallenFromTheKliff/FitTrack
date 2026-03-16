import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard/roles.guard';
import { Roles } from 'src/auth/roles.decorator/roles.decorator';
import { BookingService } from 'src/booking-venue/booking/booking.service';
import { UserService } from 'src/user/user.service';
import { CoachService } from 'src/coach-appointment/coach/coach.service';
import { AdminService } from 'src/admin/admin.service';

/**
 * STAFF Controller
 * 
 * Purpose: Handle operations for STAFF role (sub-admin)
 * 
 * Permissions:
 * - View users (read-only)
 * - Manage bookings (approve/reject)
 * - View coaches (read-only)
 * 
 * Restrictions:
 * - Cannot create admins/staff
 * - Cannot delete users
 * - Cannot manage venues
 * - Cannot upgrade users to coaches
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('STAFF', 'ADMIN')  // Both STAFF and ADMIN can access these endpoints
@Controller('staff')
export class StaffController {
    constructor(
        private bookingService: BookingService,
        private userService: UserService,
        private coachService: CoachService,
        private adminService: AdminService
    ) { }

    // ===== USER MANAGEMENT (Read-Only) =====

    /**
     * Get all users
     * Staff can view users but cannot modify them
     */
    @Get('users')
    async getAllUsers() {
        return this.adminService.getAllUsers();
    }

    /**
     * Get specific user details
     */
    @Get('users/:id')
    async getUserDetails(@Param('id') userId: string) {
        return this.userService.getProfile(userId);
    }

    // ===== BOOKING MANAGEMENT (Full Access) =====
    // This is the PRIMARY responsibility of STAFF role


    // Get all pending bookings (requires action)

    @Get('bookings/pending')
    async getPendingBookings() {
        return this.bookingService.getPendingBookings();
    }

    /**
     * Get all bookings (for monitoring)
     */
    @Get('bookings')
    async getAllBookings() {
        return this.bookingService.getAllBookings();
    }

    /**
     * Get specific booking details
     */
    @Get('bookings/:id')
    async getBookingDetails(@Param('id') id: string) {
        return this.bookingService.getBookingById(id);
    }

    /**
     * Confirm/Approve a booking
     */
    @Patch('bookings/:id/confirm')
    async confirmBooking(@Param('id') id: string) {
        return this.bookingService.confirmBooking(id);
    }

    /**
     * Reject a booking
     */
    @Patch('bookings/:id/reject')
    async rejectBooking(@Param('id') id: string, @Body('reason') reason?: string) {
        return this.bookingService.rejectBooking(id, reason);
    }

    // ===== COACH MANAGEMENT (Read-Only) =====

    /**
     * Get all coaches (for reference/monitoring)
     */
    @Get('coaches')
    async getAllCoaches() {
        return this.coachService.getAllCoaches();
    }

    /**
     * Get specific coach details
     */
    @Get('coaches/:id')
    async getCoachDetails(@Param('id') id: string) {
        return this.coachService.getCoachProfile(id);
    }

    /**
     * Get coach's appointments (for monitoring booking conflicts)
     */
    @Get('coaches/:id/appointments')
    async getCoachAppointments(@Param('id') coachId: string) {
        // Note: This would need to be implemented in CoachService
        // For now, staff can only view coach profiles
        return this.coachService.getCoachProfile(coachId);
    }

    // ===== DASHBOARD/STATS =====

    /**
     * Get booking statistics (optional - for staff dashboard)
     */
    @Get('dashboard/stats')
    async getBookingStats() {
        return this.bookingService.getBookingStatistics();
    }
}