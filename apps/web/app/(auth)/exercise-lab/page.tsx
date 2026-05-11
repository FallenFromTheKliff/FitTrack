"use client";

import { FitSection, FitText } from "@/components/fit";
import { ExerciseLabLibrarySurface } from "@/components/exercise-lab/ExerciseLabLibrarySurface";
import { ExerciseLabMilestoneSurface } from "@/components/exercise-lab/ExerciseLabMilestoneSurface";
import { ExerciseLabModalLayer } from "@/components/exercise-lab/ExerciseLabModalLayer";
import { ExerciseLabMuscleSurface } from "@/components/exercise-lab/ExerciseLabMuscleSurface";
import {
  ExerciseLabPageProvider,
  useExerciseLabPage,
} from "@/components/exercise-lab/ExerciseLabPageContext";
import { ExerciseLabReviewSurface } from "@/components/exercise-lab/ExerciseLabReviewSurface";
import PageLoadingState from "@/components/loading/PageLoadingState";

export const dynamic = "force-dynamic";

export default function ExerciseLabPage() {
  return (
    <ExerciseLabPageProvider>
      <ExerciseLabPageBody />
    </ExerciseLabPageProvider>
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
    isPageLoading,
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
        <PageLoadingState isLoading={isPageLoading} pageName="Exercise Lab" />
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
    <style jsx>{`
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
