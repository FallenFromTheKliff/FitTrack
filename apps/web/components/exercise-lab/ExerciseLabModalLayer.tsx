"use client";

import {
  Archive,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  PanelRightOpen,
  Plus,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import type {
  FitnessCreatorState,
  FitnessExerciseCategory,
} from "@fittrack/api-client";
import {
  getPrimaryExerciseMuscleGroup,
  normalizeExerciseMuscleTargets,
} from "@fittrack/utils";
import {
  FitButton,
  FitSelect,
  FitText,
  FitTextArea,
  FitTextInput,
} from "@/components/fit";
import { ConfirmModal, FitModal } from "@/components/modals";
import { EXERCISE_CATEGORY_OPTIONS } from "@/components/exercise-lab/exercise-lab-data";
import { ExerciseLabDrawer, ExerciseLabField } from "@/components/exercise-lab/ExerciseLabShell";
import { MovementProfileEditor } from "@/components/exercise-lab/ExerciseContractEditors";
import { MuscleTargetsEditor } from "@/components/exercise-lab/MuscleTargetsEditor";
import { HandShapeProfileEditor } from "@/components/exercise-lab/HandShapeProfileEditor";
import {
  CREATOR_STATE_OPTIONS,
  formatDateTime,
  getEvidenceBars,
  getEvidenceSummary,
  getReviewStatusColor,
  toTitleCase,
} from "@/components/exercise-lab/exerciseLabShared";
import type { ExerciseEditorTab } from "@/components/exercise-lab/ExerciseContractEditorShared";

import { useExerciseLabPage } from "./ExerciseLabPageContext";

const EXERCISE_EDITOR_STEPS: Array<{
  description: string;
  label: string;
  tab: ExerciseEditorTab;
}> = [
  {
    label: "Details",
    description: "Name, category, and coaching guidance",
    tab: "basics",
  },
  {
    label: "Training map",
    description: "Primary and supporting muscles",
    tab: "muscles",
  },
  {
    label: "Tracking setup",
    description: "Optional movement and hand tracking",
    tab: "movement",
  },
  {
    label: "Media & review",
    description: "References and final validation",
    tab: "media",
  },
];

export function ExerciseLabModalLayer() {
  const {
    activeEditorTab,
    activeMuscleDefinitions,
    applyMatchReference,
    canAnimate,
    closestMatch,
    colors,
    completedDefinitionItems,
    confirmationIcon,
    confirmationLabel,
    confirmationLoading,
    confirmationLoadingLabel,
    confirmationMessage,
    confirmationState,
    confirmationTitle,
    creatorGovernanceNote,
    creatorStateDraft,
    definitionChecklist,
    draft,
    draftValidationError,
    editorColors,
    filteredMatches,
    formError,
    fullMotion,
    handleCloseSheet,
    handleConfirmAction,
    handleCreatorGovernanceUpdate,
    handleModeChange,
    handleOpenPublish,
    handleReject,
    handleSheetSubmit,
    isCompact,
    matchDrawerOpen,
    matchSearch,
    matchSuggestions,
    mode,
    publishCandidate,
    rejectRationale,
    rejectTarget,
    rejectValidationError,
    reviewModalCandidate,
    selectedCandidate,
    selectedCreatorToneColor,
    setActiveEditorTab,
    setConfirmationState,
    setCreatorGovernanceNote,
    setCreatorStateDraft,
    setDraft,
    setDraftField,
    setFormError,
    setMatchDrawerOpen,
    setMatchSearch,
    setRejectRationale,
    setRejectTarget,
    setRejectValidationError,
    setReviewModalCandidate,
    sheetPending,
    sheetState,
    updateReviewSubmissionMutation,
    workbenchMotionKey,
  } = useExerciseLabPage();
  const selectedCandidateEvidenceBars = selectedCandidate
    ? getEvidenceBars(selectedCandidate.evidenceBars)
    : [];
  const activeEditorStep =
    activeEditorTab === "basics"
      ? 0
      : activeEditorTab === "muscles"
        ? 1
        : activeEditorTab === "movement" || activeEditorTab === "hands"
          ? 2
          : 3;
  const editorStep = EXERCISE_EDITOR_STEPS[activeEditorStep];
  const goToEditorStep = (step: number) => {
    const target = EXERCISE_EDITOR_STEPS[step];
    if (target) setActiveEditorTab(target.tab);
  };

  return (
    <>
      <FitModal
        isOpen={reviewModalCandidate !== null}
        onClose={() => setReviewModalCandidate(null)}
        title="Exercise review"
        subtitle="Review the submitted exercise details and confirm the best canonical match."
        icon={PanelRightOpen}
        maxWidth={980}
        containerStyle={{
          borderRadius: 8,
          height: "min(760px, calc(100dvh - 40px))",
          maxHeight: "calc(100dvh - 40px)",
        }}
        headerStyle={{ padding: "14px 18px" }}
        contentStyle={{ maxHeight: "none", minHeight: 0, padding: "14px 18px" }}
        footerStyle={{ padding: "12px 18px" }}
        footer={
          selectedCandidate ? (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                width: "100%",
              }}
            >
              <FitButton
                label="Reject"
                variant="danger"
                disabled={selectedCandidate.status !== "pending" || sheetPending}
                onClick={() => {
                  setRejectRationale("");
                  setRejectValidationError(null);
                  setRejectTarget(selectedCandidate);
                }}
              />
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <FitButton
                  label="Keep private"
                  variant="ghost"
                  disabled={selectedCandidate.status !== "pending" || sheetPending}
                  onClick={() =>
                    setConfirmationState({
                      candidate: selectedCandidate,
                      mode: "leave-private",
                    })
                  }
                />
                <FitButton
                  label="Choose another match"
                  variant="ghost"
                  onClick={() => setMatchDrawerOpen(true)}
                />
                <FitButton
                  label="Approve & publish"
                  variant="primary"
                  disabled={selectedCandidate.status !== "pending" || sheetPending}
                  onClick={() => handleOpenPublish(selectedCandidate)}
                />
              </div>
            </div>
          ) : undefined
        }
      >
        {selectedCandidate ? (
          <div
            key={workbenchMotionKey}
            className={
              canAnimate
                ? "exercise-lab-workbench-body exercise-lab-workbench-body--animated"
                : "exercise-lab-workbench-body"
            }
            style={{ display: "grid", gap: 14 }}
          >
            <div
              aria-label="Review progress"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {["Submission", "Evidence", "Match", "Decision"].map(
                (label, index) => (
                  <div
                    key={label}
                    style={{
                      alignItems: "center",
                      backgroundColor:
                        index === 3 ? `${colors.brand}12` : colors.surfaceRaised,
                      borderRight:
                        index < 3 ? `1px solid ${colors.border}` : undefined,
                      display: "flex",
                      gap: 8,
                      minHeight: 42,
                      padding: "9px 12px",
                    }}
                  >
                    <span
                      style={{
                        alignItems: "center",
                        backgroundColor: index < 3 ? colors.success : colors.brand,
                        borderRadius: 5,
                        color: "#111",
                        display: "inline-flex",
                        fontSize: 10,
                        fontWeight: 900,
                        height: 20,
                        justifyContent: "center",
                        width: 20,
                      }}
                    >
                      {index < 3 ? <CheckCircle2 size={12} /> : index + 1}
                    </span>
                    <FitText style={{ fontSize: 12, fontWeight: 850 }}>
                      {label}
                    </FitText>
                  </div>
                ),
              )}
            </div>

            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: isCompact
                  ? "minmax(0, 1fr)"
                  : "minmax(0, 3fr) minmax(300px, 2fr)",
                minHeight: 0,
              }}
            >
              <div
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  backgroundColor: colors.surface,
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    alignItems: "flex-start",
                    borderBottom: `1px solid ${colors.border}`,
                    display: "flex",
                    gap: 12,
                    justifyContent: "space-between",
                    padding: 14,
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ fontSize: 18, fontWeight: 900 }}>
                      {selectedCandidate.title}
                    </FitText>
                    <FitText style={{ color: colors.textSecondary, fontSize: 12.5 }}>
                      {selectedCandidate.summary}
                    </FitText>
                  </div>
                  <span
                    style={{
                      border: `1px solid ${getReviewStatusColor(selectedCandidate.status, colors)}75`,
                      borderRadius: 5,
                      color: getReviewStatusColor(selectedCandidate.status, colors),
                      fontSize: 10.5,
                      fontWeight: 900,
                      padding: "5px 8px",
                      textTransform: "uppercase",
                    }}
                  >
                    {toTitleCase(selectedCandidate.status)}
                  </span>
                </div>

                <div style={{ display: "grid", gap: 14, padding: 14 }}>
                  <div style={{ display: "grid", gap: 5 }}>
                    <FitText style={{ color: colors.textMuted, fontSize: 10.5, fontWeight: 850, textTransform: "uppercase" }}>
                      Proposed canonical name
                    </FitText>
                    <FitText style={{ fontSize: 16, fontWeight: 900 }}>
                      {selectedCandidate.proposedName}
                    </FitText>
                  </div>

                  <div
                    style={{
                      backgroundColor: colors.surfaceRaised,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 7,
                      padding: 12,
                    }}
                  >
                    <div style={{ alignItems: "end", display: "flex", gap: 6, height: 46 }}>
                      {selectedCandidateEvidenceBars.length ? (
                        selectedCandidateEvidenceBars.map((value, index) => (
                          <div
                            key={`${value}-${index}`}
                            style={{
                              backgroundColor: index === 2 ? colors.brand : `${colors.brand}42`,
                              borderRadius: 3,
                              height: Math.max(10, Math.min(42, value)),
                              width: 14,
                            }}
                          />
                        ))
                      ) : (
                        <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                          No numeric evidence submitted.
                        </FitText>
                      )}
                    </div>
                    <FitText style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
                      {getEvidenceSummary(selectedCandidate.evidenceBars)}
                    </FitText>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 10,
                      gridTemplateColumns: isCompact
                        ? "minmax(0, 1fr)"
                        : "repeat(3, minmax(0, 1fr))",
                    }}
                  >
                    {[
                      ["Source", selectedCandidate.originLabel],
                      ["Trigger", selectedCandidate.triggerLabel],
                      ["Muscle", toTitleCase(selectedCandidate.muscleGroup)],
                    ].map(([label, value]) => (
                      <div key={label} style={{ borderLeft: `2px solid ${colors.border}`, display: "grid", gap: 3, paddingLeft: 10 }}>
                        <FitText style={{ color: colors.textMuted, display: "block", fontSize: 10, fontWeight: 850, textTransform: "uppercase" }}>
                          {label}
                        </FitText>
                        <FitText style={{ color: colors.textSecondary, display: "block", fontSize: 12 }}>
                          {value}
                        </FitText>
                      </div>
                    ))}
                  </div>

                  <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
                    <FitText style={{ color: colors.textSecondary, fontSize: 12.5, lineHeight: 1.55 }}>
                      {selectedCandidate.description ?? "No longer-form description submitted."}
                    </FitText>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gap: 12, alignContent: "start", minWidth: 0 }}>
                <div
                  style={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    display: "grid",
                    gap: 10,
                    padding: 14,
                  }}
                >
                  <FitText style={{ fontSize: 15, fontWeight: 900 }}>Closest matches</FitText>
                  {matchSuggestions.length ? (
                    matchSuggestions.slice(0, 4).map(({ exercise, score }, index) => (
                      <button
                        key={exercise.id}
                        type="button"
                        onClick={() => applyMatchReference(exercise)}
                        style={{
                          alignItems: "center",
                          backgroundColor: index === 0 ? `${colors.brand}0f` : colors.surfaceRaised,
                          border: `1px solid ${index === 0 ? `${colors.brand}55` : colors.border}`,
                          borderRadius: 6,
                          color: colors.textPrimary,
                          cursor: "pointer",
                          display: "flex",
                          gap: 10,
                          justifyContent: "space-between",
                          padding: "9px 10px",
                          textAlign: "left",
                        }}
                      >
                        <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 850, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {exercise.name}
                          </span>
                          <span style={{ color: colors.textMuted, fontSize: 10.5 }}>
                            {toTitleCase(exercise.category)} / {toTitleCase(exercise.muscleGroup)}
                          </span>
                        </span>
                        <span style={{ color: index === 0 ? colors.brand : colors.textSecondary, fontSize: 11, fontWeight: 850, whiteSpace: "nowrap" }}>
                          {Math.max(58, Math.min(96, score))}% fit
                        </span>
                      </button>
                    ))
                  ) : (
                    <FitText style={{ color: colors.textSecondary, fontSize: 12.5 }}>
                      No close global exercise surfaced.
                    </FitText>
                  )}
                  <FitButton
                    label="Search all matches"
                    variant="ghost"
                    onClick={() => setMatchDrawerOpen(true)}
                    style={{ borderRadius: 6, justifySelf: "start", minHeight: 34 }}
                  />
                </div>

                <div
                  style={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    display: "grid",
                    gap: 9,
                    padding: 14,
                  }}
                >
                  <FitText style={{ fontSize: 15, fontWeight: 900 }}>Verification checklist</FitText>
                  {[
                    [Boolean(selectedCandidate.title && selectedCandidate.proposedName), "Submission identity is complete"],
                    [selectedCandidateEvidenceBars.length > 0, "Evidence was captured"],
                    [Boolean(closestMatch), "Canonical match was compared"],
                    [Boolean(selectedCandidate.originLabel), "Submission provenance is visible"],
                  ].map(([complete, label]) => (
                    <div key={String(label)} style={{ alignItems: "center", display: "flex", gap: 8 }}>
                      {complete ? (
                        <CheckCircle2 size={14} color={colors.success} />
                      ) : (
                        <X size={14} color={colors.textMuted} />
                      )}
                      <FitText style={{ color: complete ? colors.textSecondary : colors.textMuted, fontSize: 11.5 }}>
                        {String(label)}
                      </FitText>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <details
              style={{
                background: `linear-gradient(135deg, ${selectedCreatorToneColor}0b 0%, ${colors.surface} 72%)`,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                padding: "10px 12px",
              }}
            >
              <summary style={{ alignItems: "center", cursor: "pointer", display: "flex", gap: 10, justifyContent: "space-between", listStyle: "none" }}>
                <span style={{ display: "grid", gap: 2 }}>
                  <FitText style={{ fontSize: 12.5, fontWeight: 850 }}>Creator governance</FitText>
                  <FitText style={{ color: colors.textMuted, fontSize: 10.5 }}>
                    {selectedCandidate.creatorDisplayName ?? "Creator member"} / {selectedCandidate.creatorStateLabel}
                  </FitText>
                </span>
                <span style={{ color: selectedCreatorToneColor, fontSize: 11, fontWeight: 850 }}>Review creator standing</span>
              </summary>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: isCompact ? "minmax(0, 1fr)" : "minmax(180px, 0.55fr) minmax(0, 1fr) auto", marginTop: 12 }}>
                <FitSelect
                  name="creatorState"
                  fullWidth
                  value={creatorStateDraft}
                  options={[...CREATOR_STATE_OPTIONS]}
                  onChange={(event) => setCreatorStateDraft(event.target.value as FitnessCreatorState)}
                />
                <FitTextArea
                  name="creatorGovernanceNote"
                  value={creatorGovernanceNote}
                  onChange={(event) => setCreatorGovernanceNote(event.target.value)}
                  placeholder="Rationale for creator standing or escalation note"
                  rows={2}
                />
                <FitButton
                  label="Save creator"
                  variant="ghost"
                  disabled={sheetPending}
                  loading={updateReviewSubmissionMutation.isPending}
                  onClick={handleCreatorGovernanceUpdate}
                  style={{ borderRadius: 6, minHeight: 38 }}
                />
              </div>
              <FitText style={{ color: colors.textMuted, fontSize: 10.5, marginTop: 8 }}>
                Last state change: {formatDateTime(selectedCandidate.creatorLastStateChangedAt ?? undefined)}
              </FitText>
            </details>
          </div>
        ) : null}
      </FitModal>

      <FitModal
        isOpen={sheetState !== null}
        onClose={handleCloseSheet}
        title={
          sheetState?.mode === "publish"
            ? "Publish to global"
            : sheetState?.mode === "edit"
              ? "Edit global exercise"
              : "Create global exercise"
        }
        subtitle={
          `Step ${activeEditorStep + 1} of ${EXERCISE_EDITOR_STEPS.length} · ${editorStep.description}`
        }
        icon={sheetState?.mode === "publish" ? ShieldCheck : Plus}
        maxWidth={1120}
        containerStyle={{
          borderRadius: 8,
          height: "min(760px, calc(100dvh - 40px))",
          maxHeight: "calc(100dvh - 40px)",
        }}
        headerStyle={{ padding: "14px 18px" }}
        contentStyle={{ maxHeight: "none", minHeight: 0, padding: "16px 18px" }}
        footerStyle={{ padding: "12px 18px" }}
        footer={
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <FitButton
                label="Cancel"
                variant="ghost"
                disabled={sheetPending}
                onClick={handleCloseSheet}
              />
              {sheetState?.mode === "publish" ? (
                <FitButton
                  label="Leave private"
                  variant="ghost"
                  onClick={() =>
                    publishCandidate
                      ? setConfirmationState({
                          candidate: publishCandidate,
                          mode: "leave-private",
                        })
                      : undefined
                  }
                />
              ) : null}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {activeEditorStep > 0 ? (
                <FitButton
                  label="Back"
                  variant="ghost"
                  disabled={sheetPending}
                  onClick={() => goToEditorStep(activeEditorStep - 1)}
                />
              ) : null}
              {activeEditorStep < EXERCISE_EDITOR_STEPS.length - 1 ? (
                <FitButton
                  icon={ChevronRight}
                  label="Continue"
                  disabled={sheetPending}
                  onClick={() => goToEditorStep(activeEditorStep + 1)}
                />
              ) : (
                <FitButton
                  disabled={Boolean(draftValidationError) || sheetPending}
                  label={
                    sheetState?.mode === "edit"
                      ? "Save global exercise"
                      : sheetState?.mode === "publish"
                        ? "Publish global"
                        : "Create global exercise"
                  }
                  loading={sheetPending}
                  onClick={() => void handleSheetSubmit()}
                  title={draftValidationError ?? undefined}
                />
              )}
            </div>
          </div>
        }
      >
        <div className="exercise-editor-workbench" style={{ display: "grid", gap: 16 }}>
          {formError ? (
            <div
              style={{
                padding: 14,
                borderRadius: 18,
                border: `1px solid ${colors.danger}45`,
                backgroundColor: `${colors.danger}10`,
              }}
            >
              <FitText style={{ fontSize: 13, color: colors.danger }}>
                {formError}
              </FitText>
            </div>
          ) : null}

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "minmax(0, 1fr)",
            }}
          >
            {sheetState?.mode === "publish" ? (
              <div
                style={{
                  alignItems: isCompact ? "stretch" : "center",
                  backgroundColor: `${colors.brand}08`,
                  border: `1px solid ${colors.brand}30`,
                  borderLeft: `3px solid ${colors.brand}`,
                  borderRadius: 7,
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "minmax(220px, 0.8fr) repeat(3, minmax(0, 1fr))",
                  padding: "11px 13px",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      alignItems: "center",
                      backgroundColor: `${colors.brand}18`,
                      border: `1px solid ${colors.brand}45`,
                      borderRadius: 6,
                      display: "inline-flex",
                      flex: "0 0 auto",
                      height: 32,
                      justifyContent: "center",
                      width: 32,
                    }}
                  >
                    <Dumbbell size={15} color={colors.brand} />
                  </div>
                  <span style={{ display: "grid", gap: 2, minWidth: 0 }}>
                    <FitText
                      style={{
                        color: colors.textMuted,
                        fontSize: 9.5,
                        fontWeight: 900,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      Publish candidate
                    </FitText>
                    <FitText
                      style={{
                        fontSize: 13.5,
                        fontWeight: 900,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {publishCandidate?.proposedName ?? draft.name}
                    </FitText>
                  </span>
                </div>
                {[
                  ["Source", publishCandidate?.sourceLabel ?? "Client custom"],
                  ["Trigger", publishCandidate?.triggerLabel ?? "Manual review"],
                  ["Decision", "Global library or private"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      borderLeft: isCompact
                        ? undefined
                        : `1px solid ${colors.border}`,
                      display: "grid",
                      gap: 2,
                      minWidth: 0,
                      paddingLeft: isCompact ? 0 : 12,
                    }}
                  >
                    <FitText
                      style={{
                        color: colors.textMuted,
                        fontSize: 9.5,
                        fontWeight: 850,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                      }}
                    >
                      {label}
                    </FitText>
                    <FitText
                      style={{
                        color: colors.textSecondary,
                        fontSize: 11.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {value}
                    </FitText>
                  </div>
                ))}
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gap: 16,
                padding: 14,
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 0,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "repeat(4, minmax(0, 1fr))",
                  borderRadius: 8,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceRaised,
                  overflow: "hidden",
                }}
              >
                {EXERCISE_EDITOR_STEPS.map((step, index) => {
                  const isActive = index === activeEditorStep;
                  const isComplete = index < activeEditorStep;

                  return (
                    <button
                      key={step.label}
                      type="button"
                      aria-current={isActive ? "step" : undefined}
                      onClick={() => goToEditorStep(index)}
                      style={{
                        alignItems: "flex-start",
                        backgroundColor: isActive
                          ? `${colors.brand}14`
                          : "transparent",
                        border: 0,
                        borderBottom: isActive
                          ? `2px solid ${colors.brand}`
                          : "2px solid transparent",
                        borderRight:
                          !isCompact && index < EXERCISE_EDITOR_STEPS.length - 1
                            ? `1px solid ${colors.border}`
                            : 0,
                        color: colors.textPrimary,
                        cursor: "pointer",
                        display: "grid",
                        gap: 5,
                        minHeight: 66,
                        padding: "10px 12px",
                        textAlign: "left",
                      }}
                    >
                      <span
                        style={{
                          alignItems: "center",
                          display: "flex",
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            alignItems: "center",
                            backgroundColor:
                              isActive || isComplete
                                ? colors.brand
                                : colors.surface,
                            border: `1px solid ${
                              isActive || isComplete
                                ? colors.brand
                                : colors.border
                            }`,
                            borderRadius: 6,
                            color:
                              isActive || isComplete
                                ? colors.textPrimary
                                : colors.textSecondary,
                            display: "inline-flex",
                            fontSize: 11,
                            fontWeight: 900,
                            height: 22,
                            justifyContent: "center",
                            width: 22,
                          }}
                        >
                          {isComplete ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 850 }}>
                          {step.label}
                        </span>
                      </span>
                      <span
                        style={{
                          color: colors.textSecondary,
                          fontSize: 11.5,
                          lineHeight: 1.35,
                        }}
                      >
                        {step.description}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  alignItems: "flex-start",
                  display: "flex",
                  gap: 12,
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <FitText style={{ fontSize: 17, fontWeight: 900 }}>
                    {editorStep.label}
                  </FitText>
                  <FitText
                    style={{
                      color: colors.textSecondary,
                      fontSize: 12.5,
                    }}
                  >
                    {editorStep.description}
                  </FitText>
                </div>
                <div
                  style={{
                    border: `1px solid ${colors.brand}45`,
                    backgroundColor: `${colors.brand}10`,
                    borderRadius: 7,
                    padding: "6px 9px",
                  }}
                >
                  <FitText
                    style={{
                      color: colors.brand,
                      fontSize: 11.5,
                      fontWeight: 850,
                    }}
                  >
                    {completedDefinitionItems}/{definitionChecklist.length} requirements ready
                  </FitText>
                </div>
              </div>

              {activeEditorTab === "basics" ? (
                <>
              <div
                style={{
                  display: "grid",
                  gap: 14,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "repeat(2, minmax(0, 1fr))",
                }}
              >
              <ExerciseLabField
                label="Exercise name"
                hint="Use the name users will recognize in plans and workout sessions."
              >
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.fieldBg,
                    padding: "12px 14px",
                  }}
                >
                  <FitTextInput
                    name="exerciseName"
                    value={draft.name}
                    onChange={(event) =>
                      setDraftField("name", event.target.value)
                    }
                    placeholder="Exercise name"
                  />
                </div>
              </ExerciseLabField>

              <ExerciseLabField
                label="Category"
                hint="Feeds search, filters, and mobile exercise context."
              >
                <FitSelect
                  fullWidth
                  value={draft.category}
                  onChange={(event) =>
                    setDraftField(
                      "category",
                      event.target.value as FitnessExerciseCategory,
                    )
                  }
                  options={EXERCISE_CATEGORY_OPTIONS.map((option) => ({
                    label: option.label,
                    value: option.value,
                  }))}
                />
              </ExerciseLabField>

              <ExerciseLabField
                label="Instruction summary"
                hint="Required. Write the movement cue future users and AI prompts can rely on."
              >
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.fieldBg,
                    padding: "12px 14px",
                  }}
                >
                  <FitTextArea
                    name="exerciseInstructions"
                    rows={4}
                    style={{
                      display: "block",
                      minHeight: 132,
                      resize: "vertical",
                      width: "100%",
                    }}
                    value={draft.instructions ?? ""}
                    onChange={(event) =>
                      setDraftField("instructions", event.target.value)
                    }
                    placeholder="Describe how the movement should be performed."
                  />
                </div>
              </ExerciseLabField>

              <ExerciseLabField
                label="Description"
                hint="Optional short context for admins and exercise references."
              >
                <div
                  style={{
                    borderRadius: 14,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.fieldBg,
                    padding: "12px 14px",
                  }}
                >
                  <FitTextArea
                    name="exerciseDescription"
                    rows={3}
                    style={{
                      display: "block",
                      minHeight: 110,
                      resize: "vertical",
                      width: "100%",
                    }}
                    value={draft.description ?? ""}
                    onChange={(event) =>
                      setDraftField("description", event.target.value)
                    }
                    placeholder="Short exercise description."
                  />
                </div>
              </ExerciseLabField>
              </div>
                </>
              ) : null}

              {activeEditorTab === "muscles" ? (
                <MuscleTargetsEditor
                  colors={editorColors}
                  fallbackMuscleGroup={draft.muscleGroup}
                  muscleDefinitions={activeMuscleDefinitions}
                  onManageMuscles={() => handleModeChange("muscles")}
                  onChange={(nextTargets) => {
                    const normalizedTargets = normalizeExerciseMuscleTargets(
                      nextTargets,
                      draft.muscleGroup,
                    );
                    setDraft((current) => ({
                      ...current,
                      muscleGroup: getPrimaryExerciseMuscleGroup(
                        normalizedTargets,
                        current.muscleGroup,
                      ),
                      muscleTargets: normalizedTargets,
                    }));
                    if (formError) setFormError(null);
                  }}
                  value={draft.muscleTargets}
                />
              ) : null}

              {activeEditorTab === "movement" ||
              activeEditorTab === "hands" ? (
                <div style={{ display: "grid", gap: 14 }}>
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                      paddingBottom: 12,
                      borderBottom: `1px solid ${colors.border}`,
                    }}
                  >
                    <FitButton
                      active={activeEditorTab === "movement"}
                      label="Movement rig"
                      variant={
                        activeEditorTab === "movement" ? "primary" : "ghost"
                      }
                      onClick={() => setActiveEditorTab("movement")}
                      style={{ minHeight: 34, borderRadius: 7 }}
                    />
                    <FitButton
                      active={activeEditorTab === "hands"}
                      label="Hand shapes"
                      variant={activeEditorTab === "hands" ? "primary" : "ghost"}
                      onClick={() => setActiveEditorTab("hands")}
                      style={{ minHeight: 34, borderRadius: 7 }}
                    />
                    <FitText
                      style={{
                        color: colors.textSecondary,
                        fontSize: 11.5,
                        marginLeft: isCompact ? 0 : "auto",
                      }}
                    >
                      Optional advanced setup for camera-assisted tracking.
                    </FitText>
                  </div>

                  {activeEditorTab === "movement" ? (
                    <MovementProfileEditor
                      colors={editorColors}
                      exerciseName={draft.name}
                      onChange={(nextProfile) =>
                        setDraftField("movementProfile", nextProfile)
                      }
                      value={draft.movementProfile}
                    />
                  ) : (
                    <HandShapeProfileEditor
                      colors={editorColors}
                      onChange={(nextProfile) =>
                        setDraftField("handShapeProfile", nextProfile)
                      }
                      value={draft.handShapeProfile}
                    />
                  )}
                </div>
              ) : null}

              {activeEditorTab === "media" ? (
                <div
                style={{
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "repeat(2, minmax(0, 1fr))",
                }}
              >
                <ExerciseLabField
                  label="Image URL"
                  hint="Optional visual reference. Must be http(s) if supplied."
                >
                  <div
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.fieldBg,
                      padding: "12px 14px",
                    }}
                  >
                    <FitTextInput
                      name="exerciseImageUrl"
                      value={draft.imageUrl ?? ""}
                      onChange={(event) =>
                        setDraftField("imageUrl", event.target.value)
                      }
                      placeholder="https://..."
                    />
                  </div>
                </ExerciseLabField>

                <ExerciseLabField
                  label="Video URL"
                  hint="Optional demo clip or coaching reference. Must be http(s) if supplied."
                >
                  <div
                    style={{
                      borderRadius: 14,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.fieldBg,
                      padding: "12px 14px",
                    }}
                  >
                    <FitTextInput
                      name="exerciseVideoUrl"
                      value={draft.videoUrl ?? ""}
                      onChange={(event) =>
                        setDraftField("videoUrl", event.target.value)
                      }
                      placeholder="https://..."
                    />
                  </div>
                </ExerciseLabField>
                </div>
              ) : null}

              {activeEditorTab === "media" ? (
                <div
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 14,
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surfaceRaised,
                  }}
                >
                  <div
                    style={{
                      alignItems: "center",
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <FitText style={{ fontSize: 13.5, fontWeight: 900 }}>
                      Definition review
                    </FitText>
                    <FitText
                      style={{
                        color:
                          completedDefinitionItems === definitionChecklist.length
                            ? colors.success
                            : colors.brand,
                        fontSize: 12,
                        fontWeight: 850,
                      }}
                    >
                      {completedDefinitionItems}/{definitionChecklist.length} ready
                    </FitText>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gap: 8,
                      gridTemplateColumns: isCompact
                        ? "minmax(0, 1fr)"
                        : "repeat(2, minmax(0, 1fr))",
                    }}
                  >
                    {definitionChecklist.map((item) => (
                      <div
                        key={item.label}
                        style={{
                          alignItems: "center",
                          display: "flex",
                          gap: 8,
                          minWidth: 0,
                        }}
                      >
                        {item.complete ? (
                          <CheckCircle2 size={14} color={colors.success} />
                        ) : (
                          <X size={14} color={colors.textMuted} />
                        )}
                        <FitText
                          style={{
                            color: item.complete
                              ? colors.textSecondary
                              : colors.textMuted,
                            fontSize: 12,
                            lineHeight: 1.4,
                          }}
                        >
                          {item.label}
                        </FitText>
                      </div>
                    ))}
                  </div>
                  {draftValidationError ? (
                    <FitText
                      style={{
                        color: colors.brand,
                        fontSize: 11.5,
                        lineHeight: 1.45,
                      }}
                    >
                      Complete the unresolved requirement before saving:{" "}
                      {draftValidationError}
                    </FitText>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          {sheetState?.mode === "publish" && activeEditorTab === "media" ? (
            <div
              style={{
                display: "grid",
                gap: 12,
                padding: 14,
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <div style={{ display: "grid", gap: 3 }}>
                <FitText style={{ fontSize: 13.5, fontWeight: 900 }}>
                  Publish decision
                </FitText>
                <FitText style={{ fontSize: 11.5, color: colors.textSecondary }}>
                  Record why this private movement is ready for the shared exercise library.
                </FitText>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "minmax(240px, 0.72fr) minmax(0, 1.28fr)",
                }}
              >
                <div
                  style={{
                    padding: 12,
                    borderRadius: 7,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surfaceRaised,
                  }}
                >
                  <FitText
                    style={{ fontSize: 12.5, color: colors.textSecondary }}
                  >
                    This note is stored with the review submission so future
                    admins understand why a private movement became canonical.
                    If the movement should stay personal, use Leave private.
                  </FitText>
                </div>
                <ExerciseLabField
                  label="Publish note"
                  hint="Required for publish. Keep provenance visible for future audit and model replacement work."
                >
                  <div
                    style={{
                      borderRadius: 7,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.fieldBg,
                      padding: "10px 12px",
                    }}
                  >
                    <FitTextArea
                      name="exercisePublishNote"
                      rows={3}
                      value={draft.publishNote}
                      onChange={(event) =>
                        setDraftField("publishNote", event.target.value)
                      }
                      placeholder="Add governance notes for future reviewers."
                      style={{
                        display: "block",
                        width: "100%",
                        minWidth: 0,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </ExerciseLabField>
              </div>
            </div>
          ) : null}
        </div>
      </FitModal>

      <ExerciseLabDrawer
        isOpen={mode === "review" && matchDrawerOpen}
        onClose={() => setMatchDrawerOpen(false)}
        title="Match search"
      >
        <div style={{ display: "grid", gap: 16 }}>
          <div
            style={{
              padding: 14,
              borderRadius: 18,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
            }}
          >
            <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
              Use a live library record as taxonomy guidance before publishing a
              new global exercise.
            </FitText>
          </div>
          <div
            style={{
              borderRadius: 18,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.surface,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Search size={16} color={colors.textMuted} />
              <FitTextInput
                name="matchSearch"
                value={matchSearch}
                onChange={(event) => setMatchSearch(event.target.value)}
                placeholder="Search suggested matches..."
              />
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {filteredMatches.length ? (
              filteredMatches.map(({ exercise, score }, index) => (
                <button
                  key={exercise.id}
                  className={
                    canAnimate
                      ? "exercise-lab-drawer-option exercise-lab-drawer-option--animated"
                      : "exercise-lab-drawer-option"
                  }
                  type="button"
                  onClick={() => applyMatchReference(exercise)}
                  style={{
                    display: "grid",
                    gap: 10,
                    padding: 16,
                    borderRadius: 20,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    cursor: "pointer",
                    textAlign: "left",
                    ...(canAnimate
                      ? {
                          animationDelay: `${
                            Math.min(index, 5) * (fullMotion ? 34 : 20)
                          }ms`,
                        }
                      : {}),
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <FitText style={{ fontSize: 16, fontWeight: 700 }}>
                      {exercise.name}
                    </FitText>
                    <div
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: `1px solid ${colors.brand}35`,
                        backgroundColor: `${colors.brand}10`,
                      }}
                    >
                      <FitText style={{ fontSize: 11, color: colors.brand }}>
                        {Math.max(58, Math.min(96, score))}% fit
                      </FitText>
                    </div>
                  </div>
                  <FitText
                    style={{ fontSize: 12.5, color: colors.textSecondary }}
                  >
                    {toTitleCase(exercise.category)} /{" "}
                    {toTitleCase(exercise.muscleGroup)}
                  </FitText>
                  <FitText
                    style={{ fontSize: 12.5, color: colors.textSecondary }}
                  >
                    {exercise.instructions ??
                      "No instruction summary saved yet."}
                  </FitText>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <CheckCircle2 size={14} color={colors.success} />
                    <FitText style={{ fontSize: 12, color: colors.success }}>
                      Use as publishing reference
                    </FitText>
                    <ChevronRight size={14} color={colors.textMuted} />
                  </div>
                </button>
              ))
            ) : (
              <div
                style={{
                  padding: 16,
                  borderRadius: 20,
                  border: `1px dashed ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
                  No live matches surfaced for the current search. This
                  candidate may need a brand-new global definition.
                </FitText>
              </div>
            )}
          </div>
        </div>
      </ExerciseLabDrawer>

      <FitModal
        isOpen={rejectTarget !== null}
        onClose={() => {
          setRejectTarget(null);
          setRejectRationale("");
          setRejectValidationError(null);
        }}
        title="Reject submission"
        subtitle="Decline promotion to the global library and leave a review rationale."
        icon={Archive}
        maxWidth={560}
        footer={
          <FitButton
            label="Reject submission"
            variant="danger"
            icon={Archive}
            loading={updateReviewSubmissionMutation.isPending}
            loadingLabel="Rejecting..."
            onClick={() => void handleReject()}
            style={{ width: "100%" }}
          />
        }
      >
        <div style={{ display: "grid", gap: 14 }}>
          <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
            {rejectTarget?.title ?? "This custom exercise"} will leave the
            publish queue and will not become a reusable global movement.
          </FitText>
          <FitTextArea
            name="exerciseReviewRejectRationale"
            rows={4}
            value={rejectRationale}
            onChange={(event) => {
              setRejectRationale(event.target.value);
              if (rejectValidationError) setRejectValidationError(null);
            }}
            placeholder="Explain why this submission is not ready for the global library."
          />
          <FitText
            style={{
              fontSize: 11.5,
              color: rejectValidationError ? colors.danger : colors.textMuted,
            }}
          >
            {rejectValidationError ?? "Required: at least 12 characters."}
          </FitText>
        </div>
      </FitModal>
      <style>{`
        .exercise-lab-workbench-body > div > div,
        .exercise-lab-workbench-body > div > div > div,
        .exercise-editor-workbench > div,
        .exercise-editor-workbench > div > div {
          border-radius: 8px !important;
          background-image: none !important;
        }

        .exercise-lab-workbench-body {
          gap: 10px !important;
        }

        .exercise-editor-workbench button {
          border-radius: 6px !important;
        }

        .exercise-lab-drawer-option {
          border-radius: 8px !important;
          padding: 12px !important;
        }
      `}</style>
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
            : true
        }
        isLoading={confirmationLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmationState(null)}
      />    </>
  );
}
