import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationType } from '@prisma/client';

import { NotificationsService } from '../../notifications/notifications.service';
import { getMasteryRankLabel } from './gamification.constants';
import {
  GAMIFICATION_RANK_UP_EVENT,
  type GamificationRankUpEvent,
} from './events/rank-up.event';

@Injectable()
export class GamificationLifecycleService {
  private readonly logger = new Logger(GamificationLifecycleService.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent(GAMIFICATION_RANK_UP_EVENT, { async: true })
  async handleRankUp(event: GamificationRankUpEvent): Promise<void> {
    try {
      await this.notificationsService.dispatch(
        event.userId,
        NotificationType.rank_up,
        {
          title: 'Mastery rank up',
          body: `Your ${event.muscleGroup} mastery advanced from ${getMasteryRankLabel(event.oldRank)} to ${getMasteryRankLabel(event.newRank)}.`,
          data: {
            muscle_group: event.muscleGroup,
            old_rank: event.oldRank,
            new_rank: event.newRank,
            ranked_at: event.rankedAt,
          },
          email: {
            subject: `FitTrack mastery rank up: ${getMasteryRankLabel(event.newRank)}`,
            html: this.buildRankUpHtml(event),
          },
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to process gamification rank-up notification for user ${event.userId}`,
        this.formatError(error),
      );
    }
  }

  private buildRankUpHtml(event: GamificationRankUpEvent): string {
    return `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#1a1a1a">Mastery rank up</h2>
        <p style="color:#555">
          Your <strong>${event.muscleGroup}</strong> mastery
          advanced from <strong>${getMasteryRankLabel(event.oldRank)}</strong> to
          <strong>${getMasteryRankLabel(event.newRank)}</strong>.
        </p>
        <p style="color:#555">Keep training to unlock the next tier.</p>
        <hr style="border:none;border-top:1px solid #eee;margin-top:24px"/>
        <p style="color:#aaa;font-size:12px;text-align:center">FitTrack</p>
      </div>
    `;
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.stack ?? error.message;
    }

    return String(error);
  }
}
