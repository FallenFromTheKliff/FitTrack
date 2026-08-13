"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { SubmitCoachAppointmentFeedbackPayload } from "@fittrack/api-client";
import { completeCoachAppointmentMutationOptions, invalidateCoachScheduleQueries } from "@fittrack/query";
import { CalendarDays, CheckCircle2, FileText } from "lucide-react";

import { FitButton, FitPill, FitText } from "@/components/fit";
import CalendarModal from "@/components/modals/CalendarModal";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";

import PaidSessionSchedule from "../PaidSessionSchedule";
import { CoachClientWorkoutPrograms } from "../CoachClientWorkoutPrograms";
import { formatCoachScheduleDate, formatCoachStatusLabel } from "./coachClientPresentation";
import { useCoachClientAction } from "./coachClientActionContext";
import type { CoachClientWorkspace } from "./useCoachClientWorkspace";

type Props = { workspace: CoachClientWorkspace };

function sectionStyle(): CSSProperties {
  return { display: "grid", gap: 12, minWidth: 0 };
}

function statCardStyle(colors: ReturnType<typeof useTheme>["colors"]): CSSProperties {
  return { backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8, display: "grid", gap: 4, minWidth: 0, padding: "10px 11px" };
}

function fieldStyle(colors: ReturnType<typeof useTheme>["colors"]): CSSProperties {
  return { backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8, boxSizing: "border-box", color: colors.textPrimary, fontFamily: "inherit", minHeight: 40, padding: "9px 10px", resize: "vertical", width: "100%" };
}

function dateYmd(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getMutationError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function WorkspaceState({ workspace }: Props) {
  const { colors } = useTheme();
  if (workspace.isLoading) return <FitText style={{ color: colors.textMuted, fontSize: 11 }}>Loading coaching data...</FitText>;
  if (workspace.hasError) return <FitText role="alert" style={{ color: colors.warning, fontSize: 11, lineHeight: 1.4 }}>Coaching data could not be loaded. Try closing and reopening this tool.</FitText>;
  return null;
}

function SessionCard({ appointment }: { appointment: CoachClientWorkspace["clientAppointments"][number] }) {
  const { colors } = useTheme();
  const completed = appointment.status === "completed";
  return (
    <div style={{ alignItems: "center", backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 8, display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr) auto", padding: "9px 10px" }}>
      <div style={{ display: "grid", gap: 3, minWidth: 0 }}>
        <FitText style={{ color: colors.textPrimary, fontSize: 11, fontWeight: 800 }}>{formatCoachScheduleDate(appointment.scheduledAt)}</FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 9.75 }}>{appointment.duration} min{appointment.recurringPlanId ? " - Monthly plan" : " - One session"}</FitText>
      </div>
      <FitPill mode="status" label={formatCoachStatusLabel(appointment.status)} color={completed ? colors.success : colors.brand} fontSize={9} style={{ borderRadius: 6 }} />
    </div>
  );
}

export function CoachClientOverviewModalContent({ workspace }: Props) {
  const { colors } = useTheme();
  const recentSessions = useMemo(() => [...workspace.clientAppointments].sort((left, right) => new Date(right.scheduledAt).getTime() - new Date(left.scheduledAt).getTime()).slice(0, 4), [workspace.clientAppointments]);
  const relationship = workspace.activeMonthlyPlan
    ? `Monthly coaching active through ${formatCoachScheduleDate(workspace.activeMonthlyPlan.endDate)}`
    : workspace.hasActivePaidOneSession
      ? "Paid one-session coaching relationship"
      : "No active paid coaching relationship";

  return (
    <div style={sectionStyle()}>
      <WorkspaceState workspace={workspace} />
      <div style={{ backgroundColor: colors.surfaceRaised, border: `1px solid ${colors.border}`, borderRadius: 9, display: "grid", gap: 5, padding: 12 }}>
        <FitText style={{ color: colors.brand, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}>Coaching relationship</FitText>
        <FitText style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 800 }}>{relationship}</FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 10.5, lineHeight: 1.4 }}>Paid appointments remain independent from whichever personal or coach workout plan the member activates.</FitText>
      </div>

      <div className="coach-client-modal-stats" style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        {[
          ["Sessions", workspace.clientAppointments.length],
          ["Completed", workspace.completedAppointments.length],
          ["Upcoming", workspace.upcomingSessions.length],
        ].map(([label, value]) => (
          <div key={label} style={statCardStyle(colors)}>
            <FitText style={{ color: colors.textMuted, fontSize: 9.5, fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}>{label}</FitText>
            <FitText style={{ color: colors.textPrimary, fontSize: 18, fontWeight: 850 }}>{value}</FitText>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 7 }}>
        <FitText style={{ color: colors.brand, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}>Next session</FitText>
        {workspace.nextSession ? <SessionCard appointment={workspace.nextSession} /> : <FitText style={{ color: colors.textMuted, fontSize: 11 }}>No upcoming coaching session is scheduled.</FitText>}
      </div>

      {recentSessions.length ? (
        <div style={{ display: "grid", gap: 7 }}>
          <FitText style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}>Recent activity</FitText>
          {recentSessions.map((appointment) => <SessionCard appointment={appointment} key={appointment.id} />)}
        </div>
      ) : !workspace.isLoading ? <FitText style={{ color: colors.textMuted, fontSize: 11 }}>No coaching sessions recorded yet.</FitText> : null}
    </div>
  );
}

export function CoachClientScheduleModalContent({ workspace }: Props) {
  const { colors } = useTheme();
  const { openSessionReport } = useCoachClientAction();
  const hasPaidRelationship = Boolean(workspace.activeMonthlyPlan || workspace.hasActivePaidOneSession);
  return (
    <div style={sectionStyle()}>
      <WorkspaceState workspace={workspace} />
      <FitText style={{ color: colors.textSecondary, fontSize: 11, lineHeight: 1.45 }}>Review paid sessions, move one upcoming appointment, or open a past session report.</FitText>
      <FitPill mode="status" label={workspace.activeMonthlyPlan ? "Active monthly plan" : workspace.hasActivePaidOneSession ? "Paid one-session relationship" : "No active paid relationship"} color={hasPaidRelationship ? colors.success : colors.textMuted} fontSize={9} style={{ borderRadius: 6, justifySelf: "start" }} />
      {!workspace.isLoading ? (
        <PaidSessionSchedule
          appointments={workspace.clientAppointments}
          canReschedule={hasPaidRelationship}
          fallbackCoachId={workspace.coachProfile?.id}
          memberId={workspace.memberId}
          onOpenSessionReport={openSessionReport}
          requesterUserId={workspace.requesterUserId}
        />
      ) : null}
    </div>
  );
}

export function CoachClientWorkoutModalContent({ workspace }: Props) {
  if (workspace.isLoading) return <WorkspaceState workspace={workspace} />;
  return (
    <div style={sectionStyle()}>
      <CoachClientWorkoutPrograms
        canManage={Boolean(workspace.activeMonthlyPlan || workspace.hasActivePaidOneSession)}
        coachUserId={workspace.coachUserId}
        memberId={workspace.memberId}
        paidPeriodEndDate={workspace.activeMonthlyPlan?.endDate}
      />
    </div>
  );
}

export function CoachClientSessionReportModalContent({ workspace }: Props) {
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const { reportAppointmentId } = useCoachClientAction();
  const eligibleAppointments = useMemo(
    () => workspace.clientAppointments.filter((appointment) => appointment.status === "completed" || (appointment.status === "confirmed" && new Date(appointment.scheduledAt).getTime() < Date.now())).sort((left, right) => new Date(right.scheduledAt).getTime() - new Date(left.scheduledAt).getTime()),
    [workspace.clientAppointments],
  );
  const selectableDates = useMemo(() => [...new Set(eligibleAppointments.map((appointment) => dateYmd(appointment.scheduledAt)))], [eligibleAppointments]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [coachFeedback, setCoachFeedback] = useState("");
  const [assessmentReport, setAssessmentReport] = useState("");
  const [message, setMessage] = useState<{ text: string; tone: "error" | "success" } | null>(null);
  const appointmentsOnDate = useMemo(() => eligibleAppointments.filter((appointment) => dateYmd(appointment.scheduledAt) === selectedDate), [eligibleAppointments, selectedDate]);
  const selectedAppointment = useMemo(() => eligibleAppointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null, [eligibleAppointments, selectedAppointmentId]);
  const dateTones = useMemo(() => {
    const tones: Record<string, "complete" | "missing"> = {};
    eligibleAppointments.forEach((appointment) => {
      const key = dateYmd(appointment.scheduledAt);
      const hasReport = Boolean(appointment.coachFeedback?.trim() || appointment.assessmentReport?.trim());
      tones[key] = hasReport ? "complete" : "missing";
    });
    return tones;
  }, [eligibleAppointments]);

  const feedbackMutation = useMutation({
    mutationFn: ({ appointmentId, payload }: { appointmentId: string; payload: SubmitCoachAppointmentFeedbackPayload }) => webApiClient.coaches.submitAppointmentFeedback(appointmentId, payload),
    onSuccess: async () => { await invalidateCoachScheduleQueries(queryClient, workspace.requesterUserId); },
  });
  const completeMutation = useMutation(completeCoachAppointmentMutationOptions(webApiClient, queryClient));

  useEffect(() => {
    const preferred = eligibleAppointments.find((appointment) => appointment.id === reportAppointmentId) ?? eligibleAppointments[0];
    setSelectedDate(preferred ? dateYmd(preferred.scheduledAt) : "");
    setSelectedAppointmentId(preferred?.id ?? "");
  }, [eligibleAppointments, reportAppointmentId]);

  useEffect(() => {
    const sameDateAppointment = appointmentsOnDate.find((appointment) => appointment.id === selectedAppointmentId) ?? appointmentsOnDate[0];
    setSelectedAppointmentId(sameDateAppointment?.id ?? "");
  }, [appointmentsOnDate, selectedAppointmentId]);

  useEffect(() => {
    setCoachFeedback(selectedAppointment?.coachFeedback ?? "");
    setAssessmentReport(selectedAppointment?.assessmentReport ?? "");
    setMessage(null);
  }, [selectedAppointment?.assessmentReport, selectedAppointment?.coachFeedback, selectedAppointment?.id]);

  const saving = feedbackMutation.isPending || completeMutation.isPending;
  const handleSubmit = async () => {
    if (!selectedAppointment) {
      setMessage({ text: "Choose a completed or past confirmed session.", tone: "error" });
      return;
    }
    const feedback = coachFeedback.trim();
    if (!feedback) {
      setMessage({ text: "Add a short coach report before saving.", tone: "error" });
      return;
    }
    try {
      if (selectedAppointment.status === "confirmed") {
        await completeMutation.mutateAsync({
          appointmentId: selectedAppointment.id,
          assessmentReport: assessmentReport.trim() || undefined,
          coachFeedback: feedback,
          sessionNotes: selectedAppointment.notes ?? selectedAppointment.sessionNotes ?? undefined,
          userId: workspace.requesterUserId,
        });
        setMessage({ text: "Session marked completed and report shared with the member.", tone: "success" });
      } else {
        await feedbackMutation.mutateAsync({
          appointmentId: selectedAppointment.id,
          payload: { assessmentReport: assessmentReport.trim() || undefined, coachFeedback: feedback },
        });
        setMessage({ text: "Session report updated and shared with the member.", tone: "success" });
      }
    } catch (error) {
      setMessage({ text: getMutationError(error, "The session report could not be saved."), tone: "error" });
    }
  };

  return (
    <div style={sectionStyle()}>
      <WorkspaceState workspace={workspace} />
      <div style={{ backgroundColor: `${colors.brand}0d`, border: `1px solid ${colors.brand}30`, borderRadius: 8, display: "grid", gap: 4, padding: "9px 10px" }}>
        <FitText style={{ color: colors.brand, fontSize: 10.5, fontWeight: 850 }}>Visible to the member</FitText>
        <FitText style={{ color: colors.textSecondary, fontSize: 10.5, lineHeight: 1.4 }}>This report appears in the member's coaching session details. Saving a report for a past confirmed session also marks that session completed.</FitText>
      </div>

      <FitButton
        disabled={!selectableDates.length}
        icon={CalendarDays}
        label={selectedDate ? new Intl.DateTimeFormat(undefined, { dateStyle: "long" }).format(new Date(`${selectedDate}T12:00:00`)) : "Choose completed session date"}
        onClick={() => setCalendarOpen(true)}
        style={{ minHeight: 42, justifyContent: "flex-start" }}
        variant="ghost"
      />

      {appointmentsOnDate.length ? (
        <div style={{ display: "grid", gap: 7 }}>
          {appointmentsOnDate.map((appointment) => {
            const active = appointment.id === selectedAppointmentId;
            return (
              <button key={appointment.id} onClick={() => setSelectedAppointmentId(appointment.id)} style={{ alignItems: "center", backgroundColor: active ? `${colors.brand}10` : colors.surfaceRaised, border: `1px solid ${active ? colors.brand : colors.border}`, borderRadius: 8, color: colors.textPrimary, cursor: "pointer", display: "grid", gap: 8, gridTemplateColumns: "minmax(0, 1fr) auto", padding: "9px 10px", textAlign: "left" }} type="button">
                <span style={{ display: "grid", gap: 2 }}>
                  <FitText style={{ fontSize: 11, fontWeight: 800 }}>{formatCoachScheduleDate(appointment.scheduledAt)}</FitText>
                  <FitText style={{ color: colors.textMuted, fontSize: 9.75 }}>{appointment.duration} min</FitText>
                </span>
                <FitPill mode="status" label={appointment.status === "completed" ? "Completed" : "Ready to complete"} color={appointment.status === "completed" ? colors.success : colors.warning} fontSize={8.5} />
              </button>
            );
          })}
        </div>
      ) : !workspace.isLoading ? <FitText style={{ color: colors.textMuted, fontSize: 11 }}>No completed or past confirmed sessions are available.</FitText> : null}

      {selectedAppointment ? (
        <>
          <label style={{ display: "grid", gap: 5 }}>
            <FitText as="span" style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}>Coach report</FitText>
            <textarea aria-label="Coach session report" onChange={(event) => { setCoachFeedback(event.currentTarget.value); setMessage(null); }} placeholder="Summarize performance, wins, and the next focus." rows={4} style={fieldStyle(colors)} value={coachFeedback} />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <FitText as="span" style={{ color: colors.textMuted, fontSize: 10, fontWeight: 850, letterSpacing: "0.04em", textTransform: "uppercase" }}>Assessment notes (optional)</FitText>
            <textarea aria-label="Session assessment notes" onChange={(event) => { setAssessmentReport(event.currentTarget.value); setMessage(null); }} placeholder="Add measurements, movement observations, or progression notes." rows={3} style={fieldStyle(colors)} value={assessmentReport} />
          </label>
        </>
      ) : null}

      {message ? <FitText aria-live="polite" role={message.tone === "error" ? "alert" : "status"} style={{ backgroundColor: message.tone === "error" ? `${colors.danger}10` : `${colors.success}10`, border: `1px solid ${message.tone === "error" ? colors.danger : colors.success}35`, borderRadius: 8, color: message.tone === "error" ? colors.danger : colors.success, fontSize: 11, lineHeight: 1.4, padding: "9px 10px" }}>{message.text}</FitText> : null}
      <FitButton
        disabled={saving || !selectedAppointment}
        icon={selectedAppointment?.status === "confirmed" ? CheckCircle2 : FileText}
        label={saving ? "SAVING..." : selectedAppointment?.status === "confirmed" ? "MARK COMPLETE AND SAVE REPORT" : "SAVE SESSION REPORT"}
        loading={saving}
        onClick={() => void handleSubmit()}
        style={{ borderRadius: 8, minHeight: 42, paddingInline: 14 }}
        textStyle={{ fontSize: 10.5, fontWeight: 850 }}
        variant="primary"
      />
      <CalendarModal
        closeOnSelect
        dateTones={dateTones}
        isOpen={calendarOpen}
        maxDate={dateYmd(new Date().toISOString())}
        minDate={null}
        onClose={() => setCalendarOpen(false)}
        onSelect={(value) => { setSelectedDate(value); setMessage(null); }}
        selectableDates={selectableDates}
        selectedDate={selectedDate}
      />
    </div>
  );
}
