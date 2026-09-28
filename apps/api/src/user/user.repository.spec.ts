import type { PrismaService } from '../prisma/prisma.service';

import { UserRepository } from './user.repository';

describe('UserRepository profile updates', () => {
  let repository: UserRepository;
  const prisma = {
    userProfile: {
      update: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    repository = new UserRepository(prisma);
    jest.clearAllMocks();
  });

  it('returns the current profile without writing an empty patch', async () => {
    const currentProfile = { user_id: 'user-1' };
    const findProfile = jest
      .spyOn(repository, 'findUserProfileByUserIdOrThrow')
      .mockResolvedValue(currentProfile as never);

    await expect(repository.updateProfile('user-1', {})).resolves.toBe(
      currentProfile,
    );
    expect(findProfile).toHaveBeenCalledWith('user-1');
    expect(prisma.userProfile.update).not.toHaveBeenCalled();
  });

  it('writes non-empty patches through the profile delegate', async () => {
    const updatedProfile = { user_id: 'user-1', first_name: 'Fit' };
    prisma.userProfile.update.mockResolvedValue(updatedProfile);

    await expect(
      repository.updateProfile('user-1', { first_name: 'Fit' }),
    ).resolves.toBe(updatedProfile);
    expect(prisma.userProfile.update).toHaveBeenCalledWith({
      where: { user_id: 'user-1' },
      data: { first_name: 'Fit' },
      include: undefined,
    });
  });
});

describe('UserRepository attendance filtering', () => {
  let repository: UserRepository;
  const prisma = {
    attendanceLog: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    repository = new UserRepository(prisma);
    prisma.attendanceLog.count.mockResolvedValue(0);
    prisma.attendanceLog.findMany.mockResolvedValue([]);
    jest.clearAllMocks();
  });

  it('filters by member identity before deterministic pagination', async () => {
    await repository.getAllAttendance({
      end_date: '2026-08-28T23:59:59.999Z',
      limit: 6,
      order: 'asc',
      page: 2,
      search: 'Maria Santos',
      start_date: '2026-08-01T00:00:00.000Z',
    });

    const findManyArgs = prisma.attendanceLog.findMany.mock.calls[0]?.[0];
    expect(findManyArgs).toMatchObject({
      orderBy: [{ check_in_at: 'asc' }, { id: 'asc' }],
      skip: 6,
      take: 6,
      where: {
        check_in_at: {
          gte: new Date('2026-08-01T00:00:00.000Z'),
          lte: new Date('2026-08-28T23:59:59.999Z'),
        },
      },
    });
    expect(findManyArgs.where.user.AND).toHaveLength(2);
    expect(findManyArgs.where.user.AND[0].OR).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: expect.anything() })]),
    );
    expect(findManyArgs.where.user.AND[0].OR).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile: {
            is: {
              OR: expect.arrayContaining([
                { first_name: { contains: 'Maria', mode: 'insensitive' } },
                { last_name: { contains: 'Maria', mode: 'insensitive' } },
              ]),
            },
          },
        }),
      ]),
    );
    expect(prisma.attendanceLog.count).toHaveBeenCalledWith({
      where: findManyArgs.where,
    });
  });

  it('defaults attendance ordering to newest first without a state filter', async () => {
    await repository.getAllAttendance({});

    const findManyArgs = prisma.attendanceLog.findMany.mock.calls[0]?.[0];
    expect(findManyArgs).toMatchObject({
      orderBy: [{ check_in_at: 'desc' }, { id: 'desc' }],
      where: {},
    });
  });

  it('uses exact equality for a valid UUID search', async () => {
    const userId = '2d1fb357-3ffd-4e5e-9f74-4546e408d0a2';

    await repository.getAllAttendance({ search: userId });

    const findManyArgs = prisma.attendanceLog.findMany.mock.calls[0]?.[0];
    expect(findManyArgs.where.user).toEqual({ id: userId });
  });
});
