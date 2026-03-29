import type { Booking } from "@fittrack/types";

export type ScheduleBooking<TRecord = unknown> = Booking & {
  color: string;
  durationMin: number;
  raw: TRecord;
  resourceName: string;
  startHour: number;
  startMinute: number;
  title: string;
};

type StatusColors = Record<string, string>;

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() !== "" ? error.message : fallback;
}

export function createScheduleController() {
  return {
    toMessage,
    toScheduleBooking<TRecord extends {
      endTime: string;
      id: string;
      purpose?: string | null;
      startTime: string;
      status?: string;
      title?: string;
      user?: {
        email?: string | null;
        profile?: {
          firstName?: string | null;
          lastName?: string | null;
        } | null;
      } | null;
      venue?: { name?: string | null } | null;
      venueId?: string | number | null;
    }>(record: TRecord, statusColors: StatusColors): ScheduleBooking<TRecord> {
      const start = new Date(record.startTime);
      const end = new Date(record.endTime);
      const durationMin = Math.round((end.getTime() - start.getTime()) / 60_000);
      const resourceId = record.venueId != null ? `venue-${record.venueId}` : "venue-unassigned";
      const resourceName = record.venue?.name ?? (record.venueId != null ? `Venue ${record.venueId}` : "Unassigned");
      const userLabel = record.user?.profile?.firstName
        ? `${record.user.profile.firstName} ${record.user.profile.lastName ?? ""}`.trim()
        : record.user?.email ?? "Member";
      const title = record.purpose ? `${userLabel} - ${record.purpose}` : record.title?.trim() || userLabel;
      return {
        id: record.id,
        resourceId,
        resourceName,
        resourceType: "venue",
        date: start.toISOString().slice(0, 10),
        time: `${start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        startTime: start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        endTime: end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        status: (record.status?.toLowerCase() ?? "pending") as Booking["status"],
        price: 0,
        startHour: start.getHours(),
        startMinute: start.getMinutes(),
        durationMin,
        title,
        color: statusColors[record.status?.toLowerCase() ?? "pending"] ?? statusColors.pending ?? "",
        raw: record
      };
    },
    async runAction(action: () => Promise<void>, fallback: string) {
      try {
        await action();
        return { success: true as const };
      } catch (error: unknown) {
        return { success: false as const, error: toMessage(error, fallback) };
      }
    }
  };
}