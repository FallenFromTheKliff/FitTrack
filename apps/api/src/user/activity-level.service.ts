import { Injectable } from '@nestjs/common';
import { ActivityLevel, SessionStatus } from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';

const ACTIVITY_WINDOW_DAYS = 30;

function resolveActivityLevel(activityCount: number): ActivityLevel {
  if (activityCount <= 2) return ActivityLevel.sedentary;
  if (activityCount <= 6) return ActivityLevel.light;
  if (activityCount <= 14) return ActivityLevel.active;
  return ActivityLevel.very_active;
}

@Injectable()
export class ActivityLevelService {
  constructor(private readonly prisma: PrismaService) {}

  async recalculateForUser(userId: string): Promise<ActivityLevel> {
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - ACTIVITY_WINDOW_DAYS);

    const [completedSessions, attendanceCheckIns] =
      await Promise.all([
        this.prisma.workoutSession.count({
          where: {
            user_id: userId,
            status: SessionStatus.completed,
            completed_at: { gte: windowStart },
          },
        }),
        this.prisma.attendanceLog.count({
          where: {
            user_id: userId,
            check_in_at: { gte: windowStart },
          },
        }),
      ]);
    const nextActivityLevel = resolveActivityLevel(
      completedSessions + attendanceCheckIns,
    );

    await this.prisma.userProfile.update({
      where: { user_id: userId },
      data: { activity_level: nextActivityLevel },
    });

    return nextActivityLevel;
  }
}
