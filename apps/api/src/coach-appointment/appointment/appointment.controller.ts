import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AppointmentService } from './appointment.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard/jwt-auth.guard';
import {
  CreateAppointmentDto,
  UpdateAppointmentStatusDto,
} from './dto/appointment.dto';

@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentController {
  constructor(private appointmentService: AppointmentService) {}

  @Post()
  async createAppointment(@Request() req, @Body() dto: CreateAppointmentDto) {
    return this.appointmentService.createAppointment(req.user.id, dto);
  }

  @Get()
  async getUserAppointments(@Request() req) {
    return this.appointmentService.getUserAppointments(req.user.id);
  }

  @Get(':id')
  async getAppointmentDetails(@Request() req, @Param('id') id: string) {
    return this.appointmentService.getAppointmentDetails(req.user.id, id);
  }

  @Patch(':id/cancel')
  async cancelAppointment(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ) {
    return this.appointmentService.cancelAppointment(
      req.user.id,
      id,
      dto.cancelReason,
    );
  }
}
