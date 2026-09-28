"use client";

import { Plus, Trash2 } from "lucide-react";
import type {
  ExerciseMuscleTargetRecord,
  ExerciseMuscleTargetRole,
  MuscleDefinitionRecord,
} from "@fittrack/api-client";
import {
  calculateMuscleEffortXpShares,
  EXERCISE_MUSCLE_GROUP_OPTIONS,
  EXERCISE_MUSCLE_TARGET_ROLE_OPTIONS,
  getCanonicalMuscleDefinitions,
  getMuscleDefinitionLabel,
  normalizeExerciseMuscleTargets,
  type ExerciseEditorValidationIssue,
} from "@fittrack/utils";
import {
  clamp,
  formatRole,
  inputStyle,
  miniButtonStyle,
  toNumber,
  type EditorColors,
} from "./ExerciseContractEditorShared";
import { FitSelect, FitText } from "@/components/fit";
import { useTheme } from "@/contexts/ThemeContext";

const MUSCLE_ALLOCATION_SUCCESS_COLOR = "#3ed875";
const MUSCLE_ALLOCATION_DANGER_COLOR = "#fca5a5";

export function MuscleTargetsEditor({
  colors,
  fallbackMuscleGroup,
  muscleDefinitions,
  onManageMuscles,
  onChange,
  validationIssues,
  value,
}: {
  colors: EditorColors;
  fallbackMuscleGroup: string;
  muscleDefinitions?: MuscleDefinitionRecord[];
  onManageMuscles?: () => void;
  onChange: (nextTargets: ExerciseMuscleTargetRecord[]) => void;
  validationIssues?: Array<ExerciseEditorValidationIssue & { stepId?: string }>;
  value: ExerciseMuscleTargetRecord[];
}) {
  const { colors: themeColors } = useTheme();
  const definitions = getCanonicalMuscleDefinitions(muscleDefinitions);
  const activeDefinitions = definitions.filter(
    (definition) => definition.isActive,
  );
  const targets = normalizeExerciseMuscleTargets(value, fallbackMuscleGroup);
  const targetValidationIssues = (validationIssues ?? []).filter(
    (issue) => issue.path === "muscleTargets",
  );
  const total = targets.reduce((sum, target) => sum + target.allocationPercent, 0);
  const allocationTone =
    total === 100
      ? MUSCLE_ALLOCATION_SUCCESS_COLOR
      : total > 100
        ? MUSCLE_ALLOCATION_DANGER_COLOR
        : themeColors.warning;
  const effortShares = calculateMuscleEffortXpShares(targets);
  const effectiveShareByMuscle = new Map(
    effortShares.map((share) => [share.muscleGroup, share.effectivePercent]),
  );
  const usedMuscleGroups = new Set(
    targets.map((target) => target.muscleGroup.trim().toLowerCase()),
  );
  const firstUnusedMuscleGroup = activeDefinitions.find(
    (definition) => !usedMuscleGroups.has(definition.key.toLowerCase()),
  );
  const nextMuscleGroup =
    firstUnusedMuscleGroup?.key ||
    fallbackMuscleGroup ||
    activeDefinitions[0]?.key ||
    EXERCISE_MUSCLE_GROUP_OPTIONS[0] ||
    "core";

  const updateTarget = (
    index: number,
    patch: Partial<ExerciseMuscleTargetRecord>,
  ) => {
    onChange(
      normalizeExerciseMuscleTargets(
        targets.map((target, currentIndex) =>
          currentIndex === index ? { ...target, ...patch } : target,
        ),
        fallbackMuscleGroup,
      ),
    );
  };

  return (
    <section
      className="exercise-lab-muscle-targets-editor"
      data-testid="exercise-lab-muscle-targets-editor"
      style={{ display: "grid", gap: 20 }}
    >
      <div
        className="exercise-muscle-target-intro"
        style={{
          alignItems: "center",
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <FitText
          as="p"
          style={{ color: colors.muted, fontSize: 12.5, lineHeight: 1.5, margin: 0 }}
        >
          Explain which muscles perform the movement. Targets must total exactly 100%.
        </FitText>
        {onManageMuscles ? (
          <button
            onClick={onManageMuscles}
            style={{ background: "transparent", border: 0, color: colors.primary, cursor: "pointer", font: "inherit", fontSize: 12.5, fontWeight: 800, marginLeft: "auto", padding: 0, whiteSpace: "nowrap" }}
            type="button"
          >
            Manage Muscle Library →
          </button>
        ) : null}
      </div>

      {targetValidationIssues.length ? (
        <div
          aria-label="Muscle target validation"
          data-exercise-field="muscleTargets"
          data-testid="exercise-lab-muscle-validation"
          role="alert"
          tabIndex={-1}
          style={{
            background: `${MUSCLE_ALLOCATION_DANGER_COLOR}12`,
            border: `1px solid ${MUSCLE_ALLOCATION_DANGER_COLOR}66`,
            borderRadius: 8,
            color: MUSCLE_ALLOCATION_DANGER_COLOR,
            display: "grid",
            gap: 3,
            fontSize: 11.5,
            lineHeight: 1.4,
            padding: "9px 11px",
          }}
        >
          {targetValidationIssues.map((issue, index) => (
            <span key={`${issue.code}-${index}`}>
              <strong>{issue.message}</strong> {issue.suggestion}
            </span>
          ))}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 12 }}>
        {targets.map((target, index) => (
          <div
            data-exercise-field="muscleTargets"
            key={`${target.role}-${target.muscleGroup}-${index}`}
            className="exercise-muscle-target-row"
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              display: "grid",
              gap: 12,
              gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) 120px auto auto",
              alignItems: "center",
              padding: 12,
            }}
          >
            <FitSelect
              aria-label={`Muscle target ${index + 1}`}
              compact
              fullWidth
              name={`exercise-muscle-target-${index}`}
              onChange={(event) =>
                updateTarget(index, { muscleGroup: event.target.value })
              }
              options={[
                ...(activeDefinitions.some(
                  (definition) => definition.key === target.muscleGroup,
                )
                  ? []
                  : [{
                      label: `${getMuscleDefinitionLabel(target.muscleGroup, definitions)} archived/unknown`,
                      value: target.muscleGroup,
                    }]),
                ...activeDefinitions.map((definition) => ({
                  label: definition.name,
                  value: definition.key,
                })),
              ]}
              style={{ minHeight: 36 }}
              value={target.muscleGroup}
            />
            <FitSelect
              aria-label={`Role for muscle target ${index + 1}`}
              compact
              fullWidth
              name={`exercise-muscle-role-${index}`}
              onChange={(event) =>
                updateTarget(index, {
                  role: event.target.value as ExerciseMuscleTargetRole,
                })
              }
              options={EXERCISE_MUSCLE_TARGET_ROLE_OPTIONS.map((role) => ({
                label: formatRole(role),
                value: role,
              }))}
              style={{ minHeight: 36 }}
              value={target.role}
            />
            <div style={{ alignItems: "center", display: "flex", gap: 6 }}>
              <input
                aria-label={`Effort percentage for muscle target ${index + 1}`}
                min={0}
                max={100}
                name={`exercise-muscle-allocation-${index}`}
                onChange={(event) =>
                  updateTarget(index, {
                    allocationPercent: Math.round(
                      clamp(toNumber(event.target.value, 0), 0, 100),
                    ),
                  })
                }
                style={{ ...inputStyle(colors), minHeight: 36, padding: "0 10px", textAlign: "right" }}
                type="number"
                value={target.allocationPercent}
              />
              <span style={{ color: colors.textMuted, fontSize: 12 }}>%</span>
            </div>
            <span style={{ color: colors.textMuted, fontSize: 11, whiteSpace: "nowrap" }}>
              ≈ <strong style={{ color: colors.primary, fontFamily: "inherit" }}>{effectiveShareByMuscle.get(target.muscleGroup) ?? 0}</strong> XP
            </span>
            <button
              aria-label={`Remove ${getMuscleDefinitionLabel(target.muscleGroup, definitions)}`}
              disabled={targets.length <= 1}
              onClick={() =>
                onChange(targets.filter((_, currentIndex) => currentIndex !== index))
              }
              style={{
                alignItems: "center",
                background: "transparent",
                border: 0,
                color: colors.textMuted,
                cursor: targets.length <= 1 ? "not-allowed" : "pointer",
                display: "inline-flex",
                justifyContent: "center",
                minHeight: 36,
                minWidth: 36,
                padding: 6,
                opacity: targets.length <= 1 ? 0.45 : 1,
              }}
              title="Remove target"
              type="button"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      {total !== 100 ? (
        <span style={{ color: allocationTone, fontSize: 13, fontWeight: 800 }}>
          Save is blocked until Muscle Effort XP totals exactly 100%.
        </span>
      ) : null}

      <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          disabled={!firstUnusedMuscleGroup}
          onClick={() =>
            onChange([
              ...targets,
              {
                allocationPercent: Math.max(0, 100 - total),
                muscleGroup: nextMuscleGroup,
                role: "secondary",
              },
            ])
          }
          style={{
            ...miniButtonStyle(colors),
            minHeight: 36,
            opacity: firstUnusedMuscleGroup ? 1 : 0.45,
          }}
          type="button"
        >
          <Plus size={15} />
          Add muscle target
        </button>
        </div>
        <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
          <div
            aria-label={`Muscle effort progress ${total}%`}
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={Math.min(total, 100)}
            role="progressbar"
            style={{ backgroundColor: colors.surface, borderRadius: 999, height: 8, overflow: "hidden", width: 160 }}
          >
            <div style={{ backgroundColor: allocationTone, borderRadius: 999, height: "100%", transition: "width 150ms ease", width: `${Math.min(total, 100)}%` }} />
          </div>
          <span style={{ color: allocationTone, fontFamily: "inherit", fontSize: 13, fontWeight: 800, minWidth: 38, textAlign: "right" }}>
            {total}%
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 680px) {
          .exercise-muscle-target-intro {
            align-items: flex-start !important;
            flex-direction: column !important;
          }

          .exercise-muscle-target-row {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .exercise-muscle-target-row > button,
          .exercise-muscle-target-row > span {
            justify-self: start !important;
          }
        }
      `}</style>
    </section>
  );
}


