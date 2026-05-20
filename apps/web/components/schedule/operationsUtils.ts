import type { StaffAppointmentRecord } from "@fittrack/api-client";
import type { ThemeColors } from "@fittrack/types";
import { toYmd } from "@fittrack/utils";

import type { Booking } from "@/data/schedule-constants";
import type { VenueBookingRecord } from "@/contexts/ScheduleContext";

const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getReadableStatus(status?: string) {
  return (status ?? "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getAppointmentStatusColor(status: string | undefined, colors: ThemeColors) {
  switch (status) {
    case "pending_coach":
      return colors.warning;
    case "pending_downpayment":
    case "pending_payment":
    case "pending_full_payment":
      return colors.brand;
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

export function isPendingFullCoachPayment(appointment: StaffAppointmentRecord) {
  return (
    appointment.status === "confirmed" &&
    (appointment.remainingBalance ?? 0) > 0 &&
    !appointment.balancePaidAt
  );
}

export function getCoachAppointmentPaymentStatus(appointment: StaffAppointmentRecord) {
  if (isPendingFullCoachPayment(appointment)) {
    return "pending_full_payment";
  }
  if (
    appointment.status === "pending_payment" &&
    appointment.activePaymentStage === "full"
  ) {
    return "pending_full_payment";
  }
  if (
    appointment.status === "pending_payment" &&
    appointment.activePaymentStage === "downpayment"
  ) {
    return "pending_downpayment";
  }
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
    case "pending_coach":
    case "pending_downpayment":
    case "pending_payment":
    case "pending_full_payment":
      return "Review";
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
    case "pending":
    case "pending_downpayment":
    case "pending_payment":
    case "pending_full_payment":
    case "balance_pending":
      return "Review";
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
  const normalized = (booking.status ?? "pending").toLowerCase();
  const remainingBalance = Number(booking.remainingBalance ?? 0);
  const hasOutstandingBalance = remainingBalance > 0 && !booking.balancePaidAt;

  if (normalized === "cancelled" || normalized === "completed") {
    return normalized;
  }
  if (normalized === "balance_pending") {
    return "pending_full_payment";
  }
  if (normalized === "confirmed" && hasOutstandingBalance) {
    return "pending_full_payment";
  }
  if (normalized === "pending") {
    if (booking.paymentPlan === "downpayment" || hasOutstandingBalance) {
      return "pending_downpayment";
    }
    if (booking.paymentPlan === "full" || Number(booking.totalAmount ?? 0) > 0) {
      return "pending_full_payment";
    }
  }

  return normalized;
}

export function getVenueBookingStatusColor(booking: VenueBookingRecord, colors: ThemeColors) {
  const paymentStatus = getVenueBookingPaymentStatus(booking);
  if (
    paymentStatus === "pending" ||
    paymentStatus === "pending_downpayment" ||
    paymentStatus === "pending_payment" ||
    paymentStatus === "pending_full_payment"
  ) {
    return colors.warning;
  }
  if (paymentStatus === "confirmed") return colors.success;
  if (paymentStatus === "completed") return colors.textMuted;
  return colors.danger;
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
