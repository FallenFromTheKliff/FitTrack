import type { RecurringCoachingPlanInput } from "@fittrack/api-client";
import type {
  FitnessPlanSource,
  TrainingPlanSummaryRecord,
} from "@fittrack/types";

import type { DraftDays } from "../workout/workoutPlanDraft";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export const DEFAULT_COACH_WORKOUT_PLAN_TITLE = "Client weekly split";

export type CoachWorkoutPlanDraftState = {
  activeDraftDay: number;
  builderError: string;
  draftDays: DraftDays;
  exerciseSearch: string;
  message: string;
  title: string;
};

export type CoachWorkoutPlanTransition = {
  memberId: string;
  planId: string;
};

type ClientProgramCandidate = Pick<
  TrainingPlanSummaryRecord,
  "coachId" | "id" | "isActive" | "isTemplate" | "source" | "userId"
>;

type PublishedCoachPlanResponse = Partial<ClientProgramCandidate> & {
  id?: string | null;
};

export type PaidCoachWorkEntitlement = {
  activePaymentStatus?: string | null;
  coachId?: string | null;
  recurringPlanId?: string | null;
  status?: string | null;
  userId?: string | null;
};

export function hasPaidOneSessionProgramEntitlement(
  work: readonly PaidCoachWorkEntitlement[],
  memberId: string,
  coachId: string,
) {
  return work.some(
    (item) =>
      item.userId === memberId &&
      item.coachId === coachId &&
      item.activePaymentStatus === "completed" &&
      !item.recurringPlanId &&
      ["confirmed", "completed"].includes(item.status ?? ""),
  );
}

export function canCreateClientWorkoutProgram({
  existingProgramCount,
  hasMonthlyEntitlement,
  hasPaidEntitlement,
}: {
  existingProgramCount: number;
  hasMonthlyEntitlement: boolean;
  hasPaidEntitlement: boolean;
}) {
  if (!hasPaidEntitlement) return false;
  return hasMonthlyEntitlement || existingProgramCount === 0;
}

export function createCoachWorkoutPlanDraft(
  initialDay = new Date().getDay(),
): CoachWorkoutPlanDraftState {
  const dayOfWeek = ((initialDay % DAY_NAMES.length) + DAY_NAMES.length) % DAY_NAMES.length;

  return {
    activeDraftDay: dayOfWeek,
    builderError: "",
    draftDays: {
      [dayOfWeek]: {
        exercises: [],
        focusLabel: `${DAY_NAMES[dayOfWeek]} training`,
      },
    },
    exerciseSearch: "",
    message: "",
    title: DEFAULT_COACH_WORKOUT_PLAN_TITLE,
  };
}

export function createCoachWorkoutPlanTransition(
  memberId: string,
  planId: string,
): CoachWorkoutPlanTransition {
  return { memberId, planId };
}

export function resolvePublishedCoachPlanId(
  assignedPlan: PublishedCoachPlanResponse | null | undefined,
  memberId: string,
  coachId?: string,
) {
  if (
    !assignedPlan?.id?.trim() ||
    assignedPlan.userId !== memberId ||
    assignedPlan.isActive !== true ||
    assignedPlan.isTemplate !== false ||
    assignedPlan.source !== "coach_assigned" ||
    (coachId !== undefined && assignedPlan.coachId !== coachId)
  ) {
    throw new Error(
      "The publish response did not contain a valid client-specific workout program.",
    );
  }

  return assignedPlan.id.trim();
}

export function createSingleSubmitGate() {
  let inFlight = false;

  return {
    release() {
      inFlight = false;
    },
    tryAcquire() {
      if (inFlight) return false;
      inFlight = true;
      return true;
    },
  };
}

export function resolveMonthlyPlanSelectionId(
  preferredPlanId: string | undefined,
  plans: readonly ClientProgramCandidate[],
  memberId: string,
  coachId?: string,
) {
  const preferred = preferredPlanId?.trim();
  if (preferred) {
    const matchingPlan = plans.find((plan) => plan.id === preferred);

    // Keep a newly returned assignment selected while the client-plan query
    // catches up. If the ID is present, validate the actual record instead of
    // silently accepting a stale/base/template record with the same role.
    if (!matchingPlan) return preferred;

    return isClientSpecificCoachPlan(matchingPlan, memberId, coachId)
      ? preferred
      : "";
  }

  const validPlans = plans.filter((plan) =>
    isClientSpecificCoachPlan(plan, memberId, coachId),
  );
  return validPlans.find((plan) => plan.isActive)?.id ?? validPlans[0]?.id ?? "";
}

export function isMonthlyPlanSelectionReady(
  preferredPlanId: string | undefined,
  plans: readonly ClientProgramCandidate[],
  memberId: string,
  coachId?: string,
) {
  const candidate = preferredPlanId?.trim();
  return Boolean(
    candidate &&
      plans.some(
        (plan) =>
          plan.id === candidate &&
          isClientSpecificCoachPlan(plan, memberId, coachId),
      ),
  );
}

export function isClientSpecificCoachPlan(
  plan: ClientProgramCandidate,
  memberId: string,
  coachId?: string,
) {
  return (
    plan.id.trim().length > 0 &&
    plan.userId === memberId &&
    plan.isActive === true &&
    plan.isTemplate === false &&
    plan.source === ("coach_assigned" satisfies FitnessPlanSource) &&
    (coachId === undefined || plan.coachId === coachId)
  );
}

export function createClientProgramPreviewInput(
  input: Omit<RecurringCoachingPlanInput, "trainingPlanId"> & {
    clientProgram: ClientProgramCandidate;
  },
): RecurringCoachingPlanInput {
  if (!isClientSpecificCoachPlan(input.clientProgram, input.memberId)) {
    throw new Error(
      "The selected client program must belong to the member and cannot be a template.",
    );
  }

  const { clientProgram, ...previewInput } = input;
  return {
    ...previewInput,
    trainingPlanId: clientProgram.id,
  };
}


export type CoachOneTimeWorkoutAppointment = PaidCoachWorkEntitlement & {
  id: string;
  scheduledAt: string;
  duration: number;
  workoutAssignment?: {
    id: string;
    trainingPlanId: string;
    trainingScheduleDayId: string;
    workoutSessionId?: string | null;
    state: string;
  } | null;
};

export function isEligibleOneTimeCoachAppointment(
  appointment: CoachOneTimeWorkoutAppointment,
  now = new Date(),
): boolean {
  const startsAt = new Date(appointment.scheduledAt).getTime();
  const endsAt = startsAt + Math.max(1, appointment.duration || 60) * 60 * 1000;
  return (
    appointment.activePaymentStatus === "completed" &&
    appointment.status === "confirmed" &&
    !appointment.recurringPlanId &&
    Number.isFinite(startsAt) &&
    endsAt > now.getTime()
  );
}

export function getEligibleOneTimeCoachAppointments(
  appointments: CoachOneTimeWorkoutAppointment[],
  memberId: string,
  coachId: string,
  now = new Date(),
): CoachOneTimeWorkoutAppointment[] {
  return appointments
    .filter(
      (appointment) =>
        appointment.userId === memberId && appointment.coachId === coachId,
    )
    .filter((appointment) => isEligibleOneTimeCoachAppointment(appointment, now))
    .sort(
      (left, right) =>
        new Date(left.scheduledAt).getTime() -
        new Date(right.scheduledAt).getTime(),
    );
}
