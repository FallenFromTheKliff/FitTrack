import { useCallback, useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useRouter } from "expo-router";

import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import ExerciseConfirmationModal from "@/components/modals/workout/ExerciseConfirmationModal";
import ExerciseCreationReviewModal from "@/components/modals/workout/ExerciseCreationReviewModal";
import ExerciseModal from "@/components/modals/workout/ExerciseModal";
import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import { WorkoutContextSection } from "@/components/workout/WorkoutContextSection";
import { WorkoutTrackingSection } from "@/components/workout/WorkoutTrackingSection";
import { MobileWorkoutToday } from "@/components/workout/MobileWorkoutToday";
import type { WorkoutCameraTarget } from "@/components/workout/workout-camera-target";
import { useWorkoutLiveController } from "../../hooks/workout/useWorkoutLiveController";

export function WorkoutLiveScreen() {
  const [showCamera, setShowCamera] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<WorkoutCameraTarget | null>(
    null,
  );
  const [cameraCompletion, setCameraCompletion] =
    useState<WorkoutCameraTarget | null>(null);
  const [cameraRestRemaining, setCameraRestRemaining] = useState(0);
  const [autoResumeCamera, setAutoResumeCamera] = useState(false);
  const handleCameraSetCompleted = useCallback((target: WorkoutCameraTarget) => {
    if (target.nextTarget) {
      setCameraCompletion(target);
      setCameraRestRemaining(target.restSeconds);
      setShowCamera(true);
      return;
    }
    setCameraCompletion(null);
    setCameraRestRemaining(0);
    setShowCamera(false);
    setCameraTarget(null);
  }, []);
  const controller = useWorkoutLiveController({
    cameraTarget,
    onCameraSetCompleted: handleCameraSetCompleted,
  });
  const {
    cameraRuntimeState,
    isRecording,
    onResumeRecord,
  } = controller;
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
    const sameExercise = cameraTarget?.exerciseId === nextTarget.exerciseId;
    setCameraTarget(nextTarget);
    setCameraCompletion(null);
    setAutoResumeCamera(sameExercise);
  }, [cameraCompletion, cameraRestRemaining, cameraTarget?.exerciseId]);

  useEffect(() => {
    if (
      !autoResumeCamera ||
      !cameraTarget ||
      cameraRuntimeState !== "ready" ||
      isRecording
    ) {
      return;
    }
    setAutoResumeCamera(false);
    void onResumeRecord();
  }, [
    autoResumeCamera,
    cameraTarget,
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
              {cameraTarget ? (
                <View
                  style={{
                    backgroundColor: controller.colors.surfaceRaised,
                    borderRadius: 8,
                    gap: 4,
                    marginBottom: 10,
                    padding: 12,
                  }}
                >
                  <View
                    style={{
                      alignItems: "center",
                      flexDirection: "row",
                      gap: 12,
                      justifyContent: "space-between",
                    }}
                  >
                    <View style={{ flex: 1, flexShrink: 1, gap: 2, minWidth: 0 }}>
                      <FitText
                        style={{
                          color: controller.colors.brand,
                          fontSize: 9,
                          fontWeight: "900",
                          letterSpacing: 0.8,
                        }}
                      >
                        CAMERA TARGET
                      </FitText>
                      <FitText
                        style={{
                          color: controller.colors.textPrimary,
                          fontSize: 16,
                          fontWeight: "900",
                        }}
                      >
                        {cameraTarget.exerciseName}
                      </FitText>
                      <FitText
                        style={{
                          color: controller.colors.textMuted,
                          fontSize: 11,
                        }}
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
                        controller.onPause();
                        setCameraCompletion(null);
                        setCameraRestRemaining(0);
                        setAutoResumeCamera(false);
                        setShowCamera(false);
                        setCameraTarget(null);
                      }}
                      variant="ghost"
                      accessibilityLabel="Return to manual workout entry"
                      style={{
                        alignSelf: "center",
                        flexGrow: 0,
                        flexShrink: 0,
                        minHeight: 38,
                        minWidth: 96,
                        paddingHorizontal: 10,
                      }}
                      textStyle={{ flexShrink: 0, fontSize: 12, fontWeight: "800" }}
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
            currentKeypoints={controller.currentKeypoints}
            currentLoadLabel={controller.workoutLoadInputSavedLabel}
            currentPhase={controller.currentPhase}
            equipmentDetected={controller.equipmentDetected}
            equipmentDetectionBoxes={controller.equipmentDetectionBoxes}
            equipmentDetectionStatusText={controller.equipmentDetectionStatusText}
            equipmentSnapshotActive={controller.equipmentSnapshotActive}
            holdProgressSeconds={controller.holdProgressSeconds}
            holdValid={controller.holdValid}
            guidanceLabel={controller.trackingOverlayLabel}
            isFrozen={controller.isFrozen}
            isCameraSwitching={controller.isCameraSwitching}
            isRecording={controller.isRecording}
            isTrackingReady={controller.isTrackingReady}
            lowConfidenceLandmarks={controller.lowConfidenceLandmarks}
            movementContract={controller.movementContract}
            onInitCamera={controller.onInitCamera}
            onNativeEquipmentSnapshot={controller.onNativeEquipmentSnapshot}
            onNativePoseFrame={controller.onNativePoseFrame}
            onPause={controller.onPause}
            onResumeRecord={controller.onResumeRecord}
            onStartRecord={controller.onStartRecord}
            onStopRecord={controller.onStopRecord}
            onToggleCameraFacing={controller.onToggleCameraFacing}
            onToggleSubjectLock={controller.onToggleSubjectLock}
            permissionGranted={controller.permissionGranted}
            reps={controller.reps}
            restRemaining={cameraRestRemaining}
            seconds={controller.seconds}
            s={controller.s}
            subjectLockGestureProgress={controller.subjectLockGestureProgress}
            subjectLockReady={controller.subjectLockReady}
            subjectLockStatusText={controller.subjectLockStatusText}
            subjectLocked={controller.subjectLocked}
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
        message="FitTrack will finalize the pose count and save only the current planned set. The workout stays open until every required set is complete."
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
        onCreateFromSession={controller.onOpenExerciseCreationReview}
        createFromSessionDisabled={!controller.exerciseCreationReady}
        onUseAutoDetect={controller.onUseAutoDetection}
      />
      <ExerciseCreationReviewModal
        draft={controller.exerciseCreationDraft}
        isSubmitting={controller.isExerciseCreationSubmitting}
        isVisible={controller.isExerciseCreationReviewOpen}
        onChangeDraft={controller.onUpdateExerciseCreationDraft}
        onClose={controller.onCloseExerciseCreationReview}
        onSubmit={controller.onSubmitExerciseCreationDraft}
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
