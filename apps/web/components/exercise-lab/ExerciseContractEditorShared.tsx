"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
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

export type MovementEditorMode = "dynamic_rep" | "static_hold";
export type RigTemplateKey =
  | "push"
  | "pull"
  | "pulldown"
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
  | "lat_pulldown"
  | "squat_hinge"
  | "custom";

export const MOVEMENT_MODE_OPTIONS: {
  description: string;
  label: string;
  value: MovementEditorMode;
}[] = [
  {
    description: "Repeat a movement from the starting position to the goal and back.",
    label: "Repetitions",
    value: "dynamic_rep",
  },
  {
    description: "Stay in one position while the timer measures your hold.",
    label: "Timed hold",
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
  { label: "Pull-up", value: "pull" },
  { label: "Lat pulldown", value: "pulldown" },
  { label: "Squat", value: "squat" },
  { label: "Hip bend", value: "hinge" },
  { label: "Curl", value: "curl" },
  { label: "Press", value: "press" },
  { label: "Dip", value: "dip" },
  { label: "Timed hold", value: "static_hold" },
  { label: "Blank drawing", value: "blank" },
];

export const TEMPLATE_EXERCISE_LABELS: Record<RigTemplateKey, string> = {
  blank: "Custom blank",
  curl: "Dumbbell Bicep Curl",
  dip: "Dip",
  hinge: "Hip Hinge",
  press: "Shoulder Press",
  pull: "Pull Up",
  pulldown: "Lat Pulldown",
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
      "Use the joint angles and chosen sides. Both sides must still move together when selected.",
    label: "None",
    value: "none",
  },
  {
    description:
      "Keep the hands in place and check body position and movement, as in a push-up.",
    label: "Push-up / floor press",
    value: "ground_press",
  },
  {
    description:
      "Check how far the shoulders move up and down, and limit sideways sway.",
    label: "Pull-up",
    value: "vertical_pull",
  },
  {
    description: "Lower the upper arms from overhead. Only the shoulders and moving elbows are needed unless you add body checks.",
    label: "Lat pulldown",
    value: "lat_pulldown",
  },
  {
    description:
      "Check how far the hips and shoulders move and how the body is positioned.",
    label: "Squat / hip bend",
    value: "squat_hinge",
  },
  {
    description: "Choose your own limits for body position and movement.",
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
  pulldown: "lat_pulldown",
  push: "ground_press",
  squat: "squat_hinge",
  static_hold: "ground_press",
};

export const TEMPLATE_DEFAULT_VIEWS: Record<RigTemplateKey, RigViewTransform> =
  {
    blank: "front",
    curl: "front",
    dip: "front",
    hinge: "front",
    press: "front",
    pull: "front",
    pulldown: "front",
    push: "front",
    squat: "front",
    static_hold: "front",
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
  "joint to measure":
    "Choose which movement earns a rep. Elbow measures the arm bend. Upper arm measures raising or lowering the arm using both shoulders and the moving elbow; it does not need hips. Shoulder uses the hip as its reference instead. Hip measures bending at the waist; knee measures the leg bend; ankle measures the foot angle. Your drawing is kept and its angles are measured again when you change this choice.",
  "goal angle":
    "The angle to reach at the joint chosen in Counting rules. For elbows and knees, straight is about 180° and a right-angle bend is 90°. At the shoulder, an arm overhead is near 180°, level with the shoulder is near 90°, and beside the body is near 0°. Going farther in the movement direction still qualifies.",
  "starting angle":
    "The joint angle to begin from and return to before another rep can count. For a curl, this is the straighter-arm position. It should be clearly different from the goal angle.",
  "allowed difference from goal (°)":
    "How many degrees short of the goal are allowed. A larger number is easier; a smaller number requires getting closer. For a curl with a 90° goal and 15° allowed difference, bending to 105° or farther qualifies. The start and goal ranges must stay separate.",
  "allowed difference from start (°)":
    "How many degrees short of the starting angle are allowed. A larger number allows a less exact return; a smaller number requires getting closer. For a 155° curl start with 12° allowed difference, straightening to at least 143° qualifies.",
  "when to add a rep":
    "At the movement goal: add one rep when you reach the goal from the start. After returning to start: reach the goal, then return before the rep is added. Both need the saved movement range, and both require returning before another rep can count. Holding at the goal will not add extra reps.",
  "how the sides move":
    "Choose whether both arms or legs move together, only one side moves, or the sides take turns. Use Both sides together for a two-arm curl; use Switch sides each rep for alternating curls.",
  "sides to check":
    "Both sides means both must be clearly seen and meet the movement goal. Either side allows one clear side to qualify. Left or Right checks just that side. Take turns expects alternating sides.",
  "body position":
    "The posture required for this exercise, separate from the joint movement. Choose upright, lying down, or leaning. Any position skips this posture check, but extra body-movement checks may still need the hips visible.",
  "body parts to check":
    "Movement joints only turns off extra body checks. The upper-arm option needs both shoulders and the moving elbows, without hips. A curl needs shoulders, elbows and wrists; a squat still needs hips, knees and ankles. Upper body adds hips for posture checks. Full body also checks ankles. Extra movement checks may require more points.",
  "extra movement checks":
    "Add checks for the shape of the movement, such as keeping hands in place during a push-up. These help stop a similar arm bend from counting as a different exercise. Custom lets you adjust the individual limits below.",
  "position name":
    "A name for this position in the drawing, such as Start, Movement goal, or Back to start. Renaming it does not change when a rep counts.",
  "angle in the drawing":
    "The angle measured at the highlighted joint. Dragging its connected orange points also updates the matching start or goal angle. This value is read-only; change it by moving the drawing or editing the angle above.",
  "joint to edit":
    "Choose the orange body point to move, such as an elbow or wrist. You can drag it or use the position fields below. Joint to measure in Counting rules chooses which joint angle earns a rep; moving a point here does not change that choice.",
  "left / right position":
    "Move this point across the drawing: 0 is the left edge and 1 is the right edge in Front view. Increasing the number moves it right. Mirror view reverses how the drawing looks.",
  "up / down position":
    "Move this point vertically in the drawing: 0 is the top edge and 1 is the bottom edge. Increasing the number moves it down. This edits the drawing, not the required body posture.",
  "allowed body tilt (°)":
    "How far the body may tilt away from the chosen position. A smaller number is stricter; a larger number allows more tilt. With Full body, this also limits bending between the upper body and legs. The body-angle limits below can set a more specific upper-body range.",
  "allowed sideways sway":
    "How far the hips may move sideways during the movement. A smaller number allows less sway. This uses a share of the camera picture's width, not a distance in metres.",
  "minimum body movement":
    "The up-and-down movement required from the shoulders or hips. A larger number requires more movement; 0 turns off this minimum. Values are a share of the camera picture's height, not a distance in metres.",
  "minimum shoulder movement":
    "How far the shoulders must move up or down. A larger number requires more movement; 0 turns off this minimum. Values are a share of the camera picture's height.",
  "minimum hip movement":
    "How far the hips must move up or down. A larger number requires more movement; 0 turns off this minimum. Values are a share of the camera picture's height.",
  "minimum combined movement":
    "How far both the shoulders and hips must move up or down. Both must meet this minimum. A larger number is stricter; 0 turns it off. Values are a share of the camera picture's height.",
  "allowed hand drift":
    "How far the hands may move sideways when they should stay planted, as in a push-up. A smaller number is stricter. Values are a share of the camera picture's width.",
  "lowest body angle (°)":
    "The lowest allowed angle of the line from hips to shoulders: 0° is horizontal and 90° is upright. This must be no higher than the highest body angle. Raising it narrows the allowed range.",
  "highest body angle (°)":
    "The highest allowed angle of the line from hips to shoulders: 0° is horizontal and 90° is upright. This must be no lower than the lowest body angle. Lowering it narrows the allowed range.",
  "allowed side difference (°)":
    "How different the left and right joint angles may be when both sides should move together. A smaller number requires closer matching; a larger number allows more difference.",
  "time between sides (ms)":
    "How far apart the left and right sides may reach the same position when moving together. 1,000 milliseconds is one second. A smaller number requires more closely timed movement.",
  "1. movement type":
    "Choose whether this exercise is counted by repeated motion or held for time.",
  "2. keyframes":
    "Keyframes are the important positions of the exercise: start, hardest/peak position, and return.",
  "allowed open frames":
    "How many recent frames can look like an open hand before the system rejects the grip.",
  "derived keyframe angle":
    "The angle measured from the visible rig. Dragging the active dominant chain immediately syncs its matching mobile tracking target.",
  "target angle":
    "The joint angle the movement must reach from Start. Moving farther past this target also qualifies. Changing it updates the target rig frame.",
  "start angle":
    "The joint angle that arms a rep and resets it for the next one. Changing it updates the start and return rig frames.",
  "target tolerance": "How close the movement may come to the target and still satisfy it.",
  "start tolerance": "How close the movement must be to Start before a new rep can begin.",
  "body posture": "A separate shoulder-to-hip posture check. Any uses the configured movement joints without requiring lying down or standing. Travel safeguards can still require hips.",
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
  "count rep at":
    "Peak counts once the target is reached. Return counts after Start, Target, then Return. Both require the configured range; reaching Start only arms the next rep. Preview only never adds reps.",
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
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    display: "grid",
    gap: 14,
    padding: 16,
  };
}

export function inputStyle(colors: EditorColors): CSSProperties {
  return {
    background: colors.background,
    border: `1px solid ${colors.borderStrong}`,
    borderRadius: 8,
    boxSizing: "border-box",
    color: colors.text,
    font: "inherit",
    minHeight: 42,
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
  const helpId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 12, top: 12 });
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  const showHelp = () => {
    cancelClose();
    setOpen(true);
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => {
      if (document.activeElement !== triggerRef.current) setOpen(false);
    }, 120);
  };

  useLayoutEffect(() => {
    if (!open || !help) return;
    const place = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const tooltip = tooltipRef.current?.getBoundingClientRect();
      if (!trigger || !tooltip) return;
      const left = Math.max(12, Math.min(
        trigger.left + trigger.width / 2 - tooltip.width / 2,
        window.innerWidth - tooltip.width - 12,
      ));
      const below = trigger.bottom + 8;
      const top = Math.max(12, Math.min(
        below + tooltip.height <= window.innerHeight - 12
          ? below : trigger.top - tooltip.height - 8,
        window.innerHeight - tooltip.height - 12,
      ));
      setPosition({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, help]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
    };
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node &&
          !triggerRef.current?.contains(event.target) &&
          !tooltipRef.current?.contains(event.target)) setOpen(false);
    };
    // Close just the help first, without dismissing the exercise editor.
    document.addEventListener("keydown", dismiss, true);
    document.addEventListener("pointerdown", dismissOutside, true);
    return () => {
      document.removeEventListener("keydown", dismiss, true);
      document.removeEventListener("pointerdown", dismissOutside, true);
    };
  }, [open]);
  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);
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
        <button
          ref={triggerRef}
          aria-label={`${children} help`}
          aria-describedby={open ? helpId : undefined}
          onPointerEnter={(event) => {
            if (event.pointerType !== "touch") showHelp();
          }}
          onPointerLeave={scheduleClose}
          onFocus={showHelp}
          onBlur={scheduleClose}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            showHelp();
          }}
          style={{
            alignItems: "center",
            background: open ? colors.surface : "transparent",
            border: `1px solid ${colors.border}`,
            borderRadius: 5,
            color: colors.textMuted,
            cursor: "help",
            display: "inline-flex",
            fontSize: 9,
            height: 16,
            flexShrink: 0,
            justifyContent: "center",
            letterSpacing: 0,
            lineHeight: 1,
            padding: 0,
            textTransform: "none",
            transition:
              "background-color 140ms ease, border-color 140ms ease, color 140ms ease, transform 140ms ease",
            width: 17,
          }}
          type="button"
        >
          ?
        </button>
      ) : null}
      {help && open ? createPortal(
        <span
          id={helpId}
          ref={tooltipRef}
          role="tooltip"
          onPointerEnter={cancelClose}
          onPointerLeave={scheduleClose}
          onClick={(event) => event.stopPropagation()}
          style={{
            background: colors.card,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.28)",
            boxSizing: "border-box",
            color: colors.text,
            fontSize: 12,
            fontWeight: 400,
            left: position.left,
            letterSpacing: "normal",
            lineHeight: 1.5,
            maxHeight: "calc(100dvh - 24px)",
            overflowY: "auto",
            padding: "10px 12px",
            position: "fixed",
            textTransform: "none",
            top: position.top,
            width: "min(300px, calc(100vw - 24px))",
            zIndex: 1700,
          }}
        >
          {help}
        </span>,
        document.body,
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
