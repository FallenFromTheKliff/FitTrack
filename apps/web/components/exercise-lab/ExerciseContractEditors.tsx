"use client";

import { CheckCircle2 } from "lucide-react";
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
  buildFallbackPoseMovementContract,
  createExerciseMovementProfile,
  createGeneratedExerciseRigFromMovementContract,
  getPoseMovementContractAngle,
  normalizeExerciseMovementProfile,
} from "@fittrack/utils";
import { FitSelect } from "@/components/fit";
import { ConfirmModal } from "@/components/modals";
import {
  DYNAMIC_REP_MODEL_OPTIONS,
  EDITOR_TABS,
  FieldLabel,
  FieldShell,
  LANDMARK_LABELS,
  MOVEMENT_MODE_OPTIONS,
  PARTIAL_REP_POLICY_OPTIONS,
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

const TRACKING_SETUP_STEPS = [
  { label: "Movement type", shortLabel: "Type" },
  { label: "Template", shortLabel: "Template" },
  { label: "Angles", shortLabel: "Angles" },
  { label: "Counting rules", shortLabel: "Counting" },
  { label: "Safeguards", shortLabel: "Safeguards" },
  { label: "Preview", shortLabel: "Preview" },
] as const;

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
  const editorRootRef = useRef<HTMLElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [activeKind, setActiveKind] = useSafeKeyframeKind(keyframes);
  const [dragPoint, setDragPoint] = useState<number | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const lastDragAtRef = useRef(0);
  const [previewMotion, setPreviewMotion] = useState(false);
  const [activeSetupStep, setActiveSetupStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] =
    useState<RigTemplateKey | null>(null);
  const [regenerateConfirmTemplate, setRegenerateConfirmTemplate] =
    useState<RigTemplateKey | "generated" | null>(null);
  const [spatialPresetOverride, setSpatialPresetOverride] =
    useState<SpatialRulePreset | null>(null);
  const [viewTransform, setViewTransform] = useState<RigViewTransform>("front");
  const viewDefaultKeyRef = useRef("");

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
    <section ref={editorRootRef} style={{ display: "grid", gap: 12 }}>
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
          <strong style={{ color: colors.text }}>Visual movement editor</strong>
          <p style={{ color: colors.textMuted, margin: "4px 0 0" }}>
            Configure one decision at a time. Completed stages stay visible in
            the setup map without crowding the active workspace.
          </p>
        </div>
        <span style={{ color: colors.textMuted, fontSize: 12, fontWeight: 800 }}>
          {activeSetupStep + 1} of {TRACKING_SETUP_STEPS.length}
        </span>
      </div>

      <div
        aria-label="Tracking setup progress"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          border: `1px solid ${colors.border}`,
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {TRACKING_SETUP_STEPS.map((step, index) => {
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
              key={step.label}
              type="button"
              aria-current={active ? "step" : undefined}
              onClick={() => {
                setActiveSetupStep(index);
                if (index === 5 && rig) setPreviewMotion(true);
              }}
              style={{
                alignItems: "center",
                backgroundColor: active ? `${colors.primary}16` : colors.surface,
                border: 0,
                borderBottom: active ? `2px solid ${colors.primary}` : "2px solid transparent",
                borderRight:
                  index < TRACKING_SETUP_STEPS.length - 1
                    ? `1px solid ${colors.border}`
                    : 0,
                color: active ? colors.text : colors.textMuted,
                cursor: "pointer",
                display: "flex",
                gap: 7,
                justifyContent: "center",
                minHeight: 44,
                padding: "8px 6px",
              }}
            >
              <span
                style={{
                  alignItems: "center",
                  backgroundColor: complete ? "#3ed875" : active ? colors.primary : colors.card,
                  border: `1px solid ${complete ? "#3ed875" : active ? colors.primary : colors.border}`,
                  borderRadius: 4,
                  color: complete || active ? "#111" : colors.textMuted,
                  display: "inline-flex",
                  fontSize: 9,
                  fontWeight: 900,
                  height: 18,
                  justifyContent: "center",
                  width: 18,
                }}
              >
                {complete ? <CheckCircle2 size={11} /> : index + 1}
              </span>
              <span style={{ fontSize: 11, fontWeight: 850 }}>{step.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {activeSetupStep === 0 ? <div style={panelStyle(colors)}>
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
      </div> : null}

      {activeSetupStep === 4 && contract ? (
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
                borderRadius: 6,
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

      {activeSetupStep === 1 ? (
        <div
          style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            display: "grid",
            gap: 12,
            padding: 16,
          }}
        >
          <div>
            <FieldLabel colors={colors}>2. Movement template</FieldLabel>
            <strong style={{ color: colors.text }}>
              Start from the closest movement pattern
            </strong>
            <p style={{ color: colors.textMuted, margin: "4px 0 0" }}>
              Templates create an editable starter rig. They never replace the
              exercise-specific angles and safeguards you review next.
            </p>
          </div>
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
                style={{
                  ...miniButtonStyle(colors, selectedTemplate === template.value),
                  borderRadius: 6,
                }}
                type="button"
              >
                {template.label}
              </button>
            ))}
          </div>
          <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              disabled={!selectedTemplate && !generatedContract}
              onClick={() => createGeneratedProfile(selectedTemplate ?? undefined)}
              style={{
                ...miniButtonStyle(colors, Boolean(selectedTemplate ?? generatedContract)),
                borderRadius: 6,
                opacity: selectedTemplate || generatedContract ? 1 : 0.45,
              }}
              type="button"
            >
              {rig ? "Regenerate starter rig" : "Generate starter rig"}
            </button>
            <span style={{ color: rig ? "#3ed875" : colors.textMuted, fontSize: 12, fontWeight: 800 }}>
              {rig
                ? `${keyframes.length} editable keyframes ready`
                : "Choose a template to unlock angle editing"}
            </span>
          </div>
        </div>
      ) : null}

      {activeSetupStep === 2 || activeSetupStep === 5 ? (!rig || !keyframes.length ? (
        <div
          style={{
            border: `1px dashed ${colors.borderStrong}`,
            borderRadius: 8,
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
                <FitSelect
                  compact
                  fullWidth
                  name="exercise-selected-landmark"
                  onChange={(event) => setSelectedPoint(Number(event.target.value))}
                  options={(activeFrame?.keypoints ?? []).map((_, index) => ({
                    label: `${index}: ${LANDMARK_LABELS[index] ?? "landmark"}`,
                    value: String(index),
                  }))}
                  value={selectedPoint}
                />
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
      )) : null}

      {activeSetupStep === 3 && contract ? (
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
                <FitSelect
                  compact
                  fullWidth
                  name="exercise-side-model"
                  onChange={(event) =>
                    setRepModel(event.target.value as (typeof DYNAMIC_REP_MODEL_OPTIONS)[number])
                  }
                  options={DYNAMIC_REP_MODEL_OPTIONS.map((option) => ({
                    label: option.replace(/_/g, " "),
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
              </FieldShell>
            ) : null}
            <FieldShell colors={colors} label="Required sides">
              <FitSelect
                compact
                fullWidth
                name="exercise-required-sides"
                onChange={(event) =>
                  patchMovementContract({
                    requiredSides: event.target.value as (typeof REQUIRED_SIDE_OPTIONS)[number],
                  })
                }
                options={(movementMode === "static_hold"
                  ? STATIC_REQUIRED_SIDE_OPTIONS
                  : REQUIRED_SIDE_OPTIONS
                ).map((option) => ({
                  label: option.replace(/_/g, " "),
                  value: option,
                }))}
                value={contract.requiredSides ?? "either"}
              />
            </FieldShell>
            {movementMode === "dynamic_rep" ? (
              <FieldShell colors={colors} label="Partial rep policy">
                <FitSelect
                  compact
                  fullWidth
                  name="exercise-partial-rep-policy"
                  onChange={(event) =>
                    patchMovementContract({
                      partialRepPolicy: event.target.value as (typeof PARTIAL_REP_POLICY_OPTIONS)[number],
                    })
                  }
                  options={PARTIAL_REP_POLICY_OPTIONS.map((option) => ({
                    label: option.replace(/_/g, " "),
                    value: option,
                  }))}
                  value={contract.partialRepPolicy ?? "count_half_reps"}
                />
              </FieldShell>
            ) : null}
          </div>

        </div>
      ) : null}

      {activeSetupStep === 4 && contract ? (
          <details
            style={{
              ...panelStyle(colors),
              borderRadius: 8,
              overflow: "hidden",
              padding: 0,
            }}
          >
            <summary
              style={{
                alignItems: "center",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                listStyle: "none",
                padding: "14px 16px",
              }}
            >
              <span>
                <strong style={{ color: colors.text }}>Advanced thresholds</strong>
                <span
                  style={{
                    color: colors.textMuted,
                    display: "block",
                    fontSize: 13,
                    marginTop: 3,
                  }}
                >
                  Fine-tune spatial checks only when the selected preset needs it.
                </span>
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
                padding: 16,
              }}
            >
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
          </details>
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

export function ThresholdField({
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

export type { EditorColors, ExerciseEditorTab };
