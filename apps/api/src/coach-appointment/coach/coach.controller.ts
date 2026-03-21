import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { CoachService } from './coach.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard/jwt-auth.guard';
import { RolesGuard } from 'src/auth/roles.guard/roles.guard';
import { Roles } from 'src/auth/roles.decorator/roles.decorator';
import {
  UpdateCoachProfileDto,
  SetCoachAvailabilityDto,
  UpdateCoachAvailabilityDto,
} from './dto/coach.dto';
import { ConfirmAppointmentDto } from '../appointment/dto/appointment.dto';

@Controller('coaches')
export class CoachController {
  constructor(private coachService: CoachService) {}

  // ===== PUBLIC ENDPOINTS =====
  @Get()
  async getAllCoaches(@Query('active') active?: string) {
    const isActive =
      active === 'true' ? true : active === 'false' ? false : undefined;
    return this.coachService.getAllCoaches(isActive);
  }

  @Get(':id')
  async getCoachProfile(@Param('id') id: string) {
    return this.coachService.getCoachProfile(id);
  }

  @Get(':id/availability')
  async getCoachAvailability(@Param('id') id: string) {
    return this.coachService.getCoachAvailability(id);
  }

  // ===== COACH-ONLY ENDPOINTS =====
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COACH')
  @Patch('profile')
  async updateProfile(@Request() req, @Body() dto: UpdateCoachProfileDto) {
    return this.coachService.updateCoachProfile(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COACH')
  @Post('availability')
  async setAvailability(@Request() req, @Body() dto: SetCoachAvailabilityDto) {
    return this.coachService.setAvailability(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COACH')
  @Patch('availability/:id')
  async updateAvailability(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateCoachAvailabilityDto,
  ) {
    return this.coachService.updateAvailability(req.user.id, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COACH')
  @Delete('availability/:id')
  async deleteAvailability(@Request() req, @Param('id') id: string) {
    return this.coachService.deleteAvailability(req.user.id, id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COACH')
  @Get('appointments/schedule')
  async getCoachSchedule(@Request() req) {
    return this.coachService.getCoachSchedule(req.user.id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COACH')
  @Patch('appointments/:id/confirm')
  async confirmAppointment(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: ConfirmAppointmentDto,
  ) {
    return this.coachService.confirmAppointment(req.user.id, id, dto.notes);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COACH')
  @Patch('appointments/:id/decline')
  async declineAppointment(
    @Request() req,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.coachService.declineAppointment(req.user.id, id, reason);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('COACH')
  @Patch('appointments/:id/complete')
  async completeAppointment(@Request() req, @Param('id') id: string) {
    return this.coachService.completeAppointment(req.user.id, id);
  }
}
