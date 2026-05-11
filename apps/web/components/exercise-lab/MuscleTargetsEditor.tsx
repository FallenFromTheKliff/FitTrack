"use client";

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
} from "@fittrack/utils";
import {
  FieldShell,
  clamp,
  formatRole,
  inputStyle,
  miniButtonStyle,
  panelStyle,
  toNumber,
  type EditorColors,
} from "./ExerciseContractEditorShared";
export function MuscleTargetsEditor({
  colors,
  fallbackMuscleGroup,
  muscleDefinitions,
  onManageMuscles,
  onChange,
  value,
}: {
  colors: EditorColors;
  fallbackMuscleGroup: string;
  muscleDefinitions?: MuscleDefinitionRecord[];
  onManageMuscles?: () => void;
  onChange: (nextTargets: ExerciseMuscleTargetRecord[]) => void;
  value: ExerciseMuscleTargetRecord[];
}) {
  const definitions = getCanonicalMuscleDefinitions(muscleDefinitions);
  const activeDefinitions = definitions.filter(
    (definition) => definition.isActive,
  );
  const targets = normalizeExerciseMuscleTargets(value, fallbackMuscleGroup);
  const total = targets.reduce((sum, target) => sum + target.allocationPercent, 0);
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
    <section style={panelStyle(colors)}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 12,
          justifyContent: "space-between",
        }}
      >
        <div>
          <strong style={{ color: colors.text }}>Muscle Effort XP</strong>
          <p style={{ color: colors.textMuted, margin: "4px 0 0" }}>
            Assign exactly 100% effort across the muscles used by this
            movement. Role modifiers shape the effective XP share without
            shrinking the total XP pool.
          </p>
        </div>
        <span
          style={{
            border: `1px solid ${
              total === 100 ? "#3ed875" : colors.borderStrong
            }`,
            borderRadius: 999,
            color: total === 100 ? "#3ed875" : colors.primary,
            fontSize: 12,
            fontWeight: 900,
            padding: "8px 11px",
          }}
        >
          {total}% total
        </span>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {targets.map((target, index) => (
          <div
            key={`${target.role}-${target.muscleGroup}-${index}`}
            style={{
              background: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: 16,
              display: "grid",
              gap: 10,
              gridTemplateColumns: "1.3fr 0.9fr 0.7fr auto",
              padding: 12,
            }}
          >
            <FieldShell colors={colors} label="Muscle">
              <select
                  name={`exercise-muscle-target-${index}`}
                  onChange={(event) =>
                    updateTarget(index, { muscleGroup: event.target.value })
                  }
                style={inputStyle(colors)}
                value={target.muscleGroup}
              >
                {activeDefinitions.some(
                  (definition) => definition.key === target.muscleGroup,
                ) ? null : (
                  <option value={target.muscleGroup}>
                    {getMuscleDefinitionLabel(target.muscleGroup, definitions)}
                    {" "}archived/unknown
                  </option>
                )}
                {activeDefinitions.map((definition) => (
                  <option key={definition.key} value={definition.key}>
                    {definition.name}
                  </option>
                ))}
              </select>
            </FieldShell>
            <FieldShell colors={colors} label="Role">
              <select
                name={`exercise-muscle-role-${index}`}
                onChange={(event) =>
                  updateTarget(index, {
                    role: event.target.value as ExerciseMuscleTargetRole,
                  })
                }
                style={inputStyle(colors)}
                value={target.role}
              >
                {EXERCISE_MUSCLE_TARGET_ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {formatRole(role)}
                  </option>
                ))}
              </select>
            </FieldShell>
            <FieldShell colors={colors} label="Effort %">
              <input
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
                style={inputStyle(colors)}
                type="number"
                value={target.allocationPercent}
              />
            </FieldShell>
            <button
              disabled={targets.length <= 1}
              onClick={() =>
                onChange(targets.filter((_, currentIndex) => currentIndex !== index))
              }
              style={{
                ...miniButtonStyle(colors),
                alignSelf: "end",
                opacity: targets.length <= 1 ? 0.45 : 1,
              }}
              type="button"
            >
              Remove
            </button>
            <span
              style={{
                color: colors.textMuted,
                fontSize: 12,
                gridColumn: "1 / -1",
              }}
            >
              Effective XP preview:{" "}
              <strong style={{ color: colors.text }}>
                {effectiveShareByMuscle.get(target.muscleGroup) ?? 0}%
              </strong>{" "}
              after {formatRole(target.role).toLowerCase()} role weighting.
            </span>
          </div>
        ))}
      </div>

      {total !== 100 ? (
        <span style={{ color: colors.primary, fontSize: 13, fontWeight: 800 }}>
          Save is blocked until Muscle Effort XP totals exactly 100%.
        </span>
      ) : null}

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
            opacity: firstUnusedMuscleGroup ? 1 : 0.45,
          }}
          type="button"
        >
          Add muscle target
        </button>
        {onManageMuscles ? (
          <button
            onClick={onManageMuscles}
            style={miniButtonStyle(colors)}
            type="button"
          >
            Manage Muscle Library
          </button>
        ) : null}
      </div>
    </section>
  );
}


