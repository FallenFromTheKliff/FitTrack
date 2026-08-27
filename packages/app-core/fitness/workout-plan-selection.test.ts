import { resolveWorkoutPlanSelection } from "./workout-plan-selection";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

const personalPlan = { id: "personal-plan", isActive: true };
const coachPlan = { id: "coach-plan", isActive: false };
const staleCoachSession = {
  id: "coach-session",
  planId: coachPlan.id,
  status: "in_progress",
};

const selectedPersonal = resolveWorkoutPlanSelection(
  [personalPlan, coachPlan],
  [staleCoachSession],
);

assertEqual(
  selectedPersonal.effectivePlan?.id,
  personalPlan.id,
  "the explicitly active personal plan wins over a stale coach session",
);
assertEqual(
  selectedPersonal.activeSession,
  null,
  "a stale session from another plan is not attached to the active plan",
);

const activePersonalSession = {
  id: "personal-session",
  planId: personalPlan.id,
  status: "in_progress",
};
const selectedPersonalSession = resolveWorkoutPlanSelection(
  [personalPlan, coachPlan],
  [staleCoachSession, activePersonalSession],
);

assertEqual(
  selectedPersonalSession.activeSession?.id,
  activePersonalSession.id,
  "the active plan uses only its own in-progress session",
);

const noActiveFlag = resolveWorkoutPlanSelection(
  [coachPlan],
  [staleCoachSession],
);

assertEqual(
  noActiveFlag.effectivePlan?.id,
  coachPlan.id,
  "an in-progress session remains a fallback when no plan is marked active",
);

const firstPlanFallback = resolveWorkoutPlanSelection([coachPlan], []);

assertEqual(
  firstPlanFallback.effectivePlan?.id,
  coachPlan.id,
  "the first plan remains the final compatibility fallback",
);
