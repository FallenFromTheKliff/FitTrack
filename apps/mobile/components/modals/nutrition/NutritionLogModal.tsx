import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, Check, ChevronDown, Plus, Scale, Search, UtensilsCrossed } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { createNutritionLogMutationOptions, nutritionLogsQueryOptions } from "@fittrack/query";
import type { NutritionLogRecord, NutritionUnit, ThemeColors } from "@fittrack/types";
import { nutritionLogSchema, type NutritionLogData } from "@fittrack/validators";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useLoadingText } from "@fittrack/hooks";
import { getTodayString } from "@/data/bookings";
import {
  MEAL_NAME_OPTIONS,
  NUTRITION_UNIT_OPTIONS,
  type NutritionMealName,
  type NutritionPickerOption
} from "@/data/nutrition";
import { formatLongDate } from "@fittrack/utils";
import { mobileApiClient } from "@/lib/api-client";
import { makeGoalsModalStyles } from "@/styles/modals/GoalsStyles";
import { MAX_WIDTH, R } from "@fittrack/ui/tokens";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type NutritionLogFieldErrors = Partial<Record<keyof NutritionLogData, string[]>>;
type LogStep = "choice" | "form";
type PickerSheet = "meal" | "unit";

const localStyles = StyleSheet.create({
  choiceAction: {
    paddingHorizontal: 16,
    paddingBottom: 12
  },
  previousMealCopy: {
    flex: 1,
    gap: 2
  },
  previousMealIcon: {
    marginTop: 2
  },
  previousMealList: {
    gap: 8
  }
});

function sanitizeDecimalInput(value: string) {
  const sanitized = value.replace(/[^0-9.]/g, "");
  const [whole = "", ...fractionParts] = sanitized.split(".");
  const hasDecimal = sanitized.includes(".");
  const fraction = fractionParts.join("").slice(0, 2);

  if (!hasDecimal) return whole;

  if (fraction.length === 0) return `${whole}.`;

  return `${whole}.${fraction}`;
}

function getSelectedOption<T extends string>(
  options: readonly NutritionPickerOption<T>[],
  value: T | ""
) {
  return options.find((option) => option.value === value);
}

function getKnownMealName(value: string): NutritionMealName | "" {
  return MEAL_NAME_OPTIONS.some((option) => option.value === value)
    ? (value as NutritionMealName)
    : "";
}

function toFieldValue(value: number) {
  return Number.isFinite(value) ? String(value) : "";
}

function getPreviousMealSubtitle(entry: NutritionLogRecord) {
  return `${entry.mealName} | ${entry.calories.toFixed(0)} kcal | P ${entry.proteinG.toFixed(0)} C ${entry.carbsG.toFixed(0)} F ${entry.fatG.toFixed(0)}`;
}

function getPreviousMealSearchText(entry: NutritionLogRecord) {
  const unitOption = getSelectedOption(NUTRITION_UNIT_OPTIONS, entry.unit);
  return [
    entry.foodItem,
    entry.mealName,
    entry.unit,
    unitOption?.label,
    getPreviousMealSubtitle(entry),
    `${entry.quantity} ${entry.unit}`,
    `calories ${entry.calories.toFixed(0)} kcal`,
    `protein ${entry.proteinG.toFixed(0)} p`,
    `carbs ${entry.carbsG.toFixed(0)} c`,
    `fat ${entry.fatG.toFixed(0)} f`
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

type OptionSheetModalProps<T extends string> = {
  isVisible: boolean;
  title: string;
  subtitle: string;
  options: readonly NutritionPickerOption<T>[];
  selectedValue: T | "";
  onSelect: (value: T) => void;
  onClose: () => void;
};

function makeOptionSheetStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 20
    },
    card: {
      width: "100%",
      maxWidth: MAX_WIDTH,
      maxHeight: "76%",
      borderRadius: R.xl,
      borderWidth: 1,
      overflow: "hidden"
    },
    header: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      borderBottomWidth: 1,
      gap: 4
    },
    title: {
      fontSize: 16,
      fontWeight: "700",
      color: colors.textPrimary
    },
    subtitle: {
      fontSize: 12,
      color: colors.textMuted,
      lineHeight: 18
    },
    body: {
      paddingHorizontal: 16,
      paddingVertical: 16,
      gap: 10
    },
    optionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      borderRadius: R.lg,
      borderWidth: 1
    },
    optionCopy: {
      flex: 1,
      gap: 2
    },
    optionLabel: {
      fontSize: 14,
      fontWeight: "600"
    },
    optionDescription: {
      fontSize: 12,
      lineHeight: 18
    },
    footer: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 18,
      borderTopWidth: 1
    }
  });
}

function OptionSheetModal<T extends string>({
  isVisible,
  title,
  subtitle,
  options,
  selectedValue,
  onSelect,
  onClose
}: OptionSheetModalProps<T>) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const sheetStyles = useMemo(() => makeOptionSheetStyles(colors), [colors]);

  const backdropStyle = useAnimatedStyle(() => ({ backgroundColor: ic.value.overlay }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  return (
    <Modal visible={isVisible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[sheetStyles.backdrop, backdropStyle]}>
        <Animated.View style={[sheetStyles.card, cardStyle]}>
          <Animated.View style={[sheetStyles.header, headerBorderStyle]}>
            <FitText style={sheetStyles.title}>{title}</FitText>
            <FitText style={sheetStyles.subtitle}>{subtitle}</FitText>
          </Animated.View>
          <FitModalScrollView
            contentContainerStyle={sheetStyles.body}
            resetKey={isVisible}
          >
            {options.map((option) => {
              const isActive = option.value === selectedValue;
              return (
                <Pressable
                  key={option.value}
                  style={[
                    sheetStyles.optionRow,
                    {
                      borderColor: isActive ? colors.brand : colors.fieldBorder,
                      backgroundColor: isActive ? colors.brand + "14" : colors.fieldBg
                    }
                  ]}
                  onPress={() => onSelect(option.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}: ${option.label}`}
                  accessibilityState={{ selected: isActive }}
                >
                  <View style={sheetStyles.optionCopy}>
                    <FitText
                      style={[
                        sheetStyles.optionLabel,
                        { color: isActive ? colors.brand : colors.textPrimary }
                      ]}
                    >
                      {option.label}
                    </FitText>
                    {option.description ? (
                      <FitText
                        style={[
                          sheetStyles.optionDescription,
                          { color: isActive ? colors.brand : colors.textMuted }
                        ]}
                      >
                        {option.description}
                      </FitText>
                    ) : null}
                  </View>
                  {isActive ? <Check size={18} color={colors.brand} strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
          </FitModalScrollView>
          <Animated.View style={[sheetStyles.footer, footerBorderStyle]}>
            <FitButton label="Done" variant="ghost" onPress={onClose} flex={1} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

export default function NutritionLogModal({ isVisible, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { ic } = useThemeTransitionAnim();
  const s = useMemo(() => makeGoalsModalStyles(colors), [colors]);

  const [step, setStep] = useState<LogStep>("choice");
  const [previousMealSearch, setPreviousMealSearch] = useState("");
  const [logDate, setLogDate] = useState(getTodayString());
  const [mealName, setMealName] = useState<NutritionMealName | "">("");
  const [foodItem, setFoodItem] = useState("");
  const [calories, setCalories] = useState("");
  const [proteinG, setProteinG] = useState("");
  const [carbsG, setCarbsG] = useState("");
  const [fatG, setFatG] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<NutritionUnit>("serving");
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerSheet | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<NutritionLogFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const savingText = useLoadingText("Saving", isSubmitting);

  const createLogMutation = useMutation(createNutritionLogMutationOptions(mobileApiClient, queryClient));
  const {
    data: recentLogs = { data: [], meta: { page: 1, limit: 12, total: 0, total_pages: 0 } },
    isFetching: isRecentLogsLoading
  } = useQuery({
    ...nutritionLogsQueryOptions<NutritionLogRecord>(mobileApiClient, user?.id, {
      page: 1,
      limit: 12
    }),
    enabled: isVisible && !!user?.id
  });
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");

  const previousMeals = useMemo(() => {
    const seen = new Set<string>();
    return recentLogs.data.filter((entry) => {
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
    }).slice(0, 6);
  }, [recentLogs.data]);

  const previousMealSearchTerm = previousMealSearch.trim().toLowerCase();
  const filteredPreviousMeals = useMemo(() => {
    if (!previousMealSearchTerm) return previousMeals;
    return previousMeals.filter((entry) => getPreviousMealSearchText(entry).includes(previousMealSearchTerm));
  }, [previousMeals, previousMealSearchTerm]);

  useEffect(() => {
    if (!isVisible) return;
    setStep("choice");
    setPreviousMealSearch("");
    setLogDate(getTodayString());
    setMealName("");
    setFoodItem("");
    setCalories("");
    setProteinG("");
    setCarbsG("");
    setFatG("");
    setQuantity("1");
    setUnit("serving");
    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(false);
    setIsCalOpen(false);
    setActivePicker(null);
  }, [isVisible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  const handleClose = () => {
    setStep("choice");
    setPreviousMealSearch("");
    setSubmitError(null);
    setFieldErrors({});
    setIsSubmitting(false);
    setActivePicker(null);
    onClose();
  };

  const handleStartNewMeal = () => {
    setLogDate(getTodayString());
    setMealName("");
    setFoodItem("");
    setCalories("");
    setProteinG("");
    setCarbsG("");
    setFatG("");
    setQuantity("1");
    setUnit("serving");
    setFieldErrors({});
    setSubmitError(null);
    setActivePicker(null);
    setIsCalOpen(false);
    setStep("form");
  };

  const handleUsePreviousMeal = (entry: NutritionLogRecord) => {
    setLogDate(getTodayString());
    setMealName(getKnownMealName(entry.mealName));
    setFoodItem(entry.foodItem);
    setCalories(toFieldValue(entry.calories));
    setProteinG(toFieldValue(entry.proteinG));
    setCarbsG(toFieldValue(entry.carbsG));
    setFatG(toFieldValue(entry.fatG));
    setQuantity(toFieldValue(entry.quantity));
    setUnit(entry.unit);
    setFieldErrors({});
    setSubmitError(null);
    setActivePicker(null);
    setIsCalOpen(false);
    setStep("form");
  };

  const handleBackToPreviousMeals = () => {
    setSubmitError(null);
    setFieldErrors({});
    setIsSubmitting(false);
    setActivePicker(null);
    setIsCalOpen(false);
    setStep("choice");
  };

  const clearFieldError = (field: keyof NutritionLogData) => {
    setFieldErrors((previous) => ({ ...previous, [field]: undefined }));
  };

  const macroFields: {
    key: keyof Pick<NutritionLogData, "calories" | "proteinG" | "carbsG" | "fatG">;
    label: string;
    placeholder: string;
    value: string;
    setter: (nextValue: string) => void;
  }[] = [
    {
      key: "calories",
      label: "Calories",
      placeholder: "Calories for this meal, e.g. 420",
      value: calories,
      setter: setCalories
    },
    {
      key: "proteinG",
      label: "Protein (g)",
      placeholder: "Protein in grams, e.g. 32",
      value: proteinG,
      setter: setProteinG
    },
    {
      key: "carbsG",
      label: "Carbs (g)",
      placeholder: "Carbs in grams, e.g. 48",
      value: carbsG,
      setter: setCarbsG
    },
    {
      key: "fatG",
      label: "Fat (g)",
      placeholder: "Fat in grams, e.g. 12",
      value: fatG,
      setter: setFatG
    }
  ];

  const selectedMealOption = getSelectedOption(MEAL_NAME_OPTIONS, mealName);
  const selectedUnitOption = getSelectedOption(NUTRITION_UNIT_OPTIONS, unit);

  const handleSubmit = async () => {
    const parsed = nutritionLogSchema.safeParse({
      logDate,
      mealName,
      foodItem,
      calories,
      proteinG,
      carbsG,
      fatG,
      quantity,
      unit
    });

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as NutritionLogFieldErrors);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await createLogMutation.mutateAsync({
        payload: {
          logDate: parsed.data.logDate,
          mealName: parsed.data.mealName,
          foodItem: parsed.data.foodItem,
          calories: parsed.data.calories,
          proteinG: parsed.data.proteinG,
          carbsG: parsed.data.carbsG,
          fatG: parsed.data.fatG,
          quantity: parsed.data.quantity,
          unit: parsed.data.unit
        },
        userId: user?.id
      });
      onSuccess();
      handleClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save nutrition log.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="none" statusBarTranslucent onRequestClose={handleClose}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View style={[s.card, cardStyle]}>
          <Animated.View style={[s.header, headerBorderStyle]}>
            <View style={s.headerIcon}>
              <Plus size={18} color={colors.brand} strokeWidth={2} />
            </View>
            <View style={s.headerText}>
              <FitText style={s.headerTitle}>Log Meal</FitText>
              <FitText style={s.headerSubtitle}>
                {step === "choice"
                  ? "Choose a previous meal or start fresh"
                  : "Save today's nutrition to the live backend"}
              </FitText>
            </View>
          </Animated.View>
          <FitModalScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.body}
            resetKey={`${isVisible}-${step}`}
          >
            {step === "choice" ? (
              <>
                <View style={s.sectionGap}>
                  <FitText style={s.sectionLabel}>SEARCH PREVIOUS MEALS</FitText>
                  <View style={s.inputFieldWrap}>
                    <Search size={16} color={colors.textMuted} strokeWidth={2} />
                    <FitTextInput
                      nativeID="nutrition-log-previous-meal-search"
                      accessibilityLabel="Search previous meals"
                      style={s.inputField}
                      placeholder="Search food, meal, unit, or macros"
                      value={previousMealSearch}
                      onChangeText={setPreviousMealSearch}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                  </View>
                </View>

                <View style={s.sectionGap}>
                  <FitText style={s.sectionLabel}>PREVIOUS MEALS</FitText>
                  <View style={localStyles.previousMealList}>
                    {isRecentLogsLoading && previousMeals.length === 0 ? (
                      <View style={[s.readOnlyRow, { alignItems: "flex-start" }]}>
                        <View style={{ flex: 1 }}>
                          <FitText style={s.readOnlyValue}>Loading previous meals</FitText>
                          <FitText style={[s.fieldNote, { marginTop: 3, paddingHorizontal: 0 }]}>
                            Recent logs will appear here when the backend finishes loading.
                          </FitText>
                        </View>
                      </View>
                    ) : filteredPreviousMeals.length > 0 ? (
                      filteredPreviousMeals.map((entry) => (
                        <Pressable
                          key={entry.id}
                          accessibilityRole="button"
                          onPress={() => handleUsePreviousMeal(entry)}
                          style={[s.fieldBtn, { alignItems: "flex-start", borderColor: colors.fieldBorder }]}
                        >
                          <UtensilsCrossed
                            size={16}
                            color={colors.brand}
                            strokeWidth={2}
                            style={localStyles.previousMealIcon}
                          />
                          <View style={localStyles.previousMealCopy}>
                            <FitText
                              numberOfLines={1}
                              style={[s.fieldBtnText, { color: colors.textPrimary, fontWeight: "700" }]}
                            >
                              {entry.foodItem}
                            </FitText>
                            <FitText style={[s.fieldNote, { marginTop: 0, paddingHorizontal: 0 }]}>
                              {getPreviousMealSubtitle(entry)}
                            </FitText>
                          </View>
                        </Pressable>
                      ))
                    ) : (
                      <View style={[s.readOnlyRow, { alignItems: "flex-start" }]}>
                        <View style={{ flex: 1 }}>
                          <FitText style={s.readOnlyValue}>
                            {previousMealSearchTerm ? "No matching meals" : "No previous meals yet"}
                          </FitText>
                          <FitText style={[s.fieldNote, { marginTop: 3, paddingHorizontal: 0 }]}>
                            {previousMealSearchTerm
                              ? "Try a food item, meal type, unit, or macro number."
                              : "Log a new meal once and it can appear here for faster future entries."}
                          </FitText>
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              </>
            ) : (
              <>
            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>LOG DATE</FitText>
              <Pressable
                style={[s.fieldBtn, logDate ? { borderColor: colors.brand } : { borderColor: colors.fieldBorder }]}
                onPress={() => setIsCalOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Log date: ${logDate ? formatLongDate(logDate) : "not selected"}`}
                accessibilityState={{ expanded: isCalOpen }}
              >
                <CalendarDays size={16} color={logDate ? colors.brand : colors.textMuted} strokeWidth={2} />
                <FitText style={[s.fieldBtnText, logDate ? { color: colors.brand } : null]}>
                  {logDate ? formatLongDate(logDate) : "Select log date"}
                </FitText>
              </Pressable>
              {fieldErrors.logDate?.[0] ? (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>{fieldErrors.logDate[0]}</FitText>
              ) : (
                <FitText style={s.fieldNote}>Choose the day this meal should count toward.</FitText>
              )}
            </View>

            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>MEAL TYPE</FitText>
              <Pressable
                style={[
                  s.fieldBtn,
                  fieldErrors.mealName?.[0]
                    ? { borderColor: colors.danger }
                    : mealName
                      ? { borderColor: colors.brand }
                      : { borderColor: colors.fieldBorder }
                ]}
                onPress={() => setActivePicker("meal")}
                accessibilityRole="button"
                accessibilityLabel={`Meal type: ${selectedMealOption?.label ?? "not selected"}`}
                accessibilityState={{ expanded: activePicker === "meal" }}
              >
                <UtensilsCrossed size={16} color={mealName ? colors.brand : colors.textMuted} strokeWidth={2} />
                <FitText style={[s.fieldBtnText, mealName ? { color: colors.textPrimary } : null]}>
                  {selectedMealOption?.label ?? "Choose a meal type"}
                </FitText>
                <ChevronDown size={16} color={mealName ? colors.brand : colors.textMuted} strokeWidth={2} />
              </Pressable>
              {fieldErrors.mealName?.[0] ? (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>{fieldErrors.mealName[0]}</FitText>
              ) : (
                <FitText style={s.fieldNote}>Pick the meal bucket first so your saved log is easier to scan later.</FitText>
              )}
            </View>

            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>FOOD ITEM</FitText>
              <View style={[s.inputFieldWrap, fieldErrors.foodItem?.[0] ? { borderColor: colors.danger } : null]}>
                <UtensilsCrossed size={16} color={colors.textMuted} strokeWidth={2} />
                <FitTextInput
                  nativeID="nutrition-log-food-item"
                  accessibilityLabel="Food item"
                  style={s.inputField}
                  placeholder="What did you eat? e.g. Chicken breast"
                  value={foodItem}
                  onChangeText={(value) => {
                    setFoodItem(value);
                    clearFieldError("foodItem");
                    setSubmitError(null);
                  }}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={255}
                  returnKeyType="done"
                />
              </View>
              {fieldErrors.foodItem?.[0] ? (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>{fieldErrors.foodItem[0]}</FitText>
              ) : (
                <FitText style={s.fieldNote}>Use the actual food, brand, or recipe name you want to remember.</FitText>
              )}
            </View>

            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>MACROS</FitText>
              {macroFields.map((field) => (
                <View key={field.key} style={{ marginBottom: 8 }}>
                  <FitText style={[s.fieldNote, { marginTop: 0, marginBottom: 4, paddingHorizontal: 0 }]}>
                    {field.label}
                  </FitText>
                  <View style={[s.inputFieldWrap, fieldErrors[field.key]?.[0] ? { borderColor: colors.danger } : null]}>
                    <FitTextInput
                      nativeID={`nutrition-log-${field.key}`}
                      accessibilityLabel={field.label}
                      style={s.inputField}
                      placeholder={field.placeholder}
                      value={field.value}
                      onChangeText={(value) => {
                        field.setter(sanitizeDecimalInput(value));
                        clearFieldError(field.key);
                        setSubmitError(null);
                      }}
                      keyboardType="decimal-pad"
                      returnKeyType="done"
                    />
                  </View>
                  {fieldErrors[field.key]?.[0] ? (
                    <FitText style={[s.fieldNote, { color: colors.danger }]}>{fieldErrors[field.key]?.[0]}</FitText>
                  ) : null}
                </View>
              ))}
            </View>

            <View style={[s.sectionGap, { marginBottom: 20 }]}>
              <FitText style={s.sectionLabel}>PORTION</FitText>
              <View style={[s.inputFieldWrap, fieldErrors.quantity?.[0] ? { borderColor: colors.danger } : null]}>
                <FitTextInput
                  nativeID="nutrition-log-quantity"
                  accessibilityLabel="Portion quantity"
                  style={s.inputField}
                  placeholder="How much did you have? e.g. 1.5"
                  value={quantity}
                  onChangeText={(value) => {
                    setQuantity(sanitizeDecimalInput(value));
                    clearFieldError("quantity");
                    setSubmitError(null);
                  }}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
              {fieldErrors.quantity?.[0] ? (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>{fieldErrors.quantity[0]}</FitText>
              ) : (
                <FitText style={s.fieldNote}>Fractions work too, so 0.5 or 1.5 is fine.</FitText>
              )}
              <View style={{ height: 8 }} />
              <Pressable
                style={[
                  s.fieldBtn,
                  fieldErrors.unit?.[0] ? { borderColor: colors.danger } : { borderColor: colors.brand }
                ]}
                onPress={() => setActivePicker("unit")}
                accessibilityRole="button"
                accessibilityLabel={`Portion unit: ${selectedUnitOption?.label ?? "not selected"}`}
                accessibilityState={{ expanded: activePicker === "unit" }}
              >
                <Scale size={16} color={colors.brand} strokeWidth={2} />
                <FitText style={[s.fieldBtnText, { color: colors.textPrimary }]}>
                  {selectedUnitOption?.label ?? "Choose a portion unit"}
                </FitText>
                <ChevronDown size={16} color={colors.brand} strokeWidth={2} />
              </Pressable>
              {fieldErrors.unit?.[0] ? (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>{fieldErrors.unit[0]}</FitText>
              ) : (
                <FitText style={s.fieldNote}>Pick the unit that matches how you measured the portion.</FitText>
              )}
              {submitError ? (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>{submitError}</FitText>
              ) : null}
            </View>
              </>
            )}
          </FitModalScrollView>
          {step === "choice" ? (
            <View style={localStyles.choiceAction}>
              <FitButton
                label="New Log Meal"
                variant="primary"
                icon={Plus}
                iconSize={16}
                onPress={handleStartNewMeal}
              />
            </View>
          ) : null}
          <Animated.View style={[s.footer, footerBorderStyle]}>
            {step === "choice" ? (
              <FitButton label="Cancel" variant="ghost" onPress={handleClose} flex={1} />
            ) : (
              <>
                <FitButton
                  label="Back"
                  variant="ghost"
                  onPress={handleBackToPreviousMeals}
                  disabled={isSubmitting}
                  flex={1}
                />
                <FitButton
                  label={isSubmitting ? savingText : "Save Log"}
                  variant="primary"
                  icon={Plus}
                  iconSize={16}
                  onPress={handleSubmit}
                  disabled={isSubmitting}
                  loading={isSubmitting}
                  flex={2}
                />
              </>
            )}
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <CalendarModal
        isVisible={step === "form" && isCalOpen}
        selectedDate={logDate}
        blockPast={false}
        defaultYear={new Date().getFullYear()}
        defaultMonth={new Date().getMonth() + 1}
        onSelect={(date) => {
          setLogDate(date);
          clearFieldError("logDate");
          setIsCalOpen(false);
        }}
        onClose={() => setIsCalOpen(false)}
      />
      <OptionSheetModal
        isVisible={step === "form" && activePicker === "meal"}
        title="Choose meal type"
        subtitle="Pick the meal window that best matches this log."
        options={MEAL_NAME_OPTIONS}
        selectedValue={mealName}
        onSelect={(value) => {
          setMealName(value);
          clearFieldError("mealName");
          setSubmitError(null);
          setActivePicker(null);
        }}
        onClose={() => setActivePicker(null)}
      />
      <OptionSheetModal
        isVisible={step === "form" && activePicker === "unit"}
        title="Choose portion unit"
        subtitle="Use the measurement that best matches how you tracked this portion."
        options={NUTRITION_UNIT_OPTIONS}
        selectedValue={unit}
        onSelect={(value) => {
          setUnit(value);
          clearFieldError("unit");
          setSubmitError(null);
          setActivePicker(null);
        }}
        onClose={() => setActivePicker(null)}
      />
    </Modal>
  );
}
