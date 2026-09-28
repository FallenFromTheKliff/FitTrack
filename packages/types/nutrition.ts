export type NutritionGender = "male" | "female" | "other";
export type NutritionActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type NutritionFitnessGoal = "bulking" | "cutting" | "maintenance" | "sport_specific";
export type NutritionUnit = "g" | "kg" | "ml" | "L" | "oz" | "lb" | "cup" | "tbsp" | "tsp" | "serving" | "piece";

export const NUTRITION_MEAL_ICON_LIBRARY_KEYS = [
  "apple",
  "beef",
  "coffee",
  "cookie",
  "dumbbell",
  "milk",
  "salad",
  "sandwich",
  "utensils"
] as const;

export type NutritionMealIconLibraryKey = (typeof NUTRITION_MEAL_ICON_LIBRARY_KEYS)[number];
export type NutritionIconKind = "library" | "custom";

export type NutritionLogIconInput = {
  assetKey?: string | null;
  key?: NutritionMealIconLibraryKey | null;
  kind: NutritionIconKind;
};

export type NutritionLogIconRecord = {
  assetKey: string | null;
  key: NutritionMealIconLibraryKey | null;
  kind: NutritionIconKind;
};

export const NUTRITION_MEAL_ICON_FALLBACKS: Record<string, NutritionMealIconLibraryKey> = {
  breakfast: "coffee",
  dinner: "beef",
  lunch: "sandwich",
  "post-workout": "apple",
  "pre-workout": "dumbbell",
  snack: "cookie"
};

export interface NutritionMacroTotalsRecord {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export type NutritionCoachingInsightPriority =
  | "info"
  | "opportunity"
  | "warning"
  | "recovery";

export type NutritionCoachingInsightSource =
  | "nutrition_summary"
  | "progression_summary";

export interface NutritionCoachingInsightRecord {
  id: string;
  message: string;
  priority: NutritionCoachingInsightPriority;
  reasonCodes: string[];
  source: NutritionCoachingInsightSource;
  title: string;
}

export interface NutritionTdeeRecord {
  id: string;
  userId: string;
  weightKg: number;
  heightCm: number;
  age: number;
  gender: NutritionGender;
  activityLevel: NutritionActivityLevel;
  fitnessGoal: NutritionFitnessGoal;
  bmrCalories: number;
  tdeeCalories: number;
  isActive: boolean;
  calculatedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface NutritionMacroTargetRecord {
  id: string;
  userId: string;
  tdeeProfileId: string;
  targetCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ActiveNutritionProfileRecord {
  tdee: NutritionTdeeRecord;
  macros: NutritionMacroTargetRecord;
}

export interface NutritionLogRecord {
  id: string;
  userId: string;
  macroTargetId: string | null;
  logDate: string;
  mealName: string;
  foodItem: string;
  icon: NutritionLogIconRecord;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  quantity: number;
  unit: NutritionUnit;
  createdAt: string;
  updatedAt: string;
}

export interface DailyNutritionSummaryRecord {
  coaching: NutritionCoachingInsightRecord[];
  date: string;
  macroTargetId: string | null;
  logged: NutritionMacroTotalsRecord;
  target: NutritionMacroTotalsRecord | null;
  remaining: NutritionMacroTotalsRecord | null;
}
