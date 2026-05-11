"use client";

import { useEffect, useState } from "react";

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
    setDecisionConfirm(null);
  }, [isOpen, booking?.id, canCollectBalance, isConfirmedSettled]);

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
    <OverlayFrame isOpen={isOpen} onClose={isSubmitting ? () => {} : onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 760,
          maxWidth: "min(760px, calc(100vw - 48px))",
          maxHeight: "min(776px, calc(100vh - 48px))",
          overflow: "auto",
          margin: "auto",
          padding: 24,
          borderRadius: 8,
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
