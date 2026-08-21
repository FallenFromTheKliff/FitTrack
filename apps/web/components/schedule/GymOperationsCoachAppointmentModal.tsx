"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  StaffAppointmentRecord,
  SubmitCoachAppointmentFeedbackPayload,
} from "@fittrack/api-client";

import { useTheme } from "@/contexts/ThemeContext";
import { FitButton, FitSelect, FitText, FitTextArea } from "@/components/fit";
import { OverlayAmountGrid } from "./GymOperationsOverlayCards";
import { OverlayFrame } from "./GymOperationsOverlayFrame";
import {
  actionPillStyle,
  buildStatusTone,
  canCancelUntilDayBefore,
  formatAppointmentWindow,
  formatPeso,
  getPersonDisplayName,
  overlaySurfaceStyle,
  type CoachReadinessSummary,
} from "./GymOperationsOverlayShared";

export function GymOperationsCoachAppointmentModal({
  appointment,
  coachReadiness,
  isOpen,
  isCoachView = false,
  isSubmitting = false,
  onCancelAppointment,
  onClose,
  onComplete,
  onSaveFeedback,
}: {
  appointment: StaffAppointmentRecord | null;
  coachReadiness: CoachReadinessSummary;
  isOpen: boolean;
  isCoachView?: boolean;
  isSubmitting?: boolean;
  onCancelAppointment: (note: string) => void;
  onClose: () => void;
  onComplete: (payload: {
    assessmentReport?: string;
    coachFeedback?: string;
    sessionNotes?: string;
  }) => void;
  onSaveFeedback?: (payload: SubmitCoachAppointmentFeedbackPayload) => void;
}) {
  const { colors, settings } = useTheme();
  const [note, setNote] = useState("");
  const [assessmentReport, setAssessmentReport] = useState("");
  const [coachFeedback, setCoachFeedback] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [action, setAction] = useState<"mark_complete" | "cancel">("mark_complete");
  const status = appointment?.status ?? "confirmed";
  const isTerminal = ["cancelled", "completed", "no_show"].includes(status);
  const isConfirmed = status === "confirmed";
  const canCancel = Boolean(appointment) && !isTerminal && canCancelUntilDayBefore(appointment?.scheduledAt);
  const actionOptions = useMemo<Array<"mark_complete" | "cancel">>(() => {
    if (!appointment || isTerminal) return [];
    const options: Array<"mark_complete" | "cancel"> = isConfirmed ? ["mark_complete"] : [];
    if (canCancel) options.push("cancel");
    return options;
  }, [appointment, canCancel, isConfirmed, isTerminal]);
  const scheduleWindow = appointment
    ? formatAppointmentWindow(appointment)
    : { dateLabel: "-", timeLabel: "-" };
  const memberName = appointment
    ? getPersonDisplayName(appointment.user.profile, appointment.user.email, "Member")
    : "Member";
  const coachName = appointment
    ? appointment.coach.displayName?.trim() ||
      getPersonDisplayName(appointment.coach.profile, null, "Coach")
    : "Coach";
  const tone = buildStatusTone(status, colors);
  const isFeedbackReady = Boolean(onSaveFeedback && appointment && status === "completed");
  const isFeedbackDisabled = isSubmitting || !coachFeedback.trim();

  useEffect(() => {
    if (!isOpen) return;
    setNote("");
    setAssessmentReport(appointment?.assessmentReport ?? "");
    setCoachFeedback(appointment?.coachFeedback ?? "");
    setSessionNotes("");
    setAction(actionOptions[0] ?? "mark_complete");
  }, [
    actionOptions,
    appointment?.assessmentReport,
    appointment?.coachFeedback,
    appointment?.id,
    isOpen,
  ]);

  const submitAction = () => {
    if (!appointment || isSubmitting) return;
    if (action === "cancel") {
      if (canCancel) onCancelAppointment(note.trim());
      return;
    }
    if (!isConfirmed || !coachFeedback.trim()) return;
    onComplete({
      assessmentReport: assessmentReport.trim() || undefined,
      coachFeedback: coachFeedback.trim() || undefined,
      sessionNotes: sessionNotes.trim() || undefined,
    });
  };

  const saveFeedback = () => {
    if (!isFeedbackReady || !coachFeedback.trim()) return;
    onSaveFeedback?.({
      assessmentReport: assessmentReport.trim() || undefined,
      coachFeedback: coachFeedback.trim(),
    });
  };

  return (
    <OverlayFrame
      isOpen={isOpen}
      maxWidth={760}
      onClose={onClose}
      closeDisabled={isSubmitting}
      subtitle={
        isCoachView
          ? "Review the paid session, capture client notes, and update the session outcome."
          : "Review the confirmed coaching session and document the staff outcome."
      }
      title={isCoachView ? "Coach session" : "Review coaching session"}
      footer={
        actionOptions.length > 0 ? (
          <FitButton
            variant="primary"
            label={isSubmitting ? "SAVING..." : "SAVE SESSION"}
            aria-label={isSubmitting ? "Saving coaching session" : "Save coaching session"}
            onClick={submitAction}
            disabled={
              isSubmitting ||
              !actionOptions.includes(action) ||
              (action === "mark_complete" && (!isConfirmed || !coachFeedback.trim()))
            }
            style={actionPillStyle(colors, true)}
            textStyle={{ fontSize: 13, fontWeight: 700 }}
          />
        ) : undefined
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
                {memberName}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
                Coach: {coachName}
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <FitText excludeGlobalScale style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
                {scheduleWindow.dateLabel} / {scheduleWindow.timeLabel}
              </FitText>
              <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted }}>
                {appointment?.duration ?? 60} minutes · {appointment?.recurringPlanId ? "Monthly plan session" : "One-time session"}
              </FitText>
            </div>
          </div>
          <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.textMuted, lineHeight: 1.35 }}>
            {coachReadiness.trustLabel}. Session controls appear only for a confirmed paid booking.
          </FitText>
        </div>

        <OverlayAmountGrid
          colors={colors}
          columns="repeat(4, minmax(0, 1fr))"
          items={[
            {
              label: "Total price",
              value: appointment?.totalAmount != null ? formatPeso(appointment.totalAmount) : "Recorded",
            },
            { label: "Session status", value: tone.label },
            { label: "Coach availability", value: coachReadiness.isVisible ? "Visible" : "Not visible" },
            { label: "Member review", value: appointment?.review ? `Reviewed ${appointment.review.rating}/5` : "Not submitted" },
          ]}
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div style={{ ...overlaySurfaceStyle(colors), gap: 10 }}>
            <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
              Session notes
            </FitText>
            <FitTextArea
              value={sessionNotes}
              onChange={(event) => setSessionNotes(event.target.value)}
              rows={3}
              placeholder="Capture the session handoff or client progress..."
              aria-label="Session notes"
              disabled={isSubmitting || !isConfirmed}
              style={{ fontSize: 12, lineHeight: 1.4 }}
            />
            <FitTextArea
              value={assessmentReport}
              onChange={(event) => setAssessmentReport(event.target.value)}
              rows={3}
              placeholder="Optional assessment summary..."
              aria-label="Assessment report"
              disabled={isSubmitting || !isConfirmed}
              style={{ fontSize: 12, lineHeight: 1.4 }}
            />
          </div>
          <div style={{ ...overlaySurfaceStyle(colors), gap: 10 }}>
            <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
              Coach feedback
            </FitText>
            <FitTextArea
              value={coachFeedback}
              onChange={(event) => setCoachFeedback(event.target.value)}
              rows={5}
              placeholder={isConfirmed ? "Required before marking the session complete..." : "Feedback is available after completion."}
              aria-label="Coach feedback"
              disabled={isSubmitting || !isConfirmed}
              style={{ fontSize: 12, lineHeight: 1.4 }}
            />
            {isFeedbackReady ? (
              <FitButton
                variant="ghost"
                label={isSubmitting ? "SAVING..." : "SAVE FEEDBACK"}
                aria-label="Save coach feedback"
                onClick={saveFeedback}
                disabled={isFeedbackDisabled}
                style={{ ...actionPillStyle(colors), justifySelf: "start" }}
                textStyle={{ fontSize: 13, fontWeight: 700 }}
              />
            ) : null}
          </div>
        </div>

        {actionOptions.length > 0 ? (
          <div style={{ ...overlaySurfaceStyle(colors), gap: 10 }}>
            <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
              Session action
            </FitText>
            <FitSelect
              options={actionOptions.map((value) => ({
                label: value === "mark_complete" ? "Mark complete" : "Cancel session",
                value,
              }))}
              value={action}
              onChange={(event) => setAction(event.target.value as "mark_complete" | "cancel")}
              disabled={isSubmitting}
              fullWidth
              aria-label="Session action"
              style={{ minWidth: 220 }}
            />
            {action === "cancel" ? (
              <FitTextArea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                placeholder="Optional cancellation note..."
                aria-label="Cancellation note"
                disabled={isSubmitting}
                style={{ fontSize: 12, lineHeight: 1.4 }}
              />
            ) : null}
            {!canCancel && !isTerminal ? (
              <FitText excludeGlobalScale style={{ fontSize: 12, color: colors.warning, lineHeight: 1.35 }}>
                Cancellation is closed because the session date is too close.
              </FitText>
            ) : null}
          </div>
        ) : null}
      </div>
    </OverlayFrame>
  );
}
