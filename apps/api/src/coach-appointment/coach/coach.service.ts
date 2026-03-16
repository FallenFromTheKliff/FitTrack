import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import {
    UpdateCoachProfileDto,
    SetCoachAvailabilityDto,
    UpdateCoachAvailabilityDto
} from './dto/coach.dto';

@Injectable()
export class CoachService {
    constructor(private prisma: PrismaService) { }

    // ===== PUBLIC ENDPOINTS =====
    async getAllCoaches(isActive?: boolean) {
        const coaches = await this.prisma.coach.findMany({
            where: isActive !== undefined ? { isActive } : {},
            include: {
                user: {
                    include: { profile: true },
                },
                availability: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return coaches.map((coach) => ({
            ...coach,
            user: {
                ...coach.user,
                password: undefined, // Remove password
            },
        }));
    }

    async getCoachProfile(coachId: string) {
        const coach = await this.prisma.coach.findUnique({
            where: { id: coachId },
            include: {
                user: {
                    include: { profile: true },
                },
                availability: true,
            },
        });

        if (!coach) {
            throw new NotFoundException('Coach not found');
        }

        const { password, ...userWithoutPassword } = coach.user;

        return {
            ...coach,
            user: userWithoutPassword,
        };
    }

    async getCoachAvailability(coachId: string) {
        const coach = await this.prisma.coach.findUnique({
            where: { id: coachId },
            include: { availability: true },
        });

        if (!coach) {
            throw new NotFoundException('Coach not found');
        }

        return {
            coachId: coach.id,
            availability: coach.availability.sort((a, b) => a.dayOfWeek - b.dayOfWeek),
        };
    }

    // ===== COACH-ONLY ENDPOINTS =====
    async updateCoachProfile(userId: string, dto: UpdateCoachProfileDto) {
        const coach = await this.prisma.coach.findUnique({
            where: { userId },
        });

        if (!coach) {
            throw new NotFoundException('Coach profile not found');
        }

        const updated = await this.prisma.coach.update({
            where: { id: coach.id },
            data: {
                ...(dto.specialties && { specialties: dto.specialties }),
                ...(dto.bio !== undefined && { bio: dto.bio }),
                ...(dto.certifications && { certifications: dto.certifications }),
                ...(dto.yearsExperience !== undefined && { yearsExperience: dto.yearsExperience }),
                ...(dto.hourlyRate !== undefined && { hourlyRate: dto.hourlyRate }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        });

        return {
            message: 'Coach profile updated successfully',
            coach: updated,
        };
    }

    async setAvailability(userId: string, dto: SetCoachAvailabilityDto) {
        const coach = await this.prisma.coach.findUnique({
            where: { userId },
        });

        if (!coach) {
            throw new NotFoundException('Coach profile not found');
        }

        // Validate time format
        if (!this.isValidTimeFormat(dto.startTime) || !this.isValidTimeFormat(dto.endTime)) {
            throw new BadRequestException('Time must be in HH:mm format (e.g., "09:00")');
        }

        // Validate day of week
        if (dto.dayOfWeek < 0 || dto.dayOfWeek > 6) {
            throw new BadRequestException('Day of week must be between 0 (Sunday) and 6 (Saturday)');
        }

        // Validate start < end
        if (dto.startTime >= dto.endTime) {
            throw new BadRequestException('Start time must be before end time');
        }

        // Check for conflicts
        const existingSlot = await this.prisma.coachAvailability.findFirst({
            where: {
                coachId: coach.id,
                dayOfWeek: dto.dayOfWeek,
            },
        });

        if (existingSlot) {
            throw new BadRequestException('Availability slot already exists for this day. Use PATCH to update.');
        }

        const availability = await this.prisma.coachAvailability.create({
            data: {
                coachId: coach.id,
                dayOfWeek: dto.dayOfWeek,
                startTime: dto.startTime,
                endTime: dto.endTime,
            },
        });

        return {
            message: 'Availability set successfully',
            availability,
        };
    }

    async updateAvailability(userId: string, availabilityId: string, dto: UpdateCoachAvailabilityDto) {
        const coach = await this.prisma.coach.findUnique({
            where: { userId },
        });

        if (!coach) {
            throw new NotFoundException('Coach profile not found');
        }

        const availability = await this.prisma.coachAvailability.findUnique({
            where: { id: availabilityId },
        });

        if (!availability) {
            throw new NotFoundException('Availability slot not found');
        }

        if (availability.coachId !== coach.id) {
            throw new ForbiddenException('You can only update your own availability');
        }

        // Validate time formats if provided
        if (dto.startTime && !this.isValidTimeFormat(dto.startTime)) {
            throw new BadRequestException('Start time must be in HH:mm format');
        }

        if (dto.endTime && !this.isValidTimeFormat(dto.endTime)) {
            throw new BadRequestException('End time must be in HH:mm format');
        }

        const updated = await this.prisma.coachAvailability.update({
            where: { id: availabilityId },
            data: {
                ...(dto.startTime && { startTime: dto.startTime }),
                ...(dto.endTime && { endTime: dto.endTime }),
                ...(dto.isAvailable !== undefined && { isAvailable: dto.isAvailable }),
            },
        });

        return {
            message: 'Availability updated successfully',
            availability: updated,
        };
    }

    async deleteAvailability(userId: string, availabilityId: string) {
        const coach = await this.prisma.coach.findUnique({
            where: { userId },
        });

        if (!coach) {
            throw new NotFoundException('Coach profile not found');
        }

        const availability = await this.prisma.coachAvailability.findUnique({
            where: { id: availabilityId },
        });

        if (!availability) {
            throw new NotFoundException('Availability slot not found');
        }

        if (availability.coachId !== coach.id) {
            throw new ForbiddenException('You can only delete your own availability');
        }

        await this.prisma.coachAvailability.delete({
            where: { id: availabilityId },
        });

        return {
            message: 'Availability slot deleted successfully',
        };
    }

    async getCoachSchedule(userId: string) {
        const coach = await this.prisma.coach.findUnique({
            where: { userId },
        });

        if (!coach) {
            throw new NotFoundException('Coach profile not found');
        }

        const appointments = await this.prisma.trainerAppointment.findMany({
            where: { coachId: coach.id },
            include: {
                user: {
                    include: { profile: true },
                },
            },
            orderBy: { scheduledAt: 'desc' },
        });

        return appointments;
    }

    async confirmAppointment(userId: string, appointmentId: string, notes?: string) {
        const coach = await this.prisma.coach.findUnique({
            where: { userId },
        });

        if (!coach) {
            throw new NotFoundException('Coach profile not found');
        }

        const appointment = await this.prisma.trainerAppointment.findUnique({
            where: { id: appointmentId },
        });

        if (!appointment) {
            throw new NotFoundException('Appointment not found');
        }

        if (appointment.coachId !== coach.id) {
            throw new ForbiddenException('You can only manage your own appointments');
        }

        if (appointment.status !== 'pending') {
            throw new BadRequestException('Appointment is not pending');
        }

        const updated = await this.prisma.trainerAppointment.update({
            where: { id: appointmentId },
            data: {
                status: 'confirmed',
                ...(notes && { notes }),
            },
        });

        return {
            message: 'Appointment confirmed successfully',
            appointment: updated,
        };
    }

    async declineAppointment(userId: string, appointmentId: string, reason?: string) {
        const coach = await this.prisma.coach.findUnique({
            where: { userId },
        });

        if (!coach) {
            throw new NotFoundException('Coach profile not found');
        }

        const appointment = await this.prisma.trainerAppointment.findUnique({
            where: { id: appointmentId },
        });

        if (!appointment) {
            throw new NotFoundException('Appointment not found');
        }

        if (appointment.coachId !== coach.id) {
            throw new ForbiddenException('You can only manage your own appointments');
        }

        if (appointment.status !== 'pending') {
            throw new BadRequestException('Appointment is not pending');
        }

        const updated = await this.prisma.trainerAppointment.update({
            where: { id: appointmentId },
            data: {
                status: 'declined',
                cancelledAt: new Date(),
                cancelReason: reason || 'Declined by coach',
                cancelledBy: userId,
            },
        });

        return {
            message: 'Appointment declined successfully',
            appointment: updated,
        };
    }

    async completeAppointment(userId: string, appointmentId: string) {
        const coach = await this.prisma.coach.findUnique({
            where: { userId },
        });

        if (!coach) {
            throw new NotFoundException('Coach profile not found');
        }

        const appointment = await this.prisma.trainerAppointment.findUnique({
            where: { id: appointmentId },
        });

        if (!appointment) {
            throw new NotFoundException('Appointment not found');
        }

        if (appointment.coachId !== coach.id) {
            throw new ForbiddenException('You can only manage your own appointments');
        }

        if (appointment.status !== 'confirmed') {
            throw new BadRequestException('Only confirmed appointments can be marked as completed');
        }

        const updated = await this.prisma.trainerAppointment.update({
            where: { id: appointmentId },
            data: { status: 'completed' },
        });

        return {
            message: 'Appointment marked as completed',
            appointment: updated,
        };
    }

    // Helper method
    private isValidTimeFormat(time: string): boolean {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        return timeRegex.test(time);
    }
}