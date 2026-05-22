import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import ExerciseConfirmationModal from "@/components/modals/workout/ExerciseConfirmationModal";
import ExerciseCreationReviewModal from "@/components/modals/workout/ExerciseCreationReviewModal";
import ExerciseModal from "@/components/modals/workout/ExerciseModal";
import { FitText } from "@/components/fit/FitText";
import { WorkoutContextSection } from "@/components/workout/WorkoutContextSection";
import { WorkoutTrackingSection } from "@/components/workout/WorkoutTrackingSection";
import { useWorkoutLiveController } from "../../hooks/workout/useWorkoutLiveController";

export function WorkoutLiveScreen() {
  const controller = useWorkoutLiveController();
  const screenStyle = useAnimatedStyle(() => ({ opacity: controller.opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: controller.translateY.value }]
  }));

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
          <WorkoutTrackingSection
            cameraActive={controller.cameraActive}
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
            seconds={controller.seconds}
            s={controller.s}
            subjectLockGestureProgress={controller.subjectLockGestureProgress}
            subjectLockReady={controller.subjectLockReady}
            subjectLockStatusText={controller.subjectLockStatusText}
            subjectLocked={controller.subjectLocked}
            trackingDisabledReason={controller.trackingDisabledReason}
          />
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
        </Animated.View>
      </Animated.ScrollView>
      <ConfirmModal
        isVisible={controller.finishVisible}
        title="Finish Workout?"
        message="This will end your current session, finalize pose tracking, and save one live workout set."
        yesLabel="Finish"
        noLabel="Keep Going"
        isDestructive
        isLoading={controller.isFinishing}
        loadingLabel="FINISHING WORKOUT"
        loadingTitle="Closing session"
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
