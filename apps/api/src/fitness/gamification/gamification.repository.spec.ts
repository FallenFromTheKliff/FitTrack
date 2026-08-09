import { MasteryRank, Prisma } from '@prisma/client';

import { GamificationRepository } from './gamification.repository';

describe('GamificationRepository', () => {
  const muscleMasteryProgress = {
    findMany: jest.fn(),
    groupBy: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  };

  const exerciseLog = {
    findMany: jest.fn(),
  };

  const seasonalStanding = {
    findMany: jest.fn(),
    count: jest.fn(),
  };

  const seasonalMuscleStanding = {
    findMany: jest.fn(),
    count: jest.fn(),
  };

  const seasonDefinition = {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  };

  const prisma = {
    muscleMasteryProgress,
    exerciseLog,
    seasonalStanding,
    seasonalMuscleStanding,
    seasonDefinition,
    $transaction: jest.fn(),
  };

  let repo: GamificationRepository;

  beforeEach(() => {
    repo = new GamificationRepository(prisma as never);
    jest.clearAllMocks();
    seasonDefinition.findFirst.mockResolvedValue({ id: 'season-active' });
  });

  it('normalizes and tokenizes ranking governance member searches', async () => {
    const expectedNameToken = (token: string) => ({
      OR: [
        {
          user: {
            profile: {
              is: {
                first_name: { contains: token, mode: 'insensitive' },
              },
            },
          },
        },
        {
          user: {
            profile: {
              is: {
                last_name: { contains: token, mode: 'insensitive' },
              },
            },
          },
        },
      ],
    });

    seasonalStanding.findMany.mockResolvedValue([]);
    seasonalStanding.count.mockResolvedValue(0);
    prisma.$transaction.mockResolvedValue([[], 0]);

    await repo.listAdminSeasonStandings({
      search: '  nELsOn   DeLa   CrUz  ',
    });

    const query = seasonalStanding.findMany.mock.calls[0][0];
    expect(query.where.OR[0]).toEqual({
      AND: [
        expectedNameToken('nELsOn'),
        expectedNameToken('DeLa'),
        expectedNameToken('CrUz'),
      ],
    });
    expect(query.where.OR[1]).toEqual({
      user: {
        ranking_profile: {
          is: {
            display_alias: {
              contains: 'nELsOn DeLa CrUz',
              mode: 'insensitive',
            },
          },
        },
      },
    });
  });

  it('derives current season ranks from score order instead of stored positions', async () => {
    const rows = [
      {
        season_id: 'season-active',
        season_points: 240,
        rank_position: 2,
        is_hidden: false,
        is_disqualified: false,
      },
      {
        season_id: 'season-active',
        season_points: 120,
        rank_position: 1,
        is_hidden: false,
        is_disqualified: false,
      },
      {
        season_id: 'season-active',
        season_points: 80,
        rank_position: 3,
        is_hidden: true,
        is_disqualified: false,
      },
    ];
    prisma.$transaction.mockResolvedValue([rows, rows.length]);

    const result = await repo.listAdminSeasonStandings({
      seasonId: 'season-active',
      limit: 10,
    });

    expect(result.data.map((row) => row.rank_position)).toEqual([1, 2, null]);
  });

  it('uses the latest closed season for muscle standings when no season is active', async () => {
    seasonDefinition.findFirst
      .mockReset()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'season-closed',
        status: 'closed',
        title: 'Spring 2026',
      });
    prisma.$transaction.mockResolvedValue([
      [
        {
          user_id: 'user-1',
          user: { profile: { first_name: 'Nels', last_name: 'DeLa Cruz' } },
          muscle_group: 'chest',
          muscle_points: 140,
          rank_position: 9,
          is_hidden: false,
          is_disqualified: false,
          last_earned_at: null,
        },
      ],
      1,
    ]);

    const result = await repo.listMuscleLeaderboard({
      muscleKey: 'chest',
      scope: 'season',
      search: '  nels   DeLa   Cruz ',
    });

    expect(result.data[0]).toMatchObject({
      displayName: 'Nels DeLa Cruz',
      rankPosition: 1,
      seasonId: 'season-closed',
    });
    expect(seasonalMuscleStanding.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        season_id: 'season-closed',
        user: {
          OR: [
            expect.objectContaining({ AND: expect.any(Array) }),
            expect.any(Object),
          ],
        },
      }),
    );
  });

  it('returns an empty season muscle result when there is no season history', async () => {
    seasonDefinition.findFirst.mockReset().mockResolvedValue(null);

    await expect(
      repo.listMuscleLeaderboard({ muscleKey: 'chest', scope: 'season' }),
    ).resolves.toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, total_pages: 0 },
    });
  });

  it('lists mastery rows for one user with the requested filters', async () => {
    muscleMasteryProgress.findMany.mockResolvedValue([{ id: 'mastery-1' }]);

    await repo.listMuscleMastery('user-1', {
      muscle_group: 'legs',
      rank: MasteryRank.gold,
    });

    expect(muscleMasteryProgress.findMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        muscle_group: {
          contains: 'legs',
          mode: 'insensitive',
        },
        rank: MasteryRank.gold,
      },
      orderBy: [
        { xp_points: 'desc' },
        { total_volume_kg: 'desc' },
        { muscle_group: 'asc' },
      ],
    });
  });

  it('groups total xp by user for the leaderboard', async () => {
    muscleMasteryProgress.groupBy.mockResolvedValue([
      { user_id: 'user-1', _sum: { xp_points: 1250 } },
      { user_id: 'user-2', _sum: { xp_points: null } },
    ]);

    await expect(repo.listLeaderboardTotals()).resolves.toEqual([
      { user_id: 'user-1', total_xp: 1250 },
      { user_id: 'user-2', total_xp: 0 },
    ]);
    expect(muscleMasteryProgress.groupBy).toHaveBeenCalledWith({
      by: ['user_id'],
      _sum: { xp_points: true },
    });
  });

  it('loads workout completion logs with linked muscle groups', async () => {
    exerciseLog.findMany.mockResolvedValue([
      { exercise: { muscle_group: 'legs' } },
    ]);

    await repo.listWorkoutCompletionLogs('session-1', 'user-1');

    expect(exerciseLog.findMany).toHaveBeenCalledWith({
      where: {
        session_id: 'session-1',
        user_id: 'user-1',
        OR: [
          { reps_completed: { not: null } },
          { reps_ai_counted: { not: null } },
        ],
      },
      select: {
        reps_completed: true,
        reps_ai_counted: true,
        weight_kg: true,
        exercise: {
          select: {
            muscle_group: true,
          },
        },
      },
    });
  });

  it('upserts mastery totals by user and muscle group', async () => {
    const volumeKgDelta = new Prisma.Decimal('700');

    muscleMasteryProgress.upsert.mockResolvedValue({ id: 'mastery-1' });

    await repo.upsertMuscleMasteryProgress({
      userId: 'user-1',
      muscleGroup: 'legs',
      xpDelta: 75,
      volumeKgDelta,
    });

    expect(muscleMasteryProgress.upsert).toHaveBeenCalledWith({
      where: {
        user_id_muscle_group: {
          user_id: 'user-1',
          muscle_group: 'legs',
        },
      },
      create: {
        user_id: 'user-1',
        muscle_group: 'legs',
        xp_points: 75,
        total_volume_kg: volumeKgDelta,
        rank: MasteryRank.bronze,
      },
      update: {
        xp_points: {
          increment: 75,
        },
        total_volume_kg: {
          increment: volumeKgDelta,
        },
      },
    });
  });

  it('updates the stored rank and ranked timestamp after promotion', async () => {
    const rankedAt = new Date('2026-03-27T03:00:00.000Z');

    muscleMasteryProgress.update.mockResolvedValue({ id: 'mastery-1' });

    await repo.updateMuscleMasteryRank({
      masteryId: 'mastery-1',
      rank: MasteryRank.gold,
      rankedAt,
    });

    expect(muscleMasteryProgress.update).toHaveBeenCalledWith({
      where: { id: 'mastery-1' },
      data: {
        rank: MasteryRank.gold,
        last_ranked_at: rankedAt,
      },
    });
  });
});
