"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  PoseMovementContractRecord,
  PoseSpatialRequirementsRecord,
} from "@fittrack/types";
import type {
  ExerciseMovementProfileRecord,
  ExerciseRigKeyframeKind,
  PoseKeypointRecord,
} from "@fittrack/api-client";
import {
  applyGeneratedRigDominantAngle,
  buildFallbackPoseMovementContract,
  createExerciseMovementProfile,
  createGeneratedExerciseRigFromMovementContract,
  getExerciseBodyCheckScope,
  getPoseMovementContractSideAngles,
  getPoseMovementJointTriples,
  getPoseTorsoSlopeRange,
  getSpatialRequirementsForPreset,
  getPoseRepAcceptancePolicy,
  normalizeExerciseMovementProfile,
  refreshExerciseTrackingRequirements,
  setExerciseBodyCheckScope,
  setExerciseBodyOrientation,
  setExerciseMovementJoint,
  POSE_REP_NOISE_FLOOR_DEGREES,
  POSE_MOVEMENT_CONTRACT_VERSION,
  validateExerciseEditorContract,
} from "@fittrack/utils";
import type { ExerciseBodyCheckScope, ExerciseEditorValidationIssue } from "@fittrack/utils";
import { FitButton, FitSelect } from "@/components/fit";
import { ConfirmModal } from "@/components/modals";
import {
  DYNAMIC_REP_MODEL_OPTIONS,
  EDITOR_TABS,
  FieldShell,
  LANDMARK_LABELS,
  MOVEMENT_MODE_OPTIONS,
  REQUIRED_SIDE_OPTIONS,
  RIG_BONES,
  RIG_TEMPLATE_OPTIONS,
  RIG_VIEW_OPTIONS,
  SPATIAL_RULE_PRESET_OPTIONS,
  STATIC_REQUIRED_SIDE_OPTIONS,
  TEMPLATE_DEFAULT_VIEWS,
  TEMPLATE_EXERCISE_LABELS,
  TEMPLATE_SPATIAL_PRESETS,
  clamp,
  inputStyle,
  miniButtonStyle,
  panelStyle,
  roundToStep,
  toNumber,
  type EditorColors,
  type ExerciseEditorTab,
  type MovementEditorMode,
  type RigTemplateKey,
  type RigViewTransform,
  type SpatialRulePreset,
} from "./ExerciseContractEditorShared";

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
    visibility:
      start.visibility + (end.visibility - start.visibility) * progress,
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
    return interpolateKeypoints(
      startFrame.keypoints,
      peakFrame.keypoints,
      progress,
    );
  }
  return interpolateKeypoints(
    peakFrame.keypoints,
    endFrame.keypoints,
    progress - 1,
  );
}

const FRAME_LABELS: Record<
  MovementEditorMode,
  Record<ExerciseRigKeyframeKind, string>
> = {
  dynamic_rep: {
    end: "Back to start",
    peak: "Movement goal",
    start: "Start",
  },
  static_hold: {
    end: "Exit",
    peak: "Hold",
    start: "Setup",
  },
};

const TRACKING_SETUP_STEPS = [
  { label: "Movement type", shortLabel: "Type" },
  { label: "Template", shortLabel: "Template" },
  { label: "Movement positions", shortLabel: "Positions" },
  { label: "Counting rules", shortLabel: "Counting" },
  { label: "Form checks", shortLabel: "Form checks" },
  { label: "Preview", shortLabel: "Preview" },
] as const;


const SECONDARY_LANDMARK_INDEXES = new Set([
  1, 2, 3, 4, 5, 6, 9, 10, 17, 18, 19, 20, 21, 22, 29, 30,
]);
const FINGERTIP_LANDMARK_INDEXES = new Set([17, 18, 19, 20, 21, 22]);
const BODY_HIDDEN_LANDMARK_INDEXES = new Set([
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 17, 18, 19, 20, 21, 22,
]);

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
  if (
    label &&
    ![
      "Start position",
      "Peak contraction",
      "Return",
      "Movement goal",
      "Back to start",
      "Start",
      "Setup",
      "Hold",
      "Exit",
    ].includes(label)
  ) {
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
  repModel = "bilateral",
  requiredSides = "both",
}: {
  dominantJoint: PoseMovementContractRecord["dominantJoint"];
  exercise: string;
  repModel?: NonNullable<PoseMovementContractRecord["repModel"]>;
  requiredSides?: NonNullable<PoseMovementContractRecord["requiredSides"]>;
}): PoseMovementContractRecord {
  return refreshExerciseTrackingRequirements({
    contractVersion: POSE_MOVEMENT_CONTRACT_VERSION,
    bodyOrientation: "any",
    degradedConditions: [],
    dominantJoint,
    exercise,
    noCountConditions: [],
    oscillatingJoints: [dominantJoint],
    partialRepPolicy:
      repModel === "static_hold" ? "review_only" : "strict_full_rep",
    phaseOrder:
      repModel === "static_hold"
        ? ["setup", "hold", "exit"]
        : ["start", "peak", "return"],
    primaryJoints:
      dominantJoint === "elbow"
        ? ["left_elbow", "right_elbow"]
        : dominantJoint === "knee"
          ? ["left_knee", "right_knee"]
          : dominantJoint === "hip"
            ? ["left_hip", "right_hip"]
            : dominantJoint === "ankle"
              ? ["left_ankle", "right_ankle"]
              : ["left_shoulder", "right_shoulder"],
    repModel,
    repThresholds: {
      down: { angle: 110, tolerance: 12 },
      up: { angle: 150, tolerance: 12 },
    },
    requiredSides,
    secondaryCheck: "manual_visual_editor",
    secondaryJoints: [],
    spatialRequirements: {
      leftRightSymmetryTolerance: 28,
    },
  });
}

function getTemplateContract(
  template: RigTemplateKey,
): PoseMovementContractRecord {
  const fallback = buildFallbackPoseMovementContract(
    TEMPLATE_EXERCISE_LABELS[template],
    { forAuthoring: true },
  );
  if (fallback) {
    // A vertical pull lowers the upper arms. Elbow flexion alone describes
    // curls too; use the engine's existing shoulder measurement for this template.
    if (template === "pull") return refreshExerciseTrackingRequirements({
      ...fallback,
      dominantJoint: "shoulder",
      oscillatingJoints: ["shoulder", "elbow"],
      primaryJoints: ["left_shoulder", "right_shoulder"],
      secondaryJoints: ["left_elbow", "right_elbow"],
    });
    return fallback;
  }
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

const MOVEMENT_JOINT_LABELS = {
  elbow: "Elbow — arm bend",
  upper_arm: "Upper arm — shoulders and elbows only",
  shoulder: "Shoulder — arm angle using hips",
  hip: "Hip — bend at the waist",
  knee: "Knee — leg bend",
  ankle: "Ankle — foot angle",
} as const;

function getMovementJointOption(contract?: PoseMovementContractRecord | null) {
  return contract?.dominantJoint === "shoulder" && contract.shoulderReference === "shoulder_line"
    ? "upper_arm" : contract?.dominantJoint ?? "elbow";
}

function getSpatialSecondaryCheck(preset: SpatialRulePreset, fallback: string) {
  if (preset === "none") return "angle_side_rules";
  if (preset === "ground_press") return "spatial_ground_press";
  if (preset === "vertical_pull") return "spatial_vertical_pull";
  if (preset === "lat_pulldown") return "spatial_lat_pulldown";
  if (preset === "squat_hinge") return "spatial_squat_hinge";
  return fallback || "custom_spatial_rules";
}

function inferSpatialPreset(
  contract?: PoseMovementContractRecord | null,
): SpatialRulePreset {
  const spatial = contract?.spatialRequirements;
  if (!spatial) return "none";
  // A preset describes the saved values, not the exercise's display name.
  // Otherwise a renamed/custom pulldown reopens misleadingly as Pull-up.
  for (const preset of ["lat_pulldown", "none", "ground_press", "vertical_pull", "squat_hinge"] as const) {
    const expected = getSpatialRequirementsForPreset(preset, contract) ?? {};
    const keys = new Set([...Object.keys(spatial), ...Object.keys(expected)]);
    if ([...keys].every(key => {
      // A remembered scope without a body check requires no extra points.
      // Side timing remains a counting rule even with extra form checks off.
      if (key === "bodyLineScope" && spatial.bodyLineTolerance == null && expected.bodyLineTolerance == null) return true;
      if (preset === "none" && key === "phaseSyncToleranceMs") return true;
      return spatial[key as keyof PoseSpatialRequirementsRecord] === expected[key as keyof PoseSpatialRequirementsRecord];
    })) return preset;
  }
  return "custom";
}

function getSpatialPresetLabel(preset: SpatialRulePreset) {
  return (
    SPATIAL_RULE_PRESET_OPTIONS.find((option) => option.value === preset)
      ?.label ?? "Custom"
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
        contract.requiredSides === "alternating"
          ? "either"
          : (contract.requiredSides ?? "either"),
      spatialRequirements: {
        ...contract.spatialRequirements,
        bodyLineTolerance:
          contract.spatialRequirements?.bodyLineTolerance ?? 28,
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
    partialRepPolicy: contract.partialRepPolicy ?? "strict_full_rep",
    phaseOrder: ["start", "peak", "return"],
    repModel: nextRepModel,
    requiredSides:
      nextRepModel === "bilateral"
        ? "both"
        : (contract.requiredSides ?? "either"),
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
    trackingRequirements: contract.trackingRequirements ? { ...contract.trackingRequirements, requiredSides } : undefined,
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
  if (a.visibility < 0.1 || b.visibility < 0.1 || c.visibility < 0.1)
    return null;
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
  const triples = getPoseMovementJointTriples(contract ?? { dominantJoint: "elbow" });
  const angles = contract ? getPoseMovementContractSideAngles(contract, points) : null;
  return {
    left: angles ? angles.left : getAngleFromTriple(points, triples.left),
    leftJointIndex: triples.left[1],
    right: angles ? angles.right : getAngleFromTriple(points, triples.right),
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

type MovementEditorValidationIssue = ExerciseEditorValidationIssue & {
  movementStep?: number;
  stepId?: string;
};

const VALIDATION_DANGER_COLOR = "#fca5a5";

function issuePathKey(path: string) {
  return path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
}

function getIssuesForPath(
  issues: MovementEditorValidationIssue[] | undefined,
  path: string,
  aliases: string[] = [],
) {
  if (!issues?.length) return [];
  const acceptedPaths = new Set([path, ...aliases]);
  return issues.filter((issue) => acceptedPaths.has(issue.path));
}

function getMovementIssueStage(issue: MovementEditorValidationIssue) {
  if (typeof issue.movementStep === "number") {
    return Math.max(0, Math.min(5, issue.movementStep));
  }
  if (issue.path.includes("spatialRequirements")) return 4;
  if (
    issue.path.includes("repThresholds") ||
    issue.path.includes("holdDurationSeconds") ||
    issue.path.includes("partialRepPolicy") ||
    issue.path.includes("countAt") ||
    issue.path.includes("requiredSides") ||
    issue.path.includes("repModel")
  ) {
    return 3;
  }
  if (
    issue.path.includes("rig") ||
    issue.path.includes("trackingRequirements") ||
    issue.path.includes("primaryJoints")
  ) {
    return 2;
  }
  return 0;
}

function getMovementIssueStages(issue: MovementEditorValidationIssue) {
  const stage = getMovementIssueStage(issue);
  return issue.path.includes(".repThresholds.") && issue.path.endsWith(".angle")
    ? Array.from(new Set([2, stage]))
    : [stage];
}

function renderValidationHint({
  fieldPath,
  issues,
  suffix,
}: {
  fieldPath: string;
  issues: ExerciseEditorValidationIssue[];
  suffix?: string;
}) {
  if (!issues.length) return null;
  const id = `exercise-validation-${issuePathKey(fieldPath)}${suffix ? `-${suffix}` : ""}`;
  return (
    <div
      aria-live="polite"
      data-validation-path={fieldPath}
      id={id}
      role="alert"
      style={{
        color: VALIDATION_DANGER_COLOR,
        display: "grid",
        fontSize: 11,
        gap: 2,
        lineHeight: 1.35,
      }}
    >
      {issues.map((issue, index) => (
        <span key={`${issue.code}-${issue.path}-${index}`}>
          <strong>{issue.message}</strong> {issue.suggestion}
        </span>
      ))}
    </div>
  );
}

export function MovementProfileEditor({
  colors,
  exerciseName,
  focusIssuePath,
  isCanonical = false,
  onChange,
  onOpenHandSetup,
  onRequestEdit,
  readOnly = false,
  validationIssues,
  value,
}: {
  colors: EditorColors;
  exerciseName?: string;
  focusIssuePath?: string;
  isCanonical?: boolean;
  onChange: (nextProfile: ExerciseMovementProfileRecord | null) => void;
  onOpenHandSetup?: () => void;
  onRequestEdit?: () => void;
  readOnly?: boolean;
  validationIssues?: MovementEditorValidationIssue[];
  value: ExerciseMovementProfileRecord | null;
}) {
  const suppliedProfile = useMemo(
    () => normalizeExerciseMovementProfile(value),
    [value],
  );
  const hasUsableRig = Boolean(suppliedProfile?.rig?.keyframes?.length);
  const starterContract = useMemo(
    () =>
      suppliedProfile?.movementContract ??
      buildFallbackPoseMovementContract(exerciseName, { forAuthoring: true }) ??
      getTemplateContract("blank"),
    [exerciseName, suppliedProfile?.movementContract],
  );
  const starterRig = useMemo(
    () =>
      hasUsableRig
        ? null
        : relabelRigFrames(
            createGeneratedExerciseRigFromMovementContract({
              exerciseLabel: exerciseName ?? starterContract.exercise,
              movementContract: starterContract,
            }),
            inferMovementMode(starterContract),
          ),
    [exerciseName, hasUsableRig, starterContract],
  );
  const profile = useMemo(
    () =>
      hasUsableRig
        ? suppliedProfile
        : createExerciseMovementProfile({
            movementContract:
              suppliedProfile?.movementContract ?? starterContract,
            rig: starterRig,
            warnings: suppliedProfile?.warnings ?? [],
          }),
    [hasUsableRig, suppliedProfile, starterContract, starterRig],
  );
  const rig = profile?.rig ?? null;
  const keyframes = rig?.keyframes ?? [];
  const generatedContract = profile?.movementContract ?? starterContract;
  const contract = profile?.movementContract ?? generatedContract;
  const movementValidationIssues = useMemo(
    () =>
      (validationIssues ?? []).filter((issue) =>
        issue.path.startsWith("movementProfile"),
      ),
    [validationIssues],
  );
  const movementValidationIssuesRef = useRef(movementValidationIssues);
  movementValidationIssuesRef.current = movementValidationIssues;
  const movementValidationIssueKey = movementValidationIssues
    .map((issue) => `${issue.code}:${issue.path}`)
    .join("|");
  const rigValidationIssues = getIssuesForPath(
    movementValidationIssues,
    "movementProfile.rig.keyframes",
  );
  const thresholdIssues = {
    downAngle: getIssuesForPath(
      movementValidationIssues,
      "movementProfile.movementContract.repThresholds.down.angle",
    ),
    downTolerance: getIssuesForPath(
      movementValidationIssues,
      "movementProfile.movementContract.repThresholds.down.tolerance",
    ),
    upAngle: getIssuesForPath(
      movementValidationIssues,
      "movementProfile.movementContract.repThresholds.up.angle",
    ),
    upTolerance: getIssuesForPath(
      movementValidationIssues,
      "movementProfile.movementContract.repThresholds.up.tolerance",
    ),
  };
  const thresholdTargetsAreUsable = Boolean(
    contract &&
      [
        contract.repThresholds?.down?.angle,
        contract.repThresholds?.down?.tolerance,
        contract.repThresholds?.up?.angle,
        contract.repThresholds?.up?.tolerance,
      ].every((value, index) => {
        if (!Number.isFinite(value)) return false;
        if (index === 0 || index === 2) return value >= 0 && value <= 180;
        return value >= 0 && value <= 45;
      }),
  );
  const thresholdValidationActive = movementValidationIssues.some((issue) =>
    issue.path.includes("repThresholds"),
  );
  const currentTargetsAreValid =
    thresholdTargetsAreUsable && !thresholdValidationActive;
  const editorRootRef = useRef<HTMLElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [activeKind, setActiveKind] = useSafeKeyframeKind(keyframes);
  const [dragPoint, setDragPoint] = useState<number | null>(null);
  const [dragValidationNotice, setDragValidationNotice] = useState<string | null>(
    null,
  );
  const dragPointerIdRef = useRef<number | null>(null);
  const lastProcessedPointerRef = useRef<{
    clientX: number;
    clientY: number;
    pointIndex: number;
    pointerId: number;
  } | null>(null);
  const lastDragAtRef = useRef(0);
  const [previewMotion, setPreviewMotion] = useState(false);
  const [activeSetupStep, setActiveSetupStep] = useState(() => {
    const firstIssue = (validationIssues ?? []).find((issue) =>
      issue.path.startsWith("movementProfile"),
    );
    return firstIssue ? getMovementIssueStage(firstIssue) : 0;
  });
  const [selectedTemplate, setSelectedTemplate] =
    useState<RigTemplateKey | null>(null);
  const [regenerateConfirmTemplate, setRegenerateConfirmTemplate] = useState<
    RigTemplateKey | "generated" | null
  >(null);
  const [spatialPresetOverride, setSpatialPresetOverride] =
    useState<SpatialRulePreset | null>(null);
  const [viewTransform, setViewTransform] = useState<RigViewTransform>("front");
  const viewDefaultKeyRef = useRef("");
  const focusRequestRef = useRef<{
    path: string;
    stage: number;
    status: "pending" | "consumed";
  } | null>(null);

  useEffect(() => {
    const editorRoot = editorRootRef.current;
    if (!editorRoot) return;

    let scrollContainer: HTMLElement | null = editorRoot.parentElement;
    while (scrollContainer) {
      if (scrollContainer.scrollHeight > scrollContainer.clientHeight + 2) {
        scrollContainer.scrollTo({ top: 0, behavior: "auto" });
        break;
      }
      scrollContainer = scrollContainer.parentElement;
    }
  }, [activeSetupStep]);

  useEffect(() => {
    const requestedPath = focusIssuePath?.trim();
    if (!requestedPath) {
      focusRequestRef.current = null;
      return undefined;
    }
    const currentIssues = movementValidationIssuesRef.current;
    const requestedIssue =
      currentIssues.find((issue) => issue.path === requestedPath) ??
      currentIssues.find((issue) =>
        requestedPath.startsWith(issue.path),
      );
    if (!requestedIssue) return undefined;
    const requestedStage = getMovementIssueStage(requestedIssue);
    if (
      !focusRequestRef.current ||
      focusRequestRef.current.path !== requestedPath
    ) {
      focusRequestRef.current = {
        path: requestedPath,
        stage: requestedStage,
        status: "pending",
      };
    }
    const request = focusRequestRef.current;
    if (!request || request.status === "consumed") return undefined;
    if (activeSetupStep !== request.stage) {
      setActiveSetupStep(request.stage);
      return undefined;
    }

    let frame = 0;
    const focusTarget = () => {
      if (focusRequestRef.current?.path !== requestedPath) return;
      const root = editorRootRef.current;
      if (!root) {
        focusRequestRef.current = { ...request, status: "consumed" };
        return;
      }
      const target = Array.from(
        root.querySelectorAll<HTMLElement>("[data-exercise-field]"),
      ).find(
        (element) => element.dataset.exerciseField === requestedPath,
      );
      if (!target) {
        focusRequestRef.current = { ...request, status: "consumed" };
        return;
      }
      const enclosingDetails = target.closest("details");
      if (enclosingDetails && !enclosingDetails.open) {
        enclosingDetails.open = true;
        frame = window.requestAnimationFrame(focusTarget);
        return;
      }
      focusRequestRef.current = { ...request, status: "consumed" };
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      }
    };
    frame = window.requestAnimationFrame(focusTarget);
    return () => window.cancelAnimationFrame(frame);
  }, [activeSetupStep, focusIssuePath, movementValidationIssueKey]);
  const activeIndex = Math.max(
    0,
    keyframes.findIndex((frame) => frame.kind === activeKind),
  );
  const activeFrame = keyframes[activeIndex] ?? null;
  const defaultLandmarkIndex =
    contract?.dominantJoint === "knee"
      ? 25
      : contract?.dominantJoint === "hip"
        ? 23
        : contract?.dominantJoint === "shoulder"
          ? 11
          : contract?.dominantJoint === "ankle"
            ? 27
            : 13;
  const [selectedPoint, setSelectedPoint] = useSafePointIndex(
    activeFrame,
    defaultLandmarkIndex,
  );
  const editableLandmarkIndexes = useMemo(
    () =>
      (activeFrame?.keypoints ?? [])
        .map((_, index) => index)
        .filter((index) => !BODY_HIDDEN_LANDMARK_INDEXES.has(index)),
    [activeFrame?.keypoints],
  );
  const selectedEditablePoint = BODY_HIDDEN_LANDMARK_INDEXES.has(selectedPoint)
    ? (editableLandmarkIndexes[0] ?? defaultLandmarkIndex)
    : selectedPoint;
  const selectedPointLocked = BODY_HIDDEN_LANDMARK_INDEXES.has(selectedPoint);
  const movementMode = inferMovementMode(contract);
  const inferredSpatialPreset = useMemo(
    () => inferSpatialPreset(contract),
    [contract],
  );
  const spatialPreset = spatialPresetOverride ?? inferredSpatialPreset;
  const editableView = viewTransform === "front" || viewTransform === "mirror";
  const sourcePoints =
    previewMotion && keyframes.length >= 2
      ? getAnimatedKeypoints(keyframes, animationProgress)
      : (activeFrame?.keypoints ?? []);
  const displayPoints = sourcePoints.map((point) =>
    point ? transformPointForView(point, viewTransform) : point,
  );
  const activeAngleSummaries = getSideAngleSummaries(
    contract,
    activeFrame?.keypoints ?? [],
  );
  const dominantLandmarkIndexes = new Set<number>(
    contract
      ? [
          ...getPoseMovementJointTriples(contract).left,
          ...getPoseMovementJointTriples(contract).right,
        ]
      : [],
  );
  const dominantSide =
    contract?.requiredSides === "right" ||
    contract?.repModel === "unilateral_right"
      ? "right"
      : "left";
  const dominantAngle =
    dominantSide === "right"
      ? activeAngleSummaries.right
      : (activeAngleSummaries.left ?? activeAngleSummaries.right);
  const dominantJointIndex =
    dominantSide === "right"
      ? activeAngleSummaries.rightJointIndex
      : activeAngleSummaries.leftJointIndex;
  const dominantJointPoint = activeFrame?.keypoints[dominantJointIndex]
    ? transformPointForView(
        activeFrame.keypoints[dominantJointIndex],
        viewTransform,
      )
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
    setSpatialPresetOverride(null);
    setViewTransform("front");
  }, [contract, exerciseName, keyframes.length, movementMode]);

  useEffect(() => {
    if (!previewMotion || keyframes.length < 2) return undefined;
    const startedAt = Date.now();
    const interval = window.setInterval(() => {
      const elapsed = (Date.now() - startedAt) % 2400;
      setAnimationProgress(
        elapsed <= 1200 ? elapsed / 1200 : 2 - elapsed / 1200,
      );
    }, 80);
    return () => window.clearInterval(interval);
  }, [keyframes.length, previewMotion]);

  useEffect(() => {
    if (dragPoint === null) return undefined;
    const clearDrag = () => {
      const pointerId = dragPointerIdRef.current;
      if (
        pointerId !== null &&
        svgRef.current?.hasPointerCapture?.(pointerId)
      ) {
        try {
          svgRef.current.releasePointerCapture(pointerId);
        } catch {
          // Pointer capture can already be gone when the window loses focus.
        }
      }
      dragPointerIdRef.current = null;
      lastProcessedPointerRef.current = null;
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
    if (readOnly) return;
    setDragValidationNotice(null);
    onChange(
      nextProfile ? normalizeExerciseMovementProfile(nextProfile) : null,
    );
  };

  const applyGeneratedProfile = (template?: RigTemplateKey) => {
    if (readOnly) return;
    if (!template && !currentTargetsAreValid) {
      setDragValidationNotice(
        "Fix the starting angle, goal angle, and allowed differences before resetting the drawing.",
      );
      return;
    }
    if (!template && profile?.movementContract) {
      const currentContract = profile.movementContract;
      const nextMode = inferMovementMode(currentContract);
      const generatedRig = createGeneratedExerciseRigFromMovementContract({
        exerciseLabel: currentContract.exercise,
        movementContract: currentContract,
      });
      setDragValidationNotice(null);
      onChange({
        ...profile,
        movementContract: currentContract,
        rig: relabelRigFrames(generatedRig, nextMode),
        warnings: profile.warnings ?? [],
      });
      return;
    }
    const sourceContract = template
      ? getTemplateContract(template)
      : generatedContract;
    if (!sourceContract) return;
    const nextMode = inferMovementMode(sourceContract);
    const baseContract = patchContractForMode(sourceContract, nextMode);
    const nextPreset = template
      ? TEMPLATE_SPATIAL_PRESETS[template]
      : inferSpatialPreset(baseContract);
    const movementContract = refreshExerciseTrackingRequirements({
      ...baseContract,
      secondaryCheck: getSpatialSecondaryCheck(
        nextPreset,
        baseContract.secondaryCheck,
      ),
      spatialRequirements: getSpatialRequirementsForPreset(
        nextPreset,
        baseContract,
      ),
    });
    setSpatialPresetOverride(nextPreset);
    setViewTransform(
      template
        ? TEMPLATE_DEFAULT_VIEWS[template]
        : "front",
    );
    const generatedRig = createGeneratedExerciseRigFromMovementContract({
      exerciseLabel: template
        ? TEMPLATE_EXERCISE_LABELS[template]
        : (exerciseName ?? movementContract.exercise),
      movementContract,
    });
    patchProfile(
      createExerciseMovementProfile({
        movementContract,
        rig: relabelRigFrames(generatedRig, nextMode),
        warnings: [
          template
            ? `Created a drawing from the ${TEMPLATE_EXERCISE_LABELS[template]} template. Adjust before saving.`
            : "Created a drawing from the current movement settings. Adjust before saving.",
          `Spatial rules preset: ${getSpatialPresetLabel(nextPreset)}. Starter rules are editable.`,
        ],
      }),
    );
  };

  const createGeneratedProfile = (template?: RigTemplateKey) => {
    if (readOnly) return;
    if (!template && !currentTargetsAreValid) {
      setDragValidationNotice(
        "Fix the starting angle, goal angle, and allowed differences before resetting the drawing.",
      );
      return;
    }
    if (rig) {
      setRegenerateConfirmTemplate(template ?? "generated");
      return;
    }

    applyGeneratedProfile(template);
  };

  const handleConfirmRegenerate = () => {
    if (readOnly) {
      setRegenerateConfirmTemplate(null);
      return;
    }
    const template =
      regenerateConfirmTemplate === "generated"
        ? undefined
        : (regenerateConfirmTemplate ?? undefined);
    setRegenerateConfirmTemplate(null);
    applyGeneratedProfile(template);
  };

  const patchMovementContract = (
    patch: Partial<
      NonNullable<ExerciseMovementProfileRecord["movementContract"]>
    >,
  ) => {
    if (readOnly) return;
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
    if (readOnly) return;
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

  const setRepModel = (
    repModel: (typeof DYNAMIC_REP_MODEL_OPTIONS)[number],
  ) => {
    if (readOnly) return;
    if (!contract) return;
    patchMovementContract(patchContractForRepModel(contract, repModel));
  };

  const setSpatialPreset = (nextPreset: SpatialRulePreset) => {
    if (readOnly) return;
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
    patchProfile(
      createExerciseMovementProfile({
        movementContract: refreshExerciseTrackingRequirements(nextContract),
        rig,
        warnings: profile?.warnings ?? [],
      }),
    );
  };

  const patchThreshold = (
    phase: "down" | "up",
    patch: Partial<NonNullable<typeof contract>["repThresholds"]["down"]>,
  ) => {
    if (readOnly) return;
    if (!contract) return;
    const nextContract: PoseMovementContractRecord = {
      ...contract,
      repThresholds: {
        ...contract.repThresholds,
        [phase]: {
          ...contract.repThresholds[phase],
          ...patch,
        },
      },
    };
    const targetAngle = nextContract.repThresholds[phase].angle;
    const targetKinds =
      phase === "down"
        ? new Set<ExerciseRigKeyframeKind>(["peak"])
        : new Set<ExerciseRigKeyframeKind>(["start", "end"]);
    const nextRig = rig
      ? {
          ...rig,
          angleSummary: {
            dominantJoint: nextContract.dominantJoint,
            maxAngle: Math.max(
              nextContract.repThresholds.down.angle,
              nextContract.repThresholds.up.angle,
            ),
            minAngle: Math.min(
              nextContract.repThresholds.down.angle,
              nextContract.repThresholds.up.angle,
            ),
            repCount: rig.angleSummary?.repCount ?? 0,
            travel: Math.abs(
              nextContract.repThresholds.up.angle -
                nextContract.repThresholds.down.angle,
            ),
          },
          keyframes: rig.keyframes.map((frame) =>
            targetKinds.has(frame.kind)
              ? {
                  ...frame,
                  angle: targetAngle,
                  keypoints: applyGeneratedRigDominantAngle(
                    frame.keypoints,
                    nextContract.dominantJoint,
                    targetAngle,
                    nextContract.shoulderReference,
                  ),
                }
              : frame,
          ),
        }
      : relabelRigFrames(
          createGeneratedExerciseRigFromMovementContract({
            exerciseLabel: exerciseName ?? nextContract.exercise,
            movementContract: nextContract,
          }),
          movementMode,
        );
    patchProfile(
      createExerciseMovementProfile({
        movementContract: nextContract,
        rig: nextRig,
        warnings: profile?.warnings ?? [],
      }),
    );
  };

  const patchSpatialRequirement = (
    patch: Partial<
      NonNullable<PoseMovementContractRecord["spatialRequirements"]>
    >,
  ) => {
    if (readOnly) return;
    if (!contract) return;
    setSpatialPresetOverride(null);
    const editsTorsoRange = "torsoSlopeMinDeg" in patch || "torsoSlopeMaxDeg" in patch;
    const currentRange = getPoseTorsoSlopeRange(contract);
    patchMovementContract(refreshExerciseTrackingRequirements({
      ...contract,
      spatialRequirements: {
        ...contract.spatialRequirements,
        ...(editsTorsoRange ? { torsoSlopeMinDeg: currentRange.min, torsoSlopeMaxDeg: currentRange.max } : {}),
        ...patch,
      },
    }));
  };

  const patchActiveFrame = (
    patch: Partial<NonNullable<typeof activeFrame>>,
  ) => {
    if (readOnly) return;
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

  const getMovementProfileIssues = (
    candidateProfile: ExerciseMovementProfileRecord | null,
  ) =>
    validateExerciseEditorContract({
      expectedMovementExercise:
        candidateProfile?.movementContract?.exercise ?? null,
      movementProfile: candidateProfile,
    }).issues.filter((issue) => issue.path.startsWith("movementProfile"));

  const getMovementValidationScore = (
    candidateProfile: ExerciseMovementProfileRecord | null,
    candidateIssues: ExerciseEditorValidationIssue[],
  ) => {
    const issueCodes = new Set(candidateIssues.map((issue) => issue.code));
    let score = issueCodes.size * 1000;
    const candidateContract = candidateProfile?.movementContract;
    if (candidateContract && candidateContract.repModel !== "static_hold") {
      const policy = getPoseRepAcceptancePolicy(candidateContract);
      const gap =
        policy.direction === "increase"
          ? policy.targetBand.min - policy.startBand.max
          : policy.startBand.min - policy.targetBand.max;
      score += Math.max(0, POSE_REP_NOISE_FLOOR_DEGREES - gap);
    }
    return score;
  };

  const hasCollapsedDominantGeometry = (
    points: PoseKeypointRecord[],
    candidateContract: PoseMovementContractRecord | null | undefined,
  ) => {
    const triples = getPoseMovementJointTriples(candidateContract ?? { dominantJoint: "elbow" });
    const angles = getSideAngleSummaries(candidateContract, points);
    return (["left", "right"] as const).some((side) => {
      if (angles[side] == null) return true;
      const [proximal, joint, distal] = triples[side];
      const proximalPoint = points[proximal];
      const jointPoint = points[joint];
      const distalPoint = points[distal];
      if (!proximalPoint || !jointPoint || !distalPoint) return true;
      return (
        ![proximalPoint, jointPoint, distalPoint].every(
          (point) =>
            Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            Number.isFinite(point.z),
        ) ||
        Math.hypot(proximalPoint.x - jointPoint.x, proximalPoint.y - jointPoint.y) <
          0.002 ||
        Math.hypot(distalPoint.x - jointPoint.x, distalPoint.y - jointPoint.y) <
          0.002
      );
    });
  };

  const shouldCommitPointCandidate = (
    candidateProfile: ExerciseMovementProfileRecord,
    candidateKeypoints: PoseKeypointRecord[],
  ) => {
    if (hasCollapsedDominantGeometry(candidateKeypoints, candidateProfile.movementContract)) {
      setDragValidationNotice(
        "These points are too close together to measure the joint's bend. Move the elbow or knee away from its neighbouring points.",
      );
      return false;
    }
    const currentIssues = getMovementProfileIssues(profile);
    const candidateIssues = getMovementProfileIssues(candidateProfile);
    const currentCodes = new Set(currentIssues.map((issue) => issue.code));
    const newIssueCodes = candidateIssues.some(
      (issue) => !currentCodes.has(issue.code),
    );
    if (newIssueCodes) {
      setDragValidationNotice(
        "That position conflicts with the movement settings. The last valid position is kept. Check the red fields, or drag the joint closer to its previous position.",
      );
      return false;
    }
    if (
      getMovementValidationScore(candidateProfile, candidateIssues) >
      getMovementValidationScore(profile, currentIssues)
    ) {
      setDragValidationNotice(
        "That move takes the joint farther from the allowed angle. The last valid position is kept; try moving it closer to the goal angle.",
      );
      return false;
    }
    return true;
  };

  const patchPoint = (
    pointIndex: number,
    patch: Partial<PoseKeypointRecord>,
  ) => {
    if (readOnly) return;
    if (BODY_HIDDEN_LANDMARK_INDEXES.has(pointIndex)) return;
    if (!activeFrame || !profile || !rig) return;
    let nextKeypoints = activeFrame.keypoints.map((point, index) =>
      index === pointIndex ? { ...point, ...patch } : point,
    );
    const editedPoint = nextKeypoints[pointIndex];
    if (
      !editedPoint ||
      ![editedPoint.x, editedPoint.y, editedPoint.z, editedPoint.visibility].every(
        (value) => Number.isFinite(value),
      )
    ) {
      setDragValidationNotice(
        "That point needs a valid number for its position. The last valid position is kept.",
      );
      return;
    }
    const triples = getPoseMovementJointTriples(contract ?? { dominantJoint: "elbow" });
    const editedSide = (triples.right as readonly number[]).includes(pointIndex)
      ? "right"
      : (triples.left as readonly number[]).includes(pointIndex)
        ? "left"
        : null;
    const measuredAngle = editedSide
      ? getSideAngleSummaries(contract, nextKeypoints)[editedSide]
      : null;
    const nextAngle =
      typeof measuredAngle === "number" && Number.isFinite(measuredAngle)
        ? Math.round(measuredAngle * 10) / 10
        : activeFrame.angle;
    const syncPhase = activeFrame.kind === "peak" ? "down" : "up";
    const nextContract =
      contract &&
      movementMode === "dynamic_rep" &&
      editedSide &&
      typeof nextAngle === "number"
        ? {
            ...contract,
            repThresholds: {
              ...contract.repThresholds,
              [syncPhase]: {
                ...contract.repThresholds[syncPhase],
                angle: nextAngle,
              },
            },
          }
        : contract;
    if (editedSide && nextContract?.requiredSides === "both" && typeof nextAngle === "number") {
      // One endpoint input owns both sides. Keep the edited geometry and bring
      // the opposite dominant chain to the same target before validation.
      const synchronized = applyGeneratedRigDominantAngle(nextKeypoints, nextContract.dominantJoint, nextAngle, nextContract.shoulderReference);
      const editedIndexes = new Set(editedSide === "left" ? [11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31] : [12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32]);
      nextKeypoints = synchronized.map((point, index) => editedIndexes.has(index) ? nextKeypoints[index]! : point);
    }
    const candidateProfile: ExerciseMovementProfileRecord = {
      ...profile,
      movementContract: nextContract ?? profile.movementContract,
      rig: {
        ...rig,
        referenceVersion: 2,
        angleSummary:
          nextContract && rig.angleSummary
            ? {
                ...rig.angleSummary,
                maxAngle: Math.max(
                  nextContract.repThresholds.down.angle,
                  nextContract.repThresholds.up.angle,
                ),
                minAngle: Math.min(
                  nextContract.repThresholds.down.angle,
                  nextContract.repThresholds.up.angle,
                ),
                travel: Math.abs(
                  nextContract.repThresholds.up.angle -
                    nextContract.repThresholds.down.angle,
                ),
              }
            : rig.angleSummary,
        keyframes: keyframes.map((frame, index) =>
          index === activeIndex
            ? { ...frame, angle: nextAngle, keypoints: nextKeypoints }
            : editedSide &&
                nextContract &&
                typeof nextAngle === "number" &&
                ((syncPhase === "down" && frame.kind === "peak") ||
                  (syncPhase === "up" &&
                    (frame.kind === "start" || frame.kind === "end")))
              ? {
                  ...frame,
                  angle: nextAngle,
                  keypoints: applyGeneratedRigDominantAngle(
                    frame.keypoints,
                    nextContract.dominantJoint,
                    nextAngle,
                    nextContract.shoulderReference,
                  ),
                }
          : frame,
        ),
      },
    };
    if (!shouldCommitPointCandidate(candidateProfile, nextKeypoints)) return;
    patchProfile(candidateProfile);
  };

  const patchActivePoint = (patch: Partial<PoseKeypointRecord>) => {
    if (selectedPointLocked) return;
    patchPoint(selectedEditablePoint, patch);
  };

  const updatePointFromPointer = (
    event: ReactPointerEvent<Element>,
    pointIndex: number,
  ) => {
    if (readOnly || !editableView || previewMotion || !svgRef.current) return;
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
    const lastProcessedPointer = lastProcessedPointerRef.current;
    if (
      lastProcessedPointer &&
      lastProcessedPointer.pointerId === event.pointerId &&
      lastProcessedPointer.pointIndex === pointIndex &&
      lastProcessedPointer.clientX === event.clientX &&
      lastProcessedPointer.clientY === event.clientY
    ) {
      return;
    }
    lastProcessedPointerRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      pointIndex,
      pointerId: event.pointerId,
    };
    patchPoint(pointIndex, {
      visibility: Math.max(
        activeFrame?.keypoints[pointIndex]?.visibility ?? 0.92,
        0.72,
      ),
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

  const releaseSvgPointerCapture = (
    event?: ReactPointerEvent<SVGSVGElement>,
  ) => {
    const pointerId = dragPointerIdRef.current;
    const target = event?.currentTarget ?? svgRef.current;
    if (
      pointerId !== null &&
      target?.hasPointerCapture?.(pointerId)
    ) {
      try {
        target.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be gone when the browser emits lostcapture.
      }
    }
  };

  const finishDrag = (
    event: ReactPointerEvent<SVGSVGElement> | undefined,
    commitPointerPosition: boolean,
  ) => {
    try {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
        if (commitPointerPosition && dragPoint !== null) {
          updatePointFromPointer(event, dragPoint);
        }
      }
    } finally {
      releaseSvgPointerCapture(event);
      dragPointerIdRef.current = null;
      lastProcessedPointerRef.current = null;
      setDragPoint(null);
    }
  };

  const handleSvgPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    finishDrag(event, true);
  };

  const handleSvgPointerCancel = (event: ReactPointerEvent<SVGSVGElement>) => {
    finishDrag(event, false);
  };

  const renderRigViewButton = (view: RigViewTransform) => {
    const option = RIG_VIEW_OPTIONS.find((candidate) => candidate.value === view);
    if (!option) return null;
    return (
      <button
        aria-pressed={viewTransform === option.value}
        disabled={!rig || !keyframes.length || option.value === "side"}
        title={option.value === "side" ? "This drawing does not have a separate side view." : undefined}
        key={option.value}
        onClick={() => setViewTransform(option.value)}
        style={{
          ...miniButtonStyle(colors, viewTransform === option.value),
          borderRadius: 6,
          boxShadow: "none",
          fontSize: 9,
          fontWeight: 600,
          lineHeight: 1.1,
          minHeight: 22,
          opacity: !rig || !keyframes.length || option.value === "side" ? 0.45 : 1,
          padding: "3px 6px",
          whiteSpace: "nowrap",
        }}
        type="button"
      >
        {option.label}
      </button>
    );
  };

  const productionRigSvg = (
    <svg
      aria-label="Editable full-body movement rig"
      data-rig-visible-landmarks={
        displayPoints.filter(
          (point, index) =>
            point &&
            point.visibility >= 0.1 &&
            !BODY_HIDDEN_LANDMARK_INDEXES.has(index),
        ).length
      }
      data-testid="exercise-full-body-rig"
      onLostPointerCapture={handleSvgPointerCancel}
      onPointerCancel={handleSvgPointerCancel}
      onPointerLeave={handleSvgPointerCancel}
      onPointerMove={handleSvgPointerMove}
      onPointerUp={handleSvgPointerUp}
      ref={svgRef}
      role="img"
      style={{
        display: "block",
        cursor:
          readOnly
            ? "default"
            : dragPoint !== null
              ? "grabbing"
              : editableView && !previewMotion
                ? "default"
                : "auto",
        height: 360,
        maxHeight: 360,
        minHeight: 360,
        overscrollBehavior: "contain",
        touchAction: "none",
        userSelect: "none",
        width: "100%",
      }}
      preserveAspectRatio="xMidYMid meet"
      viewBox="2 2 96 96"
    >
      {RIG_BONES.map(([from, to]) => {
        if (
          BODY_HIDDEN_LANDMARK_INDEXES.has(from) ||
          BODY_HIDDEN_LANDMARK_INDEXES.has(to)
        ) {
          return null;
        }
        const start = getKeypointPosition(displayPoints[from]);
        const end = getKeypointPosition(displayPoints[to]);
        if (!start || !end) return null;
        const secondaryBone =
          SECONDARY_LANDMARK_INDEXES.has(from) ||
          SECONDARY_LANDMARK_INDEXES.has(to);
        return (
          <line
            data-rig-bone={`${from}-${to}`}
            key={`${from}-${to}`}
            stroke={
              secondaryBone
                ? "rgba(255,255,255,0.34)"
                : "rgba(255,255,255,0.68)"
            }
            strokeLinecap="round"
            strokeWidth={secondaryBone ? 0.8 : 1.25}
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
          strokeOpacity={0.55}
          strokeWidth={0.9}
          x1={shoulderCenterPosition.cx}
          x2={hipCenterPosition.cx}
          y1={shoulderCenterPosition.cy}
          y2={hipCenterPosition.cy}
        >
          <title>
            Torso line: spatial rules use this to reject fake push-up posture.
          </title>
        </line>
      ) : null}
      {spatialPreset === "ground_press"
        ? [leftWristPosition, rightWristPosition].map(
            (position, index) =>
              position ? (
                <circle
                  cx={position.cx}
                  cy={position.cy}
                 fill="none"
                  key={`wrist-anchor-${index}`}
                 r={5.5}
                  stroke="#facc15"
                  strokeDasharray="2 3"
                  strokeWidth={1}
                >
                  <title>
                    Wrist anchor zone: push-ups should keep hands planted.
                  </title>
                </circle>
              ) : null,
          )
        : null}
      {dominantJointPosition &&
      typeof dominantAngle === "number" ? (
        <>
          <path
            d={describeAngleArc(
              dominantJointPosition.cx,
              dominantJointPosition.cy,
              4.5,
              105,
            )}
            fill="none"
            stroke="#3ed875"
            strokeLinecap="round"
            strokeWidth={1.35}
          />
          <text
            fill="#59f08b"
            fontSize={4}
            fontWeight={800}
            textAnchor={dominantSide === "left" ? "end" : "start"}
            x={
              dominantJointPosition.cx +
              (dominantSide === "left" ? -8 : 8)
            }
            y={dominantJointPosition.cy - 4}
          >
            {dominantAngle} deg
          </text>
        </>
      ) : null}
      {displayPoints.map((point, index) => {
        if (BODY_HIDDEN_LANDMARK_INDEXES.has(index)) return null;
        const position = getKeypointPosition(point);
        if (!point || !position) return null;
        const isFingertip = FINGERTIP_LANDMARK_INDEXES.has(index);
        const nodeLabel = isFingertip
          ? `${index}: ${LANDMARK_LABELS[index] ?? "landmark"} — Edit fingertips in Configure hand shapes`
          : `${index}: ${LANDMARK_LABELS[index] ?? "landmark"} (${Math.round(point.x * 100)}% x, ${Math.round(point.y * 100)}% y)`;
        const nodeTitle = isFingertip
          ? "Edit fingertips in Configure hand shapes"
          : nodeLabel;
        const isSelected = index === selectedEditablePoint;
        const isDominant = dominantLandmarkIndexes.has(index);
        const isSecondary = SECONDARY_LANDMARK_INDEXES.has(index);
        const handlePointerDown = (
          event: ReactPointerEvent<Element>,
        ) => {
          event.preventDefault();
          event.stopPropagation();
          if (isFingertip) return;
          setSelectedPoint(index);
          if (readOnly || !editableView || previewMotion) return;
          lastProcessedPointerRef.current = null;
          dragPointerIdRef.current = event.pointerId;
          lastDragAtRef.current = 0;
          setDragPoint(index);
          try {
            svgRef.current?.setPointerCapture(event.pointerId);
          } catch {
            // Synthetic/browser-tool pointer events may not own an active pointer.
          }
          updatePointFromPointer(event, index);
        };
        return (
          <g
            data-dominant-landmark={isDominant ? "true" : undefined}
            data-rig-landmark={index}
            data-selected-landmark={isSelected ? "true" : undefined}
            key={index}
          >
            {isDominant && !isSelected ? (
              <rect
                fill="rgba(245,133,48,0.14)"
                height={6}
                pointerEvents="none"
                rx={1.5}
                stroke="#facc15"
                strokeDasharray="2 1"
                strokeWidth={0.8}
                transform={`rotate(45 ${position.cx} ${position.cy})`}
                width={6}
                x={position.cx - 3}
                y={position.cy - 3}
              />
            ) : null}
            {isSelected ? (
              <circle
                cx={position.cx}
                cy={position.cy}
                fill="none"
                pointerEvents="none"
                r={4.2}
                stroke="#ffffff"
                strokeWidth={1.1}
              />
            ) : null}
            <circle
              aria-label={nodeLabel}
              cx={position.cx}
              cy={position.cy}
              fill={isSelected ? colors.primary : "#f58530"}
              aria-disabled={isFingertip ? "true" : undefined}
              onPointerDown={isFingertip ? undefined : handlePointerDown}
              opacity={isSecondary && !isSelected ? 0.48 : 1}
              r={
                isSelected
                  ? 2.8
                  : isDominant
                    ? 2.4
                    : isSecondary
                      ? 1.05
                      : 1.75
              }
              stroke={isDominant ? "#111" : "rgba(17,17,17,0.72)"}
              strokeWidth={isDominant ? 1.1 : 0.65}
              style={{
                cursor:
                  isFingertip
                    ? "not-allowed"
                    : !readOnly && editableView && !previewMotion
                    ? dragPoint === index
                      ? "grabbing"
                      : "grab"
                    : "pointer",
              }}
              >
                <title>{nodeTitle}</title>
              </circle>
            {!isFingertip ? (
              <circle
                aria-hidden="true"
                cx={position.cx}
                cy={position.cy}
                fill="transparent"
                onPointerDown={handlePointerDown}
                data-effective-hit-target="44px-min"
                r={9.5}
                style={{
                  cursor:
                    !readOnly && editableView && !previewMotion
                      ? "grab"
                      : "pointer",
                }}
              />
            ) : null}
          </g>
        );
      })}
    </svg>
  );

  return (
    <>
      <section
        className="exercise-lab-movement-editor"
        aria-readonly={readOnly || undefined}
        data-movement-editor-readonly={readOnly ? "true" : "false"}
        data-testid="exercise-lab-movement-editor"
        ref={editorRootRef}
        style={{ display: "grid", gap: 12 }}
      >
        <div
          style={{
            alignItems: "flex-end",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <div>
            <p
              style={{
                color: colors.textMuted,
                fontSize: 13,
                lineHeight: 1.45,
                margin: 0,
                maxWidth: 760,
              }}
            >
              Set the movement the camera should look for. Use the drawing to
              adjust the joints.
            </p>
          </div>
          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10 }}>
            {onOpenHandSetup ? (
              <FitButton
                aria-label="Open Hand Setup"
                data-testid="exercise-lab-open-hand-setup"
                label="Hand Setup →"
                onClick={onOpenHandSetup}
                style={{ minHeight: 36, padding: "0 14px" }}
                variant="ghost"
              />
            ) : null}
          </div>
        </div>

        {isCanonical && !readOnly ? (
          <div
            aria-label="Movement contract notice"
            role="status"
            style={{
              background: `${colors.primary}12`,
              border: `1px solid ${colors.primary}66`,
              borderRadius: 8,
              color: colors.primary,
              fontSize: 11,
              lineHeight: 1.4,
              padding: "8px 10px",
            }}
          >
            Other exercises use these movement settings too. Before saving,
            you will be asked to confirm changes that affect them.
          </div>
        ) : null}

        {movementValidationIssues.length ? (
          <div
            aria-label="Movement validation summary"
            data-testid="exercise-lab-movement-validation-summary"
            role="alert"
            style={{
              background: `${VALIDATION_DANGER_COLOR}12`,
              border: `1px solid ${VALIDATION_DANGER_COLOR}66`,
              borderRadius: 8,
              color: VALIDATION_DANGER_COLOR,
              display: "grid",
              gap: 3,
              fontSize: 11.5,
              lineHeight: 1.4,
              padding: "9px 11px",
            }}
          >
            <strong>
              {movementValidationIssues.length} movement validation {movementValidationIssues.length === 1 ? "issue" : "issues"}
            </strong>
            <span>Use the red stage marker to open the affected fields and apply the suggested fix.</span>
          </div>
        ) : null}

        {readOnly ? (
          <div
            aria-label="Inherited movement contract"
            data-testid="exercise-lab-movement-readonly-notice"
            role="status"
            style={{
              alignItems: "center",
              background: `${colors.primary}0d`,
              border: `1px solid ${colors.primary}40`,
              borderRadius: 10,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              justifyContent: "space-between",
              padding: "10px 12px",
            }}
          >
            <span
              style={{ color: colors.textMuted, fontSize: 12, lineHeight: 1.4 }}
            >
              This exercise uses shared movement settings. Make a separate copy
              to change its movement or counting rules without changing other exercises.
            </span>
            {onRequestEdit ? (
              <FitButton
                data-testid="exercise-lab-create-override"
                label="Use separate settings"
                onClick={onRequestEdit}
                style={{ minHeight: 36, padding: "0 14px" }}
                variant="ghost"
              />
            ) : null}
          </div>
        ) : null}

        <div
          aria-label="Tracking setup progress"
          data-testid="exercise-lab-movement-stage-rail"
          className="exercise-lab-movement-stage-tabs"
          style={{
            alignItems: "center",
            display: "flex",
            gap: 6,
            maxWidth: "100%",
            overflowX: "auto",
            overflowY: "hidden",
          }}
        >
          {TRACKING_SETUP_STEPS.map((step, index) => {
            const stageIssues = movementValidationIssues.filter((issue) =>
              getMovementIssueStages(issue).includes(index),
            );
            const complete =
              index === 0
                ? Boolean(contract)
                : index === 1
                  ? Boolean(rig)
                  : index === 2
                    ? keyframes.length >= 2
                    : index === 3
                      ? Boolean(contract)
                      : index === 4
                        ? Boolean(contract?.spatialRequirements)
                        : Boolean(rig && contract);
            const active = index === activeSetupStep;
            return (
              <button
                aria-label={`${index + 1}. ${step.label}${stageIssues.length ? `, ${stageIssues.length} validation ${stageIssues.length === 1 ? "issue" : "issues"}` : ""}`}
                aria-invalid={stageIssues.length ? true : undefined}
                data-stage-index={index}
                data-stage-state={stageIssues.length ? "error" : active ? "active" : complete ? "complete" : "pending"}
                data-stage-validation={stageIssues.length ? "error" : "clear"}
                key={step.label}
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => {
                  setActiveSetupStep(index);
                  if (index === 5 && rig) setPreviewMotion(true);
                }}
                style={{
                  alignItems: "center",
                  backgroundColor: active
                    ? colors.primary
                    : colors.background,
                  border: stageIssues.length
                    ? `1px solid ${VALIDATION_DANGER_COLOR}`
                    : 0,
                  borderRadius: 999,
                  boxShadow: "none",
                  color: active ? "#090909" : colors.textMuted,
                  cursor: "pointer",
                  display: "flex",
                  flex: "0 0 auto",
                  justifyContent: "center",
                  minHeight: 26,
                  padding: "5px 10px",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}
              >
                {stageIssues.length ? (
                  <span
                    aria-hidden="true"
                    style={{
                      color: active ? "#090909" : VALIDATION_DANGER_COLOR,
                      fontSize: 11,
                      fontWeight: 900,
                      marginRight: 4,
                    }}
                  >
                    !
                  </span>
                ) : null}
                <span style={{ fontSize: 11, fontWeight: 600 }}>
                  {[
                    "1. Movement type",
                    "2. Template",
                    "3. Movement positions",
                    "4. Counting rules",
                    "5. Form checks",
                    "6. Preview",
                  ][index]}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className="exercise-lab-movement-workspace"
          data-testid="exercise-lab-movement-workspace"
        >
          <section
            aria-label="Movement rig"
            className="exercise-lab-movement-rig-card"
            data-stage-panel="persistent-rig"
            data-testid="exercise-lab-movement-rig-stage"
            style={{
              ...panelStyle(colors),
              background: colors.background,
              borderRadius: 10,
              gap: 10,
              maxWidth: "100%",
              padding: 12,
              position: "relative",
            }}
          >
            <header
              className="exercise-lab-movement-rig-card-header"
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                justifyContent: "space-between",
              }}
            >
              <div>
                <span
                  style={{
                    color: colors.textMuted,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {RIG_VIEW_OPTIONS.find(
                    (option) => option.value === viewTransform,
                  )?.label ?? "Reference"}
                </span>
              </div>
              <div
                aria-label="Primary rig views"
                className="exercise-lab-movement-rig-view-buttons"
                style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}
              >
                {(["front", "mirror", "side"] as const).map(
                  renderRigViewButton,
                )}
              </div>
            </header>
            <div
              aria-label="Additional rig views"
              className="exercise-lab-movement-rig-secondary-views"
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
              }}
            >
              {(["floor", "rotate90"] as const).map(renderRigViewButton)}
              {!hasUsableRig ? (
                <span
                  data-starter-preview="true"
                  style={{
                    color: colors.textMuted,
                    fontSize: 10,
                    marginLeft: "auto",
                  }}
                >
                  Starter preview
                </span>
              ) : null}
            </div>

            {rig && keyframes.length ? (
              productionRigSvg
            ) : (
              <div
                className="exercise-lab-movement-rig-empty"
                style={{
                  alignItems: "center",
                  border: `1px dashed ${colors.borderStrong}`,
                  borderRadius: 10,
                  color: colors.textMuted,
                  display: "flex",
                  fontSize: 12,
                  lineHeight: 1.45,
                  minHeight: 360,
                  padding: 14,
                  textAlign: "center",
                }}
              >
                No drawing yet. Choose a template in the Template tab to create
                the movement positions.
              </div>
            )}

            {rigValidationIssues.length || dragValidationNotice ? (
              <div
                aria-label="Rig validation"
                data-testid="exercise-lab-rig-validation"
                role={dragValidationNotice ? "status" : "alert"}
                style={{
                  background: `${VALIDATION_DANGER_COLOR}12`,
                  border: `1px solid ${VALIDATION_DANGER_COLOR}66`,
                  borderRadius: 8,
                  color: VALIDATION_DANGER_COLOR,
                  display: "grid",
                  gap: 5,
                  fontSize: 11,
                  lineHeight: 1.4,
                  padding: "8px 10px",
                  position: "absolute",
                  left: 12,
                  right: 12,
                  bottom: 32,
                  zIndex: 2,
                }}
              >
                {dragValidationNotice ? <span>{dragValidationNotice}</span> : null}
                {rigValidationIssues.map((issue, index) => (
                  <span key={`${issue.code}-${index}`}>
                    <strong>{issue.message}</strong> {issue.suggestion}
                  </span>
                ))}
                {rigValidationIssues.length ? (
                  thresholdValidationActive || !thresholdTargetsAreUsable ? (
                    <span>
                      Fix the angles and allowed differences first. Reset uses your current settings.
                    </span>
                  ) : (
                    <button
                      data-exercise-field="movementProfile.rig.keyframes"
                      onClick={() => createGeneratedProfile()}
                      style={{
                        background: "transparent",
                        border: `1px solid ${VALIDATION_DANGER_COLOR}`,
                        borderRadius: 7,
                        color: VALIDATION_DANGER_COLOR,
                        cursor: readOnly ? "not-allowed" : "pointer",
                        font: "inherit",
                        fontWeight: 800,
                        justifySelf: "start",
                        minHeight: 32,
                        opacity: readOnly || !currentTargetsAreValid ? 0.55 : 1,
                        padding: "6px 9px",
                      }}
                      type="button"
                      disabled={readOnly || !currentTargetsAreValid}
                    >
                      Reset drawing to these angles
                    </button>
                  )
                ) : null}
              </div>
            ) : null}

            <footer
              className="exercise-lab-movement-rig-card-footer"
              style={{
                alignItems: "center",
                borderTop: `1px solid ${colors.border}`,
                color: colors.textMuted,
                display: "flex",
                fontSize: 10,
                justifyContent: "center",
                lineHeight: 1.3,
                minHeight: 20,
                paddingTop: 8,
                textAlign: "center",
              }}
            >
              <span>
                Showing: {activeFrame
                  ? getFrameLabel(activeFrame.kind, movementMode, activeFrame.label)
                  : "—"}
              </span>
            </footer>
          </section>

          <section
            aria-label="Active movement stage editor"
            className="exercise-lab-movement-active-stage-editor"
            data-testid="exercise-lab-movement-active-stage-editor"
          >
       {activeSetupStep === 0 ? (
         <div
           className="exercise-lab-movement-active-panel exercise-lab-movement-stage-panel"
           data-stage-panel="type"
            style={{ display: "grid", gap: 8 }}
         >
            <div
              className="exercise-lab-movement-type-options"
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              }}
           >
             {MOVEMENT_MODE_OPTIONS.map((option) => (
               <button
                 aria-pressed={movementMode === option.value}
                 disabled={readOnly}
                 key={option.value}
                 onClick={() => setMovementMode(option.value)}
                 style={{
                    background:
                      movementMode === option.value
                        ? colors.primary + "10"
                        : colors.background,
                    border: `1px solid ${movementMode === option.value ? colors.primary : colors.border}`,
                    borderRadius: 10,
                    boxShadow: "none",
                    color: colors.text,
                   cursor: readOnly ? "not-allowed" : "pointer",
                    display: "grid",
                    gap: 4,
                   opacity: readOnly ? 0.72 : 1,
                    padding: 12,
                   textAlign: "left",
                 }}
                 type="button"
               >
                  <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
                   {option.label}
                 </span>
                 <span
                   style={{
                      color: colors.textMuted,
                     display: "block",
                      fontSize: 11,
                      fontWeight: 400,
                      lineHeight: 1.35,
                   }}
                 >
                   {option.description}
                 </span>
               </button>
             ))}
           </div>
         </div>
       ) : null}

        {activeSetupStep === 4 && contract ? (
          <div
            className="exercise-lab-movement-active-panel exercise-lab-movement-stage-panel"
            data-stage-panel="safeguards"
            style={{ display: "grid", gap: 12 }}
          >
            <FieldShell colors={colors} label="Body position">
              <FitSelect
                compact
                disabled={readOnly}
                fullWidth
                name="exercise-body-orientation"
                onChange={(event) => patchMovementContract(setExerciseBodyOrientation(
                  contract, event.target.value as PoseMovementContractRecord["bodyOrientation"],
                ))}
                options={[
                  { label: "Any position", value: "any" },
                  { label: "Upright", value: "upright" },
                  { label: "Lying down", value: "horizontal" },
                  { label: "Leaning", value: "inclined" },
                  { label: "On the floor", value: "floor" },
                ]}
                value={contract.bodyOrientation}
              />
            </FieldShell>
            <FieldShell colors={colors} label="Body parts to check">
              <FitSelect
                compact
                disabled={readOnly}
                fullWidth
                name="exercise-body-line-scope"
                onChange={(event) => {
                  const scope = event.target.value as ExerciseBodyCheckScope;
                  setSpatialPresetOverride(scope === "movement_joints" ? "none" : null);
                  patchMovementContract(setExerciseBodyCheckScope(contract, scope));
                }}
                options={[
                  { label: "Movement joints only", value: "movement_joints" },
                  { label: "Upper body — shoulders and hips", value: "torso" },
                  { label: "Full body — shoulders, hips and ankles", value: "full_body" },
                ]}
                value={getExerciseBodyCheckScope(contract)}
              />
              <p style={{ color: colors.textMuted, fontSize: 11.5, margin: 0 }}>
                {getExerciseBodyCheckScope(contract) === "movement_joints"
                  ? getMovementJointOption(contract) === "upper_arm"
                    ? "Only both shoulders and the moving elbows need to be visible. Hips are not used."
                    : "Body position and extra body-movement checks are off. Curls need shoulders, elbows and wrists; squats still need hips, knees and ankles."
                  : "Upper body adds shoulders and hips; Full body also adds ankles. The joints needed for the exercise must still be visible."}
              </p>
            </FieldShell>
            <FieldShell colors={colors} label="Extra movement checks">
              <FitSelect
                compact
                disabled={readOnly}
                fullWidth
                name="exercise-spatial-preset"
                onChange={(event) =>
                  setSpatialPreset(event.target.value as SpatialRulePreset)
                }
                options={SPATIAL_RULE_PRESET_OPTIONS.map((option) => ({
                  label: option.label,
                  value: option.value,
                }))}
                value={spatialPreset}
              />
            </FieldShell>
            <p
              style={{
                color: colors.textMuted,
                fontSize: 11.5,
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              These checks help tell this exercise apart from another movement
              that bends the same joints.
            </p>
          </div>
        ) : null}

        {activeSetupStep === 1 ? (
          <div
            className="exercise-lab-movement-active-panel"
            data-stage-panel="template"
            style={{
              display: "grid",
              gap: 12,
            }}
          >
            <div
              className="exercise-lab-movement-template-chips"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {RIG_TEMPLATE_OPTIONS.map((template) => (
                <button
                  aria-pressed={selectedTemplate === template.value}
                  disabled={readOnly}
                  key={template.value}
                  onClick={() => setSelectedTemplate(template.value)}
                  style={{
                    background:
                      selectedTemplate === template.value
                        ? colors.primary + "10"
                        : colors.surface,
                    border: `1px solid ${selectedTemplate === template.value ? colors.primary : colors.border}`,
                   borderRadius: 8,
                    boxShadow: "none",
                    color:
                      selectedTemplate === template.value
                        ? colors.primary
                        : colors.textMuted,
                   cursor: readOnly ? "not-allowed" : "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                   minHeight: 36,
                   opacity: readOnly ? 0.72 : 1,
                    padding: "8px 12px",
                  }}
                  type="button"
                >
                  {template.label}
                </button>
              ))}
            </div>
            <div
              style={{
                alignItems: "center",
                display: "flex",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <button
                disabled={
                  readOnly ||
                  (!selectedTemplate && !generatedContract) ||
                  (!selectedTemplate && !currentTargetsAreValid)
                }
                onClick={() =>
                  createGeneratedProfile(selectedTemplate ?? undefined)
                }
                style={{
                  ...miniButtonStyle(colors),
                  borderRadius: 8,
                  boxShadow: "none",
                  cursor: readOnly ? "not-allowed" : "pointer",
                  fontSize: 11,
                  minHeight: 32,
                  opacity:
                    readOnly ||
                    (!selectedTemplate && !generatedContract) ||
                    (!selectedTemplate && !currentTargetsAreValid)
                      ? 0.45
                      : 1,
                  padding: "6px 10px",
                }}
                type="button"
              >
                {rig ? "Rebuild drawing" : "Create drawing"}
              </button>
              <span
                style={{
                  color: rig ? "#3ed875" : colors.textMuted,
                  fontSize: 11,
                  fontWeight: 400,
                }}
              >
                {rig
                  ? `${keyframes.length} movement positions ready`
                  : "Choose a template to create the movement drawing"}
              </span>
            </div>
          </div>
        ) : null}

        {activeSetupStep === 2 || activeSetupStep === 5 ? (
          <div
            className="exercise-lab-movement-active-panel exercise-lab-movement-stage-panel"
            data-stage-panel={activeSetupStep === 2 ? "angles" : "preview"}
            style={{ display: "grid", gap: 12 }}
          >
            <div style={{ display: "grid", gap: 8 }}>
              {activeSetupStep === 5 ? (
                <p
                  style={{
                    color: colors.textMuted,
                    fontSize: 12,
                    lineHeight: 1.4,
                    margin: 0,
                  }}
                >
                  Check the movement and angles before continuing.
                </p>
              ) : null}
              {activeSetupStep === 5 ? (
                <div
                  aria-label="Movement preview summary"
                  className="exercise-lab-movement-preview-summary"
                  data-testid="exercise-lab-movement-preview-summary"
                  style={{
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  }}
                >
                  {[
                    [
                      "Template",
                      selectedTemplate
                        ? TEMPLATE_EXERCISE_LABELS[selectedTemplate]
                        : contract?.exercise.replace(/_/g, " ") ?? "Custom movement",
                    ],
                    [
                      "Type",
                      movementMode === "static_hold"
                        ? "Timed hold"
                        : "Repetitions",
                    ],
                    [
                      "Goal / start angles",
                      contract?.repThresholds
                        ? contract.repThresholds.down.angle +
                          "° goal / " +
                          contract.repThresholds.up.angle +
                          "° start"
                        : keyframes.length + " positions",
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        background: colors.surface,
                        border: "1px solid " + colors.border,
                        borderRadius: 8,
                        display: "grid",
                        gap: 4,
                        minWidth: 0,
                        padding: "10px 12px",
                      }}
                    >
                      <span
                        style={{
                          color: colors.textMuted,
                          fontSize: 10,
                          fontWeight: 800,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        {label}
                      </span>
                      <strong
                        style={{
                          color: colors.text,
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {value}
                      </strong>
                    </div>
                  ))}
                </div>
              ) : null}
              {activeSetupStep === 2 ? (
                <div
                  aria-label="Keyframe phases"
                  style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                >
                  {keyframes.map((frame) => (
                    <button
                      key={frame.kind}
                      onClick={() => {
                        setPreviewMotion(false);
                        setActiveKind(frame.kind);
                      }}
                      style={{
                        ...miniButtonStyle(
                          colors,
                          activeKind === frame.kind && !previewMotion,
                        ),
                        background:
                          activeKind === frame.kind && !previewMotion
                            ? colors.primary + "10"
                            : colors.background,
                        border:
                          activeKind === frame.kind && !previewMotion
                            ? `1px solid ${colors.primary}`
                            : "1px solid transparent",
                        borderRadius: 6,
                        boxShadow: "none",
                        color:
                          activeKind === frame.kind && !previewMotion
                            ? colors.primary
                            : colors.textMuted,
                        flex: "1 1 120px",
                        fontSize: 11.5,
                        fontWeight: 600,
                        justifyContent: "center",
                        minHeight: 32,
                        padding: "6px 8px",
                      }}
                      type="button"
                    >
                      {frame.label || getFrameLabel(frame.kind, movementMode)}
                    </button>
                  ))}
                </div>
              ) : null}
              {activeSetupStep === 5 ? (
                <div
                  aria-label="Preview playback controls"
                  style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                >
                  <button
                    onClick={() => setPreviewMotion((current) => !current)}
                    style={{
                      ...miniButtonStyle(colors, previewMotion),
                      boxShadow: "none",
                      fontSize: 11,
                      minHeight: 32,
                      padding: "6px 10px",
                    }}
                    type="button"
                  >
                    {previewMotion ? "Stop preview" : "Preview motion"}
                  </button>
                  <button
                    disabled={
                      readOnly ||
                      (!generatedContract && !selectedTemplate) ||
                      !currentTargetsAreValid
                    }
                    onClick={() => createGeneratedProfile()}
                    style={{
                      ...miniButtonStyle(colors),
                      boxShadow: "none",
                      cursor: readOnly ? "not-allowed" : "pointer",
                      fontSize: 11,
                      minHeight: 32,
                      opacity:
                        readOnly ||
                        (!generatedContract && !selectedTemplate) ||
                        !currentTargetsAreValid
                          ? 0.45
                          : 1,
                      padding: "6px 10px",
                    }}
                    type="button"
                  >
                    Reset drawing to these angles
                  </button>
                </div>
              ) : null}
              {activeSetupStep === 2 ? (
                <p
                  style={{
                    color: colors.textMuted,
                    fontSize: 11.5,
                    lineHeight: 1.4,
                    margin: 0,
                  }}
                >
                  Choose a position, then set the starting and goal angles
                  the camera should look for. Measuring: {MOVEMENT_JOINT_LABELS[getMovementJointOption(contract)]}.
                </p>
              ) : null}
            </div>

            {activeSetupStep === 2 &&
            contract &&
            movementMode === "dynamic_rep" ? (
              <div
                aria-label="Mobile tracking target angles"
                className="exercise-lab-movement-rig-thresholds"
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                }}
              >
                <AngleTargetControl
                  colors={colors}
                  disabled={readOnly}
                  fieldPath="movementProfile.movementContract.repThresholds.down.angle"
                  issues={thresholdIssues.downAngle}
                  label="Goal angle"
                  onChange={(angle) => patchThreshold("down", { angle })}
                  value={contract.repThresholds.down.angle}
                />
                <AngleTargetControl
                  colors={colors}
                  disabled={readOnly}
                  fieldPath="movementProfile.movementContract.repThresholds.up.angle"
                  issues={thresholdIssues.upAngle}
                  label="Starting angle"
                  onChange={(angle) => patchThreshold("up", { angle })}
                  value={contract.repThresholds.up.angle}
                />
              </div>
            ) : null}
            {activeSetupStep === 2 ? (
              <details
                className="exercise-lab-movement-landmark-details"
                data-stage-panel="landmark-details"
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  overflow: "hidden",
                }}
              >
                <summary
                  style={{
                    color: colors.text,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    listStyle: "none",
                    padding: "10px 12px",
                  }}
                >
                  Joint details
                </summary>
                <div
                className="exercise-lab-movement-rig-fields"
                data-testid="exercise-lab-rig-preview-pane"
                style={{
                  borderTop: `1px solid ${colors.border}`,
                  display: "grid",
                  gap: 12,
                  padding: 12,
                }}
                >
                {movementMode === "dynamic_rep" && activeFrame ? (
                  <p
                    aria-live="polite"
                    data-mobile-frame-threshold={
                      activeFrame.kind === "peak" ? "down" : "up"
                    }
                    role="status"
                    style={{
                      color: colors.textMuted,
                      fontSize: 11.5,
                      fontWeight: 400,
                      lineHeight: 1.4,
                      margin: 0,
                    }}
                  >
                    {activeFrame.kind === "peak" ? "Goal" : "Starting"}{" "}
                    angle:{" "}
                    {activeFrame.kind === "peak"
                      ? contract?.repThresholds.down.angle
                      : contract?.repThresholds.up.angle}
                    °. Dragging the highlighted joints also changes this
                    angle for camera counting.
                  </p>
                ) : null}
              <p
                style={{
                  color: colors.textMuted,
                  fontSize: 11.5,
                  lineHeight: 1.4,
                  margin: 0,
                }}
              >
                {editableView && !previewMotion
                  ? "Drag the orange joints to adjust this position. You can edit in Front or Mirror view; rotated views are for viewing only."
                  : "Switch to Front or Mirror and stop the preview to move the joints."}
              </p>
              <div
                className="exercise-lab-movement-keyframe-fields"
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                }}
              >
              <FieldShell colors={colors} label="Position name">
                <input
                  disabled={readOnly}
                  name="exercise-keyframe-label"
                  onChange={(event) =>
                    patchActiveFrame({ label: event.target.value })
                  }
                  style={inputStyle(colors)}
                  value={activeFrame?.label ?? ""}
                />
              </FieldShell>
              <FieldShell colors={colors} label="Angle in the drawing">
                <input
                  aria-readonly="true"
                  name="exercise-keyframe-angle"
                  readOnly
                  style={inputStyle(colors)}
                  type="number"
                  value={activeFrame?.angle ?? ""}
                />
              </FieldShell>
              </div>
              {contract?.repModel === "bilateral" &&
              symmetryDelta !== null &&
              symmetryDelta > symmetryLimit ? (
                <div
                  style={{
                    background: "rgba(245, 158, 11, 0.12)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    borderRadius: 10,
                    color: "#facc15",
                    fontSize: 12,
                    fontWeight: 800,
                    padding: 12,
                  }}
                >
                  The left and right sides differ by{" "}
                  {symmetryDelta}°; the allowed difference is {symmetryLimit}°.
                </div>
              ) : null}
              <FieldShell colors={colors} label="Joint to edit">
                <FitSelect
                  compact
                  fullWidth
                  name="exercise-selected-landmark"
                  onChange={(event) =>
                    !BODY_HIDDEN_LANDMARK_INDEXES.has(
                      Number(event.target.value),
                    ) &&
                    setSelectedPoint(Number(event.target.value))
                  }
                  options={(activeFrame?.keypoints ?? [])
                    .map((_, index) => index)
                    .filter((index) => !BODY_HIDDEN_LANDMARK_INDEXES.has(index))
                    .map((index) => ({
                      label: LANDMARK_LABELS[index] ?? "body point",
                      value: String(index),
                    }))}
                  value={selectedEditablePoint}
                />
              </FieldShell>
              <div
                className="exercise-lab-movement-form-grid"
                style={{
                  display: "grid",
                  gap: 10,
                  gridTemplateColumns: "1fr 1fr",
                }}
              >
                <FieldShell colors={colors} label="Left / right position">
                  <input
                    disabled={readOnly || selectedPointLocked}
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
                    value={activeFrame?.keypoints[selectedEditablePoint]?.x ?? ""}
                  />
                </FieldShell>
                <FieldShell colors={colors} label="Up / down position">
                  <input
                    disabled={readOnly || selectedPointLocked}
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
                    value={activeFrame?.keypoints[selectedEditablePoint]?.y ?? ""}
                  />
                </FieldShell>
              </div>
              <div
                aria-label="Landmark preview controls"
                style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
              >
                <button
                  onClick={() => setPreviewMotion((current) => !current)}
                  style={{
                    ...miniButtonStyle(colors, previewMotion),
                    boxShadow: "none",
                    fontSize: 11,
                    minHeight: 32,
                    padding: "6px 10px",
                  }}
                  type="button"
                >
                  {previewMotion ? "Stop preview" : "Preview motion"}
                </button>
                <button
                  disabled={
                    readOnly ||
                    (!generatedContract && !selectedTemplate) ||
                    !currentTargetsAreValid
                  }
                  onClick={() => createGeneratedProfile()}
                  style={{
                    ...miniButtonStyle(colors),
                    boxShadow: "none",
                    cursor: readOnly ? "not-allowed" : "pointer",
                    fontSize: 11,
                    minHeight: 32,
                    opacity:
                      readOnly ||
                      (!generatedContract && !selectedTemplate) ||
                      !currentTargetsAreValid
                        ? 0.45
                        : 1,
                    padding: "6px 10px",
                  }}
                  type="button"
                >
                  Reset drawing to these angles
                </button>
              </div>
            </div>
              </details>
            ) : null}
          </div>
        ) : null}

        {activeSetupStep === 3 && contract ? (
          <div
            className="exercise-lab-movement-active-panel exercise-lab-movement-stage-panel"
            data-stage-panel="counting"
            style={{ display: "grid", gap: 12 }}
          >
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
                <p
                  style={{
                    color: colors.textMuted,
                    fontSize: 11.5,
                    lineHeight: 1.4,
                    margin: 0,
                  }}
                >
                  Set the movement range, allowed differences, sides to check, and
                  when each rep counts.
                </p>
              </div>
              <button
                disabled={
                  readOnly ||
                  (!generatedContract && !selectedTemplate) ||
                  (!selectedTemplate && !currentTargetsAreValid)
                }
                onClick={() =>
                  createGeneratedProfile(selectedTemplate ?? undefined)
                }
                style={{
                  ...miniButtonStyle(colors),
                  cursor: readOnly ? "not-allowed" : "pointer",
                  opacity:
                    readOnly ||
                    (!generatedContract && !selectedTemplate) ||
                    (!selectedTemplate && !currentTargetsAreValid)
                      ? 0.45
                      : 1,
                }}
                type="button"
              >
                Rebuild drawing
              </button>
            </div>

            <FieldShell colors={colors} label="Joint to measure">
              <FitSelect
                compact
                disabled={readOnly}
                fullWidth
                name="exercise-measured-joint"
                onChange={(event) => {
                  if (!profile) return;
                  const upperArm = event.target.value === "upper_arm";
                  patchProfile(setExerciseMovementJoint(profile,
                    upperArm ? "shoulder" : event.target.value as PoseMovementContractRecord["dominantJoint"],
                    upperArm ? "shoulder_line" : undefined));
                }}
                options={Object.entries(MOVEMENT_JOINT_LABELS).map(([value, label]) => ({ value, label }))}
                value={getMovementJointOption(contract)}
              />
            </FieldShell>
            <div
              className="exercise-lab-movement-form-grid"
              style={{
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              }}
            >
              {movementMode === "dynamic_rep" ? (
                <>
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.repThresholds.down.angle"
                    issues={thresholdIssues.downAngle}
                    label="Goal angle"
                    max={180}
                    min={0}
                    onChange={(angle) => patchThreshold("down", { angle })}
                    value={contract.repThresholds.down.angle}
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.repThresholds.down.tolerance"
                    issues={thresholdIssues.downTolerance}
                    label="Allowed difference from goal (°)"
                    max={45}
                    min={0}
                    onChange={(tolerance) =>
                      patchThreshold("down", { tolerance })
                    }
                    value={contract.repThresholds.down.tolerance}
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.repThresholds.up.angle"
                    issues={thresholdIssues.upAngle}
                    label="Starting angle"
                    max={180}
                    min={0}
                    onChange={(angle) => patchThreshold("up", { angle })}
                    value={contract.repThresholds.up.angle}
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.repThresholds.up.tolerance"
                    issues={thresholdIssues.upTolerance}
                    label="Allowed difference from start (°)"
                    max={45}
                    min={0}
                    onChange={(tolerance) =>
                      patchThreshold("up", { tolerance })
                    }
                    value={contract.repThresholds.up.tolerance}
                  />
                </>
              ) : (
                <>
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.bodyLineTolerance"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.bodyLineTolerance")}
                    label="Allowed body tilt (°)"
                    max={90}
                    min={0}
                    onChange={(bodyLineTolerance) =>
                      patchSpatialRequirement({ bodyLineTolerance })
                    }
                    value={
                      contract.spatialRequirements?.bodyLineTolerance ?? 28
                    }
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.bodyXDriftMax"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.bodyXDriftMax")}
                    label="Allowed sideways sway"
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
                <FieldShell colors={colors} label="How the sides move">
                  <div
                    aria-describedby={
                      getIssuesForPath(
                        movementValidationIssues,
                        "movementProfile.movementContract.repModel",
                      ).length
                        ? "exercise-validation-movementProfile-movementContract-repModel"
                        : undefined
                    }
                    aria-invalid={
                      getIssuesForPath(
                        movementValidationIssues,
                        "movementProfile.movementContract.repModel",
                      ).length
                        ? true
                        : undefined
                    }
                    data-exercise-field="movementProfile.movementContract.repModel"
                    tabIndex={-1}
                  >
                    <FitSelect
                      compact
                      disabled={readOnly}
                      fullWidth
                      name="exercise-side-model"
                      onChange={(event) =>
                        setRepModel(
                          event.target
                            .value as (typeof DYNAMIC_REP_MODEL_OPTIONS)[number],
                        )
                      }
                      options={DYNAMIC_REP_MODEL_OPTIONS.map((option) => ({
                        label: {
                          bilateral: "Both sides together",
                          unilateral_left: "Left side only",
                          unilateral_right: "Right side only",
                          alternating: "Switch sides each rep",
                        }[option],
                        value: option,
                      }))}
                      value={
                        DYNAMIC_REP_MODEL_OPTIONS.includes(
                          contract.repModel as (typeof DYNAMIC_REP_MODEL_OPTIONS)[number],
                        )
                          ? contract.repModel
                          : "bilateral"
                      }
                    />
                  </div>
                  {renderValidationHint({
                    fieldPath: "movementProfile.movementContract.repModel",
                    issues: getIssuesForPath(
                      movementValidationIssues,
                      "movementProfile.movementContract.repModel",
                    ),
                  })}
                </FieldShell>
              ) : null}
              <FieldShell colors={colors} label="Sides to check">
                <div
                  aria-describedby={
                    getIssuesForPath(
                      movementValidationIssues,
                      "movementProfile.movementContract.requiredSides",
                    ).length
                      ? "exercise-validation-movementProfile-movementContract-requiredSides"
                      : undefined
                  }
                  aria-invalid={
                    getIssuesForPath(
                      movementValidationIssues,
                      "movementProfile.movementContract.requiredSides",
                    ).length
                      ? true
                      : undefined
                  }
                  data-exercise-field="movementProfile.movementContract.requiredSides"
                  tabIndex={-1}
                >
                  <FitSelect
                    compact
                    disabled={readOnly}
                    fullWidth
                    name="exercise-required-sides"
                    onChange={(event) =>
                      patchMovementContract({
                        requiredSides: event.target
                          .value as (typeof REQUIRED_SIDE_OPTIONS)[number],
                      })
                    }
                    options={(movementMode === "static_hold"
                      ? STATIC_REQUIRED_SIDE_OPTIONS
                      : REQUIRED_SIDE_OPTIONS
                    ).map((option) => ({
                      label: {
                        both: "Both sides",
                        left: "Left side",
                        right: "Right side",
                        either: "Either side",
                        alternating: "Take turns",
                      }[option],
                      value: option,
                    }))}
                    value={contract.requiredSides ?? "either"}
                  />
                </div>
                {renderValidationHint({
                  fieldPath: "movementProfile.movementContract.requiredSides",
                  issues: getIssuesForPath(
                    movementValidationIssues,
                    "movementProfile.movementContract.requiredSides",
                  ),
                })}
              </FieldShell>
              {movementMode === "dynamic_rep" ? (
                <FieldShell colors={colors} label="When to add a rep">
                  <div
                    aria-describedby={
                      getIssuesForPath(
                        movementValidationIssues,
                        "movementProfile.movementContract.countAt",
                        ["movementProfile.movementContract.partialRepPolicy"],
                      ).length
                        ? "exercise-validation-movementProfile-movementContract-countAt"
                        : undefined
                    }
                    aria-invalid={
                      getIssuesForPath(
                        movementValidationIssues,
                        "movementProfile.movementContract.countAt",
                        ["movementProfile.movementContract.partialRepPolicy"],
                      ).length
                        ? true
                        : undefined
                    }
                    data-exercise-field="movementProfile.movementContract.countAt"
                    tabIndex={-1}
                  >
                    <FitSelect
                      compact
                      disabled={readOnly}
                      fullWidth
                      name="exercise-count-at"
                      onChange={(event) => {
                        const value = event.target.value;
                        patchMovementContract(value === "review_only"
                          ? { partialRepPolicy: "review_only" }
                          : {
                              countAt: value as "peak" | "return",
                              partialRepPolicy: "strict_full_rep",
                            });
                      }}
                      options={[
                        { label: "At the movement goal (Peak)", value: "peak" },
                        { label: "After returning to start", value: "return" },
                        { label: "Preview only - no counting", value: "review_only" },
                      ]}
                      value={contract.partialRepPolicy === "review_only"
                        ? "review_only"
                        : getPoseRepAcceptancePolicy(contract).countAt}
                    />
                  </div>
                  {renderValidationHint({
                    fieldPath:
                      "movementProfile.movementContract.countAt",
                    issues: getIssuesForPath(
                      movementValidationIssues,
                      "movementProfile.movementContract.countAt",
                      ["movementProfile.movementContract.partialRepPolicy"],
                    ),
                  })}
                </FieldShell>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeSetupStep === 4 && contract ? (
          <details
            data-stage-panel="safeguards-advanced"
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <summary
              style={{
                alignItems: "center",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                listStyle: "none",
                padding: "10px 12px",
              }}
            >
              <span
                style={{
                  color: colors.text,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Fine-tune form checks
              </span>
              <span
                style={{
                  border: `1px solid ${colors.border}`,
                  borderRadius: 6,
                  color: colors.textMuted,
                  fontSize: 11,
                  fontWeight: 800,
                  padding: "5px 8px",
                  textTransform: "uppercase",
                }}
              >
                Optional
              </span>
            </summary>
            <div
              style={{
                borderTop: `1px solid ${colors.border}`,
                display: "grid",
                gap: 12,
                padding: 12,
              }}
            >
              {spatialPreset === "none" ? (
                <p
                  style={{
                    color: colors.textMuted,
                    fontSize: 11.5,
                    lineHeight: 1.4,
                    margin: 0,
                  }}
                >
                  No extra body-movement checks are on. The selected body position
                  and joint angles still apply.
                </p>
              ) : (
                <div
                  className="exercise-lab-movement-form-grid"
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                  }}
                >
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.bodyLineTolerance"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.bodyLineTolerance")}
                    label="Allowed body tilt (°)"
                    max={90}
                    min={0}
                    onChange={(bodyLineTolerance) =>
                      patchSpatialRequirement({ bodyLineTolerance })
                    }
                    value={
                      contract.spatialRequirements?.bodyLineTolerance ?? 28
                    }
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.bodyYTravelMin"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.bodyYTravelMin")}
                    label="Minimum body movement"
                    max={0.4}
                    min={0}
                    onChange={(bodyYTravelMin) =>
                      patchSpatialRequirement({ bodyYTravelMin })
                    }
                    step={0.001}
                    value={
                      contract.spatialRequirements?.bodyYTravelMin ?? 0.012
                    }
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.shoulderYTravelMin"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.shoulderYTravelMin")}
                    label="Minimum shoulder movement"
                    max={0.4}
                    min={0}
                    onChange={(shoulderYTravelMin) =>
                      patchSpatialRequirement({ shoulderYTravelMin })
                    }
                    step={0.001}
                    value={
                      contract.spatialRequirements?.shoulderYTravelMin ?? 0.008
                    }
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.hipYTravelMin"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.hipYTravelMin")}
                    label="Minimum hip movement"
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
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.shoulderHipTravelMin"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.shoulderHipTravelMin")}
                    label="Minimum combined movement"
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
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.wristAnchorDriftMax"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.wristAnchorDriftMax")}
                    label="Allowed hand drift"
                    max={0.5}
                    min={0}
                    onChange={(wristAnchorDriftMax) =>
                      patchSpatialRequirement({ wristAnchorDriftMax })
                    }
                    step={0.001}
                    value={
                      contract.spatialRequirements?.wristAnchorDriftMax ?? 0.18
                    }
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.torsoSlopeMinDeg"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.torsoSlopeMinDeg")}
                    label="Lowest body angle (°)"
                    max={180}
                    min={0}
                    onChange={(torsoSlopeMinDeg) =>
                      patchSpatialRequirement({ torsoSlopeMinDeg })
                    }
                    value={getPoseTorsoSlopeRange(contract).min}
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.torsoSlopeMaxDeg"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.torsoSlopeMaxDeg")}
                    label="Highest body angle (°)"
                    max={180}
                    min={0}
                    onChange={(torsoSlopeMaxDeg) =>
                      patchSpatialRequirement({ torsoSlopeMaxDeg })
                    }
                    value={getPoseTorsoSlopeRange(contract).max}
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.leftRightSymmetryTolerance"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.leftRightSymmetryTolerance")}
                    label="Allowed side difference (°)"
                    max={90}
                    min={0}
                    onChange={(leftRightSymmetryTolerance) =>
                      patchSpatialRequirement({ leftRightSymmetryTolerance })
                    }
                    value={
                      contract.spatialRequirements
                        ?.leftRightSymmetryTolerance ?? 28
                    }
                  />
                  <ThresholdField
                    colors={colors}
                    disabled={readOnly}
                    fieldPath="movementProfile.movementContract.spatialRequirements.phaseSyncToleranceMs"
                    issues={getIssuesForPath(movementValidationIssues, "movementProfile.movementContract.spatialRequirements.phaseSyncToleranceMs")}
                    label="Time between sides (ms)"
                    max={1200}
                    min={0}
                    onChange={(phaseSyncToleranceMs) =>
                      patchSpatialRequirement({ phaseSyncToleranceMs })
                    }
                    value={
                      contract.spatialRequirements?.phaseSyncToleranceMs ?? 420
                    }
                  />
                </div>
              )}
            </div>
          </details>
        ) : null}
          </section>
        </div>
      </section>
      <style>{`
        .exercise-lab-movement-editor {
          min-width: 0;
          max-width: 100%;
          overflow-x: hidden;
        }

        .exercise-lab-movement-workspace {
          align-items: start;
          display: grid;
          gap: 16px;
          grid-template-columns: minmax(260px, 300px) minmax(0, 1fr);
          min-width: 0;
          max-width: 100%;
        }

        .exercise-lab-movement-rig-card,
        .exercise-lab-movement-active-stage-editor {
          box-sizing: border-box;
          min-width: 0;
        }

        .exercise-lab-movement-rig-card {
          align-self: start;
          overflow: hidden;
        }

        .exercise-lab-movement-rig-card-header {
          min-width: 0;
        }

        .exercise-lab-movement-rig-card svg {
          display: block;
          max-width: 100%;
          min-width: 0;
        }

        .exercise-lab-movement-rig-card-footer {
          overflow-wrap: anywhere;
        }

        .exercise-lab-movement-active-stage-editor {
          display: grid;
          gap: 12px;
        }

        .exercise-lab-movement-active-stage-editor > [data-stage-panel],
        .exercise-lab-movement-active-stage-editor > details[data-stage-panel] {
          min-width: 0;
          max-width: 100%;
        }

        .exercise-lab-movement-active-panel,
        .exercise-lab-movement-stage-panel {
          box-sizing: border-box;
          min-width: 0;
          max-width: 100%;
        }

        .exercise-lab-movement-rig-thresholds,
        .exercise-lab-movement-rig-fields {
          min-width: 0;
          max-width: 100%;
        }

        .exercise-lab-movement-stage-tabs {
          background: transparent;
          min-height: 26px;
          max-width: 100%;
          overscroll-behavior-x: contain;
        }

        .exercise-lab-movement-stage-tabs > button {
          font: inherit;
          min-height: 26px !important;
        }

        .exercise-lab-movement-stage-panel button,
        .exercise-lab-movement-stage-panel input,
        .exercise-lab-movement-stage-panel select {
          box-sizing: border-box;
        }

        .exercise-lab-movement-editor label > span {
          font-size: 11.5px !important;
          font-weight: 400 !important;
          letter-spacing: 0 !important;
          text-transform: none !important;
        }

        .exercise-lab-movement-editor input,
        .exercise-lab-movement-editor select {
          border: 1px solid ${colors.border} !important;
          border-radius: 8px !important;
          box-shadow: none !important;
          font-family: inherit !important;
          font-size: 13px !important;
          height: 36px !important;
          min-height: 36px !important;
          padding: 0 12px !important;
        }

        .exercise-lab-movement-editor .exercise-lab-movement-angle-value {
          background: transparent !important;
          border: 0 !important;
          height: 34px !important;
          min-height: 34px !important;
          padding: 0 !important;
        }

        .exercise-lab-movement-editor input:focus,
        .exercise-lab-movement-editor select:focus {
          border-color: ${colors.primary} !important;
          outline: none;
        }

        .exercise-lab-movement-editor .fit-dropdown-trigger {
          background: ${colors.background} !important;
          border: 1px solid ${colors.border} !important;
          border-radius: 8px !important;
          box-shadow: none !important;
          font-family: inherit !important;
          font-size: 13px !important;
          font-weight: 400 !important;
          height: 36px !important;
          min-height: 36px !important;
          padding: 0 12px !important;
        }

        .exercise-lab-movement-editor .fit-dropdown-trigger::before {
          display: none !important;
        }

        .exercise-lab-movement-editor .fit-dropdown-label {
          font-size: 13px !important;
          font-weight: 400 !important;
        }

        .exercise-lab-movement-active-stage-editor button {
          box-shadow: none !important;
          font-weight: 600 !important;
        }

        .exercise-lab-movement-editor [disabled] {
          cursor: not-allowed !important;
        }

        @media (max-width: 920px) {
          .exercise-lab-movement-workspace {
            grid-template-columns: minmax(0, 1fr);
          }

          .exercise-lab-movement-rig-card {
            max-width: 300px;
            width: 100%;
          }

          .exercise-lab-movement-active-stage-editor {
            width: 100%;
          }

          .exercise-lab-movement-stage-tabs {
            display: flex !important;
            flex-wrap: nowrap;
            grid-template-columns: none !important;
            max-width: 100%;
            overflow-x: auto !important;
            overflow-y: hidden;
            overscroll-behavior-x: contain;
            scrollbar-width: thin;
            width: 100%;
          }

          .exercise-lab-movement-stage-tabs > button {
            box-sizing: border-box;
            flex: 0 0 auto;
            min-width: max-content;
          }

          .exercise-lab-movement-preview-summary {
            grid-template-columns: repeat(3, minmax(128px, 1fr)) !important;
            overflow-x: auto;
          }
        }

        @media (max-width: 520px) {
          .exercise-lab-movement-form-grid,
          .exercise-lab-movement-keyframe-fields,
          .exercise-lab-movement-rig-thresholds,
          .exercise-lab-movement-type-options {
            grid-template-columns: minmax(0, 1fr) !important;
          }

          .exercise-lab-movement-rig-card {
            max-width: 320px;
          }

          .exercise-lab-movement-preview-summary {
            grid-template-columns: minmax(0, 1fr) !important;
          }
        }
      `}</style>
      <ConfirmModal
        isOpen={regenerateConfirmTemplate !== null}
        title="Reset movement drawing"
        message="Rebuild the drawing using your current angles? Any joints you moved by hand will be replaced."
        confirmLabel="RESET RIG"
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
  frame:
    | NonNullable<ExerciseMovementProfileRecord["rig"]>["keyframes"][number]
    | null,
  defaultIndex: number,
) {
  const [selectedPoint, setSelectedPoint] = useState(defaultIndex);
  useEffect(() => setSelectedPoint(defaultIndex), [defaultIndex]);
  return [
    clamp(selectedPoint, 0, Math.max(0, (frame?.keypoints.length ?? 1) - 1)),
    setSelectedPoint,
  ] as const;
}

export function ThresholdField({
  colors,
  disabled = false,
  error,
  fieldPath,
  hint,
  issues,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  colors: EditorColors;
  disabled?: boolean;
  error?: string;
  fieldPath?: string;
  hint?: string;
  issues?: ExerciseEditorValidationIssue[];
  label: string;
  max: number;
  min: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  const resolvedFieldPath =
    fieldPath ??
    `movementProfile.movementContract.repThresholds.${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")}`;
  const resolvedIssues =
    issues ??
    (error
      ? [
          {
            code: "field_invalid",
            message: error,
            path: resolvedFieldPath,
            suggestion: hint ?? "Review this value before saving.",
          },
        ]
      : []);
  const validationId = `exercise-validation-${issuePathKey(resolvedFieldPath)}`;
  return (
    <FieldShell colors={colors} label={label}>
      <input
        aria-describedby={resolvedIssues.length ? validationId : undefined}
        aria-invalid={resolvedIssues.length ? true : undefined}
        data-exercise-field={resolvedFieldPath}
        disabled={disabled}
        max={max}
        min={min}
        name={`exercise-threshold-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        onChange={(event) =>
          onChange(clamp(toNumber(event.target.value, value), min, max))
        }
        step={step ?? 1}
        style={{ ...inputStyle(colors), opacity: disabled ? 0.62 : 1 }}
        type="number"
        value={value}
      />
      {renderValidationHint({
        fieldPath: resolvedFieldPath,
        issues: resolvedIssues,
      })}
    </FieldShell>
  );
}

function AngleTargetControl({
  colors,
  disabled = false,
  fieldPath,
  issues,
  label,
  onChange,
  value,
}: {
  colors: EditorColors;
  disabled?: boolean;
  fieldPath: string;
  issues?: ExerciseEditorValidationIssue[];
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  const inputName =
    "exercise-angle-target-" +
    label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const update = (nextValue: string) =>
    onChange(Math.round(clamp(toNumber(nextValue, value), 0, 180)));
  const resolvedIssues = issues ?? [];
  const validationId = `exercise-validation-${issuePathKey(fieldPath)}`;

  return (
    <FieldShell colors={colors} label={label}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 6,
        }}
      >
        <button
          aria-label={label + " decrease"}
          disabled={disabled || value <= 0}
          onClick={() => update(String(value - 1))}
          style={{
            alignItems: "center",
            background: colors.surface,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 8,
            boxShadow: "none",
            color: colors.textMuted,
            display: "grid",
            fontSize: 16,
            height: 36,
            justifyContent: "center",
            opacity: disabled || value <= 0 ? 0.55 : 1,
            padding: 0,
            width: 36,
          }}
          type="button"
        >
          −
        </button>
        <div
          style={{
            alignItems: "center",
            background: colors.background,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 8,
            display: "flex",
            flex: 1,
            gap: 4,
            height: 36,
            justifyContent: "center",
            minWidth: 0,
            padding: "0 8px",
          }}
        >
          <input
            aria-describedby={resolvedIssues.length ? validationId : undefined}
            aria-label={label + " degrees"}
            aria-invalid={resolvedIssues.length ? true : undefined}
            className="exercise-lab-movement-angle-value"
            data-exercise-field={fieldPath}
            disabled={disabled}
            max={180}
            min={0}
            name={inputName + "-degrees"}
            onChange={(event) => update(event.target.value)}
            step={1}
            style={{
              background: "transparent",
              border: 0,
              boxShadow: "none",
              color: colors.text,
              font: "inherit",
              fontSize: 13,
              height: 34,
              minHeight: 34,
              outline: "none",
              opacity: disabled ? 0.62 : 1,
              padding: 0,
              textAlign: "center",
              width: "100%",
            }}
            type="number"
            value={value}
          />
          <span
            aria-hidden="true"
            style={{ color: colors.textMuted, fontSize: 11 }}
          >
            °
          </span>
        </div>
        <button
          aria-label={label + " increase"}
          disabled={disabled || value >= 180}
          onClick={() => update(String(value + 1))}
          style={{
            alignItems: "center",
            background: colors.surface,
            border: `1px solid ${colors.borderStrong}`,
            borderRadius: 8,
            boxShadow: "none",
            color: colors.textMuted,
            display: "grid",
            fontSize: 16,
            height: 36,
            justifyContent: "center",
            opacity: disabled || value >= 180 ? 0.55 : 1,
            padding: 0,
            width: 36,
          }}
          type="button"
        >
          +
        </button>
      </div>
      {renderValidationHint({
        fieldPath,
        issues: resolvedIssues,
      })}
    </FieldShell>
  );
}

export type { EditorColors, ExerciseEditorTab };
