import type { MemberRecord } from "@fittrack/types";
import { formatWeekRange, toYmd } from "@fittrack/utils";
import type { Booking, Resource } from "@/data/schedule-constants";

export const DEFAULT_STAFF_ICON = "👤";
export const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00-21:00

export function getWeekStart(date: Date): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() - nextDate.getDay());
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

export function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export { formatWeekRange, toYmd };

export function getMemberInitials(member: MemberRecord): string {
  const first = member.profile?.firstName?.trim().charAt(0) ?? "";
  const last = member.profile?.lastName?.trim().charAt(0) ?? "";
  if (first || last) return `${first}${last}`.toUpperCase();
  return member.email.slice(0, 2).toUpperCase();
}

export function mapMembersToStaff(allMembers: MemberRecord[]): Resource[] {
  return allMembers
    .filter((member) => member.role?.name === "STAFF" && !member.deletedAt)
    .map((member) => ({
      id: `staff-${member.id}`,
      name:
        member.profile?.firstName && member.profile?.lastName
          ? `${member.profile.firstName} ${member.profile.lastName}`.trim()
          : member.email,
      type: "trainer" as const,
      icon: DEFAULT_STAFF_ICON,
      initials: getMemberInitials(member)
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
    title: `${staff.name} - Shift`,
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