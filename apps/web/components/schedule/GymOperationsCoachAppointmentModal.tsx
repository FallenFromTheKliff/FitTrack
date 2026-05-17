"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  RecurringCoachingBillingCycleRecord,
  StaffAppointmentRecord,
  SubmitCoachAppointmentFeedbackPayload,
} from "@fittrack/api-client";

import { useTheme } from "@/contexts/ThemeContext";
import { FitButton, FitSelect, FitText, FitTextArea } from "@/components/fit";
import { OverlayAmountGrid } from "./GymOperationsOverlayCards";
import { OverlayFrame } from "./GymOperationsOverlayFrame";
import {
  COACH_DECISION_LABELS,
  actionPillStyle,
  buildStatusTone,
  formatAppointmentWindow,
  formatCompactDate,
  formatPeso,
  getPersonDisplayName,
  metricChipStyle,
  overlaySurfaceStyle,
  type CoachDecision,
  type CoachReadinessSummary,
  type PaymentCollectionProvider,
  type StaffInitialPaymentStage,
} from "./GymOperationsOverlayShared";

export function GymOperationsCoachAppointmentModal({
  appointment,
  billingCycles = [],
  coachReadiness,
  isOpen,
  isCoachView = false,
  isSubmitting = false,
  onCancelRecurringPlan,
  onCancelAppointment,
  onClose,
  onComplete,
  onSaveFeedback,
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
  isCoachView?: boolean;
  isSubmitting?: boolean;
  onCancelRecurringPlan?: () => void;
  onCancelAppointment: (note: string) => void;
  onClose: () => void;
  onComplete: (payload: {
    assessmentReport?: string;
    coachFeedback?: string;
    sessionNotes?: string;
  }) => void;
  onSaveFeedback?: (payload: SubmitCoachAppointmentFeedbackPayload) => void;
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
  const [assessmentReport, setAssessmentReport] = useState("");
  const [coachFeedback, setCoachFeedback] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
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
        color: colors.onBrand,
        label: "Pending full payment",
      }
    : status === "pending_payment" &&
        appointment?.activePaymentStage === "full"
      ? {
          bg: colors.warning,
          color: colors.onBrand,
          label: "Pending full payment",
        }
      : status === "pending_payment" &&
          appointment?.activePaymentStage === "downpayment"
        ? {
            bg: colors.brand,
            color: colors.onBrand,
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
  const memberReview = appointment?.review ?? null;
  const memberReviewLabel =
    status === "completed"
      ? memberReview
        ? `Reviewed ${memberReview.rating}/5`
        : "Not reviewed"
      : "Review opens after completion";
  const memberReviewTone =
    status === "completed"
      ? memberReview
        ? colors.success
        : colors.warning
      : colors.textMuted;

  useEffect(() => {
    if (!isOpen) return;
    setNote("");
    setAssessmentReport(appointment?.assessmentReport ?? "");
    setCoachFeedback(appointment?.coachFeedback ?? "");
    setSessionNotes(appointment?.sessionNotes ?? "");
  }, [isOpen, appointment?.id]);

  const title = isCoachView
    ? canConfirm
      ? "Review coach appointment"
      : "Coach appointment actions"
    : "Review payment and appointment status";
  const description = isCoachView
    ? canConfirm
      ? "Confirm, reject, or keep the request pending from your coach schedule."
      : "Review the current session state and resolve your coach-side action."
    : "Verify payment, booking status, and remaining balances without switching away from Gym Operations.";
  const coachDecisionOptions = useMemo<CoachDecision[]>(() => {
    if (isCoachView) {
      if (canConfirm) return ["confirm", "reject", "cancel"];
      if (canComplete) return ["mark_complete", "cancel"];
      if (status === "cancelled" || status === "completed" || status === "no_show") return [];
      return ["cancel"];
    }
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
    if (status === "cancelled" || status === "no_show") return [];
    return ["cancel"];
  }, [
    appointment?.activePaymentStage,
    canCollectBalance,
    canCollectInitialPayment,
    canComplete,
    canConfirm,
    canResolvePendingCoachPayment,
    status,
    isCoachView,
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
        onComplete({
          assessmentReport: assessmentReport.trim() || undefined,
          coachFeedback: coachFeedback.trim() || undefined,
          sessionNotes: sessionNotes.trim() || undefined,
        });
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
    (coachDecision === "mark_complete" && !coachFeedback.trim()) ||
    ((coachDecision === "accept_cash_balance" ||
      coachDecision === "paymongo_balance") &&
      !onCollectBalance) ||
    ((coachDecision === "paymongo_downpayment" ||
      coachDecision === "accept_cash_downpayment" ||
      coachDecision === "accept_cash_full") &&
      !onCollectInitialPayment);

  return (
    <OverlayFrame
      isOpen={isOpen}
      maxWidth={760}
      onClose={isSubmitting ? () => {} : onClose}
      subtitle={description}
      title={title}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "none",
          maxHeight: "none",
          overflow: "visible",
          margin: 0,
          padding: 0,
          borderRadius: 0,
          border: "none",
          backgroundColor: "transparent",
          display: "grid",
          gap: 14,
          boxShadow: "none",
          transform: "none",
          transition: shouldAnimate ? "opacity 160ms ease" : "none",
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

        <OverlayAmountGrid
          colors={colors}
          items={
            isCoachView
              ? [
                  {
                    label: "Booking type",
                    value: bookingTypeLabel,
                  },
                  {
                    label: "Duration",
                    value: `${appointment?.duration ?? 0} min`,
                  },
                  {
                    label: "Status",
                    value: tone.label,
                  },
                  {
                    label: "Member review",
                    value: memberReviewLabel,
                  },
                  {
                    label: "Coach reply",
                    value: appointment?.coachFeedback ? "Submitted" : "Not submitted",
                  },
                ]
              : [
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
                  {
                    label: "Member review",
                    value: memberReviewLabel,
                  },
                ]
          }
        />

        {isCoachView ? (
        <div style={{ ...overlaySurfaceStyle(colors), gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: colors.textPrimary,
              }}
            >
              Client details and review status
            </FitText>
            <span
              style={{
                borderRadius: 999,
                border: `1px solid ${memberReviewTone}55`,
                backgroundColor: `${memberReviewTone}18`,
                color: memberReviewTone,
                fontSize: 12,
                fontWeight: 800,
                padding: "7px 10px",
                whiteSpace: "nowrap",
              }}
            >
              {memberReviewLabel}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 10,
            }}
          >
            <div style={overlaySurfaceStyle(colors)}>
              <FitText excludeGlobalScale style={{ fontSize: 11, fontWeight: 800, color: colors.textMuted }}>
                Client
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary }}>
                {memberName}
              </FitText>
            </div>
            <div style={overlaySurfaceStyle(colors)}>
              <FitText excludeGlobalScale style={{ fontSize: 11, fontWeight: 800, color: colors.textMuted }}>
                Status
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 800, color: colors.textPrimary }}>
                {tone.label}
              </FitText>
            </div>
            <div style={overlaySurfaceStyle(colors)}>
              <FitText excludeGlobalScale style={{ fontSize: 11, fontWeight: 800, color: colors.textMuted }}>
                Member note
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textSecondary }}>
                {appointment?.notes?.trim() || "No member note provided."}
              </FitText>
            </div>
          </div>
          {memberReview ? (
            <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textSecondary }}>
              Member review: {memberReview.comment?.trim() || "Rating submitted without written feedback."}
            </FitText>
          ) : null}
        </div>
        ) : null}

        <div
          style={{ display: "grid", gridTemplateColumns: isCoachView ? "1fr 1fr" : "1fr", gap: 18 }}
        >
          {isCoachView ? (
          <>
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
          </>
          ) : null}
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
                placeholder={
                  isCoachView
                    ? "Optional note for front desk, coach, or audit trail..."
                    : "Optional payment or status note for the operations audit trail..."
                }
                style={{
                  boxSizing: "border-box",
                  display: "block",
                  fontSize: 12,
                  lineHeight: 1.4,
                  width: "100%",
                }}
              />
            </div>
          </div>
        </div>

        {coachDecision === "mark_complete" ? (
          <div style={{ ...overlaySurfaceStyle(colors), gap: 12 }}>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: colors.textPrimary,
              }}
            >
              Session report
            </FitText>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: colors.textMuted,
                  }}
                >
                  Client feedback
                </FitText>
                <FitTextArea
                  value={coachFeedback}
                  onChange={(event) => setCoachFeedback(event.target.value)}
                  rows={3}
                  placeholder="Feedback the member should see after this session..."
                  style={{ fontSize: 12, lineHeight: 1.4 }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: colors.textMuted,
                  }}
                >
                  Assessment report
                </FitText>
                <FitTextArea
                  value={assessmentReport}
                  onChange={(event) => setAssessmentReport(event.target.value)}
                  rows={3}
                  placeholder="Progress, movement quality, next focus..."
                  style={{ fontSize: 12, lineHeight: 1.4 }}
                />
              </div>
            </div>
            <div style={{ display: "grid", gap: 6 }}>
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 12,
                  fontWeight: 800,
                  color: colors.textMuted,
                }}
              >
                Private session notes
              </FitText>
              <FitTextArea
                value={sessionNotes}
                onChange={(event) => setSessionNotes(event.target.value)}
                rows={3}
                placeholder="Internal coaching notes for this appointment..."
                style={{ fontSize: 12, lineHeight: 1.4 }}
              />
            </div>
          </div>
        ) : null}

        {isCoachView && status === "completed" ? (
          <div style={{ ...overlaySurfaceStyle(colors), gap: 12 }}>
            <FitText
              excludeGlobalScale
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: colors.textPrimary,
              }}
            >
              Coach reply and session report
            </FitText>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted }}
            >
              Update the feedback and report the member sees in Bookings and Assessments.
            </FitText>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: colors.textMuted,
                  }}
                >
                  Coach feedback
                </FitText>
                <FitTextArea
                  value={coachFeedback}
                  onChange={(event) => setCoachFeedback(event.target.value)}
                  rows={3}
                  placeholder="Reply with coaching feedback the member should see..."
                  style={{ fontSize: 12, lineHeight: 1.4 }}
                />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    color: colors.textMuted,
                  }}
                >
                  Assessment report
                </FitText>
                <FitTextArea
                  value={assessmentReport}
                  onChange={(event) => setAssessmentReport(event.target.value)}
                  rows={3}
                  placeholder="Optional assessment notes, progress, or next goal..."
                  style={{ fontSize: 12, lineHeight: 1.4 }}
                />
              </div>
            </div>
            <FitButton
              variant="primary"
              label="SAVE COACH REPLY"
              disabled={isSubmitting || !coachFeedback.trim() || !onSaveFeedback}
              onClick={() =>
                onSaveFeedback?.({
                  assessmentReport: assessmentReport.trim() || undefined,
                  coachFeedback: coachFeedback.trim(),
                })
              }
              style={actionPillStyle(colors)}
              textStyle={{
                fontSize: 13,
                fontWeight: 800,
                color: colors.onBrand,
              }}
            />
          </div>
        ) : null}

        {isRecurring && !isCoachView ? (
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

        {coachDecisionOptions.length > 0 ? (
        <div style={{ ...overlaySurfaceStyle(colors), gap: 14 }}>
          <FitText
            excludeGlobalScale
            style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}
          >
            {isCoachView ? "Decision path" : "Payment / status decision"}
          </FitText>
          <FitText
            excludeGlobalScale
            style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.35 }}
          >
            {isCoachView
              ? "Select one action, then submit it. Payment, rejection, completion, and cancellation no longer compete as separate decision buttons."
              : "Select the payment or status action that matches the member's verified booking state."}
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
        ) : (
          <div style={{ ...overlaySurfaceStyle(colors), gap: 10 }}>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}
            >
              No appointment decision needed
            </FitText>
            <FitText
              excludeGlobalScale
              style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.35 }}
            >
              This session is already resolved. Review the client details, member review, and coach reply above.
            </FitText>
            <FitButton
              variant="ghost"
              label="CLOSE"
              onClick={onClose}
              disabled={isSubmitting}
              style={actionPillStyle(colors)}
              textStyle={{ fontSize: 13, fontWeight: 700 }}
            />
          </div>
        )}
      </div>
    </OverlayFrame>
  );
}
