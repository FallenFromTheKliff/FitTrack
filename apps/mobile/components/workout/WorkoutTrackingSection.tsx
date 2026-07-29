import type { RefObject } from "react";
import { Linking, Platform, View } from "react-native";
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
import { formatTime } from "@fittrack/utils";
import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import { FitText } from "@/components/fit/FitText";
import { NativeVisionPoseCamera } from "@/components/workout/NativeVisionPoseCamera";
import type {
  NativeEquipmentSnapshot,
  NativePoseFrame,
} from "@/components/workout/NativeVisionPoseCamera.types";
import { PoseGuidanceOverlay } from "@/components/workout/PoseGuidanceOverlay";
import { makeWorkoutStyles } from "@/styles/shared/ScreenStyles";

type WorkoutTrackingSectionProps = {
  cameraActive: boolean;
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
  equipmentDetected: boolean;
  equipmentDetectionBoxes: PoseEquipmentDetectionBoxRecord[];
  equipmentDetectionStatusText: string | null;
  equipmentSnapshotActive: boolean;
  guidanceLabel: string | null;
  isFrozen: boolean;
  isCameraSwitching: boolean;
  isRecording: boolean;
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
  seconds: number;
  s: ReturnType<typeof makeWorkoutStyles>;
  subjectLockGestureProgress: number;
  subjectLockReady: boolean;
  subjectLockStatusText: string;
  subjectLocked: boolean;
  trackingDisabledReason: string | null;
};

export function WorkoutTrackingSection({
  cameraActive,
  cameraRef,
  calories,
  cameraFacing,
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
  guidanceLabel,
  isFrozen,
  isCameraSwitching,
  isRecording,
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
  seconds,
  s,
  subjectLockGestureProgress,
  subjectLockReady,
  subjectLockStatusText,
  subjectLocked,
  trackingDisabledReason
}: WorkoutTrackingSectionProps) {
  const primaryActionDisabled = isRecording
    ? countdownValue !== null || isCameraSwitching
    : countdownValue !== null || isCameraSwitching || !isTrackingReady;
  const secondaryActionDisabled = isRecording
    ? countdownValue !== null || isCameraSwitching
    : countdownValue !== null || isCameraSwitching || !isTrackingReady;
  const cameraFacingLabel = cameraFacing === "front" ? "Front" : "Back";
  const cameraToggleDisabled = isRecording || countdownValue !== null || isCameraSwitching;
  const isNativePoseRuntime = Platform.OS !== "web";
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

  return (
    <FitSection heading="Real-time exercise tracking" cardStyle={{ overflow: "visible" }}>
      <View style={s.previewInner}>
        {cameraActive && permissionGranted ? (
          <>
            {isNativePoseRuntime ? (
              <NativeVisionPoseCamera
                key={`native-${cameraFacing}-${cameraRemountKey}`}
                cameraFacing={cameraFacing}
                equipmentSnapshotActive={isRecording && equipmentSnapshotActive}
                isActive={!isCameraSwitching}
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
              keypoints={currentKeypoints}
              lowConfidenceLandmarks={lowConfidenceLandmarks}
              movementContract={movementContract}
            />
            {equipmentDetectionStatusText ? (
              <>
                {visibleEquipmentBoxes.length > 0 ? (
                  visibleEquipmentBoxes.map((box, index) => (
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
                style={{ marginTop: 8 }}
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
        {cameraActive && permissionGranted && !subjectLocked ? (
          <View
            style={{
              alignItems: "center",
              backgroundColor: "rgba(0,0,0,0.62)",
              borderColor: "rgba(255,255,255,0.24)",
              borderRadius: R.md,
              borderWidth: 1,
              flexDirection: "row",
              gap: 6,
              left: 14,
              paddingHorizontal: 11,
              paddingVertical: 7,
              position: "absolute",
              top: 56,
              zIndex: 5,
            }}
            >
              <SubjectLockIcon size={13} color="#FFFFFF" strokeWidth={2.4} />
              <FitText style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800", letterSpacing: 0.4 }}>
                NOT LOCKED
              </FitText>
            </View>
        ) : null}
        {cameraActive && permissionGranted && !subjectLocked ? (
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
        {cameraActive && permissionGranted && subjectLocked ? (
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
            <FitText style={s.repsText}>{reps}</FitText>
            <FitText style={s.repsPillLabel}> reps</FitText>
          </View>
        </View>
        {cameraActive && permissionGranted ? (
          <View style={s.previewControls}>
            <FitButton
              icon={isRecording ? StopCircle : Circle}
              iconOnly
              iconSize={22}
              variant={isRecording ? "danger" : "primary"}
              disabled={primaryActionDisabled}
              onPress={isRecording ? onStopRecord : () => { void onStartRecord(); }}
              style={s.previewControlButton}
            />
            <FitButton
              icon={isRecording ? Pause : Play}
              iconOnly
              iconSize={22}
              variant="ghost"
              disabled={secondaryActionDisabled}
              onPress={isRecording ? onPause : () => { void onResumeRecord(); }}
              style={s.previewControlButton}
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
