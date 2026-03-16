import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from '@nestjs/common';
import { BookingService } from './booking.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard/jwt-auth.guard';
import { CreateBookingDto, CancelBookingDto } from './dto/booking.dto';

@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingController {
    constructor(private bookingService: BookingService) { }

    @Post()
    async createBooking(@Request() req, @Body() dto: CreateBookingDto) {
        return this.bookingService.createBooking(req.user.id, dto);
    }

    @Get()
    async getUserBookings(@Request() req) {
        return this.bookingService.getUserBookings(req.user.id);
    }

    @Get(':id')
    async getBookingDetails(@Request() req, @Param('id') id: string) {
        return this.bookingService.getBookingDetails(req.user.id, id);
    }

    @Patch(':id/cancel')
    async cancelBooking(@Request() req, @Param('id') id: string, @Body() dto: CancelBookingDto) {
        return this.bookingService.cancelBooking(req.user.id, id, dto.cancelReason);
    }
}