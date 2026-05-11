"use client";

import { Target, UtensilsCrossed } from "lucide-react";

import { AccessGate } from "@/components/member-only/MemberOnlyPageControls";
import {
  EmptyState,
  MemberCard,
  MemberGrid,
  MemberHero,
  MemberOnlyScreen,
  MemberPanelHeader,
  MemberPill,
  MemberProgressRow,
  MemberSection,
  MemberSurface,
  MemberText,
  MemberToneSurface,
  PremiumGate,
} from "@/components/member-only/MemberOnlyPrimitives";
import {
  clampProgress,
  formatCalorieDelta,
  formatFoodSubtitle,
  formatGoalLabel,
  formatMacroDelta,
  formatMacroRows,
  formatNutritionLogSubtitle,
  formatShortDateTime,
  getActiveNutritionTotals,
  getFoodTrailingLabel,
  getNutritionGuidanceAlerts,
  getRecommendedFoodCatalogItems,
  getTodayString,
} from "@/components/member-only/memberOnlyUtils";
import { useMemberOnlyAccess, useMemberOnlyNutritionData } from "@/hooks/member-only/useMemberOnlyData";

export default function NutritionPage() {
  const access = useMemberOnlyAccess("Nutrition");
  const { user, hasMemberCardAccess } = access;
  const todayString = getTodayString();
  const data = useMemberOnlyNutritionData({ hasMemberCardAccess, role: user?.role, todayString, userId: user?.id });
  const activeNutrition = data.activeNutritionQuery.data ?? null;
  const dailySummary = data.dailySummaryQuery.data ?? null;
  const { logged, target } = getActiveNutritionTotals(activeNutrition, dailySummary);
  const targetCalories = target?.calories ?? 0;
  const calorieDelta = targetCalories - logged.calories;
  const hasActivePlan = data.subscriptionQuery.data?.status === "active";
  const isPremiumLocked = user?.role === "USER" && !data.subscriptionQuery.isPending && !hasActivePlan;
  const macroRows = formatMacroRows(logged, target);
  const alerts = getNutritionGuidanceAlerts(logged, target);
  const recommendedFoods = getRecommendedFoodCatalogItems(logged, target, 4);
  const logs = data.nutritionLogsQuery.data?.data ?? [];
  const history = data.nutritionHistoryQuery.data?.data ?? [];

  if (!hasMemberCardAccess) return <AccessGate featureName="Nutrition" icon={UtensilsCrossed} />;

  return (
    <MemberOnlyScreen>
      <MemberHero
        eyebrow={activeNutrition ? formatGoalLabel(activeNutrition.tdee.fitnessGoal) : "Daily nutrition"}
        title={targetCalories ? `${logged.calories} / ${targetCalories} kcal` : `${logged.calories} kcal logged`}
        subtitle={targetCalories ? formatCalorieDelta(logged.calories, targetCalories) : "Save a target to compare calories and macros."}
      >
        <MemberPill tone={calorieDelta < -150 ? "warning" : "success"}>
          {calorieDelta < -150 ? "Over target" : "On track"}
        </MemberPill>
      </MemberHero>

      {isPremiumLocked ? (
        <PremiumGate
          actionHref="/profile"
          actionLabel="Open Membership Details"
          icon={UtensilsCrossed}
          message="Premium nutrition coaching follows the same subscription state as mobile."
          statusLabel="Plan required"
          title="Advanced nutrition is locked"
        />
      ) : null}

      <MemberSection heading="Macros">
        <MemberSurface padded>
          {macroRows.map((row) => (
            <MemberProgressRow
              key={row.key}
              label={row.label}
              progress={row.target ? clampProgress(row.value / row.target) : 0}
              value={formatMacroDelta(row.target - row.value)}
              tone={row.target - row.value < -10 ? "warning" : "brand"}
            />
          ))}
        </MemberSurface>
      </MemberSection>

      <MemberSection heading="Guidance">
        <MemberGrid columns={2}>
          {alerts.slice(0, 2).map((alert) => (
            <MemberToneSurface key={alert.id} tone={alert.tone}>
              <MemberPanelHeader eyebrow={alert.eyebrow} title={alert.title} />
              <MemberText variant="muted">{alert.message}</MemberText>
            </MemberToneSurface>
          ))}
        </MemberGrid>
      </MemberSection>

      <MemberSection heading="Food Shelf">
        <MemberSurface>
          {recommendedFoods.map((item, index) => (
            <MemberCard
              key={item.name}
              hasBorder={index < recommendedFoods.length - 1}
              icon={UtensilsCrossed}
              label={item.name}
              subtitle={formatFoodSubtitle(item)}
              trailingLabel={getFoodTrailingLabel(item)}
              trailingTone="success"
            />
          ))}
        </MemberSurface>
      </MemberSection>

      <MemberSection heading="Logs">
        <MemberSurface>
          {logs.length === 0 ? (
            <EmptyState icon={UtensilsCrossed} title="No meals logged today" hint="Mobile and web logs will show here once saved." />
          ) : (
            logs.map((entry, index) => (
              <MemberCard
                key={entry.id}
                hasBorder={index < logs.length - 1}
                icon={UtensilsCrossed}
                label={entry.mealName}
                subtitle={formatNutritionLogSubtitle(entry)}
                trailingLabel={`${entry.calories} kcal`}
              />
            ))
          )}
        </MemberSurface>
      </MemberSection>

      <MemberSection heading="Recent Targets">
        <MemberSurface>
          {history.length === 0 ? (
            <EmptyState icon={Target} title="No target history" hint="Saved TDEE targets will appear here." />
          ) : (
            history.map((entry, index) => (
              <MemberCard
                key={entry.id}
                hasBorder={index < history.length - 1}
                icon={Target}
                label={formatGoalLabel(entry.fitnessGoal)}
                subtitle={formatShortDateTime(entry.createdAt)}
                trailingLabel={`${entry.tdeeCalories} kcal`}
              />
            ))
          )}
        </MemberSurface>
      </MemberSection>
    </MemberOnlyScreen>
  );
}
