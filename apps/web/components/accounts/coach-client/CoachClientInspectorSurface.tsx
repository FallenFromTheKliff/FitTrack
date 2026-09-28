"use client";

import { CalendarDays, ChevronUp, Dumbbell, Eye, FileText } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import type { MemberRecord } from "@fittrack/types";
import { fullName } from "@fittrack/utils";

import MemberInspectorPanel from "@/components/accounts/MemberInspectorPanel";
import { FitButton, FitPill, FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";
import {
  formatLastCheckIn,
  getMemberAvatarUrl,
  getMemberInitials,
} from "../accountComponentUtils";
import { useAccountsPage } from "../AccountsPageContext";

import { useCoachClientAction } from "./coachClientActionContext";
import {
  COACH_CLIENT_ACTION_LABELS,
  COACH_CLIENT_ACTIONS,
  formatCoachDetailValue,
  formatCoachScheduleDate,
  getCoachAccountStatusLabel,
  getCoachActionDisabledReason,
  getCoachMetricsLabel,
  getCoachRelationshipLabel,
} from "./coachClientPresentation";
import { useCoachClientWorkspace } from "./useCoachClientWorkspace";

const ACTION_ICONS = {
  feedback: FileText,
  overview: Eye,
  schedule: CalendarDays,
  workout: Dumbbell,
} as const;

function detailValueStyle(colors: ReturnType<typeof useTheme>["colors"]): CSSProperties {
  return {
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    display: "grid",
    gap: 5,
    minWidth: 0,
    padding: "10px 11px",
  };
}

function detailLabelStyle(colors: ReturnType<typeof useTheme>["colors"]): CSSProperties {
  return {
    color: colors.textMuted,
    fontSize: 9.5,
    fontWeight: 850,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
  };
}

function CoachClientDetails({ member }: { member: MemberRecord | null }) {
  const { colors } = useTheme();
  const workspace = useCoachClientWorkspace(member?.id);
  const profile = member?.profile;
  const title = member ? fullName(member) || "Unnamed client" : "Select a client";
  const relationshipLabel = getCoachRelationshipLabel(member);
  const accountStatusLabel = getCoachAccountStatusLabel(member);
  const metricsLabel = getCoachMetricsLabel(member);
  const relationshipColor = member?.membershipCard?.status === "active"
    ? colors.success
    : colors.textMuted;
  const summaryLabel = workspace.isLoading
    ? "Loading session data..."
    : workspace.clientAppointments.length > 0
      ? `${workspace.completedAppointments.length}/${workspace.clientAppointments.length} completed`
      : "No sessions recorded";
  const nextSessionLabel = workspace.isLoading
    ? "Loading..."
    : workspace.nextSession
      ? formatCoachScheduleDate(workspace.nextSession.scheduledAt)
      : "None scheduled";
  const paidPlanLabel = workspace.isLoading
    ? "Loading..."
    : workspace.activeMonthlyPlan
      ? `Monthly through ${formatCoachScheduleDate(workspace.activeMonthlyPlan.endDate)}`
      : workspace.hasActivePaidOneSession
        ? "Paid one-session relationship"
        : "No active paid plan";

  if (!member) {
    return (
      <div
        style={{
          alignContent: "center",
          display: "grid",
          gap: 8,
          height: "100%",
          justifyItems: "center",
          minHeight: 220,
          padding: 24,
          textAlign: "center",
        }}
      >
        <FitText style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 800 }}>
          Select a client
        </FitText>
        <FitText style={{ color: colors.textMuted, fontSize: 11, lineHeight: 1.45 }}>
          Choose a client from the directory to view coaching details and launch coach tools.
        </FitText>
      </div>
    );
  }

  const details = [
    ["Phone", formatCoachDetailValue(member.phone_no)],
    ["Verification", member.emailVerified ? "Verified" : "Not verified"],
    ["Membership type", formatCoachDetailValue(profile?.membershipType)],
    ["Activity level", formatCoachDetailValue(profile?.activityLevel)],
    ["Goal", formatCoachDetailValue(profile?.fitnessGoal)],
    ["Metrics", metricsLabel],
  ];
  const signals = [
    ["Paid plan", paidPlanLabel],
    ["Sessions", summaryLabel],
    ["Next session", nextSessionLabel],
    ["Last check-in", formatLastCheckIn(member.lastCheckInAt)],
  ];

  return (
    <div style={{ display: "grid", gap: 14, minWidth: 0 }}>
      <div
        style={{
          display: "grid",
          gap: 8,
          justifyItems: "center",
          paddingBottom: 2,
          textAlign: "center",
        }}
      >
        <div
          style={{
            alignItems: "center",
            backgroundColor: colors.surfaceRaised,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            display: "flex",
            height: 74,
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
            width: 74,
          }}
        >
          <FitText style={{ color: colors.brand, fontSize: 24, fontWeight: 850 }}>
            {getMemberInitials(member)}
          </FitText>
          {getMemberAvatarUrl(member) ? (
            <img
              src={getMemberAvatarUrl(member) ?? undefined}
              alt={`${title} profile`}
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
              style={{
                height: "100%",
                inset: 0,
                objectFit: "cover",
                position: "absolute",
                width: "100%",
              }}
            />
          ) : null}
        </div>
        <div style={{ display: "grid", gap: 4, minWidth: 0, width: "100%" }}>
          <FitText
            style={{
              color: colors.textPrimary,
              fontSize: 16,
              fontWeight: 850,
              lineHeight: 1.22,
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </FitText>
          <FitText
            style={{
              color: colors.brand,
              fontSize: 12,
              fontWeight: 600,
              lineHeight: 1.28,
              overflowWrap: "anywhere",
            }}
          >
            {member.email || "No email on file"}
          </FitText>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
            <FitPill
              mode="status"
              label={accountStatusLabel}
              color={member.status === "active" ? colors.success : colors.warning}
              fontSize={9}
              style={{ borderRadius: 6 }}
            />
            <FitPill
              mode="status"
              label={relationshipLabel}
              color={relationshipColor}
              fontSize={9}
              style={{ borderRadius: 6 }}
            />
          </div>
        </div>
      </div>

      <CoachClientDetailSection title="Client profile" items={details} />
      <CoachClientDetailSection title="Coaching signals" items={signals} />
      {workspace.hasError ? (
        <FitText
          role="status"
          style={{ color: colors.warning, fontSize: 10.5, lineHeight: 1.4 }}
        >
          Some coaching signals are unavailable right now. The client profile remains available.
        </FitText>
      ) : null}
    </div>
  );
}

function CoachClientDetailSection({
  items,
  title,
}: {
  items: string[][];
  title: string;
}) {
  const { colors } = useTheme();

  return (
    <section aria-label={title} style={{ display: "grid", gap: 9, minWidth: 0 }}>
      <FitText
        style={{
          color: colors.brand,
          fontSize: 11,
          fontWeight: 850,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
        }}
      >
        {title}
      </FitText>
      <div className="coach-client-detail-grid" style={{ display: "grid", gap: 8 }}>
        {items.map(([label, value]) => (
          <div key={label} style={detailValueStyle(colors)}>
            <FitText as="span" excludeGlobalScale style={detailLabelStyle(colors)}>
              {label}
            </FitText>
            <FitText
              excludeGlobalScale
              style={{
                color: colors.textSecondary,
                fontSize: 12,
                lineHeight: 1.35,
                overflowWrap: "anywhere",
              }}
            >
              {value}
            </FitText>
          </div>
        ))}
      </div>
    </section>
  );
}

function CoachClientActionFooter({ member }: { member: MemberRecord | null }) {
  const { colors } = useTheme();
  const { action, openAction } = useCoachClientAction();
  const { activeMonthlyPlan, hasActivePaidOneSession } = useCoachClientWorkspace(member?.id);
  const [actionsOpen, setActionsOpen] = useState(false);
  const workoutCanManage = Boolean(activeMonthlyPlan || hasActivePaidOneSession);
  const disabledReason = getCoachActionDisabledReason(member, workoutCanManage);

  return (
    <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
      {actionsOpen ? (
        <div
          aria-label="Coach client actions"
          className="coach-client-inspector__actions"
          id="coach-client-actions"
          role="group"
          style={{ display: "grid", gap: 8, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}
        >
          {COACH_CLIENT_ACTIONS.map((nextAction) => {
            const Icon = ACTION_ICONS[nextAction];
            const isActive = action === nextAction;
            const isWorkoutUnavailable = nextAction === "workout" && !workoutCanManage;
            return (
              <FitButton
                aria-haspopup="dialog"
                aria-label={`Open ${COACH_CLIENT_ACTION_LABELS[nextAction]}`}
                active={isActive}
                disabled={!member || isWorkoutUnavailable}
                icon={Icon}
                iconSize={14}
                key={nextAction}
                label={COACH_CLIENT_ACTION_LABELS[nextAction]}
                onClick={() => openAction(nextAction)}
                title={isWorkoutUnavailable ? disabledReason ?? undefined : undefined}
                variant="ghost"
                style={{
                  border: `1px solid ${isActive ? colors.brand : colors.border}`,
                  borderRadius: 8,
                  color: isActive ? colors.brand : colors.textSecondary,
                  minHeight: 40,
                  minWidth: 0,
                }}
                textStyle={{ color: isActive ? colors.brand : colors.textSecondary, fontSize: 10.5, fontWeight: 800 }}
              />
            );
          })}
        </div>
      ) : null}
      {actionsOpen && disabledReason ? (
        <FitText style={{ color: colors.textMuted, fontSize: 10.5, lineHeight: 1.35 }}>
          {disabledReason}
        </FitText>
      ) : null}
      <FitButton
        aria-controls="coach-client-actions"
        aria-expanded={actionsOpen}
        aria-label={actionsOpen ? "Close coach client actions" : "Open coach client actions"}
        onClick={() => setActionsOpen((current) => !current)}
        variant="ghost"
        style={{
          backgroundColor: actionsOpen ? `${colors.brand}12` : colors.surface,
          border: `1px solid ${actionsOpen ? colors.brand : colors.border}`,
          borderRadius: 8,
          color: colors.brand,
          minHeight: 44,
        }}
        textStyle={{ color: colors.brand, fontSize: 11, fontWeight: 850, letterSpacing: "0.04em" }}
      >
        <span style={{ alignItems: "center", display: "inline-flex", gap: 8, justifyContent: "center" }}>
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

export function CoachClientInspectorPanel() {
  const { editTarget, isCoach } = useAccountsPage();
  const { closeAction } = useCoachClientAction();

  useEffect(() => {
    closeAction();
  }, [closeAction, editTarget?.id]);

  if (!isCoach) return null;

  return (
    <MemberInspectorPanel
      ariaLabel="Client details"
      footer={<CoachClientActionFooter member={editTarget} />}
    >
      <CoachClientDetails member={editTarget} />
    </MemberInspectorPanel>
  );
}

export default function CoachClientInspectorSurface() {
  const { isCoach } = useAccountsPage();

  if (!isCoach) return null;

  return (
    <div
      className="members-directory-inspector coach-client-inspector"
      style={{ display: "grid", height: "100%", minHeight: 0 }}
    >
      <CoachClientInspectorPanel />
      <style>{`
        .coach-client-inspector .member-inspector-panel__body {
          overflow-y: auto;
        }

        .coach-client-detail-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        @media (max-width: 560px) {
          .coach-client-detail-grid {
            grid-template-columns: 1fr;
          }

          .coach-client-inspector__actions {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
