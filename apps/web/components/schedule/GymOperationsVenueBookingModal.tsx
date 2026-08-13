"use client";
import { useEffect, useMemo, useState } from "react";
import type { VenueBookingRecord } from "@/contexts/ScheduleContext";
import { useTheme } from "@/contexts/ThemeContext";
import { FitButton, FitSelect, FitText, FitTextArea } from "@/components/fit";
import { ConfirmModal } from "@/components/modals";
import { OverlayAmountGrid } from "./GymOperationsOverlayCards";
import { OverlayFrame } from "./GymOperationsOverlayFrame";
import {
  VENUE_DECISION_LABELS,
  actionPillStyle,
  buildStatusTone,
  canCancelUntilDayBefore,
  formatPeso,
  formatVenueWindow,
  getPersonDisplayName,
  overlaySurfaceStyle,
  type OverlayConfirmation,
  type VenueDecision,
} from "./GymOperationsOverlayShared";

export function GymOperationsVenueBookingModal({
  booking,
  isOpen,
  isCoachView = false,
  isSubmitting = false,
  onCancel,
  onClose,
  onComplete,
  onNoShow,
  onVenueDetails,
}: {
  booking: VenueBookingRecord | null;
  isOpen: boolean;
  isCoachView?: boolean;
  isSubmitting?: boolean;
  onCancel?: (note: string) => void;
  onClose: () => void;
  onComplete?: (note: string) => void;
  onNoShow?: (note: string) => void;
  onVenueDetails?: () => void;
}) {
  const { colors, settings } = useTheme();
  const [decision, setDecision] = useState<VenueDecision>("mark_complete");
  const [note, setNote] = useState("");
  const [decisionConfirm, setDecisionConfirm] = useState<OverlayConfirmation | null>(null);
  const windowSummary = booking
    ? formatVenueWindow(booking)
    : { dateLabel: "-", timeLabel: "-" };
  const isTerminal = Boolean(
    booking && ["cancelled", "completed", "no_show"].includes(booking.status),
  );
  const isConfirmed = booking?.status === "confirmed";
  const canCancelBooking = canCancelUntilDayBefore(booking?.startTime);
  const visibleDecisionOptions = useMemo<VenueDecision[]>(() => {
    if (!booking || isTerminal) return [];
    const baseOptions: VenueDecision[] = isConfirmed
      ? ["mark_complete", "no_show"]
      : [];
    return canCancelBooking ? [...baseOptions, "cancel"] : baseOptions;
  }, [booking, canCancelBooking, isConfirmed, isTerminal]);
  const tone = buildStatusTone(booking?.status ?? "confirmed", colors);

  useEffect(() => {
    if (!isOpen) return;
    setDecision(visibleDecisionOptions[0] ?? "mark_complete");
    setNote("");
    setDecisionConfirm(null);
  }, [isOpen, booking?.id, visibleDecisionOptions]);

  const applyDecision = () => {
    const trimmed = note.trim();
    if (decision === "mark_complete") return onComplete?.(trimmed);
    if (decision === "no_show") return onNoShow?.(trimmed);
    if (decision === "cancel" && canCancelBooking) return onCancel?.(trimmed);
  };

  const handleSave = () => {
    const confirmationMessage =
      decision === "mark_complete"
          ? "Mark this confirmed venue booking complete?"
          : decision === "no_show"
            ? "Mark this confirmed venue booking as no-show?"
            : decision === "cancel"
              ? "Cancel this venue booking now?"
              : "Save this venue booking outcome?";
    setDecisionConfirm({
      confirmLabel: "SAVE",
      isDanger: decision === "cancel" || decision === "no_show",
      message: confirmationMessage,
      onConfirm: applyDecision,
      title: "Confirm venue decision",
    });
  };

  return (
    <>
      <OverlayFrame
        isOpen={isOpen}
        onClose={onClose}
        closeDisabled={isSubmitting}
        title={isCoachView ? "Venue coaching assignment" : "Review venue booking"}
        subtitle={
          isCoachView
            ? "Manage delivery for this fully paid venue coach add-on."
            : "Confirm the venue window and operational outcome for this product booking."
        }
        footer={
          <FitButton
            variant="primary"
            label={isSubmitting ? "SAVING..." : "SAVE"}
            aria-label={isSubmitting ? "Saving venue decision" : "Save venue decision"}
            onClick={handleSave}
            disabled={isSubmitting || isTerminal || visibleDecisionOptions.length === 0}
            style={actionPillStyle(colors, true)}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
        }
      >
        <div
          onClick={(event) => event.stopPropagation()}
          style={{
            display: "grid",
            gap: 14,
            transform: settings.animationLevel !== "none" && isOpen ? "scale(1)" : "scale(0.985)",
            transition: settings.animationLevel !== "none" ? "transform 180ms ease" : "none",
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

          <div style={{ ...overlaySurfaceStyle(colors), gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <FitText excludeGlobalScale style={{ fontSize: 18, fontWeight: 800, color: colors.textPrimary }}>
                  {booking?.venue?.name ?? "Venue booking"}
                </FitText>
                <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
                  Member: {getPersonDisplayName(booking?.user?.profile, booking?.user?.email, "Member")}
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
              {isConfirmed
                ? isCoachView
                  ? "Complete, cancel, or mark no-show for this assigned paid coaching block."
                  : "Use this review surface to document the final facilities outcome."
                : "Only fully paid confirmed bookings expose delivery actions."}
            </FitText>
          </div>

          <OverlayAmountGrid
            colors={colors}
            columns="repeat(3, minmax(0, 1fr))"
            items={[
              {
                label: "Venue rate",
                value:
                  booking?.venue?.hourlyRate != null
                    ? `${formatPeso(booking.venue.hourlyRate)}/hr`
                    : "Not set",
              },
              {
                label: "Total price",
                value: booking?.totalAmount != null ? formatPeso(booking.totalAmount) : "Not set",
              },
              { label: "Booking status", value: tone.label },
            ]}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div style={overlaySurfaceStyle(colors)}>
              <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
                Live booking context
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary }}>
                {windowSummary.dateLabel} / {windowSummary.timeLabel}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.35 }}>
                {booking?.purpose?.trim()
                  ? `Member note: ${booking.purpose.trim()}`
                  : "No member note was submitted for this venue booking."}
              </FitText>
              <FitButton
                variant="ghost"
                label="VENUE DETAILS"
                aria-label="Open venue details"
                onClick={() => onVenueDetails?.()}
                disabled={isSubmitting || !onVenueDetails}
                style={{ ...actionPillStyle(colors), justifySelf: "start" }}
                textStyle={{ fontSize: 13, fontWeight: 700 }}
              />
            </div>
            <div style={overlaySurfaceStyle(colors)}>
              <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
                Delivery actions
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.35 }}>
                {isConfirmed
                  ? "Mark this confirmed venue booking complete or no-show. Cancellation remains available only before the booking day."
                  : "This historical booking has no commercial approval action."}
              </FitText>
              {!canCancelBooking && !isTerminal ? (
                <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.warning, lineHeight: 1.35 }}>
                  Cancellation is closed for this booking because the venue date is too close.
                </FitText>
              ) : null}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {isTerminal ? (
                  <FitButton
                    variant="ghost"
                    label={booking?.status === "completed" ? "COMPLETED" : "CLOSED"}
                    aria-label="Venue booking closed"
                    onClick={onClose}
                    disabled
                    style={actionPillStyle(colors)}
                    textStyle={{ fontSize: 13, fontWeight: 700, color: colors.danger }}
                  />
                ) : null}
                {visibleDecisionOptions.length > 0 ? (
                  <FitSelect
                    options={visibleDecisionOptions.map((value) => ({
                      label: VENUE_DECISION_LABELS[value],
                      value,
                    }))}
                    value={decision}
                    onChange={(event) => setDecision(event.target.value as VenueDecision)}
                    disabled={isSubmitting}
                    fullWidth
                    aria-label="Venue decision"
                    style={{ minWidth: 220 }}
                  />
                ) : null}
              </div>
            </div>
          </div>

          <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
            <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
              Audit + note
            </FitText>
            <FitTextArea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Optional handoff note for facilities staff or front desk..."
              aria-label="Venue decision handoff note"
              style={{ fontSize: 12, lineHeight: 1.4 }}
            />
          </div>
        </div>
      </OverlayFrame>
      <ConfirmModal
        isOpen={!!decisionConfirm}
        title={decisionConfirm?.title ?? "Confirm venue decision"}
        message={decisionConfirm?.message ?? ""}
        confirmLabel={decisionConfirm?.confirmLabel ?? "SAVE"}
        loadingLabel={decisionConfirm?.confirmLabel ?? "SAVE"}
        isDanger={decisionConfirm?.isDanger}
        isLoading={isSubmitting}
        onConfirm={() => {
          const nextAction = decisionConfirm?.onConfirm;
          setDecisionConfirm(null);
          nextAction?.();
        }}
        onCancel={() => setDecisionConfirm(null)}
      />
    </>
  );
}
