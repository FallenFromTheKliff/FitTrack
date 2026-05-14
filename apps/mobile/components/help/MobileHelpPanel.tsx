import { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import { FitText } from "@/components/fit/FitText";

import type { MobileHelpContent } from "./mobileHelpContent";

type Props = {
  content: MobileHelpContent;
  onNeverShowAgain?: () => void;
  showNeverShowAgain?: boolean;
};

export default function MobileHelpPanel({
  content,
  onNeverShowAgain,
  showNeverShowAgain = false,
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(
    () =>
      StyleSheet.create({
        body: {
          gap: 14,
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 20,
        },
        description: {
          color: colors.textSecondary,
          fontSize: 13,
          lineHeight: 19,
        },
        section: {
          gap: 8,
        },
        sectionTitle: {
          color: colors.textMuted,
          fontSize: 11,
          fontWeight: "800",
          letterSpacing: 0.8,
          textTransform: "uppercase",
        },
        card: {
          gap: 8,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.surfaceRaised,
          paddingHorizontal: 12,
          paddingVertical: 12,
        },
        stepRow: {
          flexDirection: "row",
          gap: 10,
          alignItems: "flex-start",
        },
        stepNumber: {
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: colors.brand,
          color: colors.onBrand ?? "#FFFFFF",
          fontSize: 11,
          fontWeight: "900",
          lineHeight: 22,
          textAlign: "center",
        },
        stepText: {
          flex: 1,
          color: colors.textSecondary,
          fontSize: 13,
          lineHeight: 18,
        },
        termRow: {
          gap: 2,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: 9,
        },
        firstTerm: {
          borderTopWidth: 0,
          paddingTop: 0,
        },
        termLabel: {
          color: colors.textPrimary,
          fontSize: 13,
          fontWeight: "800",
        },
        termValue: {
          color: colors.textMuted,
          fontSize: 12,
          lineHeight: 17,
        },
        neverButton: {
          alignItems: "center",
          borderColor: colors.border,
          borderRadius: 14,
          borderWidth: 1,
          paddingHorizontal: 12,
          paddingVertical: 11,
        },
        neverText: {
          color: colors.textSecondary,
          fontSize: 13,
          fontWeight: "800",
        },
      }),
    [colors],
  );

  return (
    <View style={s.body}>
      <FitText style={s.description}>{content.description}</FitText>

      <View style={s.section}>
        <FitText style={s.sectionTitle}>How to use this page</FitText>
        <View style={s.card}>
          {content.steps.map((step, index) => (
            <View key={`${step}-${index}`} style={s.stepRow}>
              <FitText style={s.stepNumber}>{index + 1}</FitText>
              <FitText style={s.stepText}>{step}</FitText>
            </View>
          ))}
        </View>
      </View>

      <View style={s.section}>
        <FitText style={s.sectionTitle}>Key terms</FitText>
        <View style={s.card}>
          {content.terms.map((term, index) => (
            <View
              key={term.label}
              style={[s.termRow, index === 0 ? s.firstTerm : null]}
            >
              <FitText style={s.termLabel}>{term.label}</FitText>
              <FitText style={s.termValue}>{term.value}</FitText>
            </View>
          ))}
        </View>
      </View>

      {showNeverShowAgain ? (
        <Pressable
          accessibilityRole="button"
          onPress={onNeverShowAgain}
          style={s.neverButton}
        >
          <FitText style={s.neverText}>Never show this automatically again</FitText>
        </Pressable>
      ) : null}
    </View>
  );
}
