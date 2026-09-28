import {
  buildStaffCoachBookingSubmission,
  STAFF_COACH_SESSION_DURATIONS,
} from "./coachCashBooking";

function assertDeepEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

assertDeepEqual(
  STAFF_COACH_SESSION_DURATIONS,
  [30, 45, 60, 90],
  "front-desk single sessions keep the supported fixed duration presets",
);

assertDeepEqual(
  buildStaffCoachBookingSubmission({
    bookingMode: "single",
    coachId: "coach-profile-1",
    durationMinutes: 60,
    idempotencyKey: "request-1",
    memberId: "member-1",
    memberNotes: "  First session  ",
    scheduledAt: "2026-08-20T09:00:00.000+08:00",
  }),
  {
    bookingMode: "single",
    coachId: "coach-profile-1",
    durationMinutes: 60,
    idempotencyKey: "request-1",
    memberId: "member-1",
    memberNotes: "First session",
    paymentStage: "full",
    scheduledAt: "2026-08-20T09:00:00.000+08:00",
  },
  "single mode submits the exact canonical slot as one full-cash appointment",
);
