"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";

import type { StaffAppointmentRecord } from "@fittrack/api-client";

import type { VenueBookingRecord } from "@/contexts/ScheduleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FitButton, FitText, FitTextInput, FitTextArea } from "@/components/fit";

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

type VenueDecision = "approve" | "reject" | "request_new_slot";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
        label: status === "pending_coach" ? "Pending coach" : "Pending venue booking",
      };
    case "pending_payment":
      return {
        bg: colors.warning,
        color: colors.onBrand ?? "#120e0b",
        label: "Pending payment",
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
  onReject,
}: {
  appointment: StaffAppointmentRecord | null;
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
  onReject: (note: string) => void;
}) {
  const { colors, settings } = useTheme();
  const [note, setNote] = useState("");
  const shouldAnimate = settings.animationLevel !== "none";
  const status = appointment?.status ?? "pending_coach";
  const tone = buildStatusTone(status, colors);
  const canConfirm = status === "pending_coach";
  const canComplete = status === "confirmed";
  const isRecurring = Boolean(appointment?.recurringPlanId);
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

  const title = canConfirm ? "Review coach appointment" : "Coach appointment actions";
  const description = canConfirm
    ? "Confirm, reject, or keep the request pending without leaving Gym Operations."
    : "Review the current session state and resolve the next action without leaving Gym Operations.";

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
          <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: tone.color }}>
            {tone.label}
          </FitText>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <FitText excludeGlobalScale style={{ fontSize: 30, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.12 }}>
            {title}
          </FitText>
          <FitText
            excludeGlobalScale
            style={{ fontSize: 14, color: colors.textMuted, lineHeight: 1.32, maxWidth: 520 }}
          >
            {description}
          </FitText>
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <FitText excludeGlobalScale style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
                {memberName}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 13, color: colors.textMuted }}>
                with {coachName}
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                {scheduleWindow.dateLabel} / {scheduleWindow.timeLabel}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
                {appointment?.notes?.trim() || "No member note was provided for this appointment."}
              </FitText>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={overlaySurfaceStyle(colors)}>
            <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
              Coach readiness
            </FitText>
            <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
              Visibility: {coachReadiness.isVisible ? "visible" : "hidden"}
            </FitText>
            <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
              Peak slots open: {coachReadiness.openPeakSlots}
            </FitText>
            <FitText excludeGlobalScale style={{ fontSize: 12, fontWeight: 700, color: colors.success }}>
              Profile trust: {coachReadiness.trustLabel}
            </FitText>
          </div>
          <div style={overlaySurfaceStyle(colors)}>
            <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
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
                Recurring plan controls
              </FitText>
              <FitText
                excludeGlobalScale
                style={{ fontSize: 12, color: colors.textMuted }}
              >
                Choose whether this change affects one generated session or the
                future series.
              </FitText>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <FitButton
                variant="ghost"
                label="THIS SESSION ONLY"
                onClick={onEditRecurringSession}
                disabled={isSubmitting || !onEditRecurringSession}
                style={actionPillStyle(colors)}
                textStyle={{ fontSize: 13, fontWeight: 700 }}
              />
              <FitButton
                variant="ghost"
                label="THIS + FUTURE"
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
        ) : null}

        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
            Decision path
          </FitText>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {canConfirm ? (
              <>
                <FitButton
                  variant="primary"
                  label={isSubmitting ? "CONFIRMING..." : "CONFIRM SESSION"}
                  onClick={onConfirm}
                  disabled={isSubmitting}
                  style={actionPillStyle(colors, true)}
                  textStyle={{ fontSize: 13, fontWeight: 700 }}
                />
                <FitButton
                  variant="ghost"
                  label="REJECT"
                  onClick={() => onReject(note.trim())}
                  disabled={isSubmitting || !note.trim()}
                  style={actionPillStyle(colors)}
                  textStyle={{ fontSize: 13, fontWeight: 700 }}
                />
                <FitButton
                  variant="ghost"
                  label="KEEP PENDING"
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={actionPillStyle(colors)}
                  textStyle={{ fontSize: 13, fontWeight: 700 }}
                />
                <FitButton
                  variant="ghost"
                  label="CANCEL"
                  onClick={() => onCancelAppointment(note.trim())}
                  disabled={isSubmitting || !note.trim()}
                  style={actionPillStyle(colors)}
                  textStyle={{ fontSize: 13, fontWeight: 700 }}
                />
              </>
            ) : canComplete ? (
              <>
                <FitButton
                  variant="primary"
                  label={isSubmitting ? "COMPLETING..." : "MARK COMPLETE"}
                  onClick={() => onComplete(note.trim())}
                  disabled={isSubmitting}
                  style={actionPillStyle(colors, true)}
                  textStyle={{ fontSize: 13, fontWeight: 700 }}
                />
                <FitButton
                  variant="ghost"
                  label="CANCEL"
                  onClick={() => onCancelAppointment(note.trim())}
                  disabled={isSubmitting || !note.trim()}
                  style={actionPillStyle(colors)}
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
              </>
            ) : (
              <>
                <FitButton
                  variant="ghost"
                  label="KEEP PENDING"
                  onClick={onClose}
                  disabled={isSubmitting}
                  style={actionPillStyle(colors)}
                  textStyle={{ fontSize: 13, fontWeight: 700 }}
                />
                <FitButton
                  variant="ghost"
                  label="CANCEL"
                  onClick={() => onCancelAppointment(note.trim())}
                  disabled={isSubmitting || !note.trim()}
                  style={actionPillStyle(colors)}
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
              </>
            )}
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
  onHideFromBooking,
}: {
  coachName: string;
  initialSlots: AvailabilitySlotDraft[];
  isOpen: boolean;
  isSaving?: boolean;
  isVisibleInBooking: boolean;
  onClose: () => void;
  onSave: (slots: AvailabilitySlotDraft[]) => Promise<void> | void;
  onHideFromBooking: () => void;
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

  const updateSlot = (index: number, patch: Partial<AvailabilitySlotDraft>) => {
    setSlots((current) =>
      current.map((slot, slotIndex) =>
        slotIndex === index ? { ...slot, ...patch } : slot,
      ),
    );
  };

  const handleSave = async () => {
    await onSave(slotRows);
  };

  return (
    <OverlayFrame isOpen={isOpen} onClose={isSaving ? () => {} : onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          marginLeft: "auto",
          width: 604,
          maxWidth: "min(604px, calc(100vw - 24px))",
          height: "100%",
          borderTopLeftRadius: 28,
          borderBottomLeftRadius: 28,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          padding: "52px 47px 40px",
          display: "grid",
          gridTemplateRows: "auto auto 1fr auto",
          gap: 24,
          transform: shouldAnimate && isOpen ? "translateX(0)" : "translateX(18px)",
          transition: shouldAnimate ? "transform 180ms ease" : "none",
          boxShadow: "0 24px 48px rgba(0,0,0,0.28)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <FitText excludeGlobalScale style={{ fontSize: 28, fontWeight: 800, color: colors.textPrimary }}>
              Manage availability
            </FitText>
            <FitText excludeGlobalScale style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.25 }}>
              {coachName} / weekly slot ownership / booking-visible schedule
            </FitText>
          </div>
          <FitButton
            variant="primary"
            label={isVisibleInBooking ? "VISIBLE IN BOOKING" : "HIDDEN FROM BOOKING"}
            disabled
            style={actionPillStyle(colors, true)}
            textStyle={{ fontSize: 12, fontWeight: 700 }}
          />
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 12 }}>
          <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
            Weekly lane control
          </FitText>
          <div style={{ display: "grid", gap: 10 }}>
            {slotRows.map((slot, index) => {
              const isPeak = slot.dayOfWeek === 2 || slot.dayOfWeek === 5;
              return (
                <div
                  key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}-${index}`}
                  style={{
                    minHeight: 46,
                    borderRadius: 14,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surfaceRaised,
                    padding: "7px 14px",
                    display: "grid",
                    gridTemplateColumns: "50px minmax(0, 1fr) auto auto auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <FitText excludeGlobalScale style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>
                    {WEEKDAY_LABELS[slot.dayOfWeek] ?? `Day ${slot.dayOfWeek}`}
                  </FitText>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <FitTextInput
                      type="time"
                      value={slot.startTime}
                      onChange={(event) =>
                        updateSlot(index, { startTime: event.target.value })
                      }
                      disabled={isSaving}
                      style={{ fontSize: 12, maxWidth: 92 }}
                    />
                    <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
                      to
                    </FitText>
                    <FitTextInput
                      type="time"
                      value={slot.endTime}
                      onChange={(event) =>
                        updateSlot(index, { endTime: event.target.value })
                      }
                      disabled={isSaving}
                      style={{ fontSize: 12, maxWidth: 92 }}
                    />
                  </div>
                  <FitButton
                    variant={isPeak ? "primary" : "ghost"}
                    label={isPeak ? "PEAK" : "OPEN"}
                    disabled
                    style={{ ...actionPillStyle(colors, isPeak), minWidth: 68, padding: "6px 12px" }}
                    textStyle={{ fontSize: 12, fontWeight: 700 }}
                  />
                  <FitButton
                    variant="ghost"
                    label="EDIT"
                    disabled
                    style={{ ...actionPillStyle(colors), minWidth: 56, padding: "6px 12px" }}
                    textStyle={{ fontSize: 12, fontWeight: 700 }}
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
                    style={{ ...actionPillStyle(colors), minWidth: 78, padding: "6px 12px" }}
                    textStyle={{ fontSize: 12, fontWeight: 700 }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 16 }}>
          <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
            Visibility + notes
          </FitText>
          <FitText excludeGlobalScale style={{ fontSize: 13, color: colors.textMuted, lineHeight: 1.35 }}>
            Use this drawer to adjust weekly slots and protect member booking trust without leaving the coach tab.
          </FitText>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <FitButton
              variant="ghost"
              label="HIDE FROM BOOKING"
              onClick={onHideFromBooking}
              disabled={isSaving}
              style={actionPillStyle(colors)}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
            <FitButton
              variant="primary"
              label={isSaving ? "SAVING..." : "SAVE SCHEDULE"}
              onClick={() => void handleSave()}
              disabled={isSaving}
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
  onClose,
  onReject,
  onRequestNewSlot,
}: {
  booking: VenueBookingRecord | null;
  isOpen: boolean;
  isSubmitting?: boolean;
  onApprove: (note: string) => void;
  onClose: () => void;
  onReject: (note: string) => void;
  onRequestNewSlot: (note: string) => void;
}) {
  const { colors, settings } = useTheme();
  const [decision, setDecision] = useState<VenueDecision>("approve");
  const [note, setNote] = useState("");
  const shouldAnimate = settings.animationLevel !== "none";
  const windowSummary = booking
    ? formatVenueWindow(booking)
    : { dateLabel: "-", timeLabel: "-" };
  const tone = buildStatusTone(booking?.status ?? "pending", colors);

  useEffect(() => {
    if (!isOpen) return;
    setDecision("approve");
    setNote("");
  }, [isOpen, booking?.id]);

  const handleSave = () => {
    const trimmed = note.trim();
    if (decision === "approve") {
      onApprove(trimmed);
      return;
    }
    if (decision === "reject") {
      onReject(trimmed);
      return;
    }
    onRequestNewSlot(trimmed);
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
          <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: tone.color }}>
            {tone.label}
          </FitText>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <FitText excludeGlobalScale style={{ fontSize: 30, fontWeight: 800, color: colors.textPrimary, lineHeight: 1.12 }}>
            Review venue booking
          </FitText>
          <FitText excludeGlobalScale style={{ fontSize: 14, color: colors.textMuted, lineHeight: 1.3, maxWidth: 520 }}>
            Basketball court, boxing ring, and yoga room requests should resolve here before they hit the floor.
          </FitText>
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div style={{ display: "grid", gap: 4 }}>
              <FitText excludeGlobalScale style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
                {booking?.venue?.name ?? "Venue booking"}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
                Member:{" "}
                {getPersonDisplayName(
                  booking?.user?.profile,
                  booking?.user?.email,
                  "Member",
                )}
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                {windowSummary.dateLabel} / {windowSummary.timeLabel}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
                Purpose: {booking?.purpose?.trim() || "General venue use"}
              </FitText>
            </div>
          </div>
          <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
            {booking?.status === "pending"
              ? "Needs review because occupancy pressure is high and adjacent venue load is building."
              : "Use this review surface to document the final facilities decision."}
          </FitText>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={overlaySurfaceStyle(colors)}>
            <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
              Conflict context
            </FitText>
            <FitText excludeGlobalScale style={{ fontSize: 12, fontWeight: 700, color: colors.warning }}>
              Occupancy pressure: medium-high
            </FitText>
            <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
              Adjacent booking: Boxing Ring / 7:30 PM
            </FitText>
            <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.35 }}>
              Front desk note: keep setup turnover under 10 mins.
            </FitText>
            <FitButton
              variant="ghost"
              label="VENUE DETAILS"
              onClick={() => onRequestNewSlot(note.trim())}
              disabled={isSubmitting}
              style={{ ...actionPillStyle(colors), justifySelf: "start" }}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
          </div>
          <div style={overlaySurfaceStyle(colors)}>
            <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
              Decision path
            </FitText>
            <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.35 }}>
              Approve, reschedule, or reject without leaving Gym Operations.
            </FitText>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(["approve", "request_new_slot", "reject"] as VenueDecision[]).map((value) => (
                <FitButton
                  key={value}
                  variant={decision === value ? "primary" : "ghost"}
                  label={
                    value === "approve"
                      ? "APPROVE"
                      : value === "request_new_slot"
                        ? "REQUEST NEW SLOT"
                        : "REJECT"
                  }
                  onClick={() => setDecision(value)}
                  disabled={isSubmitting}
                  style={actionPillStyle(colors, decision === value)}
                  textStyle={{ fontSize: 13, fontWeight: 700 }}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
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
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
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
              disabled={isSubmitting}
              style={actionPillStyle(colors, true)}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
          </div>
        </div>
      </div>
    </OverlayFrame>
  );
}
