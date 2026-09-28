import type { CoachProfileRecord } from "@fittrack/types";
import { formatWeekRange, toYmd } from "@fittrack/utils";
import type { Booking, Resource } from "@/data/schedule-constants";
import { formatAvailabilityTime } from "@/components/schedule/availabilityTime";

export type CoachRosterResource = Resource & {
  availabilityCount: number;
  availabilityPreview: string[];
  bio: string | null;
  certifications: string[];
  email: string;
  hourlyRate: number | null;
  isActive: boolean;
  monthlyOfferActive: boolean;
  monthlyOfferDescription: string | null;
  monthlyRate: number | null;
  monthlySessionCount: number | null;
  monthlySessionDurationMinutes: number | null;
  scheduleType: "full_time" | "part_time";
  specialties: string[];
};

export const DEFAULT_COACH_ICON = "CO";
export const HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06:00-21:00
const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function isLegacySeedIdentityEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return Boolean(
    normalized &&
    (normalized.startsWith("seed.member") ||
      normalized.startsWith("seed.staff") ||
      normalized.startsWith("seed.admin")),
  );
}

function getCoachDisplayName(coach: CoachProfileRecord, index: number): string {
  const standaloneName = coach.displayName?.trim();
  if (
    standaloneName &&
    !EMAIL_LIKE_PATTERN.test(standaloneName) &&
    !isLegacySeedIdentityEmail(standaloneName)
  ) {
    return standaloneName;
  }

  return `Coach Profile ${index + 1}`;
}

function formatAvailabilityPreview(coach: CoachProfileRecord): string[] {
  return (coach.availability ?? []).map((slot) => {
    const weekday = WEEKDAY_NAMES[slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`;
    return `${weekday} ${formatAvailabilityTime(slot.startTime)} - ${formatAvailabilityTime(slot.endTime)}`;
  });
}

export function getCoachInitials(coach: CoachProfileRecord): string {
  const standaloneName = coach.displayName?.trim();
  if (
    standaloneName &&
    !EMAIL_LIKE_PATTERN.test(standaloneName) &&
    !isLegacySeedIdentityEmail(standaloneName)
  ) {
    return (
      standaloneName
        .split(" ")
        .filter((part) => part.length > 0)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("") || DEFAULT_COACH_ICON
    );
  }
  return DEFAULT_COACH_ICON;
}

export function mapCoachesToRoster(
  coaches: CoachProfileRecord[],
): CoachRosterResource[] {
  return coaches.map((coach, index) => ({
    id: coach.id,
    name: getCoachDisplayName(coach, index),
    type: "trainer" as const,
    icon: DEFAULT_COACH_ICON,
    initials: getCoachInitials(coach),
    bio: coach.bio ?? null,
    certifications: coach.certifications ?? [],
    specialties: coach.specialties ?? [],
    hourlyRate: coach.hourlyRate ?? null,
    isActive: coach.isActive ?? false,
    monthlyOfferActive: coach.monthlyOfferActive ?? false,
    monthlyOfferDescription: coach.monthlyOfferDescription ?? null,
    monthlyRate: coach.monthlyRate ?? null,
    monthlySessionCount: coach.monthlySessionCount ?? null,
    monthlySessionDurationMinutes:
      coach.monthlySessionDurationMinutes ?? null,
    scheduleType: coach.scheduleType ?? "part_time",
    email: isLegacySeedIdentityEmail(coach.contactEmail)
      ? ""
      : (coach.contactEmail ?? ""),
    availabilityCount: coach.availability?.length ?? 0,
    availabilityPreview: formatAvailabilityPreview(coach),
  }));
}

export function buildManualBooking(
  staff: Resource,
  dayDate: Date,
  hour: number,
  brandColor: string,
): Booking {
  return {
    id: `manual-${Date.now()}`,
    title: `${staff.name} - Coaching Block`,
    resourceId: staff.id,
    resourceName: staff.name,
    startHour: hour,
    startMinute: 0,
    durationMin: 60,
    color: brandColor,
    status: "confirmed",
    source: "manual",
    date: toYmd(dayDate),
    venueLabel: "Coach Session",
  };
}
