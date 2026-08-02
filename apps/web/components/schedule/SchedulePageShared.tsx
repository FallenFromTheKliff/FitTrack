"use client";

import { type CSSProperties, type ReactNode } from "react";
import { CalendarDays, ClipboardList, UsersRound } from "lucide-react";
import type {
  RecurringCoachingBillingCycleRecord,
  RecurringCoachingPlanInput,
  StaffAppointmentRecord,
} from "@fittrack/api-client";
import { toYmd } from "@fittrack/utils";

import { FitText } from "@/components/fit";
import type { FieldConfig } from "@/components/modals";
import type { VenueBookingRecord } from "@/contexts/ScheduleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { COACH_SPECIALTY_OPTIONS } from "./GymOperationsOverlayShared";

import { addDays } from "@/app/(auth)/schedule/helpers";

export type GymOperationsTab = "schedule" | "coaches" | "appointments";
export type ScheduleSurfaceTab =
  | "month-calendar"
  | "coach-schedule"
  | "venue-bookings";
export type ScheduleRangeMode = "weekly" | "daily";
export type CoachVisibilityScope = "all" | "hidden" | "visible";
export type RecurringPlanActionMode = "single" | "future" | "cancel";
export type PaymentCollectionProvider = "cash" | "paymongo";
export type PaymentConfirmState =
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
      kind: "coachPaymentApproval";
      appointment: StaffAppointmentRecord;
      paymentId: string;
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

export type RecurringPlanFormState = {
  coachId: string;
  durationMinutes: number;
  durationMonths: number;
  frequency: "weekly" | "biweekly" | "monthly";
  memberId: string;
  preferredDays: number[];
  preferredTime: string;
  quotedAmount: number;
  scheduleItems: Array<{
    date: string;
    durationMinutes: number;
    time: string;
  }>;
  startDate: string;
  trainingPlanId: string;
};

export type RecurringPlanActionState = {
  appointment: StaffAppointmentRecord;
  mode: RecurringPlanActionMode;
};

export const EMPTY_APPOINTMENT_RESULT = {
  data: [] as StaffAppointmentRecord[],
  meta: { page: 1, limit: 100, total: 0, total_pages: 0 },
};

export const STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Pending coach", value: "pending_coach" },
  { label: "Pending payment", value: "pending_payment" },
  { label: "Pending full payment", value: "pending_full_payment" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "No show", value: "no_show" },
];

const GYM_OPERATIONS_TABS: Array<{ key: GymOperationsTab; label: string }> = [
  { key: "schedule", label: "Schedule" },
  { key: "coaches", label: "Coaches" },
  { key: "appointments", label: "Appointments" },
];

export const SCHEDULE_SURFACE_TABS: Array<{
  key: ScheduleSurfaceTab;
  label: string;
}> = [
  { key: "month-calendar", label: "Month Calendar" },
  { key: "coach-schedule", label: "Coach Schedule" },
  { key: "venue-bookings", label: "Venue Bookings" },
];

export const SCHEDULE_TIMELINE_HOURS = Array.from(
  { length: 17 },
  (_, index) => index + 7,
);

export const VENUE_STATUS_OPTIONS = [
  { label: "All statuses", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Pending full payment", value: "balance_pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "No show", value: "no_show" },
];

export const COACH_VISIBILITY_SCOPE_OPTIONS = [
  { label: "All profiles", value: "all" },
  { label: "Visible", value: "visible" },
  { label: "Hidden", value: "hidden" },
];

export const WEEKDAY_OPTIONS = [
  { label: "Sun", value: 0 },
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export const RECURRING_FREQUENCY_OPTIONS = [
  { label: "Weekly", value: "weekly" },
  { label: "Biweekly", value: "biweekly" },
  { label: "Monthly — actual dates", value: "monthly" },
];

export const RECURRING_DURATION_OPTIONS = [
  { label: "1 month", value: "1" },
  { label: "3 months", value: "3" },
  { label: "6 months", value: "6" },
];

export function createDefaultRecurringPlanForm(): RecurringPlanFormState {
  const tomorrow = addDays(new Date(), 1);
  return {
    coachId: "",
    durationMinutes: 60,
    durationMonths: 1,
    frequency: "monthly",
    memberId: "",
    preferredDays: [tomorrow.getDay()],
    preferredTime: "09:00",
    quotedAmount: 0,
    scheduleItems: [],
    startDate: toYmd(tomorrow),
    trainingPlanId: "",
  };
}

export function createFreshMonthlyScheduleDraft(
  sessionCount: number,
  durationMinutes: number,
  preferredTime: string,
) {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const daysInMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();
  const sessionsByGymWeek = new Map<string, number>();
  const rows: RecurringPlanFormState["scheduleItems"] = [];

  for (
    let day = 1;
    day <= daysInMonth && rows.length < sessionCount;
    day += 1
  ) {
    const date = new Date(monthStart.getFullYear(), monthStart.getMonth(), day);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const weekKey = toYmd(weekStart);
    const count = sessionsByGymWeek.get(weekKey) ?? 0;
    if (count >= 5) continue;
    sessionsByGymWeek.set(weekKey, count + 1);
    rows.push({
      date: toYmd(date),
      durationMinutes,
      time: preferredTime,
    });
  }

  return rows;
}

export function getRecurringScheduleIssue(
  scheduleItems: RecurringPlanFormState["scheduleItems"],
  expectedCount?: number,
) {
  if (expectedCount != null && scheduleItems.length !== expectedCount) {
    return `Add exactly ${expectedCount} actual session date${expectedCount === 1 ? "" : "s"} from the monthly offer.`;
  }

  const seen = new Set<string>();
  const sessionsByGymWeek = new Map<string, number>();
  const monthKey = scheduleItems[0]?.date.slice(0, 7) ?? "";

  for (const item of scheduleItems) {
    if (!item.date || !item.time) {
      return "Every monthly session needs an actual date and time.";
    }
    if (!Number.isFinite(item.durationMinutes) || item.durationMinutes <= 0) {
      return "Every monthly session needs a valid duration.";
    }
    if (!monthKey || item.date.slice(0, 7) !== monthKey) {
      return "Every session in a fresh plan must stay inside the same calendar month.";
    }

    const slotKey = `${item.date}T${item.time}`;
    if (seen.has(slotKey)) {
      return `Duplicate session date and time: ${item.date} at ${item.time}.`;
    }
    seen.add(slotKey);

    const date = new Date(`${item.date}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return "One or more monthly session dates are invalid.";
    }
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const weekKey = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    const weekCount = (sessionsByGymWeek.get(weekKey) ?? 0) + 1;
    if (weekCount > 5) {
      return `A monthly plan cannot place more than five sessions in the gym week of ${weekKey}.`;
    }
    sessionsByGymWeek.set(weekKey, weekCount);
  }

  return null;
}

export function buildLocalIso(date: string, time: string) {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function formatRecurringDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatScheduleDay(value: Date) {
  return value.toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getRecurringInput(
  form: RecurringPlanFormState,
  conflictOverrides?: RecurringCoachingPlanInput["sessionOverrides"],
): RecurringCoachingPlanInput {
  const scheduleItems =
    form.frequency === "monthly" && form.scheduleItems.length > 0
      ? form.scheduleItems.map((item, index) => ({
          durationMinutes: item.durationMinutes,
          scheduledAt: buildLocalIso(item.date, item.time),
          sequenceIndex: index + 1,
        }))
      : undefined;
  const preferredDays =
    form.frequency === "monthly" && scheduleItems?.length
      ? Array.from(
          new Set(
            scheduleItems.map((item) => new Date(item.scheduledAt).getUTCDay()),
          ),
        )
      : form.preferredDays;

  return {
    coachId: form.coachId,
    durationMinutes: form.durationMinutes,
    durationMonths: form.durationMonths,
    frequency: form.frequency,
    memberId: form.memberId,
    preferredDays,
    preferredTime: form.preferredTime,
    ...(form.quotedAmount > 0 ? { quotedAmount: form.quotedAmount } : {}),
    ...(scheduleItems?.length ? { scheduleItems } : {}),
    sessionOverrides: conflictOverrides,
    startDate: form.startDate,
    ...(form.trainingPlanId ? { trainingPlanId: form.trainingPlanId } : {}),
  };
}

export function normalizeOperationsTab(
  value: string | null,
  canManageGymOperations: boolean,
): GymOperationsTab {
  if (canManageGymOperations && value === "coaches") return "coaches";
  if (canManageGymOperations && value === "appointments") return "appointments";
  return "schedule";
}

export function normalizeScheduleSurfaceTab(
  value: string | null,
  canViewVenueBookings = true,
): ScheduleSurfaceTab {
  if (!canViewVenueBookings) return "coach-schedule";
  if (canViewVenueBookings && value === "venues") return "venue-bookings";
  if (value === "coaches") return "coach-schedule";
  return "month-calendar";
}

export const COACH_PROFILE_FIELDS: FieldConfig[] = [
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
    type: "multi-select",
    required: true,
    options: [...COACH_SPECIALTY_OPTIONS],
    hint: "Select the specialties shown on coach cards and booking surfaces.",
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
    name: "monthlyOfferActive",
    label: "Monthly Offer",
    type: "select",
    required: true,
    hint: "Admin/staff configure whether this coach's monthly offer is shown to members.",
    options: [
      { label: "Active", value: "active" },
      { label: "Inactive", value: "inactive" },
    ],
  },
  {
    name: "monthlyRate",
    label: "Monthly Rate",
    type: "text",
    placeholder: "e.g. 12000",
    hint: "Full monthly quote in Philippine pesos.",
  },
  {
    name: "monthlySessionCount",
    label: "Included Sessions",
    type: "text",
    placeholder: "e.g. 12",
  },
  {
    name: "monthlySessionDurationMinutes",
    label: "Session Duration (minutes)",
    type: "text",
    placeholder: "e.g. 60",
  },
  {
    name: "monthlyOfferDescription",
    label: "Monthly Offer Description",
    type: "textarea",
    placeholder: "Describe the monthly coaching offer members can review.",
  },
  {
    name: "scheduleType",
    label: "Working Schedule",
    type: "select",
    required: true,
    hint: "Marks whether this coach is tracked as full-time or part-time.",
    options: [
      { label: "Full-time", value: "full_time" },
      { label: "Part-time", value: "part_time" },
    ],
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

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function OperationsMetricCard({
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

  return (
    <div
      style={{
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surface,
        padding: "10px 12px",
        display: "grid",
        gap: 4,
        transition: canAnimate
          ? "border-color 160ms ease, background-color 160ms ease"
          : "border-color 160ms ease, background-color 160ms ease",
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

export function OperationsMetricGrid({
  children,
  columns = 4,
}: {
  children: ReactNode;
  columns?: number;
}) {
  return (
    <div
      className="gym-operations-metric-grid"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}

export function OperationsLoadingBlock({
  colors,
  maxHeight = 112,
  message,
}: {
  colors: ReturnType<typeof useTheme>["colors"];
  maxHeight?: number;
  message: string;
}) {
  return (
    <div
      style={{
        minHeight: maxHeight,
        maxHeight,
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        backgroundColor: colors.surfaceRaised,
        padding: maxHeight > 130 ? "20px 22px" : "16px 18px",
        display: "flex",
        alignItems: "center",
      }}
    >
      <FitText
        excludeGlobalScale
        style={{ fontSize: 14, color: colors.textMuted }}
      >
        {message}
      </FitText>
    </div>
  );
}

export function OperationsControlField({
  children,
  label,
  minWidth,
  style,
}: {
  children: ReactNode;
  label: string;
  minWidth: number;
  style?: CSSProperties;
}) {
  const { colors } = useTheme();

  return (
    <div style={{ display: "grid", gap: 6, minWidth, ...style }}>
      <FitText
        excludeGlobalScale
        style={{
          fontSize: 10,
          fontWeight: 650,
          color: colors.textMuted,
          letterSpacing: 0,
          lineHeight: 1.15,
        }}
      >
        {label}
      </FitText>
      {children}
    </div>
  );
}

export function GymOperationsModeTabs({
  activeTab,
  colors,
  onChange,
}: {
  activeTab: GymOperationsTab;
  colors: ReturnType<typeof useTheme>["colors"];
  onChange: (tab: GymOperationsTab) => void;
}) {
  const tabIconMap = {
    schedule: CalendarDays,
    coaches: UsersRound,
    appointments: ClipboardList,
  } satisfies Record<GymOperationsTab, typeof CalendarDays>;

  return (
    <div
      className="gym-operations-mode-tabs"
      data-ui="gym-operations-primary-tabs"
      data-option-count={GYM_OPERATIONS_TABS.length}
      style={{
        display: "inline-grid",
        gridTemplateColumns: "repeat(3, minmax(104px, 1fr))",
        gap: 0,
        border: `1px solid ${colors.border}`,
        borderRadius: 8,
        backgroundColor: colors.surface,
        overflow: "hidden",
      }}
      role="tablist"
      aria-label="Gym Operations sections"
    >
      {GYM_OPERATIONS_TABS.map((tab) => {
        const Icon = tabIconMap[tab.key];
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            data-ui={`gym-operations-tab-${tab.key}`}
            type="button"
            onClick={() => onChange(tab.key)}
            role="tab"
            aria-selected={isActive}
            style={{
              minHeight: 42,
              padding: "8px 14px",
              border: "none",
              borderRight:
                tab.key === "appointments"
                  ? "none"
                  : `1px solid ${colors.border}`,
              backgroundColor: isActive ? colors.brand : "transparent",
              color: isActive ? colors.onBrand : colors.textSecondary,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 800,
              textTransform: "uppercase",
            }}
          >
            <Icon size={14} strokeWidth={2.3} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function GymOperationsScheduleViewSwitcher({
  activeView,
  colors,
  onChange,
}: {
  activeView: ScheduleSurfaceTab;
  colors: ReturnType<typeof useTheme>["colors"];
  onChange: (view: ScheduleSurfaceTab) => void;
}) {
  return (
    <div
      data-ui="gym-operations-schedule-view-switcher"
      data-option-count={SCHEDULE_SURFACE_TABS.length}
      role="tablist"
      aria-label="Schedule view"
      style={{
        alignItems: "center",
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
      }}
    >
      <FitText
        excludeGlobalScale
        style={{
          color: colors.textMuted,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          marginRight: 4,
          textTransform: "uppercase",
        }}
      >
        View
      </FitText>
      {SCHEDULE_SURFACE_TABS.map((view) => {
        const isActive = activeView === view.key;
        return (
          <button
            key={view.key}
            data-component-option="true"
            data-ui={`gym-operations-schedule-view-${view.key}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(view.key)}
            style={{
              backgroundColor: isActive ? `${colors.brand}18` : "transparent",
              border: `1px solid ${
                isActive ? `${colors.brand}55` : colors.border
              }`,
              borderRadius: 7,
              color: isActive ? colors.brand : colors.textSecondary,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 750,
              minHeight: 34,
              minWidth: 112,
              padding: "6px 11px",
            }}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
