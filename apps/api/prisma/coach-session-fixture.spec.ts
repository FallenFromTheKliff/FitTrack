import { AppointmentStatus } from '@prisma/client';

import {
  COACH_SESSION_FIXTURE_SCENARIOS,
  coachSessionFixtureDate,
  coachSessionRelationshipId,
} from './coach-session-fixture';

describe('coach session fixture invariants', () => {
  it('keeps status/date cases coherent around one explicit anchor', () => {
    const anchor = new Date('2026-08-12T10:00:00.000Z');
    const dates = COACH_SESSION_FIXTURE_SCENARIOS.map((scenario) => ({
      date: coachSessionFixtureDate(anchor, scenario),
      scenario,
    }));

    expect(
      dates
        .filter(({ scenario }) =>
          [AppointmentStatus.confirmed, AppointmentStatus.pending_coach, AppointmentStatus.pending_payment].includes(
            scenario.status,
          ),
        )
        .every(({ date }) => date.getTime() > anchor.getTime()),
    ).toBe(true);
    expect(
      dates
        .filter(({ scenario }) =>
          [AppointmentStatus.completed, AppointmentStatus.no_show].includes(
            scenario.status,
          ),
        )
        .every(({ date }) => date.getTime() < anchor.getTime()),
    ).toBe(true);
    expect(new Set(COACH_SESSION_FIXTURE_SCENARIOS.map(({ key }) => key)).size).toBe(
      COACH_SESSION_FIXTURE_SCENARIOS.length,
    );
  });

  it('preserves a dynamic active relationship instead of creating a second pair', () => {
    expect(coachSessionRelationshipId('dynamic-rel-1', 'member-1')).toBe(
      'dynamic-rel-1',
    );
    expect(coachSessionRelationshipId(undefined, 'member-1')).toBe(
      coachSessionRelationshipId(null, 'member-1'),
    );
  });
});
