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
import {
  ExerciseEditorTabs,
  MovementProfileEditor,
} from "@/components/exercise-lab/ExerciseContractEditors";
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

import { useExerciseLabPage } from "./ExerciseLabPageContext";

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
                    {getEvidenceBars(selectedCandidate.evidenceBars).map(
                      (value, index) => (
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
                      ),
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
          sheetState?.mode === "publish"
            ? "Convert a client custom exercise into a reusable FitTrack movement."
            : sheetState?.mode === "edit"
              ? "Update taxonomy, guidance, and active state for an existing global record."
              : "Create a canonical exercise that other users can access."
        }
        icon={sheetState?.mode === "publish" ? ShieldCheck : Plus}
        maxWidth={980}
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
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
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
                borderRadius: 22,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.surface,
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: 14,
                  padding: 14,
                  borderRadius: 18,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.surfaceRaised,
                }}
              >
                <div
                  style={{
                    alignItems: "flex-start",
                    display: "flex",
                    gap: 12,
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "grid", gap: 6 }}>
                    <FitText style={{ fontSize: 11, color: colors.brand }}>
                      exercise definition
                    </FitText>
                    <FitText style={{ fontSize: 18, fontWeight: 800 }}>
                      Canonical movement record
                    </FitText>
                    <FitText
                      style={{ fontSize: 12.5, color: colors.textSecondary }}
                    >
                      Save only the fields admins and mobile sessions can trust:
                      name, taxonomy, coaching guidance, and optional media.
                    </FitText>
                  </div>
                  <div
                    style={{
                      borderRadius: 999,
                      border: `1px solid ${colors.brand}45`,
                      backgroundColor: `${colors.brand}12`,
                      padding: "7px 12px",
                    }}
                  >
                    <FitText
                      style={{
                        color: colors.brand,
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {completedDefinitionItems}/{definitionChecklist.length} ready
                    </FitText>
                  </div>
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
              </div>

              <ExerciseEditorTabs
                activeTab={activeEditorTab}
                colors={editorColors}
                onChange={setActiveEditorTab}
              />

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

              {activeEditorTab === "movement" ? (
                <MovementProfileEditor
                  colors={editorColors}
                  exerciseName={draft.name}
                  onChange={(nextProfile) =>
                    setDraftField("movementProfile", nextProfile)
                  }
                  value={draft.movementProfile}
                />
              ) : null}

              {activeEditorTab === "hands" ? (
                <HandShapeProfileEditor
                  colors={editorColors}
                  onChange={(nextProfile) =>
                    setDraftField("handShapeProfile", nextProfile)
                  }
                  value={draft.handShapeProfile}
                />
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
