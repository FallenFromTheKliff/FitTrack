import { AppointmentStatus } from '@prisma/client';

import { seedId } from './test-data/constants';

export type CoachSessionFixtureScenario = {
  key: string;
  status: AppointmentStatus;
  dayOffset: number;
  time: string;
  review?: string | null;
  rating?: number | null;
};

export const COACH_SESSION_FIXTURE_SCENARIOS = [
  {
    key: 'completed-reviewed',
    status: AppointmentStatus.completed,
    dayOffset: -7,
    time: '07:00:00',
    review: null,
    rating: null,
  },
  {
    key: 'completed-ready-feedback',
    status: AppointmentStatus.completed,
    dayOffset: -8,
    time: '09:00:00',
    review: null,
    rating: null,
  },
  {
    key: 'confirmed-upcoming',
    status: AppointmentStatus.confirmed,
    dayOffset: 2,
    time: '16:00:00',
    review: null,
    rating: null,
  },
  {
    key: 'pending-payment',
    status: AppointmentStatus.pending_payment,
    dayOffset: 3,
    time: '07:00:00',
    review: null,
    rating: null,
  },
  {
    key: 'pending-coach',
    status: AppointmentStatus.pending_coach,
    dayOffset: 4,
    time: '09:00:00',
    review: null,
    rating: null,
  },
  {
    key: 'no-show',
    status: AppointmentStatus.no_show,
    dayOffset: -9,
    time: '07:00:00',
    review: null,
    rating: null,
  },
] as const satisfies readonly CoachSessionFixtureScenario[];

export function coachSessionFixtureDate(
  anchor: Date,
  scenario: CoachSessionFixtureScenario,
): Date {
  const date = new Date(anchor);
  date.setUTCDate(date.getUTCDate() + scenario.dayOffset);
  return new Date(
    `${date.toISOString().slice(0, 10)}T${scenario.time}+08:00`,
  );
}

export function coachSessionRelationshipId(
  existingId: string | null | undefined,
  memberId: string,
): string {
  return (
    existingId ?? seedId(`seed-coach-sessions:relationship:${memberId}`)
  );
}
