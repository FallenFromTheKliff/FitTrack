"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type {
  ExerciseHandPosePreset,
  PoseMovementContractRecord,
  PoseSpatialRequirementsRecord,
} from "@fittrack/types";
import type {
  ExerciseHandShapeProfileRecord,
  ExerciseMovementProfileRecord,
  ExerciseMuscleTargetRecord,
  ExerciseMuscleTargetRole,
  ExerciseRigKeyframeKind,
  MuscleDefinitionRecord,
  PoseKeypointRecord,
} from "@fittrack/api-client";
import {
  buildFallbackPoseMovementContract,
  calculateMuscleEffortXpShares,
  createExerciseMovementProfile,
  createGeneratedExerciseRigFromMovementContract,
  EXERCISE_MUSCLE_GROUP_OPTIONS,
  EXERCISE_MUSCLE_TARGET_ROLE_OPTIONS,
  getCanonicalMuscleDefinitions,
  getMuscleDefinitionLabel,
  getPoseMovementContractAngle,
  normalizeExerciseHandShapeProfile,
  normalizeExerciseMovementProfile,
  normalizeExerciseMuscleTargets,
} from "@fittrack/utils";
import { ConfirmModal } from "@/components/modals";

type EditorColors = {
  background: string;
  border: string;
  borderStrong: string;
  card: string;
  muted: string;
  primary: string;
  surface: string;
  text: string;
  textMuted: string;
};

type ExerciseEditorTab = "basics" | "muscles" | "movement" | "hands" | "media";

const EDITOR_TABS: { label: string; value: ExerciseEditorTab }[] = [
  { label: "Basics", value: "basics" },
  { label: "Muscles", value: "muscles" },
  { label: "Movement rig", value: "movement" },
  { label: "Hand shapes", value: "hands" },
  { label: "Media", value: "media" },
];

const REQUIRED_SIDE_OPTIONS = [
  "both",
  "left",
  "right",
  "either",
  "alternating",
] as const;

const PARTIAL_REP_POLICY_OPTIONS = [
  "strict_full_rep",
  "count_half_reps",
  "review_only",
] as const;

type MovementEditorMode = "dynamic_rep" | "static_hold";
type RigTemplateKey =
  | "push"
  | "pull"
  | "squat"
  | "hinge"
  | "curl"
  | "press"
  | "dip"
  | "static_hold"
  | "blank";
type RigViewTransform = "front" | "side" | "floor" | "mirror" | "rotate90";
type SpatialRulePreset =
  | "none"
  | "ground_press"
  | "vertical_pull"
  | "squat_hinge"
  | "custom";

const MOVEMENT_MODE_OPTIONS: {
  description: string;
  label: string;
  value: MovementEditorMode;
}[] = [
  {
    description: "Start, peak contraction, return, and rep thresholds.",
    label: "Dynamic reps",
    value: "dynamic_rep",
  },
  {
    description: "Setup, hold, exit, and stability tolerance rules.",
    label: "Static hold",
    value: "static_hold",
  },
];

const DYNAMIC_REP_MODEL_OPTIONS = [
  "bilateral",
  "unilateral_left",
  "unilateral_right",
  "alternating",
] as const;

const STATIC_REQUIRED_SIDE_OPTIONS = ["both", "left", "right", "either"] as const;

const RIG_TEMPLATE_OPTIONS: {
  label: string;
  value: RigTemplateKey;
}[] = [
  { label: "Push", value: "push" },
  { label: "Pull", value: "pull" },
  { label: "Squat", value: "squat" },
  { label: "Hinge", value: "hinge" },
  { label: "Curl", value: "curl" },
  { label: "Press", value: "press" },
  { label: "Dip", value: "dip" },
  { label: "Static hold", value: "static_hold" },
  { label: "Blank rig", value: "blank" },
];

const TEMPLATE_EXERCISE_LABELS: Record<RigTemplateKey, string> = {
  blank: "Custom blank",
  curl: "Dumbbell Bicep Curl",
  dip: "Dip",
  hinge: "Hip Hinge",
  press: "Shoulder Press",
  pull: "Pull Up",
  push: "Push Up",
  squat: "Squat",
  static_hold: "Plank",
};

const SPATIAL_RULE_PRESET_OPTIONS: {
  description: string;
  label: string;
  value: SpatialRulePreset;
}[] = [
  {
    description: "Angle and side rules only; bilateral exercises keep symmetry.",
    label: "None",
    value: "none",
  },
  {
    description: "Hands anchored, torso line, body travel, and left/right sync.",
    label: "Ground press",
    value: "ground_press",
  },
  {
    description: "Vertical pulling depth with shoulder travel and torso drift limits.",
    label: "Vertical pull",
    value: "vertical_pull",
  },
  {
    description: "Lower-body depth with hip/knee travel, torso control, and foot stability.",
    label: "Squat / hinge",
    value: "squat_hinge",
  },
  {
    description: "Expose every spatial field for specialized exercises.",
    label: "Custom",
    value: "custom",
  },
];

const TEMPLATE_SPATIAL_PRESETS: Record<RigTemplateKey, SpatialRulePreset> = {
  blank: "none",
  curl: "none",
  dip: "ground_press",
  hinge: "squat_hinge",
  press: "none",
  pull: "vertical_pull",
  push: "ground_press",
  squat: "squat_hinge",
  static_hold: "ground_press",
};

const TEMPLATE_DEFAULT_VIEWS: Record<RigTemplateKey, RigViewTransform> = {
  blank: "front",
  curl: "front",
  dip: "side",
  hinge: "side",
  press: "front",
  pull: "front",
  push: "side",
  squat: "side",
  static_hold: "side",
};

const RIG_VIEW_OPTIONS: { label: string; value: RigViewTransform }[] = [
  { label: "Front", value: "front" },
  { label: "Side", value: "side" },
  { label: "Floor", value: "floor" },
  { label: "Mirror", value: "mirror" },
  { label: "Rotate 90", value: "rotate90" },
];

const RIG_BONES = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
] as const;

const LANDMARK_LABELS = [
  "nose",
  "left eye inner",
  "left eye",
  "left eye outer",
  "right eye inner",
  "right eye",
  "right eye outer",
  "left ear",
  "right ear",
  "mouth left",
  "mouth right",
  "left shoulder",
  "right shoulder",
  "left elbow",
  "right elbow",
  "left wrist",
  "right wrist",
  "left pinky",
  "right pinky",
  "left index",
  "right index",
  "left thumb",
  "right thumb",
  "left hip",
  "right hip",
  "left knee",
  "right knee",
  "left ankle",
  "right ankle",
  "left heel",
  "right heel",
  "left foot",
  "right foot",
];

const HAND_LANDMARK_LABELS = [
  "wrist",
  "thumb CMC",
  "thumb MCP",
  "thumb IP",
  "thumb tip",
  "index MCP",
  "index PIP",
  "index DIP",
  "index tip",
  "middle MCP",
  "middle PIP",
  "middle DIP",
  "middle tip",
  "ring MCP",
  "ring PIP",
  "ring DIP",
  "ring tip",
  "pinky MCP",
  "pinky PIP",
  "pinky DIP",
  "pinky tip",
];

const FIELD_HELP: Record<string, string> = {
  "1. movement type":
    "Choose whether this exercise is counted by repeated motion or held for time.",
  "2. keyframes":
    "Keyframes are the important positions of the exercise: start, hardest/peak position, and return.",
  "allowed open frames":
    "How many recent frames can look like an open hand before the system rejects the grip.",
  "angle at keyframe":
    "The joint angle shown for the selected frame, such as elbow angle at the top of a curl.",
  "body line tolerance":
    "How much body alignment can drift during a hold before the pose is considered sloppy.",
  "down angle": "The joint angle that marks the lowered or stretched part of the rep.",
  "down tolerance": "How much wiggle room is allowed around the down angle.",
  "exp %": "How much of this exercise's muscle experience goes to this muscle.",
  "finger lift": "How far a fingertip must rise from the hand to count as extended.",
  "finger spread x":
    "How far fingers must separate horizontally to count as the lock gesture.",
  "hold ms": "How long the gesture must stay stable before it counts.",
  "horn lift delta": "How similar the two raised rock-sign fingers must be in height.",
  "max body x drift": "How much the body can shift sideways during a hold.",
  "min usable frames":
    "Minimum number of clear hand frames needed before grip detection trusts the result.",
  "open-palm ratio":
    "How open the hand is allowed to look. Lower values make grip detection stricter.",
  "partial rep policy":
    "What to do with incomplete reps: reject them, count half reps, or flag for review.",
  "point visibility": "How confident the camera must be before using a hand landmark.",
  "recent frame window":
    "How many recent camera frames are checked together to smooth hand detection.",
  "required sides":
    "Which body side must satisfy the rule: left, right, either, both, or alternating.",
  "role":
    "Primary muscles do most of the work. Secondary and stabilizer muscles support the movement.",
  "selected hand node":
    "The hand point you are editing. Tips are fingertips; MCP/PIP/DIP are finger joints.",
  "selected landmark":
    "The body point you are editing, such as left elbow, right wrist, or left knee.",
  "side model":
    "How the movement uses body sides: both sides together, one side only, or alternating sides.",
  "thumb separation":
    "How far the thumb must separate from the hand for the gesture rule.",
  "up angle": "The joint angle that marks the lifted or contracted part of the rep.",
  "up tolerance": "How much wiggle room is allowed around the up angle.",
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundToStep(value: number, step = 0.005) {
  return Math.round((Math.round(value / step) * step) * 1000) / 1000;
}

function formatRole(value: ExerciseMuscleTargetRole) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function panelStyle(colors: EditorColors): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${colors.surface}, ${colors.card})`,
    border: `1px solid ${colors.border}`,
    borderRadius: 18,
    display: "grid",
    gap: 14,
    padding: 16,
  };
}

function inputStyle(colors: EditorColors): CSSProperties {
  return {
    background: colors.background,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: 12,
    color: colors.text,
    font: "inherit",
    padding: "10px 12px",
    width: "100%",
  };
}

function miniButtonStyle(
  colors: EditorColors,
  active = false,
): CSSProperties {
  return {
    background: active ? colors.primary : colors.surface,
    border: `1px solid ${active ? colors.primary : colors.border}`,
    borderRadius: 999,
    color: active ? "#090909" : colors.text,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 12px",
  };
}

function FieldLabel({
  children,
  colors,
}: {
  children: ReactNode;
  colors: EditorColors;
}) {
  const help =
    typeof children === "string" ? FIELD_HELP[children.toLowerCase()] : undefined;
  return (
    <span
      style={{
        alignItems: "center",
        color: colors.textMuted,
        display: "inline-flex",
        fontSize: 10,
        fontWeight: 800,
        gap: 6,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
      }}
    >
      {children}
      {help ? (
        <span
          aria-label={`${children} help`}
          style={{
            alignItems: "center",
            border: `1px solid ${colors.border}`,
            borderRadius: 999,
            color: colors.textMuted,
            cursor: "help",
            display: "inline-flex",
            fontSize: 9,
            height: 15,
            justifyContent: "center",
            letterSpacing: 0,
            lineHeight: 1,
            textTransform: "none",
            width: 15,
          }}
          title={help}
        >
          ?
        </span>
      ) : null}
    </span>
  );
}

function FieldShell({
  children,
  colors,
  label,
}: {
  children: ReactNode;
  colors: EditorColors;
  label: string;
}) {
  return (
    <label style={{ display: "grid", gap: 7 }}>
      <FieldLabel colors={colors}>{label}</FieldLabel>
      {children}
    </label>
  );
}

export function ExerciseEditorTabs({
  activeTab,
  colors,
  onChange,
}: {
  activeTab: ExerciseEditorTab;
  colors: EditorColors;
  onChange: (tab: ExerciseEditorTab) => void;
}) {
  return (
    <div
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: 6,
      }}
    >
      {EDITOR_TABS.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          style={miniButtonStyle(colors, activeTab === tab.value)}
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

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

function getKeypointPosition(point: PoseKeypointRecord | undefined) {
  if (!point) return null;
  if (point.visibility < 0.1) return null;
  return {
    cx: clamp(point.x, -0.2, 1.2) * 100,
    cy: clamp(point.y, -0.2, 1.2) * 100,
  };
}

function interpolatePoint(
  start: PoseKeypointRecord | undefined,
  end: PoseKeypointRecord | undefined,
  progress: number,
): PoseKeypointRecord | undefined {
  if (!start && !end) return undefined;
  if (!start) return end;
  if (!end) return start;
  return {
    visibility: start.visibility + (end.visibility - start.visibility) * progress,
    x: start.x + (end.x - start.x) * progress,
    y: start.y + (end.y - start.y) * progress,
    z: start.z + (end.z - start.z) * progress,
  };
}

function interpolateKeypoints(
  from: PoseKeypointRecord[],
  to: PoseKeypointRecord[],
  progress: number,
) {
  const length = Math.max(from.length, to.length);
  return Array.from({ length }, (_, index) =>
    interpolatePoint(from[index], to[index], progress),
  );
}

function getAnimatedKeypoints(
  keyframes: NonNullable<ExerciseMovementProfileRecord["rig"]>["keyframes"],
  progress: number,
) {
  const startFrame =
    keyframes.find((frame) => frame.kind === "start") ?? keyframes[0];
  const peakFrame =
    keyframes.find((frame) => frame.kind === "peak") ??
    keyframes[Math.min(1, keyframes.length - 1)] ??
    startFrame;
  const endFrame =
    keyframes.find((frame) => frame.kind === "end") ??
    keyframes[keyframes.length - 1] ??
    peakFrame;
  if (!startFrame || !peakFrame || !endFrame) return [];
  if (progress <= 1) {
    return interpolateKeypoints(startFrame.keypoints, peakFrame.keypoints, progress);
  }
  return interpolateKeypoints(peakFrame.keypoints, endFrame.keypoints, progress - 1);
}

const FRAME_LABELS: Record<MovementEditorMode, Record<ExerciseRigKeyframeKind, string>> = {
  dynamic_rep: {
    end: "Return",
    peak: "Peak contraction",
    start: "Start",
  },
  static_hold: {
    end: "Exit",
    peak: "Hold",
    start: "Setup",
  },
};

const SIDE_ANGLE_TRIPLES = {
  elbow: {
    left: [11, 13, 15],
    right: [12, 14, 16],
  },
  hip: {
    left: [11, 23, 25],
    right: [12, 24, 26],
  },
  knee: {
    left: [23, 25, 27],
    right: [24, 26, 28],
  },
  shoulder: {
    left: [23, 11, 13],
    right: [24, 12, 14],
  },
} as const;

function inferMovementMode(
  contract: PoseMovementContractRecord | null | undefined,
): MovementEditorMode {
  return contract?.repModel === "static_hold" ? "static_hold" : "dynamic_rep";
}

function getFrameLabel(
  kind: ExerciseRigKeyframeKind,
  mode: MovementEditorMode,
  current?: string | null,
) {
  const label = current?.trim();
  if (label && !["Start position", "Peak contraction", "Return", "Start", "Setup", "Hold", "Exit"].includes(label)) {
    return label;
  }
  return FRAME_LABELS[mode][kind];
}

function relabelRigFrames(
  rig: ExerciseMovementProfileRecord["rig"],
  mode: MovementEditorMode,
) {
  if (!rig) return rig;
  return {
    ...rig,
    keyframes: rig.keyframes.map((frame) => ({
      ...frame,
      label: getFrameLabel(frame.kind, mode, frame.label),
    })),
  };
}

function createManualMovementContract({
  dominantJoint,
  exercise,
  repModel = "unknown",
  requiredSides = "either",
}: {
  dominantJoint: PoseMovementContractRecord["dominantJoint"];
  exercise: string;
  repModel?: NonNullable<PoseMovementContractRecord["repModel"]>;
  requiredSides?: NonNullable<PoseMovementContractRecord["requiredSides"]>;
}): PoseMovementContractRecord {
  return {
    degradedConditions: ["Manual template requires admin verification."],
    dominantJoint,
    exercise,
    noCountConditions: ["Movement profile is incomplete."],
    oscillatingJoints: [dominantJoint],
    partialRepPolicy: repModel === "static_hold" ? "review_only" : "count_half_reps",
    phaseOrder:
      repModel === "static_hold" ? ["setup", "hold", "exit"] : ["start", "peak", "return"],
    primaryJoints:
      dominantJoint === "elbow"
        ? ["left_elbow", "right_elbow"]
        : dominantJoint === "knee"
          ? ["left_knee", "right_knee"]
          : dominantJoint === "hip"
            ? ["left_hip", "right_hip"]
            : ["left_shoulder", "right_shoulder"],
    repModel,
    repThresholds: {
      down: { angle: 110, tolerance: 18 },
      up: { angle: 150, tolerance: 18 },
    },
    requiredSides,
    secondaryCheck: "manual_visual_editor",
    secondaryJoints: [],
    spatialRequirements: {
      bodyLineTolerance: 28,
      leftRightSymmetryTolerance: 28,
    },
  };
}

function getTemplateContract(
  template: RigTemplateKey,
): PoseMovementContractRecord {
  const fallback = buildFallbackPoseMovementContract(TEMPLATE_EXERCISE_LABELS[template]);
  if (fallback) return fallback;
  if (template === "hinge") {
    return createManualMovementContract({
      dominantJoint: "hip",
      exercise: TEMPLATE_EXERCISE_LABELS[template],
      repModel: "bilateral",
      requiredSides: "both",
    });
  }
  return createManualMovementContract({
    dominantJoint: "elbow",
    exercise: TEMPLATE_EXERCISE_LABELS[template],
  });
}

function isBilateralLike(contract?: PoseMovementContractRecord | null) {
  return contract?.repModel === "bilateral" || contract?.requiredSides === "both";
}

function getExerciseSpatialText(
  contract?: PoseMovementContractRecord | null,
  exerciseName?: string,
) {
  return `${exerciseName ?? ""} ${contract?.exercise ?? ""}`.toLowerCase();
}

function hasMeaningfulSpatialValue(
  spatial: PoseSpatialRequirementsRecord | null | undefined,
  key: keyof PoseSpatialRequirementsRecord,
) {
  const value = spatial?.[key];
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getMinimalSideSpatialRequirements(
  contract?: PoseMovementContractRecord | null,
): PoseSpatialRequirementsRecord | null {
  if (!isBilateralLike(contract)) return null;
  return {
    leftRightSymmetryTolerance:
      contract?.spatialRequirements?.leftRightSymmetryTolerance ?? 45,
  };
}

function getSpatialRequirementsForPreset(
  preset: SpatialRulePreset,
  contract?: PoseMovementContractRecord | null,
): PoseSpatialRequirementsRecord | null {
  if (preset === "none") {
    return getMinimalSideSpatialRequirements(contract);
  }
  if (preset === "custom") {
    return contract?.spatialRequirements ?? getMinimalSideSpatialRequirements(contract);
  }
  if (preset === "ground_press") {
    return {
      bodyLineTolerance: 86,
      bodyXDriftMax: 0.22,
      bodyYTravelMin: 0.012,
      hipYTravelMin: 0.01,
      leftRightSymmetryTolerance: 60,
      phaseSyncToleranceMs: 650,
      shoulderHipTravelMin: 0.01,
      shoulderYTravelMin: 0.008,
      torsoSlopeMaxDeg: 92,
      torsoSlopeMinDeg: 0,
      wristAnchorDriftMax: 0.18,
    };
  }
  if (preset === "vertical_pull") {
    return {
      bodyLineTolerance: 45,
      bodyXDriftMax: 0.16,
      bodyYTravelMin: 0,
      leftRightSymmetryTolerance: 45,
      phaseSyncToleranceMs: 700,
      shoulderYTravelMin: 0.012,
      torsoSlopeMaxDeg: 35,
      torsoSlopeMinDeg: 0,
    };
  }
  return {
    bodyLineTolerance: 45,
    bodyXDriftMax: 0.1,
    bodyYTravelMin: 0.02,
    hipYTravelMin: 0.02,
    leftRightSymmetryTolerance: 35,
    phaseSyncToleranceMs: 450,
    shoulderHipTravelMin: 0.015,
    torsoSlopeMaxDeg: 125,
    torsoSlopeMinDeg: 0,
  };
}

function getSpatialSecondaryCheck(
  preset: SpatialRulePreset,
  fallback: string,
) {
  if (preset === "none") return "angle_side_rules";
  if (preset === "ground_press") return "spatial_ground_press";
  if (preset === "vertical_pull") return "spatial_vertical_pull";
  if (preset === "squat_hinge") return "spatial_squat_hinge";
  return fallback || "custom_spatial_rules";
}

function inferSpatialPreset(
  contract?: PoseMovementContractRecord | null,
  exerciseName?: string,
): SpatialRulePreset {
  const spatial = contract?.spatialRequirements;
  if (!spatial) return "none";
  const text = getExerciseSpatialText(contract, exerciseName);
  if (/(push[\s-]?up|dip|plank|ground press|incline)/.test(text)) {
    return "ground_press";
  }
  if (/(pull[\s-]?up|lat|pulldown|vertical pull)/.test(text)) {
    return "vertical_pull";
  }
  if (/(squat|hinge|deadlift|lunge)/.test(text)) {
    return "squat_hinge";
  }
  const spatialKeys = Object.keys(spatial).filter(
    (key) =>
      key !== "leftRightSymmetryTolerance" &&
      hasMeaningfulSpatialValue(
        spatial,
        key as keyof PoseSpatialRequirementsRecord,
      ),
  );
  return spatialKeys.length ? "custom" : "none";
}

function getPreferredViewForSpatialPreset(
  preset: SpatialRulePreset,
  contract?: PoseMovementContractRecord | null,
  exerciseName?: string,
): RigViewTransform {
  const text = getExerciseSpatialText(contract, exerciseName);
  if (preset === "ground_press") return "side";
  if (preset === "squat_hinge") return "side";
  if (/(floor|plank)/.test(text)) return "floor";
  return "front";
}

function getSpatialPresetLabel(preset: SpatialRulePreset) {
  return (
    SPATIAL_RULE_PRESET_OPTIONS.find((option) => option.value === preset)?.label ??
    "Custom"
  );
}

function patchContractForMode(
  contract: PoseMovementContractRecord,
  mode: MovementEditorMode,
): PoseMovementContractRecord {
  if (mode === "static_hold") {
    return {
      ...contract,
      partialRepPolicy: "review_only",
      phaseOrder: ["setup", "hold", "exit"],
      repModel: "static_hold",
      requiredSides:
        contract.requiredSides === "alternating" ? "either" : contract.requiredSides ?? "either",
      spatialRequirements: {
        ...contract.spatialRequirements,
        bodyLineTolerance: contract.spatialRequirements?.bodyLineTolerance ?? 28,
        bodyXDriftMax: contract.spatialRequirements?.bodyXDriftMax ?? 0.08,
        bodyYTravelMin: contract.spatialRequirements?.bodyYTravelMin ?? 0,
      },
    };
  }
  const nextRepModel =
    contract.repModel === "static_hold" || contract.repModel === "unknown"
      ? "bilateral"
      : contract.repModel;
  return {
    ...contract,
    partialRepPolicy: contract.partialRepPolicy ?? "count_half_reps",
    phaseOrder: ["start", "peak", "return"],
    repModel: nextRepModel,
    requiredSides: nextRepModel === "bilateral" ? "both" : contract.requiredSides ?? "either",
    spatialRequirements: {
      ...contract.spatialRequirements,
      leftRightSymmetryTolerance:
        contract.spatialRequirements?.leftRightSymmetryTolerance ?? 28,
    },
  };
}

function patchContractForRepModel(
  contract: PoseMovementContractRecord,
  repModel: (typeof DYNAMIC_REP_MODEL_OPTIONS)[number],
): PoseMovementContractRecord {
  const requiredSides =
    repModel === "bilateral"
      ? "both"
      : repModel === "unilateral_left"
        ? "left"
        : repModel === "unilateral_right"
          ? "right"
          : "alternating";
  return {
    ...contract,
    repModel,
    requiredSides,
    spatialRequirements: {
      ...contract.spatialRequirements,
      leftRightSymmetryTolerance:
        contract.spatialRequirements?.leftRightSymmetryTolerance ?? 28,
    },
  };
}

function transformPointForView(
  point: PoseKeypointRecord,
  transform: RigViewTransform,
): PoseKeypointRecord {
  const x = point.x;
  const y = point.y;
  if (transform === "mirror") return { ...point, x: 1 - x };
  if (transform === "side") return { ...point, x: 0.5 + (x - 0.5) * 0.72 };
  if (transform === "floor") return { ...point, x: y, y: 1 - x };
  if (transform === "rotate90") {
    return {
      ...point,
      x: 0.5 + (y - 0.5),
      y: 0.5 - (x - 0.5),
    };
  }
  return point;
}

function inverseEditableViewPoint(
  x: number,
  y: number,
  transform: RigViewTransform,
) {
  if (transform === "mirror") return { x: 1 - x, y };
  return { x, y };
}

function getAngleFromTriple(
  points: PoseKeypointRecord[],
  triple: readonly [number, number, number],
) {
  const [aIndex, bIndex, cIndex] = triple;
  const a = points[aIndex];
  const b = points[bIndex];
  const c = points[cIndex];
  if (!a || !b || !c) return null;
  if (a.visibility < 0.1 || b.visibility < 0.1 || c.visibility < 0.1) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magA = Math.hypot(ab.x, ab.y);
  const magC = Math.hypot(cb.x, cb.y);
  if (!magA || !magC) return null;
  return Math.round(
    (Math.acos(clamp(dot / (magA * magC), -1, 1)) * 180) / Math.PI,
  );
}

function getSideAngleSummaries(
  contract: PoseMovementContractRecord | null | undefined,
  points: PoseKeypointRecord[],
) {
  const joint = contract?.dominantJoint ?? "elbow";
  const triples = SIDE_ANGLE_TRIPLES[joint] ?? SIDE_ANGLE_TRIPLES.elbow;
  return {
    left: getAngleFromTriple(points, triples.left),
    leftJointIndex: triples.left[1],
    right: getAngleFromTriple(points, triples.right),
    rightJointIndex: triples.right[1],
  };
}

function describeAngleArc(cx: number, cy: number, radius: number, sweep = 240) {
  const start = (-110 * Math.PI) / 180;
  const end = ((-110 + sweep) * Math.PI) / 180;
  const startX = cx + Math.cos(start) * radius;
  const startY = cy + Math.sin(start) * radius;
  const endX = cx + Math.cos(end) * radius;
  const endY = cy + Math.sin(end) * radius;
  return `M ${startX} ${startY} A ${radius} ${radius} 0 1 1 ${endX} ${endY}`;
}

export function MovementProfileEditor({
  colors,
  exerciseName,
  onChange,
  value,
}: {
  colors: EditorColors;
  exerciseName?: string;
  onChange: (nextProfile: ExerciseMovementProfileRecord | null) => void;
  value: ExerciseMovementProfileRecord | null;
}) {
  const profile = normalizeExerciseMovementProfile(value);
  const rig = profile?.rig ?? null;
  const keyframes = rig?.keyframes ?? [];
  const generatedContract = useMemo(
    () => profile?.movementContract ?? buildFallbackPoseMovementContract(exerciseName),
    [exerciseName, profile?.movementContract],
  );
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [activeKind, setActiveKind] = useSafeKeyframeKind(keyframes);
  const [dragPoint, setDragPoint] = useState<number | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const lastDragAtRef = useRef(0);
  const [previewMotion, setPreviewMotion] = useState(false);
  const [selectedTemplate, setSelectedTemplate] =
    useState<RigTemplateKey | null>(null);
  const [regenerateConfirmTemplate, setRegenerateConfirmTemplate] =
    useState<RigTemplateKey | "generated" | null>(null);
  const [spatialPresetOverride, setSpatialPresetOverride] =
    useState<SpatialRulePreset | null>(null);
  const [viewTransform, setViewTransform] = useState<RigViewTransform>("front");
  const viewDefaultKeyRef = useRef("");
  const activeIndex = Math.max(
    0,
    keyframes.findIndex((frame) => frame.kind === activeKind),
  );
  const activeFrame = keyframes[activeIndex] ?? null;
  const [selectedPoint, setSelectedPoint] = useSafePointIndex(activeFrame);
  const contract = profile?.movementContract ?? generatedContract;
  const movementMode = inferMovementMode(contract);
  const inferredSpatialPreset = useMemo(
    () => inferSpatialPreset(contract, exerciseName),
    [contract, exerciseName],
  );
  const spatialPreset = spatialPresetOverride ?? inferredSpatialPreset;
  const shouldPreferDepthView =
    spatialPreset === "ground_press" || spatialPreset === "squat_hinge";
  const frontViewDepthWarning = shouldPreferDepthView && viewTransform === "front";
  const editableView = viewTransform === "front" || viewTransform === "mirror";
  const sourcePoints =
    previewMotion && keyframes.length >= 2
      ? getAnimatedKeypoints(keyframes, animationProgress)
      : activeFrame?.keypoints ?? [];
  const displayPoints = sourcePoints.map((point) =>
    point ? transformPointForView(point, viewTransform) : point,
  );
  const activeAngleSummaries = getSideAngleSummaries(
    contract,
    activeFrame?.keypoints ?? [],
  );
  const dominantSide =
    contract?.requiredSides === "right" || contract?.repModel === "unilateral_right"
      ? "right"
      : "left";
  const dominantAngle =
    dominantSide === "right"
      ? activeAngleSummaries.right
      : activeAngleSummaries.left ?? activeAngleSummaries.right;
  const dominantJointIndex =
    dominantSide === "right"
      ? activeAngleSummaries.rightJointIndex
      : activeAngleSummaries.leftJointIndex;
  const dominantJointPoint = activeFrame?.keypoints[dominantJointIndex]
    ? transformPointForView(activeFrame.keypoints[dominantJointIndex], viewTransform)
    : undefined;
  const dominantJointPosition = getKeypointPosition(dominantJointPoint);
  const symmetryDelta =
    typeof activeAngleSummaries.left === "number" &&
    typeof activeAngleSummaries.right === "number"
      ? Math.abs(activeAngleSummaries.left - activeAngleSummaries.right)
      : null;
  const symmetryLimit =
    contract?.spatialRequirements?.leftRightSymmetryTolerance ?? 28;
  const leftShoulderPosition = getKeypointPosition(displayPoints[11]);
  const rightShoulderPosition = getKeypointPosition(displayPoints[12]);
  const leftHipPosition = getKeypointPosition(displayPoints[23]);
  const rightHipPosition = getKeypointPosition(displayPoints[24]);
  const leftWristPosition = getKeypointPosition(displayPoints[15]);
  const rightWristPosition = getKeypointPosition(displayPoints[16]);
  const shoulderCenterPosition =
    leftShoulderPosition && rightShoulderPosition
      ? {
          cx: (leftShoulderPosition.cx + rightShoulderPosition.cx) / 2,
          cy: (leftShoulderPosition.cy + rightShoulderPosition.cy) / 2,
        }
      : (leftShoulderPosition ?? rightShoulderPosition);
  const hipCenterPosition =
    leftHipPosition && rightHipPosition
      ? {
          cx: (leftHipPosition.cx + rightHipPosition.cx) / 2,
          cy: (leftHipPosition.cy + rightHipPosition.cy) / 2,
        }
      : (leftHipPosition ?? rightHipPosition);

  useEffect(() => {
    if (!contract) return;
    const viewDefaultKey = `${exerciseName ?? ""}:${contract.exercise}:${movementMode}:${keyframes.length}`;
    if (viewDefaultKeyRef.current === viewDefaultKey) return;
    viewDefaultKeyRef.current = viewDefaultKey;
    const nextPreset = inferSpatialPreset(contract, exerciseName);
    setSpatialPresetOverride(null);
    setViewTransform(
      getPreferredViewForSpatialPreset(nextPreset, contract, exerciseName),
    );
  }, [contract, exerciseName, keyframes.length, movementMode]);

  useEffect(() => {
    if (!previewMotion || keyframes.length < 2) return undefined;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) % 2400;
      setAnimationProgress(elapsed <= 1200 ? elapsed / 1200 : 2 - elapsed / 1200);
    }, 80);
    return () => window.clearInterval(interval);
  }, [keyframes.length, previewMotion]);

  useEffect(() => {
    if (dragPoint === null) return undefined;
    const clearDrag = () => {
      dragPointerIdRef.current = null;
      setDragPoint(null);
    };
    window.addEventListener("pointerup", clearDrag);
    window.addEventListener("pointercancel", clearDrag);
    window.addEventListener("blur", clearDrag);
    return () => {
      window.removeEventListener("pointerup", clearDrag);
      window.removeEventListener("pointercancel", clearDrag);
      window.removeEventListener("blur", clearDrag);
    };
  }, [dragPoint]);

  const patchProfile = (nextProfile: ExerciseMovementProfileRecord | null) => {
    onChange(nextProfile ? normalizeExerciseMovementProfile(nextProfile) : null);
  };

  const applyGeneratedProfile = (template?: RigTemplateKey) => {
    const sourceContract = template
      ? getTemplateContract(template)
      : generatedContract;
    if (!sourceContract) return;
    const nextMode = inferMovementMode(sourceContract);
    const baseContract = patchContractForMode(sourceContract, nextMode);
    const nextPreset = template
      ? TEMPLATE_SPATIAL_PRESETS[template]
      : inferSpatialPreset(baseContract, exerciseName);
    const movementContract: PoseMovementContractRecord = {
      ...baseContract,
      secondaryCheck: getSpatialSecondaryCheck(
        nextPreset,
        baseContract.secondaryCheck,
      ),
      spatialRequirements: getSpatialRequirementsForPreset(
        nextPreset,
        baseContract,
      ),
    };
    setSpatialPresetOverride(nextPreset);
    setViewTransform(
      template
        ? TEMPLATE_DEFAULT_VIEWS[template]
        : getPreferredViewForSpatialPreset(
            nextPreset,
            movementContract,
            exerciseName,
          ),
    );
    const generatedRig = createGeneratedExerciseRigFromMovementContract({
      exerciseLabel:
        template ? TEMPLATE_EXERCISE_LABELS[template] : exerciseName ?? movementContract.exercise,
      movementContract,
    });
    patchProfile(
      createExerciseMovementProfile({
        movementContract,
        rig: relabelRigFrames(generatedRig, nextMode),
        warnings: [
          template
            ? `Generated starter rig from the ${TEMPLATE_EXERCISE_LABELS[template]} template. Adjust before publishing.`
            : "Generated starter rig from the known movement contract. Adjust before publishing.",
          `Spatial rules preset: ${getSpatialPresetLabel(nextPreset)}. Starter rules are editable.`,
        ],
      }),
    );
  };

  const createGeneratedProfile = (template?: RigTemplateKey) => {
    if (rig) {
      setRegenerateConfirmTemplate(template ?? "generated");
      return;
    }

    applyGeneratedProfile(template);
  };

  const handleConfirmRegenerate = () => {
    const template =
      regenerateConfirmTemplate === "generated"
        ? undefined
        : regenerateConfirmTemplate ?? undefined;
    setRegenerateConfirmTemplate(null);
    applyGeneratedProfile(template);
  };

  const patchMovementContract = (
    patch: Partial<NonNullable<ExerciseMovementProfileRecord["movementContract"]>>,
  ) => {
    const currentContract = contract;
    if (!currentContract) return;
    patchProfile(
      createExerciseMovementProfile({
        movementContract: { ...currentContract, ...patch },
        rig,
        warnings: profile?.warnings ?? [],
      }),
    );
  };

  const setMovementMode = (nextMode: MovementEditorMode) => {
    const currentContract =
      contract ??
      createManualMovementContract({
        dominantJoint: "elbow",
        exercise: exerciseName ?? "Custom exercise",
      });
    patchProfile(
      createExerciseMovementProfile({
        movementContract: patchContractForMode(currentContract, nextMode),
        rig: relabelRigFrames(rig, nextMode),
        warnings: profile?.warnings ?? [],
      }),
    );
  };

  const setRepModel = (repModel: (typeof DYNAMIC_REP_MODEL_OPTIONS)[number]) => {
    if (!contract) return;
    patchMovementContract(patchContractForRepModel(contract, repModel));
  };

  const setSpatialPreset = (nextPreset: SpatialRulePreset) => {
    const currentContract =
      contract ??
      createManualMovementContract({
        dominantJoint: "elbow",
        exercise: exerciseName ?? "Custom exercise",
      });
    const nextContract: PoseMovementContractRecord = {
      ...currentContract,
      secondaryCheck: getSpatialSecondaryCheck(
        nextPreset,
        currentContract.secondaryCheck,
      ),
      spatialRequirements: getSpatialRequirementsForPreset(
        nextPreset,
        currentContract,
      ),
    };
    setSpatialPresetOverride(nextPreset);
    if (nextPreset !== "none") {
      setViewTransform(
        getPreferredViewForSpatialPreset(nextPreset, nextContract, exerciseName),
      );
    }
    patchProfile(
      createExerciseMovementProfile({
        movementContract: nextContract,
        rig,
        warnings: profile?.warnings ?? [],
      }),
    );
  };

  const patchThreshold = (
    phase: "down" | "up",
    patch: Partial<NonNullable<typeof contract>["repThresholds"]["down"]>,
  ) => {
    if (!contract) return;
    patchMovementContract({
      repThresholds: {
        ...contract.repThresholds,
        [phase]: {
          ...contract.repThresholds[phase],
          ...patch,
        },
      },
    });
  };

  const patchSpatialRequirement = (
    patch: Partial<NonNullable<PoseMovementContractRecord["spatialRequirements"]>>,
  ) => {
    if (!contract) return;
    patchMovementContract({
      spatialRequirements: {
        ...contract.spatialRequirements,
        ...patch,
      },
    });
  };

  const patchActiveFrame = (
    patch: Partial<NonNullable<typeof activeFrame>>,
  ) => {
    if (!profile || !rig || !activeFrame) return;
    patchProfile({
      ...profile,
      rig: {
        ...rig,
        keyframes: keyframes.map((frame, index) =>
          index === activeIndex ? { ...frame, ...patch } : frame,
        ),
      },
    });
  };

  const patchPoint = (pointIndex: number, patch: Partial<PoseKeypointRecord>) => {
    if (!activeFrame) return;
    const nextKeypoints = activeFrame.keypoints.map((point, index) =>
      index === pointIndex ? { ...point, ...patch } : point,
    );
    const nextAngle = contract
      ? getPoseMovementContractAngle(contract, nextKeypoints)
      : activeFrame.angle;
    patchActiveFrame({
      angle:
        typeof nextAngle === "number" && Number.isFinite(nextAngle)
          ? Math.round(nextAngle * 10) / 10
          : activeFrame.angle,
      keypoints: nextKeypoints,
    });
  };

  const patchActivePoint = (patch: Partial<PoseKeypointRecord>) => {
    patchPoint(selectedPoint, patch);
  };

  const updatePointFromPointer = (
    event: ReactPointerEvent<Element>,
    pointIndex: number,
  ) => {
    if (!editableView || previewMotion || !svgRef.current) return;
    const matrix = svgRef.current.getScreenCTM();
    if (!matrix) return;
    const point = svgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const cursor = point.matrixTransform(matrix.inverse());
    const normalized = inverseEditableViewPoint(
      clamp(cursor.x / 100, -0.2, 1.2),
      clamp(cursor.y / 100, -0.2, 1.2),
      viewTransform,
    );
    patchPoint(pointIndex, {
      visibility: Math.max(activeFrame?.keypoints[pointIndex]?.visibility ?? 0.92, 0.72),
      x: roundToStep(normalized.x),
      y: roundToStep(normalized.y),
    });
  };

  const handleSvgPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragPoint === null) return;
    if (
      dragPointerIdRef.current !== null &&
      event.pointerId !== dragPointerIdRef.current
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    if (now - lastDragAtRef.current < 16) return;
    lastDragAtRef.current = now;
    updatePointFromPointer(event, dragPoint);
  };

  const handleSvgPointerEnd = (event?: ReactPointerEvent<SVGSVGElement>) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (dragPoint !== null) {
        updatePointFromPointer(event, dragPoint);
      }
      const pointerId = dragPointerIdRef.current;
      if (
        pointerId !== null &&
        event.currentTarget.hasPointerCapture?.(pointerId)
      ) {
        try {
          event.currentTarget.releasePointerCapture(pointerId);
        } catch {
          // Pointer capture can already be gone when the browser emits lostcapture.
        }
      }
    }
    dragPointerIdRef.current = null;
    setDragPoint(null);
  };

  return (
    <>
    <section style={panelStyle(colors)}>
      <div>
        <strong style={{ color: colors.text }}>Visual movement editor</strong>
        <p style={{ color: colors.textMuted, margin: "4px 0 0" }}>
          Build the rep contract in order: movement type, side model, editable
          keyframes, then counting rules. The saved coordinates stay normalized
          even when using mirror or rotation previews.
        </p>
      </div>

      <div style={panelStyle(colors)}>
        <FieldLabel colors={colors}>1. Movement type</FieldLabel>
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          {MOVEMENT_MODE_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setMovementMode(option.value)}
              style={{
                ...miniButtonStyle(colors, movementMode === option.value),
                borderRadius: 16,
                padding: 14,
                textAlign: "left",
              }}
              type="button"
            >
              <span style={{ display: "block", fontSize: 14 }}>{option.label}</span>
              <span
                style={{
                  color: movementMode === option.value ? "#151515" : colors.textMuted,
                  display: "block",
                  fontSize: 12,
                  fontWeight: 700,
                  marginTop: 4,
                }}
              >
                {option.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      {contract ? (
        <div style={panelStyle(colors)}>
          <div
            style={{
              alignItems: "flex-start",
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div>
              <FieldLabel colors={colors}>Spatial rules</FieldLabel>
              <strong style={{ color: colors.text }}>
                Exercise-level movement validity
              </strong>
              <p style={{ color: colors.textMuted, margin: "4px 0 0" }}>
                Angles decide rep depth. Spatial rules decide whether the body
                position matches the exercise.
              </p>
            </div>
            <span
              style={{
                border: `1px solid ${colors.border}`,
                borderRadius: 999,
                color: colors.textMuted,
                fontSize: 12,
                fontWeight: 800,
                padding: "8px 12px",
              }}
            >
              {spatialPreset === "none"
                ? "No extra spatial gate"
                : "Editable starter rules"}
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))",
              marginTop: 12,
            }}
          >
            {SPATIAL_RULE_PRESET_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setSpatialPreset(option.value)}
                style={{
                  ...miniButtonStyle(colors, spatialPreset === option.value),
                  borderRadius: 16,
                  padding: 12,
                  textAlign: "left",
                }}
                type="button"
              >
                <span style={{ display: "block", fontSize: 13 }}>
                  {option.label}
                </span>
                <span
                  style={{
                    color:
                      spatialPreset === option.value
                        ? "#151515"
                        : colors.textMuted,
                    display: "block",
                    fontSize: 11,
                    fontWeight: 700,
                    lineHeight: 1.35,
                    marginTop: 4,
                  }}
                >
                  {option.description}
                </span>
              </button>
            ))}
          </div>
          {frontViewDepthWarning ? (
            <p
              style={{
                color: colors.primary,
                fontSize: 12,
                fontWeight: 850,
                margin: "10px 0 0",
              }}
            >
              Front view is for symmetry only. Use Side or Floor to tune depth.
            </p>
          ) : null}
        </div>
      ) : null}

      {!rig || !keyframes.length ? (
        <div
          style={{
            border: `1px dashed ${colors.borderStrong}`,
            borderRadius: 16,
            color: colors.textMuted,
            display: "grid",
            gap: 12,
            padding: 18,
          }}
        >
          <span>
            No rig captured yet. Choose a template first; unknown exercises no
            longer receive a generic curl animation.
          </span>
          <div
            style={{
              display: "grid",
              gap: 8,
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            }}
          >
            {RIG_TEMPLATE_OPTIONS.map((template) => (
              <button
                key={template.value}
                onClick={() => setSelectedTemplate(template.value)}
                style={miniButtonStyle(colors, selectedTemplate === template.value)}
                type="button"
              >
                {template.label}
              </button>
            ))}
          </div>
          <button
            disabled={!selectedTemplate && !generatedContract}
            onClick={() => createGeneratedProfile(selectedTemplate ?? undefined)}
            style={{
              ...miniButtonStyle(colors, Boolean(selectedTemplate ?? generatedContract)),
              justifySelf: "flex-start",
              opacity: selectedTemplate || generatedContract ? 1 : 0.45,
            }}
            type="button"
          >
            {selectedTemplate
              ? `Generate ${TEMPLATE_EXERCISE_LABELS[selectedTemplate]} rig`
              : "Generate starter rig"}
          </button>
        </div>
      ) : (
        <>
          <div style={panelStyle(colors)}>
            <FieldLabel colors={colors}>2. Keyframes</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {keyframes.map((frame) => (
                <button
                  key={frame.kind}
                  onClick={() => {
                    setPreviewMotion(false);
                    setActiveKind(frame.kind);
                  }}
                  style={miniButtonStyle(colors, activeKind === frame.kind && !previewMotion)}
                  type="button"
                >
                  {frame.label || getFrameLabel(frame.kind, movementMode)}
                </button>
              ))}
              <button
                onClick={() => setPreviewMotion((current) => !current)}
                style={miniButtonStyle(colors, previewMotion)}
                type="button"
              >
                Preview motion
              </button>
              <button
                disabled={!generatedContract && !selectedTemplate}
                onClick={() => createGeneratedProfile(selectedTemplate ?? undefined)}
                style={{
                  ...miniButtonStyle(colors),
                  opacity: generatedContract || selectedTemplate ? 1 : 0.45,
                }}
                type="button"
              >
                Reset rig
              </button>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 10,
              }}
            >
              {RIG_VIEW_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setViewTransform(option.value)}
                  style={miniButtonStyle(colors, viewTransform === option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
            {editableView && !previewMotion ? (
              <span style={{ color: colors.textMuted, fontSize: 12 }}>
                Drag orange joints directly. Mirror view saves the inverse normalized
                coordinate; other transforms are preview-only.
              </span>
            ) : (
              <span style={{ color: colors.textMuted, fontSize: 12 }}>
                Switch to Front or Mirror and turn off Preview motion to drag nodes.
              </span>
            )}
            {frontViewDepthWarning ? (
              <span
                style={{
                  color: colors.primary,
                  display: "block",
                  fontSize: 12,
                  fontWeight: 850,
                  marginTop: 6,
                }}
              >
                Front view is for symmetry only. Use Side or Floor to tune depth.
              </span>
            ) : null}
          </div>

          <div
            style={{
              display: "grid",
              gap: 16,
              gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 0.95fr)",
            }}
          >
            <svg
              onLostPointerCapture={handleSvgPointerEnd}
              onPointerCancel={handleSvgPointerEnd}
              onPointerLeave={handleSvgPointerEnd}
              onPointerMove={handleSvgPointerMove}
              onPointerUp={handleSvgPointerEnd}
              ref={svgRef}
              role="img"
              style={{
                background:
                  "radial-gradient(circle at 50% 20%, rgba(245, 133, 48, 0.18), transparent 42%), rgba(0, 0, 0, 0.2)",
                border: `1px solid ${colors.border}`,
                borderRadius: 18,
                cursor:
                  dragPoint !== null
                    ? "grabbing"
                    : editableView && !previewMotion
                      ? "default"
                      : "auto",
                minHeight: 280,
                overscrollBehavior: "contain",
                touchAction: "none",
                userSelect: "none",
                width: "100%",
              }}
              viewBox="-10 -10 120 120"
            >
              {RIG_BONES.map(([from, to]) => {
                const start = getKeypointPosition(displayPoints[from]);
                const end = getKeypointPosition(displayPoints[to]);
                if (!start || !end) return null;
                return (
                  <line
                    key={`${from}-${to}`}
                    stroke="rgba(255,255,255,0.78)"
                    strokeLinecap="round"
                    strokeWidth={1.6}
                    x1={start.cx}
                    x2={end.cx}
                    y1={start.cy}
                    y2={end.cy}
                  />
                );
              })}
              {shoulderCenterPosition && hipCenterPosition ? (
                <line
                  stroke="#3ed875"
                  strokeDasharray="3 3"
                  strokeLinecap="round"
                  strokeWidth={1.8}
                  x1={shoulderCenterPosition.cx}
                  x2={hipCenterPosition.cx}
                  y1={shoulderCenterPosition.cy}
                  y2={hipCenterPosition.cy}
                >
                  <title>Torso line: spatial rules use this to reject fake push-up posture.</title>
                </line>
              ) : null}
              {[leftWristPosition, rightWristPosition].map((position, index) =>
                position ? (
                  <circle
                    cx={position.cx}
                    cy={position.cy}
                    fill="none"
                    key={`wrist-anchor-${index}`}
                    r={7}
                    stroke="#facc15"
                    strokeDasharray="2 3"
                    strokeWidth={1.5}
                  >
                    <title>Wrist anchor zone: push-ups should keep hands planted.</title>
                  </circle>
                ) : null,
              )}
              {shoulderCenterPosition && hipCenterPosition ? (
                <line
                  markerEnd="url(#travel-arrow)"
                  stroke="#f97316"
                  strokeLinecap="round"
                  strokeWidth={1.6}
                  x1={shoulderCenterPosition.cx + 6}
                  x2={shoulderCenterPosition.cx + 6}
                  y1={shoulderCenterPosition.cy}
                  y2={hipCenterPosition.cy}
                >
                  <title>Shoulder/hip travel: spatial rules require the body to actually move through the rep.</title>
                </line>
              ) : null}
              <defs>
                <marker
                  id="travel-arrow"
                  markerHeight="5"
                  markerWidth="5"
                  orient="auto"
                  refX="4"
                  refY="2.5"
                >
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#f97316" />
                </marker>
              </defs>
              {dominantJointPosition && typeof dominantAngle === "number" ? (
                <>
                  <path
                    d={describeAngleArc(
                      dominantJointPosition.cx,
                      dominantJointPosition.cy,
                      7,
                    )}
                    fill="none"
                    stroke="#3ed875"
                    strokeLinecap="round"
                    strokeWidth={2.4}
                  />
                  <circle
                    cx={dominantJointPosition.cx}
                    cy={dominantJointPosition.cy}
                    fill="none"
                    r={8.5}
                    stroke="rgba(62,216,117,0.38)"
                    strokeWidth={1.4}
                  />
                  <text
                    fill="#59f08b"
                    fontSize={5}
                    fontWeight={800}
                    x={dominantJointPosition.cx + 9}
                    y={dominantJointPosition.cy - 6}
                  >
                    {dominantAngle} deg
                  </text>
                </>
              ) : null}
              {displayPoints.map((point, index) => {
                const position = getKeypointPosition(point);
                if (!point || !position) return null;
                const nodeLabel = `${index}: ${
                  LANDMARK_LABELS[index] ?? "landmark"
                } (${Math.round(point.x * 100)}% x, ${Math.round(point.y * 100)}% y)`;
                return (
                  <circle
                    aria-label={nodeLabel}
                    cx={position.cx}
                    cy={position.cy}
                    fill={index === selectedPoint ? colors.primary : "#f58530"}
                    key={index}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedPoint(index);
                      if (!editableView || previewMotion) return;
                      dragPointerIdRef.current = event.pointerId;
                      lastDragAtRef.current = 0;
                      setDragPoint(index);
                      try {
                        svgRef.current?.setPointerCapture(event.pointerId);
                      } catch {
                        // Synthetic/browser-tool pointer events may not own an active pointer.
                      }
                      updatePointFromPointer(event, index);
                    }}
                    r={index === selectedPoint ? 2.6 : 1.8}
                    stroke={index === selectedPoint ? "#111" : "transparent"}
                    strokeWidth={0.8}
                    style={{
                      cursor:
                        editableView && !previewMotion
                          ? dragPoint === index
                            ? "grabbing"
                            : "grab"
                          : "pointer",
                    }}
                  >
                    <title>{nodeLabel}</title>
                  </circle>
                );
              })}
            </svg>

            <div style={{ display: "grid", gap: 12 }}>
              <FieldShell colors={colors} label="Keyframe label">
                <input
                  name="exercise-keyframe-label"
                  onChange={(event) =>
                    patchActiveFrame({ label: event.target.value })
                  }
                  style={inputStyle(colors)}
                  value={activeFrame?.label ?? ""}
                />
              </FieldShell>
              <FieldShell colors={colors} label="Angle at keyframe">
                <input
                  max={180}
                  min={0}
                  name="exercise-keyframe-angle"
                  onChange={(event) =>
                    patchActiveFrame({
                      angle: event.target.value.trim()
                        ? toNumber(event.target.value, activeFrame?.angle ?? 0)
                        : null,
                    })
                  }
                  step={1}
                  style={inputStyle(colors)}
                  type="number"
                  value={activeFrame?.angle ?? ""}
                />
              </FieldShell>
              {contract?.repModel === "bilateral" &&
              symmetryDelta !== null &&
              symmetryDelta > symmetryLimit ? (
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    borderRadius: 14,
                    color: "#facc15",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: 12,
                  }}
                >
                  Symmetry warning: left/right angle delta is {symmetryDelta} deg
                  (limit {symmetryLimit} deg).
                </div>
              ) : null}
              <FieldShell colors={colors} label="Selected landmark">
                <select
                  name="exercise-selected-landmark"
                  onChange={(event) => setSelectedPoint(Number(event.target.value))}
                  style={inputStyle(colors)}
                  value={selectedPoint}
                >
                  {(activeFrame?.keypoints ?? []).map((_, index) => (
                    <option key={index} value={index}>
                      {index}: {LANDMARK_LABELS[index] ?? "landmark"}
                    </option>
                  ))}
                </select>
              </FieldShell>
              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <FieldShell colors={colors} label="X">
                  <input
                    max={1.2}
                    min={-0.2}
                    name="exercise-landmark-x"
                    onChange={(event) =>
                      patchActivePoint({
                        x: roundToStep(
                          clamp(toNumber(event.target.value, 0), -0.2, 1.2),
                        ),
                      })
                    }
                    step={0.005}
                    style={inputStyle(colors)}
                    type="number"
                    value={activeFrame?.keypoints[selectedPoint]?.x ?? ""}
                  />
                </FieldShell>
                <FieldShell colors={colors} label="Y">
                  <input
                    max={1.2}
                    min={-0.2}
                    name="exercise-landmark-y"
                    onChange={(event) =>
                      patchActivePoint({
                        y: roundToStep(
                          clamp(toNumber(event.target.value, 0), -0.2, 1.2),
                        ),
                      })
                    }
                    step={0.005}
                    style={inputStyle(colors)}
                    type="number"
                    value={activeFrame?.keypoints[selectedPoint]?.y ?? ""}
                  />
                </FieldShell>
              </div>
              {!previewMotion ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button
                    disabled={typeof activeFrame?.angle !== "number" || movementMode === "static_hold"}
                    onClick={() =>
                      activeFrame?.angle !== null &&
                      patchThreshold("down", { angle: activeFrame?.angle ?? 0 })
                    }
                    style={miniButtonStyle(colors)}
                    type="button"
                  >
                    Use angle as down
                  </button>
                  <button
                    disabled={typeof activeFrame?.angle !== "number" || movementMode === "static_hold"}
                    onClick={() =>
                      activeFrame?.angle !== null &&
                      patchThreshold("up", { angle: activeFrame?.angle ?? 0 })
                    }
                    style={miniButtonStyle(colors)}
                    type="button"
                  >
                    Use angle as up
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {contract ? (
        <div style={panelStyle(colors)}>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong style={{ color: colors.text }}>Rep counting rules</strong>
              <p style={{ color: colors.textMuted, margin: "4px 0 0" }}>
                Tune the actual down/up phase thresholds, tolerances, side
                requirements, and partial-rep policy used by the tracker.
              </p>
              <p
                style={{
                  color: "#3ed875",
                  fontSize: 12,
                  fontWeight: 800,
                  margin: "8px 0 0",
                }}
              >
                Angles decide rep depth. Spatial rules decide whether the body
                position matches the exercise.
              </p>
            </div>
            <button
              disabled={!generatedContract && !selectedTemplate}
              onClick={() => createGeneratedProfile(selectedTemplate ?? undefined)}
              style={miniButtonStyle(colors)}
              type="button"
            >
              Regenerate rig
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            {movementMode === "dynamic_rep" ? (
              <>
                <ThresholdField
                  colors={colors}
                  label="Down angle"
                  max={180}
                  min={0}
                  onChange={(angle) => patchThreshold("down", { angle })}
                  value={contract.repThresholds.down.angle}
                />
                <ThresholdField
                  colors={colors}
                  label="Down tolerance"
                  max={90}
                  min={0}
                  onChange={(tolerance) => patchThreshold("down", { tolerance })}
                  value={contract.repThresholds.down.tolerance}
                />
                <ThresholdField
                  colors={colors}
                  label="Up angle"
                  max={180}
                  min={0}
                  onChange={(angle) => patchThreshold("up", { angle })}
                  value={contract.repThresholds.up.angle}
                />
                <ThresholdField
                  colors={colors}
                  label="Up tolerance"
                  max={90}
                  min={0}
                  onChange={(tolerance) => patchThreshold("up", { tolerance })}
                  value={contract.repThresholds.up.tolerance}
                />
              </>
            ) : (
              <>
                <ThresholdField
                  colors={colors}
                  label="Body line tolerance"
                  max={90}
                  min={0}
                  onChange={(bodyLineTolerance) =>
                    patchSpatialRequirement({ bodyLineTolerance })
                  }
                  value={contract.spatialRequirements?.bodyLineTolerance ?? 28}
                />
                <ThresholdField
                  colors={colors}
                  label="Max body X drift"
                  max={0.4}
                  min={0}
                  onChange={(bodyXDriftMax) =>
                    patchSpatialRequirement({ bodyXDriftMax })
                  }
                  step={0.005}
                  value={contract.spatialRequirements?.bodyXDriftMax ?? 0.08}
                />
              </>
            )}
            {movementMode === "dynamic_rep" ? (
              <FieldShell colors={colors} label="Side model">
              <select
                name="exercise-side-model"
                onChange={(event) =>
                  setRepModel(event.target.value as (typeof DYNAMIC_REP_MODEL_OPTIONS)[number])
                }
                style={inputStyle(colors)}
                value={
                  DYNAMIC_REP_MODEL_OPTIONS.includes(
                    contract.repModel as (typeof DYNAMIC_REP_MODEL_OPTIONS)[number],
                  )
                    ? contract.repModel
                    : "bilateral"
                }
              >
                {DYNAMIC_REP_MODEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
              </FieldShell>
            ) : null}
            <FieldShell colors={colors} label="Required sides">
              <select
                name="exercise-required-sides"
                onChange={(event) =>
                  patchMovementContract({
                    requiredSides: event.target.value as (typeof REQUIRED_SIDE_OPTIONS)[number],
                  })
                }
                style={inputStyle(colors)}
                value={contract.requiredSides ?? "either"}
              >
                {(movementMode === "static_hold"
                  ? STATIC_REQUIRED_SIDE_OPTIONS
                  : REQUIRED_SIDE_OPTIONS
                ).map((option) => (
                  <option key={option} value={option}>
                    {option.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </FieldShell>
            {movementMode === "dynamic_rep" ? (
              <FieldShell colors={colors} label="Partial rep policy">
                <select
                  name="exercise-partial-rep-policy"
                  onChange={(event) =>
                    patchMovementContract({
                      partialRepPolicy: event.target.value as (typeof PARTIAL_REP_POLICY_OPTIONS)[number],
                    })
                  }
                  style={inputStyle(colors)}
                  value={contract.partialRepPolicy ?? "count_half_reps"}
                >
                  {PARTIAL_REP_POLICY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </FieldShell>
            ) : null}
          </div>

          <div style={{ ...panelStyle(colors), marginTop: 14 }}>
            <strong style={{ color: colors.text }}>Spatial awareness rules</strong>
            <p style={{ color: colors.textMuted, margin: "4px 0 0" }}>
              Use these to stop curls from counting as push-ups, reject one-arm
              motion on bilateral exercises, and require real body travel.
            </p>
            {spatialPreset === "none" ? (
              <p
                style={{
                  border: `1px dashed ${colors.border}`,
                  borderRadius: 14,
                  color: colors.textMuted,
                  fontSize: 13,
                  margin: "12px 0 0",
                  padding: 14,
                }}
              >
                No extra spatial gate is active. Use this for exercises where
                joint angles and required side checks are enough, then switch to
                a preset or Custom if the movement needs body-position proof.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  marginTop: 12,
                }}
              >
                <ThresholdField
                  colors={colors}
                  label="Body line tolerance"
                  max={90}
                  min={0}
                  onChange={(bodyLineTolerance) =>
                    patchSpatialRequirement({ bodyLineTolerance })
                  }
                  value={contract.spatialRequirements?.bodyLineTolerance ?? 28}
                />
                <ThresholdField
                  colors={colors}
                  label="Body Y travel min"
                  max={0.4}
                  min={0}
                  onChange={(bodyYTravelMin) =>
                    patchSpatialRequirement({ bodyYTravelMin })
                  }
                  step={0.001}
                  value={contract.spatialRequirements?.bodyYTravelMin ?? 0.012}
                />
                <ThresholdField
                  colors={colors}
                  label="Shoulder travel min"
                  max={0.4}
                  min={0}
                  onChange={(shoulderYTravelMin) =>
                    patchSpatialRequirement({ shoulderYTravelMin })
                  }
                  step={0.001}
                  value={contract.spatialRequirements?.shoulderYTravelMin ?? 0.008}
                />
                <ThresholdField
                  colors={colors}
                  label="Hip travel min"
                  max={0.4}
                  min={0}
                  onChange={(hipYTravelMin) =>
                    patchSpatialRequirement({ hipYTravelMin })
                  }
                  step={0.001}
                  value={contract.spatialRequirements?.hipYTravelMin ?? 0.01}
                />
                <ThresholdField
                  colors={colors}
                  label="Shoulder/Hip travel"
                  max={0.4}
                  min={0}
                  onChange={(shoulderHipTravelMin) =>
                    patchSpatialRequirement({ shoulderHipTravelMin })
                  }
                  step={0.001}
                  value={
                    contract.spatialRequirements?.shoulderHipTravelMin ?? 0.01
                  }
                />
                <ThresholdField
                  colors={colors}
                  label="Wrist anchor drift"
                  max={0.5}
                  min={0}
                  onChange={(wristAnchorDriftMax) =>
                    patchSpatialRequirement({ wristAnchorDriftMax })
                  }
                  step={0.001}
                  value={contract.spatialRequirements?.wristAnchorDriftMax ?? 0.18}
                />
                <ThresholdField
                  colors={colors}
                  label="Torso slope min"
                  max={180}
                  min={0}
                  onChange={(torsoSlopeMinDeg) =>
                    patchSpatialRequirement({ torsoSlopeMinDeg })
                  }
                  value={contract.spatialRequirements?.torsoSlopeMinDeg ?? 0}
                />
                <ThresholdField
                  colors={colors}
                  label="Torso slope max"
                  max={180}
                  min={0}
                  onChange={(torsoSlopeMaxDeg) =>
                    patchSpatialRequirement({ torsoSlopeMaxDeg })
                  }
                  value={contract.spatialRequirements?.torsoSlopeMaxDeg ?? 92}
                />
                <ThresholdField
                  colors={colors}
                  label="Elbow symmetry"
                  max={90}
                  min={0}
                  onChange={(leftRightSymmetryTolerance) =>
                    patchSpatialRequirement({ leftRightSymmetryTolerance })
                  }
                  value={
                    contract.spatialRequirements?.leftRightSymmetryTolerance ?? 28
                  }
                />
                <ThresholdField
                  colors={colors}
                  label="Phase sync ms"
                  max={1200}
                  min={0}
                  onChange={(phaseSyncToleranceMs) =>
                    patchSpatialRequirement({ phaseSyncToleranceMs })
                  }
                  value={contract.spatialRequirements?.phaseSyncToleranceMs ?? 420}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
    <ConfirmModal
      isOpen={regenerateConfirmTemplate !== null}
      title="Regenerate Rig"
      message="Regenerate this rig? Manual keyframe edits will be overwritten."
      confirmLabel="REGENERATE RIG"
      isDanger
      onConfirm={handleConfirmRegenerate}
      onCancel={() => setRegenerateConfirmTemplate(null)}
    />
    </>
  );
}

function useSafeKeyframeKind(
  keyframes: NonNullable<ExerciseMovementProfileRecord["rig"]>["keyframes"],
) {
  const firstKind = keyframes[0]?.kind ?? "start";
  const [activeKind, setActiveKind] =
    useState<ExerciseRigKeyframeKind>(firstKind);
  const exists = keyframes.some((frame) => frame.kind === activeKind);
  return [exists ? activeKind : firstKind, setActiveKind] as const;
}

function useSafePointIndex(
  frame: NonNullable<ExerciseMovementProfileRecord["rig"]>["keyframes"][number] | null,
) {
  const [selectedPoint, setSelectedPoint] = useState(13);
  return [
    clamp(selectedPoint, 0, Math.max(0, (frame?.keypoints.length ?? 1) - 1)),
    setSelectedPoint,
  ] as const;
}

function ThresholdField({
  colors,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  colors: EditorColors;
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <FieldShell colors={colors} label={label}>
      <input
        max={max}
        min={min}
        name={`exercise-threshold-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        onChange={(event) =>
          onChange(clamp(toNumber(event.target.value, value), min, max))
        }
        step={step ?? 1}
        style={inputStyle(colors)}
        type="number"
        value={value}
      />
    </FieldShell>
  );
}

const HAND_BONES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [0, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [0, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
] as const;

const HAND_PRESET_POINTS: Record<
  Exclude<ExerciseHandPosePreset, "custom">,
  { x: number; y: number }[]
> = {
  closed_grip: [
    [0.5, 0.88],
    [0.39, 0.72],
    [0.33, 0.58],
    [0.39, 0.5],
    [0.48, 0.57],
    [0.43, 0.64],
    [0.38, 0.5],
    [0.45, 0.43],
    [0.53, 0.52],
    [0.5, 0.62],
    [0.48, 0.48],
    [0.55, 0.41],
    [0.6, 0.51],
    [0.57, 0.65],
    [0.57, 0.51],
    [0.63, 0.46],
    [0.66, 0.55],
    [0.64, 0.7],
    [0.64, 0.58],
    [0.68, 0.53],
    [0.7, 0.61],
  ].map(([x, y]) => ({ x, y })),
  neutral: [
    [0.5, 0.9],
    [0.38, 0.73],
    [0.31, 0.57],
    [0.26, 0.45],
    [0.23, 0.35],
    [0.43, 0.66],
    [0.4, 0.5],
    [0.38, 0.36],
    [0.37, 0.24],
    [0.5, 0.63],
    [0.5, 0.45],
    [0.5, 0.29],
    [0.5, 0.17],
    [0.58, 0.65],
    [0.61, 0.5],
    [0.64, 0.37],
    [0.66, 0.27],
    [0.65, 0.71],
    [0.7, 0.58],
    [0.74, 0.48],
    [0.78, 0.39],
  ].map(([x, y]) => ({ x, y })),
  open_palm: [
    [0.5, 0.9],
    [0.37, 0.72],
    [0.27, 0.55],
    [0.18, 0.4],
    [0.1, 0.28],
    [0.42, 0.66],
    [0.38, 0.47],
    [0.35, 0.28],
    [0.33, 0.12],
    [0.5, 0.63],
    [0.5, 0.42],
    [0.5, 0.22],
    [0.5, 0.05],
    [0.58, 0.65],
    [0.63, 0.46],
    [0.68, 0.29],
    [0.72, 0.15],
    [0.65, 0.71],
    [0.73, 0.56],
    [0.81, 0.43],
    [0.88, 0.31],
  ].map(([x, y]) => ({ x, y })),
  rock_sign: [
    [0.5, 0.9],
    [0.38, 0.72],
    [0.29, 0.55],
    [0.21, 0.42],
    [0.12, 0.31],
    [0.42, 0.66],
    [0.38, 0.47],
    [0.35, 0.28],
    [0.33, 0.1],
    [0.5, 0.63],
    [0.48, 0.49],
    [0.54, 0.44],
    [0.6, 0.52],
    [0.58, 0.65],
    [0.6, 0.5],
    [0.65, 0.46],
    [0.7, 0.54],
    [0.65, 0.71],
    [0.73, 0.55],
    [0.81, 0.38],
    [0.88, 0.22],
  ].map(([x, y]) => ({ x, y })),
  thumbs_up: [
    [0.5, 0.9],
    [0.38, 0.7],
    [0.31, 0.49],
    [0.29, 0.28],
    [0.29, 0.08],
    [0.43, 0.65],
    [0.42, 0.52],
    [0.48, 0.47],
    [0.54, 0.55],
    [0.5, 0.63],
    [0.5, 0.5],
    [0.56, 0.46],
    [0.62, 0.55],
    [0.58, 0.65],
    [0.58, 0.52],
    [0.64, 0.49],
    [0.7, 0.58],
    [0.65, 0.71],
    [0.65, 0.59],
    [0.7, 0.56],
    [0.76, 0.64],
  ].map(([x, y]) => ({ x, y })),
};

const HAND_PRESETS: { label: string; value: ExerciseHandPosePreset }[] = [
  { label: "Closed grip", value: "closed_grip" },
  { label: "Open palm", value: "open_palm" },
  { label: "Rock sign", value: "rock_sign" },
  { label: "Neutral", value: "neutral" },
  { label: "Thumbs up", value: "thumbs_up" },
  { label: "Custom", value: "custom" },
];

export function HandShapeProfileEditor({
  colors,
  onChange,
  value,
}: {
  colors: EditorColors;
  onChange: (nextProfile: ExerciseHandShapeProfileRecord) => void;
  value: ExerciseHandShapeProfileRecord | null;
}) {
  const profile = normalizeExerciseHandShapeProfile(value);
  const handSvgRef = useRef<SVGSVGElement | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [dragPoint, setDragPoint] = useState<number | null>(null);
  const handDragPointerIdRef = useRef<number | null>(null);
  const lastHandDragAtRef = useRef(0);
  const [selectedPoint, setSelectedPoint] = useState(8);
  const handPose = profile.handPosePreview ?? {
    points: HAND_PRESET_POINTS.neutral,
    preset: "neutral" as ExerciseHandPosePreset,
  };
  const handPoints =
    handPose.points.length === 21 ? handPose.points : HAND_PRESET_POINTS.neutral;
  const countsAsGrip =
    profile.grip.required &&
    profile.grip.maxOpenRatio <= 0.28 &&
    profile.grip.maxOpenFrames <= 2 &&
    profile.grip.minUsableFrames <= profile.grip.recentFrameLimit;
  const countsAsLock =
    profile.subjectLockGesture.enabled &&
    profile.subjectLockGesture.minFingerLift >= 0.025 &&
    profile.subjectLockGesture.minFingerSpreadX >= 0.015 &&
    profile.subjectLockGesture.holdMs >= 800;
  const exerciseHandRequirement = profile.grip.required
    ? handPose.preset === "closed_grip"
      ? "grip"
      : "custom"
    : handPose.preset === "open_palm"
      ? "open_palm"
      : "none";
  const update = (patch: Partial<ExerciseHandShapeProfileRecord>) => {
    onChange(normalizeExerciseHandShapeProfile({ ...profile, ...patch }));
  };
  const updateGrip = (patch: Partial<typeof profile.grip>) => {
    update({ grip: { ...profile.grip, ...patch } });
  };
  const updateSubjectLock = (
    patch: Partial<typeof profile.subjectLockGesture>,
  ) => {
    update({
      subjectLockGesture: { ...profile.subjectLockGesture, ...patch },
    });
  };
  const updateHandPose = (
    patch: Partial<NonNullable<ExerciseHandShapeProfileRecord["handPosePreview"]>>,
  ) => {
    update({
      handPosePreview: {
        points: handPoints,
        preset: handPose.preset,
        ...patch,
      },
    });
  };
  const applyPreset = (preset: ExerciseHandPosePreset) => {
    const presetPoints = preset === "custom" ? handPoints : HAND_PRESET_POINTS[preset];
    const gripPatch =
      preset === "closed_grip"
        ? {
            maxOpenFrames: 0,
            maxOpenRatio: 0.16,
            minUsableFrames: 3,
            recentFrameLimit: 6,
            required: true,
          }
        : preset === "open_palm"
          ? {
              maxOpenFrames: 5,
              maxOpenRatio: 0.7,
              minUsableFrames: 2,
              recentFrameLimit: 6,
              required: false,
            }
          : {};
    const lockPatch =
      preset === "rock_sign"
        ? {
            enabled: true,
            holdMs: 1800,
            minFingerLift: 0.04,
            minFingerSpreadX: 0.03,
            minThumbSeparation: 0.025,
          }
        : {};
    update({
      grip: { ...profile.grip, ...gripPatch },
      handPosePreview: {
        points: presetPoints,
        preset,
      },
      subjectLockGesture: { ...profile.subjectLockGesture, ...lockPatch },
    });
  };
  const setExerciseHandRequirement = (
    requirement: "custom" | "grip" | "none" | "open_palm",
  ) => {
    if (requirement === "grip") {
      applyPreset("closed_grip");
      return;
    }
    if (requirement === "open_palm") {
      applyPreset("open_palm");
      return;
    }
    if (requirement === "none") {
      update({
        grip: { ...profile.grip, required: false },
        handPosePreview: {
          points: HAND_PRESET_POINTS.neutral,
          preset: "neutral",
        },
      });
      return;
    }
    update({
      grip: { ...profile.grip, required: true },
      handPosePreview: {
        points: handPoints,
        preset: "custom",
      },
    });
  };
  const updateHandPointFromPointer = (
    event: ReactPointerEvent<Element>,
    pointIndex: number,
  ) => {
    if (!handSvgRef.current) return;
    const matrix = handSvgRef.current.getScreenCTM();
    if (!matrix) return;
    const point = handSvgRef.current.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const cursor = point.matrixTransform(matrix.inverse());
    const nextPoints = handPoints.map((current, index) =>
      index === pointIndex
        ? {
            x: roundToStep(clamp(cursor.x / 100, 0.02, 0.98)),
            y: roundToStep(clamp(cursor.y / 100, 0.02, 0.98)),
          }
        : current,
    );
    updateHandPose({ points: nextPoints });
  };
  const handleHandPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (dragPoint === null) return;
    if (
      handDragPointerIdRef.current !== null &&
      event.pointerId !== handDragPointerIdRef.current
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const now = performance.now();
    if (now - lastHandDragAtRef.current < 16) return;
    lastHandDragAtRef.current = now;
    updateHandPointFromPointer(event, dragPoint);
  };

  const handleHandPointerEnd = (event?: ReactPointerEvent<SVGSVGElement>) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (dragPoint !== null) {
        updateHandPointFromPointer(event, dragPoint);
      }
      const pointerId = handDragPointerIdRef.current;
      if (
        pointerId !== null &&
        event.currentTarget.hasPointerCapture?.(pointerId)
      ) {
        try {
          event.currentTarget.releasePointerCapture(pointerId);
        } catch {
          // Pointer capture can already be gone when the browser emits lostcapture.
        }
      }
    }
    handDragPointerIdRef.current = null;
    setDragPoint(null);
  };

  useEffect(() => {
    if (dragPoint === null) return undefined;
    const clearDrag = () => {
      handDragPointerIdRef.current = null;
      setDragPoint(null);
    };
    window.addEventListener("pointerup", clearDrag);
    window.addEventListener("pointercancel", clearDrag);
    window.addEventListener("blur", clearDrag);
    return () => {
      window.removeEventListener("pointerup", clearDrag);
      window.removeEventListener("pointercancel", clearDrag);
      window.removeEventListener("blur", clearDrag);
    };
  }, [dragPoint]);

  return (
    <section style={panelStyle(colors)}>
      <div>
        <strong style={{ color: colors.text }}>Exercise hand requirement</strong>
        <p style={{ color: colors.textMuted, margin: "4px 0 0" }}>
          Decide whether this exercise needs a grip/open palm. Target lock is a
          separate pre-workout gesture and should not affect normal rep
          counting once a subject is locked.
        </p>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {[
          ["none", "None"],
          ["grip", "Grip required"],
          ["open_palm", "Open palm required"],
          ["custom", "Custom gesture"],
        ].map(([valueKey, label]) => (
          <button
            key={valueKey}
            onClick={() =>
              setExerciseHandRequirement(
                valueKey as "custom" | "grip" | "none" | "open_palm",
              )
            }
            style={miniButtonStyle(colors, exerciseHandRequirement === valueKey)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      <div style={panelStyle(colors)}>
        <strong style={{ color: colors.text }}>Gesture templates</strong>
        <p style={{ color: colors.textMuted, margin: "4px 0 10px" }}>
          Templates are starting points. Drag nodes to fine-tune a custom hand
          shape only when the common grip/open-palm rules are not enough.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {HAND_PRESETS.map((preset) => (
          <button
            key={preset.value}
            onClick={() => applyPreset(preset.value)}
            style={miniButtonStyle(colors, handPose.preset === preset.value)}
            type="button"
          >
            {preset.label}
          </button>
        ))}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 14,
          gridTemplateColumns: "minmax(260px, 0.9fr) minmax(260px, 1fr)",
        }}
      >
        <div style={panelStyle(colors)}>
          <svg
            onLostPointerCapture={handleHandPointerEnd}
            onPointerCancel={handleHandPointerEnd}
            onPointerLeave={handleHandPointerEnd}
            onPointerMove={handleHandPointerMove}
            onPointerUp={handleHandPointerEnd}
            ref={handSvgRef}
            role="img"
            style={{
              background:
                "radial-gradient(circle at 50% 50%, rgba(62,216,117,0.12), transparent 45%), rgba(0,0,0,0.22)",
              border: `1px solid ${colors.border}`,
              borderRadius: 18,
              cursor: dragPoint !== null ? "grabbing" : "default",
              height: 280,
              overscrollBehavior: "contain",
              touchAction: "none",
              userSelect: "none",
              width: "100%",
            }}
            viewBox="0 0 100 100"
          >
            {HAND_BONES.map(([from, to]) => {
              const start = handPoints[from];
              const end = handPoints[to];
              return (
                <line
                  key={`${from}-${to}`}
                  stroke="rgba(255,255,255,0.7)"
                  strokeLinecap="round"
                  strokeWidth={2.2}
                  x1={start.x * 100}
                  x2={end.x * 100}
                  y1={start.y * 100}
                  y2={end.y * 100}
                />
              );
            })}
            {handPoints.map((point, index) => {
              const nodeLabel = `${index}: ${
                HAND_LANDMARK_LABELS[index] ?? "hand landmark"
              } (${Math.round(point.x * 100)}% x, ${Math.round(point.y * 100)}% y)`;
              return (
                <circle
                  aria-label={nodeLabel}
                  cx={point.x * 100}
                  cy={point.y * 100}
                  fill={index === selectedPoint ? colors.primary : "#3ed875"}
                  key={index}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSelectedPoint(index);
                    handDragPointerIdRef.current = event.pointerId;
                    lastHandDragAtRef.current = 0;
                    setDragPoint(index);
                    try {
                      handSvgRef.current?.setPointerCapture(event.pointerId);
                    } catch {
                      // Synthetic/browser-tool pointer events may not own an active pointer.
                    }
                    updateHandPointFromPointer(event, index);
                  }}
                  r={index === selectedPoint ? 3.2 : 2.3}
                  stroke="#101010"
                  strokeWidth={0.8}
                  style={{ cursor: dragPoint === index ? "grabbing" : "grab" }}
                >
                  <title>{nodeLabel}</title>
                </circle>
              );
            })}
          </svg>
          <span style={{ color: colors.textMuted, fontSize: 12 }}>
            Drag wrist/finger nodes to document the intended gesture shape.
          </span>
        </div>

        <div style={panelStyle(colors)}>
          <strong style={{ color: colors.text }}>Validation badges</strong>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            }}
          >
            <button
              onClick={() => updateGrip({ required: !profile.grip.required })}
              style={miniButtonStyle(colors, profile.grip.required)}
              type="button"
            >
              {profile.grip.required ? "Grip required" : "Grip optional"}
            </button>
            <button
              onClick={() =>
                updateSubjectLock({
                  enabled: !profile.subjectLockGesture.enabled,
                })
              }
              style={miniButtonStyle(colors, profile.subjectLockGesture.enabled)}
              type="button"
            >
              {profile.subjectLockGesture.enabled
                ? "Target lock gesture on"
                : "Target lock gesture off"}
            </button>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <span
              style={{
                color: countsAsGrip ? "#3ed875" : "#fca5a5",
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {countsAsGrip ? "Counts as grip" : "Does not count as grip"}
            </span>
            <span
              style={{
                color: countsAsLock ? "#3ed875" : colors.textMuted,
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              {countsAsLock ? "Counts as lock gesture" : "Lock gesture not active"}
            </span>
          </div>
          <FieldShell colors={colors} label="Selected hand node">
            <select
              name="exercise-hand-selected-node"
              onChange={(event) => setSelectedPoint(Number(event.target.value))}
              style={inputStyle(colors)}
              value={selectedPoint}
            >
              {handPoints.map((_, index) => (
                <option key={index} value={index}>
                  {index}: {HAND_LANDMARK_LABELS[index] ?? "hand landmark"}
                </option>
              ))}
            </select>
          </FieldShell>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <FieldShell colors={colors} label="X">
              <input
                max={0.98}
                min={0.02}
                name="exercise-hand-node-x"
                onChange={(event) => {
                  const nextPoints = handPoints.map((point, index) =>
                    index === selectedPoint
                      ? {
                          ...point,
                          x: roundToStep(
                            clamp(toNumber(event.target.value, point.x), 0.02, 0.98),
                          ),
                        }
                      : point,
                  );
                  updateHandPose({ points: nextPoints });
                }}
                step={0.005}
                style={inputStyle(colors)}
                type="number"
                value={handPoints[selectedPoint]?.x ?? ""}
              />
            </FieldShell>
            <FieldShell colors={colors} label="Y">
              <input
                max={0.98}
                min={0.02}
                name="exercise-hand-node-y"
                onChange={(event) => {
                  const nextPoints = handPoints.map((point, index) =>
                    index === selectedPoint
                      ? {
                          ...point,
                          y: roundToStep(
                            clamp(toNumber(event.target.value, point.y), 0.02, 0.98),
                          ),
                        }
                      : point,
                  );
                  updateHandPose({ points: nextPoints });
                }}
                step={0.005}
                style={inputStyle(colors)}
                type="number"
                value={handPoints[selectedPoint]?.y ?? ""}
              />
            </FieldShell>
          </div>
        </div>
      </div>

      <button
        onClick={() => setAdvancedOpen((current) => !current)}
        style={{ ...miniButtonStyle(colors), justifySelf: "flex-start" }}
        type="button"
      >
        {advancedOpen ? "Hide advanced tuning" : "Show advanced tuning"}
      </button>

      {advancedOpen ? (
        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}>
          <div style={panelStyle(colors)}>
            <strong style={{ color: colors.text }}>Grip tuning</strong>
            <ThresholdField
              colors={colors}
              label="Recent frame window"
              max={18}
              min={1}
              onChange={(recentFrameLimit) => updateGrip({ recentFrameLimit })}
              value={profile.grip.recentFrameLimit}
            />
            <ThresholdField
              colors={colors}
              label="Min usable frames"
              max={10}
              min={1}
              onChange={(minUsableFrames) => updateGrip({ minUsableFrames })}
              value={profile.grip.minUsableFrames}
            />
            <ThresholdField
              colors={colors}
              label="Allowed open frames"
              max={8}
              min={0}
              onChange={(maxOpenFrames) => updateGrip({ maxOpenFrames })}
              value={profile.grip.maxOpenFrames}
            />
            <ThresholdField
              colors={colors}
              label="Open-palm ratio"
              max={1}
              min={0}
              onChange={(maxOpenRatio) => updateGrip({ maxOpenRatio })}
              step={0.01}
              value={profile.grip.maxOpenRatio}
            />
            <ThresholdField
              colors={colors}
              label="Point visibility"
              max={1}
              min={0}
              onChange={(reliablePointMinVisibility) =>
                updateGrip({ reliablePointMinVisibility })
              }
              step={0.01}
              value={profile.grip.reliablePointMinVisibility}
            />
          </div>
          <div style={panelStyle(colors)}>
            <strong style={{ color: colors.text }}>Rock-sign tuning</strong>
          <ThresholdField
            colors={colors}
            label="Hold ms"
            max={6000}
            min={400}
            onChange={(holdMs) => updateSubjectLock({ holdMs })}
            value={profile.subjectLockGesture.holdMs}
          />
          <ThresholdField
            colors={colors}
            label="Finger lift"
            max={0.2}
            min={0}
            onChange={(minFingerLift) => updateSubjectLock({ minFingerLift })}
            step={0.005}
            value={profile.subjectLockGesture.minFingerLift}
          />
          <ThresholdField
            colors={colors}
            label="Finger spread X"
            max={0.2}
            min={0}
            onChange={(minFingerSpreadX) =>
              updateSubjectLock({ minFingerSpreadX })
            }
            step={0.005}
            value={profile.subjectLockGesture.minFingerSpreadX}
          />
          <ThresholdField
            colors={colors}
            label="Thumb separation"
            max={0.2}
            min={0}
            onChange={(minThumbSeparation) =>
              updateSubjectLock({ minThumbSeparation })
            }
            step={0.005}
            value={profile.subjectLockGesture.minThumbSeparation}
          />
          <ThresholdField
            colors={colors}
            label="Horn lift delta"
            max={0.2}
            min={0}
            onChange={(maxHornLiftDelta) =>
              updateSubjectLock({ maxHornLiftDelta })
            }
            step={0.005}
            value={profile.subjectLockGesture.maxHornLiftDelta}
          />
        </div>
      </div>
      ) : null}
    </section>
  );
}

export type { EditorColors, ExerciseEditorTab };
