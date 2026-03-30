import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import {
  type MasteryRank,
  type MuscleMasteryProgress,
  Prisma,
} from '@prisma/client';

import { type PaginatedResult } from '../../common/base-repository/base-repository';
import { type PaginationDTO } from '../../user/dto/user-dto';
import {
  UserService,
  type GamificationParticipantProfile,
} from '../../user/user.service';
import {
  WORKOUT_SESSION_COMPLETED_EVENT,
  type WorkoutSessionCompletedEvent,
} from '../session/events/workout-session-completed.event';
import {
  LeaderboardEntryResponseDTO,
  MasteryFilterDTO,
  MuscleMasteryResponseDTO,
} from './dto/gamification.dto';
import {
  evaluateMasteryRank,
  formatMasteryRankDisplay,
  isHigherMasteryRank,
} from './gamification.constants';
import {
  GAMIFICATION_RANK_UP_EVENT,
  type GamificationRankUpEvent,
} from './events/rank-up.event';
import {
  type LeaderboardTotalRecord,
  GamificationRepository,
  type WorkoutCompletionLogRecord,
} from './gamification.repository';

export interface MuscleMasteryDelta {
  xp: number;
  volumeKg: Prisma.Decimal;
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly repo: GamificationRepository,
    private readonly userService: UserService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(WORKOUT_SESSION_COMPLETED_EVENT, { async: true })
  async handleWorkoutCompleted(
    event: WorkoutSessionCompletedEvent,
  ): Promise<void> {
    try {
      const logs = await this.repo.listWorkoutCompletionLogs(
        event.sessionId,
        event.userId,
      );
      const deltas = this.computeDeltas(logs);

      await Promise.all(
        Array.from(deltas.entries()).map(([muscleGroup, delta]) =>
          this.upsertMastery(event.userId, muscleGroup, delta),
        ),
      );
    } catch (error) {
      this.logger.error(
        `Failed to process workout completion gamification for session ${event.sessionId}`,
        this.formatError(error),
      );
    }
  }

  async getMuscleMastery(
    userId: string,
    dto: MasteryFilterDTO,
  ): Promise<MuscleMasteryResponseDTO[]> {
    const records = await this.repo.listMuscleMastery(userId, dto);

    return records.map((record) => this.toMasteryResponse(record));
  }

  async getLeaderboard(
    dto: PaginationDTO,
  ): Promise<PaginatedResult<LeaderboardEntryResponseDTO>> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const [participants, totals] = await Promise.all([
      this.userService.listGamificationParticipants(),
      this.repo.listLeaderboardTotals(),
    ]);

    const leaderboard = this.buildLeaderboardEntries(participants, totals);
    const total = leaderboard.length;
    const start = (page - 1) * limit;

    return {
      data: leaderboard.slice(start, start + limit),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  private buildLeaderboardEntries(
    participants: GamificationParticipantProfile[],
    totals: LeaderboardTotalRecord[],
  ): LeaderboardEntryResponseDTO[] {
    const totalXpByUserId = new Map<string, number>(
      totals.map((row) => [row.user_id, row.total_xp]),
    );

    return participants
      .map((participant) => ({
        user_id: participant.user_id,
        display_name: participant.display_name,
        avatar_url: participant.avatar_url,
        total_xp: totalXpByUserId.get(participant.user_id) ?? 0,
      }))
      .sort(
        (left, right) =>
          right.total_xp - left.total_xp ||
          left.display_name.localeCompare(right.display_name) ||
          left.user_id.localeCompare(right.user_id),
      )
      .map((entry, index) => ({
        ...entry,
        rank_position: index + 1,
      }));
  }

  private toMasteryResponse(
    record: MuscleMasteryProgress,
  ): MuscleMasteryResponseDTO {
    return {
      id: record.id,
      user_id: record.user_id,
      muscle_group: record.muscle_group,
      total_volume_kg: record.total_volume_kg.toFixed(2),
      xp_points: record.xp_points,
      rank: record.rank,
      rank_display: formatMasteryRankDisplay(record.rank, record.xp_points),
      last_ranked_at: record.last_ranked_at?.toISOString() ?? null,
      created_at: record.created_at.toISOString(),
      updated_at: record.updated_at.toISOString(),
    };
  }

  computeDeltas(
    logs: WorkoutCompletionLogRecord[],
  ): Map<string, MuscleMasteryDelta> {
    const deltas = new Map<string, MuscleMasteryDelta>();

    for (const log of logs) {
      const repsCompleted = log.reps_completed ?? log.reps_ai_counted ?? 0;

      if (repsCompleted <= 0) {
        continue;
      }

      const current = deltas.get(log.exercise.muscle_group) ?? {
        xp: 0,
        volumeKg: new Prisma.Decimal(0),
      };
      const weightForXp = log.weight_kg ?? new Prisma.Decimal(1);
      const volumeKg = (log.weight_kg ?? new Prisma.Decimal(0)).times(
        repsCompleted,
      );
      const xp = weightForXp
        .times(repsCompleted)
        .dividedBy(10)
        .floor()
        .toNumber();

      deltas.set(log.exercise.muscle_group, {
        xp: current.xp + xp,
        volumeKg: current.volumeKg.plus(volumeKg),
      });
    }

    return deltas;
  }

  async upsertMastery(
    userId: string,
    muscleGroup: string,
    delta: MuscleMasteryDelta,
  ): Promise<MuscleMasteryProgress> {
    const mastery = await this.repo.upsertMuscleMasteryProgress({
      userId,
      muscleGroup,
      xpDelta: delta.xp,
      volumeKgDelta: delta.volumeKg,
    });
    const nextRank = this.evaluateRank(
      mastery.xp_points,
      mastery.total_volume_kg,
    );

    if (!isHigherMasteryRank(nextRank, mastery.rank)) {
      return mastery;
    }

    const rankedAt = new Date();
    const updated = await this.repo.updateMuscleMasteryRank({
      masteryId: mastery.id,
      rank: nextRank,
      rankedAt,
    });

    this.emitRankUp({
      userId,
      muscleGroup,
      oldRank: mastery.rank,
      newRank: nextRank,
      rankedAt: rankedAt.toISOString(),
    });

    return updated;
  }

  evaluateRank(
    xpPoints: number,
    totalVolumeKg: Prisma.Decimal | number,
  ): MasteryRank {
    return evaluateMasteryRank(xpPoints, totalVolumeKg);
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    return String(error);
  }

  private emitRankUp(event: GamificationRankUpEvent): void {
    this.eventEmitter.emit(GAMIFICATION_RANK_UP_EVENT, event);
  }
}
