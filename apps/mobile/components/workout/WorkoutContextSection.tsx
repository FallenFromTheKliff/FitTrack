import { View } from "react-native";
import { Cpu, ListChecks } from "lucide-react-native";

import type { IThemeContext } from "@fittrack/types";
import { formatTime } from "@fittrack/utils";
import FitButton from "@/components/fit/FitButton";
import FitCard from "@/components/fit/FitCard";
import { FitText } from "@/components/fit/FitText";
import { makeWorkoutStyles } from "@/styles/shared/ScreenStyles";

type WorkoutContextSectionProps = {
  calories: number;
  colors: IThemeContext["colors"];
  exerciseFocusText: string;
  exerciseRecommendation: string;
  feedbackItems: string[];
  onOpenExerciseModal: () => void;
  planStatusText: string;
  reps: number;
  s: ReturnType<typeof makeWorkoutStyles>;
  seconds: number;
  sessionStatusText: string;
};

export function WorkoutContextSection({
  calories,
  colors,
  exerciseFocusText,
  exerciseRecommendation,
  feedbackItems,
  onOpenExerciseModal,
  planStatusText,
  reps,
  s,
  seconds,
  sessionStatusText
}: WorkoutContextSectionProps) {
  return (
    <View style={s.lowerContentWrap}>
      <FitText style={s.sectionLabel}>Live Workout Context</FitText>
      <View style={s.tipsCard}>
        <View style={s.tipsHeader}>
          <Cpu size={15} color={colors.brand} strokeWidth={2} />
          <FitText style={s.tipsTitle}>Connected Plan</FitText>
        </View>
        <FitText style={s.tipText}>{planStatusText}</FitText>
        <FitText style={s.tipText}>{exerciseFocusText}</FitText>
        <FitText style={s.tipText}>{sessionStatusText}</FitText>
      </View>
      <FitText style={[s.sectionLabel, s.exerciseReferencesLabel]}>
        Exercise References
      </FitText>
      <FitButton
        variant="field"
        label="Exercise References"
        icon={ListChecks}
        showTrailing
        onPress={onOpenExerciseModal}
        style={s.presetField}
      />
      <FitText style={s.presetHint}>{exerciseRecommendation}</FitText>
      <View style={s.statsRow}>
        <FitCard icon={Cpu} iconSize={18} label="Total Reps" statValue={`${reps}`} />
        <FitCard icon={Cpu} iconSize={18} label="Duration" statValue={formatTime(seconds)} />
        <FitCard icon={Cpu} iconSize={18} label="Calories" statValue={`${calories}`} />
      </View>
      <View style={s.tipsCard}>
        <View style={s.tipsHeader}>
          <Cpu size={15} color={colors.brand} strokeWidth={2} />
          <FitText style={s.tipsTitle}>Live Pose Feedback</FitText>
        </View>
        {feedbackItems.map((tip) => (
          <View key={tip} style={s.tipRow}>
            <View style={s.tipBullet} />
            <FitText style={s.tipText}>{tip}</FitText>
          </View>
        ))}
      </View>
    </View>
  );
}
