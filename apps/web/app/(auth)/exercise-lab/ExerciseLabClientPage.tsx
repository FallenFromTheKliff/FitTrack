"use client";

import { useRouter } from "next/navigation";
import { Activity, Dumbbell, Trophy } from "lucide-react";
import type { CSSProperties } from "react";

import { FitButton, FitSection, FitText } from "@/components/fit";
import { ExerciseLabLibrarySurface } from "@/components/exercise-lab/ExerciseLabLibrarySurface";
import { ExerciseLabMilestoneSurface } from "@/components/exercise-lab/ExerciseLabMilestoneSurface";
import { ExerciseLabModalLayer } from "@/components/exercise-lab/ExerciseLabModalLayer";
import { ExerciseLabMuscleSurface } from "@/components/exercise-lab/ExerciseLabMuscleSurface";
import {
  ExerciseLabPageProvider,
  useExerciseLabPage,
} from "@/components/exercise-lab/ExerciseLabPageContext";
import { ExerciseLabReviewSurface } from "@/components/exercise-lab/ExerciseLabReviewSurface";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useFadeIn } from "@/hooks/animations/useFadeIn";
import { useThemeTransition } from "@/hooks/animations/useThemeTransition";
import FloatingHelpButton from "@/components/help/FloatingHelpButton";

export default function ExerciseLabClientPage() {
  const { user } = useAuth();
  const help = (
    <FloatingHelpButton
      title="Exercise Lab"
      description="This page manages exercise catalog entries, muscle maps, and review queues for movement data."
      terms={[
        { label: "Exercise library", value: "Approved movement records used by workout and coaching features." },
        { label: "Review queue", value: "Submitted or detected movements that need staff review before publishing." },
        { label: "Milestones", value: "Achievement records connected to member progression and ranking." },
      ]}
    />
  );

  if (user?.role === "COACH") {
    return (
      <>
        <CoachExerciseLabPage />
        {help}
      </>
    );
  }

  return (
    <>
      <AdminExerciseLabPage />
      {help}
    </>
  );
}

function AdminExerciseLabPage() {
  return (
    <ExerciseLabPageProvider>
      <ExerciseLabPageBody />
    </ExerciseLabPageProvider>
  );
}

function CoachExerciseLabPage() {
  const router = useRouter();
  const { colors } = useTheme();
  const fadeIn = useFadeIn({ duration: 180 });
  const themeTransition = useThemeTransition();
  const cardStyle: CSSProperties = {
    backgroundColor: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    display: "grid",
    gap: 8,
    minHeight: 132,
    padding: 16,
  };
  const resources = [
    {
      icon: Dumbbell,
      label: "Exercise Library",
      value: "Cues",
      helper: "Movement references for client session planning.",
    },
    {
      icon: Activity,
      label: "Progress Signals",
      value: "Context",
      helper: "Use training history to tune coaching emphasis.",
    },
    {
      icon: Trophy,
      label: "Milestones",
      value: "Review",
      helper: "Connect goals back to sessions without admin tooling.",
    },
  ];

  return (
    <FitSection
      as="section"
      heading=""
      hideHeading
      bare
      noPadding
      className={themeTransition}
      style={fadeIn}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <div
          style={{
            alignItems: "center",
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
            padding: 16,
          }}
        >
          <div>
            <FitText
              style={{
                color: colors.textPrimary,
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              Coach Exercise Lab
            </FitText>
            <FitText
              as="p"
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Training references for safer client sessions.
            </FitText>
          </div>
          <FitButton
            variant="primary"
            label="OPEN SESSIONS"
            onClick={() => router.push("/schedule")}
          />
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          {resources.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} style={cardStyle}>
                <Icon size={18} color={colors.brand} />
                <FitText
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    fontWeight: 850,
                  }}
                >
                  {item.label}
                </FitText>
                <FitText
                  style={{
                    color: colors.textPrimary,
                    fontSize: 24,
                    fontWeight: 900,
                  }}
                >
                  {item.value}
                </FitText>
                <FitText
                  as="p"
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12.5,
                    lineHeight: 1.5,
                  }}
                >
                  {item.helper}
                </FitText>
              </div>
            );
          })}
        </div>

        <div
          style={{
            ...cardStyle,
            alignItems: "center",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            minHeight: 0,
          }}
        >
          <div>
            <FitText
              style={{
                color: colors.textPrimary,
                fontSize: 16,
                fontWeight: 850,
              }}
            >
              Client planning
            </FitText>
            <FitText
              as="p"
              style={{
                color: colors.textSecondary,
                fontSize: 13,
                marginTop: 4,
              }}
            >
              Review the matching client records before adjusting the next
              program.
            </FitText>
          </div>
          <FitButton
            variant="ghost"
            label="OPEN CLIENTS"
            onClick={() => router.push("/accounts")}
          />
        </div>
      </div>
    </FitSection>
  );
}

function ExerciseLabPageBody() {
  const {
    canAnimate,
    closedMilestoneCount,
    colors,
    fadeIn,
    feedbackMessage,
    filteredMilestones,
    fullMotion,
    handleMilestoneDecision,
    handleMilestoneScopeChange,
    handleOpenClosedMilestones,
    isCompact,
    milestoneDecisionPending,
    milestoneNotes,
    milestoneScope,
    milestoneWorkbenchMotionKey,
    mode,
    pendingMilestoneCount,
    reviewViewportHeight,
    selectedMilestone,
    setMilestoneNotes,
    setSelectedMilestoneId,
    themeTransition,
  } = useExerciseLabPage();

  return (
    <FitSection
      as="section"
      heading=""
      hideHeading
      bare
      noPadding
      className={themeTransition}
      style={{
        ...fadeIn,
        height: isCompact ? "auto" : "calc(100vh - 154px)",
        marginBottom: 0,
        minHeight: 0,
        overflow: isCompact ? "visible" : "hidden",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 14,
          height: isCompact ? "auto" : "100%",
          minHeight: 0,
          overflow: isCompact ? "visible" : "hidden",
          position: "relative",
        }}
      >
        {feedbackMessage ? (
          <div
            role="status"
            style={{
              border: `1px solid ${colors.brand}45`,
              borderRadius: 8,
              backgroundColor: `${colors.brand}12`,
              padding: "8px 10px",
            }}
          >
            <FitText
              style={{
                color: colors.textPrimary,
                fontSize: 12.5,
                fontWeight: 800,
              }}
            >
              {feedbackMessage}
            </FitText>
          </div>
        ) : null}

        {mode === "review" ? (
          <ExerciseLabReviewSurface />
        ) : mode === "milestones" ? (
          <ExerciseLabMilestoneSurface
            canAnimate={canAnimate}
            closedMilestoneCount={closedMilestoneCount}
            colors={colors}
            filteredMilestones={filteredMilestones}
            fullMotion={fullMotion}
            isCompact={isCompact}
            milestoneNotes={milestoneNotes}
            milestoneDecisionPending={milestoneDecisionPending}
            milestoneScope={milestoneScope}
            milestoneWorkbenchMotionKey={milestoneWorkbenchMotionKey}
            onDecision={handleMilestoneDecision}
            onNotesChange={setMilestoneNotes}
            onOpenClosedMilestones={handleOpenClosedMilestones}
            onScopeChange={handleMilestoneScopeChange}
            onSelectMilestone={setSelectedMilestoneId}
            pendingMilestoneCount={pendingMilestoneCount}
            reviewViewportHeight={reviewViewportHeight}
            selectedMilestone={selectedMilestone}
          />
        ) : mode === "muscles" ? (
          <ExerciseLabMuscleSurface />
        ) : (
          <ExerciseLabLibrarySurface />
        )}
      </div>

      <ExerciseLabModalLayer />
      <ExerciseLabPageStyles />
    </FitSection>
  );
}

function ExerciseLabPageStyles() {
  const { fullMotion } = useExerciseLabPage();

  return (
    <style>{`
      .exercise-lab-queue-card,
      .exercise-lab-drawer-option,
      .exercise-lab-action-dock {
        transition:
          border-color 160ms ease,
          background-color 160ms ease;
      }

      .exercise-lab-queue-card--animated {
        animation: exercise-lab-queue-in ${fullMotion ? 260 : 180}ms
          cubic-bezier(0.18, 0.88, 0.24, 1) both;
      }

      .exercise-lab-workbench-body--animated {
        animation: exercise-lab-workbench-in ${fullMotion ? 240 : 160}ms
          cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      .exercise-lab-action-dock--animated {
        animation: exercise-lab-dock-in ${fullMotion ? 240 : 180}ms
          cubic-bezier(0.2, 0.8, 0.2, 1) ${fullMotion ? 80 : 40}ms both;
      }

      .exercise-lab-drawer-option--animated {
        animation: exercise-lab-drawer-option-in ${fullMotion ? 220 : 160}ms
          cubic-bezier(0.2, 0.8, 0.2, 1) both;
      }

      @keyframes exercise-lab-queue-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes exercise-lab-workbench-in {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes exercise-lab-dock-in {
        from {
          opacity: 0;
          transform: translateY(12px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes exercise-lab-drawer-option-in {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .exercise-lab-queue-card,
        .exercise-lab-drawer-option,
        .exercise-lab-action-dock,
        .exercise-lab-queue-card--animated,
        .exercise-lab-workbench-body--animated,
        .exercise-lab-action-dock--animated,
        .exercise-lab-drawer-option--animated {
          animation: none !important;
          transition: none !important;
          transform: none !important;
        }
      }
    `}</style>
  );
}
