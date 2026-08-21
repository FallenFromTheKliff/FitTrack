import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { CalendarDays, Dumbbell, Target } from "lucide-react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { MemberProfile } from "@fittrack/types";
import {
  getLatestAllowedMemberBirthDate,
  nutritionGoalSetupSchema,
  type NutritionGoalSetupData
} from "@fittrack/validators";
import { recalculateNutritionMutationOptions, updateProfileMutationOptions } from "@fittrack/query";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useLoadingText } from "@fittrack/hooks";
import { getTodayString } from "@/data/bookings";
import { formatLongDate } from "@fittrack/utils";
import { mobileApiClient } from "@/lib/api-client";
import { makeGoalsModalStyles } from "@/styles/modals/GoalsStyles";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";
import CalendarModal from "@/components/modals/shared/CalendarModal";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";

type NutritionFieldErrors = Partial<Record<keyof NutritionGoalSetupData, string[]>>;
type GenderValue = "male" | "female" | "other";
type ActivityLevelValue = "sedentary" | "light" | "moderate" | "active" | "very_active";
type FitnessGoalValue = "bulking" | "cutting" | "maintenance" | "sport_specific";

export type NutritionGoal = {
  id: string;
  name: string;
  type: "bulking" | "cutting" | "maintain";
  weightKg: number;
  currentCalories: number;
  targetCalories: number;
  dueDate: string;
};

type Props = {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const GENDER_OPTIONS = [
  { label: "Male", value: "male" as const },
  { label: "Female", value: "female" as const },
  { label: "Other", value: "other" as const }
];

const ACTIVITY_OPTIONS = [
  { label: "Sedentary", value: "sedentary" as const },
  { label: "Light", value: "light" as const },
  { label: "Moderate", value: "moderate" as const },
  { label: "Active", value: "active" as const },
  { label: "Very Active", value: "very_active" as const }
];

const GOAL_OPTIONS = [
  { label: "Bulk", value: "bulking" as const },
  { label: "Cut", value: "cutting" as const },
  { label: "Maintain", value: "maintenance" as const },
  { label: "Sport", value: "sport_specific" as const }
];

function normalizeProfilePatch(
  previous: MemberProfile | undefined,
  payload: NutritionGoalSetupData
): MemberProfile {
  return {
    ...(previous ?? {}),
    dateOfBirth: payload.dateOfBirth,
    gender: payload.gender,
    activityLevel: payload.activityLevel,
    fitnessGoal: payload.fitnessGoal,
    currentWeightKg: payload.weightKg,
    heightCm: payload.heightCm
  };
}

function pickProfileValue<T>(
  directValue: T | null | undefined,
  profileValue: T | null | undefined,
  fallback: T
) {
  return directValue ?? profileValue ?? fallback;
}

function toInputNumber(value?: number | null) {
  return value != null ? String(value) : "";
}

function toDateOnlyInput(value?: string | null) {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
}

function isGenderValue(value?: string | null): value is GenderValue {
  return GENDER_OPTIONS.some((option) => option.value === value);
}

function isActivityLevelValue(value?: string | null): value is ActivityLevelValue {
  return ACTIVITY_OPTIONS.some((option) => option.value === value);
}

function isFitnessGoalValue(value?: string | null): value is FitnessGoalValue {
  return GOAL_OPTIONS.some((option) => option.value === value);
}

export default function GoalsModal({ isVisible, onClose, onSuccess }: Props) {
  const { colors } = useTheme();
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const { ic } = useThemeTransitionAnim();
  const s = useMemo(() => makeGoalsModalStyles(colors), [colors]);

  const [dateOfBirth, setDateOfBirth] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [gender, setGender] = useState<GenderValue>("male");
  const [activityLevel, setActivityLevel] = useState<ActivityLevelValue>("moderate");
  const [fitnessGoal, setFitnessGoal] = useState<FitnessGoalValue>("maintenance");
  const [isCalOpen, setIsCalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<NutritionFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const savingText = useLoadingText("Saving", isSubmitting);
  const latestAllowedBirthDate = useMemo(() => getLatestAllowedMemberBirthDate(), []);

  const updateProfileMutation = useMutation(updateProfileMutationOptions(mobileApiClient));
  const recalculateMutation = useMutation(recalculateNutritionMutationOptions(mobileApiClient, queryClient));

  const { opacity, scale } = useOverlayAnim(isVisible, "scale");

  useEffect(() => {
    if (!isVisible) return;
    const profile = user?.profile;
    const nextGender = pickProfileValue(user?.gender, profile?.gender, "male");
    const nextActivityLevel = pickProfileValue(user?.activityLevel, profile?.activityLevel, "moderate");
    const nextFitnessGoal = pickProfileValue(user?.fitnessGoal, profile?.fitnessGoal, "maintenance");

    setDateOfBirth(toDateOnlyInput(pickProfileValue(user?.dateOfBirth, profile?.dateOfBirth, "")));
    setWeightKg(toInputNumber(user?.weightKg ?? profile?.currentWeightKg));
    setHeightCm(toInputNumber(user?.heightCm ?? profile?.heightCm));
    setGender(isGenderValue(nextGender) ? nextGender : "male");
    setActivityLevel(isActivityLevelValue(nextActivityLevel) ? nextActivityLevel : "moderate");
    setFitnessGoal(isFitnessGoalValue(nextFitnessGoal) ? nextFitnessGoal : "maintenance");
    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(false);
    setIsCalOpen(false);
  }, [
    isVisible,
    user?.activityLevel,
    user?.dateOfBirth,
    user?.fitnessGoal,
    user?.gender,
    user?.heightCm,
    user?.profile,
    user?.weightKg
  ]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));
  const headerBorderStyle = useAnimatedStyle(() => ({ borderBottomColor: ic.value.border }));
  const footerBorderStyle = useAnimatedStyle(() => ({ borderTopColor: ic.value.border }));

  const resetAndClose = () => {
    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(false);
    setIsCalOpen(false);
    onClose();
  };

  const handleSubmit = async () => {
    const parsed = nutritionGoalSetupSchema.safeParse({
      dateOfBirth,
      weightKg,
      heightCm,
      gender,
      activityLevel,
      fitnessGoal
    });

    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors as NutritionFieldErrors);
      return;
    }

    setFieldErrors({});
    setSubmitError(null);
    setIsSubmitting(true);

    try {
      await updateProfileMutation.mutateAsync({
        dateOfBirth: parsed.data.dateOfBirth,
        currentWeightKg: parsed.data.weightKg,
        heightCm: parsed.data.heightCm,
        gender: parsed.data.gender,
        activityLevel: parsed.data.activityLevel,
        fitnessGoal: parsed.data.fitnessGoal
      });
      await recalculateMutation.mutateAsync({
        payload: {
          gender: parsed.data.gender,
          activityLevel: parsed.data.activityLevel,
          fitnessGoal: parsed.data.fitnessGoal,
          weightKg: parsed.data.weightKg,
          heightCm: parsed.data.heightCm
        },
        userId: user?.id
      });
      await updateUser({
        dateOfBirth: parsed.data.dateOfBirth,
        weightKg: parsed.data.weightKg,
        heightCm: parsed.data.heightCm,
        gender: parsed.data.gender,
        activityLevel: parsed.data.activityLevel,
        fitnessGoal: parsed.data.fitnessGoal,
        profile: normalizeProfilePatch(user?.profile, parsed.data)
      });
      onSuccess();
      resetAndClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to save nutrition target.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={isVisible} transparent animationType="none" statusBarTranslucent onRequestClose={resetAndClose}>
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View style={[s.card, cardStyle]}>
          <Animated.View style={[s.header, headerBorderStyle]}>
            <View style={s.headerIcon}>
              <Target size={18} color={colors.brand} strokeWidth={2} />
            </View>
            <View style={s.headerText}>
              <FitText style={s.headerTitle}>Set Nutrition Target</FitText>
              <FitText style={s.headerSubtitle}>Save your profile metrics and recalculate live macros</FitText>
            </View>
          </Animated.View>
          <FitModalScrollView
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.body}
            resetKey={isVisible}
          >
            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>DATE OF BIRTH</FitText>
              <Pressable
                style={[s.fieldBtn, dateOfBirth ? { borderColor: colors.brand } : { borderColor: colors.fieldBorder }]}
                onPress={() => setIsCalOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Date of birth: ${dateOfBirth ? formatLongDate(dateOfBirth) : "not selected"}`}
                accessibilityHint="Opens the birth date picker"
                accessibilityState={{ expanded: isCalOpen }}
              >
                <CalendarDays size={16} color={dateOfBirth ? colors.brand : colors.textMuted} strokeWidth={2} />
                <FitText style={[s.fieldBtnText, dateOfBirth ? { color: colors.brand } : {}]}>
                  {dateOfBirth ? formatLongDate(dateOfBirth) : "Select your birth date"}
                </FitText>
              </Pressable>
              {fieldErrors.dateOfBirth?.[0] ? (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>{fieldErrors.dateOfBirth[0]}</FitText>
              ) : (
                <FitText style={s.fieldNote}>Required for the TDEE calculation.</FitText>
              )}
            </View>

            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>BODY METRICS</FitText>
              <View style={[s.inputFieldWrap, fieldErrors.weightKg?.[0] ? { borderColor: colors.danger } : null]}>
                <Dumbbell size={16} color={colors.textMuted} strokeWidth={2} />
                <FitTextInput
                  nativeID="nutrition-target-weight-kg"
                  accessibilityLabel="Weight in kg"
                  style={s.inputField}
                  placeholder="Weight in kg"
                  value={weightKg}
                  onChangeText={(value) => {
                    setWeightKg(value.replace(/[^0-9.]/g, ""));
                    setFieldErrors((previous) => ({ ...previous, weightKg: undefined }));
                  }}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
              {fieldErrors.weightKg?.[0] ? (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>{fieldErrors.weightKg[0]}</FitText>
              ) : null}
              <View style={{ height: 8 }} />
              <View style={[s.inputFieldWrap, fieldErrors.heightCm?.[0] ? { borderColor: colors.danger } : null]}>
                <Dumbbell size={16} color={colors.textMuted} strokeWidth={2} />
                <FitTextInput
                  nativeID="nutrition-target-height-cm"
                  accessibilityLabel="Height in cm"
                  style={s.inputField}
                  placeholder="Height in cm"
                  value={heightCm}
                  onChangeText={(value) => {
                    setHeightCm(value.replace(/[^0-9.]/g, ""));
                    setFieldErrors((previous) => ({ ...previous, heightCm: undefined }));
                  }}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
              {fieldErrors.heightCm?.[0] ? (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>{fieldErrors.heightCm[0]}</FitText>
              ) : null}
            </View>

            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>GENDER</FitText>
              <View style={s.goalTypeRow}>
                {GENDER_OPTIONS.map((option) => {
                  const isActive = gender === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        s.goalTypePill,
                        {
                          borderColor: isActive ? colors.brand : colors.fieldBorder,
                          backgroundColor: isActive ? colors.brand + "18" : colors.fieldBg
                        }
                      ]}
                      onPress={() => setGender(option.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose gender: ${option.label}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <FitText style={[s.goalTypePillText, { color: isActive ? colors.brand : colors.textMuted }]}>
                        {option.label}
                      </FitText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={s.sectionGap}>
              <FitText style={s.sectionLabel}>ACTIVITY LEVEL</FitText>
              <View style={{ gap: 8 }}>
                {ACTIVITY_OPTIONS.map((option) => {
                  const isActive = activityLevel === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        s.goalTypePill,
                        {
                          justifyContent: "flex-start",
                          borderColor: isActive ? colors.brand : colors.fieldBorder,
                          backgroundColor: isActive ? colors.brand + "18" : colors.fieldBg
                        }
                      ]}
                      onPress={() => setActivityLevel(option.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose activity level: ${option.label}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <FitText style={[s.goalTypePillText, { color: isActive ? colors.brand : colors.textMuted }]}>
                        {option.label}
                      </FitText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[s.sectionGap, { marginBottom: 20 }]}>
              <FitText style={s.sectionLabel}>FITNESS GOAL</FitText>
              <View style={{ gap: 8 }}>
                {GOAL_OPTIONS.map((option) => {
                  const isActive = fitnessGoal === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      style={[
                        s.goalTypePill,
                        {
                          justifyContent: "flex-start",
                          borderColor: isActive ? colors.brand : colors.fieldBorder,
                          backgroundColor: isActive ? colors.brand + "18" : colors.fieldBg
                        }
                      ]}
                      onPress={() => setFitnessGoal(option.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose fitness goal: ${option.label}`}
                      accessibilityState={{ selected: isActive }}
                    >
                      <FitText style={[s.goalTypePillText, { color: isActive ? colors.brand : colors.textMuted }]}>
                        {option.label}
                      </FitText>
                    </Pressable>
                  );
                })}
              </View>
              <FitText style={s.fieldNote}>
                {`Today: ${formatLongDate(getTodayString())}. The backend will recompute your live macro target immediately.`}
              </FitText>
              {submitError ? (
                <FitText style={[s.fieldNote, { color: colors.danger }]}>{submitError}</FitText>
              ) : null}
            </View>
          </FitModalScrollView>
          <Animated.View style={[s.footer, footerBorderStyle]}>
            <FitButton label="Cancel" variant="ghost" onPress={resetAndClose} flex={1} />
            <FitButton
              label={isSubmitting ? savingText : "Save Target"}
              variant="primary"
              icon={Target}
              iconSize={16}
              onPress={handleSubmit}
              disabled={isSubmitting}
              loading={isSubmitting}
              flex={2}
            />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <CalendarModal
        isVisible={isCalOpen}
        selectedDate={dateOfBirth}
        blockPast={false}
        maxDate={latestAllowedBirthDate}
        defaultYear={2000}
        defaultMonth={1}
        onSelect={(date) => {
          setDateOfBirth(date);
          setFieldErrors((previous) => ({ ...previous, dateOfBirth: undefined }));
          setIsCalOpen(false);
        }}
        onClose={() => setIsCalOpen(false)}
      />
    </Modal>
  );
}
