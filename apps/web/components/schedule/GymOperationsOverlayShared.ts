import type { CSSProperties } from "react";
import type {
  StaffAppointmentRecord,
  VenueAvailabilityRecord,
} from "@fittrack/api-client";
import type { ThemeColors } from "@fittrack/types";

import type { VenueBookingRecord } from "@/contexts/ScheduleContext";

export type AvailabilitySlotDraft = {
  dayOfWeek: number;
  endTime: string;
  startTime: string;
};

export type CoachReadinessSummary = {
  isVisible: boolean;
  openPeakSlots: number;
  trustLabel: string;
};

export type VenueDecision =
  | "cancel"
  | "mark_complete"
  | "no_show";
export type SelectOption = {
  coachUserId?: string;
  disabled?: boolean;
  hourlyRate?: number | null;
  label: string;
  monthlyOfferActive?: boolean;
  monthlyOfferDescription?: string | null;
  monthlyRate?: number | null;
  monthlySessionCount?: number | null;
  monthlySessionDurationMinutes?: number | null;
  unavailableReason?: string | null;
  value: string;
};
export type OverlayConfirmation = {
  confirmLabel: string;
  isDanger?: boolean;
  message: string;
  onConfirm: () => void;
  title: string;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const GYM_TIME_ZONE = "Asia/Manila";

export const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, index) => ({
  label,
  value: String(index),
}));

export const COACH_SPECIALTY_OPTIONS = [
  { label: "Strength", value: "Strength" },
  { label: "Conditioning", value: "Conditioning" },
  { label: "Mobility", value: "Mobility" },
  { label: "Boxing", value: "Boxing" },
  { label: "HIIT", value: "HIIT" },
  { label: "Weight Loss", value: "Weight Loss" },
  { label: "Rehab", value: "Rehab" },
  { label: "Nutrition", value: "Nutrition" },
] as const;

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^[+\d][\d\s().-]{6,39}$/;

export const VENUE_DECISION_LABELS: Record<VenueDecision, string> = {
  cancel: "Cancel booking",
  mark_complete: "Mark complete",
  no_show: "No show",
};

export function splitListInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function toMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function formatPeso(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

export function formatCompactDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getGymDateKey(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: GYM_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "";
}

export function canCancelUntilDayBefore(
  scheduledAt: Date | string | null | undefined,
  now: Date = new Date(),
) {
  const scheduledDay = getGymDateKey(scheduledAt);
  const today = getGymDateKey(now);
  return Boolean(scheduledDay && today && today < scheduledDay);
}

export function hasVenueWindowConflict(
  bookings: VenueAvailabilityRecord[],
  startTime: string,
  endTime: string,
) {
  if (!startTime || !endTime) return false;
  const selectedStart = toMinutes(startTime);
  const selectedEnd = toMinutes(endTime);
  return bookings.some((booking) => {
    if (booking.status !== "confirmed" && booking.status !== "pending") {
      return false;
    }
    const bookingStart = new Date(booking.startTime);
    const bookingEnd = new Date(booking.endTime);
    const bookingStartMinutes =
      bookingStart.getHours() * 60 + bookingStart.getMinutes();
    const bookingEndMinutes =
      bookingEnd.getHours() * 60 + bookingEnd.getMinutes();
    return (
      selectedStart < bookingEndMinutes && selectedEnd > bookingStartMinutes
    );
  });
}

export function matchesDay(selectedDate: string, dayValue: number | string) {
  const currentDate = new Date(`${selectedDate}T00:00:00`);
  const dayIndex = currentDate.getDay();
  if (typeof dayValue === "number") {
    return dayValue === dayIndex;
  }
  return String(dayValue) === String(dayIndex);
}

export function formatSlotLabel(value: string) {
  const [hoursValue, minutesValue] = value.split(":").map(Number);
  const period = hoursValue >= 12 ? "PM" : "AM";
  const normalizedHour = hoursValue % 12 || 12;
  return `${String(normalizedHour).padStart(2, "0")}:${String(minutesValue).padStart(2, "0")} ${period}`;
}

export function getDurationMinutes(startTime: string, endTime: string) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
}

export function formatDurationLabel(durationMinutes: number) {
  if (durationMinutes < 60) return `${durationMinutes} min`;
  if (durationMinutes % 60 !== 0) {
    return `${Math.floor(durationMinutes / 60)} hr ${durationMinutes % 60} min`;
  }
  const hours = durationMinutes / 60;
  return `${hours} hr${hours === 1 ? "" : "s"}`;
}

export function getPersonDisplayName(
  profile:
    | {
        firstName?: string | null;
        lastName?: string | null;
      }
    | null
    | undefined,
  email?: string | null,
  fallback = "Unknown",
) {
  const first = profile?.firstName?.trim() ?? "";
  const last = profile?.lastName?.trim() ?? "";
  const fullName = `${first} ${last}`.trim();
  return fullName || email || fallback;
}

export function formatAppointmentWindow(appointment: StaffAppointmentRecord) {
  const start = new Date(appointment.scheduledAt);
  const end = new Date(start.getTime() + appointment.duration * 60 * 1000);

  return {
    dateLabel: start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    timeLabel: `${start.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })} - ${end.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`,
  };
}

export function formatVenueWindow(booking: VenueBookingRecord) {
  const start = new Date(booking.startTime);
  const end = new Date(booking.endTime);

  return {
    dateLabel: start.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    timeLabel: `${start.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })} - ${end.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    })}`,
  };
}

export function getDefaultDateInput() {
  return getGymDateKey(new Date());
}

export function getCurrentGymMinutes(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: GYM_TIME_ZONE,
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );
  return hour * 60 + minute;
}

export function toIsoString(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const gymOffsetMinutes = 8 * 60;
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) - gymOffsetMinutes * 60 * 1000,
  ).toISOString();
}

export function buildStatusTone(
  status: string | undefined,
  colors: ThemeColors,
) {
  switch (status) {
    case "pending_coach":
    case "pending":
      return {
        bg: colors.brand,
        color: colors.onBrand,
        label: status === "pending_coach" ? "Pending coach" : "Pending review",
      };
    case "confirmed":
      return {
        bg: `${colors.success}22`,
        color: colors.success,
        label: "Confirmed",
      };
    case "completed":
      return {
        bg: `${colors.textMuted}22`,
        color: colors.textPrimary,
        label: "Completed",
      };
    case "cancelled":
    case "coach_unavailable":
      return {
        bg: `${colors.danger}18`,
        color: colors.danger,
        label:
          status === "coach_unavailable" ? "Coach Unavailable" : "Cancelled",
      };
    case "no_show":
      return {
        bg: `${colors.danger}18`,
        color: colors.danger,
        label: "No show",
      };
    default:
      return {
        bg: `${colors.surfaceRaised}`,
        color: colors.textPrimary,
        label: "Review",
      };
  }
}

export function overlaySurfaceStyle(_colors: ThemeColors): CSSProperties {
  return {
    display: "grid",
    gap: 12,
    minWidth: 0,
    backgroundColor: "transparent",
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    padding: 0,
  };
}

export function bookingAmountCardStyle(colors: ThemeColors): CSSProperties {
  return {
    display: "grid",
    alignContent: "space-between",
    gap: 8,
    minHeight: 78,
    minWidth: 0,
    backgroundColor: "transparent",
    border: "none",
    borderTop: `1px solid ${colors.border}`,
    borderRadius: 0,
    boxShadow: "none",
    padding: "12px 0 0",
  };
}

export function metricChipStyle(colors: ThemeColors): CSSProperties {
  return {
    display: "grid",
    gap: 4,
    minWidth: 0,
    backgroundColor: "transparent",
    border: "none",
    borderTop: `1px solid ${colors.border}`,
    borderRadius: 0,
    boxShadow: "none",
    padding: "10px 0 0",
  };
}

export function modalFieldStyle(colors: ThemeColors): CSSProperties {
  return {
    width: "100%",
    minHeight: 42,
    borderRadius: 12,
    border: `1px solid ${colors.fieldBorder ?? colors.border}`,
    backgroundColor: colors.fieldBg ?? colors.surfaceRaised,
    color: colors.textPrimary,
    padding: "10px 12px",
    fontSize: 13,
    fontWeight: 650,
    boxSizing: "border-box",
  };
}

export function modalTextAreaStyle(colors: ThemeColors): CSSProperties {
  return {
    ...modalFieldStyle(colors),
    minHeight: 96,
    lineHeight: 1.45,
    resize: "vertical",
  };
}

export function actionPillStyle(
  colors: ThemeColors,
  active = false,
): CSSProperties {
  return {
    minHeight: 36,
    borderRadius: 10,
    padding: "8px 14px",
    border: `1px solid ${active ? `${colors.brand}44` : colors.border}`,
    backgroundColor: active ? colors.brand : colors.surfaceRaised,
    boxShadow: active ? `0 12px 22px -18px ${colors.brand}` : "none",
    transition:
      "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
  };
}
