"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { ExerciseHandPosePreset } from "@fittrack/types";
import type { ExerciseHandShapeProfileRecord } from "@fittrack/api-client";
import { normalizeExerciseHandShapeProfile } from "@fittrack/utils";

import {
  FieldShell,
  HAND_LANDMARK_LABELS,
  clamp,
  inputStyle,
  miniButtonStyle,
  panelStyle,
  roundToStep,
  toNumber,
  type EditorColors,
} from "./ExerciseContractEditorShared";
import { ThresholdField } from "./ExerciseContractEditors";

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

