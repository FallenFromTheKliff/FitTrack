import {
  GoneException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoachService } from './coach.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard/roles.guard';
import { Roles } from 'src/auth/roles.decorator/roles.decorator';

@Controller('coaches')
export class CoachController {
  constructor(private coachService: CoachService) {}

  // ===== PUBLIC ENDPOINTS =====
  @Get()
  async getAllCoaches(@Query('active') active?: string): Promise<unknown> {
    const isActive =
      active === 'true' ? true : active === 'false' ? false : undefined;
    return (await this.coachService.getAllCoaches(isActive)) as unknown;
  }

  @Get(':id')
  async getCoachProfile(@Param('id') id: string): Promise<unknown> {
    return (await this.coachService.getCoachProfile(id)) as unknown;
  }

  @Get(':id/availability')
  async getCoachAvailability(@Param('id') id: string): Promise<unknown> {
    return (await this.coachService.getCoachAvailability(id)) as unknown;
  }

  private unsupportedCoachUserEndpoint() {
    throw new GoneException(
      'Coach user accounts are no longer supported. Use Gym Operations staff-managed coach profiles instead.',
    );
  }

  // ===== LEGACY SELF-SERVICE ENDPOINTS =====
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @Patch('profile')
  updateProfile() {
    return this.unsupportedCoachUserEndpoint();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @Post('availability')
  setAvailability() {
    return this.unsupportedCoachUserEndpoint();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @Patch('availability/:id')
  updateAvailability() {
    return this.unsupportedCoachUserEndpoint();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @Delete('availability/:id')
  deleteAvailability() {
    return this.unsupportedCoachUserEndpoint();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @Get('appointments/schedule')
  getCoachSchedule() {
    return this.unsupportedCoachUserEndpoint();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @Patch('appointments/:id/confirm')
  confirmAppointment() {
    return this.unsupportedCoachUserEndpoint();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @Patch('appointments/:id/decline')
  declineAppointment() {
    return this.unsupportedCoachUserEndpoint();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  @Patch('appointments/:id/complete')
  completeAppointment() {
    return this.unsupportedCoachUserEndpoint();
  }
}
