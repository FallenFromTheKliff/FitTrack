export const WORKOUT_INTEGRITY_RULESET_VERSION = 'workout-integrity-v1';

const MAX_REPS_PER_SET = 500;
const MAX_REPS_PER_SECOND = 4;
const MAX_REPS_PER_SESSION = 5_000;
const MAX_LOGS_PER_SESSION = 120;
const MAX_IDENTICAL_LOGS_PER_SESSION = 25;

export type WorkoutIntegrityRuleInput = {
  durationSeconds: number | null;
  exerciseId: string | null;
  reps: number;
};

export type WorkoutIntegrityAdvisory = {
  reasonCodes: string[];
  rulesetVersion: typeof WORKOUT_INTEGRITY_RULESET_VERSION;
};

export function evaluateWorkoutIntegrityAdvisories(
  logs: WorkoutIntegrityRuleInput[],
): WorkoutIntegrityAdvisory {
  const reasonCodes = new Set<string>();
  const totalReps = logs.reduce((total, log) => total + log.reps, 0);

  if (logs.length > MAX_LOGS_PER_SESSION) {
    reasonCodes.add('extreme_session_log_count');
  }

  if (totalReps > MAX_REPS_PER_SESSION) {
    reasonCodes.add('extreme_session_rep_total');
  }

  const duplicateCounts = new Map<string, number>();
  logs.forEach((log) => {
    if (log.reps > MAX_REPS_PER_SET) {
      reasonCodes.add('extreme_set_repetitions');
    }

    if (
      log.durationSeconds !== null &&
      log.durationSeconds > 0 &&
      log.reps >= 20 &&
      log.reps / log.durationSeconds > MAX_REPS_PER_SECOND
    ) {
      reasonCodes.add('implausible_rep_velocity');
    }

    const fingerprint = [
      log.exerciseId ?? 'unknown-exercise',
      log.reps,
      log.durationSeconds ?? 'no-duration',
    ].join(':');
    duplicateCounts.set(
      fingerprint,
      (duplicateCounts.get(fingerprint) ?? 0) + 1,
    );
  });

  if (
    Array.from(duplicateCounts.values()).some(
      (count) => count > MAX_IDENTICAL_LOGS_PER_SESSION,
    )
  ) {
    reasonCodes.add('duplicate_set_burst');
  }

  return {
    reasonCodes: Array.from(reasonCodes).sort(),
    rulesetVersion: WORKOUT_INTEGRITY_RULESET_VERSION,
  };
}
