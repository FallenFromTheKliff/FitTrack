import { useMemo, useState, type RefObject } from "react";
import { Linking, Platform, View, type LayoutChangeEvent } from "react-native";
import {
  Circle,
  Cpu,
  Dumbbell,
  Pause,
  Play,
  RefreshCw,
  StopCircle,
  UnlockKeyhole,
} from "lucide-react-native";
import { CameraView, type CameraType } from "expo-camera";

import type { IThemeContext } from "@fittrack/types";
import { R } from "@fittrack/ui/tokens";
import type {
  PoseEquipmentDetectionBoxRecord,
  PoseKeypointRecord,
  PoseMovementContractRecord,
} from "@fittrack/types";
import { createCoverCropTransform, formatTime } from "@fittrack/utils";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";
import { getWorkoutCameraRestLabel } from "@/components/workout/workout-camera-target";
import { NativeVisionPoseCamera } from "@/components/workout/NativeVisionPoseCamera";
import type {
  NativeEquipmentSnapshot,
  NativePoseFrame,
} from "@/components/workout/NativeVisionPoseCamera.types";
import { PoseGuidanceOverlay } from "@/components/workout/PoseGuidanceOverlay";
import { makeWorkoutStyles } from "@/styles/shared/ScreenStyles";
import type { WorkoutCameraRuntimeState } from "@/hooks/workout/useWorkoutLiveController";
import type { WorkoutCameraTarget } from "@/components/workout/workout-camera-target";

type WorkoutTrackingSectionProps = {
  cameraRuntimeState: WorkoutCameraRuntimeState;
  cameraTarget: WorkoutCameraTarget | null;
  cameraActive: boolean;
  autoFinishWarningSeconds: number | null;
  cameraRef: RefObject<CameraView | null>;
  calories: number;
  cameraFacing: CameraType;
  cameraRemountKey: number;
  colors: IThemeContext["colors"];
  countdownValue: number | null;
  currentAngle: number | null;
  currentKeypoints: PoseKeypointRecord[] | null;
  currentLoadLabel: string | null;
  currentPhase: string;
  cameraFrameSize: { height: number; width: number } | null;
  equipmentDetected: boolean;
  equipmentDetectionBoxes: PoseEquipmentDetectionBoxRecord[];
  equipmentDetectionStatusText: string | null;
  equipmentSnapshotActive: boolean;
  holdProgressSeconds: number;
  holdValid: boolean;
  guidanceLabel: string | null;
  isFrozen: boolean;
  isCameraSwitching: boolean;
  isRecording: boolean;
  hasStartedSet: boolean;
  isTrackingReady: boolean;
  lowConfidenceLandmarks: string[];
  movementContract: PoseMovementContractRecord | null;
  onInitCamera: () => void | Promise<void>;
  onNativeEquipmentSnapshot: (snapshot: NativeEquipmentSnapshot) => void | Promise<void>;
  onPause: () => void;
  onResumeRecord: () => void | Promise<void>;
  onNativePoseFrame: (frame: NativePoseFrame) => void | Promise<void>;
  onStartRecord: () => void | Promise<void>;
  onStopRecord: () => void;
  onToggleCameraFacing: () => void;
  onToggleSubjectLock: () => void;
  permissionGranted: boolean;
  reps: number;
  restRemaining: number;
  seconds: number;
  s: ReturnType<typeof makeWorkoutStyles>;
  subjectLockGestureProgress: number;
  subjectLockReady: boolean;
  subjectLockStatusText: string;
  subjectLocked: boolean;
  trackingDisabledReason: string | null;
};

export function WorkoutTrackingSection({
  cameraRuntimeState,
  cameraTarget,
  cameraActive,
  autoFinishWarningSeconds,
  cameraRef,
  calories,
  cameraFacing,
  cameraFrameSize,
  cameraRemountKey,
  colors,
  countdownValue,
  currentAngle,
  currentKeypoints,
  currentLoadLabel,
  currentPhase,
  equipmentDetected,
  equipmentDetectionBoxes,
  equipmentDetectionStatusText,
  equipmentSnapshotActive,
  holdProgressSeconds,
  holdValid,
  guidanceLabel,
  isFrozen,
  isCameraSwitching,
  isRecording,
  hasStartedSet,
  isTrackingReady,
  lowConfidenceLandmarks,
  movementContract,
  onInitCamera,
  onNativeEquipmentSnapshot,
  onNativePoseFrame,
  onPause,
  onResumeRecord,
  onStartRecord,
  onStopRecord,
  onToggleCameraFacing,
  onToggleSubjectLock,
  permissionGranted,
  reps,
  restRemaining,
  seconds,
  s,
  subjectLockGestureProgress,
  subjectLockReady,
  subjectLockStatusText,
  subjectLocked,
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
  const isNormalRepTarget = !!cameraTarget && !isStaticHoldTarget && targetReps > 0;
  const repProgress =
    targetReps > 0 ? Math.min(1, reps / targetReps) : 0;
  const repsRemaining = Math.max(0, targetReps - reps);
  const repsOver = Math.max(0, reps - targetReps);
  const goalLabel =
    reps > targetReps
      ? `+${repsOver} ABOVE GOAL`
      : reps === targetReps
        ? "GOAL REACHED ✓"
        : `${repsRemaining} TO GO`;
  const goalColor = reps >= targetReps ? colors.success : colors.brand;
  const cameraTransform = useMemo(() => {
    if (!cameraFrameSize || previewSize.width <= 0 || previewSize.height <= 0) {
      return null;
    }
    return createCoverCropTransform({
      frameHeight: cameraFrameSize.height,
      frameWidth: cameraFrameSize.width,
      mirrorX: cameraFacing === "front",
      viewportHeight: previewSize.height,
      viewportWidth: previewSize.width,
    });
  }, [cameraFacing, cameraFrameSize, previewSize]);
  const poseTransform = useMemo(() => {
    if (!cameraFrameSize || previewSize.width <= 0 || previewSize.height <= 0) {
      return null;
    }
    return createCoverCropTransform({
      frameHeight: cameraFrameSize.height,
      frameWidth: cameraFrameSize.width,
      mirrorX: cameraFacing === "front" && !isNativePoseRuntime,
      viewportHeight: previewSize.height,
      viewportWidth: previewSize.width,
    });
  }, [cameraFacing, cameraFrameSize, isNativePoseRuntime, previewSize]);
  const transformedKeypoints = currentKeypoints?.map((keypoint) =>
    poseTransform
      ? {
          ...keypoint,
          ...poseTransform.point({ x: keypoint.x, y: keypoint.y }),
        }
      : keypoint,
  );
  const SubjectLockIcon = UnlockKeyhole;
  const subjectLockProgressPercent = Math.min(
    100,
    Math.round(subjectLockGestureProgress * 100),
  );
  const visibleEquipmentBoxes = equipmentDetected
    ? equipmentDetectionBoxes.filter(
        (box) =>
          typeof box.x === "number" &&
          typeof box.y === "number" &&
          typeof box.width === "number" &&
          typeof box.height === "number" &&
          box.width > 0 &&
          box.height > 0,
      )
    : [];
  const equipmentOverlayBoxes = visibleEquipmentBoxes.map((box) => {
    const fallback = {
      height: Math.max(0.05, Math.min(1, box.height ?? 0.05)),
      width: Math.max(0.05, Math.min(1, box.width ?? 0.05)),
      x: Math.max(0, Math.min(1, box.x ?? 0)),
      y: Math.max(0, Math.min(1, box.y ?? 0)),
    };
    return cameraTransform
      ? { ...box, ...cameraTransform.rect(fallback) }
      : { ...box, ...fallback };
  });

  return (
    <FitSection heading="Real-time exercise tracking" cardStyle={{ overflow: "visible" }}>
      <View
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
                equipmentSnapshotActive={isRecording && equipmentSnapshotActive}
                isActive={!isCameraSwitching}
                poseProcessingEnabled={
                  cameraRuntimeState !== "rest" && cameraRuntimeState !== "saving"
                }
                onEquipmentSnapshot={onNativeEquipmentSnapshot}
                onPoseFrame={onNativePoseFrame}
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
              currentPhase={currentPhase}
              guidanceLabel={guidanceLabel}
              keypoints={transformedKeypoints ?? null}
              lowConfidenceLandmarks={lowConfidenceLandmarks}
              movementContract={movementContract}
            />
            {equipmentDetectionStatusText ? (
              <>
                {equipmentOverlayBoxes.length > 0 ? (
                  equipmentOverlayBoxes.map((box, index) => (
                    <View
                      key={`${box.label ?? "equipment"}-${index}`}
                      style={{
                        borderColor: "#FFD84D",
                        borderRadius: 14,
                        pointerEvents: "none",
                        borderWidth: 3,
                        left: `${Math.max(0, Math.min(1, box.x ?? 0)) * 100}%`,
                        position: "absolute",
                        top: `${Math.max(0, Math.min(1, box.y ?? 0)) * 100}%`,
                        width: `${Math.max(0.05, Math.min(1, box.width ?? 0.05)) * 100}%`,
                        height: `${Math.max(0.05, Math.min(1, box.height ?? 0.05)) * 100}%`,
                        zIndex: 6,
                      }}
                    />
                  ))
                ) : equipmentDetected ? (
                  <View
                    style={{
                      borderColor: "#FFD84D",
                      borderRadius: 20,
                      pointerEvents: "none",
                      borderStyle: "dashed",
                      borderWidth: 3,
                      height: "28%",
                      left: "18%",
                      position: "absolute",
                      top: "45%",
                      width: "64%",
                      zIndex: 6,
                    }}
                  />
                ) : null}
                <View
                  style={{
                    alignItems: "center",
                    alignSelf: "center",
                    pointerEvents: "none",
                    backgroundColor: equipmentDetected
                      ? "rgba(255, 216, 77, 0.92)"
                      : "rgba(0,0,0,0.68)",
                    borderColor: equipmentDetected
                      ? "rgba(255,255,255,0.78)"
                      : "rgba(255, 216, 77, 0.65)",
                    borderRadius: R.md,
                    borderWidth: 1,
                    bottom: 54,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    position: "absolute",
                    zIndex: 7,
                  }}
                >
                  <FitText
                    style={{
                      color: equipmentDetected ? "#191200" : "#FFD84D",
                      fontSize: 11,
                      fontWeight: "900",
                      letterSpacing: 0.5,
                      textTransform: "uppercase",
                    }}
                  >
                    {equipmentDetectionStatusText}
                  </FitText>
                </View>
              </>
            ) : null}
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
          <View style={s.timerPill}>
            <View style={[s.timerDot, { backgroundColor: isRecording ? colors.danger : colors.brand }]} />
            <FitText style={s.timerText}>{formatTime(seconds)}</FitText>
          </View>
          <View style={s.previewTopRightCluster}>
            {cameraActive && permissionGranted ? (
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
            ) : null}
            <View style={s.metricPillStack}>
              <View style={s.kcalPill}>
                <Cpu size={13} color={colors.brand} strokeWidth={2} />
                <FitText style={s.kcalText}>{calories} kcal</FitText>
              </View>
              {currentLoadLabel ? (
                <View style={s.currentLoadPill}>
                  <Dumbbell size={13} color={colors.brand} strokeWidth={2} />
                  <FitText style={s.currentLoadText}>{currentLoadLabel}</FitText>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        {cameraTarget ? (
          <View
            accessibilityLabel={`Camera ${cameraRuntimeState} for ${cameraTarget.exerciseName}, set ${cameraTarget.setNumber} of ${cameraTarget.totalSets}, ${isStaticHoldTarget ? `${holdProgressSeconds.toFixed(1)} of ${cameraTarget.targetDurationSeconds} seconds` : `${reps} of ${cameraTarget.targetReps} reps`}`}
            style={{
              backgroundColor: "rgba(0,0,0,0.68)",
              borderColor:
                cameraRuntimeState === "tracking"
                  ? colors.brand
                  : "rgba(255,255,255,0.2)",
              borderRadius: R.md,
              borderWidth: 1,
              left: 14,
              maxWidth: "82%",
              paddingHorizontal: 10,
              paddingVertical: 7,
              position: "absolute",
              top: 56,
              zIndex: 5,
            }}
          >
            <FitText
              numberOfLines={1}
              style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}
            >
              {cameraTarget.exerciseName}
            </FitText>
            <FitText
              style={{ color: "rgba(255,255,255,0.8)", fontSize: 10, marginTop: 2 }}
            >
              Set {cameraTarget.setNumber}/{cameraTarget.totalSets} · {isStaticHoldTarget
                ? `${holdProgressSeconds.toFixed(1)} / ${cameraTarget.targetDurationSeconds}s hold${holdValid ? "" : " · form paused"}`
                : `${reps}/${cameraTarget.targetReps} reps`}
              {cameraTarget.targetWeightKg != null
                ? ` · ${cameraTarget.targetWeightKg} kg`
                : " · Bodyweight"}
              {` · ${currentPhase}`}
            </FitText>
            {isNormalRepTarget ? (
              <View style={{ gap: 5, marginTop: 8 }}>
                <View style={{ alignItems: "baseline", flexDirection: "row", justifyContent: "space-between" }}>
                  <FitText style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900" }}>
                    {reps} / {targetReps}
                  </FitText>
                  <FitText style={{ color: goalColor, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 }}>
                    {goalLabel}
                  </FitText>
                </View>
                <View style={{ backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 999, height: 5, overflow: "hidden" }}>
                  <View style={{ backgroundColor: goalColor, borderRadius: 999, height: 5, width: `${repProgress * 100}%` }} />
                </View>
              </View>
            ) : null}
            {autoFinishWarningSeconds !== null ? (
              <View accessibilityLiveRegion="polite" style={{ gap: 5, marginTop: 8 }}>
                <FitText
                  style={{
                    color: colors.warning,
                    fontSize: 10,
                    fontWeight: "900",
                    letterSpacing: 0.6,
                  }}
                >
                  SET MAY BE DONE
                </FitText>
                <FitText style={{ color: "rgba(255,255,255,0.82)", fontSize: 10 }}>
                  Auto-finishing in {autoFinishWarningSeconds}s
                </FitText>
                <View
                  style={{
                    backgroundColor: "rgba(255,255,255,0.2)",
                    borderRadius: 999,
                    height: 4,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      backgroundColor: colors.warning,
                      borderRadius: 999,
                      height: 4,
                      width: `${(autoFinishWarningSeconds / 5) * 100}%`,
                    }}
                  />
                </View>
              </View>
            ) : null}
            {cameraRuntimeState === "rest" ? (
              <FitText
                style={{ color: colors.brand, fontSize: 10, fontWeight: "900", marginTop: 3 }}
              >
                {getWorkoutCameraRestLabel(restRemaining)}
              </FitText>
            ) : cameraRuntimeState === "saving" ? (
              <FitText
                style={{ color: colors.warning, fontSize: 10, fontWeight: "900", marginTop: 3 }}
              >
                SAVING SET
              </FitText>
            ) : cameraRuntimeState === "ready" ? (
              <FitText
                style={{ color: colors.success, fontSize: 10, fontWeight: "900", marginTop: 3 }}
              >
                READY · reposition, then start
              </FitText>
            ) : null}
          </View>
        ) : null}
        {cameraTarget && cameraActive && permissionGranted ? (
          <View style={{ position: "absolute", left: 14, right: 14, bottom: 86, zIndex: 4 }}>
            <View style={{ alignItems: "center", backgroundColor: "rgba(0,0,0,0.62)", borderColor: subjectLocked ? colors.success : colors.border, borderRadius: 18, borderWidth: 1, padding: 10 }}>
              <FitText style={{ color: subjectLocked ? colors.success : "#FFFFFF", fontSize: 12, fontWeight: "900", letterSpacing: 0.8 }}>
                {subjectLocked ? "BODY TRACKED" : "GET IN FRAME"}
              </FitText>
              <FitText style={{ color: "rgba(255,255,255,0.78)", fontSize: 11, marginTop: 3, textAlign: "center" }}>
                {subjectLocked
                  ? "Automatic subject lock is active. Reps pause if your body leaves the frame."
                  : "Stand fully in frame so FitTrack can acquire your body automatically."}
              </FitText>
            </View>
          </View>
        ) : null}
        {cameraActive && permissionGranted && !cameraTarget && !subjectLocked ? (
          <View style={{ position: "absolute", left: 14, right: 14, bottom: 86, zIndex: 4 }}>
            <View
              style={{
                backgroundColor: "rgba(0,0,0,0.62)",
                borderColor: colors.border,
                borderRadius: 18,
                borderWidth: 1,
                padding: 10,
              }}
            >
              <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
                <SubjectLockIcon
                  size={14}
                  color="rgba(255,255,255,0.78)"
                  strokeWidth={2.5}
                />
                <FitText style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800", letterSpacing: 0.3 }}>
                  Subject lock is off
                </FitText>
              </View>
              <FitText style={{ color: "rgba(255,255,255,0.78)", fontSize: 11, marginTop: 3 }}>
                {subjectLockReady
                  ? subjectLockStatusText
                  : "Align your shoulders, hips, and one arm chain in frame to enable target lock."}
              </FitText>
              {subjectLockGestureProgress > 0 ? (
                <>
                  <View style={{ backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, height: 4, marginTop: 8, overflow: "hidden" }}>
                    <View
                      style={{
                        backgroundColor: colors.success,
                        height: 4,
                        width: `${subjectLockProgressPercent}%`,
                      }}
                    />
                  </View>
                  <FitText style={{ color: "rgba(255,255,255,0.72)", fontSize: 10, marginTop: 4 }}>
                    Gesture hold {subjectLockProgressPercent}%
                  </FitText>
                </>
              ) : null}
              <FitButton
                label="Lock on me"
                variant="ghost"
                disabled={!subjectLockReady}
                onPress={onToggleSubjectLock}
                style={{ marginTop: 8, paddingVertical: 8 }}
                textStyle={{ fontSize: 12 }}
              />
            </View>
          </View>
        ) : null}
        {cameraActive && permissionGranted && !cameraTarget && subjectLocked ? (
          <View
            style={{
              alignItems: "center",
              bottom: 92,
              left: 0,
              position: "absolute",
              right: 0,
              zIndex: 4,
            }}
          >
            <FitButton
              icon={UnlockKeyhole}
              iconSize={14}
              label="Unlock target"
              variant="ghost"
              onPress={onToggleSubjectLock}
              style={{
                backgroundColor: "rgba(0,0,0,0.48)",
                borderColor: "rgba(255,255,255,0.18)",
                borderWidth: 1,
                minWidth: 136,
                paddingHorizontal: 12,
                paddingVertical: 8,
              }}
              textStyle={{ fontSize: 12 }}
            />
          </View>
        ) : null}
        <View style={s.previewOverlayTopCenter}>
          <View style={s.repsPill}>
            <FitText style={s.repsText}>
              {isStaticHoldTarget ? holdProgressSeconds.toFixed(1) : reps}
            </FitText>
            <FitText style={s.repsPillLabel}>
              {isStaticHoldTarget ? " sec" : " reps"}
            </FitText>
          </View>
        </View>
        {cameraActive && permissionGranted ? (
          cameraTarget ? (
            <View style={{ alignSelf: "stretch", flexDirection: "row", gap: 10, marginTop: 12, width: "100%" }}>
              <FitButton icon={hasStartedSet ? (isRecording ? Pause : Play) : Circle} label={hasStartedSet ? (isRecording ? "Pause" : "Resume") : "Start Set"} variant={hasStartedSet ? "ghost" : "primary"} disabled={hasStartedSet ? secondaryActionDisabled : primaryActionDisabled} onPress={hasStartedSet ? (isRecording ? onPause : () => { void onResumeRecord(); }) : () => { void onStartRecord(); }} style={{ flex: 1, minHeight: 48, minWidth: 0, paddingHorizontal: 10 }} textStyle={{ fontSize: 14, fontWeight: "700" }} />
              <FitButton icon={StopCircle} label="Finish Set" variant="danger" disabled={countdownValue !== null || isCameraSwitching} onPress={onStopRecord} style={{ display: hasStartedSet ? "flex" : "none", flex: 1, minHeight: 48, minWidth: 0, paddingHorizontal: 10 }} textStyle={{ fontSize: 14, fontWeight: "700" }} />
            </View>
          ) : (
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
          )
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
