import { useState, useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Circle, Cpu, ListChecks, Pause, Play, StopCircle } from "lucide-react-native";
import { CameraView } from "expo-camera";

import { useAuth } from "@/contexts/AuthContext";
import { AI_TIPS } from "@/data/workout";
import { useTheme } from "@/contexts/ThemeContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { useWorkoutTimer } from "@/hooks/workout/useWorkoutTimer";
import { useCameraCountdown } from "@/hooks/workout/useCameraCountdown";
import { formatTime } from "@fittrack/utils/index";
import { makeScreenStyles, makeWorkoutStyles } from "@/styles/shared/ScreenStyles";

import { FitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import FitCard from "@/components/fit/FitCard";
import FitSection from "@/components/fit/FitSection";
import ConfirmModal from "@/components/modals/shared/ConfirmModal";
import ExerciseModal from "@/components/modals/workout/ExerciseModal";

export default function WorkoutsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeWorkoutStyles(colors), [colors]);

  const [isExerciseModalOpen, setIsExerciseModalOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [finishVisible, setFinishVisible] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const isFrozen = user?.status === "frozen";

  const reps = 0;
  const calories = 0;

  const { secondsRef, start, resume, pause, reset, cleanup: cleanupTimer } = useWorkoutTimer();
  const {
    cameraActive,
    countdownValue,
    permission,
    initCamera,
    cleanupCamera
  } = useCameraCountdown();

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const handleInitCamera = async () => {
    await initCamera(isFrozen);
  };

  const handleStartRecord = () => {
    if (isFrozen) return;
    setIsRecording(true);
    start();
  };

  const handleResumeRecord = () => {
    if (isFrozen) return;
    setIsRecording(true);
    resume();
  };

  const handlePause = () => {
    setIsRecording(false);
    pause();
  };

  const handleStopRecord = () => {
    handlePause();
    setFinishVisible(true);
  };

  const handleFinishConfirm = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    await new Promise((resolve) => setTimeout(resolve, 250));
    setFinishVisible(false);
    cleanupCamera();
    cleanupTimer();
    reset();
    setIsRecording(false);
    setIsFinishing(false);
  };

  const handleFinishCancel = () => {
    if (isFinishing) return;
    setFinishVisible(false);
    handleResumeRecord();
  };

  useEffect(() => {
    return () => {
      cleanupTimer();
      cleanupCamera();
    };
  }, [cleanupTimer, cleanupCamera]);

  return (
    <View style={base.screen}>
      <Animated.ScrollView
        style={[base.content, screenStyle]}
        contentContainerStyle={base.scrollContent}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!cameraActive}
      >
        <Animated.View style={contentStyle}>
          <FitSection heading="Real-time exercise tracking" cardStyle={{ overflow: "visible" }}>
            <View style={s.previewInner}>
              {cameraActive && permission?.granted && (
                <CameraView style={s.cameraView} facing="back" />
              )}
              {countdownValue !== null && (
                <View style={s.countdownOverlay}>
                  <FitText style={s.countdownText}>{countdownValue}</FitText>
                </View>
              )}
              <View style={s.gridOverlay}>
                <View style={[s.gridLine, { width: 1, top: 0, bottom: 0, left: "33.3%" as any }]} />
                <View style={[s.gridLine, { width: 1, top: 0, bottom: 0, left: "66.6%" as any }]} />
                <View style={[s.gridLine, { height: 1, left: 0, right: 0, top: "33.3%" as any }]} />
                <View style={[s.gridLine, { height: 1, left: 0, right: 0, top: "66.6%" as any }]} />
              </View>
              {!cameraActive || !permission?.granted ? (
                <View style={s.initButtonWrap}>
                  <FitButton
                    label="Initialize Camera"
                    icon={Cpu}
                    variant="primary"
                    onPress={handleInitCamera}
                    disabled={isFrozen}
                    style={{ paddingHorizontal: 24 }}
                  />
                </View>
              ) : null}
              <View style={s.previewOverlayTop}>
                <View style={s.timerPill}>
                  <View style={[s.timerDot, { backgroundColor: isRecording ? colors.danger : colors.brand }]} />
                  <FitText style={s.timerText}>{formatTime(secondsRef.current)}</FitText>
                </View>
                <View style={s.kcalPill}>
                  <Cpu size={13} color={colors.brand} strokeWidth={2} />
                  <FitText style={s.kcalText}>{calories} gkcal</FitText>
                </View>
              </View>
              <View style={s.previewOverlayTopCenter}>
                <View style={s.repsPill}>
                  <FitText style={s.repsText}>{reps}</FitText>
                  <FitText style={s.repsPillLabel}> reps</FitText>
                </View>
              </View>
              {cameraActive && permission?.granted && (
                <View style={s.previewControls}>
                  <FitButton
                    icon={isRecording ? StopCircle : Circle}
                    iconOnly
                    iconSize={28}
                    variant={isRecording ? "danger" : "primary"}
                    disabled={countdownValue !== null}
                    onPress={isRecording ? handleStopRecord : handleStartRecord}
                  />
                  <FitButton
                    icon={isRecording ? Pause : Play}
                    iconOnly
                    iconSize={28}
                    variant="ghost"
                    disabled={countdownValue !== null}
                    onPress={isRecording ? handlePause : handleResumeRecord}
                  />
                </View>
              )}
            </View>
          </FitSection>
          <View style={s.lowerContentWrap}>
            <FitText style={s.sectionLabel}>Exercise References</FitText>
            <FitButton
              variant="field"
              label="Exercise References"
              icon={ListChecks}
              showTrailing
              onPress={() => setIsExerciseModalOpen(true)}
              style={s.presetField}
            />
            <FitText style={s.presetHint}>Tap me to read about exercises!</FitText>
            <View style={s.statsRow}>
              <FitCard icon={Cpu} iconSize={18} label="Total Reps" statValue={`${reps}`} />
              <FitCard icon={Cpu} iconSize={18} label="Duration" statValue={formatTime(secondsRef.current)} />
              <FitCard icon={Cpu} iconSize={18} label="Calories" statValue={`${calories}`} />
            </View>
            <View style={s.tipsCard}>
              <View style={s.tipsHeader}>
                <Cpu size={15} color={colors.brand} strokeWidth={2} />
                <FitText style={s.tipsTitle}>AI Tips</FitText>
              </View>
              {AI_TIPS.map((tip) => (
                <View key={tip} style={s.tipRow}>
                  <View style={s.tipBullet} />
                  <FitText style={s.tipText}>{tip}</FitText>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      </Animated.ScrollView>
      <ConfirmModal
        isVisible={finishVisible}
        title="Finish Workout?"
        message="This will end your current session and stop the timer."
        yesLabel="Finish"
        noLabel="Keep Going"
        isDestructive
        isLoading={isFinishing}
        loadingLabel="FINISHING WORKOUT"
        loadingTitle="Closing session"
        onYes={handleFinishConfirm}
        onNo={handleFinishCancel}
      />
      <ExerciseModal
        isVisible={isExerciseModalOpen}
        onClose={() => setIsExerciseModalOpen(false)}
      />
    </View>
  );
}