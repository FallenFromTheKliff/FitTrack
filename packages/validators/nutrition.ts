import { z } from "zod";

import { ISO_DATE_PATTERN, requiredMemberDateOfBirthSchema } from "./profile";

const genderSchema = z.enum(["male", "female", "other"]);
const activityLevelSchema = z.enum(["sedentary", "light", "moderate", "active", "very_active"]);
const fitnessGoalSchema = z.enum(["bulking", "cutting", "maintenance", "sport_specific"]);
const nutritionUnitSchema = z.enum(["g", "kg", "ml", "L", "oz", "lb", "cup", "tbsp", "tsp", "serving", "piece"]);

const positiveNumberFromString = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value) && value > 0, `${label} must be greater than zero`)
    .refine((value) => value <= max, `${label} must not exceed ${max}`);

const nonNegativeNumberFromString = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .transform((value) => Number(value))
    .refine((value) => Number.isFinite(value) && value >= 0, `${label} must be zero or greater`)
    .refine((value) => value <= max, `${label} must not exceed ${max}`);

export const nutritionGoalSetupSchema = z.object({
  dateOfBirth: requiredMemberDateOfBirthSchema,
  weightKg: positiveNumberFromString("Weight", 500),
  heightCm: positiveNumberFromString("Height", 300),
  gender: genderSchema,
  activityLevel: activityLevelSchema,
  fitnessGoal: fitnessGoalSchema
});

export const nutritionLogSchema = z.object({
  logDate: z.string().regex(ISO_DATE_PATTERN, "Log date is required"),
  mealName: z.string().trim().min(1, "Meal name is required").max(100, "Meal name must not exceed 100 characters"),
  foodItem: z.string().trim().min(1, "Food item is required").max(255, "Food item must not exceed 255 characters"),
  calories: positiveNumberFromString("Calories", 10000),
  proteinG: nonNegativeNumberFromString("Protein", 1000),
  carbsG: nonNegativeNumberFromString("Carbs", 1000),
  fatG: nonNegativeNumberFromString("Fat", 1000),
  quantity: positiveNumberFromString("Quantity", 1000),
  unit: nutritionUnitSchema
});

export type NutritionGoalSetupData = z.infer<typeof nutritionGoalSetupSchema>;
export type NutritionLogData = z.infer<typeof nutritionLogSchema>;
