import {
  AuthProvider,
  BookingStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';

import { StaffService } from './staff.service';

describe('StaffService', () => {
  const prisma = {
    amenityBooking: {
      count: jest.fn(),
    },
    coachProfile: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  };

  let service: StaffService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.coachProfile.createMany.mockResolvedValue({ count: 0 });
    prisma.user.findMany.mockResolvedValue([]);
    service = new StaffService(prisma as never);
  });

  it('builds staff dashboard stats from live amenity bookings', async () => {
    prisma.amenityBooking.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    await expect(service.getDashboardStats()).resolves.toEqual({
      total: 12,
      byStatus: {
        pending: 3,
        confirmed: 6,
        cancelled: 2,
        completed: 5,
      },
      recentBookings: 7,
      upcomingBookings: 3,
    });

    expect(prisma.amenityBooking.count).toHaveBeenNthCalledWith(2, {
      where: { status: BookingStatus.pending },
    });
    expect(prisma.amenityBooking.count).toHaveBeenNthCalledWith(4, {
      where: { status: BookingStatus.balance_pending },
    });
  });

  it('maps staff user directory records to the frontend contract', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'user-1',
        role: UserRole.staff,
        email_verified_at: new Date('2026-04-01T00:00:00.000Z'),
        phone_verified_at: null,
        deletedAt: null,
        created_at: new Date('2026-03-01T00:00:00.000Z'),
        updated_at: new Date('2026-03-02T00:00:00.000Z'),
        auth_identities: [
          {
            provider: AuthProvider.google,
            identifier: 'staff.fittrack@gmail.com',
            is_primary: true,
          },
          {
            provider: AuthProvider.phone,
            identifier: '+639171234567',
            is_primary: true,
          },
        ],
        profile: {
          first_name: 'Staff',
          last_name: 'Member',
          date_of_birth: null,
          gender: null,
          activity_level: 'light',
          fitness_goal: 'maintenance',
          weight_kg: null,
          height_cm: null,
          avatar_url: 'https://cdn.fittrack.test/staff-member.png',
          phone: null,
        },
      },
    ]);

    await expect(service.getAllUsers()).resolves.toEqual([
      {
        id: 'user-1',
        email: 'staff.fittrack@gmail.com',
        phone_no: null,
        role: { id: 2, name: 'STAFF' },
        emailVerified: true,
        phoneVerified: false,
        deletedAt: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
        profile: {
          firstName: 'Staff',
          lastName: 'Member',
          dateOfBirth: null,
          gender: null,
          activityLevel: 'light',
          fitnessGoal: 'maintenance',
          currentWeightKg: null,
          heightCm: null,
          avatarUrl: 'https://cdn.fittrack.test/staff-member.png',
          membershipType: null,
        },
      },
    ]);
  });

  it('maps staff coach directory records to the legacy frontend contract', async () => {
    prisma.coachProfile.findMany.mockResolvedValue([
      {
        id: 'coach-1',
        display_name: null,
        contact_email: 'coach@fittrack.test',
        contact_phone: '09170000000',
        bio: 'Strength coach',
        specialization: 'Strength, Mobility',
        certification: 'NASM-CPT, CPR',
        hourly_rate: { toString: () => '1200' },
        schedule_type: 'part_time',
        is_available_for_booking: false,
        user: {
          id: 'user-2',
          status: UserStatus.active,
          created_at: new Date('2026-02-01T00:00:00.000Z'),
          auth_identities: [
            {
              provider: AuthProvider.email,
              identifier: 'coach@fittrack.test',
              is_primary: true,
            },
          ],
          profile: {
            first_name: 'Coach',
            last_name: 'One',
            date_of_birth: null,
            gender: null,
            activity_level: 'active',
            fitness_goal: 'bulking',
            weight_kg: null,
            height_cm: null,
            avatar_url: 'https://cdn.fittrack.test/coach-one.png',
            phone: '09170000000',
          },
        },
        availability_slots: [
          {
            id: 'slot-1',
            day_of_week: 1,
            start_time: new Date('1970-01-01T08:00:00.000Z'),
            end_time: new Date('1970-01-01T10:00:00.000Z'),
          },
        ],
      },
    ]);

    await expect(service.getAllCoaches()).resolves.toEqual([
      {
        id: 'coach-1',
        displayName: 'Coach One',
        contactEmail: null,
        contactPhone: null,
        bio: 'Strength coach',
        specialties: ['Strength', 'Mobility'],
        certifications: ['NASM-CPT', 'CPR'],
        yearsExperience: null,
        hourlyRate: 1200,
        scheduleType: 'part_time',
        isActive: false,
        availability: [
          {
            id: 'slot-1',
            dayOfWeek: 1,
            startTime: '08:00',
            endTime: '10:00',
            isAvailable: true,
          },
        ],
        user: {
          id: 'user-2',
          email: 'coach@fittrack.test',
          phone_no: '09170000000',
          createdAt: '2026-02-01T00:00:00.000Z',
          profile: {
            firstName: 'Coach',
            lastName: 'One',
            dateOfBirth: null,
            gender: null,
            activityLevel: 'active',
            fitnessGoal: 'bulking',
            currentWeightKg: null,
            heightCm: null,
            avatarUrl: 'https://cdn.fittrack.test/coach-one.png',
            membershipType: null,
          },
        },
      },
    ]);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
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
    expect(prisma.coachProfile.createMany).not.toHaveBeenCalled();
  });

  it('creates missing coach profiles for active coach-role users before listing coaches', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'coach-user-qwerty',
        profile: {
          first_name: 'Qwerty',
          last_name: 'Coach',
        },
      },
    ]);
    prisma.coachProfile.findMany.mockResolvedValue([
      {
        id: 'coach-qwerty',
        display_name: null,
        contact_email: null,
        contact_phone: null,
        bio: null,
        specialization: null,
        certification: null,
        hourly_rate: { toString: () => '0' },
        schedule_type: 'part_time',
        is_available_for_booking: true,
        user: {
          id: 'coach-user-qwerty',
          status: UserStatus.active,
          created_at: new Date('2026-04-01T00:00:00.000Z'),
          auth_identities: [
            {
              provider: AuthProvider.email,
              identifier: 'qwerty@fittrack.test',
              is_primary: true,
            },
          ],
          profile: {
            first_name: 'Qwerty',
            last_name: 'Coach',
            date_of_birth: null,
            gender: null,
            activity_level: null,
            fitness_goal: null,
            weight_kg: null,
            height_cm: null,
            avatar_url: null,
            phone: null,
          },
        },
        availability_slots: [],
      },
    ]);

    const coaches = await service.getAllCoaches();

    expect(coaches).toHaveLength(1);
    expect(coaches[0]?.id).toBe('coach-qwerty');
    expect(coaches[0]?.displayName).toBe('Qwerty Coach');
    expect(coaches[0]?.user).toMatchObject({
      id: 'coach-user-qwerty',
      email: 'qwerty@fittrack.test',
    });

    expect(prisma.coachProfile.createMany).toHaveBeenCalledWith({
      data: [
        {
          user_id: 'coach-user-qwerty',
          display_name: 'Qwerty Coach',
        },
      ],
      skipDuplicates: true,
    });
  });
});
