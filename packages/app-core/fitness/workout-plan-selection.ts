type WorkoutPlanSelectionCandidate = {
  id: string;
  isActive: boolean;
};

type WorkoutSessionSelectionCandidate = {
  id: string;
  planId: string | null;
  status: string;
};

export function resolveWorkoutPlanSelection<
  TPlan extends WorkoutPlanSelectionCandidate,
  TSession extends WorkoutSessionSelectionCandidate,
>(plans: TPlan[], sessions: TSession[]) {
  const anyInProgressSession =
    sessions.find((session) => session.status === "in_progress") ?? null;
  const effectivePlan =
    plans.find((plan) => plan.isActive) ??
    plans.find((plan) => plan.id === anyInProgressSession?.planId) ??
    plans[0] ??
    null;
  const activeSession = effectivePlan
    ? (sessions.find(
        (session) =>
          session.status === "in_progress" &&
          session.planId === effectivePlan.id,
      ) ?? null)
    : null;

  return { activeSession, effectivePlan };
}
