import { useState, useEffect, useCallback, useMemo } from "react";
import { View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Flame, UtensilsCrossed, Bot, Target } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFitness } from "@/contexts/FitnessContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeNutritionStyles } from "@/styles/shared/ScreenStyles";
import type { NutritionGoal } from "@/components/modals/nutrition/GoalsModal";

import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import FitCard from "@/components/fit/FitCard";
import { FitText } from "@/components/fit/FitText";
import GoalsModal from "@/components/modals/nutrition/GoalsModal";

export default function NutritionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { activeGoal, setActiveGoal } = useFitness();
  const {
    registerFAB,
    unregisterFAB,
    fireOpenGoals,
    openGoalsSignal,
    resetSignal
  } = useFABState();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeNutritionStyles(colors), [colors]);
  const isFrozen = user?.status === "frozen";

  const [isGoalsVisible, setGoalsVisible] = useState(false);

  const today = activeGoal?.currentCalories ?? user?.currentCalories ?? 0;
  const target = activeGoal?.targetCalories ?? 0;
  const remaining = Math.max(target - today, 0);
  const hasGoal = !!activeGoal && target > 0;

  const handleGoalCreated = useCallback((goal: NutritionGoal) => {
    void setActiveGoal(goal);
  }, [setActiveGoal]);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => { scrollY.value = e.contentOffset.y; }
  });

  const menuItems: FABMenuItem[] = useMemo(() => {
    if (isFrozen) return [];
    return [
      {
        label: "Chat with BrodigyAI",
        icon: Bot,
        iconColor: colors.brand,
        iconBg: colors.brand + "18",
        onPress: () => {
          router.push({
            pathname: "/(tabs)/chatbot",
            params: { sessionId: "new", from: "nutrition" }
          });
        }
      },
      {
        label: "Create Nutrition Goal",
        icon: Target,
        iconColor: colors.brand,
        iconBg: colors.brand + "18",
        onPress: fireOpenGoals
      }
    ];
  }, [colors.brand, fireOpenGoals, isFrozen, router]);

  useEffect(() => {
    if (openGoalsSignal && !isFrozen) {
      setGoalsVisible(true);
      resetSignal();
    } else if (openGoalsSignal && isFrozen) {
      resetSignal();
    }
  }, [openGoalsSignal, resetSignal, isFrozen]);

  useFocusEffect(useCallback(() => {
    registerFAB({
      screenIcon: UtensilsCrossed,
      menuItems,
      scrollY,
      visible: !isFrozen
    });
    return () => unregisterFAB();
  }, [menuItems, registerFAB, scrollY, unregisterFAB, isFrozen]));

  const screenStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
      <Animated.View style={base.screen}>
        <Animated.ScrollView
            style={[base.content, screenStyle]}
            contentContainerStyle={base.scrollContent}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
        >
          <Animated.View style={contentStyle}>
            <View style={hasGoal ? s.caloriesCardActive : s.caloriesCard}>
              {activeGoal && (
                  <FitText style={s.caloriesGoalName}>{activeGoal.name.toUpperCase()}</FitText>
              )}
              <FitText style={hasGoal ? s.caloriesLabelActive : s.caloriesLabel}>TODAY'S CALORIES</FitText>
              <FitText style={hasGoal ? s.caloriesValueActive : s.caloriesValue}>{today}</FitText>
              <FitText style={hasGoal ? s.caloriesTargetActive : s.caloriesTarget}>
                {target > 0 ? `/ ${target} kcal` : "No goal set"}
              </FitText>
              <View style={hasGoal ? s.caloriesFlameCircleActive : s.caloriesFlameCircle}>
                <Flame size={16} color={hasGoal ? colors.onBrand : colors.brand} strokeWidth={2} />
              </View>
              {target > 0 && (
                  <>
                    <View style={hasGoal ? s.caloriesBarActive : s.caloriesBar}>
                      <View
                          style={[
                            hasGoal ? s.caloriesBarFillActive : s.caloriesBarFill,
                            { width: `${Math.min(1, today / target) * 100}%` }
                          ]}
                      />
                    </View>
                    <FitText style={hasGoal ? s.caloriesRemainingActive : s.caloriesRemaining}>
                      {remaining} kcal remaining
                    </FitText>
                  </>
              )}
            </View>
            <FitSection heading="Macro Breakdown">
              <View style={s.macroBlock}>
                <View style={s.macroRow}>
                  <View style={[s.macroDot, { backgroundColor: colors.brand }]} />
                  <FitText style={s.macroName}>Protein</FitText>
                  <FitText style={s.macroValue}>120g / 160g</FitText>
                </View>
                <View style={s.macroTrack}>
                  <View style={[s.macroFill, { width: `${(120 / 160) * 100}%`, backgroundColor: colors.brand }]} />
                </View>
                <FitText style={s.macroRemaining}>40g remaining</FitText>
                <View style={s.macroRow}>
                  <View style={[s.macroDot, { backgroundColor: colors.textSecondary }]} />
                  <FitText style={s.macroName}>Carbs</FitText>
                  <FitText style={s.macroValue}>180g / 250g</FitText>
                </View>
                <View style={s.macroTrack}>
                  <View style={[s.macroFill, { width: `${(180 / 250) * 100}%`, backgroundColor: colors.textSecondary }]} />
                </View>
                <FitText style={s.macroRemaining}>70g remaining</FitText>
                <View style={s.macroRow}>
                  <View style={[s.macroDot, { backgroundColor: colors.success }]} />
                  <FitText style={s.macroName}>Fats</FitText>
                  <FitText style={s.macroValue}>45g / 60g</FitText>
                </View>
                <View style={s.macroTrack}>
                  <View style={[s.macroFill, { width: `${(45 / 60) * 100}%`, backgroundColor: colors.success }]} />
                </View>
                <FitText style={s.macroRemaining}>15g remaining</FitText>
              </View>
            </FitSection>
            <View style={s.contentCard}>
              <FitText style={s.matchBadge}>PERFECT MATCH</FitText>
              <FitText style={s.matchTitle}>SertFit Meal Prep Plans</FitText>
              <FitText style={s.matchSubtitle}>
                Custom meals matching your {activeGoal?.type ?? "nutrition"} goals
              </FitText>
              <View style={s.cardList}>
                <FitCard label="Power Fuel Bowl" subtitle="₱86/serving · P:45g C:52g F:12g" hasBorder />
                <FitCard label="Muscle Builder Plate" subtitle="₱94/serving · P:52g C:78g F:18g" hasBorder />
              </View>
              <FitButton label="View Meal Plans" variant="primary" onPress={() => {}} />
            </View>
            <View style={s.contentCard}>
              <FitText style={s.matchBadge}>RECOMMENDED FOR YOU</FitText>
              <FitText style={s.matchTitle}>Supplements</FitText>
              <FitText style={s.matchSubtitle}>Personalized picks based on your macros</FitText>
              <View style={s.cardList}>
                <FitCard
                    label="SertFit Pro Whey"
                    subtitle="25g per serving"
                    trailingLabel="Best Seller"
                    trailingLabelColor={colors.brand}
                    hasBorder
                />
                <FitCard
                    label="SertFit Energy Bars"
                    subtitle="10g per bar"
                    trailingLabel="Available"
                    trailingLabelColor={colors.success}
                    hasBorder
                />
                <FitCard
                    label="SertFit BCAA Recovery"
                    subtitle="10g per serving"
                    trailingLabel="New"
                    trailingLabelColor={colors.warning}
                    hasBorder
                />
              </View>
              <FitButton label="Shop Supplements" variant="primary" onPress={() => {}} />
            </View>
            <FitText style={s.disclaimer}>
              Personalized recommendations based on current macro intake.
            </FitText>
          </Animated.View>
        </Animated.ScrollView>
        <GoalsModal
            isVisible={isGoalsVisible}
            onClose={() => setGoalsVisible(false)}
            onSuccess={handleGoalCreated}
        />
      </Animated.View>
  );
}