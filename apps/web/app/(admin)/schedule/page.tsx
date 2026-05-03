"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MotionStyle } from "framer-motion";
import { toast } from "sonner";
import type {
  RecurringCoachingBillingCycleRecord,
  RecurringCoachingPlanInput,
  RecurringCoachingPlanPreviewResult,
  StaffAppointmentRecord,
} from "@fittrack/api-client";
import type { MemberRecord } from "@fittrack/types";
import {
  bulkUpdateRecurringCoachingSessionsMutationOptions,
  cancelStaffAppointmentMutationOptions,
  cancelRecurringCoachingPlanMutationOptions,
  completeStaffAppointmentMutationOptions,
  createStaffAppointmentMutationOptions,
  createStaffBookingMutationOptions,
  createStaffCoachMutationOptions,
  payAppointmentDownpaymentMutationOptions,
  createRecurringCoachingPlanMutationOptions,
  previewRecurringCoachingPlanMutationOptions,
  processAppointmentBalanceMutationOptions,
  processBookingBalanceMutationOptions,
  payRecurringCoachingBillingCycleMutationOptions,
  recurringCoachingPlanSessionsQueryOptions,
  replaceStaffCoachAvailabilityMutationOptions,
  respondToStaffAppointmentMutationOptions,
  staffAppointmentsQueryOptions,
  staffCoachesQueryOptions,
  staffUsersQueryOptions,
  updateRecurringCoachingSessionMutationOptions,
  updateStaffCoachProfileMutationOptions,
  venuesQueryOptions,
  verifyMembershipPaymentMutationOptions,
} from "@fittrack/query";
import { coachProfileSchema } from "@fittrack/validators";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  useSchedule,
  type VenueBookingRecord,
} from "@/contexts/ScheduleContext";
import { webApiClient } from "@/lib/api-client";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useDebounce } from "@fittrack/hooks";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import { usePowerSlide } from "@/hooks/animations/usePowerSlide";
import { useFitSensors } from "@/hooks/useFitSensors";
import { formatWeekRange, toYmd } from "@fittrack/utils";

import {
  FitButton,
  FitPill,
  FitSection,
  FitSelect,
  FitTable,
  FitText,
} from "@/components/fit";
import type { FitTableColumn } from "@/components/fit/FitTable";
import {
  BlockDetailModal,
  CalendarModal,
  ConfirmModal,
  DetailsModal,
  StaffDetailsModal,
} from "@/components/modals";
import {
  GymOperationsAvailabilityDrawer,
  GymOperationsCoachAppointmentModal,
  GymOperationsCreateCoachBookingModal,
  GymOperationsCreateCoachModal,
  GymOperationsCreateVenueBookingModal,
  GymOperationsVenueBookingModal,
} from "@/components/schedule/GymOperationsOverlays";
import type { FieldConfig } from "@/components/modals";

import { RosterPanel, WeeklyTimeline } from "@/components/schedule";
import type { Booking, Resource } from "@/components/schedule";

import {
  HOURS,
  addDays,
  buildManualBooking,
  getWeekStart,
  mapCoachesToRoster,
} from "./helpers";

type GymOperationsTab = "schedule" | "coaches";
type ScheduleSurfaceTab = "coach-schedule" | "venue-bookings";
type CoachVisibilityScope = "all" | "hidden" | "visible";
type RecurringPlanActionMode = "single" | "future" | "cancel";
type PaymentCollectionProvider = "cash" | "paymongo";
type PaymentConfirmState =
  | {
      kind: "coachInitial";
      appointment: StaffAppointmentRecord;
      provider: PaymentCollectionProvider;
      paymentStage: "downpayment" | "full";
      title: string;
      message: string;
      confirmLabel: string;
    }
  | {
      kind: "coachBalance";
      appointment: StaffAppointmentRecord;
      provider: PaymentCollectionProvider;
      title: string;
      message: string;
      confirmLabel: string;
    }
  | {
      kind: "recurringCycle";
      cycle: RecurringCoachingBillingCycleRecord;
      provider: PaymentCollectionProvider;
      title: string;
      message: string;
      confirmLabel: string;
    }
  | {
      kind: "venueBalance";
      booking: VenueBookingRecord;
      provider: PaymentCollectionProvider;
      title: string;
      message: string;
      confirmLabel: string;
    };

type RecurringPlanFormState = {
  coachId: string;
  durationMinutes: number;
  durationMonths: number;
  frequency: "weekly" | "biweekly";
  memberId: string;
  preferredDays: number[];
  preferredTime: string;
  startDate: string;
};

type RecurringPlanActionState = {
  appointment: StaffAppointmentRecord;
  mode: RecurringPlanActionMode;
};

const EMPTY_APPOINTMENT_RESULT = {
  data: [] as StaffAppointmentRecord[],
  meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
};

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Pending coach", value: "pending_coach" },
  { label: "Pending full payment", value: "pending_full_payment" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "No show", value: "no_show" },
];

const GYM_OPERATIONS_TABS: Array<{ key: GymOperationsTab; label: string }> = [
  { key: "schedule", label: "Schedule" },
  { key: "coaches", label: "Manage Coaches" },
];

const SCHEDULE_SURFACE_TABS: Array<{
  key: ScheduleSurfaceTab;
  label: string;
}> = [
  { key: "coach-schedule", label: "Coach Schedule" },
  { key: "venue-bookings", label: "Venue Bookings" },
];

const VENUE_STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Pending full payment", value: "balance_pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "No show", value: "no_show" },
];

const COACH_VISIBILITY_SCOPE_OPTIONS = [
  { label: "All profiles", value: "all" },
  { label: "Visible", value: "visible" },
  { label: "Hidden", value: "hidden" },
];

const WEEKDAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

const RECURRING_FREQUENCY_OPTIONS = [
  { label: "Weekly", value: "weekly" },
  { label: "Biweekly", value: "biweekly" },
];

const RECURRING_DURATION_OPTIONS = [
  { label: "1 month", value: "1" },
  { label: "3 months", value: "3" },
  { label: "6 months", value: "6" },
];

function createDefaultRecurringPlanForm(): RecurringPlanFormState {
  const tomorrow = addDays(new Date(), 1);
  return {
    coachId: "",
    durationMinutes: 60,
    durationMonths: 3,
    frequency: "weekly",
    memberId: "",
    preferredDays: [tomorrow.getDay()],
    preferredTime: "09:00",
    startDate: toYmd(tomorrow),
  };
}

function buildLocalIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

function formatRecurringDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRecurringInput(
  form: RecurringPlanFormState,
  conflictOverrides?: RecurringCoachingPlanInput["sessionOverrides"],
): RecurringCoachingPlanInput {
  return {
    coachId: form.coachId,
    durationMinutes: form.durationMinutes,
    durationMonths: form.durationMonths,
    frequency: form.frequency,
    memberId: form.memberId,
    preferredDays: form.preferredDays,
    preferredTime: form.preferredTime,
    sessionOverrides: conflictOverrides,
    startDate: form.startDate,
  };
}

function normalizeOperationsTab(
  value: string | null,
  canManageCoaching: boolean,
): GymOperationsTab {
  if (canManageCoaching && value === "coaches") return "coaches";
  return "schedule";
}

function normalizeScheduleSurfaceTab(value: string | null): ScheduleSurfaceTab {
  if (value === "venues") return "venue-bookings";
  return "coach-schedule";
}

const COACH_PROFILE_FIELDS: FieldConfig[] = [
  {
    name: "displayName",
    label: "Coach Name",
    type: "text",
    required: true,
    placeholder: "Coach Profile Alpha",
    hint: "Standalone coach profile name. This is not a user account.",
  },
  {
    name: "contactEmail",
    label: "Contact Email",
    type: "text",
    placeholder: "coach.profile@fittrack.local",
    hint: "Optional profile contact email. Account emails are not used for coach profiles.",
  },
  {
    name: "contactPhone",
    label: "Contact Phone",
    type: "text",
    placeholder: "+639171234567",
  },
  {
    name: "bio",
    label: "Bio",
    type: "textarea",
    placeholder: "Tell members how this coach trains and what they focus on.",
  },
  {
    name: "specialties",
    label: "Specialties",
    type: "textarea",
    required: true,
    placeholder: "Strength, Boxing, Conditioning",
    hint: "Separate specialties with commas or line breaks.",
  },
  {
    name: "certifications",
    label: "Certifications",
    type: "textarea",
    placeholder: "NASM, CPR, First Aid",
    hint: "Separate certifications with commas or line breaks.",
  },
  {
    name: "hourlyRate",
    label: "Hourly Rate",
    type: "text",
    required: true,
    placeholder: "e.g. 850",
    hint: "Use whole Philippine peso values only.",
  },
  {
    name: "isAvailableForBooking",
    label: "Booking Visibility",
    type: "select",
    required: true,
    hint: "This controls whether members can see and book this coach.",
    options: [
      { label: "Visible to members", value: "active" },
      { label: "Hidden from member booking", value: "inactive" },
    ],
  },
];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function getReadableStatus(status?: string) {
  return (status ?? "unknown")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getAppointmentStatusColor(
  status: string | undefined,
  colors: ReturnType<typeof useTheme>["colors"],
) {
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

function getPersonDisplayName(
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

const EMAIL_LIKE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isLegacySeedIdentityName(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return Boolean(
    normalized &&
    (normalized.startsWith("seed.member") ||
      normalized.startsWith("seed.staff") ||
      normalized.startsWith("seed.admin")),
  );
}

function getCoachDisplayName(
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

  return fallback;
}

function formatAppointmentWindow(appointment: StaffAppointmentRecord) {
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

function isPendingFullCoachPayment(appointment: StaffAppointmentRecord) {
  return (
    appointment.status === "confirmed" &&
    (appointment.remainingBalance ?? 0) > 0 &&
    !appointment.balancePaidAt
  );
}

function getCoachAppointmentPaymentStatus(appointment: StaffAppointmentRecord) {
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

function mapAppointmentToTimelineBooking(
  appointment: StaffAppointmentRecord,
  colors: ReturnType<typeof useTheme>["colors"],
): Booking {
  const start = new Date(appointment.scheduledAt);
  const memberName = getPersonDisplayName(
    appointment.user.profile,
    appointment.user.email,
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

function getAppointmentActionLabel(status?: string) {
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

function getVenueBookingActionLabel(status?: string) {
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

function getVenueBookingPaymentStatus(booking: VenueBookingRecord) {
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

function getVenueBookingStatusColor(
  booking: VenueBookingRecord,
  colors: ReturnType<typeof useTheme>["colors"],
) {
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

function getDisplayInitials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function OperationsMetricCard({
  colors,
  label,
  tone,
  value,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  label: string;
  tone?: string;
  value: string | number;
}) {
  const { settings } = useTheme();
  const canAnimate = settings.animationLevel !== "none";
  const fullMotion = settings.animationLevel === "full";

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        padding: "10px 12px",
        display: "grid",
        gap: 4,
        transformOrigin: "center",
        transition: canAnimate
          ? "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease"
          : "border-color 160ms ease, box-shadow 160ms ease, background-color 160ms ease",
      }}
      onMouseEnter={(event) => {
        if (!canAnimate) return;
        event.currentTarget.style.transform = fullMotion
          ? "translateY(-1px)"
          : "translateY(-0.5px)";
        event.currentTarget.style.boxShadow = "0 10px 22px rgba(0,0,0,0.14)";
        event.currentTarget.style.borderColor = `${colors.brand}28`;
      }}
      onMouseLeave={(event) => {
        event.currentTarget.style.transform = "none";
        event.currentTarget.style.boxShadow = "none";
        event.currentTarget.style.borderColor = colors.border;
      }}
    >
      <FitText
        excludeGlobalScale
        style={{
          fontSize: 10.5,
          fontWeight: 650,
          color: colors.textMuted,
          letterSpacing: "0.02em",
          lineHeight: 1.15,
        }}
      >
        {label}
      </FitText>
      <FitText
        excludeGlobalScale
        style={{
          fontSize: 21,
          fontWeight: 800,
          color: tone ?? colors.textPrimary,
          lineHeight: 1.05,
          letterSpacing: 0,
        }}
      >
        {value}
      </FitText>
    </div>
  );
}

function CoachAppointmentsTable({
  appointments,
  colors,
  onOpenReview,
}: {
  appointments: StaffAppointmentRecord[];
  colors: ReturnType<typeof useTheme>["colors"];
  onOpenReview: (appointment: StaffAppointmentRecord) => void;
}) {
  const { settings } = useTheme();
  const canAnimate = settings.animationLevel !== "none";
  const resultsHeight = 170;

  if (appointments.length === 0) {
    return (
      <div
        style={{
          minHeight: resultsHeight,
          maxHeight: resultsHeight,
          borderRadius: 18,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          padding: "20px 22px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <FitText
          excludeGlobalScale
          style={{ fontSize: 14, color: colors.textMuted }}
        >
          No coach appointments match the current filters.
        </FitText>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: resultsHeight,
        maxHeight: 236,
        borderRadius: 18,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        padding: 12,
        display: "grid",
        gap: 10,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(180px, 1.3fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(130px, 0.9fr) minmax(120px, 0.8fr)",
          gap: 12,
          padding: "0 8px 2px",
        }}
      >
        {["MEMBER", "COACH", "SLOT", "STATUS", "ACTION"].map((label) => (
          <FitText
            excludeGlobalScale
            key={label}
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.textMuted,
              letterSpacing: "0.08em",
            }}
          >
            {label}
          </FitText>
        ))}
      </div>
      {appointments.map((appointment) => {
        const memberName = getPersonDisplayName(
          appointment.user.profile,
          appointment.user.email,
          "Member",
        );
        const coachName = getCoachDisplayName(appointment.coach, "Coach");
        const { dateLabel, timeLabel } = formatAppointmentWindow(appointment);

        return (
          <div
            key={appointment.id}
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(180px, 1.3fr) minmax(150px, 1fr) minmax(150px, 1fr) minmax(130px, 0.9fr) minmax(120px, 0.8fr)",
              gap: 12,
              alignItems: "center",
              minHeight: 52,
              borderRadius: 14,
              border: `1px solid ${colors.border}55`,
              backgroundColor: colors.surfaceRaised,
              padding: "10px 14px",
              transformOrigin: "center",
              transition: canAnimate
                ? "transform 160ms ease, border-color 160ms ease, background-color 160ms ease"
                : "border-color 160ms ease, background-color 160ms ease",
            }}
            onMouseEnter={(event) => {
              if (!canAnimate) return;
              event.currentTarget.style.transform = "translateY(-1px)";
              event.currentTarget.style.borderColor = `${colors.brand}24`;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = "none";
              event.currentTarget.style.borderColor = colors.border;
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
              }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  backgroundColor: `${colors.brand}18`,
                  border: `1px solid ${colors.brand}24`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 10, fontWeight: 700, color: colors.brand }}
                >
                  {getDisplayInitials(memberName)}
                </FitText>
              </div>
              <div style={{ minWidth: 0 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: colors.textPrimary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {memberName}
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 10.5,
                    color: appointment.recurringPlanId
                      ? colors.brand
                      : colors.textMuted,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {appointment.recurringPlanId
                    ? "Recurring coaching plan"
                    : (appointment.user.email ?? "No email recorded")}
                </FitText>
              </div>
            </div>

            <div style={{ minWidth: 0 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {coachName}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 10.5, color: colors.textMuted }}
              >
                {appointment.coach.hourlyRate != null
                  ? `PHP ${appointment.coach.hourlyRate.toLocaleString("en-PH")}/hr`
                  : "Rate not set"}
              </FitText>
            </div>

            <div style={{ minWidth: 0 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                {dateLabel}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 10.5, color: colors.textMuted }}
              >
                {timeLabel} - {appointment.duration} mins
              </FitText>
            </div>

            <FitPill
              mode="status"
              label={getReadableStatus(
                getCoachAppointmentPaymentStatus(appointment),
              ).toUpperCase()}
              color={getAppointmentStatusColor(
                getCoachAppointmentPaymentStatus(appointment),
                colors,
              )}
              fontSize={10}
              fontWeight={700}
              borderOpacity="35"
              bgOpacity="14"
            />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {appointment.status === "cancelled" ||
              appointment.status === "no_show" ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.textMuted }}
                >
                  Closed
                </FitText>
              ) : (
                <FitButton
                  variant={
                    appointment.status === "pending_coach" ? "primary" : "ghost"
                  }
                  label={getAppointmentActionLabel(
                    getCoachAppointmentPaymentStatus(appointment),
                  ).toUpperCase()}
                  onClick={() => onOpenReview(appointment)}
                  style={{
                    minHeight: 30,
                    padding: "6px 14px",
                    borderRadius: 15,
                  }}
                  textStyle={{ fontSize: 11, fontWeight: 700 }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function VenueBookingsTable({
  bookings,
  colors,
  emptyMessage = "No venue bookings match the current filters.",
  onOpenReview,
}: {
  bookings: VenueBookingRecord[];
  colors: ReturnType<typeof useTheme>["colors"];
  emptyMessage?: string;
  onOpenReview: (booking: VenueBookingRecord) => void;
}) {
  const { settings } = useTheme();
  const canAnimate = settings.animationLevel !== "none";

  if (bookings.length === 0) {
    return (
      <div
        style={{
          minHeight: 170,
          maxHeight: 170,
          borderRadius: 18,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          padding: "20px 22px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <FitText
          excludeGlobalScale
          style={{ fontSize: 14, color: colors.textMuted }}
        >
          {emptyMessage}
        </FitText>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: 170,
        maxHeight: 236,
        borderRadius: 18,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        padding: 12,
        display: "grid",
        gap: 10,
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(180px, 1.15fr) minmax(170px, 1fr) minmax(150px, 1fr) minmax(130px, 0.85fr) minmax(120px, 0.8fr)",
          gap: 12,
          padding: "0 8px 2px",
        }}
      >
        {["MEMBER", "VENUE", "SLOT", "STATUS", "ACTION"].map((label) => (
          <FitText
            key={label}
            excludeGlobalScale
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.textMuted,
              letterSpacing: "0.08em",
            }}
          >
            {label}
          </FitText>
        ))}
      </div>

      {bookings.map((booking) => {
        const memberName = getPersonDisplayName(
          booking.user?.profile,
          booking.user?.email,
          "Member",
        );
        const start = new Date(booking.startTime);
        const end = new Date(booking.endTime);
        return (
          <div
            key={booking.id}
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(180px, 1.15fr) minmax(170px, 1fr) minmax(150px, 1fr) minmax(130px, 0.85fr) minmax(120px, 0.8fr)",
              gap: 12,
              alignItems: "center",
              minHeight: 52,
              borderRadius: 14,
              border: `1px solid ${colors.border}55`,
              backgroundColor: colors.surfaceRaised,
              padding: "10px 14px",
              transition: canAnimate
                ? "transform 160ms ease, border-color 160ms ease, background-color 160ms ease"
                : "border-color 160ms ease, background-color 160ms ease",
            }}
            onMouseEnter={(event) => {
              if (!canAnimate) return;
              event.currentTarget.style.transform = "translateY(-1px)";
              event.currentTarget.style.borderColor = `${colors.brand}24`;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.transform = "none";
              event.currentTarget.style.borderColor = `${colors.border}55`;
            }}
          >
            <div style={{ minWidth: 0 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                {memberName}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 10.5, color: colors.textMuted }}
              >
                {booking.user?.email ?? "No email recorded"}
              </FitText>
            </div>
            <div style={{ minWidth: 0 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                {booking.venue?.name ?? `Venue ${booking.venueId}`}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 10.5, color: colors.textMuted }}
              >
                {booking.purpose?.trim() || "General venue use"}
              </FitText>
            </div>
            <div style={{ minWidth: 0 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                {start.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 10.5, color: colors.textMuted }}
              >
                {start.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}{" "}
                -{" "}
                {end.toLocaleTimeString([], {
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </FitText>
            </div>
            <FitPill
              mode="status"
              label={getReadableStatus(
                getVenueBookingPaymentStatus(booking),
              ).toUpperCase()}
              color={getVenueBookingStatusColor(booking, colors)}
              fontSize={10}
              fontWeight={700}
              borderOpacity="35"
              bgOpacity="14"
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {booking.status === "cancelled" ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.textMuted }}
                >
                  Closed
                </FitText>
              ) : (
                <FitButton
                  variant={
                    getVenueBookingActionLabel(
                      getVenueBookingPaymentStatus(booking),
                    ) === "Review"
                      ? "primary"
                      : "ghost"
                  }
                  label={getVenueBookingActionLabel(
                    getVenueBookingPaymentStatus(booking),
                  ).toUpperCase()}
                  onClick={() => onOpenReview(booking)}
                  style={{
                    minHeight: 30,
                    padding: "6px 14px",
                    borderRadius: 15,
                  }}
                  textStyle={{ fontSize: 11, fontWeight: 700 }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function GymOperationsPage() {
  const { colors, settings } = useTheme();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const isAdmin = user?.role === "ADMIN";
  const canManageCoaching = isAdmin || user?.role === "STAFF";
  const {
    cancelBooking,
    completeBooking,
    confirmBooking,
    noShowBooking,
    rejectBooking,
    rawBookings,
    isLoading: scheduleLoading,
  } = useSchedule();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();

  const showFeedback = (
    nextMessage: string,
    tone: "danger" | "success" = "success",
  ) => {
    if (tone === "danger") {
      toast.error(nextMessage);
      return;
    }
    toast.success(nextMessage);
  };

  const refreshGymOperationsData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["staff", "appointments"] }),
      queryClient.invalidateQueries({ queryKey: ["staff", "bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["staff", "coaches"] }),
      queryClient.invalidateQueries({ queryKey: ["recurring-coaching-plans"] }),
      queryClient.invalidateQueries({ queryKey: ["venues"] }),
      queryClient.invalidateQueries({ queryKey: ["coaches"] }),
      queryClient.invalidateQueries({ queryKey: ["bookings"] }),
      queryClient.invalidateQueries({ queryKey: ["analytics"] }),
    ]);
    showFeedback("Gym Operations data refreshed.");
  };

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [slideKey, setSlideKey] = useState(0);
  const [slideDir, setSlideDir] = useState<"left" | "right">("right");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeOperationsTab, setActiveOperationsTab] =
    useState<GymOperationsTab>(() =>
      normalizeOperationsTab(searchParams.get("tab"), canManageCoaching),
    );
  const [activeScheduleSurfaceTab, setActiveScheduleSurfaceTab] =
    useState<ScheduleSurfaceTab>(() =>
      normalizeScheduleSurfaceTab(searchParams.get("schedule_view")),
    );
  const { style: slideStyle } = usePowerSlide(slideKey, slideDir);

  const prevWeek = () => {
    setSlideDir("left");
    setSlideKey((key) => key + 1);
    setWeekStart((date) => addDays(date, -7));
  };

  const nextWeek = () => {
    setSlideDir("right");
    setSlideKey((key) => key + 1);
    setWeekStart((date) => addDays(date, 7));
  };

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  );

  const [coachQuery, setCoachQuery] = useState("");
  const debouncedQuery = useDebounce(coachQuery, 250);
  const [coachVisibilityScope, setCoachVisibilityScope] =
    useState<CoachVisibilityScope>("all");
  const [manualBookings, setManualBookings] = useState<Booking[]>([]);
  const [bookingOverrides, setBookingOverrides] = useState<
    Record<string, Pick<Booking, "date" | "startHour" | "startMinute">>
  >({});
  const [draggingCoach, setDraggingCoach] = useState<Resource | null>(null);
  const [draggingBooking, setDraggingBooking] = useState<Booking | null>(null);
  const [coachFilterId, setCoachFilterId] = useState<string | null>(null);
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState("all");
  const [venueFilterId, setVenueFilterId] = useState("all");
  const [venueStatusFilter, setVenueStatusFilter] = useState("all");
  const [availabilityEditorCoachId, setAvailabilityEditorCoachId] = useState<
    string | null
  >(null);
  const [profileEditorCoachId, setProfileEditorCoachId] = useState<
    string | null
  >(null);
  const [appointmentReviewTarget, setAppointmentReviewTarget] =
    useState<StaffAppointmentRecord | null>(null);
  const [venueReviewTarget, setVenueReviewTarget] =
    useState<VenueBookingRecord | null>(null);
  const [createVenueBookingOpen, setCreateVenueBookingOpen] = useState(false);
  const [createCoachBookingOpen, setCreateCoachBookingOpen] = useState(false);
  const [createCoachOpen, setCreateCoachOpen] = useState(false);
  const [recurringPlanOpen, setRecurringPlanOpen] = useState(false);
  const [recurringPlanForm, setRecurringPlanForm] =
    useState<RecurringPlanFormState>(() => createDefaultRecurringPlanForm());
  const [recurringPlanPreview, setRecurringPlanPreview] =
    useState<RecurringCoachingPlanPreviewResult | null>(null);
  const [recurringPlanAction, setRecurringPlanAction] =
    useState<RecurringPlanActionState | null>(null);
  const [recurringActionDate, setRecurringActionDate] = useState("");
  const [recurringActionTime, setRecurringActionTime] = useState("09:00");
  const [recurringActionCoachId, setRecurringActionCoachId] = useState("");
  const [recurringActionDays, setRecurringActionDays] = useState<number[]>([]);
  const [recurringActionReason, setRecurringActionReason] = useState("");
  const [paymentConfirm, setPaymentConfirm] =
    useState<PaymentConfirmState | null>(null);

  const { data: coachProfiles = [] } = useQuery({
    ...staffCoachesQueryOptions(webApiClient),
    enabled: canManageCoaching,
    staleTime: 60_000,
  });
  const { data: staffUsers = [] } = useQuery({
    ...staffUsersQueryOptions(webApiClient),
    enabled: canManageCoaching,
    staleTime: 60_000,
  });
  const { data: venues = [] } = useQuery({
    ...venuesQueryOptions(webApiClient),
    enabled: canManageCoaching,
    staleTime: 60_000,
  });

  const appointmentFilters = useMemo(
    () => ({
      limit: 100,
      page: 1,
      startDate: toYmd(weekDays[0] ?? weekStart),
      endDate: toYmd(weekDays[weekDays.length - 1] ?? weekStart),
      ...(coachFilterId ? { coachId: coachFilterId } : {}),
      ...(appointmentStatusFilter !== "all" &&
      appointmentStatusFilter !== "pending_full_payment"
        ? { status: appointmentStatusFilter }
        : {}),
    }),
    [appointmentStatusFilter, coachFilterId, weekDays, weekStart],
  );

  const rosterAppointmentFilters = useMemo(
    () => ({
      limit: 100,
      page: 1,
      startDate: toYmd(weekDays[0] ?? weekStart),
      endDate: toYmd(weekDays[weekDays.length - 1] ?? weekStart),
    }),
    [weekDays, weekStart],
  );

  const {
    data: appointmentResult = EMPTY_APPOINTMENT_RESULT,
    isLoading: appointmentsLoading,
  } = useQuery({
    ...staffAppointmentsQueryOptions<StaffAppointmentRecord>(
      webApiClient,
      appointmentFilters,
    ),
    enabled: canManageCoaching,
    staleTime: 30_000,
  });
  const { data: rosterAppointmentResult = EMPTY_APPOINTMENT_RESULT } = useQuery(
    {
      ...staffAppointmentsQueryOptions<StaffAppointmentRecord>(
        webApiClient,
        rosterAppointmentFilters,
      ),
      enabled: canManageCoaching,
      staleTime: 30_000,
    },
  );

  const replaceAvailabilityMutation = useMutation(
    replaceStaffCoachAvailabilityMutationOptions(webApiClient, queryClient),
  );
  const respondAppointmentMutation = useMutation(
    respondToStaffAppointmentMutationOptions(webApiClient, queryClient),
  );
  const completeAppointmentMutation = useMutation(
    completeStaffAppointmentMutationOptions(webApiClient, queryClient),
  );
  const cancelAppointmentMutation = useMutation(
    cancelStaffAppointmentMutationOptions(webApiClient, queryClient),
  );
  const updateCoachProfileMutation = useMutation(
    updateStaffCoachProfileMutationOptions(webApiClient, queryClient),
  );
  const createVenueBookingMutation = useMutation(
    createStaffBookingMutationOptions(webApiClient, queryClient),
  );
  const createCoachBookingMutation = useMutation(
    createStaffAppointmentMutationOptions(webApiClient, queryClient),
  );
  const createCoachMutation = useMutation(
    createStaffCoachMutationOptions(webApiClient, queryClient),
  );
  const previewRecurringPlanMutation = useMutation(
    previewRecurringCoachingPlanMutationOptions(webApiClient),
  );
  const createRecurringPlanMutation = useMutation(
    createRecurringCoachingPlanMutationOptions(webApiClient, queryClient),
  );
  const updateRecurringSessionMutation = useMutation(
    updateRecurringCoachingSessionMutationOptions(webApiClient, queryClient),
  );
  const bulkUpdateRecurringSessionsMutation = useMutation(
    bulkUpdateRecurringCoachingSessionsMutationOptions(
      webApiClient,
      queryClient,
    ),
  );
  const cancelRecurringPlanMutation = useMutation(
    cancelRecurringCoachingPlanMutationOptions(webApiClient, queryClient),
  );
  const processAppointmentBalanceMutation = useMutation(
    processAppointmentBalanceMutationOptions(webApiClient, queryClient),
  );
  const processBookingBalanceMutation = useMutation(
    processBookingBalanceMutationOptions(webApiClient, queryClient),
  );
  const payRecurringCycleMutation = useMutation(
    payRecurringCoachingBillingCycleMutationOptions(webApiClient, queryClient),
  );
  const payAppointmentInitialMutation = useMutation(
    payAppointmentDownpaymentMutationOptions(webApiClient, queryClient),
  );
  const verifyPaymentMutation = useMutation(
    verifyMembershipPaymentMutationOptions(webApiClient, queryClient),
  );

  const coachRoster = useMemo(
    () => mapCoachesToRoster(coachProfiles),
    [coachProfiles],
  );

  const coachOptions = useMemo(
    () =>
      coachRoster
        .filter((coach) => coach.isActive)
        .map((coach) => ({
          hourlyRate: coach.hourlyRate ?? 0,
          label: coach.name,
          value: coach.id,
        })),
    [coachRoster],
  );
  const memberOptions = useMemo(
    () =>
      (staffUsers as MemberRecord[])
        .filter((member) => {
          const roleName = member.role?.name?.toUpperCase();
          const status = (
            member as MemberRecord & { status?: string | null }
          ).status?.toLowerCase();
          const isActive = !status || status === "active";
          return (
            (roleName === "USER" || roleName === "MEMBER") &&
            isActive &&
            !member.deletedAt
          );
        })
        .map((member) => {
          const label = getPersonDisplayName(
            member.profile,
            member.email,
            "Member",
          );
          return { label, value: member.id };
        }),
    [staffUsers],
  );
  const coachAppointments = useMemo(
    () =>
      appointmentStatusFilter === "pending_full_payment"
        ? appointmentResult.data.filter(isPendingFullCoachPayment)
        : appointmentResult.data,
    [appointmentResult.data, appointmentStatusFilter],
  );
  const activeRecurringPlanId =
    recurringPlanAction?.appointment.recurringPlanId ??
    appointmentReviewTarget?.recurringPlanId ??
    null;
  const { data: recurringPlanSessions } = useQuery({
    ...recurringCoachingPlanSessionsQueryOptions(
      webApiClient,
      activeRecurringPlanId ?? "pending",
    ),
    enabled: Boolean(activeRecurringPlanId),
    staleTime: 20_000,
  });
  const recurringSessionRows = recurringPlanSessions?.sessions ?? [];
  const recurringCompletedCount = recurringSessionRows.filter(
    (session) =>
      session.status === "completed" || session.recurringState === "completed",
  ).length;
  const recurringRemainingCount = recurringSessionRows.filter(
    (session) =>
      session.status !== "completed" &&
      session.status !== "cancelled" &&
      session.recurringState !== "completed" &&
      session.recurringState !== "cancelled" &&
      session.recurringState !== "skipped",
  ).length;
  const recurringCreateBusy =
    previewRecurringPlanMutation.isPending ||
    createRecurringPlanMutation.isPending;
  const recurringActionBusy =
    updateRecurringSessionMutation.isPending ||
    bulkUpdateRecurringSessionsMutation.isPending ||
    cancelRecurringPlanMutation.isPending;
  const paymentConfirmLoading =
    payAppointmentInitialMutation.isPending ||
    processAppointmentBalanceMutation.isPending ||
    payRecurringCycleMutation.isPending ||
    processBookingBalanceMutation.isPending ||
    verifyPaymentMutation.isPending;
  const recurringPlanInputInvalid =
    !recurringPlanForm.memberId ||
    !recurringPlanForm.coachId ||
    !recurringPlanForm.startDate ||
    !recurringPlanForm.preferredTime ||
    recurringPlanForm.preferredDays.length === 0;
  const recurringPreviewConflictOverrides = useMemo(
    () =>
      recurringPlanPreview?.sessions
        .filter((session) => session.conflict)
        .map((session) => ({
          action: "skip" as const,
          reason: "Skipped during recurring plan conflict review.",
          scheduledAt: session.scheduledAt,
        })) ?? [],
    [recurringPlanPreview],
  );
  const recurringFormFieldStyle = useMemo(
    () => ({
      width: "100%",
      minHeight: 42,
      borderRadius: 13,
      border: `1px solid ${colors.border}`,
      backgroundColor: colors.surfaceRaised,
      color: colors.textPrimary,
      padding: "9px 11px",
      fontSize: 13,
      fontWeight: 650,
      outline: "none",
    }),
    [colors.border, colors.surfaceRaised, colors.textPrimary],
  );

  const appointmentBookings = useMemo<Booking[]>(
    () =>
      coachAppointments.map((appointment) =>
        mapAppointmentToTimelineBooking(appointment, colors),
      ),
    [coachAppointments, colors],
  );

  const rosterAppointmentBookings = useMemo<Booking[]>(
    () =>
      rosterAppointmentResult.data.map((appointment) =>
        mapAppointmentToTimelineBooking(appointment, colors),
      ),
    [colors, rosterAppointmentResult.data],
  );

  const allBookings = useMemo(
    () =>
      [...appointmentBookings, ...manualBookings].map((booking) => {
        const override = bookingOverrides[booking.id];
        return override ? { ...booking, ...override } : booking;
      }),
    [appointmentBookings, bookingOverrides, manualBookings],
  );

  const rosterBookings = useMemo(
    () =>
      [...rosterAppointmentBookings, ...manualBookings].map((booking) => {
        const override = bookingOverrides[booking.id];
        return override ? { ...booking, ...override } : booking;
      }),
    [bookingOverrides, manualBookings, rosterAppointmentBookings],
  );

  const filteredStaff = useMemo(
    () =>
      coachRoster.filter((coach) => {
        if (coachVisibilityScope === "visible" && !coach.isActive) {
          return false;
        }
        if (coachVisibilityScope === "hidden" && coach.isActive) {
          return false;
        }
        return coach.name.toLowerCase().includes(debouncedQuery.toLowerCase());
      }),
    [coachRoster, coachVisibilityScope, debouncedQuery],
  );

  const defaultCoachId = coachRoster[0]?.id ?? null;
  const focusedCoachId = coachFilterId ?? defaultCoachId;
  const selectedCoachProfile = useMemo(
    () => coachProfiles.find((coach) => coach.id === focusedCoachId) ?? null,
    [coachProfiles, focusedCoachId],
  );
  const selectedCoachRoster = useMemo(
    () => coachRoster.find((coach) => coach.id === focusedCoachId) ?? null,
    [coachRoster, focusedCoachId],
  );
  const focusedCoachScheduleBookings = useMemo(
    () =>
      allBookings.filter((booking) =>
        focusedCoachId ? booking.resourceId === focusedCoachId : true,
      ),
    [allBookings, focusedCoachId],
  );
  const availabilityEditorCoach = useMemo(
    () =>
      coachProfiles.find((coach) => coach.id === availabilityEditorCoachId) ??
      null,
    [availabilityEditorCoachId, coachProfiles],
  );
  const profileEditorCoach = useMemo(
    () =>
      coachProfiles.find((coach) => coach.id === profileEditorCoachId) ?? null,
    [coachProfiles, profileEditorCoachId],
  );
  const reviewCoachProfile = useMemo(
    () =>
      appointmentReviewTarget
        ? (coachProfiles.find(
            (coach) => coach.id === appointmentReviewTarget.coachId,
          ) ?? null)
        : null,
    [appointmentReviewTarget, coachProfiles],
  );
  const appointmentReviewReadiness = useMemo(
    () => ({
      isVisible: reviewCoachProfile?.isActive ?? true,
      openPeakSlots: Math.max(
        0,
        (reviewCoachProfile?.availability?.length ?? 0) -
          coachAppointments.filter(
            (appointment) =>
              appointment.coachId === appointmentReviewTarget?.coachId &&
              (appointment.status === "confirmed" ||
                appointment.status === "pending_coach"),
          ).length,
      ),
      trustLabel:
        (reviewCoachProfile?.certifications?.length ?? 0) > 0
          ? "clear"
          : "review",
    }),
    [appointmentReviewTarget?.coachId, coachAppointments, reviewCoachProfile],
  );

  const appointmentSummary = useMemo(
    () => ({
      visible: coachAppointments.length,
      pendingCoach: coachAppointments.filter(
        (appointment) => appointment.status === "pending_coach",
      ).length,
      confirmed: coachAppointments.filter(
        (appointment) => appointment.status === "confirmed",
      ).length,
      completed: coachAppointments.filter(
        (appointment) => appointment.status === "completed",
      ).length,
    }),
    [coachAppointments],
  );

  useEffect(() => {
    setRecurringPlanForm((current) => ({
      ...current,
      coachId: coachOptions.some((coach) => coach.value === current.coachId)
        ? current.coachId
        : coachOptions[0]?.value || "",
      memberId: current.memberId || memberOptions[0]?.value || "",
    }));
  }, [coachOptions, memberOptions]);

  useEffect(() => {
    if (!recurringPlanAction) return;
    const start = new Date(recurringPlanAction.appointment.scheduledAt);
    setRecurringActionDate(toYmd(start));
    setRecurringActionTime(
      `${String(start.getHours()).padStart(2, "0")}:${String(
        start.getMinutes(),
      ).padStart(2, "0")}`,
    );
    setRecurringActionCoachId(
      coachOptions.some(
        (coach) => coach.value === recurringPlanAction.appointment.coachId,
      )
        ? recurringPlanAction.appointment.coachId
        : coachOptions[0]?.value || "",
    );
    setRecurringActionDays([start.getDay()]);
    setRecurringActionReason("");
  }, [coachOptions, recurringPlanAction]);

  const sensors = useFitSensors();

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current as
      | { kind?: "coach"; coachId?: string }
      | { kind?: "booking"; bookingId?: string }
      | undefined;

    if (activeData?.kind === "coach" && activeData.coachId) {
      const coach = coachRoster.find(
        (resource) => resource.id === activeData.coachId,
      );
      if (coach) setDraggingCoach(coach);
      return;
    }

    if (activeData?.kind === "booking" && activeData.bookingId) {
      const booking = allBookings.find(
        (item) => item.id === activeData.bookingId,
      );
      if (booking) setDraggingBooking(booking);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingCoach(null);
    setDraggingBooking(null);
    if (!event.over || !canManageCoaching) return;
    const [dayIndexValue, hourValue] = String(event.over.id).split(":");
    const dayIndex = Number(dayIndexValue);
    const hour = Number(hourValue);
    const activeData = event.active.data.current as
      | { kind?: "coach"; coachId?: string }
      | { kind?: "booking"; bookingId?: string }
      | undefined;
    if (Number.isNaN(dayIndex) || Number.isNaN(hour)) return;

    if (activeData?.kind === "coach" && activeData.coachId) {
      const coach = coachRoster.find(
        (resource) => resource.id === activeData.coachId,
      );
      if (!coach) return;
      const booking = buildManualBooking(
        coach,
        weekDays[dayIndex],
        hour,
        colors.brand,
      );
      setManualBookings((previous) => [...previous, booking]);
      showFeedback(
        `${coach.name} assigned to ${weekDays[dayIndex].toLocaleDateString(
          "en-US",
          {
            weekday: "short",
          },
        )} ${hour}:00`,
      );
      return;
    }

    if (activeData?.kind === "booking" && activeData.bookingId) {
      const booking = allBookings.find(
        (item) => item.id === activeData.bookingId,
      );
      if (!booking) return;
      const nextDate = toYmd(weekDays[dayIndex]);
      if (booking.date === nextDate && booking.startHour === hour) return;
      setBookingOverrides((previous) => ({
        ...previous,
        [booking.id]: {
          date: nextDate,
          startHour: hour,
          startMinute: 0,
        },
      }));
      showFeedback(
        `${booking.resourceName} moved to ${weekDays[
          dayIndex
        ].toLocaleDateString("en-US", {
          weekday: "short",
        })} ${hour}:00`,
      );
    }
  };

  const [activeCoachId, setActiveCoachId] = useState<string | null>(null);
  const [coachDetailsOpen, setCoachDetailsOpen] = useState(false);

  const handleStaffClick = (coachId: string) => {
    setActiveCoachId(coachId);
    setCoachFilterId(coachId);
    setCoachDetailsOpen(true);
  };

  const handleCoachFocus = (coachId: string) => {
    setCoachFilterId(coachId);
    setActiveCoachId(null);
    setCoachDetailsOpen(false);
  };

  const [activeBlock, setActiveBlock] = useState<Booking | null>(null);
  const [blockDetailOpen, setBlockDetailOpen] = useState(false);

  const handleBlockClick = (block: Booking) => {
    if (block.source === "api") {
      const appointment = coachAppointments.find(
        (record) => record.id === block.id,
      );
      if (appointment) {
        setAppointmentReviewTarget(appointment);
        return;
      }
    }
    setActiveBlock(block);
    setBlockDetailOpen(true);
  };

  const handleBlockSave = (updated: Booking) => {
    setManualBookings((previous) =>
      previous.map((booking) =>
        booking.id === updated.id ? updated : booking,
      ),
    );
    setBlockDetailOpen(false);
    setActiveBlock(null);
  };

  const handleBlockDelete = (id: string) => {
    setManualBookings((previous) =>
      previous.filter((booking) => booking.id !== id),
    );
    setBlockDetailOpen(false);
    setActiveBlock(null);
  };

  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const [leftMaxHeight, setLeftMaxHeight] = useState<number | null>(null);
  const [rightMaxHeight, setRightMaxHeight] = useState<number | null>(null);
  const scheduleRosterMaxHeight = useMemo(
    () => (leftMaxHeight ? Math.min(leftMaxHeight, 458) : 458),
    [leftMaxHeight],
  );
  const scheduleTimelineMaxHeight = useMemo(
    () => (rightMaxHeight ? Math.min(rightMaxHeight, 548) : 548),
    [rightMaxHeight],
  );
  const coachRosterMaxHeight = useMemo(
    () => (leftMaxHeight ? Math.min(leftMaxHeight, 388) : 388),
    [leftMaxHeight],
  );
  const canAnimate = settings.animationLevel !== "none";
  const fullMotion = settings.animationLevel === "full";
  const controlLabelStyle = useMemo(
    () => ({
      fontSize: 10,
      fontWeight: 650,
      color: colors.textMuted,
      letterSpacing: 0,
      lineHeight: 1.15,
    }),
    [colors.textMuted],
  );

  useEffect(() => {
    if (!coachFilterId) return;
    if (coachRoster.some((coach) => coach.id === coachFilterId)) return;
    setCoachFilterId(null);
  }, [coachFilterId, coachRoster]);

  useEffect(() => {
    const recalc = () => {
      const logoutButton = document.querySelector(
        'button[aria-label="SIGN OUT"]',
      ) as HTMLElement | null;
      if (!logoutButton) return;
      const bottom = logoutButton.getBoundingClientRect().bottom;
      if (leftScrollRef.current) {
        setLeftMaxHeight(
          Math.max(
            240,
            Math.floor(
              bottom - leftScrollRef.current.getBoundingClientRect().top,
            ),
          ),
        );
      }
      if (rightScrollRef.current) {
        setRightMaxHeight(
          Math.max(
            240,
            Math.floor(
              bottom - rightScrollRef.current.getBoundingClientRect().top,
            ),
          ),
        );
      }
    };

    recalc();
    const resizeObserver = new ResizeObserver(recalc);
    if (leftScrollRef.current) resizeObserver.observe(leftScrollRef.current);
    if (rightScrollRef.current) resizeObserver.observe(rightScrollRef.current);
    window.addEventListener("resize", recalc);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, []);

  const activeCoach = coachRoster.find((coach) => coach.id === activeCoachId);

  const staffColumns: FitTableColumn<VenueBookingRecord>[] = [
    {
      key: "member",
      heading: "MEMBER",
      render: (booking, palette) => {
        const firstName = booking.user?.profile?.firstName?.trim() ?? "";
        const lastName = booking.user?.profile?.lastName?.trim() ?? "";
        const label =
          `${firstName} ${lastName}`.trim() || booking.user?.email || "Member";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FitText
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: palette.textPrimary,
              }}
            >
              {label}
            </FitText>
            <FitText style={{ fontSize: 12, color: palette.textMuted }}>
              {booking.user?.email ?? "-"}
            </FitText>
          </div>
        );
      },
    },
    {
      key: "venue",
      heading: "VENUE",
      render: (booking, palette) => (
        <FitText style={{ fontSize: 14, color: palette.textPrimary }}>
          {booking.venue?.name ?? `Venue ${booking.venueId}`}
        </FitText>
      ),
    },
    {
      key: "time",
      heading: "SCHEDULE",
      render: (booking, palette) => (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <FitText style={{ fontSize: 14, color: palette.textPrimary }}>
            {new Date(booking.startTime).toLocaleDateString()}
          </FitText>
          <FitText style={{ fontSize: 12, color: palette.textMuted }}>
            {new Date(booking.startTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            -{" "}
            {new Date(booking.endTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </FitText>
        </div>
      ),
    },
    {
      key: "coach",
      heading: "COACH",
      render: (booking, palette) => {
        if (!booking.coach) {
          return (
            <FitText style={{ fontSize: 13, color: palette.textMuted }}>
              Venue only
            </FitText>
          );
        }

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FitText
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: palette.textPrimary,
              }}
            >
              {getCoachDisplayName(booking.coach, "Coach")}
            </FitText>
            <FitText style={{ fontSize: 12, color: palette.textMuted }}>
              {booking.coach.hourlyRate != null
                ? `PHP ${booking.coach.hourlyRate.toLocaleString("en-PH")}/hr`
                : "Rate not set"}
            </FitText>
          </div>
        );
      },
    },
    {
      key: "status",
      heading: "STATUS",
      render: (booking, palette) => (
        <FitPill
          mode="status"
          label={booking.status.toUpperCase()}
          color={
            booking.status === "pending"
              ? palette.warning
              : booking.status === "confirmed"
                ? palette.success
                : booking.status === "completed"
                  ? palette.textMuted
                  : palette.danger
          }
          fontSize={13}
        />
      ),
    },
    {
      key: "purpose",
      heading: "PURPOSE",
      render: (booking, palette) => (
        <FitText style={{ fontSize: 13, color: palette.textMuted }}>
          {booking.purpose ?? "-"}
        </FitText>
      ),
    },
  ];

  const pendingBookings = useMemo(
    () => rawBookings.filter((booking) => booking.status === "pending"),
    [rawBookings],
  );

  const venueOptions = useMemo(
    () =>
      Array.from(
        new Map([
          ...venues
            .filter(
              (venue) =>
                venue.isActive !== false && venue.isReservable !== false,
            )
            .map(
              (venue) =>
                [
                  String(venue.id),
                  {
                    label: venue.name,
                    value: String(venue.id),
                    hourlyRate: venue.hourlyRate ?? 0,
                  },
                ] as const,
            ),
          ...rawBookings.map(
            (booking) =>
              [
                String(booking.venueId),
                {
                  label: booking.venue?.name ?? `Venue ${booking.venueId}`,
                  value: String(booking.venueId),
                  hourlyRate: booking.venue?.hourlyRate ?? null,
                },
              ] as const,
          ),
        ]).values(),
      ),
    [rawBookings, venues],
  );

  const bookableVenueOptions = useMemo(
    () =>
      venues
        .filter(
          (venue) =>
            venue.isActive !== false && venue.isReservable !== false,
        )
        .map((venue) => ({
          label: venue.name,
          value: String(venue.id),
          hourlyRate: venue.hourlyRate ?? 0,
        })),
    [venues],
  );

  const venueFilterOptions = useMemo(
    () => [{ label: "All venues", value: "all" }, ...venueOptions],
    [venueOptions],
  );
  const selectedVenueFilterLabel = useMemo(
    () =>
      venueFilterOptions.find((option) => option.value === venueFilterId)
        ?.label ?? "this venue",
    [venueFilterId, venueFilterOptions],
  );

  const filteredVenueBookings = useMemo(
    () =>
      rawBookings.filter((booking) => {
        if (
          venueFilterId !== "all" &&
          String(booking.venueId) !== venueFilterId
        ) {
          return false;
        }
        if (
          venueStatusFilter !== "all" &&
          booking.status !== venueStatusFilter
        ) {
          return false;
        }
        return true;
      }),
    [rawBookings, venueFilterId, venueStatusFilter],
  );

  const venueBookingSummary = useMemo(
    () => ({
      visible: filteredVenueBookings.length,
      pending: filteredVenueBookings.filter(
        (booking) => booking.status === "pending",
      ).length,
      confirmed: filteredVenueBookings.filter(
        (booking) => booking.status === "confirmed",
      ).length,
      activeVenues: new Set(
        filteredVenueBookings.map((booking) => booking.venueId),
      ).size,
    }),
    [filteredVenueBookings],
  );

  useEffect(() => {
    const requestedTab = normalizeOperationsTab(
      searchParams.get("tab"),
      canManageCoaching,
    );
    const requestedScheduleSurface = normalizeScheduleSurfaceTab(
      searchParams.get("schedule_view"),
    );

    setActiveOperationsTab((currentTab) =>
      currentTab === requestedTab ? currentTab : requestedTab,
    );
    setActiveScheduleSurfaceTab((currentTab) =>
      currentTab === requestedScheduleSurface
        ? currentTab
        : requestedScheduleSurface,
    );
  }, [canManageCoaching, searchParams]);

  useEffect(() => {
    const currentQueryTab = searchParams.get("tab");
    const normalizedTab = normalizeOperationsTab(
      currentQueryTab,
      canManageCoaching,
    );

    if (activeOperationsTab === normalizedTab) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    if (activeOperationsTab === "schedule") {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", activeOperationsTab);
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [activeOperationsTab, canManageCoaching, pathname, router, searchParams]);

  useEffect(() => {
    const currentSurfaceParam = searchParams.get("schedule_view");
    const normalizedSurfaceParam =
      normalizeScheduleSurfaceTab(currentSurfaceParam);

    if (activeScheduleSurfaceTab === normalizedSurfaceParam) return;

    const nextParams = new URLSearchParams(searchParams.toString());
    if (activeScheduleSurfaceTab === "coach-schedule") {
      nextParams.delete("schedule_view");
    } else {
      nextParams.set("schedule_view", "venues");
    }

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [activeScheduleSurfaceTab, pathname, router, searchParams]);

  const toggleRecurringPlanDay = (day: number) => {
    setRecurringPlanPreview(null);
    setRecurringPlanForm((current) => {
      const exists = current.preferredDays.includes(day);
      const preferredDays = exists
        ? current.preferredDays.filter((value) => value !== day)
        : [...current.preferredDays, day].sort((left, right) => left - right);

      return {
        ...current,
        preferredDays: preferredDays.length > 0 ? preferredDays : [day],
      };
    });
  };

  const toggleRecurringActionDay = (day: number) => {
    setRecurringActionDays((current) => {
      const exists = current.includes(day);
      const next = exists
        ? current.filter((value) => value !== day)
        : [...current, day].sort((left, right) => left - right);
      return next.length > 0 ? next : [day];
    });
  };

  const handlePreviewRecurringPlan = async () => {
    if (recurringPlanInputInvalid) {
      showFeedback(
        "Choose a member, coach, start date, time, and at least one weekday.",
        "danger",
      );
      return;
    }

    try {
      const preview = await previewRecurringPlanMutation.mutateAsync(
        getRecurringInput(recurringPlanForm),
      );
      setRecurringPlanPreview(preview);
      showFeedback(
        preview.conflictCount > 0
          ? `${preview.conflictCount} generated session conflict(s) need review.`
          : `${preview.totalSessions} recurring sessions are clear to confirm.`,
        preview.conflictCount > 0 ? "danger" : "success",
      );
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to preview recurring coaching plan."),
        "danger",
      );
    }
  };

  const handleConfirmRecurringPlan = async (skipConflicts = false) => {
    if (recurringPlanInputInvalid) {
      showFeedback(
        "Complete the recurring plan details before confirming.",
        "danger",
      );
      return;
    }
    if (!recurringPlanPreview) {
      showFeedback(
        "Preview the schedule before confirming the plan.",
        "danger",
      );
      return;
    }
    if (recurringPlanPreview.conflictCount > 0 && !skipConflicts) {
      showFeedback(
        "Resolve conflicts first, or confirm while skipping conflicted sessions.",
        "danger",
      );
      return;
    }

    try {
      const result = await createRecurringPlanMutation.mutateAsync(
        getRecurringInput(
          recurringPlanForm,
          skipConflicts ? recurringPreviewConflictOverrides : undefined,
        ),
      );
      showFeedback(
        `Recurring coaching plan created with ${result.sessions.length} session(s).`,
      );
      setRecurringPlanOpen(false);
      setRecurringPlanPreview(null);
      setRecurringPlanForm(createDefaultRecurringPlanForm());
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to create recurring coaching plan."),
        "danger",
      );
    }
  };

  const handleRecurringSessionReschedule = async () => {
    const appointment = recurringPlanAction?.appointment;
    const planId = appointment?.recurringPlanId;
    if (!appointment || !planId) return;

    try {
      await updateRecurringSessionMutation.mutateAsync({
        input: {
          action: "reschedule",
          coachId: recurringActionCoachId || appointment.coachId,
          newScheduledAt: buildLocalIso(
            recurringActionDate,
            recurringActionTime,
          ),
          reason: recurringActionReason || undefined,
        },
        planId,
        sessionId: appointment.id,
      });
      showFeedback("Recurring session updated.");
      setRecurringPlanAction(null);
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to reschedule recurring session."),
        "danger",
      );
    }
  };

  const handleRecurringSessionSkip = async () => {
    const appointment = recurringPlanAction?.appointment;
    const planId = appointment?.recurringPlanId;
    if (!appointment || !planId) return;

    try {
      await updateRecurringSessionMutation.mutateAsync({
        input: {
          action: "skip",
          reason: recurringActionReason || "Skipped from Gym Operations.",
        },
        planId,
        sessionId: appointment.id,
      });
      showFeedback("Recurring session skipped.");
      setRecurringPlanAction(null);
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to skip recurring session."),
        "danger",
      );
    }
  };

  const handleRecurringFutureUpdate = async () => {
    const appointment = recurringPlanAction?.appointment;
    const planId = appointment?.recurringPlanId;
    if (!appointment || !planId) return;

    try {
      const result = await bulkUpdateRecurringSessionsMutation.mutateAsync({
        input: {
          coachId: recurringActionCoachId || appointment.coachId,
          fromSessionId: appointment.id,
          preferredDays: recurringActionDays,
          preferredTime: recurringActionTime,
        },
        planId,
      });

      if ("canConfirm" in result && result.conflictCount > 0) {
        showFeedback(
          `${result.conflictCount} future recurring session conflict(s) need manual review.`,
          "danger",
        );
        return;
      }

      showFeedback("Future recurring sessions updated.");
      setRecurringPlanAction(null);
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to update future recurring sessions."),
        "danger",
      );
    }
  };

  const handleRecurringPlanCancel = async () => {
    const appointment = recurringPlanAction?.appointment;
    const planId = appointment?.recurringPlanId;
    if (!appointment || !planId) return;

    try {
      await cancelRecurringPlanMutation.mutateAsync({
        planId,
        reason: recurringActionReason || undefined,
      });
      showFeedback("Recurring coaching plan cancelled.");
      setRecurringPlanAction(null);
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to cancel recurring coaching plan."),
        "danger",
      );
    }
  };

  const handleConfirmAppointment = async () => {
    if (!appointmentReviewTarget) return;

    try {
      await respondAppointmentMutation.mutateAsync({
        accepted: true,
        appointmentId: appointmentReviewTarget.id,
        coachId: appointmentReviewTarget.coachId,
      });
      showFeedback("Coach appointment confirmed.");
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to confirm coach appointment."),
        "danger",
      );
    }
  };

  const handleRejectAppointment = async (
    appointment: StaffAppointmentRecord,
    value: string,
  ) => {
    try {
      await respondAppointmentMutation.mutateAsync({
        accepted: false,
        appointmentId: appointment.id,
        coachId: appointment.coachId,
        reason: value,
      });
      showFeedback("Coach appointment rejected.");
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to reject coach appointment."),
        "danger",
      );
    }
  };

  const handleCancelAppointment = async (
    appointment: StaffAppointmentRecord,
    value: string,
  ) => {
    try {
      await cancelAppointmentMutation.mutateAsync({
        appointmentId: appointment.id,
        coachId: appointment.coachId,
        reason: value,
      });
      showFeedback("Coach appointment cancelled.");
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to cancel coach appointment."),
        "danger",
      );
    }
  };

  const handleCompleteAppointment = async (
    appointment: StaffAppointmentRecord,
    value: string,
  ) => {
    try {
      await completeAppointmentMutation.mutateAsync({
        appointmentId: appointment.id,
        coachId: appointment.coachId,
        sessionNotes: value || undefined,
      });
      showFeedback("Coach appointment marked complete.");
      setAppointmentReviewTarget(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to complete coach appointment."),
        "danger",
      );
    }
  };

  const executeCollectAppointmentInitialPayment = async (
    appointment: StaffAppointmentRecord,
    provider: PaymentCollectionProvider,
    paymentStage: "downpayment" | "full",
  ) => {
    try {
      const result = await payAppointmentInitialMutation.mutateAsync({
        appointmentId: appointment.id,
        paymentStage,
        provider,
        userId: appointment.userId,
      });

      if (provider === "cash" && result.paymentId) {
        await verifyPaymentMutation.mutateAsync({
          affectedUserId: appointment.userId,
          paymentId: result.paymentId,
          payload: { action: "approve" },
        });
        showFeedback(
          paymentStage === "full"
            ? "Coach full cash payment accepted."
            : "Coach cash downpayment accepted.",
        );
        setAppointmentReviewTarget(null);
        return;
      }

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        showFeedback("PayMongo coach checkout opened.");
        return;
      }

      showFeedback("Coach payment request updated.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to collect coach payment."),
        "danger",
      );
    }
  };

  const requestCollectAppointmentInitialPayment = (
    appointment: StaffAppointmentRecord,
    provider: PaymentCollectionProvider,
    paymentStage: "downpayment" | "full",
  ) => {
    const stageLabel =
      paymentStage === "full" ? "full payment" : "downpayment";
    const providerLabel = provider === "cash" ? "cash" : "PayMongo";
    setPaymentConfirm({
      kind: "coachInitial",
      appointment,
      provider,
      paymentStage,
      title: "Confirm coach payment",
      message: `Continue with ${providerLabel} ${stageLabel} for this coach appointment?`,
      confirmLabel:
        provider === "cash"
          ? paymentStage === "full"
            ? "ACCEPT CASH FULL"
            : "ACCEPT CASH DOWNPAYMENT"
          : "OPEN PAYMONGO",
    });
  };

  const executeCollectAppointmentBalance = async (
    appointment: StaffAppointmentRecord,
    provider: PaymentCollectionProvider,
  ) => {
    try {
      const result = await processAppointmentBalanceMutation.mutateAsync({
        appointmentId: appointment.id,
        provider,
        referenceNo:
          provider === "cash" ? `COACH-BAL-${Date.now()}` : undefined,
        userId: appointment.userId,
      });

      if (provider === "cash" && result.paymentId) {
        await verifyPaymentMutation.mutateAsync({
          affectedUserId: appointment.userId,
          paymentId: result.paymentId,
          payload: { action: "approve" },
        });
        showFeedback("Coach appointment balance accepted.");
        setAppointmentReviewTarget(null);
        return;
      }

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        showFeedback("PayMongo balance checkout opened.");
        return;
      }

      showFeedback("Coach appointment balance request updated.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to collect coach balance."),
        "danger",
      );
    }
  };

  const requestCollectAppointmentBalance = (
    appointment: StaffAppointmentRecord,
    provider: PaymentCollectionProvider,
  ) => {
    const label =
      provider === "cash"
        ? "accept this cash balance"
        : "open PayMongo balance checkout";
    setPaymentConfirm({
      kind: "coachBalance",
      appointment,
      provider,
      title: "Confirm coach balance",
      message: `Continue and ${label}?`,
      confirmLabel:
        provider === "cash" ? "ACCEPT CASH BALANCE" : "OPEN PAYMONGO",
    });
  };

  const executeRecurringCyclePayment = async (
    cycle: RecurringCoachingBillingCycleRecord,
    provider: PaymentCollectionProvider,
  ) => {
    const planId = cycle.recurringPlanId;
    if (!planId) return;

    if (
      cycle.status === "awaiting_verification" &&
      cycle.paymentId &&
      provider === "cash"
    ) {
      try {
        await verifyPaymentMutation.mutateAsync({
          affectedUserId: appointmentReviewTarget?.userId,
          paymentId: cycle.paymentId,
          payload: { action: "approve" },
        });
        showFeedback("Recurring coach payment approved.");
      } catch (error) {
        showFeedback(
          getErrorMessage(error, "Unable to approve recurring coach payment."),
          "danger",
        );
      }
      return;
    }

    try {
      const result = await payRecurringCycleMutation.mutateAsync({
        cycleId: cycle.id,
        input: {
          provider,
          referenceNo:
            provider === "cash" ? `RECUR-COACH-${Date.now()}` : undefined,
        },
        planId,
      });

      if (provider === "cash") {
        await verifyPaymentMutation.mutateAsync({
          affectedUserId: appointmentReviewTarget?.userId,
          paymentId: result.paymentId,
          payload: { action: "approve" },
        });
        showFeedback("Recurring coach cash payment accepted.");
        return;
      }

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        showFeedback("PayMongo recurring coach checkout opened.");
        return;
      }

      showFeedback("Recurring coach payment request updated.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to process recurring coach payment."),
        "danger",
      );
    }
  };

  const requestRecurringCyclePayment = (
    cycle: RecurringCoachingBillingCycleRecord,
    provider: PaymentCollectionProvider,
  ) => {
    if (
      cycle.status === "awaiting_verification" &&
      cycle.paymentId &&
      provider === "cash"
    ) {
      setPaymentConfirm({
        kind: "recurringCycle",
        cycle,
        provider,
        title: "Approve recurring cash payment",
        message: "Approve this recurring coach cash payment now?",
        confirmLabel: "APPROVE CASH PAYMENT",
      });
      return;
    }

    const label =
      provider === "cash"
        ? "accept this recurring coach cash payment"
        : "open PayMongo for this recurring coach cycle";
    setPaymentConfirm({
      kind: "recurringCycle",
      cycle,
      provider,
      title: "Confirm recurring coach payment",
      message: `Continue and ${label}?`,
      confirmLabel:
        provider === "cash" ? "ACCEPT CASH CYCLE" : "OPEN PAYMONGO",
    });
  };

  const handleSaveAvailability = async (
    slots: Array<{ dayOfWeek: number; endTime: string; startTime: string }>,
  ) => {
    if (!availabilityEditorCoachId) return;

    try {
      await replaceAvailabilityMutation.mutateAsync({
        coachId: availabilityEditorCoachId,
        payload: { slots },
      });
      showFeedback("Coach availability updated.");
      setAvailabilityEditorCoachId(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to update coach availability."),
        "danger",
      );
    }
  };

  const handleSaveCoachProfile = async (data: Record<string, string>) => {
    if (!profileEditorCoach) return;

    const parsed = coachProfileSchema.safeParse({
      bio: data.bio ?? "",
      specialties: data.specialties ?? "",
      certifications: data.certifications ?? "",
      yearsExperience: "",
      hourlyRate: data.hourlyRate ?? "",
    });

    if (!parsed.success) {
      showFeedback(
        parsed.error.issues[0]?.message ?? "Invalid coach profile details.",
        "danger",
      );
      return;
    }

    const displayName = data.displayName?.trim() ?? "";
    if (!displayName) {
      showFeedback("Coach name is required.", "danger");
      return;
    }

    try {
      await updateCoachProfileMutation.mutateAsync({
        coachId: profileEditorCoach.id,
        payload: {
          bio: parsed.data.bio || undefined,
          specialties: parsed.data.specialties,
          certifications: parsed.data.certifications,
          contactEmail: data.contactEmail?.trim() || null,
          contactPhone: data.contactPhone?.trim() || null,
          displayName,
          hourlyRate: parsed.data.hourlyRate,
          isAvailableForBooking:
            (data.isAvailableForBooking ?? "active") === "active",
        },
      });
      showFeedback("Coach profile updated.");
      setProfileEditorCoachId(null);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to update coach profile."),
        "danger",
      );
    }
  };

  const handleSetCoachBookingVisibility = async (
    coachId: string,
    isVisibleForBooking: boolean,
  ) => {
    const coach = coachProfiles.find((item) => item.id === coachId);
    if (!coach) return;

    try {
      await updateCoachProfileMutation.mutateAsync({
        coachId: coach.id,
        payload: {
          bio: coach.bio ?? undefined,
          certifications: coach.certifications ?? [],
          hourlyRate: coach.hourlyRate ?? undefined,
          isAvailableForBooking: isVisibleForBooking,
          specialties: coach.specialties ?? [],
        },
      });
      showFeedback(
        isVisibleForBooking
          ? "Coach restored to booking visibility."
          : "Coach hidden from booking.",
      );
    } catch (error) {
      showFeedback(
        getErrorMessage(
          error,
          isVisibleForBooking
            ? "Unable to restore coach visibility."
            : "Unable to hide coach from booking.",
        ),
        "danger",
      );
    }
  };

  const handleApproveVenueBooking = async (note: string) => {
    if (!venueReviewTarget) return;

    const result = await confirmBooking(venueReviewTarget.id);
    if (!result.success) {
      showFeedback(
        result.error ?? "Unable to approve venue booking.",
        "danger",
      );
      return;
    }

    showFeedback(
      note
        ? "Venue booking approved and note captured."
        : "Venue booking approved.",
    );
    setVenueReviewTarget(null);
  };

  const executeCollectVenueBalance = async (
    booking: VenueBookingRecord,
    provider: PaymentCollectionProvider,
  ) => {
    try {
      const result = await processBookingBalanceMutation.mutateAsync({
        bookingId: booking.id,
        provider,
        referenceNo:
          provider === "cash" ? `VENUE-BAL-${Date.now()}` : undefined,
      });

      if (provider === "cash" && result.paymentId) {
        await verifyPaymentMutation.mutateAsync({
          affectedUserId: booking.userId,
          paymentId: result.paymentId,
          payload: { action: "approve" },
        });
        showFeedback("Venue booking balance accepted.");
        setVenueReviewTarget(null);
        return;
      }

      if (result.checkoutUrl) {
        window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
        showFeedback("PayMongo balance checkout opened.");
        return;
      }

      showFeedback("Venue booking balance request updated.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to collect venue balance."),
        "danger",
      );
    }
  };

  const requestCollectVenueBalance = (
    booking: VenueBookingRecord,
    provider: PaymentCollectionProvider,
  ) => {
    const label =
      provider === "cash"
        ? "accept this cash balance"
        : "open PayMongo balance checkout";
    setPaymentConfirm({
      kind: "venueBalance",
      booking,
      provider,
      title: "Confirm venue balance",
      message: `Continue and ${label}?`,
      confirmLabel:
        provider === "cash" ? "ACCEPT CASH BALANCE" : "OPEN PAYMONGO",
    });
  };

  const handleConfirmPaymentAction = async () => {
    if (!paymentConfirm) return;

    try {
      switch (paymentConfirm.kind) {
        case "coachInitial":
          await executeCollectAppointmentInitialPayment(
            paymentConfirm.appointment,
            paymentConfirm.provider,
            paymentConfirm.paymentStage,
          );
          break;
        case "coachBalance":
          await executeCollectAppointmentBalance(
            paymentConfirm.appointment,
            paymentConfirm.provider,
          );
          break;
        case "recurringCycle":
          await executeRecurringCyclePayment(
            paymentConfirm.cycle,
            paymentConfirm.provider,
          );
          break;
        case "venueBalance":
          await executeCollectVenueBalance(
            paymentConfirm.booking,
            paymentConfirm.provider,
          );
          break;
        default:
          break;
      }
    } finally {
      setPaymentConfirm(null);
    }
  };

  const handleRejectVenueBooking = async (note: string) => {
    if (!venueReviewTarget) return;

    const result = await rejectBooking(venueReviewTarget.id, note || undefined);
    if (!result.success) {
      showFeedback(result.error ?? "Unable to reject venue booking.", "danger");
      return;
    }

    showFeedback("Venue booking rejected.");
    setVenueReviewTarget(null);
  };

  const handleCompleteVenueBooking = async () => {
    if (!venueReviewTarget) return;

    const result = await completeBooking(venueReviewTarget.id);
    if (!result.success) {
      showFeedback(
        result.error ?? "Unable to mark venue booking complete.",
        "danger",
      );
      return;
    }

    showFeedback("Venue booking marked complete.");
    setVenueReviewTarget(null);
  };

  const handleCancelVenueBooking = async (note: string) => {
    if (!venueReviewTarget) return;

    const result = await cancelBooking(venueReviewTarget.id, note || undefined);
    if (!result.success) {
      showFeedback(result.error ?? "Unable to cancel venue booking.", "danger");
      return;
    }

    showFeedback("Venue booking cancelled.");
    setVenueReviewTarget(null);
  };

  const handleNoShowVenueBooking = async () => {
    if (!venueReviewTarget) return;

    const result = await noShowBooking(venueReviewTarget.id);
    if (!result.success) {
      showFeedback(result.error ?? "Unable to mark venue booking no-show.", "danger");
      return;
    }

    showFeedback("Venue booking marked no-show.");
    setVenueReviewTarget(null);
  };

  const handleCreateVenueBooking = async (payload: {
    amenityId: string;
    coachId?: string;
    endsAt: string;
    memberId: string;
    notes?: string;
    paymentStage?: "downpayment" | "full";
    startsAt: string;
  }) => {
    try {
      await createVenueBookingMutation.mutateAsync(payload);
      showFeedback("Venue booking created.");
      setCreateVenueBookingOpen(false);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to create venue booking."),
        "danger",
      );
    }
  };

  const handleCreateCoachBooking = async (payload: {
    coachId: string;
    durationMinutes: number;
    memberId: string;
    memberNotes?: string;
    paymentStage?: "downpayment" | "full";
    scheduledAt: string;
  }) => {
    try {
      await createCoachBookingMutation.mutateAsync(payload);
      showFeedback("Coach booking created.");
      setCreateCoachBookingOpen(false);
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to create coach booking."),
        "danger",
      );
    }
  };

  const handleCreateCoach = async (payload: {
    bio?: string;
    certifications?: string[];
    contactEmail?: string;
    contactPhone?: string;
    displayName: string;
    hourlyRate?: number;
    isAvailableForBooking?: boolean;
    specialties?: string[];
  }) => {
    try {
      await createCoachMutation.mutateAsync(payload);
      showFeedback("Coach created.");
      setCreateCoachOpen(false);
    } catch (error) {
      showFeedback(getErrorMessage(error, "Unable to create coach."), "danger");
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <FitSection
        as="section"
        heading=""
        hideHeading
        bare
        noPadding
        className={themeTransition}
        style={fadeIn}
      >
        <div
          style={{
            display: "grid",
            gap: 18,
            marginBottom: 18,
            padding: 0,
            borderRadius: 28,
            border: `1px solid ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 24,
              flexWrap: "wrap",
              minHeight: 88,
              padding: "24px 39px 18px",
              backgroundColor: colors.surface,
            }}
          >
            <div style={{ display: "grid", gap: 6, maxWidth: 720 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 34,
                  fontWeight: 800,
                  color: colors.textPrimary,
                  lineHeight: 1.08,
                }}
              >
                Gym Operations
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.brand,
                  letterSpacing: "0.08em",
                }}
              >
                dispatch console / schedule control / coach operations
              </FitText>
            </div>
            {canManageCoaching ? (
              <FitPill
                options={GYM_OPERATIONS_TABS}
                active={activeOperationsTab}
                onChange={setActiveOperationsTab}
                style={{ alignSelf: "center" }}
              />
            ) : null}
          </div>
          <div style={{ padding: "0 39px 26px" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 18,
                flexWrap: "wrap",
                minHeight: 74,
                padding: "18px 28px",
                borderRadius: 22,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: colors.textPrimary,
                  lineHeight: 1.24,
                  maxWidth: 620,
                }}
              >
                {activeOperationsTab === "schedule"
                  ? "Search coaches, review appointment pressure, or shift the active week"
                  : "Search coach records, fix booking visibility, and repair readiness details"}
              </FitText>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {activeOperationsTab === "schedule" ? (
                  <>
                    <FitButton
                      variant="ghost"
                      label="REFRESH DATA"
                      icon={RefreshCw}
                      iconSize={15}
                      onClick={() => {
                        void refreshGymOperationsData();
                      }}
                      style={{
                        minHeight: 36,
                        borderRadius: 18,
                        padding: "8px 14px",
                      }}
                      textStyle={{ fontSize: 13, fontWeight: 700 }}
                    />
                    <FitButton
                      variant="ghost"
                      label="OPEN CALENDAR"
                      onClick={() => setCalendarOpen(true)}
                      style={{
                        minHeight: 36,
                        borderRadius: 18,
                        padding: "8px 14px",
                      }}
                      textStyle={{ fontSize: 13, fontWeight: 700 }}
                    />
                  </>
                ) : (
                  <>
                    <FitSelect
                      compact
                      value={coachVisibilityScope}
                      onChange={(event) =>
                        setCoachVisibilityScope(
                          event.target.value as CoachVisibilityScope,
                        )
                      }
                      options={COACH_VISIBILITY_SCOPE_OPTIONS}
                      style={{
                        minHeight: 36,
                        borderRadius: 18,
                        padding: "8px 14px",
                        minWidth: 156,
                        textTransform: "uppercase",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    />
                    <FitButton
                      variant="ghost"
                      label="EDIT PROFILE"
                      onClick={() => {
                        if (!selectedCoachProfile) return;
                        setProfileEditorCoachId(selectedCoachProfile.id);
                      }}
                      disabled={!selectedCoachProfile}
                      style={{
                        minHeight: 36,
                        borderRadius: 18,
                        padding: "8px 14px",
                      }}
                      textStyle={{ fontSize: 13, fontWeight: 700 }}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {activeOperationsTab === "schedule" ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              {activeScheduleSurfaceTab === "coach-schedule" ? (
                <FitButton
                  variant="primary"
                  label="CREATE RECURRING PLAN"
                  onClick={() => {
                    setRecurringPlanPreview(null);
                    setRecurringPlanOpen(true);
                  }}
                  disabled={
                    memberOptions.length === 0 || coachOptions.length === 0
                  }
                  style={{
                    minHeight: 38,
                    borderRadius: 16,
                    padding: "8px 14px",
                  }}
                  textStyle={{ fontSize: 11, fontWeight: 800 }}
                />
              ) : null}
              <FitPill
                options={SCHEDULE_SURFACE_TABS}
                active={activeScheduleSurfaceTab}
                onChange={setActiveScheduleSurfaceTab}
              />
            </div>
            {activeScheduleSurfaceTab === "coach-schedule" ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "286px minmax(0, 1fr)",
                  gap: 16,
                  alignItems: "start",
                }}
              >
                <RosterPanel
                  scrollRef={leftScrollRef}
                  maxHeight={scheduleRosterMaxHeight}
                  staffQuery={coachQuery}
                  onStaffQueryChange={setCoachQuery}
                  filteredStaff={filteredStaff}
                  bookings={rosterBookings}
                  canDrag={false}
                  canSelect={canManageCoaching}
                  selectedStaffId={focusedCoachId}
                  onStaffClick={handleStaffClick}
                  resourceLabelPlural="Coaches"
                  resourceLabelSingular="coach"
                  searchPlaceholder="Search coaches..."
                />
                <div
                  style={{
                    borderRadius: 24,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    display: "grid",
                    gap: 12,
                    minHeight: scheduleTimelineMaxHeight ?? 548,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gap: 6,
                      padding: "20px 20px 0",
                    }}
                  >
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: colors.brand,
                        letterSpacing: "0.08em",
                      }}
                    >
                      WEEKLY SCHEDULE WORKBENCH
                    </FitText>
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 18,
                        fontWeight: 700,
                        color: colors.textPrimary,
                        lineHeight: 1.15,
                      }}
                    >
                      Review appointment pressure, shift the active week, and
                      inspect live coaching sessions without leaving Gym
                      Operations.
                    </FitText>
                  </div>
                  <div
                    ref={rightScrollRef}
                    style={{
                      maxHeight: scheduleTimelineMaxHeight,
                      minHeight: scheduleTimelineMaxHeight ?? 548,
                      overflowY: "auto",
                      padding: "0 12px 12px",
                    }}
                  >
                    <div style={{ padding: 8 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 10,
                          position: "sticky",
                          top: 0,
                          zIndex: 4,
                          padding: "8px 0 10px",
                          backgroundColor: colors.surface,
                        }}
                      >
                        <FitButton
                          variant="ghost"
                          iconOnly
                          icon={ChevronLeft}
                          iconSize={18}
                          onClick={prevWeek}
                          aria-label="Previous week"
                        />
                        <FitButton
                          variant="ghost"
                          onClick={() => setCalendarOpen(true)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "4px 9px",
                            borderRadius: 8,
                            backgroundColor: `${colors.brand}12`,
                          }}
                          aria-label="Pick week"
                        >
                          <CalendarDays
                            size={16}
                            color={colors.brand}
                            strokeWidth={2}
                          />
                          <FitText
                            excludeGlobalScale
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: colors.brand,
                            }}
                          >
                            {formatWeekRange(weekStart)}
                          </FitText>
                        </FitButton>
                        <FitButton
                          variant="ghost"
                          iconOnly
                          icon={ChevronRight}
                          iconSize={18}
                          onClick={nextWeek}
                          aria-label="Next week"
                        />
                      </div>
                      <WeeklyTimeline
                        weekDays={weekDays}
                        hours={HOURS}
                        bookings={focusedCoachScheduleBookings}
                        slideStyle={slideStyle as MotionStyle}
                        isLoading={appointmentsLoading}
                        colors={colors}
                        allowDrag={false}
                        onBlockClick={handleBlockClick}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{
                  borderRadius: 24,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                  padding: "20px 20px 18px",
                  display: "grid",
                  gap: 14,
                }}
              >
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-end",
                      justifyContent: "space-between",
                      gap: 16,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: colors.brand,
                          letterSpacing: "0.08em",
                        }}
                      >
                        VENUE BOOKING CONTROL
                      </FitText>
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 18,
                          color: colors.textPrimary,
                          lineHeight: 1.45,
                          letterSpacing: 0,
                          fontWeight: 700,
                        }}
                      >
                        Review basketball courts, boxing rings, and yoga rooms
                        without leaving the main Gym Operations route.
                      </FitText>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    >
                      <FitButton
                        variant="primary"
                        label="CREATE VENUE BOOKING"
                        onClick={() => setCreateVenueBookingOpen(true)}
                        style={{
                          minHeight: 42,
                          borderRadius: 16,
                          padding: "0 16px",
                        }}
                        textStyle={{ fontSize: 12, fontWeight: 700 }}
                      />
                      <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
                        <FitText excludeGlobalScale style={controlLabelStyle}>
                          Venue Filter
                        </FitText>
                        <FitSelect
                          value={venueFilterId}
                          onChange={(event) =>
                            setVenueFilterId(event.target.value || "all")
                          }
                          options={venueFilterOptions}
                          compact
                          fullWidth
                        />
                      </div>
                      <div style={{ display: "grid", gap: 6, minWidth: 180 }}>
                        <FitText excludeGlobalScale style={controlLabelStyle}>
                          Status Filter
                        </FitText>
                        <FitSelect
                          value={venueStatusFilter}
                          onChange={(event) =>
                            setVenueStatusFilter(event.target.value || "all")
                          }
                          options={VENUE_STATUS_OPTIONS}
                          compact
                          fullWidth
                        />
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                      gap: 8,
                    }}
                  >
                    <OperationsMetricCard
                      colors={colors}
                      label="Visible Venue Bookings"
                      value={venueBookingSummary.visible}
                      tone={colors.brand}
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Pending Venue Bookings"
                      value={venueBookingSummary.pending}
                      tone={colors.warning}
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Confirmed Venue Sessions"
                      value={venueBookingSummary.confirmed}
                      tone={colors.success}
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Active Venues"
                      value={venueBookingSummary.activeVenues}
                    />
                  </div>
                  {scheduleLoading ? (
                    <div
                      style={{
                        minHeight: 170,
                        maxHeight: 170,
                        borderRadius: 18,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.surfaceRaised,
                        padding: "20px 22px",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <FitText
                        excludeGlobalScale
                        style={{ fontSize: 14, color: colors.textMuted }}
                      >
                        Loading venue bookings...
                      </FitText>
                    </div>
                  ) : (
                    <VenueBookingsTable
                      bookings={filteredVenueBookings}
                      colors={colors}
                      emptyMessage={
                        venueFilterId === "all"
                          ? "No venue bookings match the current filters."
                          : `No bookings made in ${selectedVenueFilterLabel}.`
                      }
                      onOpenReview={setVenueReviewTarget}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}

        {activeOperationsTab === "schedule" &&
        activeScheduleSurfaceTab === "coach-schedule" &&
        canManageCoaching ? (
          <div
            style={{
              borderRadius: 24,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              padding: "20px 20px 18px",
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                  paddingTop: 4,
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: colors.brand,
                      letterSpacing: "0.08em",
                    }}
                  >
                    COACH APPOINTMENTS
                  </FitText>
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: colors.textPrimary,
                      lineHeight: 1.2,
                    }}
                  >
                    Appointment control
                  </FitText>
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 12,
                      color: colors.textMuted,
                      lineHeight: 1.45,
                      letterSpacing: 0,
                    }}
                  >
                    Review pending coach decisions, payment-held sessions, and
                    completions without leaving the main operations tab.
                  </FitText>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <FitButton
                    variant="primary"
                    label="CREATE COACH BOOKING"
                    onClick={() => setCreateCoachBookingOpen(true)}
                    style={{
                      minHeight: 42,
                      borderRadius: 16,
                      padding: "0 16px",
                    }}
                    textStyle={{ fontSize: 12, fontWeight: 700 }}
                  />
                  <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
                    <FitText excludeGlobalScale style={controlLabelStyle}>
                      Coach Filter
                    </FitText>
                    <FitSelect
                      value={coachFilterId ?? ""}
                      onChange={(event) =>
                        setCoachFilterId(event.target.value || null)
                      }
                      options={coachOptions}
                      placeholder="All coaches"
                      compact
                      fullWidth
                    />
                  </div>
                  <div style={{ display: "grid", gap: 6, minWidth: 180 }}>
                    <FitText excludeGlobalScale style={controlLabelStyle}>
                      Status Filter
                    </FitText>
                    <FitSelect
                      value={appointmentStatusFilter}
                      onChange={(event) =>
                        setAppointmentStatusFilter(event.target.value || "all")
                      }
                      options={STATUS_OPTIONS}
                      compact
                      fullWidth
                    />
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                <OperationsMetricCard
                  colors={colors}
                  label="Visible Appointments"
                  value={appointmentSummary.visible}
                  tone={colors.brand}
                />
                <OperationsMetricCard
                  colors={colors}
                  label="Pending Coach Decisions"
                  value={appointmentSummary.pendingCoach}
                  tone={colors.warning}
                />
                <OperationsMetricCard
                  colors={colors}
                  label="Confirmed Sessions"
                  value={appointmentSummary.confirmed}
                  tone={colors.success}
                />
                <OperationsMetricCard
                  colors={colors}
                  label={
                    coachFilterId
                      ? "Selected Coach Slots"
                      : "Preview Coach Slots"
                  }
                  value={
                    selectedCoachProfile
                      ? (selectedCoachProfile.availability?.length ?? 0)
                      : coachProfiles.filter((coach) => coach.isActive).length
                  }
                />
              </div>

              {appointmentsLoading ? (
                <div
                  style={{
                    minHeight: 112,
                    maxHeight: 112,
                    borderRadius: 18,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surfaceRaised,
                    padding: "16px 18px",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 14, color: colors.textMuted }}
                  >
                    Loading coach appointments...
                  </FitText>
                </div>
              ) : (
                <CoachAppointmentsTable
                  appointments={coachAppointments}
                  colors={colors}
                  onOpenReview={setAppointmentReviewTarget}
                />
              )}
            </div>
          </div>
        ) : null}

        {activeOperationsTab === "coaches" && canManageCoaching ? (
          <div
            style={{
              borderRadius: 24,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              padding: "20px 20px 18px",
              display: "grid",
              gap: 16,
            }}
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 6 }}>
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: colors.brand,
                      letterSpacing: "0.08em",
                    }}
                  >
                    COACH DATA MANAGEMENT
                  </FitText>
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 18,
                      color: colors.textPrimary,
                      lineHeight: 1.3,
                      fontWeight: 700,
                    }}
                  >
                    Maintain coach-facing booking trust, weekly availability,
                    and member-visible profile quality from one contained tab.
                  </FitText>
                </div>
                <FitButton
                  variant="primary"
                  label="CREATE COACH"
                  onClick={() => setCreateCoachOpen(true)}
                  style={{ minHeight: 42, borderRadius: 16, padding: "0 16px" }}
                  textStyle={{ fontSize: 12, fontWeight: 700 }}
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "286px minmax(0, 726px) 308px",
                  gap: 12,
                  alignItems: "start",
                }}
              >
                <RosterPanel
                  scrollRef={leftScrollRef}
                  maxHeight={coachRosterMaxHeight}
                  staffQuery={coachQuery}
                  onStaffQueryChange={setCoachQuery}
                  filteredStaff={filteredStaff}
                  bookings={rosterBookings}
                  canDrag={false}
                  canSelect={canManageCoaching}
                  selectedStaffId={focusedCoachId}
                  onStaffClick={handleCoachFocus}
                  resourceLabelPlural="Coaches"
                  resourceLabelSingular="coach"
                  searchPlaceholder="Search coaches..."
                />
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 24,
                    backgroundColor: colors.surface,
                    padding: 20,
                    display: "grid",
                    gap: 16,
                    transformOrigin: "center",
                    transition: canAnimate
                      ? "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease"
                      : "border-color 180ms ease, box-shadow 180ms ease",
                  }}
                  onMouseEnter={(event) => {
                    if (!canAnimate) return;
                    event.currentTarget.style.transform = fullMotion
                      ? "translateY(-1px)"
                      : "translateY(-0.5px)";
                    event.currentTarget.style.boxShadow =
                      "0 12px 26px rgba(0,0,0,0.14)";
                    event.currentTarget.style.borderColor = `${colors.brand}24`;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.transform = "none";
                    event.currentTarget.style.boxShadow = "none";
                    event.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ display: "grid", gap: 4 }}>
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: colors.brand,
                          letterSpacing: "0.08em",
                        }}
                      >
                        COACH DATA MANAGEMENT
                      </FitText>
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 30,
                          fontWeight: 800,
                          color: colors.textPrimary,
                          lineHeight: 1.02,
                        }}
                      >
                        {selectedCoachRoster?.name ??
                          "Choose a coach from the roster"}
                      </FitText>
                      <FitText
                        excludeGlobalScale
                        style={{ fontSize: 10, color: colors.textMuted }}
                      >
                        {selectedCoachRoster
                          ? selectedCoachRoster.email ||
                            "No coach-profile contact email yet. Edit profile to add one."
                          : "Select a coach to repair visibility, availability, and member-facing booking trust."}
                      </FitText>
                    </div>
                    <FitPill
                      mode="status"
                      label={
                        selectedCoachProfile
                          ? selectedCoachProfile.isActive
                            ? "VISIBLE IN BOOKING"
                            : "HIDDEN FROM BOOKING"
                          : "NO COACH SELECTED"
                      }
                      color={
                        selectedCoachProfile
                          ? selectedCoachProfile.isActive
                            ? colors.brand
                            : colors.warning
                          : colors.textMuted
                      }
                      fontSize={10}
                      fontWeight={700}
                      borderOpacity="35"
                      bgOpacity="14"
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                      gap: 8,
                    }}
                  >
                    <OperationsMetricCard
                      colors={colors}
                      label="Weekly Slots"
                      value={selectedCoachProfile?.availability?.length ?? 0}
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Hourly Rate"
                      value={
                        selectedCoachRoster?.hourlyRate != null
                          ? `PHP ${selectedCoachRoster.hourlyRate.toLocaleString("en-PH")}`
                          : "Unset"
                      }
                      tone={
                        selectedCoachRoster?.hourlyRate != null
                          ? colors.brand
                          : colors.textPrimary
                      }
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Certifications"
                      value={selectedCoachRoster?.certifications?.length ?? 0}
                      tone={
                        (selectedCoachRoster?.certifications?.length ?? 0) > 0
                          ? colors.success
                          : colors.textPrimary
                      }
                    />
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        borderRadius: 16,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.surfaceRaised,
                        padding: "14px 16px",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: colors.textPrimary,
                        }}
                      >
                        Availability snapshot
                      </FitText>
                      {(selectedCoachProfile?.availability?.length ?? 0) > 0 ? (
                        selectedCoachProfile?.availability
                          ?.slice(0, 4)
                          .map((slot) => (
                            <FitText
                              key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`}
                              excludeGlobalScale
                              style={{
                                fontSize: 12,
                                color: colors.textSecondary,
                              }}
                            >
                              {[
                                "Sun",
                                "Mon",
                                "Tue",
                                "Wed",
                                "Thu",
                                "Fri",
                                "Sat",
                              ][slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`}{" "}
                              / {slot.startTime} - {slot.endTime}
                            </FitText>
                          ))
                      ) : (
                        <FitText
                          excludeGlobalScale
                          style={{ fontSize: 12, color: colors.textMuted }}
                        >
                          No availability recorded yet.
                        </FitText>
                      )}
                    </div>
                    <div
                      style={{
                        borderRadius: 16,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.surfaceRaised,
                        padding: "14px 16px",
                        display: "grid",
                        gap: 10,
                      }}
                    >
                      <FitText
                        excludeGlobalScale
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: colors.textPrimary,
                        }}
                      >
                        Specialties
                      </FitText>
                      <div
                        style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                      >
                        {(selectedCoachRoster?.specialties ?? []).length > 0 ? (
                          selectedCoachRoster?.specialties.map(
                            (specialty, index) => (
                              <FitPill
                                key={specialty}
                                mode="status"
                                label={specialty.toUpperCase()}
                                color={
                                  index === 0 ? colors.brand : colors.textMuted
                                }
                                fontSize={9}
                                fontWeight={700}
                                borderOpacity="28"
                                bgOpacity="12"
                              />
                            ),
                          )
                        ) : (
                          <FitText
                            excludeGlobalScale
                            style={{ fontSize: 12, color: colors.textMuted }}
                          >
                            No specialties recorded for the current selection.
                          </FitText>
                        )}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      borderRadius: 16,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceRaised,
                      padding: "14px 16px",
                      display: "grid",
                      gap: 8,
                    }}
                  >
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.textPrimary,
                      }}
                    >
                      Booking bio
                    </FitText>
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: colors.textSecondary,
                      }}
                    >
                      {selectedCoachRoster?.bio?.trim() ||
                        "This tab owns trust and profile quality only. Live appointment decisions and calendar pressure stay in the schedule workbench."}
                    </FitText>
                  </div>

                  <div
                    style={{
                      borderRadius: 16,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceRaised,
                      padding: "14px 16px",
                      display: "grid",
                      gap: 10,
                    }}
                  >
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.textPrimary,
                      }}
                    >
                      Profile actions
                    </FitText>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <FitButton
                        variant="primary"
                        label="MANAGE AVAILABILITY"
                        onClick={() => {
                          if (!selectedCoachProfile) return;
                          setAvailabilityEditorCoachId(selectedCoachProfile.id);
                        }}
                        disabled={!selectedCoachProfile}
                        style={{
                          minHeight: 36,
                          padding: "8px 12px",
                          borderRadius: 10,
                        }}
                        textStyle={{ fontSize: 11, fontWeight: 700 }}
                      />
                      <FitButton
                        variant="ghost"
                        label="VIEW PROFILE"
                        onClick={() => {
                          if (!selectedCoachRoster) return;
                          setActiveCoachId(selectedCoachRoster.id);
                          setCoachDetailsOpen(true);
                        }}
                        disabled={!selectedCoachRoster}
                        style={{
                          minHeight: 36,
                          padding: "8px 12px",
                          borderRadius: 10,
                        }}
                        textStyle={{ fontSize: 11, fontWeight: 700 }}
                      />
                      <FitButton
                        variant="ghost"
                        label="OPEN IN SCHEDULE"
                        onClick={() => {
                          setActiveOperationsTab("schedule");
                          setActiveScheduleSurfaceTab("coach-schedule");
                        }}
                        disabled={!selectedCoachProfile}
                        style={{
                          minHeight: 36,
                          padding: "8px 12px",
                          borderRadius: 10,
                        }}
                        textStyle={{ fontSize: 11, fontWeight: 700 }}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 24,
                    backgroundColor: colors.surface,
                    padding: 20,
                    display: "grid",
                    gap: 12,
                    transformOrigin: "center",
                    transition: canAnimate
                      ? "transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease"
                      : "border-color 180ms ease, box-shadow 180ms ease",
                  }}
                  onMouseEnter={(event) => {
                    if (!canAnimate) return;
                    event.currentTarget.style.transform = fullMotion
                      ? "translateY(-1px)"
                      : "translateY(-0.5px)";
                    event.currentTarget.style.boxShadow =
                      "0 12px 26px rgba(0,0,0,0.14)";
                    event.currentTarget.style.borderColor = `${colors.brand}24`;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.transform = "none";
                    event.currentTarget.style.boxShadow = "none";
                    event.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: colors.textPrimary,
                    }}
                  >
                    Readiness + trust
                  </FitText>
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 11,
                      color: colors.brand,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                    }}
                  >
                    VISIBILITY / CREDENTIALS / AVAILABILITY GAPS
                  </FitText>

                  <OperationsMetricCard
                    colors={colors}
                    label="Booking Visibility"
                    value={
                      selectedCoachProfile?.isActive ? "Visible" : "Hidden"
                    }
                    tone={
                      selectedCoachProfile?.isActive
                        ? colors.success
                        : colors.warning
                    }
                  />
                  <OperationsMetricCard
                    colors={colors}
                    label="Open Peak Slots"
                    value={selectedCoachProfile?.availability?.length ?? 0}
                    tone={colors.warning}
                  />
                  <OperationsMetricCard
                    colors={colors}
                    label="Upcoming Sessions"
                    value={
                      coachAppointments.filter(
                        (appointment) =>
                          !focusedCoachId ||
                          appointment.coachId === focusedCoachId,
                      ).length
                    }
                  />

                  <div
                    style={{
                      borderRadius: 16,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceRaised,
                      padding: "14px 16px",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.textPrimary,
                      }}
                    >
                      Credential notes
                    </FitText>
                    {(selectedCoachRoster?.certifications ?? []).length > 0 ? (
                      selectedCoachRoster?.certifications.map(
                        (certification) => (
                          <FitText
                            key={certification}
                            excludeGlobalScale
                            style={{
                              fontSize: 12,
                              color: colors.textSecondary,
                            }}
                          >
                            {certification}
                          </FitText>
                        ),
                      )
                    ) : (
                      <FitText
                        excludeGlobalScale
                        style={{ fontSize: 12, color: colors.textMuted }}
                      >
                        No certifications recorded yet.
                      </FitText>
                    )}
                  </div>

                  <div
                    style={{
                      borderRadius: 16,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceRaised,
                      padding: "14px 16px",
                      display: "grid",
                      gap: 6,
                    }}
                  >
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.textPrimary,
                      }}
                    >
                      Operational note
                    </FitText>
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        lineHeight: 1.45,
                      }}
                    >
                      {selectedCoachProfile?.isActive
                        ? "Use this rail to spot trust issues before bookings become front-desk problems."
                        : "This coach is hidden from booking. Repair visibility only after profile trust details are ready."}
                    </FitText>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <StaffDetailsModal
          isOpen={coachDetailsOpen && canManageCoaching}
          coachName={activeCoach?.name ?? "Coach"}
          coachBio={activeCoach?.bio ?? null}
          coachCertifications={activeCoach?.certifications ?? []}
          coachEmail={activeCoach?.email ?? ""}
          coachHourlyRate={activeCoach?.hourlyRate ?? null}
          coachSpecialties={activeCoach?.specialties ?? []}
          coachAvailability={activeCoach?.availabilityPreview ?? []}
          bookings={allBookings.filter(
            (booking) => booking.resourceId === activeCoachId,
          )}
          colors={colors}
          onClose={() => {
            setCoachDetailsOpen(false);
            setActiveCoachId(null);
          }}
        />
        <BlockDetailModal
          isOpen={blockDetailOpen}
          block={activeBlock}
          staffMembers={coachRoster}
          onSave={handleBlockSave}
          onDelete={handleBlockDelete}
          resourceLabel="Coach"
          onClose={() => {
            setBlockDetailOpen(false);
            setActiveBlock(null);
          }}
        />
        <CalendarModal
          isOpen={calendarOpen}
          selectedDate={toYmd(weekStart)}
          onSelect={(ymd) => {
            if (!ymd) return;
            const [year, month, day] = ymd.split("-").map(Number);
            if (
              Number.isFinite(year) &&
              Number.isFinite(month) &&
              Number.isFinite(day)
            ) {
              setWeekStart(getWeekStart(new Date(year, month - 1, day)));
            }
          }}
          onClose={() => setCalendarOpen(false)}
        />
        {recurringPlanOpen ? (
          <div
            onClick={() => {
              if (!recurringCreateBusy) setRecurringPlanOpen(false);
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 80,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              backgroundColor: colors.overlay,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 920,
                maxWidth: "min(920px, calc(100vw - 48px))",
                maxHeight: "min(780px, calc(100vh - 48px))",
                overflow: "auto",
                borderRadius: 26,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
                padding: 30,
                display: "grid",
                gap: 18,
                boxShadow: "0 20px 48px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    color: colors.brand,
                  }}
                >
                  RECURRING COACHING PLAN
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 28,
                    fontWeight: 850,
                    lineHeight: 1.08,
                    color: colors.textPrimary,
                  }}
                >
                  Preview the generated sessions before creating the plan.
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    maxWidth: 720,
                    fontSize: 13,
                    lineHeight: 1.45,
                    color: colors.textMuted,
                  }}
                >
                  This creates one durable plan record plus child coaching
                  appointments after confirmation. Conflicted sessions can be
                  skipped from the first pass and handled manually later.
                </FitText>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                  gap: 16,
                }}
              >
                <div style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <FitText excludeGlobalScale style={controlLabelStyle}>
                      Member
                    </FitText>
                    <FitSelect
                      value={recurringPlanForm.memberId}
                      onChange={(event) => {
                        setRecurringPlanPreview(null);
                        setRecurringPlanForm((current) => ({
                          ...current,
                          memberId: event.target.value,
                        }));
                      }}
                      options={memberOptions}
                      placeholder="Choose member"
                      compact
                      fullWidth
                    />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <FitText excludeGlobalScale style={controlLabelStyle}>
                      Coach
                    </FitText>
                    <FitSelect
                      value={recurringPlanForm.coachId}
                      onChange={(event) => {
                        setRecurringPlanPreview(null);
                        setRecurringPlanForm((current) => ({
                          ...current,
                          coachId: event.target.value,
                        }));
                      }}
                      options={coachOptions}
                      placeholder="Choose coach"
                      compact
                      fullWidth
                    />
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <FitText excludeGlobalScale style={controlLabelStyle}>
                        Frequency
                      </FitText>
                      <FitSelect
                        value={recurringPlanForm.frequency}
                        onChange={(event) => {
                          setRecurringPlanPreview(null);
                          setRecurringPlanForm((current) => ({
                            ...current,
                            frequency: event.target
                              .value as RecurringPlanFormState["frequency"],
                          }));
                        }}
                        options={RECURRING_FREQUENCY_OPTIONS}
                        compact
                        fullWidth
                      />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <FitText excludeGlobalScale style={controlLabelStyle}>
                        Duration
                      </FitText>
                      <FitSelect
                        value={String(recurringPlanForm.durationMonths)}
                        onChange={(event) => {
                          setRecurringPlanPreview(null);
                          setRecurringPlanForm((current) => ({
                            ...current,
                            durationMonths: Number(event.target.value) || 3,
                          }));
                        }}
                        options={RECURRING_DURATION_OPTIONS}
                        compact
                        fullWidth
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: 12 }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <FitText excludeGlobalScale style={controlLabelStyle}>
                        Start Date
                      </FitText>
                      <input
                        type="date"
                        value={recurringPlanForm.startDate}
                        onChange={(event) => {
                          setRecurringPlanPreview(null);
                          setRecurringPlanForm((current) => ({
                            ...current,
                            startDate: event.target.value,
                          }));
                        }}
                        style={recurringFormFieldStyle}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <FitText excludeGlobalScale style={controlLabelStyle}>
                        Preferred Time
                      </FitText>
                      <input
                        type="time"
                        value={recurringPlanForm.preferredTime}
                        onChange={(event) => {
                          setRecurringPlanPreview(null);
                          setRecurringPlanForm((current) => ({
                            ...current,
                            preferredTime: event.target.value,
                          }));
                        }}
                        style={recurringFormFieldStyle}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <FitText excludeGlobalScale style={controlLabelStyle}>
                      Session Duration
                    </FitText>
                    <input
                      type="number"
                      min={30}
                      max={180}
                      step={15}
                      value={recurringPlanForm.durationMinutes}
                      onChange={(event) => {
                        setRecurringPlanPreview(null);
                        setRecurringPlanForm((current) => ({
                          ...current,
                          durationMinutes: Number(event.target.value) || 60,
                        }));
                      }}
                      style={recurringFormFieldStyle}
                    />
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <FitText excludeGlobalScale style={controlLabelStyle}>
                      Preferred Days
                    </FitText>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {WEEKDAY_OPTIONS.map((day) => {
                        const active = recurringPlanForm.preferredDays.includes(
                          day.value,
                        );
                        return (
                          <FitButton
                            key={day.value}
                            variant={active ? "primary" : "ghost"}
                            label={day.label}
                            onClick={() => toggleRecurringPlanDay(day.value)}
                            style={{
                              minHeight: 34,
                              minWidth: 48,
                              borderRadius: 12,
                              padding: "7px 10px",
                            }}
                            textStyle={{ fontSize: 11, fontWeight: 800 }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderRadius: 18,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceRaised,
                  padding: 16,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <FitText
                    excludeGlobalScale
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: colors.textPrimary,
                    }}
                  >
                    Schedule preview
                  </FitText>
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 12, color: colors.textMuted }}
                  >
                    {recurringPlanPreview
                      ? `${recurringPlanPreview.totalSessions} sessions / ${recurringPlanPreview.conflictCount} conflicts`
                      : "Preview required before confirm"}
                  </FitText>
                </div>
                <div
                  style={{
                    maxHeight: 220,
                    overflowY: "auto",
                    display: "grid",
                    gap: 8,
                  }}
                >
                  {recurringPlanPreview ? (
                    recurringPlanPreview.sessions.map((session) => (
                      <div
                        key={session.scheduledAt}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0, 1fr) auto",
                          gap: 12,
                          alignItems: "center",
                          borderRadius: 14,
                          border: `1px solid ${
                            session.conflict
                              ? `${colors.danger}55`
                              : colors.border
                          }`,
                          backgroundColor: session.conflict
                            ? `${colors.danger}12`
                            : colors.surface,
                          padding: "10px 12px",
                        }}
                      >
                        <div style={{ display: "grid", gap: 3 }}>
                          <FitText
                            excludeGlobalScale
                            style={{
                              fontSize: 13,
                              fontWeight: 750,
                              color: colors.textPrimary,
                            }}
                          >
                            {formatRecurringDateTime(session.scheduledAt)}
                          </FitText>
                          <FitText
                            excludeGlobalScale
                            style={{ fontSize: 11, color: colors.textMuted }}
                          >
                            {session.conflict
                              ? session.conflictReasons.join(" / ")
                              : "Coach availability and appointment conflict check passed."}
                          </FitText>
                        </div>
                        <FitPill
                          mode="status"
                          label={session.conflict ? "CONFLICT" : "CLEAR"}
                          color={
                            session.conflict ? colors.danger : colors.success
                          }
                          fontSize={9}
                          fontWeight={800}
                          borderOpacity="28"
                          bgOpacity="12"
                        />
                      </div>
                    ))
                  ) : (
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 13,
                        color: colors.textMuted,
                        padding: "8px 0",
                      }}
                    >
                      Fill the plan details and generate a preview. No rows are
                      written until you confirm.
                    </FitText>
                  )}
                </div>
                {recurringPlanPreview?.venueConflictsChecked === false ? (
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 11, color: colors.warning }}
                  >
                    Venue conflicts: {recurringPlanPreview.venueConflictsNote}
                  </FitText>
                ) : null}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <FitButton
                  variant="ghost"
                  label="CLOSE"
                  onClick={() => setRecurringPlanOpen(false)}
                  disabled={recurringCreateBusy}
                  style={{
                    minHeight: 38,
                    borderRadius: 16,
                    padding: "8px 14px",
                  }}
                  textStyle={{ fontSize: 11, fontWeight: 800 }}
                />
                <FitButton
                  variant="ghost"
                  label={
                    recurringCreateBusy ? "PREVIEWING..." : "PREVIEW SCHEDULE"
                  }
                  onClick={() => void handlePreviewRecurringPlan()}
                  disabled={recurringCreateBusy || recurringPlanInputInvalid}
                  style={{
                    minHeight: 38,
                    borderRadius: 16,
                    padding: "8px 14px",
                  }}
                  textStyle={{ fontSize: 11, fontWeight: 800 }}
                />
                {recurringPlanPreview?.conflictCount ? (
                  <FitButton
                    variant="ghost"
                    label="CONFIRM + SKIP CONFLICTS"
                    onClick={() => void handleConfirmRecurringPlan(true)}
                    disabled={recurringCreateBusy}
                    style={{
                      minHeight: 38,
                      borderRadius: 16,
                      padding: "8px 14px",
                    }}
                    textStyle={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: colors.warning,
                    }}
                  />
                ) : null}
                <FitButton
                  variant="primary"
                  label={
                    createRecurringPlanMutation.isPending
                      ? "CREATING..."
                      : "CONFIRM PLAN"
                  }
                  onClick={() => void handleConfirmRecurringPlan(false)}
                  disabled={
                    recurringCreateBusy ||
                    !recurringPlanPreview ||
                    recurringPlanPreview.conflictCount > 0
                  }
                  style={{
                    minHeight: 38,
                    borderRadius: 16,
                    padding: "8px 14px",
                  }}
                  textStyle={{ fontSize: 11, fontWeight: 800 }}
                />
              </div>
            </div>
          </div>
        ) : null}
        <GymOperationsCoachAppointmentModal
          appointment={appointmentReviewTarget}
          billingCycles={recurringPlanSessions?.plan.billingCycles ?? []}
          coachReadiness={appointmentReviewReadiness}
          isOpen={!!appointmentReviewTarget}
          isSubmitting={
            respondAppointmentMutation.isPending ||
            completeAppointmentMutation.isPending ||
            cancelAppointmentMutation.isPending ||
            payAppointmentInitialMutation.isPending ||
            processAppointmentBalanceMutation.isPending ||
            payRecurringCycleMutation.isPending ||
            verifyPaymentMutation.isPending
          }
          onClose={() => setAppointmentReviewTarget(null)}
          onConfirm={() => void handleConfirmAppointment()}
          onReject={(note) => {
            if (!appointmentReviewTarget) return;
            void handleRejectAppointment(appointmentReviewTarget, note);
          }}
          onComplete={(note) => {
            if (!appointmentReviewTarget) return;
            void handleCompleteAppointment(appointmentReviewTarget, note);
          }}
          onCancelAppointment={(note) => {
            if (!appointmentReviewTarget) return;
            void handleCancelAppointment(appointmentReviewTarget, note);
          }}
          onEditRecurringSession={() => {
            if (!appointmentReviewTarget?.recurringPlanId) return;
            const currentAppointment = appointmentReviewTarget;
            setAppointmentReviewTarget(null);
            setRecurringPlanAction({
              appointment: currentAppointment,
              mode: "single",
            });
          }}
          onEditRecurringFuture={() => {
            if (!appointmentReviewTarget?.recurringPlanId) return;
            const currentAppointment = appointmentReviewTarget;
            setAppointmentReviewTarget(null);
            setRecurringPlanAction({
              appointment: currentAppointment,
              mode: "future",
            });
          }}
          onCancelRecurringPlan={() => {
            if (!appointmentReviewTarget?.recurringPlanId) return;
            const currentAppointment = appointmentReviewTarget;
            setAppointmentReviewTarget(null);
            setRecurringPlanAction({
              appointment: currentAppointment,
              mode: "cancel",
            });
          }}
          onCollectBalance={(provider) => {
            if (!appointmentReviewTarget) return;
            requestCollectAppointmentBalance(
              appointmentReviewTarget,
              provider,
            );
          }}
          onCollectInitialPayment={(provider, paymentStage) => {
            if (!appointmentReviewTarget) return;
            requestCollectAppointmentInitialPayment(
              appointmentReviewTarget,
              provider,
              paymentStage,
            );
          }}
          onPayRecurringCycle={(cycle, provider) =>
            requestRecurringCyclePayment(cycle, provider)
          }
        />
        {recurringPlanAction ? (
          <div
            onClick={() => {
              if (!recurringActionBusy) setRecurringPlanAction(null);
            }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 90,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
              backgroundColor: colors.overlay,
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                width: 720,
                maxWidth: "min(720px, calc(100vw - 48px))",
                maxHeight: "min(720px, calc(100vh - 48px))",
                overflow: "auto",
                borderRadius: 24,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
                padding: 28,
                display: "grid",
                gap: 16,
                boxShadow: "0 20px 48px rgba(0,0,0,0.32)",
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    color: colors.brand,
                  }}
                >
                  RECURRING PLAN ACTION
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 24,
                    fontWeight: 850,
                    color: colors.textPrimary,
                    lineHeight: 1.12,
                  }}
                >
                  {recurringPlanAction.mode === "single"
                    ? "Edit this generated session only"
                    : recurringPlanAction.mode === "future"
                      ? "Update this and all future sessions"
                      : "Cancel this recurring coaching plan"}
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 13,
                    color: colors.textMuted,
                    lineHeight: 1.45,
                  }}
                >
                  Current session:{" "}
                  {formatRecurringDateTime(
                    recurringPlanAction.appointment.scheduledAt,
                  )}
                </FitText>
              </div>

              {recurringPlanAction.mode === "cancel" ? (
                <div
                  style={{
                    borderRadius: 18,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surfaceRaised,
                    padding: 16,
                    display: "grid",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 10,
                    }}
                  >
                    <OperationsMetricCard
                      colors={colors}
                      label="Completed Sessions"
                      value={recurringCompletedCount}
                      tone={colors.success}
                    />
                    <OperationsMetricCard
                      colors={colors}
                      label="Future Sessions"
                      value={recurringRemainingCount}
                      tone={colors.warning}
                    />
                  </div>
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 12, color: colors.textMuted }}
                  >
                    Cancelling preserves completed sessions and cancels only
                    future non-completed sessions.
                  </FitText>
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      recurringPlanAction.mode === "single" ? "1fr 1fr" : "1fr",
                    gap: 12,
                  }}
                >
                  {recurringPlanAction.mode === "single" ? (
                    <div style={{ display: "grid", gap: 6 }}>
                      <FitText excludeGlobalScale style={controlLabelStyle}>
                        New Date
                      </FitText>
                      <input
                        type="date"
                        value={recurringActionDate}
                        onChange={(event) =>
                          setRecurringActionDate(event.target.value)
                        }
                        style={recurringFormFieldStyle}
                      />
                    </div>
                  ) : null}
                  <div style={{ display: "grid", gap: 6 }}>
                    <FitText excludeGlobalScale style={controlLabelStyle}>
                      New Time
                    </FitText>
                    <input
                      type="time"
                      value={recurringActionTime}
                      onChange={(event) =>
                        setRecurringActionTime(event.target.value)
                      }
                      style={recurringFormFieldStyle}
                    />
                  </div>
                  <div style={{ display: "grid", gap: 6 }}>
                    <FitText excludeGlobalScale style={controlLabelStyle}>
                      Coach
                    </FitText>
                    <FitSelect
                      value={recurringActionCoachId}
                      onChange={(event) =>
                        setRecurringActionCoachId(event.target.value)
                      }
                      options={coachOptions}
                      compact
                      fullWidth
                    />
                  </div>
                  {recurringPlanAction.mode === "future" ? (
                    <div style={{ display: "grid", gap: 8 }}>
                      <FitText excludeGlobalScale style={controlLabelStyle}>
                        Future Weekdays
                      </FitText>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        {WEEKDAY_OPTIONS.map((day) => {
                          const active = recurringActionDays.includes(
                            day.value,
                          );
                          return (
                            <FitButton
                              key={day.value}
                              variant={active ? "primary" : "ghost"}
                              label={day.label}
                              onClick={() =>
                                toggleRecurringActionDay(day.value)
                              }
                              style={{
                                minHeight: 34,
                                minWidth: 48,
                                borderRadius: 12,
                                padding: "7px 10px",
                              }}
                              textStyle={{ fontSize: 11, fontWeight: 800 }}
                            />
                          );
                        })}
                      </div>
                      <FitText
                        excludeGlobalScale
                        style={{ fontSize: 12, color: colors.textMuted }}
                      >
                        Affects {recurringRemainingCount || "the remaining"}{" "}
                        future session(s), starting from the selected
                        appointment.
                      </FitText>
                    </div>
                  ) : null}
                </div>
              )}

              <div style={{ display: "grid", gap: 6 }}>
                <FitText excludeGlobalScale style={controlLabelStyle}>
                  Reason / Notes
                </FitText>
                <textarea
                  value={recurringActionReason}
                  onChange={(event) =>
                    setRecurringActionReason(event.target.value)
                  }
                  placeholder="Optional audit note..."
                  rows={3}
                  style={{
                    ...recurringFormFieldStyle,
                    resize: "vertical",
                    lineHeight: 1.45,
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <FitButton
                  variant="ghost"
                  label="CLOSE"
                  onClick={() => setRecurringPlanAction(null)}
                  disabled={recurringActionBusy}
                  style={{
                    minHeight: 38,
                    borderRadius: 16,
                    padding: "8px 14px",
                  }}
                  textStyle={{ fontSize: 11, fontWeight: 800 }}
                />
                {recurringPlanAction.mode === "single" ? (
                  <>
                    <FitButton
                      variant="ghost"
                      label={
                        updateRecurringSessionMutation.isPending
                          ? "SKIPPING..."
                          : "SKIP SESSION"
                      }
                      onClick={() => void handleRecurringSessionSkip()}
                      disabled={recurringActionBusy}
                      style={{
                        minHeight: 38,
                        borderRadius: 16,
                        padding: "8px 14px",
                      }}
                      textStyle={{
                        fontSize: 11,
                        fontWeight: 800,
                        color: colors.warning,
                      }}
                    />
                    <FitButton
                      variant="primary"
                      label={
                        updateRecurringSessionMutation.isPending
                          ? "SAVING..."
                          : "RESCHEDULE SESSION"
                      }
                      onClick={() => void handleRecurringSessionReschedule()}
                      disabled={
                        recurringActionBusy ||
                        !recurringActionDate ||
                        !recurringActionTime
                      }
                      style={{
                        minHeight: 38,
                        borderRadius: 16,
                        padding: "8px 14px",
                      }}
                      textStyle={{ fontSize: 11, fontWeight: 800 }}
                    />
                  </>
                ) : recurringPlanAction.mode === "future" ? (
                  <FitButton
                    variant="primary"
                    label={
                      bulkUpdateRecurringSessionsMutation.isPending
                        ? "UPDATING..."
                        : "UPDATE FUTURE SESSIONS"
                    }
                    onClick={() => void handleRecurringFutureUpdate()}
                    disabled={
                      recurringActionBusy ||
                      !recurringActionTime ||
                      recurringActionDays.length === 0
                    }
                    style={{
                      minHeight: 38,
                      borderRadius: 16,
                      padding: "8px 14px",
                    }}
                    textStyle={{ fontSize: 11, fontWeight: 800 }}
                  />
                ) : (
                  <FitButton
                    variant="ghost"
                    label={
                      cancelRecurringPlanMutation.isPending
                        ? "CANCELLING..."
                        : "CANCEL PLAN"
                    }
                    onClick={() => void handleRecurringPlanCancel()}
                    disabled={recurringActionBusy}
                    style={{
                      minHeight: 38,
                      borderRadius: 16,
                      padding: "8px 14px",
                      borderColor: `${colors.danger}66`,
                    }}
                    textStyle={{
                      fontSize: 11,
                      fontWeight: 800,
                      color: colors.danger,
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        ) : null}
        <GymOperationsCreateVenueBookingModal
          isOpen={createVenueBookingOpen}
          isSubmitting={createVenueBookingMutation.isPending}
          onClose={() => setCreateVenueBookingOpen(false)}
          onCreate={(payload) => void handleCreateVenueBooking(payload)}
          memberOptions={memberOptions}
          coachOptions={coachOptions}
          venueOptions={bookableVenueOptions}
        />
        <GymOperationsCreateCoachBookingModal
          isOpen={createCoachBookingOpen}
          isSubmitting={createCoachBookingMutation.isPending}
          onClose={() => setCreateCoachBookingOpen(false)}
          onCreate={(payload) => void handleCreateCoachBooking(payload)}
          memberOptions={memberOptions}
          coachOptions={coachOptions}
        />
        <GymOperationsCreateCoachModal
          isOpen={createCoachOpen}
          isSubmitting={createCoachMutation.isPending}
          onClose={() => setCreateCoachOpen(false)}
          onCreate={(payload) => void handleCreateCoach(payload)}
        />
        <GymOperationsAvailabilityDrawer
          isOpen={!!availabilityEditorCoach}
          coachName={
            availabilityEditorCoach
              ? getCoachDisplayName(availabilityEditorCoach, "Coach")
              : "Coach"
          }
          isVisibleInBooking={availabilityEditorCoach?.isActive ?? false}
          initialSlots={
            availabilityEditorCoach?.availability?.map((slot) => ({
              dayOfWeek: slot.dayOfWeek,
              startTime: slot.startTime,
              endTime: slot.endTime,
            })) ?? []
          }
          isSaving={
            replaceAvailabilityMutation.isPending ||
            updateCoachProfileMutation.isPending
          }
          onClose={() => setAvailabilityEditorCoachId(null)}
          onSave={(slots) => void handleSaveAvailability(slots)}
          onSetBookingVisibility={(isVisible) => {
            if (!availabilityEditorCoach) return;
            void handleSetCoachBookingVisibility(
              availabilityEditorCoach.id,
              isVisible,
            );
          }}
        />
        <GymOperationsVenueBookingModal
          booking={venueReviewTarget}
          isOpen={!!venueReviewTarget}
          isSubmitting={
            scheduleLoading ||
            processBookingBalanceMutation.isPending ||
            verifyPaymentMutation.isPending
          }
          onClose={() => setVenueReviewTarget(null)}
          onApprove={(note) => void handleApproveVenueBooking(note)}
          onCancel={(note) => void handleCancelVenueBooking(note)}
          onCollectBalance={(provider) => {
            if (!venueReviewTarget) return;
            requestCollectVenueBalance(venueReviewTarget, provider);
          }}
          onComplete={() => void handleCompleteVenueBooking()}
          onNoShow={() => void handleNoShowVenueBooking()}
          onReject={(note) => void handleRejectVenueBooking(note)}
          onVenueDetails={() => {
            window.location.assign("/facilities");
          }}
        />
        <ConfirmModal
          isOpen={!!paymentConfirm}
          title={paymentConfirm?.title ?? "Confirm payment action"}
          message={
            paymentConfirm?.message ??
            "Review this payment action before continuing."
          }
          confirmLabel={paymentConfirm?.confirmLabel ?? "CONFIRM"}
          loadingLabel={paymentConfirm?.confirmLabel ?? "CONFIRM"}
          isLoading={paymentConfirmLoading}
          onConfirm={() => {
            void handleConfirmPaymentAction();
          }}
          onCancel={() => setPaymentConfirm(null)}
        />
        <DetailsModal
          isOpen={!!profileEditorCoach}
          title={
            profileEditorCoach
              ? `${getCoachDisplayName(profileEditorCoach, "Coach")} Profile`
              : "Coach Profile"
          }
          subtitle="Keep this member-facing profile trustworthy before new bookings."
          fields={COACH_PROFILE_FIELDS}
          initialValues={
            profileEditorCoach
              ? {
                  bio: profileEditorCoach.bio ?? "",
                  contactEmail: profileEditorCoach.contactEmail ?? "",
                  contactPhone: profileEditorCoach.contactPhone ?? "",
                  displayName: profileEditorCoach.displayName ?? "",
                  specialties: (profileEditorCoach.specialties ?? []).join(
                    ", ",
                  ),
                  certifications: (
                    profileEditorCoach.certifications ?? []
                  ).join(", "),
                  hourlyRate:
                    profileEditorCoach.hourlyRate != null
                      ? String(profileEditorCoach.hourlyRate)
                      : "",
                  isAvailableForBooking: profileEditorCoach.isActive
                    ? "active"
                    : "inactive",
                }
              : undefined
          }
          submitLabel={
            updateCoachProfileMutation.isPending
              ? "SAVING PROFILE"
              : "SAVE PROFILE"
          }
          isLoading={updateCoachProfileMutation.isPending}
          disableUnchanged
          onCancel={() => setProfileEditorCoachId(null)}
          onSubmit={(data) => void handleSaveCoachProfile(data)}
        >
          <FitText style={{ fontSize: 12, color: colors.textMuted }}>
            Years of experience is still outside the live coach-profile
            contract, so this management pass focuses on the fields members can
            already see during booking review.
          </FitText>
        </DetailsModal>
      </FitSection>
      <DragOverlay>
        {draggingCoach ? (
          <div
            style={{
              width: 254,
              maxWidth: 254,
              backgroundColor: colors.surface,
              color: colors.textPrimary,
              borderRadius: 14,
              border: `1.5px solid ${colors.brand}55`,
              padding: "10px 12px",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 12px 28px rgba(0,0,0,0.26)",
              opacity: 0.96,
              pointerEvents: "none",
              display: "grid",
              gap: 3,
              overflow: "hidden",
            }}
          >
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: colors.textPrimary,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: 0,
              }}
            >
              {draggingCoach.name}
            </FitText>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 10,
                color: colors.textMuted,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: 0,
              }}
            >
              Drag into a schedule slot
            </FitText>
          </div>
        ) : draggingBooking ? (
          <div
            style={{
              width: 152,
              maxWidth: 152,
              backgroundColor: draggingBooking.color ?? colors.brand,
              color: colors.onBrand ?? colors.surface,
              borderRadius: 10,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 700,
              boxShadow: "0 10px 24px rgba(0,0,0,0.24)",
              opacity: 0.92,
              pointerEvents: "none",
              overflow: "hidden",
            }}
          >
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: colors.onBrand ?? colors.surface,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                letterSpacing: 0,
              }}
            >
              {draggingBooking.resourceName}
            </FitText>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
