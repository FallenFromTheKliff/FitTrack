import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useRouter } from "expo-router";

import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import ExerciseConfirmationModal from "@/components/modals/workout/ExerciseConfirmationModal";
import ExerciseModal from "@/components/modals/workout/ExerciseModal";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import { WorkoutContextSection } from "@/components/workout/WorkoutContextSection";
import { WorkoutTrackingSection } from "@/components/workout/WorkoutTrackingSection";
import { MobileWorkoutToday } from "@/components/workout/MobileWorkoutToday";
import {
  shouldAutoResumeWorkoutCamera,
  type WorkoutCameraTarget,
} from "@/components/workout/workout-camera-target";
import { useWorkoutLiveController } from "../../hooks/workout/useWorkoutLiveController";

export function WorkoutLiveScreen() {
  const [showCamera, setShowCamera] = useState(false);
  const [requestedCameraTarget, setCameraTarget] = useState<WorkoutCameraTarget | null>(
    null,
  );
  const [cameraCompletion, setCameraCompletion] =
    useState<WorkoutCameraTarget | null>(null);
  const [cameraRestRemaining, setCameraRestRemaining] = useState(0);
  const [autoResumeCamera, setAutoResumeCamera] = useState(false);
  const handleCameraSetCompleted = useCallback((target: WorkoutCameraTarget) => {
    setCameraCompletion(target);
    if (target.nextTarget) {
      setCameraRestRemaining(target.restSeconds);
      setShowCamera(true);
      return;
    }
    setCameraRestRemaining(0);
    setShowCamera(false);
    setCameraTarget(null);
  }, []);
  const controller = useWorkoutLiveController({
    cameraTarget: requestedCameraTarget,
    onCameraSetCompleted: handleCameraSetCompleted,
  });
  const {
    cameraTarget,
    cameraRuntimeState,
    isRecording,
    onPause,
    onResumeRecord,
  } = controller;
  const targetReps = cameraTarget?.targetReps ?? 0;
  const repsOver = Math.max(0, controller.reps - targetReps);
  const repsBelowGoal = Math.max(0, targetReps - controller.reps);
  const finishGoalSummary =
    controller.reps > targetReps
      ? `+${repsOver} above goal`
      : controller.reps === targetReps
        ? "Goal reached"
        : `${repsBelowGoal} below goal`;
  const finishSetMessage =
    cameraTarget && targetReps > 0
      ? `Detected ${controller.reps} reps\nTarget ${targetReps} reps\n${finishGoalSummary}\n\nFitTrack will finalize the pose count and save only the current planned set. The workout stays open until every required set is complete.`
      : "FitTrack will finalize the pose count and save only the current planned set. The workout stays open until every required set is complete.";
  const router = useRouter();
  const screenStyle = useAnimatedStyle(() => ({ opacity: controller.opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: controller.translateY.value }]
  }));

  useEffect(() => {
    if (cameraRestRemaining <= 0) return;
    const timer = setInterval(
      () => setCameraRestRemaining((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [cameraRestRemaining]);

  useEffect(() => {
    const nextTarget = cameraCompletion?.nextTarget;
    if (!nextTarget || cameraRestRemaining > 0) return;
    const sameExercise = shouldAutoResumeWorkoutCamera(cameraTarget, nextTarget);
    if (!sameExercise && cameraRuntimeState === "rest") {
      onPause();
    }
    setCameraTarget(nextTarget);
    setCameraCompletion(null);
    setAutoResumeCamera(sameExercise);
  }, [cameraCompletion, cameraRestRemaining, cameraRuntimeState, cameraTarget?.exerciseId, onPause]);

  useEffect(() => {
    if (
      !autoResumeCamera ||
      !cameraTarget ||
      (cameraRuntimeState !== "ready" &&
        !(cameraRuntimeState === "rest" && cameraRestRemaining <= 0)) ||
      isRecording
    ) {
      return;
    }
    setAutoResumeCamera(false);
    void onResumeRecord();
  }, [
    autoResumeCamera,
    cameraTarget,
    cameraRestRemaining,
    cameraRuntimeState,
    isRecording,
    onResumeRecord,
  ]);

  return (
    <View style={controller.base.screen}>
      <Animated.ScrollView
        style={[controller.base.content, screenStyle]}
        contentContainerStyle={controller.base.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled
        nestedScrollEnabled
      >
        <Animated.View style={contentStyle}>
          {controller.message ? (
            <View style={{ marginBottom: 10 }}>
              <FitText style={{ fontSize: 13, color: controller.colors.success, textAlign: "right" }}>
                {controller.message}
              </FitText>
            </View>
          ) : null}
          {!showCamera ? (
            <MobileWorkoutToday
              cameraCompletion={cameraCompletion}
              onManagePlans={() => router.push("/workout-plans")}
              onShowCamera={(target) => {
                setCameraCompletion(null);
                setCameraRestRemaining(0);
                setAutoResumeCamera(false);
                setCameraTarget(target);
                setShowCamera(true);
              }}
            />
          ) : (
            <>
              <View style={controller.s.liveHeader}>
                <View style={controller.s.liveHeaderCopy}>
                  <FitText style={controller.s.liveHeaderTitle}>
                    Live Tracking
                  </FitText>
                  <View style={controller.s.liveHeaderStatus}>
                    <View
                      style={[
                        controller.s.liveHeaderDot,
                        {
                          backgroundColor: controller.isRecording
                            ? controller.colors.brand
                            : controller.colors.success,
                        },
                      ]}
                    />
                    <FitText
                      style={[
                        controller.s.liveHeaderStatusText,
                        {
                          color: controller.isRecording
                            ? controller.colors.brand
                            : controller.colors.success,
                        },
                      ]}
                    >
                      {controller.isRecording ? "RECORDING" : "READY"}
                    </FitText>
                  </View>
                </View>
                <FitText style={controller.s.liveHeaderProgress}>
                  {cameraTarget
                    ? `SET ${cameraTarget.setNumber}/${cameraTarget.totalSets}`
                    : "LIVE"}
                </FitText>
              </View>
              {cameraTarget ? (
                <View
                  style={controller.s.cameraTargetCard}
                >
                  <View style={controller.s.cameraTargetRow}>
                    <View style={controller.s.cameraTargetCopy}>
                      <FitText
                        style={controller.s.cameraTargetEyebrow}
                      >
                        CAMERA TARGET
                      </FitText>
                      <FitText
                        style={controller.s.cameraTargetTitle}
                      >
                        {cameraTarget.exerciseName}
                      </FitText>
                      <FitText
                        style={controller.s.cameraTargetMeta}
                      >
                        Set {cameraTarget.setNumber} of {cameraTarget.totalSets} ·{" "}
                        {cameraTarget.targetDurationSeconds != null && cameraTarget.targetReps <= 0
                          ? `${cameraTarget.targetDurationSeconds}s hold`
                          : `${cameraTarget.targetReps} reps`}
                        {cameraTarget.targetWeightKg != null
                          ? ` · ${cameraTarget.targetWeightKg} kg`
                          : ""}
                      </FitText>
                    </View>
                    <FitButton
                      label="Manual"
                      onPress={() => {
                        controller.onExitCamera();
                        setCameraCompletion(null);
                        setCameraRestRemaining(0);
                        setAutoResumeCamera(false);
                        setShowCamera(false);
                        setCameraTarget(null);
                      }}
                      variant="ghost"
                      accessibilityLabel="Return to manual workout entry"
                      style={controller.s.cameraTargetManual}
                      textStyle={controller.s.cameraTargetManualText}
                    />
                  </View>
                </View>
              ) : null}
              <WorkoutTrackingSection
                cameraRuntimeState={controller.cameraRuntimeState}
                cameraTarget={cameraTarget}
                cameraActive={controller.cameraActive}
                cameraFrameSize={controller.cameraFrameSize}
                cameraFacing={controller.cameraFacing}
                cameraRemountKey={controller.cameraRemountKey}
                cameraRef={controller.cameraRef}
                calories={controller.calories}
                colors={controller.colors}
                countdownValue={controller.countdownValue}
                currentAngle={controller.currentAngle}
                repPathUnblocked={controller.repPathUnblocked}
                currentKeypoints={controller.currentKeypoints}
                currentLoadLabel={controller.workoutLoadInputSavedLabel}
                currentPhase={controller.currentPhase}
                nativeStreamGeneration={controller.nativeStreamGeneration}
                holdProgressSeconds={controller.holdProgressSeconds}
                holdValid={controller.holdValid}
                guidanceLabel={controller.trackingOverlayLabel}
                isFrozen={controller.isFrozen}
                isCameraSwitching={controller.isCameraSwitching}
                hasStartedSet={controller.hasStartedSet}
                isRecording={controller.isRecording}
                isTrackingReady={controller.isTrackingReady}
                subjectTrackingAvailable={controller.subjectTrackingAvailable}
                subjectTrackingError={controller.subjectTrackingError}
                subjectTrackingEnabled={controller.subjectTrackingEnabled}
                subjectTrackingStatus={controller.subjectTrackingStatus}
                lowConfidenceLandmarks={controller.lowConfidenceLandmarks}
                movementContract={controller.movementContract}
                poseStatusText={controller.poseStatusText}
                onInitCamera={controller.onInitCamera}
                onCameraContinuityChange={controller.onCameraContinuityChange}
                onMultiPoseAvailabilityChange={controller.onMultiPoseAvailabilityChange}
                onMultiPoseStatusChange={controller.onMultiPoseStatusChange}
                onNativePoseFrame={controller.onNativePoseFrame}
                onToggleSubjectTracking={controller.onToggleSubjectTracking}
                onPause={controller.onPause}
                onResumeRecord={controller.onResumeRecord}
                onStartRecord={controller.onStartRecord}
                onStopRecord={controller.onStopRecord}
                onToggleCameraFacing={controller.onToggleCameraFacing}
                permissionGranted={controller.permissionGranted}
                reps={controller.reps}
                seconds={controller.seconds}
                s={controller.s}
                trackingDisabledReason={controller.trackingDisabledReason}
              />
              {cameraTarget ? null : (
                <WorkoutContextSection
                  calories={controller.calories}
                  colors={controller.colors}
                  exerciseFocusText={controller.exerciseFocusText}
                  exerciseRecommendation={controller.exerciseRecommendation}
                  feedbackItems={controller.feedbackItems}
                  onOpenExerciseModal={controller.onOpenExerciseModal}
                  planStatusText={controller.planStatusText}
                  reps={controller.reps}
                  s={controller.s}
                  seconds={controller.seconds}
                  sessionStatusText={controller.sessionStatusText}
                />
              )}
            </>
          )}
        </Animated.View>
      </Animated.ScrollView>
      <ConfirmModal
        isVisible={controller.finishVisible}
        title="Save This Set?"
        message={finishSetMessage}
        yesLabel="Save Set"
        noLabel="Keep Going"
        isLoading={controller.isFinishing}
        loadingLabel="SAVING SET"
        loadingTitle="Finalizing pose count"
        onYes={controller.onFinishConfirm}
        onNo={controller.onFinishCancel}
      />
      <ExerciseModal
        currentSelectionLabel={controller.selectedTrackingExerciseLabel}
        emptyMessage={controller.exerciseModalEmptyMessage}
        isVisible={controller.isExerciseModalOpen}
        isLoading={controller.exercisesLoading}
        loadInputError={controller.workoutLoadInputError}
        loadInputSavedLabel={controller.workoutLoadInputSavedLabel}
        loadInputUnit={controller.workoutLoadInputUnit}
        loadInputValue={controller.workoutLoadInputValue}
        loadInputVisible={controller.workoutLoadInputVisible}
        loadSliderMax={controller.workoutLoadSliderMax}
        loadSliderMin={controller.workoutLoadSliderMin}
        loadSliderValue={controller.workoutLoadSliderValue}
        onApplyLoadInput={controller.onApplyWorkoutLoadInput}
        onChangeLoadInputUnit={controller.onChangeWorkoutLoadInputUnit}
        onChangeLoadInputValue={controller.onChangeWorkoutLoadInputValue}
        onChangeLoadSliderValue={controller.onChangeWorkoutLoadSliderValue}
        onClearLoadInput={controller.onClearWorkoutLoadInput}
        onSelectReference={controller.onSelectExerciseReference}
        references={controller.exerciseReferences}
        onClose={controller.onCloseExerciseModal}
        onUseAutoDetect={controller.onUseAutoDetection}
      />
      <ExerciseConfirmationModal
        candidateExercises={controller.exerciseConfirmationCandidates}
        currentPlanLabel={controller.currentPlanExerciseLabel}
        customLabel={controller.customExerciseLabel}
        isVisible={controller.isExerciseConfirmationVisible}
        savedExercises={controller.savedExerciseOptions}
        onChangeCustomLabel={controller.onChangeCustomExerciseLabel}
        onClose={controller.onCloseExerciseConfirmation}
        onConfirm={controller.onConfirmExerciseLabel}
      />
    </View>
  );
}
