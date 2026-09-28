"use client";

import { ConfirmModal, FitModal } from "@/components/modals";
import { FitButton } from "@/components/fit";

import { useExerciseLabPage } from "./ExerciseLabPageContext";

/**
 * Exercise creation/editing now owns a page-level workbench. This layer keeps
 * destructive and shared-contract confirmations above whichever surface is
 * currently active, including the Muscle Library overlay flow.
 */
export function ExerciseLabModalLayer() {
  const {
    colors,
    actionResult,
    dismissActionResult,
    confirmationIcon,
    confirmationLabel,
    confirmationLoading,
    confirmationLoadingLabel,
    confirmationMessage,
    confirmationState,
    confirmationTitle,
    handleConfirmAction,
    setConfirmationState,
  } = useExerciseLabPage();

  return (
    <>
    <ConfirmModal
      isOpen={confirmationState !== null}
      title={confirmationTitle}
      message={confirmationMessage}
      confirmLabel={confirmationLabel}
      loadingLabel={confirmationLoadingLabel}
      confirmIcon={confirmationIcon}
      isDanger={
        confirmationState?.mode === "archive"
          ? !confirmationState.nextActive
          : confirmationState?.mode === "shared-family"
            ? false
            : true
      }
      isLoading={confirmationLoading}
      onConfirm={handleConfirmAction}
      onCancel={() => setConfirmationState(null)}
    >
      {confirmationState?.mode === "shared-family" ? (
        <ul
          aria-label="Affected inheriting exercises"
          style={{
            color: colors.textSecondary,
            display: "grid",
            gap: 6,
            margin: "8px 0 0",
            maxHeight: 180,
            overflowY: "auto",
            paddingLeft: 22,
          }}
        >
          {(confirmationState.affectedNames.length
            ? confirmationState.affectedNames
            : ["No active inheritors"]
          ).map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : null}
    </ConfirmModal>
    <FitModal
      isOpen={actionResult !== null}
      onClose={dismissActionResult}
      title={actionResult?.tone === "error" ? "Unable to complete action" : "Changes saved"}
      maxWidth={460}
      footer={<FitButton onClick={dismissActionResult}>OK</FitButton>}
    >
      <p role={actionResult?.tone === "error" ? "alert" : "status"} style={{ margin: 0, color: colors.textPrimary }}>
        {actionResult?.message}
      </p>
    </FitModal>
    </>
  );
}
