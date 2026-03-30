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

  const prisma = {
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
});
