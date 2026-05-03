import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Dumbbell, SlidersHorizontal } from "lucide-react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";
import { useDebounce } from "@fittrack/hooks";
import { makeExerciseModalStyles } from "@/styles/modals/ExerciseStyles";
import { EXERCISE_REFERENCES, type ExerciseReference } from "@/data/exercises";

import { FitText } from "@/components/fit/FitText";
import FitSearch from "@/components/fit/FitSearch";
import FitButton from "@/components/fit/FitButton";

const LEVEL_OPTIONS: { label: string; value: "all" | ExerciseReference["level"] }[] = [
  { label: "All", value: "all" },
  { label: "Beginner", value: "Beginner" },
  { label: "Intermediate", value: "Intermediate" },
  { label: "Advanced", value: "Advanced" }
];

type Props = {
  currentSelectionLabel?: string | null;
  emptyMessage?: string;
  isLoading?: boolean;
  isVisible: boolean;
  onClose: () => void;
  onCreateFromSession?: () => void;
  createFromSessionDisabled?: boolean;
  onSelectReference?: (label: string) => void;
  onUseAutoDetect?: () => void;
  references?: ExerciseReference[];
};

export default function ExerciseModal({
  currentSelectionLabel = null,
  emptyMessage = "No exercises match your search.",
  isLoading = false,
  isVisible,
  onClose,
  onCreateFromSession,
  createFromSessionDisabled = false,
  onSelectReference,
  onUseAutoDetect,
  references
}: Props) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = useOverlayAnim(isVisible, "slideUp");
  const s = useMemo(() => makeExerciseModalStyles(colors), [colors]);
  const [query, setQuery] = useState("");
  const [activeLevel, setActiveLevel] = useState<"all" | ExerciseReference["level"]>("all");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 250);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border
  }));

  const levelColor = (level: ExerciseReference["level"]) => {
    if (level === "Beginner") return colors.success;
    if (level === "Intermediate") return colors.warning;
    return colors.danger;
  };

  const sourceReferences = references ?? EXERCISE_REFERENCES;

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
                <Dumbbell size={18} color={colors.brand} strokeWidth={2} />
              </View>
              <View style={s.headerTextWrap}>
                <FitText style={s.title}>Exercise References</FitText>
                <FitText style={s.subtitle}>Browse exercises by level and muscle group.</FitText>
              </View>
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
            <ScrollView
                style={s.body}
                contentContainerStyle={s.listContent}
                showsVerticalScrollIndicator={false}
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
            </ScrollView>
            <View style={s.footer}>
              {onCreateFromSession ? (
                <FitButton
                  disabled={createFromSessionDisabled}
                  label="Create Draft"
                  variant="ghost"
                  onPress={onCreateFromSession}
                  style={{ flex: 1 }}
                />
              ) : null}
              {onUseAutoDetect ? (
                <FitButton
                  label="Auto Detect"
                  variant="ghost"
                  onPress={onUseAutoDetect}
                  style={{ flex: 1 }}
                />
              ) : null}
              <FitButton label="Close" variant="ghost" onPress={onClose} style={{ flex: 1 }} />
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
  );
}
