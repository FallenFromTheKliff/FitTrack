"use client";

import { Archive, ChevronUp, CreditCard, LogIn, Pencil, ScanLine, UserCheck, UserPlus } from "lucide-react";
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CoachAppointmentScheduleRecord,
  CreateCoachManagedAppointmentPayload,
  SubmitCoachAppointmentFeedbackPayload,
} from "@fittrack/api-client";
import { coachScheduleQueryOptions, coachSelfProfileQueryOptions, invalidateCoachScheduleQueries } from "@fittrack/query";
import type { CoachProfileRecord } from "@fittrack/types";
import { fullName } from "@fittrack/utils";

import { FitButton, FitPill, FitText } from "@/components/fit";
import MemberInspectorPanel from "@/components/accounts/MemberInspectorPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";
import {
  formatLastCheckIn,
  getDirectoryAccessLabel,
  getDirectoryRoleLabel,
  getDirectoryStatusColor,
  getDirectoryStatusLabel,
  getMemberAvatarUrl,
  getMemberInitials,
  getMembershipFieldValue,
  getScanReadinessLabel,
} from "@/components/accounts/accountComponentUtils";

import { useAccountsPage } from "./AccountsPageContext";

function useAccountActionStyles() {
  const { colors, onBrandTextColor } = useTheme();
  const { canRestoreEditTarget } = useAccountsPage();
  const secondaryActionStyle: CSSProperties = {
    border: `1px solid ${colors.border}`,
    backgroundColor: `${colors.surfaceRaised}cc`,
    borderRadius: 8,
    minHeight: 42,
  };
  const primaryActionStyle: CSSProperties = {
    backgroundColor: colors.brand,
    color: onBrandTextColor,
    border: `1px solid ${colors.brand}`,
    borderRadius: 8,
    minHeight: 42,
  };
  const warningActionStyle: CSSProperties = {
    border: `1px solid ${colors.danger}45`,
    backgroundColor: `${colors.danger}10`,
    borderRadius: 8,
    minHeight: 42,
  };
  const accountLifecycleActionStyle: CSSProperties = canRestoreEditTarget
    ? {
        border: `1px solid ${colors.brand}42`,
        backgroundColor: `${colors.brand}10`,
        borderRadius: 8,
        minHeight: 42,
      }
    : warningActionStyle;

  return {
    accountLifecycleActionColor: canRestoreEditTarget ? colors.brand : colors.danger,
    accountLifecycleActionStyle,
    primaryActionStyle,
    primaryCommandTextColor: onBrandTextColor,
    secondaryActionStyle,
  };
}

type CoachInspectorMessage = {
  text: string;
  tone: "error" | "success";
} | null;

const COACH_DURATION_OPTIONS = [30, 45, 60, 90];

function createNextScheduleValue() {
  const nextHour = new Date(Date.now() + 60 * 60 * 1000);
  nextHour.setMinutes(0, 0, 0);

  const timezoneOffsetMs = nextHour.getTimezoneOffset() * 60 * 1000;
  return new Date(nextHour.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function formatCoachDetailValue(value?: string | number | null, suffix?: string) {
  if (value === null || value === undefined || value === "") return "N/A";
  return suffix ? `${value}${suffix}` : String(value);
}

function formatCoachStatusLabel(status?: string | null) {
  if (!status) return "Unknown";

  return status
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatCoachScheduleDate(value?: string | null) {
  if (!value) return "Not scheduled";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not scheduled";

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function getCoachMutationError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

function CoachClientManagementPanel() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { editTarget, isCoach } = useAccountsPage();
  const queryClient = useQueryClient();
  const [scheduledAt, setScheduledAt] = useState(createNextScheduleValue);
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [memberNotes, setMemberNotes] = useState("");
  const [scheduleMessage, setScheduleMessage] = useState<CoachInspectorMessage>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [coachFeedback, setCoachFeedback] = useState("");
  const [assessmentReport, setAssessmentReport] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<CoachInspectorMessage>(null);
  const isCoachClient = isCoach && editTarget?.role?.name === "USER";

  const { data: coachProfile } = useQuery({
    ...coachSelfProfileQueryOptions<CoachProfileRecord>(webApiClient, user?.id),
    enabled: isCoachClient && Boolean(user?.id),
  });
  const { data: coachSchedule = [] } = useQuery({
    ...coachScheduleQueryOptions<CoachAppointmentScheduleRecord>(webApiClient, user?.id),
    enabled: isCoachClient && Boolean(user?.id),
  });

  const clientAppointments = useMemo(
    () =>
      coachSchedule
        .filter((appointment) => appointment.userId === editTarget?.id)
        .sort(
          (left, right) =>
            new Date(right.scheduledAt).getTime() - new Date(left.scheduledAt).getTime(),
        ),
    [coachSchedule, editTarget?.id],
  );
  const completedAppointments = useMemo(
    () => clientAppointments.filter((appointment) => appointment.status === "completed"),
    [clientAppointments],
  );
  const selectedAppointment = useMemo(
    () => completedAppointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null,
    [completedAppointments, selectedAppointmentId],
  );
  const createManagedAppointmentMutation = useMutation({
    mutationFn: (payload: CreateCoachManagedAppointmentPayload) =>
      webApiClient.coaches.createManagedAppointment(payload),
    onSuccess: async () => {
      await invalidateCoachScheduleQueries(queryClient, user?.id);
      setScheduleMessage({
        text: "Client appointment scheduled from your coach roster.",
        tone: "success",
      });
      setScheduledAt(createNextScheduleValue());
      setDurationMinutes("60");
      setMemberNotes("");
    },
    onError: (error: unknown) => {
      setScheduleMessage({
        text: getCoachMutationError(error, "Client appointment could not be scheduled right now."),
        tone: "error",
      });
    },
  });
  const submitAppointmentFeedbackMutation = useMutation({
    mutationFn: ({
      appointmentId,
      payload,
    }: {
      appointmentId: string;
      payload: SubmitCoachAppointmentFeedbackPayload;
    }) => webApiClient.coaches.submitAppointmentFeedback(appointmentId, payload),
    onSuccess: async () => {
      await invalidateCoachScheduleQueries(queryClient, user?.id);
      setFeedbackMessage({
        text: "Client feedback saved to this completed session.",
        tone: "success",
      });
    },
    onError: (error: unknown) => {
      setFeedbackMessage({
        text: getCoachMutationError(error, "Client feedback could not be saved right now."),
        tone: "error",
      });
    },
  });

  useEffect(() => {
    if (!isCoachClient) {
      setSelectedAppointmentId("");
      return;
    }

    setSelectedAppointmentId((current) => {
      if (current && completedAppointments.some((appointment) => appointment.id === current)) {
        return current;
      }

      return completedAppointments[0]?.id ?? "";
    });
  }, [completedAppointments, isCoachClient]);

  useEffect(() => {
    setCoachFeedback(selectedAppointment?.coachFeedback ?? "");
    setAssessmentReport(selectedAppointment?.assessmentReport ?? "");
    setFeedbackMessage(null);
  }, [selectedAppointment?.id, selectedAppointment?.coachFeedback, selectedAppointment?.assessmentReport]);

  if (!isCoachClient || !editTarget) return null;

  const membershipStatus = formatCoachStatusLabel(getMembershipFieldValue(editTarget));
  const profile = editTarget.profile;
  const latestSession = clientAppointments[0] ?? null;
  const upcomingSessions = clientAppointments.filter((appointment) =>
    appointment.status !== "completed" && appointment.status !== "cancelled",
  );

  const handleCreateManagedAppointment = async () => {
    if (!editTarget.id) {
      setScheduleMessage({
        text: "Select a client before scheduling an appointment.",
        tone: "error",
      });
      return;
    }

    if (!coachProfile?.id) {
      setScheduleMessage({
        text: "Your coach profile is still loading. Try again in a moment.",
        tone: "error",
      });
      return;
    }

    const parsedScheduleAt = new Date(scheduledAt);
    if (Number.isNaN(parsedScheduleAt.getTime())) {
      setScheduleMessage({
        text: "Choose a valid schedule date and time.",
        tone: "error",
      });
      return;
    }

    setScheduleMessage(null);
    await createManagedAppointmentMutation.mutateAsync({
      durationMinutes: Number(durationMinutes),
      memberId: editTarget.id,
      memberNotes: memberNotes.trim() || undefined,
      scheduledAt: parsedScheduleAt.toISOString(),
    });
  };

  const handleSubmitAppointmentFeedback = async () => {
    if (!selectedAppointmentId) {
      setFeedbackMessage({
        text: "Select a completed session before saving client feedback.",
        tone: "error",
      });
      return;
    }

    const trimmedFeedback = coachFeedback.trim();
    if (!trimmedFeedback) {
      setFeedbackMessage({
        text: "Add a short client feedback note before saving.",
        tone: "error",
      });
      return;
    }

    setFeedbackMessage(null);
    await submitAppointmentFeedbackMutation.mutateAsync({
      appointmentId: selectedAppointmentId,
      payload: {
        assessmentReport: assessmentReport.trim() || undefined,
        coachFeedback: trimmedFeedback,
      },
    });
  };

  const sharedInputStyle: CSSProperties = {
    width: "100%",
    minHeight: 40,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
  };
  const sectionCardStyle: CSSProperties = {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceRaised,
  };

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        maxHeight: "calc(100vh - 245px)",
        overflowY: "auto",
        paddingBottom: 84,
        paddingRight: 2,
      }}
    >
      <div style={sectionCardStyle}>
        <FitText
          style={{
            fontSize: 11,
            fontWeight: 850,
            color: colors.brand,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Client Profile Snapshot
        </FitText>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          {[
            { label: "Membership", value: membershipStatus },
            {
              label: "Membership Type",
              value: formatCoachDetailValue(profile?.membershipType),
            },
            { label: "Activity Level", value: formatCoachDetailValue(profile?.activityLevel) },
            { label: "Goal", value: formatCoachDetailValue(profile?.fitnessGoal) },
            { label: "Weight", value: formatCoachDetailValue(profile?.currentWeightKg, " kg") },
            { label: "Height", value: formatCoachDetailValue(profile?.heightCm, " cm") },
            { label: "Phone", value: formatCoachDetailValue(editTarget.phone_no) },
            {
              label: "Verification",
              value: editTarget.emailVerified ? "Verified" : "Pending verification",
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "grid",
                gap: 4,
                padding: "10px 11px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 9.5,
                  fontWeight: 850,
                  color: colors.textMuted,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {item.label}
              </FitText>
              <FitText style={{ fontSize: 12.25, fontWeight: 800, color: colors.textPrimary }}>
                {item.value}
              </FitText>
            </div>
          ))}
        </div>
      </div>

      <div style={sectionCardStyle}>
        <FitText
          style={{
            fontSize: 11,
            fontWeight: 850,
            color: colors.brand,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Session History
        </FitText>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
          {[
            { label: "Total Sessions", value: String(clientAppointments.length) },
            { label: "Completed", value: String(completedAppointments.length) },
            { label: "Upcoming", value: String(upcomingSessions.length) },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "grid",
                gap: 4,
                padding: "10px 11px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <FitText
                excludeGlobalScale
                style={{
                  fontSize: 9.5,
                  fontWeight: 850,
                  color: colors.textMuted,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                {item.label}
              </FitText>
              <FitText style={{ fontSize: 13, fontWeight: 850, color: colors.textPrimary }}>
                {item.value}
              </FitText>
            </div>
          ))}
        </div>
        {latestSession ? (
          <FitText style={{ fontSize: 11, color: colors.textSecondary }}>
            Latest session: {formatCoachScheduleDate(latestSession.scheduledAt)}
          </FitText>
        ) : (
          <FitText style={{ fontSize: 11, color: colors.textSecondary }}>
            No coaching sessions recorded for this client yet.
          </FitText>
        )}
        <div style={{ display: "grid", gap: 8 }}>
          {clientAppointments.slice(0, 4).map((appointment) => (
            <div
              key={appointment.id}
              style={{
                display: "grid",
                gap: 6,
                padding: "10px 11px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <FitText style={{ fontSize: 12.5, fontWeight: 800, color: colors.textPrimary }}>
                  {formatCoachScheduleDate(appointment.scheduledAt)}
                </FitText>
                <FitPill
                  mode="status"
                  label={formatCoachStatusLabel(appointment.status)}
                  color={appointment.status === "completed" ? colors.success : colors.brand}
                  fontSize={9}
                />
              </div>
              <FitText style={{ fontSize: 11, color: colors.textSecondary }}>
                {appointment.duration} min
                {appointment.notes ? ` • ${appointment.notes}` : ""}
              </FitText>
              {appointment.coachFeedback ? (
                <FitText style={{ fontSize: 11, color: colors.textPrimary }}>
                  Feedback: {appointment.coachFeedback}
                </FitText>
              ) : null}
              {appointment.assessmentReport ? (
                <FitText style={{ fontSize: 11, color: colors.textSecondary }}>
                  Assessment: {appointment.assessmentReport}
                </FitText>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div style={sectionCardStyle}>
        <FitText
          style={{
            fontSize: 11,
            fontWeight: 850,
            color: colors.brand,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Schedule New Appointment
        </FitText>
        <FitText style={{ fontSize: 11, color: colors.textSecondary }}>
          Creates a confirmed appointment for this client using your current coach availability.
        </FitText>
        <label style={{ display: "grid", gap: 6 }}>
          <FitText style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>Date &amp; time</FitText>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(event) => {
              setScheduledAt(event.currentTarget.value);
              if (scheduleMessage) setScheduleMessage(null);
            }}
            style={sharedInputStyle}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <FitText style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>Duration</FitText>
          <select
            value={durationMinutes}
            onChange={(event) => {
              setDurationMinutes(event.currentTarget.value);
              if (scheduleMessage) setScheduleMessage(null);
            }}
            style={sharedInputStyle}
          >
            {COACH_DURATION_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} minutes
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <FitText style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>Session notes</FitText>
          <textarea
            rows={3}
            value={memberNotes}
            onChange={(event) => {
              setMemberNotes(event.currentTarget.value);
              if (scheduleMessage) setScheduleMessage(null);
            }}
            placeholder="Add session focus, reminders, or prep notes."
            style={{ ...sharedInputStyle, minHeight: 88, resize: "vertical" }}
          />
        </label>
        {scheduleMessage ? (
          <FitText
            style={{
              fontSize: 11,
              color: scheduleMessage.tone === "success" ? colors.success : colors.danger,
            }}
          >
            {scheduleMessage.text}
          </FitText>
        ) : null}
        <FitButton
          variant="primary"
          label="SCHEDULE APPOINTMENT"
          disabled={createManagedAppointmentMutation.isPending}
          loading={createManagedAppointmentMutation.isPending}
          onClick={() => void handleCreateManagedAppointment()}
          style={{
            minHeight: 42,
            borderRadius: 8,
            backgroundColor: colors.brand,
            color: colors.surface,
            border: `1px solid ${colors.brand}`,
          }}
          textStyle={{ fontSize: 10.75, fontWeight: 800, color: colors.surface }}
        />
      </div>

      <div style={sectionCardStyle}>
        <FitText
          style={{
            fontSize: 11,
            fontWeight: 850,
            color: colors.brand,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          Client Feedback
        </FitText>
        <FitText style={{ fontSize: 11, color: colors.textSecondary }}>
          Save feedback and an optional assessment report to a completed session record.
        </FitText>
        <label style={{ display: "grid", gap: 6 }}>
          <FitText style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>
            Completed session
          </FitText>
          <select
            value={selectedAppointmentId}
            onChange={(event) => setSelectedAppointmentId(event.currentTarget.value)}
            style={sharedInputStyle}
            disabled={completedAppointments.length === 0}
          >
            {completedAppointments.length === 0 ? (
              <option value="">No completed sessions yet</option>
            ) : null}
            {completedAppointments.map((appointment) => (
              <option key={appointment.id} value={appointment.id}>
                {formatCoachScheduleDate(appointment.scheduledAt)}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <FitText style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>Coach feedback</FitText>
          <textarea
            rows={4}
            value={coachFeedback}
            onChange={(event) => {
              setCoachFeedback(event.currentTarget.value);
              if (feedbackMessage) setFeedbackMessage(null);
            }}
            placeholder="Summarize what the client did well and what to improve next."
            style={{ ...sharedInputStyle, minHeight: 110, resize: "vertical" }}
          />
        </label>
        <label style={{ display: "grid", gap: 6 }}>
          <FitText style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>
            Assessment report
          </FitText>
          <textarea
            rows={4}
            value={assessmentReport}
            onChange={(event) => {
              setAssessmentReport(event.currentTarget.value);
              if (feedbackMessage) setFeedbackMessage(null);
            }}
            placeholder="Add optional assessment notes, mobility observations, or progression updates."
            style={{ ...sharedInputStyle, minHeight: 110, resize: "vertical" }}
          />
        </label>
        {feedbackMessage ? (
          <FitText
            style={{
              fontSize: 11,
              color: feedbackMessage.tone === "success" ? colors.success : colors.danger,
            }}
          >
            {feedbackMessage.text}
          </FitText>
        ) : null}
        <FitButton
          variant="primary"
          label="SAVE CLIENT FEEDBACK"
          disabled={submitAppointmentFeedbackMutation.isPending || completedAppointments.length === 0}
          loading={submitAppointmentFeedbackMutation.isPending}
          onClick={() => void handleSubmitAppointmentFeedback()}
          style={{
            minHeight: 42,
            borderRadius: 8,
            backgroundColor: colors.brand,
            color: colors.surface,
            border: `1px solid ${colors.brand}`,
          }}
          textStyle={{ fontSize: 10.75, fontWeight: 800, color: colors.surface }}
        />
      </div>
    </div>
  );
}

function AccountInspectorCommandRow() {
  const { colors, onBrandTextColor } = useTheme();
  const { canManageAccounts, isAdmin, setContentMode, setScanFeedback, setScanOpen } = useAccountsPage();

  if (!canManageAccounts) return null;

  return (
    <div
      className="members-inspector-command-row"
      style={{
        display: "grid",
        gridTemplateColumns: isAdmin ? "minmax(0, 0.86fr) minmax(0, 1fr)" : "1fr",
        gap: 8,
        minWidth: 0,
      }}
    >
      {isAdmin ? (
        <FitButton
          variant="ghost"
          label="SCAN QR"
          icon={ScanLine}
          iconSize={14}
          title="Scan QR Attendance"
          aria-label="Scan QR Attendance"
          style={{
            minHeight: 40,
            borderRadius: 8,
            paddingInline: 8,
            border: `1px solid ${colors.brand}42`,
            backgroundColor: colors.surfaceRaised,
            color: colors.brand,
          }}
          onClick={() => {
            setScanOpen(true);
            setScanFeedback(null);
          }}
          textStyle={{
            color: colors.brand,
            fontSize: 10.75,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        />
      ) : null}
      <FitButton
        variant="primary"
        label="CREATE ACCOUNT"
        icon={UserPlus}
        iconSize={14}
        style={{
          backgroundColor: colors.brand,
          color: onBrandTextColor,
          border: `1px solid ${colors.brand}`,
          minHeight: 40,
          borderRadius: 8,
          paddingInline: 10,
        }}
        onClick={() => setContentMode("create")}
        textStyle={{
          color: onBrandTextColor,
          fontSize: 10.75,
          fontWeight: 800,
          whiteSpace: "nowrap",
        }}
      />
    </div>
  );
}

export function AccountInspectorFooter() {
  const { colors } = useTheme();
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsPanelId = useId();
  const {
    canEditTargetDetails,
    canManageMemberCard,
    canManualCheckInTarget,
    canManageAccounts,
    canRestoreEditTarget,
    canArchiveEditTarget,
    canVerifyNonMemberTarget,
    editTarget,
    handleManualCheckIn,
    isMembershipCardPending,
    isManualAttendancePending,
    isMembershipPaymentReviewPending,
    membershipCardLoadingLabel,
    manualCheckInLoadingLabel,
    openEditModal,
    pendingMembershipPayment,
    setArchiveTarget,
    setPaymentReviewAction,
    setGrantCardTarget,
    setRestoreTarget,
    setRevokeCardTarget,
    setVerifyNonMemberTarget,
  } = useAccountsPage();
  const {
    accountLifecycleActionColor,
    accountLifecycleActionStyle,
    primaryActionStyle,
    primaryCommandTextColor,
    secondaryActionStyle,
  } = useAccountActionStyles();
  const editTargetMembershipStatus = editTarget ? getMembershipFieldValue(editTarget) : "none";
  const memberCardActionLabel =
    editTargetMembershipStatus === "active"
      ? "Revoke Membership"
      : editTargetMembershipStatus === "revoked"
        ? "Restore Membership"
        : "Grant Membership";
  const membershipActionTone =
    editTargetMembershipStatus === "active"
      ? {
          color: colors.danger,
          border: `1px solid ${colors.danger}42`,
          backgroundColor: `${colors.danger}10`,
        }
      : editTargetMembershipStatus === "revoked"
        ? {
            color: colors.brand,
            border: `1px solid ${colors.brand}42`,
            backgroundColor: `${colors.brand}10`,
          }
        : {
            color: colors.brand,
            border: `1px solid ${colors.brand}42`,
            backgroundColor: colors.surfaceRaised,
          };
  const accountActionLabel = canRestoreEditTarget ? "Restore Account" : "Archive Account";
  const canRunAccountArchiveAction = canArchiveEditTarget || canRestoreEditTarget;
  const canReviewMembershipPayment =
    canManageAccounts &&
    Boolean(editTarget) &&
    Boolean(pendingMembershipPayment);
  const compactActionStyle: CSSProperties = {
    minHeight: 36,
    paddingInline: 8,
  };
  const compactTextStyle: CSSProperties = {
    fontSize: 10.5,
    fontWeight: 800,
    lineHeight: 1.1,
    whiteSpace: "normal",
    textAlign: "center",
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        id={actionsPanelId}
        aria-hidden={!actionsOpen}
        style={{
          display: "grid",
          gap: 8,
          maxHeight: actionsOpen ? 320 : 0,
          opacity: actionsOpen ? 1 : 0,
          overflowX: "hidden",
          overflowY: actionsOpen ? "auto" : "hidden",
          pointerEvents: actionsOpen ? "auto" : "none",
          transform: actionsOpen ? "translateY(0)" : "translateY(12px)",
          transformOrigin: "bottom center",
          transition: `max-height 240ms ease, opacity 180ms ease, transform 240ms ease, visibility 0ms linear ${
            actionsOpen ? "0ms" : "240ms"
          }`,
          visibility: actionsOpen ? "visible" : "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          <FitButton
            variant="primary"
            label="Edit Details"
            icon={Pencil}
            iconSize={13}
            fullWidth
            disabled={!editTarget || !canEditTargetDetails}
            onClick={editTarget && canEditTargetDetails ? openEditModal : undefined}
            style={{ ...primaryActionStyle, ...compactActionStyle }}
            textStyle={{ ...compactTextStyle, color: primaryCommandTextColor }}
          />
          <FitButton
            variant="ghost"
            label={editTarget ? memberCardActionLabel : "Manage Membership"}
            icon={CreditCard}
            iconSize={13}
            fullWidth
            disabled={!editTarget || !canManageMemberCard || isMembershipCardPending}
            onClick={() => {
              if (!editTarget || !canManageMemberCard) return;
              if (getMembershipFieldValue(editTarget) === "active") {
                setRevokeCardTarget(editTarget);
                return;
              }
              setGrantCardTarget(editTarget);
            }}
            style={{
              ...secondaryActionStyle,
              ...compactActionStyle,
              border: membershipActionTone.border,
              backgroundColor: membershipActionTone.backgroundColor,
            }}
            textStyle={{ ...compactTextStyle, color: membershipActionTone.color }}
          />
          <FitButton
            variant="ghost"
            label="Verify Non-Member"
            icon={UserCheck}
            iconSize={13}
            fullWidth
            disabled={!editTarget || !canVerifyNonMemberTarget}
            onClick={() => {
              if (!editTarget || !canVerifyNonMemberTarget) return;
              setVerifyNonMemberTarget(editTarget);
            }}
            style={{
              ...secondaryActionStyle,
              ...compactActionStyle,
              border: `1px solid ${colors.brand}42`,
              backgroundColor: canVerifyNonMemberTarget ? `${colors.brand}10` : colors.surfaceRaised,
            }}
            textStyle={{ ...compactTextStyle, color: colors.brand }}
          />
          <FitButton
            variant="ghost"
            label="Check In"
            icon={LogIn}
            iconSize={13}
            fullWidth
            disabled={!editTarget || !canManualCheckInTarget || isManualAttendancePending}
            onClick={() => {
              if (!editTarget || !canManualCheckInTarget) return;
              void handleManualCheckIn(editTarget);
            }}
            style={{ ...secondaryActionStyle, ...compactActionStyle }}
            textStyle={{ ...compactTextStyle, color: colors.textPrimary }}
          />
          <FitButton
            variant="ghost"
            label={editTarget ? accountActionLabel : "Archive Account"}
            icon={Archive}
            iconSize={13}
            fullWidth
            disabled={!editTarget || !canRunAccountArchiveAction}
            onClick={() => {
              if (!editTarget) return;
              if (canRestoreEditTarget) {
                setRestoreTarget(editTarget);
                return;
              }
              if (canArchiveEditTarget) {
                setArchiveTarget(editTarget);
              }
            }}
            style={{
              ...accountLifecycleActionStyle,
              ...compactActionStyle,
              gridColumn: "1 / -1",
            }}
            textStyle={{ ...compactTextStyle, color: accountLifecycleActionColor }}
          />
          {canReviewMembershipPayment ? (
            <>
              <FitButton
                variant="ghost"
                label="Approve Payment"
                icon={CreditCard}
                iconSize={13}
                fullWidth
                disabled={isMembershipPaymentReviewPending}
                onClick={() => setPaymentReviewAction("approve")}
                style={{
                  ...secondaryActionStyle,
                  ...compactActionStyle,
                  border: `1px solid ${colors.success}45`,
                  backgroundColor: `${colors.success}10`,
                }}
                textStyle={{ ...compactTextStyle, color: colors.success }}
              />
              <FitButton
                variant="ghost"
                label="Reject Payment"
                icon={CreditCard}
                iconSize={13}
                fullWidth
                disabled={isMembershipPaymentReviewPending}
                onClick={() => setPaymentReviewAction("reject")}
                style={{
                  ...secondaryActionStyle,
                  ...compactActionStyle,
                  border: `1px solid ${colors.danger}45`,
                  backgroundColor: `${colors.danger}10`,
                }}
                textStyle={{ ...compactTextStyle, color: colors.danger }}
              />
            </>
          ) : null}
        </div>
        {isMembershipCardPending ? (
          <FitText style={{ fontSize: 11, color: colors.textMuted }}>{membershipCardLoadingLabel}</FitText>
        ) : null}
        {canReviewMembershipPayment ? (
          <FitText style={{ fontSize: 11, color: colors.textMuted }}>
            Cash membership payment is awaiting staff verification.
          </FitText>
        ) : null}
        {isManualAttendancePending ? (
          <FitText style={{ fontSize: 11, color: colors.textMuted }}>{manualCheckInLoadingLabel}</FitText>
        ) : null}
      </div>
      <FitButton
        variant="ghost"
        aria-controls={actionsPanelId}
        aria-expanded={actionsOpen}
        onClick={() => setActionsOpen((current) => !current)}
        style={{
          border: `1px solid ${actionsOpen ? colors.brand : colors.border}`,
          backgroundColor: actionsOpen ? `${colors.brand}12` : colors.surface,
          color: colors.brand,
          minHeight: 44,
          borderRadius: 8,
        }}
        textStyle={{ color: colors.brand, fontWeight: 850, letterSpacing: "0.04em" }}
      >
        <span
          style={{
            alignItems: "center",
            display: "inline-flex",
            gap: 8,
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          <span>{actionsOpen ? "CLOSE ACTIONS" : "OPEN ACTIONS"}</span>
          <ChevronUp
            size={15}
            strokeWidth={2.4}
            style={{
              transform: actionsOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 180ms ease",
            }}
          />
        </span>
      </FitButton>
    </div>
  );
}

export function AccountInspectorBody() {
  const { colors } = useTheme();
  const { editTarget, pendingRequestsByUserId } = useAccountsPage();
  const emptyAccountValue = "N/A";
  const accountDetailsAvatarUrl = editTarget ? getMemberAvatarUrl(editTarget) : null;
  const accountDetailsTitle = editTarget ? fullName(editTarget) || "Unnamed account" : emptyAccountValue;
  const accountStatusLabel = editTarget
    ? getDirectoryStatusLabel(editTarget, pendingRequestsByUserId)
    : emptyAccountValue;
  const accountAccessLabel = editTarget
    ? getDirectoryAccessLabel(editTarget, pendingRequestsByUserId)
    : emptyAccountValue;
  const accountInspectorSections = [
    {
      title: "User Details",
      items: [
        {
          label: "User Type",
          value: editTarget ? getDirectoryRoleLabel(editTarget.role?.name) : emptyAccountValue,
        },
        { label: "Access", value: accountAccessLabel },
        { label: "Email", value: editTarget?.email ?? emptyAccountValue },
      ],
    },
    {
      title: "Activity",
      items: [
        {
          label: "Last Check-in",
          value: editTarget ? formatLastCheckIn(editTarget.lastCheckInAt) : emptyAccountValue,
        },
        {
          label: "Scan Status",
          value: editTarget ? getScanReadinessLabel(editTarget) : emptyAccountValue,
        },
      ],
    },
  ];

  return (
    <>
      <div
        style={{
          display: "grid",
          justifyItems: "center",
          gap: 8,
          padding: "0 0 4px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 74,
            height: 74,
            borderRadius: 8,
            border: `1px ${editTarget ? "solid" : "dashed"} ${colors.border}`,
            backgroundColor: colors.surfaceRaised,
            color: editTarget ? colors.brand : colors.textMuted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <FitText
            style={{
              fontSize: editTarget ? 24 : 15,
              fontWeight: 850,
              letterSpacing: "0.04em",
            }}
          >
            {editTarget ? getMemberInitials(editTarget) : emptyAccountValue}
          </FitText>
          {accountDetailsAvatarUrl ? (
            <img
              src={accountDetailsAvatarUrl}
              alt={`${accountDetailsTitle} profile`}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : null}
        </div>
        <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
          <FitText
            style={{
              fontSize: 16,
              fontWeight: 850,
              color: colors.textPrimary,
              lineHeight: 1.22,
              overflowWrap: "anywhere",
            }}
          >
            {accountDetailsTitle}
          </FitText>
          <FitText
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: editTarget ? colors.brand : colors.textSecondary,
              lineHeight: 1.28,
              overflowWrap: "anywhere",
            }}
          >
            {editTarget?.email ?? emptyAccountValue}
          </FitText>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
            <FitPill
              mode="status"
              label={accountStatusLabel}
              color={
                editTarget
                  ? getDirectoryStatusColor(editTarget, pendingRequestsByUserId, colors.warning)
                  : colors.textMuted
              }
              fontSize={9.5}
            />
            <FitPill
              mode="status"
              label={accountAccessLabel}
              color={editTarget ? colors.brand : colors.textMuted}
              fontSize={9.5}
              borderOpacity="35"
              bgOpacity="12"
            />
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {accountInspectorSections.map((section) => (
          <div key={section.title} style={{ display: "grid", gap: 10 }}>
            <FitText
              style={{
                fontSize: 11,
                fontWeight: 850,
                color: colors.brand,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {section.title}
            </FitText>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: section.items.length > 2 ? "repeat(2, minmax(0, 1fr))" : "1fr",
                gap: 8,
              }}
            >
              {section.items.map((item) => {
                const isEmailDetail = item.label === "Email";

                return (
                  <div
                    key={item.label}
                    style={{
                      display: "grid",
                      gap: 5,
                      minWidth: 0,
                      padding: "10px 11px",
                      borderRadius: 8,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.surfaceRaised,
                      gridColumn: isEmailDetail ? "1 / -1" : undefined,
                    }}
                  >
                    <FitText
                      excludeGlobalScale
                      style={{
                        fontSize: 9.5,
                        fontWeight: 850,
                        color: colors.textMuted,
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                      }}
                    >
                      {item.label}
                    </FitText>
                    <FitText
                      excludeGlobalScale={isEmailDetail}
                      style={{
                        fontSize: isEmailDetail ? 10.5 : 12.25,
                        fontWeight: 800,
                        color: colors.textPrimary,
                        lineHeight: 1.3,
                        overflowWrap: "anywhere",
                        wordBreak: "normal",
                        whiteSpace: isEmailDetail ? "normal" : undefined,
                      }}
                    >
                      {item.value}
                    </FitText>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <CoachClientManagementPanel />
    </>
  );
}

export default function AccountsInspectorSurface() {
  const { canManageAccounts, isCoach } = useAccountsPage();

  return (
    <div
      className="members-directory-inspector"
      style={{
        display: "grid",
        gridTemplateRows: canManageAccounts
          ? "auto minmax(0, 1fr)"
          : "minmax(0, 1fr)",
        gap: canManageAccounts ? 10 : 0,
        height: "100%",
        minHeight: 0,
      }}
    >
      {canManageAccounts ? <AccountInspectorCommandRow /> : null}
      <MemberInspectorPanel
        ariaLabel={isCoach ? "Client details" : "Account details"}
        footer={<AccountInspectorFooter />}
      >
        <AccountInspectorBody />
      </MemberInspectorPanel>
    </div>
  );
}

export { useAccountActionStyles };
