import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { FitText } from "@/components/fit/FitText";
import { useTheme } from "@/contexts/ThemeContext";

const DOT_STAGGER_MS = 140;
const DOT_TRAVEL_PX = -2;
const DOT_PHASE_MS = 360;

const styles = StyleSheet.create({
  root: {
    gap: 2,
  },
  label: {
    fontSize: 12,
    lineHeight: 16,
  },
  dotsRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
    paddingVertical: 2,
  },
  dot: {
    borderRadius: 4,
    height: 7,
    width: 7,
  },
});

type ThinkingDotProps = {
  color: string;
  index: number;
  reducedMotion: boolean;
};

function ThinkingDot({ color, index, reducedMotion }: ThinkingDotProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(progress);
    progress.value = 0;

    if (reducedMotion) {
      return () => cancelAnimation(progress);
    }

    progress.value = withDelay(
      index * DOT_STAGGER_MS,
      withRepeat(
        withSequence(
          ReduceMotion.Never,
          withTiming(1, {
            duration: DOT_PHASE_MS,
            easing: Easing.inOut(Easing.quad),
          }),
          withTiming(0, {
            duration: DOT_PHASE_MS,
            easing: Easing.inOut(Easing.quad),
          }),
        ),
        -1,
        false,
        undefined,
        ReduceMotion.Never,
      ),
      ReduceMotion.Never,
    );

    return () => cancelAnimation(progress);
  }, [index, progress, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.65,
    transform: [{ translateY: DOT_TRAVEL_PX * progress.value }],
  }));

  return (
    <Animated.View
      testID={`brodigyai-thinking-dot-${index + 1}`}
      style={[styles.dot, { backgroundColor: color }, animatedStyle]}
    />
  );
}

export default function BrodigyThinkingIndicator() {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();

  return (
    <View
      accessible
      accessibilityLabel="BrodigyAI is thinking"
      accessibilityLiveRegion="polite"
      accessibilityRole="text"
      accessibilityState={{ busy: true }}
      aria-busy={true}
      style={styles.root}
      testID="brodigyai-thinking-indicator"
    >
      <FitText style={[styles.label, { color: colors.textMuted }]}>
        BrodigyAI is thinking…
      </FitText>
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.dotsRow}
      >
        {[0, 1, 2].map((index) => (
          <ThinkingDot
            color={colors.textMuted}
            index={index}
            key={index}
            reducedMotion={reducedMotion}
          />
        ))}
      </View>
    </View>
  );
}
