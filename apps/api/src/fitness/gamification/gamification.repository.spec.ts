import { BadRequestException, ConflictException } from '@nestjs/common';
import { MasteryRank, Prisma } from '@prisma/client';

import { GamificationRepository } from './gamification.repository';

describe('GamificationRepository', () => {
  const muscleMasteryProgress = {
    findMany: jest.fn(),
    groupBy: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  };

  const exerciseLog = {
    aggregate: jest.fn(),
    findMany: jest.fn(),
  };

  const seasonalStanding = {
    findMany: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  };

  const seasonalMuscleStanding = {
    findMany: jest.fn(),
    count: jest.fn(),
    createMany: jest.fn(),
    deleteMany: jest.fn(),
  };

  const seasonDefinition = {
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
  };

  const muscleDefinition = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  };

  const userProgressionProfile = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
    upsert: jest.fn(),
  };

  const user = {
    findFirst: jest.fn(),
    findMany: jest.fn(),
  };
  const progressionSourceEvent = {
    count: jest.fn(),
    create: jest.fn(),
    findUnique: jest.fn(),
  };
  const progressionGrantLedger = {
    create: jest.fn(),
    groupBy: jest.fn(),
  };
  const rankingProfile = { findMany: jest.fn(), upsert: jest.fn() };
  const moderationActionRecord = { create: jest.fn() };
  const milestoneDefinition = { findMany: jest.fn() };
  const userMilestoneProgress = { create: jest.fn(), update: jest.fn() };
  const nutritionLog = { count: jest.fn() };
  const coachAppointment = { count: jest.fn() };
  const amenityBooking = { count: jest.fn() };
  const aiChatMessage = { count: jest.fn() };
  const gymChatMessage = { count: jest.fn() };

  const prisma = {
    muscleMasteryProgress,
    exerciseLog,
    seasonalStanding,
    seasonalMuscleStanding,
    seasonDefinition,
    muscleDefinition,
    userProgressionProfile,
    user,
    progressionSourceEvent,
    progressionGrantLedger,
    rankingProfile,
    moderationActionRecord,
    milestoneDefinition,
    userMilestoneProgress,
    nutritionLog,
    coachAppointment,
    amenityBooking,
    aiChatMessage,
    gymChatMessage,
    $transaction: jest.fn(),
  };

  let repo: GamificationRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repo = new GamificationRepository(prisma as never);
    seasonDefinition.findFirst.mockResolvedValue({ id: 'season-active' });
    muscleDefinition.findUnique.mockResolvedValue({
      is_active: true,
      key: 'chest',
    });
  });

  const runSeasonTransaction = () => {
    prisma.$transaction.mockImplementation(async (work) =>
      work({ seasonDefinition } as never),
    );
  };

  const runSeasonLifecycleTransaction = () => {
    prisma.$transaction.mockImplementation(async (work) =>
      work({
        seasonDefinition,
        seasonalMuscleStanding,
        seasonalStanding,
        progressionGrantLedger,
        rankingProfile,
        userProgressionProfile,
        user,
      } as never),
    );
  };

  const mockExistingSeasonInterval = (
    existingStartsAt: Date,
    existingEndsAt: Date,
    existingStatus = 'draft',
  ) => {
    seasonDefinition.findFirst.mockImplementation(({ where }) => {
      const orConditions = Array.isArray(where.OR) ? where.OR : [];
      const candidateStartsAt =
        (where.ends_at?.gt as Date) ??
        (orConditions.find((condition: any) => condition.ends_at?.gt)?.ends_at
          .gt as Date) ??
        null;
      const candidateEndsAt =
        (where.starts_at?.lt as Date) ??
        (orConditions.find((condition: any) => condition.starts_at?.lt)
          ?.starts_at.lt as Date) ??
        null;
      if (!candidateStartsAt || !candidateEndsAt) {
        return Promise.resolve(null);
      }

      const overlaps =
        existingStartsAt < candidateEndsAt &&
        existingEndsAt > candidateStartsAt;
      if (!overlaps) {
        return Promise.resolve(null);
      }

      if (where.status?.not === 'archived') {
        if (existingStatus === 'archived') {
          return Promise.resolve(null);
        }
      }

      if (where.status?.in) {
        if (!where.status.in.includes(existingStatus)) {
          return Promise.resolve(null);
        }
      }

      if (Array.isArray(where.OR)) {
        const hasMatchingOr = where.OR.some((condition: any) => {
          if (condition.status === 'active') {
            return false;
          }
          if (condition.status === 'draft') {
            return existingStatus === 'draft';
          }
          if (condition.status === 'closed') {
            return existingStatus === 'closed';
          }
          return false;
        });
        if (!hasMatchingOr) {
          return Promise.resolve(null);
        }
      }

      return Promise.resolve({ id: 'existing-season', status: existingStatus });
    });
  };

  const runManualGrantTransaction = () => {
    prisma.$transaction.mockImplementation(async (work) =>
      work(prisma as never),
    );
  };

  const manualGrantInput = {
    actorUserId: 'admin-1',
    allocations: [
      { muscle_group: 'chest', amount: 125 },
      { muscle_group: 'triceps', amount: 100 },
    ],
    rationale: 'Verified multi-muscle session.',
    sourceId: 'manual_exp:11111111-1111-4111-8111-111111111111',
    userId: 'member-1',
  };

  const makeAdminStanding = (input: {
    firstName?: string;
    isHidden?: boolean;
    seasonPoints: number;
    totalXp: number;
    userId: string;
  }) => ({
    id: `standing-${input.userId}`,
    season_id: 'season-active',
    user_id: input.userId,
    season_points: input.seasonPoints,
    rank_position: null,
    is_hidden: input.isHidden ?? false,
    is_disqualified: false,
    last_earned_at: null,
    season: {
      id: 'season-active',
      title: 'Current Season',
      status: 'active',
      starts_at: new Date('2026-08-01T00:00:00.000Z'),
    },
    user: {
      profile: {
        first_name: input.firstName ?? input.userId,
        last_name: 'Member',
      },
      ranking_profile: null,
      progression_profile: { total_xp: input.totalXp },
      muscle_mastery: [],
      milestone_progress: [],
    },
  });

  it.each([
    ['containment', new Date('2026-01-11T00:00:00.000Z'), new Date('2026-01-19T00:00:00.000Z')],
    ['partial overlap on the left', new Date('2026-01-05T00:00:00.000Z'), new Date('2026-01-12T00:00:00.000Z')],
    ['partial overlap on the right', new Date('2026-01-18T00:00:00.000Z'), new Date('2026-01-25T00:00:00.000Z')],
  ])('rejects %s season creation', async (_label, startsAt, endsAt) => {
    runSeasonTransaction();
    mockExistingSeasonInterval(
      new Date('2026-01-10T00:00:00.000Z'),
      new Date('2026-01-20T00:00:00.000Z'),
    );

    await expect(
      repo.createSeason({
        autoStartNext: false,
        description: null,
        endsAt,
        rulesVersion: 'v1',
        startsAt,
        title: 'Overlap',
      }),
    ).rejects.toThrow(ConflictException);
    expect(seasonDefinition.create).not.toHaveBeenCalled();
  });

  it.each([
    ['exact boundary before', new Date('2026-01-01T00:00:00.000Z'), new Date('2026-01-10T00:00:00.000Z')],
    ['exact boundary after', new Date('2026-01-20T00:00:00.000Z'), new Date('2026-01-30T00:00:00.000Z')],
    ['non-overlap before', new Date('2025-12-01T00:00:00.000Z'), new Date('2026-01-09T00:00:00.000Z')],
    ['non-overlap after', new Date('2026-01-21T00:00:00.000Z'), new Date('2026-02-01T00:00:00.000Z')],
  ])('allows %s season creation', async (_label, startsAt, endsAt) => {
    runSeasonTransaction();
    mockExistingSeasonInterval(
      new Date('2026-01-10T00:00:00.000Z'),
      new Date('2026-01-20T00:00:00.000Z'),
    );
    seasonDefinition.create.mockResolvedValue({ id: 'created-season' });

    await expect(
      repo.createSeason({
        autoStartNext: false,
        description: null,
        endsAt,
        rulesVersion: 'v1',
        startsAt,
        title: 'Available',
      }),
    ).resolves.toEqual({ id: 'created-season' });
    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  });

  it('rejects a draft update that overlaps another season', async () => {
    runSeasonTransaction();
    seasonDefinition.findUniqueOrThrow.mockResolvedValue({
      ends_at: new Date('2026-01-20T00:00:00.000Z'),
      starts_at: new Date('2026-01-10T00:00:00.000Z'),
      status: 'draft',
    });
    seasonDefinition.findFirst.mockResolvedValue({ id: 'other-season' });

    await expect(
      repo.updateDraftSeason({
        endsAt: new Date('2026-01-25T00:00:00.000Z'),
        seasonId: 'draft-season',
      }),
    ).rejects.toThrow(ConflictException);
    expect(seasonDefinition.update).not.toHaveBeenCalled();
  });

  it('excludes the edited season itself from the overlap check', async () => {
    runSeasonTransaction();
    seasonDefinition.findUniqueOrThrow.mockResolvedValue({
      ends_at: new Date('2026-01-20T00:00:00.000Z'),
      starts_at: new Date('2026-01-10T00:00:00.000Z'),
      status: 'draft',
    });
    seasonDefinition.findFirst.mockResolvedValue(null);
    seasonDefinition.update.mockResolvedValue({ id: 'draft-season' });

    await expect(
      repo.updateDraftSeason({ seasonId: 'draft-season' }),
    ).resolves.toEqual({ id: 'draft-season' });

      expect(seasonDefinition.findFirst).toHaveBeenCalledWith({
      where: {
        id: { not: 'draft-season' },
        archived_at: null,
        OR: [
          {
            status: 'draft',
            starts_at: {
              lt: new Date('2026-01-20T00:00:00.000Z'),
            },
            ends_at: {
              gt: new Date('2026-01-10T00:00:00.000Z'),
            },
          },
          {
            status: 'closed',
            starts_at: {
              lt: new Date('2026-01-20T00:00:00.000Z'),
            },
            OR: [
              {
                closed_at: null,
                ends_at: {
                  gt: new Date('2026-01-10T00:00:00.000Z'),
                  lte: expect.any(Date),
                },
              },
              {
                closed_at: { gt: new Date('2026-01-10T00:00:00.000Z') },
              },
            ],
          },
        ],
      },
      select: { id: true },
    });
  });

  it('ignores archived seasons when checking new season creation', async () => {
    runSeasonTransaction();
    mockExistingSeasonInterval(
      new Date('2026-01-10T00:00:00.000Z'),
      new Date('2026-01-20T00:00:00.000Z'),
      'archived',
    );
    seasonDefinition.create.mockResolvedValue({ id: 'created-season' });

    await expect(
      repo.createSeason({
        autoStartNext: false,
        description: null,
        endsAt: new Date('2026-01-15T00:00:00.000Z'),
        rulesVersion: 'v1',
        startsAt: new Date('2026-01-12T00:00:00.000Z'),
        title: 'After Archived Window',
      }),
    ).resolves.toEqual({ id: 'created-season' });
  });

  it('allows creating a season while another season is active', async () => {
    const now = new Date('2026-01-15T08:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(now);
    try {
      runSeasonTransaction();
      mockExistingSeasonInterval(
        new Date('2025-12-01T00:00:00.000Z'),
        new Date('2026-01-30T00:00:00.000Z'),
        'active',
      );
      seasonDefinition.create.mockResolvedValue({ id: 'created-season' });

      await expect(
        repo.createSeason({
          autoStartNext: false,
          description: null,
          endsAt: new Date('2026-02-01T00:00:00.000Z'),
          rulesVersion: 'v1',
          startsAt: new Date('2026-01-20T01:00:00.000Z'),
          title: 'With Active Season',
        }),
      ).resolves.toEqual({ id: 'created-season' });
    } finally {
      jest.useRealTimers();
    }
  });

  it('starts a future draft season immediately when manually activated', async () => {
    const now = new Date('2026-01-15T10:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(now);
    try {
      runSeasonLifecycleTransaction();
      user.findMany.mockResolvedValue([]);
      seasonDefinition.findUniqueOrThrow.mockResolvedValue({
        auto_start_next: false,
        description: null,
        ends_at: new Date('2026-01-30T00:00:00.000Z'),
        id: 'season-future',
        rules_version: 'v1',
        starts_at: new Date('2026-01-20T00:00:00.000Z'),
        status: 'draft',
        title: 'Future Draft',
      });
      seasonDefinition.findFirst.mockResolvedValue(null);
      seasonalStanding.createMany.mockResolvedValue([]);
      seasonDefinition.update.mockResolvedValue({
        auto_start_next: false,
        archived_at: null,
        closed_at: null,
        ends_at: new Date('2026-01-30T00:00:00.000Z'),
        id: 'season-future',
        rules_version: 'v1',
        starts_at: now,
        status: 'active',
        title: 'Future Draft',
      });

      await expect(
        repo.updateSeasonStatus({
          actorUserId: 'admin-1',
          rationale: 'Manual start test.',
          seasonId: 'season-future',
          status: 'active',
        }),
      ).resolves.toMatchObject({
        status: 'active',
        seasonId: 'season-future',
      });

      expect(seasonDefinition.update).toHaveBeenCalledWith({
        where: { id: 'season-future' },
        data: expect.objectContaining({
          status: 'active',
          activated_at: now,
          starts_at: now,
          archived_at: null,
          closed_at: null,
        }),
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('prevents creating a second active season during manual activation', async () => {
    runSeasonLifecycleTransaction();
    user.findMany.mockResolvedValue([]);
    seasonDefinition.findUniqueOrThrow.mockResolvedValue({
      auto_start_next: false,
      description: null,
      ends_at: new Date('2026-01-30T00:00:00.000Z'),
      id: 'season-draft-blocked',
      rules_version: 'v1',
      starts_at: new Date('2026-01-10T00:00:00.000Z'),
      status: 'draft',
      title: 'Second Active Candidate',
    });
    seasonDefinition.findFirst.mockResolvedValue({ id: 'season-existing-active' });

    await expect(
      repo.updateSeasonStatus({
        actorUserId: 'admin-1',
        rationale: 'Blocked active start.',
        seasonId: 'season-draft-blocked',
        status: 'active',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(seasonDefinition.update).not.toHaveBeenCalled();
  });

  it('shortens an active season when it is closed before its configured end', async () => {
    const now = new Date('2026-01-18T10:00:00.000Z');
    jest.useFakeTimers();
    jest.setSystemTime(now);
    try {
      runSeasonLifecycleTransaction();
      user.findMany.mockResolvedValue([]);
      progressionGrantLedger.groupBy.mockResolvedValue([]);
      rankingProfile.findMany.mockResolvedValue([]);
      seasonalMuscleStanding.findMany.mockResolvedValue([]);
      seasonalStanding.findMany.mockResolvedValue([]);
      seasonalStanding.update.mockResolvedValue({});
      userProgressionProfile.updateMany.mockResolvedValue({});
      seasonalMuscleStanding.deleteMany.mockResolvedValue({});
      seasonDefinition.findUniqueOrThrow.mockResolvedValue({
        auto_start_next: false,
        closed_at: null,
        description: null,
        ends_at: new Date('2026-01-25T00:00:00.000Z'),
        id: 'season-active-early-close',
        rules_version: 'v1',
        starts_at: new Date('2026-01-10T00:00:00.000Z'),
        status: 'active',
        title: 'Active Season',
      });
      seasonDefinition.update.mockResolvedValue({
        auto_start_next: false,
        closed_at: now,
        ends_at: now,
        id: 'season-active-early-close',
        status: 'closed',
        title: 'Active Season',
      });

      await expect(
        repo.updateSeasonStatus({
          actorUserId: 'admin-1',
          rationale: 'Closed before scheduled end.',
          seasonId: 'season-active-early-close',
          status: 'closed',
        }),
      ).resolves.toMatchObject({
        seasonId: 'season-active-early-close',
        status: 'closed',
      });

      expect(seasonDefinition.update).toHaveBeenCalledWith({
        where: { id: 'season-active-early-close' },
        data: expect.objectContaining({
          status: 'closed',
          closed_at: now,
          ends_at: now,
        }),
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('allows a new season immediately after an early-closed season', async () => {
    runSeasonTransaction();
    mockExistingSeasonInterval(
      new Date('2026-01-10T00:00:00.000Z'),
      new Date('2026-01-18T10:00:00.000Z'),
      'closed',
    );
    seasonDefinition.create.mockResolvedValue({ id: 'created-season' });

    await expect(
      repo.createSeason({
        autoStartNext: false,
        description: null,
        endsAt: new Date('2026-01-20T00:00:00.000Z'),
        rulesVersion: 'v1',
        startsAt: new Date('2026-01-18T10:00:01.000Z'),
        title: 'Next Season After Close',
      }),
    ).resolves.toEqual({ id: 'created-season' });
  });

  it('orders Overall by total EXP with non-null competition ties', async () => {
    seasonDefinition.findUnique.mockResolvedValue({ status: 'closed' });
    seasonalStanding.findMany.mockResolvedValue([
      makeAdminStanding({
        userId: 'lower-total',
        totalXp: 1691,
        seasonPoints: 900,
      }),
      makeAdminStanding({
        userId: 'high-total-b',
        totalXp: 2344,
        seasonPoints: 25,
        isHidden: true,
      }),
      makeAdminStanding({
        userId: 'high-total-a',
        totalXp: 2344,
        seasonPoints: 50,
      }),
    ]);

    const result = await repo.listAdminSeasonStandings({
      seasonId: 'season-active',
      limit: 10,
    });

    expect(result.data.map((row) => row.user_id)).toEqual([
      'high-total-a',
      'high-total-b',
      'lower-total',
    ]);
    expect(result.data.map((row) => row.rank_position)).toEqual([1, 1, 3]);
    expect(result.data.every((row) => row.rank_position !== null)).toBe(true);
  });

  it('preserves a searched member global Overall rank', async () => {
    seasonDefinition.findUnique.mockResolvedValue({ status: 'closed' });
    seasonalStanding.findMany.mockResolvedValue(
      Array.from({ length: 20 }, (_, index) =>
        makeAdminStanding({
          userId: `user-${String(index + 1).padStart(2, '0')}`,
          firstName: index === 16 ? 'Maria' : `Member${index + 1}`,
          totalXp: 3000 - index * 50,
          seasonPoints: index * 100,
        }),
      ),
    );

    const result = await repo.listAdminSeasonStandings({
      seasonId: 'season-active',
      search: '  MARIA   Member ',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      user_id: 'user-17',
      rank_position: 17,
    });
    expect(result.meta.total).toBe(1);
    expect(seasonalStanding.findMany.mock.calls[0][0].where).toEqual({
      season_id: 'season-active',
      season: { status: { not: 'archived' } },
    });
  });

  it('keeps page two Overall ranks globally monotonic', async () => {
    seasonDefinition.findUnique.mockResolvedValue({ status: 'closed' });
    seasonalStanding.findMany.mockResolvedValue(
      Array.from({ length: 25 }, (_, index) =>
        makeAdminStanding({
          userId: `user-${String(index + 1).padStart(2, '0')}`,
          totalXp: 5000 - index * 25,
          seasonPoints: index * 100,
        }),
      ),
    );

    const result = await repo.listAdminSeasonStandings({
      seasonId: 'season-active',
      page: 2,
      limit: 10,
    });

    expect(result.data.map((row) => row.rank_position)).toEqual([
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
    ]);
    expect(result.meta).toEqual({
      page: 2,
      limit: 10,
      total: 25,
      total_pages: 3,
    });
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
      rankPosition: 9,
      seasonId: 'season-closed',
    });
    expect(seasonalMuscleStanding.findMany.mock.calls[0][0].where).toEqual(
      expect.objectContaining({
        muscle_group: { equals: 'chest', mode: 'insensitive' },
        season_id: 'season-closed',
        is_disqualified: false,
        is_hidden: false,
        last_earned_at: { lte: expect.any(Date) },
        user: {
          AND: expect.arrayContaining([
            { ranking_profile: { is: { visibility: 'public' } } },
            { OR: expect.any(Array) },
          ]),
        },
      }),
    );
  });

  it('orders lifetime muscle standings by selected muscle EXP with competition ties', async () => {
    const makeRow = (userId: string, xpPoints: number) => ({
      user_id: userId,
      user: { profile: null, ranking_profile: null },
      muscle_group: 'chest',
      xp_points: xpPoints,
      last_ranked_at: null,
    });
    prisma.$transaction.mockResolvedValue([
      [makeRow('user-a', 300), makeRow('user-b', 300), makeRow('user-c', 100)],
      3,
    ]);

    const result = await repo.listMuscleLeaderboard({
      muscleKey: 'chest',
      scope: 'lifetime',
    });

    expect(result.data.map((row) => row.xpPoints)).toEqual([300, 300, 100]);
    expect(result.data.map((row) => row.rankPosition)).toEqual([1, 1, 3]);
    expect(muscleMasteryProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ xp_points: 'desc' }, { user_id: 'asc' }],
      }),
    );
  });

  it('preserves lifetime muscle rank when a member search narrows the result', async () => {
    const makeRow = (userId: string, xpPoints: number, firstName: string) => ({
      user_id: userId,
      user: {
        profile: { first_name: firstName, last_name: 'Member' },
        ranking_profile: null,
      },
      muscle_group: 'chest',
      xp_points: xpPoints,
      last_ranked_at: null,
    });
    const fullRows = [
      makeRow('user-1', 300, 'Top'),
      makeRow('user-2', 200, 'Second'),
      makeRow('user-3', 100, 'Maria'),
    ];
    prisma.$transaction.mockResolvedValue([[fullRows[2]], 1]);
    muscleMasteryProgress.findMany.mockResolvedValue(fullRows);

    const result = await repo.listMuscleLeaderboard({
      muscleKey: 'chest',
      scope: 'lifetime',
      search: 'Maria Member',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      displayName: 'Maria Member',
      rankPosition: 3,
    });
    expect(muscleMasteryProgress.findMany).toHaveBeenCalledTimes(2);
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

  it('uses canonical total xp by user for the leaderboard', async () => {
    userProgressionProfile.findMany.mockResolvedValue([
      { user_id: 'user-1', total_xp: 1250 },
      { user_id: 'user-2', total_xp: 0 },
    ]);

    await expect(repo.listLeaderboardTotals()).resolves.toEqual([
      { user_id: 'user-1', total_xp: 1250 },
      { user_id: 'user-2', total_xp: 0 },
    ]);
    expect(userProgressionProfile.findMany).toHaveBeenCalledWith({
      select: { user_id: true, total_xp: true },
      orderBy: { user_id: 'asc' },
    });
  });

  it('rejects muscle standings for an unknown database muscle definition', async () => {
    muscleDefinition.findUnique.mockResolvedValue(null);

    await expect(
      repo.listMuscleLeaderboard({ muscleKey: 'unknown', scope: 'lifetime' }),
    ).rejects.toThrow('Muscle group unknown was not found.');
  });

  it.each([
    ['chest', 'upper_body_push'],
    ['quads', 'lower_body'],
  ])('resolves the legacy %s key through an active alias', async (legacyKey, bodyRegion) => {
    muscleDefinition.findUnique.mockResolvedValue(null);
    muscleDefinition.findMany.mockResolvedValue([
      {
        aliases: [legacyKey],
        body_region: bodyRegion,
        icon_asset_key: null,
        icon_key: 'dumbbell',
        icon_kind: 'library',
        is_active: true,
        key: `${legacyKey}_canonical`,
      },
    ]);
    prisma.$transaction.mockResolvedValue([[], 0]);

    const result = await repo.listMuscleLeaderboard({
      muscleKey: legacyKey,
      scope: 'lifetime',
    });

    expect(result.data).toEqual([]);
    expect(muscleMasteryProgress.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          muscle_group: {
            equals: `${legacyKey}_canonical`,
            mode: 'insensitive',
          },
        }),
      }),
    );
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

  it('applies multiple manual EXP allocations atomically and updates totals and standings', async () => {
    runManualGrantTransaction();
    user.findFirst.mockResolvedValue({ id: 'member-1' });
    muscleDefinition.findMany.mockResolvedValue([
      { key: 'chest' },
      { key: 'triceps' },
    ]);
    progressionSourceEvent.findUnique.mockResolvedValue(null);
    progressionSourceEvent.create.mockResolvedValue({ id: 'source-1' });
    progressionSourceEvent.count.mockResolvedValue(0);
    rankingProfile.upsert.mockResolvedValue({});
    rankingProfile.findMany.mockResolvedValue([]);
    seasonDefinition.findFirst.mockResolvedValue({ id: 'season-active' });
    userProgressionProfile.findUnique.mockResolvedValue({
      active_season_id: 'season-active',
      current_season_points: 50,
      current_streak: 0,
      longest_streak: 0,
      total_xp: 500,
    });
    progressionGrantLedger.create
      .mockResolvedValueOnce({ id: 'grant-1' })
      .mockResolvedValueOnce({ id: 'grant-2' })
      .mockResolvedValueOnce({ id: 'season-grant' });
    muscleMasteryProgress.upsert
      .mockResolvedValueOnce({
        id: 'mastery-chest',
        rank: MasteryRank.bronze,
        xp_points: 125,
        total_volume_kg: new Prisma.Decimal(0),
      })
      .mockResolvedValueOnce({
        id: 'mastery-triceps',
        rank: MasteryRank.bronze,
        xp_points: 100,
        total_volume_kg: new Prisma.Decimal(0),
      });
    muscleMasteryProgress.count.mockResolvedValue(2);
    progressionGrantLedger.groupBy.mockResolvedValue([
      {
        user_id: 'member-1',
        muscle_group: 'chest',
        _sum: { amount: 125 },
        _max: { created_at: new Date('2026-08-11T00:00:00.000Z') },
      },
      {
        user_id: 'member-1',
        muscle_group: 'triceps',
        _sum: { amount: 100 },
        _max: { created_at: new Date('2026-08-11T00:00:00.000Z') },
      },
    ]);
    seasonalMuscleStanding.findMany.mockResolvedValue([]);
    moderationActionRecord.create.mockResolvedValue({ id: 'action-1' });
    exerciseLog.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _max: { weight_kg: null },
    });
    nutritionLog.count.mockResolvedValue(0);
    coachAppointment.count.mockResolvedValue(0);
    amenityBooking.count.mockResolvedValue(0);
    aiChatMessage.count.mockResolvedValue(0);
    gymChatMessage.count.mockResolvedValue(0);
    milestoneDefinition.findMany.mockResolvedValue([]);

    await expect(repo.createManualExpGrant(manualGrantInput)).resolves.toEqual({
      currentSeasonPoints: 275,
      grantId: 'grant-1',
      grantIds: ['grant-1', 'grant-2'],
      grantStatus: 'applied',
      moderationActionId: 'action-1',
      totalXp: 725,
      userId: 'member-1',
    });
    expect(
      progressionGrantLedger.create.mock.calls.slice(0, 2).map(([call]) => [
        call.data.muscle_group,
        call.data.amount,
      ]),
    ).toEqual([
      ['chest', 125],
      ['triceps', 100],
    ]);
    expect(userProgressionProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          total_xp: 725,
          current_season_points: 275,
        }),
      }),
    );
    expect(seasonalStanding.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          season_points: { increment: 225 },
        }),
      }),
    );
    expect(seasonalMuscleStanding.createMany).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
  });

  it('requires at least one manual EXP allocation', async () => {
    runManualGrantTransaction();

    await expect(
      repo.createManualExpGrant({ ...manualGrantInput, allocations: [] }),
    ).rejects.toThrow(BadRequestException);
    expect(user.findFirst).not.toHaveBeenCalled();
  });

  it('rejects duplicate normalized muscles in one manual EXP request', async () => {
    runManualGrantTransaction();

    await expect(
      repo.createManualExpGrant({
        ...manualGrantInput,
        allocations: [
          { muscle_group: 'Chest', amount: 25 },
          { muscle_group: ' chest ', amount: 30 },
        ],
      }),
    ).rejects.toThrow('Manual EXP allocations must use unique muscle groups.');
    expect(user.findFirst).not.toHaveBeenCalled();
  });

  it.each([0, 1001, 1.5, Number.NaN])(
    'rejects malformed manual EXP amount %s',
    async (amount) => {
      runManualGrantTransaction();

      await expect(
        repo.createManualExpGrant({
          ...manualGrantInput,
          allocations: [{ muscle_group: 'chest', amount }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(user.findFirst).not.toHaveBeenCalled();
    },
  );

  it('rolls back the whole request when a later allocation write fails', async () => {
    runManualGrantTransaction();
    user.findFirst.mockResolvedValue({ id: 'member-1' });
    muscleDefinition.findMany.mockResolvedValue([
      { key: 'chest' },
      { key: 'triceps' },
    ]);
    progressionSourceEvent.findUnique.mockResolvedValue(null);
    progressionSourceEvent.create.mockResolvedValue({ id: 'source-1' });
    rankingProfile.upsert.mockResolvedValue({});
    seasonDefinition.findFirst.mockResolvedValue(null);
    userProgressionProfile.findUnique.mockResolvedValue(null);
    progressionGrantLedger.create
      .mockResolvedValueOnce({ id: 'grant-1' })
      .mockRejectedValueOnce(new Error('second allocation failed'));

    await expect(repo.createManualExpGrant(manualGrantInput)).rejects.toThrow(
      'second allocation failed',
    );
    expect(userProgressionProfile.upsert).not.toHaveBeenCalled();
    expect(moderationActionRecord.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('rejects an already-applied manual EXP request without new ledger effects', async () => {
    runManualGrantTransaction();
    user.findFirst.mockResolvedValue({ id: 'member-1' });
    muscleDefinition.findMany.mockResolvedValue([
      { key: 'chest' },
      { key: 'triceps' },
    ]);
    progressionSourceEvent.findUnique.mockResolvedValue({ id: 'source-1' });

    await expect(repo.createManualExpGrant(manualGrantInput)).rejects.toThrow(
      ConflictException,
    );
    expect(progressionGrantLedger.create).not.toHaveBeenCalled();
  });

  it('maps a concurrent source-event uniqueness race to duplicate-request conflict', async () => {
    runManualGrantTransaction();
    user.findFirst.mockResolvedValue({ id: 'member-1' });
    muscleDefinition.findMany.mockResolvedValue([
      { key: 'chest' },
      { key: 'triceps' },
    ]);
    progressionSourceEvent.findUnique.mockResolvedValue(null);
    rankingProfile.upsert.mockResolvedValue({});
    seasonDefinition.findFirst.mockResolvedValue(null);
    userProgressionProfile.findUnique.mockResolvedValue(null);
    progressionSourceEvent.create.mockRejectedValue({ code: 'P2002' });

    await expect(repo.createManualExpGrant(manualGrantInput)).rejects.toThrow(
      ConflictException,
    );
    expect(progressionGrantLedger.create).not.toHaveBeenCalled();
  });

  it('rejects stale or ineligible members inside the grant transaction', async () => {
    runManualGrantTransaction();
    user.findFirst.mockResolvedValue(null);

    await expect(repo.createManualExpGrant(manualGrantInput)).rejects.toThrow(
      'Manual EXP can only be granted to an active member with an active membership card.',
    );
    expect(progressionSourceEvent.create).not.toHaveBeenCalled();
  });
});
