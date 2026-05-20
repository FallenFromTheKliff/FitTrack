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
  | "approve"
  | "cancel"
  | "collect_cash_balance"
  | "mark_complete"
  | "no_show"
  | "paymongo_balance"
  | "reject";
export type CoachDecision =
  | "accept_cash_balance"
  | "accept_cash_downpayment"
  | "accept_cash_full"
  | "approve_payment"
  | "cancel"
  | "confirm"
  | "mark_complete"
  | "paymongo_balance"
  | "paymongo_downpayment"
  | "reject";
export type StaffInitialPaymentStage = "downpayment" | "full";
export type PaymentCollectionProvider = "cash" | "paymongo";
export type SelectOption = {
  hourlyRate?: number | null;
  label: string;
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

export const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, index) => ({
  label,
  value: String(index),
}));

export const VENUE_SLOT_OPTIONS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_PATTERN = /^[+\d][\d\s().-]{6,39}$/;

export const COACH_DECISION_LABELS: Record<CoachDecision, string> = {
  accept_cash_balance: "Accept cash balance",
  accept_cash_downpayment: "Record cash downpayment",
  accept_cash_full: "Record cash full payment",
  approve_payment: "Approve submitted payment",
  cancel: "Cancel appointment",
  confirm: "Confirm session",
  mark_complete: "Mark complete",
  paymongo_balance: "PayMongo balance",
  paymongo_downpayment: "PayMongo downpayment",
  reject: "Reject",
};

export const VENUE_DECISION_LABELS: Record<VenueDecision, string> = {
  approve: "Approve / accept payment",
  cancel: "Cancel booking",
  collect_cash_balance: "Accept cash balance",
  mark_complete: "Mark complete",
  no_show: "No show",
  paymongo_balance: "PayMongo balance",
  reject: "Reject",
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

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function getInitialPaymentAmount(
  totalAmount: number,
  paymentStage: StaffInitialPaymentStage,
) {
  return paymentStage === "downpayment"
    ? roundCurrency(totalAmount * 0.3)
    : roundCurrency(totalAmount);
}

export function formatCompactDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
  const hours = Math.max(1, Math.round(durationMinutes / 60));
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
  return new Date().toISOString().slice(0, 10);
}

export function toIsoString(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const gymOffsetMinutes = 8 * 60;
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) -
      gymOffsetMinutes * 60 * 1000,
  ).toISOString();
}

export function buildStatusTone(status: string | undefined, colors: ThemeColors) {
  switch (status) {
    case "pending_coach":
    case "pending":
      return {
        bg: colors.brand,
        color: colors.onBrand,
        label:
          status === "pending_coach"
            ? "Pending coach"
            : "Pending downpayment",
      };
    case "pending_payment":
      return {
        bg: colors.warning,
        color: colors.onBrand,
        label: "Pending payment",
      };
    case "balance_pending":
      return {
        bg: colors.warning,
        color: colors.onBrand,
        label: "Pending full payment",
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
      return {
        bg: `${colors.danger}18`,
        color: colors.danger,
        label: "Cancelled",
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

export function overlaySurfaceStyle(colors: ThemeColors): CSSProperties {
  return {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 18,
    padding: 22,
    display: "grid",
    gap: 12,
  };
}

export function bookingAmountCardStyle(colors: ThemeColors): CSSProperties {
  return {
    minHeight: 96,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    padding: 14,
    display: "grid",
    alignContent: "space-between",
    gap: 8,
  };
}

export function metricChipStyle(colors: ThemeColors): CSSProperties {
  return {
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    padding: 12,
    display: "grid",
    gap: 4,
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

export function actionPillStyle(colors: ThemeColors, active = false): CSSProperties {
  return {
    minHeight: 36,
    borderRadius: 10,
    padding: "8px 14px",
    border: `1px solid ${active ? `${colors.brand}44` : colors.border}`,
    backgroundColor: active ? colors.brand : colors.surfaceRaised,
    boxShadow: active ? `0 12px 22px -18px ${colors.brand}` : "none",
    transform: active ? "translateY(-1px)" : "translateY(0)",
    transition:
      "background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease",
  };
}
