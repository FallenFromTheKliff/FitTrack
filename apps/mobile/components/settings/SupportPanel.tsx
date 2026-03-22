import { useMemo } from "react";
import { View } from "react-native";

import { useTheme } from "@/contexts/ThemeContext";
import Animated from "react-native-reanimated";
import { useThemeTransition } from "@/hooks/animations/core/useThemeTransition";
import { HELP_FAQS, LEGAL_INFO_CARDS } from "@/data/settings";
import { makePrefModalStyles } from "@/styles/modals/PrefStyles";

import { FitText, AnimatedFitText } from "@/components/fit/FitText";
import FitButton from "@/components/fit/FitButton";

export function HelpPanel({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const { surfaceStyle, textMutedStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);

  return (
    <Animated.View style={[s.body, surfaceStyle]}>
      <AnimatedFitText style={[s.sectionLabel, textMutedStyle]}>FREQUENTLY ASKED</AnimatedFitText>
      {HELP_FAQS.map((item, i) => (
        <View key={i} style={s.infoCard}>
          <FitText style={s.infoCardTitle}>{item.q}</FitText>
          <FitText style={s.infoCardHint}>{item.a}</FitText>
        </View>
      ))}
      <View style={s.footer}>
        <FitButton label="Close" variant="ghost" onPress={onClose} flex={1} />
      </View>
    </Animated.View>
  );
}

export function TermsPanel({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const { surfaceStyle } = useThemeTransition();
  const s = useMemo(() => makePrefModalStyles(colors), [colors]);

  return (
    <Animated.View style={[s.body, surfaceStyle]}>
      {LEGAL_INFO_CARDS.map((card) => (
        <View key={card.title} style={s.infoCard}>
          <FitText style={s.infoCardTitle}>{card.title}</FitText>
          <FitText style={s.infoCardHint}>{card.body}</FitText>
        </View>
      ))}
      <View style={s.footer}>
        <FitButton label="Close" variant="ghost" onPress={onClose} flex={1} />
      </View>
    </Animated.View>
  );
}
