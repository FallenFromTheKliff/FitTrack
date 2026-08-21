import { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { ChevronDown } from "lucide-react-native";
import { R } from "@fittrack/ui/tokens";

import { useTheme } from "@/contexts/ThemeContext";
import { usePanelAnim } from "@/hooks/animations/ui/usePanelAnim";
import { FitText } from "@/components/fit/FitText";

import type {
  MobileHelpContent,
  MobileHelpDetailCard,
} from "./mobileHelpContent";

type Props = {
  content: MobileHelpContent;
};

type HelpPanelStyles = ReturnType<typeof makeStyles>;

function estimateDetailHeight(card: MobileHelpDetailCard) {
  const termCount = card.terms?.length ?? 0;
  return (
    22 +
    card.details.length * 74 +
    (termCount > 0 ? termCount * 58 + 16 : 0)
  );
}

function ExpandableHelpCard({
  card,
  index,
  isOpen,
  onPress,
  styles,
}: {
  card: MobileHelpDetailCard;
  index: number;
  isOpen: boolean;
  onPress: () => void;
  styles: HelpPanelStyles;
}) {
  const { colors } = useTheme();
  const everOpenedRef = useRef(false);
  const [measuredHeight, setMeasuredHeight] = useState(
    estimateDetailHeight(card),
  );

  if (isOpen) everOpenedRef.current = true;

  const { height, opacity } = usePanelAnim({
    duration: 220,
    targetHeight: measuredHeight,
    visible: isOpen,
  });
  const dropdownStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
    overflow: "hidden",
  }));

  return (
    <View style={styles.detailCardWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={onPress}
        style={[
          styles.detailTrigger,
          {
            backgroundColor: isOpen ? colors.brand + "12" : colors.surfaceRaised,
            borderColor: isOpen ? colors.brand + "66" : colors.border,
          },
        ]}
      >
        <View style={styles.detailTriggerCopy}>
          <FitText
            style={[
              styles.detailTriggerTitle,
              { color: isOpen ? colors.brand : colors.textPrimary },
            ]}
          >
            {index + 1}. {card.title}
          </FitText>
          <FitText style={styles.detailTriggerSubtitle}>{card.subtitle}</FitText>
        </View>
        <View
          style={[
            styles.chevronBadge,
            {
              backgroundColor: isOpen ? colors.brand + "18" : colors.surface,
              borderColor: isOpen ? colors.brand + "44" : colors.border,
            },
          ]}
        >
          <ChevronDown
            color={isOpen ? colors.brand : colors.textMuted}
            size={18}
            strokeWidth={2.2}
            style={{ transform: [{ rotate: isOpen ? "180deg" : "0deg" }] }}
          />
        </View>
      </Pressable>

      {everOpenedRef.current ? (
        <Animated.View style={[styles.detailDropdown, dropdownStyle]}>
          <View
            onLayout={(event) => {
              const nextHeight = Math.ceil(event.nativeEvent.layout.height);
              if (nextHeight > 0 && Math.abs(nextHeight - measuredHeight) > 2) {
                setMeasuredHeight(nextHeight);
              }
            }}
            style={styles.detailPanel}
          >
            {card.details.map((detail, detailIndex) => (
              <View
                key={`${card.title}-detail-${detailIndex}`}
                style={styles.detailRow}
              >
                <View style={styles.detailBullet} />
                <FitText style={styles.detailText}>{detail}</FitText>
              </View>
            ))}

            {card.terms?.length ? (
              <View style={styles.inlineTerms}>
                {card.terms.map((term) => (
                  <View
                    key={`${card.title}-${term.label}`}
                    style={styles.inlineTerm}
                  >
                    <FitText style={styles.termLabel}>{term.label}</FitText>
                    <FitText style={styles.termValue}>{term.value}</FitText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
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
    fabNote: {
      backgroundColor: colors.brand + "10",
      borderColor: colors.brand + "33",
      borderRadius: 14,
      borderWidth: 1,
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    fabNoteTitle: {
      color: colors.brand,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    fabNoteText: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 18,
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
    detailCardWrap: {
      gap: 6,
    },
    detailGrid: {
      gap: 8,
    },
    detailTrigger: {
      alignItems: "center",
      borderRadius: 14,
      borderWidth: 1,
      flexDirection: "row",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    detailTriggerCopy: {
      flex: 1,
      gap: 4,
    },
    detailTriggerTitle: {
      fontSize: 13,
      fontWeight: "800",
    },
    detailTriggerSubtitle: {
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 17,
    },
    chevronBadge: {
      alignItems: "center",
      borderRadius: R.md,
      borderWidth: 1,
      height: 32,
      justifyContent: "center",
      width: 32,
    },
    detailDropdown: {
      overflow: "hidden",
    },
    detailPanel: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      elevation: 6,
      gap: 12,
      padding: 14,
      boxShadow: "0 4px 12px rgba(0,0,0,0.16)",
    },
    detailRow: {
      alignItems: "flex-start",
      flexDirection: "row",
      gap: 9,
    },
    detailBullet: {
      backgroundColor: colors.brand,
      borderRadius: 4,
      height: 7,
      marginTop: 6,
      width: 7,
    },
    detailText: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
    },
    inlineTerms: {
      borderTopColor: colors.border,
      borderTopWidth: 1,
      gap: 10,
      paddingTop: 12,
    },
    inlineTerm: {
      gap: 2,
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
  });
}

function hasFabGuidance(content: MobileHelpContent) {
  const detailText =
    content.detailCards
      ?.flatMap((card) => [
        card.title,
        card.subtitle,
        ...card.details,
        ...(card.terms?.flatMap((term) => [term.label, term.value]) ?? []),
      ])
      .join(" ") ?? "";
  const text = [content.description, ...content.steps, detailText].join(" ");
  return /\bFAB\b|\+ button/i.test(text);
}

export default function MobileHelpPanel({
  content,
}: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const [openDetailIndex, setOpenDetailIndex] = useState<number | null>(null);
  const showFabNote = hasFabGuidance(content);

  return (
    <View style={s.body}>
      <FitText style={s.description}>{content.description}</FitText>
      {showFabNote ? (
        <View style={s.fabNote}>
          <FitText style={s.fabNoteTitle}>FAB</FitText>
          <FitText style={s.fabNoteText}>
            FAB means Floating Action Button: the round quick-action button near
            the bottom corner. Open it for this screen's shortcuts, then choose
            the action that matches your next task.
          </FitText>
        </View>
      ) : null}

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

      {content.detailCards?.length ? (
        <View style={s.section}>
          <FitText style={s.sectionTitle}>
            {content.detailTitle ?? "Detailed guides"}
          </FitText>
          {content.detailIntro ? (
            <FitText style={s.description}>{content.detailIntro}</FitText>
          ) : null}
          <View style={s.detailGrid}>
            {content.detailCards.map((card, index) => (
              <ExpandableHelpCard
                key={card.title}
                card={card}
                index={index}
                isOpen={openDetailIndex === index}
                onPress={() =>
                  setOpenDetailIndex((current) =>
                    current === index ? null : index,
                  )
                }
                styles={s}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
