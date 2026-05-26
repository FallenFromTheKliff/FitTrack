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
  type PaymentCollectionProvider,
  type VenueDecision,
} from "./GymOperationsOverlayShared";

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
  const [decisionConfirm, setDecisionConfirm] =
    useState<OverlayConfirmation | null>(null);
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
        color: colors.onBrand,
        label: "Pending full payment",
      }
    : isPendingInitialFullPayment
      ? {
          bg: colors.warning,
          color: colors.onBrand,
          label: "Pending payment",
        }
    : buildStatusTone(booking?.status ?? "pending", colors);
  const approvalAlsoVerifiesPayment =
    booking?.status === "pending" && Number(totalAmount ?? 0) > 0;
  const canCollectBalance =
    (booking?.status === "confirmed" || booking?.status === "balance_pending") &&
    hasOutstandingBalance;
  const canCancelBooking = canCancelUntilDayBefore(booking?.startTime);
  const isTerminal =
    booking?.status === "cancelled" ||
    booking?.status === "completed" ||
    booking?.status === "no_show";
  const cancellationClosed =
    Boolean(booking) && !isTerminal && !canCancelBooking;
  const isConfirmedSettled =
    booking?.status === "confirmed" &&
    !hasOutstandingBalance &&
    Number(remainingBalance ?? 0) <= 0;
  const visibleDecisionOptions = useMemo<VenueDecision[]>(() => {
    if (isTerminal) return [];
    const baseOptions: VenueDecision[] = canCollectBalance
      ? ["collect_cash_balance", "paymongo_balance"]
      : isConfirmedSettled
        ? ["mark_complete", "no_show"]
        : ["approve", "reject"];
    return canCancelBooking ? [...baseOptions, "cancel"] : baseOptions;
  }, [canCancelBooking, canCollectBalance, isConfirmedSettled, isTerminal]);

  useEffect(() => {
    if (!isOpen) return;
    setDecision(
      canCollectBalance
        ? "collect_cash_balance"
        : isConfirmedSettled
          ? "mark_complete"
          : visibleDecisionOptions[0] ?? "approve",
    );
    setNote("");
    setDecisionConfirm(null);
  }, [
    isOpen,
    booking?.id,
    canCollectBalance,
    isConfirmedSettled,
    visibleDecisionOptions,
  ]);

  const applyDecision = () => {
    const trimmed = note.trim();

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
      if (!canCancelBooking) return;
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

  const handleSave = () => {
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

    setDecisionConfirm({
      confirmLabel: decision === "paymongo_balance" ? "OPEN PAYMONGO" : "SAVE",
      isDanger:
        decision === "cancel" ||
        decision === "reject" ||
        decision === "no_show",
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
      title="Review venue booking"
      subtitle="Basketball court, boxing ring, and yoga room requests should resolve here before they hit the floor."
      footer={
        <FitButton
          variant="primary"
          label={isSubmitting ? "SAVING..." : "SAVE"}
          aria-label={
            isSubmitting ? "Saving venue decision" : "Save venue decision"
          }
          onClick={handleSave}
          disabled={
            isSubmitting ||
            isTerminal ||
            visibleDecisionOptions.length === 0 ||
            ((decision === "collect_cash_balance" ||
              decision === "paymongo_balance") &&
              !onCollectBalance) ||
            !visibleDecisionOptions.includes(decision)
          }
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
              ? approvalAlsoVerifiesPayment
                ? "Review the submitted payment and booking window before approving this venue request."
                : "Review the booking window before approving this venue request."
              : "Use this review surface to document the final facilities decision."}
          </FitText>
        </div>

        <OverlayAmountGrid
          colors={colors}
          columns="repeat(4, minmax(0, 1fr))"
          items={[
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
          ]}
        />

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
              Live booking context
            </FitText>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, fontWeight: 700, color: colors.textPrimary }}
            >
              {windowSummary.dateLabel} / {windowSummary.timeLabel}
            </FitText>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              Status: {tone.label}
            </FitText>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 12,
                color: colors.textMuted,
                lineHeight: 1.35,
              }}
            >
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
                ? "Collect the remaining balance, or cancel before the booking day without marking it paid."
                : isConfirmedSettled
                  ? "Mark this confirmed venue booking complete or no-show. Cancel remains available only before the booking day."
                : approvalAlsoVerifiesPayment
                  ? "Accept the submitted payment, cancel the request, or reject it without leaving Gym Operations."
                  : "Approve, cancel, or reject without leaving Gym Operations."}
            </FitText>
            {cancellationClosed ? (
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  color: colors.warning,
                  lineHeight: 1.35,
                }}
              >
                Cancellation is closed for this booking. Venue bookings can only
                be cancelled until the day before {windowSummary.dateLabel}.
              </FitText>
            ) : null}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {isTerminal ? (
                <FitButton
                  variant="ghost"
                  label={booking?.status === "completed" ? "COMPLETED" : "CANCELLED"}
                  aria-label={
                    booking?.status === "completed"
                      ? "Venue booking completed"
                      : "Venue booking cancelled"
                  }
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
                  aria-label="Venue decision"
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
              borderTop: `1px solid ${colors.border}`,
              backgroundColor: "transparent",
              minHeight: 56,
              paddingTop: 10,
            }}
          >
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
