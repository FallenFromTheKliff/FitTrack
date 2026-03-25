import type { MemberRecord } from "@fittrack/types";
import type { Booking, Resource } from "@/data/schedule-constants";

export const DEFAULT_STAFF_ICON = "👤";
export const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00–21:00

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toYmd(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  if (start.getMonth() === end.getMonth()) {
    return `${start.toLocaleDateString("en-US", { month: "short" })} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`;
  }
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}, ${start.getFullYear()}`;
}

export function getMemberInitials(member: MemberRecord): string {
  const first = member.profile?.firstName?.trim().charAt(0) ?? "";
  const last = member.profile?.lastName?.trim().charAt(0) ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return member.email.slice(0, 2).toUpperCase();
}

export function mapMembersToStaff(allMembers: MemberRecord[]): Resource[] {
  return allMembers
    .filter((m) => m.role?.name === "STAFF" && !m.deletedAt)
    .map((m) => ({
      id: `staff-${m.id}`,
      name:
        m.profile?.firstName && m.profile?.lastName
          ? `${m.profile.firstName} ${m.profile.lastName}`.trim()
          : m.email,
      type: "trainer" as const,
      icon: DEFAULT_STAFF_ICON,
      initials: getMemberInitials(m)
    }));
}

export function buildManualBooking(
  staff: Resource,
  dayDate: Date,
  hour: number,
  brandColor: string
): Booking {
  return {
    id: `manual-${Date.now()}`,
    title: `${staff.name} – Shift`,
    resourceId: staff.id,
    resourceName: staff.name,
    startHour: hour,
    startMinute: 0,
    durationMin: 60,
    color: brandColor,
    status: "confirmed",
    source: "manual",
    date: toYmd(dayDate),
    venueLabel: "Unassigned"
  };
}
