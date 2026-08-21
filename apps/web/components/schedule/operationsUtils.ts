import type { StaffAppointmentRecord } from "@fittrack/api-client";
import type { ThemeColors } from "@fittrack/types";
import { toYmd } from "@fittrack/utils";

import type { Booking } from "@/data/schedule-constants";
import type { VenueBookingRecord } from "@/contexts/ScheduleContext";

const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getReadableStatus(status?: string) {
  const normalized = (status ?? "unknown").toLowerCase();
  if (["pending", "pending_coach"].includes(normalized)) {
    return "Processing";
  }
  return normalized
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getAppointmentStatusColor(status: string | undefined, colors: ThemeColors) {
  switch (status) {
    case "confirmed":
      return colors.success;
    case "completed":
      return colors.textMuted;
    case "cancelled":
    case "no_show":
      return colors.danger;
    default:
      return colors.textMuted;
  }
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

function isLegacySeedIdentityName(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return Boolean(
    normalized &&
      (normalized.startsWith("seed.member") ||
        normalized.startsWith("seed.staff") ||
        normalized.startsWith("seed.admin")),
  );
}

export function getCoachDisplayName(
  coach:
    | {
        contactEmail?: string | null;
        displayName?: string | null;
        email?: string | null;
        profile?: {
          firstName?: string | null;
          lastName?: string | null;
        } | null;
        user?: {
          email?: string | null;
          profile?: {
            firstName?: string | null;
            lastName?: string | null;
          } | null;
        } | null;
      }
    | null
    | undefined,
  fallback = "Coach",
) {
  const standaloneName = coach?.displayName?.trim();
  if (
    standaloneName &&
    !EMAIL_LIKE_PATTERN.test(standaloneName) &&
    !isLegacySeedIdentityName(standaloneName)
  ) {
    return standaloneName;
  }

  return getPersonDisplayName(
    coach?.profile ?? coach?.user?.profile,
    coach?.email ?? coach?.user?.email ?? coach?.contactEmail,
    fallback,
  );
}

export function formatAppointmentWindow(appointment: StaffAppointmentRecord) {
  const start = new Date(appointment.scheduledAt);
  const end = new Date(start.getTime() + appointment.duration * 60 * 1000);

  return {
    dateLabel: start.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    timeLabel: `${start.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })} - ${end.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })}`,
  };
}

export function getCoachAppointmentPaymentStatus(appointment: StaffAppointmentRecord) {
  return appointment.status;
}

export function mapAppointmentToTimelineBooking(
  appointment: StaffAppointmentRecord,
  colors: ThemeColors,
): Booking {
  const start = new Date(appointment.scheduledAt);
  const memberName = getPersonDisplayName(
    appointment.user?.profile,
    appointment.user?.email,
    "Member",
  );
  const coachName = getCoachDisplayName(appointment.coach, "Coach Profile");

  return {
    id: appointment.id,
    title: appointment.recurringPlanId
      ? `${coachName} recurring coaching`
      : `${coachName} coaching session`,
    resourceId: appointment.coachId,
    resourceName: coachName,
    startHour: start.getHours(),
    startMinute: start.getMinutes(),
    durationMin: appointment.duration,
    color: getAppointmentStatusColor(
      getCoachAppointmentPaymentStatus(appointment),
      colors,
    ),
    status: getCoachAppointmentPaymentStatus(appointment) ?? "pending_coach",
    source: "api",
    date: toYmd(start),
    venueLabel: memberName,
  };
}

export function getAppointmentActionLabel(status?: string) {
  switch (status) {
    case "confirmed":
      return "Open";
    case "completed":
      return "Archive";
    case "cancelled":
    case "no_show":
      return "Closed";
    default:
      return "Open";
  }
}

export function getVenueBookingActionLabel(status?: string) {
  switch (status) {
    case "confirmed":
      return "Open";
    case "completed":
      return "Archive";
    case "cancelled":
      return "Closed";
    default:
      return "Open";
  }
}

export function getVenueBookingPaymentStatus(booking: VenueBookingRecord) {
  return (booking.status ?? "unknown").toLowerCase();
}

export function getVenueBookingStatusColor(booking: VenueBookingRecord, colors: ThemeColors) {
  const paymentStatus = getVenueBookingPaymentStatus(booking);
  if (paymentStatus === "confirmed") return colors.success;
  if (paymentStatus === "completed") return colors.textMuted;
  if (paymentStatus === "cancelled" || paymentStatus === "no_show") return colors.danger;
  return colors.textMuted;
}

export function getDisplayInitials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}
