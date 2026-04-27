import { useState, useEffect, useCallback, useMemo } from "react";
import { View } from "react-native";
import Animated, { FadeInDown, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Bot, Flame, Plus, Target, UtensilsCrossed } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";

import type {
  ActiveNutritionProfileRecord,
  NutritionCoachingInsightRecord,
  DailyNutritionSummaryRecord,
  NutritionLogRecord,
  NutritionMacroTotalsRecord
} from "@fittrack/types";
import {
  nutritionActiveTdeeQueryOptions,
  nutritionDailySummaryQueryOptions,
  nutritionLogsQueryOptions
} from "@fittrack/query";
import {
  CURATED_FOOD_CATALOG,
  getNutritionGuidanceAlerts,
  getRecommendedFoodCatalogItems,
  type NutritionFoodCatalogItem,
  type NutritionGuidanceAlertTone
} from "@/data/nutrition";
import { getTodayString } from "@/data/bookings";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import PremiumFeatureGate from "@/components/membership/PremiumFeatureGate";
import { usePremiumFitnessAccess } from "@/hooks/membership/usePremiumFitnessAccess";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeNutritionStyles } from "@/styles/shared/ScreenStyles";
import { mobileApiClient } from "@/lib/api-client";

import FitButton from "@/components/fit/FitButton";
import FitSection from "@/components/fit/FitSection";
import FitCard from "@/components/fit/FitCard";
import { FitText } from "@/components/fit/FitText";
import { GoalsModal, NutritionLogModal } from "@/components/modals";

type ThemeColors = ReturnType<typeof useTheme>["colors"];
type NutritionStyles = ReturnType<typeof makeNutritionStyles>;

function formatGoalLabel(value?: string | null) {
  if (!value) return "No active target";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatMacroRows(
  logged: NutritionMacroTotalsRecord,
  target: NutritionMacroTotalsRecord | null
) {
  return [
    {
      key: "protein",
      label: "Protein",
      color: "brand",
      value: logged.proteinG,
      target: target?.proteinG ?? 0
    },
    {
      key: "carbs",
      label: "Carbs",
      color: "textSecondary",
      value: logged.carbsG,
      target: target?.carbsG ?? 0
    },
    {
      key: "fat",
      label: "Fats",
      color: "success",
      value: logged.fatG,
      target: target?.fatG ?? 0
    }
  ];
}

function formatMacroDelta(delta: number) {
  return delta >= 0 ? `${delta.toFixed(0)}g remaining` : `${Math.abs(delta).toFixed(0)}g over target`;
}

function formatNutritionLogSubtitle(entry: NutritionLogRecord) {
  return `${entry.calories.toFixed(0)} kcal | P ${entry.proteinG.toFixed(0)} C ${entry.carbsG.toFixed(0)} F ${entry.fatG.toFixed(0)}`;
}

function getAlertToneStyle(tone: NutritionGuidanceAlertTone, styles: NutritionStyles) {
  switch (tone) {
    case "success":
      return styles.signalCardSuccess;
    case "warning":
      return styles.signalCardWarning;
    default:
      return styles.signalCardBrand;
  }
}

function getAlertToneColor(tone: NutritionGuidanceAlertTone, colors: ThemeColors) {
  switch (tone) {
    case "success":
      return colors.success;
    case "warning":
      return colors.warning;
    default:
      return colors.brand;
  }
}

function mapCoachingInsightToAlert(insight: NutritionCoachingInsightRecord) {
  const tone: NutritionGuidanceAlertTone =
    insight.priority === "warning"
      ? "warning"
      : insight.priority === "recovery"
        ? "success"
        : "brand";

  return {
    id: insight.id,
    tone,
    eyebrow: insight.source === "progression_summary" ? "PROGRESSION-AWARE" : "LIVE SUMMARY",
    title: insight.title,
    message: insight.message
  };
}

function getFoodTrailingLabel(item: NutritionFoodCatalogItem) {
  switch (item.focus[0]) {
    case "protein":
      return "PROTEIN";
    case "carbs":
      return "CARB REFILL";
    case "fat":
      return "FAT SUPPORT";
    default:
      return "BALANCED";
  }
}

function getFoodTrailingColor(item: NutritionFoodCatalogItem, colors: ThemeColors) {
  switch (item.focus[0]) {
    case "protein":
      return colors.brand;
    case "carbs":
      return colors.textSecondary;
    case "fat":
      return colors.warning;
    default:
      return colors.success;
  }
}

function formatFoodSubtitle(item: NutritionFoodCatalogItem) {
  return `${item.serving} | ${item.calories.toFixed(0)} kcal | P ${item.proteinG.toFixed(0)} C ${item.carbsG.toFixed(0)} F ${item.fatG.toFixed(0)} | ${item.highlight}`;
}

export default function NutritionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const {
    isMember,
    isPlanAccessLoading,
    isPremiumLocked,
    membershipAccessSummary,
    subscriptionStatusLabel
  } = usePremiumFitnessAccess();
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
  const membershipCardStatus = user?.membershipCard?.status ?? "none";
  const hasMemberCardAccess = user?.membershipAccess === "member";
  const canUsePremiumNutrition = !isMember || (!isPlanAccessLoading && !isPremiumLocked);
  const todayString = getTodayString();

  const [isGoalsVisible, setGoalsVisible] = useState(false);
  const [isLogVisible, setLogVisible] = useState(false);

  const { data: activeNutrition = null, isLoading: isNutritionLoading } = useQuery({
    ...nutritionActiveTdeeQueryOptions<ActiveNutritionProfileRecord | null>(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id
  });
  const { data: dailySummary = null } = useQuery({
    ...nutritionDailySummaryQueryOptions<DailyNutritionSummaryRecord>(mobileApiClient, user?.id, todayString),
    enabled: isFocused && !!user?.id
  });
  const { data: nutritionLogs = { data: [], meta: { page: 1, limit: 20, total: 0, total_pages: 0 } } } = useQuery({
    ...nutritionLogsQueryOptions<NutritionLogRecord>(mobileApiClient, user?.id, {
      startDate: todayString,
      endDate: todayString,
      page: 1,
      limit: 20
    }),
    enabled: isFocused && !!user?.id && canUsePremiumNutrition
  });

  const loggedTotals = dailySummary?.logged ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  const targetTotals = dailySummary?.target ?? (
    activeNutrition
      ? {
          calories: activeNutrition.macros.targetCalories,
          proteinG: activeNutrition.macros.proteinG,
          carbsG: activeNutrition.macros.carbsG,
          fatG: activeNutrition.macros.fatG
        }
      : null
  );

  const today = loggedTotals.calories;
  const target = targetTotals?.calories ?? 0;
  const calorieDelta = target - today;
  const hasGoal = !!activeNutrition?.macros;
  const goalLabel = formatGoalLabel(activeNutrition?.tdee.fitnessGoal);
  const macroRows = formatMacroRows(loggedTotals, targetTotals);
  const guidanceAlerts = useMemo(
    () =>
      dailySummary?.coaching?.length
        ? dailySummary.coaching.map(mapCoachingInsightToAlert)
        : getNutritionGuidanceAlerts(loggedTotals, targetTotals),
    [dailySummary?.coaching, loggedTotals, targetTotals]
  );
  const recommendedFoods = useMemo(
    () => getRecommendedFoodCatalogItems(loggedTotals, targetTotals, 3),
    [loggedTotals, targetTotals]
  );
  const catalogShelf = useMemo(() => CURATED_FOOD_CATALOG.slice(0, 6), []);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  const menuItems: FABMenuItem[] = useMemo(() => {
    if (isFrozen) return [];
    const targetAction: FABMenuItem = {
      label: hasGoal ? "Recalculate Nutrition Target" : "Create Nutrition Goal",
      icon: Target,
      iconColor: colors.brand,
      iconBg: colors.brand + "18",
      onPress: fireOpenGoals
    };

    if (!isMember) {
      return [targetAction];
    }

    const chatAction: FABMenuItem = hasMemberCardAccess
      ? {
          label: "Launch BrodigyAI Mini-Chat",
          sub: "Nutrition-focused coaching with today's live totals",
          icon: Bot,
          iconColor: colors.brand,
          iconBg: colors.brand + "18",
          onPress: () => {
            router.push({
              pathname: "/(tabs)/chatbot",
              params: { sessionId: "new", from: "nutrition" }
            });
          }
        }
      : {
          label: membershipCardStatus === "pending_verification"
            ? "BrodigyAI Unlock Pending"
            : membershipCardStatus === "revoked"
              ? "Repair BrodigyAI Access"
              : "Unlock BrodigyAI Chat",
          sub: membershipCardStatus === "pending_verification"
            ? "Chat opens as soon as staff verifies your membership card"
            : membershipCardStatus === "revoked"
              ? "Open Profile to restore your member-card access"
              : "Buy or restore a membership card from Profile first",
          icon: Bot,
          iconColor: colors.warning,
          iconBg: colors.warning + "18",
          onPress: () => router.push("/(tabs)/profile")
        };

    return [chatAction, targetAction];
  }, [colors.brand, colors.warning, fireOpenGoals, hasGoal, hasMemberCardAccess, isFrozen, isMember, membershipCardStatus, router]);

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
            {hasGoal ? (
              <FitText style={s.caloriesGoalName}>{goalLabel.toUpperCase()}</FitText>
            ) : null}
            <FitText style={hasGoal ? s.caloriesLabelActive : s.caloriesLabel}>TODAY'S CALORIES</FitText>
            <FitText style={hasGoal ? s.caloriesValueActive : s.caloriesValue}>
              {isNutritionLoading ? "--" : today.toFixed(0)}
            </FitText>
            <FitText style={hasGoal ? s.caloriesTargetActive : s.caloriesTarget}>
              {target > 0 ? `/ ${target.toFixed(0)} kcal` : "No active backend target yet"}
            </FitText>
            <View style={hasGoal ? s.caloriesFlameCircleActive : s.caloriesFlameCircle}>
              <Flame size={16} color={hasGoal ? colors.onBrand : colors.brand} strokeWidth={2} />
            </View>
            {target > 0 ? (
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
                  {calorieDelta >= 0
                    ? `${calorieDelta.toFixed(0)} kcal remaining`
                    : `${Math.abs(calorieDelta).toFixed(0)} kcal over target`}
                </FitText>
              </>
            ) : (
              <>
                <FitText style={hasGoal ? s.caloriesRemainingActive : s.caloriesRemaining}>
                  Save your profile metrics and goal to unlock the live nutrition summary.
                </FitText>
                {!isFrozen ? (
                  <FitButton
                    label="Set Nutrition Target"
                    variant={hasGoal ? "ghost" : "primary"}
                    onPress={() => setGoalsVisible(true)}
                    style={{ marginTop: 12 }}
                  />
                ) : null}
              </>
            )}
          </View>

          <FitSection heading="Macro Breakdown">
            <View style={s.macroBlock}>
              {macroRows.map((row) => {
                const targetValue = row.target;
                const progress = targetValue > 0 ? (row.value / targetValue) * 100 : 0;
                const color = row.color === "brand"
                  ? colors.brand
                  : row.color === "success"
                    ? colors.success
                    : colors.textSecondary;

                return (
                  <View key={row.key} style={{ marginBottom: 12 }}>
                    <View style={s.macroRow}>
                      <View style={[s.macroDot, { backgroundColor: color }]} />
                      <FitText style={s.macroName}>{row.label}</FitText>
                      <FitText style={s.macroValue}>
                        {`${row.value.toFixed(0)}g${targetValue > 0 ? ` / ${targetValue.toFixed(0)}g` : ""}`}
                      </FitText>
                    </View>
                    <View style={s.macroTrack}>
                      <View style={[s.macroFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: color }]} />
                    </View>
                    <FitText style={s.macroRemaining}>
                      {targetValue > 0
                        ? formatMacroDelta(targetValue - row.value)
                        : "Create a target to compare your macros"}
                    </FitText>
                  </View>
                );
              })}
            </View>
          </FitSection>

          <FitSection heading="Coaching Signals">
            <View style={s.sectionBlock}>
              <FitText style={s.matchBadge}>{hasGoal ? "LIVE GUIDANCE" : "FREE BASELINE"}</FitText>
              <FitText style={s.matchTitle}>
                {hasGoal ? "Today's biggest nutrition swings" : "Build from your current intake"}
              </FitText>
              <FitText style={s.matchSubtitle}>
                {hasGoal
                  ? "These alerts react to the live backend target and daily summary, so the page tells you what actually needs attention next."
                  : "Your calorie and macro totals stay live even before premium logging tools or a paid plan are active."}
              </FitText>
              <View style={s.signalStack}>
                {guidanceAlerts.map((alert, index) => (
                  <Animated.View
                    key={alert.id}
                    entering={FadeInDown.delay(index * 70).duration(220)}
                    style={[s.signalCard, getAlertToneStyle(alert.tone, s)]}
                  >
                    <FitText style={[s.signalEyebrow, { color: getAlertToneColor(alert.tone, colors) }]}>
                      {alert.eyebrow}
                    </FitText>
                    <FitText style={s.signalTitle}>{alert.title}</FitText>
                    <FitText style={s.signalMessage}>{alert.message}</FitText>
                  </Animated.View>
                ))}
              </View>
            </View>
          </FitSection>

          <FitSection heading="Recommended Next Bites">
            <View style={s.sectionBlock}>
              <FitText style={s.matchBadge}>{hasGoal ? "DEFICIT-AWARE PICKS" : "STARTER SHELF"}</FitText>
              <FitText style={s.matchTitle}>Quick foods to close the next gap</FitText>
              <FitText style={s.matchSubtitle}>
                {hasGoal
                  ? "These picks are sorted against the macros you're still missing, so the shelf changes with the live summary."
                  : "No target is active yet, so this shelf stays balanced and easy to use while you set your first nutrition goal."}
              </FitText>
              <View style={s.cardList}>
                {recommendedFoods.map((item, index) => (
                  <FitCard
                    key={item.id}
                    emoji={item.emoji}
                    label={item.name}
                    subtitle={formatFoodSubtitle(item)}
                    trailingLabel={getFoodTrailingLabel(item)}
                    trailingLabelColor={getFoodTrailingColor(item, colors)}
                    hasBorder={index < recommendedFoods.length - 1}
                    noChevron
                  />
                ))}
              </View>
              <FitText style={s.sectionNote}>
                Use these as starter ideas, then log the exact meal if you want the premium daily log to keep pace with what you actually ate.
              </FitText>
            </View>
          </FitSection>

          <FitSection heading="Curated Food Catalog">
            <View style={s.sectionBlock}>
              <FitText style={s.matchBadge}>INTERNAL CATALOG</FitText>
              <FitText style={s.matchTitle}>Seeded staples for fast nutrition logging</FitText>
              <FitText style={s.matchSubtitle}>
                Batch D keeps a small internal shelf here so the page feels useful even before search, barcode, or a larger food database exists.
              </FitText>
              <View style={s.cardList}>
                {catalogShelf.map((item, index) => (
                  <FitCard
                    key={item.id}
                    emoji={item.emoji}
                    label={item.name}
                    subtitle={formatFoodSubtitle(item)}
                    trailingLabel={getFoodTrailingLabel(item)}
                    trailingLabelColor={getFoodTrailingColor(item, colors)}
                    hasBorder={index < catalogShelf.length - 1}
                    noChevron
                  />
                ))}
              </View>
            </View>
          </FitSection>

          <FitSection heading="Today's Nutrition Log">
            {isPlanAccessLoading ? (
              <PremiumFeatureGate
                statusLabel="Checking access"
                title="Checking premium nutrition access"
                message="We're confirming your membership plan before loading meal logs and premium nutrition tools."
              />
            ) : isPremiumLocked ? (
              <PremiumFeatureGate
                actionLabel="Open Membership Details"
                onActionPress={() => router.push("/(tabs)/profile")}
                statusLabel={subscriptionStatusLabel}
                title="Meal logging unlocks with an active plan"
                message={`${membershipAccessSummary} Daily meal logs stay discoverable here, but only active plans can save and compare entries against live nutrition targets.`}
              />
            ) : nutritionLogs.data.length > 0 ? (
              nutritionLogs.data.map((entry, index) => (
                <FitCard
                  key={entry.id}
                  label={`${entry.mealName} - ${entry.foodItem}`}
                  subtitle={formatNutritionLogSubtitle(entry)}
                  trailingLabel={`${entry.quantity.toFixed(0)} ${entry.unit}`}
                  trailingLabelColor={colors.brand}
                  hasBorder={index < nutritionLogs.data.length - 1}
                  noChevron
                />
              ))
            ) : (
              <View style={s.contentCard}>
                <FitText style={s.matchBadge}>NO LOGS YET</FitText>
                <FitText style={s.matchTitle}>Start tracking today</FitText>
                <FitText style={s.matchSubtitle}>
                  Save your meals to compare today's intake against your live macro target.
                </FitText>
              </View>
            )}
            {!isFrozen && canUsePremiumNutrition ? (
              <FitButton
                label="Log Meal"
                icon={Plus}
                variant="primary"
                onPress={() => setLogVisible(true)}
                style={{ marginTop: 12 }}
              />
            ) : null}
          </FitSection>

          <View style={s.contentCard}>
            <FitText style={s.matchBadge}>LIVE TARGET</FitText>
            <FitText style={s.matchTitle}>Nutrition Snapshot</FitText>
            <FitText style={s.matchSubtitle}>
              {hasGoal
                ? `${goalLabel} plan from the backend TDEE module`
                : "No active nutrition target found for this account yet."}
            </FitText>
            <View style={s.cardList}>
              <FitCard
                label="TDEE"
                subtitle={activeNutrition ? `${activeNutrition.tdee.tdeeCalories.toFixed(0)} kcal/day` : "Unavailable"}
                hasBorder
                noChevron
              />
              <FitCard
                label="BMR"
                subtitle={activeNutrition ? `${activeNutrition.tdee.bmrCalories.toFixed(0)} kcal/day` : "Unavailable"}
                hasBorder
                noChevron
              />
              <FitCard
                label="Today vs Target"
                subtitle={target > 0 ? `${today.toFixed(0)} / ${target.toFixed(0)} kcal` : "Target not configured"}
                noChevron
              />
            </View>
          </View>

          <FitText style={s.disclaimer}>
            Nutrition data now comes from the live backend TDEE, summary, and log endpoints, while the mini-chat launcher follows the newer member-card access policy.
          </FitText>
        </Animated.View>
      </Animated.ScrollView>
      <GoalsModal
        isVisible={isGoalsVisible}
        onClose={() => setGoalsVisible(false)}
        onSuccess={() => setGoalsVisible(false)}
      />
      <NutritionLogModal
        isVisible={canUsePremiumNutrition && isLogVisible}
        onClose={() => setLogVisible(false)}
        onSuccess={() => setLogVisible(false)}
      />
    </Animated.View>
  );
}
