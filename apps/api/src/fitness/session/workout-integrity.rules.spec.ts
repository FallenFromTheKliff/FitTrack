import {
  WORKOUT_INTEGRITY_RULESET_VERSION,
  evaluateWorkoutIntegrityAdvisories,
} from './workout-integrity.rules';

describe('evaluateWorkoutIntegrityAdvisories', () => {
  it('returns no advisories for an ordinary workout', () => {
    expect(
      evaluateWorkoutIntegrityAdvisories([
        { durationSeconds: 45, exerciseId: 'squat', reps: 10 },
        { durationSeconds: 50, exerciseId: 'squat', reps: 8 },
      ]),
    ).toEqual({
      reasonCodes: [],
      rulesetVersion: WORKOUT_INTEGRITY_RULESET_VERSION,
    });
  });

  it('flags extreme counts and impossible rep velocity deterministically', () => {
    expect(
      evaluateWorkoutIntegrityAdvisories([
        { durationSeconds: 10, exerciseId: 'curl', reps: 600 },
        ...Array.from({ length: 26 }, () => ({
          durationSeconds: null,
          exerciseId: 'press',
          reps: 200,
        })),
      ]).reasonCodes,
    ).toEqual([
      'duplicate_set_burst',
      'extreme_session_rep_total',
      'extreme_set_repetitions',
      'implausible_rep_velocity',
    ]);
  });
});
