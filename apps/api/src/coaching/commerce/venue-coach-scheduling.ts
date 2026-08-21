import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { CoachAvailabilityService } from '../availability/coach-availability.service';

type VenueCoachWindowInput = {
  coachId: string;
  endsAt: Date;
  excludeHoldIds?: string[];
  excludeAmenityBookingIds?: string[];
  now?: Date;
  startsAt: Date;
};

export async function lockAndAssertVenueCoachWindow(
  tx: Prisma.TransactionClient,
  input: VenueCoachWindowInput,
): Promise<void> {
  const durationMinutes =
    (input.endsAt.getTime() - input.startsAt.getTime()) / (60 * 1000);
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    throw coachSlotUnavailable(['invalid_coach_window']);
  }

  const lockKey = `${input.coachId}:${CoachAvailabilityService.toGymDateKey(input.startsAt)}`;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

  await CoachAvailabilityService.assertAvailableWithClient(tx, {
    coachId: input.coachId,
    durationMinutes,
    excludeAmenityBookingIds: input.excludeAmenityBookingIds,
    excludeHoldIds: [...new Set(input.excludeHoldIds ?? [])],
    now: input.now,
    startsAt: input.startsAt,
  });
}

function coachSlotUnavailable(conflictReasons: string[]): ConflictException {
  return new ConflictException({
    type: 'CONFLICT',
    title: 'Coach Slot Unavailable',
    status: 409,
    detail: `The selected coaching time is unavailable: ${conflictReasons.join(', ')}.`,
    conflict_reasons: conflictReasons,
  });
}
