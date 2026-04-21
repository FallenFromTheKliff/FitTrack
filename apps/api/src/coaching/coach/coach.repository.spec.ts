import { NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

import { CoachRepository } from './coach.repository';

describe('CoachRepository', () => {
  const coachProfile = {
    findMany: jest.fn(),
    count: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const coachAppointment = {
    findMany: jest.fn(),
  };
  const amenityBooking = {
    count: jest.fn(),
  };

  const prisma = {
    amenityBooking,
    coachAppointment,
    coachProfile,
    $transaction: jest.fn(),
  };

  let repo: CoachRepository;

  beforeEach(() => {
    repo = new CoachRepository(prisma as never);
    jest.clearAllMocks();
  });

  it('lists available coaches with the requested filters', async () => {
    coachProfile.findMany.mockResolvedValue([{ id: 'coach-1' }]);
    coachProfile.count.mockResolvedValue(1);

    await repo.listAvailableCoaches({
      page: 2,
      limit: 10,
      specialization: 'boxing',
      min_rating: 4,
      max_rate: 1500,
    });

    expect(coachProfile.findMany).toHaveBeenCalledWith({
      where: {
        is_available_for_booking: true,
        user: { status: UserStatus.active },
        specialization: {
          contains: 'boxing',
          mode: 'insensitive',
        },
        average_rating: { gte: 4 },
        hourly_rate: { lte: 1500 },
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [
        { average_rating: 'desc' },
        { rating_count: 'desc' },
        { hourly_rate: 'asc' },
        { created_at: 'desc' },
      ],
      skip: 10,
      take: 10,
    });
    expect(coachProfile.count).toHaveBeenCalledWith({
      where: {
        is_available_for_booking: true,
        user: { status: UserStatus.active },
        specialization: {
          contains: 'boxing',
          mode: 'insensitive',
        },
        average_rating: { gte: 4 },
        hourly_rate: { lte: 1500 },
      },
    });
  });

  it('loads a single coach profile with active availability', async () => {
    coachProfile.findFirst.mockResolvedValue({ id: 'coach-1' });

    await repo.findCoachByIdOrThrow('coach-1');

    expect(coachProfile.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'coach-1',
        user: { status: UserStatus.active },
      },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        availability_slots: {
          where: { is_active: true },
          orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
        },
      },
      orderBy: undefined,
    });
  });

  it('throws when a coach profile cannot be found by id', async () => {
    coachProfile.findFirst.mockResolvedValue(null);

    await expect(
      repo.findCoachByIdOrThrow('missing-coach'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a coach profile by owner user id', async () => {
    coachProfile.update.mockResolvedValue({ id: 'coach-1' });

    await repo.updateCoachByUserId('user-1', { bio: 'Updated' });

    expect(coachProfile.update).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      data: { bio: 'Updated' },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
        availability_slots: {
          where: { is_active: true },
          orderBy: [{ day_of_week: 'asc' }, { start_time: 'asc' }],
        },
      },
    });
  });

  it('detects overlapping active coach appointments for reservation add-ons', async () => {
    const startsAt = new Date('2099-03-23T08:30:00.000Z');
    const endsAt = new Date('2099-03-23T09:30:00.000Z');
    coachAppointment.findMany.mockResolvedValue([
      {
        scheduled_at: new Date('2099-03-23T08:00:00.000Z'),
        duration_minutes: 90,
      },
    ]);

    await expect(
      repo.hasActiveAppointmentConflict('coach-1', startsAt, endsAt),
    ).resolves.toBe(true);

    expect(coachAppointment.findMany).toHaveBeenCalledWith({
      where: {
        coach_id: 'coach-1',
        status: { in: ['pending_coach', 'pending_payment', 'confirmed'] },
        scheduled_at: {
          gte: new Date('2099-03-23T05:30:00.000Z'),
          lt: endsAt,
        },
      },
      select: {
        scheduled_at: true,
        duration_minutes: true,
      },
    });
  });

  it('detects overlapping coach-linked venue bookings for reservation add-ons', async () => {
    const startsAt = new Date('2099-03-23T08:30:00.000Z');
    const endsAt = new Date('2099-03-23T09:30:00.000Z');
    amenityBooking.count.mockResolvedValue(1);

    await expect(
      repo.hasActiveLinkedBookingConflict('coach-1', startsAt, endsAt),
    ).resolves.toBe(true);

    expect(amenityBooking.count).toHaveBeenCalledWith({
      where: {
        coach_id: 'coach-1',
        status: { in: ['pending', 'confirmed', 'balance_pending'] },
        starts_at: { lt: endsAt },
        ends_at: { gt: startsAt },
      },
    });
  });
});
