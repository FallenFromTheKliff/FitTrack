import {Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from 'prisma/prisma.service';

@Injectable()
export class VenueService {
  constructor(private prisma: PrismaService) {}

  async getAllVenues(isActive?: boolean) {
    return await this.prisma.venue.findMany({
      where: isActive !== undefined ? {isActive} : {},
      orderBy: [{displayOrder: 'asc'}, {name: 'asc'}]
    });
  }

  async getVenueDetails(venueId: number) {
    const venue = await this.prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      throw new NotFoundException('Venue not found');
    }

    return venue;
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
      bookings: bookings.map((b) => ({
        startTime: b.startTime,
        endTime: b.endTime,
        status: b.status,
      })),
    };
  }
}
