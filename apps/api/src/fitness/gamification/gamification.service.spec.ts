import { EventEmitter2 } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { MasteryRank, Prisma } from '@prisma/client';

import type { PaginationDTO } from '../../user/dto/user-dto';
import { UserService } from '../../user/user.service';
import { type WorkoutSessionCompletedEvent } from '../session/events/workout-session-completed.event';
import { GAMIFICATION_RANK_UP_EVENT } from './events/rank-up.event';
import { GamificationRepository } from './gamification.repository';
import { GamificationService } from './gamification.service';

describe('GamificationService', () => {
  let service: GamificationService;

  const repo = {
    listMuscleMastery: jest.fn(),
    listLeaderboardTotals: jest.fn(),
    listWorkoutCompletionLogs: jest.fn(),
    upsertMuscleMasteryProgress: jest.fn(),
    updateMuscleMasteryRank: jest.fn(),
  };

  const userService = {
    listGamificationParticipants: jest.fn(),
  };

  const eventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: GamificationRepository, useValue: repo },
        { provide: UserService, useValue: userService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<GamificationService>(GamificationService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps mastery rows to response DTOs with display rank text', async () => {
    repo.listMuscleMastery.mockResolvedValue([
      {
        id: 'mastery-1',
        user_id: 'user-1',
        muscle_group: 'legs',
        total_volume_kg: new Prisma.Decimal('12500.00'),
        xp_points: 10250,
        rank: MasteryRank.adamantite,
        last_ranked_at: new Date('2026-03-27T03:00:00.000Z'),
        created_at: new Date('2026-03-27T02:00:00.000Z'),
        updated_at: new Date('2026-03-27T03:30:00.000Z'),
      },
    ]);

    await expect(service.getMuscleMastery('user-1', {})).resolves.toEqual([
      expect.objectContaining({
        id: 'mastery-1',
        muscle_group: 'legs',
        total_volume_kg: '12500.00',
        xp_points: 10250,
        rank: MasteryRank.adamantite,
        rank_display: 'Adamantite+ (250 EXP)',
      }),
    ]);
  });

  it('builds the leaderboard from participant profiles and total xp', async () => {
    userService.listGamificationParticipants.mockResolvedValue([
      {
        user_id: 'user-1',
        display_name: 'Alpha Coach',
        avatar_url: null,
      },
      {
        user_id: 'user-2',
        display_name: 'Bravo Member',
        avatar_url: 'https://cdn.fittrack.test/avatars/bravo.png',
      },
      {
        user_id: 'user-3',
        display_name: 'Charlie Member',
        avatar_url: null,
      },
    ]);
    repo.listLeaderboardTotals.mockResolvedValue([
      { user_id: 'user-2', total_xp: 450 },
      { user_id: 'user-1', total_xp: 900 },
    ]);

    const result = await service.getLeaderboard({ page: 1, limit: 2 });

    expect(result).toEqual({
      data: [
        {
          rank_position: 1,
          user_id: 'user-1',
          display_name: 'Alpha Coach',
          avatar_url: null,
          total_xp: 900,
        },
        {
          rank_position: 2,
          user_id: 'user-2',
          display_name: 'Bravo Member',
          avatar_url: 'https://cdn.fittrack.test/avatars/bravo.png',
          total_xp: 450,
        },
      ],
      meta: {
        page: 1,
        limit: 2,
        total: 3,
        total_pages: 2,
      },
    });
  });

  it('uses zero xp for participants without mastery rows', async () => {
    userService.listGamificationParticipants.mockResolvedValue([
      {
        user_id: 'user-3',
        display_name: 'Charlie Member',
        avatar_url: null,
      },
    ]);
    repo.listLeaderboardTotals.mockResolvedValue([]);

    await expect(service.getLeaderboard({} as PaginationDTO)).resolves.toEqual({
      data: [
        {
          rank_position: 1,
          user_id: 'user-3',
          display_name: 'Charlie Member',
          avatar_url: null,
          total_xp: 0,
        },
      ],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('computes per-muscle-group deltas with bodyweight xp fallback', () => {
    const deltas = service.computeDeltas([
      {
        reps_completed: 12,
        reps_ai_counted: null,
        weight_kg: new Prisma.Decimal('50'),
        exercise: { muscle_group: 'legs' },
      },
      {
        reps_completed: null,
        reps_ai_counted: 15,
        weight_kg: null,
        exercise: { muscle_group: 'legs' },
      },
      {
        reps_completed: 10,
        reps_ai_counted: null,
        weight_kg: new Prisma.Decimal('20'),
        exercise: { muscle_group: 'chest' },
      },
    ]);

    expect(deltas.get('legs')).toEqual({
      xp: 61,
      volumeKg: new Prisma.Decimal('600'),
    });
    expect(deltas.get('chest')).toEqual({
      xp: 20,
      volumeKg: new Prisma.Decimal('200'),
    });
  });

  it('promotes to the highest mastery tier crossed by xp or volume', () => {
    expect(service.evaluateRank(500, new Prisma.Decimal('4000'))).toBe(
      MasteryRank.silver,
    );
    expect(service.evaluateRank(400, new Prisma.Decimal('5500'))).toBe(
      MasteryRank.silver,
    );
    expect(service.evaluateRank(2100, new Prisma.Decimal('51000'))).toBe(
      MasteryRank.platinum,
    );
    expect(service.evaluateRank(2500, new Prisma.Decimal('100500'))).toBe(
      MasteryRank.adamantite,
    );
  });

  it('updates rank timestamps only when the rank changes', async () => {
    repo.upsertMuscleMasteryProgress.mockResolvedValue({
      id: 'mastery-1',
      user_id: 'user-1',
      muscle_group: 'legs',
      total_volume_kg: new Prisma.Decimal('5200'),
      xp_points: 520,
      rank: MasteryRank.bronze,
      last_ranked_at: null,
      created_at: new Date('2026-03-27T01:00:00.000Z'),
      updated_at: new Date('2026-03-27T01:00:00.000Z'),
    });
    repo.updateMuscleMasteryRank.mockResolvedValue({
      id: 'mastery-1',
      user_id: 'user-1',
      muscle_group: 'legs',
      total_volume_kg: new Prisma.Decimal('5200'),
      xp_points: 520,
      rank: MasteryRank.silver,
      last_ranked_at: new Date('2026-03-27T02:00:00.000Z'),
      created_at: new Date('2026-03-27T01:00:00.000Z'),
      updated_at: new Date('2026-03-27T02:00:00.000Z'),
    });

    await expect(
      service.upsertMastery('user-1', 'legs', {
        xp: 520,
        volumeKg: new Prisma.Decimal('5200'),
      }),
    ).resolves.toMatchObject({
      rank: MasteryRank.silver,
    });

    expect(repo.updateMuscleMasteryRank).toHaveBeenCalledWith(
      expect.objectContaining({
        masteryId: 'mastery-1',
        rank: MasteryRank.silver,
      }),
    );

    const [[rankUpdateInput]] = repo.updateMuscleMasteryRank.mock.calls as [
      [{ masteryId: string; rank: MasteryRank; rankedAt: Date }],
    ];

    expect(rankUpdateInput.rankedAt).toBeInstanceOf(Date);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      GAMIFICATION_RANK_UP_EVENT,
      expect.objectContaining({
        userId: 'user-1',
        muscleGroup: 'legs',
        oldRank: MasteryRank.bronze,
        newRank: MasteryRank.silver,
      }),
    );
  });

  it('keeps last_ranked_at untouched when no new rank is crossed', async () => {
    repo.upsertMuscleMasteryProgress.mockResolvedValue({
      id: 'mastery-1',
      user_id: 'user-1',
      muscle_group: 'legs',
      total_volume_kg: new Prisma.Decimal('2500'),
      xp_points: 250,
      rank: MasteryRank.bronze,
      last_ranked_at: null,
      created_at: new Date('2026-03-27T01:00:00.000Z'),
      updated_at: new Date('2026-03-27T01:00:00.000Z'),
    });

    await service.upsertMastery('user-1', 'legs', {
      xp: 250,
      volumeKg: new Prisma.Decimal('2500'),
    });

    expect(repo.updateMuscleMasteryRank).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('groups workout completion deltas before upserting mastery', async () => {
    const event: WorkoutSessionCompletedEvent = {
      sessionId: 'session-1',
      userId: 'user-1',
      planId: null,
      completedAt: '2026-03-27T03:00:00.000Z',
      durationSeconds: 1800,
      totalVolumeKg: '800.00',
      exerciseLogCount: 3,
    };

    repo.listWorkoutCompletionLogs.mockResolvedValue([
      {
        reps_completed: 10,
        reps_ai_counted: null,
        weight_kg: new Prisma.Decimal('50'),
        exercise: { muscle_group: 'legs' },
      },
      {
        reps_completed: 8,
        reps_ai_counted: null,
        weight_kg: new Prisma.Decimal('25'),
        exercise: { muscle_group: 'legs' },
      },
      {
        reps_completed: 12,
        reps_ai_counted: null,
        weight_kg: new Prisma.Decimal('20'),
        exercise: { muscle_group: 'chest' },
      },
    ]);
    const upsertSpy = jest
      .spyOn(service, 'upsertMastery')
      .mockResolvedValue({} as never);

    await service.handleWorkoutCompleted(event);

    expect(repo.listWorkoutCompletionLogs).toHaveBeenCalledWith(
      'session-1',
      'user-1',
    );
    expect(upsertSpy).toHaveBeenCalledTimes(2);
    expect(upsertSpy).toHaveBeenCalledWith('user-1', 'legs', {
      xp: 70,
      volumeKg: new Prisma.Decimal('700'),
    });
    expect(upsertSpy).toHaveBeenCalledWith('user-1', 'chest', {
      xp: 24,
      volumeKg: new Prisma.Decimal('240'),
    });
  });

  it('never throws back into the caller flow when the listener fails', async () => {
    const loggerError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    repo.listWorkoutCompletionLogs.mockRejectedValue(new Error('db down'));

    await expect(
      service.handleWorkoutCompleted({
        sessionId: 'session-1',
        userId: 'user-1',
        planId: null,
        completedAt: '2026-03-27T03:00:00.000Z',
        durationSeconds: 1800,
        totalVolumeKg: '0.00',
        exerciseLogCount: 0,
      }),
    ).resolves.toBeUndefined();

    expect(loggerError).toHaveBeenCalledWith(
      'Failed to process workout completion gamification for session session-1',
      expect.stringContaining('db down'),
    );
  });
});
