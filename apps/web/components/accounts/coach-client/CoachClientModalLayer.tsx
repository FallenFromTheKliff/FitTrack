"use client";

import { CalendarDays, Dumbbell, Eye, FileText, type LucideIcon } from "lucide-react";
import { fullName } from "@fittrack/utils";

import { FitButton } from "@/components/fit";
import { FitModal } from "@/components/modals";
import { useAccountsPage } from "../AccountsPageContext";

import {
  CoachClientSessionReportModalContent,
  CoachClientOverviewModalContent,
  CoachClientScheduleModalContent,
  CoachClientWorkoutModalContent,
} from "./CoachClientActionModalContent";
import { useCoachClientAction } from "./coachClientActionContext";
import {
  COACH_CLIENT_ACTION_LABELS,
  type CoachClientAction,
} from "./coachClientPresentation";
import { CoachClientInspectorPanel } from "./CoachClientInspectorSurface";
import { useCoachClientWorkspace } from "./useCoachClientWorkspace";

const ACTION_META: Record<
  CoachClientAction,
  { icon: LucideIcon; maxWidth: number }
> = {
  feedback: { icon: FileText, maxWidth: 820 },
  overview: { icon: Eye, maxWidth: 720 },
  schedule: { icon: CalendarDays, maxWidth: 860 },
  workout: { icon: Dumbbell, maxWidth: 1_000 },
};

export default function CoachClientModalLayer() {
  const { closeInspector, editTarget, isAccountsHamburgerMode, isCoach, mobileInspectorOpen } =
    useAccountsPage();
  const { action, closeAction } = useCoachClientAction();
  const workspace = useCoachClientWorkspace(editTarget?.id);
  const actionMeta = action ? ACTION_META[action] : null;
  const clientLabel = editTarget
    ? fullName(editTarget) || editTarget.email || "Selected client"
    : "Selected client";

  if (!isCoach) return null;

  return (
    <>
      <FitModal
        containerStyle={{ height: "min(720px, calc(100dvh - 48px))" }}
        contentStyle={{ overflow: "hidden", padding: 0 }}
        footer={null}
        isOpen={Boolean(
          mobileInspectorOpen &&
            isAccountsHamburgerMode &&
            editTarget &&
            !action,
        )}
        noScroll
        onClose={closeInspector}
        title="Client details"
        subtitle={clientLabel}
        maxWidth={448}
      >
        <div
          className="coach-client-inspector coach-client-inspector-modal"
          style={{ height: "100%", minHeight: 0 }}
        >
          <CoachClientInspectorPanel />
        </div>
      </FitModal>

      <FitModal
        containerStyle={{ height: "min(820px, 82vh)" }}
        contentStyle={{ minHeight: 0, minWidth: 0, overflowY: "auto" }}
        footer={
          <FitButton
            label="CLOSE"
            onClick={closeAction}
            style={{ minHeight: 38, minWidth: 96 }}
            variant="ghost"
          />
        }
        isOpen={Boolean(action && editTarget)}
        maxWidth={actionMeta?.maxWidth ?? 720}
        onClose={closeAction}
        title={action ? COACH_CLIENT_ACTION_LABELS[action] : "Coach tool"}
        subtitle={action ? `${clientLabel} - coach workspace` : undefined}
        icon={actionMeta?.icon}
      >
        {action === "overview" ? (
          <CoachClientOverviewModalContent workspace={workspace} />
        ) : action === "schedule" ? (
          <CoachClientScheduleModalContent workspace={workspace} />
        ) : action === "workout" ? (
          <CoachClientWorkoutModalContent workspace={workspace} />
        ) : action === "feedback" ? (
          <CoachClientSessionReportModalContent workspace={workspace} />
        ) : null}
      </FitModal>

      <style>{`
        .coach-client-inspector-modal .member-inspector-panel__body {
          overflow-y: auto;
        }
      `}</style>
    </>
  );
}
