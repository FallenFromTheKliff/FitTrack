"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ExerciseMuscleTargetRole } from "@fittrack/api-client";

export type EditorColors = {
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

export type ExerciseEditorTab =
  | "basics"
  | "muscles"
  | "movement"
  | "hands"
  | "media";

export const EDITOR_TABS: { label: string; value: ExerciseEditorTab }[] = [
  { label: "Basics", value: "basics" },
  { label: "Muscles", value: "muscles" },
  { label: "Movement angle preview", value: "movement" },
  { label: "Hand shapes", value: "hands" },
  { label: "Media", value: "media" },
];

export const REQUIRED_SIDE_OPTIONS = [
  "both",
  "left",
  "right",
  "either",
  "alternating",
] as const;

export const PARTIAL_REP_POLICY_OPTIONS = [
  "strict_full_rep",
  "count_half_reps",
  "review_only",
] as const;

export type MovementEditorMode = "dynamic_rep" | "static_hold";
export type RigTemplateKey =
  | "push"
  | "pull"
  | "squat"
  | "hinge"
  | "curl"
  | "press"
  | "dip"
  | "static_hold"
  | "blank";
export type RigViewTransform =
  | "front"
  | "side"
  | "floor"
  | "mirror"
  | "rotate90";
export type SpatialRulePreset =
  | "none"
  | "ground_press"
  | "vertical_pull"
  | "squat_hinge"
  | "custom";

export const MOVEMENT_MODE_OPTIONS: {
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

export const DYNAMIC_REP_MODEL_OPTIONS = [
  "bilateral",
  "unilateral_left",
  "unilateral_right",
  "alternating",
] as const;

export const STATIC_REQUIRED_SIDE_OPTIONS = [
  "both",
  "left",
  "right",
  "either",
] as const;

export const RIG_TEMPLATE_OPTIONS: {
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

export const TEMPLATE_EXERCISE_LABELS: Record<RigTemplateKey, string> = {
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

export const SPATIAL_RULE_PRESET_OPTIONS: {
  description: string;
  label: string;
  value: SpatialRulePreset;
}[] = [
  {
    description:
      "Angle and side rules only; bilateral exercises keep symmetry.",
    label: "None",
    value: "none",
  },
  {
    description:
      "Hands anchored, torso line, body travel, and left/right sync.",
    label: "Ground press",
    value: "ground_press",
  },
  {
    description:
      "Vertical pulling depth with shoulder travel and torso drift limits.",
    label: "Vertical pull",
    value: "vertical_pull",
  },
  {
    description:
      "Lower-body depth with hip/knee travel, torso control, and foot stability.",
    label: "Squat / hinge",
    value: "squat_hinge",
  },
  {
    description: "Expose every spatial field for specialized exercises.",
    label: "Custom",
    value: "custom",
  },
];

export const TEMPLATE_SPATIAL_PRESETS: Record<
  RigTemplateKey,
  SpatialRulePreset
> = {
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

export const TEMPLATE_DEFAULT_VIEWS: Record<RigTemplateKey, RigViewTransform> =
  {
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

export const RIG_VIEW_OPTIONS: { label: string; value: RigViewTransform }[] = [
  { label: "Front", value: "front" },
  { label: "Side", value: "side" },
  { label: "Floor", value: "floor" },
  { label: "Mirror", value: "mirror" },
  { label: "Rotate 90", value: "rotate90" },
];

export const RIG_BONES = [
  [0, 7],
  [0, 8],
  [7, 11],
  [8, 12],
  [11, 12],
  [11, 13],
  [13, 15],
  [15, 17],
  [15, 19],
  [15, 21],
  [12, 14],
  [14, 16],
  [16, 18],
  [16, 20],
  [16, 22],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [27, 29],
  [27, 31],
  [29, 31],
  [24, 26],
  [26, 28],
  [28, 30],
  [28, 32],
  [30, 32],
] as const;

export const LANDMARK_LABELS = [
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

export const HAND_LANDMARK_LABELS = [
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
  "derived keyframe angle":
    "The angle measured from the visible rig. Dragging the active dominant chain immediately syncs its matching mobile tracking target.",
  "peak / down target":
    "The contracted or lowered angle consumed by mobile rep counting. Changing it redraws the peak frame immediately.",
  "start / up target":
    "The extended or returned angle consumed by mobile rep counting. Changing it redraws the start and return frames immediately.",
  "body line tolerance":
    "How much body alignment can drift during a hold before the pose is considered sloppy.",
  "down angle":
    "The joint angle that marks the lowered or stretched part of the rep.",
  "down tolerance": "How much wiggle room is allowed around the down angle.",
  "exp %": "How much of this exercise's muscle experience goes to this muscle.",
  "finger lift":
    "How far a fingertip must rise from the hand to count as extended.",
  "finger spread x":
    "How far fingers must separate horizontally to count as the lock gesture.",
  "hold ms": "How long the gesture must stay stable before it counts.",
  "horn lift delta":
    "How similar the two raised rock-sign fingers must be in height.",
  "max body x drift": "How much the body can shift sideways during a hold.",
  "min usable frames":
    "Minimum number of clear hand frames needed before grip detection trusts the result.",
  "open-palm ratio":
    "How open the hand is allowed to look. Lower values make grip detection stricter.",
  "partial rep policy":
    "What to do with incomplete reps: reject them, count half reps, or flag for review.",
  "point visibility":
    "How confident the camera must be before using a hand landmark.",
  "recent frame window":
    "How many recent camera frames are checked together to smooth hand detection.",
  "required sides":
    "Which body side must satisfy the rule: left, right, either, both, or alternating.",
  role: "Primary muscles do most of the work. Secondary and stabilizer muscles support the movement.",
  "selected hand node":
    "The hand point you are editing. Tips are fingertips; MCP/PIP/DIP are finger joints.",
  "selected landmark":
    "The body point you are editing, such as left elbow, right wrist, or left knee.",
  "side model":
    "How the movement uses body sides: both sides together, one side only, or alternating sides.",
  "thumb separation":
    "How far the thumb must separate from the hand for the gesture rule.",
  "up angle":
    "The joint angle that marks the lifted or contracted part of the rep.",
  "up tolerance": "How much wiggle room is allowed around the up angle.",
};

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function toNumber(value: string, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function roundToStep(value: number, step = 0.005) {
  return Math.round(Math.round(value / step) * step * 1000) / 1000;
}

export function formatRole(value: ExerciseMuscleTargetRole) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function panelStyle(colors: EditorColors): CSSProperties {
  return {
    background: `linear-gradient(135deg, ${colors.surface}, ${colors.card})`,
    border: `1px solid ${colors.border}`,
    borderRadius: 18,
    display: "grid",
    gap: 14,
    padding: 16,
  };
}

export function inputStyle(colors: EditorColors): CSSProperties {
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

export function miniButtonStyle(
  colors: EditorColors,
  active = false,
): CSSProperties {
  return {
    background: active ? colors.primary : colors.surface,
    border: `1px solid ${active ? colors.primary : colors.border}`,
    borderRadius: 10,
    boxShadow: active ? `0 10px 18px -14px ${colors.primary}` : "none",
    color: active ? "#090909" : colors.text,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 12px",
    transition:
      "background-color 150ms ease, border-color 150ms ease, color 150ms ease, box-shadow 150ms ease",
  };
}

export function FieldLabel({
  children,
  colors,
}: {
  children: ReactNode;
  colors: EditorColors;
}) {
  const help =
    typeof children === "string"
      ? FIELD_HELP[children.toLowerCase()]
      : undefined;
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
            borderRadius: 5,
            color: colors.textMuted,
            cursor: "help",
            display: "inline-flex",
            fontSize: 9,
            height: 16,
            justifyContent: "center",
            letterSpacing: 0,
            lineHeight: 1,
            textTransform: "none",
            transition:
              "background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease",
            width: 17,
          }}
          title={help}
        >
          ?
        </span>
      ) : null}
    </span>
  );
}

export function FieldShell({
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
