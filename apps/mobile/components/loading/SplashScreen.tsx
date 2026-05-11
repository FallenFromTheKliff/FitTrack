import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { createAnimatedComponent, useSharedValue, useAnimatedStyle, useAnimatedReaction, withTiming, withSequence, Easing, runOnJS } from "react-native-reanimated";
import { Dumbbell } from "lucide-react-native";
import { useTypewriter } from "@fittrack/hooks";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { FONT_FAMILIES } from "@fittrack/ui/styles";
import { R } from "@fittrack/ui/tokens";
const ReanimatedText = createAnimatedComponent(Text);

const APP_NAME = "FitTrack";
const SPLASH_DURATION_MS = 800;
const EXIT_FADE_MS = 200;
const TYPEWRITER_DURATION_MS = SPLASH_DURATION_MS - EXIT_FADE_MS;
const CHAR_INTERVAL = TYPEWRITER_DURATION_MS / APP_NAME.length;

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: R.xl,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  titleWrap: { width: 180 },
  title: { fontSize: 42, fontWeight: "700", letterSpacing: 1 }
});

type Props = {
  onDone: () => void;
  fontsReady: boolean;
};

export default function SplashScreen({ onDone, fontsReady }: Props) {
  const { activeFont, colors } = useTheme();
  const { ic } = useThemeTransitionAnim();
  const [typingDone, setTypingDone] = useState(false);
  const completedRef = useRef(false);
  const onBrand = colors.onBrand ?? "#FFFFFF";

  const iconScale = useSharedValue(0.52);
  const contentOpacity = useSharedValue(0);
  const doneSignal = useSharedValue(0);

  const iconScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }]
  }));
  const contentOpacityStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value
  }));
  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.base
  }));
  const titleStyle = useAnimatedStyle(() => ({
    color: ic.value.textPrimary
  }));
  const iconBoxStyle = useAnimatedStyle(() => ({
    backgroundColor: ic.value.brand
  }));

  const finishSplash = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onDone();
  }, [onDone]);

  useAnimatedReaction(
    () => doneSignal.value,
    (val, prev) => {
      if (val === 1 && prev !== 1) {
        runOnJS(finishSplash)();
      }
    },
    [finishSplash]
  );

  useEffect(() => {
    iconScale.value = withSequence(
      withTiming(1.12, {
        duration: 420,
        easing: Easing.out(Easing.cubic)
      }),
      withTiming(1, {
        duration: 160,
        easing: Easing.out(Easing.quad)
      })
    );
    contentOpacity.value = withTiming(1, { duration: 200 });
  }, [contentOpacity, iconScale]);

  const handleTypingDone = useCallback(() => {
    if (fontsReady) {
      setTypingDone(true);
    }
  }, [fontsReady]);

  const { typed } = useTypewriter({
    text: APP_NAME,
    isActive: fontsReady,
    intervalMs: CHAR_INTERVAL,
    onDone: handleTypingDone
  });

  useEffect(() => {
    if (!typingDone) return;
    contentOpacity.value = withTiming(0, { duration: EXIT_FADE_MS });
    const doneTimer = setTimeout(() => {
      doneSignal.value = 1;
    }, EXIT_FADE_MS);
    return () => clearTimeout(doneTimer);
  }, [contentOpacity, doneSignal, typingDone]);

  return (
    <Animated.View style={[s.container, containerStyle]}>
      <Animated.View style={[s.row, contentOpacityStyle]}>
        <Animated.View style={[s.iconBox, iconScaleStyle, iconBoxStyle]}>
          <Dumbbell size={26} color={onBrand} strokeWidth={2} />
        </Animated.View>
        <Animated.View style={s.titleWrap}>
          <ReanimatedText
            style={[s.title, titleStyle, { fontFamily: FONT_FAMILIES[activeFont] }]}
          >
            {fontsReady ? typed : ""}
          </ReanimatedText>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
