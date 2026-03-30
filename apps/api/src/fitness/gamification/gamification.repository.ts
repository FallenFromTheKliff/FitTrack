import { Injectable } from '@nestjs/common';
import {
  MasteryRank,
  type MuscleMasteryProgress,
  type Prisma,
} from '@prisma/client';

import { BaseRepository } from '../../common/base-repository/base-repository';
import { PrismaService } from '../../prisma/prisma.service';
import { type MasteryFilterDTO } from './dto/gamification.dto';

export interface LeaderboardTotalRecord {
  user_id: string;
  total_xp: number;
}

export interface WorkoutCompletionLogRecord {
  reps_completed: number | null;
  reps_ai_counted: number | null;
  weight_kg: Prisma.Decimal | null;
  exercise: {
    muscle_group: string;
  };
}

@Injectable()
export class GamificationRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  listMuscleMastery(
    userId: string,
    dto: MasteryFilterDTO,
  ): Promise<MuscleMasteryProgress[]> {
    const where: Prisma.MuscleMasteryProgressWhereInput = {
      user_id: userId,
    };

    if (dto.muscle_group) {
      where.muscle_group = {
        contains: dto.muscle_group.trim(),
        mode: 'insensitive',
      };
    }

    if (dto.rank) {
      where.rank = dto.rank;
    }

    return this.prisma.muscleMasteryProgress.findMany({
      where,
      orderBy: [
        { xp_points: 'desc' },
        { total_volume_kg: 'desc' },
        { muscle_group: 'asc' },
      ],
    });
  }

  async listLeaderboardTotals(): Promise<LeaderboardTotalRecord[]> {
    const rows = await this.prisma.muscleMasteryProgress.groupBy({
      by: ['user_id'],
      _sum: { xp_points: true },
    });

    return rows.map((row) => ({
      user_id: row.user_id,
      total_xp: row._sum.xp_points ?? 0,
    }));
  }

  listWorkoutCompletionLogs(
    sessionId: string,
    userId: string,
  ): Promise<WorkoutCompletionLogRecord[]> {
    return this.prisma.exerciseLog.findMany({
      where: {
        session_id: sessionId,
        user_id: userId,
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
  }

  upsertMuscleMasteryProgress(input: {
    userId: string;
    muscleGroup: string;
    xpDelta: number;
    volumeKgDelta: Prisma.Decimal;
  }): Promise<MuscleMasteryProgress> {
    return this.prisma.muscleMasteryProgress.upsert({
      where: {
        user_id_muscle_group: {
          user_id: input.userId,
          muscle_group: input.muscleGroup,
        },
      },
      create: {
        user_id: input.userId,
        muscle_group: input.muscleGroup,
        xp_points: input.xpDelta,
        total_volume_kg: input.volumeKgDelta,
        rank: MasteryRank.bronze,
      },
      update: {
        xp_points: {
          increment: input.xpDelta,
        },
        total_volume_kg: {
          increment: input.volumeKgDelta,
        },
      },
    });
  }

  updateMuscleMasteryRank(input: {
    masteryId: string;
    rank: MasteryRank;
    rankedAt: Date;
  }): Promise<MuscleMasteryProgress> {
    return this.prisma.muscleMasteryProgress.update({
      where: { id: input.masteryId },
      data: {
        rank: input.rank,
        last_ranked_at: input.rankedAt,
      },
    });
  }
}
