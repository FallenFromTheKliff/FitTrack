"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";

import type {
  CoachAvailabilityResponse,
  RecurringCoachingBillingCycleRecord,
  StaffAppointmentRecord,
  VenueAvailabilityRecord,
} from "@fittrack/api-client";
import {
  coachAvailabilityQueryOptions,
  venueAvailabilityQueryOptions,
} from "@fittrack/query";

import type { VenueBookingRecord } from "@/contexts/ScheduleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";
import {
  FitButton,
  FitSelect,
  FitText,
  FitTextArea,
  FitTextInput,
} from "@/components/fit";
import { CalendarModal } from "@/components/modals";

type AvailabilitySlotDraft = {
  dayOfWeek: number;
  endTime: string;
  startTime: string;
};

type CoachReadinessSummary = {
  isVisible: boolean;
  openPeakSlots: number;
  trustLabel: string;
};

type VenueDecision =
  | "approve"
  | "cancel"
  | "collect_cash_balance"
  | "mark_complete"
  | "no_show"
  | "paymongo_balance"
  | "reject";
type CoachDecision =
  | "accept_cash_balance"
  | "accept_cash_downpayment"
  | "accept_cash_full"
  | "cancel"
  | "confirm"
  | "mark_complete"
  | "paymongo_balance"
  | "paymongo_downpayment"
  | "reject";
type StaffInitialPaymentStage = "downpayment" | "full";
type PaymentCollectionProvider = "cash" | "paymongo";
type SelectOption = {
  hourlyRate?: number | null;
  label: string;
  value: string;
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAY_OPTIONS = WEEKDAY_LABELS.map((label, index) => ({
  label,
  value: String(index),
}));
const VENUE_SLOT_OPTIONS = [
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
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[+\d][\d\s().-]{6,39}$/;

const COACH_DECISION_LABELS: Record<CoachDecision, string> = {
  accept_cash_balance: "Accept cash balance",
  accept_cash_downpayment: "Accept cash downpayment",
  accept_cash_full: "Accept cash full payment",
  cancel: "Cancel appointment",
  confirm: "Confirm session",
  mark_complete: "Mark complete",
  paymongo_balance: "PayMongo balance",
  paymongo_downpayment: "PayMongo downpayment",
  reject: "Reject",
};

const VENUE_DECISION_LABELS: Record<VenueDecision, string> = {
  approve: "Approve / accept payment",
  cancel: "Cancel booking",
  collect_cash_balance: "Accept cash balance",
  mark_complete: "Mark complete",
  no_show: "No show",
  paymongo_balance: "PayMongo balance",
  reject: "Reject",
};

function splitListInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function toMinutes(value: string) {
  const [hours = 0, minutes = 0] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function formatPeso(value: number) {
  return `PHP ${value.toLocaleString("en-PH", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}`;
}

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getInitialPaymentAmount(
  totalAmount: number,
  paymentStage: StaffInitialPaymentStage,
) {
  return paymentStage === "downpayment"
    ? roundCurrency(totalAmount * 0.3)
    : roundCurrency(totalAmount);
}

function formatCompactDate(value: string) {
  return new Date(value).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function hasVenueWindowConflict(
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

function matchesDay(selectedDate: string, dayValue: number | string) {
  const currentDate = new Date(`${selectedDate}T00:00:00`);
  const dayIndex = currentDate.getDay();
  if (typeof dayValue === "number") {
    return dayValue === dayIndex;
  }
  return String(dayValue) === String(dayIndex);
}

function formatSlotLabel(value: string) {
  const [hoursValue, minutesValue] = value.split(":").map(Number);
  const period = hoursValue >= 12 ? "PM" : "AM";
  const normalizedHour = hoursValue % 12 || 12;
  return `${String(normalizedHour).padStart(2, "0")}:${String(minutesValue).padStart(2, "0")} ${period}`;
}

function getDurationMinutes(startTime: string, endTime: string) {
  const [startHours, startMinutes] = startTime.split(":").map(Number);
  const [endHours, endMinutes] = endTime.split(":").map(Number);
  return endHours * 60 + endMinutes - (startHours * 60 + startMinutes);
}

function formatDurationLabel(durationMinutes: number) {
  const hours = Math.max(1, Math.round(durationMinutes / 60));
  return `${hours} hr${hours === 1 ? "" : "s"}`;
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

function formatVenueWindow(booking: VenueBookingRecord) {
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

function getDefaultDateInput() {
  return new Date().toISOString().slice(0, 10);
}

function toIsoString(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const gymOffsetMinutes = 8 * 60;
  return new Date(
    Date.UTC(year, month - 1, day, hour, minute) -
      gymOffsetMinutes * 60 * 1000,
  ).toISOString();
}

function buildStatusTone(
  status: string | undefined,
  colors: ReturnType<typeof useTheme>["colors"],
) {
  switch (status) {
    case "pending_coach":
    case "pending":
      return {
        bg: colors.brand,
        color: colors.onBrand ?? "#120e0b",
        label:
          status === "pending_coach"
            ? "Pending coach"
            : "Pending downpayment",
      };
    case "pending_payment":
      return {
        bg: colors.warning,
        color: colors.onBrand ?? "#120e0b",
        label: "Pending payment",
      };
    case "balance_pending":
      return {
        bg: colors.warning,
        color: colors.onBrand ?? "#120e0b",
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
    default:
      return {
        bg: `${colors.surfaceRaised}`,
        color: colors.textPrimary,
        label: "Review",
      };
  }
}

function overlaySurfaceStyle(
  colors: ReturnType<typeof useTheme>["colors"],
): CSSProperties {
  return {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 18,
    padding: 22,
    display: "grid",
    gap: 12,
  };
}

function bookingAmountCardStyle(
  colors: ReturnType<typeof useTheme>["colors"],
): CSSProperties {
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

function metricChipStyle(
  colors: ReturnType<typeof useTheme>["colors"],
): CSSProperties {
  return {
    border: `1px solid ${colors.border}`,
    borderRadius: 14,
    backgroundColor: colors.surfaceRaised,
    padding: 12,
    display: "grid",
    gap: 4,
  };
}

function modalFieldStyle(
  colors: ReturnType<typeof useTheme>["colors"],
): CSSProperties {
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

function modalTextAreaStyle(
  colors: ReturnType<typeof useTheme>["colors"],
): CSSProperties {
  return {
    ...modalFieldStyle(colors),
    minHeight: 96,
    lineHeight: 1.45,
    resize: "vertical",
  };
}

function actionPillStyle(
  colors: ReturnType<typeof useTheme>["colors"],
  active = false,
): CSSProperties {
  return {
    minHeight: 36,
    borderRadius: 18,
    padding: "8px 14px",
    border: `1px solid ${active ? `${colors.brand}44` : colors.border}`,
    backgroundColor: active ? colors.brand : colors.surfaceRaised,
  };
}

function usePortalRoot() {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setRoot(document.body);
  }, []);

  return root;
}

function OverlayFrame({
  children,
  isOpen,
  onClose,
}: {
  children: React.ReactNode;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { colors, settings } = useTheme();
  const portalRoot = usePortalRoot();
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);
  const shouldAnimate = settings.animationLevel !== "none";

  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (isOpen) {
      rafRef.current = requestAnimationFrame(() => {
        setVisible(true);
        rafRef.current = null;
      });
      return;
    }

    setVisible(false);
  }, [isOpen]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    [],
  );

  if ((!isOpen && !visible) || !portalRoot) return null;

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        padding: 24,
        backgroundColor: colors.overlay,
        opacity: visible ? 1 : 0,
        pointerEvents: isOpen && visible ? "auto" : "none",
        transition: shouldAnimate ? "opacity 180ms ease" : "none",
      }}
    >
      {children}
    </div>,
    portalRoot,
  );
}

export function GymOperationsCoachAppointmentModal({
  appointment,
  billingCycles = [],
  coachReadiness,
  isOpen,
  isSubmitting = false,
  onCancelRecurringPlan,
  onCancelAppointment,
  onClose,
  onComplete,
  onEditRecurringFuture,
  onEditRecurringSession,
  onConfirm,
  onCollectBalance,
  onCollectInitialPayment,
  onPayRecurringCycle,
  onReject,
}: {
  appointment: StaffAppointmentRecord | null;
  billingCycles?: RecurringCoachingBillingCycleRecord[];
  coachReadiness: CoachReadinessSummary;
  isOpen: boolean;
  isSubmitting?: boolean;
  onCancelRecurringPlan?: () => void;
  onCancelAppointment: (note: string) => void;
  onClose: () => void;
  onComplete: (note: string) => void;
  onEditRecurringFuture?: () => void;
  onEditRecurringSession?: () => void;
  onConfirm: () => void;
  onCollectBalance?: (provider: PaymentCollectionProvider) => void;
  onCollectInitialPayment?: (
    provider: PaymentCollectionProvider,
    paymentStage: StaffInitialPaymentStage,
  ) => void;
  onPayRecurringCycle?: (
    cycle: RecurringCoachingBillingCycleRecord,
    provider: PaymentCollectionProvider,
  ) => void;
  onReject: (note: string) => void;
}) {
  const { colors, settings } = useTheme();
  const [note, setNote] = useState("");
  const [coachDecision, setCoachDecision] = useState<CoachDecision>("confirm");
  const shouldAnimate = settings.animationLevel !== "none";
  const status = appointment?.status ?? "pending_coach";
  const canConfirm = status === "pending_coach";
  const canComplete = status === "confirmed";
  const canCollectInitialPayment = status === "pending_payment";
  const canResolvePendingCoachPayment = status === "pending_coach";
  const isRecurring = Boolean(appointment?.recurringPlanId);
  const bookingTypeLabel = isRecurring ? "Recurring booking" : "Single booking";
  const coachRate = appointment?.coach?.hourlyRate ?? null;
  const totalAmount = appointment?.totalAmount ?? null;
  const nextBillingCycle =
    billingCycles.find((cycle) =>
      ["due", "overdue", "awaiting_verification", "processing"].includes(
        cycle.status,
      ),
    ) ??
    billingCycles.find(
      (cycle) =>
        cycle.status !== "paid" &&
        cycle.status !== "cancelled" &&
        cycle.status !== "overdue",
    ) ?? billingCycles.at(-1);
  const recurringCycleAmount = nextBillingCycle
    ? Number(nextBillingCycle.amount)
    : null;
  const sessionPrice = totalAmount != null ? totalAmount : coachRate;
  const recurringDueNow =
    recurringCycleAmount != null
      ? Math.min(
          recurringCycleAmount,
          Math.max(0, Number(sessionPrice ?? recurringCycleAmount)),
        )
      : null;
  const amountDueNow = isRecurring
    ? recurringDueNow
    : (appointment?.amountDueNow ?? null);
  const remainingBalance = isRecurring
    ? recurringCycleAmount != null && recurringDueNow != null
      ? Math.max(recurringCycleAmount - recurringDueNow, 0)
      : null
    : (appointment?.remainingBalance ?? null);
  const displayTotalLabel = isRecurring ? "Current cycle total" : "Total price";
  const displayTotalAmount = isRecurring
    ? recurringCycleAmount
    : totalAmount;
  const canCollectBalance =
    !isRecurring &&
    status === "confirmed" &&
    Number(appointment?.remainingBalance ?? 0) > 0 &&
    !appointment?.balancePaidAt;
  const tone = canCollectBalance
    ? {
        bg: colors.warning,
        color: colors.onBrand ?? "#120e0b",
        label: "Pending full payment",
      }
    : status === "pending_payment" &&
        appointment?.activePaymentStage === "full"
      ? {
          bg: colors.warning,
          color: colors.onBrand ?? "#120e0b",
          label: "Pending full payment",
        }
      : status === "pending_payment" &&
          appointment?.activePaymentStage === "downpayment"
        ? {
            bg: colors.brand,
            color: colors.onBrand ?? "#120e0b",
            label: "Pending downpayment",
          }
        : buildStatusTone(status, colors);
  const memberName = appointment
    ? getPersonDisplayName(
        appointment.user.profile,
        appointment.user.email,
        "Member",
      )
    : "Member";
  const coachName = appointment
    ? getPersonDisplayName(appointment.coach.profile, null, "Coach")
    : "Coach";
  const scheduleWindow = appointment
    ? formatAppointmentWindow(appointment)
    : { dateLabel: "-", timeLabel: "-" };

  useEffect(() => {
    if (!isOpen) return;
    setNote("");
  }, [isOpen, appointment?.id]);

  const title = canConfirm
    ? "Review coach appointment"
    : "Coach appointment actions";
  const description = canConfirm
    ? "Confirm, reject, or keep the request pending without leaving Gym Operations."
    : "Review the current session state and resolve the next action without leaving Gym Operations.";
  const coachDecisionOptions = useMemo<CoachDecision[]>(() => {
    if (canConfirm) {
      const options: CoachDecision[] = [];
      if (
        canResolvePendingCoachPayment &&
        appointment?.activePaymentStage === "downpayment"
      ) {
        options.push("paymongo_downpayment", "accept_cash_downpayment");
      }
      if (
        canResolvePendingCoachPayment &&
        appointment?.activePaymentStage === "full"
      ) {
        options.push("accept_cash_full");
      }
      if (
        !canResolvePendingCoachPayment ||
        !appointment?.activePaymentStage
      ) {
        options.push("confirm", "reject");
      }
      options.push("cancel");
      return options;
    }
    if (canComplete) {
      const options: CoachDecision[] = [];
      if (canCollectBalance) {
        options.push("accept_cash_balance", "paymongo_balance");
      } else {
        options.push("mark_complete");
      }
      options.push("cancel");
      return options;
    }
    if (canCollectInitialPayment) {
      if (appointment?.activePaymentStage === "full") {
        return ["accept_cash_full", "cancel"];
      }
      if (appointment?.activePaymentStage === "downpayment") {
        return ["paymongo_downpayment", "accept_cash_downpayment", "cancel"];
      }
      return [
        "paymongo_downpayment",
        "accept_cash_downpayment",
        "accept_cash_full",
        "cancel",
      ];
    }
    if (status === "cancelled") return [];
    return ["cancel"];
  }, [
    appointment?.activePaymentStage,
    canCollectBalance,
    canCollectInitialPayment,
    canComplete,
    canConfirm,
    canResolvePendingCoachPayment,
    status,
  ]);

  useEffect(() => {
    if (coachDecisionOptions.length === 0) return;
    if (!coachDecisionOptions.includes(coachDecision)) {
      setCoachDecision(coachDecisionOptions[0]);
    }
  }, [coachDecision, coachDecisionOptions]);

  const handleCoachDecisionSubmit = () => {
    switch (coachDecision) {
      case "accept_cash_balance":
        onCollectBalance?.("cash");
        return;
      case "paymongo_balance":
        onCollectBalance?.("paymongo");
        return;
      case "paymongo_downpayment":
        onCollectInitialPayment?.("paymongo", "downpayment");
        return;
      case "accept_cash_downpayment":
        onCollectInitialPayment?.("cash", "downpayment");
        return;
      case "accept_cash_full":
        onCollectInitialPayment?.("cash", "full");
        return;
      case "confirm":
        onConfirm();
        return;
      case "mark_complete":
        onComplete(note.trim());
        return;
      case "reject":
        onReject(note.trim());
        return;
      case "cancel":
        onCancelAppointment(note.trim());
        return;
    }
  };

  const isCoachDecisionDisabled =
    isSubmitting ||
    coachDecisionOptions.length === 0 ||
    (coachDecision === "reject" && !note.trim()) ||
    ((coachDecision === "accept_cash_balance" ||
      coachDecision === "paymongo_balance") &&
      !onCollectBalance) ||
    ((coachDecision === "paymongo_downpayment" ||
      coachDecision === "accept_cash_downpayment" ||
      coachDecision === "accept_cash_full") &&
      !onCollectInitialPayment);

  return (
    <OverlayFrame isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 720,
          maxWidth: "min(720px, calc(100vw - 48px))",
          maxHeight: "min(740px, calc(100vh - 48px))",
          overflow: "auto",
          margin: "auto",
          padding: 40,
          borderRadius: 26,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          display: "grid",
          gap: 20,
          boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
          transform: shouldAnimate && isOpen ? "scale(1)" : "scale(0.985)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
        }}
      >
        <div
          style={{
            minHeight: 36,
            padding: "9px 16px",
            borderRadius: 18,
            justifySelf: "start",
            backgroundColor: tone.bg,
            color: tone.color,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <FitText
            excludeGlobalScale
            style={{ fontSize: 13, fontWeight: 700, color: tone.color }}
          >
            {tone.label}
          </FitText>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: colors.textPrimary,
              lineHeight: 1.12,
            }}
          >
            {title}
          </FitText>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 14,
              color: colors.textMuted,
              lineHeight: 1.32,
              maxWidth: 520,
            }}
          >
            {description}
          </FitText>
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 8 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: colors.textPrimary,
                }}
              >
                {memberName}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 13, color: colors.textMuted }}
              >
                with {coachName}
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                {scheduleWindow.dateLabel} / {scheduleWindow.timeLabel}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 12, color: colors.textMuted }}
              >
                {appointment?.notes?.trim() ||
                  "No member note was provided for this appointment."}
              </FitText>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              label: "Booking type",
              value: bookingTypeLabel,
            },
            {
              label: "Coach rate",
              value:
                coachRate != null ? `${formatPeso(coachRate)}/hr` : "Not set",
            },
            {
              label: displayTotalLabel,
              value:
                displayTotalAmount != null
                  ? formatPeso(displayTotalAmount)
                  : "Not set",
            },
            {
              label: isRecurring ? "Cycle due now" : "Paid / due now",
              value:
                amountDueNow != null ? formatPeso(amountDueNow) : "Not set",
            },
            {
              label: isRecurring ? "Cycle remaining" : "Remaining",
              value:
                remainingBalance != null
                  ? formatPeso(remainingBalance)
                  : "Not set",
            },
          ].map((item) => (
            <div key={item.label} style={bookingAmountCardStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: colors.textMuted,
                }}
              >
                {item.label}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: colors.textPrimary,
                }}
              >
                {item.value}
              </FitText>
            </div>
          ))}
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}
        >
          <div style={overlaySurfaceStyle(colors)}>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: colors.textPrimary,
              }}
            >
              Coach readiness
            </FitText>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              Visibility: {coachReadiness.isVisible ? "visible" : "hidden"}
            </FitText>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              Peak slots open: {coachReadiness.openPeakSlots}
            </FitText>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.success }}
            >
              Profile trust: {coachReadiness.trustLabel}
            </FitText>
          </div>
          <div style={overlaySurfaceStyle(colors)}>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: colors.textPrimary,
              }}
            >
              Decision note
            </FitText>
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceRaised,
                minHeight: 76,
                padding: 12,
              }}
            >
              <FitTextArea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Optional note for front desk, coach, or audit trail..."
                style={{ fontSize: 12, lineHeight: 1.4 }}
              />
            </div>
          </div>
        </div>

        {isRecurring ? (
          <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <FitText
                excludeGlobalScale
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: colors.textPrimary,
              }}
            >
                Recurring booking controls
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 12, color: colors.textMuted }}
              >
                Recurring payments are tracked by billing cycle. The cycle total
                stays fixed for the block, while due now and remaining show the
                next collectable slice.
              </FitText>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                gap: 10,
              }}
            >
              <div style={metricChipStyle(colors)}>
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, fontWeight: 800, color: colors.textMuted }}
                >
                  SESSION PRICE
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: colors.textPrimary,
                  }}
                >
                  {sessionPrice != null ? formatPeso(Number(sessionPrice)) : "Not set"}
                </FitText>
              </div>
              <div style={metricChipStyle(colors)}>
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, fontWeight: 800, color: colors.textMuted }}
                >
                  CURRENT CYCLE TOTAL
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: colors.textPrimary,
                  }}
                >
                  {nextBillingCycle
                    ? formatPeso(Number(nextBillingCycle.amount))
                    : "No cycle"}
                </FitText>
              </div>
              <div style={metricChipStyle(colors)}>
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, fontWeight: 800, color: colors.textMuted }}
                >
                  DUE DATE
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: colors.textPrimary,
                  }}
                >
                  {nextBillingCycle
                    ? formatCompactDate(nextBillingCycle.dueDate)
                    : "-"}
                </FitText>
              </div>
              <div style={metricChipStyle(colors)}>
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, fontWeight: 800, color: colors.textMuted }}
                >
                  PAYMENT STATUS
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color:
                      nextBillingCycle?.status === "paid"
                        ? colors.success
                        : colors.brand,
                  }}
                >
                  {nextBillingCycle?.status.replace(/_/g, " ") ?? "-"}
                </FitText>
              </div>
            </div>
            {billingCycles.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {billingCycles.slice(0, 4).map((cycle) => (
                  <div
                    key={cycle.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "center",
                      padding: "10px 12px",
                      borderRadius: 14,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceRaised,
                    }}
                  >
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 12,
                        color: colors.textMuted,
                        lineHeight: 1.35,
                      }}
                    >
                      {formatCompactDate(cycle.cycleStartDate)} -{" "}
                      {formatCompactDate(cycle.cycleEndDate)}
                      {` / ${formatPeso(Number(cycle.amount))}`}
                      {cycle.paidAt
                        ? ` / paid ${formatCompactDate(cycle.paidAt)}`
                        : ""}
                    </FitText>
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color:
                          cycle.status === "paid"
                            ? colors.success
                            : colors.textPrimary,
                        textTransform: "uppercase",
                      }}
                    >
                      {cycle.status.replace(/_/g, " ")}
                    </FitText>
                  </div>
                ))}
              </div>
            ) : null}
            {nextBillingCycle &&
            nextBillingCycle.status !== "paid" &&
            nextBillingCycle.status !== "cancelled" ? (
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 12,
                  borderRadius: 16,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceRaised,
                }}
              >
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: colors.textPrimary,
                  }}
                >
                  Billing-cycle payment
                </FitText>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    color: colors.textMuted,
                    lineHeight: 1.35,
                  }}
                >
                  Paying this cycle marks every generated recurring session
                  inside the selected cycle window as paid. Editing a single
                  session does not split the cycle charge into a one-session
                  payment.
                </FitText>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {nextBillingCycle.status === "awaiting_verification" &&
                  nextBillingCycle.paymentId ? (
                    <FitButton
                      variant="primary"
                      label="APPROVE CASH PAYMENT"
                      onClick={() =>
                        onPayRecurringCycle?.(nextBillingCycle, "cash")
                      }
                      disabled={isSubmitting || !onPayRecurringCycle}
                      style={actionPillStyle(colors, true)}
                      textStyle={{ fontSize: 12, fontWeight: 800 }}
                    />
                  ) : (
                    <>
                      <FitButton
                        variant="primary"
                        label="ACCEPT CASH FOR CYCLE"
                        onClick={() =>
                          onPayRecurringCycle?.(nextBillingCycle, "cash")
                        }
                        disabled={isSubmitting || !onPayRecurringCycle}
                        style={actionPillStyle(colors, true)}
                        textStyle={{ fontSize: 12, fontWeight: 800 }}
                      />
                      <FitButton
                        variant="ghost"
                        label="OPEN PAYMONGO FOR CYCLE"
                        onClick={() =>
                          onPayRecurringCycle?.(nextBillingCycle, "paymongo")
                        }
                        disabled={isSubmitting || !onPayRecurringCycle}
                        style={actionPillStyle(colors)}
                        textStyle={{ fontSize: 12, fontWeight: 800 }}
                      />
                    </>
                  )}
                </div>
              </div>
            ) : null}
            <div
              style={{
                display: "grid",
                gap: 8,
                padding: 12,
                borderRadius: 16,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: colors.textPrimary,
                }}
              >
                Schedule edit scope
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 1.35,
                }}
              >
                Use these actions only when changing the recurring schedule.
              </FitText>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <FitButton
                variant="ghost"
                label="EDIT THIS SESSION"
                onClick={onEditRecurringSession}
                disabled={isSubmitting || !onEditRecurringSession}
                style={actionPillStyle(colors)}
                textStyle={{ fontSize: 13, fontWeight: 700 }}
              />
              <FitButton
                variant="ghost"
                label="EDIT THIS + FUTURE"
                onClick={onEditRecurringFuture}
                disabled={isSubmitting || !onEditRecurringFuture}
                style={actionPillStyle(colors)}
                textStyle={{ fontSize: 13, fontWeight: 700 }}
              />
              <FitButton
                variant="ghost"
                label="CANCEL PLAN"
                onClick={onCancelRecurringPlan}
                disabled={isSubmitting || !onCancelRecurringPlan}
                style={actionPillStyle(colors)}
                textStyle={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: colors.danger,
                }}
              />
              </div>
            </div>
          </div>
        ) : null}

        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <FitText
            excludeGlobalScale
            style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}
          >
            Decision path
          </FitText>
          <FitText
            excludeGlobalScale
            style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.35 }}
          >
            Select one action, then submit it. Payment, rejection, completion,
            and cancellation no longer compete as separate decision buttons.
          </FitText>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(220px, 1fr) auto auto",
              gap: 12,
              alignItems: "center",
            }}
          >
            <FitSelect
              options={coachDecisionOptions.map((value) => ({
                label: COACH_DECISION_LABELS[value],
                value,
              }))}
              value={coachDecision}
              onChange={(event) =>
                setCoachDecision(event.target.value as CoachDecision)
              }
              disabled={isSubmitting || coachDecisionOptions.length === 0}
              fullWidth
            />
            <FitButton
              variant="primary"
              label={isSubmitting ? "SUBMITTING..." : "SUBMIT DECISION"}
              onClick={handleCoachDecisionSubmit}
              disabled={isCoachDecisionDisabled}
              style={actionPillStyle(colors, true)}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
            <FitButton
              variant="ghost"
              label="CLOSE"
              onClick={onClose}
              disabled={isSubmitting}
              style={actionPillStyle(colors)}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
          </div>
        </div>
      </div>
    </OverlayFrame>
  );
}

export function GymOperationsAvailabilityDrawer({
  coachName,
  initialSlots,
  isOpen,
  isSaving = false,
  isVisibleInBooking,
  onClose,
  onSave,
  onSetBookingVisibility,
}: {
  coachName: string;
  initialSlots: AvailabilitySlotDraft[];
  isOpen: boolean;
  isSaving?: boolean;
  isVisibleInBooking: boolean;
  onClose: () => void;
  onSave: (slots: AvailabilitySlotDraft[]) => Promise<void> | void;
  onSetBookingVisibility: (isVisible: boolean) => void;
}) {
  const { colors, settings } = useTheme();
  const [slots, setSlots] = useState<AvailabilitySlotDraft[]>([]);
  const shouldAnimate = settings.animationLevel !== "none";

  useEffect(() => {
    if (!isOpen) return;
    setSlots(
      [...initialSlots].sort((left, right) =>
        left.dayOfWeek === right.dayOfWeek
          ? left.startTime.localeCompare(right.startTime)
          : left.dayOfWeek - right.dayOfWeek,
      ),
    );
  }, [initialSlots, isOpen]);

  const slotRows = useMemo(() => {
    if (slots.length > 0) return slots;
    return [{ dayOfWeek: 1, startTime: "08:00", endTime: "10:00" }];
  }, [slots]);
  const coveredDaysCount = useMemo(
    () => new Set(slotRows.map((slot) => slot.dayOfWeek)).size,
    [slotRows],
  );
  const hasInvalidSlot = slotRows.some(
    (slot) =>
      !slot.startTime || !slot.endTime || slot.endTime <= slot.startTime,
  );

  const updateSlot = (index: number, patch: Partial<AvailabilitySlotDraft>) => {
    setSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    );
  };
  const addSlot = () => {
    setSlots((current) => [
      ...current,
      { dayOfWeek: 1, startTime: "08:00", endTime: "10:00" },
    ]);
  };

  const handleSave = async () => {
    if (hasInvalidSlot) return;
    await onSave(slotRows);
  };

  return (
    <OverlayFrame isOpen={isOpen} onClose={isSaving ? () => {} : onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          margin: "auto",
          width: 760,
          maxWidth: "min(760px, calc(100vw - 48px))",
          maxHeight: "min(820px, calc(100vh - 48px))",
          overflow: "auto",
          borderRadius: 26,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          padding: 40,
          display: "grid",
          gap: 20,
          transform: shouldAnimate && isOpen ? "scale(1)" : "scale(0.985)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
          boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 30,
                fontWeight: 800,
                color: colors.textPrimary,
                lineHeight: 1.12,
              }}
            >
              Manage availability
            </FitText>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 13,
                color: colors.textMuted,
                lineHeight: 1.35,
                maxWidth: 480,
              }}
            >
              Set the weekly slots members can book for {coachName}. Visibility
              controls whether this coach appears in member booking surfaces.
            </FitText>
          </div>
          <FitButton
            variant={isVisibleInBooking ? "ghost" : "primary"}
            label={isVisibleInBooking ? "HIDE FROM BOOKING" : "SHOW IN BOOKING"}
            onClick={() => onSetBookingVisibility(!isVisibleInBooking)}
            disabled={isSaving}
            style={actionPillStyle(colors, !isVisibleInBooking)}
            textStyle={{ fontSize: 12, fontWeight: 700 }}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              label: "Booking visibility",
              tone: isVisibleInBooking ? colors.success : colors.warning,
              value: isVisibleInBooking ? "Visible" : "Hidden",
            },
            {
              label: "Weekly slots",
              tone: colors.brand,
              value: String(slotRows.length),
            },
            {
              label: "Days covered",
              tone: colors.textPrimary,
              value: String(coveredDaysCount),
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{ ...overlaySurfaceStyle(colors), gap: 6 }}
            >
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.textMuted,
                  letterSpacing: "0.06em",
                }}
              >
                {item.label.toUpperCase()}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 20, fontWeight: 800, color: item.tone }}
              >
                {item.value}
              </FitText>
            </div>
          ))}
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: colors.textPrimary,
                }}
              >
                Weekly schedule
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 1.35,
                  maxWidth: 360,
                }}
              >
                Adjust the coach&apos;s recurring weekly windows here. Each row
                becomes a persisted booking slot after save.
              </FitText>
            </div>
            <FitButton
              variant="ghost"
              label="ADD SLOT"
              onClick={addSlot}
              disabled={isSaving}
              style={{ ...actionPillStyle(colors), minWidth: 88 }}
              textStyle={{ fontSize: 12, fontWeight: 700 }}
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(110px, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) auto",
              gap: 10,
              padding: "0 2px",
            }}
          >
            {["Day", "Start time", "End time", "Action"].map((label) => (
              <FitText
                key={label}
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.textMuted,
                  letterSpacing: "0.06em",
                }}
              >
                {label.toUpperCase()}
              </FitText>
            ))}
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {slotRows.map((slot, index) => (
              <div
                key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}-${index}`}
                style={{
                  borderRadius: 16,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceRaised,
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(110px, 0.8fr) minmax(0, 1fr) minmax(0, 1fr) auto",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <FitSelect
                  value={String(slot.dayOfWeek)}
                  onChange={(event) =>
                    updateSlot(index, { dayOfWeek: Number(event.target.value) })
                  }
                  options={WEEKDAY_OPTIONS}
                  compact
                  fullWidth
                />
                <FitTextInput
                  type="time"
                  value={slot.startTime}
                  onChange={(event) =>
                    updateSlot(index, { startTime: event.target.value })
                  }
                  disabled={isSaving}
                />
                <FitTextInput
                  type="time"
                  value={slot.endTime}
                  onChange={(event) =>
                    updateSlot(index, { endTime: event.target.value })
                  }
                  disabled={isSaving}
                />
                <FitButton
                  variant="ghost"
                  label="REMOVE"
                  onClick={() =>
                    setSlots((current) =>
                      current.filter((_, slotIndex) => slotIndex !== index),
                    )
                  }
                  disabled={isSaving || slotRows.length === 1}
                  style={{ ...actionPillStyle(colors), minWidth: 84 }}
                  textStyle={{ fontSize: 12, fontWeight: 700 }}
                />
              </div>
            ))}
          </div>

          {hasInvalidSlot ? (
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.danger, lineHeight: 1.35 }}
            >
              End time must be later than start time for every slot before you
              can save.
            </FitText>
          ) : null}
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 16 }}>
          <FitText
            excludeGlobalScale
            style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}
          >
            Save changes
          </FitText>
          <FitText
            excludeGlobalScale
            style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.35 }}
          >
            Save the current weekly slots, or change booking visibility first if
            the coach should stay hidden from new reservations.
          </FitText>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <FitButton
              variant="ghost"
              label="CLOSE"
              onClick={onClose}
              disabled={isSaving}
              style={actionPillStyle(colors)}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
            <FitButton
              variant="primary"
              label={isSaving ? "SAVING..." : "SAVE SCHEDULE"}
              onClick={() => void handleSave()}
              disabled={isSaving || hasInvalidSlot}
              style={actionPillStyle(colors, true)}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
          </div>
        </div>
      </div>
    </OverlayFrame>
  );
}

export function GymOperationsVenueBookingModal({
  booking,
  isOpen,
  isSubmitting = false,
  onApprove,
  onCancel,
  onCollectBalance,
  onClose,
  onComplete,
  onNoShow,
  onReject,
  onVenueDetails,
}: {
  booking: VenueBookingRecord | null;
  isOpen: boolean;
  isSubmitting?: boolean;
  onApprove: (note: string) => void;
  onCancel?: (note: string) => void;
  onCollectBalance?: (provider: PaymentCollectionProvider) => void;
  onClose: () => void;
  onComplete?: (note: string) => void;
  onNoShow?: (note: string) => void;
  onReject: (note: string) => void;
  onVenueDetails?: () => void;
}) {
  const { colors, settings } = useTheme();
  const [decision, setDecision] = useState<VenueDecision>("approve");
  const [note, setNote] = useState("");
  const shouldAnimate = settings.animationLevel !== "none";
  const windowSummary = booking
    ? formatVenueWindow(booking)
    : { dateLabel: "-", timeLabel: "-" };
  const venueRate = booking?.venue?.hourlyRate ?? null;
  const totalAmount = booking?.totalAmount ?? null;
  const amountDueNow = booking?.amountDueNow ?? null;
  const remainingBalance = booking?.remainingBalance ?? null;
  const hasOutstandingBalance =
    Number(remainingBalance ?? 0) > 0 && !booking?.balancePaidAt;
  const isPendingFullPayment =
    (booking?.status === "confirmed" || booking?.status === "balance_pending") &&
    hasOutstandingBalance;
  const isPendingInitialFullPayment =
    booking?.status === "pending" &&
    Number(totalAmount ?? 0) > 0 &&
    !hasOutstandingBalance;
  const tone = isPendingFullPayment
    ? {
        bg: colors.warning,
        color: colors.onBrand ?? "#120e0b",
        label: "Pending full payment",
      }
    : isPendingInitialFullPayment
      ? {
          bg: colors.warning,
          color: colors.onBrand ?? "#120e0b",
          label: "Pending payment",
        }
    : buildStatusTone(booking?.status ?? "pending", colors);
  const approvalAlsoVerifiesPayment =
    booking?.status === "pending" && Number(totalAmount ?? 0) > 0;
  const canCollectBalance =
    (booking?.status === "confirmed" || booking?.status === "balance_pending") &&
    hasOutstandingBalance;
  const isTerminal =
    booking?.status === "cancelled" ||
    booking?.status === "completed" ||
    booking?.status === "no_show";
  const isConfirmedSettled =
    booking?.status === "confirmed" &&
    !hasOutstandingBalance &&
    Number(remainingBalance ?? 0) <= 0;
  const visibleDecisionOptions: VenueDecision[] = isTerminal
    ? []
    : canCollectBalance
      ? ["collect_cash_balance", "paymongo_balance", "cancel"]
      : isConfirmedSettled
        ? ["mark_complete", "cancel", "no_show"]
        : ["approve", "reject", "cancel"];

  useEffect(() => {
    if (!isOpen) return;
    setDecision(
      canCollectBalance
        ? "collect_cash_balance"
        : isConfirmedSettled
          ? "mark_complete"
          : "approve",
    );
    setNote("");
  }, [isOpen, booking?.id, canCollectBalance, isConfirmedSettled]);

  const handleSave = () => {
    const trimmed = note.trim();
    const confirmationMessage =
      decision === "approve"
        ? "Approve this venue booking now?"
        : decision === "collect_cash_balance"
          ? "Accept this venue booking cash balance now?"
          : decision === "paymongo_balance"
            ? "Open PayMongo balance collection for this venue booking?"
        : decision === "mark_complete"
          ? "Mark this confirmed venue booking complete?"
        : decision === "no_show"
          ? "Mark this confirmed venue booking as no-show?"
        : decision === "cancel"
          ? "Cancel this venue booking now?"
        : decision === "reject"
          ? "Reject this venue booking now?"
          : "Submit this venue booking decision now?";

    if (typeof window !== "undefined" && !window.confirm(confirmationMessage)) {
      return;
    }

    if (decision === "approve") {
      onApprove(trimmed);
      return;
    }
    if (decision === "reject") {
      onReject(trimmed);
      return;
    }
    if (decision === "mark_complete") {
      onComplete?.(trimmed);
      return;
    }
    if (decision === "no_show") {
      onNoShow?.(trimmed);
      return;
    }
    if (decision === "cancel") {
      onCancel?.(trimmed);
      return;
    }
    if (decision === "collect_cash_balance") {
      onCollectBalance?.("cash");
      return;
    }
    if (decision === "paymongo_balance") {
      onCollectBalance?.("paymongo");
    }
  };

  return (
    <OverlayFrame isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 760,
          maxWidth: "min(760px, calc(100vw - 48px))",
          maxHeight: "min(776px, calc(100vh - 48px))",
          overflow: "auto",
          margin: "auto",
          padding: 40,
          borderRadius: 26,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          display: "grid",
          gap: 20,
          boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
          transform: shouldAnimate && isOpen ? "scale(1)" : "scale(0.985)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
        }}
      >
        <div
          style={{
            minHeight: 36,
            padding: "9px 16px",
            borderRadius: 18,
            justifySelf: "start",
            backgroundColor: tone.bg,
            color: tone.color,
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <FitText
            excludeGlobalScale
            style={{ fontSize: 13, fontWeight: 700, color: tone.color }}
          >
            {tone.label}
          </FitText>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: colors.textPrimary,
              lineHeight: 1.12,
            }}
          >
            Review venue booking
          </FitText>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 14,
              color: colors.textMuted,
              lineHeight: 1.3,
              maxWidth: 520,
            }}
          >
            Basketball court, boxing ring, and yoga room requests should resolve
            here before they hit the floor.
          </FitText>
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 8 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: colors.textPrimary,
                }}
              >
                {booking?.venue?.name ?? "Venue booking"}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 12, color: colors.textMuted }}
              >
                Member:{" "}
                {getPersonDisplayName(
                  booking?.user?.profile,
                  booking?.user?.email,
                  "Member",
                )}
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: colors.textPrimary,
                }}
              >
                {windowSummary.dateLabel} / {windowSummary.timeLabel}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 12, color: colors.textMuted }}
              >
                Purpose: {booking?.purpose?.trim() || "General venue use"}
              </FitText>
            </div>
          </div>
          <FitText
            excludeGlobalScale
            style={{ fontSize: 12, color: colors.textMuted }}
          >
            {booking?.status === "pending"
              ? "Needs review because occupancy pressure is high and adjacent venue load is building."
              : "Use this review surface to document the final facilities decision."}
          </FitText>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {[
            {
              label: "Venue rate",
              value:
                venueRate != null ? `${formatPeso(venueRate)}/hr` : "Not set",
            },
            {
              label: "Total price",
              value: totalAmount != null ? formatPeso(totalAmount) : "Not set",
            },
            {
              label: "Paid / due now",
              value:
                amountDueNow != null ? formatPeso(amountDueNow) : "Not set",
            },
            {
              label: "Remaining",
              value:
                remainingBalance != null
                  ? formatPeso(remainingBalance)
                  : "Not set",
            },
          ].map((item) => (
            <div key={item.label} style={bookingAmountCardStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 10.5,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: colors.textMuted,
                }}
              >
                {item.label}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  color: colors.textPrimary,
                }}
              >
                {item.value}
              </FitText>
            </div>
          ))}
        </div>

        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}
        >
          <div style={overlaySurfaceStyle(colors)}>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: colors.textPrimary,
              }}
            >
              Conflict context
            </FitText>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.warning }}
            >
              Occupancy pressure: medium-high
            </FitText>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              Adjacent booking: Boxing Ring / 7:30 PM
            </FitText>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 12,
                color: colors.textMuted,
                lineHeight: 1.35,
              }}
            >
              Front desk note: keep setup turnover under 10 mins.
            </FitText>
            <FitButton
              variant="ghost"
              label="VENUE DETAILS"
              onClick={() => onVenueDetails?.()}
              disabled={isSubmitting || !onVenueDetails}
              style={{ ...actionPillStyle(colors), justifySelf: "start" }}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
          </div>
          <div style={overlaySurfaceStyle(colors)}>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: colors.textPrimary,
              }}
            >
              Decision path
            </FitText>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 12,
                color: colors.textMuted,
                lineHeight: 1.35,
              }}
            >
              {canCollectBalance
                ? "Collect the remaining balance, or send this booking back for reschedule/rejection without marking it paid."
                : approvalAlsoVerifiesPayment
                  ? "Accept the submitted payment, or send it back for reschedule/rejection without leaving Gym Operations."
                  : "Approve, reschedule, or reject without leaving Gym Operations."}
            </FitText>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {isTerminal ? (
                <FitButton
                  variant="ghost"
                  label={booking?.status === "completed" ? "COMPLETED" : "CANCELLED"}
                  onClick={onClose}
                  disabled
                  style={actionPillStyle(colors)}
                  textStyle={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: colors.danger,
                  }}
                  />
              ) : null}
              {visibleDecisionOptions.length > 0 ? (
                <FitSelect
                  options={visibleDecisionOptions.map((value) => ({
                    label:
                      value === "approve" && !approvalAlsoVerifiesPayment
                        ? "Approve"
                        : VENUE_DECISION_LABELS[value],
                    value,
                  }))}
                  value={decision}
                  onChange={(event) =>
                    setDecision(event.target.value as VenueDecision)
                  }
                  disabled={isSubmitting}
                  fullWidth
                  style={{ minWidth: 240 }}
                />
              ) : null}
            </div>
          </div>
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <FitText
            excludeGlobalScale
            style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}
          >
            Audit + note
          </FitText>
          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceRaised,
              minHeight: 56,
              padding: 12,
            }}
          >
            <FitTextArea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Optional handoff note for facilities staff or front desk..."
              style={{ fontSize: 12, lineHeight: 1.4 }}
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
              onClick={onClose}
              disabled={isSubmitting}
              style={actionPillStyle(colors)}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
            <FitButton
              variant="primary"
              label={isSubmitting ? "SAVING..." : "SAVE"}
              onClick={handleSave}
              disabled={
                isSubmitting ||
                isTerminal ||
                visibleDecisionOptions.length === 0 ||
                ((decision === "collect_cash_balance" ||
                  decision === "paymongo_balance") &&
                  !onCollectBalance)
              }
              style={actionPillStyle(colors, true)}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
          </div>
        </div>
      </div>
    </OverlayFrame>
  );
}

export function GymOperationsCreateVenueBookingModal({
  coachOptions,
  isOpen,
  isSubmitting = false,
  memberOptions,
  onClose,
  onCreate,
  venueOptions,
}: {
  coachOptions: SelectOption[];
  isOpen: boolean;
  isSubmitting?: boolean;
  memberOptions: SelectOption[];
  onClose: () => void;
  onCreate: (payload: {
    amenityId: string;
    coachId?: string;
    endsAt: string;
    memberId: string;
    notes?: string;
    paymentStage?: StaffInitialPaymentStage;
    startsAt: string;
  }) => void;
  venueOptions: SelectOption[];
}) {
  const { colors, settings } = useTheme();
  const [memberId, setMemberId] = useState("");
  const [venueId, setVenueId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [date, setDate] = useState(getDefaultDateInput());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [note, setNote] = useState("");
  const [paymentStage, setPaymentStage] =
    useState<StaffInitialPaymentStage>("full");
  const [errorText, setErrorText] = useState("");
  const shouldAnimate = settings.animationLevel !== "none";
  const inputStyle = modalFieldStyle(colors);
  const textAreaStyle = modalTextAreaStyle(colors);
  const { data: venueAvailability = [] } = useQuery({
    ...venueAvailabilityQueryOptions<VenueAvailabilityRecord>(
      webApiClient,
      venueId || undefined,
      date,
    ),
    enabled: isOpen && Boolean(venueId) && Boolean(date),
  });

  useEffect(() => {
    if (!isOpen) return;
    setMemberId((current) => current || memberOptions[0]?.value || "");
    setVenueId((current) => current || venueOptions[0]?.value || "");
    setCoachId("");
    setDate(getDefaultDateInput());
    setDatePickerOpen(false);
    setStartTime("09:00");
    setEndTime("10:00");
    setNote("");
    setPaymentStage("full");
    setErrorText("");
  }, [coachOptions, isOpen, memberOptions, venueOptions]);

  const venueStartOptions = useMemo(
    () =>
      VENUE_SLOT_OPTIONS.map((value) => ({
        label: formatSlotLabel(value),
        value,
      })),
    [],
  );
  const venueEndOptions = useMemo(
    () =>
      VENUE_SLOT_OPTIONS.filter((value) => value > startTime).map((value) => ({
        label: formatSlotLabel(value),
        value,
      })),
    [startTime],
  );

  useEffect(() => {
    if (!venueEndOptions.some((option) => option.value === endTime)) {
      setEndTime(venueEndOptions[0]?.value ?? "");
    }
  }, [endTime, venueEndOptions]);

  const hasConflict = hasVenueWindowConflict(
    venueAvailability,
    startTime,
    endTime,
  );
  const selectedVenueOption = venueOptions.find(
    (option) => option.value === venueId,
  );
  const selectedCoachOption = coachOptions.find(
    (option) => option.value === coachId,
  );
  const durationMinutes = Math.max(
    0,
    toMinutes(endTime) - toMinutes(startTime),
  );
  const venueHourlyRate = selectedVenueOption?.hourlyRate ?? 0;
  const coachHourlyRate = selectedCoachOption?.hourlyRate ?? 0;
  const estimatedVenueTotal = (venueHourlyRate * durationMinutes) / 60;
  const estimatedCoachTotal = coachId
    ? (coachHourlyRate * durationMinutes) / 60
    : 0;
  const estimatedBookingTotal = estimatedVenueTotal + estimatedCoachTotal;
  const amountDueNow = getInitialPaymentAmount(
    estimatedBookingTotal,
    paymentStage,
  );
  const remainingBalance = roundCurrency(
    Math.max(estimatedBookingTotal - amountDueNow, 0),
  );
  const canSubmit =
    Boolean(memberId) &&
    Boolean(venueId) &&
    Boolean(date) &&
    Boolean(startTime) &&
    Boolean(endTime) &&
    endTime > startTime &&
    !hasConflict;

  const handleCreate = () => {
    setErrorText("");
    if (!memberId) {
      setErrorText("Select the member for this venue booking.");
      return;
    }
    if (!venueId) {
      setErrorText("Select a venue before creating the booking.");
      return;
    }
    if (!date || !startTime || !endTime || endTime <= startTime) {
      setErrorText("Select a valid date and time window.");
      return;
    }
    if (hasConflict) {
      setErrorText(
        "The selected venue already has a pending or confirmed booking in this time window.",
      );
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Create this manual venue booking and record ${formatPeso(amountDueNow)} as ${paymentStage === "downpayment" ? "cash downpayment" : "full cash payment"}?`,
      )
    ) {
      return;
    }

    onCreate({
      amenityId: venueId,
      ...(coachId ? { coachId } : {}),
      endsAt: toIsoString(date, endTime),
      memberId,
      ...(note.trim() ? { notes: note.trim() } : {}),
      paymentStage,
      startsAt: toIsoString(date, startTime),
    });
  };

  return (
    <OverlayFrame isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 760,
          maxWidth: "min(760px, calc(100vw - 48px))",
          maxHeight: "min(760px, calc(100vh - 48px))",
          overflow: "auto",
          margin: "auto",
          padding: 40,
          borderRadius: 26,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          display: "grid",
          gap: 20,
          boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
          transform: shouldAnimate && isOpen ? "scale(1)" : "scale(0.985)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: colors.textPrimary,
              lineHeight: 1.12,
            }}
          >
            Create venue booking
          </FitText>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 14,
              color: colors.textMuted,
              lineHeight: 1.32,
              maxWidth: 560,
            }}
          >
            Use this for front-desk or operator-created reservations. The
            booking is persisted immediately into the shared venue booking
            table.
          </FitText>
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Member
              </FitText>
              <FitSelect
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
                options={memberOptions}
                compact
                fullWidth
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Venue
              </FitText>
              <FitSelect
                value={venueId}
                onChange={(event) => setVenueId(event.target.value)}
                options={venueOptions}
                compact
                fullWidth
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Date
              </FitText>
              <FitButton
                variant="ghost"
                label={date ? formatCompactDate(date) : "Select date"}
                onClick={() => setDatePickerOpen(true)}
                style={{
                  ...inputStyle,
                  justifyContent: "flex-start",
                  minHeight: 46,
                  width: "100%",
                }}
                textStyle={{ fontSize: 13, fontWeight: 700 }}
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Start time
              </FitText>
              <FitSelect
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                options={venueStartOptions}
                compact
                fullWidth
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                End time
              </FitText>
              <FitSelect
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                options={venueEndOptions}
                compact
                fullWidth
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Optional coach add-on
            </FitText>
            <FitSelect
              value={coachId}
              onChange={(event) => setCoachId(event.target.value)}
              options={[
                { label: "No coach add-on", value: "" },
                ...coachOptions,
              ]}
              compact
              fullWidth
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div style={bookingAmountCardStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: colors.textMuted,
                }}
              >
                Venue rate
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 20, fontWeight: 900, color: colors.brand }}
              >
                {formatPeso(venueHourlyRate)}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.textMuted }}
              >
                Per hour from Facilities
              </FitText>
            </div>
            <div style={bookingAmountCardStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: colors.textMuted,
                }}
              >
                Duration
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: colors.textPrimary,
                }}
              >
                {durationMinutes} min
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.textMuted }}
              >
                Selected time window
              </FitText>
            </div>
            <div style={bookingAmountCardStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: colors.textMuted,
                }}
              >
                Revenue recorded
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 20, fontWeight: 900, color: colors.brand }}
              >
                {formatPeso(coachId ? amountDueNow : getInitialPaymentAmount(estimatedVenueTotal, paymentStage))}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.textMuted }}
              >
                Due now from selected payment option
              </FitText>
            </div>
          </div>
          {coachId ? (
            <div style={bookingAmountCardStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: colors.textMuted,
                }}
              >
                Booking total
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 20, fontWeight: 900, color: colors.brand }}
              >
                {formatPeso(estimatedBookingTotal)}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.textMuted }}
              >
                Includes {formatPeso(estimatedCoachTotal)} coach add-on /{" "}
                {remainingBalance > 0
                  ? `${formatPeso(remainingBalance)} remaining`
                  : "fully paid"}
              </FitText>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Payment option
            </FitText>
            <FitSelect
              value={paymentStage}
              onChange={(event) =>
                setPaymentStage(event.target.value as StaffInitialPaymentStage)
              }
              options={[
                { label: "Cash Full Payment", value: "full" },
                { label: "Cash Downpayment", value: "downpayment" },
              ]}
              compact
              fullWidth
            />
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              {paymentStage === "downpayment"
                ? `${formatPeso(amountDueNow)} is approved now; ${formatPeso(remainingBalance)} remains pending full payment.`
                : `${formatPeso(amountDueNow)} is approved now as the full payment.`}
            </FitText>
          </div>

          {hasConflict || errorText ? (
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${colors.danger}44`,
                backgroundColor: `${colors.danger}12`,
                padding: 12,
              }}
            >
              <FitText
                excludeGlobalScale
                style={{ fontSize: 12, color: colors.danger, lineHeight: 1.45 }}
              >
                {errorText ||
                  "The selected venue is already occupied in this time window."}
              </FitText>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Operator note
            </FitText>
            <FitTextArea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Optional front-desk or facilities note..."
              style={textAreaStyle}
            />
          </div>
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
            onClick={onClose}
            disabled={isSubmitting}
            style={actionPillStyle(colors)}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
          <FitButton
            variant="primary"
            label={isSubmitting ? "CREATING..." : "CREATE BOOKING"}
            onClick={handleCreate}
            disabled={!canSubmit || isSubmitting}
            style={actionPillStyle(colors, true)}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
        </div>
        <CalendarModal
          isOpen={datePickerOpen}
          selectedDate={date}
          onClose={() => setDatePickerOpen(false)}
          onSelect={(nextDate) => {
            if (nextDate) setDate(nextDate);
          }}
        />
      </div>
    </OverlayFrame>
  );
}

export function GymOperationsCreateCoachBookingModal({
  coachOptions,
  isOpen,
  isSubmitting = false,
  memberOptions,
  onClose,
  onCreate,
}: {
  coachOptions: SelectOption[];
  isOpen: boolean;
  isSubmitting?: boolean;
  memberOptions: SelectOption[];
  onClose: () => void;
  onCreate: (payload: {
    coachId: string;
    durationMinutes: number;
    memberId: string;
    memberNotes?: string;
    paymentStage?: StaffInitialPaymentStage;
    scheduledAt: string;
  }) => void;
}) {
  const { colors, settings } = useTheme();
  const [memberId, setMemberId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [date, setDate] = useState(getDefaultDateInput());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [slotValue, setSlotValue] = useState("");
  const [note, setNote] = useState("");
  const [paymentStage, setPaymentStage] =
    useState<StaffInitialPaymentStage>("full");
  const [errorText, setErrorText] = useState("");
  const shouldAnimate = settings.animationLevel !== "none";
  const inputStyle = modalFieldStyle(colors);
  const textAreaStyle = modalTextAreaStyle(colors);
  const { data: coachAvailability, isLoading: coachAvailabilityLoading } =
    useQuery({
      ...coachAvailabilityQueryOptions<CoachAvailabilityResponse>(
        webApiClient,
        coachId || undefined,
      ),
      enabled: isOpen && Boolean(coachId),
    });

  useEffect(() => {
    if (!isOpen) return;
    setMemberId((current) => current || memberOptions[0]?.value || "");
    setCoachId((current) => current || coachOptions[0]?.value || "");
    setDate(getDefaultDateInput());
    setDatePickerOpen(false);
    setSlotValue("");
    setNote("");
    setPaymentStage("full");
    setErrorText("");
  }, [coachOptions, isOpen, memberOptions]);

  const slotOptions = useMemo(() => {
    if (!coachAvailability?.availability) {
      return [];
    }

    return coachAvailability.availability
      .filter((slot) => slot.isAvailable && matchesDay(date, slot.dayOfWeek))
      .map((slot) => {
        const durationMinutes = getDurationMinutes(
          slot.startTime,
          slot.endTime,
        );
        return {
          durationMinutes,
          label: `${formatSlotLabel(slot.startTime)} - ${formatDurationLabel(durationMinutes)}`,
          startTime: slot.startTime,
          value: `${slot.startTime}|${durationMinutes}`,
        };
      });
  }, [coachAvailability?.availability, date]);

  useEffect(() => {
    if (!slotOptions.some((slot) => slot.value === slotValue)) {
      setSlotValue(slotOptions[0]?.value ?? "");
    }
  }, [slotOptions, slotValue]);

  const selectedSlot =
    slotOptions.find((slot) => slot.value === slotValue) ?? null;
  const selectedCoachOption = coachOptions.find(
    (option) => option.value === coachId,
  );
  const coachHourlyRate = selectedCoachOption?.hourlyRate ?? 0;
  const estimatedCoachTotal =
    (coachHourlyRate * (selectedSlot?.durationMinutes ?? 0)) / 60;
  const amountDueNow = getInitialPaymentAmount(
    estimatedCoachTotal,
    paymentStage,
  );
  const remainingBalance = roundCurrency(
    Math.max(estimatedCoachTotal - amountDueNow, 0),
  );
  const canSubmit =
    Boolean(memberId) &&
    Boolean(coachId) &&
    Boolean(date) &&
    Boolean(selectedSlot);

  const handleCreate = () => {
    setErrorText("");
    if (!memberId) {
      setErrorText("Select the member for this coach booking.");
      return;
    }
    if (!coachId) {
      setErrorText("Select a coach profile before creating the booking.");
      return;
    }
    if (!date) {
      setErrorText("Select a booking date.");
      return;
    }
    if (!selectedSlot) {
      setErrorText(
        "Select one of the coach's available timeslots for this date.",
      );
      return;
    }
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Create this manual coach booking and record ${formatPeso(amountDueNow)} as ${paymentStage === "downpayment" ? "cash downpayment" : "full cash payment"}?`,
      )
    ) {
      return;
    }

    onCreate({
      coachId,
      durationMinutes: selectedSlot?.durationMinutes ?? 0,
      memberId,
      ...(note.trim() ? { memberNotes: note.trim() } : {}),
      paymentStage,
      scheduledAt: toIsoString(date, selectedSlot?.startTime ?? "00:00"),
    });
  };

  return (
    <OverlayFrame isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 760,
          maxWidth: "min(760px, calc(100vw - 48px))",
          maxHeight: "min(760px, calc(100vh - 48px))",
          overflow: "auto",
          margin: "auto",
          padding: 40,
          borderRadius: 26,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          display: "grid",
          gap: 20,
          boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
          transform: shouldAnimate && isOpen ? "scale(1)" : "scale(0.985)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: colors.textPrimary,
              lineHeight: 1.12,
            }}
          >
            Create coach booking
          </FitText>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 14,
              color: colors.textMuted,
              lineHeight: 1.32,
              maxWidth: 560,
            }}
          >
            Use this for a front-desk or operator-created coaching session. The
            appointment is persisted immediately into the shared coaching
            schedule.
          </FitText>
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Member
              </FitText>
              <FitSelect
                value={memberId}
                onChange={(event) => setMemberId(event.target.value)}
                options={memberOptions}
                compact
                fullWidth
              />
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Coach
              </FitText>
              <FitSelect
                value={coachId}
                onChange={(event) => setCoachId(event.target.value)}
                options={coachOptions}
                compact
                fullWidth
              />
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Date
              </FitText>
              <FitButton
                variant="ghost"
                label={date ? formatCompactDate(date) : "Select date"}
                onClick={() => setDatePickerOpen(true)}
                style={{
                  ...inputStyle,
                  justifyContent: "flex-start",
                  minHeight: 46,
                  width: "100%",
                  borderColor:
                    slotOptions.length > 0 ? colors.success : colors.border,
                }}
                textStyle={{ fontSize: 13, fontWeight: 700 }}
              />
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  color:
                    slotOptions.length > 0 ? colors.success : colors.textMuted,
                }}
              >
                {coachAvailabilityLoading
                  ? "Checking coach availability..."
                  : slotOptions.length > 0
                    ? `${slotOptions.length} available coach slot${slotOptions.length === 1 ? "" : "s"} on this date.`
                    : coachId
                      ? "No coach slots are available on this date."
                      : "Select a coach to check availability."}
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 6, gridColumn: "span 2" }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Available timeslot
              </FitText>
              <FitSelect
                value={slotValue}
                onChange={(event) => setSlotValue(event.target.value)}
                options={slotOptions.map((slot) => ({
                  label: slot.label,
                  value: slot.value,
                }))}
                placeholder={
                  coachAvailabilityLoading ? "Loading slots" : "No slots found"
                }
                compact
                fullWidth
              />
            </div>
          </div>

          <div
            style={{
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surfaceRaised,
              minHeight: 54,
              padding: 12,
              display: "grid",
              gap: 6,
            }}
          >
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 12,
                color: colors.textPrimary,
                lineHeight: 1.45,
              }}
            >
              {coachAvailabilityLoading
                ? "Loading live coach availability."
                : slotOptions.length > 0
                  ? `${slotOptions.length} live slot${slotOptions.length === 1 ? "" : "s"} available on the selected date.`
                  : "No live coach slots are available on the selected date."}
            </FitText>
            {selectedSlot ? (
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  lineHeight: 1.45,
                }}
              >
                Selected: {selectedSlot.label}
              </FitText>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <div style={bookingAmountCardStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: colors.textMuted,
                }}
              >
                Coach rate
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 20, fontWeight: 900, color: colors.brand }}
              >
                {formatPeso(coachHourlyRate)}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.textMuted }}
              >
                Per hour from coach profile
              </FitText>
            </div>
            <div style={bookingAmountCardStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: colors.textMuted,
                }}
              >
                Duration
              </FitText>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  color: colors.textPrimary,
                }}
              >
                {selectedSlot?.durationMinutes ?? 0} min
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.textMuted }}
              >
                Selected coach slot
              </FitText>
            </div>
            <div style={bookingAmountCardStyle(colors)}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: 0.7,
                  textTransform: "uppercase",
                  color: colors.textMuted,
                }}
              >
                Revenue recorded
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 20, fontWeight: 900, color: colors.brand }}
              >
                {formatPeso(amountDueNow)}
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.textMuted }}
              >
                Due now from selected payment option
              </FitText>
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Payment option
            </FitText>
            <FitSelect
              value={paymentStage}
              onChange={(event) =>
                setPaymentStage(event.target.value as StaffInitialPaymentStage)
              }
              options={[
                { label: "Cash Full Payment", value: "full" },
                { label: "Cash Downpayment", value: "downpayment" },
              ]}
              compact
              fullWidth
            />
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              {paymentStage === "downpayment"
                ? `${formatPeso(amountDueNow)} is approved now; ${formatPeso(remainingBalance)} remains pending full payment.`
                : `${formatPeso(amountDueNow)} is approved now as the full payment.`}
            </FitText>
          </div>

          {errorText ? (
            <div
              style={{
                borderRadius: 14,
                border: `1px solid ${colors.danger}44`,
                backgroundColor: `${colors.danger}12`,
                padding: 12,
              }}
            >
              <FitText
                excludeGlobalScale
                style={{ fontSize: 12, color: colors.danger, lineHeight: 1.45 }}
              >
                {errorText}
              </FitText>
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Session note
            </FitText>
            <FitTextArea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Optional handoff note for the coach or front desk..."
              style={textAreaStyle}
            />
          </div>
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
            onClick={onClose}
            disabled={isSubmitting}
            style={actionPillStyle(colors)}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
          <FitButton
            variant="primary"
            label={isSubmitting ? "CREATING..." : "CREATE BOOKING"}
            onClick={handleCreate}
            disabled={!canSubmit || isSubmitting}
            style={actionPillStyle(colors, true)}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
        </div>
        <CalendarModal
          isOpen={datePickerOpen}
          selectedDate={date}
          onClose={() => setDatePickerOpen(false)}
          onSelect={(nextDate) => {
            if (nextDate) setDate(nextDate);
          }}
        />
      </div>
    </OverlayFrame>
  );
}

export function GymOperationsCreateCoachModal({
  isOpen,
  isSubmitting = false,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  isSubmitting?: boolean;
  onClose: () => void;
  onCreate: (payload: {
    bio?: string;
    certifications?: string[];
    contactEmail?: string;
    contactPhone?: string;
    displayName: string;
    hourlyRate?: number;
    isAvailableForBooking?: boolean;
    specialties?: string[];
  }) => void;
}) {
  const { colors, settings } = useTheme();
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [specialties, setSpecialties] = useState("");
  const [certifications, setCertifications] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [isAvailableForBooking, setIsAvailableForBooking] = useState("active");
  const [bio, setBio] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const shouldAnimate = settings.animationLevel !== "none";
  const inputStyle = modalFieldStyle(colors);
  const textAreaStyle = modalTextAreaStyle(colors);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName("");
    setContactEmail("");
    setContactPhone("");
    setSpecialties("");
    setCertifications("");
    setHourlyRate("");
    setIsAvailableForBooking("active");
    setBio("");
    setErrors({});
  }, [isOpen]);

  const specialtiesList = useMemo(
    () => splitListInput(specialties),
    [specialties],
  );
  const certificationsList = useMemo(
    () => splitListInput(certifications),
    [certifications],
  );
  const hourlyRateValue = Number(hourlyRate);
  const canSubmit =
    displayName.trim().length > 0 &&
    specialtiesList.length > 0 &&
    hourlyRate.trim().length > 0 &&
    Number.isFinite(hourlyRateValue) &&
    hourlyRateValue > 0 &&
    !isSubmitting;

  const validateCoach = () => {
    const nextErrors: Record<string, string> = {};
    const name = displayName.trim();
    const email = contactEmail.trim();
    const phone = contactPhone.trim();
    const joinedSpecialties = specialtiesList.join(", ");
    const joinedCertifications = certificationsList.join(", ");

    if (!name) nextErrors.displayName = "Coach name is required.";
    if (name.length > 160)
      nextErrors.displayName = "Coach name must not exceed 160 characters.";
    if (email && !EMAIL_PATTERN.test(email))
      nextErrors.contactEmail = "Enter a valid coach contact email.";
    if (email.length > 255)
      nextErrors.contactEmail = "Contact email must not exceed 255 characters.";
    if (phone && !PHONE_PATTERN.test(phone))
      nextErrors.contactPhone = "Enter a valid contact phone number.";
    if (phone.length > 40)
      nextErrors.contactPhone = "Contact phone must not exceed 40 characters.";
    if (specialtiesList.length === 0)
      nextErrors.specialties = "Enter at least one specialty.";
    if (joinedSpecialties.length > 255)
      nextErrors.specialties = "Specialties must not exceed 255 characters.";
    if (joinedCertifications.length > 255)
      nextErrors.certifications =
        "Certifications must not exceed 255 characters.";
    if (!hourlyRate.trim()) {
      nextErrors.hourlyRate = "Hourly rate is required.";
    } else if (!Number.isFinite(hourlyRateValue) || hourlyRateValue <= 0) {
      nextErrors.hourlyRate = "Hourly rate must be greater than zero.";
    }
    if (bio.length > 2000)
      nextErrors.bio = "Bio must not exceed 2000 characters.";

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleCreate = () => {
    if (!validateCoach()) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Create this standalone coach now?")
    ) {
      return;
    }

    onCreate({
      ...(bio.trim() ? { bio: bio.trim() } : {}),
      ...(certificationsList.length > 0
        ? { certifications: certificationsList }
        : {}),
      ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
      ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
      displayName: displayName.trim(),
      hourlyRate: hourlyRateValue,
      isAvailableForBooking: isAvailableForBooking === "active",
      specialties: specialtiesList,
    });
  };

  return (
    <OverlayFrame isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 760,
          maxWidth: "min(760px, calc(100vw - 48px))",
          maxHeight: "min(760px, calc(100vh - 48px))",
          overflow: "auto",
          margin: "auto",
          padding: 40,
          borderRadius: 26,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          display: "grid",
          gap: 20,
          boxShadow: "0 18px 42px rgba(0,0,0,0.28)",
          transform: shouldAnimate && isOpen ? "scale(1)" : "scale(0.985)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
        }}
      >
        <div style={{ display: "grid", gap: 10 }}>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: colors.textPrimary,
              lineHeight: 1.12,
            }}
          >
            Create coach
          </FitText>
          <FitText
            excludeGlobalScale
            style={{
              fontSize: 14,
              color: colors.textMuted,
              lineHeight: 1.32,
              maxWidth: 560,
            }}
          >
            Create a standalone coach record for Gym Operations. This does not
            create a mobile/member profile or login account.
          </FitText>
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Coach name
              </FitText>
              <FitTextInput
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Coach name"
                style={inputStyle}
              />
              {errors.displayName ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.displayName}
                </FitText>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Hourly rate
              </FitText>
              <FitTextInput
                type="number"
                value={hourlyRate}
                onChange={(event) => setHourlyRate(event.target.value)}
                placeholder="0"
                style={inputStyle}
              />
              {errors.hourlyRate ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.hourlyRate}
                </FitText>
              ) : null}
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Contact email
              </FitText>
              <FitTextInput
                value={contactEmail}
                onChange={(event) => setContactEmail(event.target.value)}
                placeholder="coach@fittrack.com"
                style={inputStyle}
              />
              {errors.contactEmail ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.contactEmail}
                </FitText>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Contact phone
              </FitText>
              <FitTextInput
                value={contactPhone}
                onChange={(event) => setContactPhone(event.target.value)}
                placeholder="+639171234567"
                style={inputStyle}
              />
              {errors.contactPhone ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.contactPhone}
                </FitText>
              ) : null}
            </div>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}
          >
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Specialties
              </FitText>
              <FitTextArea
                value={specialties}
                onChange={(event) => setSpecialties(event.target.value)}
                rows={3}
                placeholder="Strength, Mobility"
                style={textAreaStyle}
              />
              {errors.specialties ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.specialties}
                </FitText>
              ) : null}
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: colors.textMuted,
                }}
              >
                Certifications
              </FitText>
              <FitTextArea
                value={certifications}
                onChange={(event) => setCertifications(event.target.value)}
                rows={3}
                placeholder="NASM-CPT, CrossFit L1"
                style={textAreaStyle}
              />
              {errors.certifications ? (
                <FitText
                  excludeGlobalScale
                  style={{ fontSize: 11, color: colors.danger }}
                >
                  {errors.certifications}
                </FitText>
              ) : null}
            </div>
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Booking visibility
            </FitText>
            <FitSelect
              value={isAvailableForBooking}
              onChange={(event) => setIsAvailableForBooking(event.target.value)}
              options={[
                { label: "Visible to member booking", value: "active" },
                { label: "Hidden until ready", value: "inactive" },
              ]}
              compact
              fullWidth
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textMuted }}
            >
              Bio
            </FitText>
            <FitTextArea
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              placeholder="Short member-facing coach summary..."
              style={textAreaStyle}
            />
            {errors.bio ? (
              <FitText
                excludeGlobalScale
                style={{ fontSize: 11, color: colors.danger }}
              >
                {errors.bio}
              </FitText>
            ) : null}
          </div>
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
            onClick={onClose}
            disabled={isSubmitting}
            style={actionPillStyle(colors)}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
          <FitButton
            variant="primary"
            label={isSubmitting ? "CREATING..." : "CREATE COACH"}
            onClick={handleCreate}
            disabled={!canSubmit || isSubmitting}
            style={actionPillStyle(colors, true)}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
        </div>
      </div>
    </OverlayFrame>
  );
}
