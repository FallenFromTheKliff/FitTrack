import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Cpu } from "lucide-react-native";

import { R } from "@fittrack/ui/tokens";
import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { useOverlayAnim } from "@/hooks/animations/modal/useOverlayAnim";

import FitButton from "@/components/fit/FitButton";
import FitSearch from "@/components/fit/FitSearch";
import { FitText, FitTextInput } from "@/components/fit/FitText";

type ExerciseConfirmationModalProps = {
  candidateExercises: string[];
  currentPlanLabel: string | null;
  customLabel: string;
  isVisible: boolean;
  onChangeCustomLabel: (value: string) => void;
  onClose: () => void;
  onConfirm: (label: string) => void;
  savedExercises: string[];
};

export default function ExerciseConfirmationModal({
  candidateExercises,
  currentPlanLabel,
  customLabel,
  isVisible,
  onChangeCustomLabel,
  onClose,
  onConfirm,
  savedExercises
}: ExerciseConfirmationModalProps) {
  const { colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const { opacity, translateY } = useOverlayAnim(isVisible, "slideUp");
  const [query, setQuery] = useState("");

  const s = useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          alignItems: "center",
          backgroundColor: colors.overlay,
          flex: 1,
          justifyContent: "center",
          padding: 20
        },
        buttonRow: {
          flexDirection: "row",
          gap: 10
        },
        card: {
          borderColor: colors.border,
          borderRadius: R.xl,
          borderWidth: 1,
          maxHeight: "90%",
          overflow: "hidden",
          width: "100%"
        },
        chip: {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          borderRadius: R.md,
          borderWidth: 1,
          paddingHorizontal: 12,
          paddingVertical: 10
        },
        chipText: {
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: "600"
        },
        customRow: {
          alignItems: "center",
          flexDirection: "row",
          gap: 10
        },
        fieldCard: {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          borderRadius: R.lg,
          borderWidth: 1,
          gap: 10,
          padding: 12
        },
        footer: {
          borderTopColor: colors.border,
          borderTopWidth: 1,
          gap: 12,
          padding: 16
        },
        header: {
          borderBottomColor: colors.border,
          borderBottomWidth: 1,
          flexDirection: "row",
          gap: 12,
          padding: 16
        },
        headerBadge: {
          alignItems: "center",
          backgroundColor: `${colors.brand}18`,
          borderColor: `${colors.brand}40`,
          borderRadius: R.lg,
          borderWidth: 1,
          height: 42,
          justifyContent: "center",
          width: 42
        },
        headerCopy: {
          flex: 1,
          gap: 4
        },
        inputShell: {
          alignItems: "center",
          backgroundColor: colors.fieldBg,
          borderColor: colors.fieldBorder,
          borderRadius: R.md,
          borderWidth: 1,
          flex: 1,
          flexDirection: "row",
          paddingHorizontal: 12
        },
        savedList: {
          gap: 8,
          marginTop: 12
        },
        savedOption: {
          alignItems: "center",
          borderBottomColor: colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
          flexDirection: "row",
          justifyContent: "space-between",
          paddingBottom: 10
        },
        section: {
          gap: 10
        },
        sectionLabel: {
          color: colors.textPrimary,
          fontSize: 13,
          fontWeight: "700",
          letterSpacing: 0.3,
          textTransform: "uppercase"
        },
        scroll: {
          padding: 16
        },
        subtitle: {
          color: colors.textMuted,
          fontSize: 13,
          lineHeight: 19
        },
        suggestedWrap: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8
        },
        title: {
          color: colors.textPrimary,
          fontSize: 20,
          fontWeight: "700"
        }
      }),
    [colors]
  );

  const filteredSavedExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const deduped = Array.from(new Set(savedExercises));
    if (!normalizedQuery) return deduped.slice(0, 8);
    return deduped
      .filter((exercise) => exercise.toLowerCase().includes(normalizedQuery))
      .slice(0, 8);
  }, [query, savedExercises]);

  const candidateOptions = useMemo(() => {
    const used = new Set<string>();
    const options: string[] = [];

    if (currentPlanLabel?.trim()) {
      used.add(currentPlanLabel.trim().toLowerCase());
    }

    for (const candidate of candidateExercises) {
      const normalized = candidate.trim().toLowerCase();
      if (!normalized || used.has(normalized)) continue;
      used.add(normalized);
      options.push(candidate);
    }

    return options;
  }, [candidateExercises, currentPlanLabel]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.surface,
    borderColor: ic.value.border,
    transform: [{ translateY: translateY.value }]
  }));

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[s.backdrop, backdropStyle]}>
        <Animated.View style={[s.card, cardStyle]}>
          <View style={s.header}>
            <View style={s.headerBadge}>
              <Cpu size={18} color={colors.brand} strokeWidth={2} />
            </View>
            <View style={s.headerCopy}>
              <FitText style={s.title}>Confirm the live exercise</FitText>
              <FitText style={s.subtitle}>
                Auto rep counting is paused until this movement is labeled. Pick the best match so
                tracking can resume on the next keypoint batch.
              </FitText>
            </View>
          </View>

          <ScrollView style={s.scroll} contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
            {currentPlanLabel ? (
              <View style={s.section}>
                <FitText style={s.sectionLabel}>Current Plan</FitText>
                <View style={s.fieldCard}>
                  <FitText style={{ color: colors.textPrimary, fontSize: 16, fontWeight: "700" }}>
                    {currentPlanLabel}
                  </FitText>
                  <FitText style={s.subtitle}>
                    Use the planned exercise if this is the movement you are actually performing.
                  </FitText>
                  <FitButton
                    label="Use plan exercise"
                    variant="primary"
                    onPress={() => onConfirm(currentPlanLabel)}
                  />
                </View>
              </View>
            ) : null}

            {candidateOptions.length > 0 ? (
              <View style={s.section}>
                <FitText style={s.sectionLabel}>Suggested Matches</FitText>
                <View style={s.suggestedWrap}>
                  {candidateOptions.map((candidate) => (
                    <Pressable key={candidate} style={s.chip} onPress={() => onConfirm(candidate)}>
                      <FitText style={s.chipText}>{candidate.replace(/_/g, " ")}</FitText>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={s.section}>
              <FitText style={s.sectionLabel}>Choose Another Saved Exercise</FitText>
              <FitSearch
                placeholder="Search the live exercise catalog..."
                value={query}
                onChangeText={setQuery}
              />
              <View style={s.fieldCard}>
                {filteredSavedExercises.length > 0 ? (
                  <View style={s.savedList}>
                    {filteredSavedExercises.map((exercise) => (
                      <Pressable
                        key={exercise}
                        style={s.savedOption}
                        onPress={() => onConfirm(exercise)}
                      >
                        <FitText style={{ color: colors.textPrimary, fontSize: 15 }}>
                          {exercise}
                        </FitText>
                        <FitText style={{ color: colors.brand, fontSize: 12, fontWeight: "700" }}>
                          USE
                        </FitText>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <FitText style={s.subtitle}>
                    No saved exercises match that search yet. You can still enter a new label below.
                  </FitText>
                )}
              </View>
            </View>

            <View style={s.section}>
              <FitText style={s.sectionLabel}>Name a New Exercise</FitText>
              <View style={s.fieldCard}>
                <FitText style={s.subtitle}>
                  Use this when the live movement is new to the stack. The label will be reused on
                  the next analyze batch and can be learned into a preset at finalize.
                </FitText>
                <View style={s.customRow}>
                  <View style={s.inputShell}>
                    <FitTextInput
                      placeholder="e.g. Incline Push Up"
                      value={customLabel}
                      onChangeText={onChangeCustomLabel}
                    />
                  </View>
                  <FitButton
                    label="Use"
                    variant="primary"
                    disabled={customLabel.trim().length === 0}
                    onPress={() => onConfirm(customLabel)}
                  />
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={s.footer}>
            <View style={s.buttonRow}>
              <FitButton label="Keep Paused" variant="ghost" flex={1} onPress={onClose} />
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}
