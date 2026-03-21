import {BadRequestException, ForbiddenException, Injectable, NotFoundException,} from '@nestjs/common';
import {PrismaService} from 'prisma/prisma.service';
import {CreateAppointmentDto} from './dto/appointment.dto';

@Injectable()
export class AppointmentService {
  constructor(private prisma: PrismaService) {}

  async createAppointment(userId: string, dto: CreateAppointmentDto) {
    // Check if coach exists and is active
    const coach = await this.prisma.coach.findUnique({
      where: { id: dto.coachId },
      include: { availability: true },
    });

    if (!coach) {
      throw new NotFoundException('Coach not found');
    }

    if (!coach.isActive) {
      throw new BadRequestException('Coach is not available');
    }

    // Parse scheduled time
    const scheduledAt = new Date(dto.scheduledAt);
    const endTime = new Date(scheduledAt);
    endTime.setMinutes(endTime.getMinutes() + dto.duration);

    // Check if appointment is in the past
    if (scheduledAt < new Date()) {
      throw new BadRequestException('Cannot book past time slots');
    }

    // Check if the time falls within coach's availability
    const dayOfWeek = scheduledAt.getDay();
    const appointmentTime = scheduledAt.toTimeString().slice(0, 5); // "HH:mm"

    const availableSlot = coach.availability.find((slot) => {
      return (
        slot.dayOfWeek === dayOfWeek &&
        slot.isAvailable &&
        appointmentTime >= slot.startTime &&
        appointmentTime < slot.endTime
      );
    });

    if (!availableSlot) {
      throw new BadRequestException(
        'Selected time is outside coach availability',
      );
    }

    // Check for conflicts
    const conflicts = await this.prisma.trainerAppointment.findMany({
      where: {
        coachId: dto.coachId,
        status: { in: ['pending', 'confirmed'] },
        OR: [
          {
            AND: [
              { scheduledAt: { lte: scheduledAt } },
              { endTime: { gt: scheduledAt } },
            ],
          },
          {
            AND: [
              { scheduledAt: { lt: endTime } },
              { endTime: { gte: endTime } },
            ],
          },
          {
            AND: [
              { scheduledAt: { gte: scheduledAt } },
              { endTime: { lte: endTime } },
            ],
          },
        ],
      },
    });

    if (conflicts.length > 0) {
      throw new BadRequestException(
        'Coach is already booked for this time slot',
      );
    }

    // Create appointment
    const appointment = await this.prisma.trainerAppointment.create({
      data: {
        userId,
        coachId: dto.coachId,
        scheduledAt,
        duration: dto.duration,
        endTime,
        sessionType: dto.sessionType,
        notes: dto.notes,
        status: 'pending', // Requires coach confirmation
      },
      include: {
        coach: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
      },
    });

    return {
      message: 'Appointment created successfully. Awaiting coach confirmation.',
      appointment,
    };
  }

  async getUserAppointments(userId: string) {
    return await this.prisma.trainerAppointment.findMany({
      where: {userId},
      include: {
        coach: {
          include: {
            user: {
              include: {profile: true}
            }
          }
        }
      },
      orderBy: {scheduledAt: 'desc'}
    });
  }

  async getAppointmentDetails(userId: string, appointmentId: string) {
    const appointment = await this.prisma.trainerAppointment.findUnique({
      where: { id: appointmentId },
      include: {
        coach: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
        user: {
          include: { profile: true },
        },
      },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    // Only allow user to see their own appointments
    if (appointment.userId !== userId) {
      throw new ForbiddenException('You can only view your own appointments');
    }

    return appointment;
  }

  async cancelAppointment(
    userId: string,
    appointmentId: string,
    reason?: string,
  ) {
    const appointment = await this.prisma.trainerAppointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    if (appointment.userId !== userId) {
      throw new ForbiddenException('You can only cancel your own appointments');
    }

    if (appointment.status === 'cancelled') {
      throw new BadRequestException('Appointment is already cancelled');
    }

    if (appointment.status === 'completed') {
      throw new BadRequestException('Cannot cancel completed appointment');
    }

    const updated = await this.prisma.trainerAppointment.update({
      where: { id: appointmentId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelReason: reason || 'Cancelled by user',
        cancelledBy: userId,
      },
    });

    return {
      message: 'Appointment cancelled successfully',
      appointment: updated,
    };
  }
}
