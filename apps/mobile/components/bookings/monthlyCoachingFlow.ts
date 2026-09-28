export type MonthlyCoachingPlanLike = {
  id: string;
  totalSessions: number;
};

export type MonthlyCoachingSessionLike = {
  recurringPlanId?: string | null;
};

export type MonthlyCoachAvailabilitySlotLike = {
  endTime: string;
  isAvailable?: boolean;
  startTime: string;
};

function timeToMinutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

export function normalizeMonthlyPreferredTime(value?: string | null) {
  const normalized = value?.trim().slice(0, 5) ?? "";
  return normalized === "00:00" ? "" : normalized;
}

export function getMonthlyCoachingSetupActionLabel(monthlyScheduledCount: number) {
  return monthlyScheduledCount > 0
    ? "COMPLETE MONTHLY SCHEDULE"
    : "SET MONTHLY SCHEDULE";
}

export function getMonthlyCoachingTimeOptions(
  availability: MonthlyCoachAvailabilitySlotLike[],
  durationMinutes: number,
) {
  const options = new Set<string>();

  for (const slot of availability) {
    if (slot.isAvailable === false) {
      continue;
    }

    const startMinutes = timeToMinutes(slot.startTime);
    const endMinutes = timeToMinutes(slot.endTime);
    if (
      startMinutes === null ||
      endMinutes === null ||
      endMinutes <= startMinutes ||
      durationMinutes <= 0
    ) {
      continue;
    }

    const firstStart = Math.ceil(startMinutes / 30) * 30;
    for (
      let candidate = firstStart;
      candidate + durationMinutes <= endMinutes;
      candidate += 30
    ) {
      options.add(
        `${String(Math.floor(candidate / 60)).padStart(2, "0")}:${String(
          candidate % 60,
        ).padStart(2, "0")}`,
      );
    }
  }

  return [...options].sort();
}

export function deriveMonthlyCoachingSchedule(
  activeMonthlyPlan: MonthlyCoachingPlanLike | null | undefined,
  sessions: MonthlyCoachingSessionLike[],
) {
  const monthlySessions = activeMonthlyPlan
    ? sessions.filter(
        (session) => session.recurringPlanId === activeMonthlyPlan.id,
      )
    : [];
  const monthlyPurchasedCount = activeMonthlyPlan?.totalSessions ?? 0;
  const monthlyScheduledCount = monthlySessions.length;

  return {
    monthlyPurchasedCount,
    monthlyScheduledCount,
    monthlySetupRequired:
      activeMonthlyPlan !== null &&
      activeMonthlyPlan !== undefined &&
      monthlyScheduledCount < monthlyPurchasedCount,
  };
}

export function isSelectableMonthlyPreviewSession(session: {
  conflict?: boolean | null;
  recurringState?: string | null;
}) {
  return session.conflict !== true && session.recurringState !== "conflict";
}
