import type { NutritionUnit } from "@fittrack/types";

export type NutritionMealName = "Breakfast" | "Lunch" | "Dinner" | "Snack" | "Pre-workout" | "Post-workout";
export type NutritionPickerOption<T extends string = string> = {
  label: string;
  value: T;
  description?: string;
};

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
