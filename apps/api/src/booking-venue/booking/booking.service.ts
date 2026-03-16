import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { CreateBookingDto } from './dto/booking.dto';

@Injectable()
export class BookingService {
    constructor(private prisma: PrismaService) { }

    async createBooking(userId: string, dto: CreateBookingDto) {
        // Check if venue exists and is active
        const venue = await this.prisma.venue.findUnique({
            where: { id: dto.venueId },
        });

        if (!venue) {
            throw new NotFoundException('Venue not found');
        }

        if (!venue.isActive) {
            throw new BadRequestException('Venue is not available for booking');
        }

        // Check minimum hours
        if (dto.durationHours < venue.minimumHours) {
            throw new BadRequestException(
                `Minimum booking duration is ${venue.minimumHours} hour(s)`
            );
        }

        // Calculate end time
        const startTime = new Date(dto.startTime);
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + dto.durationHours);

        // Check if booking is in the past
        if (startTime < new Date()) {
            throw new BadRequestException('Cannot book past time slots');
        }

        // Check for conflicts
        const conflicts = await this.prisma.venueBooking.findMany({
            where: {
                venueId: dto.venueId,
                status: { in: ['pending', 'confirmed'] },
                OR: [
                    {
                        AND: [
                            { startTime: { lte: startTime } },
                            { endTime: { gt: startTime } },
                        ],
                    },
                    {
                        AND: [
                            { startTime: { lt: endTime } },
                            { endTime: { gte: endTime } },
                        ],
                    },
                    {
                        AND: [
                            { startTime: { gte: startTime } },
                            { endTime: { lte: endTime } },
                        ],
                    },
                ],
            },
        });

        if (conflicts.length > 0) {
            throw new BadRequestException('Time slot is already booked');
        }

        // Create booking
        const booking = await this.prisma.venueBooking.create({
            data: {
                userId,
                venueId: dto.venueId,
                startTime,
                endTime,
                durationHours: dto.durationHours,
                purpose: dto.purpose,
                participants: dto.participants,
                status: 'pending', // Requires admin approval
            },
            include: {
                venue: true,
            },
        });

        return {
            message: 'Booking created successfully. Awaiting admin approval.',
            booking,
        };
    }

    async getUserBookings(userId: string) {
        const bookings = await this.prisma.venueBooking.findMany({
            where: { userId },
            include: {
                venue: true,
            },
            orderBy: { startTime: 'desc' },
        });

        return bookings;
    }

    async getBookingDetails(userId: string, bookingId: string) {
        const booking = await this.prisma.venueBooking.findUnique({
            where: { id: bookingId },
            include: {
                venue: true,
                user: {
                    include: { profile: true },
                },
            },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        // Only allow user to see their own bookings (unless admin)
        if (booking.userId !== userId) {
            throw new ForbiddenException('You can only view your own bookings');
        }

        return booking;
    }

    async cancelBooking(userId: string, bookingId: string, reason?: string) {
        const booking = await this.prisma.venueBooking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.userId !== userId) {
            throw new ForbiddenException('You can only cancel your own bookings');
        }

        if (booking.status === 'cancelled') {
            throw new BadRequestException('Booking is already cancelled');
        }

        if (booking.status === 'completed') {
            throw new BadRequestException('Cannot cancel completed booking');
        }

        const updated = await this.prisma.venueBooking.update({
            where: { id: bookingId },
            data: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancelReason: reason || 'Cancelled by user',
            },
        });

        return {
            message: 'Booking cancelled successfully',
            booking: updated,
        };
    }

    async getVenueAvailability(venueId: number, date: string) {
        const venue = await this.prisma.venue.findUnique({
            where: { id: venueId },
        });

        if (!venue) {
            throw new NotFoundException('Venue not found');
        }

        // Get bookings for the specified date
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const bookings = await this.prisma.venueBooking.findMany({
            where: {
                venueId,
                status: { in: ['pending', 'confirmed'] },
                startTime: {
                    gte: startOfDay,
                    lte: endOfDay,
                },
            },
            orderBy: { startTime: 'asc' },
        });

        return {
            venue,
            date,
            bookings,
        };
    }

    async getAllBookings() {
        const bookings = await this.prisma.venueBooking.findMany({
            include: {
                venue: {
                    select: {
                        id: true,
                        name: true,
                        capacity: true,
                        hourlyRate: true,
                    }
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                        phone_no: true,
                        profile: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            },
            orderBy: [
                { status: 'asc' },      // pending first
                { startTime: 'asc' },   // then by start time
            ]
        });

        return {
            total: bookings.length,
            pending: bookings.filter(b => b.status === 'pending').length,
            confirmed: bookings.filter(b => b.status === 'confirmed').length,
            cancelled: bookings.filter(b => b.status === 'cancelled').length,
            completed: bookings.filter(b => b.status === 'completed').length,
            bookings,
        };
    }

    /**
     * Get pending bookings (for admin/staff approval)
     */
    async getPendingBookings() {
        const bookings = await this.prisma.venueBooking.findMany({
            where: { status: 'pending' },
            include: {
                venue: {
                    select: {
                        id: true,
                        name: true,
                        capacity: true,
                        hourlyRate: true,
                    }
                },
                user: {
                    select: {
                        id: true,
                        email: true,
                        phone_no: true,
                        profile: {
                            select: {
                                firstName: true,
                                lastName: true,
                            }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }  // oldest first (FIFO)
        });

        return {
            total: bookings.length,
            bookings,
        };
    }

    /**
     * Get booking by ID (for admin/staff)
     */
    async getBookingById(bookingId: string) {
        const booking = await this.prisma.venueBooking.findUnique({
            where: { id: bookingId },
            include: {
                venue: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        phone_no: true,
                        profile: true,
                    }
                }
            }
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        return booking;
    }

    /**
     * Confirm/Approve a booking (for admin/staff)
     */
    async confirmBooking(bookingId: string) {
        const booking = await this.prisma.venueBooking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.status !== 'pending') {
            throw new BadRequestException(
                `Cannot confirm booking with status: ${booking.status}`
            );
        }

        // Check if booking time has passed
        if (booking.startTime < new Date()) {
            throw new BadRequestException('Cannot confirm past bookings');
        }

        const updated = await this.prisma.venueBooking.update({
            where: { id: bookingId },
            data: { status: 'confirmed' },
            include: {
                venue: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        profile: true,
                    }
                }
            }
        });

        return {
            message: 'Booking confirmed successfully',
            booking: updated,
        };
    }

    /**
     * Reject a booking (for admin/staff)
     */
    async rejectBooking(bookingId: string, reason?: string) {
        const booking = await this.prisma.venueBooking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundException('Booking not found');
        }

        if (booking.status !== 'pending') {
            throw new BadRequestException(
                `Cannot reject booking with status: ${booking.status}`
            );
        }

        const updated = await this.prisma.venueBooking.update({
            where: { id: bookingId },
            data: {
                status: 'cancelled',
                cancelledAt: new Date(),
                cancelReason: reason || 'Rejected by staff',
            },
            include: {
                venue: true,
                user: {
                    select: {
                        id: true,
                        email: true,
                        profile: true,
                    }
                }
            }
        });

        return {
            message: 'Booking rejected successfully',
            booking: updated,
        };
    }

    /**
     * Get booking statistics (optional - for staff dashboard)
     */
    async getBookingStatistics() {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [
            totalBookings,
            pendingBookings,
            confirmedBookings,
            cancelledBookings,
            completedBookings,
            recentBookings,
            upcomingBookings,
        ] = await Promise.all([
            this.prisma.venueBooking.count(),
            this.prisma.venueBooking.count({ where: { status: 'pending' } }),
            this.prisma.venueBooking.count({ where: { status: 'confirmed' } }),
            this.prisma.venueBooking.count({ where: { status: 'cancelled' } }),
            this.prisma.venueBooking.count({ where: { status: 'completed' } }),
            this.prisma.venueBooking.count({
                where: {
                    createdAt: { gte: thirtyDaysAgo }
                }
            }),
            this.prisma.venueBooking.count({
                where: {
                    status: 'confirmed',
                    startTime: { gte: now }
                }
            }),
        ]);

        return {
            total: totalBookings,
            byStatus: {
                pending: pendingBookings,
                confirmed: confirmedBookings,
                cancelled: cancelledBookings,
                completed: completedBookings,
            },
            recentBookings: recentBookings,  // last 30 days
            upcomingBookings: upcomingBookings,  // confirmed, future bookings
        };
    }
}