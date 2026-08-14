import { createApiClient } from "@fittrack/api-client";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected ${String(expected)}, got ${String(actual)}`,
    );
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

function assertThrows(action: () => unknown, message: string) {
  try {
    action();
  } catch {
    return;
  }
  throw new Error(`${message}: expected the action to throw`);
}

async function runCoachWorkoutPublishRegression() {
  const modulePath = "./coachClientWorkoutPublish.ts";
  const {
    DEFAULT_COACH_WORKOUT_PLAN_TITLE,
    createClientProgramPreviewInput,
    canCreateClientWorkoutProgram,
    createCoachWorkoutPlanDraft,
    createCoachWorkoutPlanTransition,
    createSingleSubmitGate,
    isClientSpecificCoachPlan,
    hasPaidOneSessionProgramEntitlement,
    isMonthlyPlanSelectionReady,
    resolveMonthlyPlanSelectionId,
    resolvePublishedCoachPlanId,
  } = await import(modulePath);

  assertEqual(
    hasPaidOneSessionProgramEntitlement(
      [
        {
          activePaymentStatus: "completed",
          coachId: "coach-1",
          status: "completed",
          userId: "member-1",
        },
      ],
      "member-1",
      "coach-1",
    ),
    true,
    "a completed fully paid one-session booking keeps workout-program entitlement",
  );
  assertEqual(
    hasPaidOneSessionProgramEntitlement(
      [
        {
          activePaymentStatus: "pending",
          coachId: "coach-1",
          status: "confirmed",
          userId: "member-1",
        },
      ],
      "member-1",
      "coach-1",
    ),
    false,
    "unpaid work never grants workout-program entitlement",
  );
  assertEqual(
    canCreateClientWorkoutProgram({
      existingProgramCount: 0,
      hasMonthlyEntitlement: false,
      hasPaidEntitlement: true,
    }),
    true,
    "a paid one-session client can receive the single scoped program",
  );
  assertEqual(
    canCreateClientWorkoutProgram({
      existingProgramCount: 1,
      hasMonthlyEntitlement: false,
      hasPaidEntitlement: true,
    }),
    false,
    "a paid one-session entitlement cannot create an additional program",
  );
  assertEqual(
    canCreateClientWorkoutProgram({
      existingProgramCount: 1,
      hasMonthlyEntitlement: true,
      hasPaidEntitlement: true,
    }),
    true,
    "an active monthly entitlement can create a replacement paid-period program",
  );

  const gate = createSingleSubmitGate();

  assertEqual(
    gate.tryAcquire(),
    true,
    "first publish click acquires the submit gate",
  );
  assertEqual(
    gate.tryAcquire(),
    false,
    "duplicate publish clicks are blocked while the request is pending",
  );

  gate.release();
  assertEqual(
    gate.tryAcquire(),
    true,
    "a failed request can be retried after the gate is released",
  );

  const draft = createCoachWorkoutPlanDraft(2);

  assertEqual(
    draft.title,
    DEFAULT_COACH_WORKOUT_PLAN_TITLE,
    "draft reset restores the default title",
  );
  assertEqual(draft.activeDraftDay, 2, "draft reset restores the active day");
  assertDeepEqual(
    draft.draftDays,
    { 2: { exercises: [], focusLabel: "Tue training" } },
    "draft reset clears exercises and restores the day label",
  );
  assertEqual(draft.exerciseSearch, "", "draft reset clears exercise search");
  assertEqual(draft.message, "", "draft reset clears success messaging");
  assertEqual(draft.builderError, "", "draft reset clears builder errors");

  assertDeepEqual(
    createCoachWorkoutPlanTransition("member-1", "plan-created"),
    { memberId: "member-1", planId: "plan-created" },
    "publish transition carries the same client and published program",
  );
  assertEqual(
    resolvePublishedCoachPlanId(
      {
        coachId: "coach-1",
        id: "assigned-plan",
        isActive: true,
        isTemplate: false,
        source: "coach_assigned",
        userId: "member-1",
      },
      "member-1",
      "coach-1",
    ),
    "assigned-plan",
    "monthly preselection uses the client-assigned program id returned by publish",
  );
  assertThrows(
    () =>
      resolvePublishedCoachPlanId(
        {
          coachId: "coach-1",
          id: "source-plan",
          isActive: true,
          isTemplate: true,
          source: "self_created",
          userId: "coach-1",
        },
        "member-1",
        "coach-1",
      ),
    "template/base program ids are rejected instead of used as the client selection",
  );

  const assignedProgram = {
    coachId: "coach-1",
    id: "assigned-plan",
    isActive: true,
    isTemplate: false,
    source: "coach_assigned" as const,
    userId: "member-1",
  };
  const staleSourceProgram = {
    ...assignedProgram,
    id: "source-plan",
    isTemplate: true,
    source: "self_created" as const,
    userId: "coach-1",
  };

  assertEqual(
    isClientSpecificCoachPlan(assignedProgram, "member-1", "coach-1"),
    true,
    "returned assignment data maps to the member-owned active client program",
  );
  assertEqual(
    isClientSpecificCoachPlan(staleSourceProgram, "member-1", "coach-1"),
    false,
    "stale source/template data is not a valid client program",
  );

  assertEqual(
    resolveMonthlyPlanSelectionId("assigned-plan", [], "member-1", "coach-1"),
    "assigned-plan",
    "the trusted returned id stays pending until the refreshed client list arrives",
  );
  assertEqual(
    resolveMonthlyPlanSelectionId(
      "assigned-plan",
      [staleSourceProgram],
      "member-1",
      "coach-1",
    ),
    "assigned-plan",
    "a fresh assignment is not replaced by a stale list entry",
  );
  assertEqual(
    resolveMonthlyPlanSelectionId(
      "assigned-plan",
      [
        { ...assignedProgram },
        {
          ...assignedProgram,
          id: "older-plan",
          isActive: false,
        },
      ],
      "member-1",
      "coach-1",
    ),
    "assigned-plan",
    "newly created program wins monthly-plan preselection",
  );
  assertEqual(
    isMonthlyPlanSelectionReady(
      "source-plan",
      [staleSourceProgram],
      "member-1",
      "coach-1",
    ),
    false,
    "stale/base/template ids are rejected rather than silently used",
  );
  assertEqual(
    isMonthlyPlanSelectionReady(
      "assigned-plan",
      [assignedProgram],
      "member-1",
      "coach-1",
    ),
    true,
    "preselection becomes ready when the assigned program reaches the client list",
  );
  assertEqual(
    resolveMonthlyPlanSelectionId(
      undefined,
      [
        { ...assignedProgram, id: "active-plan" },
        { ...assignedProgram, id: "older-plan", isActive: false },
      ],
      "member-1",
      "coach-1",
    ),
    "active-plan",
    "active program remains the fallback preselection",
  );

  const previewInput = createClientProgramPreviewInput({
    clientProgram: assignedProgram,
    coachId: "coach-1",
    durationMinutes: 60,
    durationMonths: 1,
    frequency: "monthly",
    memberId: "member-1",
    preferredDays: [2],
    preferredTime: "17:00",
    quotedAmount: 700,
    startDate: "2026-09-01",
  });
  assertEqual(
    previewInput.trainingPlanId,
    "assigned-plan",
    "preview input uses the validated client-assigned program id",
  );
  assertThrows(
    () =>
      createClientProgramPreviewInput({
        ...previewInput,
        clientProgram: staleSourceProgram,
      }),
    "preview input rejects stale/template program data",
  );

  const requests: Array<{ url: string; payload: unknown }> = [];
  const api = createApiClient({
    transport: {
      post: async (url: string, payload: unknown) => {
        requests.push({ url, payload });
        return {
          data: {
            data: {
              candidate_count: 0,
              can_confirm: false,
              conflict_count: 0,
              eligible_session_count: 0,
              purchased_session_count: 0,
              sessions: [],
              selected_session_count: 0,
              total_sessions: 0,
              venue_conflicts_checked: false,
              venue_conflicts_note: null,
            },
          },
        };
      },
    } as never,
  });
  await api.recurringCoachingPlans.preview(previewInput);
  assertDeepEqual(
    requests,
    [
      {
        url: "/bookings/recurring-coaching-plans/preview",
        payload: {
          coach_id: "coach-1",
          duration_minutes: 60,
          duration_months: 1,
          frequency: "monthly",
          member_id: "member-1",
          preferred_days: [2],
          preferred_time: "17:00",
          quoted_amount: 700,
          start_date: "2026-09-01",
          training_plan_id: "assigned-plan",
        },
      },
    ],
    "preview payload serializes the client-assigned program id",
  );
}

void runCoachWorkoutPublishRegression();
