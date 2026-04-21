import type { RefObject } from "react";
import { Platform, View } from "react-native";
import { Circle, Cpu, Pause, Play, StopCircle } from "lucide-react-native";
import { CameraView } from "expo-camera";

import type { IThemeContext } from "@fittrack/types";
import type {
  PoseKeypointRecord,
  PoseMovementContractRecord,
} from "@fittrack/types";
import { formatTime } from "@fittrack/utils";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";
import { PoseGuidanceOverlay } from "@/components/workout/PoseGuidanceOverlay";
import { makeWorkoutStyles } from "@/styles/shared/ScreenStyles";

type WorkoutTrackingSectionProps = {
  cameraActive: boolean;
  cameraRef: RefObject<CameraView | null>;
  calories: number;
  colors: IThemeContext["colors"];
  countdownValue: number | null;
  currentAngle: number | null;
  currentKeypoints: PoseKeypointRecord[] | null;
  currentPhase: string;
  guidanceLabel: string | null;
  isFrozen: boolean;
  isRecording: boolean;
  isTrackingReady: boolean;
  lowConfidenceLandmarks: string[];
  movementContract: PoseMovementContractRecord | null;
  onInitCamera: () => void | Promise<void>;
  onPause: () => void;
  onResumeRecord: () => void | Promise<void>;
  onStartRecord: () => void | Promise<void>;
  onStopRecord: () => void;
  permissionGranted: boolean;
  reps: number;
  seconds: number;
  s: ReturnType<typeof makeWorkoutStyles>;
  trackingDisabledReason: string | null;
};

export function WorkoutTrackingSection({
  cameraActive,
  cameraRef,
  calories,
  colors,
  countdownValue,
  currentAngle,
  currentKeypoints,
  currentPhase,
  guidanceLabel,
  isFrozen,
  isRecording,
  isTrackingReady,
  lowConfidenceLandmarks,
  movementContract,
  onInitCamera,
  onPause,
  onResumeRecord,
  onStartRecord,
  onStopRecord,
  permissionGranted,
  reps,
  seconds,
  s,
  trackingDisabledReason
}: WorkoutTrackingSectionProps) {
  const primaryActionDisabled = isRecording
    ? countdownValue !== null
    : countdownValue !== null || !isTrackingReady;
  const secondaryActionDisabled = isRecording
    ? countdownValue !== null
    : countdownValue !== null || !isTrackingReady;

  return (
    <FitSection heading="Real-time exercise tracking" cardStyle={{ overflow: "visible" }}>
      <View style={s.previewInner}>
        {cameraActive && permissionGranted ? (
          <>
            <CameraView
              ref={cameraRef}
              style={s.cameraView}
              facing={Platform.OS === "web" ? "front" : "back"}
            />
            <PoseGuidanceOverlay
              colors={colors}
              currentAngle={currentAngle}
              currentPhase={currentPhase}
              guidanceLabel={guidanceLabel}
              keypoints={currentKeypoints}
              lowConfidenceLandmarks={lowConfidenceLandmarks}
              movementContract={movementContract}
            />
          </>
        ) : null}
        {countdownValue !== null ? (
          <View style={s.countdownOverlay}>
            <FitText style={s.countdownText}>{countdownValue}</FitText>
          </View>
        ) : null}
        <View style={s.gridOverlay}>
          <View style={[s.gridLine, { width: 1, top: 0, bottom: 0, left: "33.3%" as const }]} />
          <View style={[s.gridLine, { width: 1, top: 0, bottom: 0, left: "66.6%" as const }]} />
          <View style={[s.gridLine, { height: 1, left: 0, right: 0, top: "33.3%" as const }]} />
          <View style={[s.gridLine, { height: 1, left: 0, right: 0, top: "66.6%" as const }]} />
        </View>
        {!cameraActive || !permissionGranted ? (
          <View style={s.initButtonWrap}>
            <FitButton
              label="Initialize Camera"
              icon={Cpu}
              variant="primary"
              onPress={() => { void onInitCamera(); }}
              disabled={isFrozen}
              style={{ paddingHorizontal: 24 }}
            />
            <FitText style={{ marginTop: 10, fontSize: 12, color: colors.textMuted, textAlign: "center" }}>
              {permissionGranted
                ? "Tap to prepare the camera before you start tracking."
                : "Camera permission is required for live pose tracking."}
            </FitText>
          </View>
        ) : null}
        <View style={s.previewOverlayTop}>
          <View style={s.timerPill}>
            <View style={[s.timerDot, { backgroundColor: isRecording ? colors.danger : colors.brand }]} />
            <FitText style={s.timerText}>{formatTime(seconds)}</FitText>
          </View>
          <View style={s.kcalPill}>
            <Cpu size={13} color={colors.brand} strokeWidth={2} />
            <FitText style={s.kcalText}>{calories} kcal</FitText>
          </View>
        </View>
        <View style={s.previewOverlayTopCenter}>
          <View style={s.repsPill}>
            <FitText style={s.repsText}>{reps}</FitText>
            <FitText style={s.repsPillLabel}> reps</FitText>
          </View>
        </View>
        {cameraActive && permissionGranted ? (
          <View style={s.previewControls}>
            <FitButton
              icon={isRecording ? StopCircle : Circle}
              iconOnly
              iconSize={28}
              variant={isRecording ? "danger" : "primary"}
              disabled={primaryActionDisabled}
              onPress={isRecording ? onStopRecord : () => { void onStartRecord(); }}
            />
            <FitButton
              icon={isRecording ? Pause : Play}
              iconOnly
              iconSize={28}
              variant="ghost"
              disabled={secondaryActionDisabled}
              onPress={isRecording ? onPause : () => { void onResumeRecord(); }}
            />
          </View>
        ) : null}
      </View>
      {trackingDisabledReason ? (
        <FitText style={{ marginTop: 12, fontSize: 12, color: colors.warning }}>
          {trackingDisabledReason}
        </FitText>
      ) : null}
    </FitSection>
  );
}
