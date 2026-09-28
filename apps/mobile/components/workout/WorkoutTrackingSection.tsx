import { useMemo, useState, type RefObject } from "react";
import {
  Linking,
  Platform,
  Switch,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  Circle,
  Cpu,
  Dumbbell,
  Pause,
  Play,
  RefreshCw,
  StopCircle,
} from "lucide-react-native";
import { CameraView, type CameraType } from "expo-camera";

import type { IThemeContext } from "@fittrack/types";
import type {
  PoseKeypointRecord,
  PoseMovementContractRecord,
} from "@fittrack/types";
import {
  createCoverCropTransform,
  formatTime,
  type CameraRotation,
} from "@fittrack/utils";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";
import { NativeVisionPoseCamera } from "@/components/workout/NativeVisionPoseCamera";
import type { NativePoseObservation } from "@/components/workout/NativeVisionPoseCamera.types";
import type {
  FitTrackMultiPoseError,
  FitTrackMultiPoseSessionStatus,
} from "@/modules/fittrack-multi-pose/src";
import { PoseGuidanceOverlay } from "@/components/workout/PoseGuidanceOverlay";
import { makeWorkoutStyles } from "@/styles/shared/ScreenStyles";
import type { WorkoutCameraRuntimeState } from "@/hooks/workout/useWorkoutLiveController";
import type { WorkoutCameraTarget } from "@/components/workout/workout-camera-target";

type WorkoutTrackingSectionProps = {
  cameraRuntimeState: WorkoutCameraRuntimeState;
  cameraTarget: WorkoutCameraTarget | null;
  cameraActive: boolean;
  cameraRef: RefObject<CameraView | null>;
  calories: number;
  cameraFacing: CameraType;
  cameraRemountKey: number;
  colors: IThemeContext["colors"];
  countdownValue: number | null;
  currentAngle: number | null;
  repPathUnblocked?: boolean;
  currentKeypoints: PoseKeypointRecord[] | null;
  currentLoadLabel: string | null;
  currentPhase: string;
  cameraFrameSize: {
    height: number;
    mirrorX: boolean;
    rotation: CameraRotation;
    width: number;
  } | null;
  nativeStreamGeneration: number;
  holdProgressSeconds: number;
  holdValid: boolean;
  guidanceLabel: string | null;
  isFrozen: boolean;
  isCameraSwitching: boolean;
  isRecording: boolean;
  hasStartedSet: boolean;
  isTrackingReady: boolean;
  subjectTrackingAvailable: boolean | null;
  subjectTrackingError: FitTrackMultiPoseError | null;
  subjectTrackingEnabled: boolean;
  subjectTrackingStatus: FitTrackMultiPoseSessionStatus;
  lowConfidenceLandmarks: string[];
  movementContract: PoseMovementContractRecord | null;
  poseStatusText: string | null;
  onInitCamera: () => void | Promise<void>;
  onCameraContinuityChange: (active: boolean) => void;
  onMultiPoseAvailabilityChange: (available: boolean) => void;
  onMultiPoseStatusChange: (
    status: FitTrackMultiPoseSessionStatus,
    error?: FitTrackMultiPoseError | null,
  ) => void;
  onPause: () => void;
  onResumeRecord: () => void | Promise<void>;
  onNativePoseFrame: (observation: NativePoseObservation) => void | Promise<void>;
  onToggleSubjectTracking: () => void;
  onStartRecord: () => void | Promise<void>;
  onStopRecord: () => void;
  onToggleCameraFacing: () => void;
  permissionGranted: boolean;
  reps: number;
  seconds: number;
  s: ReturnType<typeof makeWorkoutStyles>;
  trackingDisabledReason: string | null;
};

export function WorkoutTrackingSection({
  cameraRuntimeState,
  cameraTarget,
  cameraActive,
  cameraRef,
  calories,
  cameraFacing,
  cameraFrameSize,
  cameraRemountKey,
  colors,
  countdownValue,
  currentAngle,
  repPathUnblocked,
  currentKeypoints,
  currentLoadLabel,
  currentPhase,
  holdProgressSeconds,
  holdValid,
  guidanceLabel,
  isFrozen,
  isCameraSwitching,
  isRecording,
  hasStartedSet,
  isTrackingReady,
  subjectTrackingAvailable,
  subjectTrackingError,
  subjectTrackingEnabled,
  subjectTrackingStatus,
  lowConfidenceLandmarks,
  movementContract,
  poseStatusText,
  nativeStreamGeneration,
  onInitCamera,
  onCameraContinuityChange,
  onMultiPoseAvailabilityChange,
  onMultiPoseStatusChange,
  onNativePoseFrame,
  onToggleSubjectTracking,
  onPause,
  onResumeRecord,
  onStartRecord,
  onStopRecord,
  onToggleCameraFacing,
  permissionGranted,
  reps,
  seconds,
  s,
  trackingDisabledReason,
}: WorkoutTrackingSectionProps) {
  const [previewSize, setPreviewSize] = useState({ height: 0, width: 0 });
  const canStartTarget = cameraRuntimeState === "ready";
  const primaryActionDisabled = isRecording
    ? countdownValue !== null || isCameraSwitching
    : countdownValue !== null ||
      isCameraSwitching ||
      !isTrackingReady ||
      !canStartTarget;
  const secondaryActionDisabled = isRecording
    ? countdownValue !== null || isCameraSwitching
    : countdownValue !== null ||
      isCameraSwitching ||
      !isTrackingReady ||
      !canStartTarget;
  const plannedActionDisabled =
    countdownValue !== null || isCameraSwitching || isFrozen;
  const cameraFacingLabel = cameraFacing === "front" ? "Front" : "Back";
  const cameraToggleDisabled =
    isRecording ||
    cameraRuntimeState === "saving" ||
    cameraRuntimeState === "rest" ||
    countdownValue !== null ||
    isCameraSwitching;
  const isNativePoseRuntime = Platform.OS !== "web";
  const isStaticHoldTarget =
    cameraTarget?.targetDurationSeconds != null && cameraTarget.targetReps <= 0;
  const targetReps = cameraTarget?.targetReps ?? 0;
  const poseTransform = useMemo(() => {
    if (!cameraFrameSize || previewSize.width <= 0 || previewSize.height <= 0) {
      return null;
    }
    return createCoverCropTransform({
      frameHeight: cameraFrameSize.height,
      frameWidth: cameraFrameSize.width,
      mirrorX: cameraFrameSize.mirrorX,
      rotation: cameraFrameSize.rotation,
      viewportHeight: previewSize.height,
      viewportWidth: previewSize.width,
    });
  }, [cameraFrameSize, previewSize]);
  const transformedKeypoints = currentKeypoints?.map((keypoint) =>
    poseTransform
      ? {
          ...keypoint,
          ...poseTransform.point({ x: keypoint.x, y: keypoint.y }),
        }
      : keypoint,
  );
  return (
    <FitSection heading="" bare>
      <View
        accessibilityLabel={
          cameraTarget
            ? `Camera ${cameraRuntimeState} for ${cameraTarget.exerciseName}, set ${cameraTarget.setNumber} of ${cameraTarget.totalSets}, ${isStaticHoldTarget ? `${holdProgressSeconds.toFixed(1)} of ${cameraTarget.targetDurationSeconds} seconds, ${holdValid ? "valid hold" : "hold paused"}` : `${reps} of ${cameraTarget.targetReps} reps`}`
            : undefined
        }
        onLayout={(event: LayoutChangeEvent) => {
          const { height, width } = event.nativeEvent.layout;
          if (height !== previewSize.height || width !== previewSize.width) {
            setPreviewSize({ height, width });
          }
        }}
        style={s.previewInner}
      >
        {cameraActive && permissionGranted ? (
          <>
            {isNativePoseRuntime ? (
              <NativeVisionPoseCamera
                key={`native-${cameraFacing}-${cameraRemountKey}`}
                cameraFacing={cameraFacing}
                isActive={!isCameraSwitching}
                poseProcessingEnabled={
                  cameraRuntimeState !== "rest" && cameraRuntimeState !== "saving"
                }
                onCameraContinuityChange={onCameraContinuityChange}
                onMultiPoseAvailabilityChange={onMultiPoseAvailabilityChange}
                onMultiPoseStatusChange={onMultiPoseStatusChange}
                onPoseFrame={onNativePoseFrame}
                streamId={cameraRemountKey}
                streamGeneration={nativeStreamGeneration}
                subjectTrackingEnabled={subjectTrackingEnabled}
                style={s.cameraView}
              />
            ) : (
              <CameraView
                key={`web-${cameraFacing}-${cameraRemountKey}`}
                ref={cameraRef}
                style={s.cameraView}
                facing={cameraFacing}
              />
            )}
            <PoseGuidanceOverlay
              colors={colors}
              currentAngle={currentAngle}
              repPathUnblocked={repPathUnblocked}
              currentPhase={currentPhase}
              guidanceLabel={guidanceLabel}
              keypoints={transformedKeypoints ?? null}
              lowConfidenceLandmarks={lowConfidenceLandmarks}
              movementContract={movementContract}
              reps={reps}
              statusText={poseStatusText}
              viewportSize={previewSize}
            />
          </>
        ) : null}
        {countdownValue !== null ? (
          <View style={s.countdownOverlay}>
            <FitText style={s.countdownText}>{countdownValue}</FitText>
          </View>
        ) : null}
        {isCameraSwitching ? (
          <View style={s.cameraSwitchOverlay}>
            <FitText style={s.cameraSwitchTitle}>Switching camera...</FitText>
            <FitText style={s.cameraSwitchHint}>
              Reopening the preview so Android releases the previous lens.
            </FitText>
          </View>
        ) : null}
        {(!cameraActive || !permissionGranted) && !isCameraSwitching ? (
          <View style={s.initButtonWrap}>
            <FitButton
              label={permissionGranted ? "Start Camera" : "Allow Camera Access"}
              icon={Cpu}
              variant="primary"
              onPress={() => { void onInitCamera(); }}
              disabled={isFrozen}
              style={{ paddingHorizontal: 24 }}
            />
            <FitText style={{ marginTop: 10, fontSize: 12, color: colors.textMuted, textAlign: "center" }}>
              {permissionGranted
                ? "Prepare the preview, then begin the current planned set."
                : "Camera tracking is optional. You can return to manual logging at any time."}
            </FitText>
            {!permissionGranted && Platform.OS !== "web" ? (
              <FitButton
                label="Open Device Settings"
                onPress={() => {
                  void Linking.openSettings();
                }}
                variant="ghost"
                style={{ alignSelf: "stretch", marginTop: 8, minHeight: 44, paddingHorizontal: 14 }}
                textStyle={{ fontSize: 15, fontWeight: "600" }}
              />
            ) : null}
          </View>
        ) : null}
        <View style={s.previewOverlayTop}>
          <View style={s.metricPillStack}>
            <View style={s.timerPill}>
              <View style={[s.timerDot, { backgroundColor: isRecording ? colors.danger : colors.brand }]} />
              <View style={s.metricContent}>
                <FitText style={s.metricLabel}>TIMER</FitText>
                <FitText style={s.timerText}>{formatTime(seconds)}</FitText>
              </View>
            </View>
            <View style={s.kcalPill}>
              <Cpu size={13} color={colors.brand} strokeWidth={2} />
              <View style={s.metricContent}>
                <FitText style={s.metricLabel}>KCAL</FitText>
                <FitText style={s.kcalText} numberOfLines={1}>{calories}</FitText>
              </View>
            </View>
          </View>
          {currentLoadLabel ? (
            <View style={s.loadPillRow}>
              <View style={s.currentLoadPill}>
                <Dumbbell size={13} color={colors.brand} strokeWidth={2} />
                <View style={s.metricContent}>
                  <FitText style={s.metricLabel}>LOAD</FitText>
                  <FitText style={s.currentLoadText} numberOfLines={1}>{currentLoadLabel}</FitText>
                </View>
              </View>
            </View>
          ) : null}
        </View>
        {cameraActive && permissionGranted ? (
          <View style={s.cameraFacingControl}>
            <FitButton
              icon={RefreshCw}
              iconSize={13}
              label={cameraFacingLabel}
              variant="primary"
              disabled={cameraToggleDisabled}
              onPress={onToggleCameraFacing}
              style={s.cameraToggleButton}
              textStyle={s.cameraToggleText}
            />
          </View>
        ) : null}
        <View
          style={[
            s.previewOverlayTopCenter,
            currentLoadLabel ? s.previewOverlayTopCenterWithLoad : null,
          ]}
        >
          <View style={s.repsPill}>
            <FitText style={s.repsText}>
              {isStaticHoldTarget
                ? `${holdProgressSeconds.toFixed(1)} / ${cameraTarget?.targetDurationSeconds ?? 0}`
                : cameraTarget
                  ? `${reps} / ${targetReps}`
                  : reps}
            </FitText>
            <FitText style={s.repsPillLabel}>
              {isStaticHoldTarget ? "SECONDS" : "REPS"}
            </FitText>
          </View>
        </View>
        {cameraActive && permissionGranted && !cameraTarget ? (
          <View style={s.previewControls}>
            <FitButton
              icon={isRecording ? StopCircle : Circle}
              iconOnly
              iconSize={22}
              accessibilityLabel={isRecording ? "Stop recording" : "Start recording"}
              variant={isRecording ? "danger" : "primary"}
              disabled={primaryActionDisabled}
              onPress={isRecording ? onStopRecord : () => { void onStartRecord(); }}
              style={s.previewControlButton}
            />
            <FitButton
              icon={isRecording ? Pause : Play}
              iconOnly
              iconSize={22}
              accessibilityLabel={isRecording ? "Pause recording" : "Resume recording"}
              variant="ghost"
              disabled={secondaryActionDisabled}
              onPress={isRecording ? onPause : () => { void onResumeRecord(); }}
              style={s.previewControlButton}
            />
          </View>
        ) : null}
      </View>
      <View
        accessibilityRole="summary"
        style={{
          alignItems: "center",
          backgroundColor: colors.surfaceRaised,
          borderRadius: 12,
          flexDirection: "row",
          gap: 10,
          justifyContent: "space-between",
          marginTop: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <FitText style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "800" }}>
            Subject tracking
          </FitText>
          <FitText style={{ color: colors.textMuted, fontSize: 11, lineHeight: 15 }}>
            {subjectTrackingAvailable === false
              ? "Requires a new mobile build."
              : subjectTrackingError
                ? `${subjectTrackingError.message} Turn tracking off, then on to retry.`
                : subjectTrackingStatus === "starting"
                  ? "Starting subject tracking..."
              : subjectTrackingEnabled
                ? "On · follows the same body if others enter the frame."
                : "Off · keeps lower processing cost for one body."}
          </FitText>
          {subjectTrackingEnabled ? (
            <FitText style={{ color: colors.textMuted, fontSize: 10, lineHeight: 14 }}>
              May use more battery and reduce frame rate. Turn off if tracking slows.
            </FitText>
          ) : null}
        </View>
        <Switch
          accessibilityLabel="Subject tracking"
          disabled={
            (subjectTrackingAvailable === false && !subjectTrackingEnabled) ||
            isFrozen
          }
          onValueChange={onToggleSubjectTracking}
          value={subjectTrackingEnabled}
          trackColor={{ false: colors.border, true: colors.brand + "88" }}
          thumbColor={subjectTrackingEnabled ? colors.brand : colors.textMuted}
        />
      </View>
      {cameraActive && permissionGranted && cameraTarget ? (
        <View style={s.setControls}>
          <FitButton
            icon={hasStartedSet ? (isRecording ? Pause : Play) : Circle}
            label={hasStartedSet ? (isRecording ? "Pause" : "Resume") : "Start Set"}
            variant={hasStartedSet ? "ghost" : "primary"}
            disabled={plannedActionDisabled}
            onPress={hasStartedSet
              ? (isRecording ? onPause : () => { void onResumeRecord(); })
              : () => { void onStartRecord(); }}
            style={s.setControlButton}
            textStyle={s.setControlText}
          />
          {hasStartedSet ? (
            <FitButton
              icon={StopCircle}
              label="Finish Set"
              variant="danger"
              disabled={countdownValue !== null || isCameraSwitching}
              onPress={onStopRecord}
              style={s.setControlButton}
              textStyle={s.setControlText}
            />
          ) : null}
        </View>
      ) : null}
      {trackingDisabledReason ? (
        <FitText style={{ marginTop: 12, fontSize: 12, color: colors.warning }}>
          {trackingDisabledReason}
        </FitText>
      ) : null}
    </FitSection>
  );
}
