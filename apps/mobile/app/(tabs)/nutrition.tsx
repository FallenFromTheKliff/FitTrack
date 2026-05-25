import { useState, useEffect, useCallback, useMemo } from "react";
import { View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Bot, Flame, Info, Plus, Target, UtensilsCrossed } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused } from "@react-navigation/native";

import type {
  ActiveNutritionProfileRecord,
  DailyNutritionSummaryRecord,
  NutritionLogRecord,
  NutritionMacroTotalsRecord,
  NutritionTdeeRecord
} from "@fittrack/types";
import {
  nutritionActiveTdeeQueryOptions,
  nutritionDailySummaryQueryOptions,
  nutritionHistoryQueryOptions,
  nutritionLogsQueryOptions
} from "@fittrack/query";
import { getTodayString } from "@/data/bookings";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { type FABMenuItem, useFABState } from "@/contexts/FABStateContext";
import PremiumFeatureGate from "@/components/membership/PremiumFeatureGate";
import { usePassageAnim } from "@/hooks/animations/screen/usePassageAnim";
import { makeScreenStyles, makeNutritionStyles } from "@/styles/shared/ScreenStyles";
import { mobileApiClient } from "@/lib/api-client";
import FeatureHeader from "@/components/layout/FeatureHeader";

import FitSection from "@/components/fit/FitSection";
import FitCard from "@/components/fit/FitCard";
import { FitText } from "@/components/fit/FitText";
import { GoalsModal, NutritionLogModal } from "@/components/modals";

type ThemeColors = ReturnType<typeof useTheme>["colors"];
type MealMacroFocus = "protein" | "carbs" | "fat" | "balance";
type RecommendedMealLog = NutritionLogRecord & {
  focus: MealMacroFocus;
};

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

function formatShortDateTime(value?: string | null) {
  if (!value) return "Not calculated yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not calculated yet";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function formatCalorieDelta(current?: number, previous?: number) {
  if (!current || !previous) return "No previous target";
  const delta = current - previous;
  if (Math.abs(delta) < 1) return "No change";
  return `${delta > 0 ? "+" : ""}${delta.toFixed(0)} kcal`;
}

function getMacroGaps(
  logged: NutritionMacroTotalsRecord,
  target: NutritionMacroTotalsRecord
) {
  return [
    {
      key: "protein" as const,
      delta: target.proteinG - logged.proteinG,
      threshold: 12
    },
    {
      key: "carbs" as const,
      delta: target.carbsG - logged.carbsG,
      threshold: 18
    },
    {
      key: "fat" as const,
      delta: target.fatG - logged.fatG,
      threshold: 8
    }
  ].sort((left, right) => right.delta - left.delta);
}

function getMealMacroValue(entry: NutritionLogRecord, focus: MealMacroFocus) {
  switch (focus) {
    case "protein":
      return entry.proteinG;
    case "carbs":
      return entry.carbsG;
    case "fat":
      return entry.fatG;
    default:
      return 0;
  }
}

function getDominantMealFocus(entry: NutritionLogRecord): MealMacroFocus {
  const macroCalories = [
    { focus: "protein" as const, value: entry.proteinG * 4 },
    { focus: "carbs" as const, value: entry.carbsG * 4 },
    { focus: "fat" as const, value: entry.fatG * 9 }
  ].sort((left, right) => right.value - left.value);
  const total = macroCalories.reduce((sum, macro) => sum + macro.value, 0);

  if (!total || macroCalories[0].value / total < 0.4) {
    return "balance";
  }

  return macroCalories[0].focus;
}

function getRecommendedMealFocus(
  entry: NutritionLogRecord,
  positiveGaps: ReturnType<typeof getMacroGaps>
): MealMacroFocus {
  const topMatch = positiveGaps
    .map((gap, index) => ({
      focus: gap.key,
      value: getMealMacroValue(entry, gap.key) * (positiveGaps.length - index)
    }))
    .sort((left, right) => right.value - left.value)[0];

  return topMatch && topMatch.value > 0 ? topMatch.focus : getDominantMealFocus(entry);
}

function getRecommendedMealLogs(
  logs: NutritionLogRecord[],
  logged: NutritionMacroTotalsRecord,
  target: NutritionMacroTotalsRecord | null,
  limit = 3
): RecommendedMealLog[] {
  const seen = new Set<string>();
  const uniqueLogs = logs.filter((entry) => {
    const key = [
      entry.mealName,
      entry.foodItem.trim().toLowerCase(),
      entry.calories,
      entry.proteinG,
      entry.carbsG,
      entry.fatG,
      entry.quantity,
      entry.unit
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const positiveGaps = target
    ? getMacroGaps(logged, target).filter((gap) => gap.delta > gap.threshold / 2)
    : [];

  return uniqueLogs
    .map((entry, index) => {
      const focus = getRecommendedMealFocus(entry, positiveGaps);
      const score = positiveGaps.length
        ? positiveGaps.reduce(
            (total, gap, gapIndex) =>
              total + getMealMacroValue(entry, gap.key) * (positiveGaps.length - gapIndex + 1),
            0
          )
        : uniqueLogs.length - index;

      return {
        ...entry,
        focus,
        score
      };
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

function getMealTrailingLabel(focus: MealMacroFocus) {
  switch (focus) {
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

function getMealTrailingColor(focus: MealMacroFocus, colors: ThemeColors) {
  switch (focus) {
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

function formatRecommendedMealSubtitle(entry: NutritionLogRecord) {
  return `${formatShortDateTime(entry.logDate)} | ${formatNutritionLogSubtitle(entry)} | ${entry.quantity.toFixed(0)} ${entry.unit}`;
}

export default function NutritionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const isFocused = useIsFocused();
  const {
    registerFAB,
    unregisterFAB,
    fireOpenGoals,
    openGoalsSignal,
    resetSignal,
    setFabOpen
  } = useFABState();
  const { opacity, translateY } = usePassageAnim({ mode: "focus" });
  const base = useMemo(() => makeScreenStyles(colors), [colors]);
  const s = useMemo(() => makeNutritionStyles(colors), [colors]);
  const isFrozen = user?.status === "frozen";
  const isMember = user?.role === "USER";
  const { data: liveProfile = null, isFetching: isCheckingMemberAccess } = useQuery({
    queryKey: ["nutrition-member-access", user?.id],
    queryFn: () => mobileApiClient.users.getProfile(),
    enabled: isFocused && !!user?.id && isMember,
    staleTime: 15_000,
    gcTime: 60_000
  });
  const memberAccountStatus = liveProfile?.status ?? user?.status ?? "active";
  const membershipCardStatus = liveProfile?.membershipCard?.status ?? user?.membershipCard?.status ?? "none";
  const hasMemberCardAccess =
    membershipCardStatus === "active" || user?.membershipAccess === "member";
  const isActiveMemberAccount = isMember && memberAccountStatus === "active";
  const canUseNutritionLogging = !isMember || isActiveMemberAccount;
  const memberAccessLabel = isCheckingMemberAccess
    ? "Checking access"
    : isActiveMemberAccount
      ? "Active member"
      : memberAccountStatus === "frozen"
        ? "Frozen"
        : "Inactive member";
  const memberAccessSummary = isCheckingMemberAccess
    ? "FitTrack is checking your current member status before meal logging opens."
    : "Meal logging is available to active members. Your account needs to be active before logging meals.";
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
    enabled: isFocused && !!user?.id && canUseNutritionLogging
  });
  const { data: recentNutritionLogs = { data: [], meta: { page: 1, limit: 24, total: 0, total_pages: 0 } } } = useQuery({
    ...nutritionLogsQueryOptions<NutritionLogRecord>(mobileApiClient, user?.id, {
      page: 1,
      limit: 24
    }),
    enabled: isFocused && !!user?.id && canUseNutritionLogging
  });
  const { data: nutritionHistory = { data: [], meta: { page: 1, limit: 4, total: 0, total_pages: 0 } } } = useQuery({
    ...nutritionHistoryQueryOptions<NutritionTdeeRecord>(mobileApiClient, user?.id, {
      page: 1,
      limit: 4
    }),
    enabled: isFocused && !!user?.id
  });

  const loggedTotals = useMemo(
    () => dailySummary?.logged ?? { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    [dailySummary?.logged]
  );
  const targetTotals = useMemo(
    () =>
      dailySummary?.target ?? (
        activeNutrition
          ? {
              calories: activeNutrition.macros.targetCalories,
              proteinG: activeNutrition.macros.proteinG,
              carbsG: activeNutrition.macros.carbsG,
              fatG: activeNutrition.macros.fatG
            }
          : null
      ),
    [activeNutrition, dailySummary?.target]
  );

  const today = loggedTotals.calories;
  const target = targetTotals?.calories ?? 0;
  const calorieDelta = target - today;
  const hasGoal = !!activeNutrition?.macros;
  const goalLabel = formatGoalLabel(activeNutrition?.tdee.fitnessGoal);
  const recentTdee = nutritionHistory.data[0] ?? activeNutrition?.tdee ?? null;
  const previousTdee = nutritionHistory.data.find((entry) => entry.id !== activeNutrition?.tdee.id) ?? null;
  const targetAdherence = target > 0 ? Math.min((today / target) * 100, 999) : 0;
  const targetStatusLabel = hasGoal
    ? calorieDelta >= 0
      ? "In range"
      : "Over target"
    : "Needs setup";
  const targetStatusDetail = hasGoal
    ? `${Math.min(targetAdherence, 100).toFixed(0)}% of today's target logged.`
    : "Create a nutrition goal before macro comparisons can run.";
  const recalculationDetail = recentTdee
    ? `Last calculated ${formatShortDateTime(recentTdee.calculatedAt)}.`
    : "No backend TDEE calculation is active yet.";
  const macroRows = formatMacroRows(loggedTotals, targetTotals);
  const recommendedMeals = useMemo(
    () => getRecommendedMealLogs(recentNutritionLogs.data, loggedTotals, targetTotals, 3),
    [loggedTotals, recentNutritionLogs.data, targetTotals]
  );

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    }
  });

  const menuItems: FABMenuItem[] = useMemo(() => {
    if (isFrozen) return [];
    const targetAction: FABMenuItem = {
      label: hasGoal ? "Target" : "Create Target",
      sub: hasGoal ? "Update calories" : "Set macros",
      icon: Target,
      iconColor: colors.brand,
      iconBg: colors.brand + "18",
      onPress: fireOpenGoals
    };
    const logAction: FABMenuItem = {
      label: "Log Meal",
      sub: "Add today's food",
      icon: Plus,
      iconColor: colors.success,
      iconBg: colors.success + "18",
      onPress: () => {
        setFabOpen(false);
        setLogVisible(true);
      }
    };

    if (!isMember) {
      return [targetAction];
    }

    const chatAction: FABMenuItem = hasMemberCardAccess
      ? {
          label: "BrodigyAI",
          sub: "Nutrition chat",
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
            ? "Chat Pending"
            : membershipCardStatus === "revoked"
              ? "Repair Chat"
              : "Unlock Chat",
          sub: membershipCardStatus === "pending_verification"
            ? "Awaiting card check"
            : membershipCardStatus === "revoked"
              ? "Open Profile"
              : "Needs member card",
          icon: Bot,
          iconColor: colors.warning,
          iconBg: colors.warning + "18",
          onPress: () => router.push("/(tabs)/profile")
        };

    return canUseNutritionLogging
      ? [chatAction, logAction, targetAction]
      : [chatAction, targetAction];
  }, [canUseNutritionLogging, colors.brand, colors.success, colors.warning, fireOpenGoals, hasGoal, hasMemberCardAccess, isFrozen, isMember, membershipCardStatus, router, setFabOpen]);

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
      <FeatureHeader
        icon={UtensilsCrossed}
        iconMode="none"
      >
        <View style={s.headerSummary}>
          <View style={s.headerTopRow}>
            <View style={s.headerTitleStack}>
              <FitText style={s.headerGoalName}>
                {hasGoal ? goalLabel.toUpperCase() : "TARGET SETUP"}
              </FitText>
              <FitText style={s.headerCaloriesLabel}>TODAY'S CALORIES</FitText>
            </View>
            <View style={s.headerFlameIcon}>
              <Flame size={30} color={colors.brand} strokeWidth={2.2} />
            </View>
          </View>
          <FitText style={s.headerCaloriesValue}>
            {isNutritionLoading ? "--" : today.toFixed(0)}
          </FitText>
          <FitText style={s.headerCaloriesTarget}>
            {target > 0 ? `/ ${target.toFixed(0)} kcal` : "No active backend target yet"}
          </FitText>
          {target > 0 ? (
            <>
              <View style={s.headerCaloriesBar}>
                <View
                  style={[
                    s.headerCaloriesBarFill,
                    { width: `${Math.min(1, today / target) * 100}%` },
                  ]}
                />
              </View>
              <FitText style={s.headerCaloriesRemaining}>
                {calorieDelta >= 0
                  ? `${calorieDelta.toFixed(0)} kcal remaining`
                  : `${Math.abs(calorieDelta).toFixed(0)} kcal over target`}
              </FitText>
              {!isFrozen ? (
                <View style={s.headerHintRow}>
                  <UtensilsCrossed size={14} color={colors.brand} strokeWidth={2} />
                  <FitText style={s.headerCaloriesHint}>
                    Use the FAB to update this target.
                  </FitText>
                </View>
              ) : null}
            </>
          ) : (
            <>
              <FitText style={s.headerCaloriesRemaining}>
                Save your profile metrics and goal to unlock the live nutrition summary.
              </FitText>
              {!isFrozen ? (
                <View style={s.headerHintRow}>
                  <UtensilsCrossed size={14} color={colors.brand} strokeWidth={2} />
                  <FitText style={s.headerCaloriesHint}>
                    Use the FAB to set your target.
                  </FitText>
                </View>
              ) : null}
            </>
          )}
        </View>
      </FeatureHeader>
      <Animated.ScrollView
        style={[base.content, screenStyle]}
        contentContainerStyle={base.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Animated.View style={contentStyle}>
          <FitSection heading="Target Status" bare>
            <View style={s.cardList}>
              <FitCard
                icon={Target}
                label="Daily Target"
                subtitle={targetStatusDetail}
                trailingLabel={targetStatusLabel}
                trailingLabelColor={targetStatusLabel === "Over target" ? colors.warning : colors.brand}
                hasBorder
                noChevron
              />
              <FitCard
                icon={Flame}
                label="Recent Adherence"
                subtitle={
                  target > 0
                    ? `${today.toFixed(0)} kcal logged against ${target.toFixed(0)} kcal today.`
                    : "No calorie target is available for today's comparison."
                }
                trailingLabel={target > 0 ? `${Math.min(targetAdherence, 100).toFixed(0)}%` : "--"}
                trailingLabelColor={targetAdherence > 105 ? colors.warning : colors.success}
                hasBorder
                noChevron
              />
              <FitCard
                icon={UtensilsCrossed}
                label="Target History"
                subtitle={`${recalculationDetail} ${nutritionHistory.meta.total} saved calculation${nutritionHistory.meta.total === 1 ? "" : "s"} on record.`}
                trailingLabel={formatCalorieDelta(activeNutrition?.tdee.tdeeCalories, previousTdee?.tdeeCalories)}
                trailingLabelColor={colors.brand}
                noChevron
              />
            </View>
          </FitSection>

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

          <FitSection heading="Today's Nutrition Log" bare>
            {!canUseNutritionLogging ? (
              <PremiumFeatureGate
                eyebrow="ACTIVE MEMBER REQUIRED"
                actionLabel="Open Membership Details"
                onActionPress={() => router.push("/(tabs)/profile")}
                statusLabel={memberAccessLabel}
                title="Meal logging unlocks for active members"
                message={memberAccessSummary}
              />
            ) : nutritionLogs.data.length > 0 ? (
              <View style={s.cardList}>
                {nutritionLogs.data.map((entry, index) => (
                  <FitCard
                    key={entry.id}
                    label={`${entry.mealName} - ${entry.foodItem}`}
                    subtitle={formatNutritionLogSubtitle(entry)}
                    trailingLabel={`${entry.quantity.toFixed(0)} ${entry.unit}`}
                    trailingLabelColor={colors.brand}
                    hasBorder={index < nutritionLogs.data.length - 1}
                    noChevron
                  />
                ))}
              </View>
            ) : (
              <View style={s.contentCard}>
                <FitText style={s.matchBadge}>NO LOGS YET</FitText>
                <FitText style={s.matchTitle}>Start tracking today</FitText>
                <FitText style={s.matchSubtitle}>
                  Save your meals to compare today's intake against your live macro target.
                </FitText>
              </View>
            )}
            {!isFrozen && canUseNutritionLogging ? (
              <View style={s.logFabHintRow}>
                <Info size={14} color={colors.textMuted} strokeWidth={2} />
                <FitText style={s.logFabHint}>
                  Use the FAB to log meals.
                </FitText>
              </View>
            ) : null}
          </FitSection>

          <FitSection heading="Recommended Next Bites">
            <View style={s.sectionBlock}>
              <FitText style={s.matchBadge}>{hasGoal ? "LIVE MEAL PICKS" : "SAVED MEAL PICKS"}</FitText>
              <FitText style={s.matchTitle}>Recent meals to close the next gap</FitText>
              <FitText style={s.matchSubtitle}>
                {hasGoal
                  ? "These picks come from your saved meal logs and sort against the macros you're still missing."
                  : "No target is active yet, so FitTrack shows recent saved meals while you set your first nutrition goal."}
              </FitText>
              {recommendedMeals.length > 0 ? (
                <View style={s.cardList}>
                  {recommendedMeals.map((entry, index) => (
                    <FitCard
                      key={entry.id}
                      icon={UtensilsCrossed}
                      label={entry.foodItem}
                      subtitle={formatRecommendedMealSubtitle(entry)}
                      trailingLabel={getMealTrailingLabel(entry.focus)}
                      trailingLabelColor={getMealTrailingColor(entry.focus, colors)}
                      hasBorder={index < recommendedMeals.length - 1}
                      noChevron
                    />
                  ))}
                </View>
              ) : (
                <View style={s.contentCard}>
                  <FitText style={s.matchBadge}>NO SAVED MEALS</FitText>
                  <FitText style={s.matchTitle}>Log meals to build this shelf</FitText>
                  <FitText style={s.matchSubtitle}>
                    Recommended bites now come from live meal logs instead of a built-in catalog.
                  </FitText>
                </View>
              )}
              <FitText style={s.sectionNote}>
                Pick a previous meal from Log Meal or save a fresh entry to keep this list aligned with what you actually eat.
              </FitText>
            </View>
          </FitSection>

        </Animated.View>
      </Animated.ScrollView>
      <GoalsModal
        isVisible={isGoalsVisible}
        onClose={() => setGoalsVisible(false)}
        onSuccess={() => setGoalsVisible(false)}
      />
      <NutritionLogModal
        isVisible={canUseNutritionLogging && isLogVisible}
        onClose={() => setLogVisible(false)}
        onSuccess={() => setLogVisible(false)}
      />
    </Animated.View>
  );
}
