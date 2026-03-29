import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, { createAnimatedComponent, useSharedValue, useAnimatedStyle, useAnimatedReaction, withTiming, Easing } from "react-native-reanimated";
import { Dumbbell } from "lucide-react-native";
import { useTypewriter } from "@fittrack/hooks";

import { useTheme } from "@/contexts/ThemeContext";
import { useThemeTransitionAnim } from "@/hooks/animations/core/useThemeTransition";
import { FONT_FAMILIES, R } from "@fittrack/ui";

const ReanimatedText = createAnimatedComponent(Text);

const APP_NAME = "FitTrack";
const CHAR_INTERVAL = 45;
const POST_TYPE_HOLD = 300;

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
  const onBrand = colors.onBrand ?? "#FFFFFF";

  const iconScale = useSharedValue(0.4);
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

  useAnimatedReaction(
    () => doneSignal.value,
    (val) => { if (val === 1) onDone(); }
  );

  useEffect(() => {
    iconScale.value = withTiming(1, {
      duration: 140,
      easing: Easing.out(Easing.cubic)
    });
    contentOpacity.value = withTiming(1, { duration: 200 });
  }, []);

  const { typed } = useTypewriter({
    text: APP_NAME,
    isActive: fontsReady,
    intervalMs: CHAR_INTERVAL,
    onDone: () => setTypingDone(true)
  });

  useEffect(() => {
    if (!typingDone) return;
    const hold = setTimeout(() => {
      contentOpacity.value = withTiming(0, { duration: 200 });
      setTimeout(() => {
        doneSignal.value = 1;
      }, 200);
    }, POST_TYPE_HOLD);
    return () => clearTimeout(hold);
  }, [typingDone]);

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
            {typed}
          </ReanimatedText>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
