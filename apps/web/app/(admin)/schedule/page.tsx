"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { MotionStyle } from "framer-motion";
import { toast } from "sonner";
import type { StaffAppointmentRecord } from "@fittrack/api-client";
import {
  cancelStaffAppointmentMutationOptions,
  completeStaffAppointmentMutationOptions,
  replaceStaffCoachAvailabilityMutationOptions,
  respondToStaffAppointmentMutationOptions,
  staffAppointmentsQueryOptions,
  staffCoachesQueryOptions,
  updateStaffCoachProfileMutationOptions,
} from "@fittrack/query";
import { coachProfileSchema } from "@fittrack/validators";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useSchedule, type VenueBookingRecord } from "@/contexts/ScheduleContext";
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
  DetailsModal,
  StaffDetailsModal,
} from "@/components/modals";
import {
  GymOperationsAvailabilityDrawer,
  GymOperationsCoachAppointmentModal,
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

const EMPTY_APPOINTMENT_RESULT = {
  data: [] as StaffAppointmentRecord[],
  meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
};

const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Pending coach", value: "pending_coach" },
  { label: "Pending payment", value: "pending_payment" },
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
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function normalizeOperationsTab(
  value: string | null,
  canManageCoaching: boolean,
): GymOperationsTab {
  if (canManageCoaching && value === "coaches") return "coaches";
  return "schedule";
}

function normalizeScheduleSurfaceTab(
  value: string | null,
): ScheduleSurfaceTab {
  if (value === "venues") return "venue-bookings";
  return "coach-schedule";
}

const COACH_PROFILE_FIELDS: FieldConfig[] = [
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
    case "pending_payment":
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

function canRespondToAppointment(status?: string) {
  return status === "pending_coach";
}

function canCompleteAppointment(status?: string) {
  return status === "confirmed";
}

function canCancelAppointment(status?: string) {
  return (
    status === "pending_coach" ||
    status === "pending_payment" ||
    status === "confirmed"
  );
}

function getAppointmentActionLabel(status?: string) {
  switch (status) {
    case "pending_coach":
      return "Review";
    case "confirmed":
      return "Open";
    case "pending_payment":
      return "Follow up";
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

function toAppointmentActionLabel(appointment: StaffAppointmentRecord) {
  const memberName = getPersonDisplayName(
    appointment.user.profile,
    appointment.user.email,
    "Member",
  );
  const coachName = getPersonDisplayName(
    appointment.coach.profile,
    undefined,
    "Coach",
  );
  const { dateLabel, timeLabel } = formatAppointmentWindow(appointment);
  return `${memberName} with ${coachName} - ${dateLabel} - ${timeLabel}`;
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
        <FitText excludeGlobalScale style={{ fontSize: 14, color: colors.textMuted }}>
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
        const coachName = getPersonDisplayName(
          appointment.coach.profile,
          null,
          "Coach",
        );
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
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
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
                <FitText excludeGlobalScale style={{ fontSize: 10, fontWeight: 700, color: colors.brand }}>
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
                    color: colors.textMuted,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {appointment.user.email ?? "No email recorded"}
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
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted }}>
                {appointment.coach.hourlyRate != null
                  ? `PHP ${appointment.coach.hourlyRate.toLocaleString("en-PH")}/hr`
                  : "Rate not set"}
              </FitText>
            </div>

            <div style={{ minWidth: 0 }}>
              <FitText excludeGlobalScale style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>
                {dateLabel}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted }}>
                {timeLabel} - {appointment.duration} mins
              </FitText>
            </div>

            <FitPill
              mode="status"
              label={getReadableStatus(appointment.status).toUpperCase()}
              color={getAppointmentStatusColor(appointment.status, colors)}
              fontSize={10}
              fontWeight={700}
              borderOpacity="35"
              bgOpacity="14"
            />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {appointment.status === "cancelled" || appointment.status === "no_show" ? (
                <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted }}>
                  Closed
                </FitText>
              ) : (
                <FitButton
                  variant={
                    appointment.status === "pending_coach" ? "primary" : "ghost"
                  }
                  label={getAppointmentActionLabel(appointment.status).toUpperCase()}
                  onClick={() => onOpenReview(appointment)}
                  style={{ minHeight: 30, padding: "6px 14px", borderRadius: 15 }}
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
  onOpenReview,
}: {
  bookings: VenueBookingRecord[];
  colors: ReturnType<typeof useTheme>["colors"];
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
        <FitText excludeGlobalScale style={{ fontSize: 14, color: colors.textMuted }}>
          No venue bookings match the current filters.
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
              <FitText excludeGlobalScale style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>
                {memberName}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted }}>
                {booking.user?.email ?? "No email recorded"}
              </FitText>
            </div>
            <div style={{ minWidth: 0 }}>
              <FitText excludeGlobalScale style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>
                {booking.venue?.name ?? `Venue ${booking.venueId}`}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted }}>
                {booking.purpose?.trim() || "General venue use"}
              </FitText>
            </div>
            <div style={{ minWidth: 0 }}>
              <FitText excludeGlobalScale style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>
                {start.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 10.5, color: colors.textMuted }}>
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
              label={(booking.status ?? "pending").toUpperCase()}
              color={
                booking.status === "pending"
                  ? colors.warning
                  : booking.status === "confirmed"
                    ? colors.success
                    : booking.status === "completed"
                      ? colors.textMuted
                      : colors.danger
              }
              fontSize={10}
              fontWeight={700}
              borderOpacity="35"
              bgOpacity="14"
            />
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              {booking.status === "cancelled" ? (
                <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.textMuted }}>
                  Closed
                </FitText>
              ) : (
                <FitButton
                  variant={booking.status === "pending" ? "primary" : "ghost"}
                  label={getVenueBookingActionLabel(booking.status).toUpperCase()}
                  onClick={() => onOpenReview(booking)}
                  style={{ minHeight: 30, padding: "6px 14px", borderRadius: 15 }}
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
    bookings: scheduleBookings,
    confirmBooking,
    rejectBooking,
    rawBookings,
    isLoading: scheduleLoading,
  } = useSchedule();
  const fadeIn = useFadeIn();
  const themeTransition = useThemeTransition();

  const showFeedback = (nextMessage: string, tone: "danger" | "success" = "success") => {
    if (tone === "danger") {
      toast.error(nextMessage);
      return;
    }
    toast.success(nextMessage);
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
  const [coachVisibilityScope, setCoachVisibilityScope] = useState<"all" | "visible">("all");
  const [manualBookings, setManualBookings] = useState<Booking[]>([]);
  const [bookingOverrides, setBookingOverrides] = useState<
    Record<string, Pick<Booking, "date" | "startHour" | "startMinute">>
  >({});
  const [draggingCoach, setDraggingCoach] = useState<Resource | null>(null);
  const [draggingBooking, setDraggingBooking] = useState<Booking | null>(null);
  const [coachFilterId, setCoachFilterId] = useState<string | null>(null);
  const [appointmentStatusFilter, setAppointmentStatusFilter] =
    useState("all");
  const [venueFilterId, setVenueFilterId] = useState("all");
  const [venueStatusFilter, setVenueStatusFilter] = useState("all");
  const [availabilityEditorCoachId, setAvailabilityEditorCoachId] =
    useState<string | null>(null);
  const [profileEditorCoachId, setProfileEditorCoachId] =
    useState<string | null>(null);
  const [appointmentReviewTarget, setAppointmentReviewTarget] =
    useState<StaffAppointmentRecord | null>(null);
  const [venueReviewTarget, setVenueReviewTarget] =
    useState<VenueBookingRecord | null>(null);

  const { data: coachProfiles = [] } = useQuery({
    ...staffCoachesQueryOptions(webApiClient),
    enabled: canManageCoaching,
    staleTime: 60_000,
  });

  const appointmentFilters = useMemo(
    () => ({
      limit: 100,
      page: 1,
      ...(coachFilterId ? { coachId: coachFilterId } : {}),
      ...(appointmentStatusFilter !== "all"
        ? { status: appointmentStatusFilter }
        : {}),
    }),
    [appointmentStatusFilter, coachFilterId],
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

  const coachRoster = useMemo(
    () => mapCoachesToRoster(coachProfiles),
    [coachProfiles],
  );

  const coachOptions = useMemo(
    () =>
      coachRoster.map((coach) => ({
        label: coach.name,
        value: coach.id,
      })),
    [coachRoster],
  );

  const apiBookings = useMemo<Booking[]>(
    () =>
      scheduleBookings.map((booking) => ({
        ...booking,
        source: "api" as const,
      })),
    [scheduleBookings],
  );

  const allBookings = useMemo(
    () =>
      [...apiBookings, ...manualBookings].map((booking) => {
        const override = bookingOverrides[booking.id];
        return override ? { ...booking, ...override } : booking;
      }),
    [apiBookings, bookingOverrides, manualBookings],
  );

  const filteredStaff = useMemo(
    () =>
      coachRoster.filter((coach) => {
        if (
          coachVisibilityScope === "visible" &&
          !coach.isActive
        ) {
          return false;
        }
        return coach.name.toLowerCase().includes(debouncedQuery.toLowerCase());
      }),
    [coachRoster, coachVisibilityScope, debouncedQuery],
  );

  const coachAppointments = appointmentResult.data;
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
  const availabilityEditorCoach = useMemo(
    () =>
      coachProfiles.find((coach) => coach.id === availabilityEditorCoachId) ?? null,
    [availabilityEditorCoachId, coachProfiles],
  );
  const profileEditorCoach = useMemo(
    () => coachProfiles.find((coach) => coach.id === profileEditorCoachId) ?? null,
    [coachProfiles, profileEditorCoachId],
  );
  const reviewCoachProfile = useMemo(
    () =>
      appointmentReviewTarget
        ? coachProfiles.find((coach) => coach.id === appointmentReviewTarget.coachId) ?? null
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
        (reviewCoachProfile?.certifications?.length ?? 0) > 0 ? "clear" : "review",
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

  const sensors = useFitSensors();

  const handleDragStart = (event: DragStartEvent) => {
    const activeData = event.active.data.current as
      | { kind?: "coach"; coachId?: string }
      | { kind?: "booking"; bookingId?: string }
      | undefined;

    if (activeData?.kind === "coach" && activeData.coachId) {
      const coach = coachRoster.find((resource) => resource.id === activeData.coachId);
      if (coach) setDraggingCoach(coach);
      return;
    }

    if (activeData?.kind === "booking" && activeData.bookingId) {
      const booking = allBookings.find((item) => item.id === activeData.bookingId);
      if (booking) setDraggingBooking(booking);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingCoach(null);
    setDraggingBooking(null);
    if (!event.over || !isAdmin) return;
    const [dayIndexValue, hourValue] = String(event.over.id).split(":");
    const dayIndex = Number(dayIndexValue);
    const hour = Number(hourValue);
    const activeData = event.active.data.current as
      | { kind?: "coach"; coachId?: string }
      | { kind?: "booking"; bookingId?: string }
      | undefined;
    if (Number.isNaN(dayIndex) || Number.isNaN(hour)) return;

    if (activeData?.kind === "coach" && activeData.coachId) {
      const coach = coachRoster.find((resource) => resource.id === activeData.coachId);
      if (!coach) return;
      const booking = buildManualBooking(coach, weekDays[dayIndex], hour, colors.brand);
      setManualBookings((previous) => [...previous, booking]);
      showFeedback(
        `${coach.name} assigned to ${weekDays[dayIndex].toLocaleDateString("en-US", {
          weekday: "short",
        })} ${hour}:00`,
      );
      return;
    }

    if (activeData?.kind === "booking" && activeData.bookingId) {
      const booking = allBookings.find((item) => item.id === activeData.bookingId);
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
        `${booking.resourceName} moved to ${weekDays[dayIndex].toLocaleDateString("en-US", {
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
    setActiveBlock(block);
    setBlockDetailOpen(true);
  };

  const handleBlockSave = (updated: Booking) => {
    setManualBookings((previous) =>
      previous.map((booking) => (booking.id === updated.id ? updated : booking)),
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
    if (venueFilterId === "all") return;
    if (rawBookings.some((booking) => String(booking.venueId) === venueFilterId)) return;
    setVenueFilterId("all");
  }, [venueFilterId, rawBookings]);

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
          `${firstName} ${lastName}`.trim() ||
          booking.user?.email ||
          "Member";
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <FitText
              style={{ fontSize: 14, fontWeight: 700, color: palette.textPrimary }}
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
              style={{ fontSize: 14, fontWeight: 700, color: palette.textPrimary }}
            >
              {getPersonDisplayName(
                booking.coach.user?.profile,
                booking.coach.user?.email ?? null,
                "Coach",
              )}
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
        new Map(
          rawBookings.map((booking) => [
            String(booking.venueId),
            {
              label: booking.venue?.name ?? `Venue ${booking.venueId}`,
              value: String(booking.venueId),
            },
          ]),
        ).values(),
      ),
    [rawBookings],
  );

  const venueFilterOptions = useMemo(
    () => [{ label: "All venues", value: "all" }, ...venueOptions],
    [venueOptions],
  );

  const filteredVenueBookings = useMemo(
    () =>
      rawBookings.filter((booking) => {
        if (venueFilterId !== "all" && String(booking.venueId) !== venueFilterId) {
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
      activeVenues: new Set(filteredVenueBookings.map((booking) => booking.venueId))
        .size,
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
  }, [
    activeOperationsTab,
    canManageCoaching,
    pathname,
    router,
    searchParams,
  ]);

  useEffect(() => {
    const currentSurfaceParam = searchParams.get("schedule_view");
    const normalizedSurfaceParam = normalizeScheduleSurfaceTab(currentSurfaceParam);

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
  }, [
    activeScheduleSurfaceTab,
    pathname,
    router,
    searchParams,
  ]);

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

  const handleRejectAppointment = async (appointment: StaffAppointmentRecord, value: string) => {
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

  const handleCancelAppointment = async (appointment: StaffAppointmentRecord, value: string) => {
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

  const handleCompleteAppointment = async (appointment: StaffAppointmentRecord, value: string) => {
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

    try {
      await updateCoachProfileMutation.mutateAsync({
        coachId: profileEditorCoach.id,
        payload: {
          bio: parsed.data.bio || undefined,
          specialties: parsed.data.specialties,
          certifications: parsed.data.certifications,
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

  const handleHideCoachFromBooking = async (coachId: string) => {
    const coach = coachProfiles.find((item) => item.id === coachId);
    if (!coach) return;

    try {
      await updateCoachProfileMutation.mutateAsync({
        coachId: coach.id,
        payload: {
          bio: coach.bio ?? undefined,
          certifications: coach.certifications ?? [],
          hourlyRate: coach.hourlyRate ?? undefined,
          isAvailableForBooking: false,
          specialties: coach.specialties ?? [],
        },
      });
      showFeedback("Coach hidden from booking.");
    } catch (error) {
      showFeedback(
        getErrorMessage(error, "Unable to hide coach from booking."),
        "danger",
      );
    }
  };

  const handleApproveVenueBooking = async (note: string) => {
    if (!venueReviewTarget) return;

    const result = await confirmBooking(venueReviewTarget.id);
    if (!result.success) {
      showFeedback(result.error ?? "Unable to approve venue booking.", "danger");
      return;
    }

    showFeedback(note ? "Venue booking approved and note captured." : "Venue booking approved.");
    setVenueReviewTarget(null);
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

  const handleRequestVenueReschedule = (note: string) => {
    if (!venueReviewTarget) return;
    showFeedback(
      note
        ? "Requested a new venue slot and saved the staff note."
        : "Requested a new venue slot.",
    );
    setVenueReviewTarget(null);
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
                style={{ fontSize: 34, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.08 }}
              >
                Gym Operations
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, fontWeight: 700, color: colors.brand, letterSpacing: "0.08em" }}
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
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                {activeOperationsTab === "schedule" ? (
                  <>
                    <FitButton
                      variant="primary"
                      label="WEEK VIEW"
                      disabled
                      style={{ minHeight: 36, borderRadius: 18, padding: "8px 14px" }}
                      textStyle={{ fontSize: 13, fontWeight: 700 }}
                    />
                    <FitButton
                      variant="ghost"
                      label={coachFilterId ? "COACH FILTERED" : "COACH FILTER"}
                      onClick={() => {
                        if (coachFilterId) setCoachFilterId(null);
                      }}
                      style={{ minHeight: 36, borderRadius: 18, padding: "8px 14px" }}
                      textStyle={{ fontSize: 13, fontWeight: 700 }}
                    />
                    <FitButton
                      variant="ghost"
                      label="OPEN CALENDAR"
                      onClick={() => setCalendarOpen(true)}
                      style={{ minHeight: 36, borderRadius: 18, padding: "8px 14px" }}
                      textStyle={{ fontSize: 13, fontWeight: 700 }}
                    />
                  </>
                ) : (
                  <>
                    <FitButton
                      variant="primary"
                      label="ALL COACHES"
                      onClick={() => {
                        setCoachFilterId(null);
                        setCoachVisibilityScope("all");
                      }}
                      style={{ minHeight: 36, borderRadius: 18, padding: "8px 14px" }}
                      textStyle={{ fontSize: 13, fontWeight: 700 }}
                    />
                    <FitButton
                      variant="ghost"
                      label={coachVisibilityScope === "visible" ? "VISIBLE ONLY" : "BOOKING VISIBLE"}
                      onClick={() =>
                        setCoachVisibilityScope((current) =>
                          current === "visible" ? "all" : "visible",
                        )
                      }
                      style={{ minHeight: 36, borderRadius: 18, padding: "8px 14px" }}
                      textStyle={{ fontSize: 13, fontWeight: 700 }}
                    />
                    <FitButton
                      variant="ghost"
                      label="EDIT PROFILE"
                      onClick={() => {
                        if (!selectedCoachProfile) return;
                        setProfileEditorCoachId(selectedCoachProfile.id);
                      }}
                      disabled={!selectedCoachProfile}
                      style={{ minHeight: 36, borderRadius: 18, padding: "8px 14px" }}
                      textStyle={{ fontSize: 13, fontWeight: 700 }}
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {activeOperationsTab === "schedule" && !isAdmin ? (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  padding: 14,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                  Pending Approvals
                </FitText>
                <FitText style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                  {pendingBookings.length}
                </FitText>
              </div>
              <div
                style={{
                  padding: 14,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                  Confirmed Bookings
                </FitText>
                <FitText style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                  {
                    rawBookings.filter((booking) => booking.status === "confirmed")
                      .length
                  }
                </FitText>
              </div>
              <div
                style={{
                  padding: 14,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                  All Visible Bookings
                </FitText>
                <FitText style={{ fontSize: 24, fontWeight: 700, marginTop: 4 }}>
                  {rawBookings.length}
                </FitText>
              </div>
            </div>
            <FitSection heading="Booking Operations" className="mb-0">
              <div style={{ marginBottom: 12 }}>
                <FitText style={{ fontSize: 13, color: colors.textMuted }}>
                  Booking statuses now follow the live payment workflow. Staff can
                  monitor bookings here, while status changes are handled by payment
                  and cancellation flows.
                </FitText>
              </div>
              <FitTable
                columns={staffColumns}
                rows={rawBookings}
                getRowKey={(booking) => booking.id}
                isLoading={scheduleLoading}
                loadingMessage="Loading staff bookings..."
                emptyMessage="No bookings available."
              />
            </FitSection>
          </>
        ) : activeOperationsTab === "schedule" ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
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
                  bookings={allBookings}
                  canDrag={isAdmin}
                  canSelect={isAdmin}
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
                      Review appointment pressure, shift the active week, and drag coaches
                      directly into the live floor grid.
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
                          <CalendarDays size={16} color={colors.brand} strokeWidth={2} />
                          <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: colors.brand }}>
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
                        bookings={allBookings}
                        slideStyle={slideStyle as MotionStyle}
                        isLoading={scheduleLoading}
                        colors={colors}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
                        <FitText excludeGlobalScale style={controlLabelStyle}>
                          Venue Filter
                        </FitText>
                        <FitSelect
                          value={venueFilterId}
                          onChange={(event) => setVenueFilterId(event.target.value || "all")}
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
                          onChange={(event) => setVenueStatusFilter(event.target.value || "all")}
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
                      <FitText excludeGlobalScale style={{ fontSize: 14, color: colors.textMuted }}>
                        Loading venue bookings...
                      </FitText>
                    </div>
                  ) : (
                    <VenueBookingsTable
                      bookings={filteredVenueBookings}
                      colors={colors}
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
                    style={{ fontSize: 11, fontWeight: 700, color: colors.brand, letterSpacing: "0.08em" }}
                  >
                    COACH APPOINTMENTS
                  </FitText>
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary, lineHeight: 1.2 }}
                  >
                    Appointment control
                  </FitText>
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.45, letterSpacing: 0 }}
                  >
                    Review pending coach decisions, payment-held sessions, and completions without leaving the main
                    operations tab.
                  </FitText>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
                  label={coachFilterId ? "Selected Coach Slots" : "Preview Coach Slots"}
                  value={
                    selectedCoachProfile
                      ? selectedCoachProfile.availability?.length ?? 0
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
                  <FitText excludeGlobalScale style={{ fontSize: 14, color: colors.textMuted }}>
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
                    style={{ fontSize: 11, fontWeight: 700, color: colors.brand, letterSpacing: "0.08em" }}
                  >
                    COACH DATA MANAGEMENT
                  </FitText>
                  <FitText
                    excludeGlobalScale
                    style={{ fontSize: 18, color: colors.textPrimary, lineHeight: 1.3, fontWeight: 700 }}
                  >
                    Maintain coach-facing booking trust, weekly availability, and member-visible profile quality from one contained tab.
                  </FitText>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ display: "grid", gap: 6, minWidth: 220 }}>
                    <FitText excludeGlobalScale style={controlLabelStyle}>
                      Focus coach
                    </FitText>
                    <FitSelect
                      value={coachFilterId ?? ""}
                      onChange={(event) => setCoachFilterId(event.target.value || null)}
                      options={coachOptions}
                      placeholder="All coaches"
                      compact
                      fullWidth
                    />
                  </div>
                </div>
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
                  bookings={allBookings}
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
                    event.currentTarget.style.transform = fullMotion ? "translateY(-1px)" : "translateY(-0.5px)";
                    event.currentTarget.style.boxShadow = "0 12px 26px rgba(0,0,0,0.14)";
                    event.currentTarget.style.borderColor = `${colors.brand}24`;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.transform = "none";
                    event.currentTarget.style.boxShadow = "none";
                    event.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <FitText
                        excludeGlobalScale
                        style={{ fontSize: 11, fontWeight: 700, color: colors.brand, letterSpacing: "0.08em" }}
                      >
                        COACH DATA MANAGEMENT
                      </FitText>
                      <FitText
                        excludeGlobalScale
                        style={{ fontSize: 30, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.02 }}
                      >
                        {selectedCoachRoster?.name ?? "Choose a coach from the roster"}
                      </FitText>
                      <FitText excludeGlobalScale style={{ fontSize: 10, color: colors.textMuted }}>
                        {selectedCoachRoster?.email ??
                          "Select a coach to repair visibility, availability, and member-facing booking trust."}
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
                      tone={selectedCoachRoster?.hourlyRate != null ? colors.brand : colors.textPrimary}
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
                      <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                        Availability snapshot
                      </FitText>
                      {(selectedCoachProfile?.availability?.length ?? 0) > 0 ? (
                        selectedCoachProfile?.availability?.slice(0, 4).map((slot) => (
                          <FitText
                            key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`}
                            excludeGlobalScale
                            style={{ fontSize: 12, color: colors.textSecondary }}
                          >
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`} / {slot.startTime} - {slot.endTime}
                          </FitText>
                        ))
                      ) : (
                        <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
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
                      <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                        Specialties
                      </FitText>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {(selectedCoachRoster?.specialties ?? []).length > 0 ? (
                          selectedCoachRoster?.specialties.map((specialty, index) => (
                            <FitPill
                              key={specialty}
                              mode="status"
                              label={specialty.toUpperCase()}
                              color={index === 0 ? colors.brand : colors.textMuted}
                              fontSize={9}
                              fontWeight={700}
                              borderOpacity="28"
                              bgOpacity="12"
                            />
                          ))
                        ) : (
                          <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
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
                    <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
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
                    <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
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
                      style={{ minHeight: 36, padding: "8px 12px", borderRadius: 10 }}
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
                      style={{ minHeight: 36, padding: "8px 12px", borderRadius: 10 }}
                      textStyle={{ fontSize: 11, fontWeight: 700 }}
                    />
                    <FitButton
                      variant="ghost"
                      label="EDIT PROFILE"
                      onClick={() => {
                        if (!selectedCoachProfile) return;
                        setProfileEditorCoachId(selectedCoachProfile.id);
                      }}
                      disabled={!selectedCoachProfile}
                      style={{ minHeight: 36, padding: "8px 12px", borderRadius: 10 }}
                      textStyle={{ fontSize: 11, fontWeight: 700 }}
                    />
                    <FitButton
                      variant="ghost"
                      label="OPEN IN SCHEDULE"
                      onClick={() => setActiveOperationsTab("schedule")}
                      disabled={!selectedCoachProfile}
                      style={{ minHeight: 36, padding: "8px 12px", borderRadius: 10 }}
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
                    event.currentTarget.style.transform = fullMotion ? "translateY(-1px)" : "translateY(-0.5px)";
                    event.currentTarget.style.boxShadow = "0 12px 26px rgba(0,0,0,0.14)";
                    event.currentTarget.style.borderColor = `${colors.brand}24`;
                  }}
                  onMouseLeave={(event) => {
                    event.currentTarget.style.transform = "none";
                    event.currentTarget.style.boxShadow = "none";
                    event.currentTarget.style.borderColor = colors.border;
                  }}
                >
                  <FitText excludeGlobalScale style={{ fontSize: 16, fontWeight: 700, color: colors.textPrimary }}>
                    Readiness + trust
                  </FitText>
                  <FitText excludeGlobalScale style={{ fontSize: 11, color: colors.brand, fontWeight: 700, letterSpacing: "0.08em" }}>
                    VISIBILITY / CREDENTIALS / AVAILABILITY GAPS
                  </FitText>

                  <OperationsMetricCard
                    colors={colors}
                    label="Booking Visibility"
                    value={selectedCoachProfile?.isActive ? "Visible" : "Hidden"}
                    tone={selectedCoachProfile?.isActive ? colors.success : colors.warning}
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
                          !focusedCoachId || appointment.coachId === focusedCoachId,
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
                    <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                      Credential notes
                    </FitText>
                    {(selectedCoachRoster?.certifications ?? []).length > 0 ? (
                      selectedCoachRoster?.certifications.map((certification) => (
                        <FitText key={certification} excludeGlobalScale style={{ fontSize: 12, color: colors.textSecondary }}>
                          {certification}
                        </FitText>
                      ))
                    ) : (
                      <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
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
                    <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                      Operational note
                    </FitText>
                    <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
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
          bookings={allBookings.filter((booking) => booking.resourceId === activeCoachId)}
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
        <GymOperationsCoachAppointmentModal
          appointment={appointmentReviewTarget}
          coachReadiness={appointmentReviewReadiness}
          isOpen={!!appointmentReviewTarget}
          isSubmitting={
            respondAppointmentMutation.isPending ||
            completeAppointmentMutation.isPending ||
            cancelAppointmentMutation.isPending
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
        />
        <GymOperationsAvailabilityDrawer
          isOpen={!!availabilityEditorCoach}
          coachName={
            availabilityEditorCoach
              ? getPersonDisplayName(
                  availabilityEditorCoach.user?.profile,
                  availabilityEditorCoach.user?.email,
                  "Coach",
                )
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
          onHideFromBooking={() => {
            if (!availabilityEditorCoach) return;
            void handleHideCoachFromBooking(availabilityEditorCoach.id);
          }}
        />
        <GymOperationsVenueBookingModal
          booking={venueReviewTarget}
          isOpen={!!venueReviewTarget}
          isSubmitting={scheduleLoading}
          onClose={() => setVenueReviewTarget(null)}
          onApprove={(note) => void handleApproveVenueBooking(note)}
          onReject={(note) => void handleRejectVenueBooking(note)}
          onRequestNewSlot={(note) => handleRequestVenueReschedule(note)}
        />
        <DetailsModal
          isOpen={!!profileEditorCoach}
          title={
            profileEditorCoach
              ? `${getPersonDisplayName(
                  profileEditorCoach.user?.profile,
                  profileEditorCoach.user?.email,
                  "Coach",
                )} Profile`
              : "Coach Profile"
          }
          subtitle="Keep this member-facing profile trustworthy before new bookings."
          fields={COACH_PROFILE_FIELDS}
          initialValues={
            profileEditorCoach
              ? {
                  bio: profileEditorCoach.bio ?? "",
                  specialties: (profileEditorCoach.specialties ?? []).join(", "),
                  certifications: (profileEditorCoach.certifications ?? []).join(", "),
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
            Years of experience is still outside the live coach-profile contract,
            so this management pass focuses on the fields members can already
            see during booking review.
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
