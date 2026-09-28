import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { Canvas, Circle, Line, vec } from "@shopify/react-native-skia";

import { FitText } from "@/components/fit/FitText";
import { useTheme } from "@/contexts/ThemeContext";
import type { ExerciseRigRecord, PoseKeypointRecord } from "@fittrack/types";

const BONES = [
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

function interpolate(a: number, b: number, progress: number) {
  return a + (b - a) * progress;
}

function getPoint(
  start: PoseKeypointRecord | undefined,
  peak: PoseKeypointRecord | undefined,
  progress: number,
  width: number,
  height: number,
) {
  if (!start && !peak) return null;
  const from = start ?? peak;
  const to = peak ?? start;
  if (!from || !to) return null;

  return {
    visibility: Math.max(from.visibility, to.visibility),
    x: interpolate(from.x, to.x, progress) * width,
    y: interpolate(from.y, to.y, progress) * height,
  };
}

type Props = {
  height?: number;
  rig: ExerciseRigRecord | null;
  width?: number;
};

export default function SkeletonRigPreview({
  height = 220,
  rig,
  width = 300,
}: Props) {
  const { colors } = useTheme();
  const [canvasWidth, setCanvasWidth] = useState(width);
  const [progress, setProgress] = useState(0);
  const [direction, setDirection] = useState(1);

  const startFrame = rig?.keyframes.find((frame) => frame.kind === "start");
  const peakFrame = rig?.keyframes.find((frame) => frame.kind === "peak");

  useEffect(() => {
    if (!startFrame || !peakFrame) return undefined;

    const interval = setInterval(() => {
      setProgress((current) => {
        const next = current + direction * 0.04;
        if (next >= 1) {
          setDirection(-1);
          return 1;
        }
        if (next <= 0) {
          setDirection(1);
          return 0;
        }
        return next;
      });
    }, 48);

    return () => clearInterval(interval);
  }, [direction, peakFrame, startFrame]);

  const points = useMemo(
    () =>
      (startFrame?.keypoints ?? []).map((point, index) =>
        getPoint(
          point,
          peakFrame?.keypoints[index],
          progress,
          canvasWidth,
          height,
        ),
      ),
    [canvasWidth, height, peakFrame?.keypoints, progress, startFrame?.keypoints],
  );

  if (!rig || !startFrame || !peakFrame) {
    return (
      <View
        style={{
          alignItems: "center",
          borderColor: `${colors.border}AA`,
          borderRadius: 22,
          borderWidth: 1,
          height,
          justifyContent: "center",
          padding: 18,
          width: "100%",
        }}
      >
        <FitText style={{ color: colors.textMuted, textAlign: "center" }}>
          No rig preview yet. Capture at least three clean reps to generate one.
        </FitText>
      </View>
    );
  }

  return (
    <View>
      <View
        onLayout={(event) => {
          const measuredWidth = event.nativeEvent.layout.width;
          if (measuredWidth > 0 && Math.abs(measuredWidth - canvasWidth) > 1) {
            setCanvasWidth(measuredWidth);
          }
        }}
        style={{
          backgroundColor: `${colors.surfaceRaised}EE`,
          borderColor: `${colors.border}AA`,
          borderRadius: 22,
          borderWidth: 1,
          overflow: "hidden",
          width: "100%",
        }}
      >
        <Canvas style={{ height, width: "100%" }}>
          {BONES.map(([fromIndex, toIndex]) => {
            const from = points[fromIndex];
            const to = points[toIndex];
            if (!from || !to || from.visibility < 0.18 || to.visibility < 0.18) {
              return null;
            }
            return (
              <Line
                key={`${fromIndex}-${toIndex}`}
                color={colors.brand}
                p1={vec(from.x, from.y)}
                p2={vec(to.x, to.y)}
                strokeWidth={4}
              />
            );
          })}
          {points.map((point, index) => {
            if (!point || point.visibility < 0.18) return null;
            const isJoint = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].includes(index);
            return (
              <Circle
                key={`joint-${index}`}
                color={isJoint ? colors.success : colors.brand}
                cx={point.x}
                cy={point.y}
                r={isJoint ? 4.5 : 3}
              />
            );
          })}
        </Canvas>
      </View>
      {rig.angleSummary ? (
        <FitText
          style={{
            color: colors.textMuted,
            fontSize: 12,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          {rig.angleSummary.dominantJoint.toUpperCase()}{" "}
          {Math.round(rig.angleSummary.minAngle)} deg to{" "}
          {Math.round(rig.angleSummary.maxAngle)} deg -{" "}
          {Math.round(rig.angleSummary.travel)} deg travel
        </FitText>
      ) : null}
    </View>
  );
}
