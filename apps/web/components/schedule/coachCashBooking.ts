export const STAFF_COACH_SESSION_DURATIONS = [30, 45, 60, 90] as const;

export type StaffCoachBookingSubmission =
  | {
      bookingMode: "monthly";
      coachId: string;
      idempotencyKey: string;
      memberId: string;
      referenceNo?: string;
      startDate: string;
    }
  | {
      bookingMode: "single";
      coachId: string;
      durationMinutes: number;
      idempotencyKey: string;
      memberId: string;
      memberNotes?: string;
      paymentStage: "full";
      scheduledAt: string;
    };

export function isActiveMonthlyCoachOffer(offer: {
  monthlyOfferActive?: boolean;
  monthlyRate?: number | null;
  monthlySessionCount?: number | null;
  monthlySessionDurationMinutes?: number | null;
}) {
  return (
    offer.monthlyOfferActive === true &&
    Number(offer.monthlyRate ?? 0) > 0 &&
    Number(offer.monthlySessionCount ?? 0) > 0 &&
    Number(offer.monthlySessionDurationMinutes ?? 0) > 0
  );
}

export function getMonthlyCoachPaidPeriod(startDate: string) {
  const [year, month, day] = startDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  const start = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(start.getTime())) return null;
  const targetMonthStart = new Date(Date.UTC(year, month, 1));
  const targetMonthEnd = new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth() + 1,
      0,
    ),
  );
  const nextMonthSameDay = new Date(
    Date.UTC(
      targetMonthStart.getUTCFullYear(),
      targetMonthStart.getUTCMonth(),
      Math.min(day, targetMonthEnd.getUTCDate()),
    ),
  );
  const end = new Date(nextMonthSameDay.getTime() - 24 * 60 * 60 * 1000);
  const toDateKey = (value: Date) => value.toISOString().slice(0, 10);
  return { endDate: toDateKey(end), startDate: toDateKey(start) };
}

export function buildStaffCoachBookingSubmission(input: {
  bookingMode: "monthly" | "single";
  coachId: string;
  durationMinutes: number;
  idempotencyKey: string;
  memberId: string;
  memberNotes?: string;
  referenceNo?: string;
  scheduledAt?: string;
  startDate: string;
}): StaffCoachBookingSubmission {
  if (input.bookingMode === "monthly") {
    return {
      bookingMode: "monthly",
      coachId: input.coachId,
      idempotencyKey: input.idempotencyKey,
      memberId: input.memberId,
      ...(input.referenceNo?.trim()
        ? { referenceNo: input.referenceNo.trim() }
        : {}),
      startDate: input.startDate,
    };
  }

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
