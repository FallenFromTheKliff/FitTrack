import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Target, CalendarDays } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useLoadingText } from "@fittrack/hooks";
import { getTodayString } from "@/data/bookings";
import { formatLongDate, nextDate } from "@fittrack/utils";
import { GOAL_TYPES, type GoalType } from "@/data/nutrition";
import { makeGoalsModalStyles } from "@/styles/modals/GoalsStyles";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import CalendarModal from "@/components/modals/shared/CalendarModal";

export type NutritionGoal = {
  id: string;
  name: string;
  type: "bulking" | "cutting" | "maintain";
  weightKg: number;
  currentCalories: number;
  targetCalories: number;
  dueDate: string;
};

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: (goal: NutritionGoal) => void;
};

export default function GoalsModal({ isVisible, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { ic } = useThemeTransitionAnim();
  const s = useMemo(() => makeGoalsModalStyles(colors), [colors]);

  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("bulking");
  const [currentCalories, setCurrentCalories] = useState("");
  const [targetCalories, setTargetCalories] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [currentCalsError, setCurrentCalsError] = useState(false);
  const [calsError, setCalsError] = useState(false);
  const savingText = useLoadingText("Saving", isSubmitting);

  const { opacity, scale } = useOverlayAnim(isVisible, "scale");

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  const reset = () => {
    setName("");
    setGoalType("bulking");
    setCurrentCalories(String(user?.currentCalories ?? ""));
    setTargetCalories("");
    setDueDate("");
    setNameError(false);
    setCurrentCalsError(false);
    setCalsError(false);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const currCals = parseInt(currentCalories, 10);
    const cals = parseInt(targetCalories, 10);
    let hasError = false;
    if (!trimmedName) { setNameError(true); hasError = true; }
    if (!currentCalories || isNaN(currCals) || currCals < 0) { setCurrentCalsError(true); hasError = true; }
    if (!targetCalories || isNaN(cals) || cals <= 0) { setCalsError(true); hasError = true; }
    if (hasError) return;
    setIsSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    onSuccess({
      id: Date.now().toString(),
      name: trimmedName,
      type: goalType,
      weightKg: user?.weightKg ?? 0,
      currentCalories: currCals,
      targetCalories: cals,
      dueDate: dueDate || nextDate(getTodayString())
    });
    reset();
    onClose();
  };

  return (
    <Modal visible={isVisible} transparent animationType="none" statusBarTranslucent onRequestClose={undefined}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View style={[s.card, cardStyle]}>
          <Animated.View style={[s.header, headerBorderStyle]}>
            <View style={s.headerIcon}>
              <Target size={18} color={colors.brand} strokeWidth={2} />
            </View>
            <View style={s.headerText}>
              <FitText style={s.headerTitle}>Create Nutrition Goal</FitText>
              <FitText style={s.headerSubtitle}>Set your calorie target</FitText>
            </View>
          </Animated.View>
          <ScrollView style={s.body} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>GOAL NAME</FitText>
              <View style={[s.inputFieldWrap, nameError && { borderColor: colors.danger }]}>
                <FitTextInput
                  style={s.inputField}
                  placeholder="e.g. Summer Cut"
                  value={name}
                  onChangeText={(v) => { setName(v); if (v.trim()) setNameError(false); }}
                  returnKeyType="done"
                />
              </View>
              {nameError && (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>Name is required</FitText>
              )}
            </View>
            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>GOAL TYPE</FitText>
              <View style={s.goalTypeRow}>
                {GOAL_TYPES.map(({ value, label, Icon }) => {
                  const isActive = goalType === value;
                  return (
                    <Pressable
                      key={value}
                      style={[
                        s.goalTypePill,
                        {
                          borderColor: isActive ? colors.brand : colors.fieldBorder,
                          backgroundColor: isActive ? colors.brand + "18" : colors.fieldBg
                        }
                      ]}
                      onPress={() => setGoalType(value)}
                    >
                      <Icon size={14} color={isActive ? colors.brand : colors.textMuted} strokeWidth={2} />
                      <FitText style={[s.goalTypePillText, { color: isActive ? colors.brand : colors.textMuted }]}>
                        {label}
                      </FitText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>CALORIES</FitText>
              <FitText style={s.fieldNote}>Current - how many kcal you've had today</FitText>
              <View style={[s.inputFieldWrap, currentCalsError && { borderColor: colors.danger }]}>
                <FitTextInput
                  style={s.inputField}
                  placeholder="e.g. 1850"
                  value={currentCalories}
                  onChangeText={(v) => {
                    setCurrentCalories(v.replace(/[^0-9]/g, ""));
                    if (v) setCurrentCalsError(false);
                  }}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
              {currentCalsError && (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>Enter your current calorie intake</FitText>
              )}
              <View style={{ height: 8 }} />
              <FitText style={s.fieldNote}>Target - your daily calorie goal</FitText>
              <View style={[s.inputFieldWrap, calsError && { borderColor: colors.danger }]}>
                <FitTextInput
                  style={s.inputField}
                  placeholder="e.g. 2200"
                  value={targetCalories}
                  onChangeText={(v) => { setTargetCalories(v.replace(/[^0-9]/g, "")); if (v) setCalsError(false); }}
                  keyboardType="numeric"
                  returnKeyType="done"
                />
              </View>
              {calsError && (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>Enter a valid calorie target</FitText>
              )}
            </View>
            <View style={[s.sectionGap, { marginBottom: 20 }]}>
              <FitText style={s.sectionLabel}>DUE DATE</FitText>
              <Pressable
                style={[s.fieldBtn, dueDate ? { borderColor: colors.brand } : { borderColor: colors.fieldBorder }]}
                onPress={() => setIsCalOpen(true)}
              >
                <CalendarDays size={16} color={dueDate ? colors.brand : colors.textMuted} strokeWidth={2} />
                <FitText style={[s.fieldBtnText, dueDate ? { color: colors.brand } : {}]}>
                  {dueDate ? formatLongDate(dueDate) : "Select due date"}
                </FitText>
              </Pressable>
              <FitText style={s.fieldNote}>Optional - defaults to tomorrow if left blank.</FitText>
            </View>
          </ScrollView>
          <Animated.View style={[s.footer, footerBorderStyle]}>
            <FitButton label="Cancel" variant="ghost" onPress={handleClose} flex={1} />
            <FitButton
              label={isSubmitting ? savingText : "Create Goal"}
              variant="primary"
              icon={Target}
              iconSize={16}
              onPress={handleSubmit}
              disabled={isSubmitting}
              loading={isSubmitting}
              flex={2}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <CalendarModal
        isVisible={isCalOpen}
        selectedDate={dueDate}
        minDate={nextDate(getTodayString())}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        onSelect={(date) => { setDueDate(date); setIsCalOpen(false); }}
        onClose={() => setIsCalOpen(false)}
      />
    </Modal>
  );
}
