"use client";

import {
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Hand,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { FitnessExerciseCategory } from "@fittrack/api-client";
import { getPrimaryExerciseMuscleGroup, normalizeExerciseMuscleTargets, validatePoseMovementContract } from "@fittrack/utils";
import type { LucideIcon } from "lucide-react";
import {
  FitButton,
  FitSelect,
  FitText,
  FitTextArea,
  FitTextInput,
  FitWorkflowRail,
} from "@/components/fit";

import { EXERCISE_CATEGORY_OPTIONS } from "./exercise-lab-data";
import { ExerciseLabField } from "./ExerciseLabShell";
import { ExerciseLabMuscleSurface } from "./ExerciseLabMuscleSurface";
import { HandShapeProfileEditor } from "./HandShapeProfileEditor";
import { MovementProfileEditor } from "./ExerciseContractEditors";
import { MuscleTargetsEditor } from "./MuscleTargetsEditor";
import { ExerciseLabLiveCameraValidation } from "./ExerciseLabLiveCameraValidation";
import { useExerciseLabPage } from "./ExerciseLabPageContext";
import {
  toTitleCase,
  type ExerciseWorkbenchStep,
  type ExerciseWorkbenchStepId,
} from "./exerciseLabShared";

const inputShellStyle = (colors: ReturnType<typeof useExerciseLabPage>["colors"]): CSSProperties => ({
  alignItems: "center",
  backgroundColor: colors.fieldBg,
  border: `1px solid ${colors.border}`,
  borderRadius: 8,
  boxSizing: "border-box",
  display: "flex",
  minHeight: 36,
  padding: "0 12px",
});

function modeLabel(value: string) {
  if (value === "inherit") return "Shared family";
  if (value === "override") return "Exercise override";
  return "Manual logging";
}

function cardStyle(
  colors: ReturnType<typeof useExerciseLabPage>["colors"],
): CSSProperties {
  return {
    backgroundColor: colors.surfaceRaised,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    boxSizing: "border-box",
    minWidth: 0,
    padding: 16,
  };
}

function iconLabel(
  Icon: LucideIcon,
  label: string,
  colors: ReturnType<typeof useExerciseLabPage>["colors"],
) {
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 7 }}>
      <Icon color={colors.brand} size={15} />
      <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 700 }}>
        {label}
      </FitText>
    </div>
  );
}

function SummaryRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  const { colors } = useExerciseLabPage();
  return (
    <div
      style={{
        alignItems: "baseline",
        display: "grid",
        gap: 12,
        gridTemplateColumns: "112px minmax(0, 1fr)",
      }}
    >
      <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12 }}>
        {label}
      </FitText>
      <FitText
        excludeGlobalScale
        style={{
          color: colors.textSecondary,
          fontSize: 12,
          fontWeight: 400,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </FitText>
    </div>
  );
}

export function ExerciseLabWorkbench({
  helpControl,
  managingMuscles: managingMusclesProp,
  onManagingMusclesChange,
}: {
  helpControl?: ReactNode;
  managingMuscles?: boolean;
  onManagingMusclesChange?: (next: boolean) => void;
}) {
  const {
    activeMuscleDefinitions,
    colors,
    completedDefinitionItems,
    definitionChecklist,
    draft,
    draftValidationError,
    draftValidationIssues,
    exerciseWorkbenchStep,
    exerciseWorkbenchSteps,
    editorColors,
    formError,
    goToExerciseWorkbenchStep,
    handleCloseSheet,
    handleSheetSubmit,
    isCompact,
    setDraft,
    setDraftField,
    setFormError,
    sheetPending,
    sheetState,
  } = useExerciseLabPage();
  const [localManagingMuscles, setLocalManagingMuscles] = useState(false);
  const [cameraSummaryTarget, setCameraSummaryTargetState] =
    useState<HTMLDivElement | null>(null);
  const setCameraSummaryTarget = useCallback(
    (node: HTMLDivElement | null) => setCameraSummaryTargetState(node),
    [],
  );
  const managingMuscles = managingMusclesProp ?? localManagingMuscles;
  const updateManagingMuscles = (next: boolean) => {
    if (managingMusclesProp !== undefined) {
      onManagingMusclesChange?.(next);
      return;
    }
    setLocalManagingMuscles(next);
  };

  const currentStep = exerciseWorkbenchSteps.find(
    (entry) => entry.step === exerciseWorkbenchStep,
  ) ?? exerciseWorkbenchSteps[0];
  const isEdit = sheetState?.mode === "edit";
  const currentStepId: ExerciseWorkbenchStepId = currentStep?.id ?? "setup";
  const isReview = currentStepId === "review";
  const isHand = currentStepId === "hand";
  const isCanonical =
    isEdit &&
    draft.movementFamily?.canonicalExerciseId ===
      (sheetState?.mode === "edit" ? sheetState.exercise.id : undefined);
  const stepFor = (id: ExerciseWorkbenchStepId) =>
    exerciseWorkbenchSteps.find((entry) => entry.id === id)?.step;
  const currentStepIndex = Math.max(
    0,
    exerciseWorkbenchSteps.findIndex((entry) => entry.step === exerciseWorkbenchStep),
  );
  const handOwnerStep = stepFor("movement") ?? stepFor("tracking");
  const cameraOwnerStep = stepFor("movement") ?? stepFor("tracking");
  const movementIssues = draftValidationIssues.filter(
    (issue) => issue.stepId === "movement",
  );
  const trainingIssues = draftValidationIssues.filter(
    (issue) => issue.stepId === "training",
  );
  const handIssues = draftValidationIssues.filter(
    (issue) => issue.stepId === "hand",
  );
  const setupIssue = (path: "name" | "instructions" | "description") =>
    draftValidationIssues.find(
      (issue) => issue.stepId === "setup" && issue.path === path,
    );
  const workbenchRailSteps = exerciseWorkbenchSteps.map((step) => {
    const issueCount = draftValidationIssues.filter(
      (issue) => issue.stepId === step.id,
    ).length;
    return {
      ...step,
      errorCount: issueCount || undefined,
      errorLabel: issueCount
        ? `${issueCount} issue${issueCount === 1 ? "" : "s"}`
        : undefined,
    };
  });
  const [focusIssuePath, setFocusIssuePath] = useState<string | undefined>();
  const requestedMovementFocusPath =
    focusIssuePath?.startsWith("movementProfile.") &&
    movementIssues.some(
      (issue) =>
        issue.path === focusIssuePath || focusIssuePath.startsWith(issue.path),
    )
      ? focusIssuePath
      : undefined;
  const movementFocusIssuePath =
    requestedMovementFocusPath ?? movementIssues[0]?.path;
  useEffect(() => {
    const requestedPath = focusIssuePath?.trim();
    if (
      !requestedPath ||
      currentStepId !== "setup" ||
      !draftValidationIssues.some(
        (issue) => issue.stepId === "setup" && issue.path === requestedPath,
      )
    ) {
      return undefined;
    }

    const frame = window.requestAnimationFrame(() => {
      const target = Array.from(
        document.querySelectorAll<HTMLElement>(
          "[data-validation-field-path]",
        ),
      ).find((element) => element.dataset.validationFieldPath === requestedPath);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentStepId, draftValidationIssues, focusIssuePath]);
  const adjacentPrimaryStep = (direction: -1 | 1) => {
    let index = currentStepIndex + direction;
    while (index >= 0 && index < exerciseWorkbenchSteps.length) {
      const entry = exerciseWorkbenchSteps[index];
      if (entry?.id !== "hand") return entry?.step;
      index += direction;
    }
    return undefined;
  };
  const previousStep = isHand ? handOwnerStep : adjacentPrimaryStep(-1);
  const nextStep = isHand ? undefined : adjacentPrimaryStep(1);
  const primaryTarget = draft.muscleTargets.find(
    (target) => target.role === "primary",
  );
  const contract = draft.movementProfile?.movementContract ?? null;
  const movementReady = validatePoseMovementContract(contract).valid;
  const movementReadOnly =
    draft.trackingMode === "inherit" &&
    Boolean(draft.movementFamily) &&
    !isCanonical;
  const canValidateLiveCamera =
    draft.trackingMode !== "manual" &&
    movementReady;
  const handRequirement = draft.handShapeProfile.grip.required
    ? draft.handShapeProfile.handPosePreview?.preset === "closed_grip"
      ? "Grip required"
      : "Custom hand requirement"
    : draft.handShapeProfile.handPosePreview?.preset === "open_palm"
      ? "Open palm"
      : "None";

  const updateTrackingMode = (trackingMode: "manual" | "inherit" | "override") => {
    setDraft((current) => trackingMode === "inherit" && !current.movementFamily ? current : ({
      ...current,
      movementProfileOverride:
        trackingMode === "override" ? current.movementProfile : null,
      trackingMode,
    }));
  };

  const renderSetupStep = () => {
    if (currentStepId === "setup") {
      const setupFieldLabelStyle: CSSProperties = {
        color: colors.textSecondary,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "normal",
        textTransform: "none",
      };
      return (
        <div className="exercise-lab-form-grid" style={{ display: "grid", gap: 20 }}>
          <FitText excludeGlobalScale as="p" style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
            Define the exercise identity in language members and coaches recognize.
          </FitText>
          <div
            style={{
              display: "grid",
              gap: 20,
              gridTemplateColumns: isCompact
                ? "minmax(0, 1fr)"
                : "minmax(0, 1fr) 200px",
            }}
          >
            <ExerciseLabField
              labelStyle={setupFieldLabelStyle}
              label="Exercise name"
              hint="Used in plans and workout sessions · 3–90 characters"
              required
            >
              <div style={inputShellStyle(colors)}>
                <FitTextInput
                  name="exerciseName"
                  aria-invalid={Boolean(setupIssue("name"))}
                  aria-describedby={setupIssue("name") ? "exercise-name-error" : undefined}
                  data-validation-field-path="name"
                  placeholder="e.g. Barbell bench press"
                  value={draft.name}
                  onChange={(event) => setDraftField("name", event.target.value)}
                />
              </div>
              {setupIssue("name") ? (
                <FitText
                  aria-live="polite"
                  id="exercise-name-error"
                  excludeGlobalScale
                  style={{ color: colors.danger, fontSize: 12, fontWeight: 700 }}
                >
                  {setupIssue("name")?.message} {setupIssue("name")?.suggestion}
                </FitText>
              ) : null}
            </ExerciseLabField>
            <ExerciseLabField
              labelStyle={setupFieldLabelStyle}
              label="Category"
              required
            >
              <FitSelect
                compact
                fullWidth
                name="exerciseCategory"
                options={EXERCISE_CATEGORY_OPTIONS.map((option) => ({
                  label: option.label,
                  value: option.value,
                }))}
                style={{ minHeight: 36 }}
                value={draft.category}
                onChange={(event) =>
                  setDraftField(
                    "category",
                    event.target.value as FitnessExerciseCategory,
                  )
                }
              />
            </ExerciseLabField>
          </div>
          <ExerciseLabField
            labelStyle={setupFieldLabelStyle}
            label="Instruction summary"
            hint="Supports members and AI prompts · minimum 12 characters"
            required
          >
            <div style={inputShellStyle(colors)}>
              <FitTextArea
                name="exerciseInstructions"
                aria-invalid={Boolean(setupIssue("instructions"))}
                aria-describedby={setupIssue("instructions") ? "exercise-instructions-error" : undefined}
                data-validation-field-path="instructions"
                placeholder="Describe the movement from setup to finish."
                rows={4}
                style={{ display: "block", minHeight: 80, resize: "vertical", width: "100%" }}
                value={draft.instructions}
                onChange={(event) => setDraftField("instructions", event.target.value)}
              />
            </div>
            {setupIssue("instructions") ? (
              <FitText
                aria-live="polite"
                id="exercise-instructions-error"
                excludeGlobalScale
                style={{ color: colors.danger, fontSize: 12, fontWeight: 700 }}
              >
                {setupIssue("instructions")?.message} {setupIssue("instructions")?.suggestion}
              </FitText>
            ) : null}
          </ExerciseLabField>
          <ExerciseLabField
            labelStyle={setupFieldLabelStyle}
            label="Description"
            hint="Optional · if supplied, minimum 12 characters"
          >
            <div style={inputShellStyle(colors)}>
              <FitTextArea
                name="exerciseDescription"
                aria-invalid={Boolean(setupIssue("description"))}
                aria-describedby={setupIssue("description") ? "exercise-description-error" : undefined}
                data-validation-field-path="description"
                placeholder="Extra coaching cues or context."
                rows={4}
                style={{ display: "block", minHeight: 80, resize: "vertical", width: "100%" }}
                value={draft.description}
                onChange={(event) => setDraftField("description", event.target.value)}
              />
            </div>
            {setupIssue("description") ? (
              <FitText
                aria-live="polite"
                id="exercise-description-error"
                excludeGlobalScale
                style={{ color: colors.danger, fontSize: 12, fontWeight: 700 }}
              >
                {setupIssue("description")?.message} {setupIssue("description")?.suggestion}
              </FitText>
            ) : null}
          </ExerciseLabField>
          <ExerciseLabField
            labelStyle={setupFieldLabelStyle}
            label="Exact aliases"
            hint="Comma-separated spelling variants or synonyms · each alias belongs to one exercise"
          >
            <div style={inputShellStyle(colors)}>
              <FitTextInput
                name="exerciseAliases"
                placeholder="bench, press-up"
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
              />
            </div>
          </ExerciseLabField>
        </div>
      );
    }

    if (currentStepId === "training") {
      return (
        <MuscleTargetsEditor
          colors={editorColors}
          fallbackMuscleGroup={draft.muscleGroup}
          muscleDefinitions={activeMuscleDefinitions}
          onManageMuscles={() => updateManagingMuscles(true)}
          onChange={(nextTargets) => {
            if (formError) setFormError(null);
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
          }}
          validationIssues={trainingIssues}
          value={draft.muscleTargets}
        />
      );
    }

    if (currentStepId === "tracking") {
      return (
        <div style={{ display: "grid", gap: 20 }}>
          <FitText excludeGlobalScale as="p" style={{ color: colors.textMuted, fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>
            {currentStep.description}
          </FitText>
          <div
            aria-label="Tracking mode"
            style={{ display: "grid", gap: 8, gridTemplateColumns: isCompact ? "minmax(0, 1fr)" : "repeat(3, minmax(0, 1fr))" }}
          >
            {([
              ["manual", "Manual only", "No movement family contract. Continues straight to review."],
              ["inherit", "Inherit shared tracking", "Uses the shared movement-family contract."],
              ["override", "Override this exercise", "Create and save movement settings for this exercise."],
            ] as const).map(([mode, title, description]) => {
              const active = draft.trackingMode === mode;
              const unavailable = mode === "inherit" && !draft.movementFamily;
              return (
                <button
                  aria-label={title}
                  aria-pressed={active}
                  aria-describedby={`exercise-tracking-mode-${mode}-description`}
                  data-tracking-mode-option={mode}
                  disabled={unavailable}
                  key={mode}
                  onClick={() => updateTrackingMode(mode)}
                  style={{
                    backgroundColor: active ? `${colors.brand}18` : colors.surfaceRaised,
                    border: `1px solid ${active ? colors.brand : colors.border}`,
                    borderRadius: 10,
                    color: colors.textPrimary,
                    cursor: unavailable ? "not-allowed" : "pointer",
                    display: "grid",
                    gap: 6,
                    minHeight: 88,
                    padding: 14,
                    textAlign: "left",
                    transition: "background-color 150ms ease, border-color 150ms ease",
                  }}
                  type="button"
                >
                  <span style={{ alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between" }}>
                    <FitText excludeGlobalScale style={{ color: active ? colors.textPrimary : colors.textSecondary, fontSize: 13, fontWeight: 600 }}>
                      {title}
                    </FitText>
                    {active ? <Check color={colors.brand} size={15} /> : null}
                  </span>
                  <FitText
                    as="span"
                    excludeGlobalScale
                    id={`exercise-tracking-mode-${mode}-description`}
                    style={{ color: colors.textMuted, fontSize: 11.5, lineHeight: 1.4 }}
                  >
                    {unavailable ? "No shared movement settings are linked. Choose Override this exercise to use your drawing." : description}
                  </FitText>
                </button>
              );
            })}
          </div>

          {isCanonical && draft.trackingMode === "inherit" && draft.movementFamily ? (
            <div
              aria-label="Canonical tracking notice"
              role="status"
              style={{
                backgroundColor: `${colors.brand}0d`,
                border: `1px solid ${colors.brand}45`,
                borderRadius: 9,
                display: "grid",
                gap: 4,
                padding: "10px 12px",
              }}
            >
              <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: 700 }}>
                Canonical movement family
              </FitText>
              <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.45 }}>
                This exercise owns the shared {draft.movementFamily.displayName} contract. Publishing movement changes will ask for confirmation before updating inheriting exercises.
              </FitText>
            </div>
          ) : draft.trackingMode === "inherit" && draft.movementFamily ? (
            <div
              aria-label="Inherited tracking notice"
              role="status"
              style={{
                backgroundColor: `${colors.surfaceRaised}`,
                border: `1px solid ${colors.border}`,
                borderRadius: 9,
                display: "grid",
                gap: 4,
                padding: "10px 12px",
              }}
            >
              <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 12.5, fontWeight: 700 }}>
                Inherited movement family
              </FitText>
              <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.45 }}>
                This exercise follows the shared {draft.movementFamily.displayName} contract. The Movement Builder is available for inspection and camera validation. Create an override to edit this exercise&apos;s profile.
              </FitText>
            </div>
          ) : null}

          {draft.trackingMode !== "manual" ? (
            <div
              aria-label="Movement contract status"
              className="exercise-lab-tracking-status-card"
              role="region"
              style={{ ...cardStyle(colors), display: "grid", gap: 14 }}
            >
              <div
              style={{
                backgroundColor: colors.fieldBg,
                border: `1px solid ${colors.border}`,
                borderRadius: 10,
                display: "grid",
                columnGap: 24,
                rowGap: 8,
                padding: 16,
                gridTemplateColumns: isCompact
                  ? "repeat(2, minmax(0, 1fr))"
                  : "repeat(3, minmax(0, 1fr))",
                }}
              >
                <div>
                  <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Movement family</FitText>
                  <FitText excludeGlobalScale style={{ color: colors.textPrimary, display: "block", fontSize: 12.5, fontWeight: 600, marginTop: 4, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={draft.movementFamily?.displayName ?? "—"}>{draft.movementFamily?.displayName ?? "—"}</FitText>
                </div>
                <div>
                  <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Tracking mode</FitText>
                  <FitText excludeGlobalScale style={{ color: colors.textPrimary, display: "block", fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{modeLabel(draft.trackingMode)}</FitText>
                </div>
                <div>
                  <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Contract source</FitText>
                  <FitText excludeGlobalScale style={{ color: colors.textPrimary, display: "block", fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{draft.movementFamily ? (isCanonical && draft.trackingMode === "inherit" ? "Canonical" : draft.trackingMode === "override" ? "Local" : "Family") : "Local"}</FitText>
                </div>
                <div>
                  <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Revision</FitText>
                  <FitText excludeGlobalScale style={{ color: colors.textPrimary, display: "block", fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{draft.movementFamily?.contractRevision ?? "—"}</FitText>
                </div>
                <div>
                  <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Rig</FitText>
                  <FitText excludeGlobalScale style={{ color: draft.movementProfile?.rig ? colors.success : colors.warning, display: "block", fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{draft.movementProfile?.rig ? "Ready" : "Not configured"}</FitText>
                </div>
                <div>
                  <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 10.5, letterSpacing: "0.06em", textTransform: "uppercase" }}>Hands</FitText>
                  <FitText excludeGlobalScale style={{ color: colors.textPrimary, display: "block", fontSize: 12.5, fontWeight: 600, marginTop: 4 }}>{handRequirement}</FitText>
                </div>
              </div>
              {contract ? (
                <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.45 }}>
                  {contract.repModel === "static_hold" ? "Static hold" : "Dynamic reps"} · {contract.dominantJoint} target · required landmarks {contract.trackingRequirements?.requiredLandmarks.join(", ") ?? "not configured"}.
                </FitText>
              ) : (
                <FitText excludeGlobalScale style={{ color: colors.textMuted, fontSize: 12 }}>
                  No movement contract is active. Configure the movement in the next step.
                </FitText>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {draft.movementFamily && draft.trackingMode !== "override" ? (
                  <FitButton
                    label="Create override for this exercise"
                    variant="ghost"
                    onClick={() => updateTrackingMode("override")}
                    style={{ minHeight: 36, padding: "0 14px" }}
                  />
                ) : null}
                {draft.movementFamily && draft.trackingMode === "override" ? (
                  <FitButton
                    label="Reset to inherited"
                    variant="ghost"
                    onClick={() => updateTrackingMode("inherit")}
                    style={{ minHeight: 36, padding: "0 14px" }}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

          <div
            className="exercise-lab-tracking-continuation"
            style={{
              alignItems: "center",
              borderTop: `1px solid ${colors.border}`,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "space-between",
              paddingTop: 16,
            }}
          >
            <FitText excludeGlobalScale style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.4 }}>
              {stepFor("movement")
                ? "Continue opens the Movement Builder."
                : draft.trackingMode === "inherit" && draft.movementFamily
                  ? "Continue keeps the shared movement contract and opens Review."
                  : "Continue opens Review & Publish."}
            </FitText>
            {stepFor("hand") ? (
              <FitButton
                icon={Hand}
                label="Configure hand shapes (optional)"
                onClick={() => {
                  const step = stepFor("hand");
                  if (step) goToExerciseWorkbenchStep(step);
                }}
                variant="ghost"
                style={{ minHeight: 36, padding: "0 14px" }}
              />
            ) : null}
          </div>
        </div>
      );
    }

    if (currentStepId === "movement") {
      return (
        <div
          data-movement-editor-mode={draft.trackingMode}
          data-movement-editor-readonly={movementReadOnly ? "true" : "false"}
        >
          <MovementProfileEditor
            colors={editorColors}
            exerciseName={draft.name}
            focusIssuePath={movementFocusIssuePath}
            isCanonical={isCanonical}
            onChange={(nextProfile) => {
              if (movementReadOnly) return;
              setDraftField("movementProfile", nextProfile);
            }}
            onOpenHandSetup={() => {
              const step = stepFor("hand");
              if (step) goToExerciseWorkbenchStep(step);
            }}
            onRequestEdit={
              movementReadOnly ? () => updateTrackingMode("override") : undefined
            }
            readOnly={movementReadOnly}
            validationIssues={movementIssues}
            value={draft.movementProfile}
          />
        </div>
      );
    }

    if (currentStepId === "hand") {
      return (
        <HandShapeProfileEditor
          colors={editorColors}
          onBack={() => {
            if (handOwnerStep) goToExerciseWorkbenchStep(handOwnerStep);
          }}
          onChange={(nextProfile) => setDraftField("handShapeProfile", nextProfile)}
          validationIssues={handIssues}
          value={draft.handShapeProfile}
        />
      );
    }

    return (
      <div className="exercise-lab-review-body" style={{ display: "grid", gap: 16 }}>
        <div
          role={draftValidationError ? "alert" : "status"}
          style={{
            alignItems: "flex-start",
            backgroundColor: draftValidationError ? `${colors.warning}12` : `${colors.success}12`,
            border: `1px solid ${draftValidationError ? `${colors.warning}66` : `${colors.success}66`}`,
            borderRadius: 8,
            color: draftValidationError ? colors.warning : colors.success,
            display: "flex",
            gap: 8,
            padding: "10px 12px",
          }}
        >
          {draftValidationError ? <CircleAlert size={16} /> : <CheckCircle2 size={16} />}
          <FitText excludeGlobalScale style={{ color: "inherit", fontSize: 12, fontWeight: 600 }}>
            {draftValidationError
              ? `Complete the unresolved requirement before publishing: ${draftValidationError}`
              : "Definition check passed. Ready to publish."}
          </FitText>
        </div>

        {canValidateLiveCamera ? (
          <ExerciseLabLiveCameraValidation
            exerciseName={draft.name}
            handShapeProfile={draft.handShapeProfile}
            movementProfile={draft.movementProfile}
            summaryTarget={cameraSummaryTarget}
            onAdjust={(target) => {
              const step = stepFor(target === "movement" ? "movement" : target === "hand" ? "hand" : "tracking");
              if (step) goToExerciseWorkbenchStep(step);
            }}
          />
        ) : (
          <section
            aria-label="Camera validation"
            data-camera-state="idle"
            style={{
              backgroundColor: colors.surfaceRaised,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              display: "grid",
              gap: 10,
              padding: 16,
            }}
          >
            <FitText excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 14, fontWeight: 700 }}>
              Live camera validation
            </FitText>
            <FitText excludeGlobalScale as="p" style={{ color: colors.textSecondary, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
              {draft.trackingMode === "manual"
                ? "Automated rep validation is unavailable for manual-only exercises. Members will log this exercise manually."
                : draft.movementFamily
                  ? "The shared movement contract is not configured yet. Open Movement Builder to inspect the effective family profile, or switch to Override to author a local rig."
                  : "Select a movement family before configuring camera tracking."}
            </FitText>
            <FitButton
              label={draft.trackingMode === "manual" ? "Add a movement contract" : "Review tracking source"}
              onClick={() => {
                const step = stepFor("tracking");
                if (step) goToExerciseWorkbenchStep(step);
              }}
              variant="ghost"
              style={{ fontSize: 13, fontWeight: 600, minHeight: 36, padding: "0 12px", width: "fit-content" }}
              textStyle={{ fontSize: 13, fontWeight: 600 }}
            />
          </section>
        )}

        <section
          aria-label="Review summary"
          className="exercise-lab-review-summary"
          data-testid="exercise-lab-review-summary"
          style={{ display: "grid", gap: 12 }}
        >
          <div className="exercise-lab-review-card-grid" style={{ display: "grid", gap: 12, gridTemplateColumns: isCompact ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))" }}>
            <ReviewCard
              colors={colors}
              onEdit={() => {
                const step = stepFor("setup");
                if (step) goToExerciseWorkbenchStep(step);
              }}
              title="Identity"
            >
              <SummaryRow label="Name" value={draft.name || "Untitled exercise"} />
              <SummaryRow label="Category" value={toTitleCase(draft.category)} />
              <SummaryRow label="Aliases" value={draft.aliases.length ? draft.aliases.map((alias) => alias.label).join(", ") : "—"} />
              <SummaryRow label="Instructions" value={draft.instructions || "—"} />
            </ReviewCard>
            <ReviewCard
              colors={colors}
              onEdit={() => {
                const step = stepFor("training");
                if (step) goToExerciseWorkbenchStep(step);
              }}
              title="EXP Allocation"
            >
              <SummaryRow label="Primary" value={primaryTarget?.muscleGroup ? toTitleCase(primaryTarget.muscleGroup) : "—"} />
              <SummaryRow label="Targets" value={`${draft.muscleTargets.length} muscle${draft.muscleTargets.length === 1 ? "" : "s"}`} />
              <SummaryRow label="Effort XP" value={`${draft.muscleTargets.reduce((sum, target) => sum + target.allocationPercent, 0)}% allocated`} />
              <SummaryRow label="Roles" value={draft.muscleTargets.map((target) => toTitleCase(target.role)).join(", ") || "—"} />
            </ReviewCard>
            <ReviewCard
              colors={colors}
              onEdit={() => {
                const step = stepFor("tracking");
                if (step) goToExerciseWorkbenchStep(step);
              }}
              title="Tracking"
            >
               <SummaryRow label="Tracking mode" value={modeLabel(draft.trackingMode)} />
               <SummaryRow label="Movement family" value={draft.movementFamily?.displayName ?? "None"} />
               <SummaryRow label="Contract source" value={modeLabel(draft.trackingMode)} />
              <SummaryRow label="Revision" value={draft.movementFamily?.contractRevision ?? "—"} />
              <SummaryRow label="Movement" value={draft.trackingMode === "manual" ? "Manual logging" : movementReady ? `${toTitleCase(contract?.repModel === "static_hold" ? "static hold" : "dynamic reps")} · ${contract?.dominantJoint ?? "—"}` : "Manual setup needed"} />
              <SummaryRow label="Hands" value={handRequirement} />
            </ReviewCard>
          <ReviewCard
            colors={colors}
            onEdit={() => {
              if (cameraOwnerStep) goToExerciseWorkbenchStep(cameraOwnerStep);
            }}
            title="Camera test summary"
          >
              <div
                data-camera-summary-slot
                ref={setCameraSummaryTarget}
                style={{ display: "grid", gap: 8, minWidth: 0 }}
              >
                {!canValidateLiveCamera || !cameraSummaryTarget ? (
                  <SummaryRow label="Status" value="Not tested" />
                ) : null}
              </div>
            </ReviewCard>
          </div>

          {draftValidationIssues.length > 0 ? (
            <div
              aria-label="Draft validation issues"
              data-testid="exercise-lab-validation-issue-list"
              role="region"
              style={{
                ...cardStyle(colors),
                display: "grid",
                gap: 8,
              }}
            >
              <div style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <CircleAlert color={colors.danger} size={15} />
                <FitText
                  excludeGlobalScale
                  style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 700 }}
                >
                  Needs attention
                </FitText>
              </div>
              <div role="list" style={{ display: "grid", gap: 6 }}>
                {draftValidationIssues.map((issue) => {
                  const targetStep = stepFor(issue.stepId);
                  return (
                    <div key={`${issue.code}-${issue.path}`} role="listitem">
                      <button
                        aria-label={`Fix ${issue.message}`}
                        data-validation-issue-path={issue.path}
                        onClick={() => {
                          setFocusIssuePath(issue.path);
                          if (targetStep) goToExerciseWorkbenchStep(targetStep);
                        }}
                        style={{
                          alignItems: "flex-start",
                          backgroundColor: `${colors.danger}0d`,
                          border: `1px solid ${colors.danger}44`,
                          borderRadius: 8,
                          color: colors.textSecondary,
                          cursor: targetStep ? "pointer" : "default",
                          display: "grid",
                          gap: 3,
                          padding: "8px 10px",
                          textAlign: "left",
                          width: "100%",
                        }}
                        type="button"
                      >
                        <FitText
                          excludeGlobalScale
                          style={{ color: colors.danger, fontSize: 12, fontWeight: 700, lineHeight: 1.35 }}
                        >
                          {issue.message}
                        </FitText>
                        <FitText
                          excludeGlobalScale
                          style={{ color: colors.textMuted, fontSize: 11, lineHeight: 1.35 }}
                        >
                          {issue.suggestion}
                        </FitText>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div aria-label="Definition checklist" style={{ ...cardStyle(colors), display: "grid", gap: 10 }}>
            <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 12 }}>
              {iconLabel(CheckCircle2, "Definition checklist", colors)}
              <FitText excludeGlobalScale style={{ color: completedDefinitionItems === definitionChecklist.length ? colors.success : colors.brand, fontSize: 12, fontWeight: 700 }}>
                {completedDefinitionItems}/{definitionChecklist.length} ready
              </FitText>
            </div>
            <div style={{ display: "grid", gap: 8, gridTemplateColumns: isCompact ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))" }}>
              {definitionChecklist.map((item) => (
                <div key={item.label} style={{ alignItems: "flex-start", display: "flex", gap: 8, minWidth: 0 }}>
                  {item.complete ? <Check color={colors.success} size={14} /> : <CircleAlert color={colors.textMuted} size={14} />}
                  <FitText excludeGlobalScale style={{ color: item.complete ? colors.textSecondary : colors.textMuted, fontSize: 12, lineHeight: 1.4 }}>{item.label}</FitText>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  };

  if (managingMuscles) {
    return (
      <div
        aria-label="Manage muscle library"
        className="exercise-lab-muscle-manager"
        data-testid="exercise-lab-muscle-manager"
        style={{ display: "grid", gap: 16, minWidth: 0, width: "100%" }}
      >
        <div
          style={{
            alignItems: "flex-start",
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            justifyContent: "space-between",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <FitButton
              icon={ChevronLeft}
              label="Back to exercise draft"
              onClick={() => updateManagingMuscles(false)}
              variant="link"
              style={{ minHeight: 30, padding: 0 }}
            />
            <FitText
              excludeGlobalScale
              as="p"
              style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.45, margin: "4px 0 0" }}
            >
              Managing muscle taxonomy · the draft for <strong style={{ color: colors.textSecondary }}>{draft.name || "new exercise"}</strong> is preserved.
            </FitText>
          </div>
          <span
            style={{
              border: `1px solid ${colors.brand}55`,
              borderRadius: 999,
              color: colors.brand,
              fontSize: 10.5,
              fontWeight: 850,
              letterSpacing: "0.04em",
              padding: "5px 9px",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            Draft held
          </span>
        </div>
        <ExerciseLabMuscleSurface />
        <style>{`
          .exercise-lab-muscle-manager .exercise-lab-surface-navigation-row {
            display: none;
          }

          .exercise-lab-muscle-manager .exercise-lab-surface-frame {
            grid-template-rows: 42px minmax(0, 1fr) 42px !important;
          }

          @media (max-width: 920px) {
            .exercise-lab-muscle-manager .exercise-lab-surface-frame {
              grid-template-rows: none !important;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      aria-label="Exercise creation workbench"
      className="exercise-lab-workbench-shell"
      data-testid="exercise-lab-workbench"
      style={{
        display: "grid",
        gap: 24,
        gridTemplateColumns: "240px minmax(0, 1fr)",
        alignItems: "start",
        height: "auto",
        margin: "0 auto",
        maxWidth: 1154,
        minHeight: 0,
        overflow: "visible",
        width: "100%",
      }}
    >
      <FitWorkflowRail
        ariaLabel="Exercise creation steps"
        className="exercise-lab-workbench-rail"
        data-testid="exercise-lab-step-rail"
        activeStep={exerciseWorkbenchStep}
        eyebrow={isEdit ? "Edit exercise" : "New exercise"}
        onExit={handleCloseSheet}
        onStepChange={(step) => goToExerciseWorkbenchStep(step as ExerciseWorkbenchStep)}
        steps={workbenchRailSteps}
        title={draft.name || "Untitled"}
        style={{ width: 240 }}
      />

      <section
        aria-label={`${currentStep.label} step`}
        className="exercise-lab-step-surface"
        data-testid="exercise-lab-step-surface"
        data-workbench-step={exerciseWorkbenchStep}
        style={{
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          display: "grid",
          gridTemplateRows: "auto auto auto",
          minHeight: "auto",
          overflow: "visible",
        }}
      >
        <header
          className={`exercise-lab-step-header${
            helpControl ? " exercise-lab-step-header--with-help" : ""
          }`}
          style={{ borderBottom: `1px solid ${colors.border}`, boxSizing: "border-box", display: "grid", gap: 0, overflow: "visible", padding: "16px 24px" }}
        >
          <div
            className="exercise-lab-step-header-copy"
            style={{ display: "grid", gap: 7, minWidth: 0 }}
          >
            <FitText excludeGlobalScale style={{ color: colors.brand, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", lineHeight: 1.2, textTransform: "uppercase" }}>
              Step {exerciseWorkbenchStep} of {exerciseWorkbenchSteps.length}
            </FitText>
            <FitText as="h2" excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 17, fontWeight: 700, lineHeight: 1.15, margin: 0 }}>
              {currentStep.label}
            </FitText>
          </div>
          {helpControl ? (
            <div className="exercise-lab-workbench-help-slot">
              {helpControl}
            </div>
          ) : null}
        </header>

        <div className="exercise-lab-step-body" style={{ boxSizing: "border-box", overflow: "visible", padding: 24 }}>
          {formError ? (
            <div role="alert" style={{ alignItems: "flex-start", backgroundColor: `${colors.danger}12`, border: `1px solid ${colors.danger}66`, borderRadius: 8, display: "flex", gap: 8, marginBottom: 14, padding: "10px 12px" }}>
              <CircleAlert color={colors.danger} size={16} />
              <FitText excludeGlobalScale style={{ color: colors.danger, fontSize: 12, fontWeight: 600 }}>{formError}</FitText>
            </div>
          ) : null}
          <div className={`exercise-lab-workbench-body--animated exercise-lab-step-content exercise-lab-step-content--${exerciseWorkbenchStep}`} key={exerciseWorkbenchStep}>
            {renderSetupStep()}
          </div>
        </div>

        <footer className="exercise-lab-workbench-footer" style={{ alignItems: "center", backgroundColor: colors.surface, borderTop: `1px solid ${colors.border}`, bottom: 0, boxSizing: "border-box", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", padding: "16px 24px", position: "sticky", zIndex: 2 }}>
          <FitButton
            disabled={sheetPending}
            label="Exit"
            onClick={handleCloseSheet}
            variant="ghost"
            style={{ minHeight: 36, padding: "0 14px" }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 9, justifyContent: "flex-end" }}>
            {previousStep ? (
              <FitButton
                disabled={sheetPending}
                icon={ChevronLeft}
                label="Back"
                onClick={() => {
                  if (previousStep) goToExerciseWorkbenchStep(previousStep);
                }}
                variant="ghost"
                style={{ minHeight: 36, padding: "0 14px" }}
              />
            ) : null}
            {isReview ? (
              <FitButton
                disabled={Boolean(draftValidationError) || sheetPending}
                label={isEdit ? "Save global exercise" : "Create global exercise"}
                loading={sheetPending}
                onClick={() => void handleSheetSubmit()}
                title={draftValidationError ?? undefined}
                style={{ minHeight: 36, padding: "0 14px" }}
              />
            ) : isHand ? (
              <FitButton
                disabled={sheetPending}
                icon={Check}
                label="Done with hands"
                onClick={() => {
                  if (handOwnerStep) goToExerciseWorkbenchStep(handOwnerStep);
                }}
                style={{ minHeight: 36, padding: "0 14px" }}
              />
            ) : (
              <FitButton
                label="Continue"
                onClick={() => {
                  if (nextStep) goToExerciseWorkbenchStep(nextStep);
                }}
                variant="primary"
                style={{ minHeight: 36, padding: "0 14px" }}
              />
            )}
          </div>
        </footer>
      </section>

      <style>{`
        .exercise-lab-workbench-help-slot {
          display: contents;
        }

        .exercise-lab-form-grid > label > span:first-child {
          color: ${colors.textSecondary} !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          letter-spacing: normal !important;
          text-transform: none !important;
        }

        .exercise-lab-form-grid > label > span:not(:first-child) {
          color: ${colors.textSecondary} !important;
          font-size: 11.5px !important;
          line-height: 1.35 !important;
        }

        .exercise-lab-workbench-footer button,
        .exercise-lab-workbench-footer button > span {
          font-size: 13px !important;
          font-weight: 600 !important;
        }

        .exercise-lab-workbench-rail {
          gap: 14px !important;
        }

        .exercise-lab-workbench-rail .fit-workflow-rail__heading {
          gap: 4px !important;
        }

        .exercise-lab-workbench-rail .fit-workflow-rail__heading h1 {
          font-size: 18px !important;
        }

        .exercise-lab-workbench-rail .fit-workflow-rail__steps {
          gap: 5px !important;
          grid-auto-rows: 40px !important;
        }

        .exercise-lab-workbench-rail .fit-workflow-rail__step {
          gap: 8px !important;
          height: 40px !important;
          min-height: 40px !important;
          padding: 6px 10px !important;
        }

        .exercise-lab-workbench-rail .fit-workflow-rail__step > span:first-child {
          font-size: 10px !important;
          height: 20px !important;
          width: 20px !important;
        }

        .exercise-lab-workbench-body--animated {
          animation: exercise-lab-step-enter ${isCompact ? 160 : 220}ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        @keyframes exercise-lab-step-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 920px) {
          .exercise-lab-step-header--with-help {
            align-items: start;
            column-gap: 12px !important;
            grid-template-columns: minmax(0, 1fr) 56px;
            padding-bottom: 10px !important;
            padding-top: 14px !important;
            row-gap: 0 !important;
          }

          .exercise-lab-step-header--with-help .exercise-lab-step-header-copy {
            gap: 5px !important;
          }

          .exercise-lab-workbench-help-slot {
            align-self: start;
            display: block;
            height: 56px;
            width: 56px;
          }

          .exercise-lab-workbench-help-slot > button[aria-label$="help for Exercise Lab"] {
            bottom: auto !important;
            position: static !important;
            right: auto !important;
          }

          .exercise-lab-workbench-shell {
            grid-template-columns: minmax(0, 1fr) !important;
            height: auto !important;
            overflow: visible !important;
          }

          .exercise-lab-step-surface {
            grid-template-rows: auto auto auto !important;
            min-height: auto !important;
            overflow: visible !important;
          }

          .exercise-lab-step-surface > header {
            height: auto !important;
            min-height: 0 !important;
          }

          .exercise-lab-step-body {
            overflow: visible !important;
            padding: 18px !important;
          }

          .exercise-lab-workbench-footer {
            height: auto !important;
            min-height: 0 !important;
            padding: 16px 18px !important;
          }
        }

        @media (min-width: 921px) and (max-width: 1219px) {
          .exercise-lab-workbench-shell {
            grid-template-columns: 240px minmax(0, 1fr) !important;
          }

          .exercise-lab-step-surface > header,
          .exercise-lab-step-body,
          .exercise-lab-workbench-footer {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }
        }

        .exercise-lab-step-content--2 > section,
        .exercise-lab-step-content--3 > div,
        .exercise-lab-step-content--6 > div {
          box-sizing: border-box;
        }

        @media (prefers-reduced-motion: reduce) {
          .exercise-lab-workbench-body--animated {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

function ReviewCard({
  children,
  colors,
  onEdit,
  title,
}: {
  children: ReactNode;
  colors: ReturnType<typeof useExerciseLabPage>["colors"];
  onEdit: () => void;
  title: string;
}) {
  return (
    <section aria-label={title} style={{ ...cardStyle(colors), display: "grid", gap: 12 }}>
      <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 10 }}>
        <FitText as="h3" excludeGlobalScale style={{ color: colors.textPrimary, fontSize: 13, fontWeight: 700, margin: 0 }}>
          {title}
        </FitText>
        <FitButton
          aria-label={`Edit ${title}`}
          label="Edit"
          onClick={onEdit}
          variant="link"
          style={{ fontSize: 13, fontWeight: 600, minHeight: 24, padding: 0 }}
          textStyle={{ fontSize: 13, fontWeight: 600 }}
        />
      </div>
      <div style={{ display: "grid", gap: 8, minWidth: 0 }}>{children}</div>
    </section>
  );
}
