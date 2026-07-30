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
  FitPill,
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
    <>      <FitModal
        isOpen={reviewModalCandidate !== null}
        onClose={() => setReviewModalCandidate(null)}
        title="Exercise review"
        subtitle="Inspect the submitted movement, govern the creator state, and choose the review outcome."
        icon={PanelRightOpen}
        maxWidth={980}
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
                  label="Review & Publish"
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
            style={{ display: "grid", gap: 16 }}
          >
            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: isCompact
                  ? "minmax(0, 1fr)"
                  : "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 10,
                  padding: 16,
                  borderRadius: 20,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 4 }}>
                    <FitText style={{ fontSize: 18, fontWeight: 900 }}>
                      {selectedCandidate.title}
                    </FitText>
                    <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>
                      {selectedCandidate.summary}
                    </FitText>
                  </div>
                  <FitPill
                    mode="status"
                    label={toTitleCase(selectedCandidate.status)}
                    color={getReviewStatusColor(selectedCandidate.status, colors)}
                  />
                </div>
                <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
                  Proposed global name:{" "}
                  <strong style={{ color: colors.textPrimary }}>
                    {selectedCandidate.proposedName}
                  </strong>
                </FitText>
                <div
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 16,
                    backgroundColor: colors.surfaceRaised,
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "end",
                      gap: 8,
                      height: 48,
                    }}
                  >
                    {selectedCandidateEvidenceBars.length ? (
                      selectedCandidateEvidenceBars.map((value, index) => (
                        <div
                          key={`${value}-${index}`}
                          style={{
                            width: 16,
                            height: Math.max(12, Math.min(44, value)),
                            borderRadius: 999,
                            backgroundColor:
                              index === 2 ? colors.brand : `${colors.brand}35`,
                          }}
                        />
                      ))
                    ) : (
                      <FitText style={{ fontSize: 12, color: colors.textMuted }}>
                        No numeric evidence bars submitted.
                      </FitText>
                    )}
                  </div>
                  <FitText
                    style={{
                      marginTop: 10,
                      fontSize: 12,
                      color: colors.textSecondary,
                    }}
                  >
                    {getEvidenceSummary(selectedCandidate.evidenceBars)}
                  </FitText>
                </div>
                <FitText style={{ fontSize: 12.5, color: colors.textSecondary }}>
                  {selectedCandidate.description ?? "No longer-form description submitted."}
                </FitText>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: 16,
                  borderRadius: 20,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                  alignContent: "start",
                }}
              >
                <FitText style={{ fontSize: 16, fontWeight: 900 }}>
                  Closest match
                </FitText>
                {closestMatch ? (
                  <>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      <div>
                        <FitText style={{ fontSize: 15, fontWeight: 800 }}>
                          {closestMatch.name}
                        </FitText>
                        <FitText
                          style={{ fontSize: 12, color: colors.textSecondary }}
                        >
                          {toTitleCase(closestMatch.category)} /{" "}
                          {toTitleCase(closestMatch.muscleGroup)}
                        </FitText>
                      </div>
                      <FitPill
                        mode="status"
                        label={`${Math.max(58, Math.min(96, matchSuggestions[0]?.score ?? 58))}% fit`}
                        color={colors.brand}
                      />
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {matchSuggestions.slice(1, 4).map(({ exercise, score }) => (
                        <div
                          key={exercise.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            border: `1px solid ${colors.border}`,
                            borderRadius: 14,
                            padding: 10,
                            backgroundColor: colors.surfaceRaised,
                          }}
                        >
                          <FitText style={{ fontSize: 12.5, fontWeight: 800 }}>
                            {exercise.name}
                          </FitText>
                          <FitText
                            style={{ fontSize: 12, color: colors.textSecondary }}
                          >
                            {Math.max(58, Math.min(96, score))}% fit
                          </FitText>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <FitText style={{ fontSize: 13, color: colors.textSecondary }}>
                    No close global exercise surfaced. Use the publish editor to
                    create a new canonical movement if the contract is clean.
                  </FitText>
                )}
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: isCompact
                  ? "minmax(0, 1fr)"
                  : "repeat(2, minmax(0, 1fr))",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: 18,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 15, fontWeight: 800 }}>
                  Client submission
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  source: {selectedCandidate.originLabel}
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  trigger: {selectedCandidate.triggerLabel}
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  muscle: {toTitleCase(selectedCandidate.muscleGroup)}
                </FitText>
              </div>
              <div
                style={{
                  display: "grid",
                  gap: 8,
                  padding: 14,
                  borderRadius: 18,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <FitText style={{ fontSize: 15, fontWeight: 800 }}>
                  Contract details
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  instructions:{" "}
                  {selectedCandidate.instructions ?? "No instructions submitted."}
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  reviewed: {formatDateTime(selectedCandidate.reviewedAt ?? undefined)}
                </FitText>
                <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                  note: {selectedCandidate.reviewNotes ?? "No review note yet."}
                </FitText>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gap: 12,
                padding: 14,
                borderRadius: 18,
                border: `1px solid ${selectedCreatorToneColor}45`,
                background: `linear-gradient(135deg, ${selectedCreatorToneColor}12 0%, ${colors.surface} 74%)`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <FitText style={{ fontSize: 16, fontWeight: 900 }}>
                    Creator governance
                  </FitText>
                  <FitText style={{ fontSize: 12, color: colors.textSecondary }}>
                    {selectedCandidate.creatorDisplayName ?? "Creator member"} /{" "}
                    {selectedCandidate.creatorEmail ?? "email unavailable"}
                  </FitText>
                </div>
                <FitPill
                  mode="status"
                  label={selectedCandidate.creatorStateLabel}
                  color={selectedCreatorToneColor}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "repeat(4, minmax(0, 1fr))",
                }}
              >
                {[
                  ["Submissions", selectedCandidate.creatorSubmissionCount],
                  ["Published", selectedCandidate.creatorPublishedCount],
                  ["Rejected", selectedCandidate.creatorRejectedCount],
                  ["Candidate score", selectedCandidate.creatorCandidateScore],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 14,
                      backgroundColor: colors.surfaceRaised,
                      padding: 12,
                    }}
                  >
                    <FitText style={{ fontSize: 10, color: colors.textMuted }}>
                      {label}
                    </FitText>
                    <FitText style={{ fontSize: 20, fontWeight: 900 }}>
                      {value}
                    </FitText>
                  </div>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "minmax(220px, 0.6fr) minmax(0, 1fr) auto",
                  alignItems: "start",
                }}
              >
                <FitSelect
                  name="creatorState"
                  fullWidth
                  value={creatorStateDraft}
                  options={[...CREATOR_STATE_OPTIONS]}
                  onChange={(event) =>
                    setCreatorStateDraft(
                      event.target.value as FitnessCreatorState,
                    )
                  }
                />
                <FitTextArea
                  name="creatorGovernanceNote"
                  value={creatorGovernanceNote}
                  onChange={(event) => setCreatorGovernanceNote(event.target.value)}
                  placeholder="Rationale for creator standing or escalation note"
                  rows={3}
                />
                <FitButton
                  label="Save creator"
                  variant="ghost"
                  disabled={sheetPending}
                  loading={updateReviewSubmissionMutation.isPending}
                  onClick={handleCreatorGovernanceUpdate}
                  style={{ minHeight: 42 }}
                />
              </div>
              <FitText style={{ fontSize: 11.5, color: colors.textSecondary }}>
                Last state change:{" "}
                {formatDateTime(
                  selectedCandidate.creatorLastStateChangedAt ?? undefined,
                )}
              </FitText>
            </div>
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
        <div style={{ display: "grid", gap: 18 }}>
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
              gap: 18,
              gridTemplateColumns:
                sheetState?.mode === "publish" && !isCompact
                  ? "minmax(0, 0.9fr) minmax(0, 1.1fr)"
                  : "minmax(0, 1fr)",
            }}
          >
            {sheetState?.mode === "publish" ? (
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  padding: 18,
                  borderRadius: 22,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surface,
                }}
              >
                <div
                  style={{
                    width: 6,
                    borderRadius: 999,
                    backgroundColor: colors.brand,
                    minHeight: 180,
                    justifySelf: "start",
                  }}
                />
                {publishCandidate ? (
                  <div
                    style={{
                      display: "grid",
                      gap: 14,
                      marginTop: -180,
                      marginLeft: 24,
                    }}
                  >
                    <FitText style={{ fontSize: 20, fontWeight: 800 }}>
                      Publish candidate
                    </FitText>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 12 }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 10,
                          backgroundColor: "rgba(38, 41, 48, 1)",
                          border: "1px solid rgba(84, 92, 107, 0.85)",
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Dumbbell size={14} color={colors.brand} />
                      </div>
                      <div
                        style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
                      >
                        <div
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: `1px solid ${colors.brand}35`,
                            backgroundColor: `${colors.brand}10`,
                          }}
                        >
                          <FitText
                            style={{ fontSize: 11, color: colors.brand }}
                          >
                            client custom
                          </FitText>
                        </div>
                        <div
                          style={{
                            padding: "4px 10px",
                            borderRadius: 999,
                            border: `1px solid ${colors.brand}35`,
                            backgroundColor: `${colors.brand}10`,
                          }}
                        >
                          <FitText
                            style={{ fontSize: 11, color: colors.brand }}
                          >
                            pending publish
                          </FitText>
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gap: 6 }}>
                      <FitText
                        style={{ fontSize: 13, color: colors.textSecondary }}
                      >
                        trigger: {publishCandidate.triggerLabel}
                      </FitText>
                      <FitText
                        style={{ fontSize: 13, color: colors.textSecondary }}
                      >
                        source label: {publishCandidate.sourceLabel}
                      </FitText>
                      <FitText
                        style={{ fontSize: 13, color: colors.textSecondary }}
                      >
                        decision: publish globally or keep private
                      </FitText>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gap: 16,
                padding: 18,
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
                        minHeight: 78,
                        padding: "13px 14px",
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

          {sheetState?.mode === "publish" ? (
            <div
              style={{
                display: "grid",
                gap: 16,
                padding: 18,
                borderRadius: 22,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <FitText style={{ fontSize: 11, color: colors.brand }}>
                publish decision / global governance
              </FitText>
              <div
                style={{
                  display: "grid",
                  gap: 16,
                  gridTemplateColumns: isCompact
                    ? "minmax(0, 1fr)"
                    : "minmax(0, 1fr) minmax(0, 1.2fr)",
                }}
              >
                <div
                  style={{
                    padding: 16,
                    borderRadius: 18,
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
                      borderRadius: 14,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.fieldBg,
                      padding: "12px 14px",
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
                        borderRadius: 999,
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
