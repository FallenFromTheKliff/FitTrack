import { Injectable } from '@nestjs/common';
import {
  AuthProvider,
  BookingStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function splitDelimitedList(value: string | null) {
  if (!value) return [];

  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function toFrontendRole(role: UserRole) {
  switch (role) {
    case UserRole.admin:
      return { id: 1, name: 'ADMIN' as const };
    case UserRole.staff:
      return { id: 2, name: 'STAFF' as const };
    case UserRole.coach:
      return { id: 3, name: 'COACH' as const };
    case UserRole.member:
    default:
      return { id: 4, name: 'USER' as const };
  }
}

function toFrontendMembershipType(role: UserRole) {
  return role === UserRole.member ? 'member' : null;
}

function findIdentity(
  identities: Array<{
    identifier: string;
    is_primary: boolean;
    provider: AuthProvider;
  }>,
  providers: readonly AuthProvider[],
) {
  return (
    identities.find(
      (identity) =>
        identity.is_primary && providers.includes(identity.provider),
    ) ??
    identities.find((identity) => providers.includes(identity.provider)) ??
    null
  );
}

@Injectable()
export class StaffService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

    const [
      total,
      pending,
      confirmed,
      balancePending,
      cancelled,
      noShow,
      completed,
      recentBookings,
      upcomingConfirmed,
      upcomingBalancePending,
    ] = await Promise.all([
      this.prisma.amenityBooking.count(),
      this.prisma.amenityBooking.count({
        where: { status: BookingStatus.pending },
      }),
      this.prisma.amenityBooking.count({
        where: { status: BookingStatus.confirmed },
      }),
      this.prisma.amenityBooking.count({
        where: { status: BookingStatus.balance_pending },
      }),
      this.prisma.amenityBooking.count({
        where: { status: BookingStatus.cancelled },
      }),
      this.prisma.amenityBooking.count({
        where: { status: BookingStatus.no_show },
      }),
      this.prisma.amenityBooking.count({
        where: { status: BookingStatus.completed },
      }),
      this.prisma.amenityBooking.count({
        where: {
          created_at: { gte: thirtyDaysAgo },
        },
      }),
      this.prisma.amenityBooking.count({
        where: {
          status: BookingStatus.confirmed,
          starts_at: { gte: now },
        },
      }),
      this.prisma.amenityBooking.count({
        where: {
          status: BookingStatus.balance_pending,
          starts_at: { gte: now },
        },
      }),
    ]);

    return {
      total,
      byStatus: {
        pending,
        confirmed: confirmed + balancePending,
        cancelled: cancelled + noShow,
        completed,
      },
      recentBookings,
      upcomingBookings: upcomingConfirmed + upcomingBalancePending,
    };
  }

  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        auth_identities: {
          select: {
            provider: true,
            identifier: true,
            is_primary: true,
          },
          orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
        },
        profile: true,
      },
      orderBy: { created_at: 'desc' },
    });

    return users.map((user) => {
      const primaryEmail = findIdentity(user.auth_identities, [
        AuthProvider.email,
        AuthProvider.google,
      ]);

      return {
        id: user.id,
        email: primaryEmail?.identifier ?? '',
        phone_no: user.profile?.phone ?? null,
        role: toFrontendRole(user.role),
        emailVerified: Boolean(user.email_verified_at),
        phoneVerified: false,
        deletedAt: user.deletedAt?.toISOString() ?? null,
        createdAt: user.created_at.toISOString(),
        updatedAt: user.updated_at.toISOString(),
        profile: user.profile
          ? {
              firstName: user.profile.first_name,
              lastName: user.profile.last_name,
              dateOfBirth: user.profile.date_of_birth?.toISOString() ?? null,
              gender: user.profile.gender ?? null,
              activityLevel: user.profile.activity_level ?? null,
              fitnessGoal: user.profile.fitness_goal ?? null,
              currentWeightKg:
                user.profile.weight_kg !== null
                  ? Number(user.profile.weight_kg)
                  : null,
              heightCm:
                user.profile.height_cm !== null
                  ? Number(user.profile.height_cm)
                  : null,
              avatarUrl: user.profile.avatar_url ?? null,
              membershipType: toFrontendMembershipType(user.role),
            }
          : null,
      };
    });
  }

  async getAllCoaches() {
    const coaches = await this.prisma.coachProfile.findMany({
      include: {
        availability_slots: {
          where: { is_active: true },
          orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
        },
        user: {
          include: {
            auth_identities: {
              select: {
                provider: true,
                identifier: true,
                is_primary: true,
              },
              orderBy: [{ is_primary: 'desc' }, { created_at: 'asc' }],
            },
            profile: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    return coaches.map((coach) => {
      const primaryEmail = findIdentity(coach.user.auth_identities, [
        AuthProvider.email,
        AuthProvider.google,
      ]);

      return {
        id: coach.id,
        bio: coach.bio,
        specialties: splitDelimitedList(coach.specialization),
        certifications: splitDelimitedList(coach.certification),
        yearsExperience: null,
        hourlyRate: Number(coach.hourly_rate),
        isActive:
          coach.is_available_for_booking &&
          coach.user.status === UserStatus.active,
        availability: coach.availability_slots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.day_of_week,
          startTime: this.toTimeString(slot.start_time),
          endTime: this.toTimeString(slot.end_time),
          isAvailable: true,
        })),
        user: {
          id: coach.user.id,
          email: primaryEmail?.identifier ?? '',
          phone_no: coach.user.profile?.phone ?? null,
          createdAt: coach.user.created_at.toISOString(),
          profile: coach.user.profile
            ? {
                firstName: coach.user.profile.first_name,
                lastName: coach.user.profile.last_name,
                dateOfBirth:
                  coach.user.profile.date_of_birth?.toISOString() ?? null,
                gender: coach.user.profile.gender ?? null,
                activityLevel: coach.user.profile.activity_level ?? null,
                fitnessGoal: coach.user.profile.fitness_goal ?? null,
                currentWeightKg:
                  coach.user.profile.weight_kg !== null
                    ? Number(coach.user.profile.weight_kg)
                    : null,
                heightCm:
                  coach.user.profile.height_cm !== null
                    ? Number(coach.user.profile.height_cm)
                    : null,
                avatarUrl: coach.user.profile.avatar_url ?? null,
                membershipType: toFrontendMembershipType(UserRole.coach),
              }
            : null,
        },
      };
    });
  }

  private toTimeString(value: Date) {
    const hours = value.getUTCHours().toString().padStart(2, '0');
    const minutes = value.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
