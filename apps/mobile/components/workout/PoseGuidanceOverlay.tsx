import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from "react-native-svg";

import type {
  PoseJointName,
  PoseKeypointRecord,
  PoseMovementContractRecord,
  ThemeColors,
} from "@fittrack/types";

type PoseGuidanceOverlayProps = {
  colors: ThemeColors;
  currentAngle: number | null;
  currentPhase: string;
  guidanceLabel?: string | null;
  keypoints: PoseKeypointRecord[] | null;
  lowConfidenceLandmarks: string[];
  movementContract: PoseMovementContractRecord | null;
};

const SKELETON_CONNECTIONS: Array<[number, number]> = [
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
  [27, 31],
  [28, 32],
];

const GUIDE_KEYPOINTS: PoseKeypointRecord[] = Array.from({ length: 33 }, () => ({
  visibility: 0,
  x: 0,
  y: 0,
  z: 0,
}));

[
  [0, 0.5, 0.16],
  [11, 0.42, 0.29],
  [12, 0.58, 0.29],
  [13, 0.35, 0.43],
  [14, 0.65, 0.43],
  [15, 0.31, 0.59],
  [16, 0.69, 0.59],
  [23, 0.45, 0.56],
  [24, 0.55, 0.56],
  [25, 0.43, 0.75],
  [26, 0.57, 0.75],
  [27, 0.42, 0.92],
  [28, 0.58, 0.92],
  [31, 0.39, 0.95],
  [32, 0.61, 0.95],
].forEach(([index, x, y]) => {
  GUIDE_KEYPOINTS[index] = { visibility: 0.72, x, y, z: 0 };
});

const JOINT_POINTS: Record<PoseJointName, [number, number, number, number, number, number]> = {
  elbow: [11, 13, 15, 12, 14, 16],
  hip: [11, 23, 25, 12, 24, 26],
  knee: [23, 25, 27, 24, 26, 28],
  shoulder: [13, 11, 23, 14, 12, 24],
};

function normalizeAngle(value: number) {
  let next = value;
  while (next < 0) next += 360;
  while (next > 360) next -= 360;
  return next;
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const startRadians = (Math.PI / 180) * startAngle;
  const endRadians = (Math.PI / 180) * endAngle;
  const start = {
    x: x + radius * Math.cos(startRadians),
    y: y + radius * Math.sin(startRadians),
  };
  const end = {
    x: x + radius * Math.cos(endRadians),
    y: y + radius * Math.sin(endRadians),
  };
  const largeArcFlag = Math.abs(endAngle - startAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

function getRepresentativeJointPoints(
  keypoints: PoseKeypointRecord[],
  joint: PoseJointName,
) {
  const [la, lb, lc, ra, rb, rc] = JOINT_POINTS[joint];
  const leftVisibility =
    (keypoints[la]?.visibility ?? 0) +
    (keypoints[lb]?.visibility ?? 0) +
    (keypoints[lc]?.visibility ?? 0);
  const rightVisibility =
    (keypoints[ra]?.visibility ?? 0) +
    (keypoints[rb]?.visibility ?? 0) +
    (keypoints[rc]?.visibility ?? 0);
  return leftVisibility >= rightVisibility
    ? {
        a: keypoints[la],
        b: keypoints[lb],
        c: keypoints[lc],
      }
    : {
        a: keypoints[ra],
        b: keypoints[rb],
        c: keypoints[rc],
      };
}

function buildAngleArc(
  keypoints: PoseKeypointRecord[],
  joint: PoseJointName,
) {
  const points = getRepresentativeJointPoints(keypoints, joint);
  if (!points.a || !points.b || !points.c) {
    return null;
  }

  const startAngle = normalizeAngle(
    (Math.atan2(points.a.y - points.b.y, points.a.x - points.b.x) * 180) / Math.PI,
  );
  const endAngle = normalizeAngle(
    (Math.atan2(points.c.y - points.b.y, points.c.x - points.b.x) * 180) / Math.PI,
  );
  return {
    center: points.b,
    path: describeArc(points.b.x, points.b.y, 0.05, startAngle, endAngle),
  };
}

export function PoseGuidanceOverlay({
  colors,
  currentAngle,
  currentPhase,
  guidanceLabel,
  keypoints,
  lowConfidenceLandmarks,
  movementContract,
}: PoseGuidanceOverlayProps) {
  const hasLiveKeypoints = keypoints?.length === 33;
  const drawableKeypoints = hasLiveKeypoints ? keypoints : GUIDE_KEYPOINTS;

  if (drawableKeypoints.length !== 33) {
    return null;
  }

  const angleArc =
    hasLiveKeypoints && movementContract
      ? buildAngleArc(drawableKeypoints, movementContract.dominantJoint)
      : null;
  const phaseText = !hasLiveKeypoints
    ? "GUIDE"
    : currentPhase === "down"
      ? "DOWN"
      : currentPhase === "up"
        ? "UP"
        : "READY";
  const guidanceText = !hasLiveKeypoints
    ? "Align full body in frame"
    : guidanceLabel
      ? guidanceLabel.replace(/_/g, " ")
      : movementContract
        ? `${movementContract.exercise.replace(/_/g, " ")}`
        : "Detecting movement";

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2,
        pointerEvents: "none",
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 1 1" preserveAspectRatio="none">
        {!hasLiveKeypoints ? (
          <>
            <Rect
              x={0.22}
              y={0.1}
              rx={0.035}
              width={0.56}
              height={0.82}
              stroke="rgba(255,255,255,0.36)"
              strokeWidth={0.006}
              strokeDasharray="0.025 0.018"
              fill="rgba(0,0,0,0)"
            />
            <Line
              x1={0.5}
              y1={0.1}
              x2={0.5}
              y2={0.92}
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={0.004}
              strokeDasharray="0.018 0.018"
              strokeLinecap="round"
            />
          </>
        ) : null}
        {SKELETON_CONNECTIONS.map(([start, end]) => {
          const from = drawableKeypoints[start];
          const to = drawableKeypoints[end];
          if (!from || !to || from.visibility < 0.3 || to.visibility < 0.3) {
            return null;
          }
          return (
            <Line
              key={`${start}-${end}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={hasLiveKeypoints ? "rgba(255,255,255,0.68)" : "rgba(255,255,255,0.42)"}
              strokeWidth={hasLiveKeypoints ? 0.006 : 0.005}
              strokeLinecap="round"
            />
          );
        })}
        {drawableKeypoints.map((point, index) =>
          point.visibility >= 0.2 ? (
            <Circle
              key={`joint-${index}`}
              cx={point.x}
              cy={point.y}
              r={point.visibility >= 0.5 ? 0.01 : 0.007}
              fill={
                hasLiveKeypoints
                  ? point.visibility >= 0.5
                    ? colors.brand
                    : "rgba(255,255,255,0.35)"
                  : "rgba(255,255,255,0.5)"
              }
            />
          ) : null,
        )}
        {movementContract
          ? getRepresentativeJointPoints(drawableKeypoints, movementContract.dominantJoint)
              ? [getRepresentativeJointPoints(drawableKeypoints, movementContract.dominantJoint)].map((points, index) => (
                  <Circle
                    key={`dominant-${index}`}
                    cx={points.b.x}
                    cy={points.b.y}
                    r={0.022}
                    stroke={colors.success}
                    strokeWidth={0.006}
                    fill="rgba(0,0,0,0.0)"
                  />
                ))
              : null
          : null}
        {angleArc ? (
          <Path
            d={angleArc.path}
            stroke={colors.success}
            strokeWidth={0.01}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        <Rect
          x={0.04}
          y={0.04}
          rx={0.02}
          width={0.42}
          height={0.11}
          fill="rgba(0,0,0,0.58)"
        />
        <SvgText
          x={0.06}
          y={0.085}
          fill="#FFFFFF"
          fontSize={0.034}
          fontWeight="700"
        >
          {phaseText}
        </SvgText>
        <SvgText
          x={0.18}
          y={0.085}
          fill="rgba(255,255,255,0.88)"
          fontSize={0.026}
          fontWeight="600"
        >
          {guidanceText}
        </SvgText>
        {!hasLiveKeypoints ? (
          <>
            <Rect
              x={0.04}
              y={0.76}
              rx={0.018}
              width={0.62}
              height={0.1}
              fill="rgba(0,0,0,0.58)"
            />
            <SvgText
              x={0.06}
              y={0.805}
              fill="#FFFFFF"
              fontSize={0.022}
              fontWeight="700"
            >
              Snapshot tracking active
            </SvgText>
            <SvgText
              x={0.06}
              y={0.835}
              fill="rgba(255,255,255,0.76)"
              fontSize={0.018}
              fontWeight="600"
            >
              Guide overlay only until live landmarks are available
            </SvgText>
          </>
        ) : null}
        {movementContract && currentAngle !== null ? (
          <>
            <Rect
              x={0.56}
              y={0.04}
              rx={0.02}
              width={0.28}
              height={0.11}
              fill="rgba(0,0,0,0.58)"
            />
            <SvgText
              x={0.59}
              y={0.085}
              fill={colors.success}
              fontSize={0.034}
              fontWeight="700"
            >
              {Math.round(currentAngle)} deg
            </SvgText>
            <SvgText
              x={0.69}
              y={0.085}
              fill="rgba(255,255,255,0.78)"
              fontSize={0.022}
              fontWeight="600"
            >
              {movementContract.dominantJoint}
            </SvgText>
          </>
        ) : null}
        {lowConfidenceLandmarks.length > 0 ? (
          <>
            <Rect
              x={0.04}
              y={0.86}
              rx={0.018}
              width={0.52}
              height={0.08}
              fill="rgba(0,0,0,0.58)"
            />
            <SvgText
              x={0.06}
              y={0.91}
              fill={colors.warning}
              fontSize={0.023}
              fontWeight="600"
            >
              Low confidence: {lowConfidenceLandmarks.slice(0, 2).join(", ")}
            </SvgText>
          </>
        ) : null}
      </Svg>
    </View>
  );
}
