import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  PanResponder,
  Platform,
  Pressable,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent
} from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Dumbbell, ListChecks, SlidersHorizontal } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useDebounce } from "@fittrack/hooks";
import { makeExerciseModalStyles } from "@/styles/modals/ExerciseStyles";
import type { ExerciseReference } from "@/data/exercises";

import { FitText, FitTextInput } from "@/components/fit/FitText";
import FitSearch from "@/components/fit/FitSearch";
import FitButton from "@/components/fit/FitButton";
import FitModalScrollView from "@/components/modals/shared/FitModalScrollView";

const LEVEL_OPTIONS: { label: string; value: "all" | ExerciseReference["level"] }[] = [
  { label: "All", value: "all" },
  { label: "Beginner", value: "Beginner" },
  { label: "Intermediate", value: "Intermediate" },
  { label: "Advanced", value: "Advanced" }
];
const EMPTY_EXERCISE_REFERENCES: ExerciseReference[] = [];

type LoadInputUnit = "kg" | "lb";

type Props = {
  currentSelectionLabel?: string | null;
  emptyMessage?: string;
  isLoading?: boolean;
  isVisible: boolean;
  loadInputError?: string | null;
  loadInputSavedLabel?: string | null;
  loadInputUnit?: LoadInputUnit;
  loadInputValue?: string;
  loadInputVisible?: boolean;
  loadSliderMax?: number;
  loadSliderMin?: number;
  loadSliderValue?: number;
  onClose: () => void;
  onApplyLoadInput?: () => void;
  onChangeLoadInputUnit?: (unit: LoadInputUnit) => void;
  onChangeLoadInputValue?: (value: string) => void;
  onChangeLoadSliderValue?: (value: number) => void;
  onClearLoadInput?: () => void;
  onSelectReference?: (label: string) => void;
  onUseAutoDetect?: () => void;
  references?: ExerciseReference[];
};

type ExerciseModalStyles = ReturnType<typeof makeExerciseModalStyles>;

type LoadSliderProps = {
  max: number;
  min: number;
  onChange: (value: number) => void;
  s: ExerciseModalStyles;
  unit: LoadInputUnit;
  value: number;
};

function LoadSlider({ max, min, onChange, s, unit, value }: LoadSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const boundedMax = Math.max(min, max);
  const boundedValue = Math.min(boundedMax, Math.max(min, value));
  const progress =
    boundedMax === min ? 0 : (boundedValue - min) / (boundedMax - min);
  const accessibilityValueText = `${boundedValue} ${unit}`;
  const webSliderAriaProps =
    Platform.OS === "web"
      ? {
          "aria-valuemax": boundedMax,
          "aria-valuemin": min,
          "aria-valuenow": boundedValue,
          "aria-valuetext": accessibilityValueText
        }
      : {};

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const updateFromX = useCallback(
    (x: number) => {
      if (trackWidth <= 0) return;
      const ratio = Math.min(1, Math.max(0, x / trackWidth));
      onChange(Math.round(min + ratio * (boundedMax - min)));
    },
    [boundedMax, min, onChange, trackWidth],
  );

  const updateFromEvent = useCallback(
    (event: GestureResponderEvent) => {
      updateFromX(event.nativeEvent.locationX);
    },
    [updateFromX],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: () => true,
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: updateFromEvent,
        onPanResponderMove: updateFromEvent
      }),
    [updateFromEvent],
  );

  const handleAccessibilityAction = useCallback(
    (event: AccessibilityActionEvent) => {
      const delta = event.nativeEvent.actionName === "increment" ? 1 : -1;
      onChange(Math.min(boundedMax, Math.max(min, boundedValue + delta)));
    },
    [boundedMax, boundedValue, min, onChange],
  );

  return (
    <View style={s.loadSliderWrap}>
      <View style={s.loadSliderHeader}>
        <FitText style={s.loadSliderLabel}>Current load</FitText>
        <FitText style={s.loadSliderValue}>
          {boundedValue} {unit}
        </FitText>
      </View>
      <View
        accessibilityActions={[{ name: "decrement" }, { name: "increment" }]}
        accessibilityLabel="Current load"
        accessibilityRole="adjustable"
        accessibilityValue={{
          min,
          max: boundedMax,
          now: boundedValue,
          text: accessibilityValueText
        }}
        onAccessibilityAction={handleAccessibilityAction}
        onLayout={handleTrackLayout}
        style={s.loadSliderTrack}
        {...webSliderAriaProps}
        {...panResponder.panHandlers}
      >
        <View style={[s.loadSliderFill, { width: `${progress * 100}%` }]} />
        <View style={[s.loadSliderThumb, { left: `${progress * 100}%` }]} />
      </View>
      <View style={s.loadSliderScaleRow}>
        <FitText style={s.loadSliderLimit}>
          {min} {unit}
        </FitText>
        <FitText style={s.loadSliderLimit}>
          {boundedMax} {unit}
        </FitText>
      </View>
    </View>
  );
}

export default function ExerciseModal({
  currentSelectionLabel = null,
  emptyMessage = "No exercises match your search.",
  isLoading = false,
  isVisible,
  loadInputError = null,
  loadInputSavedLabel = null,
  loadInputUnit = "kg",
  loadInputValue = "",
  loadInputVisible = false,
  loadSliderMax = 1000,
  loadSliderMin = 1,
  loadSliderValue = 1,
  onClose,
  onApplyLoadInput,
  onChangeLoadInputUnit,
  onChangeLoadInputValue,
  onChangeLoadSliderValue,
  onClearLoadInput,
  onSelectReference,
  onUseAutoDetect,
  references
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, scale } = useOverlayAnim(isVisible, "scale");
  const s = useMemo(() => makeExerciseModalStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [activeLevel, setActiveLevel] = useState<"all" | ExerciseReference["level"]>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isLoadInputOpen, setIsLoadInputOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 250);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));

  const levelColor = (level: ExerciseReference["level"]) => {
    if (level === "Beginner") return colors.success;
    if (level === "Intermediate") return colors.warning;
    return colors.danger;
  };

  const sourceReferences = references ?? EMPTY_EXERCISE_REFERENCES;
  const canEditLoadInput =
    loadInputVisible &&
    !!onApplyLoadInput &&
    !!onChangeLoadInputUnit &&
    !!onChangeLoadInputValue &&
    !!onClearLoadInput;
  const canUseLoadSlider = canEditLoadInput && !!onChangeLoadSliderValue;
  const loadButtonLabel = loadInputSavedLabel
    ? `Load ${loadInputSavedLabel}`
    : "Set Load";

  const filteredReferences = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    return sourceReferences.filter((item) => {
      const matchesLevel = activeLevel === "all" || item.level === activeLevel;
      const matchesSearch =
          q.length === 0 ||
          item.name.toLowerCase().includes(q) ||
          item.muscleGroup.toLowerCase().includes(q);
      return matchesLevel && matchesSearch;
    });
  }, [activeLevel, debouncedQuery, sourceReferences]);

  useEffect(() => {
    if (!isVisible || !canEditLoadInput) {
      setIsLoadInputOpen(false);
    }
  }, [canEditLoadInput, isVisible]);

  const handleApplyLoadInput = () => {
    onApplyLoadInput?.();
    if (!loadInputError && loadInputValue.trim().length > 0) {
      setIsLoadInputOpen(false);
    }
  };

  return (
      <Modal
          visible={isVisible}
          transparent
          animationType="none"
          statusBarTranslucent
          onRequestClose={undefined}
      >
        <Animated.View style={[s.backdrop, backdropStyle]}>
          <Animated.View style={[s.card, cardStyle]}>
            <View style={s.header}>
              <View style={s.headerIcon}>
                <ListChecks size={18} color={colors.brand} strokeWidth={2} />
              </View>
              <FitText style={s.headerTitle}>Exercise References</FitText>
            </View>
            <View style={s.filtersArea}>
              <View style={s.filtersWrap}>
                <View style={s.searchFieldWrap}>
                  <FitSearch
                      placeholder="Search exercises or muscle groups..."
                      value={query}
                      onChangeText={setQuery}
                  />
                </View>
                <Pressable
                    onPress={() => setIsFilterOpen((o) => !o)}
                    style={s.filterBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter exercise references by level: ${
                      LEVEL_OPTIONS.find((opt) => opt.value === activeLevel)?.label ?? "All levels"
                    }`}
                    accessibilityState={{ expanded: isFilterOpen }}
                >
                  <SlidersHorizontal
                      size={20}
                      color={isFilterOpen ? colors.brand : colors.textMuted}
                      strokeWidth={2}
                  />
                </Pressable>
              </View>
              {isFilterOpen && (
                  <View style={s.filterOverlay}>
                    <FitText style={s.filterLabel}>Level</FitText>
                    <View style={s.filterOptions}>
                      {LEVEL_OPTIONS.map((opt) => {
                        const isActive = activeLevel === opt.value;
                        return (
                            <Pressable
                                key={opt.value}
                                style={[
                                  s.filterChip,
                                  isActive && { borderColor: colors.brand, backgroundColor: colors.brand + "18" }
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Show ${opt.label.toLowerCase()} exercise references`}
                                accessibilityState={{ selected: isActive }}
                                onPress={() => {
                                  setActiveLevel(opt.value);
                                  setIsFilterOpen(false);
                                }}
                            >
                              <FitText style={[s.filterChipText, isActive && { color: colors.brand, fontWeight: "600" }]}>
                                {opt.label}
                              </FitText>
                            </Pressable>
                        );
                      })}
                    </View>
                  </View>
              )}
            </View>
            <FitModalScrollView
                style={s.body}
                contentContainerStyle={s.listContent}
                resetKey={`${isVisible}-${activeLevel}-${debouncedQuery}`}
            >
              {isLoading ? (
                  <FitText style={s.emptyText}>Loading live exercise library...</FitText>
              ) : filteredReferences.length === 0 ? (
                  <FitText style={s.emptyText}>{emptyMessage}</FitText>
              ) : filteredReferences.map((item) => {
                const badgeColor = levelColor(item.level);
                const isSelected =
                  currentSelectionLabel?.trim().toLowerCase() === item.name.trim().toLowerCase();
                return (
                    <Pressable
                      key={item.id}
                      style={[
                        s.referenceCard,
                        onSelectReference
                          ? {
                              borderColor: isSelected ? colors.brand : colors.border,
                              backgroundColor: isSelected ? `${colors.brand}10` : colors.surfaceRaised
                            }
                          : null
                      ]}
                      disabled={!onSelectReference}
                      onPress={() => onSelectReference?.(item.name)}
                      accessibilityRole={onSelectReference ? "button" : undefined}
                      accessibilityLabel={`${item.name}, ${item.muscleGroup}, ${item.level}. ${
                        isSelected ? "Selected for tracking" : "Tap to use for tracking"
                      }`}
                      accessibilityState={{
                        disabled: !onSelectReference,
                        selected: isSelected,
                      }}
                    >
                      <View style={s.cardHeadRow}>
                        <View style={s.cardTitleWrap}>
                          <FitText style={s.referenceName}>{item.name}</FitText>
                          <FitText style={s.referenceGroup}>{item.muscleGroup}</FitText>
                        </View>
                        <View style={[s.levelBadge, { backgroundColor: `${badgeColor}22`, borderColor: badgeColor }]}>
                          <FitText style={[s.levelBadgeText, { color: badgeColor }]}>{item.level}</FitText>
                        </View>
                      </View>
                      <FitText style={s.referenceRecommendation}>{item.recommendation}</FitText>
                      {onSelectReference ? (
                        <FitText
                          style={{
                            color: isSelected ? colors.brand : colors.textMuted,
                            fontSize: 12,
                            fontWeight: "700",
                            marginTop: 10
                          }}
                        >
                          {isSelected ? "SELECTED FOR TRACKING" : "TAP TO USE FOR TRACKING"}
                        </FitText>
                      ) : null}
                    </Pressable>
                );
              })}
            </FitModalScrollView>
            {canEditLoadInput && isLoadInputOpen ? (
              <View style={s.loadPanel}>
                <View
                  style={[
                    s.loadInputWrap,
                    loadInputError ? { borderColor: colors.danger } : null
                  ]}
                >
                  <Dumbbell size={16} color={colors.textMuted} strokeWidth={2} />
                  <FitTextInput
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    onSubmitEditing={handleApplyLoadInput}
                    placeholder={`Load in ${loadInputUnit}`}
                    style={s.loadTextInput}
                    value={loadInputValue}
                    onChangeText={(value) => onChangeLoadInputValue?.(value)}
                  />
                </View>
                <View style={s.loadUnitRow}>
                  {(["kg", "lb"] as const).map((unit) => {
                    const isActive = loadInputUnit === unit;
                    return (
                      <Pressable
                        key={unit}
                        onPress={() => onChangeLoadInputUnit?.(unit)}
                        accessibilityRole="button"
                        accessibilityLabel={`Use ${unit} for workout load`}
                        accessibilityState={{ selected: isActive }}
                        style={[
                          s.loadUnitChip,
                          isActive && {
                            backgroundColor: colors.brand,
                            borderColor: colors.brand
                          }
                        ]}
                      >
                        <FitText
                          style={[
                            s.loadUnitText,
                            isActive && { color: colors.onBrand ?? "#FFFFFF" }
                          ]}
                        >
                          {unit}
                        </FitText>
                      </Pressable>
                    );
                  })}
                </View>
                {canUseLoadSlider ? (
                  <LoadSlider
                    max={loadSliderMax}
                    min={loadSliderMin}
                    onChange={onChangeLoadSliderValue}
                    s={s}
                    unit={loadInputUnit}
                    value={loadSliderValue}
                  />
                ) : null}
                {loadInputError ? (
                  <FitText style={s.loadErrorText}>{loadInputError}</FitText>
                ) : loadInputSavedLabel ? (
                  <FitText style={s.loadSavedText}>{loadInputSavedLabel}</FitText>
                ) : null}
                <View style={s.loadActions}>
                  <FitButton
                    label="Clear"
                    variant="ghost"
                    onPress={() => onClearLoadInput?.()}
                    style={s.footerAction}
                  />
                  <FitButton
                    label="Apply"
                    variant="ghost"
                    disabled={!!loadInputError || loadInputValue.trim().length === 0}
                    onPress={handleApplyLoadInput}
                    style={s.footerAction}
                  />
                </View>
              </View>
            ) : null}
            <View style={s.footer}>
              {canEditLoadInput ? (
                <FitButton
                  label={loadButtonLabel}
                  variant="ghost"
                  onPress={() => setIsLoadInputOpen((open) => !open)}
                  style={s.footerAction}
                />
              ) : null}
              {onUseAutoDetect ? (
                <FitButton
                  label="Auto Detect"
                  variant="ghost"
                  onPress={onUseAutoDetect}
                  style={s.footerAction}
                />
              ) : null}
              <FitButton label="Close" variant="ghost" onPress={onClose} style={s.footerAction} />
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
  );
}
