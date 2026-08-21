import { useState, useEffect, useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Bot, ChevronRight, Flame, History, Info, Plus, RefreshCw, Target, UtensilsCrossed } from "lucide-react-native";
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
import {
  resolveCalorieIntakeStatus,
  type CalorieIntakeTone,
} from "@/data/calorieIntakeStatus";
import { formatNutritionLogSubtitle } from "@/data/nutrition";
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
import FitButton from "@/components/fit/FitButton";
import { FitText } from "@/components/fit/FitText";
import { GoalsModal, NutritionHistoryModal, NutritionLogModal } from "@/components/modals";
import NutritionMealIcon from "@/components/nutrition/NutritionMealIcon";
import { R } from "@fittrack/ui/tokens";

type ThemeColors = ReturnType<typeof useTheme>["colors"];
type RatioTone = "success" | "warning" | "danger";

const ACCESSIBLE_DARK_CALORIE_DANGER = "#F05252";
const TODAY_LOG_PREVIEW_COUNT = 6;
const TODAY_MEAL_GROUPS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
type TodayMealGroup = (typeof TODAY_MEAL_GROUPS)[number];

const localStyles = StyleSheet.create({
  historyAction: {
    alignItems: "center",
    borderRadius: R.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    minHeight: 44,
    minWidth: 76,
    paddingHorizontal: 8
  },
  historyActionText: {
    fontSize: 12,
    lineHeight: 16
  },
  todayGroups: {
    gap: 16
  },
  todayGroup: {
    gap: 8
  },
  todayGroupHeader: {
    alignItems: "baseline",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 2
  },
  todayGroupTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  todayGroupSubtotal: {
    fontSize: 11,
    fontWeight: "700"
  },
  todayGroupRows: {
    gap: 8
  },
  todayExpandButton: {
    alignItems: "center",
    alignSelf: "center",
    borderRadius: R.md,
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  todayExpandButtonText: {
    fontSize: 12,
    fontWeight: "700"
  },
  todayRow: {
    alignItems: "center",
    borderRadius: R.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 10,
    minHeight: 68,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  todayRowCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  todayRowIcon: {
    alignItems: "center",
    borderRadius: R.md,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    width: 38
  },
  todayRowSubtitle: {
    fontSize: 11,
    lineHeight: 16
  },
  todayRowTitle: {
    fontSize: 14,
    fontWeight: "700"
  },
  todayState: {
    alignItems: "center",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 28
  },
  todayStateHint: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center"
  },
  todayStateTitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center"
  }
});

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
      color: "success",
      value: logged.carbsG,
      target: target?.carbsG ?? 0
    },
    {
      key: "fat",
      label: "Fats",
      color: "warning",
      value: logged.fatG,
      target: target?.fatG ?? 0
    }
  ];
}

function formatMacroDelta(delta: number) {
  return delta >= 0 ? `${delta.toFixed(0)}g remaining` : `${Math.abs(delta).toFixed(0)}g over target`;
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

function getRatioState(percent: number) {
  if (percent >= 90 && percent <= 105) {
    return { label: "On target", tone: "success" as RatioTone };
  }
  if ((percent >= 75 && percent < 90) || (percent > 105 && percent <= 115)) {
    return {
      label: percent < 90 ? "Near target, low" : "Near target, high",
      tone: "warning" as RatioTone
    };
  }
  return {
    label: percent < 75 ? "Below target" : "Above target",
    tone: "danger" as RatioTone
  };
}

function getRatioColor(tone: RatioTone, colors: ThemeColors) {
  if (tone === "success") return colors.success;
  if (tone === "warning") return colors.warning;
  return colors.danger;
}

function getCalorieIntakeColor(tone: CalorieIntakeTone, colors: ThemeColors) {
  if (tone === "neutral") return colors.textMuted;
  if (tone === "danger" && colors.danger.toUpperCase() === "#EF4444") {
    return ACCESSIBLE_DARK_CALORIE_DANGER;
  }
  return getRatioColor(tone, colors);
}

function getMacroCategoryColor(color: string, colors: ThemeColors) {
  if (color === "success") return colors.success;
  if (color === "warning") return colors.warning;
  return colors.textSecondary;
}

function getTodayMealGroup(mealName: string): TodayMealGroup {
  const normalizedMealName = mealName.trim().toLowerCase().replace(/\s+/g, "-");
  if (normalizedMealName === "breakfast") return "Breakfast";
  if (normalizedMealName === "lunch") return "Lunch";
  if (normalizedMealName === "dinner") return "Dinner";
  return "Snacks";
}

function groupTodayLogs(entries: NutritionLogRecord[]) {
  const grouped: Record<TodayMealGroup, NutritionLogRecord[]> = {
    Breakfast: [],
    Lunch: [],
    Dinner: [],
    Snacks: []
  };

  entries.forEach((entry) => {
    grouped[getTodayMealGroup(entry.mealName)].push(entry);
  });

  return TODAY_MEAL_GROUPS.map((label) => ({
    calories: grouped[label].reduce((total, entry) => total + entry.calories, 0),
    entries: grouped[label],
    label
  })).filter((group) => group.entries.length > 0);
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
  const [isHistoryVisible, setHistoryVisible] = useState(false);
  const [editingLog, setEditingLog] = useState<NutritionLogRecord | null>(null);
  const [isTodayLogExpanded, setTodayLogExpanded] = useState(false);

  const { data: activeNutrition = null, isLoading: isNutritionLoading } = useQuery({
    ...nutritionActiveTdeeQueryOptions<ActiveNutritionProfileRecord | null>(mobileApiClient, user?.id),
    enabled: isFocused && !!user?.id
  });
  const { data: dailySummary = null } = useQuery({
    ...nutritionDailySummaryQueryOptions<DailyNutritionSummaryRecord>(mobileApiClient, user?.id, todayString),
    enabled: isFocused && !!user?.id
  });
  const {
    data: todayLogsResponse,
    error: todayLogsError,
    isError: isTodayLogsError,
    isPending: isTodayLogsLoading,
    refetch: refetchTodayLogs
  } = useQuery({
    ...nutritionLogsQueryOptions<NutritionLogRecord>(mobileApiClient, user?.id, {
      startDate: todayString,
      endDate: todayString,
      sort: "newest",
      limit: 100
    }),
    enabled: isFocused && !!user?.id && canUseNutritionLogging
  });
  const nutritionLogs = useMemo(() => todayLogsResponse?.data ?? [], [todayLogsResponse?.data]);
  const visibleTodayLogs = useMemo(
    () => isTodayLogExpanded ? nutritionLogs : nutritionLogs.slice(0, TODAY_LOG_PREVIEW_COUNT),
    [isTodayLogExpanded, nutritionLogs]
  );
  const allTodayLogGroups = useMemo(() => groupTodayLogs(nutritionLogs), [nutritionLogs]);
  const visibleTodayLogIds = useMemo(
    () => new Set(visibleTodayLogs.map((entry) => entry.id)),
    [visibleTodayLogs]
  );
  const todayLogGroups = useMemo(
    () => allTodayLogGroups
      .map((group) => ({
        ...group,
        entries: group.entries.filter((entry) => visibleTodayLogIds.has(entry.id))
      }))
      .filter((group) => group.entries.length > 0),
    [allTodayLogGroups, visibleTodayLogIds]
  );
  const hasMoreTodayLogsToShow = nutritionLogs.length > TODAY_LOG_PREVIEW_COUNT;
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
  const calorieIntakeStatus = resolveCalorieIntakeStatus(
    isNutritionLoading ? null : today,
    isNutritionLoading ? null : target,
  );
  const calorieIntakeColor = getCalorieIntakeColor(calorieIntakeStatus.tone, colors);
  const calorieBalanceText = calorieDelta >= 0
    ? `${calorieDelta.toFixed(0)} kcal remaining`
    : `${Math.abs(calorieDelta).toFixed(0)} kcal over target`;
  const hasGoal = !!activeNutrition?.macros;
  const goalLabel = formatGoalLabel(activeNutrition?.tdee.fitnessGoal);
  const recentTdee = nutritionHistory.data[0] ?? activeNutrition?.tdee ?? null;
  const previousTdee = nutritionHistory.data.find((entry) => entry.id !== activeNutrition?.tdee.id) ?? null;
  const targetAdherence = target > 0 ? Math.min((today / target) * 100, 999) : 0;
  const adherenceState = target > 0 ? getRatioState(targetAdherence) : null;
  const targetStatusLabel = target > 0 ? calorieIntakeStatus.label : "Needs setup";
  const targetStatusDetail = target > 0
    ? `${Math.min(targetAdherence, 100).toFixed(0)}% of today's target logged · ${calorieBalanceText}.`
    : "Create a nutrition goal before macro comparisons can run.";
  const recalculationDetail = recentTdee
    ? `Last calculated ${formatShortDateTime(recentTdee.calculatedAt)}.`
    : "No backend TDEE calculation is active yet.";
  const macroRows = formatMacroRows(loggedTotals, targetTotals);
  const todayLogsErrorMessage = todayLogsError instanceof Error
    ? todayLogsError.message
    : "Unable to load today's meals.";

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
        setEditingLog(null);
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
      <FeatureHeader icon={UtensilsCrossed} iconMode="none" title="Nutrition" />
      <Animated.ScrollView
        style={[base.content, screenStyle]}
        contentContainerStyle={[base.scrollContent, { paddingBottom: 180 }]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Animated.View style={contentStyle}>
          <View style={s.caloriesCard}>
            <View style={s.headerTopRow}>
              <View style={s.headerTitleStack}>
                <FitText style={[s.headerGoalName, { color: calorieIntakeColor }]}>
                  {hasGoal ? goalLabel.toUpperCase() : "TARGET SETUP"}
                </FitText>
                <FitText style={s.headerCaloriesLabel}>TODAY'S CALORIES</FitText>
              </View>
              <View
                style={[
                  s.headerFlameIcon,
                  {
                    backgroundColor: calorieIntakeColor + "14",
                    borderColor: calorieIntakeColor + "3D",
                    borderRadius: 18,
                    borderWidth: 1,
                  },
                ]}
              >
                <Flame size={30} color={calorieIntakeColor} strokeWidth={2.2} />
              </View>
            </View>
            <FitText style={[s.headerCaloriesValue, { color: calorieIntakeColor }]}>
              {isNutritionLoading ? "--" : today.toFixed(0)}
            </FitText>
            <FitText style={s.headerCaloriesTarget}>
              {target > 0 ? `/ ${target.toFixed(0)} kcal` : "No active backend target yet"}
            </FitText>
            {target > 0 ? (
              <>
                <View
                  style={[
                    s.headerCaloriesBar,
                    { backgroundColor: calorieIntakeColor + "20" },
                  ]}
                >
                  <View
                    style={[
                      s.headerCaloriesBarFill,
                      {
                        backgroundColor: calorieIntakeColor,
                        width: `${calorieIntakeStatus.progressPercent}%`,
                      },
                    ]}
                  />
                </View>
                <FitText
                  accessibilityLabel={`Calorie status: ${calorieIntakeStatus.label}. ${calorieBalanceText}.`}
                  accessibilityLiveRegion="polite"
                  style={[s.headerCaloriesRemaining, { color: calorieIntakeColor, opacity: 1 }]}
                >
                  {calorieIntakeStatus.label} · {calorieBalanceText}
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
                  {isNutritionLoading
                    ? "Loading today's live nutrition summary."
                    : "Save your profile metrics and goal to unlock the live nutrition summary."}
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
          <FitSection heading="Target Status" bare>
            <View style={s.cardList}>
              <FitCard
                icon={Target}
                label="Daily Target"
                subtitle={targetStatusDetail}
                trailingLabel={targetStatusLabel}
                trailingLabelColor={target > 0 ? calorieIntakeColor : colors.warning}
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
                trailingLabel={
                  target > 0 && adherenceState
                    ? `${Math.min(targetAdherence, 999).toFixed(0)}% ${adherenceState.label}`
                    : "--"
                }
                trailingLabelColor={adherenceState ? getRatioColor(adherenceState.tone, colors) : colors.textMuted}
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
                const categoryColor = getMacroCategoryColor(row.color, colors);
                const ratioState = targetValue > 0 ? getRatioState(progress) : null;
                const ratioPercent = Math.min(Math.max(progress, 0), 999);

                return (
                  <View
                    key={row.key}
                    style={{ marginBottom: 12 }}
                    accessible
                    accessibilityLabel={
                      targetValue > 0 && ratioState
                        ? `${row.label}: ${row.value.toFixed(0)} grams of ${targetValue.toFixed(0)} grams. ${ratioState.label}, ${ratioPercent.toFixed(0)} percent of target.`
                        : `${row.label}: ${row.value.toFixed(0)} grams. No target is set.`
                    }
                  >
                    <View style={s.macroRow}>
                      <View style={[s.macroDot, { backgroundColor: categoryColor }]} />
                      <FitText style={s.macroName}>{row.label}</FitText>
                      <FitText style={s.macroValue}>
                        {`${row.value.toFixed(0)}g${targetValue > 0 ? ` / ${targetValue.toFixed(0)}g` : ""}`}
                      </FitText>
                    </View>
                    <View style={s.macroTrack}>
                      <View style={[s.macroFill, { width: `${Math.min(progress, 100)}%`, backgroundColor: categoryColor }]} />
                    </View>
                    <FitText style={[s.macroRemaining, { color: categoryColor }]}>
                      {targetValue > 0
                        ? `${formatMacroDelta(targetValue - row.value)} | ${ratioState?.label} (${ratioPercent.toFixed(0)}%)`
                        : "Create a target to compare your macros"}
                    </FitText>
                  </View>
                );
              })}
            </View>
          </FitSection>

          <FitSection
            heading="Today's Nutrition Log"
            bare
            headerAccessory={
              canUseNutritionLogging ? (
                <Pressable
                  accessibilityLabel="History"
                  accessibilityRole="button"
                  hitSlop={4}
                  onPress={() => {
                    setLogVisible(false);
                    setHistoryVisible(true);
                  }}
                  style={[
                    localStyles.historyAction,
                    { backgroundColor: colors.surfaceRaised, borderColor: colors.border }
                  ]}
                >
                  <History color={colors.textSecondary} size={15} strokeWidth={2} />
                  <FitText style={[localStyles.historyActionText, { color: colors.textSecondary }]}>History</FitText>
                </Pressable>
              ) : undefined
            }
          >
            {!canUseNutritionLogging ? (
              <PremiumFeatureGate
                eyebrow="ACTIVE MEMBER REQUIRED"
                actionLabel="Open Membership Details"
                onActionPress={() => router.push("/(tabs)/profile")}
                statusLabel={memberAccessLabel}
                title="Meal logging unlocks for active members"
                message={memberAccessSummary}
              />
            ) : (
              <>
                {isTodayLogsLoading ? (
                  <View style={localStyles.todayState}>
                    <ActivityIndicator color={colors.brand} />
                    <FitText style={[localStyles.todayStateTitle, { color: colors.textPrimary }]}>Loading today's meals</FitText>
                  </View>
                ) : isTodayLogsError ? (
                  <View style={localStyles.todayState}>
                    <UtensilsCrossed size={28} color={colors.danger} strokeWidth={2} />
                    <FitText style={[localStyles.todayStateTitle, { color: colors.textPrimary }]}>Today's meals are unavailable</FitText>
                    <FitText style={[localStyles.todayStateHint, { color: colors.textMuted }]}>{todayLogsErrorMessage}</FitText>
                    <FitButton
                      label="Retry"
                      icon={RefreshCw}
                      iconSize={16}
                      variant="ghost"
                      onPress={() => void refetchTodayLogs()}
                    />
                  </View>
                ) : nutritionLogs.length > 0 ? (
                  <>
                    <View style={localStyles.todayGroups}>
                      {todayLogGroups.map((group) => (
                        <View key={group.label} style={localStyles.todayGroup}>
                          <View style={localStyles.todayGroupHeader}>
                            <FitText style={[localStyles.todayGroupTitle, { color: colors.textSecondary }]}>
                              {group.label}
                            </FitText>
                            <FitText style={[localStyles.todayGroupSubtotal, { color: colors.textMuted }]}>
                              {`${group.calories.toFixed(0)} kcal`}
                            </FitText>
                          </View>
                          <View style={localStyles.todayGroupRows}>
                            {group.entries.map((entry) => (
                              <Pressable
                                key={entry.id}
                                accessibilityRole="button"
                                accessibilityLabel={`Edit ${entry.mealName}, ${entry.foodItem}`}
                                onPress={() => {
                                  setEditingLog(entry);
                                  setLogVisible(true);
                                }}
                                style={[localStyles.todayRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                              >
                                <View style={[localStyles.todayRowIcon, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
                                  <NutritionMealIcon color={colors.brand} icon={entry.icon} size={18} />
                                </View>
                                <View style={localStyles.todayRowCopy}>
                                  <FitText
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                    style={[localStyles.todayRowTitle, { color: colors.textPrimary }]}
                                  >
                                    {`${entry.mealName} - ${entry.foodItem}`}
                                  </FitText>
                                  <FitText numberOfLines={1} style={[localStyles.todayRowSubtitle, { color: colors.textMuted }]}>
                                    {`${formatNutritionLogSubtitle(entry)} | ${entry.quantity.toFixed(0)} ${entry.unit}`}
                                  </FitText>
                                </View>
                                <ChevronRight color={colors.textMuted} size={18} strokeWidth={2} />
                              </Pressable>
                            ))}
                          </View>
                        </View>
                      ))}
                    </View>
                    {hasMoreTodayLogsToShow ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={isTodayLogExpanded ? "Show less" : `View all ${nutritionLogs.length} entries`}
                        onPress={() => setTodayLogExpanded((expanded) => !expanded)}
                        style={[
                          localStyles.todayExpandButton,
                          { backgroundColor: colors.surfaceRaised, borderColor: colors.border, borderWidth: 1 }
                        ]}
                      >
                        <FitText style={[localStyles.todayExpandButtonText, { color: colors.brand }]}>
                          {isTodayLogExpanded ? "Show less" : `View all ${nutritionLogs.length} entries`}
                        </FitText>
                      </Pressable>
                    ) : null}
                  </>
                ) : (
                  <View style={localStyles.todayState}>
                    <UtensilsCrossed size={28} color={colors.textMuted} strokeWidth={1.8} />
                    <FitText style={[localStyles.todayStateTitle, { color: colors.textPrimary }]}>
                      Start tracking today
                    </FitText>
                    <FitText style={[localStyles.todayStateHint, { color: colors.textMuted }]}>
                      Save your meals to compare today's intake against your live macro target.
                    </FitText>
                  </View>
                )}
              </>
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
        </Animated.View>
      </Animated.ScrollView>
      <GoalsModal
        isVisible={isGoalsVisible}
        onClose={() => setGoalsVisible(false)}
        onSuccess={() => setGoalsVisible(false)}
      />
      <NutritionHistoryModal
        isVisible={canUseNutritionLogging && isHistoryVisible}
        onClose={() => setHistoryVisible(false)}
        onEdit={(entry) => {
          setHistoryVisible(false);
          setEditingLog(entry);
          setLogVisible(true);
        }}
      />
      <NutritionLogModal
        key={editingLog?.id ?? "new-nutrition-log"}
        editingEntry={editingLog}
        isVisible={canUseNutritionLogging && isLogVisible}
        onClose={() => setLogVisible(false)}
        onSuccess={() => {
          setLogVisible(false);
          setEditingLog(null);
        }}
      />
    </Animated.View>
  );
}
