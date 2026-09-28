export const STAFF_COACH_SESSION_DURATIONS = [30, 45, 60, 90] as const;

export type StaffCoachBookingSubmission =
  {
  bookingMode: "single";
  coachId: string;
  durationMinutes: number;
  idempotencyKey: string;
  memberId: string;
  memberNotes?: string;
  paymentStage: "full";
  scheduledAt: string;
};

export function buildStaffCoachBookingSubmission(input: {
  bookingMode: "single";
  coachId: string;
  durationMinutes: number;
  idempotencyKey: string;
  memberId: string;
  memberNotes?: string;
  scheduledAt?: string;
}): StaffCoachBookingSubmission {
  if (!input.scheduledAt) {
    throw new Error("Choose an exact live coach slot.");
  }

  return {
    bookingMode: "single",
    coachId: input.coachId,
    durationMinutes: input.durationMinutes,
    idempotencyKey: input.idempotencyKey,
    memberId: input.memberId,
    ...(input.memberNotes?.trim()
      ? { memberNotes: input.memberNotes.trim() }
      : {}),
    paymentStage: "full",
    scheduledAt: input.scheduledAt,
  };
}
