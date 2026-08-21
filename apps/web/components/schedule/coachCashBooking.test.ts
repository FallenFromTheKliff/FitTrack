import {
  buildStaffCoachBookingSubmission,
  getMonthlyCoachPaidPeriod,
  isActiveMonthlyCoachOffer,
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
    startDate: "2026-08-20",
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

assertDeepEqual(
  buildStaffCoachBookingSubmission({
    bookingMode: "monthly",
    coachId: "coach-profile-1",
    durationMinutes: 60,
    idempotencyKey: "request-2",
    memberId: "member-1",
    referenceNo: "  OR-101  ",
    startDate: "2026-08-20",
  }),
  {
    bookingMode: "monthly",
    coachId: "coach-profile-1",
    idempotencyKey: "request-2",
    memberId: "member-1",
    referenceNo: "OR-101",
    startDate: "2026-08-20",
  },
  "monthly mode submits only the active-package cash enrollment fields",
);

assertDeepEqual(
  isActiveMonthlyCoachOffer({
    monthlyOfferActive: true,
    monthlyRate: 4_500,
    monthlySessionCount: 8,
    monthlySessionDurationMinutes: 60,
  }),
  true,
  "a complete published monthly offer is selectable",
);

assertDeepEqual(
  isActiveMonthlyCoachOffer({
    monthlyOfferActive: false,
    monthlyRate: 4_500,
    monthlySessionCount: 8,
    monthlySessionDurationMinutes: 60,
  }),
  false,
  "an inactive monthly offer is rejected",
);

assertDeepEqual(
  getMonthlyCoachPaidPeriod("2026-08-14"),
  { endDate: "2026-09-13", startDate: "2026-08-14" },
  "a monthly package exposes its exact rolling paid date range",
);

assertDeepEqual(
  getMonthlyCoachPaidPeriod("2026-08-31"),
  { endDate: "2026-09-29", startDate: "2026-08-31" },
  "month-end enrollment remains bounded instead of rolling into a second month",
);
