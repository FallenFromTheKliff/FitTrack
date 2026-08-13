import type { CoachAppointmentScheduleRecord } from "@fittrack/api-client";
import { isUpcomingCoachSession } from "@fittrack/utils";

export type CoachClientSummary = {
  completed: number;
  nextSessionLabel: string;
  nextSessionTime: number | null;
  notReviewed: number;
  total: number;
  upcoming: number;
};

type CoachSummaryAppointment = Pick<
  CoachAppointmentScheduleRecord,
  "review" | "scheduledAt" | "status" | "userId"
>;

export function isUpcomingCoachAppointment(
  appointment: Pick<CoachSummaryAppointment, "scheduledAt" | "status">,
  now = Date.now(),
) {
  return isUpcomingCoachSession(appointment, now);
}

export function buildCoachClientSummary(
  appointments: readonly CoachSummaryAppointment[],
  now = Date.now(),
) {
  const byClient = new Map<string, CoachClientSummary>();

  for (const appointment of appointments) {
    const current =
      byClient.get(appointment.userId) ??
      {
        completed: 0,
        nextSessionLabel: "None scheduled",
        nextSessionTime: null,
        notReviewed: 0,
        total: 0,
        upcoming: 0,
      };
    const status = appointment.status ?? "";
    const isCompleted = status === "completed";
    const scheduledTime = new Date(appointment.scheduledAt).getTime();

    current.total += 1;
    if (isCompleted) {
      current.completed += 1;
      if (!appointment.review) current.notReviewed += 1;
    } else if (isUpcomingCoachAppointment(appointment, now)) {
      current.upcoming += 1;
      if (
        current.nextSessionTime == null ||
        scheduledTime < current.nextSessionTime
      ) {
        current.nextSessionTime = scheduledTime;
        current.nextSessionLabel = new Intl.DateTimeFormat("en-PH", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(scheduledTime));
      }
    }

    byClient.set(appointment.userId, current);
  }

  return byClient;
}
