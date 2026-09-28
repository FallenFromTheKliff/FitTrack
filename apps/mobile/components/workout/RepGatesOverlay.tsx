import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type {
  PoseKeypointRecord,
  PoseMovementContractRecord,
  ThemeColors,
} from "@fittrack/types";
import { FitText } from "@/components/fit/FitText";
import { getPoseMovementJointTriples } from "@fittrack/utils";
import { getRepGateProgress, getRepGateState, getRepGateGeometry, getRepGateBlockedCopy, type DynamicGateState } from "@/lib/workout/repGateFeedback";

type RepGatesOverlayProps = {
  colors: ThemeColors;
  currentAngle: number | null;
  currentPhase: string;
  guidanceLabel?: string | null;
  keypoints: PoseKeypointRecord[] | null;
  lowConfidenceLandmarks: string[];
  movementContract: PoseMovementContractRecord | null;
  reps: number;
  repPathUnblocked?: boolean;
  statusText?: string | null;
  viewportSize?: { height: number; width: number } | null;
};

type Point = PoseKeypointRecord | undefined;

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

function movementCue(exercise: string | null | undefined) {
  const label = exercise?.toLowerCase().replace(/[_-]+/g, " ") ?? "";
  if (label.includes("curl")) return "Curl higher";
  if (label.includes("squat")) return "Squat deeper";
  if (label.includes("lunge")) return "Drive up";
  if (label.includes("push") || label.includes("press")) return "Press up";
  if (label.includes("pull") || label.includes("row")) return "Pull higher";
  if (label.includes("hinge") || label.includes("deadlift")) return "Stand tall";
  return "Move with control";
}

function getActiveIndexes(
  keypoints: PoseKeypointRecord[],
  movementContract: PoseMovementContractRecord | null,
) {
  if (!movementContract) return new Set<number>();
  const triples = getPoseMovementJointTriples(movementContract);
  const points = [...triples.left, ...triples.right];
  const [leftA, leftB, leftC, rightA, rightB, rightC] = points;
  const leftVisibility =
    (keypoints[leftA]?.visibility ?? 0) +
    (keypoints[leftB]?.visibility ?? 0) +
    (keypoints[leftC]?.visibility ?? 0);
  const rightVisibility =
    (keypoints[rightA]?.visibility ?? 0) +
    (keypoints[rightB]?.visibility ?? 0) +
    (keypoints[rightC]?.visibility ?? 0);
  return new Set(
    leftVisibility >= rightVisibility
      ? [leftA, leftB, leftC]
      : [rightA, rightB, rightC],
  );
}

function getRepresentativeJoint(
  keypoints: PoseKeypointRecord[],
  movementContract: PoseMovementContractRecord | null,
): Point {
  if (!movementContract) return undefined;
  const triples = getPoseMovementJointTriples(movementContract);
  const points = [...triples.left, ...triples.right];
  const [leftA, leftB, leftC, rightA, rightB, rightC] = points;
  const leftVisibility =
    (keypoints[leftA]?.visibility ?? 0) +
    (keypoints[leftB]?.visibility ?? 0) +
    (keypoints[leftC]?.visibility ?? 0);
  const rightVisibility =
    (keypoints[rightA]?.visibility ?? 0) +
    (keypoints[rightB]?.visibility ?? 0) +
    (keypoints[rightC]?.visibility ?? 0);
  return keypoints[leftVisibility >= rightVisibility ? leftB : rightB];
}

function getGuidanceCopy({
  currentPhase,
  exercise,
  gateState,
  guidanceLabel,
  hasLiveKeypoints,
  isStaticHold,
}: {
  currentPhase: string;
  exercise: string | null | undefined;
  gateState: DynamicGateState;
  guidanceLabel?: string | null;
  hasLiveKeypoints: boolean;
  isStaticHold: boolean;
}) {
  if (gateState === "unreliable") {
    return { label: "Tracking paused", support: "Move back into frame" };
  }
  if (!hasLiveKeypoints) {
    return { label: "Get in frame", support: "Align full body" };
  }
  if (isStaticHold) {
    return currentPhase === "hold"
      ? { label: "Hold steady", support: "Good form" }
      : { label: "Find your position", support: "Enter the hold zone" };
  }
  switch (gateState) {
    case "armed":
      return { label: "Start reached", support: "Rep armed" };
    case "moving":
      return {
        label: movementCue(guidanceLabel ?? exercise),
        support: "Keep going",
      };
    case "target":
      return { label: "Target reached", support: "Return to start" };
    case "returning":
      return { label: "Return to start", support: "Finish the rep" };
    default:
      return { label: "Return to start", support: "Reach the start gate" };
  }
}

type GuidanceCopy = {
  label: string;
  support: string;
};

function getCompactStatusCopy(
  statusText: string | null | undefined,
  lowConfidenceLandmarks: string[],
): GuidanceCopy | null {
  const normalized = statusText?.trim().toLowerCase();
  if (!normalized) return getRepGateBlockedCopy(statusText, lowConfidenceLandmarks);

  if (normalized.includes("failed") || normalized.includes("unavailable")) {
    return { label: "Tracking paused", support: "Try again when ready" };
  }
  if (normalized.includes("saving")) {
    return { label: "Saving set", support: "Keep camera steady" };
  }
  if (normalized.includes("rest")) {
    return { label: "Rest timer", support: "Counting paused" };
  }
  if (normalized.includes("switch")) {
    return { label: "Camera ready", support: "Recenter before recording" };
  }
  if (normalized.includes("loading")) {
    return { label: "Preparing camera", support: "Keep the preview open" };
  }

  const blocked = getRepGateBlockedCopy(statusText, lowConfidenceLandmarks);
  if (blocked) return blocked;
  if (
    normalized.includes("body lost") ||
    normalized.includes("get back in frame") ||
    normalized.includes("reacquir") ||
    normalized.includes("unreliable") ||
    normalized.includes("waiting for a fresh") ||
    normalized.includes("paused")
  ) {
    return { label: "Tracking paused", support: "Move back into frame" };
  }
  if (
    normalized.includes("ready") ||
    normalized.includes("armed") ||
    normalized.includes("start set")
  ) {
    return { label: "Ready", support: "Start set" };
  }

  return null;
}

export function RepGatesOverlay({
  colors,
  currentAngle,
  currentPhase,
  guidanceLabel,
  keypoints,
  lowConfidenceLandmarks,
  movementContract,
  reps,
  repPathUnblocked = true,
  statusText,
}: RepGatesOverlayProps) {
  const hasLiveKeypoints = keypoints?.length === 33;
  const drawableKeypoints = hasLiveKeypoints ? keypoints : GUIDE_KEYPOINTS;

  const lowConfidence = lowConfidenceLandmarks.length > 0 || !repPathUnblocked;
  const isStaticHold = movementContract?.repModel === "static_hold";
  const reducedMotion = useReducedMotion();
  const orbPulse = useSharedValue(0);
  const startArrivalPulse = useSharedValue(0);
  const targetArrivalPulse = useSharedValue(0);
  const completionPulse = useSharedValue(0);
  const previousRepsRef = useRef<number | null>(null);
  const previousGateStateRef = useRef<DynamicGateState | null>(null);
  const lastLiveKeypointsRef = useRef<PoseKeypointRecord[] | null>(null);
  const reducedMotionConfirmationTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [completionKeypoints, setCompletionKeypoints] = useState<
    PoseKeypointRecord[] | null
  >(null);
  const [reducedMotionConfirmationVisible, setReducedMotionConfirmationVisible] =
    useState(false);
  const safeReps = Number.isFinite(reps) ? reps : 0;
  const [startGateCenter, setStartGateCenter] = useState(12.5);
  const [targetGateCenter, setTargetGateCenter] = useState(12.5);
  const progress = getRepGateProgress(currentAngle, movementContract);
  const rail = getRepGateGeometry(startGateCenter, targetGateCenter, progress);
  const gateState = getRepGateState({
    currentAngle,
    currentPhase,
    hasLiveKeypoints,
    lowConfidence,
    progress,
    repPathUnblocked,
  });
  const clearCompletionFeedback = useCallback(() => {
    cancelAnimation(completionPulse);
    completionPulse.value = 0;
    setCompletionKeypoints(null);
    if (reducedMotionConfirmationTimerRef.current) {
      clearTimeout(reducedMotionConfirmationTimerRef.current);
      reducedMotionConfirmationTimerRef.current = null;
    }
    setReducedMotionConfirmationVisible(false);
  }, [completionPulse]);

  useEffect(() => {
    if (reducedMotion || isStaticHold) {
      cancelAnimation(orbPulse);
      orbPulse.value = 0;
      return;
    }

    orbPulse.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
        }),
        withTiming(0, {
          duration: 900,
          easing: Easing.inOut(Easing.quad),
        }),
      ),
      -1,
      false,
    );

    return () => cancelAnimation(orbPulse);
  }, [isStaticHold, orbPulse, reducedMotion]);

  useEffect(() => {
    const previousGateState = previousGateStateRef.current;
    previousGateStateRef.current = gateState;

    cancelAnimation(startArrivalPulse);
    cancelAnimation(targetArrivalPulse);
    startArrivalPulse.value = 0;
    targetArrivalPulse.value = 0;

    if (reducedMotion || isStaticHold || previousGateState === null) return;

    if (gateState === "armed" && previousGateState !== "armed") {
      startArrivalPulse.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) }),
      );
    }

    if (gateState === "target" && previousGateState !== "target") {
      targetArrivalPulse.value = withSequence(
        withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 160, easing: Easing.in(Easing.cubic) }),
      );
    }
  }, [
    gateState,
    isStaticHold,
    reducedMotion,
    startArrivalPulse,
    targetArrivalPulse,
  ]);

  useEffect(
    () => () => {
      cancelAnimation(orbPulse);
      cancelAnimation(startArrivalPulse);
      cancelAnimation(targetArrivalPulse);
    },
    [orbPulse, startArrivalPulse, targetArrivalPulse],
  );

  useEffect(() => {
    if (hasLiveKeypoints && keypoints) {
      lastLiveKeypointsRef.current = keypoints.map((point) => ({ ...point }));
    }
  }, [hasLiveKeypoints, keypoints]);

  useEffect(() => {
    if (reducedMotion) clearCompletionFeedback();
  }, [clearCompletionFeedback, reducedMotion]);

  useEffect(
    () => () => {
      clearCompletionFeedback();
    },
    [clearCompletionFeedback],
  );

  useEffect(() => {
    const previousReps = previousRepsRef.current;
    previousRepsRef.current = safeReps;

    const registeredRep =
      previousReps !== null && safeReps > previousReps && !isStaticHold;
    if (!registeredRep) {
      clearCompletionFeedback();
      return;
    }

    const pulseSnapshot = lastLiveKeypointsRef.current?.map((point) => ({
      ...point,
    }));
    if (!pulseSnapshot) {
      clearCompletionFeedback();
      return;
    }

    if (reducedMotion) {
      clearCompletionFeedback();
      setCompletionKeypoints(pulseSnapshot);
      setReducedMotionConfirmationVisible(true);
      reducedMotionConfirmationTimerRef.current = setTimeout(() => {
        reducedMotionConfirmationTimerRef.current = null;
        setReducedMotionConfirmationVisible(false);
        setCompletionKeypoints(null);
      }, 470);
      return clearCompletionFeedback;
    }

    clearCompletionFeedback();
    setCompletionKeypoints(pulseSnapshot);
    completionPulse.value = withSequence(
      withTiming(1, {
        duration: 80,
        easing: Easing.out(Easing.cubic),
      }),
      withTiming(1, {
        duration: 90,
        easing: Easing.linear,
      }),
      withTiming(0, {
        duration: 330,
        easing: Easing.out(Easing.quad),
      }),
    );

    return clearCompletionFeedback;
  }, [
    clearCompletionFeedback,
    completionPulse,
    isStaticHold,
    reducedMotion,
    safeReps,
  ]);

  const orbPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + orbPulse.value * 0.12 }],
  }));
  const startArrivalPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + startArrivalPulse.value * 0.16 }],
  }));
  const targetArrivalPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + targetArrivalPulse.value * 0.16 }],
  }));
  const completionPulseStyle = useAnimatedStyle(() => ({
    opacity: completionPulse.value,
  }));
  const guidance = getGuidanceCopy({
    currentPhase,
    exercise: movementContract?.exercise,
    gateState,
    guidanceLabel,
    hasLiveKeypoints,
    isStaticHold: !!isStaticHold,
  });
  const displayGuidance = getCompactStatusCopy(statusText, lowConfidenceLandmarks) ?? guidance;
  const activeIndexes = getActiveIndexes(drawableKeypoints, movementContract);
  const representativeJoint = getRepresentativeJoint(
    drawableKeypoints,
    movementContract,
  );
  const isStartActive = gateState === "armed";
  const isTargetActive = gateState === "moving" || gateState === "target";
  const isTargetReached = gateState === "target";
  const isStartEmphasized =
    isStartActive ||
    gateState === "waiting" ||
    gateState === "unreliable" ||
    gateState === "returning";
  const targetGateColor = isTargetReached ? colors.success : colors.brand;
  const startGateColor = isStartActive
    ? colors.success
    : gateState === "returning"
      ? colors.brand
      : "rgba(255,255,255,0.78)";
  const targetGateLabel = isTargetReached
    ? "HIT ✓"
    : gateState === "moving"
      ? "TARGET ↑"
      : "TARGET";
  const startGateLabel = {
    armed: "ARMED ✓",
    waiting: "RETURN ↓",
    unreliable: "PAUSED",
    returning: "RETURN ↓",
    moving: "START",
    target: "START",
  }[gateState];
  const orbDirection =
    gateState === "target" || gateState === "unreliable"
      ? null
      : gateState === "armed" || gateState === "moving"
        ? "↑"
        : "↓";
  const orbDirectionColor =
    gateState === "waiting" || gateState === "unreliable"
      ? "rgba(255,255,255,0.92)"
      : colors.brand;
  const orbColor =
    gateState === "unreliable"
      ? "rgba(255,255,255,0.4)"
      : gateState === "armed" || gateState === "target"
      ? colors.success
      : colors.brand;
  const accent = lowConfidence ? "rgba(255,255,255,0.92)" : colors.brand;
  const activeSkeletonColor = lowConfidence
    ? "rgba(255,255,255,0.32)"
    : "rgba(255,255,255,0.58)";
  const progressColor = lowConfidence
    ? "rgba(255,255,255,0.68)"
    : isTargetReached
      ? colors.success
      : progress >= 0.68
        ? colors.warning
        : progress >= 0.28
          ? colors.brand
          : "rgba(255,255,255,0.62)";
  const activeChainColor = lowConfidence
    ? "rgba(255,255,255,0.28)"
    : colors.brand;
  const activeGateHaloInnerOpacity = 0.3;
  const inactiveGateHaloInnerOpacity = 0.16;
  const activeGateHaloOuterOpacity = 0.14;
  const inactiveGateHaloOuterOpacity = 0.07;

  if (drawableKeypoints.length !== 33) return null;

  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.root}
      testID="rep-gates-overlay"
    >
      <View style={styles.rigLayer}>
        <Svg
          height="100%"
          preserveAspectRatio="none"
          testID="rep-gates-skeleton"
          viewBox="0 0 1 1"
          width="100%"
        >
          {SKELETON_CONNECTIONS.map(([start, end]) => {
            const from = drawableKeypoints[start];
            const to = drawableKeypoints[end];
            if (!from || !to || from.visibility < 0.3 || to.visibility < 0.3) {
              return null;
            }
            const isActive = activeIndexes.has(start) && activeIndexes.has(end);
            return (
              <Line
                key={`${start}-${end}`}
                stroke={isActive ? activeChainColor : activeSkeletonColor}
                strokeLinecap="round"
                strokeWidth={isActive ? 0.008 : 0.0045}
                x1={from.x}
                x2={to.x}
                y1={from.y}
                y2={to.y}
              />
            );
          })}
          {drawableKeypoints.map((point, index) =>
            point.visibility >= 0.2 ? (
              <Circle
                key={`joint-${index}`}
                cx={point.x}
                cy={point.y}
                fill={
                  activeIndexes.has(index)
                    ? activeChainColor
                    : "rgba(255,255,255,0.78)"
                }
                opacity={lowConfidence ? 0.62 : 0.9}
                r={activeIndexes.has(index) ? 0.011 : 0.008}
              />
            ) : null,
          )}
          {representativeJoint ? (
            <Circle
              cx={representativeJoint.x}
              cy={representativeJoint.y}
              fill="transparent"
              opacity={lowConfidence ? 0.25 : 0.72}
              r={0.018}
              stroke={accent}
              strokeWidth={0.004}
            />
          ) : null}
        </Svg>
        {!isStaticHold && completionKeypoints ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.completionPulseLayer,
              completionPulseStyle,
              reducedMotion
                ? {
                    opacity: reducedMotionConfirmationVisible ? 0.78 : 0,
                  }
                : null,
            ]}
            testID="rep-gates-rep-complete"
          >
            <Svg
              height="100%"
              preserveAspectRatio="none"
              testID="rep-gates-rep-complete-skeleton"
              viewBox="0 0 1 1"
              width="100%"
            >
              {SKELETON_CONNECTIONS.map(([start, end]) => {
                const from = completionKeypoints[start];
                const to = completionKeypoints[end];
                if (!from || !to || from.visibility < 0.3 || to.visibility < 0.3) {
                  return null;
                }
                return (
                  <Line
                    key={`completion-halo-${start}-${end}`}
                    opacity={0.28}
                    stroke={colors.success}
                    strokeLinecap="round"
                    strokeWidth={0.018}
                    x1={from.x}
                    x2={to.x}
                    y1={from.y}
                    y2={to.y}
                  />
                );
              })}
              {completionKeypoints.map((point, index) =>
                point.visibility >= 0.2 ? (
                  <Circle
                    key={`completion-halo-joint-${index}`}
                    fill={colors.success}
                    opacity={0.22}
                    r={0.022}
                    cx={point.x}
                    cy={point.y}
                  />
                ) : null,
              )}
              {SKELETON_CONNECTIONS.map(([start, end]) => {
                const from = completionKeypoints[start];
                const to = completionKeypoints[end];
                if (!from || !to || from.visibility < 0.3 || to.visibility < 0.3) {
                  return null;
                }
                return (
                  <Line
                    key={`completion-${start}-${end}`}
                    stroke={colors.success}
                    strokeLinecap="round"
                    strokeWidth={0.009}
                    x1={from.x}
                    x2={to.x}
                    y1={from.y}
                    y2={to.y}
                  />
                );
              })}
              {completionKeypoints.map((point, index) =>
                point.visibility >= 0.2 ? (
                  <Circle
                    key={`completion-joint-${index}`}
                    cx={point.x}
                    cy={point.y}
                    fill={colors.success}
                    r={0.011}
                  />
                ) : null,
              )}
            </Svg>
          </Animated.View>
        ) : null}
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.guidanceCard,
          {
            borderColor: lowConfidence
              ? "rgba(255,255,255,0.16)"
              : "rgba(255,255,255,0.08)",
            right: isStaticHold ? 104 : 80,
          },
        ]}
        testID="rep-gates-guidance-card"
      >
        <FitText numberOfLines={2} style={styles.guidanceTitle}>
          {displayGuidance.label}
        </FitText>
        <FitText
          numberOfLines={2}
          style={[
            styles.guidanceSupport,
            { color: lowConfidence ? "rgba(255,255,255,0.62)" : colors.brand },
          ]}
        >
          {displayGuidance.support}
        </FitText>
      </View>

      {isStaticHold ? (
        <View
          pointerEvents="none"
          style={[
            styles.holdLane,
            {
              borderColor:
                currentPhase === "hold" && !lowConfidence
                  ? colors.success
                  : "rgba(255,255,255,0.38)",
              backgroundColor:
                currentPhase === "hold" && !lowConfidence
                  ? "rgba(46,190,117,0.14)"
                  : "rgba(0,0,0,0.28)",
            },
          ]}
          testID="rep-gates-static-hold"
        >
          <FitText style={styles.holdLabel}>HOLD ZONE</FitText>
          <View
            style={[
              styles.holdMarker,
              {
                backgroundColor:
                  currentPhase === "hold" && !lowConfidence
                    ? colors.success
                    : "rgba(255,255,255,0.7)",
              },
            ]}
          />
          <FitText
            style={[
              styles.holdStatus,
              {
                color:
                  currentPhase === "hold" && !lowConfidence
                    ? colors.success
                    : "rgba(255,255,255,0.58)",
              },
            ]}
          >
            {currentPhase === "hold" && !lowConfidence
              ? "FORM LOCKED"
              : "FIND POSITION"}
          </FitText>
        </View>
      ) : (
        <View
          pointerEvents="none"
          style={styles.romLane}
          testID="rep-gates-rom-lane"
        >
          <View
            pointerEvents="none"
            style={[
              styles.railFalloffOuter,
              { backgroundColor: colors.brand, opacity: 0.07, top: rail.top, height: rail.height },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.railFalloffInner,
              { backgroundColor: colors.brand, opacity: 0.18, top: rail.top, height: rail.height },
            ]}
            testID="rep-gates-rom-glow"
          />
          <View
            pointerEvents="none"
            style={[styles.railTrack, { backgroundColor: colors.brand, opacity: 1, top: rail.top, height: rail.height }]}
          />
          <View
            style={[
              styles.railProgress,
              {
                backgroundColor: progressColor,
                top: rail.center,
                height: rail.fillHeight,
              },
            ]}
          />
          <View style={styles.gateTarget} onLayout={(event) => setTargetGateCenter(event.nativeEvent.layout.y + 12.5)}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.gateHaloOuter,
                {
                  borderColor: targetGateColor,
                  opacity: isTargetActive
                    ? activeGateHaloOuterOpacity
                    : inactiveGateHaloOuterOpacity,
                },
                targetArrivalPulseStyle,
              ]}
            testID="rep-gates-target-glow"
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.gateHaloInner,
                {
                  borderColor: targetGateColor,
                  opacity: isTargetActive
                    ? activeGateHaloInnerOpacity
                    : inactiveGateHaloInnerOpacity,
                },
                targetArrivalPulseStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.gateRing,
                {
                  borderColor: targetGateColor,
                  opacity: isTargetActive ? 1 : 0.72,
                },
                targetArrivalPulseStyle,
              ]}
            />
            <FitText
              style={[
                styles.gateLabel,
                {
                  color: targetGateColor,
                },
              ]}
            >
              {targetGateLabel}
            </FitText>
          </View>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.orbFalloffOuter,
              {
                backgroundColor: orbColor,
                top: rail.center - 21,
                opacity: 0.08,
              },
              orbPulseStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.orbFalloffInner,
              {
                backgroundColor: orbColor,
                top: rail.center - 16,
                opacity: 0.18,
              },
              orbPulseStyle,
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.progressOrb,
              {
                backgroundColor: orbColor,
                top: rail.center - 12,
                opacity: 1,
              },
              orbPulseStyle,
            ]}
          />
          {orbDirection ? (
            <FitText
              style={[
                styles.orbDirection,
                {
                  top: rail.center - 9,
                  color: orbDirectionColor,
                },
              ]}
            >
              {orbDirection}
            </FitText>
          ) : null}
          <View style={styles.gateStart} onLayout={(event) => setStartGateCenter(event.nativeEvent.layout.y + 12.5)}>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.gateHaloOuter,
                {
                  borderColor: startGateColor,
                  opacity: isStartEmphasized
                    ? activeGateHaloOuterOpacity
                    : inactiveGateHaloOuterOpacity,
                },
                startArrivalPulseStyle,
              ]}
            testID="rep-gates-start-glow"
            />
            <Animated.View
              pointerEvents="none"
              style={[
                styles.gateHaloInner,
                {
                  borderColor: startGateColor,
                  opacity: isStartEmphasized
                    ? activeGateHaloInnerOpacity
                    : inactiveGateHaloInnerOpacity,
                },
                startArrivalPulseStyle,
              ]}
            />
            <Animated.View
              style={[
                styles.gateRing,
                {
                  borderColor: startGateColor,
                  opacity: isStartEmphasized ? 1 : 0.72,
                },
                startArrivalPulseStyle,
              ]}
            />
            <FitText
              style={[
                styles.gateLabel,
                {
                  color: startGateColor,
                },
              ]}
            >
              {startGateLabel}
            </FitText>
          </View>
        </View>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
    zIndex: 2,
  },
  rigLayer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  completionPulseLayer: {
    bottom: 0,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  guidanceCard: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.78)",
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: "center",
    left: 10,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: "absolute",
    right: 80,
    top: "43%",
    zIndex: 5,
  },
  guidanceTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.1,
    lineHeight: 27,
    textAlign: "center",
  },
  guidanceSupport: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    lineHeight: 15,
    marginTop: 4,
    textAlign: "center",
    textTransform: "uppercase",
  },
  romLane: {
    bottom: "24%",
    position: "absolute",
    right: 8,
    top: "22%",
    width: 70,
  },
  railTrack: {
    borderRadius: 999,
    left: "50%",
    marginLeft: -1,
    position: "absolute",
    width: 2,
  },
  railFalloffInner: {
    borderRadius: 999,
    left: "50%",
    marginLeft: -2,
    position: "absolute",
    width: 4,
  },
  railFalloffOuter: {
    borderRadius: 999,
    left: "50%",
    marginLeft: -4,
    position: "absolute",
    width: 8,
  },
  railProgress: {
    borderRadius: 999,
    left: "50%",
    marginLeft: -1,
    position: "absolute",
    width: 2,
  },
  gateTarget: {
    alignItems: "center",
    position: "absolute",
    right: 0,
    top: 0,
    width: 70,
  },
  gateStart: {
    alignItems: "center",
    bottom: 0,
    position: "absolute",
    right: 0,
    width: 70,
  },
  gateRing: {
    borderRadius: 999,
    borderWidth: 3,
    height: 25,
    width: 25,
  },
  gateHaloInner: {
    borderRadius: 999,
    borderWidth: 3,
    height: 31,
    left: 19.5,
    position: "absolute",
    top: -3,
    width: 31,
  },
  gateHaloOuter: {
    borderRadius: 999,
    borderWidth: 4,
    height: 37,
    left: 16.5,
    position: "absolute",
    top: -6,
    width: 37,
  },
  gateLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
    marginTop: 3,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 3,
  },
  progressOrb: {
    borderColor: "rgba(255,255,255,0.88)",
    borderRadius: 999,
    borderWidth: 2,
    height: 24,
    left: "50%",
    marginLeft: -12,
    position: "absolute",
    width: 24,
  },
  orbFalloffInner: {
    borderRadius: 999,
    height: 32,
    left: "50%",
    marginLeft: -16,
    position: "absolute",
    width: 32,
  },
  orbFalloffOuter: {
    borderRadius: 999,
    height: 42,
    left: "50%",
    marginLeft: -21,
    position: "absolute",
    width: 42,
  },
  orbDirection: {
    fontSize: 16,
    fontWeight: "900",
    height: 18,
    left: "50%",
    lineHeight: 18,
    marginLeft: 15,
    position: "absolute",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { height: 1, width: 0 },
    textShadowRadius: 3,
    width: 18,
  },
  holdLane: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 2,
    justifyContent: "center",
    minHeight: 104,
    paddingHorizontal: 10,
    position: "absolute",
    right: 8,
    top: "43%",
    width: 88,
  },
  holdLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  holdMarker: {
    borderColor: "rgba(255,255,255,0.88)",
    borderRadius: 999,
    borderWidth: 2,
    height: 17,
    marginVertical: 10,
    width: 17,
  },
  holdStatus: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
});
