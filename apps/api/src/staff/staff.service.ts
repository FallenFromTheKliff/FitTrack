import { Injectable } from '@nestjs/common';
import {
  AuthProvider,
  BookingStatus,
  MembershipCardSource,
  MembershipCardStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function toFrontendMembershipCard(
  role: UserRole,
  card: {
    activated_at: Date | null;
    purchased_at: Date;
    revoke_reason: string | null;
    revoked_at: Date | null;
    source: MembershipCardSource;
    status: MembershipCardStatus;
    updated_at: Date;
    verified_at: Date | null;
  } | null,
) {
  if (role !== UserRole.member) {
    return null;
  }

  return {
    activatedAt: card?.activated_at?.toISOString() ?? null,
    purchasedAt: card?.purchased_at.toISOString() ?? null,
    revokeReason: card?.revoke_reason ?? null,
    revokedAt: card?.revoked_at?.toISOString() ?? null,
    source: card?.source ?? null,
    status: card?.status ?? 'none',
    updatedAt: card?.updated_at.toISOString() ?? null,
    verifiedAt: card?.verified_at?.toISOString() ?? null,
  };
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

function normalizeOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function buildLinkedCoachIdentityValues(
  user: {
    auth_identities: Array<{ identifier: string }>;
    profile?: {
      first_name?: string | null;
      last_name?: string | null;
      phone?: string | null;
    } | null;
  } | null,
) {
  const values = new Set<string>();
  if (!user) return values;

  for (const identity of user.auth_identities) {
    const identifier = normalizeOptionalString(identity.identifier);
    if (identifier) values.add(identifier.toLowerCase());
  }

  const firstName = normalizeOptionalString(user.profile?.first_name);
  const lastName = normalizeOptionalString(user.profile?.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (fullName) values.add(fullName.toLowerCase());

  const phone = normalizeOptionalString(user.profile?.phone);
  if (phone) values.add(phone.toLowerCase());

  return values;
}

function getLinkedCoachDisplayName(
  user: {
    profile?: {
      first_name?: string | null;
      last_name?: string | null;
    } | null;
  } | null,
) {
  const firstName = normalizeOptionalString(user?.profile?.first_name);
  const lastName = normalizeOptionalString(user?.profile?.last_name);
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

  return fullName || null;
}

function normalizeStandaloneCoachDisplayName(
  value: string | null,
  linkedUserDisplayName: string | null,
  index: number,
) {
  const displayName = normalizeOptionalString(value);
  if (displayName && !EMAIL_LIKE_PATTERN.test(displayName)) {
    return displayName;
  }

  if (linkedUserDisplayName) {
    return linkedUserDisplayName;
  }

  return `Coach Profile ${index + 1}`;
}

function normalizeStandaloneCoachContact(
  value: string | null,
  linkedIdentityValues: Set<string>,
) {
  const contact = normalizeOptionalString(value);
  if (!contact || linkedIdentityValues.has(contact.toLowerCase())) {
    return null;
  }

  return contact;
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
        membership_card: true,
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
        status: user.status,
        emailVerified: Boolean(user.email_verified_at),
        phoneVerified: false,
        membershipCard: toFrontendMembershipCard(
          user.role,
          user.membership_card,
        ),
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
    await this.ensureProfilesForActiveCoachUsers();

    const coaches = await this.prisma.coachProfile.findMany({
      where: {
        user: {
          role: UserRole.coach,
          status: { in: [UserStatus.active, UserStatus.pending] },
        },
      },
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

    return coaches.map((coach, index) => {
      const linkedIdentityValues = buildLinkedCoachIdentityValues(coach.user);
      const linkedUserDisplayName = getLinkedCoachDisplayName(coach.user);
      const primaryEmail = findIdentity(coach.user?.auth_identities ?? [], [
        AuthProvider.email,
        AuthProvider.google,
      ]);

      return {
        id: coach.id,
        displayName: normalizeStandaloneCoachDisplayName(
          coach.display_name,
          linkedUserDisplayName,
          index,
        ),
        contactEmail: normalizeStandaloneCoachContact(
          coach.contact_email,
          linkedIdentityValues,
        ),
        contactPhone: normalizeStandaloneCoachContact(
          coach.contact_phone,
          linkedIdentityValues,
        ),
        bio: coach.bio,
        specialties: splitDelimitedList(coach.specialization),
        certifications: splitDelimitedList(coach.certification),
        yearsExperience: null,
        hourlyRate: Number(coach.hourly_rate),
        monthlyOfferActive: coach.monthly_offer_active,
        monthlyOfferDescription: coach.monthly_offer_description,
        monthlyRate: Number(coach.monthly_rate),
        monthlySessionCount: coach.monthly_session_count,
        monthlySessionDurationMinutes: coach.monthly_session_duration_minutes,
        scheduleType: coach.schedule_type,
        isActive:
          coach.user?.status === UserStatus.active &&
          coach.is_available_for_booking,
        availability: coach.availability_slots.map((slot) => ({
          id: slot.id,
          dayOfWeek: slot.day_of_week,
          startTime: this.toTimeString(slot.start_time),
          endTime: this.toTimeString(slot.end_time),
          isAvailable: true,
        })),
        user: coach.user
          ? {
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
                    membershipType: null,
                  }
                : null,
            }
          : null,
      };
    });
  }

  private async ensureProfilesForActiveCoachUsers() {
    const coachUsersWithoutProfiles = await this.prisma.user.findMany({
      where: {
        role: UserRole.coach,
        status: UserStatus.active,
        coach_profile: {
          is: null,
        },
      },
      select: {
        id: true,
        profile: {
          select: {
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (coachUsersWithoutProfiles.length === 0) {
      return;
    }

    await this.prisma.coachProfile.createMany({
      data: coachUsersWithoutProfiles.map((user) => ({
        user_id: user.id,
        display_name: getLinkedCoachDisplayName(user),
      })),
      skipDuplicates: true,
    });
  }

  private toTimeString(value: Date) {
    const hours = value.getUTCHours().toString().padStart(2, '0');
    const minutes = value.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
