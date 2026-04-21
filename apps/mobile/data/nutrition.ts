import { TrendingUp, TrendingDown, Minus, type LucideIcon } from "lucide-react-native";

import type { NutritionMacroTotalsRecord, NutritionUnit } from "@fittrack/types";

export type GoalType = "bulking" | "cutting" | "maintain";
export type NutritionMealName = "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Pre-workout" | "Post-workout";
export type NutritionMacroFocus = "protein" | "carbs" | "fat" | "balance";
export type NutritionPickerOption<T extends string = string> = {
  label: string;
  value: T;
  description?: string;
};
export type NutritionFoodCatalogItem = {
  id: string;
  name: string;
  serving: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  focus: NutritionMacroFocus[];
  emoji: string;
  highlight: string;
};
export type NutritionGuidanceAlertTone = "brand" | "success" | "warning";
export type NutritionGuidanceAlert = {
  id: string;
  tone: NutritionGuidanceAlertTone;
  eyebrow: string;
  title: string;
  message: string;
};

export const GOAL_TYPES: { value: GoalType; label: string; Icon: LucideIcon }[] = [
  { value: "bulking", label: "Bulking", Icon: TrendingUp },
  { value: "cutting", label: "Cutting", Icon: TrendingDown },
  { value: "maintain", label: "Maintain", Icon: Minus }
];

export const MEAL_NAME_OPTIONS: NutritionPickerOption<NutritionMealName>[] = [
  { label: "Breakfast", value: "Breakfast", description: "Morning meals, coffee runs, and first bites of the day." },
  { label: "Lunch", value: "Lunch", description: "Midday meals, rice bowls, sandwiches, and quick breaks." },
  { label: "Dinner", value: "Dinner", description: "Your main evening meal or late-night plate." },
  { label: "Snack", value: "Snack", description: "Smaller bites, desserts, protein bars, or light refuels." },
  { label: "Pre-workout", value: "Pre-workout", description: "Fuel you had shortly before training." },
  { label: "Post-workout", value: "Post-workout", description: "Recovery meals or shakes after training." }
];

export const NUTRITION_UNIT_OPTIONS: NutritionPickerOption<NutritionUnit>[] = [
  { label: "Serving", value: "serving", description: "Best for packaged meals, recipes, or restaurant servings." },
  { label: "Piece", value: "piece", description: "Use when you can count whole items like eggs or bananas." },
  { label: "Grams (g)", value: "g", description: "Best for weighed solids and meal-prep portions." },
  { label: "Kilograms (kg)", value: "kg", description: "Use for bulk measurements of heavier items." },
  { label: "Milliliters (ml)", value: "ml", description: "Best for drinks, sauces, and liquid add-ons." },
  { label: "Liters (L)", value: "L", description: "Use for larger drink portions or pitchers." },
  { label: "Cup", value: "cup", description: "Helpful for oats, rice, cereal, soups, and home cooking." },
  { label: "Tablespoon (tbsp)", value: "tbsp", description: "Good for oils, peanut butter, dressings, and condiments." },
  { label: "Teaspoon (tsp)", value: "tsp", description: "Best for small add-ons like sugar, syrup, or spices." },
  { label: "Ounce (oz)", value: "oz", description: "Common for meats, snacks, and US nutrition labels." },
  { label: "Pound (lb)", value: "lb", description: "Best for larger bulk weights or full cuts." }
];

export const CURATED_FOOD_CATALOG: NutritionFoodCatalogItem[] = [
  {
    id: "greek-yogurt-power-cup",
    name: "Greek Yogurt Power Cup",
    serving: "170 g cup",
    calories: 170,
    proteinG: 17,
    carbsG: 12,
    fatG: 4,
    focus: ["protein", "balance"],
    emoji: "GY",
    highlight: "Fast protein support without blowing up your calories."
  },
  {
    id: "chicken-adobo-rice-bowl",
    name: "Chicken Adobo Rice Bowl",
    serving: "1 bowl",
    calories: 420,
    proteinG: 35,
    carbsG: 42,
    fatG: 12,
    focus: ["protein", "carbs"],
    emoji: "CA",
    highlight: "Balanced post-lift meal when both protein and carbs are lagging."
  },
  {
    id: "banana-oat-recovery-cup",
    name: "Banana Oat Recovery Cup",
    serving: "1 cup",
    calories: 310,
    proteinG: 8,
    carbsG: 58,
    fatG: 6,
    focus: ["carbs"],
    emoji: "BO",
    highlight: "Simple carb refill for low-energy or low-glycogen days."
  },
  {
    id: "peanut-butter-toast-stack",
    name: "Peanut Butter Toast Stack",
    serving: "2 slices",
    calories: 290,
    proteinG: 11,
    carbsG: 26,
    fatG: 16,
    focus: ["fat", "carbs"],
    emoji: "PB",
    highlight: "Useful when you need a compact calorie bump and healthy fats."
  },
  {
    id: "tuna-pandesal-pair",
    name: "Tuna Pandesal Pair",
    serving: "2 rolls",
    calories: 250,
    proteinG: 24,
    carbsG: 22,
    fatG: 7,
    focus: ["protein"],
    emoji: "TP",
    highlight: "Quick high-protein option that still feels like a real snack."
  },
  {
    id: "avocado-egg-wrap",
    name: "Avocado Egg Wrap",
    serving: "1 wrap",
    calories: 360,
    proteinG: 18,
    carbsG: 24,
    fatG: 20,
    focus: ["fat", "balance"],
    emoji: "AE",
    highlight: "Helps round out fats while keeping the meal satisfying."
  },
  {
    id: "whey-milk-shake",
    name: "Whey + Milk Shake",
    serving: "400 ml shake",
    calories: 220,
    proteinG: 28,
    carbsG: 15,
    fatG: 5,
    focus: ["protein"],
    emoji: "WM",
    highlight: "High-protein fallback when you need something fast after training."
  }
];

function getMacroGaps(logged: NutritionMacroTotalsRecord, target: NutritionMacroTotalsRecord) {
  return [
    {
      key: "protein" as const,
      label: "protein",
      delta: target.proteinG - logged.proteinG,
      threshold: 12
    },
    {
      key: "carbs" as const,
      label: "carbs",
      delta: target.carbsG - logged.carbsG,
      threshold: 18
    },
    {
      key: "fat" as const,
      label: "fats",
      delta: target.fatG - logged.fatG,
      threshold: 8
    }
  ].sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
}

export function getNutritionGuidanceAlerts(
  logged: NutritionMacroTotalsRecord,
  target: NutritionMacroTotalsRecord | null
): NutritionGuidanceAlert[] {
  if (!target) {
    return [
      {
        id: "baseline-open",
        tone: "brand",
        eyebrow: "FREE BASELINE",
        title: "Macro math is live before premium tools",
        message: "Calories and macros already update from your daily intake. Save a nutrition goal whenever you want live target comparisons and tighter coaching signals."
      }
    ];
  }

  const alerts: NutritionGuidanceAlert[] = [];
  const calorieDelta = target.calories - logged.calories;

  if (calorieDelta > 150) {
    alerts.push({
      id: "calories-under",
      tone: "brand",
      eyebrow: "UNDER TARGET",
      title: `${calorieDelta.toFixed(0)} kcal still open today`,
      message: "You're still below today's calorie target. A denser protein-plus-carb meal is the easiest way to close the gap without random snacking."
    });
  } else if (calorieDelta < -150) {
    alerts.push({
      id: "calories-over",
      tone: "warning",
      eyebrow: "OVER TARGET",
      title: `${Math.abs(calorieDelta).toFixed(0)} kcal over target`,
      message: "Today's intake is already above the calorie target. Favor leaner and lower-fat choices for the rest of the day if you want to settle back into range."
    });
  } else {
    alerts.push({
      id: "calories-steady",
      tone: "success",
      eyebrow: "ON TRACK",
      title: "Calories are sitting inside a healthy range",
      message: "You're close enough to target that the next meal should focus on whichever macro is still lagging rather than chasing calories alone."
    });
  }

  const topMacroGap = getMacroGaps(logged, target)[0];
  if (!topMacroGap) return alerts;

  if (topMacroGap.delta > topMacroGap.threshold) {
    alerts.push({
      id: `${topMacroGap.key}-under`,
      tone: "brand",
      eyebrow: "LOW MACRO",
      title: `${topMacroGap.delta.toFixed(0)}g of ${topMacroGap.label} still missing`,
      message: `Bias the next meal toward ${topMacroGap.label}. The recommendation shelf below is sorted to close that gap first.`
    });
  } else if (topMacroGap.delta < -topMacroGap.threshold) {
    alerts.push({
      id: `${topMacroGap.key}-over`,
      tone: "warning",
      eyebrow: "MACRO RUNNING HOT",
      title: `${Math.abs(topMacroGap.delta).toFixed(0)}g over on ${topMacroGap.label}`,
      message: `You've already pushed ${topMacroGap.label} past target. The next meal can ease off that macro and balance the rest of the plate instead.`
    });
  } else {
    alerts.push({
      id: "macro-balanced",
      tone: "success",
      eyebrow: "BALANCED MACROS",
      title: "Macro split is holding together",
      message: "Protein, carbs, and fats are all living near target. Use the food catalog as a stable starter shelf instead of trying to fix a big imbalance."
    });
  }

  return alerts;
}

export function getRecommendedFoodCatalogItems(
  logged: NutritionMacroTotalsRecord,
  target: NutritionMacroTotalsRecord | null,
  limit = 3
): NutritionFoodCatalogItem[] {
  const defaultShelf = CURATED_FOOD_CATALOG.filter((item) => item.focus.includes("balance")).slice(0, limit);
  if (!target) return defaultShelf.length > 0 ? defaultShelf : CURATED_FOOD_CATALOG.slice(0, limit);

  const positiveGaps = getMacroGaps(logged, target).filter((gap) => gap.delta > gap.threshold / 2);
  if (positiveGaps.length === 0) return defaultShelf.length > 0 ? defaultShelf : CURATED_FOOD_CATALOG.slice(0, limit);

  return CURATED_FOOD_CATALOG
    .map((item, index) => ({
      item,
      index,
      score: positiveGaps.reduce((score, gap, gapIndex) => {
        if (!item.focus.includes(gap.key)) return score;
        return score + (positiveGaps.length - gapIndex + 1);
      }, item.focus.includes("balance") ? 1 : 0)
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.item.calories - right.item.calories || left.index - right.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}
