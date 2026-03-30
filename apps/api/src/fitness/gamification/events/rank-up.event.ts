import { MasteryRank } from '@prisma/client';

export const GAMIFICATION_RANK_UP_EVENT = 'fitness.gamification.rank-up';

export interface GamificationRankUpEvent {
  userId: string;
  muscleGroup: string;
  oldRank: MasteryRank;
  newRank: MasteryRank;
  rankedAt: string;
}
