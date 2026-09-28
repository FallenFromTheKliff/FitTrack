"use client";

import { useEffect, useState } from "react";

import { FitModal } from "@/components/modals";

import { ExerciseLabWorkbench } from "./ExerciseLabWorkbench";
import { useExerciseLabPage } from "./ExerciseLabPageContext";

const AUTHORING_MODAL_WIDTH = 1152;

/**
 * The exercise catalog stays mounted while authoring is open. FitModal owns
 * the portal, focus trap, interaction lock, Escape handling, and backdrop
 * dismissal; this component only supplies the current Figma content host.
 */
export function ExerciseLabAuthoringModal() {
  const { colors, handleCloseSheet, sheetState } = useExerciseLabPage();
  const [managingMuscles, setManagingMuscles] = useState(false);
  const isOpen = Boolean(sheetState);

  useEffect(() => {
    if (!sheetState) setManagingMuscles(false);
  }, [sheetState]);

  const handleClose = () => {
    if (managingMuscles) {
      setManagingMuscles(false);
      return;
    }

    handleCloseSheet();
  };

  return (
    <FitModal
      closeAriaLabel="Close exercise authoring"
      closeButtonStyle={{ display: "none" }}
      containerStyle={{
        backgroundColor: colors.base,
        border: `1px solid ${colors.border}`,
        boxSizing: "border-box",
        flexShrink: 0,
        maxHeight: "none",
        maxWidth: `min(${AUTHORING_MODAL_WIDTH}px, calc(100vw - 48px))`,
        marginBlock: "auto",
        minHeight: 0,
        overflow: "hidden",
        padding: 24,
        width: `min(${AUTHORING_MODAL_WIDTH}px, calc(100vw - 48px))`,
      }}
      contentStyle={{
        boxSizing: "border-box",
        flex: "0 0 auto",
        maxHeight: "none",
        minHeight: 0,
        overflow: "visible",
        padding: 0,
      }}
      headerStyle={{
        border: 0,
        clipPath: "inset(50%)",
        height: 1,
        margin: -1,
        overflow: "hidden",
        padding: 0,
        position: "absolute",
        width: 1,
      }}
      hideHeaderIcon
      hideHeaderDivider
      isOpen={isOpen}
      maxWidth={AUTHORING_MODAL_WIDTH}
      noScroll
      onClose={handleClose}
      overlayStyle={{
        alignItems: "flex-start",
        backdropFilter: "blur(6px)",
        backgroundColor: "rgba(0, 0, 0, 0.68)",
        justifyContent: "center",
        overflow: "auto",
        padding: 24,
        WebkitBackdropFilter: "blur(6px)",
      }}
      title="Exercise Lab authoring"
    >
      {sheetState ? (
        <div
          className="exercise-lab-authoring-modal"
          data-testid="exercise-lab-authoring-modal"
          style={{ minHeight: 0, minWidth: 0, width: "100%" }}
        >
          <ExerciseLabWorkbench
            managingMuscles={managingMuscles}
            onManagingMusclesChange={setManagingMuscles}
          />
          <style>{`
            /* FitModal's compact defaults assume a visible header/footer.
               This content-only host keeps its own body as the scroll owner. */
            [data-fit-modal-container="true"]:has(.exercise-lab-authoring-modal) {
              gap: 0;
            }

            [data-fit-modal-container="true"]:has(.exercise-lab-authoring-modal) > [data-fit-modal-content="true"] {
              box-sizing: border-box;
              flex: 0 0 auto !important;
              max-height: none !important;
              min-height: 0 !important;
              overflow: visible !important;
              padding: 0 !important;
            }

            [data-fit-modal-container="true"]:has(.exercise-lab-authoring-modal) .exercise-lab-workbench-shell {
              max-width: none !important;
              min-width: 0 !important;
            }

            @media (max-width: 640px) {
              [data-fit-modal-overlay="true"]:has(.exercise-lab-authoring-modal) {
                align-items: center !important;
              }

              [data-fit-modal-container="true"]:has(.exercise-lab-authoring-modal) {
                border-radius: 16px !important;
                max-height: none !important;
                padding: 20px !important;
                width: min(100%, calc(100vw - 32px)) !important;
              }

              [data-fit-modal-overlay="true"]:has(.exercise-lab-authoring-modal) {
                padding: 16px !important;
              }

              [data-fit-modal-container="true"]:has(.exercise-lab-authoring-modal) > [data-fit-modal-content="true"] {
                max-height: none !important;
                padding: 0 !important;
              }
            }
          `}</style>
        </div>
      ) : null}
    </FitModal>
  );
}
