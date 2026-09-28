export type MonthlyCoachingPlanLike = {
  id: string;
  totalSessions: number;
};

export type MonthlyCoachingAppointmentLike = {
  activePaymentStatus?: string | null;
  recurringPlanId?: string | null;
  status?: string | null;
};

export type MonthlyCoachAvailabilityLike = {
  endTime: string;
  isAvailable: boolean;
  startTime: string;
};

export const MONTHLY_COACHING_SETUP_COPY = {
  label: "MONTHLY COACHING",
  required: "SETUP REQUIRED",
  action: "SET MONTHLY SCHEDULE",
} as const;

function timeToMinutes(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return Number.NaN;
  return Number(match[1]) * 60 + Number(match[2]);
}

function formatTimeValue(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(
    minutes % 60,
  ).padStart(2, "0")}`;
}

export function normalizeMonthlyPreferredTime(value: string | null | undefined) {
  const normalized = value?.trim().slice(0, 5) ?? "";
  return normalized === "00:00" ? "" : normalized;
}

export function getMonthlyCoachingTimeOptions(
  availability: readonly MonthlyCoachAvailabilityLike[],
  durationMinutes: number,
) {
  const options = new Set<string>();
  const duration = Math.max(1, durationMinutes);

  availability.forEach((slot) => {
    if (!slot.isAvailable) return;
    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;

    const firstCanonicalStart = Math.ceil(start / 30) * 30;
    for (
      let candidate = firstCanonicalStart;
      candidate + duration <= end;
      candidate += 30
    ) {
      options.add(formatTimeValue(candidate));
    }
  });

  return [...options].sort((left, right) => timeToMinutes(left) - timeToMinutes(right));
}

export function deriveMonthlyCoachingSchedule<
  TAppointment extends MonthlyCoachingAppointmentLike,
>(
  activeMonthlyPlan: MonthlyCoachingPlanLike | null,
  appointments: TAppointment[],
) {
  const monthlySessions = activeMonthlyPlan
    ? appointments.filter(
        (appointment) =>
          appointment.recurringPlanId === activeMonthlyPlan.id,
      )
    : [];
  const monthlyScheduledCount = monthlySessions.length;
  const monthlyPurchasedCount = activeMonthlyPlan?.totalSessions ?? 0;

  return {
    monthlyPurchasedCount,
    monthlyScheduledCount,
    monthlySessions,
    monthlySetupRequired:
      activeMonthlyPlan != null &&
      monthlyScheduledCount < monthlyPurchasedCount,
  };
}

export function isRecurringCoachingSession(
  appointment: MonthlyCoachingAppointmentLike,
) {
  return Boolean(appointment.recurringPlanId);
}

export function isPaidCoachingScheduleAppointment(
  appointment: MonthlyCoachingAppointmentLike,
) {
  const status = (appointment.status ?? "").toLowerCase();
  return (
    (status === "confirmed" || status === "completed") &&
    (appointment.activePaymentStatus === "completed" ||
      isRecurringCoachingSession(appointment))
  );
}
