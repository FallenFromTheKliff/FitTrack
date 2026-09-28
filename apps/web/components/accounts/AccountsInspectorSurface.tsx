"use client";

import { Archive, Check, ChevronUp, CreditCard, LogIn, Pencil, ScanLine, UserCheck, UserPlus, X } from "lucide-react";
import { useEffect, useId, useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CoachAppointmentScheduleRecord,
  StaffAppointmentRecord,
  SubmitCoachAppointmentFeedbackPayload,
} from "@fittrack/api-client";
import {
  coachScheduleQueryOptions,
  coachSelfProfileQueryOptions,
  invalidateCoachScheduleQueries,
  recurringCoachingPlansQueryOptions,
  staffAppointmentsQueryOptions,
} from "@fittrack/query";
import { parseRevocationReasons, type CoachProfileRecord } from "@fittrack/types";
import { fullName } from "@fittrack/utils";

import { FitButton, FitPill, FitSelect, FitText } from "@/components/fit";
import MemberInspectorPanel from "@/components/accounts/MemberInspectorPanel";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { webApiClient } from "@/lib/api-client";
import { MEMBERSHIP_CARD_REVOCATION_REASONS } from "@/data/members/members";
import {
  formatLastCheckIn,
  getDirectoryAccessLabel,
  getDirectoryRoleLabel,
  getDirectoryStatusLabel,
  getMemberAvatarUrl,
  getMemberInitials,
  getMembershipFieldValue,
} from "@/components/accounts/accountComponentUtils";

import { useAccountsPage } from "./AccountsPageContext";
import { CoachClientWorkoutPrograms } from "./CoachClientWorkoutPrograms";
import PaidSessionSchedule, { isPaidSession } from "./PaidSessionSchedule";

const PREDEFINED_REVOCATION_REASON_SET = new Set<string>(
  MEMBERSHIP_CARD_REVOCATION_REASONS.filter((reason) => reason !== "Other"),
);

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
  const {
    coachClientPanelMode,
    editTarget,
    isCoach,
    setCoachClientPanelMode,
  } = useAccountsPage();
  const queryClient = useQueryClient();
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [historyAppointmentId, setHistoryAppointmentId] = useState("");
  const [coachFeedback, setCoachFeedback] = useState("");
  const [assessmentReport, setAssessmentReport] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState<CoachInspectorMessage>(null);
  const isCoachClient = isCoach && editTarget?.role?.name === "USER";

  const { data: coachProfile } = useQuery({
    ...coachSelfProfileQueryOptions<CoachProfileRecord>(webApiClient, user?.id),
    enabled: isCoachClient && Boolean(user?.id),
  });
  const { data: recurringPlans = [] } = useQuery({
    ...recurringCoachingPlansQueryOptions(webApiClient),
    enabled: isCoachClient && Boolean(user?.id),
    staleTime: 30_000,
  });
  const { data: coachSchedule = [] } = useQuery({
    ...coachScheduleQueryOptions<CoachAppointmentScheduleRecord>(webApiClient, user?.id),
    enabled: isCoachClient && Boolean(user?.id),
  });

  const clientAppointments = useMemo(
    () =>
      coachSchedule
        .filter(
          (appointment) =>
            appointment.userId === editTarget?.id &&
            (appointment.status === "confirmed" || appointment.status === "completed"),
        )
        .sort(
          (left, right) =>
            new Date(right.scheduledAt).getTime() - new Date(left.scheduledAt).getTime(),
        ),
    [coachSchedule, editTarget?.id],
  );
  const activeMonthlyPlan = useMemo(
    () =>
      recurringPlans.find(
        (plan) =>
          plan.memberId === editTarget?.id &&
          plan.coachId === coachProfile?.id &&
          plan.frequency === "monthly" &&
          plan.status === "active",
      ) ?? null,
    [coachProfile?.id, editTarget?.id, recurringPlans],
  );
  const hasActivePaidOneSession = useMemo(
    () =>
      clientAppointments.some(
        (appointment) =>
          appointment.status === "confirmed" &&
          appointment.activePaymentStatus === "completed" &&
          !appointment.recurringPlanId,
      ),
    [clientAppointments],
  );
  const completedAppointments = useMemo(
    () => clientAppointments.filter((appointment) => appointment.status === "completed"),
    [clientAppointments],
  );
  const selectedAppointment = useMemo(
    () => completedAppointments.find((appointment) => appointment.id === selectedAppointmentId) ?? null,
    [completedAppointments, selectedAppointmentId],
  );
  const historyAppointment = useMemo(
    () => clientAppointments.find((appointment) => appointment.id === historyAppointmentId) ?? null,
    [clientAppointments, historyAppointmentId],
  );
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
    if (!isCoachClient) {
      setHistoryAppointmentId("");
      return;
    }

    setHistoryAppointmentId((current) => {
      if (current && clientAppointments.some((appointment) => appointment.id === current)) {
        return current;
      }

      return clientAppointments[0]?.id ?? "";
    });
  }, [clientAppointments, isCoachClient]);

  useEffect(() => {
    setCoachFeedback(selectedAppointment?.coachFeedback ?? "");
    setAssessmentReport(selectedAppointment?.assessmentReport ?? "");
    setFeedbackMessage(null);
  }, [selectedAppointment?.id, selectedAppointment?.coachFeedback, selectedAppointment?.assessmentReport]);

  useEffect(() => {
    setCoachClientPanelMode("overview");
  }, [editTarget?.id, setCoachClientPanelMode]);

  if (!isCoachClient || !editTarget) return null;

  const latestSession = clientAppointments[0] ?? null;
  const upcomingSessions = clientAppointments.filter(
    (appointment) =>
      appointment.status === "confirmed" &&
      new Date(appointment.scheduledAt).getTime() >= Date.now(),
  );

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
    try {
      await submitAppointmentFeedbackMutation.mutateAsync({
        appointmentId: selectedAppointmentId,
        payload: {
          assessmentReport: assessmentReport.trim() || undefined,
          coachFeedback: trimmedFeedback,
        },
      });
    } catch {
      // onError owns the user-facing message; keep handled validation failures out of the console.
    }
  };

  const sharedInputStyle: CSSProperties = {
    boxSizing: "border-box",
    width: "100%",
    minHeight: 40,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceRaised,
    color: colors.textPrimary,
    fontFamily: "inherit",
  };
  const compactCoachFieldStyle: CSSProperties = {
    display: "grid",
    gap: 4,
  };
  const compactCoachFieldLabelStyle: CSSProperties = {
    fontSize: 9.25,
    fontWeight: 800,
    color: colors.textMuted,
    letterSpacing: "0.03em",
    lineHeight: 1.1,
    textTransform: "uppercase",
  };
  const compactCoachInputStyle: CSSProperties = {
    ...sharedInputStyle,
    minHeight: 34,
    padding: "7px 9px",
    fontSize: 11,
    lineHeight: 1.25,
  };
  const compactCoachTextareaStyle: CSSProperties = {
    ...compactCoachInputStyle,
    minHeight: 62,
    maxHeight: 76,
    overflowY: "auto",
    resize: "none",
  };
  const sharedSelectStyle: CSSProperties = {
    width: "100%",
    minHeight: 40,
    borderRadius: 8,
  };
  const sectionCardStyle: CSSProperties = {
    display: "grid",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    backgroundColor: colors.surfaceRaised,
  };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {coachClientPanelMode === "overview" ? (
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
            Coaching Overview
          </FitText>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 7 }}>
            {[
              { label: "Sessions", value: String(clientAppointments.length) },
              { label: "Done", value: String(completedAppointments.length) },
              { label: "Next", value: String(upcomingSessions.length) },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "grid",
                  gap: 4,
                  padding: "9px 8px",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText
                  excludeGlobalScale
                  style={{
                    fontSize: 9.25,
                    fontWeight: 800,
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
            <FitText style={{ fontSize: 11, lineHeight: 1.45, color: colors.textSecondary }}>
              Latest session: {formatCoachScheduleDate(latestSession.scheduledAt)}
            </FitText>
          ) : (
            <FitText style={{ fontSize: 11, lineHeight: 1.45, color: colors.textSecondary }}>
              No coaching sessions recorded for this client yet.
            </FitText>
          )}
          <label style={{ display: "grid", gap: 6 }}>
            <FitText style={{ fontSize: 10, fontWeight: 800, color: colors.textMuted }}>Session record</FitText>
            <FitSelect
              id="coach-client-session-record"
              name="coachClientSessionRecord"
              fullWidth
              value={historyAppointmentId}
              onChange={(event) => setHistoryAppointmentId(event.currentTarget.value)}
              placeholder={clientAppointments.length > 0 ? "Select session" : "No sessions yet"}
              options={clientAppointments.map((appointment) => ({
                label: formatCoachScheduleDate(appointment.scheduledAt),
                value: appointment.id,
              }))}
              style={sharedSelectStyle}
              disabled={clientAppointments.length === 0}
            />
          </label>
          {historyAppointment ? (
            <div
              style={{
                display: "grid",
                gap: 7,
                padding: "10px 11px",
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <FitText style={{ fontSize: 12, fontWeight: 800, color: colors.textPrimary }}>
                  {historyAppointment.duration} min
                </FitText>
                <FitPill
                  mode="status"
                  label={formatCoachStatusLabel(historyAppointment.status)}
                  color={historyAppointment.status === "completed" ? colors.success : colors.brand}
                  fontSize={9}
                  style={{ borderRadius: 6 }}
                />
              </div>
              {[
                { label: "Notes", value: historyAppointment.notes },
                { label: "Feedback", value: historyAppointment.coachFeedback },
                { label: "Assessment", value: historyAppointment.assessmentReport },
              ].map((item) => (
                <div key={item.label} style={{ display: "grid", gap: 2 }}>
                  <FitText style={{ fontSize: 9.75, fontWeight: 800, color: colors.textMuted }}>
                    {item.label}
                  </FitText>
                  <FitText style={{ fontSize: 11, lineHeight: 1.45, color: colors.textSecondary }}>
                    {item.value?.trim() || "Not added"}
                  </FitText>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {coachClientPanelMode === "workout" ? (
        <CoachClientWorkoutPrograms
          canManage={Boolean(activeMonthlyPlan) || hasActivePaidOneSession}
          coachUserId={user?.id ?? ""}
          memberId={editTarget.id}
          paidPeriodEndDate={activeMonthlyPlan?.endDate}
        />
      ) : null}

      {coachClientPanelMode === "schedule" ? (
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
            Paid session schedule
          </FitText>
          <FitText style={{ fontSize: 11, color: colors.textSecondary }}>
            Existing confirmed sessions remain tied to the client&apos;s active coaching enrollment.
          </FitText>
          <FitPill
            mode="status"
            label={activeMonthlyPlan ? "Active monthly plan" : "No active monthly plan"}
            color={activeMonthlyPlan ? colors.success : colors.textMuted}
            fontSize={9}
            style={{ justifySelf: "start", borderRadius: 6 }}
          />
          <PaidSessionSchedule
            appointments={clientAppointments}
            fallbackCoachId={coachProfile?.id}
            memberId={editTarget.id}
            requesterUserId={user?.id}
          />
        </div>
      ) : null}

      {coachClientPanelMode === "feedback" ? (
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
            <FitSelect
              id="coach-client-completed-session"
              name="coachClientCompletedSession"
              fullWidth
              value={selectedAppointmentId}
              onChange={(event) => setSelectedAppointmentId(event.currentTarget.value)}
              placeholder={completedAppointments.length > 0 ? "Select completed session" : "No completed sessions yet"}
              options={completedAppointments.map((appointment) => ({
                label: formatCoachScheduleDate(appointment.scheduledAt),
                value: appointment.id,
              }))}
              style={sharedSelectStyle}
              disabled={completedAppointments.length === 0}
            />
          </label>
          <label style={compactCoachFieldStyle}>
            <FitText style={compactCoachFieldLabelStyle}>Coach feedback</FitText>
            <textarea
              id="coach-client-feedback"
              name="coachClientFeedback"
              rows={2}
              value={coachFeedback}
              onChange={(event) => {
                setCoachFeedback(event.currentTarget.value);
                if (feedbackMessage) setFeedbackMessage(null);
              }}
              placeholder="Summarize what the client did well and what to improve next."
              style={compactCoachTextareaStyle}
            />
          </label>
          <label style={compactCoachFieldStyle}>
            <FitText style={compactCoachFieldLabelStyle}>Assessment report</FitText>
            <textarea
              id="coach-client-assessment-report"
              name="coachClientAssessmentReport"
              rows={2}
              value={assessmentReport}
              onChange={(event) => {
                setAssessmentReport(event.currentTarget.value);
                if (feedbackMessage) setFeedbackMessage(null);
              }}
              placeholder="Add optional assessment notes, mobility observations, or progression updates."
              style={compactCoachTextareaStyle}
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
      ) : null}
    </div>
  );
}

function AccountInspectorCommandRow() {
  const { colors, onBrandTextColor } = useTheme();
  const { canManageAccounts, setContentMode, setScanFeedback, setScanOpen } = useAccountsPage();

  if (!canManageAccounts) return null;

  return (
    <div
      className="members-inspector-command-row"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 0.86fr) minmax(0, 1fr)",
        gap: 8,
        minWidth: 0,
      }}
    >
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
    coachClientPanelMode,
    canEditTargetDetails,
    canManageMemberCard,
    canManualCheckInTarget,
  canRestoreEditTarget,
  canArchiveEditTarget,
  canTerminateEditTarget,
  canVerifyNonMemberTarget,
    editTarget,
    handleManualCheckIn,
    isCoach,
    isMembershipCardPending,
    isManualAttendancePending,
    membershipCardLoadingLabel,
    manualCheckInLoadingLabel,
    openEditModal,
    setArchiveTarget,
    setGrantCardTarget,
    setRejectTerminationTarget,
    setRemoveMembershipTarget,
    setRestoreTarget,
    openRevokeReasonModal,
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
      ? "Revoke Membership Card"
      : editTargetMembershipStatus === "revoked"
        ? "Restore Membership Card"
        : "Grant Membership Card";
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
  const isCoachActionsVariant = isCoach && Boolean(editTarget);
  const actionsPanelMaxHeight = isCoachActionsVariant ? "min(620px, max(340px, calc(100vh - 300px)))" : 320;
  const verifyAccountActionLabel =
    editTarget?.role?.name === "USER" ? "Verify Non-Member" : "Verify Team Member";

  useEffect(() => {
    if (!isCoach || !editTarget) {
      setActionsOpen(false);
      return;
    }

    if (coachClientPanelMode !== "overview") {
      setActionsOpen(true);
    }
  }, [coachClientPanelMode, editTarget, isCoach]);

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div
        id={actionsPanelId}
        aria-hidden={!actionsOpen}
        style={{
          display: isCoachActionsVariant ? "flex" : "grid",
          flexDirection: isCoachActionsVariant ? "column" : undefined,
          gap: isCoachActionsVariant ? 0 : 8,
          maxHeight: actionsOpen ? actionsPanelMaxHeight : 0,
          opacity: actionsOpen ? 1 : 0,
          overflowX: "hidden",
          overflowY: isCoachActionsVariant ? "hidden" : actionsOpen ? "auto" : "hidden",
          pointerEvents: actionsOpen ? "auto" : "none",
          transform: actionsOpen ? "translateY(0)" : "translateY(12px)",
          transformOrigin: "bottom center",
          transition: `max-height 240ms ease, opacity 180ms ease, transform 240ms ease, visibility 0ms linear ${
            actionsOpen ? "0ms" : "240ms"
          }`,
          visibility: actionsOpen ? "visible" : "hidden",
        }}
      >
        {isCoachActionsVariant ? (
          <div
            style={{
              display: "grid",
              flex: "1 1 auto",
              minHeight: 0,
              overflowX: "hidden",
              overflowY: "auto",
              paddingBottom: 12,
              borderBottom: `1px solid ${colors.border}`,
            }}
          >
            <div
              style={{
                minHeight: 0,
                overflowX: "hidden",
                paddingRight: 2,
              }}
            >
              <CoachClientManagementPanel />
            </div>
          </div>
        ) : null}
        <div
          style={{
            display: "grid",
            flexShrink: isCoachActionsVariant ? 0 : undefined,
            gap: 8,
            paddingTop: isCoachActionsVariant ? 12 : 0,
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
                  openRevokeReasonModal(editTarget);
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
            {editTargetMembershipStatus === "active" ? (
              <FitButton
                variant="ghost"
                label="Make Non-Member"
                icon={X}
                iconSize={13}
                fullWidth
                disabled={!editTarget || !canManageMemberCard || isMembershipCardPending}
                onClick={() => {
                  if (!editTarget || !canManageMemberCard) return;
                  setRemoveMembershipTarget(editTarget);
                }}
                style={{
                  ...secondaryActionStyle,
                  ...compactActionStyle,
                  border: `1px solid ${colors.danger}42`,
                  backgroundColor: `${colors.danger}10`,
                }}
                textStyle={{ ...compactTextStyle, color: colors.danger }}
              />
            ) : null}
            <FitButton
              variant="ghost"
              label={verifyAccountActionLabel}
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
            {canTerminateEditTarget && editTarget ? (
              <FitButton
                variant="ghost"
                label="Reject Termination Request"
                icon={X}
                iconSize={13}
                fullWidth
                onClick={() => setRejectTerminationTarget(editTarget)}
                style={{
                  ...secondaryActionStyle,
                  ...compactActionStyle,
                  gridColumn: "1 / -1",
                  border: `1px solid ${colors.danger}42`,
                  backgroundColor: `${colors.danger}10`,
                }}
                textStyle={{ ...compactTextStyle, color: colors.danger }}
              />
            ) : null}
          </div>
          {isMembershipCardPending ? (
            <FitText style={{ fontSize: 11, color: colors.textMuted }}>{membershipCardLoadingLabel}</FitText>
          ) : null}
          {isManualAttendancePending ? (
            <FitText style={{ fontSize: 11, color: colors.textMuted }}>{manualCheckInLoadingLabel}</FitText>
          ) : null}
        </div>
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
  const { user } = useAuth();
  const {
    canManageAccounts,
    canManageMemberCard,
    editTarget,
    isCoach,
    openRevokeReasonModal,
    pendingRequestsByUserId,
  } = useAccountsPage();
  const isManagedMember =
    canManageAccounts && !isCoach && editTarget?.role?.name === "USER";
  const emptyAccountValue = "N/A";
  const accountDetailsAvatarUrl = editTarget ? getMemberAvatarUrl(editTarget) : null;
  const accountDetailsTitle = editTarget ? fullName(editTarget) || "Unnamed account" : emptyAccountValue;
  const profile = editTarget?.profile;
  const accountStatusLabel = editTarget
    ? getDirectoryStatusLabel(editTarget, pendingRequestsByUserId)
    : emptyAccountValue;
  const accountStatusTone =
    accountStatusLabel === "Archived" ||
    accountStatusLabel === "Pending" ||
    accountStatusLabel === "Requesting Termination"
      ? colors.warning
      : accountStatusLabel === "Suspended" || accountStatusLabel === "Banned"
        ? colors.danger
        : colors.success;
  const accountAccessLabel = editTarget
    ? getDirectoryAccessLabel(editTarget, pendingRequestsByUserId)
    : emptyAccountValue;
  const isRevokedMembershipCard = getMembershipFieldValue(editTarget) === "revoked";
  const revocationReasons = parseRevocationReasons(editTarget?.membershipCard?.revokeReason);
  const predefinedRevocationReasons = revocationReasons.filter((reason) =>
    PREDEFINED_REVOCATION_REASON_SET.has(reason),
  );
  const customRevocationReasons = revocationReasons.filter(
    (reason) => !PREDEFINED_REVOCATION_REASON_SET.has(reason),
  );
  const compactRevocationReasons = predefinedRevocationReasons.length
    ? predefinedRevocationReasons
    : customRevocationReasons.length
      ? []
      : ["Not recorded"];
  const accountStatusLines = accountStatusLabel === "Requesting Termination"
    ? ["Requesting", "Termination"]
    : [accountStatusLabel];
  const showVerifiedAccessMarker =
    editTarget &&
    accountAccessLabel !== "Archived" &&
    accountAccessLabel !== "Not Verified" &&
    accountAccessLabel !== "Revoked" &&
    (editTarget.emailVerified || editTarget.status === "active");
  const accountInspectorSections = isCoach
    ? [
        {
          title: "Client Profile",
          items: [
            { label: "Phone", value: formatCoachDetailValue(editTarget?.phone_no) },
            {
              label: "Verification",
              value: editTarget?.emailVerified ? "Verified" : "Not Verified",
            },
            {
              label: "Membership Type",
              value: formatCoachDetailValue(profile?.membershipType),
            },
            {
              label: "Activity Level",
              value: formatCoachDetailValue(profile?.activityLevel),
            },
            { label: "Goal", value: formatCoachDetailValue(profile?.fitnessGoal) },
            {
              label: "Metrics",
              value: `${formatCoachDetailValue(profile?.currentWeightKg, " kg")} / ${formatCoachDetailValue(
                profile?.heightCm,
                " cm",
              )}`,
            },
          ],
        },
        {
          title: "Account Signals",
          items: [
            {
              label: "Last Check-in",
              value: editTarget ? formatLastCheckIn(editTarget.lastCheckInAt) : emptyAccountValue,
            },
          ],
        },
      ]
    : [
        {
          title: "User Details",
          items: [
            {
              label: "User Type",
              value: editTarget ? getDirectoryRoleLabel(editTarget.role?.name).toUpperCase() : emptyAccountValue,
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
            <span
              style={{
                display: "inline-grid",
                justifyItems: "center",
                alignItems: "center",
                minWidth: accountStatusLines.length > 1 ? 78 : 64,
                padding: accountStatusLines.length > 1 ? "4px 8px" : "4px 9px",
                borderRadius: 6,
                border: `1px solid ${editTarget ? accountStatusTone : colors.textMuted}55`,
                backgroundColor: `${editTarget ? accountStatusTone : colors.textMuted}14`,
                textAlign: "center",
              }}
            >
              {accountStatusLines.map((line) => (
                <FitText
                  key={line}
                  as="span"
                  excludeGlobalScale
                  style={{
                    fontSize: 9.5,
                    fontWeight: 500,
                    lineHeight: 1.08,
                    color: editTarget ? accountStatusTone : colors.textMuted,
                  }}
                >
                  {line}
                </FitText>
              ))}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 5,
                minWidth: 0,
                padding: "4px 8px",
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              {accountAccessLabel === "Revoked" ? (
                <X size={12} color={colors.danger} strokeWidth={2.4} />
              ) : accountAccessLabel === "Not Verified" ? (
                <FitText
                  as="span"
                  excludeGlobalScale
                  style={{ color: colors.textSecondary, fontSize: 12, fontWeight: 700, lineHeight: 1 }}
                >
                  !
                </FitText>
              ) : showVerifiedAccessMarker ? (
                <Check size={12} color={colors.warning} strokeWidth={2.4} />
              ) : null}
              <FitText
                as="span"
                excludeGlobalScale
                style={{
                  fontSize: 9.5,
                  fontWeight: 500,
                  lineHeight: 1.15,
                  color: editTarget ? colors.textSecondary : colors.textMuted,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {accountAccessLabel}
              </FitText>
            </span>
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
                        fontWeight: 500,
                        color: colors.textSecondary,
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
            {section.title === "User Details" && isRevokedMembershipCard ? (
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  padding: "11px 12px",
                  borderRadius: 8,
                  border: `1px solid ${colors.danger}45`,
                  backgroundColor: `${colors.danger}08`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <FitText
                    style={{
                      fontSize: 11,
                      fontWeight: 850,
                      color: colors.textPrimary,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                    }}
                  >
                    Membership Card
                  </FitText>
                  {canManageMemberCard && editTarget ? (
                    <FitButton
                      variant="ghost"
                      icon={Pencil}
                      iconOnly
                      iconSize={14}
                      title="Edit Revocation Reasons"
                      aria-label="Edit Revocation Reasons"
                      onClick={() => openRevokeReasonModal(editTarget, "edit")}
                      style={{ minHeight: 30, width: 30, borderRadius: 6 }}
                    />
                  ) : null}
                </div>
                <div style={{ display: "grid", gap: 5 }}>
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
                    Status
                  </FitText>
                  <FitPill
                    mode="status"
                    label="Revoked"
                    color={colors.danger}
                    fontSize={9}
                    style={{ justifySelf: "start", borderRadius: 6 }}
                  />
                </div>
                <div style={{ display: "grid", gap: 6 }}>
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
                    Revocation Reasons
                  </FitText>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      minWidth: 0,
                      maxWidth: "100%",
                    }}
                  >
                    {compactRevocationReasons.map((reason) => (
                      <span
                        key={reason}
                        title={reason}
                        style={{
                          display: "inline-flex",
                          minWidth: 0,
                          maxWidth: "100%",
                          overflow: "hidden",
                          flex: "0 1 auto",
                        }}
                      >
                        <FitPill
                          mode="status"
                          label={reason}
                          color={
                            predefinedRevocationReasons.length
                              ? colors.danger
                              : colors.textMuted
                          }
                          fontSize={9}
                          style={{
                            borderRadius: 6,
                            maxWidth: "100%",
                            minWidth: 0,
                            overflow: "hidden",
                          }}
                        />
                      </span>
                    ))}
                    {customRevocationReasons.map((reason, index) => (
                      <span
                        key={`${reason}-${index}`}
                        title={reason}
                        style={{
                          display: "block",
                          width: "100%",
                          maxWidth: "100%",
                          minWidth: 0,
                          boxSizing: "border-box",
                          flex: "0 1 100%",
                          border: `1px solid ${colors.danger}55`,
                          borderRadius: 6,
                          padding: "3px 9px",
                          backgroundColor: `${colors.danger}18`,
                        }}
                      >
                        <FitText
                          as="span"
                          style={{
                            display: "block",
                            color: colors.danger,
                            fontSize: 9,
                            fontWeight: 700,
                            lineHeight: 1.35,
                            minWidth: 0,
                            maxWidth: "100%",
                            whiteSpace: "normal",
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                          }}
                        >
                          {reason}
                        </FitText>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
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
        {canManageAccounts ? (
          <div
            className="accounts-management-inspector-scroll"
            style={{
              height: "100%",
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
            }}
          >
            <AccountInspectorBody />
          </div>
        ) : (
          <AccountInspectorBody />
        )}
      </MemberInspectorPanel>
    </div>
  );
}

export { useAccountActionStyles };
