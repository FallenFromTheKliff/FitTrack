import { Controller, Get, Param, Query } from '@nestjs/common';
import { VenueService } from './venue.service';

@Controller('venues')
export class VenueController {
  constructor(private venueService: VenueService) {}

  @Get()
  async getAllVenues(@Query('active') active?: string) {
    const isActive =
      active === 'true' ? true : active === 'false' ? false : undefined;
    return this.venueService.getAllVenues(isActive);
  }

  @Get(':id')
  async getVenueDetails(@Param('id') id: string) {
    return this.venueService.getVenueDetails(parseInt(id));
  }

  @Get(':id/availability')
  async getVenueAvailability(
    @Param('id') id: string,
    @Query('date') date: string,
  ) {
    if (!date) {
      date = new Date().toISOString().split('T')[0]; // Today
    }
    return this.venueService.getVenueAvailability(parseInt(id), date);
  }
}
