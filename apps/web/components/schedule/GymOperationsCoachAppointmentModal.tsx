"use client";

import { useEffect, useState } from "react";
import type {
  AppointmentManualStatus,
  StaffAppointmentRecord,
  SubmitCoachAppointmentFeedbackPayload,
} from "@fittrack/api-client";

import { useTheme } from "@/contexts/ThemeContext";
import { FitButton, FitSelect, FitText, FitTextArea } from "@/components/fit";
import { ConfirmModal } from "@/components/modals";
import { OverlayAmountGrid } from "./GymOperationsOverlayCards";
import { OverlayFrame } from "./GymOperationsOverlayFrame";
import {
  actionPillStyle,
  buildStatusTone,
  formatAppointmentWindow,
  formatPeso,
  getPersonDisplayName,
  overlaySurfaceStyle,
  type CoachReadinessSummary,
} from "./GymOperationsOverlayShared";
import { getReadableStatus } from "./operationsUtils";

const MANUAL_SESSION_STATUS_OPTIONS: Array<{
  label: string;
  value: AppointmentManualStatus;
}> = [
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Coach Unavailable", value: "coach_unavailable" },
  { label: "No Show", value: "no_show" },
];

function normalizeManualStatus(status?: string): AppointmentManualStatus {
  return MANUAL_SESSION_STATUS_OPTIONS.some((option) => option.value === status)
    ? (status as AppointmentManualStatus)
    : "confirmed";
}

export function GymOperationsCoachAppointmentModal({
  appointment,
  coachReadiness,
  isOpen,
  isCoachView = false,
  isSubmitting = false,
  onChangeStatus,
  onClose,
  onSaveFeedback,
}: {
  appointment: StaffAppointmentRecord | null;
  coachReadiness: CoachReadinessSummary;
  isOpen: boolean;
  isCoachView?: boolean;
  isSubmitting?: boolean;
  onChangeStatus: (status: AppointmentManualStatus, reason?: string) => void;
  onClose: () => void;
  onSaveFeedback?: (payload: SubmitCoachAppointmentFeedbackPayload) => void;
}) {
  const { colors, settings } = useTheme();
  const [assessmentReport, setAssessmentReport] = useState("");
  const [coachFeedback, setCoachFeedback] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [selectedStatus, setSelectedStatus] =
    useState<AppointmentManualStatus>("confirmed");
  const [statusReason, setStatusReason] = useState("");
  const [statusConfirmationOpen, setStatusConfirmationOpen] = useState(false);
  const status = appointment?.status ?? "confirmed";
  const currentStatus = normalizeManualStatus(status);
  const isConfirmed = status === "confirmed";
  const isStatusChanged = Boolean(appointment && selectedStatus !== currentStatus);
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
    setAssessmentReport(appointment?.assessmentReport ?? "");
    setCoachFeedback(appointment?.coachFeedback ?? "");
    setSessionNotes("");
    setSelectedStatus(normalizeManualStatus(appointment?.status));
    setStatusReason("");
  }, [
    appointment?.assessmentReport,
    appointment?.coachFeedback,
    appointment?.id,
    appointment?.status,
    isOpen,
  ]);

  const submitAction = () => {
    if (!appointment || isSubmitting || !isStatusChanged) return;
    setStatusConfirmationOpen(true);
  };

  const confirmStatusChange = () => {
    if (!isStatusChanged) return;
    setStatusConfirmationOpen(false);
    onChangeStatus(selectedStatus, statusReason.trim() || undefined);
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
        appointment ? (
          <FitButton
            variant="primary"
            label={isSubmitting ? "SAVING..." : "SAVE SESSION"}
            aria-label={isSubmitting ? "Saving coaching session" : "Save session status"}
            onClick={submitAction}
            disabled={isSubmitting || !isStatusChanged}
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

        {appointment ? (
          <div style={{ ...overlaySurfaceStyle(colors), gap: 10 }}>
            <FitText excludeGlobalScale style={{ fontSize: 15, fontWeight: 800, color: colors.textPrimary }}>
              Session status
            </FitText>
            <FitSelect
              options={MANUAL_SESSION_STATUS_OPTIONS}
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as AppointmentManualStatus)}
              disabled={isSubmitting}
              fullWidth
              aria-label="Session status"
              style={{ minWidth: 220 }}
            />
            {selectedStatus === "cancelled" || selectedStatus === "coach_unavailable" ? (
              <FitTextArea
                value={statusReason}
                onChange={(event) => setStatusReason(event.target.value)}
                rows={2}
                placeholder="Optional reason..."
                aria-label="Status change reason"
                disabled={isSubmitting}
                style={{ fontSize: 12, lineHeight: 1.4 }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <ConfirmModal
        isOpen={statusConfirmationOpen}
        title="Change session status?"
        message={`Change this session from ${getReadableStatus(currentStatus)} to ${getReadableStatus(selectedStatus)}?`}
        confirmLabel="Confirm Change"
        cancelLabel="Go Back"
        loadingLabel="Saving..."
        isLoading={isSubmitting}
        onConfirm={confirmStatusChange}
        onCancel={() => setStatusConfirmationOpen(false)}
      />
    </OverlayFrame>
  );
}
