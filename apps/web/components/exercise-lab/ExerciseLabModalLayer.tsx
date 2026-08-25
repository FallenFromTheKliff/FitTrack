"use client";

import {
  CheckCircle2,
  ChevronRight,
  Plus,
  X,
} from "lucide-react";
import type { FitnessExerciseCategory } from "@fittrack/api-client";
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
import { ExerciseLabField } from "@/components/exercise-lab/ExerciseLabShell";
import { MovementProfileEditor } from "@/components/exercise-lab/ExerciseContractEditors";
import { MuscleTargetsEditor } from "@/components/exercise-lab/MuscleTargetsEditor";
import { HandShapeProfileEditor } from "@/components/exercise-lab/HandShapeProfileEditor";
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
    label: "Media & validation",
    description: "References and final validation",
    tab: "media",
  },
];

export function ExerciseLabModalLayer() {
  const {
    activeEditorTab,
    activeMuscleDefinitions,
    colors,
    completedDefinitionItems,
    confirmationIcon,
    confirmationLabel,
    confirmationLoading,
    confirmationLoadingLabel,
    confirmationMessage,
    confirmationState,
    confirmationTitle,
    definitionChecklist,
    draft,
    draftValidationError,
    editorColors,
    formError,
    handleCloseSheet,
    handleConfirmAction,
    handleModeChange,
    handleSheetSubmit,
    handleSaveSharedMovementContract,
    isCompact,
    setActiveEditorTab,
    setConfirmationState,
    setDraft,
    setDraftField,
    setFormError,
    sheetPending,
    sheetState,
  } = useExerciseLabPage();
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
        isOpen={sheetState !== null}
        onClose={handleCloseSheet}
        title={
          sheetState?.mode === "edit"
            ? "Edit global exercise"
            : "Create global exercise"
        }
        subtitle={
          `Step ${activeEditorStep + 1} of ${EXERCISE_EDITOR_STEPS.length} · ${editorStep.description}`
        }
        icon={Plus}
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

              <ExerciseLabField
                label="Exact aliases"
                hint="Comma-separated spelling or synonym labels. Each normalized label can belong to only one exercise."
              >
                <div
                  style={{
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.fieldBg,
                    padding: "12px 14px",
                  }}
                >
                  <FitTextInput
                    name="exerciseAliases"
                    value={draft.aliases.map((alias) => alias.label).join(", ")}
                    onChange={(event) =>
                      setDraftField(
                        "aliases",
                        event.target.value
                          .split(",")
                          .map((label) => label.trim())
                          .filter(Boolean)
                          .map((label) => ({ kind: "synonym" as const, label })),
                      )
                    }
                    placeholder="Push Up, Push-Up, Pushup"
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
                    <div style={{ display: "grid", gap: 14 }}>
                      <section
                        aria-label="Movement contract status"
                        style={{
                          backgroundColor: colors.surfaceRaised,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 8,
                          display: "grid",
                          gap: 12,
                          padding: 14,
                        }}
                      >
                        <div
                          style={{
                            display: "grid",
                            gap: 10,
                            gridTemplateColumns: isCompact
                              ? "minmax(0, 1fr)"
                              : "repeat(4, minmax(0, 1fr))",
                          }}
                        >
                          <ExerciseLabField label="Movement family">
                            <FitText style={{ fontSize: 13, fontWeight: 850 }}>
                              {draft.movementFamily?.displayName ?? "None"}
                            </FitText>
                          </ExerciseLabField>
                          <ExerciseLabField label="Tracking mode">
                            <FitSelect
                              fullWidth
                              value={draft.trackingMode}
                              onChange={(event) => {
                                const trackingMode = event.target.value as
                                  | "manual"
                                  | "inherit"
                                  | "override";
                                setDraft((current) => ({
                                  ...current,
                                  movementProfileOverride:
                                    trackingMode === "override"
                                      ? current.movementProfile
                                      : null,
                                  trackingMode,
                                }));
                              }}
                              options={[
                                { label: "Manual only", value: "manual" },
                                { label: "Inherit shared tracking", value: "inherit" },
                                { label: "Override this exercise", value: "override" },
                              ]}
                            />
                          </ExerciseLabField>
                          <ExerciseLabField label="Contract source">
                            <FitText style={{ fontSize: 13, fontWeight: 850 }}>
                              {draft.trackingMode === "manual"
                                ? "Manual logging"
                                : draft.trackingMode === "override"
                                  ? "Exercise override"
                                  : "Shared family"}
                            </FitText>
                          </ExerciseLabField>
                          <ExerciseLabField label="Revision">
                            <FitText style={{ fontSize: 13, fontWeight: 850 }}>
                              {draft.movementFamily?.contractRevision ?? "—"}
                            </FitText>
                          </ExerciseLabField>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {draft.aliases.length ? (
                            draft.aliases.map((alias) => (
                              <span
                                key={`${alias.label}-${alias.kind ?? "synonym"}`}
                                style={{
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: 999,
                                  color: colors.textSecondary,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: "5px 9px",
                                }}
                              >
                                {alias.label}
                              </span>
                            ))
                          ) : (
                            <FitText style={{ color: colors.textMuted, fontSize: 12 }}>
                              No exact aliases configured.
                            </FitText>
                          )}
                        </div>
                        {draft.movementProfile?.movementContract ? (() => {
                          const contract = draft.movementProfile.movementContract;
                          const increasing =
                            contract.repThresholds.up.angle >=
                            contract.repThresholds.down.angle;
                          const bottomGate = increasing
                            ? contract.repThresholds.down.angle + contract.repThresholds.down.tolerance
                            : contract.repThresholds.down.angle - contract.repThresholds.down.tolerance;
                          const topGate = increasing
                            ? contract.repThresholds.up.angle - contract.repThresholds.up.tolerance
                            : contract.repThresholds.up.angle + contract.repThresholds.up.tolerance;
                          return (
                            <FitText style={{ color: colors.textSecondary, fontSize: 12 }}>
                              Effective gates: bottom trigger {bottomGate}° · standing/top trigger {topGate}° · required landmarks {contract.trackingRequirements?.requiredLandmarks.join(", ") ?? "not configured"}.
                            </FitText>
                          );
                        })() : null}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {sheetState?.mode === "edit" &&
                          draft.movementFamily?.canonicalExerciseId ===
                            sheetState.exercise.id ? (
                            <FitButton
                              label="Edit shared tracking"
                              loading={sheetPending}
                              onClick={() => void handleSaveSharedMovementContract()}
                            />
                          ) : null}
                          {draft.movementFamily && draft.trackingMode !== "override" ? (
                            <FitButton
                              label="Create override for this exercise"
                              variant="ghost"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  movementProfileOverride: current.movementProfile,
                                  trackingMode: "override",
                                }))
                              }
                            />
                          ) : null}
                          {draft.movementFamily && draft.trackingMode === "override" ? (
                            <FitButton
                              label="Reset to inherited"
                              variant="ghost"
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  movementProfileOverride: null,
                                  trackingMode: "inherit",
                                }))
                              }
                            />
                          ) : null}
                        </div>
                      </section>
                      <MovementProfileEditor
                        colors={editorColors}
                        exerciseName={draft.name}
                        onChange={(nextProfile) =>
                          setDraftField("movementProfile", nextProfile)
                        }
                        value={draft.movementProfile}
                      />
                    </div>
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
                      Definition check
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
    </>
  );
}
